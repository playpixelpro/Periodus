# Periodus

<div align="center">

![Periodus Logo](app/public/icons/icon-192.png)

### **Private, Local-First Cycle & Reproductive Health Companion**

[![License: AGPL-3.0](https://img.shields.io/badge/License-AGPL_3.0-amber.svg?style=flat-square)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue.svg?style=flat-square)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18-61dafb.svg?style=flat-square)](https://react.dev/)
[![Capacitor](https://img.shields.io/badge/Capacitor-8.4-53B9EA.svg?style=flat-square)](https://capacitorjs.com/)
[![Zero Knowledge](https://img.shields.io/badge/Zero--Knowledge-AES--GCM-success.svg?style=flat-square)](#-security--privacy)
[![Sponsor](https://img.shields.io/badge/Sponsor-💖-ea4aaa.svg?style=flat-square)](#-support--sponsorship)

*Empowering health autonomy through on-device computing, zero surveillance, and Terminal Modernist design.*

</div>

---

> [!NOTE]
> **Lineage & Origin**: **Periodus** is an independent, actively developed **hard fork of [Lunara](https://github.com/lunara-app/lunara)**. It inherits Lunara's robust local-first foundation while introducing a state-of-the-art **Terminal Modernist design system**, **fluid momentum scrolling**, **custom asynchronous dialog systems**, and **enhanced zero-knowledge cloud backup integrations**.

---

## ✨ Why Periodus?

| Feature | Periodus | Mainstream Commercial Apps |
| :--- | :--- | :--- |
| **Data Privacy** | **100% Zero-Knowledge & Local-First** | Cloud-stored, monetized, or shared |
| **Subscription Paywalls** | **Free & Open Source Forever (AGPL-3.0)** | $50–$80/year recurring subscriptions |
| **Onboarding Experience** | **Fast, respectful & explainable** | 50+ intrusive question sales funnel |
| **Cloud Backups** | **Client-side encrypted (AES-256-GCM)** | Plaintext or server-accessible storage |
| **UI Aesthetics** | **Terminal Modernist (High-contrast dark gold)** | Generic pink pastels & ad banners |
| **AI Assistant** | **Bring-your-own-key, per-message consent** | Mandatory cloud telemetry |

---

## 🚀 Key Features

### 🌑 1. Terminal Modernist UI & Tactile Physics
- **Vibrant & Legible Dark Theme**: Deep obsidian surfaces (`#16130b`), glowing containers, and warm gold accents (`#ffe1a3`).
- **Fluid Momentum Scrolling**: Complete touch physics (`-webkit-overflow-scrolling: touch;`, overscroll containment) across all main tabs, calendar overlays, health detail modals, and bottom sheets.
- **Floating Elevated Cards**: Structured with clean hierarchy, responsive line-heights, and safe-area padding above the navigation bar.
- **Custom In-App Dialog System**: Built-in `useDialog` modal alerts, confirms, copyable recovery codes, and prompts (no raw browser popups).

### 🩸 2. Adaptive Lifecycle Health Tracking
- **Cycle & Flow Forecasts**: Probabilistic estimation windows tailored for both regular and irregular cycles.
- **Trying to Conceive (TTC)**: Basal Body Temperature (BBT) plotting, LH surge test tracking, cervical mucus, and fertile window calculation.
- **Pregnancy Support**: Multi-source dating (LMP, ultrasound EDD, conception date) and developmental milestone timelines.
- **Perimenopause Monitoring**: Tracking vasomotor symptoms, cycle length shifts, and clinician prompt generation.

### 🛡️ 3. Zero-Knowledge Backups & Native Cloud Sync
- **Native Cloud & Drive Sync (Zero-Setup)**: Save encrypted database snapshots (`.vault` / `.json`) directly into **Google Drive**, **iCloud Drive**, **OneDrive**, **Proton Drive**, **Dropbox**, **Nextcloud**, or local device folders using the OS file picker and share sheet — **with 0 API keys, 0 Google Cloud setup, and 0 approval hassles**.
- **Client-Side AES-256-GCM Encryption**: All exports are protected on-device with authenticated encryption using your zero-knowledge recovery passphrase.
- **Stateless Cloudflare Relay**: Optional support for headless zero-knowledge Worker + R2 relays.

### 🤖 4. Private AI Companion & Curated Insights
- **Bring Your Own Key**: Connect Anthropic (Claude), OpenAI, or local custom endpoints (Ollama / LocalAI).
- **Hardware Isolation**: API credentials are saved exclusively in iOS Keychain / Android Keystore.
- **Granular Consent**: Choose exactly what categories of tracker context (if any) are attached to each question.
- **AI-Curated Women's Health Articles**: Generate evidence-based articles dynamically saved directly into your local database.

### 🩺 5. Executive Doctor & Clinical PDF Reports
- **Executive Clinical Formatting**: Structured PDF reports featuring the Periodus vector logo badge, 3 key cycle metrics cards, recent cycle history tables, 2-column symptom frequency grids, and biomarker logs.
- **Physician Consultation Notes**: Dedicated clinician notes section for appointments and doctor visits.
- **Native Sharing & File Export**: Built-in `@capacitor/share` and `@capacitor/filesystem` integration for native share sheet export on mobile and modern "Save As" file dialog on desktop.

---

## 📱 Getting Started on Mobile

Periodus can be compiled directly onto your device using standard Capacitor tooling:

### 1. Prerequisites
- [Node.js LTS (v20+)](https://nodejs.org/en/download)
- [Git](https://git-scm.com/)
- [pnpm](https://pnpm.io/installation) (`npm install -g pnpm`)

### 2. Clone & Install
```sh
# Clone the repository
git clone https://github.com/playpixelpro/Periodus.git
cd Periodus

# Install dependencies
pnpm install

# Build and sync native bundles
pnpm --filter @periodus/app native:sync
# or simply: pnpm native:sync
```

### 3. Run on Android (Windows, Mac, Linux)
1. Install [**Android Studio**](https://developer.android.com/studio).
2. Enable **USB Debugging** on your Android phone under *Developer Options*.
3. Open the Android project in Android Studio:
   ```sh
   pnpm --filter @periodus/app native:android
   # or: pnpm native:android
   ```
4. Connect your device and press **▶ Run**.

### 4. Run on iOS (macOS required)
1. Open the iOS project in **Xcode**:
   ```sh
   pnpm --filter @periodus/app native:ios
   # or: pnpm native:ios
   ```
2. Select the **App** target → **Signing & Capabilities** and choose your Apple ID team.
3. Select your connected iPhone and press **▶ Run**.

---

## 💻 Local Web Development

To run and test Periodus in your desktop browser:

```sh
# Start local Vite development server
pnpm dev

# Run full test suite (unit tests & fuzz estimation audits)
pnpm test

# Sync changes to native shells after code edits
pnpm --filter @periodus/app native:sync
# or: pnpm native:sync
```

---

## 📂 Project Architecture

```text
Periodus/
├── app/                          # Main React + Capacitor Application
│   ├── android/                  # Native Android project (com.playpixelpro.myperiod)
│   ├── ios/                      # Native iOS project & Widget Extension
│   ├── public/                   # Static assets, PWA manifests, icons
│   └── src/
│       ├── components/           # UI components (Sheets, DoctorReport, LogSheet, Dialogs)
│       ├── context/              # Global React contexts (DialogProvider, Theme)
│       ├── crypto/               # AES-GCM vault encryption & key derivation
│       ├── db/                   # Dexie / IndexedDB schemas and health profiles
│       ├── engine/               # Cycle estimation, stats, TTC, & safety fuzz tests
│       ├── lib/                  # Native bridges, assistant clients, date utilities
│       ├── screens/              # Core screens (Today, Insights, Trends, Settings, Onboarding)
│       └── styles/               # Terminal Modernist design system (tokens, app.css, health.css)
├── workers/                      # Cloudflare Worker relays (Backup & Reminders)
└── docs/                         # Architecture and technical specifications
```

---

## 🔒 Security & Privacy

1. **Zero Cloud Requirement**: The database operates in SQLite (native) or IndexedDB (web).
2. **Encrypted Vaults**: Secrets and sensitive fields use PBKDF2/Argon2 key derivation with authenticated AES-GCM encryption.
3. **App Links & Permissions**: Health Connect (Android 14+) and Apple HealthKit permissions are strictly read-only and requested on-demand.

---

## 💖 Support & Sponsorship

Periodus is completely free, open source, and built without advertisements, investor tracking, or user data monetization. If Periodus brings value to your health autonomy, consider supporting independent development:

<div align="center">

[![GitHub Sponsors](https://img.shields.io/badge/GitHub_Sponsors-playpixelpro-EA4AAA?style=for-the-badge&logo=github&logoColor=white)](https://github.com/sponsors/playpixelpro)
[![Ko-fi](https://img.shields.io/badge/Ko--fi-playpixelpro-FF5E5B?style=for-the-badge&logo=kofi&logoColor=white)](https://ko-fi.com/playpixelpro)
[![Buy Me A Coffee](https://img.shields.io/badge/Buy_Me_A_Coffee-playpixelpro-FFDD00?style=for-the-badge&logo=buymeacoffee&logoColor=black)](https://buymeacoffee.com/playpixelpro)
[![Patreon](https://img.shields.io/badge/Patreon-playpixelpro-FF424D?style=for-the-badge&logo=patreon&logoColor=white)](https://patreon.com/playpixelpro)

</div>

---

## ⚖️ License & Attribution

- Licensed under the **[GNU Affero General Public License v3.0 (AGPL-3.0)](LICENSE)**.
- **Periodus** is an open-source hard fork of **[Lunara](https://github.com/lunara-app/lunara)**.
- Periodus is not affiliated with, endorsed by, or connected to Flo Health Inc.

---

<div align="center">
<b>Periodus</b> — Your cycle, your health, your data.
</div>
