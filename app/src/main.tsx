import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { StartupErrorBoundary } from './components/StartupErrorBoundary'
import { initializeNativeRuntime } from './native/runtime'
import { Onboarding } from './screens/Onboarding'
import { DialogProvider } from './context/DialogContext'
import { ThemeProvider, readStoredTheme } from './context/ThemeContext'
import './styles/base.css'
import './styles/app.css'
import './styles/health-import.css'

// Apply the persisted theme before first paint to avoid a flash of the wrong
// palette. ThemeProvider re-applies it on mount and on change.
document.documentElement.dataset.theme = readStoredTheme()

// Retire service workers left behind by pre-native development builds. Lunara
// no longer registers a PWA or depends on service-worker caching.
if ('serviceWorker' in navigator) {
  void navigator.serviceWorker
    .getRegistrations()
    .then((registrations) => Promise.all(registrations.map((registration) => registration.unregister())))
    .catch(() => undefined)
}

void initializeNativeRuntime()

const onboardingPreview =
  import.meta.env.DEV &&
  new URLSearchParams(window.location.search).get('preview') === 'onboarding'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <StartupErrorBoundary>
      <ThemeProvider>
        <DialogProvider>
          {onboardingPreview ? (
            <Onboarding
              onDone={() => {
                window.location.assign('/')
              }}
            />
          ) : (
            <App />
          )}
        </DialogProvider>
      </ThemeProvider>
    </StartupErrorBoundary>
  </React.StrictMode>,
)
