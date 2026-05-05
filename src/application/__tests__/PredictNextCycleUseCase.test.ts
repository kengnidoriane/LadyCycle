/**
 * Tests pour PredictNextCycleUseCase
 *
 * Vérifie les cas de base et les exemples spécifiques.
 * Les tests basés sur les propriétés sont dans un fichier séparé.
 */

import { PredictNextCycleUseCase } from '../PredictNextCycleUseCase'
import { InMemoryCycleRepository } from '../../infrastructure/db/CycleRepository'
import type { Cycle } from '../../infrastructure/db/CycleRepository'
import { addDays } from '../../domain/shared/calendarDate'
import * as fc from 'fast-check'

// ─── Helpers de test ──────────────────────────────────────────────────────────

function createCycle(
  startDate: string,
  duration: number,
  isExceptional = false,
): Cycle {
  const endDate = addDays(startDate, duration - 1)
  const menstruationEndDate = addDays(startDate, 5)

  return {
    id: `cycle-${startDate}`,
    startDate,
    endDate,
    menstruationEndDate,
    duration,
    menstruationDuration: 5,
    isExceptional,
    exceptionalReason: isExceptional ? 'Test reason' : null,
    symptoms: [],
    predictions: {
      ovulation: null,
      nextPeriod: null,
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('PredictNextCycleUseCase', () => {
  let repository: InMemoryCycleRepository
  let useCase: PredictNextCycleUseCase

  beforeEach(() => {
    repository = new InMemoryCycleRepository()
    useCase = new PredictNextCycleUseCase(repository)
  })

  describe('execute', () => {
    it('devrait retourner les prédictions avec phase actuelle', async () => {
      // Créer un historique de cycles
      const cycles = [
        createCycle('2024-01-01', 28),
        createCycle('2024-01-29', 28),
        createCycle('2024-02-26', 28),
      ]

      // Sauvegarder les cycles
      for (const cycle of cycles) {
        repository.saveCycle(cycle)
      }

      // Exécuter le Use Case
      const result = await useCase.execute()

      // Vérifier le résultat
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.currentPhase).toBeDefined()
        expect(result.value.nextPeriod).toBeDefined()
        expect(result.value.ovulation).toBeDefined()
        expect(result.value.ovulationIsBlurred).toBe(true)

        // Vérifier que les prédictions ont un niveau de confiance
        expect(result.value.nextPeriod.confidence).toBeDefined()
        expect(result.value.ovulation.confidence).toBeDefined()
      }
    })

    it('devrait retourner une erreur si le chargement échoue', async () => {
      // Créer un repository qui échoue
      const failingRepository = {
        loadAllCycles: () => ({
          ok: false,
          error: {
            code: 'STORAGE_READ_FAILED',
            message: 'Échec du chargement',
            timestamp: new Date().toISOString(),
          },
        }),
      } as any

      const failingUseCase = new PredictNextCycleUseCase(failingRepository)

      // Exécuter le Use Case
      const result = await failingUseCase.execute()

      // Vérifier l'erreur
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.code).toBe('STORAGE_READ_FAILED')
      }
    })

    it('devrait fonctionner avec un historique vide', async () => {
      // Exécuter le Use Case sans cycles
      const result = await useCase.execute()

      // Vérifier le résultat
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.currentPhase).toBeDefined()
        expect(result.value.nextPeriod).toBeDefined()
        expect(result.value.ovulation).toBeDefined()
        expect(result.value.ovulationIsBlurred).toBe(true)

        // Avec un historique vide, la confiance devrait être faible
        expect(result.value.nextPeriod.confidence.level).toBe('low')
        expect(result.value.ovulation.confidence.level).toBe('low')
      }
    })

    it('devrait exclure les cycles exceptionnels des prédictions', async () => {
      // Créer un historique avec cycles exceptionnels
      const cycles = [
        createCycle('2024-01-01', 28),
        createCycle('2024-01-29', 45, true), // Exceptionnel
        createCycle('2024-03-14', 28),
        createCycle('2024-04-11', 28),
      ]

      // Sauvegarder les cycles
      for (const cycle of cycles) {
        repository.saveCycle(cycle)
      }

      // Exécuter le Use Case
      const result = await useCase.execute()

      // Vérifier le résultat
      expect(result.ok).toBe(true)
      if (result.ok) {
        // Avec 3 cycles non exceptionnels, la confiance devrait être moyenne
        expect(result.value.nextPeriod.confidence.level).toBe('medium')
      }
    })
  })

  // ─── Tests Basés sur les Propriétés ──────────────────────────────────────────

  describe('Property-Based Tests', () => {
    /**
     * **Validates: Requirements 12.1, 12.4, 2.6**
     * 
     * Propriété 32 : Disponibilité des données pour l'affichage visuel
     * 
     * Pour tout cycle actuel, le système doit fournir les données nécessaires
     * pour afficher visuellement : la phase actuelle, les dates de début et fin
     * prévues, la période féconde, le niveau de confiance avec son explication,
     * et la zone de flou pour l'ovulation.
     * 
     * Cette propriété vérifie que le Use Case retourne toujours un objet complet
     * avec toutes les données nécessaires pour l'UI, indépendamment de l'historique.
     */
    it('Property 32: Visual display data is always available', async () => {
      // Générateur de CalendarDate YYYY-MM-DD
      const calendarDate = fc
        .integer({ min: 0, max: 3650 }) // 10 years of days
        .map(days => {
          const baseDate = new Date('2020-01-01')
          baseDate.setDate(baseDate.getDate() + days)
          return baseDate.toISOString().split('T')[0]
        })

      // Générateur de durée de cycle (21-35 jours)
      const cycleDuration = fc.integer({ min: 21, max: 35 })

      // Générateur d'historique de cycles (0 à 12 cycles)
      const cycleHistoryArbitrary = fc
        .tuple(
          calendarDate, // Date de départ
          fc.array(cycleDuration, { minLength: 0, maxLength: 12 }),
        )
        .map(([startDate, durations]) => {
          const cycles: Cycle[] = []
          let currentDate = startDate

          for (const duration of durations) {
            cycles.push(createCycle(currentDate, duration, false))
            currentDate = addDays(currentDate, duration)
          }

          return cycles
        })

      await fc.assert(
        fc.asyncProperty(cycleHistoryArbitrary, async cycles => {
          // Créer un nouveau repository pour chaque test
          const testRepository = new InMemoryCycleRepository()
          const testUseCase = new PredictNextCycleUseCase(testRepository)

          // Sauvegarder les cycles
          for (const cycle of cycles) {
            testRepository.saveCycle(cycle)
          }

          // Exécuter le Use Case
          const result = await testUseCase.execute()

          // Vérifier que le résultat est toujours un succès
          expect(result.ok).toBe(true)

          if (result.ok) {
            const predictionResult = result.value

            // 1. La phase actuelle doit être définie
            expect(predictionResult.currentPhase).toBeDefined()
            expect(['menstrual', 'follicular', 'ovulation', 'luteal']).toContain(
              predictionResult.currentPhase,
            )

            // 2. Les prédictions des prochaines règles doivent être complètes
            expect(predictionResult.nextPeriod).toBeDefined()
            expect(predictionResult.nextPeriod.value).toBeDefined()
            expect(predictionResult.nextPeriod.value.startDate).toBeDefined()
            expect(predictionResult.nextPeriod.value.endDate).toBeDefined()
            expect(predictionResult.nextPeriod.confidence).toBeDefined()
            expect(predictionResult.nextPeriod.confidence.level).toBeDefined()
            expect(['low', 'medium', 'high']).toContain(
              predictionResult.nextPeriod.confidence.level,
            )

            // 3. Les prédictions d'ovulation doivent être complètes
            expect(predictionResult.ovulation).toBeDefined()
            expect(predictionResult.ovulation.value).toBeDefined()
            expect(predictionResult.ovulation.value.estimatedDate).toBeDefined()
            expect(predictionResult.ovulation.value.fertileWindowStart).toBeDefined()
            expect(predictionResult.ovulation.value.fertileWindowEnd).toBeDefined()
            expect(predictionResult.ovulation.value.isBlurred).toBe(true)
            expect(predictionResult.ovulation.confidence).toBeDefined()

            // 4. Le niveau de confiance doit avoir une explication si faible
            if (predictionResult.nextPeriod.confidence.level === 'low') {
              expect(predictionResult.nextPeriod.confidence.explanation).toBeDefined()
              expect(['not_enough_data', 'too_irregular']).toContain(
                predictionResult.nextPeriod.confidence.explanation,
              )
            }

            if (predictionResult.ovulation.confidence.level === 'low') {
              expect(predictionResult.ovulation.confidence.explanation).toBeDefined()
              expect(['not_enough_data', 'too_irregular']).toContain(
                predictionResult.ovulation.confidence.explanation,
              )
            }

            // 5. La zone de flou pour l'ovulation doit être activée
            expect(predictionResult.ovulationIsBlurred).toBe(true)

            // 6. Les dates doivent être au format YYYY-MM-DD valide
            const dateRegex = /^\d{4}-\d{2}-\d{2}$/
            expect(predictionResult.nextPeriod.value.startDate).toMatch(dateRegex)
            expect(predictionResult.nextPeriod.value.endDate).toMatch(dateRegex)
            expect(predictionResult.ovulation.value.estimatedDate).toMatch(dateRegex)
            expect(predictionResult.ovulation.value.fertileWindowStart).toMatch(dateRegex)
            expect(predictionResult.ovulation.value.fertileWindowEnd).toMatch(dateRegex)

            // 7. La période féconde doit être cohérente (start <= end)
            expect(
              predictionResult.ovulation.value.fertileWindowStart <=
                predictionResult.ovulation.value.fertileWindowEnd,
            ).toBe(true)

            // 8. La plage des prochaines règles doit être cohérente (start <= end)
            expect(
              predictionResult.nextPeriod.value.startDate <=
                predictionResult.nextPeriod.value.endDate,
            ).toBe(true)
          }
        }),
        { numRuns: 100 },
      )
    })
  })
})
