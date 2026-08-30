import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useRef, useState } from 'react'
import {
  generateRecoveryCode,
  hashPin,
  newSalt,
  normalizeRecoveryCode,
} from '../crypto/vault'
import {
  db,
  getHealthProfile,
  getSetting,
  putHealthProfile,
  removeSetting,
  setSetting,
  SK,
  type Goal,
  type PermissionState,
} from '../db/schema'
import type { Envelope } from '../crypto/vault'
import { applyImport, collectExport, decryptImport, encryptedExport, shareOrDownload } from '../db/transfer'
import { useDialog } from '../context/DialogContext'
import { pushBackup, restoreBackup } from '../lib/backup'
import {
  disconnectGoogleDrive,
  listGoogleDriveBackups,
  pushGoogleDriveBackup,
  requestGoogleDriveAuth,
  restoreGoogleDriveBackup,
} from '../lib/googleDrive'
import { formatShort, localToday } from '../lib/dates'
import { addDays } from '../engine/cycle'
import {
  parseReminderPreferences,
  REMINDER_DEFINITIONS,
  REMINDER_SETTINGS_KEY,
  serializeReminderPreferences,
  updateReminderPlan,
  withReminderGlobals,
  withReminderPermission,
  type ReminderPreferenceId,
  type ReminderPreferences,
} from '../engine/reminderPreferences'
import type { ReminderPermission } from '../engine/reminders'
import {
  resolvePregnancyDating,
  type PregnancyDatingMethod,
} from '../engine/pregnancyDating'
import {
  authenticateWithBiometrics,
  getBiometricStatus,
  type BiometricStatus,
} from '../native/biometrics'
import {
  getHealthPlatformStatus,
  importHealthData,
  requestHealthAccess,
  type HealthPlatformStatus,
} from '../native/health'
import {
  applyHealthSamples,
  healthImportProvider,
  importAppleHealthPeriodHistory,
} from '../native/healthImport'
import {
  cancelDailyReminder,
  cancelMaterializedReminders,
  notificationPermission,
  syncReminderPlans,
} from '../native/notifications'
import { isNative, nativePlatform } from '../native/runtime'
import { checkForUpdate, type UpdateResult } from '../lib/updater'
import { APP_VERSION } from '../lib/version'
import { Browser } from '@capacitor/browser'
import {
  clearSecureSecrets,
  deleteSecureSecret,
  getSecureSecret,
  SECURE_SECRET_KEYS,
  secureVaultStatus,
} from '../native/secureVault'
import { getWidgetStatus, type WidgetStatus } from '../native/widgets'
import { useApp } from '../state/appStore'
import {
  geminiNanoStatus,
  geminiNanoDownload,
  geminiNanoInfer,
  type GeminiNanoStatus,
} from '../native/geminiNano'
import { buildCycleAnalysisPrompt } from '../lib/cycleAnalysisPrompt'

const DEVICE_TIME_ZONE = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'

function profileHealthPermission(
  authorization: HealthPlatformStatus['authorization'],
): PermissionState {
  if (authorization === 'granted' || authorization === 'partial') return 'granted'
  if (authorization === 'requested') return 'requested'
  if (authorization === 'denied') return 'denied'
  return 'not-requested'
}

function profileReminderPermission(permission: PermissionState): ReminderPermission {
  return permission === 'requested' ? 'not-requested' : permission
}

const GOAL_LABELS: Record<Goal, string> = {
  cycle: 'Cycle tracking',
  ttc: 'Trying to conceive',
  pregnancy: 'Pregnancy',
  peri: 'Perimenopause',
}

const PREGNANCY_DATING_OPTIONS: {
  method: PregnancyDatingMethod
  label: string
  dateLabel: string
}[] = [
  {
    method: 'clinician-edd',
    label: 'Due date assigned by my clinician',
    dateLabel: 'Clinician-assigned due date',
  },
  { method: 'lmp', label: 'First day of last period', dateLabel: 'First day of last period' },
  { method: 'conception', label: 'Conception date', dateLabel: 'Conception date' },
  {
    method: 'ivf-day-3',
    label: 'IVF day-3 embryo transfer',
    dateLabel: 'Day-3 embryo-transfer date',
  },
  {
    method: 'ivf-day-5',
    label: 'IVF day-5 embryo transfer',
    dateLabel: 'Day-5 embryo-transfer date',
  },
]

function pregnancyDateBounds(method: PregnancyDatingMethod) {
  const today = localToday()
  if (method === 'clinician-edd') {
    return { min: addDays(today, -21), max: addDays(today, 300) }
  }
  return { min: addDays(today, -300), max: today }
}

export function Settings() {
  const {
    setAssistantOpen,
    setCycleReportOpen,
    setPregnancyDetailOpen,
    setPerimenopauseOpen,
    setTtcDetailOpen,
    setTrackerCustomizeOpen,
    setAboutOpen,
  } = useApp()
  const dialog = useDialog()
  const fileInput = useRef<HTMLInputElement>(null)
  const [status, setStatus] = useState<string | null>(null)
  const [hasOpenAiKey, setHasOpenAiKey] = useState(false)
  const [hasAnthropicKey, setHasAnthropicKey] = useState(false)
  const [hasCustomKey, setHasCustomKey] = useState(false)
  const [vaultLabel, setVaultLabel] = useState(isNative ? 'Checking…' : 'Session memory')
  const [biometrics, setBiometrics] = useState<BiometricStatus | null>(null)
  const [health, setHealth] = useState<HealthPlatformStatus | null>(null)
  const [widget, setWidget] = useState<WidgetStatus | null>(null)
  const [capabilityBusy, setCapabilityBusy] = useState(false)
  const [reminderBusy, setReminderBusy] = useState(false)
  const [reminders, setReminders] = useState<ReminderPreferences | null>(null)
  const [pregnancyMethod, setPregnancyMethod] =
    useState<PregnancyDatingMethod>('lmp')
  const [updateResult, setUpdateResult] = useState<UpdateResult | null>(null)
  const [updateBusy, setUpdateBusy] = useState(false)
  const [nanoStatus, setNanoStatus] = useState<GeminiNanoStatus | null>(null)
  const [nanoAnalysis, setNanoAnalysis] = useState<string | null>(null)
  const [nanoBusy, setNanoBusy] = useState(false)

  useEffect(() => {
    let alive = true
    void Promise.all([
      getSecureSecret(SECURE_SECRET_KEYS.openAiApiKey),
      getSecureSecret(SECURE_SECRET_KEYS.anthropicApiKey),
      getSecureSecret(SECURE_SECRET_KEYS.customAiApiKey),
      secureVaultStatus(),
      getBiometricStatus(),
      getHealthPlatformStatus(),
      getWidgetStatus(),
      geminiNanoStatus(),
    ])
      .then(([openAiKey, anthropicKey, customKey, vault, biometricStatus, healthStatus, widgetStatus, nanoSt]) => {
        if (!alive) return
        setHasOpenAiKey(Boolean(openAiKey))
        setHasAnthropicKey(Boolean(anthropicKey))
        setHasCustomKey(Boolean(customKey))
        setVaultLabel(
          vault.persistence === 'memory'
            ? 'Session memory'
            : `${vault.persistence}${vault.hardwareBacked ? ' · hardware protected' : ''}`,
        )
        setBiometrics(biometricStatus)
        setHealth(healthStatus)
        setWidget(widgetStatus)
        setNanoStatus(nanoSt)
      })
      .catch((reason: unknown) => {
        if (alive) setStatus(reason instanceof Error ? reason.message : 'Could not inspect native services.')
      })
    return () => {
      alive = false
    }
  }, [])

  const s = useLiveQuery(async () => {
    const [
      legacyPregnancyLmp,
      hasPin,
      biometricLock,
      provider,
      endpoint,
      code,
      time,
      reminderSettings,
      googleEmail,
      googleToken,
      googleLastBackup,
      autoAiInsights,
      profile,
    ] =
      await Promise.all([
        getSetting(SK.pregnancyLMP),
        getSetting(SK.pinHash),
        getSetting(SK.biometricLock),
        getSetting(SK.aiProvider),
        getSetting(SK.backupEndpoint),
        getSetting('recoveryCode'),
        getSetting(SK.reminderTime),
        getSetting(REMINDER_SETTINGS_KEY),
        getSetting(SK.googleAccountEmail),
        getSetting(SK.googleDriveToken),
        getSetting(SK.googleLastBackup),
        getSetting(SK.autoAiInsights),
        getHealthProfile(),
      ])
    const pregnancyLmp = profile.reproductive.pregnancyLmp ?? legacyPregnancyLmp
    const pregnancyDating =
      profile.reproductive.pregnancyDating ??
      (pregnancyLmp
        ? resolvePregnancyDating({
            method: 'lmp',
            date: pregnancyLmp,
          })
        : undefined)
    return {
      goal: profile.primaryGoal,
      profile,
      pregnancyDating,
      hasPin: !!hasPin,
      biometricLock: biometricLock === '1',
      provider: provider === 'openai' ? ('openai' as const) : provider === 'custom' ? ('custom' as const) : ('anthropic' as const),
      endpoint: endpoint ?? '',
      recoveryCode: code ?? '',
      legacyReminderTime: time,
      reminderSettings,
      googleAccountEmail: googleEmail ?? '',
      googleDriveToken: googleToken ?? '',
      googleLastBackup: googleLastBackup ?? '',
      autoAiInsights: autoAiInsights ?? '0',
    }
  }, [])

  useEffect(() => {
    if (s?.pregnancyDating?.method) {
      setPregnancyMethod(s.pregnancyDating.method)
    }
  }, [s?.pregnancyDating?.method])

  useEffect(() => {
    if (!s) return
    setReminders(
      parseReminderPreferences(s.reminderSettings, {
        timeZone: DEVICE_TIME_ZONE,
        startDate: localToday(),
        permission: profileReminderPermission(s.profile.permissions.notifications),
        legacyTime: s.legacyReminderTime,
      }),
    )
  }, [
    s?.legacyReminderTime,
    s?.profile.permissions.notifications,
    s?.reminderSettings,
  ])

  if (!s) return <div className="page" />
  const profileGoals = s.profile.goals
  const hasPregnancyDating = Boolean(s.pregnancyDating)
  const reminderPreferences =
    reminders ??
    parseReminderPreferences(s.reminderSettings, {
      timeZone: DEVICE_TIME_ZONE,
      startDate: localToday(),
      permission: profileReminderPermission(s.profile.permissions.notifications),
      legacyTime: s.legacyReminderTime,
    })
  const activeReminderCount = reminderPreferences.plans.filter((plan) => plan.enabled).length

  async function setGoal(g: Goal) {
    await Promise.all([
      setSetting(SK.goal, g),
      putHealthProfile({
        primaryGoal: g,
        goals: [g, ...profileGoals.filter((goal) => goal !== g)],
      }),
    ])
    setStatus(
      g === 'pregnancy' && !hasPregnancyDating
        ? 'Pregnancy mode selected. Add your current dating source below.'
        : `Mode set to ${GOAL_LABELS[g]}`,
    )
  }

  async function setPregnancyDate(method: PregnancyDatingMethod, value: string) {
    if (!value) {
      await Promise.all([
        removeSetting(SK.pregnancyLMP),
        putHealthProfile({
          reproductive: {
            pregnancyDating: undefined,
            pregnancyLmp: undefined,
          },
        }),
      ])
      setStatus('Pregnancy dating source cleared.')
      return
    }
    const dating = resolvePregnancyDating({
      method,
      date: value,
      clinicianConfirmed: method === 'clinician-edd',
    })
    await putHealthProfile({
      reproductive: {
        pregnancyDating: {
          ...dating,
          updatedAt: new Date().toISOString(),
        },
        pregnancyLmp: method === 'lmp' ? value : undefined,
      },
    })
    if (method === 'lmp') await setSetting(SK.pregnancyLMP, value)
    else await removeSetting(SK.pregnancyLMP)
    setStatus(
      dating.provisional
        ? 'Pregnancy timeline updated with a provisional estimate.'
        : 'Pregnancy timeline updated with the clinician-assigned due date.',
    )
  }

  async function exportPlain() {
    const payload = await collectExport()
    await shareOrDownload(`periodus-backup-${localToday()}.json`, JSON.stringify(payload, null, 2))
    setStatus('Exported. Save it somewhere safe.')
  }

  async function exportEncrypted() {
    const pass = await dialog.prompt({
      title: 'Encrypt export file',
      message: 'Choose a passphrase to encrypt this export. You will need this passphrase whenever you import this backup.',
      confirmText: 'Encrypt & Export',
      input: {
        type: 'password',
        placeholder: 'Enter secure passphrase',
      },
    })
    if (!pass) return
    const env = await encryptedExport(pass)
    await shareOrDownload(`periodus-encrypted-${localToday()}.json`, JSON.stringify(env))
    setStatus('Encrypted export saved.')
  }

  async function onImportFile(file: File) {
    const text = await file.text()
    const parsed = JSON.parse(text)
    try {
      if (parsed.kdf && parsed.data) {
        const pass = await dialog.prompt({
          title: 'Unlock encrypted backup',
          message: 'This file is encrypted. Enter the passphrase you used when creating it:',
          confirmText: 'Decrypt & Import',
          input: {
            type: 'password',
            placeholder: 'Enter passphrase',
          },
        })
        if (!pass) return
        const n = await decryptImport(parsed as Envelope, pass)
        setStatus(`Imported ${n} days from encrypted file.`)
      } else {
        const n = await applyImport(parsed)
        setStatus(`Imported ${n} days.`)
      }
    } catch (e) {
      setStatus(e instanceof Error ? e.message : 'Import failed.')
    }
  }

  async function setPin() {
    const pin = await dialog.prompt({
      title: 'Set 4-digit PIN',
      message: 'Choose a 4-digit numeric PIN to secure Periodus on this device:',
      confirmText: 'Save PIN',
      input: {
        type: 'password',
        placeholder: '4-digit PIN',
        helperText: 'Must be exactly 4 digits (e.g. 1234)',
      },
    })
    if (!pin || !/^\d{4}$/.test(pin)) {
      if (pin) setStatus('PIN must be exactly 4 digits.')
      return
    }
    const salt = newSalt()
    await setSetting(SK.pinSalt, salt)
    await setSetting(SK.pinHash, await hashPin(pin, salt))
    setStatus('PIN lock enabled.')
  }

  async function removePin() {
    await removeSetting(SK.pinHash)
    await removeSetting(SK.pinSalt)
    await removeSetting(SK.biometricLock)
    setStatus('PIN lock removed.')
  }

  async function toggleBiometricLock() {
    if (s!.biometricLock) {
      await removeSetting(SK.biometricLock)
      setStatus('Biometric unlock turned off.')
      return
    }
    if (!s!.hasPin) {
      setStatus('Set a PIN first so you always have a fallback.')
      return
    }
    const current = biometrics ?? (await getBiometricStatus())
    setBiometrics(current)
    if (!current.available || !current.enrolled) {
      setStatus(current.reason ?? 'No enrolled biometric is available on this device.')
      return
    }
    setCapabilityBusy(true)
    try {
      const result = await authenticateWithBiometrics('Confirm biometric unlock for Periodus')
      if (!result.authenticated) {
        setStatus('Biometric confirmation was cancelled.')
        return
      }
      await setSetting(SK.biometricLock, '1')
      setStatus('Biometric unlock enabled. Your PIN remains the fallback.')
    } finally {
      setCapabilityBusy(false)
    }
  }

  async function syncHealthData() {
    setCapabilityBusy(true)
    setStatus(null)
    try {
      let access = health ?? (await getHealthPlatformStatus())
      if (!access.available) {
        setStatus(access.reason ?? 'Health data import is not available on this device.')
        setHealth(access)
        return
      }
      access = await requestHealthAccess()
      setHealth(access)
      await recordHealthImportDecision(access.authorization)
      if (access.authorization === 'denied' || access.authorization === 'unavailable') {
        setStatus(access.reason ?? 'Health permission was not granted.')
        return
      }
      const provider = healthImportProvider(access)
      if (!provider) {
        setStatus('This device does not expose a supported health-data provider.')
        return
      }
      const today = localToday()
      const samples = await importHealthData({
        startDate: addDays(today, -365),
        endDate: today,
        types: access.grantedTypes.length ? access.grantedTypes : access.supportedTypes,
      })
      const result = await applyHealthSamples(samples, provider)
      if (!samples.length && access.platform === 'healthkit') {
        setStatus(
          'Apple Health returned no records. For privacy, iOS does not reveal whether access was denied or the selected categories are empty.',
        )
      } else {
        setStatus(
          `Reviewed ${result.uniqueSamples} health sample${result.uniqueSamples === 1 ? '' : 's'}; ${result.daysChanged} day${result.daysChanged === 1 ? '' : 's'} added or updated.${result.fieldsSkippedForUserData ? ` Kept ${result.fieldsSkippedForUserData} manually entered value${result.fieldsSkippedForUserData === 1 ? '' : 's'}.` : ''}`,
        )
      }
    } catch (reason) {
      setStatus(reason instanceof Error ? reason.message : 'Health import failed.')
    } finally {
      setCapabilityBusy(false)
    }
  }

  async function recordHealthImportDecision(
    authorization: HealthPlatformStatus['authorization'],
  ) {
    const profile = await getHealthProfile()
    const permission = profileHealthPermission(authorization)
    const state =
      authorization === 'denied'
        ? 'declined'
        : authorization === 'granted' ||
            authorization === 'partial' ||
            authorization === 'requested'
          ? 'granted'
          : 'not-requested'
    const consentLedger = profile.privacy.consentLedger
      .filter((decision) => decision.purpose !== 'health-import')
      .concat({
        purpose: 'health-import' as const,
        state,
        version: 1 as const,
        decidedAt: new Date().toISOString(),
      })
    await putHealthProfile({
      permissions: { healthData: permission },
      privacy: { consentLedger },
    })
  }

  async function importApplePeriods() {
    setCapabilityBusy(true)
    setStatus(null)
    try {
      const today = localToday()
      const result = await importAppleHealthPeriodHistory({
        startDate: addDays(today, -730),
        endDate: today,
      })
      const refreshed = await getHealthPlatformStatus()
      setHealth(refreshed)
      if (result.authorization !== 'unavailable') {
        await recordHealthImportDecision(result.authorization)
      }
      if (!result.available) {
        setStatus(result.reason ?? 'Apple Health period import is unavailable.')
      } else if (!result.periodSamples) {
        setStatus(
          'Apple Health returned no period records. For privacy, iOS does not reveal whether access was denied or Health has no menstrual-flow history.',
        )
      } else {
        setStatus(
          `Reviewed ${result.uniqueSamples} Apple Health period record${result.uniqueSamples === 1 ? '' : 's'}; ${result.daysChanged} day${result.daysChanged === 1 ? '' : 's'} added or updated.${result.fieldsSkippedForUserData ? ` Kept ${result.fieldsSkippedForUserData} manually entered period value${result.fieldsSkippedForUserData === 1 ? '' : 's'}.` : ''}`,
        )
      }
    } catch (reason) {
      setStatus(reason instanceof Error ? reason.message : 'Apple Health period import failed.')
    } finally {
      setCapabilityBusy(false)
    }
  }

  async function removeAiKey() {
    const provider = s?.provider ?? 'anthropic'
    await deleteSecureSecret(
      provider === 'anthropic'
        ? SECURE_SECRET_KEYS.anthropicApiKey
        : provider === 'custom'
          ? SECURE_SECRET_KEYS.customAiApiKey
          : SECURE_SECRET_KEYS.openAiApiKey,
    )
    await removeSetting(SK.aiKey)
    if (provider === 'anthropic') setHasAnthropicKey(false)
    else if (provider === 'custom') setHasCustomKey(false)
    else setHasOpenAiKey(false)
    setStatus(
      provider === 'anthropic'
        ? 'Anthropic credential removed from this device. Revoke it in the Anthropic console to invalidate it everywhere.'
        : provider === 'custom'
          ? 'Custom AI credential removed from secure storage.'
          : 'OpenAI key removed from secure storage.',
    )
  }

  async function backupToGoogleDrive() {
    if (!s) return
    let token = s.googleDriveToken
    if (!token) {
      try {
        const auth = await requestGoogleDriveAuth()
        token = auth.token
      } catch (e) {
        setStatus(e instanceof Error ? e.message : 'Google sign-in required.')
        return
      }
    }

    let code = s.recoveryCode
    if (!code) {
      code = generateRecoveryCode()
      await setSetting('recoveryCode', code)
      await dialog.alert({
        title: 'Zero-Knowledge Passphrase',
        message:
          'Write down this recovery passphrase. Your Google Drive backup is encrypted with it and cannot be decrypted without it:',
        copyableText: code,
        confirmText: 'I have saved it',
      })
    }

    setCapabilityBusy(true)
    setStatus('Encrypting and uploading to Google Drive…')
    try {
      const res = await pushGoogleDriveBackup(code, token)
      setStatus(
        `Backed up to Google Drive (Zero-knowledge AES-GCM · ${formatShort(res.modifiedTime.split('T')[0])}).`,
      )
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Google Drive backup failed.'
      if (msg.includes('expired') || msg.includes('sign in')) {
        await disconnectGoogleDrive()
      }
      setStatus(msg)
    } finally {
      setCapabilityBusy(false)
    }
  }

  async function restoreFromGoogleDrive() {
    if (!s) return
    let token = s.googleDriveToken
    if (!token) {
      try {
        const auth = await requestGoogleDriveAuth()
        token = auth.token
      } catch (e) {
        setStatus(e instanceof Error ? e.message : 'Google sign-in required.')
        return
      }
    }

    setCapabilityBusy(true)
    setStatus('Checking Google Drive backups…')
    let files
    try {
      files = await listGoogleDriveBackups(token)
    } catch (e) {
      setCapabilityBusy(false)
      const msg = e instanceof Error ? e.message : 'Could not check Google Drive backups.'
      if (msg.includes('expired') || msg.includes('sign in')) {
        await disconnectGoogleDrive()
      }
      setStatus(msg)
      return
    }
    setCapabilityBusy(false)

    if (files.length === 0) {
      await dialog.alert({
        title: 'No Backups Found',
        message: 'No encrypted Periodus backups were found in your Google Drive AppData folder.',
      })
      return
    }

    const latest = files[0]
    const pass = await dialog.prompt({
      title: 'Restore from Google Drive',
      message: `Found backup from ${formatShort(latest.modifiedTime.split('T')[0])}.\nEnter your zero-knowledge recovery code / passphrase to decrypt:`,
      confirmText: 'Decrypt & Restore',
      input: {
        defaultValue: s.recoveryCode || '',
        placeholder: 'e.g. word1-word2-word3-word4',
      },
    })
    if (!pass) return

    setCapabilityBusy(true)
    setStatus('Downloading and decrypting backup…')
    try {
      const count = await restoreGoogleDriveBackup(latest.id, normalizeRecoveryCode(pass), token)
      await setSetting('recoveryCode', normalizeRecoveryCode(pass))
      setStatus(`Successfully restored ${count} records from Google Drive.`)
    } catch (e) {
      setStatus(e instanceof Error ? e.message : 'Restore failed.')
    } finally {
      setCapabilityBusy(false)
    }
  }

  async function disconnectGoogle() {
    const confirmed = await dialog.confirm({
      title: 'Disconnect Google Drive?',
      message:
        'This will unlink Google Drive on this device. Existing backups in your Google Drive will not be deleted.',
      confirmText: 'Disconnect',
      cancelText: 'Keep Connected',
    })
    if (!confirmed) return
    await disconnectGoogleDrive()
    setStatus('Google Drive disconnected.')
  }

  async function enableBackup() {
    const endpoint = await dialog.prompt({
      title: 'Cloud backup relay',
      message: 'Enter your deployed Periodus backup Worker URL:',
      confirmText: 'Connect & Back Up',
      input: {
        defaultValue: s!.endpoint || '',
        placeholder: 'https://your-backup-relay.workers.dev',
      },
    })
    if (!endpoint) return
    let code = s!.recoveryCode
    if (!code) {
      code = generateRecoveryCode()
      await setSetting('recoveryCode', code)
      await dialog.alert({
        title: 'Recovery code',
        message: 'Write down your recovery code. It is shown only once and without it, your backups cannot be restored:',
        copyableText: code,
        confirmText: 'I have saved my code',
      })
    }
    await setSetting(SK.backupEndpoint, endpoint)
    try {
      await pushBackup(endpoint, code)
      setStatus('Backed up (zero-knowledge — the server cannot read it).')
    } catch (e) {
      setStatus(e instanceof Error ? e.message : 'Backup failed.')
    }
  }

  async function restore() {
    const endpoint = await dialog.prompt({
      title: 'Restore from cloud backup',
      message: 'Enter your backup relay URL:',
      confirmText: 'Next',
      input: {
        defaultValue: s!.endpoint || '',
        placeholder: 'https://your-backup-relay.workers.dev',
      },
    })
    if (!endpoint) return
    const code = await dialog.prompt({
      title: 'Enter recovery code',
      message: 'Enter your zero-knowledge recovery code:',
      confirmText: 'Restore data',
      input: {
        placeholder: 'e.g. word1-word2-word3-word4',
      },
    })
    if (!code) return
    try {
      const n = await restoreBackup(endpoint, normalizeRecoveryCode(code))
      await setSetting('recoveryCode', normalizeRecoveryCode(code))
      await setSetting(SK.backupEndpoint, endpoint)
      setStatus(`Restored ${n} days.`)
    } catch (e) {
      setStatus(e instanceof Error ? e.message : 'Restore failed.')
    }
  }

  async function saveReminderPreferences(
    next: ReminderPreferences,
    requestPermission = false,
  ) {
    setReminderBusy(true)
    setStatus(null)
    try {
      const hasEnabledPlans = next.plans.some((plan) => plan.enabled)
      let prepared = next
      let permission = profileReminderPermission(s!.profile.permissions.notifications)

      if (isNative && hasEnabledPlans) {
        permission = await notificationPermission(requestPermission)
        prepared = withReminderPermission(next, permission)
      } else if (!isNative) {
        permission = 'not-requested'
        prepared = withReminderPermission(next, permission)
      }

      setReminders(prepared)
      await setSetting(REMINDER_SETTINGS_KEY, serializeReminderPreferences(prepared))

      // Retire the single legacy alarm after the first edit; preferences have
      // already been migrated into the cycle preset above.
      await cancelDailyReminder()
      await Promise.all([
        removeSetting(SK.reminderEmail),
        removeSetting(SK.reminderTime),
      ])

      if (isNative) {
        if (!hasEnabledPlans || permission !== 'granted') {
          await cancelMaterializedReminders()
        } else {
          await syncReminderPlans(prepared.plans, {
            now: new Date(),
            horizonDays: 30,
            limit: 64,
          })
        }

        if (permission !== 'not-requested') {
          const consentLedger = s!.profile.privacy.consentLedger
            .filter((decision) => decision.purpose !== 'notifications')
            .concat({
              purpose: 'notifications' as const,
              state: permission === 'granted' ? 'granted' as const : 'declined' as const,
              version: 1 as const,
              decidedAt: new Date().toISOString(),
            })
          await putHealthProfile({
            permissions: { notifications: permission },
            privacy: { consentLedger },
          })
        }
      }

      if (!isNative) {
        setStatus(
          'Saved locally. Native alarms will be scheduled when these preferences are used in the iOS or Android app.',
        )
      } else if (hasEnabledPlans && permission === 'denied') {
        setStatus('Saved locally, but notifications are blocked in your device settings.')
      } else if (hasEnabledPlans) {
        setStatus('Private reminder schedule updated on this device.')
      } else {
        setStatus('All local reminders are off.')
      }
    } catch (reason) {
      setStatus(reason instanceof Error ? reason.message : 'Could not update local reminders.')
    } finally {
      setReminderBusy(false)
    }
  }

  function changeReminderPlan(
    id: ReminderPreferenceId,
    changes: { enabled?: boolean; localTime?: string },
    requestPermission = false,
  ) {
    void saveReminderPreferences(
      updateReminderPlan(reminderPreferences, id, changes),
      requestPermission,
    )
  }

  function changeReminderGlobals(changes: {
    privatePreviews?: boolean
    quietHours?: {
      enabled?: boolean
      start?: string
      end?: string
    }
  }) {
    void saveReminderPreferences(
      withReminderGlobals(reminderPreferences, changes),
    )
  }

  async function wipe() {
    const confirmed = await dialog.confirm({
      title: 'Delete all data?',
      message: 'Delete ALL Periodus data and health logs on this device?\n\nThis action cannot be undone.',
      confirmText: 'Delete everything',
      cancelText: 'Keep my data',
      isDanger: true,
    })
    if (!confirmed) return
    await clearSecureSecrets()
    await db.delete()
    location.reload()
  }

  async function checkUpdates() {
    setUpdateBusy(true)
    setUpdateResult(null)
    try {
      const result = await checkForUpdate()
      setUpdateResult(result)
    } finally {
      setUpdateBusy(false)
    }
  }

  async function downloadUpdate(apkUrl: string) {
    if (isNative) {
      await Browser.open({ url: apkUrl, presentationStyle: 'popover' })
    } else {
      window.open(apkUrl, '_blank')
    }
  }

  async function triggerNanoDownload() {
    setNanoBusy(true)
    try {
      await geminiNanoDownload()
      // Refresh status so UI updates from 'downloadable' → 'downloading'
      const updated = await geminiNanoStatus()
      setNanoStatus(updated)
    } catch (e) {
      setStatus(e instanceof Error ? e.message : 'Could not start Gemini Nano download.')
    } finally {
      setNanoBusy(false)
    }
  }

  async function runNanoAnalysis() {
    if (!s) return
    setNanoBusy(true)
    setNanoAnalysis(null)
    try {
      // Import the stats & pattern engines lazily so they don't bloat initial bundle
      const [{ cycleWindowStatistics }, { buildCycleReport }] = await Promise.all([
        import('../engine/stats'),
        import('../engine/patterns'),
      ])
      const { db, getPeriodStarts } = await import('../db/schema')
      const { localToday } = await import('../lib/dates')
      const [days, periodStarts] = await Promise.all([
        db.dailyLogs.toArray(),
        getPeriodStarts(),
      ])
      const stats6 = cycleWindowStatistics(periodStarts, 6)
      const stats12 = cycleWindowStatistics(periodStarts, 12)
      const report = buildCycleReport(days, periodStarts, localToday())
      const prompt = buildCycleAnalysisPrompt({
        stats6,
        stats12,
        prediction: null,
        patterns: report.patterns,
        goal: s.goal ?? 'cycle',
      })
      const text = await geminiNanoInfer(prompt)
      setNanoAnalysis(text)
    } catch (e) {
      setStatus(e instanceof Error ? e.message : 'On-device analysis failed.')
    } finally {
      setNanoBusy(false)
    }
  }

  return (
    <div className="page">
      <h1>Settings</h1>
      {status && (
        <div className="card" style={{ background: 'var(--rose-100)', fontSize: 14 }}>
          {status}
        </div>
      )}

      <Section title="Goal">
        {(Object.keys(GOAL_LABELS) as Goal[]).map((g) => (
          <button key={g} className="setting-row" onClick={() => setGoal(g)}>
            <span>{GOAL_LABELS[g]}</span>
            <span style={{ color: 'var(--rose-500)' }}>{s.goal === g ? '●' : '○'}</span>
          </button>
        ))}
      </Section>

      <Section title="Cycle baseline &amp; duration">
        <button
          className="setting-row"
          onClick={async () => {
            const current = s.profile.cycle.typicalCycleLength ?? 28
            const val = await dialog.prompt({
              title: 'Typical cycle length',
              message: 'How many days are usually between the first day of one period and the first day of the next?',
              confirmText: 'Save',
              input: {
                type: 'number',
                defaultValue: String(current),
                placeholder: 'e.g. 28',
              },
            })
            if (val && !isNaN(Number(val)) && Number(val) >= 15 && Number(val) <= 120) {
              await putHealthProfile({
                cycle: { typicalCycleLength: Math.round(Number(val)) },
              })
              await setSetting(SK.cycleLength, String(Math.round(Number(val))))
              setStatus(`Typical cycle length updated to ${Math.round(Number(val))} days.`)
            }
          }}
        >
          <span>Typical cycle length</span>
          <span className="muted">
            {s.profile.cycle.typicalCycleLength ? `${s.profile.cycle.typicalCycleLength} days ›` : '28 days ›'}
          </span>
        </button>

        <button
          className="setting-row"
          onClick={async () => {
            const current = s.profile.cycle.typicalPeriodLength ?? 5
            const val = await dialog.prompt({
              title: 'Typical period duration',
              message: 'How many days does your menstrual bleeding usually last?',
              confirmText: 'Save',
              input: {
                type: 'number',
                defaultValue: String(current),
                placeholder: 'e.g. 5',
              },
            })
            if (val && !isNaN(Number(val)) && Number(val) >= 1 && Number(val) <= 20) {
              await putHealthProfile({
                cycle: { typicalPeriodLength: Math.round(Number(val)) },
              })
              setStatus(`Typical period length updated to ${Math.round(Number(val))} days.`)
            }
          }}
        >
          <span>Typical period duration</span>
          <span className="muted">
            {s.profile.cycle.typicalPeriodLength ? `${s.profile.cycle.typicalPeriodLength} days ›` : '5 days ›'}
          </span>
        </button>

        <button
          className="setting-row"
          onClick={async () => {
            const current = s.profile.cycle.regularity ?? 'regular'
            const next = current === 'regular' ? 'irregular' : current === 'irregular' ? 'unsure' : 'regular'
            await putHealthProfile({
              cycle: { regularity: next },
            })
            setStatus(`Cycle regularity updated to ${next}.`)
          }}
        >
          <span>Cycle regularity</span>
          <span className="muted">
            {s.profile.cycle.regularity === 'irregular'
              ? 'Irregular ›'
              : s.profile.cycle.regularity === 'unsure'
                ? 'Unsure ›'
                : 'Regular ›'}
          </span>
        </button>
      </Section>

      <Section title="Personalize">
        <button className="setting-row" onClick={() => setTrackerCustomizeOpen(true)}>
          <span>Customize daily trackers</span>
          <span className="muted">reorder &amp; hide ›</span>
        </button>
        <button className="setting-row" onClick={() => setCycleReportOpen(true)}>
          <span>Cycle report &amp; patterns</span>
          <span className="muted">›</span>
        </button>
        {s.goal === 'pregnancy' && (
          <>
            <form
              className="setting-pregnancy-form"
              onSubmit={(event) => {
                event.preventDefault()
                const input = event.currentTarget.elements.namedItem('pregnancyDate')
                if (input instanceof HTMLInputElement) {
                  void setPregnancyDate(pregnancyMethod, input.value)
                }
              }}
            >
              <label className="setting-row setting-date-row">
                <span>Dating source</span>
                <select
                  name="pregnancyDatingMethod"
                  value={pregnancyMethod}
                  onChange={(event) =>
                    setPregnancyMethod(event.currentTarget.value as PregnancyDatingMethod)
                  }
                  aria-label="Pregnancy dating source"
                  style={{
                    maxWidth: '58%',
                    border: 0,
                    background: 'transparent',
                    color: 'inherit',
                    font: 'inherit',
                    textAlign: 'right',
                  }}
                >
                  {PREGNANCY_DATING_OPTIONS.map((option) => (
                    <option value={option.method} key={option.method}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="setting-row setting-date-row">
                <span>
                  {PREGNANCY_DATING_OPTIONS.find(
                    (option) => option.method === pregnancyMethod,
                  )?.dateLabel ?? 'Pregnancy date'}
                </span>
                <input
                  key={`${pregnancyMethod}-${s.pregnancyDating?.inputDate ?? ''}`}
                  name="pregnancyDate"
                  type="date"
                  min={pregnancyDateBounds(pregnancyMethod).min}
                  max={pregnancyDateBounds(pregnancyMethod).max}
                  defaultValue={
                    s.pregnancyDating?.method === pregnancyMethod
                      ? s.pregnancyDating.inputDate
                      : ''
                  }
                  aria-label="Date used for the pregnancy timeline"
                />
              </label>
              {s.pregnancyDating && (
                <div className="setting-row static-row">
                  <span>Current dating status</span>
                  <span className="muted">
                    {s.pregnancyDating.provisional
                      ? 'Provisional estimate'
                      : 'Clinician assigned'}
                  </span>
                </div>
              )}
              <button className="setting-row setting-date-save" type="submit">
                <span>Update pregnancy timeline</span>
                <span className="muted">Save</span>
              </button>
            </form>
            <button
              className="setting-row"
              disabled={!s.pregnancyDating}
              onClick={() => setPregnancyDetailOpen(true)}
            >
              <span>Pregnancy week &amp; checklist</span>
              <span className="muted">{s.pregnancyDating ? '›' : 'add dating source first'}</span>
            </button>
          </>
        )}
        {s.goal === 'ttc' && (
          <button className="setting-row" onClick={() => setTtcDetailOpen(true)}>
            <span>TTC daily guide</span>
            <span className="muted">›</span>
          </button>
        )}
        {s.goal === 'peri' && (
          <button className="setting-row" onClick={() => setPerimenopauseOpen(true)}>
            <span>Perimenopause timeline</span>
            <span className="muted">›</span>
          </button>
        )}
      </Section>

      <Section title="Privacy &amp; lock">
        <button className="setting-row" onClick={s.hasPin ? removePin : setPin}>
          <span>PIN lock</span>
          <span className="muted">{s.hasPin ? 'On — tap to remove' : 'Off'}</span>
        </button>
        {isNative && (
          <button className="setting-row" disabled={capabilityBusy} onClick={toggleBiometricLock}>
            <span>Biometric unlock</span>
            <span className="muted">
              {s.biometricLock
                ? 'On'
                : biometrics?.available
                  ? 'Available ›'
                  : 'Unavailable'}
            </span>
          </button>
        )}
        <div className="setting-row static-row">
          <span>Secret storage</span>
          <span className="muted">{vaultLabel}</span>
        </div>
      </Section>

      {isNative && (
        <Section title="Device health &amp; native services">
          {nativePlatform === 'ios' && (
            <button className="setting-row" disabled={capabilityBusy} onClick={importApplePeriods}>
              <span>Import period history from Apple Health</span>
              <span className="muted">{capabilityBusy ? 'Working…' : 'Up to 2 years ›'}</span>
            </button>
          )}
          <button className="setting-row" disabled={capabilityBusy} onClick={syncHealthData}>
            <span>
              {health?.platform === 'healthkit'
                ? 'Import other Apple Health data'
                : health?.platform === 'health-connect'
                  ? 'Import from Health Connect'
                  : 'Health data import'}
            </span>
            <span className="muted">
              {capabilityBusy
                ? 'Working…'
                : health?.available
                  ? health.authorization === 'granted'
                    ? 'Connected ›'
                    : health.authorization === 'requested'
                      ? 'Requested ›'
                      : 'Connect ›'
                  : 'Unavailable'}
            </span>
          </button>
          <div className="setting-row static-row">
            <span>Home-screen widget</span>
            <span className="muted">
              {widget?.available ? 'Available' : widget?.publisherAvailable ? 'Native extension pending' : 'Unavailable'}
            </span>
          </div>
          <p className="muted" style={{ padding: '8px 0' }}>
            Health imports are read-only, permission-scoped, and copied into your local Periodus
            timeline. Manual entries are never silently replaced, and nothing is uploaded by this
            step.
          </p>
        </Section>
      )}

      <Section title="Your data &amp; encrypted backup">
        <button className="setting-row" onClick={exportPlain}>
          <span>Export a backup file</span>
          <span className="muted">›</span>
        </button>
        <button className="setting-row" onClick={exportEncrypted}>
          <span>Export encrypted</span>
          <span className="muted">›</span>
        </button>
        <button className="setting-row" onClick={() => fileInput.current?.click()}>
          <span>Import from file</span>
          <span className="muted">›</span>
        </button>
        <button className="setting-row" onClick={backupToGoogleDrive}>
          <span>Google Drive backup</span>
          <span className="muted">
            {s.googleAccountEmail
              ? `${s.googleAccountEmail.split('@')[0]} · ${s.googleLastBackup ? formatShort(s.googleLastBackup.split('T')[0]) : 'ready'} ›`
              : 'connect & back up ›'}
          </span>
        </button>
        {s.googleDriveToken && (
          <>
            <button className="setting-row" onClick={restoreFromGoogleDrive}>
              <span>Restore from Google Drive</span>
              <span className="muted">›</span>
            </button>
            <button className="setting-row" onClick={disconnectGoogle}>
              <span>Disconnect Google Drive</span>
              <span className="muted" style={{ color: 'var(--red-400)' }}>unlink ›</span>
            </button>
          </>
        )}
        <button className="setting-row" onClick={enableBackup}>
          <span>Encrypted relay backup</span>
          <span className="muted">zero-knowledge ›</span>
        </button>
        <button className="setting-row" onClick={restore}>
          <span>Restore from relay</span>
          <span className="muted">›</span>
        </button>
        <input
          ref={fileInput}
          type="file"
          accept="application/json"
          hidden
          onChange={(e) => e.target.files?.[0] && onImportFile(e.target.files[0])}
        />
      </Section>

      <div className="reminder-settings-section">
        <div className="section-label" style={{ marginBottom: 4 }}>
          Local reminders
        </div>
        <div className="card reminder-console">
          <div className="reminder-console-heading">
            <div>
              <span className="reminder-kicker">QUIETLY ON YOUR DEVICE</span>
              <h3>{activeReminderCount ? `${activeReminderCount} active` : 'Your time, your rhythm'}</h3>
              <p>
                {isNative
                  ? 'No account or server is used to deliver these notifications.'
                  : 'Set your preferences here; the native iOS and Android shells deliver them.'}
              </p>
            </div>
            <span
              className={`reminder-status-pill ${
                s.profile.permissions.notifications === 'denied' ? 'is-blocked' : ''
              }`}
            >
              {reminderBusy
                ? 'Saving…'
                : !isNative
                  ? 'Local'
                  : s.profile.permissions.notifications === 'denied'
                    ? 'Blocked'
                    : activeReminderCount
                      ? 'Ready'
                      : 'Off'}
            </span>
          </div>

          <div className="reminder-privacy-controls">
            <label className="reminder-privacy-row">
              <span>
                <strong>Private previews</strong>
                <small>
                  {reminderPreferences.privatePreviews
                    ? 'Lock screens show one neutral sentence.'
                    : 'Use broad category wording, never results or predictions.'}
                </small>
              </span>
              <span className="reminder-switch">
                <input
                  type="checkbox"
                  checked={reminderPreferences.privatePreviews}
                  disabled={reminderBusy}
                  onChange={(event) =>
                    changeReminderGlobals({ privatePreviews: event.currentTarget.checked })
                  }
                  aria-label="Use private reminder previews"
                />
                <span aria-hidden="true" />
              </span>
            </label>

            <div className="reminder-quiet-block">
              <label className="reminder-privacy-row">
                <span>
                  <strong>Quiet hours</strong>
                  <small>Anything inside this window moves to the end time.</small>
                </span>
                <span className="reminder-switch">
                  <input
                    type="checkbox"
                    checked={reminderPreferences.quietHours.enabled}
                    disabled={reminderBusy}
                    onChange={(event) =>
                      changeReminderGlobals({
                        quietHours: { enabled: event.currentTarget.checked },
                      })
                    }
                    aria-label="Enable quiet hours"
                  />
                  <span aria-hidden="true" />
                </span>
              </label>
              {reminderPreferences.quietHours.enabled && (
                <div className="reminder-quiet-times">
                  <label>
                    <span>From</span>
                    <input
                      type="time"
                      value={reminderPreferences.quietHours.start}
                      disabled={reminderBusy}
                      onChange={(event) =>
                        changeReminderGlobals({
                          quietHours: { start: event.currentTarget.value },
                        })
                      }
                    />
                  </label>
                  <span aria-hidden="true">→</span>
                  <label>
                    <span>Until</span>
                    <input
                      type="time"
                      value={reminderPreferences.quietHours.end}
                      disabled={reminderBusy}
                      onChange={(event) =>
                        changeReminderGlobals({
                          quietHours: { end: event.currentTarget.value },
                        })
                      }
                    />
                  </label>
                </div>
              )}
            </div>
          </div>

          <div className="reminder-plan-list">
            {REMINDER_DEFINITIONS.map((definition, index) => {
              const plan = reminderPreferences.plans.find(
                (candidate) => candidate.id === `settings-${definition.id}`,
              )
              if (!plan) return null
              return (
                <div
                  className={`reminder-plan ${plan.enabled ? 'is-enabled' : ''}`}
                  key={definition.id}
                  style={{ '--reminder-index': index } as React.CSSProperties}
                >
                  <span className="reminder-monogram" aria-hidden="true">
                    {definition.monogram}
                  </span>
                  <span className="reminder-plan-copy">
                    <strong>{definition.label}</strong>
                    <small>
                      {definition.detail} · {definition.cadence}
                    </small>
                  </span>
                  <label className="reminder-time-field">
                    <span className="sr-only">{definition.label} reminder time</span>
                    <input
                      type="time"
                      value={plan.localTime}
                      disabled={reminderBusy || !plan.enabled}
                      onChange={(event) =>
                        changeReminderPlan(definition.id, {
                          localTime: event.currentTarget.value,
                        })
                      }
                      aria-label={`${definition.label} reminder time`}
                    />
                  </label>
                  <label className="reminder-switch">
                    <input
                      type="checkbox"
                      checked={plan.enabled}
                      disabled={reminderBusy}
                      onChange={(event) =>
                        changeReminderPlan(
                          definition.id,
                          { enabled: event.currentTarget.checked },
                          event.currentTarget.checked,
                        )
                      }
                      aria-label={`${plan.enabled ? 'Disable' : 'Enable'} ${definition.label}`}
                    />
                    <span aria-hidden="true" />
                  </label>
                </div>
              )
            })}
          </div>

          <p className="reminder-footnote">
            Estimates, tests, and medication logs stay informational. A notification never confirms
            fertility, pregnancy, contraception protection, or a diagnosis.
          </p>
        </div>
      </div>

      <Section title="AI assistant">
        <button className="setting-row" onClick={() => setAssistantOpen(true)}>
          <span>Open Periodus AI</span>
          <span className="muted">
            {s.provider === 'anthropic'
              ? hasAnthropicKey
                ? 'Anthropic connected ›'
                : 'add Anthropic key ›'
              : s.provider === 'custom'
                ? hasCustomKey
                  ? 'Custom AI connected ›'
                  : 'configure custom AI ›'
                : hasOpenAiKey
                  ? 'OpenAI key secured ›'
                  : 'add OpenAI key ›'}
          </span>
        </button>
        <label className="setting-row">
          <span>Auto-generate women’s health insights</span>
          <span className="reminder-switch">
            <input
              type="checkbox"
              checked={s.autoAiInsights === '1'}
              onChange={async (e) => {
                const val = e.target.checked ? '1' : '0'
                await setSetting(SK.autoAiInsights, val)
                setStatus(`AI auto-insights ${e.target.checked ? 'enabled' : 'disabled'}.`)
              }}
            />
            <span aria-hidden="true" />
          </span>
        </label>
        <p className="muted" style={{ padding: '4px 16px 8px', fontSize: 12, lineHeight: 1.4 }}>
          Periodus can periodically research and draft fresh educational articles on nutrition, hormones, and wellness trends tailored to your focus stage.
        </p>
        {(s.provider === 'anthropic' ? hasAnthropicKey : s.provider === 'custom' ? hasCustomKey : hasOpenAiKey) && (
          <button className="setting-row" onClick={removeAiKey}>
            <span>Remove saved credential</span>
            <span className="muted">›</span>
          </button>
        )}
      </Section>

      {(isNative && nativePlatform === 'android') && (
        <Section title="App updates">
          <div className="setting-row static-row">
            <span>Current version</span>
            <span className="muted">{APP_VERSION}</span>
          </div>
          {updateResult?.status === 'available' && (
            <>
              <div className="setting-row static-row">
                <span>Latest version</span>
                <span style={{ color: 'var(--rose-500)', fontWeight: 600 }}>
                  {updateResult.latestVersion} ✦
                </span>
              </div>
              {updateResult.releaseNotes && (
                <div
                  className="setting-row static-row"
                  style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}
                >
                  <span style={{ fontWeight: 600, fontSize: 13 }}>What's new</span>
                  <span className="muted" style={{ fontSize: 12, whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                    {updateResult.releaseNotes.slice(0, 400)}
                  </span>
                </div>
              )}
              <button
                className="setting-row"
                style={{ color: 'var(--rose-500)', fontWeight: 600 }}
                onClick={() => downloadUpdate(updateResult.apkUrl)}
              >
                <span>Download &amp; Install {updateResult.latestVersion}</span>
                <span>↓</span>
              </button>
            </>
          )}
          {updateResult?.status === 'current' && (
            <div className="setting-row static-row">
              <span className="muted">You're on the latest version 🎉</span>
            </div>
          )}
          {updateResult?.status === 'error' && (
            <div className="setting-row static-row">
              <span className="muted" style={{ fontSize: 13 }}>{updateResult.message}</span>
            </div>
          )}
          <button
            className="setting-row"
            disabled={updateBusy}
            onClick={checkUpdates}
          >
            <span>{updateBusy ? 'Checking…' : 'Check for updates'}</span>
            <span className="muted">›</span>
          </button>
        </Section>
      )}

      {(isNative && nativePlatform === 'android') && (() => {
        const nano = nanoStatus
        const isReady = nano?.status === 'available'
        const isDownloading = nano?.status === 'downloading'
        const isDownloadable = nano?.status === 'downloadable'
        const isUnsupported = !nano || nano.status === 'not-supported' || nano.status === 'web'
        return (
          <Section title="On-device AI · Private">
            <div className="setting-row static-row">
              <span>Gemini Nano</span>
              <span
                className="muted"
                style={{
                  color: isReady ? 'var(--rose-500)' : isDownloading ? '#d97706' : undefined,
                  fontWeight: isReady ? 600 : undefined,
                }}
              >
                {isReady
                  ? 'Ready · 100% private'
                  : isDownloading
                    ? 'Downloading…'
                    : isDownloadable
                      ? 'Available — needs download'
                      : nano === null
                        ? 'Checking…'
                        : 'Not supported on this device'}
              </span>
            </div>
            {isDownloadable && (
              <button className="setting-row" disabled={nanoBusy} onClick={triggerNanoDownload}>
                <span>Download Gemini Nano model</span>
                <span className="muted">~1 GB · Wi-Fi recommended ›</span>
              </button>
            )}
            {isDownloading && (
              <div className="setting-row static-row">
                <span className="muted" style={{ fontSize: 13 }}>
                  Model downloading in the background. Check back in a few minutes.
                </span>
              </div>
            )}
            {isReady && (
              <>
                <button className="setting-row" disabled={nanoBusy} onClick={runNanoAnalysis}>
                  <span>{nanoBusy ? 'Analysing…' : 'Analyse my cycle data'}</span>
                  <span className="muted">runs on-device ›</span>
                </button>
                {nanoAnalysis && (
                  <div
                    className="setting-row static-row"
                    style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 6 }}
                  >
                    <span style={{ fontWeight: 600, fontSize: 13 }}>On-device analysis</span>
                    <span className="muted" style={{ fontSize: 13, lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>
                      {nanoAnalysis}
                    </span>
                  </div>
                )}
              </>
            )}
            {isUnsupported && (
              <div className="setting-row static-row">
                <span className="muted" style={{ fontSize: 12 }}>
                  Requires a Pixel 8+, Galaxy S24+, or similar device with Android 9+.
                </span>
              </div>
            )}
            <div className="setting-row static-row">
              <span className="muted" style={{ fontSize: 12, lineHeight: 1.5 }}>
                When available, your data is analysed entirely on this device — nothing is sent to any server.
              </span>
            </div>
          </Section>
        )
      })()}

      <Section title="About Periodus">
        <button className="setting-row" onClick={() => setAboutOpen(true)}>
          <span>About &amp; Support</span>
          <span className="muted">v{APP_VERSION} · 💖 Sponsor ›</span>
        </button>
      </Section>

      <Section title="Danger zone">
        <button className="setting-row" onClick={wipe} style={{ color: 'var(--red-500)' }}>
          <span>Delete all data</span>
          <span>›</span>
        </button>
      </Section>


      <p className="muted" style={{ textAlign: 'center', marginTop: 8, lineHeight: 1.5 }}>
        Periodus is open source (AGPL-3.0) and not affiliated with Flo Health Inc. Not a medical
        device. Removing the app deletes its local history — keep an encrypted backup.
      </p>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="section-label" style={{ marginBottom: 4 }} dangerouslySetInnerHTML={{ __html: title }} />
      <div className="card" style={{ padding: '0 16px' }}>
        {children}
      </div>
    </div>
  )
}
