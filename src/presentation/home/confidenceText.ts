/**
 * confidenceText — génère le texte localisé du message de progression de confiance.
 *
 * Séparé du calcul (cycleSummary) car le service i18n ne gère pas l'interpolation
 * de variables. On compose ici la phrase complète selon la langue.
 *
 * C'est le texte qui incarne la signature de LadyCycle : rendre la montée en
 * fiabilité de l'algorithme honnête et gratifiante.
 */

import type { ConfidenceMessage } from './cycleSummary'
import type { SupportedLanguage } from '../../domain/shared/types'

export interface ConfidenceCopy {
  /** Titre court (ex: « Précision en hausse »). */
  title: string
  /** Détail (ex: « Encore 2 cycles pour une confiance élevée »). */
  detail: string
}

export function confidenceCopy(
  message: ConfidenceMessage,
  lang: SupportedLanguage,
): ConfidenceCopy {
  const fr = lang === 'fr'
  const { kind, validCycleCount, cyclesToNextTier } = message

  if (kind === 'reached') {
    return fr
      ? {
          title: 'Fiabilité maximale',
          detail:
            'Tes prédictions sont au plus haut niveau de confiance. L’algorithme te connaît bien.',
        }
      : {
          title: 'Maximum reliability',
          detail:
            'Your predictions are at the highest confidence level. The algorithm knows you well.',
        }
  }

  if (kind === 'irregular') {
    return fr
      ? {
          title: 'Cycle irrégulier',
          detail:
            'Tes cycles varient beaucoup — les prédictions restent indicatives, sans fausse précision.',
        }
      : {
          title: 'Irregular cycle',
          detail:
            'Your cycles vary a lot — predictions stay indicative, with no false precision.',
        }
  }

  // kind === 'progress'
  if (cyclesToNextTier > 0) {
    const n = cyclesToNextTier
    if (fr) {
      const cycleWord = n === 1 ? 'cycle' : 'cycles'
      return {
        title: 'Précision en hausse',
        detail: `Encore ${n} ${cycleWord} et tes prédictions gagneront en fiabilité.`,
      }
    }
    const cycleWord = n === 1 ? 'cycle' : 'cycles'
    return {
      title: 'Precision improving',
      detail: `${n} more ${cycleWord} and your predictions will get more reliable.`,
    }
  }

  // Progression sans palier explicite (≥ 6 cycles mais confiance moyenne)
  return fr
    ? {
        title: 'Précision en hausse',
        detail: `Avec ${validCycleCount} cycles enregistrés, la précision continue de s’affiner.`,
      }
    : {
        title: 'Precision improving',
        detail: `With ${validCycleCount} cycles logged, precision keeps refining.`,
      }
}
