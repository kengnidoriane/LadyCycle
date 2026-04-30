import type { UTCTimestamp } from './types'

/**
 * Codes d'erreur exhaustifs de l'application.
 * Chaque code correspond à un cas d'erreur précis, ce qui permet à l'UI
 * d'afficher un message adapté sans exposer de détails techniques.
 */
export enum ErrorCode {
  // ── Validation ────────────────────────────────────────────────────────────
  INVALID_DATE_RANGE = 'INVALID_DATE_RANGE',           // fin < début
  INVALID_SYMPTOM_INTENSITY = 'INVALID_SYMPTOM_INTENSITY', // intensité hors [1-5]
  MISSING_REQUIRED_FIELD = 'MISSING_REQUIRED_FIELD',
  INVALID_DATE_FORMAT = 'INVALID_DATE_FORMAT',         // format non YYYY-MM-DD

  // ── Persistance ───────────────────────────────────────────────────────────
  STORAGE_WRITE_FAILED = 'STORAGE_WRITE_FAILED',
  STORAGE_READ_FAILED = 'STORAGE_READ_FAILED',
  DATA_CORRUPTED = 'DATA_CORRUPTED',
  INSUFFICIENT_STORAGE = 'INSUFFICIENT_STORAGE',

  // ── Chiffrement ───────────────────────────────────────────────────────────
  ENCRYPTION_FAILED = 'ENCRYPTION_FAILED',
  DECRYPTION_FAILED = 'DECRYPTION_FAILED',
  ENCRYPTION_NOT_INITIALIZED = 'ENCRYPTION_NOT_INITIALIZED',

  // ── Authentification ──────────────────────────────────────────────────────
  AUTHENTICATION_FAILED = 'AUTHENTICATION_FAILED',
  TOO_MANY_ATTEMPTS = 'TOO_MANY_ATTEMPTS',
  BIOMETRIC_NOT_AVAILABLE = 'BIOMETRIC_NOT_AVAILABLE',

  // ── Notifications ─────────────────────────────────────────────────────────
  NOTIFICATION_PERMISSION_DENIED = 'NOTIFICATION_PERMISSION_DENIED',
  NOTIFICATION_SCHEDULING_FAILED = 'NOTIFICATION_SCHEDULING_FAILED',

  // ── Kit de Récupération ───────────────────────────────────────────────────
  RECOVERY_KIT_NOT_CONFIRMED = 'RECOVERY_KIT_NOT_CONFIRMED', // cloud bloqué sans kit
  RECOVERY_KIT_INVALID = 'RECOVERY_KIT_INVALID',

  // ── Migration ─────────────────────────────────────────────────────────────
  MIGRATION_FAILED = 'MIGRATION_FAILED',
  MIGRATION_BACKUP_FAILED = 'MIGRATION_BACKUP_FAILED',
  SCHEMA_VERSION_MISMATCH = 'SCHEMA_VERSION_MISMATCH',
}

/**
 * Structure d'erreur standard de l'application.
 * `details` est volontairement typé `unknown` pour éviter d'exposer des
 * informations sensibles dans les logs.
 */
export interface AppError {
  code: ErrorCode
  message: string
  details?: unknown
  timestamp: UTCTimestamp
}

// ── Sous-types d'erreurs spécialisés ─────────────────────────────────────────

export type ValidationError = AppError & {
  code:
    | ErrorCode.INVALID_DATE_RANGE
    | ErrorCode.INVALID_SYMPTOM_INTENSITY
    | ErrorCode.MISSING_REQUIRED_FIELD
    | ErrorCode.INVALID_DATE_FORMAT
}

export type StorageError = AppError & {
  code:
    | ErrorCode.STORAGE_WRITE_FAILED
    | ErrorCode.STORAGE_READ_FAILED
    | ErrorCode.DATA_CORRUPTED
    | ErrorCode.INSUFFICIENT_STORAGE
}

export type EncryptionError = AppError & {
  code:
    | ErrorCode.ENCRYPTION_FAILED
    | ErrorCode.DECRYPTION_FAILED
    | ErrorCode.ENCRYPTION_NOT_INITIALIZED
}

export type MigrationError = AppError & {
  code:
    | ErrorCode.MIGRATION_FAILED
    | ErrorCode.MIGRATION_BACKUP_FAILED
    | ErrorCode.SCHEMA_VERSION_MISMATCH
}

export type CryptoError = AppError & {
  code: ErrorCode.RECOVERY_KIT_INVALID
}

export type ExportError = AppError & {
  code: ErrorCode.STORAGE_WRITE_FAILED
}

// ── Helper pour créer une AppError ───────────────────────────────────────────

export function createError(
  code: ErrorCode,
  message: string,
  details?: unknown,
): AppError {
  return {
    code,
    message,
    details,
    timestamp: new Date().toISOString(),
  }
}
