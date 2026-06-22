/**
 * Tests de computeCycleSummary + confidenceCopy.
 *
 * Verrouille la signature de LadyCycle : la progression honnête de la confiance
 * (« encore N cycles pour gagner en fiabilité ») et le calcul du jour de cycle.
 */

import { computeCycleSummary } from '../cycleSummary'
import { confidenceCopy } from '../confidenceText'
import type { Cycle } from '../../../infrastructure/db/CycleRepository'
import type { PredictionResult } from '../../../application/PredictNextCycleUseCase'

// ─── Helpers de construction ──────────────────────────────────────────────────

function makeCycle(startDate: string, opts: Partial<Cycle> = {}): Cycle {
  return {
    startDate,
    endDate: null,
    duration: 28,
    isExceptional: false,
    ...opts,
  } as unknown as Cycle
}

function makePredictions(
  nextPeriodStart: string,
  level: 'low' | 'medium' | 'high',
  explanation: 'not_enough_data' | 'too_irregular' | null = null,
): PredictionResult {
  const confidence = { level, explanation, standardDeviation: null }
  return {
    currentPhase: 'follicular',
    nextPeriod: {
      value: { startDate: nextPeriodStart, endDate: nextPeriodStart },
      confidence,
      calculatedAt: '2026-06-01T00:00:00.000Z',
    },
    ovulation: {
      value: {
        estimatedDate: '2026-06-15',
        fertileWindowStart: '2026-06-10',
        fertileWindowEnd: '2026-06-16',
        isBlurred: true,
      },
      confidence,
      calculatedAt: '2026-06-01T00:00:00.000Z',
    },
    ovulationIsBlurred: true,
  }
}

// ─── computeCycleSummary ──────────────────────────────────────────────────────

describe('computeCycleSummary', () => {
  it('retourne null sans cycle ni prédiction', () => {
    expect(computeCycleSummary(null, [])).toBeNull()
    expect(computeCycleSummary(makePredictions('2026-07-01', 'low'), [])).toBeNull()
  })

  it('calcule le jour de cycle et le compte à rebours', () => {
    const cycles = [makeCycle('2026-06-01')]
    const predictions = makePredictions('2026-06-29', 'medium')
    const summary = computeCycleSummary(predictions, cycles, '2026-06-10')

    expect(summary).not.toBeNull()
    expect(summary!.cycleDay).toBe(10) // 1er → 10 juin = jour 10
    expect(summary!.daysUntilNextPeriod).toBe(19) // 10 → 29 juin
    expect(summary!.progress).toBeGreaterThan(0)
    expect(summary!.progress).toBeLessThanOrEqual(1)
  })

  it('détecte la période féconde du jour', () => {
    const cycles = [makeCycle('2026-06-01')]
    const predictions = makePredictions('2026-06-29', 'high')
    const summary = computeCycleSummary(predictions, cycles, '2026-06-12')
    expect(summary!.isFertileToday).toBe(true)
  })

  it('signature : indique combien de cycles manquent pour le palier suivant', () => {
    // 2 cycles valides → il en manque 1 pour atteindre le palier moyen (3)
    const cycles = [makeCycle('2026-04-01'), makeCycle('2026-05-01')]
    const predictions = makePredictions('2026-06-29', 'low')
    const summary = computeCycleSummary(predictions, cycles, '2026-06-10')

    expect(summary!.confidenceMessage.kind).toBe('progress')
    expect(summary!.confidenceMessage.validCycleCount).toBe(2)
    expect(summary!.confidenceMessage.cyclesToNextTier).toBe(1)
  })

  it('signature : confiance maximale atteinte à ≥ 6 cycles réguliers', () => {
    const cycles = Array.from({ length: 6 }, (_, i) =>
      makeCycle(`2026-0${i + 1}-01`),
    )
    const predictions = makePredictions('2026-07-29', 'high')
    const summary = computeCycleSummary(predictions, cycles, '2026-07-10')
    expect(summary!.confidenceMessage.kind).toBe('reached')
  })

  it('exclut les cycles exceptionnels du décompte', () => {
    const cycles = [
      makeCycle('2026-04-01'),
      makeCycle('2026-05-01', { isExceptional: true }),
    ]
    const predictions = makePredictions('2026-06-29', 'low')
    const summary = computeCycleSummary(predictions, cycles, '2026-06-10')
    expect(summary!.confidenceMessage.validCycleCount).toBe(1)
  })
})

// ─── confidenceCopy ───────────────────────────────────────────────────────────

describe('confidenceCopy', () => {
  it('formule le message de progression au singulier et pluriel', () => {
    const one = confidenceCopy(
      { kind: 'progress', validCycleCount: 2, cyclesToNextTier: 1 },
      'fr',
    )
    expect(one.detail).toContain('1 cycle ')

    const many = confidenceCopy(
      { kind: 'progress', validCycleCount: 1, cyclesToNextTier: 2 },
      'fr',
    )
    expect(many.detail).toContain('2 cycles')
  })

  it('annonce la fiabilité maximale', () => {
    const copy = confidenceCopy(
      { kind: 'reached', validCycleCount: 6, cyclesToNextTier: 0 },
      'fr',
    )
    expect(copy.title).toBe('Fiabilité maximale')
  })

  it('assume honnêtement un cycle irrégulier', () => {
    const copy = confidenceCopy(
      { kind: 'irregular', validCycleCount: 8, cyclesToNextTier: 0 },
      'fr',
    )
    expect(copy.title).toBe('Cycle irrégulier')
  })
})
