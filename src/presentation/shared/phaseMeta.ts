/**
 * phaseMeta — métadonnées d'affichage des phases du cycle.
 *
 * Source unique pour la couleur, l'icône et la clé i18n de chaque phase.
 * Évite la duplication des couleurs de phase dans les écrans.
 */

import { colors } from '../theme'
import type { IconName } from '../components'
import type { CyclePhase } from '../../domain/cycle/types'

export interface PhaseMeta {
  /** Couleur principale (trait, accent). */
  main: string
  /** Fond clair teinté. */
  soft: string
  /** Couleur de texte foncée sur fond teinté. */
  text: string
  /** Icône représentative. */
  icon: IconName
  /** Clé i18n du libellé (ex: 'calendar.phases.menstrual'). */
  labelKey: string
  /** Clé i18n de la description. */
  descKey: string
}

export const PHASE_META: Record<CyclePhase, PhaseMeta> = {
  menstrual: {
    ...colors.phase.menstrual,
    icon: 'droplet',
    labelKey: 'calendar.phases.menstrual',
    descKey: 'phase.desc.menstrual',
  },
  follicular: {
    ...colors.phase.follicular,
    icon: 'leaf',
    labelKey: 'calendar.phases.follicular',
    descKey: 'phase.desc.follicular',
  },
  ovulation: {
    ...colors.phase.ovulation,
    icon: 'flower',
    labelKey: 'calendar.phases.ovulation',
    descKey: 'phase.desc.ovulation',
  },
  luteal: {
    ...colors.phase.luteal,
    icon: 'moon',
    labelKey: 'calendar.phases.luteal',
    descKey: 'phase.desc.luteal',
  },
}

/** Métadonnées de couleur d'un niveau de confiance. */
export function confidenceMeta(level: 'low' | 'medium' | 'high') {
  return colors.confidence[level]
}
