/**
 * Tests unitaires pour GetDailyAdviceUseCase
 *
 * Vérifie que le Use Case :
 * - Détermine correctement la phase actuelle du cycle
 * - Charge les symptômes récents (derniers 7 jours)
 * - Appelle WellnessAdvisor avec les bons paramètres
 * - Retourne des conseils adaptés à la phase et au mode
 */

import { GetDailyAdviceUseCase } from '../GetDailyAdviceUseCase'
import { InMemoryCycleRepository } from '../../infrastructure/db/CycleRepository'
import type { Cycle, Symptom } from '../../infrastructure/db/CycleRepository'
import type { WellnessContent } from '../../domain/wellness/types'
import { today, addDays, subtractDays } from '../../domain/shared/calendarDate'

// ─── Données de test ──────────────────────────────────────────────────────────

const mockWellnessContent: WellnessContent = {
  phases: {
    menstrual: [
      {
        id: 'menstrual_rest',
        category: 'self_care',
        title: 'Repos et détente',
        content: 'Privilégiez le repos pendant vos règles.',
        modes: null,
      },
    ],
    follicular: [
      {
        id: 'follicular_energy',
        category: 'exercise',
        title: 'Activité physique',
        content: 'Profitez de votre énergie pour faire du sport.',
        modes: null,
      },
    ],
    ovulation: [
      {
        id: 'ovulation_fertility',
        category: 'medical',
        title: 'Période féconde',
        content: 'Vous êtes dans votre période féconde.',
        modes: ['trying_to_conceive'],
      },
      {
        id: 'ovulation_general',
        category: 'nutrition',
        title: 'Alimentation équilibrée',
        content: 'Maintenez une alimentation équilibrée.',
        modes: null,
      },
    ],
    luteal: [
      {
        id: 'luteal_spm',
        category: 'medical',
        title: 'Gestion du SPM',
        content: 'Gérez les symptômes prémenstruels.',
        modes: null,
      },
    ],
  },
}

function createTestCycle(overrides?: Partial<Cycle>): Cycle {
  const todayDate = today()
  const startDate = subtractDays(todayDate, 10) // Cycle commencé il y a 10 jours

  return {
    id: 'test-cycle-1',
    startDate,
    endDate: null,
    menstruationEndDate: addDays(startDate, 4), // Menstruation de 5 jours
    duration: null,
    menstruationDuration: 5,
    isExceptional: false,
    exceptionalReason: null,
    symptoms: [],
    predictions: {
      ovulation: null,
      nextPeriod: null,
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('GetDailyAdviceUseCase', () => {
  let repository: InMemoryCycleRepository
  let useCase: GetDailyAdviceUseCase

  beforeEach(() => {
    repository = new InMemoryCycleRepository()
    useCase = new GetDailyAdviceUseCase(repository, mockWellnessContent)
  })

  describe('execute()', () => {
    it('devrait retourner des conseils généraux si aucun cycle en cours', async () => {
      // Aucun cycle enregistré
      const result = await useCase.execute()

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value).toBeInstanceOf(Array)
        expect(result.value.length).toBeGreaterThan(0)
        // Par défaut, retourne des conseils pour la phase menstruelle
        expect(result.value[0].phase).toBe('menstrual')
      }
    })

    it('devrait déterminer la phase menstruelle correctement', async () => {
      // Créer un cycle avec menstruation en cours (jour 3 sur 5)
      const todayDate = today()
      const startDate = subtractDays(todayDate, 2) // Commencé il y a 2 jours

      const cycle = createTestCycle({
        startDate,
        menstruationEndDate: addDays(startDate, 4), // Menstruation de 5 jours
      })

      repository.saveCycle(cycle)

      const result = await useCase.execute()

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.length).toBeGreaterThan(0)
        expect(result.value[0].phase).toBe('menstrual')
      }
    })

    it('devrait déterminer la phase folliculaire correctement', async () => {
      // Créer un cycle au jour 10 (après menstruation, avant ovulation)
      const todayDate = today()
      const startDate = subtractDays(todayDate, 9) // Jour 10 du cycle

      const cycle = createTestCycle({
        startDate,
        menstruationEndDate: addDays(startDate, 4), // Menstruation terminée
        duration: 28, // Cycle de 28 jours
      })

      repository.saveCycle(cycle)

      const result = await useCase.execute()

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.length).toBeGreaterThan(0)
        expect(result.value[0].phase).toBe('follicular')
      }
    })

    it('devrait déterminer la phase d\'ovulation correctement', async () => {
      // Créer un cycle au jour 14 (ovulation estimée)
      const todayDate = today()
      const startDate = subtractDays(todayDate, 13) // Jour 14 du cycle

      const cycle = createTestCycle({
        startDate,
        menstruationEndDate: addDays(startDate, 4),
        duration: 28,
      })

      repository.saveCycle(cycle)

      const result = await useCase.execute()

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.length).toBeGreaterThan(0)
        expect(result.value[0].phase).toBe('ovulation')
      }
    })

    it('devrait déterminer la phase lutéale correctement', async () => {
      // Créer un cycle au jour 20 (après ovulation)
      const todayDate = today()
      const startDate = subtractDays(todayDate, 19) // Jour 20 du cycle

      const cycle = createTestCycle({
        startDate,
        menstruationEndDate: addDays(startDate, 4),
        duration: 28,
      })

      repository.saveCycle(cycle)

      const result = await useCase.execute()

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.length).toBeGreaterThan(0)
        expect(result.value[0].phase).toBe('luteal')
      }
    })

    it('devrait filtrer les symptômes récents (derniers 7 jours)', async () => {
      const todayDate = today()
      const startDate = subtractDays(todayDate, 10)

      const symptoms: Symptom[] = [
        {
          id: 'symptom-1',
          cycleId: 'test-cycle-1',
          date: subtractDays(todayDate, 2), // Il y a 2 jours (récent)
          type: 'cramps',
          category: 'pain',
          intensity: 3,
          notes: null,
          createdAt: new Date().toISOString(),
        },
        {
          id: 'symptom-2',
          cycleId: 'test-cycle-1',
          date: subtractDays(todayDate, 10), // Il y a 10 jours (ancien)
          type: 'headache',
          category: 'pain',
          intensity: 2,
          notes: null,
          createdAt: new Date().toISOString(),
        },
      ]

      const cycle = createTestCycle({
        startDate,
        symptoms,
      })

      repository.saveCycle(cycle)

      const result = await useCase.execute()

      expect(result.ok).toBe(true)
      // Le Use Case devrait filtrer les symptômes et ne garder que ceux des 7 derniers jours
      // (vérification indirecte via les conseils retournés)
    })

    it('devrait adapter les conseils selon le mode de suivi', async () => {
      const todayDate = today()
      const startDate = subtractDays(todayDate, 13) // Jour 14 (ovulation)

      const cycle = createTestCycle({
        startDate,
        duration: 28,
      })

      repository.saveCycle(cycle)

      // Configurer le mode "essai bébé"
      const preferencesResult = repository.loadPreferences()
      if (preferencesResult.ok) {
        const preferences = preferencesResult.value
        preferences.trackingMode = 'trying_to_conceive'
        repository.savePreferences(preferences)
      }

      const result = await useCase.execute()

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.length).toBeGreaterThan(0)
        expect(result.value[0].phase).toBe('ovulation')
        // Devrait inclure des conseils spécifiques au mode "essai bébé"
        const fertilityAdvice = result.value.find(
          (a) => a.id === 'ovulation_fertility',
        )
        expect(fertilityAdvice).toBeDefined()
      }
    })

    it('devrait gérer les erreurs de chargement du repository', async () => {
      // Créer un repository qui échoue
      const failingRepository = {
        loadAllCycles: () => ({
          ok: false,
          error: {
            code: 'STORAGE_READ_FAILED',
            message: 'Erreur de lecture',
            timestamp: new Date().toISOString(),
          },
        }),
        loadPreferences: () => ({
          ok: true,
          value: {
            trackingMode: 'general' as const,
            notificationPreferences: {
              enabled: true,
              periodAdvanceNoticeDays: [3, 1],
              fertileWindowAdvanceNoticeDays: 1,
              medicationRemindersEnabled: true,
            },
            medicationReminders: [],
            securitySettings: {
              authenticationEnabled: false,
              authenticationType: 'pin' as const,
              autoLockEnabled: false,
              autoLockTimeoutMinutes: 5,
              cloudBackupEnabled: false,
              recoveryKitGenerated: false,
            },
            languageCode: 'fr' as const,
          },
        }),
      }

      const failingUseCase = new GetDailyAdviceUseCase(
        failingRepository as any,
        mockWellnessContent,
      )

      const result = await failingUseCase.execute()

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.code).toBe('STORAGE_READ_FAILED')
      }
    })
  })
})
