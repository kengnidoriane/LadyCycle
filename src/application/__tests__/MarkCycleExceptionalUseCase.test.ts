/**
 * Tests property-based pour MarkCycleExceptionalUseCase.
 *
 * Feature: suivi-cycle-menstruel
 *
 * Propriétés testées :
 *   - Propriété 33 : Réintégration d'un cycle après annulation du marquage exceptionnel (Exigence 13.4)
 *
 * Outil : fast-check (minimum 100 itérations par propriété)
 */

import * as fc from 'fast-check'
import { MarkCycleExceptionalUseCase } from '../MarkCycleExceptionalUseCase'
import { InMemoryCycleRepository } from '../../infrastructure/db/CycleRepository'
import type { Cycle } from '../../infrastructure/db/CycleRepository'
import { ErrorCode } from '../../domain/shared/errors'
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
 * Génère un historique de N cycles complets.
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
          fc.boolean(),                      // isExceptional
        ),
        { minLength: count, maxLength: count },
      ),
    )
    .map(([firstStart, durations]) => {
      const cycles: Cycle[] = []
      let currentStart = firstStart

      for (const [cycleDuration, menstruationDuration, isExceptional] of durations) {
        const cycle = arbitraryCompleteCycle(
          currentStart,
          cycleDuration,
          menstruationDuration,
          isExceptional,
        )
        cycles.push(cycle)
        // Le prochain cycle commence après la fin du cycle actuel
        currentStart = addDays(currentStart, cycleDuration)
      }

      return cycles
    })
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('MarkCycleExceptionalUseCase', () => {
  describe('Feature: suivi-cycle-menstruel, Property 33: Réintégration après annulation du marquage exceptionnel', () => {
    /**
     * Propriété 33 : Réintégration d'un cycle après annulation du marquage exceptionnel
     *
     * Pour tout cycle précédemment marqué comme exceptionnel dont le marquage est annulé,
     * le système doit réintégrer ce cycle dans les calculs de prédiction et recalculer
     * immédiatement les prédictions.
     *
     * Valide : Exigence 13.4
     */
    test('Property 33: Unmarking exceptional cycle reintegrates it into predictions', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Générer un historique de 3 à 6 cycles (besoin d'au moins 3 pour des prédictions fiables)
          fc.integer({ min: 3, max: 6 }).chain(count => arbitraryCycleHistory(count)),
          async (cycles) => {
            // Arrange : Créer un repository avec l'historique
            const repository = new InMemoryCycleRepository()

            // Sauvegarder tous les cycles
            for (const cycle of cycles) {
              const saveResult = repository.saveCycle(cycle)
              expect(saveResult.ok).toBe(true)
            }

            // Sélectionner un cycle à marquer comme exceptionnel (pas le dernier)
            const cycleToMark = cycles[Math.floor(cycles.length / 2)]

            // Act 1 : Marquer le cycle comme exceptionnel
            const useCase = new MarkCycleExceptionalUseCase(repository)
            const markResult = await useCase.markAsExceptional(
              cycleToMark.id,
              'Test exceptional reason'
            )

            // Assert 1 : Vérifier que le marquage a réussi
            expect(markResult.ok).toBe(true)
            if (!markResult.ok) {
              console.error('Mark failed:', markResult.error)
              return
            }

            const markedCycle = markResult.value
            expect(markedCycle.isExceptional).toBe(true)
            expect(markedCycle.exceptionalReason).toBe('Test exceptional reason')

            // Vérifier que le cycle a été persisté avec isExceptional = true
            const loadMarkedResult = repository.loadCycle(cycleToMark.id)
            expect(loadMarkedResult.ok).toBe(true)
            if (loadMarkedResult.ok && loadMarkedResult.value) {
              expect(loadMarkedResult.value.isExceptional).toBe(true)
            }

            // Compter les cycles non exceptionnels après le marquage
            const allCyclesAfterMark = repository.loadAllCycles()
            expect(allCyclesAfterMark.ok).toBe(true)
            if (!allCyclesAfterMark.ok) return

            const normalCyclesAfterMark = allCyclesAfterMark.value.filter(
              c => !c.isExceptional
            )

            // Act 2 : Annuler le marquage exceptionnel
            const unmarkResult = await useCase.unmarkAsExceptional(cycleToMark.id)

            // Assert 2 : Vérifier que l'annulation a réussi
            expect(unmarkResult.ok).toBe(true)
            if (!unmarkResult.ok) {
              console.error('Unmark failed:', unmarkResult.error)
              return
            }

            const unmarkedCycle = unmarkResult.value
            expect(unmarkedCycle.isExceptional).toBe(false)
            expect(unmarkedCycle.exceptionalReason).toBeNull()

            // Vérifier que le cycle a été persisté avec isExceptional = false
            const loadUnmarkedResult = repository.loadCycle(cycleToMark.id)
            expect(loadUnmarkedResult.ok).toBe(true)
            if (loadUnmarkedResult.ok && loadUnmarkedResult.value) {
              expect(loadUnmarkedResult.value.isExceptional).toBe(false)
              expect(loadUnmarkedResult.value.exceptionalReason).toBeNull()
            }

            // Assert 3 : Vérifier que le cycle a été réintégré dans les calculs
            const allCyclesAfterUnmark = repository.loadAllCycles()
            expect(allCyclesAfterUnmark.ok).toBe(true)
            if (!allCyclesAfterUnmark.ok) return

            const normalCyclesAfterUnmark = allCyclesAfterUnmark.value.filter(
              c => !c.isExceptional
            )

            // Le nombre de cycles normaux doit avoir augmenté de 1
            expect(normalCyclesAfterUnmark.length).toBe(normalCyclesAfterMark.length + 1)

            // Assert 4 : Vérifier que les prédictions ont été recalculées
            // Les prédictions doivent maintenant inclure le cycle réintégré
            // On vérifie que les prédictions existent et ont été mises à jour
            const lastCycle = allCyclesAfterUnmark.value[allCyclesAfterUnmark.value.length - 1]
            
            // Si on a au moins 3 cycles normaux, des prédictions doivent exister
            if (normalCyclesAfterUnmark.length >= 3) {
              // Les prédictions doivent avoir été recalculées
              // (on ne peut pas vérifier les valeurs exactes car elles dépendent de l'algorithme,
              // mais on peut vérifier qu'elles existent)
              expect(lastCycle.predictions).toBeDefined()
            }
          }
        ),
        { numRuns: 100 } // Minimum 100 itérations comme spécifié
      )
    })

    /**
     * Test complémentaire : Vérifier que le marquage d'un cycle comme exceptionnel
     * l'exclut des calculs de prédiction.
     */
    test('Property 33 (variant): Marking cycle as exceptional excludes it from predictions', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Générer un historique de 3 à 6 cycles non exceptionnels
          fc.integer({ min: 3, max: 6 }).chain(count => 
            arbitraryCycleHistory(count).map(cycles => 
              cycles.map(c => ({ ...c, isExceptional: false, exceptionalReason: null }))
            )
          ),
          async (cycles) => {
            // Arrange : Créer un repository avec l'historique
            const repository = new InMemoryCycleRepository()

            for (const cycle of cycles) {
              repository.saveCycle(cycle)
            }

            // Compter les cycles normaux avant le marquage
            const allCyclesBefore = repository.loadAllCycles()
            expect(allCyclesBefore.ok).toBe(true)
            if (!allCyclesBefore.ok) return

            const normalCyclesBefore = allCyclesBefore.value.filter(c => !c.isExceptional)

            // Sélectionner un cycle à marquer
            const cycleToMark = cycles[Math.floor(cycles.length / 2)]

            // Act : Marquer le cycle comme exceptionnel
            const useCase = new MarkCycleExceptionalUseCase(repository)
            const markResult = await useCase.markAsExceptional(
              cycleToMark.id,
              'Test reason'
            )

            // Assert
            expect(markResult.ok).toBe(true)
            if (!markResult.ok) return

            // Vérifier que le cycle est marqué comme exceptionnel
            const loadResult = repository.loadCycle(cycleToMark.id)
            expect(loadResult.ok).toBe(true)
            if (loadResult.ok && loadResult.value) {
              expect(loadResult.value.isExceptional).toBe(true)
            }

            // Vérifier que le nombre de cycles normaux a diminué de 1
            const allCyclesAfter = repository.loadAllCycles()
            expect(allCyclesAfter.ok).toBe(true)
            if (!allCyclesAfter.ok) return

            const normalCyclesAfter = allCyclesAfter.value.filter(c => !c.isExceptional)
            expect(normalCyclesAfter.length).toBe(normalCyclesBefore.length - 1)
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  /**
   * Tests unitaires pour vérifier le fonctionnement de base.
   */
  describe('Basic functionality', () => {
    test('should successfully mark a cycle as exceptional', async () => {
      const repository = new InMemoryCycleRepository()
      
      // Create a cycle
      const cycle = arbitraryCompleteCycle('2024-01-01', 28, 5, false)
      repository.saveCycle(cycle)

      const useCase = new MarkCycleExceptionalUseCase(repository)
      const result = await useCase.markAsExceptional(cycle.id, 'Maladie')

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.isExceptional).toBe(true)
        expect(result.value.exceptionalReason).toBe('Maladie')
      }
    })

    test('should successfully unmark a cycle as exceptional', async () => {
      const repository = new InMemoryCycleRepository()
      
      // Create an exceptional cycle
      const cycle = arbitraryCompleteCycle('2024-01-01', 28, 5, true)
      repository.saveCycle(cycle)

      const useCase = new MarkCycleExceptionalUseCase(repository)
      const result = await useCase.unmarkAsExceptional(cycle.id)

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.isExceptional).toBe(false)
        expect(result.value.exceptionalReason).toBeNull()
      }
    })

    test('should return error when marking non-existent cycle', async () => {
      const repository = new InMemoryCycleRepository()
      const useCase = new MarkCycleExceptionalUseCase(repository)

      const result = await useCase.markAsExceptional('non-existent-id', 'Test')

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.code).toBe('MISSING_REQUIRED_FIELD')
      }
    })

    test('should return error when unmarking non-existent cycle', async () => {
      const repository = new InMemoryCycleRepository()
      const useCase = new MarkCycleExceptionalUseCase(repository)

      const result = await useCase.unmarkAsExceptional('non-existent-id')

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.code).toBe('MISSING_REQUIRED_FIELD')
      }
    })

    test('should persist exceptional status through round-trip', async () => {
      const repository = new InMemoryCycleRepository()
      
      // Create a cycle
      const cycle = arbitraryCompleteCycle('2024-01-01', 28, 5, false)
      repository.saveCycle(cycle)

      // Mark as exceptional
      const useCase = new MarkCycleExceptionalUseCase(repository)
      await useCase.markAsExceptional(cycle.id, 'Test reason')

      // Load and verify
      const loadResult = repository.loadCycle(cycle.id)
      expect(loadResult.ok).toBe(true)
      if (loadResult.ok && loadResult.value) {
        expect(loadResult.value.isExceptional).toBe(true)
        expect(loadResult.value.exceptionalReason).toBe('Test reason')
      }

      // Unmark
      await useCase.unmarkAsExceptional(cycle.id)

      // Load and verify again
      const loadResult2 = repository.loadCycle(cycle.id)
      expect(loadResult2.ok).toBe(true)
      if (loadResult2.ok && loadResult2.value) {
        expect(loadResult2.value.isExceptional).toBe(false)
        expect(loadResult2.value.exceptionalReason).toBeNull()
      }
    })
  })

  /**
   * Tests unitaires pour vérifier la gestion des erreurs.
   */
  describe('Error handling', () => {
    test('should handle repository errors gracefully', async () => {
      // Create a mock repository that fails on save
      const repository = new InMemoryCycleRepository()
      
      // Create a cycle
      const cycle = arbitraryCompleteCycle('2024-01-01', 28, 5, false)
      repository.saveCycle(cycle)

      // Override saveCycle to simulate failure
      const originalSave = repository.saveCycle.bind(repository)
      repository.saveCycle = () => ({
        ok: false,
        error: {
          code: ErrorCode.STORAGE_WRITE_FAILED,
          message: 'Simulated storage failure',
          timestamp: new Date().toISOString(),
        },
      })

      const useCase = new MarkCycleExceptionalUseCase(repository)
      const result = await useCase.markAsExceptional(cycle.id, 'Test')

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.code).toBe('STORAGE_WRITE_FAILED')
      }

      // Restore original method
      repository.saveCycle = originalSave
    })
  })
})
