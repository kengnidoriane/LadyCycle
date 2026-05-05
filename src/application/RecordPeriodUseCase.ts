/**
 * RecordPeriodUseCase — Use Case pour enregistrer une menstruation.
 *
 * Orchestration complète de bout en bout :
 *   1. Valider les données via CycleManager.recordMenstruation()
 *   2. Persister via CycleRepository.saveCycle()
 *   3. Recalculer les prédictions via PredictionEngine
 *   4. Planifier les notifications via NotificationManager (quand implémenté)
 *
 * Responsabilités :
 *   - Coordonner les composants domaine et infrastructure
 *   - Gérer les erreurs de validation et de persistance
 *   - Retourner un Result<Cycle, Error> explicite
 *
 * Exigences : 1.1, 1.2, 1.3, 1.4, 1.5
 */

import type { CalendarDate, Result } from '../domain/shared/types'
import { ok, err } from '../domain/shared/types'
import { CycleManager } from '../domain/cycle/CycleManager'
import { PredictionEngine } from '../domain/cycle/PredictionEngine'
import type { Cycle as DomainCycle } from '../domain/cycle/types'
import type { Cycle as RepoCycle, ICycleRepository } from '../infrastructure/db/CycleRepository'
import type { ValidationError, StorageError } from '../domain/shared/errors'
import { ErrorCode, createError } from '../domain/shared/errors'

// ─── Types d'erreur ───────────────────────────────────────────────────────────

/**
 * Erreur unifiée pour le Use Case.
 * Peut être une erreur de validation (domaine) ou de persistance (infrastructure).
 */
export type RecordPeriodError = ValidationError | StorageError

// ─── Interface NotificationManager (stub) ────────────────────────────────────

/**
 * Interface pour le NotificationManager.
 * Sera implémentée dans la tâche 18.
 */
export interface INotificationManager {
  schedulePeriodNotifications(
    prediction: any,
    preferences: any,
  ): Result<void, Error>
}

// ─── RecordPeriodUseCase ──────────────────────────────────────────────────────

/**
 * Use Case pour enregistrer une menstruation.
 *
 * Usage typique :
 *   const useCase = new RecordPeriodUseCase(repository, notificationManager)
 *   const result = await useCase.execute('2024-01-15', '2024-01-20')
 *   if (result.ok) {
 *     console.log('Cycle enregistré :', result.value)
 *   } else {
 *     console.error('Erreur :', result.error.message)
 *   }
 */
export class RecordPeriodUseCase {
  private repository: ICycleRepository
  private notificationManager: INotificationManager | null

  constructor(
    repository: ICycleRepository,
    notificationManager: INotificationManager | null = null,
  ) {
    this.repository = repository
    this.notificationManager = notificationManager
  }

  /**
   * Exécute le Use Case : enregistrer une menstruation.
   *
   * Étapes :
   *   1. Charger l'historique des cycles depuis le repository
   *   2. Créer un CycleManager avec l'historique
   *   3. Enregistrer la menstruation (validation)
   *   4. Persister le cycle via repository
   *   5. Recalculer les prédictions avec PredictionEngine
   *   6. Mettre à jour le cycle avec les nouvelles prédictions
   *   7. Persister les prédictions
   *   8. Planifier les notifications (si NotificationManager disponible)
   *
   * @param startDate - Date de début de la menstruation (YYYY-MM-DD)
   * @param menstruationEndDate - Date de fin de la menstruation (YYYY-MM-DD)
   * @returns Result<RepoCycle, RecordPeriodError>
   */
  async execute(
    startDate: CalendarDate,
    menstruationEndDate: CalendarDate,
  ): Promise<Result<RepoCycle, RecordPeriodError>> {
    // Étape 1 : Charger l'historique des cycles
    const historyResult = this.repository.loadAllCycles()
    if (!historyResult.ok) {
      return err(historyResult.error)
    }

    const cycleHistory = historyResult.value

    // Étape 2 : Créer un CycleManager avec l'historique
    // Convert repo cycles to domain cycles for CycleManager
    const domainHistory: DomainCycle[] = cycleHistory.map(c => ({
      ...c,
      menstruationDuration: c.menstruationDuration,
      predictions: { ovulation: null, nextPeriod: null },
    }))
    const cycleManager = new CycleManager(domainHistory)

    // Étape 3 : Enregistrer la menstruation (validation)
    const recordResult = cycleManager.recordMenstruation(
      startDate,
      menstruationEndDate,
    )
    if (!recordResult.ok) {
      return err(recordResult.error)
    }

    const domainCycle = recordResult.value

    // Étape 4 : Convertir le cycle du domaine vers le format du repository
    const now = new Date().toISOString()
    const cycleForRepo: RepoCycle = {
      id: domainCycle.id,
      startDate: domainCycle.startDate,
      endDate: domainCycle.endDate,
      menstruationEndDate: domainCycle.menstruationEndDate,
      duration: domainCycle.duration,
      menstruationDuration: domainCycle.menstruationDuration,
      isExceptional: domainCycle.isExceptional,
      exceptionalReason: domainCycle.exceptionalReason,
      symptoms: [],
      predictions: { ovulation: null, nextPeriod: null },
      createdAt: domainCycle.createdAt,
      updatedAt: domainCycle.updatedAt,
    }

    // Persister le cycle
    const saveResult = this.repository.saveCycle(cycleForRepo)
    if (!saveResult.ok) {
      return err(saveResult.error)
    }

    // Étape 5 : Recalculer les prédictions avec PredictionEngine
    const predictionEngine = new PredictionEngine()

    // Mettre à jour l'historique avec le nouveau cycle pour les prédictions
    const updatedDomainHistory: DomainCycle[] = [
      ...domainHistory,
      { ...domainCycle, predictions: { ovulation: null, nextPeriod: null } },
    ]

    // Prédire l'ovulation
    const ovulationPrediction = predictionEngine.predictOvulation(updatedDomainHistory)

    // Prédire les prochaines règles
    const nextPeriodPrediction = predictionEngine.predictNextPeriod(updatedDomainHistory)

    // Étape 6 : Convertir les prédictions vers le format plat du repository
    const ovulationForRepo = ovulationPrediction
      ? {
          id: this._generateId(),
          cycleId: domainCycle.id,
          predictionType: 'ovulation' as const,
          predictedDate: ovulationPrediction.value.estimatedDate,
          predictedDateRangeStart: ovulationPrediction.value.fertileWindowStart,
          predictedDateRangeEnd: ovulationPrediction.value.fertileWindowEnd,
          confidence: ovulationPrediction.confidence,
          calculatedAt: ovulationPrediction.calculatedAt,
        }
      : null

    const nextPeriodForRepo = nextPeriodPrediction
      ? {
          id: this._generateId(),
          cycleId: domainCycle.id,
          predictionType: 'next_period' as const,
          predictedDate: nextPeriodPrediction.value.startDate,
          predictedDateRangeStart: nextPeriodPrediction.value.startDate,
          predictedDateRangeEnd: nextPeriodPrediction.value.endDate,
          confidence: nextPeriodPrediction.confidence,
          calculatedAt: nextPeriodPrediction.calculatedAt,
        }
      : null

    const cycleWithPredictions: RepoCycle = {
      ...cycleForRepo,
      predictions: {
        ovulation: ovulationForRepo,
        nextPeriod: nextPeriodForRepo,
      },
    }

    // Étape 7 : Persister les prédictions
    const savePredictionsResult = this.repository.saveCycle(cycleWithPredictions)
    if (!savePredictionsResult.ok) {
      return err(savePredictionsResult.error)
    }

    // Étape 8 : Planifier les notifications (si NotificationManager disponible)
    if (this.notificationManager && nextPeriodPrediction) {
      // Charger les préférences utilisateur pour les notifications
      const preferencesResult = this.repository.loadPreferences()
      if (preferencesResult.ok) {
        const preferences = preferencesResult.value
        // Planifier les notifications (ignorer les erreurs de notification)
        this.notificationManager.schedulePeriodNotifications(
          nextPeriodPrediction,
          preferences.notificationPreferences,
        )
      }
    }

    // Retourner le cycle avec les prédictions
    return ok(cycleWithPredictions)
  }

  /**
   * Génère un identifiant unique de type UUID v4.
   * Utilise Math.random() — suffisant pour les IDs locaux non cryptographiques.
   */
  private _generateId(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = (Math.random() * 16) | 0
      const v = c === 'x' ? r : (r & 0x3) | 0x8
      return v.toString(16)
    })
  }
}
