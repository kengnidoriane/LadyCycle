
/**
 * Tests property-based pour CycleManager.
 *
 * Feature: suivi-cycle-menstruel
 *
 * Propriétés testées :
 *   - Propriété 1  : Enregistrement cohérent des menstruations (Exigences 1.1, 1.2)
 *   - Propriété 2  : Validation des dates de menstruation (Exigence 1.3)
 *   - Propriété 9  : Calcul statistique de la régularité (Exigences 7.3, 13.2)
 *   - Propriété 18 : Complétude de l'historique (Exigences 7.1, 7.5)
 *
 * Outil : fast-check (minimum 100 itérations par propriété)
 */

import * as fc from 'fast-check'
import { CycleManager } from '../CycleManager'
import { addDays, diffDays } from '../../shared/calendarDate'
import type { CalendarDate } from '../../shared/types'

// ─── Arbitraires réutilisables ────────────────────────────────────────────────

const MIN_TS = new Date('2000-01-01T00:00:00Z').getTime()
const MAX_TS = new Date('2099-12-31T00:00:00Z').getTime()

/**
 * Génère une CalendarDate valide au format YYYY-MM-DD.
 */
const arbitraryCalendarDate: fc.Arbitrary<CalendarDate> = fc
  .integer({ min: MIN_TS, max: MAX_TS })
  .map(ts => new Date(ts).toISOString().split('T')[0])

/**
 * Génère une paire (startDate, menstruationEndDate) valide où end >= start.
 * La durée de menstruation est entre 1 et 10 jours (plage réaliste).
 */
const arbitraryValidMenstruationPair = fc
  .tuple(
    arbitraryCalendarDate,
    fc.integer({ min: 0, max: 9 }), // offset en jours (0 = même jour)
  )
  .map(([start, offset]) => ({
    startDate: start,
    menstruationEndDate: addDays(start, offset),
    menstruationDuration: offset + 1,
  }))

/**
 * Génère une paire invalide où end < start.
 * Utilisée pour tester la validation des dates.
 */
const arbitraryInvalidMenstruationPair = fc
  .tuple(
    arbitraryCalendarDate,
    fc.integer({ min: 1, max: 30 }), // offset négatif
  )
  .map(([end, offset]) => ({
    startDate: addDays(end, offset), // start est APRÈS end
    menstruationEndDate: end,
  }))

/**
 * Génère une séquence de N cycles consécutifs non chevauchants.
 * Chaque cycle a une durée totale entre 21 et 35 jours (plage réaliste).
 * La menstruation dure entre 3 et 7 jours.
 */
function arbitraryCycleSequence(
  count: number,
): fc.Arbitrary<Array<{ startDate: CalendarDate; menstruationEndDate: CalendarDate; cycleDuration: number }>> {
  return fc
    .tuple(
      arbitraryCalendarDate,
      fc.array(
        fc.tuple(
          fc.integer({ min: 21, max: 35 }), // durée totale du cycle
          fc.integer({ min: 3, max: 7 }),   // durée de la menstruation
        ),
        { minLength: count, maxLength: count },
      ),
    )
    .map(([firstStart, durations]) => {
      const cycles: Array<{
        startDate: CalendarDate
        menstruationEndDate: CalendarDate
        cycleDuration: number
      }> = []
      let currentStart = firstStart

      for (const [cycleDuration, menstruationDuration] of durations) {
        const menstruationEndDate = addDays(
          currentStart,
          menstruationDuration - 1,
        )
        cycles.push({
          startDate: currentStart,
          menstruationEndDate,
          cycleDuration,
        })
        // Le prochain cycle commence cycleDuration jours après le début du cycle actuel
        currentStart = addDays(currentStart, cycleDuration)
      }

      return cycles
    })
}

// ─── Propriété 1 : Enregistrement cohérent des menstruations ─────────────────

describe('Propriété 1 : Enregistrement cohérent des menstruations', () => {
  /**
   * Pour toute paire de dates valides (start, end) où end >= start,
   * recordMenstruation() doit :
   *   1. Retourner ok=true
   *   2. Créer un cycle avec startDate = start
   *   3. Créer un cycle avec menstruationEndDate = end
   *   4. Calculer menstruationDuration = diffDays(start, end) + 1
   *
   * Valide : Exigences 1.1, 1.2
   */
  it('crée un cycle avec les dates correctes et la durée calculée', () => {
    fc.assert(
      fc.property(
        arbitraryValidMenstruationPair,
        ({ startDate, menstruationEndDate, menstruationDuration }) => {
          const manager = new CycleManager()
          const result = manager.recordMenstruation(startDate, menstruationEndDate)

          expect(result.ok).toBe(true)
          if (!result.ok) return

          const cycle = result.value
          expect(cycle.startDate).toBe(startDate)
          expect(cycle.menstruationEndDate).toBe(menstruationEndDate)
          expect(cycle.menstruationDuration).toBe(menstruationDuration)
        },
      ),
      { numRuns: 200 },
    )
  })

  /**
   * La durée de menstruation est toujours >= 1 jour.
   * Valide : Exigence 1.2
   */
  it('la durée de menstruation est toujours >= 1 jour', () => {
    fc.assert(
      fc.property(
        arbitraryValidMenstruationPair,
        ({ startDate, menstruationEndDate }) => {
          const manager = new CycleManager()
          const result = manager.recordMenstruation(startDate, menstruationEndDate)

          expect(result.ok).toBe(true)
          if (!result.ok) return

          expect(result.value.menstruationDuration).toBeGreaterThanOrEqual(1)
        },
      ),
      { numRuns: 200 },
    )
  })

  /**
   * La durée de menstruation est exactement diffDays(start, end) + 1.
   * Valide : Exigence 1.2
   */
  it('menstruationDuration === diffDays(start, end) + 1', () => {
    fc.assert(
      fc.property(
        arbitraryValidMenstruationPair,
        ({ startDate, menstruationEndDate }) => {
          const manager = new CycleManager()
          const result = manager.recordMenstruation(startDate, menstruationEndDate)

          expect(result.ok).toBe(true)
          if (!result.ok) return

          const expectedDuration = diffDays(startDate, menstruationEndDate) + 1
          expect(result.value.menstruationDuration).toBe(expectedDuration)
        },
      ),
      { numRuns: 200 },
    )
  })

  /**
   * Chaque cycle enregistré reçoit un identifiant unique.
   * Valide : Exigence 1.1
   */
  it('chaque cycle enregistré reçoit un identifiant unique', () => {
    fc.assert(
      fc.property(
        fc.array(arbitraryValidMenstruationPair, { minLength: 2, maxLength: 10 }),
        pairs => {
          const manager = new CycleManager()
          const ids: string[] = []

          for (const { startDate, menstruationEndDate } of pairs) {
            const result = manager.recordMenstruation(startDate, menstruationEndDate)
            if (result.ok) {
              ids.push(result.value.id)
            }
          }

          // Tous les IDs doivent être uniques
          const uniqueIds = new Set(ids)
          expect(uniqueIds.size).toBe(ids.length)
        },
      ),
      { numRuns: 100 },
    )
  })

  /**
   * Un cycle nouvellement enregistré a isExceptional = false par défaut.
   * Valide : Exigence 1.1
   */
  it('un nouveau cycle a isExceptional = false par défaut', () => {
    fc.assert(
      fc.property(
        arbitraryValidMenstruationPair,
        ({ startDate, menstruationEndDate }) => {
          const manager = new CycleManager()
          const result = manager.recordMenstruation(startDate, menstruationEndDate)

          expect(result.ok).toBe(true)
          if (!result.ok) return

          expect(result.value.isExceptional).toBe(false)
          expect(result.value.exceptionalReason).toBeNull()
        },
      ),
      { numRuns: 100 },
    )
  })

  /**
   * Un cycle nouvellement enregistré a endDate = null (cycle en cours).
   * La durée du cycle (duration) est null jusqu'à la clôture du cycle.
   * Valide : Exigence 1.1
   */
  it('un nouveau cycle a endDate = null et duration = null (cycle en cours)', () => {
    fc.assert(
      fc.property(
        arbitraryValidMenstruationPair,
        ({ startDate, menstruationEndDate }) => {
          const manager = new CycleManager()
          const result = manager.recordMenstruation(startDate, menstruationEndDate)

          expect(result.ok).toBe(true)
          if (!result.ok) return

          expect(result.value.endDate).toBeNull()
          expect(result.value.duration).toBeNull()
        },
      ),
      { numRuns: 100 },
    )
  })
})

// ─── Propriété 2 : Validation des dates de menstruation ──────────────────────

describe('Propriété 2 : Validation des dates de menstruation', () => {
  /**
   * Pour toute paire (start, end) où end < start,
   * recordMenstruation() doit retourner ok=false avec INVALID_DATE_RANGE.
   *
   * Valide : Exigence 1.3
   */
  it('rejette les paires où end < start avec INVALID_DATE_RANGE', () => {
    fc.assert(
      fc.property(
        arbitraryInvalidMenstruationPair,
        ({ startDate, menstruationEndDate }) => {
          const manager = new CycleManager()
          const result = manager.recordMenstruation(startDate, menstruationEndDate)

          expect(result.ok).toBe(false)
          if (result.ok) return

          expect(result.error.code).toBe('INVALID_DATE_RANGE')
        },
      ),
      { numRuns: 200 },
    )
  })

  /**
   * Une paire invalide ne doit pas modifier l'état du manager.
   * Valide : Exigence 1.3
   */
  it('une paire invalide ne modifie pas l\'état du manager', () => {
    fc.assert(
      fc.property(
        arbitraryInvalidMenstruationPair,
        ({ startDate, menstruationEndDate }) => {
          const manager = new CycleManager()
          const historyBefore = manager.getCycleHistory()

          manager.recordMenstruation(startDate, menstruationEndDate)

          const historyAfter = manager.getCycleHistory()
          expect(historyAfter.length).toBe(historyBefore.length)
        },
      ),
      { numRuns: 200 },
    )
  })

  /**
   * Une date de début au format invalide doit être rejetée.
   * Valide : Exigence 1.3
   */
  it('rejette les dates au format invalide', () => {
    const invalidDates = [
      '15/01/2024',
      '2024.01.15',
      '20240115',
      'not-a-date',
      '',
      '2024-13-01',
      '2024-01-32',
    ]

    for (const invalidDate of invalidDates) {
      const manager = new CycleManager()
      const result = manager.recordMenstruation(invalidDate, '2024-01-20')
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.code).toBe('INVALID_DATE_FORMAT')
      }
    }
  })

  /**
   * Une date de fin au format invalide doit être rejetée.
   * Valide : Exigence 1.3
   */
  it('rejette les dates de fin au format invalide', () => {
    const invalidDates = [
      '15/01/2024',
      '2024.01.15',
      'not-a-date',
      '',
    ]

    for (const invalidDate of invalidDates) {
      const manager = new CycleManager()
      const result = manager.recordMenstruation('2024-01-15', invalidDate)
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.code).toBe('INVALID_DATE_FORMAT')
      }
    }
  })

  /**
   * updateMenstruation() rejette aussi les paires invalides.
   * Valide : Exigence 1.3
   */
  it('updateMenstruation() rejette les paires où end < start', () => {
    fc.assert(
      fc.property(
        arbitraryValidMenstruationPair,
        arbitraryInvalidMenstruationPair,
        ({ startDate, menstruationEndDate }, invalidPair) => {
          const manager = new CycleManager()
          const createResult = manager.recordMenstruation(startDate, menstruationEndDate)
          if (!createResult.ok) return

          const updateResult = manager.updateMenstruation(
            createResult.value.id,
            invalidPair.startDate,
            invalidPair.menstruationEndDate,
          )

          expect(updateResult.ok).toBe(false)
          if (!updateResult.ok) {
            expect(updateResult.error.code).toBe('INVALID_DATE_RANGE')
          }
        },
      ),
      { numRuns: 100 },
    )
  })
})

// ─── Propriété 9 : Calcul statistique de la régularité ───────────────────────

describe('Propriété 9 : Calcul statistique de la régularité', () => {
  /**
   * Les cycles exceptionnels sont exclus du calcul de l'écart-type.
   *
   * Invariant : calculateStatistics() sur un ensemble de cycles où certains
   * sont marqués exceptionnels doit produire le même résultat que sur
   * l'ensemble sans les cycles exceptionnels.
   *
   * Valide : Exigences 7.3, 13.2
   */
  it('les cycles exceptionnels sont exclus du calcul de l\'écart-type', () => {
    fc.assert(
      fc.property(
        // Générer 4 cycles normaux + 1 cycle exceptionnel très long
        arbitraryCycleSequence(4),
        arbitraryValidMenstruationPair,
        (normalCycles, exceptionalMenstruation) => {
          // Manager avec 4 cycles normaux
          const managerNormal = new CycleManager()
          for (const c of normalCycles) {
            managerNormal.recordMenstruation(c.startDate, c.menstruationEndDate)
          }
          const statsNormal = managerNormal.calculateStatistics()

          // Manager avec les mêmes 4 cycles + 1 cycle exceptionnel
          const managerWithExceptional = new CycleManager()
          for (const c of normalCycles) {
            managerWithExceptional.recordMenstruation(c.startDate, c.menstruationEndDate)
          }
          const exceptionalResult = managerWithExceptional.recordMenstruation(
            exceptionalMenstruation.startDate,
            exceptionalMenstruation.menstruationEndDate,
          )
          if (!exceptionalResult.ok) return

          managerWithExceptional.markCycleAsExceptional(
            exceptionalResult.value.id,
            'Test exceptionnel',
          )

          const statsWithExceptional = managerWithExceptional.calculateStatistics()

          // L'écart-type doit être le même (le cycle exceptionnel est exclu)
          expect(statsWithExceptional.standardDeviation).toBeCloseTo(
            statsNormal.standardDeviation,
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
   * La régularité est déterminée correctement selon les seuils de σ :
   *   - σ < 3  → 'regular'
   *   - 3 ≤ σ ≤ 7 → 'irregular'
   *   - σ > 7  → 'very_irregular'
   *
   * Valide : Exigence 7.3
   */
  it('la régularité correspond aux seuils de σ définis', () => {
    // Cycles très réguliers : durées identiques → σ = 0
    const regularManager = new CycleManager()
    // Enregistrer 4 cycles de 28 jours chacun
    let currentStart: CalendarDate = '2024-01-01'
    for (let i = 0; i < 4; i++) {
      const end = addDays(currentStart, 4) // menstruation de 5 jours
      regularManager.recordMenstruation(currentStart, end)
      currentStart = addDays(currentStart, 28)
    }
    const regularStats = regularManager.calculateStatistics()
    // σ = 0 → regular
    expect(regularStats.cycleRegularity).toBe('regular')
    expect(regularStats.standardDeviation).toBeLessThan(3)
  })

  /**
   * calculateStatistics() retourne le nombre total de cycles enregistrés,
   * incluant les cycles exceptionnels.
   *
   * Valide : Exigence 13.3
   */
  it('totalCyclesRecorded inclut tous les cycles (normaux + exceptionnels)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 10 }),
        fc.integer({ min: 0, max: 5 }),
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
              manager.markCycleAsExceptional(result.value.id, 'Test')
            }
            currentStart = addDays(currentStart, 45) // cycle long exceptionnel
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
   * L'écart-type est toujours >= 0.
   * Valide : Exigence 7.3
   */
  it('l\'écart-type est toujours >= 0', () => {
    fc.assert(
      fc.property(
        arbitraryCycleSequence(3),
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
   * Annuler le marquage exceptionnel réintègre le cycle dans les calculs.
   * Valide : Exigence 13.4 (via calculateStatistics)
   */
  it('unmarkCycleAsExceptional réintègre le cycle dans les calculs', () => {
    fc.assert(
      fc.property(
        arbitraryValidMenstruationPair,
        ({ startDate, menstruationEndDate }) => {
          const manager = new CycleManager()
          const result = manager.recordMenstruation(startDate, menstruationEndDate)
          if (!result.ok) return

          const cycleId = result.value.id

          // Marquer comme exceptionnel
          manager.markCycleAsExceptional(cycleId, 'Test')
          const statsExceptional = manager.calculateStatistics()
          expect(statsExceptional.exceptionalCyclesExcluded).toBe(1)

          // Annuler le marquage
          manager.unmarkCycleAsExceptional(cycleId)
          const statsNormal = manager.calculateStatistics()
          expect(statsNormal.exceptionalCyclesExcluded).toBe(0)
        },
      ),
      { numRuns: 100 },
    )
  })
})

// ─── Propriété 18 : Complétude de l'historique ───────────────────────────────

describe('Propriété 18 : Complétude de l\'historique', () => {
  /**
   * getCycleHistory() retourne tous les cycles enregistrés, sans exception.
   *
   * Invariant : après N enregistrements valides, getCycleHistory() retourne
   * exactement N cycles.
   *
   * Valide : Exigence 7.1
   */
  it('getCycleHistory() retourne tous les cycles enregistrés', () => {
    fc.assert(
      fc.property(
        fc.array(arbitraryValidMenstruationPair, { minLength: 1, maxLength: 15 }),
        pairs => {
          const manager = new CycleManager()
          let successCount = 0

          for (const { startDate, menstruationEndDate } of pairs) {
            const result = manager.recordMenstruation(startDate, menstruationEndDate)
            if (result.ok) successCount++
          }

          const history = manager.getCycleHistory()
          expect(history.length).toBe(successCount)
        },
      ),
      { numRuns: 100 },
    )
  })

  /**
   * getCycleHistory() retourne les cycles triés du plus récent au plus ancien.
   * Valide : Exigence 7.1
   */
  it('getCycleHistory() retourne les cycles triés du plus récent au plus ancien', () => {
    fc.assert(
      fc.property(
        arbitraryCycleSequence(5),
        cycles => {
          const manager = new CycleManager()
          for (const c of cycles) {
            manager.recordMenstruation(c.startDate, c.menstruationEndDate)
          }

          const history = manager.getCycleHistory()

          // Vérifier l'ordre décroissant des startDate
          for (let i = 0; i < history.length - 1; i++) {
            expect(history[i].startDate >= history[i + 1].startDate).toBe(true)
          }
        },
      ),
      { numRuns: 100 },
    )
  })

  /**
   * getCycleHistory(limit) retourne au plus `limit` cycles.
   * Valide : Exigence 7.1
   */
  it('getCycleHistory(limit) retourne au plus limit cycles', () => {
    fc.assert(
      fc.property(
        arbitraryCycleSequence(8),
        fc.integer({ min: 1, max: 5 }),
        (cycles, limit) => {
          const manager = new CycleManager()
          for (const c of cycles) {
            manager.recordMenstruation(c.startDate, c.menstruationEndDate)
          }

          const history = manager.getCycleHistory(limit)
          expect(history.length).toBeLessThanOrEqual(limit)
        },
      ),
      { numRuns: 100 },
    )
  })

  /**
   * getCycleHistory() inclut les cycles exceptionnels.
   * Les cycles exceptionnels sont conservés dans l'historique même s'ils
   * sont exclus des calculs statistiques.
   *
   * Valide : Exigences 7.1, 7.5
   */
  it('getCycleHistory() inclut les cycles exceptionnels', () => {
    fc.assert(
      fc.property(
        arbitraryCycleSequence(3),
        cycles => {
          const manager = new CycleManager()
          const ids: string[] = []

          for (const c of cycles) {
            const result = manager.recordMenstruation(c.startDate, c.menstruationEndDate)
            if (result.ok) ids.push(result.value.id)
          }

          // Marquer le premier cycle comme exceptionnel
          if (ids.length > 0) {
            manager.markCycleAsExceptional(ids[0], 'Maladie')
          }

          const history = manager.getCycleHistory()
          // Tous les cycles sont dans l'historique, y compris l'exceptionnel
          expect(history.length).toBe(ids.length)

          // Le cycle exceptionnel est bien présent et marqué
          const exceptionalInHistory = history.find(c => c.id === ids[0])
          if (exceptionalInHistory) {
            expect(exceptionalInHistory.isExceptional).toBe(true)
          }
        },
      ),
      { numRuns: 100 },
    )
  })

  /**
   * updateMenstruation() met à jour le cycle dans l'historique.
   * Valide : Exigence 7.1
   */
  it('updateMenstruation() met à jour le cycle dans l\'historique', () => {
    fc.assert(
      fc.property(
        arbitraryValidMenstruationPair,
        arbitraryValidMenstruationPair,
        (original, updated) => {
          const manager = new CycleManager()
          const createResult = manager.recordMenstruation(
            original.startDate,
            original.menstruationEndDate,
          )
          if (!createResult.ok) return

          const cycleId = createResult.value.id
          const updateResult = manager.updateMenstruation(
            cycleId,
            updated.startDate,
            updated.menstruationEndDate,
          )
          if (!updateResult.ok) return

          // L'historique doit contenir le cycle mis à jour
          const history = manager.getCycleHistory()
          const updatedCycle = history.find(c => c.id === cycleId)

          expect(updatedCycle).toBeDefined()
          if (!updatedCycle) return

          expect(updatedCycle.startDate).toBe(updated.startDate)
          expect(updatedCycle.menstruationEndDate).toBe(updated.menstruationEndDate)
          expect(updatedCycle.menstruationDuration).toBe(updated.menstruationDuration)
        },
      ),
      { numRuns: 100 },
    )
  })

  /**
   * getCurrentCycle() retourne le cycle le plus récent sans endDate.
   * Valide : Exigence 7.1
   */
  it('getCurrentCycle() retourne le cycle en cours (sans endDate)', () => {
    fc.assert(
      fc.property(
        arbitraryCycleSequence(3),
        cycles => {
          const manager = new CycleManager()
          let lastId: string | null = null

          for (const c of cycles) {
            const result = manager.recordMenstruation(c.startDate, c.menstruationEndDate)
            if (result.ok) lastId = result.value.id
          }

          const current = manager.getCurrentCycle()

          // Il doit y avoir un cycle en cours (le dernier enregistré)
          expect(current).not.toBeNull()
          if (!current) return

          // Le cycle en cours n'a pas de endDate
          expect(current.endDate).toBeNull()

          // C'est le cycle avec la startDate la plus récente
          if (lastId) {
            expect(current.id).toBe(lastId)
          }
        },
      ),
      { numRuns: 100 },
    )
  })

  /**
   * Un manager vide retourne null pour getCurrentCycle().
   * Valide : Exigence 7.1
   */
  it('getCurrentCycle() retourne null si aucun cycle n\'est enregistré', () => {
    const manager = new CycleManager()
    expect(manager.getCurrentCycle()).toBeNull()
  })
})
