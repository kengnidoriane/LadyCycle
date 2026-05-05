/**
 * PredictNextCycleUseCase — Use Case pour prédire le prochain cycle.
 *
 * Orchestration complète de bout en bout :
 *   1. Charger l'historique via CycleRepository.loadAllCycles()
 *   2. Appeler PredictionEngine.predictNextPeriod() et PredictionEngine.predictOvulation()
 *   3. Retourner les prédictions avec niveau de confiance et explication
 *
 * Responsabilités :
 *   - Coordonner les composants domaine et infrastructure
 *   - Gérer les erreurs de chargement
 *   - Retourner un Result<PredictionResult, Error> explicite
 *   - Fournir toutes les données nécessaires pour l'affichage visuel
 *
 * Exigences : 2.1, 2.2, 2.3, 2.4, 3.1, 3.2, 3.3, 3.4, 9.5, 12.4
 *
 * Architecture CQRS :
 * Ce Use Case est une REQUÊTE (Query) — il lit des données et calcule,
 * mais ne modifie jamais l'état du système. RecordPeriodUseCase est une
 * COMMANDE (Command) — il écrit des données.
 */

import type { Result } from '../domain/shared/types'
import { ok, err } from '../domain/shared/types'
import { PredictionEngine } from '../domain/cycle/PredictionEngine'
import type {
  Prediction,
  OvulationWindow,
  DateRange,
  CyclePhase,
  Cycle as DomainCycle,
} from '../domain/cycle/types'
import type { ICycleRepository } from '../infrastructure/db/CycleRepository'
import type { StorageError } from '../domain/shared/errors'
import { addDays, diffDays } from '../domain/shared/calendarDate'

// ─── Types de retour ──────────────────────────────────────────────────────────

/**
 * Résultat complet de la prédiction, prêt pour l'affichage visuel.
 *
 * Contient toutes les données nécessaires pour l'UI :
 * - Phase actuelle du cycle
 * - Dates de début et fin prévues des prochaines règles
 * - Période féconde avec zone de flou pour l'ovulation
 * - Niveau de confiance avec explication si confiance faible
 * - Indicateur de zone de flou pour l'ovulation
 *
 * L'UI n'a plus qu'à afficher ces données sans logique de calcul.
 */
export interface PredictionResult {
  /** Phase actuelle du cycle (menstrual, follicular, ovulation, luteal) */
  currentPhase: CyclePhase

  /** Prédiction des prochaines règles avec niveau de confiance */
  nextPeriod: Prediction<DateRange>

  /** Prédiction de l'ovulation avec période féconde et zone de flou */
  ovulation: Prediction<OvulationWindow>

  /**
   * Indicateur visuel : l'ovulation doit être affichée avec une zone de flou
   * pour signaler son instabilité biologique.
   * Toujours `true` car l'ovulation est biologiquement instable.
   */
  ovulationIsBlurred: true
}

/**
 * Erreur unifiée pour le Use Case.
 * Peut être une erreur de chargement (infrastructure).
 */
export type PredictNextCycleError = StorageError

// ─── PredictNextCycleUseCase ──────────────────────────────────────────────────

/**
 * Use Case pour prédire le prochain cycle.
 *
 * Usage typique :
 *   const useCase = new PredictNextCycleUseCase(repository)
 *   const result = await useCase.execute()
 *   if (result.ok) {
 *     console.log('Prédictions :', result.value)
 *   } else {
 *     console.error('Erreur :', result.error.message)
 *   }
 */
export class PredictNextCycleUseCase {
  private repository: ICycleRepository

  constructor(repository: ICycleRepository) {
    this.repository = repository
  }

  /**
   * Exécute le Use Case : prédire le prochain cycle.
   *
   * Étapes :
   *   1. Charger l'historique des cycles depuis le repository
   *   2. Créer un PredictionEngine
   *   3. Prédire l'ovulation avec PredictionEngine.predictOvulation()
   *   4. Prédire les prochaines règles avec PredictionEngine.predictNextPeriod()
   *   5. Déterminer la phase actuelle du cycle
   *   6. Retourner un PredictionResult complet pour l'UI
   *
   * @returns Result<PredictionResult, PredictNextCycleError>
   */
  async execute(): Promise<Result<PredictionResult, PredictNextCycleError>> {
    // Étape 1 : Charger l'historique des cycles
    const historyResult = this.repository.loadAllCycles()
    if (!historyResult.ok) {
      return err(historyResult.error)
    }

    const cycleHistory = historyResult.value

    // Convert repo cycles to domain cycles for PredictionEngine
    const domainHistory: DomainCycle[] = cycleHistory.map(c => ({
      ...c,
      menstruationDuration: c.menstruationDuration,
      predictions: { ovulation: null, nextPeriod: null },
    }))

    // Étape 2 : Créer un PredictionEngine
    const predictionEngine = new PredictionEngine()

    // Étape 3 : Prédire l'ovulation
    const ovulationPrediction = predictionEngine.predictOvulation(domainHistory)

    // Étape 4 : Prédire les prochaines règles
    const nextPeriodPrediction = predictionEngine.predictNextPeriod(domainHistory)

    // Étape 5 : Déterminer la phase actuelle du cycle
    const currentPhase = this._determineCurrentPhase(
      domainHistory,
      ovulationPrediction,
      nextPeriodPrediction,
    )

    // Étape 6 : Retourner le résultat complet
    const result: PredictionResult = {
      currentPhase,
      nextPeriod: nextPeriodPrediction,
      ovulation: ovulationPrediction,
      ovulationIsBlurred: true, // Toujours true — l'ovulation est biologiquement instable
    }

    return ok(result)
  }

  /**
   * Détermine la phase actuelle du cycle.
   *
   * Algorithme :
   *   - Si aujourd'hui est dans la période de menstruation → 'menstrual'
   *   - Si aujourd'hui est dans la période féconde → 'ovulation'
   *   - Si aujourd'hui est après l'ovulation et avant les règles → 'luteal'
   *   - Sinon → 'follicular'
   *
   * @param cycleHistory - Historique des cycles
   * @param ovulationPrediction - Prédiction de l'ovulation
   * @param nextPeriodPrediction - Prédiction des prochaines règles
   * @returns Phase actuelle du cycle
   */
  private _determineCurrentPhase(
    cycleHistory: any[],
    ovulationPrediction: Prediction<OvulationWindow>,
    nextPeriodPrediction: Prediction<DateRange>,
  ): CyclePhase {
    const today = new Date().toISOString().split('T')[0]

    // Trouver le cycle en cours (le plus récent sans endDate)
    const currentCycle = cycleHistory
      .filter(c => c.endDate === null)
      .sort((a, b) => b.startDate.localeCompare(a.startDate))[0]

    if (!currentCycle) {
      // Pas de cycle en cours — utiliser les prédictions pour déterminer la phase
      return this._determinePhaseFromPredictions(
        today,
        ovulationPrediction,
        nextPeriodPrediction,
      )
    }

    // Phase menstruelle : aujourd'hui est dans la période de menstruation
    if (currentCycle.menstruationEndDate) {
      const menstruationEnd = currentCycle.menstruationEndDate
      if (today >= currentCycle.startDate && today <= menstruationEnd) {
        return 'menstrual'
      }
    } else {
      // Si menstruationEndDate n'est pas renseignée, supposer 5 jours
      const estimatedMenstruationEnd = addDays(currentCycle.startDate, 5)
      if (today >= currentCycle.startDate && today <= estimatedMenstruationEnd) {
        return 'menstrual'
      }
    }

    // Phase d'ovulation : aujourd'hui est dans la période féconde
    const fertileWindowStart = ovulationPrediction.value.fertileWindowStart
    const fertileWindowEnd = ovulationPrediction.value.fertileWindowEnd
    if (today >= fertileWindowStart && today <= fertileWindowEnd) {
      return 'ovulation'
    }

    // Phase lutéale : aujourd'hui est après l'ovulation et avant les règles
    const ovulationDate = ovulationPrediction.value.estimatedDate
    const nextPeriodStart = nextPeriodPrediction.value.startDate
    if (today > ovulationDate && today < nextPeriodStart) {
      return 'luteal'
    }

    // Phase folliculaire : entre la fin des règles et le début de la période féconde
    return 'follicular'
  }

  /**
   * Détermine la phase à partir des prédictions uniquement (pas de cycle en cours).
   *
   * @param today - Date d'aujourd'hui (YYYY-MM-DD)
   * @param ovulationPrediction - Prédiction de l'ovulation
   * @param nextPeriodPrediction - Prédiction des prochaines règles
   * @returns Phase actuelle du cycle
   */
  private _determinePhaseFromPredictions(
    today: string,
    ovulationPrediction: Prediction<OvulationWindow>,
    nextPeriodPrediction: Prediction<DateRange>,
  ): CyclePhase {
    // Phase d'ovulation : aujourd'hui est dans la période féconde
    const fertileWindowStart = ovulationPrediction.value.fertileWindowStart
    const fertileWindowEnd = ovulationPrediction.value.fertileWindowEnd
    if (today >= fertileWindowStart && today <= fertileWindowEnd) {
      return 'ovulation'
    }

    // Phase lutéale : aujourd'hui est après l'ovulation et avant les règles
    const ovulationDate = ovulationPrediction.value.estimatedDate
    const nextPeriodStart = nextPeriodPrediction.value.startDate
    if (today > ovulationDate && today < nextPeriodStart) {
      return 'luteal'
    }

    // Phase menstruelle : aujourd'hui est dans la période des prochaines règles
    const nextPeriodEnd = nextPeriodPrediction.value.endDate
    if (today >= nextPeriodStart && today <= nextPeriodEnd) {
      return 'menstrual'
    }

    // Phase folliculaire : par défaut
    return 'follicular'
  }
}
