/**
 * Tests property-based pour WellnessAdvisor.
 *
 * Propriétés testées :
 * - Propriété 30 : Conseils adaptés à la phase du cycle
 * - Propriété 31 : Conseils adaptés au mode de suivi pendant l'ovulation
 *
 * Exigences : 11.1, 11.2, 11.3, 11.4, 11.5
 */

import * as fc from 'fast-check'
import { WellnessAdvisor } from '../WellnessAdvisor'
import type {
  CyclePhase,
  PhaseAdvice,
  TrackingMode,
  WellnessContent,
} from '../types'
import type { Symptom } from '../../symptoms/types'

// ─── Générateurs fast-check ───────────────────────────────────────────────────

/**
 * Générateur de CyclePhase.
 */
const cyclePhaseArb: fc.Arbitrary<CyclePhase> = fc.constantFrom(
  'menstrual',
  'follicular',
  'ovulation',
  'luteal',
)

/**
 * Générateur de TrackingMode.
 */
const trackingModeArb: fc.Arbitrary<TrackingMode> = fc.constantFrom(
  'general',
  'trying_to_conceive',
  'natural_contraception',
)

/**
 * Générateur de PhaseAdvice.
 */
const phaseAdviceArb: fc.Arbitrary<PhaseAdvice> = fc.record({
  id: fc.uuid(),
  category: fc.constantFrom('nutrition', 'exercise', 'self_care', 'medical'),
  title: fc.string({ minLength: 5, maxLength: 50 }),
  content: fc.string({ minLength: 20, maxLength: 200 }),
  modes: fc.oneof(
    fc.constant(null), // Applicable à tous les modes
    fc.array(trackingModeArb, { minLength: 1, maxLength: 3 }), // Modes spécifiques
  ),
})

/**
 * Générateur de WellnessContent avec au moins un conseil par phase.
 */
const wellnessContentArb: fc.Arbitrary<WellnessContent> = fc.record({
  phases: fc.record({
    menstrual: fc.array(phaseAdviceArb, { minLength: 1, maxLength: 5 }),
    follicular: fc.array(phaseAdviceArb, { minLength: 1, maxLength: 5 }),
    ovulation: fc.array(phaseAdviceArb, { minLength: 1, maxLength: 5 }),
    luteal: fc.array(phaseAdviceArb, { minLength: 1, maxLength: 5 }),
  }),
})

/**
 * Générateur de Symptom (simplifié pour les tests).
 */
const symptomArb: fc.Arbitrary<Symptom> = fc.record({
  id: fc.uuid(),
  date: fc
    .date({ min: new Date('2024-01-01'), max: new Date('2024-12-31') })
    .map((d) => d.toISOString().split('T')[0]),
  type: fc.constantFrom('cramps', 'headache', 'fatigue', 'mood_swings'),
  category: fc.constantFrom('pain', 'mood', 'energy'),
  intensity: fc.option(fc.integer({ min: 1, max: 5 }), { nil: null }),
  notes: fc.option(fc.string({ maxLength: 100 }), { nil: null }),
  createdAt: fc.date().map((d) => d.toISOString()),
})

// ─── Tests de propriété ───────────────────────────────────────────────────────

describe('WellnessAdvisor — Property-Based Tests', () => {
  // ── Propriété 30 : Conseils adaptés à la phase du cycle ──────────────────────

  test('Property 30: getDailyAdvice returns advice specific to the current phase', () => {
    fc.assert(
      fc.property(
        wellnessContentArb,
        cyclePhaseArb,
        trackingModeArb,
        fc.array(symptomArb, { maxLength: 5 }),
        (content, phase, mode, symptoms) => {
          const advisor = new WellnessAdvisor(content)
          const advice = advisor.getDailyAdvice(phase, mode, symptoms)

          // Tous les conseils retournés doivent être pour la phase actuelle
          for (const a of advice) {
            expect(a.phase).toBe(phase)
          }

          // Il doit y avoir au moins un conseil si le contenu en contient pour cette phase
          const phaseAdvices = content.phases[phase] || []
          const applicableAdvices = phaseAdvices.filter(
            (pa) => pa.modes === null || pa.modes.includes(mode),
          )
          if (applicableAdvices.length > 0) {
            expect(advice.length).toBeGreaterThan(0)
          }
        },
      ),
      { numRuns: 100 },
    )
  })

  test('Property 30: Each phase returns advice when applicable to the mode', () => {
    fc.assert(
      fc.property(wellnessContentArb, cyclePhaseArb, trackingModeArb, (content, phase, mode) => {
        const advisor = new WellnessAdvisor(content)
        const advice = advisor.getDailyAdvice(phase, mode, [])

        // Vérifier que tous les conseils retournés sont applicables au mode
        const phaseAdvices = content.phases[phase] || []
        const applicableAdvices = phaseAdvices.filter(
          (pa) => pa.modes === null || pa.modes.includes(mode),
        )

        // Si des conseils applicables existent, ils doivent être retournés
        if (applicableAdvices.length > 0) {
          expect(advice.length).toBe(applicableAdvices.length)
        } else {
          // Sinon, aucun conseil ne doit être retourné
          expect(advice.length).toBe(0)
        }
      }),
      { numRuns: 100 },
    )
  })

  // ── Propriété 31 : Conseils adaptés au mode pendant l'ovulation ──────────────

  test('Property 31: Ovulation advice varies by tracking mode', () => {
    fc.assert(
      fc.property(
        fc.record({
          phases: fc.record({
            menstrual: fc.constant([]),
            follicular: fc.constant([]),
            ovulation: fc.tuple(
              // Conseil pour "trying_to_conceive"
              fc.record({
                id: fc.constant('ovulation_ttc'),
                category: fc.constant('nutrition' as const),
                title: fc.constant('Conception advice'),
                content: fc.constant('Advice for trying to conceive'),
                modes: fc.constant(['trying_to_conceive'] as TrackingMode[]),
              }),
              // Conseil pour "natural_contraception"
              fc.record({
                id: fc.constant('ovulation_nc'),
                category: fc.constant('medical' as const),
                title: fc.constant('Contraception warning'),
                content: fc.constant('High risk period'),
                modes: fc.constant(['natural_contraception'] as TrackingMode[]),
              }),
              // Conseil général (tous modes)
              fc.record({
                id: fc.constant('ovulation_general'),
                category: fc.constant('self_care' as const),
                title: fc.constant('General ovulation info'),
                content: fc.constant('General information'),
                modes: fc.constant(null),
              }),
            ),
            luteal: fc.constant([]),
          }),
        }),
        (content) => {
          const advisor = new WellnessAdvisor(content)

          // Mode "trying_to_conceive" doit inclure le conseil TTC + général
          const ttcAdvice = advisor.getDailyAdvice('ovulation', 'trying_to_conceive', [])
          expect(ttcAdvice.some((a) => a.id === 'ovulation_ttc')).toBe(true)
          expect(ttcAdvice.some((a) => a.id === 'ovulation_general')).toBe(true)
          expect(ttcAdvice.some((a) => a.id === 'ovulation_nc')).toBe(false)

          // Mode "natural_contraception" doit inclure le conseil NC + général
          const ncAdvice = advisor.getDailyAdvice(
            'ovulation',
            'natural_contraception',
            [],
          )
          expect(ncAdvice.some((a) => a.id === 'ovulation_nc')).toBe(true)
          expect(ncAdvice.some((a) => a.id === 'ovulation_general')).toBe(true)
          expect(ncAdvice.some((a) => a.id === 'ovulation_ttc')).toBe(false)

          // Mode "general" doit inclure uniquement le conseil général
          const generalAdvice = advisor.getDailyAdvice('ovulation', 'general', [])
          expect(generalAdvice.some((a) => a.id === 'ovulation_general')).toBe(true)
          expect(generalAdvice.some((a) => a.id === 'ovulation_ttc')).toBe(false)
          expect(generalAdvice.some((a) => a.id === 'ovulation_nc')).toBe(false)
        },
      ),
      { numRuns: 100 },
    )
  })

  // ── Tests additionnels : Priorité et symptômes ────────────────────────────────

  test('Advice is sorted by priority (high > medium > low)', () => {
    fc.assert(
      fc.property(wellnessContentArb, cyclePhaseArb, trackingModeArb, (content, phase, mode) => {
        const advisor = new WellnessAdvisor(content)
        const advice = advisor.getDailyAdvice(phase, mode, [])

        // Vérifier que les conseils sont triés par priorité
        for (let i = 0; i < advice.length - 1; i++) {
          const currentPriority = advice[i].priority
          const nextPriority = advice[i + 1].priority

          const order = { high: 0, medium: 1, low: 2 }
          expect(order[currentPriority]).toBeLessThanOrEqual(order[nextPriority])
        }
      }),
      { numRuns: 100 },
    )
  })

  test('getSymptomAdvice returns relevant advice for a symptom', () => {
    const content: WellnessContent = {
      phases: {
        menstrual: [
          {
            id: 'cramps_relief',
            category: 'medical',
            title: 'Cramps Relief',
            content: 'Advice for managing cramps during menstruation',
            modes: null,
          },
        ],
        follicular: [],
        ovulation: [],
        luteal: [],
      },
    }

    const advisor = new WellnessAdvisor(content)
    const advice = advisor.getSymptomAdvice('cramps')

    // Le conseil doit être retourné car il mentionne "cramps"
    expect(advice.length).toBeGreaterThan(0)
    expect(advice[0].id).toBe('cramps_relief')
    expect(advice[0].priority).toBe('high') // Priorité haute pour les conseils symptômes
  })

  test('getSymptomAdvice returns empty array if no relevant advice', () => {
    const content: WellnessContent = {
      phases: {
        menstrual: [
          {
            id: 'general_nutrition',
            category: 'nutrition',
            title: 'Nutrition Tips',
            content: 'General nutrition advice',
            modes: null,
          },
        ],
        follicular: [],
        ovulation: [],
        luteal: [],
      },
    }

    const advisor = new WellnessAdvisor(content)
    const advice = advisor.getSymptomAdvice('cramps')

    // Aucun conseil ne mentionne "cramps"
    expect(advice.length).toBe(0)
  })
})
