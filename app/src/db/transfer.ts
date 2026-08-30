import { Capacitor } from '@capacitor/core'
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem'
import { Share } from '@capacitor/share'
import { decryptJSON, encryptJSON, type Envelope } from '../crypto/vault'
import { db, SK, type ContentBookmark, type DailyLog, type Setting } from './schema'

/** Settings that must never leave the device. */
const SECRET_KEYS: string[] = [SK.pinSalt, SK.pinHash, SK.aiKey]

export interface ExportPayload {
  app: 'periodus' | 'lunara'
  v: 1
  exportedAt: string
  dailyLogs: DailyLog[]
  settings: Setting[]
  contentBookmarks: ContentBookmark[]
}

export async function collectExport(): Promise<ExportPayload> {
  const [dailyLogs, settings, contentBookmarks] = await Promise.all([
    db.dailyLogs.toArray(),
    db.settings.toArray(),
    db.contentBookmarks.toArray(),
  ])
  return {
    app: 'periodus',
    v: 1,
    exportedAt: new Date().toISOString(),
    dailyLogs,
    settings: settings.filter((s) => !SECRET_KEYS.includes(s.key)),
    contentBookmarks,
  }
}

export async function applyImport(payload: ExportPayload): Promise<number> {
  if ((payload.app !== 'periodus' && payload.app !== 'lunara') || payload.v !== 1) {
    throw new Error('Not a Periodus export file')
  }
  await db.transaction('rw', db.dailyLogs, db.settings, db.contentBookmarks, async () => {
    await db.dailyLogs.bulkPut(payload.dailyLogs)
    await db.settings.bulkPut(payload.settings.filter((s) => !SECRET_KEYS.includes(s.key)))
    await db.contentBookmarks.bulkPut(payload.contentBookmarks)
  })
  return payload.dailyLogs.length
}

export async function encryptedExport(passphrase: string): Promise<Envelope> {
  return encryptJSON(await collectExport(), passphrase)
}

export async function decryptImport(env: Envelope, passphrase: string): Promise<number> {
  return applyImport(await decryptJSON<ExportPayload>(env, passphrase))
}

/**
 * Saves or shares a file with full platform support:
 * - Native Android / iOS: writes to Cache and opens the OS Share Sheet / Intent Chooser (Save to Drive, Files, etc.)
 * - Desktop / Modern Web: opens the OS File Picker dialog via File System Access API (Save As...)
 * - Fallback: standard blob download anchor
 */
export async function shareOrDownload(filename: string, contents: string): Promise<void> {
  // 1. Native Capacitor (Android & iOS)
  if (Capacitor.isNativePlatform()) {
    try {
      const fileResult = await Filesystem.writeFile({
        path: filename,
        data: contents,
        directory: Directory.Cache,
        encoding: Encoding.UTF8,
      })
      await Share.share({
        title: filename,
        text: 'Periodus Encrypted Backup Vault',
        url: fileResult.uri,
        dialogTitle: 'Save or Share Backup File',
      })
      return
    } catch (e) {
      console.warn('Native share failed, falling back:', e)
    }
  }

  // 2. Desktop / Modern Browser File System Access API (Save As dialog)
  if (typeof window !== 'undefined' && 'showSaveFilePicker' in window) {
    try {
      const isVault = filename.endsWith('.vault')
      const ext = isVault ? '.vault' : '.json'
      const mime = isVault ? 'application/octet-stream' : 'application/json'
      const handle = await (window as unknown as {
        showSaveFilePicker: (opts: unknown) => Promise<{
          createWritable: () => Promise<{
            write: (data: unknown) => Promise<void>
            close: () => Promise<void>
          }>
        }>
      }).showSaveFilePicker({
        suggestedName: filename,
        types: [
          {
            description: isVault ? 'Periodus Encrypted Vault (*.vault)' : 'Periodus Backup (*.json)',
            accept: { [mime]: [ext] },
          },
        ],
      })
      const writable = await handle.createWritable()
      await writable.write(contents)
      await writable.close()
      return
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return
    }
  }

  // 3. Web Share API fallback
  const blob = new Blob([contents], { type: 'application/json' })
  const file = new File([blob], filename, { type: 'application/json' })
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: filename })
      return
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') return
    }
  }

  // 4. Traditional Download Fallback
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}
