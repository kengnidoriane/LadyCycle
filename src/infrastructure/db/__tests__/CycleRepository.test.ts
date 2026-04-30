/**
 * Tests property-based pour CycleRepository.
 *
 * Feature: suivi-cycle-menstruel
 *
 * Propriété 3 : Persistance round-trip des données
 *   Valide : Exigences 1.5, 5.4
 *
 * Ces tests vérifient les invariants fondamentaux du repository :
 *   - saveCycle() puis loadCycle() retourne un cycle équivalent (round-trip)
 *   - isExceptional est préservé dans toutes les opérations (0/1 ↔ boolean)
 *   - Les symptômes associés sont correctement persistés et rechargés
 *   - Les prédictions (ovulation, next_period) sont préservées intactes
 *   - loadAllCycles() retourne tous les cycles sauvegardés
 *   - deleteCycle() supprime le cycle et ses données associées
 *   - savePreferences() / loadPreferences() préservent toutes les préférences
 *   - languageCode est correctement persisté et restauré
 *
 * Outil : fast-check (minimum 100 itérations par propriété)
 */

import * as fc from 'fast-check'
import {
  InMemoryCycleRepository,
  type Cycle,
  type Symptom,
  type Prediction,
  type UserPreferences,
} from '../CycleRepository'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeRepo(): InMemoryCycleRepository {
  return new InMemoryCycleRepository()
}

/** Génère un UUID v4 simplifié pour les tests */
function makeId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.floor(Math.random() * 16)
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
  })
}

/** Compare deux cycles en ignorant l'ordre des symptômes */
function cyclesEqual(a: Cycle, b: Cycle): boolean {
  if (a.id !== b.id) return false
  if (a.startDate !== b.startDate) return false
  if (a.endDate !== b.endDate) return false
  if (a.menstruationEndDate !== b.menstruationEndDate) return false
  if (a.duration !== b.duration) return false
  if (a.isExceptional !== b.isExceptional) return false
  if (a.exceptionalReason !== b.exceptionalReason) return false
  if (a.createdAt !== b.createdAt) return false
  if (a.updatedAt !== b.updatedAt) return false

  // Comparer les symptômes (triés par id)
  const sympA = [...a.symptoms].sort((x, y) => x.id.localeCompare(y.id))
  const sympB = [...b.symptoms].sort((x, y) => x.id.localeCompare(y.id))
  if (sympA.length !== sympB.length) return false
  for (let i = 0; i < sympA.length; i++) {
    if (JSON.stringify(sympA[i]) !== JSON.stringify(sympB[i])) return false
  }

  // Comparer les prédictions
  if (JSON.stringify(a.predictions) !== JSON.stringify(b.predictions)) return false

  return true
}

// ─── Arbitraires ─────────────────────────────────────────────────────────────

/** Génère une CalendarDate valide au format YYYY-MM-DD */
const arbitraryCalendarDate = fc
  .integer({ min: new Date('2020-01-01').getTime(), max: new Date('2030-12-31').getTime() })
  .map(ts => new Date(ts).toISOString().split('T')[0])

/** Génère une paire (startDate, endDate) avec endDate >= startDate */
const arbitraryDatePair = fc
  .tuple(
    fc.integer({ min: new Date('2020-01-01').getTime(), max: new Date('2029-12-31').getTime() }),
    fc.integer({ min: 1, max: 35 }),
  )
  .map(([startTs, durationDays]) => {
    const start = new Date(startTs)
    const end = new Date(startTs + durationDays * 24 * 60 * 60 * 1000)
    return {
      startDate: start.toISOString().split('T')[0],
      endDate: end.toISOString().split('T')[0],
      duration: durationDays,
    }
  })

/** Génère un UTCTimestamp valide */
const arbitraryUTCTimestamp = fc
  .integer({ min: new Date('2020-01-01').getTime(), max: new Date('2030-12-31').getTime() })
  .map(ts => new Date(ts).toISOString())

/** Génère un Symptom valide */
const arbitrarySymptom = (cycleId: string): fc.Arbitrary<Symptom> =>
  fc.record({
    id: fc.constant(makeId()),
    cycleId: fc.constant(cycleId),
    date: arbitraryCalendarDate,
    type: fc.constantFrom(
      'cramps' as const, 'headache' as const, 'fatigue' as const,
      'bloating' as const, 'irritable' as const, 'happy' as const,
      'high_energy' as const, 'insomnia' as const,
    ),
    category: fc.constantFrom(
      'pain' as const, 'mood' as const, 'energy' as const,
      'physical' as const, 'sleep' as const,
    ),
    intensity: fc.option(fc.integer({ min: 1, max: 5 }), { nil: null }),
    notes: fc.option(fc.string({ maxLength: 100 }), { nil: null }),
    createdAt: arbitraryUTCTimestamp,
  })

/** Génère une Prediction valide */
const arbitraryPrediction = (cycleId: string, type: 'ovulation' | 'next_period'): fc.Arbitrary<Prediction> =>
  fc.record({
    id: fc.constant(makeId()),
    cycleId: fc.constant(cycleId),
    predictionType: fc.constant(type),
    predictedDate: arbitraryCalendarDate,
    predictedDateRangeStart: fc.option(arbitraryCalendarDate, { nil: null }),
    predictedDateRangeEnd: fc.option(arbitraryCalendarDate, { nil: null }),
    confidence: fc.record({
      level: fc.constantFrom('low' as const, 'medium' as const, 'high' as const),
      explanation: fc.option(
        fc.constantFrom('not_enough_data' as const, 'too_irregular' as const),
        { nil: null },
      ),
      standardDeviation: fc.option(fc.float({ min: 0, max: 10, noNaN: true }), { nil: null }),
    }),
    calculatedAt: arbitraryUTCTimestamp,
  })

/** Génère un Cycle complet avec symptômes et prédictions */
const arbitraryCycle: fc.Arbitrary<Cycle> = arbitraryDatePair.chain(dates => {
  const id = makeId()
  return fc.record({
    id: fc.constant(id),
    startDate: fc.constant(dates.startDate),
    endDate: fc.option(fc.constant(dates.endDate), { nil: null }),
    menstruationEndDate: fc.option(arbitraryCalendarDate, { nil: null }),
    duration: fc.option(fc.constant(dates.duration), { nil: null }),
    isExceptional: fc.boolean(),
    exceptionalReason: fc.option(
      fc.constantFrom('maladie', 'stress', 'voyage', 'autre'),
      { nil: null },
    ),
    symptoms: fc.array(arbitrarySymptom(id), { minLength: 0, maxLength: 5 }),
    predictions: fc.record({
      ovulation: fc.option(arbitraryPrediction(id, 'ovulation'), { nil: null }),
      nextPeriod: fc.option(arbitraryPrediction(id, 'next_period'), { nil: null }),
    }),
    createdAt: arbitraryUTCTimestamp,
    updatedAt: arbitraryUTCTimestamp,
  })
})

/** Génère des UserPreferences complètes */
const arbitraryPreferences: fc.Arbitrary<UserPreferences> = fc.record({
  trackingMode: fc.constantFrom(
    'general' as const,
    'trying_to_conceive' as const,
    'natural_contraception' as const,
  ),
  notificationPreferences: fc.record({
    enabled: fc.boolean(),
    periodAdvanceNoticeDays: fc.array(fc.integer({ min: 1, max: 7 }), { minLength: 1, maxLength: 3 }),
    fertileWindowAdvanceNoticeDays: fc.integer({ min: 1, max: 7 }),
    medicationRemindersEnabled: fc.boolean(),
  }),
  medicationReminders: fc.constant([]),
  securitySettings: fc.record({
    authenticationEnabled: fc.boolean(),
    authenticationType: fc.constantFrom('pin' as const, 'biometric' as const),
    autoLockEnabled: fc.boolean(),
    autoLockTimeoutMinutes: fc.integer({ min: 1, max: 60 }),
    cloudBackupEnabled: fc.boolean(),
    recoveryKitGenerated: fc.boolean(),
  }),
  languageCode: fc.constantFrom('fr' as const, 'en' as const),
})

// ─── Propriété 3 : Persistance round-trip des données ────────────────────────

describe('Propriété 3 : Persistance round-trip des données', () => {
  /**
   * Invariant principal : pour tout cycle C,
   * loadCycle(saveCycle(C).id) retourne un cycle équivalent à C.
   *
   * Vérifie que toutes les propriétés du cycle sont préservées :
   * - Dates (CalendarDate YYYY-MM-DD)
   * - isExceptional (boolean ↔ 0/1)
   * - Symptômes avec leurs intensités et notes
   * - Prédictions avec leurs niveaux de confiance
   * Valide : Exigences 1.5, 5.4
   */
  it('saveCycle() puis loadCycle() retourne un cycle équivalent', async () => {
    await fc.assert(
      fc.asyncProperty(arbitraryCycle, async cycle => {
        const repo = makeRepo()

        const saveResult = repo.saveCycle(cycle)
        expect(saveResult.ok).toBe(true)

        const loadResult = repo.loadCycle(cycle.id)
        expect(loadResult.ok).toBe(true)
        if (!loadResult.ok) return

        const loaded = loadResult.value
        expect(loaded).not.toBeNull()
        if (!loaded) return

        expect(cyclesEqual(loaded, cycle)).toBe(true)
      }),
      { numRuns: 100 },
    )
  })

  /**
   * isExceptional est préservé dans le round-trip.
   *
   * C'est la propriété la plus critique : un cycle marqué exceptionnel
   * doit rester exceptionnel après persistance, et vice-versa.
   * Valide : Exigences 1.5, 5.4
   */
  it('isExceptional est préservé exactement dans le round-trip', async () => {
    await fc.assert(
      fc.asyncProperty(arbitraryCycle, async cycle => {
        const repo = makeRepo()

        repo.saveCycle(cycle)
        const loadResult = repo.loadCycle(cycle.id)

        expect(loadResult.ok).toBe(true)
        if (!loadResult.ok) return

        const loaded = loadResult.value
        expect(loaded).not.toBeNull()
        if (!loaded) return

        // isExceptional doit être exactement le même boolean
        expect(loaded.isExceptional).toBe(cycle.isExceptional)
        expect(typeof loaded.isExceptional).toBe('boolean')
      }),
      { numRuns: 100 },
    )
  })

  /**
   * Les symptômes sont préservés dans le round-trip.
   *
   * Pour tout cycle avec des symptômes, loadCycle() doit retourner
   * exactement les mêmes symptômes avec toutes leurs propriétés.
   * Valide : Exigence 5.4
   */
  it('les symptômes sont préservés intacts dans le round-trip', async () => {
    await fc.assert(
      fc.asyncProperty(arbitraryCycle, async cycle => {
        const repo = makeRepo()

        repo.saveCycle(cycle)
        const loadResult = repo.loadCycle(cycle.id)

        expect(loadResult.ok).toBe(true)
        if (!loadResult.ok) return

        const loaded = loadResult.value
        if (!loaded) return

        expect(loaded.symptoms).toHaveLength(cycle.symptoms.length)

        // Chaque symptôme doit être identique
        const sortedOriginal = [...cycle.symptoms].sort((a, b) => a.id.localeCompare(b.id))
        const sortedLoaded = [...loaded.symptoms].sort((a, b) => a.id.localeCompare(b.id))

        sortedOriginal.forEach((orig, i) => {
          expect(sortedLoaded[i].id).toBe(orig.id)
          expect(sortedLoaded[i].type).toBe(orig.type)
          expect(sortedLoaded[i].category).toBe(orig.category)
          expect(sortedLoaded[i].intensity).toBe(orig.intensity)
          expect(sortedLoaded[i].date).toBe(orig.date)
        })
      }),
      { numRuns: 100 },
    )
  })

  /**
   * loadAllCycles() retourne tous les cycles sauvegardés.
   *
   * Pour tout ensemble de cycles sauvegardés, loadAllCycles() doit
   * retourner exactement ces cycles (ni plus, ni moins).
   * Valide : Exigence 1.5
   */
  it('loadAllCycles() retourne tous les cycles sauvegardés', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(arbitraryCycle, { minLength: 1, maxLength: 10 }),
        async cycles => {
          // S'assurer que les ids sont uniques
          const uniqueCycles = cycles.filter(
            (c, i, arr) => arr.findIndex(x => x.id === c.id) === i,
          )
          fc.pre(uniqueCycles.length >= 1)

          const repo = makeRepo()

          for (const cycle of uniqueCycles) {
            const result = repo.saveCycle(cycle)
            expect(result.ok).toBe(true)
          }

          const loadResult = repo.loadAllCycles()
          expect(loadResult.ok).toBe(true)
          if (!loadResult.ok) return

          const loaded = loadResult.value
          expect(loaded).toHaveLength(uniqueCycles.length)

          // Chaque cycle sauvegardé doit être présent
          for (const original of uniqueCycles) {
            const found = loaded.find(c => c.id === original.id)
            expect(found).toBeDefined()
            if (found) {
              expect(found.isExceptional).toBe(original.isExceptional)
              expect(found.startDate).toBe(original.startDate)
            }
          }
        },
      ),
      { numRuns: 100 },
    )
  })

  /**
   * deleteCycle() supprime le cycle et le rend introuvable.
   *
   * Après suppression, loadCycle() doit retourner null.
   * Valide : Exigence 1.5
   */
  it('deleteCycle() supprime le cycle — loadCycle() retourne null ensuite', async () => {
    await fc.assert(
      fc.asyncProperty(arbitraryCycle, async cycle => {
        const repo = makeRepo()

        repo.saveCycle(cycle)

        // Vérifier que le cycle existe
        const beforeDelete = repo.loadCycle(cycle.id)
        expect(beforeDelete.ok).toBe(true)
        if (beforeDelete.ok) expect(beforeDelete.value).not.toBeNull()

        // Supprimer
        const deleteResult = repo.deleteCycle(cycle.id)
        expect(deleteResult.ok).toBe(true)

        // Vérifier que le cycle n'existe plus
        const afterDelete = repo.loadCycle(cycle.id)
        expect(afterDelete.ok).toBe(true)
        if (afterDelete.ok) expect(afterDelete.value).toBeNull()
      }),
      { numRuns: 100 },
    )
  })

  /**
   * Mise à jour d'un cycle : saveCycle() sur un id existant remplace le cycle.
   *
   * Pour tout cycle C, modifier isExceptional et sauvegarder à nouveau
   * doit retourner la valeur mise à jour.
   * Valide : Exigence 1.5
   */
  it('saveCycle() sur un id existant met à jour le cycle (upsert)', async () => {
    await fc.assert(
      fc.asyncProperty(arbitraryCycle, async cycle => {
        const repo = makeRepo()

        // Sauvegarder le cycle original
        repo.saveCycle(cycle)

        // Modifier isExceptional et sauvegarder à nouveau
        const updated: Cycle = {
          ...cycle,
          isExceptional: !cycle.isExceptional,
          exceptionalReason: !cycle.isExceptional ? 'maladie' : null,
          updatedAt: new Date().toISOString(),
        }
        repo.saveCycle(updated)

        // Charger et vérifier la mise à jour
        const loadResult = repo.loadCycle(cycle.id)
        expect(loadResult.ok).toBe(true)
        if (!loadResult.ok) return

        const loaded = loadResult.value
        expect(loaded).not.toBeNull()
        if (!loaded) return

        expect(loaded.isExceptional).toBe(updated.isExceptional)
        expect(loaded.exceptionalReason).toBe(updated.exceptionalReason)
      }),
      { numRuns: 100 },
    )
  })
})

// ─── Propriété : Persistance des préférences ─────────────────────────────────

describe('Persistance des préférences utilisateur', () => {
  /**
   * Round-trip des préférences : savePreferences() puis loadPreferences()
   * retourne des préférences équivalentes.
   * Valide : Exigence 1.5
   */
  it('savePreferences() puis loadPreferences() retourne des préférences équivalentes', async () => {
    await fc.assert(
      fc.asyncProperty(arbitraryPreferences, async prefs => {
        const repo = makeRepo()

        const saveResult = repo.savePreferences(prefs)
        expect(saveResult.ok).toBe(true)

        const loadResult = repo.loadPreferences()
        expect(loadResult.ok).toBe(true)
        if (!loadResult.ok) return

        const loaded = loadResult.value

        expect(loaded.trackingMode).toBe(prefs.trackingMode)
        expect(loaded.languageCode).toBe(prefs.languageCode)
        expect(loaded.securitySettings.recoveryKitGenerated).toBe(
          prefs.securitySettings.recoveryKitGenerated,
        )
        expect(loaded.securitySettings.cloudBackupEnabled).toBe(
          prefs.securitySettings.cloudBackupEnabled,
        )
        expect(loaded.notificationPreferences.enabled).toBe(
          prefs.notificationPreferences.enabled,
        )
      }),
      { numRuns: 100 },
    )
  })

  /**
   * languageCode est préservé exactement.
   *
   * La langue est une préférence critique — elle doit être restaurée
   * exactement à chaque lancement de l'application.
   * Valide : Exigences 15.3, 15.4
   */
  it('languageCode est préservé exactement dans le round-trip', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom('fr' as const, 'en' as const),
        async languageCode => {
          const repo = makeRepo()

          const prefs: UserPreferences = {
            trackingMode: 'general',
            notificationPreferences: {
              enabled: true,
              periodAdvanceNoticeDays: [3, 1],
              fertileWindowAdvanceNoticeDays: 1,
              medicationRemindersEnabled: true,
            },
            medicationReminders: [],
            securitySettings: {
              authenticationEnabled: false,
              authenticationType: 'pin',
              autoLockEnabled: false,
              autoLockTimeoutMinutes: 5,
              cloudBackupEnabled: false,
              recoveryKitGenerated: false,
            },
            languageCode,
          }

          repo.savePreferences(prefs)
          const loadResult = repo.loadPreferences()

          expect(loadResult.ok).toBe(true)
          if (!loadResult.ok) return

          expect(loadResult.value.languageCode).toBe(languageCode)
        },
      ),
      { numRuns: 100 },
    )
  })

  /**
   * loadPreferences() retourne les valeurs par défaut si aucune préférence
   * n'a été sauvegardée.
   */
  it('loadPreferences() retourne les valeurs par défaut sur un repository vierge', () => {
    const repo = makeRepo()
    const result = repo.loadPreferences()

    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.value.trackingMode).toBe('general')
    expect(result.value.languageCode).toBe('fr')
    expect(result.value.securitySettings.recoveryKitGenerated).toBe(false)
    expect(result.value.securitySettings.cloudBackupEnabled).toBe(false)
  })
})

// ─── Tests : Comportement sur données invalides ───────────────────────────────

describe('CycleRepository — gestion des erreurs', () => {
  it('deleteCycle() retourne une erreur pour un id inexistant', () => {
    const repo = makeRepo()
    const result = repo.deleteCycle('id-inexistant')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('STORAGE_READ_FAILED')
    }
  })

  it('loadCycle() retourne null pour un id inexistant', () => {
    const repo = makeRepo()
    const result = repo.loadCycle('id-inexistant')
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value).toBeNull()
    }
  })

  it('loadAllCycles() retourne un tableau vide sur un repository vierge', () => {
    const repo = makeRepo()
    const result = repo.loadAllCycles()
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value).toHaveLength(0)
    }
  })
})
