import type { CalendarDate, UTCTimestamp, Option } from '../shared/types'
import type { CyclePhase } from '../cycle/types'

// ─── Catégories de symptômes ──────────────────────────────────────────────────

/**
 * Catégories de symptômes.
 * Utilisées pour regrouper les symptômes et déterminer si l'intensité est requise.
 */
export type SymptomCategory = 'pain' | 'mood' | 'energy' | 'physical' | 'sleep'

// ─── Types de symptômes ───────────────────────────────────────────────────────

/**
 * Types de symptômes spécifiques.
 * Chaque type appartient à une catégorie.
 */
export type SymptomType =
  // Douleurs (pain)
  | 'cramps'
  | 'headache'
  | 'back_pain'
  | 'breast_tenderness'
  // Humeur (mood)
  | 'irritable'
  | 'anxious'
  | 'happy'
  | 'sad'
  | 'mood_swings'
  // Énergie (energy)
  | 'high_energy'
  | 'low_energy'
  | 'fatigue'
  // Physique (physical)
  | 'bloating'
  | 'acne'
  | 'nausea'
  | 'food_cravings'
  // Sommeil (sleep)
  | 'insomnia'
  | 'good_sleep'
  | 'restless_sleep'

// ─── Mapping type → catégorie ─────────────────────────────────────────────────

/**
 * Mapping des types de symptômes vers leurs catégories.
 * Utilisé pour la validation de l'intensité.
 */
export const SYMPTOM_TYPE_TO_CATEGORY: Record<SymptomType, SymptomCategory> = {
  // Douleurs
  cramps: 'pain',
  headache: 'pain',
  back_pain: 'pain',
  breast_tenderness: 'pain',
  // Humeur
  irritable: 'mood',
  anxious: 'mood',
  happy: 'mood',
  sad: 'mood',
  mood_swings: 'mood',
  // Énergie
  high_energy: 'energy',
  low_energy: 'energy',
  fatigue: 'energy',
  // Physique
  bloating: 'physical',
  acne: 'physical',
  nausea: 'physical',
  food_cravings: 'physical',
  // Sommeil
  insomnia: 'sleep',
  good_sleep: 'sleep',
  restless_sleep: 'sleep',
}

// ─── Entité Symptom ───────────────────────────────────────────────────────────

/**
 * Entité représentant un symptôme enregistré.
 *
 * Règle de validation conditionnelle :
 * - Si category === 'pain', intensity DOIT être définie et dans [1-5]
 * - Si category !== 'pain', intensity DOIT être undefined ou null
 */
export interface Symptom {
  /** Identifiant unique UUID v4 */
  id: string

  /** Date du symptôme — YYYY-MM-DD */
  date: CalendarDate

  /** Type spécifique du symptôme */
  type: SymptomType

  /** Catégorie du symptôme (dérivée du type) */
  category: SymptomCategory

  /**
   * Intensité du symptôme (1-5).
   * OBLIGATOIRE pour category === 'pain', INTERDIT pour les autres catégories.
   */
  intensity: Option<number>

  /** Notes optionnelles de l'utilisatrice */
  notes: Option<string>

  /** Horodatage de création — UTCTimestamp */
  createdAt: UTCTimestamp
}

// ─── Tendances de symptômes ───────────────────────────────────────────────────

/**
 * Analyse des tendances d'un symptôme sur plusieurs cycles.
 */
export interface SymptomTrend {
  /** Type de symptôme analysé */
  symptomType: SymptomType

  /**
   * Intensité moyenne (pour les symptômes de douleur uniquement).
   * 0 pour les symptômes sans intensité.
   */
  averageIntensity: number

  /** Phases du cycle où ce symptôme est le plus fréquent */
  commonPhases: CyclePhase[]

  /** Fréquence d'apparition (pourcentage de cycles où ce symptôme apparaît) */
  frequency: number
}
