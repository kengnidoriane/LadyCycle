/**
 * Tests property-based pour SymptomTracker.
 *
 * Feature: suivi-cycle-menstruel
 *
 * Propriétés testées :
 *   - Propriété 13 : Association des symptômes aux cycles (Exigence 5.5)
 *
 * Outil : fast-check (minimum 100 itérations par propriété)
 */

import * as fc from 'fast-check'
import { SymptomTracker } from '../SymptomTracker'
import type { CalendarDate } from '../../shared/types'
import type { SymptomType } from '../types'
import { SYMPTOM_TYPE_TO_CATEGORY } from '../types'

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
 * Génère un type de symptôme valide.
 */
const arbitrarySymptomType: fc.Arbitrary<SymptomType> = fc.constantFrom(
  // Douleurs
  'cramps',
  'headache',
  'back_pain',
  'breast_tenderness',
  // Humeur
  'irritable',
  'anxious',
  'happy',
  'sad',
  'mood_swings',
  // Énergie
  'high_energy',
  'low_energy',
  'fatigue',
  // Physique
  'bloating',
  'acne',
  'nausea',
  'food_cravings',
  // Sommeil
  'insomnia',
  'good_sleep',
  'restless_sleep',
)

/**
 * Génère un symptôme de douleur avec intensité valide.
 */
const arbitraryPainSymptom = fc
  .tuple(
    fc.constantFrom('cramps', 'headache', 'back_pain', 'breast_tenderness'),
    fc.integer({ min: 1, max: 5 }),
    fc.option(fc.string(), { nil: null }),
  )
  .map(([type, intensity, notes]) => ({
    type: type as SymptomType,
    intensity,
    notes: notes ?? undefined,
  }))

/**
 * Génère un symptôme sans intensité (non-douleur).
 */
const arbitraryNonPainSymptom = fc
  .tuple(
    fc.constantFrom(
      // Humeur
      'irritable',
      'anxious',
      'happy',
      'sad',
      'mood_swings',
      // Énergie
      'high_energy',
      'low_energy',
      'fatigue',
      // Physique
      'bloating',
      'acne',
      'nausea',
      'food_cravings',
      // Sommeil
      'insomnia',
      'good_sleep',
      'restless_sleep',
    ),
    fc.option(fc.string(), { nil: null }),
  )
  .map(([type, notes]) => ({
    type: type as SymptomType,
    intensity: undefined,
    notes: notes ?? undefined,
  }))

/**
 * Génère un symptôme valide (douleur avec intensité ou non-douleur sans intensité).
 */
const arbitraryValidSymptom = fc.oneof(
  arbitraryPainSymptom,
  arbitraryNonPainSymptom,
)

/**
 * Génère un identifiant de cycle.
 */
const arbitraryCycleId = fc
  .uuid()
  .map(uuid => `cycle-${uuid}`)

// ─── Propriété 13 : Association des symptômes aux cycles ──────────────────────

describe('Propriété 13 : Association des symptômes aux cycles', () => {
  /**
   * Pour tout symptôme enregistré avec une date et un cycleId,
   * getSymptomsForCycle(cycleId) DOIT inclure ce symptôme.
   *
   * Valide : Exigence 5.5
   */
  it('getSymptomsForCycle() inclut tous les symptômes enregistrés pour ce cycle', () => {
    fc.assert(
      fc.property(
        arbitraryCalendarDate,
        arbitraryValidSymptom,
        arbitraryCycleId,
        (date, symptomData, cycleId) => {
          const tracker = new SymptomTracker()
          const result = tracker.recordSymptom(date, symptomData, cycleId)

          expect(result.ok).toBe(true)
          if (!result.ok) return

          const symptom = result.value
          const symptomsForCycle = tracker.getSymptomsForCycle(cycleId)

          // Le symptôme doit être dans la liste
          expect(symptomsForCycle).toContainEqual(symptom)
          expect(symptomsForCycle.length).toBeGreaterThanOrEqual(1)
        },
      ),
      { numRuns: 200 },
    )
  })

  /**
   * Pour tout symptôme enregistré avec une date,
   * getSymptomsForDate(date) DOIT inclure ce symptôme.
   *
   * Valide : Exigence 5.5
   */
  it('getSymptomsForDate() inclut tous les symptômes enregistrés pour cette date', () => {
    fc.assert(
      fc.property(
        arbitraryCalendarDate,
        arbitraryValidSymptom,
        (date, symptomData) => {
          const tracker = new SymptomTracker()
          const result = tracker.recordSymptom(date, symptomData)

          expect(result.ok).toBe(true)
          if (!result.ok) return

          const symptom = result.value
          const symptomsForDate = tracker.getSymptomsForDate(date)

          // Le symptôme doit être dans la liste
          expect(symptomsForDate).toContainEqual(symptom)
          expect(symptomsForDate.length).toBeGreaterThanOrEqual(1)
        },
      ),
      { numRuns: 200 },
    )
  })

  /**
   * Plusieurs symptômes enregistrés pour le même cycle doivent tous être retournés.
   *
   * Valide : Exigence 5.5
   */
  it('getSymptomsForCycle() retourne tous les symptômes du cycle', () => {
    fc.assert(
      fc.property(
        arbitraryCycleId,
        fc.array(
          fc.tuple(arbitraryCalendarDate, arbitraryValidSymptom),
          { minLength: 2, maxLength: 10 },
        ),
        (cycleId, symptomPairs) => {
          const tracker = new SymptomTracker()
          const recordedSymptoms: string[] = []

          for (const [date, symptomData] of symptomPairs) {
            const result = tracker.recordSymptom(date, symptomData, cycleId)
            if (result.ok) {
              recordedSymptoms.push(result.value.id)
            }
          }

          const symptomsForCycle = tracker.getSymptomsForCycle(cycleId)

          // Tous les symptômes enregistrés doivent être présents
          expect(symptomsForCycle.length).toBe(recordedSymptoms.length)
          for (const symptomId of recordedSymptoms) {
            expect(symptomsForCycle.some(s => s.id === symptomId)).toBe(true)
          }
        },
      ),
      { numRuns: 100 },
    )
  })

  /**
   * Plusieurs symptômes enregistrés pour la même date doivent tous être retournés.
   *
   * Valide : Exigence 5.1
   */
  it('getSymptomsForDate() retourne tous les symptômes de la date', () => {
    fc.assert(
      fc.property(
        arbitraryCalendarDate,
        fc.array(arbitraryValidSymptom, { minLength: 2, maxLength: 10 }),
        (date, symptoms) => {
          const tracker = new SymptomTracker()
          const recordedSymptoms: string[] = []

          for (const symptomData of symptoms) {
            const result = tracker.recordSymptom(date, symptomData)
            if (result.ok) {
              recordedSymptoms.push(result.value.id)
            }
          }

          const symptomsForDate = tracker.getSymptomsForDate(date)

          // Tous les symptômes enregistrés doivent être présents
          expect(symptomsForDate.length).toBe(recordedSymptoms.length)
          for (const symptomId of recordedSymptoms) {
            expect(symptomsForDate.some(s => s.id === symptomId)).toBe(true)
          }
        },
      ),
      { numRuns: 100 },
    )
  })

  /**
   * Les symptômes d'un cycle ne doivent pas apparaître dans un autre cycle.
   *
   * Valide : Exigence 5.5
   */
  it('les symptômes sont correctement isolés par cycle', () => {
    fc.assert(
      fc.property(
        fc.tuple(arbitraryCycleId, arbitraryCycleId).filter(
          ([id1, id2]) => id1 !== id2,
        ),
        arbitraryCalendarDate,
        arbitraryValidSymptom,
        arbitraryValidSymptom,
        ([cycleId1, cycleId2], date, symptom1, symptom2) => {
          const tracker = new SymptomTracker()

          const result1 = tracker.recordSymptom(date, symptom1, cycleId1)
          const result2 = tracker.recordSymptom(date, symptom2, cycleId2)

          if (!result1.ok || !result2.ok) return

          const symptomsForCycle1 = tracker.getSymptomsForCycle(cycleId1)
          const symptomsForCycle2 = tracker.getSymptomsForCycle(cycleId2)

          // Chaque cycle doit avoir exactement son symptôme
          expect(symptomsForCycle1.length).toBe(1)
          expect(symptomsForCycle2.length).toBe(1)
          expect(symptomsForCycle1[0].id).toBe(result1.value.id)
          expect(symptomsForCycle2[0].id).toBe(result2.value.id)
        },
      ),
      { numRuns: 100 },
    )
  })

  /**
   * Un symptôme sans cycleId ne doit pas apparaître dans getSymptomsForCycle().
   *
   * Valide : Exigence 5.5
   */
  it('un symptôme sans cycleId n\'apparaît pas dans getSymptomsForCycle()', () => {
    fc.assert(
      fc.property(
        arbitraryCalendarDate,
        arbitraryValidSymptom,
        arbitraryCycleId,
        (date, symptomData, cycleId) => {
          const tracker = new SymptomTracker()

          // Enregistrer sans cycleId
          const result = tracker.recordSymptom(date, symptomData)
          expect(result.ok).toBe(true)

          // Ne doit pas apparaître dans ce cycle
          const symptomsForCycle = tracker.getSymptomsForCycle(cycleId)
          expect(symptomsForCycle.length).toBe(0)
        },
      ),
      { numRuns: 100 },
    )
  })

  /**
   * associateSymptomToCycle() permet d'associer un symptôme à un cycle après coup.
   *
   * Valide : Exigence 5.4
   */
  it('associateSymptomToCycle() associe correctement un symptôme existant', () => {
    fc.assert(
      fc.property(
        arbitraryCalendarDate,
        arbitraryValidSymptom,
        arbitraryCycleId,
        (date, symptomData, cycleId) => {
          const tracker = new SymptomTracker()

          // Enregistrer sans cycleId
          const result = tracker.recordSymptom(date, symptomData)
          if (!result.ok) return

          const symptomId = result.value.id

          // Associer après coup
          tracker.associateSymptomToCycle(symptomId, cycleId)

          // Le symptôme doit maintenant apparaître dans le cycle
          const symptomsForCycle = tracker.getSymptomsForCycle(cycleId)
          expect(symptomsForCycle.some(s => s.id === symptomId)).toBe(true)
        },
      ),
      { numRuns: 100 },
    )
  })
})

// ─── Tests de validation de l'intensité ───────────────────────────────────────

describe('Validation de l\'intensité des symptômes', () => {
  /**
   * Pour tout symptôme de douleur, l'intensité doit être dans [1-5].
   *
   * Valide : Exigence 5.3
   */
  it('accepte les symptômes de douleur avec intensité valide [1-5]', () => {
    fc.assert(
      fc.property(
        arbitraryCalendarDate,
        arbitraryPainSymptom,
        (date, symptomData) => {
          const tracker = new SymptomTracker()
          const result = tracker.recordSymptom(date, symptomData)

          expect(result.ok).toBe(true)
          if (!result.ok) return

          expect(result.value.intensity).toBeGreaterThanOrEqual(1)
          expect(result.value.intensity).toBeLessThanOrEqual(5)
        },
      ),
      { numRuns: 200 },
    )
  })

  /**
   * Pour tout symptôme de douleur avec intensité < 1 ou > 5,
   * recordSymptom() doit retourner INVALID_SYMPTOM_INTENSITY.
   *
   * Valide : Exigence 5.3
   */
  it('rejette les symptômes de douleur avec intensité invalide', () => {
    fc.assert(
      fc.property(
        arbitraryCalendarDate,
        fc.constantFrom('cramps', 'headache', 'back_pain', 'breast_tenderness'),
        fc.integer().filter(i => i < 1 || i > 5),
        (date, type, intensity) => {
          const tracker = new SymptomTracker()
          const result = tracker.recordSymptom(date, {
            type: type as SymptomType,
            intensity,
          })

          expect(result.ok).toBe(false)
          if (result.ok) return

          expect(result.error.code).toBe('INVALID_SYMPTOM_INTENSITY')
        },
      ),
      { numRuns: 200 },
    )
  })

  /**
   * Pour tout symptôme de douleur sans intensité,
   * recordSymptom() doit retourner INVALID_SYMPTOM_INTENSITY.
   *
   * Valide : Exigence 5.3
   */
  it('rejette les symptômes de douleur sans intensité', () => {
    fc.assert(
      fc.property(
        arbitraryCalendarDate,
        fc.constantFrom('cramps', 'headache', 'back_pain', 'breast_tenderness'),
        (date, type) => {
          const tracker = new SymptomTracker()
          const result = tracker.recordSymptom(date, {
            type: type as SymptomType,
            intensity: undefined,
          })

          expect(result.ok).toBe(false)
          if (result.ok) return

          expect(result.error.code).toBe('INVALID_SYMPTOM_INTENSITY')
        },
      ),
      { numRuns: 100 },
    )
  })

  /**
   * Pour tout symptôme non-douleur, l'intensité doit être absente.
   *
   * Valide : Exigence 5.3
   */
  it('accepte les symptômes non-douleur sans intensité', () => {
    fc.assert(
      fc.property(
        arbitraryCalendarDate,
        arbitraryNonPainSymptom,
        (date, symptomData) => {
          const tracker = new SymptomTracker()
          const result = tracker.recordSymptom(date, symptomData)

          expect(result.ok).toBe(true)
          if (!result.ok) return

          expect(result.value.intensity).toBeNull()
        },
      ),
      { numRuns: 200 },
    )
  })

  /**
   * Pour tout symptôme non-douleur avec intensité fournie,
   * recordSymptom() doit retourner INVALID_SYMPTOM_INTENSITY.
   *
   * Valide : Exigence 5.3
   */
  it('rejette les symptômes non-douleur avec intensité', () => {
    fc.assert(
      fc.property(
        arbitraryCalendarDate,
        fc.constantFrom(
          'irritable',
          'anxious',
          'happy',
          'sad',
          'mood_swings',
          'high_energy',
          'low_energy',
          'fatigue',
          'bloating',
          'acne',
          'nausea',
          'food_cravings',
          'insomnia',
          'good_sleep',
          'restless_sleep',
        ),
        fc.integer({ min: 1, max: 5 }),
        (date, type, intensity) => {
          const tracker = new SymptomTracker()
          const result = tracker.recordSymptom(date, {
            type: type as SymptomType,
            intensity,
          })

          expect(result.ok).toBe(false)
          if (result.ok) return

          expect(result.error.code).toBe('INVALID_SYMPTOM_INTENSITY')
        },
      ),
      { numRuns: 200 },
    )
  })

  /**
   * La catégorie est correctement dérivée du type.
   *
   * Valide : Exigence 5.2
   */
  it('la catégorie est correctement dérivée du type de symptôme', () => {
    fc.assert(
      fc.property(
        arbitraryCalendarDate,
        arbitraryValidSymptom,
        (date, symptomData) => {
          const tracker = new SymptomTracker()
          const result = tracker.recordSymptom(date, symptomData)

          expect(result.ok).toBe(true)
          if (!result.ok) return

          const expectedCategory = SYMPTOM_TYPE_TO_CATEGORY[symptomData.type]
          expect(result.value.category).toBe(expectedCategory)
        },
      ),
      { numRuns: 200 },
    )
  })
})

// ─── Tests de gestion des symptômes ───────────────────────────────────────────

describe('Gestion des symptômes', () => {
  /**
   * deleteSymptom() supprime correctement un symptôme.
   *
   * Valide : Exigence 5.4
   */
  it('deleteSymptom() supprime le symptôme de tous les index', () => {
    fc.assert(
      fc.property(
        arbitraryCalendarDate,
        arbitraryValidSymptom,
        arbitraryCycleId,
        (date, symptomData, cycleId) => {
          const tracker = new SymptomTracker()
          const result = tracker.recordSymptom(date, symptomData, cycleId)

          if (!result.ok) return

          const symptomId = result.value.id

          // Supprimer le symptôme
          tracker.deleteSymptom(symptomId)

          // Ne doit plus apparaître nulle part
          expect(tracker.getSymptomsForDate(date).length).toBe(0)
          expect(tracker.getSymptomsForCycle(cycleId).length).toBe(0)
          expect(tracker.getAllSymptoms().some(s => s.id === symptomId)).toBe(false)
        },
      ),
      { numRuns: 100 },
    )
  })

  /**
   * getAllSymptoms() retourne tous les symptômes enregistrés.
   *
   * Valide : Exigence 5.4
   */
  it('getAllSymptoms() retourne tous les symptômes', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.tuple(arbitraryCalendarDate, arbitraryValidSymptom),
          { minLength: 1, maxLength: 20 },
        ),
        (symptomPairs) => {
          const tracker = new SymptomTracker()
          const recordedIds: string[] = []

          for (const [date, symptomData] of symptomPairs) {
            const result = tracker.recordSymptom(date, symptomData)
            if (result.ok) {
              recordedIds.push(result.value.id)
            }
          }

          const allSymptoms = tracker.getAllSymptoms()
          expect(allSymptoms.length).toBe(recordedIds.length)

          for (const id of recordedIds) {
            expect(allSymptoms.some(s => s.id === id)).toBe(true)
          }
        },
      ),
      { numRuns: 100 },
    )
  })

  /**
   * Les notes optionnelles sont correctement enregistrées.
   *
   * Valide : Exigence 5.1
   */
  it('les notes optionnelles sont correctement enregistrées', () => {
    fc.assert(
      fc.property(
        arbitraryCalendarDate,
        arbitraryValidSymptom,
        fc.string({ minLength: 1, maxLength: 200 }),
        (date, symptomData, notes) => {
          const tracker = new SymptomTracker()
          const result = tracker.recordSymptom(date, {
            ...symptomData,
            notes,
          })

          expect(result.ok).toBe(true)
          if (!result.ok) return

          expect(result.value.notes).toBe(notes)
        },
      ),
      { numRuns: 100 },
    )
  })

  /**
   * Un symptôme sans notes a notes = null.
   *
   * Valide : Exigence 5.1
   */
  it('un symptôme sans notes a notes = null', () => {
    fc.assert(
      fc.property(
        arbitraryCalendarDate,
        arbitraryValidSymptom,
        (date, symptomData) => {
          const tracker = new SymptomTracker()
          const result = tracker.recordSymptom(date, {
            ...symptomData,
            notes: undefined,
          })

          expect(result.ok).toBe(true)
          if (!result.ok) return

          expect(result.value.notes).toBeNull()
        },
      ),
      { numRuns: 100 },
    )
  })
})
