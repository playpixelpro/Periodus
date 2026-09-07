import { getPeriodusNativeBridge } from './bridge'
import { isNative, nativePlatform } from './runtime'

export interface CycleWidgetSnapshot {
  generatedAt: string
  headline: string
  detail?: string
  cycleDay?: number
  phase?: 'period' | 'follicular' | 'fertile' | 'ovulation' | 'luteal' | 'pregnancy'
  nextPeriodDate?: string
  fertileToday?: boolean
  accent?: string
}

export interface WidgetStatus {
  /** True when this build includes a native home-screen widget. */
  available: boolean
  /** True when the app can persist the redacted snapshot consumed by the widget. */
  publisherAvailable: boolean
  extensionInstalled: boolean
  backgroundRefreshConfigured: boolean
  configuredWidgets?: number
  platform: 'ios' | 'android' | 'web'
}

interface PeriodusNativeWidgetPlugin {
  widgetStatus(): Promise<WidgetStatus>
  publishWidgetSnapshot(options: { snapshot: CycleWidgetSnapshot }): Promise<void>
  clearWidgetSnapshot(): Promise<void>
}

const PeriodusNative = getPeriodusNativeBridge<PeriodusNativeWidgetPlugin>()

function normalizedSnapshot(snapshot: CycleWidgetSnapshot): CycleWidgetSnapshot {
  if (!Number.isFinite(Date.parse(snapshot.generatedAt))) {
    throw new Error('Widget snapshot generatedAt must be a valid ISO date.')
  }

  const headline = snapshot.headline.trim().slice(0, 80)
  if (!headline) throw new Error('Widget snapshot headline is required.')

  return {
    generatedAt: snapshot.generatedAt,
    headline,
    detail: snapshot.detail?.trim().slice(0, 140),
    cycleDay:
      snapshot.cycleDay !== undefined
        ? Math.max(1, Math.min(999, Math.trunc(snapshot.cycleDay)))
        : undefined,
    phase: snapshot.phase,
    nextPeriodDate: snapshot.nextPeriodDate,
    fertileToday: snapshot.fertileToday,
    accent: snapshot.accent?.slice(0, 20),
  }
}

export async function getWidgetStatus(): Promise<WidgetStatus> {
  if (!isNative) {
    return {
      available: false,
      publisherAvailable: false,
      extensionInstalled: false,
      backgroundRefreshConfigured: false,
      platform: 'web',
    }
  }
  return PeriodusNative.widgetStatus()
}

/** Persists only the redacted snapshot contract consumed by the native widget. */
export async function publishWidgetSnapshot(snapshot: CycleWidgetSnapshot): Promise<void> {
  if (!isNative) return
  await PeriodusNative.publishWidgetSnapshot({ snapshot: normalizedSnapshot(snapshot) })
}

export async function clearWidgetSnapshot(): Promise<void> {
  if (!isNative) return
  await PeriodusNative.clearWidgetSnapshot()
}

export function currentWidgetPlatform(): WidgetStatus['platform'] {
  return isNative && (nativePlatform === 'ios' || nativePlatform === 'android')
    ? nativePlatform
    : 'web'
}
