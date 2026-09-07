import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  buildAndroidAssociation,
  buildAppleAssociation,
  handleRequest,
} from './index.js'

const CALLBACK = 'https://periodus.app/auth/openrouter'
const FINGERPRINT = Array.from({ length: 32 }, (_, index) =>
  index.toString(16).padStart(2, '0'),
)
  .join(':')
  .toUpperCase()

describe('OAuth callback fallback', () => {
  it('does not echo callback data, auto-redirect, cache, or allow network calls', async () => {
    const secretCode = 'sensitive-authorization-code'
    const response = handleRequest(
      new Request(`${CALLBACK}?code=${secretCode}&key=must-not-forward`),
    )
    const html = await response.text()

    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toContain('no-store')
    expect(response.headers.get('referrer-policy')).toBe('no-referrer')
    expect(response.headers.get('x-periodus-openrouter-callback')).toBe('v1')
    expect(response.headers.get('content-security-policy')).toContain(
      "connect-src 'none'",
    )
    expect(html).not.toContain(secretCode)
    expect(html).not.toContain('must-not-forward')
    expect(html).toContain("'periodus://openrouter/callback?'")
    expect(html.indexOf("addEventListener('click'")).toBeLessThan(
      html.indexOf('window.location.assign'),
    )
  })

  it('does not read request bodies or accept mutating methods', async () => {
    const response = handleRequest(
      new Request(CALLBACK, { method: 'POST', body: 'code=do-not-read' }),
    )
    expect(response.status).toBe(405)
    expect(response.headers.get('allow')).toBe('GET, HEAD')
    expect(await response.text()).not.toContain('do-not-read')
  })

  it('returns headers without a body for HEAD', async () => {
    const response = handleRequest(new Request(CALLBACK, { method: 'HEAD' }))
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toContain('text/html')
    expect(await response.text()).toBe('')
  })
})

describe('mobile association endpoints', () => {
  it('serves the checked-in Apple association exactly', async () => {
    const expectedFile = JSON.parse(
      await readFile(
        fileURLToPath(
          new URL(
            '../associations/apple-app-site-association',
            import.meta.url,
          ),
        ),
        'utf8',
      ),
    )
    const expectedRuntime = buildAppleAssociation()
    expect(expectedRuntime).toEqual(expectedFile)

    const response = handleRequest(
      new Request(
        'https://periodus.app/.well-known/apple-app-site-association',
      ),
    )
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('application/json')
    expect(await response.json()).toEqual(expectedFile)
  })

  it('rejects invalid Apple signing configuration', () => {
    expect(
      buildAppleAssociation({
        APPLE_TEAM_ID: 'NOT-A-TEAM',
        APPLE_BUNDLE_ID: 'app.periodus.mobile',
      }),
    ).toBeNull()
  })

  it('requires a real Android signing fingerprint instead of inventing one', async () => {
    const response = handleRequest(
      new Request('https://periodus.app/.well-known/assetlinks.json'),
      {
        ANDROID_PACKAGE_NAME: 'app.periodus.mobile',
        ANDROID_SHA256_CERT_FINGERPRINTS: '',
      },
    )
    expect(response.status).toBe(503)
    expect(await response.json()).toMatchObject({
      error: 'association_not_configured',
    })
  })

  it('serves Android App Links for configured signing fingerprints', () => {
    expect(
      buildAndroidAssociation({
        ANDROID_PACKAGE_NAME: 'app.periodus.mobile',
        ANDROID_SHA256_CERT_FINGERPRINTS: FINGERPRINT,
      }),
    ).toEqual([
      {
        relation: ['delegate_permission/common.handle_all_urls'],
        target: {
          namespace: 'android_app',
          package_name: 'app.periodus.mobile',
          sha256_cert_fingerprints: [FINGERPRINT],
        },
      },
    ])
  })
})
