import { getPeriodusNativeBridge } from './bridge'
import { isNative, nativePlatform } from './runtime'

export const SUPPORTED_HEALTH_DATA_TYPES = [
  'menstrualFlow',
  'basalBodyTemperature',
  'ovulationTest',
  'weight',
  'sleep',
  'steps',
] as const

export type HealthDataType = (typeof SUPPORTED_HEALTH_DATA_TYPES)[number]
export type HealthAuthorization =
  | 'not-determined'
  | 'requested'
  | 'granted'
  | 'partial'
  | 'denied'
  | 'unavailable'

export interface HealthPlatformStatus {
  available: boolean
  platform: 'healthkit' | 'health-connect' | 'none'
  authorization: HealthAuthorization
  supportedTypes: HealthDataType[]
  grantedTypes: HealthDataType[]
  reason?: string
}

export interface HealthSample {
  id: string
  type: HealthDataType
  startDate: string
  endDate: string
  /** Device-calendar date supplied by the native bridge. */
  localDate?: string
  value: string | number
  unit: string
  source?: string
  sourceBundleIdentifier?: string
  metadata?: {
    menstrualCycleStart?: boolean
    wasUserEntered?: boolean
  }
}

export interface HealthImportOptions {
  startDate: string
  endDate: string
  types?: HealthDataType[]
}

interface PeriodusNativeHealthPlugin {
  healthStatus(): Promise<HealthPlatformStatus>
  requestHealthAccess(options: { types: HealthDataType[] }): Promise<HealthPlatformStatus>
  importHealthData(options: {
    types: HealthDataType[]
    startDate: string
    endDate: string
  }): Promise<{ samples: HealthSample[] }>
}

const PeriodusNative = getPeriodusNativeBridge<PeriodusNativeHealthPlugin>()

function normalizeTypes(types?: HealthDataType[]): HealthDataType[] {
  if (!types?.length) return [...SUPPORTED_HEALTH_DATA_TYPES]
  const supported = new Set<string>(SUPPORTED_HEALTH_DATA_TYPES)
  return [...new Set(types)].filter((type): type is HealthDataType => supported.has(type))
}

function validDate(value: string): boolean {
  return value.length > 0 && Number.isFinite(Date.parse(value))
}

export async function getHealthPlatformStatus(): Promise<HealthPlatformStatus> {
  if (!isNative) {
    return {
      available: false,
      platform: 'none',
      authorization: 'unavailable',
      supportedTypes: [],
      grantedTypes: [],
      reason: 'Health data import requires the installed iOS or Android app.',
    }
  }

  return PeriodusNative.healthStatus()
}

export async function requestHealthAccess(
  types?: HealthDataType[],
): Promise<HealthPlatformStatus> {
  if (!isNative) return getHealthPlatformStatus()
  return PeriodusNative.requestHealthAccess({ types: normalizeTypes(types) })
}

export async function importHealthData(options: HealthImportOptions): Promise<HealthSample[]> {
  if (!validDate(options.startDate) || !validDate(options.endDate)) {
    throw new Error('Health import dates must be valid ISO date strings.')
  }
  if (Date.parse(options.startDate) > Date.parse(options.endDate)) {
    throw new Error('Health import start date must be before its end date.')
  }
  if (!isNative) return []

  const result = await PeriodusNative.importHealthData({
    types: normalizeTypes(options.types),
    startDate: options.startDate,
    endDate: options.endDate,
  })
  return result.samples
}

export function healthPlatformName(): HealthPlatformStatus['platform'] {
  if (nativePlatform === 'ios') return 'healthkit'
  if (nativePlatform === 'android') return 'health-connect'
  return 'none'
}
