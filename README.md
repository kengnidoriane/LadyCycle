# LadyCycle

A privacy-first menstrual cycle tracking app built with React Native. All data stays on your device, encrypted with AES-256. Predictions improve over time using an adaptive algorithm that learns from your personal cycle history.

---

## Features

- **Cycle tracking** — log period start and end dates, view your full history
- **Predictions** — next period and ovulation estimates with a confidence indicator (low / medium / high)
- **Fertile window** — calculated using the calendar method (ovulation − 5 days to ovulation + 1 day)
- **Symptom tracking** — record daily symptoms across five categories: pain, mood, energy, physical, sleep
- **Medication reminders** — schedule reminders tied to your cycle, log each dose with a precise UTC timestamp
- **Wellness advice** — phase-aware tips (menstrual, follicular, ovulation, luteal) adapted to your tracking mode
- **Exceptional cycles** — mark anomalous cycles (illness, stress) to exclude them from predictions without deleting them
- **Statistics** — average cycle length, menstruation duration, regularity score (standard deviation σ)
- **Proactive notifications** — configurable advance notice (1–7 days) for upcoming periods and fertile windows
- **Tracking modes** — General, Trying to Conceive, Natural Contraception
- **Bilingual** — French and English, auto-detected from system settings, switchable at runtime
- **Local-first encryption** — AES-256 via SQLCipher; master key stored in Android Keystore / iOS Keychain, never leaves the device
- **Cloud backup (E2EE)** — optional; requires generating a 12-word Recovery Kit (BIP-39) before the first sync

---

## Architecture

The project follows **DDD Lite** (Domain-Driven Design, simplified): business logic lives in `domain/` with zero external dependencies, making it fully testable without an emulator.

```
src/
├── domain/              # Pure logic — no external dependencies
│   ├── cycle/           # CycleManager, PredictionEngine, Cycle types
│   ├── symptoms/        # SymptomTracker
│   └── wellness/        # WellnessAdvisor
│
├── application/         # Use cases (orchestration layer)
│   ├── RecordPeriodUseCase.ts
│   ├── PredictNextCycleUseCase.ts
│   ├── MarkCycleExceptionalUseCase.ts
│   └── GetDailyAdviceUseCase.ts
│
├── infrastructure/      # Concrete implementations
│   ├── db/              # SQLCipher, VersionManager, schema migrations
│   ├── crypto/          # EncryptionService, RecoveryKitService
│   ├── notifications/   # LocalNotifications (no push server)
│   └── i18n/            # JSON translation files (fr / en)
│
└── presentation/        # React Native UI
    ├── calendar/        # CalendarScreen, RecordPeriodForm, SymptomForm
    ├── statistics/      # StatisticsScreen, CycleDetailScreen
    ├── settings/        # SettingsScreen, SecurityScreen, RecoveryKitScreen
    └── wellness/        # WellnessScreen
```

**Dependency rule**: `domain/` ← `application/` ← `infrastructure/` + `presentation/`

---

## Prediction Algorithm

| History | Algorithm | Confidence |
|---------|-----------|------------|
| < 3 non-exceptional cycles | 28-day default | Low |
| 3–5 non-exceptional cycles | Simple average | Medium |
| ≥ 6 non-exceptional cycles | Weighted average `0.5·n + 0.3·(n-1) + 0.2·(n-2)` + σ | High / Medium / Low |

Ovulation is estimated at **next period − 14 days** (Ogino-Knaus calendar method). Cycles marked as exceptional are excluded from all calculations.

---

## Data Model

Dates use two distinct types to avoid timezone bugs:

| Type | Format | Used for |
|------|--------|----------|
| `CalendarDate` | `YYYY-MM-DD` | Cycle dates, symptoms, predictions |
| `UTCTimestamp` | ISO 8601 UTC | Medication logs, `created_at`, `updated_at` |

The SQLite database is fully encrypted by SQLCipher. The master key never leaves the device's secure enclave (Keystore / Keychain).

---

## Security

- **At-rest encryption**: AES-256 via SQLCipher — the entire `.db` file is encrypted
- **Key storage**: Android Keystore / iOS Keychain — hardware-backed, inaccessible to other apps
- **Cloud backup**: the already-encrypted SQLite file is uploaded; the master key is never transmitted
- **Recovery Kit**: a 12-word BIP-39 mnemonic that derives the cloud decryption key; must be saved before the first sync
- **Authentication**: PIN or biometrics (Face ID / Touch ID / BiometricPrompt); auto-lock configurable
- **Schema migrations**: every migration runs inside a SQL transaction with a pre-migration backup; rolled back automatically on failure

---

## Testing

The project uses **Jest** + **[fast-check](https://fast-check.dev)** for property-based testing.

```bash
# Run all tests
cd LadyCycle
npm test

# Run with coverage report
npx jest --coverage

# Run only domain + application tests
npx jest --testPathPattern="src/(domain|application)"
```

**37 correctness properties** are verified, each with a minimum of 100 fast-check iterations. Current coverage:

| Metric | Value |
|--------|-------|
| Statements | 81% |
| Lines | 82% |
| Functions | 83% |
| Branches | 67% |

Property tests are located alongside their implementation in `__tests__/` directories, named `*.properties.test.ts`.

---

## Getting Started

### Prerequisites

- Node.js ≥ 18
- React Native environment set up: [reactnative.dev/docs/set-up-your-environment](https://reactnative.dev/docs/set-up-your-environment)
- Android Studio with an AVD (Android Virtual Device) **or** a physical device with USB debugging enabled

### Install dependencies

```bash
cd LadyCycle
npm install
```

### Run on Android

```bash
# Terminal 1 — start the Metro bundler
npm start

# Terminal 2 — build and launch on Android
npm run android
```

### Run on iOS (macOS only)

```bash
# Install CocoaPods (first time only)
bundle install
bundle exec pod install

# Terminal 1
npm start

# Terminal 2
npm run ios
```

---

## Internationalization

The app ships with French and English. The language is auto-detected from the device's system settings on first launch and can be changed at any time in Settings without restarting the app.

Wellness advice content (medical tips) is stored in manually written JSON files under `src/infrastructure/i18n/wellness/` — never machine-translated, to ensure medical accuracy.

---

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Run tests before committing: `npm test`
4. Open a pull request against `main`

---

## License

MIT
