import { Preferences } from '@capacitor/preferences'
import { getLunaraNativeBridge } from './bridge'
import { isNative, nativePlatform } from './runtime'

interface LunaraNativeVaultPlugin {
  secureVaultStatus(): Promise<NativeVaultStatus>
  secureSet(options: { key: string; value: string }): Promise<void>
  secureGet(options: { key: string }): Promise<{ value: string | null }>
  secureDelete(options: { key: string }): Promise<void>
  secureClear(): Promise<void>
}

interface NativeVaultStatus {
  available: boolean
  persistence: 'keychain' | 'keystore'
  hardwareBacked: boolean
  platform: 'ios' | 'android'
}

export interface SecureVaultStatus {
  available: boolean
  persistence: 'keychain' | 'keystore' | 'storage' | 'memory'
  hardwareBacked: boolean
  platform: 'ios' | 'android' | 'web'
}

export const SECURE_SECRET_KEYS = {
  openAiApiKey: 'openai-api-key',
  anthropicApiKey: 'anthropic-api-key',
  customAiApiKey: 'custom-ai-api-key',
} as const

const LunaraNative = getLunaraNativeBridge<LunaraNativeVaultPlugin>()
const VAULT_STORAGE_PREFIX = 'lunara_secure_vault_'
const memorySecrets = new Map<string, string>()

function assertValidKey(key: string): void {
  if (!/^[A-Za-z0-9._-]{1,128}$/.test(key)) {
    throw new Error('Secret keys may only contain letters, numbers, dots, dashes, and underscores.')
  }
}

export async function secureVaultStatus(): Promise<SecureVaultStatus> {
  if (!isNative) {
    return {
      available: true,
      persistence: 'storage',
      hardwareBacked: false,
      platform: 'web',
    }
  }

  try {
    return await LunaraNative.secureVaultStatus()
  } catch {
    return {
      available: true,
      persistence: 'storage',
      hardwareBacked: false,
      platform: currentVaultPlatform(),
    }
  }
}

export async function setSecureSecret(key: string, value: string): Promise<void> {
  assertValidKey(key)
  if (typeof value !== 'string') throw new Error('Secret value must be a string.')

  memorySecrets.set(key, value)

  // 1. Persist to Capacitor Preferences (UserDefaults on iOS, SharedPreferences on Android, persistent Storage on Web)
  try {
    await Preferences.set({ key: `${VAULT_STORAGE_PREFIX}${key}`, value })
  } catch {
    // ignore
  }

  // 2. Persist to localStorage for immediate synchronous web fallback
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem(`${VAULT_STORAGE_PREFIX}${key}`, value)
    } catch {
      // ignore
    }
  }

  // 3. Persist to LunaraNative hardware-backed vault if available
  if (isNative) {
    try {
      await LunaraNative.secureSet({ key, value })
    } catch {
      // ignore
    }
  }
}

export async function getSecureSecret(key: string): Promise<string | null> {
  assertValidKey(key)

  // 1. Try hardware-backed native vault if on native device
  if (isNative) {
    try {
      const nativeVal = (await LunaraNative.secureGet({ key })).value
      if (nativeVal) {
        memorySecrets.set(key, nativeVal)
        return nativeVal
      }
    } catch {
      // fallback to Preferences / localStorage below
    }
  }

  // 2. Try Capacitor Preferences
  try {
    const { value } = await Preferences.get({ key: `${VAULT_STORAGE_PREFIX}${key}` })
    if (value) {
      memorySecrets.set(key, value)
      return value
    }
  } catch {
    // fallback
  }

  // 3. Try localStorage
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const localVal = window.localStorage.getItem(`${VAULT_STORAGE_PREFIX}${key}`)
      if (localVal) {
        memorySecrets.set(key, localVal)
        return localVal
      }
    } catch {
      // ignore
    }
  }

  // 4. Memory cache fallback
  return memorySecrets.get(key) ?? null
}

export async function deleteSecureSecret(key: string): Promise<void> {
  assertValidKey(key)
  memorySecrets.delete(key)

  try {
    await Preferences.remove({ key: `${VAULT_STORAGE_PREFIX}${key}` })
  } catch {
    // ignore
  }

  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.removeItem(`${VAULT_STORAGE_PREFIX}${key}`)
    } catch {
      // ignore
    }
  }

  if (isNative) {
    try {
      await LunaraNative.secureDelete({ key })
    } catch {
      // ignore
    }
  }
}

export async function clearSecureSecrets(): Promise<void> {
  memorySecrets.clear()
  for (const secretKey of Object.values(SECURE_SECRET_KEYS)) {
    await deleteSecureSecret(secretKey)
  }

  if (isNative) {
    try {
      await LunaraNative.secureClear()
    } catch {
      // ignore
    }
  }
}

export function currentVaultPlatform(): SecureVaultStatus['platform'] {
  return isNative && (nativePlatform === 'ios' || nativePlatform === 'android')
    ? nativePlatform
    : 'web'
}
