/**
 * schema.ts — Schéma SQLite initial et migration v1.
 *
 * Conventions de stockage des dates :
 * - CalendarDate (YYYY-MM-DD) → TEXT : dates de cycle, symptômes, prédictions
 * - UTCTimestamp (ISO 8601 UTC) → TEXT : created_at, updated_at, taken_at
 *
 * Toutes les tables sont créées dans la migration v1.
 * Les migrations futures (v2, v3...) ajouteront des colonnes ou tables
 * via ALTER TABLE dans de nouvelles entrées Migration.
 *
 * Exigences : 1.5, 10.1
 */

import type { IDatabase, Migration } from './VersionManager'

// ─── Instructions SQL de création des tables ─────────────────────────────────

/**
 * Table de versionnage du schéma.
 * Contient exactement une ligne avec la version actuelle.
 */
export const CREATE_SCHEMA_VERSION = `
  CREATE TABLE IF NOT EXISTS schema_version (
    version    INTEGER NOT NULL,
    applied_at TEXT    NOT NULL
  )
`.trim()

/**
 * Table des cycles menstruels.
 * is_exceptional : 0 = normal, 1 = exclu des calculs de prédiction.
 * Toutes les dates de cycle sont en CalendarDate (YYYY-MM-DD).
 */
export const CREATE_CYCLES = `
  CREATE TABLE IF NOT EXISTS cycles (
    id                    TEXT    PRIMARY KEY,
    start_date            TEXT    NOT NULL,
    end_date              TEXT,
    menstruation_end_date TEXT,
    duration              INTEGER,
    is_exceptional        INTEGER NOT NULL DEFAULT 0,
    exceptional_reason    TEXT,
    created_at            TEXT    NOT NULL,
    updated_at            TEXT    NOT NULL
  )
`.trim()

/**
 * Table des symptômes quotidiens.
 * intensity : NULL sauf pour category = 'pain' (valeur 1-5).
 * date : CalendarDate (YYYY-MM-DD).
 */
export const CREATE_SYMPTOMS = `
  CREATE TABLE IF NOT EXISTS symptoms (
    id         TEXT    PRIMARY KEY,
    cycle_id   TEXT    NOT NULL,
    date       TEXT    NOT NULL,
    type       TEXT    NOT NULL,
    category   TEXT    NOT NULL,
    intensity  INTEGER,
    notes      TEXT,
    created_at TEXT    NOT NULL,
    FOREIGN KEY (cycle_id) REFERENCES cycles(id) ON DELETE CASCADE
  )
`.trim()

/**
 * Table des prédictions (ovulation et prochaines règles).
 * predicted_date : CalendarDate (YYYY-MM-DD).
 * calculated_at  : UTCTimestamp.
 * confidence_explanation : 'not_enough_data' | 'too_irregular' | NULL.
 */
export const CREATE_PREDICTIONS = `
  CREATE TABLE IF NOT EXISTS predictions (
    id                        TEXT    PRIMARY KEY,
    cycle_id                  TEXT    NOT NULL,
    prediction_type           TEXT    NOT NULL,
    predicted_date            TEXT    NOT NULL,
    predicted_date_range_start TEXT,
    predicted_date_range_end   TEXT,
    confidence_level          TEXT    NOT NULL,
    confidence_explanation    TEXT,
    confidence_std_deviation  REAL,
    calculated_at             TEXT    NOT NULL,
    FOREIGN KEY (cycle_id) REFERENCES cycles(id) ON DELETE CASCADE
  )
`.trim()

/**
 * Table des rappels de médicaments.
 * time_of_day : "HH:MM" en heure locale.
 */
export const CREATE_MEDICATION_REMINDERS = `
  CREATE TABLE IF NOT EXISTS medication_reminders (
    id                   TEXT    PRIMARY KEY,
    name                 TEXT    NOT NULL,
    frequency            TEXT    NOT NULL,
    timing_before_period INTEGER NOT NULL,
    time_of_day          TEXT    NOT NULL,
    enabled              INTEGER NOT NULL DEFAULT 1,
    created_at           TEXT    NOT NULL,
    updated_at           TEXT    NOT NULL
  )
`.trim()

/**
 * Table des logs de prise de médicaments.
 * scheduled_date : CalendarDate (YYYY-MM-DD).
 * taken_at       : UTCTimestamp précis (heure exacte de prise).
 */
export const CREATE_MEDICATION_LOGS = `
  CREATE TABLE IF NOT EXISTS medication_logs (
    id             TEXT    PRIMARY KEY,
    reminder_id    TEXT    NOT NULL,
    scheduled_date TEXT    NOT NULL,
    taken_at       TEXT,
    skipped        INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (reminder_id) REFERENCES medication_reminders(id) ON DELETE CASCADE
  )
`.trim()

/**
 * Table des préférences utilisateur (clé-valeur).
 * Clés connues :
 *   - 'tracking_mode'       : 'general' | 'trying_to_conceive' | 'natural_contraception'
 *   - 'language_code'       : 'fr' | 'en'
 *   - 'notifications_enabled' : '0' | '1'
 *   - 'recovery_kit_generated' : '0' | '1'
 *   - 'authentication_enabled' : '0' | '1'
 *   - 'authentication_type'  : 'pin' | 'biometric'
 *   - 'auto_lock_enabled'    : '0' | '1'
 *   - 'auto_lock_timeout'    : nombre de minutes (string)
 *   - 'cloud_backup_enabled' : '0' | '1'
 */
export const CREATE_USER_PREFERENCES = `
  CREATE TABLE IF NOT EXISTS user_preferences (
    key        TEXT PRIMARY KEY,
    value      TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )
`.trim()

// ─── Migration v1 ─────────────────────────────────────────────────────────────

/**
 * Migration v1 : création du schéma initial.
 *
 * Crée toutes les tables de l'application.
 * down() supprime toutes les tables dans l'ordre inverse (respect des FK).
 */
export const migrationV1: Migration = {
  version: 1,
  description: 'Création du schéma initial (toutes les tables)',
  up: (db: IDatabase) => {
    db.execute(CREATE_SCHEMA_VERSION)
    db.execute(CREATE_CYCLES)
    db.execute(CREATE_SYMPTOMS)
    db.execute(CREATE_PREDICTIONS)
    db.execute(CREATE_MEDICATION_REMINDERS)
    db.execute(CREATE_MEDICATION_LOGS)
    db.execute(CREATE_USER_PREFERENCES)
  },
  down: (db: IDatabase) => {
    // Supprimer dans l'ordre inverse pour respecter les contraintes FK
    db.execute('DROP TABLE IF EXISTS medication_logs')
    db.execute('DROP TABLE IF EXISTS medication_reminders')
    db.execute('DROP TABLE IF EXISTS predictions')
    db.execute('DROP TABLE IF EXISTS symptoms')
    db.execute('DROP TABLE IF EXISTS cycles')
    db.execute('DROP TABLE IF EXISTS user_preferences')
    db.execute('DROP TABLE IF EXISTS schema_version')
  },
}

/** Liste ordonnée de toutes les migrations de l'application */
export const ALL_MIGRATIONS: Migration[] = [migrationV1]
