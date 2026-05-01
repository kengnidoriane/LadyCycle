/**
 * PredictionEngine — moteur de prédiction pour l'ovulation et les prochaines règles.
 *
 * Logique pure : aucune dépendance externe (pas de DB, pas de réseau).
 * Toutes les méthodes sont pures et testables sans infrastructure.
 *
 * Responsabilités :
 *   - Prédire la date d'ovulation
 *   - Calculer la période féconde
 *   - Prédire les prochaines règles
 *   - Calculer le niveau de confiance avec explication
 *   - Exclure systématiquement les cycles exceptionnels des calculs
 *
 * Algorithme :
 *   - < 3 cycles non exceptionnels → 28 jours / confiance faible
 *   - 3-5 cycles non exceptionnels → moyenne simple / confiance moyenne
 *   - ≥ 6 cycles non exceptionnels → moyenne pondérée (0.5·n + 0.3·n-1 + 0.2·n-2) + σ
 *   - Ovulation = prochaines règles − 14 jours
 *   - Période féconde = [ovulation − 5 jours, ovulation + 1 jour]
 */

import type { CalendarDate, UTCTimestamp, Option } from '../shared/types'
import { none } from '../shared/types'
import { addDays, subtractDays } from '../shared/calendarDate'
import type {
  Cycle,
  Prediction,
  OvulationWindow,
  DateRange,
  ConfidenceResult,
  ConfidenceLevel,
} from './types'

// ─── Helpers internes ─────────────────────────────────────────────────────────

/**
 * Crée un UTCTimestamp pour maintenant.
 */
function nowUTC(): UTCTimestamp {
  return new Date().toISOString()
}

/**
 * Calcule l'écart-type (σ) d'un tableau de nombres.
 * Retourne 0 si le tableau contient moins de 2 éléments.
 */
function standardDeviation(values: number[]): number {
  if (values.length < 2) return 0
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length
  const variance =
    values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length
  return Math.sqrt(variance)
}

/**
 * Filtre les cycles non exceptionnels avec une durée connue.
 * Les cycles exceptionnels (isExceptional = true) sont exclus de TOUS les calculs.
 */
function filterValidCycles(cycles: Cycle[]): Cycle[] {
  return cycles.filter(c => !c.isExceptional && c.duration !== null)
}

/**
 * Calcule la durée prédite du cycle selon l'algorithme adaptatif.
 *
 * Algorithme :
 *   - < 3 cycles → 28 jours (valeur par défaut)
 *   - 3-5 cycles → moyenne simple
 *   - ≥ 6 cycles → moyenne pondérée des 3 derniers cycles (0.5·n + 0.3·n-1 + 0.2·n-2)
 */
function calculatePredictedDuration(validCycles: Cycle[]): number {
  const count = validCycles.length

  if (count < 3) {
    return 28 // Durée standard par défaut
  }

  const durations = validCycles.map(c => c.duration as number)

  if (count < 6) {
    // Moyenne simple pour 3-5 cycles
    return durations.reduce((sum, d) => sum + d, 0) / durations.length
  }

  // Moyenne pondérée pour ≥ 6 cycles (utilise les 3 derniers)
  const n = durations[durations.length - 1]
  const n1 = durations[durations.length - 2]
  const n2 = durations[durations.length - 3]

  return 0.5 * n + 0.3 * n1 + 0.2 * n2
}

// ─── PredictionEngine ─────────────────────────────────────────────────────────

/**
 * Moteur de prédiction pour l'ovulation et les prochaines règles.
 *
 * Toutes les méthodes sont pures : elles opèrent sur l'historique des cycles
 * et retournent des prédictions avec niveau de confiance.
 *
 * Usage typique :
 *   const engine = new PredictionEngine()
 *   const ovulation = engine.predictOvulation(cycleHistory)
 *   const nextPeriod = engine.predictNextPeriod(cycleHistory)
 */
export class PredictionEngine {
  /**
   * Prédit la date d'ovulation pour le cycle actuel.
   *
   * Algorithme :
   *   1. Filtrer les cycles non exceptionnels avec durée connue
   *   2. Calculer la durée prédite du prochain cycle
   *   3. Prédire les prochaines règles = dernier cycle.startDate + durée prédite
   *   4. Ovulation = prochaines règles − 14 jours
   *   5. Période féconde = [ovulation − 5, ovulation + 1]
   *
   * L'ovulation est toujours marquée `isBlurred: true` car biologiquement instable.
   *
   * Exigences : 2.1, 2.2, 2.3, 2.4, 2.6
   */
  predictOvulation(cycleHistory: Cycle[]): Prediction<OvulationWindow> {
    const validCycles = filterValidCycles(cycleHistory)
    const confidence = this.getConfidenceLevel(cycleHistory)

    // Calculer la durée prédite du prochain cycle
    const predictedDuration = calculatePredictedDuration(validCycles)

    // Trouver le cycle en cours non exceptionnel (le plus récent sans endDate)
    const currentCycle = validCycles
      .filter(c => c.endDate === null)
      .sort((a, b) => b.startDate.localeCompare(a.startDate))[0]

    // Si pas de cycle en cours, utiliser le dernier cycle terminé non exceptionnel
    const lastCycle = currentCycle || validCycles
      .filter(c => c.endDate !== null)
      .sort((a, b) => b.startDate.localeCompare(a.startDate))[0]

    // Prédire les prochaines règles
    const nextPeriodStart = addDays(
      lastCycle?.startDate || new Date().toISOString().split('T')[0],
      Math.round(predictedDuration),
    )

    // Ovulation = prochaines règles − 14 jours
    const estimatedDate = subtractDays(nextPeriodStart, 14)

    // Période féconde = [ovulation − 5, ovulation + 1]
    const fertileWindowStart = subtractDays(estimatedDate, 5)
    const fertileWindowEnd = addDays(estimatedDate, 1)

    const ovulationWindow: OvulationWindow = {
      estimatedDate,
      fertileWindowStart,
      fertileWindowEnd,
      isBlurred: true, // Toujours true — l'ovulation est biologiquement instable
    }

    return {
      value: ovulationWindow,
      confidence,
      calculatedAt: nowUTC(),
    }
  }

  /**
   * Prédit les prochaines règles.
   *
   * Algorithme :
   *   1. Filtrer les cycles non exceptionnels avec durée connue
   *   2. Calculer la durée prédite du prochain cycle
   *   3. Prochaines règles = dernier cycle.startDate + durée prédite
   *   4. Plage de dates = [date prédite − 1, date prédite + 1] si confiance moyenne/haute
   *
   * Exigences : 3.1, 3.2, 3.3, 3.4
   */
  predictNextPeriod(cycleHistory: Cycle[]): Prediction<DateRange> {
    const validCycles = filterValidCycles(cycleHistory)
    const confidence = this.getConfidenceLevel(cycleHistory)

    // Calculer la durée prédite du prochain cycle
    const predictedDuration = calculatePredictedDuration(validCycles)

    // Trouver le cycle en cours non exceptionnel (le plus récent sans endDate)
    const currentCycle = validCycles
      .filter(c => c.endDate === null)
      .sort((a, b) => b.startDate.localeCompare(a.startDate))[0]

    // Si pas de cycle en cours, utiliser le dernier cycle terminé non exceptionnel
    const lastCycle = currentCycle || validCycles
      .filter(c => c.endDate !== null)
      .sort((a, b) => b.startDate.localeCompare(a.startDate))[0]

    // Prédire les prochaines règles
    const predictedDate = addDays(
      lastCycle?.startDate || new Date().toISOString().split('T')[0],
      Math.round(predictedDuration),
    )

    // Plage de dates basée sur la confiance
    let startDate: CalendarDate
    let endDate: CalendarDate

    if (confidence.level === 'low') {
      // Plage large pour confiance faible
      startDate = subtractDays(predictedDate, 2)
      endDate = addDays(predictedDate, 2)
    } else {
      // Plage étroite pour confiance moyenne/haute
      startDate = subtractDays(predictedDate, 1)
      endDate = addDays(predictedDate, 1)
    }

    const dateRange: DateRange = {
      startDate,
      endDate,
    }

    return {
      value: dateRange,
      confidence,
      calculatedAt: nowUTC(),
    }
  }

  /**
   * Calcule la période féconde à partir d'une date d'ovulation.
   *
   * Période féconde = [ovulation − 5 jours, ovulation + 1 jour]
   *
   * Exigence : 2.4
   */
  calculateFertileWindow(ovulationDate: CalendarDate): DateRange {
    return {
      startDate: subtractDays(ovulationDate, 5),
      endDate: addDays(ovulationDate, 1),
    }
  }

  /**
   * Met à jour le modèle avec un nouveau cycle.
   *
   * Dans cette implémentation, le modèle est stateless (sans état interne).
   * Les prédictions sont recalculées à chaque appel avec l'historique complet.
   *
   * Cette méthode est un placeholder pour une future implémentation avec
   * apprentissage adaptatif (ajustement des poids selon les erreurs passées).
   *
   * Exigence : 9.3
   */
  updateModel(newCycle: Cycle): void {
    // Placeholder pour l'apprentissage adaptatif futur
    // Pour l'instant, le modèle est stateless et recalcule à chaque fois
  }

  /**
   * Calcule le niveau de confiance avec explication.
   *
   * Algorithme :
   *   - < 3 cycles non exceptionnels → 'low', explication : 'not_enough_data'
   *   - 3-5 cycles non exceptionnels → 'medium'
   *   - ≥ 6 cycles non exceptionnels :
   *       - σ < 3 → 'high'
   *       - 3 ≤ σ ≤ 7 → 'medium'
   *       - σ > 7 → 'low', explication : 'too_irregular'
   *
   * Exigences : 9.1, 9.4, 9.5, 12.4
   */
  getConfidenceLevel(cycleHistory: Cycle[]): ConfidenceResult {
    const validCycles = filterValidCycles(cycleHistory)
    const count = validCycles.length

    // Cas 1 : Moins de 3 cycles non exceptionnels
    if (count < 3) {
      return {
        level: 'low',
        explanation: 'not_enough_data',
        standardDeviation: none,
      }
    }

    // Calculer l'écart-type des durées
    const durations = validCycles.map(c => c.duration as number)
    const sigma = standardDeviation(durations)

    // Cas 2 : 3-5 cycles non exceptionnels
    if (count < 6) {
      return {
        level: 'medium',
        explanation: none,
        standardDeviation: sigma,
      }
    }

    // Cas 3 : ≥ 6 cycles non exceptionnels
    // Niveau de confiance basé sur l'écart-type
    let level: ConfidenceLevel
    let explanation: Option<'not_enough_data' | 'too_irregular'>

    if (sigma < 3) {
      level = 'high'
      explanation = none
    } else if (sigma <= 7) {
      level = 'medium'
      explanation = none
    } else {
      level = 'low'
      explanation = 'too_irregular'
    }

    return {
      level,
      explanation,
      standardDeviation: sigma,
    }
  }
}
