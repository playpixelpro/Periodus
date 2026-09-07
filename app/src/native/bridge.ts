import { registerPlugin } from '@capacitor/core'

const periodusNativeBridge = registerPlugin('PeriodusNative')

/**
 * Returns the single shared Capacitor proxy with a feature-specific type.
 * Keeping registration here avoids duplicate-plugin warnings when multiple
 * native service modules are imported together.
 */
export function getPeriodusNativeBridge<T extends object>(): T {
  return periodusNativeBridge as unknown as T
}
