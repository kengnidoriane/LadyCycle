import type { SymptomType } from '../symptoms/types'

// ─── Types du domaine wellness ────────────────────────────────────────────────

/**
 * Phases du cycle menstruel.
 * Utilisées pour adapter les conseils de bien-être.
 */
export type CyclePhase = 'menstrual' | 'follicular' | 'ovulation' | 'luteal'

/**
 * Modes de suivi personnalisés.
 * Détermine le contexte d'utilisation et adapte les conseils.
 */
export type TrackingMode = 'general' | 'trying_to_conceive' | 'natural_contraception'

/**
 * Catégories de conseils de bien-être.
 */
export type AdviceCategory = 'nutrition' | 'exercise' | 'self_care' | 'medical'

/**
 * Niveau de priorité d'un conseil.
 */
export type AdvicePriority = 'low' | 'medium' | 'high'

// ─── Entité Advice ────────────────────────────────────────────────────────────

/**
 * Entité représentant un conseil de bien-être.
 *
 * Les conseils sont chargés depuis I18nService.loadWellnessContent() et filtrés
 * selon la phase du cycle, le mode de suivi et les symptômes récents.
 */
export interface Advice {
  /** Identifiant unique du conseil */
  id: string

  /** Catégorie du conseil */
  category: AdviceCategory

  /** Titre du conseil (traduit) */
  title: string

  /** Contenu détaillé du conseil (traduit) */
  content: string

  /** Phase du cycle à laquelle ce conseil s'applique */
  phase: CyclePhase

  /** Niveau de priorité pour l'affichage */
  priority: AdvicePriority
}

/**
 * Conseil de bien-être brut chargé depuis I18nService.
 * Contient les modes de suivi applicables (null = tous les modes).
 */
export interface PhaseAdvice {
  id: string
  category: AdviceCategory
  title: string
  content: string
  modes: TrackingMode[] | null
}

/**
 * Catalogue complet des conseils de bien-être, indexé par phase.
 * Chargé depuis I18nService.loadWellnessContent().
 */
export interface WellnessContent {
  phases: Record<CyclePhase, PhaseAdvice[]>
}

/**
 * Mapping des types de symptômes vers les conseils spécifiques.
 * Utilisé par getSymptomAdvice() pour fournir des conseils ciblés.
 */
export interface SymptomAdviceMapping {
  [symptomType: string]: string[] // IDs des conseils applicables
}
