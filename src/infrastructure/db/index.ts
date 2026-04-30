// infrastructure/db — SQLCipher, VersionManager, CycleRepository, migrations
export type {
  IDatabase,
  IVersionManager,
  Migration,
} from './VersionManager'
export {
  InMemoryDatabase,
  InMemoryVersionManager,
  NativeVersionManager,
} from './VersionManager'

export { ALL_MIGRATIONS, migrationV1 } from './schema'

export type {
  ICycleRepository,
  Cycle,
  Symptom,
  Prediction,
  Predictions,
  UserPreferences,
  SecuritySettings,
  NotificationPreferences,
  MedicationReminder,
  SymptomType,
  SymptomCategory,
  ConfidenceLevel,
  ConfidenceResult,
  TrackingMode,
} from './CycleRepository'
export {
  InMemoryCycleRepository,
  NativeCycleRepository,
} from './CycleRepository'
