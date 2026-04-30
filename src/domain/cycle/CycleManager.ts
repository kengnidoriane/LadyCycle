/**
 * CycleManager — gestionnaire des cycles menstruels.
 *
 * Logique pure : aucune dépendance externe (pas de DB, pas de réseau).
 * La persistance est déléguée au CycleRepository (infrastructure).
 *
 * Responsabilités :
 *   - Enregistrer et modifier les données de menstruation
 *   - Calculer la durée des cycles
 *   - Valider la cohérence des dates
 *   - Marquer les cycles comme exceptionnels
 *   - Calculer les statistiques (en excluant les cycles exceptionnels)
 */

import type { CalendarDate, Option, Result } from '../shared/types'
import { ok, err, none } from '../shared/types'
import { diffDays, isAfterOrEqual, isValidCalendarDate } from '../shared/calendarDate'
import { ErrorCode, createError } from '../shared/errors'
import type { ValidationError } from '../shared/errors'
import type { Cycle, CycleStatistics } from './types'

// ─── Helpers internes ─────────────────────────────────────────────────────────

/**
 * Génère un identifiant unique de type UUID v4.
 * Utilise Math.random() — suffisant pour les IDs locaux non cryptographiques.
 * En production, remplacer par crypto.randomUUID() si disponible.
 */
function generateId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

/**
 * Crée un UTCTimestamp pour maintenant.
 */
function nowUTC(): string {
  return new Date().toISOString()
}

/**
 * Calcule la durée d'un cycle en jours (inclusif des deux extrémités).
 * Exemple : du 15 jan au 12 fév → 29 jours.
 */
function computeDuration(
  startDate: CalendarDate,
  endDate: CalendarDate,
): number {
  return diffDays(startDate, endDate) + 1
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
 * Détermine la régularité du cycle à partir de l'écart-type σ.
 *   - σ < 3  → 'regular'
 *   - 3 ≤ σ ≤ 7 → 'irregular'
 *   - σ > 7  → 'very_irregular'
 */
function computeRegularity(
  sigma: number,
): 'regular' | 'irregular' | 'very_irregular' {
  if (sigma < 3) return 'regular'
  if (sigma <= 7) return 'irregular'
  return 'very_irregular'
}

// ─── CycleManager ─────────────────────────────────────────────────────────────

/**
 * Gestionnaire des cycles menstruels.
 *
 * Toutes les méthodes sont pures : elles opèrent sur l'état interne
 * (`cycles`) et retournent des `Result<T, E>` explicites.
 *
 * Usage typique :
 *   const manager = new CycleManager()
 *   const result = manager.recordMenstruation('2024-01-15', '2024-01-20')
 *   if (result.ok) {
 *     await repository.saveCycle(result.value)
 *   }
 */
export class CycleManager {
  private cycles: Cycle[]

  constructor(initialCycles: Cycle[] = []) {
    // Copie défensive pour éviter les mutations externes
    this.cycles = [...initialCycles]
  }

  // ─── Enregistrement ──────────────────────────────────────────────────────

  /**
   * Enregistre une nouvelle menstruation.
   *
   * Valide que :
   *   - Les deux dates sont au format YYYY-MM-DD valide
   *   - endDate >= startDate (sinon ValidationError INVALID_DATE_RANGE)
   *
   * La durée du cycle ne peut être calculée qu'une fois le cycle terminé
   * (endDate du cycle = startDate du cycle suivant - 1). Ici on enregistre
   * uniquement la menstruation ; la durée du cycle sera mise à jour lors
   * de l'enregistrement du cycle suivant.
   *
   * Exigences : 1.1, 1.2, 1.3
   */
  recordMenstruation(
    startDate: CalendarDate,
    menstruationEndDate: CalendarDate,
  ): Result<Cycle, ValidationError> {
    // Validation du format des dates
    if (!isValidCalendarDate(startDate)) {
      return err(
        createError(
          ErrorCode.INVALID_DATE_FORMAT,
          `La date de début "${startDate}" n'est pas au format YYYY-MM-DD valide.`,
        ) as ValidationError,
      )
    }
    if (!isValidCalendarDate(menstruationEndDate)) {
      return err(
        createError(
          ErrorCode.INVALID_DATE_FORMAT,
          `La date de fin "${menstruationEndDate}" n'est pas au format YYYY-MM-DD valide.`,
        ) as ValidationError,
      )
    }

    // Validation de la cohérence des dates : fin >= début
    if (!isAfterOrEqual(menstruationEndDate, startDate)) {
      return err(
        createError(
          ErrorCode.INVALID_DATE_RANGE,
          `La date de fin de menstruation (${menstruationEndDate}) doit être postérieure ou égale à la date de début (${startDate}).`,
          { startDate, menstruationEndDate },
        ) as ValidationError,
      )
    }

    const menstruationDuration = computeDuration(startDate, menstruationEndDate)
    const now = nowUTC()

    const cycle: Cycle = {
      id: generateId(),
      startDate,
      endDate: none,
      menstruationEndDate,
      duration: none,
      menstruationDuration,
      isExceptional: false,
      exceptionalReason: none,
      predictions: {
        ovulation: none,
        nextPeriod: none,
      },
      createdAt: now,
      updatedAt: now,
    }

    this.cycles.push(cycle)
    return ok(cycle)
  }

  /**
   * Modifie une menstruation existante.
   *
   * Recalcule la durée de menstruation après modification.
   * Exigences : 1.4
   */
  updateMenstruation(
    cycleId: string,
    startDate: CalendarDate,
    menstruationEndDate: CalendarDate,
  ): Result<Cycle, ValidationError> {
    // Validation du format des dates
    if (!isValidCalendarDate(startDate)) {
      return err(
        createError(
          ErrorCode.INVALID_DATE_FORMAT,
          `La date de début "${startDate}" n'est pas au format YYYY-MM-DD valide.`,
        ) as ValidationError,
      )
    }
    if (!isValidCalendarDate(menstruationEndDate)) {
      return err(
        createError(
          ErrorCode.INVALID_DATE_FORMAT,
          `La date de fin "${menstruationEndDate}" n'est pas au format YYYY-MM-DD valide.`,
        ) as ValidationError,
      )
    }

    // Validation de la cohérence des dates
    if (!isAfterOrEqual(menstruationEndDate, startDate)) {
      return err(
        createError(
          ErrorCode.INVALID_DATE_RANGE,
          `La date de fin de menstruation (${menstruationEndDate}) doit être postérieure ou égale à la date de début (${startDate}).`,
          { startDate, menstruationEndDate },
        ) as ValidationError,
      )
    }

    const index = this.cycles.findIndex(c => c.id === cycleId)
    if (index === -1) {
      return err(
        createError(
          ErrorCode.MISSING_REQUIRED_FIELD,
          `Aucun cycle trouvé avec l'identifiant "${cycleId}".`,
        ) as ValidationError,
      )
    }

    const existing = this.cycles[index]
    const menstruationDuration = computeDuration(startDate, menstruationEndDate)

    // Recalculer la durée du cycle si endDate est connue
    const duration: Option<number> =
      existing.endDate !== null
        ? computeDuration(startDate, existing.endDate)
        : none

    const updated: Cycle = {
      ...existing,
      startDate,
      menstruationEndDate,
      menstruationDuration,
      duration,
      updatedAt: nowUTC(),
    }

    this.cycles[index] = updated
    return ok(updated)
  }

  // ─── Gestion des cycles exceptionnels ────────────────────────────────────

  /**
   * Marque un cycle comme exceptionnel (exclu des calculs de prédiction).
   *
   * Les cycles exceptionnels sont conservés dans l'historique mais exclus
   * de TOUS les calculs statistiques et de prédiction.
   *
   * Exigences : 13.1
   */
  markCycleAsExceptional(
    cycleId: string,
    reason?: string,
  ): Result<Cycle, ValidationError> {
    const index = this.cycles.findIndex(c => c.id === cycleId)
    if (index === -1) {
      return err(
        createError(
          ErrorCode.MISSING_REQUIRED_FIELD,
          `Aucun cycle trouvé avec l'identifiant "${cycleId}".`,
        ) as ValidationError,
      )
    }

    const updated: Cycle = {
      ...this.cycles[index],
      isExceptional: true,
      exceptionalReason: reason ?? none,
      updatedAt: nowUTC(),
    }

    this.cycles[index] = updated
    return ok(updated)
  }

  /**
   * Annule le marquage exceptionnel d'un cycle.
   *
   * Le cycle est réintégré dans les calculs statistiques et de prédiction.
   * Exigences : 13.4
   */
  unmarkCycleAsExceptional(cycleId: string): Result<Cycle, ValidationError> {
    const index = this.cycles.findIndex(c => c.id === cycleId)
    if (index === -1) {
      return err(
        createError(
          ErrorCode.MISSING_REQUIRED_FIELD,
          `Aucun cycle trouvé avec l'identifiant "${cycleId}".`,
        ) as ValidationError,
      )
    }

    const updated: Cycle = {
      ...this.cycles[index],
      isExceptional: false,
      exceptionalReason: none,
      updatedAt: nowUTC(),
    }

    this.cycles[index] = updated
    return ok(updated)
  }

  // ─── Consultation ─────────────────────────────────────────────────────────

  /**
   * Retourne le cycle en cours (le plus récent sans endDate).
   * Retourne `null` si aucun cycle n'est en cours.
   */
  getCurrentCycle(): Option<Cycle> {
    // Le cycle en cours est le dernier cycle sans endDate
    const openCycles = this.cycles.filter(c => c.endDate === null)
    if (openCycles.length === 0) return none

    // Retourner le plus récent par startDate
    return openCycles.reduce((latest, c) =>
      c.startDate > latest.startDate ? c : latest,
    )
  }

  /**
   * Retourne l'historique des cycles, du plus récent au plus ancien.
   *
   * @param limit - Nombre maximum de cycles à retourner (tous si absent)
   * Exigences : 7.1
   */
  getCycleHistory(limit?: number): Cycle[] {
    const sorted = [...this.cycles].sort((a, b) =>
      b.startDate.localeCompare(a.startDate),
    )
    return limit !== undefined ? sorted.slice(0, limit) : sorted
  }

  // ─── Statistiques ─────────────────────────────────────────────────────────

  /**
   * Calcule les statistiques sur l'historique des cycles.
   *
   * Les cycles marqués `isExceptional = true` sont exclus de TOUS les calculs.
   * Seuls les cycles avec une durée connue (endDate renseignée) sont inclus
   * dans les calculs de durée moyenne et d'écart-type.
   *
   * Exigences : 7.2, 7.3, 13.2, 13.3
   */
  calculateStatistics(): CycleStatistics {
    const totalCyclesRecorded = this.cycles.length
    const exceptionalCycles = this.cycles.filter(c => c.isExceptional)
    const exceptionalCyclesExcluded = exceptionalCycles.length

    // Cycles non exceptionnels avec durée connue (cycle terminé)
    const normalCompletedCycles = this.cycles.filter(
      c => !c.isExceptional && c.duration !== null,
    )

    // Durées de cycle (en jours)
    const cycleDurations = normalCompletedCycles
      .map(c => c.duration as number)

    // Durées de menstruation (en jours)
    const menstruationDurations = this.cycles
      .filter(c => !c.isExceptional && c.menstruationDuration !== null)
      .map(c => c.menstruationDuration as number)

    // Durée moyenne du cycle
    const averageCycleLength =
      cycleDurations.length > 0
        ? cycleDurations.reduce((sum, d) => sum + d, 0) / cycleDurations.length
        : 28 // valeur par défaut si aucun cycle complet

    // Durée moyenne des menstruations
    const averageMenstruationLength =
      menstruationDurations.length > 0
        ? menstruationDurations.reduce((sum, d) => sum + d, 0) /
          menstruationDurations.length
        : 5 // valeur par défaut

    // Écart-type des durées de cycle
    const sigma = standardDeviation(cycleDurations)

    // Régularité basée sur σ
    const cycleRegularity = computeRegularity(sigma)

    return {
      averageCycleLength,
      averageMenstruationLength,
      cycleRegularity,
      standardDeviation: sigma,
      totalCyclesRecorded,
      exceptionalCyclesExcluded,
    }
  }
}
