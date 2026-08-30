import { describe, expect, it, vi } from 'vitest'
import {
  DEFAULT_GOOGLE_CLIENT_ID,
  fetchGoogleUserInfo,
  listGoogleDriveBackups,
  pushGoogleDriveBackup,
  restoreGoogleDriveBackup,
} from './googleDrive'

describe('googleDrive integration', () => {
  it('has default Google Client ID configured', () => {
    expect(DEFAULT_GOOGLE_CLIENT_ID).toContain('89692632506-v65jg191jms7ouohtf7j88i2ffju4uob')
  })

  it('fetches user info with proper authorization bearer header', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          email: 'user@example.com',
          name: 'Test User',
        }),
        { status: 200 },
      ),
    )

    const userInfo = await fetchGoogleUserInfo('fake-token-123')
    expect(userInfo.email).toBe('user@example.com')
    expect(fetchSpy).toHaveBeenCalledWith(
      'https://www.googleapis.com/oauth2/v3/userinfo',
      expect.objectContaining({
        headers: { Authorization: 'Bearer fake-token-123' },
      }),
    )
    fetchSpy.mockRestore()
  })

  it('lists files from appDataFolder', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          files: [
            {
              id: 'file-123',
              name: 'periodus-backup-encrypted.json',
              modifiedTime: '2026-08-30T12:00:00.000Z',
              size: '1024',
            },
          ],
        }),
        { status: 200 },
      ),
    )

    const files = await listGoogleDriveBackups('fake-token-123')
    expect(files).toHaveLength(1)
    expect(files[0].id).toBe('file-123')
    expect(files[0].name).toBe('periodus-backup-encrypted.json')
    fetchSpy.mockRestore()
  })

  it('rejects empty passphrases', async () => {
    await expect(pushGoogleDriveBackup('', 'token')).rejects.toThrow(
      'Passphrase / recovery key is required',
    )
    await expect(restoreGoogleDriveBackup('file-1', '', 'token')).rejects.toThrow(
      'Passphrase / recovery key is required',
    )
  })
})
