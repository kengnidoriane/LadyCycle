/**
 * Tests property-based pour RecordPeriodUseCase.
 *
 * Feature: suivi-cycle-menstruel
 *
 * Propriétés testées :
 *   - Propriété 4 : Recalcul automatique des prédictions (Exigences 1.4, 2.5, 3.5)
 *
 * Outil : fast-check (minimum 100 itérations par propriété)
 */

import * as fc from 'fast-check'
import { RecordPeriodUseCase } from '../RecordPeriodUseCase'
import { InMemoryCycleRepository } from '../../infrastructure/db/CycleRepository'
import type { Cycle } from '../../infrastructure/db/CycleRepository'
import { addDays } from '../../domain/shared/calendarDate'
import type { CalendarDate } from '../../domain/shared/types'

// ─── Arbitraires réutilisables ────────────────────────────────────────────────

const MIN_TS = new Date('2020-01-01T00:00:00Z').getTime()
const MAX_TS = new Date('2030-12-31T00:00:00Z').getTime()

/**
 * Génère une CalendarDate valide au format YYYY-MM-DD.
 */
const arbitraryCalendarDate: fc.Arbitrary<CalendarDate> = fc
  .integer({ min: MIN_TS, max: MAX_TS })
  .map(ts => new Date(ts).toISOString().split('T')[0])

/**
 * Génère une paire (startDate, menstruationEndDate) valide où end >= start.
 * La durée de menstruation est entre 3 et 7 jours (plage réaliste).
 */
const arbitraryValidMenstruationPair = fc
  .tuple(
    arbitraryCalendarDate,
    fc.integer({ min: 3, max: 7 }), // durée de menstruation
  )
  .map(([start, duration]) => ({
    startDate: start,
    menstruationEndDate: addDays(start, duration - 1),
  }))

/**
 * Génère un cycle complet avec toutes les propriétés requises.
 */
function arbitraryCompleteCycle(
  startDate: CalendarDate,
  cycleDuration: number,
  menstruationDuration: number,
  isExceptional: boolean = false,
): Cycle {
  const menstruationEndDate = addDays(startDate, menstruationDuration - 1)
  const endDate = addDays(startDate, cycleDuration - 1)
  const now = new Date().toISOString()

  return {
    id: `cycle-${Math.random().toString(36).substring(7)}`,
    startDate,
    endDate,
    menstruationEndDate,
    duration: cycleDuration,
    menstruationDuration,
    isExceptional,
    exceptionalReason: isExceptional ? 'Test cycle' : null,
    symptoms: [],
    predictions: {
      ovulation: null,
      nextPeriod: null,
    },
    createdAt: now,
    updatedAt: now,
  }
}

/**
 * Génère un historique de N cycles complets non exceptionnels.
 * Chaque cycle a une durée entre 21 et 35 jours.
 */
function arbitraryCycleHistory(count: number): fc.Arbitrary<Cycle[]> {
  return fc
    .tuple(
      arbitraryCalendarDate,
      fc.array(
        fc.tuple(
          fc.integer({ min: 21, max: 35 }), // durée du cycle
          fc.integer({ min: 3, max: 7 }),   // durée de menstruation
        ),
        { minLength: count, maxLength: count },
      ),
    )
    .map(([firstStart, durations]) => {
      const cycles: Cycle[] = []
      let currentStart = firstStart

      for (const [cycleDuration, menstruationDuration] of durations) {
        const cycle = arbitraryCompleteCycle(
          currentStart,
          cycleDuration,
          menstruationDuration,
          false, // non exceptionnel
        )
        cycles.push(cycle)
        // Le prochain cycle commence après la fin du cycle actuel
        currentStart = addDays(currentStart, cycleDuration)
      }

      return cycles
    })
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('RecordPeriodUseCase', () => {
  describe('Feature: suivi-cycle-menstruel, Property 4: Recalcul automatique des prédictions', () => {
    /**
     * Propriété 4 : Recalcul automatique des prédictions
     *
     * Pour tout historique de cycles existant, l'ajout d'un nouveau cycle complet
     * doit déclencher un recalcul des prédictions d'ovulation et des prochaines règles,
     * produisant de nouvelles valeurs différentes des précédentes.
     *
     * Valide : Exigences 1.4, 2.5, 3.5
     */
    test('Property 4: Adding a new cycle triggers automatic prediction recalculation', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Générer un historique de 1 à 6 cycles
          fc.integer({ min: 1, max: 6 }).chain(count => arbitraryCycleHistory(count)),
          // Générer une durée de menstruation valide (3-7 jours)
          fc.integer({ min: 3, max: 7 }),
          async (existingCycles, menstruationDuration) => {
            // Arrange : Créer un repository avec l'historique existant
            const repository = new InMemoryCycleRepository()

            // Sauvegarder l'historique existant
            for (const cycle of existingCycles) {
              const saveResult = repository.saveCycle(cycle)
              expect(saveResult.ok).toBe(true)
            }

            // Capturer les prédictions avant l'ajout du nouveau cycle
            const lastCycle = existingCycles[existingCycles.length - 1]
            const predictionsBefore = lastCycle?.predictions

            // Act : Enregistrer une nouvelle menstruation
            const useCase = new RecordPeriodUseCase(repository, null)

            // Calculer une date de début qui ne chevauche pas les cycles existants
            // Le nouveau cycle commence le jour après la fin du dernier cycle
            const newStartDate = lastCycle
              ? addDays(lastCycle.endDate!, 1)
              : '2024-01-01'
            
            // La menstruation se termine menstruationDuration jours après le début
            const newEndDate = addDays(newStartDate, menstruationDuration - 1)

            const result = await useCase.execute(newStartDate, newEndDate)

            // Assert : Vérifier que l'opération a réussi
            if (!result.ok) {
              // Log l'erreur pour le débogage
              console.error('UseCase failed:', result.error)
            }
            expect(result.ok).toBe(true)

            if (result.ok) {
              const newCycle = result.value

              // Vérifier que le cycle a été créé avec les bonnes dates
              expect(newCycle.startDate).toBe(newStartDate)
              expect(newCycle.menstruationEndDate).toBe(newEndDate)

              // Vérifier que des prédictions ont été calculées
              expect(newCycle.predictions).toBeDefined()

              // Si l'historique contenait au moins 1 cycle, des prédictions doivent être générées
              if (existingCycles.length >= 1) {
                // Vérifier que les prédictions d'ovulation ont été calculées
                expect(newCycle.predictions.ovulation).not.toBeNull()
                if (newCycle.predictions.ovulation) {
                  expect(newCycle.predictions.ovulation.predictedDate).toBeDefined()
                  expect(newCycle.predictions.ovulation.confidence).toBeDefined()
                  expect(newCycle.predictions.ovulation.calculatedAt).toBeDefined()
                }

                // Vérifier que les prédictions des prochaines règles ont été calculées
                expect(newCycle.predictions.nextPeriod).not.toBeNull()
                if (newCycle.predictions.nextPeriod) {
                  expect(newCycle.predictions.nextPeriod.predictedDate).toBeDefined()
                  expect(newCycle.predictions.nextPeriod.confidence).toBeDefined()
                  expect(newCycle.predictions.nextPeriod.calculatedAt).toBeDefined()
                }

                // Vérifier que les nouvelles prédictions sont différentes des anciennes
                // (si des prédictions existaient avant)
                if (predictionsBefore?.nextPeriod && newCycle.predictions.nextPeriod) {
                  // Les prédictions doivent avoir été recalculées (nouveau calculatedAt)
                  expect(newCycle.predictions.nextPeriod.calculatedAt).not.toBe(
                    predictionsBefore.nextPeriod.calculatedAt
                  )
                }
              }

              // Vérifier que le cycle a été persisté
              const loadResult = repository.loadCycle(newCycle.id)
              expect(loadResult.ok).toBe(true)
              if (loadResult.ok && loadResult.value) {
                expect(loadResult.value.id).toBe(newCycle.id)
                expect(loadResult.value.predictions.ovulation).toBeDefined()
                expect(loadResult.value.predictions.nextPeriod).toBeDefined()
              }
            }
          }
        ),
        { numRuns: 100 } // Minimum 100 itérations comme spécifié
      )
    })

    /**
     * Test complémentaire : Vérifier que les prédictions sont recalculées
     * même quand l'historique contient des cycles exceptionnels.
     *
     * Les cycles exceptionnels doivent être exclus des calculs de prédiction.
     */
    test('Property 4 (variant): Predictions exclude exceptional cycles', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Générer un historique de 3 à 6 cycles
          fc.integer({ min: 3, max: 6 }).chain(count => arbitraryCycleHistory(count)),
          // Générer une durée de menstruation valide
          fc.integer({ min: 3, max: 7 }),
          async (existingCycles, menstruationDuration) => {
            // Arrange : Marquer certains cycles comme exceptionnels
            const repository = new InMemoryCycleRepository()

            const cyclesWithExceptional = existingCycles.map((cycle, index) => ({
              ...cycle,
              // Marquer 1 cycle sur 3 comme exceptionnel
              isExceptional: index % 3 === 0,
              exceptionalReason: index % 3 === 0 ? 'Test exceptional' : null,
            }))

            for (const cycle of cyclesWithExceptional) {
              repository.saveCycle(cycle)
            }

            // Act : Enregistrer une nouvelle menstruation
            const useCase = new RecordPeriodUseCase(repository, null)

            const lastCycle = cyclesWithExceptional[cyclesWithExceptional.length - 1]
            const newStartDate = addDays(lastCycle.endDate!, 1)
            const newEndDate = addDays(newStartDate, menstruationDuration - 1)

            const result = await useCase.execute(newStartDate, newEndDate)

            // Assert
            if (!result.ok) {
              console.error('UseCase failed:', result.error)
            }
            expect(result.ok).toBe(true)

            if (result.ok) {
              const newCycle = result.value

              // Vérifier que des prédictions ont été calculées
              expect(newCycle.predictions.ovulation).not.toBeNull()
              expect(newCycle.predictions.nextPeriod).not.toBeNull()

              // Compter les cycles non exceptionnels
              const normalCyclesCount = cyclesWithExceptional.filter(
                c => !c.isExceptional
              ).length

              // Le niveau de confiance doit refléter le nombre de cycles NON exceptionnels
              if (newCycle.predictions.nextPeriod) {
                const confidence = newCycle.predictions.nextPeriod.confidence.level

                if (normalCyclesCount < 3) {
                  expect(confidence).toBe('low')
                  expect(newCycle.predictions.nextPeriod.confidence.explanation).toBe(
                    'not_enough_data'
                  )
                } else if (normalCyclesCount < 6) {
                  expect(['low', 'medium']).toContain(confidence)
                } else {
                  expect(['low', 'medium', 'high']).toContain(confidence)
                }
              }
            }
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  /**
   * Test unitaire simple pour vérifier le fonctionnement de base.
   */
  describe('Basic functionality', () => {
    test('should successfully record a period with empty history', async () => {
      const repository = new InMemoryCycleRepository()
      const useCase = new RecordPeriodUseCase(repository, null)

      const result = await useCase.execute('2024-01-15', '2024-01-20')

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.startDate).toBe('2024-01-15')
        expect(result.value.menstruationEndDate).toBe('2024-01-20')
        expect(result.value.predictions).toBeDefined()
      }
    })

    test('should successfully record a period with existing history', async () => {
      const repository = new InMemoryCycleRepository()
      
      // Add an existing cycle
      const existingCycle = arbitraryCompleteCycle('2024-01-01', 28, 5, false)
      repository.saveCycle(existingCycle)

      const useCase = new RecordPeriodUseCase(repository, null)

      // Add a new cycle after the existing one
      const result = await useCase.execute('2024-01-29', '2024-02-03')

      if (!result.ok) {
        console.error('Error:', result.error)
      }

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.startDate).toBe('2024-01-29')
        expect(result.value.predictions.ovulation).not.toBeNull()
        expect(result.value.predictions.nextPeriod).not.toBeNull()
      }
    })
  })

  /**
   * Test unitaire complémentaire : Vérifier la gestion des erreurs de validation.
   */
  describe('Error handling', () => {
    test('should return validation error when end date is before start date', async () => {
      const repository = new InMemoryCycleRepository()
      const useCase = new RecordPeriodUseCase(repository, null)

      const result = await useCase.execute('2024-01-20', '2024-01-15')

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.code).toBe('INVALID_DATE_RANGE')
      }
    })

    test('should return validation error for invalid date format', async () => {
      const repository = new InMemoryCycleRepository()
      const useCase = new RecordPeriodUseCase(repository, null)

      const result = await useCase.execute('invalid-date', '2024-01-20')

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.code).toBe('INVALID_DATE_FORMAT')
      }
    })
  })
})
