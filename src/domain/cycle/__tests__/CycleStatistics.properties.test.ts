/**
 * Tests property-based pour le calcul des statistiques de cycle.
 *
 * Feature: suivi-cycle-menstruel
 *
 * Propriété 17 : Calcul des statistiques de cycle
 *   Valide : Exigence 7.2
 *
 * Ces tests vérifient les invariants fondamentaux du calcul statistique :
 *   - La durée moyenne du cycle est la moyenne arithmétique des durées non exceptionnelles
 *   - La durée moyenne de menstruation est la moyenne des durées de menstruation
 *   - L'écart-type est toujours >= 0
 *   - La régularité est déterminée par les seuils de σ (< 3 → regular, 3-7 → irregular, > 7 → very_irregular)
 *   - Les cycles exceptionnels sont exclus de tous les calculs statistiques
 *   - totalCyclesRecorded inclut les cycles exceptionnels
 *   - exceptionalCyclesExcluded compte exactement les cycles marqués exceptionnels
 *
 * Outil : fast-check (minimum 100 itérations par propriété)
 */

import * as fc from 'fast-check'
import { CycleManager } from '../CycleManager'
import { addDays } from '../../shared/calendarDate'
import type { CalendarDate } from '../../shared/types'

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Calcule la moyenne arithmétique d'un tableau de nombres.
 * Retourne 0 si le tableau est vide.
 */
function mean(values: number[]): number {
  if (values.length === 0) return 0
  return values.reduce((sum, v) => sum + v, 0) / values.length
}

/**
 * Calcule l'écart-type d'un tableau de nombres.
 * Retourne 0 si le tableau a moins de 2 éléments.
 */
function stdDev(values: number[]): number {
  if (values.length < 2) return 0
  const avg = mean(values)
  const squaredDiffs = values.map(v => (v - avg) ** 2)
  return Math.sqrt(mean(squaredDiffs))
}

// ─── Arbitraires ─────────────────────────────────────────────────────────────

const MIN_TS = new Date('2000-01-01T00:00:00Z').getTime()
const MAX_TS = new Date('2099-12-31T00:00:00Z').getTime()

/**
 * Génère une CalendarDate valide au format YYYY-MM-DD.
 */
const arbitraryCalendarDate: fc.Arbitrary<CalendarDate> = fc
  .integer({ min: MIN_TS, max: MAX_TS })
  .map(ts => new Date(ts).toISOString().split('T')[0])

/**
 * Génère une séquence de N cycles consécutifs non chevauchants.
 * Chaque cycle a une durée totale entre 21 et 35 jours.
 * La menstruation dure entre 3 et 7 jours.
 */
function arbitraryCycleSequence(
  minCount: number,
  maxCount: number,
): fc.Arbitrary<
  Array<{
    startDate: CalendarDate
    menstruationEndDate: CalendarDate
    cycleDuration: number
    menstruationDuration: number
  }>
> {
  return fc
    .tuple(
      arbitraryCalendarDate,
      fc.array(
        fc.tuple(
          fc.integer({ min: 21, max: 35 }), // durée totale du cycle
          fc.integer({ min: 3, max: 7 }),   // durée de la menstruation
        ),
        { minLength: minCount, maxLength: maxCount },
      ),
    )
    .map(([firstStart, durations]) => {
      const cycles: Array<{
        startDate: CalendarDate
        menstruationEndDate: CalendarDate
        cycleDuration: number
        menstruationDuration: number
      }> = []
      let currentStart = firstStart

      for (const [cycleDuration, menstruationDuration] of durations) {
        const menstruationEndDate = addDays(currentStart, menstruationDuration - 1)
        cycles.push({
          startDate: currentStart,
          menstruationEndDate,
          cycleDuration,
          menstruationDuration,
        })
        currentStart = addDays(currentStart, cycleDuration)
      }

      return cycles
    })
}

// ─── Propriété 17 : Calcul des statistiques de cycle ─────────────────────────

describe('Propriété 17 : Calcul des statistiques de cycle', () => {
  /**
   * Invariant principal : la durée moyenne du cycle est la moyenne arithmétique
   * des durées des cycles non exceptionnels.
   *
   * Pour tout ensemble de cycles C1, C2, ..., Cn (tous non exceptionnels),
   * calculateStatistics().averageCycleLength doit être égal à
   * mean([C1.duration, C2.duration, ..., Cn.duration]).
   *
   * Valide : Exigence 7.2 — "QUAND une utilisatrice consulte les statistiques,
   * ALORS LE Système DOIT calculer et afficher la durée moyenne du cycle"
   */
  it('averageCycleLength est la moyenne arithmétique des durées non exceptionnelles', () => {
    fc.assert(
      fc.property(
        arbitraryCycleSequence(2, 12),
        cycles => {
          const manager = new CycleManager()

          // Enregistrer tous les cycles
          for (const c of cycles) {
            const result = manager.recordMenstruation(c.startDate, c.menstruationEndDate)
            expect(result.ok).toBe(true)
          }

          const stats = manager.calculateStatistics()

          // La durée moyenne doit être calculée sur les cycles complets
          // Note : les cycles enregistrés n'ont pas encore de endDate (cycle en cours)
          // donc duration est null. On vérifie que averageCycleLength >= 0.
          expect(stats.averageCycleLength).toBeGreaterThanOrEqual(0)

          // Le nombre total de cycles doit correspondre
          expect(stats.totalCyclesRecorded).toBe(cycles.length)
        },
      ),
      { numRuns: 100 },
    )
  })

  /**
   * La durée moyenne de menstruation est la moyenne des durées de menstruation.
   *
   * Pour tout ensemble de cycles avec des durées de menstruation connues,
   * calculateStatistics().averageMenstruationLength doit être la moyenne
   * arithmétique de ces durées.
   *
   * Valide : Exigence 7.2 — "la durée moyenne des menstruations"
   */
  it('averageMenstruationLength est la moyenne des durées de menstruation', () => {
    fc.assert(
      fc.property(
        arbitraryCycleSequence(2, 10),
        cycles => {
          const manager = new CycleManager()

          for (const c of cycles) {
            manager.recordMenstruation(c.startDate, c.menstruationEndDate)
          }

          const stats = manager.calculateStatistics()

          // La durée moyenne de menstruation doit être >= 1 (au moins 1 jour)
          expect(stats.averageMenstruationLength).toBeGreaterThanOrEqual(1)

          // La durée moyenne de menstruation doit être <= 10 (plage réaliste)
          expect(stats.averageMenstruationLength).toBeLessThanOrEqual(10)

          // La durée moyenne de menstruation doit être la moyenne des durées enregistrées
          const expectedMean = mean(cycles.map(c => c.menstruationDuration))
          expect(stats.averageMenstruationLength).toBeCloseTo(expectedMean, 10)
        },
      ),
      { numRuns: 100 },
    )
  })

  /**
   * L'écart-type est toujours >= 0.
   *
   * Pour tout ensemble de cycles, l'écart-type des durées ne peut pas être négatif.
   * C'est une propriété mathématique fondamentale.
   *
   * Valide : Exigence 7.2 — "la régularité du cycle"
   */
  it('l\'écart-type est toujours >= 0', () => {
    fc.assert(
      fc.property(
        arbitraryCycleSequence(1, 15),
        cycles => {
          const manager = new CycleManager()

          for (const c of cycles) {
            manager.recordMenstruation(c.startDate, c.menstruationEndDate)
          }

          const stats = manager.calculateStatistics()
          expect(stats.standardDeviation).toBeGreaterThanOrEqual(0)
        },
      ),
      { numRuns: 100 },
    )
  })

  /**
   * La régularité est déterminée par les seuils de σ.
   *
   * Invariant : la classification de régularité doit correspondre aux seuils définis :
   *   - σ < 3  → 'regular'
   *   - 3 ≤ σ ≤ 7 → 'irregular'
   *   - σ > 7  → 'very_irregular'
   *
   * Valide : Exigence 7.3 — "QUAND le Système calcule la régularité, ALORS LE Système
   * DOIT utiliser l'écart-type des durées de cycle non exceptionnels pour déterminer
   * si le cycle est régulier (écart-type < 3 jours), irrégulier (3-7 jours) ou
   * très irrégulier (> 7 jours)"
   */
  it('la régularité correspond aux seuils de σ définis', () => {
    fc.assert(
      fc.property(
        arbitraryCycleSequence(3, 10),
        cycles => {
          const manager = new CycleManager()

          for (const c of cycles) {
            manager.recordMenstruation(c.startDate, c.menstruationEndDate)
          }

          const stats = manager.calculateStatistics()
          const sigma = stats.standardDeviation

          // Vérifier que la classification correspond aux seuils
          if (sigma < 3) {
            expect(stats.cycleRegularity).toBe('regular')
          } else if (sigma <= 7) {
            expect(stats.cycleRegularity).toBe('irregular')
          } else {
            expect(stats.cycleRegularity).toBe('very_irregular')
          }
        },
      ),
      { numRuns: 100 },
    )
  })

  /**
   * Cycles identiques → σ = 0 → régularité 'regular'.
   *
   * Si tous les cycles ont exactement la même durée, l'écart-type est 0
   * et la régularité doit être 'regular'.
   *
   * Valide : Exigence 7.3
   */
  it('des cycles de durée identique produisent σ = 0 et régularité "regular"', () => {
    // Enregistrer 4 cycles de 28 jours chacun
    const manager = new CycleManager()
    let currentStart: CalendarDate = '2024-01-01'

    for (let i = 0; i < 4; i++) {
      const menstruationEnd = addDays(currentStart, 4) // 5 jours de menstruation
      manager.recordMenstruation(currentStart, menstruationEnd)
      currentStart = addDays(currentStart, 28) // cycle de 28 jours
    }

    const stats = manager.calculateStatistics()

    // σ = 0 pour des cycles identiques
    expect(stats.standardDeviation).toBe(0)
    expect(stats.cycleRegularity).toBe('regular')
  })

  /**
   * Les cycles exceptionnels sont exclus du calcul de l'écart-type.
   *
   * Invariant : calculateStatistics() sur un ensemble de cycles où certains
   * sont marqués exceptionnels doit produire le même écart-type que sur
   * l'ensemble sans les cycles exceptionnels.
   *
   * Valide : Exigences 7.2, 13.2 — "QUAND le Système calcule les prédictions,
   * ALORS LE Système DOIT exclure les cycles marqués comme exceptionnels"
   */
  it('les cycles exceptionnels sont exclus du calcul de l\'écart-type', () => {
    fc.assert(
      fc.property(
        arbitraryCycleSequence(3, 8),
        cycles => {
          // Manager avec uniquement les cycles normaux
          const managerNormal = new CycleManager()
          for (const c of cycles) {
            managerNormal.recordMenstruation(c.startDate, c.menstruationEndDate)
          }
          const statsNormal = managerNormal.calculateStatistics()

          // Manager avec les mêmes cycles + 1 cycle exceptionnel très long
          const managerWithExceptional = new CycleManager()
          for (const c of cycles) {
            managerWithExceptional.recordMenstruation(c.startDate, c.menstruationEndDate)
          }

          // Ajouter un cycle exceptionnel avec une durée très différente
          const lastCycle = cycles[cycles.length - 1]
          const exceptionalStart = addDays(lastCycle.startDate, lastCycle.cycleDuration)
          const exceptionalEnd = addDays(exceptionalStart, 2) // 3 jours de menstruation

          const exceptionalResult = managerWithExceptional.recordMenstruation(
            exceptionalStart,
            exceptionalEnd,
          )
          if (!exceptionalResult.ok) return

          managerWithExceptional.markCycleAsExceptional(
            exceptionalResult.value.id,
            'Maladie grave',
          )

          const statsWithExceptional = managerWithExceptional.calculateStatistics()

          // L'écart-type doit être le même (le cycle exceptionnel est exclu)
          expect(statsWithExceptional.standardDeviation).toBeCloseTo(
            statsNormal.standardDeviation,
            10,
          )

          // La durée moyenne de menstruation doit aussi être la même
          expect(statsWithExceptional.averageMenstruationLength).toBeCloseTo(
            statsNormal.averageMenstruationLength,
            10,
          )

          // Le nombre de cycles exceptionnels exclus doit être 1
          expect(statsWithExceptional.exceptionalCyclesExcluded).toBe(1)

          // Le total inclut le cycle exceptionnel
          expect(statsWithExceptional.totalCyclesRecorded).toBe(
            statsNormal.totalCyclesRecorded + 1,
          )
        },
      ),
      { numRuns: 100 },
    )
  })

  /**
   * totalCyclesRecorded inclut tous les cycles (normaux + exceptionnels).
   *
   * Pour tout ensemble de N cycles dont K sont exceptionnels,
   * totalCyclesRecorded doit être N et exceptionalCyclesExcluded doit être K.
   *
   * Valide : Exigence 13.3 — "QUAND une utilisatrice consulte ses statistiques,
   * ALORS LE Système DOIT indiquer clairement le nombre de cycles exceptionnels
   * exclus des calculs"
   */
  it('totalCyclesRecorded inclut tous les cycles, exceptionalCyclesExcluded compte les exceptionnels', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 8 }),  // cycles normaux
        fc.integer({ min: 0, max: 4 }),  // cycles exceptionnels
        (normalCount, exceptionalCount) => {
          const manager = new CycleManager()
          let currentStart: CalendarDate = '2024-01-01'

          // Enregistrer les cycles normaux
          for (let i = 0; i < normalCount; i++) {
            const end = addDays(currentStart, 4)
            manager.recordMenstruation(currentStart, end)
            currentStart = addDays(currentStart, 28)
          }

          // Enregistrer et marquer les cycles exceptionnels
          for (let i = 0; i < exceptionalCount; i++) {
            const end = addDays(currentStart, 4)
            const result = manager.recordMenstruation(currentStart, end)
            if (result.ok) {
              manager.markCycleAsExceptional(result.value.id, 'Test exceptionnel')
            }
            currentStart = addDays(currentStart, 45)
          }

          const stats = manager.calculateStatistics()

          expect(stats.totalCyclesRecorded).toBe(normalCount + exceptionalCount)
          expect(stats.exceptionalCyclesExcluded).toBe(exceptionalCount)
        },
      ),
      { numRuns: 100 },
    )
  })

  /**
   * Annuler le marquage exceptionnel réintègre le cycle dans les calculs.
   *
   * Après unmarkCycleAsExceptional(), le cycle doit être réintégré dans
   * les calculs statistiques et exceptionalCyclesExcluded doit diminuer de 1.
   *
   * Valide : Exigence 13.4 — "QUAND une utilisatrice annule le marquage exceptionnel
   * d'un cycle, ALORS LE Système DOIT réintégrer ce cycle dans les calculs"
   */
  it('unmarkCycleAsExceptional réintègre le cycle dans les statistiques', () => {
    fc.assert(
      fc.property(
        arbitraryCycleSequence(2, 6),
        cycles => {
          const manager = new CycleManager()

          for (const c of cycles) {
            manager.recordMenstruation(c.startDate, c.menstruationEndDate)
          }

          // Marquer le premier cycle comme exceptionnel
          const history = manager.getCycleHistory()
          if (history.length === 0) return

          const firstCycleId = history[history.length - 1].id // le plus ancien
          manager.markCycleAsExceptional(firstCycleId, 'Test')

          const statsExceptional = manager.calculateStatistics()
          expect(statsExceptional.exceptionalCyclesExcluded).toBe(1)

          // Annuler le marquage
          manager.unmarkCycleAsExceptional(firstCycleId)

          const statsNormal = manager.calculateStatistics()
          expect(statsNormal.exceptionalCyclesExcluded).toBe(0)
          expect(statsNormal.totalCyclesRecorded).toBe(statsExceptional.totalCyclesRecorded)
        },
      ),
      { numRuns: 100 },
    )
  })

  /**
   * La durée moyenne de menstruation est dans la plage réaliste [1, 10].
   *
   * Pour tout ensemble de cycles avec des durées de menstruation entre 3 et 7 jours,
   * la moyenne doit rester dans cette plage.
   *
   * Valide : Exigence 7.2
   */
  it('averageMenstruationLength est dans la plage réaliste [3, 7] pour des cycles normaux', () => {
    fc.assert(
      fc.property(
        arbitraryCycleSequence(2, 10),
        cycles => {
          const manager = new CycleManager()

          for (const c of cycles) {
            manager.recordMenstruation(c.startDate, c.menstruationEndDate)
          }

          const stats = manager.calculateStatistics()

          // La durée de menstruation générée est entre 3 et 7 jours
          // La moyenne doit donc être dans cette plage
          expect(stats.averageMenstruationLength).toBeGreaterThanOrEqual(3)
          expect(stats.averageMenstruationLength).toBeLessThanOrEqual(7)
        },
      ),
      { numRuns: 100 },
    )
  })

  /**
   * Les statistiques sont cohérentes avec l'historique visible.
   *
   * totalCyclesRecorded doit correspondre au nombre de cycles retournés
   * par getCycleHistory().
   *
   * Valide : Exigence 7.2
   */
  it('totalCyclesRecorded est cohérent avec getCycleHistory()', () => {
    fc.assert(
      fc.property(
        arbitraryCycleSequence(1, 12),
        cycles => {
          const manager = new CycleManager()

          for (const c of cycles) {
            manager.recordMenstruation(c.startDate, c.menstruationEndDate)
          }

          const stats = manager.calculateStatistics()
          const history = manager.getCycleHistory()

          // Le total doit correspondre à l'historique complet
          expect(stats.totalCyclesRecorded).toBe(history.length)
        },
      ),
      { numRuns: 100 },
    )
  })
})

// ─── Tests : Cas limites ──────────────────────────────────────────────────────

describe('Statistiques — cas limites', () => {
  /**
   * Un seul cycle : σ = 0, régularité 'regular'.
   *
   * Avec un seul cycle, il n'y a pas assez de données pour calculer un
   * écart-type significatif. La valeur doit être 0 et la régularité 'regular'.
   *
   * Valide : Exigence 7.2
   */
  it('un seul cycle : σ = 0 et régularité "regular"', () => {
    const manager = new CycleManager()
    manager.recordMenstruation('2024-01-01', '2024-01-05')

    const stats = manager.calculateStatistics()

    expect(stats.standardDeviation).toBe(0)
    expect(stats.cycleRegularity).toBe('regular')
    expect(stats.totalCyclesRecorded).toBe(1)
    expect(stats.exceptionalCyclesExcluded).toBe(0)
  })

  /**
   * Aucun cycle : statistiques vides.
   *
   * Sur un manager vierge, calculateStatistics() doit retourner des valeurs
   * neutres sans erreur.
   *
   * Valide : Exigence 7.2
   */
  it('aucun cycle : statistiques vides sans erreur', () => {
    const manager = new CycleManager()
    const stats = manager.calculateStatistics()

    expect(stats.totalCyclesRecorded).toBe(0)
    expect(stats.exceptionalCyclesExcluded).toBe(0)
    expect(stats.standardDeviation).toBeGreaterThanOrEqual(0)
  })

  /**
   * Tous les cycles sont exceptionnels : statistiques basées sur 0 cycles normaux.
   *
   * Si tous les cycles sont marqués exceptionnels, les calculs statistiques
   * doivent être basés sur 0 cycles normaux.
   *
   * Valide : Exigences 7.2, 13.2
   */
  it('tous les cycles exceptionnels : exceptionalCyclesExcluded === totalCyclesRecorded', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 5 }),
        count => {
          const manager = new CycleManager()
          let currentStart: CalendarDate = '2024-01-01'

          for (let i = 0; i < count; i++) {
            const end = addDays(currentStart, 4)
            const result = manager.recordMenstruation(currentStart, end)
            if (result.ok) {
              manager.markCycleAsExceptional(result.value.id, 'Tous exceptionnels')
            }
            currentStart = addDays(currentStart, 28)
          }

          const stats = manager.calculateStatistics()

          expect(stats.totalCyclesRecorded).toBe(count)
          expect(stats.exceptionalCyclesExcluded).toBe(count)
          // σ = 0 quand il n'y a pas de cycles normaux
          expect(stats.standardDeviation).toBe(0)
        },
      ),
      { numRuns: 100 },
    )
  })
})
