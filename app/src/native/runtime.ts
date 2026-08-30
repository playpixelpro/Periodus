import { App as NativeApp } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'
import { Haptics, ImpactStyle } from '@capacitor/haptics'
import { Keyboard } from '@capacitor/keyboard'
import { SplashScreen } from '@capacitor/splash-screen'
import { StatusBar, Style } from '@capacitor/status-bar'
import { useApp } from '../state/appStore'

export const isNative = Capacitor.isNativePlatform()
export const nativePlatform = Capacitor.getPlatform()

/**
 * Handles Android system back gesture / back button press:
 * - Closes any open sheet, modal, subscreen, or article reader.
 * - Navigates from secondary tabs (Insights, Trends, Settings) back to Today tab.
 * - Returns true if the back event was consumed, or false if at root home screen.
 */
export function handleAndroidBackButton(): boolean {
  const state = useApp.getState()

  // 1. Dismiss overlays in priority order
  if (state.aboutOpen) {
    state.setAboutOpen(false)
    return true
  }
  if (state.articleSlug) {
    state.setArticleSlug(null)
    return true
  }
  if (state.sheetDate) {
    state.closeSheet()
    return true
  }
  if (state.calendarOpen) {
    state.setCalendarOpen(false)
    return true
  }
  if (state.reportOpen) {
    state.setReportOpen(false)
    return true
  }
  if (state.cycleReportOpen) {
    state.setCycleReportOpen(false)
    return true
  }
  if (state.pregnancyDetailOpen) {
    state.setPregnancyDetailOpen(false)
    return true
  }
  if (state.perimenopauseOpen) {
    state.setPerimenopauseOpen(false)
    return true
  }
  if (state.ttcDetailOpen) {
    state.setTtcDetailOpen(false)
    return true
  }
  if (state.trackerCustomizeOpen) {
    state.setTrackerCustomizeOpen(false)
    return true
  }
  if (state.assistantOpen) {
    state.setAssistantOpen(false)
    return true
  }

  // 2. If on secondary tab, return to main Today tab
  if (state.tab !== 'today') {
    state.setTab('today')
    return true
  }

  return false
}

/**
 * Keep the React application platform-agnostic while the native shells own
 * operating-system concerns. Every call is guarded so the browser build
 * remains a useful development surface.
 */
export async function initializeNativeRuntime(): Promise<void> {
  document.documentElement.dataset.runtime = isNative ? nativePlatform : 'web'
  if (!isNative) return

  await Promise.allSettled([
    StatusBar.setStyle({ style: Style.Light }),
    StatusBar.setOverlaysWebView({ overlay: true }),
    Keyboard.setAccessoryBarVisible({ isVisible: true }),
  ])

  await NativeApp.addListener('backButton', ({ canGoBack }) => {
    const handled = handleAndroidBackButton()
    if (handled) return

    if (canGoBack) {
      history.back()
    } else {
      void NativeApp.minimizeApp()
    }
  })

  await SplashScreen.hide({ fadeOutDuration: 260 })
}

export async function nativeTap(style: ImpactStyle = ImpactStyle.Light): Promise<void> {
  if (!isNative) return
  await Haptics.impact({ style }).catch(() => undefined)
}
