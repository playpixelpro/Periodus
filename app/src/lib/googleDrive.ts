import { Browser } from '@capacitor/browser'
import { Capacitor } from '@capacitor/core'
import { decryptJSON, encryptJSON, type Envelope } from '../crypto/vault'
import { getSetting, removeSetting, setSetting, SK } from '../db/schema'
import { applyImport, collectExport, type ExportPayload } from '../db/transfer'

export const DEFAULT_GOOGLE_CLIENT_ID =
  '89692632506-v65jg191jms7ouohtf7j88i2ffju4uob.apps.googleusercontent.com'

const GOOGLE_DRIVE_APPDATA_SCOPE =
  'https://www.googleapis.com/auth/drive.appdata https://www.googleapis.com/auth/userinfo.email'

const BACKUP_FILENAME = 'periodus-backup-encrypted.json'

export interface GoogleDriveFileInfo {
  id: string
  name: string
  modifiedTime: string
  size?: string
}

export interface GoogleUserInfo {
  email: string
  name?: string
  picture?: string
}

/**
 * Retrieves the active Google Client ID (from settings, or default).
 */
export async function getGoogleClientId(): Promise<string> {
  const configured = await getSetting(SK.googleClientId)
  return configured?.trim() || DEFAULT_GOOGLE_CLIENT_ID
}

/**
 * Fetches the user info for an active Google access token.
 */
export async function fetchGoogleUserInfo(token: string): Promise<GoogleUserInfo> {
  const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error(`Failed to fetch Google user info (${res.status})`)
  return (await res.json()) as GoogleUserInfo
}

/**
 * Initiates OAuth 2.0 token acquisition for Google Drive appdata access.
 */
export async function requestGoogleDriveAuth(customClientId?: string): Promise<{
  token: string
  email: string
}> {
  const clientId = customClientId?.trim() || (await getGoogleClientId())
  if (!clientId) throw new Error('Google Client ID is required.')

  const redirectUri = window.location.origin

  return new Promise((resolve, reject) => {
    // 1. Check if Google Identity Services is available in window
    const gWindow = window as unknown as {
      google?: {
        accounts?: {
          oauth2?: {
            initTokenClient: (config: {
              client_id: string
              scope: string
              callback: (response: { access_token?: string; error?: string }) => void
              error_callback?: (error: unknown) => void
            }) => { requestAccessToken: () => void }
          }
        }
      }
    }

    if (gWindow.google?.accounts?.oauth2) {
      const client = gWindow.google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: GOOGLE_DRIVE_APPDATA_SCOPE,
        callback: async (response) => {
          if (response.error || !response.access_token) {
            reject(new Error(response.error || 'Google authorization was cancelled.'))
            return
          }
          try {
            const userInfo = await fetchGoogleUserInfo(response.access_token)
            await setSetting(SK.googleDriveToken, response.access_token)
            await setSetting(SK.googleAccountEmail, userInfo.email)
            resolve({ token: response.access_token, email: userInfo.email })
          } catch (err) {
            reject(err)
          }
        },
        error_callback: (err) => reject(new Error(String(err))),
      })
      client.requestAccessToken()
      return
    }

    // 2. Standard OAuth 2.0 Implicit / Popup flow fallback
    const authUrl =
      `https://accounts.google.com/o/oauth2/v2/auth?` +
      `client_id=${encodeURIComponent(clientId)}&` +
      `redirect_uri=${encodeURIComponent(redirectUri)}&` +
      `response_type=token&` +
      `scope=${encodeURIComponent(GOOGLE_DRIVE_APPDATA_SCOPE)}&` +
      `include_granted_scopes=true&` +
      `prompt=select_account`

    if (Capacitor.isNativePlatform()) {
      // Native mobile handling
      Browser.open({ url: authUrl })
      reject(
        new Error(
          'Please complete Google sign-in in your browser window.',
        ),
      )
    } else {
      // Desktop / Web popup
      const width = 500
      const height = 650
      const left = window.screenX + (window.outerWidth - width) / 2
      const top = window.screenY + (window.outerHeight - height) / 2
      const popup = window.open(
        authUrl,
        'google-drive-oauth',
        `width=${width},height=${height},left=${left},top=${top},scrollbars=yes`,
      )

      if (!popup) {
        reject(new Error('Popup blocked. Please allow popups for this site to sign in.'))
        return
      }

      const checkInterval = setInterval(async () => {
        try {
          if (popup.closed) {
            clearInterval(checkInterval)
            reject(new Error('Sign in window was closed.'))
            return
          }
          const popupUrl = popup.location.href
          if (popupUrl && popupUrl.includes('access_token=')) {
            clearInterval(checkInterval)
            const hash = popup.location.hash.substring(1)
            const params = new URLSearchParams(hash)
            const token = params.get('access_token')
            popup.close()

            if (!token) {
              reject(new Error('Failed to retrieve access token from Google.'))
              return
            }

            const userInfo = await fetchGoogleUserInfo(token)
            await setSetting(SK.googleDriveToken, token)
            await setSetting(SK.googleAccountEmail, userInfo.email)
            resolve({ token, email: userInfo.email })
          }
        } catch {
          // Cross-origin access until redirect matches origin — expected
        }
      }, 500)
    }
  })
}

/**
 * Lists backups in Google Drive AppData folder.
 */
export async function listGoogleDriveBackups(token: string): Promise<GoogleDriveFileInfo[]> {
  const url =
    'https://www.googleapis.com/drive/v3/files?' +
    'spaces=appDataFolder&' +
    'fields=files(id,name,modifiedTime,size)&' +
    'orderBy=modifiedTime desc'

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  })

  if (res.status === 401) {
    throw new Error('Google authorization expired. Please sign in again.')
  }
  if (!res.ok) {
    throw new Error(`Failed to list Google Drive backups (${res.status})`)
  }

  const data = (await res.json()) as { files?: GoogleDriveFileInfo[] }
  return data.files || []
}

/**
 * Uploads an encrypted backup snapshot to Google Drive appDataFolder (Zero-Knowledge).
 */
export async function pushGoogleDriveBackup(
  passphrase: string,
  token: string,
): Promise<{ fileId: string; modifiedTime: string }> {
  if (!passphrase || passphrase.trim().length === 0) {
    throw new Error('Passphrase / recovery key is required to encrypt your backup.')
  }

  // 1. Collect and client-encrypt data (AES-256-GCM)
  const exportPayload = await collectExport()
  const envelope: Envelope = await encryptJSON(exportPayload, passphrase)
  const fileContent = JSON.stringify(envelope, null, 2)

  // 2. Check for existing backup in appDataFolder
  const existingFiles = await listGoogleDriveBackups(token)
  const existing = existingFiles.find((f) => f.name === BACKUP_FILENAME)

  const boundary = '-------314159265358979323846'
  const delimiter = `\r\n--${boundary}\r\n`
  const closeDelimiter = `\r\n--${boundary}--`

  const metadata = {
    name: BACKUP_FILENAME,
    mimeType: 'application/json',
    ...(existing ? {} : { parents: ['appDataFolder'] }),
  }

  const multipartRequestBody =
    delimiter +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify(metadata) +
    delimiter +
    'Content-Type: application/json\r\n\r\n' +
    fileContent +
    closeDelimiter

  let uploadUrl = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart'
  let method = 'POST'

  if (existing) {
    uploadUrl = `https://www.googleapis.com/upload/drive/v3/files/${existing.id}?uploadType=multipart`
    method = 'PATCH'
  }

  const res = await fetch(uploadUrl, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': `multipart/related; boundary=${boundary}`,
    },
    body: multipartRequestBody,
  })

  if (res.status === 401) {
    throw new Error('Google authorization expired. Please sign in again.')
  }
  if (!res.ok) {
    throw new Error(`Google Drive upload failed (${res.status})`)
  }

  const result = (await res.json()) as { id: string; modifiedTime?: string }
  const now = new Date().toISOString()
  await setSetting(SK.googleLastBackup, now)

  return {
    fileId: result.id,
    modifiedTime: result.modifiedTime || now,
  }
}

/**
 * Downloads and restores an encrypted backup snapshot from Google Drive.
 */
export async function restoreGoogleDriveBackup(
  fileId: string,
  passphrase: string,
  token: string,
): Promise<number> {
  if (!passphrase || passphrase.trim().length === 0) {
    throw new Error('Passphrase / recovery key is required to decrypt your backup.')
  }

  const downloadUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`
  const res = await fetch(downloadUrl, {
    headers: { Authorization: `Bearer ${token}` },
  })

  if (res.status === 401) {
    throw new Error('Google authorization expired. Please sign in again.')
  }
  if (res.status === 404) {
    throw new Error('Backup file was not found in Google Drive.')
  }
  if (!res.ok) {
    throw new Error(`Failed to download backup (${res.status})`)
  }

  const envelope = (await res.json()) as Envelope
  const payload = await decryptJSON<ExportPayload>(envelope, passphrase).catch(() => {
    throw new Error('Could not decrypt backup. Please verify your passphrase / recovery code.')
  })

  return applyImport(payload)
}

/**
 * Disconnects the Google Drive connection from this device.
 */
export async function disconnectGoogleDrive(): Promise<void> {
  await removeSetting(SK.googleDriveToken)
  await removeSetting(SK.googleAccountEmail)
  await removeSetting(SK.googleLastBackup)
}
