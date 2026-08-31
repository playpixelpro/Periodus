import { describe, it, expect, beforeEach } from 'vitest'
import {
  setSecureSecret,
  getSecureSecret,
  deleteSecureSecret,
  clearSecureSecrets,
  SECURE_SECRET_KEYS,
  secureVaultStatus,
} from './secureVault'

describe('secureVault persistence', () => {
  beforeEach(async () => {
    await clearSecureSecrets()
  })

  it('persists and retrieves an API key across reads', async () => {
    await setSecureSecret(SECURE_SECRET_KEYS.openAiApiKey, 'sk-proj-test1234567890')
    const retrieved = await getSecureSecret(SECURE_SECRET_KEYS.openAiApiKey)
    expect(retrieved).toBe('sk-proj-test1234567890')
  })

  it('persists multiple distinct provider keys', async () => {
    await setSecureSecret(SECURE_SECRET_KEYS.anthropicApiKey, 'sk-ant-api03-testkey')
    await setSecureSecret(SECURE_SECRET_KEYS.customAiApiKey, 'ollama-bearer-key')

    expect(await getSecureSecret(SECURE_SECRET_KEYS.anthropicApiKey)).toBe('sk-ant-api03-testkey')
    expect(await getSecureSecret(SECURE_SECRET_KEYS.customAiApiKey)).toBe('ollama-bearer-key')
  })

  it('correctly updates and overwrites an existing key', async () => {
    await setSecureSecret(SECURE_SECRET_KEYS.openAiApiKey, 'sk-initial-key')
    expect(await getSecureSecret(SECURE_SECRET_KEYS.openAiApiKey)).toBe('sk-initial-key')

    await setSecureSecret(SECURE_SECRET_KEYS.openAiApiKey, 'sk-updated-key')
    expect(await getSecureSecret(SECURE_SECRET_KEYS.openAiApiKey)).toBe('sk-updated-key')
  })

  it('deletes a secret when explicitly requested', async () => {
    await setSecureSecret(SECURE_SECRET_KEYS.openAiApiKey, 'sk-key-to-delete')
    await deleteSecureSecret(SECURE_SECRET_KEYS.openAiApiKey)
    expect(await getSecureSecret(SECURE_SECRET_KEYS.openAiApiKey)).toBeNull()
  })

  it('returns valid vault status', async () => {
    const status = await secureVaultStatus()
    expect(status.available).toBe(true)
    expect(status.platform).toBeDefined()
  })
})
