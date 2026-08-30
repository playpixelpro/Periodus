/**
 * Gemini Nano on-device inference bridge.
 *
 * Mirrors the LunaraNative bridge pattern but targets the separate
 * `LunaraNano` Capacitor plugin registered by GeminiNanoPlugin.java.
 *
 * All calls are no-ops when the plugin is unavailable (web build, unsupported
 * device). The status check always resolves — it never rejects.
 */

import { registerPlugin } from '@capacitor/core'
import { isNative, nativePlatform } from './runtime'

// ---------------------------------------------------------------------------
// Plugin interface
// ---------------------------------------------------------------------------

interface LunaraNanoPlugin {
  geminiNanoStatus(): Promise<GeminiNanoStatus>
  geminiNanoDownload(): Promise<{ started: boolean }>
  geminiNanoInfer(options: { prompt: string }): Promise<{ text: string }>
}

const nanoPlugin = registerPlugin<LunaraNanoPlugin>('LunaraNano')

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type GeminiNanoAvailabilityStatus =
  | 'available'       // model is ready — inference can proceed
  | 'downloading'     // model is downloading in background
  | 'downloadable'    // device supports it but model not yet downloaded
  | 'not-supported'   // device does not support Gemini Nano
  | 'web'             // running in the browser — not applicable

export interface GeminiNanoStatus {
  available: boolean
  status: GeminiNanoAvailabilityStatus
  reason: string
}

export interface GeminiNanoInferResult {
  text: string
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Check whether Gemini Nano is available on the current device.
 * Always resolves (never rejects). Safe to call on any platform.
 */
export async function geminiNanoStatus(): Promise<GeminiNanoStatus> {
  if (!isNative || nativePlatform !== 'android') {
    return { available: false, status: 'web', reason: 'On-device AI is Android-only.' }
  }
  try {
    return await nanoPlugin.geminiNanoStatus()
  } catch {
    return {
      available: false,
      status: 'not-supported',
      reason: 'Gemini Nano is not available on this device.',
    }
  }
}

/**
 * Trigger a background download of the Gemini Nano model.
 * Call this when the user opts in and the status is `downloadable`.
 */
export async function geminiNanoDownload(): Promise<void> {
  if (!isNative || nativePlatform !== 'android') return
  await nanoPlugin.geminiNanoDownload()
}

/**
 * Run a prompt through Gemini Nano on-device.
 * Throws if the model is not ready or inference fails.
 *
 * @param prompt  The full prompt string to send to the model
 */
export async function geminiNanoInfer(prompt: string): Promise<string> {
  if (!isNative || nativePlatform !== 'android') {
    throw new Error('On-device AI is only available in the Android app.')
  }
  const result = await nanoPlugin.geminiNanoInfer({ prompt })
  return result.text
}
