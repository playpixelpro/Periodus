# Feature-depth delivery map

Updated: 2026-07-26

## Target and status language

Periodus's target is an original, premium-quality reproductive-health companion
with comparable product depth. It is not a counterfeit interface and does not
claim literal Flo parity.

Status terms:

- **Verified locally** — implemented and covered by the current TypeScript
  build and/or automated tests.
- **Implemented** — meaningful end-to-end code exists, but physical-device,
  accessibility, failure-state, or release validation remains.
- **Foundation** — core types, engine, or UI exist; the full user workflow is
  incomplete.
- **Missing** — no complete implementation exists.
- **External** — completion requires a platform account, credential, service,
  licensed content, or specialist review.
- **Excluded** — intentionally outside the requested scope.

The latest completed repository verification in this implementation pass was
the web production build plus **151 passing automated tests**, a freshly
synced Capacitor bundle, and successful unsigned iOS-simulator and Android
debug builds. Native release readiness is a separate standard.

## Adaptive setup and durable profile

| Capability | Status | Current boundary |
|---|---|---|
| Versioned local health profile | Verified locally | Schema v2 separates durable profile context from dated daily logs |
| Goal-conditioned onboarding graph | Verified locally | Cycle, TTC, pregnancy, and perimenopause choose different paths; a single primary mode is stored |
| Local-storage purpose consent | Verified locally | Onboarding records versioned local-health-storage and assistant-sharing decisions |
| Minimum-age gate | Foundation | Age 13 minimum and age bands exist; region-aware minimum age, guardian/legal policy, and age-change consequences remain |
| Cycle baseline | Verified locally | Regularity, up to three period starts, confidence, usual cycle length, and bleeding duration |
| Contraception-aware branch | Verified locally | Hormonal contexts receive a separate bleeding question and forecast suppression |
| TTC setup | Foundation | Trying-since date and fertility evidence education exist; discontinuation history, prenatal-vitamin plan, and test preferences remain |
| Pregnancy setup | Verified locally | Clinician EDD, LMP, conception, day-3/day-5 transfer, source authority, provisional status, and number of babies |
| Perimenopause setup | Foundation | Mode and relevant symptom questions exist; surgery, hormone-therapy, last-bleed, and transition-specific history remain |
| Tracker personalization | Verified locally | User chooses tracking areas; full category reordering and visibility remain editable later |
| Privacy/permission education | Foundation | Local and AI boundaries are explained; full notification, health-import, motion, denial, retry, and revocation paths are not all in onboarding |
| Review summary and correction | Verified locally | Summary reflects forecast eligibility and missing context; a richer purpose-by-purpose edit/review page remains useful |

This is intentionally not a five-screen funnel. Irrelevant modules are removed
by branch rules, while prediction-critical and consent-critical questions stay.

## Logging and local data

| Capability | Status | Current boundary |
|---|---|---|
| Searchable daily logger | Verified locally | Dense category sections and search support the observed tracker depth |
| Explicit complete check-in | Verified locally | Missing or partial days are not treated as symptom-free |
| Flow | Verified locally | Light, medium, heavy, and clots |
| Symptoms and ratings | Verified locally | Broad taxonomy plus optional severity and routine-impact detail |
| Mood | Verified locally | Broad mood/mental-health entry set |
| Discharge | Verified locally | None, watery, creamy, sticky, egg-white, spotting, unusual, clumpy white, and gray |
| Sexual and intimacy logs | Verified locally | Canonical multi-select model with legacy single-value compatibility |
| Pregnancy and ovulation tests | Verified locally | Typed pregnancy result plus OPK positive/negative; results remain observations |
| Digestion, activity, and lifestyle | Verified locally | Typed multi-select values |
| BBT, sleep, steps, water, weight, and notes | Verified locally | Stored as dated measurements or notes |
| Medication/contraception adherence events | Foundation | Tracker events exist; a first-class dated regimen, dose, pack/change schedule, and history model is still missing |
| Tracker visibility/reordering | Verified locally | Stored locally |
| Edit/delete history and provenance | Foundation | Current value editing works; audit history and source provenance are incomplete |
| Local import/export | Verified locally | Plain and passphrase-encrypted export/import |
| Local wipe | Verified locally | Settings can clear device data |
| Encrypted core database at rest | Missing | Core records still use WebView/Dexie storage |
| Zero-knowledge backup relay | Foundation | Client encryption and opaque blob relay exist; recovery UX, production abuse controls, and deployment are not release-ready |

## Forecasts and safety policy

| Capability | Status | Current boundary |
|---|---|---|
| Robust cycle forecast | Verified locally | Recent median, bounded data-quality exclusions, history-derived uncertainty, and explicit methodology |
| Period range | Verified locally | Point date is accompanied by an estimated window |
| Calendar ovulation/fertile range | Verified locally | Informational estimate only; never a safe-day or contraceptive claim |
| OPK evidence | Verified locally | Positive OPK is described as suggestive, not confirmation |
| BBT-shift evidence | Verified locally | Sustained shift is retrospective support; sparse-data thresholds need clinical hardening |
| Prediction policy layer | Verified locally | Pregnancy suppresses cycle forecasts; hormonal contraception suppresses fertility forecasts; irregular/PCOS/peri context widens uncertainty |
| “Why this estimate” explanation | Verified locally | Today exposes source, range, evidence, exclusions, and reasons |
| Pregnancy dating engine | Verified locally | Preserves input method and clinician/art/user authority; calculated dates are provisional |
| Deterministic safety rules | Verified locally | Explicit bleeding, pregnancy/pelvic-pain, postmenopausal-bleeding, and self-harm combinations produce sourced care levels |
| Safety workflow integration | Foundation | Engine is tested; not every logger, report, article, and assistant entry point invokes it |
| Pregnancy-chance probability | Not implemented by design | Lunara uses qualitative timing; it does not fabricate a numeric probability |
| Future symptom forecast | Missing | No validated prospective symptom model |
| Diagnosis or contraceptive mode | Excluded | Lunara is not a medical device and predictions must not be used to prevent pregnancy |

## Today, calendar, and goal modes

| Capability | Status | Current boundary |
|---|---|---|
| Today phase renderer | Verified locally | Empty-history, period, follicular/fertile/ovulatory, luteal/late, suppressed, and pregnancy states |
| Date strip and quick actions | Verified locally | Date-aware logging shortcuts and insight cards |
| Calendar | Verified locally | Month/year navigation, period editing, logged and estimated markers |
| Cycle mode | Verified locally | Period/cycle-day/ovulation/fertile/late states with uncertainty |
| TTC mode | Foundation | Fertile range, OPK/BBT context, timing guidance, test plan, and detail screen; full prospective protocol and reminders remain |
| Pregnancy mode | Foundation | Source-aware gestational timeline, Today/detail surfaces, original weekly content, checklist, FAQs, and warning copy; appointments, tests, postpartum/loss flows, and clinical review remain |
| Perimenopause mode | Foundation | Original non-diagnostic burden snapshot, symptom domains, trend windows, observations, and relief notebook; stage inference is deliberately absent |
| Historical mode/regimen eras | Foundation | Analytics exposes an annotation hook; dated contraception, pregnancy, postpartum, and treatment histories are not yet captured |
| True menopause-stage diagnosis | Excluded | No public screen can justify reproducing a proprietary score or diagnosing stage |

## Trends, reports, and clinician handoff

| Capability | Status | Current boundary |
|---|---|---|
| Six- and twelve-cycle statistics | Verified locally | Separate bounded windows with sample size, median/average, range, and descriptive slope |
| Bleeding trend | Verified locally | Consecutive logged-flow dates form episodes; missing days are not filled |
| Tracking completeness | Verified locally | Any-entry and explicit-complete-check-in coverage are reported separately |
| Symptom-by-phase summary | Verified locally | Complete check-ins only; association is not presented as cause |
| Pattern cards | Verified locally | Deterministic phase, day-cluster, and co-occurrence rules with evidence and minimum thresholds |
| BBT/OPK observation series | Verified locally | Plotting series only; no exact ovulation confirmation |
| Cycle report UI | Verified locally | Methodology, data sufficiency, patterns, bleeding, phase summaries, and fertility observations |
| Doctor summary | Implemented | Print/save-as-PDF view, methodology, data range, and opt-in sensitive sections |
| Native PDF/share flow | Missing | Browser print exists; platform-native document generation and sharesheet are not wired |
| Imported-source provenance/conflict UI | Missing | Health samples have source fields, but reconciliation and report provenance are incomplete |

## Reminders and native platform

| Capability | Status | Current boundary |
|---|---|---|
| Reminder-plan engine | Verified locally | Once, dates, daily, weekdays, interval, and monthly recurrence; IANA time zones, DST handling, quiet hours, snooze/completion, and bounded materialization |
| Reminder kinds | Verified locally | Cycle, period, pregnancy, BBT/OPK/tests, medication, contraception, prenatal vitamin, water, sleep, weight, movement, and journaling |
| Privacy-safe notification copy | Verified locally | Private and broad-category preview modes exclude results, fertility status, medication names, and pregnancy detail |
| Native notification adapter | Implemented | Schedules/cancels pending requests and exposes open/complete/snooze actions |
| Reminder settings and persistence | Implemented | Seven reviewed presets, per-plan enable/time controls, quiet hours, preview privacy, local migration/persistence, permission requests, and native rescheduling are wired; native action completion/snooze persistence still needs device-level lifecycle QA |
| Capacitor iOS and Android shells | Implemented | Native projects, bundled offline assets, and debug build workflows exist |
| Keychain/Keystore vault | Implemented | Secret store/read/delete bridges exist; physical-device and recovery validation remain |
| PIN/biometric gate | Implemented | UI and native bridges exist; retry throttling and production recovery policy remain |
| HealthKit/Health Connect import | Implemented | Permission-scoped types and native bridges exist; provenance, conflict, revocation, and physical-device QA remain |
| iOS/Android widgets | Implemented | Redacted foreground snapshot publishing exists; background extensions redraw the last snapshot |
| Store distribution | External | Signing, developer accounts, privacy declarations, store metadata, and review |

## Content and assistant

| Capability | Status | Current boundary |
|---|---|---|
| Searchable local articles | Verified locally | Small original offline library with bookmarks |
| Original pregnancy/TTC/peri guides | Foundation | Useful local content exists; it is not a comprehensive reviewed corpus |
| Audio, video, and courses | Missing | Requires original or licensed media, transcripts, accessibility, and editorial review |
| OpenAI assistant | Implemented | BYO project key, official API transport, `store: false`, and explicit context-category toggles; requires network, billing, and provider access |
| Ollama assistant | Implemented | User-owned local/LAN provider path; on-device size/performance and physical-device networking are not validated |
| Secret storage for API keys | Implemented | Native vault is used; keys are not committed to source or stored in IndexedDB |
| Urgent-message interception | Foundation | Deterministic safety interception exists; comprehensive clinical evaluation and localized crisis handling remain external |
| Reviewed retrieval corpus and eval program | Missing / External | Requires editorial versioning, clinician governance, red-team cases, monitoring, and incident response |

## Deliberately excluded

The requested scope includes the AI assistant and excludes:

- Community / Secret Chats
- Partner sharing or synchronization
- Symptom Checker
- Guided Journey

These are not backlog omissions. A limited warning-sign safety router is still
required because any health app needs a safe response to explicitly reported
urgent symptoms; it does not diagnose a condition or reproduce a Symptom
Checker.

## Remaining release blockers

1. Migrate core health data from Dexie/WebView storage to encrypted native
   SQLite with versioned migration and rollback tests.
2. Complete first-class contraception/medication regimen history and persist
   native notification action completion/snooze across lifecycle restarts.
3. Wire safety evaluation consistently through logger, pregnancy, reports, and
   assistant entry points.
4. Finish health-import provenance, deduplication, conflict, revocation, and
   deletion behavior.
5. Validate notifications, biometrics, HealthKit, Health Connect, widgets,
   lifecycle, offline launch, and networking on physical iOS and Android
   devices.
6. Conduct clinical/editorial review of fertility, pregnancy, bleeding,
   perimenopause, and assistant content.
7. Complete accessibility, localization, privacy/legal, security, and data-loss
   audits.
8. Add signed release builds, store declarations, and App Store/Play review.
