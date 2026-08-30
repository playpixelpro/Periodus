/**
 * GitHub Releases updater.
 *
 * Queries the GitHub Releases API for the latest published release of the
 * app and compares it against the bundled APP_VERSION.  The result is
 * intentionally structured so the UI can show a rich changelog and a direct
 * download link without any additional network round-trips.
 *
 * No authentication is required: the GitHub Releases API endpoint for the
 * latest release of a public repository is freely accessible.
 */

import { APP_VERSION, GITHUB_REPO } from './version'

/** Result returned when there is nothing to do. */
export interface UpdateResultCurrent {
  status: 'current'
  currentVersion: string
  latestVersion: string
}

/** Result returned when a newer version exists on GitHub. */
export interface UpdateResultAvailable {
  status: 'available'
  currentVersion: string
  latestVersion: string
  /** Human-readable tag, e.g. "v1.2.3" */
  tagName: string
  /** Markdown release notes from the GitHub release body. */
  releaseNotes: string
  /** Direct download URL for the APK asset. */
  apkUrl: string
  /** GitHub release HTML page, used as a fallback. */
  releaseUrl: string
  /** ISO-8601 publish timestamp of the release. */
  publishedAt: string
}

/** Result returned when the check failed (network error, rate limit, etc.). */
export interface UpdateResultError {
  status: 'error'
  message: string
}

export type UpdateResult = UpdateResultCurrent | UpdateResultAvailable | UpdateResultError

// ---------------------------------------------------------------------------
// Semver comparison
// ---------------------------------------------------------------------------

/**
 * Parse a version string such as "1.2.3" or "v1.2.3" into a numeric triple.
 * Returns [0,0,0] for strings that cannot be parsed.
 */
function parseSemver(raw: string): [number, number, number] {
  const clean = raw.replace(/^v/, '').trim()
  const parts = clean.split('.').map(Number)
  if (parts.length < 3 || parts.some(isNaN)) return [0, 0, 0]
  return [parts[0], parts[1], parts[2]]
}

/**
 * Returns `true` when `a` is strictly older than `b`.
 */
function isOlderThan(a: string, b: string): boolean {
  const [aMaj, aMin, aPatch] = parseSemver(a)
  const [bMaj, bMin, bPatch] = parseSemver(b)
  if (aMaj !== bMaj) return aMaj < bMaj
  if (aMin !== bMin) return aMin < bMin
  return aPatch < bPatch
}

// ---------------------------------------------------------------------------
// GitHub Releases API types (partial)
// ---------------------------------------------------------------------------

interface GithubAsset {
  name: string
  browser_download_url: string
  content_type: string
  size: number
}

interface GithubRelease {
  tag_name: string
  name: string
  body: string
  html_url: string
  published_at: string
  prerelease: boolean
  draft: boolean
  assets: GithubAsset[]
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

const RELEASES_URL = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`

/**
 * Check GitHub Releases for an update.
 *
 * @param signal  Optional AbortSignal so callers can cancel in-flight checks
 *                when the user navigates away.
 */
export async function checkForUpdate(signal?: AbortSignal): Promise<UpdateResult> {
  let release: GithubRelease
  try {
    const response = await fetch(RELEASES_URL, {
      headers: {
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      signal,
    })
    if (!response.ok) {
      const body = await response.text().catch(() => '')
      return {
        status: 'error',
        message:
          response.status === 403
            ? 'GitHub rate-limit reached. Try again in a few minutes.'
            : response.status === 404
              ? 'No releases found for this repository.'
              : `GitHub API error ${response.status}: ${body.slice(0, 120)}`,
      }
    }
    release = (await response.json()) as GithubRelease
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      return { status: 'error', message: 'Update check cancelled.' }
    }
    return {
      status: 'error',
      message: err instanceof Error ? err.message : 'Network error during update check.',
    }
  }

  // Skip drafts and pre-releases — only stable releases matter for users.
  if (release.draft || release.prerelease) {
    return {
      status: 'current',
      currentVersion: APP_VERSION,
      latestVersion: release.tag_name.replace(/^v/, ''),
    }
  }

  const latestVersion = release.tag_name.replace(/^v/, '')

  if (!isOlderThan(APP_VERSION, latestVersion)) {
    return { status: 'current', currentVersion: APP_VERSION, latestVersion }
  }

  // Find an APK asset in the release.
  const apkAsset = release.assets.find(
    (asset) =>
      asset.name.toLowerCase().endsWith('.apk') ||
      asset.content_type === 'application/vnd.android.package-archive',
  )

  return {
    status: 'available',
    currentVersion: APP_VERSION,
    latestVersion,
    tagName: release.tag_name,
    releaseNotes: (release.body ?? '').trim(),
    apkUrl: apkAsset?.browser_download_url ?? release.html_url,
    releaseUrl: release.html_url,
    publishedAt: release.published_at,
  }
}
