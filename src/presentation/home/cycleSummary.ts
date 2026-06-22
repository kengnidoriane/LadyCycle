/**
 * cycleSummary — dérive les données d'affichage de l'écran d'accueil.
 *
 * Fonction pure (aucune dépendance UI/infra) : à partir des prédictions et de
 * l'historique, calcule le jour de cycle, la progression de l'anneau, le compte
 * à rebours et — surtout — le message de progression de la confiance.
 *
 * Ce dernier est la signature de LadyCycle : transformer la collecte de données
 * en progression honnête et gratifiante (« Encore 2 cycles pour une confiance
 * élevée »), au lieu de cacher l'incertitude.
 */

import { diffDays, today as todayDate } from '../../domain/shared/calendarDate'
import type { CalendarDate } from '../../domain/shared/types'
import type { Cycle } from '../../infrastructure/db/CycleRepository'
import type { PredictionResult } from '../../application/PredictNextCycleUseCase'
import type { CyclePhase, ConfidenceLevel } from '../../domain/cycle/types'

export interface CycleSummary {
  /** Numéro du jour dans le cycle courant (1 = premier jour des règles). */
  cycleDay: number
  /** Progression de l'anneau, 0 à 1. */
  progress: number
  /** Jours restants avant les prochaines règles (négatif si en retard). */
  daysUntilNextPeriod: number
  /** Date de début des prochaines règles. */
  nextPeriodStart: CalendarDate
  /** Phase courante. */
  phase: CyclePhase
  /** Niveau de confiance de la prédiction. */
  confidence: ConfidenceLevel
  /**
   * Message de progression honnête de l'algorithme.
   * Pilote la « montée en fiabilité » visible par l'utilisatrice.
   */
  confidenceMessage: ConfidenceMessage
  /** Vrai si la période féconde est en cours aujourd'hui. */
  isFertileToday: boolean
}

export interface ConfidenceMessage {
  /** 'progress' = en route vers une meilleure confiance ; 'reached' = au max ; 'irregular' = trop irrégulier. */
  kind: 'progress' | 'reached' | 'irregular'
  /** Nombre de cycles non exceptionnels enregistrés. */
  validCycleCount: number
  /** Cycles supplémentaires nécessaires pour le palier suivant (0 si atteint). */
  cyclesToNextTier: number
}

const MIN_FOR_MEDIUM = 3
const MIN_FOR_HIGH = 6

/**
 * Compte les cycles non exceptionnels avec une durée connue (ceux qui comptent
 * réellement pour l'algorithme de prédiction).
 */
function countValidCycles(cycles: Cycle[]): number {
  return cycles.filter(c => !c.isExceptional && c.duration !== null).length
}

/**
 * Construit le message de progression de la confiance.
 */
function buildConfidenceMessage(
  cycles: Cycle[],
  confidence: ConfidenceLevel,
  explanation: 'not_enough_data' | 'too_irregular' | null,
): ConfidenceMessage {
  const validCycleCount = countValidCycles(cycles)

  if (explanation === 'too_irregular') {
    return { kind: 'irregular', validCycleCount, cyclesToNextTier: 0 }
  }

  if (validCycleCount < MIN_FOR_MEDIUM) {
    return {
      kind: 'progress',
      validCycleCount,
      cyclesToNextTier: MIN_FOR_MEDIUM - validCycleCount,
    }
  }

  if (validCycleCount < MIN_FOR_HIGH) {
    return {
      kind: 'progress',
      validCycleCount,
      cyclesToNextTier: MIN_FOR_HIGH - validCycleCount,
    }
  }

  // ≥ 6 cycles et confiance élevée atteinte
  if (confidence === 'high') {
    return { kind: 'reached', validCycleCount, cyclesToNextTier: 0 }
  }

  // ≥ 6 cycles mais confiance moyenne (légère irrégularité)
  return { kind: 'progress', validCycleCount, cyclesToNextTier: 0 }
}

/**
 * Calcule le résumé d'accueil. Retourne `null` si aucun cycle n'est connu.
 */
export function computeCycleSummary(
  predictions: PredictionResult | null,
  cycles: Cycle[],
  now: CalendarDate = todayDate(),
): CycleSummary | null {
  if (predictions === null || cycles.length === 0) {
    return null
  }

  // Cycle courant = celui dont la date de début est la plus récente
  const lastStart = cycles
    .map(c => c.startDate)
    .sort((a, b) => b.localeCompare(a))[0]

  const nextPeriodStart = predictions.nextPeriod.value.startDate
  const cycleLength = Math.max(1, diffDays(lastStart, nextPeriodStart))
  const elapsed = diffDays(lastStart, now)

  const cycleDay = Math.max(1, elapsed + 1)
  const progress = Math.max(0, Math.min(1, elapsed / cycleLength))
  const daysUntilNextPeriod = diffDays(now, nextPeriodStart)

  const confidence = predictions.nextPeriod.confidence
  const fertileStart = predictions.ovulation.value.fertileWindowStart
  const fertileEnd = predictions.ovulation.value.fertileWindowEnd
  const isFertileToday =
    diffDays(fertileStart, now) >= 0 && diffDays(now, fertileEnd) >= 0

  return {
    cycleDay,
    progress,
    daysUntilNextPeriod,
    nextPeriodStart,
    phase: predictions.currentPhase,
    confidence: confidence.level,
    confidenceMessage: buildConfidenceMessage(
      cycles,
      confidence.level,
      confidence.explanation,
    ),
    isFertileToday,
  }
}
