# Periodus native architecture

## Decision

Periodus is a native-distributed, local-first application. React and TypeScript
own the shared product UI and deterministic health engines. Capacitor embeds
that application in first-class iOS and Android projects. Native APIs are
exposed through narrow, typed bridges rather than scattered platform checks.

This is not a hosted website wrapped for the stores. The bundled web assets
ship inside each application and work without a network connection.

## Runtime topology

```text
React / TypeScript product layer
├── screens, navigation, motion and accessibility
├── cycle, TTC, pregnancy and perimenopause engines
├── local educational content
├── reports and visualizations
└── typed native service interfaces
    ├── iOS shell (Swift)
    │   ├── HealthKit
    │   ├── Keychain + LocalAuthentication
    │   ├── UserNotifications
    │   ├── BackgroundTasks
    │   └── WidgetKit
    └── Android shell
        ├── Health Connect
        ├── Keystore + BiometricPrompt
        ├── AlarmManager / WorkManager
        └── App Widgets
```

## Data ownership

- Health logs and derived insights are device-owned.
- The current Dexie store remains the migration source during the native
  transition.
- The target store is encrypted native SQLite with versioned migrations.
- Encryption keys live in Keychain on iOS and Android Keystore on Android.
- User exports remain portable, versioned and independently encrypted.
- Optional sync and backup may only transport opaque, client-encrypted data.
- AI is opt-in. A local model or user-selected provider receives the minimum
  scoped context the user explicitly chooses to send.

## Native service boundaries

| Service | Shared contract | iOS | Android |
|---|---|---|---|
| Secure vault | store/read/delete secret | Keychain | Keystore |
| Biometrics | availability/authenticate | LocalAuthentication | BiometricPrompt |
| Health data | authorize/read/write | HealthKit | Health Connect |
| Reminders | schedule/cancel/list | UserNotifications | AlarmManager |
| Background work | refresh derived state | BackgroundTasks | WorkManager |
| Widgets | publish redacted snapshot | WidgetKit | Glance/App Widgets |
| Sharing | export report/backup | UIActivityViewController | Sharesheet |

No native bridge returns more health data than the requesting screen needs.

## Local-first precedents

- Capacitor officially supports adding native Swift and Android functionality
  to an existing web application through plugins.
- HealthKit and Health Connect are permission-controlled system repositories;
  integrations read only user-approved categories.
- SQLCipher-backed SQLite is a viable encrypted native-store path, with export
  compliance reviewed before release.
- Local notifications replace the PWA reminder compromise and work without a
  Periodus server after the user grants permission.

## Build workflow

```sh
pnpm install
pnpm --filter @periodus/app test
pnpm --filter @periodus/app build:native
pnpm --filter @periodus/app native:sync

# Native IDEs
pnpm --filter @periodus/app native:ios
pnpm --filter @periodus/app native:android
```

Web development remains useful for fast UI iteration with `pnpm dev`, but the
shipping artifacts are the Xcode and Android projects.
