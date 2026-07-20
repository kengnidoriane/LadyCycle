/**
 * CycleRepository — Couche de persistance pour les cycles, symptômes et préférences.
 *
 * Architecture :
 * - `ICycleRepository`        : interface pure (domaine/application)
 * - `InMemoryCycleRepository` : implémentation complète pour les tests
 * - `NativeCycleRepository`   : stub production (nécessite SQLCipher natif)
 *
 * Responsabilités :
 * - Sauvegarder et charger les cycles avec leurs symptômes et prédictions
 * - Déléguer le chiffrement à IEncryptionService
 * - Déléguer les migrations à IVersionManager
 * - Convertir snake_case SQL ↔ camelCase TypeScript
 * - Inclure is_exceptional dans toutes les requêtes de lecture/écriture
 *
 * Convention de nommage :
 * - SQL : snake_case (start_date, is_exceptional, cycle_id)
 * - TypeScript : camelCase (startDate, isExceptional, cycleId)
 *
 * Exigences : 1.5, 5.4, 10.1
 */

import {
  type Result,
  type Option,
  type CalendarDate,
  type UTCTimestamp,
  type SupportedLanguage,
  ok,
  err,
} from '../../domain/shared/types'
import { type StorageError, ErrorCode, createError } from '../../domain/shared/errors'

// ─── Types du domaine ─────────────────────────────────────────────────────────

export type SymptomCategory = 'pain' | 'mood' | 'energy' | 'physical' | 'sleep'

export type SymptomType =
  | 'cramps' | 'headache' | 'back_pain' | 'breast_tenderness'
  | 'irritable' | 'anxious' | 'happy' | 'sad' | 'mood_swings'
  | 'high_energy' | 'low_energy' | 'fatigue'
  | 'bloating' | 'acne' | 'nausea' | 'food_cravings'
  | 'insomnia' | 'good_sleep' | 'restless_sleep'

export type ConfidenceLevel = 'low' | 'medium' | 'high'
export type TrackingMode = 'general' | 'trying_to_conceive' | 'natural_contraception'

export interface Symptom {
  id: string
  cycleId: string
  date: CalendarDate
  type: SymptomType
  category: SymptomCategory
  intensity: Option<number>   // 1-5 pour 'pain' uniquement
  notes: Option<string>
  createdAt: UTCTimestamp
}

export interface ConfidenceResult {
  level: ConfidenceLevel
  explanation: Option<'not_enough_data' | 'too_irregular'>
  standardDeviation: Option<number>
}

export interface Prediction {
  id: string
  cycleId: string
  predictionType: 'ovulation' | 'next_period'
  predictedDate: CalendarDate
  predictedDateRangeStart: Option<CalendarDate>
  predictedDateRangeEnd: Option<CalendarDate>
  confidence: ConfidenceResult
  calculatedAt: UTCTimestamp
}

export interface Predictions {
  ovulation: Option<Prediction>
  nextPeriod: Option<Prediction>
}

export interface Cycle {
  id: string
  startDate: CalendarDate
  endDate: Option<CalendarDate>
  menstruationEndDate: Option<CalendarDate>
  duration: Option<number>
  /** Durée de la menstruation en jours. Absent si menstruationEndDate non renseignée. */
  menstruationDuration: Option<number>
  isExceptional: boolean
  exceptionalReason: Option<string>
  symptoms: Symptom[]
  predictions: Predictions
  createdAt: UTCTimestamp
  updatedAt: UTCTimestamp
}

export interface NotificationPreferences {
  enabled: boolean
  periodAdvanceNoticeDays: number[]
  fertileWindowAdvanceNoticeDays: number
  medicationRemindersEnabled: boolean
}

export interface SecuritySettings {
  authenticationEnabled: boolean
  authenticationType: 'pin' | 'biometric'
  autoLockEnabled: boolean
  autoLockTimeoutMinutes: number
  cloudBackupEnabled: boolean
  recoveryKitGenerated: boolean
}

export interface MedicationReminder {
  id: string
  name: string
  frequency: 'once_per_cycle' | 'daily' | 'custom'
  timingBeforePeriod: number
  timeOfDay: string
  enabled: boolean
  createdAt: UTCTimestamp
  updatedAt: UTCTimestamp
}

export interface UserPreferences {
  trackingMode: TrackingMode
  notificationPreferences: NotificationPreferences
  medicationReminders: MedicationReminder[]
  securitySettings: SecuritySettings
  languageCode: SupportedLanguage
}

// ─── Interface publique ───────────────────────────────────────────────────────

export interface ICycleRepository {
  /** Sauvegarde un cycle (INSERT ou UPDATE selon l'existence de l'id) */
  saveCycle(cycle: Cycle): Result<void, StorageError>

  /** Charge tous les cycles avec leurs symptômes et prédictions */
  loadAllCycles(): Result<Cycle[], StorageError>

  /** Charge un cycle spécifique par son id */
  loadCycle(cycleId: string): Result<Option<Cycle>, StorageError>

  /** Supprime un cycle et ses données associées (CASCADE) */
  deleteCycle(cycleId: string): Result<void, StorageError>

  /** Sauvegarde les préférences utilisateur */
  savePreferences(preferences: UserPreferences): Result<void, StorageError>

  /** Charge les préférences utilisateur (valeurs par défaut si absentes) */
  loadPreferences(): Result<UserPreferences, StorageError>
}

// ─── Valeurs par défaut ───────────────────────────────────────────────────────

const DEFAULT_PREFERENCES: UserPreferences = {
  trackingMode: 'general',
  notificationPreferences: {
    enabled: true,
    periodAdvanceNoticeDays: [3, 1],
    fertileWindowAdvanceNoticeDays: 1,
    medicationRemindersEnabled: true,
  },
  medicationReminders: [],
  securitySettings: {
    authenticationEnabled: false,
    authenticationType: 'pin',
    autoLockEnabled: false,
    autoLockTimeoutMinutes: 5,
    cloudBackupEnabled: false,
    recoveryKitGenerated: false,
  },
  languageCode: 'fr',
}

// ─── Implémentation en mémoire (tests) ───────────────────────────────────────

/**
 * Implémentation en mémoire de ICycleRepository pour les tests.
 *
 * Stocke les cycles dans une Map<id, Cycle> en mémoire.
 * Simule la sérialisation/désérialisation JSON pour garantir que les
 * propriétés round-trip (notamment isExceptional, dates, null) sont préservées.
 *
 * Propriétés garanties :
 * - Round-trip : loadCycle(saveCycle(c).id) retourne un cycle équivalent à c
 * - is_exceptional est inclus dans toutes les opérations de lecture/écriture
 * - Les symptômes et prédictions sont correctement associés aux cycles
 */
export class InMemoryCycleRepository implements ICycleRepository {
  // Stockage principal : sérialisation JSON pour simuler la persistance réelle.
  // `protected` pour permettre à PersistentCycleRepository d'hydrater/persister.
  protected cycles: Map<string, string> = new Map()
  protected preferences: string | null = null

  saveCycle(cycle: Cycle): Result<void, StorageError> {
    try {
      // Valider les champs obligatoires
      if (!cycle.id || !cycle.startDate) {
        return err(
          createError(
            ErrorCode.MISSING_REQUIRED_FIELD,
            'id et startDate sont obligatoires',
          ) as StorageError,
        )
      }

      // Sérialiser en JSON (simule le stockage SQLite + chiffrement)
      this.cycles.set(cycle.id, JSON.stringify(this._serializeCycle(cycle)))
      return ok(undefined)
    } catch (e) {
      return err(
        createError(
          ErrorCode.STORAGE_WRITE_FAILED,
          `Échec de la sauvegarde du cycle ${cycle.id}`,
          e,
        ) as StorageError,
      )
    }
  }

  loadAllCycles(): Result<Cycle[], StorageError> {
    try {
      const cycles: Cycle[] = []
      for (const serialized of this.cycles.values()) {
        cycles.push(this._deserializeCycle(JSON.parse(serialized)))
      }
      // Trier par startDate croissant
      cycles.sort((a, b) => a.startDate.localeCompare(b.startDate))
      return ok(cycles)
    } catch (e) {
      return err(
        createError(
          ErrorCode.STORAGE_READ_FAILED,
          'Échec du chargement des cycles',
          e,
        ) as StorageError,
      )
    }
  }

  loadCycle(cycleId: string): Result<Option<Cycle>, StorageError> {
    try {
      const serialized = this.cycles.get(cycleId)
      if (!serialized) return ok(null)
      return ok(this._deserializeCycle(JSON.parse(serialized)))
    } catch (e) {
      return err(
        createError(
          ErrorCode.STORAGE_READ_FAILED,
          `Échec du chargement du cycle ${cycleId}`,
          e,
        ) as StorageError,
      )
    }
  }

  deleteCycle(cycleId: string): Result<void, StorageError> {
    if (!this.cycles.has(cycleId)) {
      return err(
        createError(
          ErrorCode.STORAGE_READ_FAILED,
          `Cycle introuvable : ${cycleId}`,
        ) as StorageError,
      )
    }
    this.cycles.delete(cycleId)
    return ok(undefined)
  }

  savePreferences(preferences: UserPreferences): Result<void, StorageError> {
    try {
      this.preferences = JSON.stringify(preferences)
      return ok(undefined)
    } catch (e) {
      return err(
        createError(
          ErrorCode.STORAGE_WRITE_FAILED,
          'Échec de la sauvegarde des préférences',
          e,
        ) as StorageError,
      )
    }
  }

  loadPreferences(): Result<UserPreferences, StorageError> {
    try {
      if (!this.preferences) {
        return ok({ ...DEFAULT_PREFERENCES })
      }
      const parsed = JSON.parse(this.preferences) as UserPreferences
      // Fusionner avec les valeurs par défaut pour les clés manquantes
      return ok(this._mergeWithDefaults(parsed))
    } catch (e) {
      return err(
        createError(
          ErrorCode.STORAGE_READ_FAILED,
          'Échec du chargement des préférences',
          e,
        ) as StorageError,
      )
    }
  }

  // ── Sérialisation / Désérialisation ──────────────────────────────────────

  /**
   * Convertit un Cycle TypeScript en objet sérialisable (snake_case SQL).
   * Simule la conversion camelCase → snake_case du vrai Repository.
   */
  private _serializeCycle(cycle: Cycle): Record<string, unknown> {
    return {
      id: cycle.id,
      start_date: cycle.startDate,
      end_date: cycle.endDate,
      menstruation_end_date: cycle.menstruationEndDate,
      duration: cycle.duration,
      menstruation_duration: cycle.menstruationDuration,
      is_exceptional: cycle.isExceptional ? 1 : 0,
      exceptional_reason: cycle.exceptionalReason,
      symptoms: cycle.symptoms.map(s => this._serializeSymptom(s)),
      predictions: {
        ovulation: cycle.predictions.ovulation
          ? this._serializePrediction(cycle.predictions.ovulation)
          : null,
        next_period: cycle.predictions.nextPeriod
          ? this._serializePrediction(cycle.predictions.nextPeriod)
          : null,
      },
      created_at: cycle.createdAt,
      updated_at: cycle.updatedAt,
    }
  }

  private _serializeSymptom(s: Symptom): Record<string, unknown> {
    return {
      id: s.id,
      cycle_id: s.cycleId,
      date: s.date,
      type: s.type,
      category: s.category,
      intensity: s.intensity,
      notes: s.notes,
      created_at: s.createdAt,
    }
  }

  private _serializePrediction(p: Prediction): Record<string, unknown> {
    return {
      id: p.id,
      cycle_id: p.cycleId,
      prediction_type: p.predictionType,
      predicted_date: p.predictedDate,
      predicted_date_range_start: p.predictedDateRangeStart,
      predicted_date_range_end: p.predictedDateRangeEnd,
      confidence_level: p.confidence.level,
      confidence_explanation: p.confidence.explanation,
      confidence_std_deviation: p.confidence.standardDeviation,
      calculated_at: p.calculatedAt,
    }
  }

  /**
   * Convertit un objet sérialisé (snake_case) en Cycle TypeScript (camelCase).
   * Simule la conversion snake_case → camelCase du vrai Repository.
   */
  private _deserializeCycle(row: Record<string, unknown>): Cycle {
    const symptomsRaw = (row['symptoms'] as Record<string, unknown>[]) ?? []
    const predictionsRaw = row['predictions'] as {
      ovulation: Record<string, unknown> | null
      next_period: Record<string, unknown> | null
    }

    return {
      id: row['id'] as string,
      startDate: row['start_date'] as CalendarDate,
      endDate: (row['end_date'] as CalendarDate) ?? null,
      menstruationEndDate: (row['menstruation_end_date'] as CalendarDate) ?? null,
      duration: (row['duration'] as number) ?? null,
      menstruationDuration: (row['menstruation_duration'] as number) ?? null,
      // is_exceptional stocké comme 0/1 en SQL, converti en boolean
      isExceptional: row['is_exceptional'] === 1 || row['is_exceptional'] === true,
      exceptionalReason: (row['exceptional_reason'] as string) ?? null,
      symptoms: symptomsRaw.map(s => this._deserializeSymptom(s)),
      predictions: {
        ovulation: predictionsRaw?.ovulation
          ? this._deserializePrediction(predictionsRaw.ovulation)
          : null,
        nextPeriod: predictionsRaw?.next_period
          ? this._deserializePrediction(predictionsRaw.next_period)
          : null,
      },
      createdAt: row['created_at'] as UTCTimestamp,
      updatedAt: row['updated_at'] as UTCTimestamp,
    }
  }

  private _deserializeSymptom(row: Record<string, unknown>): Symptom {
    return {
      id: row['id'] as string,
      cycleId: row['cycle_id'] as string,
      date: row['date'] as CalendarDate,
      type: row['type'] as SymptomType,
      category: row['category'] as SymptomCategory,
      intensity: (row['intensity'] as number) ?? null,
      notes: (row['notes'] as string) ?? null,
      createdAt: row['created_at'] as UTCTimestamp,
    }
  }

  private _deserializePrediction(row: Record<string, unknown>): Prediction {
    return {
      id: row['id'] as string,
      cycleId: row['cycle_id'] as string,
      predictionType: row['prediction_type'] as 'ovulation' | 'next_period',
      predictedDate: row['predicted_date'] as CalendarDate,
      predictedDateRangeStart: (row['predicted_date_range_start'] as CalendarDate) ?? null,
      predictedDateRangeEnd: (row['predicted_date_range_end'] as CalendarDate) ?? null,
      confidence: {
        level: row['confidence_level'] as ConfidenceLevel,
        explanation: (row['confidence_explanation'] as 'not_enough_data' | 'too_irregular') ?? null,
        standardDeviation: (row['confidence_std_deviation'] as number) ?? null,
      },
      calculatedAt: row['calculated_at'] as UTCTimestamp,
    }
  }

  private _mergeWithDefaults(partial: Partial<UserPreferences>): UserPreferences {
    return {
      trackingMode: partial.trackingMode ?? DEFAULT_PREFERENCES.trackingMode,
      notificationPreferences: {
        ...DEFAULT_PREFERENCES.notificationPreferences,
        ...partial.notificationPreferences,
      },
      medicationReminders: partial.medicationReminders ?? [],
      securitySettings: {
        ...DEFAULT_PREFERENCES.securitySettings,
        ...partial.securitySettings,
      },
      languageCode: partial.languageCode ?? DEFAULT_PREFERENCES.languageCode,
    }
  }
}

// ─── Implémentation production (stub) ────────────────────────────────────────

/**
 * Implémentation production de ICycleRepository.
 *
 * En production, cette classe délègue à :
 *   - `react-native-sqlcipher-storage` pour les requêtes SQL chiffrées
 *   - `IEncryptionService` pour le chiffrement des données sensibles
 *   - `IVersionManager` pour les migrations de schéma au démarrage
 *
 * NOTE : Cette classe nécessite un émulateur/appareil physique.
 * Pour les tests unitaires, utiliser InMemoryCycleRepository.
 */
export class NativeCycleRepository implements ICycleRepository {
  saveCycle(_cycle: Cycle): Result<void, StorageError> {
    return err(
      createError(
        ErrorCode.STORAGE_WRITE_FAILED,
        'NativeCycleRepository nécessite un appareil physique ou un émulateur. ' +
          'Utilisez InMemoryCycleRepository pour les tests.',
      ) as StorageError,
    )
  }

  loadAllCycles(): Result<Cycle[], StorageError> {
    return err(
      createError(
        ErrorCode.STORAGE_READ_FAILED,
        'Non implémenté — nécessite les modules natifs',
      ) as StorageError,
    )
  }

  loadCycle(_cycleId: string): Result<Option<Cycle>, StorageError> {
    return err(
      createError(
        ErrorCode.STORAGE_READ_FAILED,
        'Non implémenté — nécessite les modules natifs',
      ) as StorageError,
    )
  }

  deleteCycle(_cycleId: string): Result<void, StorageError> {
    return err(
      createError(
        ErrorCode.STORAGE_WRITE_FAILED,
        'Non implémenté — nécessite les modules natifs',
      ) as StorageError,
    )
  }

  savePreferences(_preferences: UserPreferences): Result<void, StorageError> {
    return err(
      createError(
        ErrorCode.STORAGE_WRITE_FAILED,
        'Non implémenté — nécessite les modules natifs',
      ) as StorageError,
    )
  }

  loadPreferences(): Result<UserPreferences, StorageError> {
    return err(
      createError(
        ErrorCode.STORAGE_READ_FAILED,
        'Non implémenté — nécessite les modules natifs',
      ) as StorageError,
    )
  }
}
