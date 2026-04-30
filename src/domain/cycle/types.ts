import type { CalendarDate, UTCTimestamp, Option } from '../shared/types'

// ─── Phases du cycle ──────────────────────────────────────────────────────────

/**
 * Les quatre phases du cycle menstruel.
 * Utilisées pour associer les symptômes et les conseils de bien-être à une phase.
 */
export type CyclePhase = 'menstrual' | 'follicular' | 'ovulation' | 'luteal'

// ─── Entité Cycle ─────────────────────────────────────────────────────────────

/**
 * Entité principale représentant un cycle menstruel.
 *
 * En DDD, une entité a une identité unique : deux cycles avec les mêmes dates
 * mais des `id` différents sont des objets distincts.
 *
 * Conventions de dates :
 * - `startDate`, `endDate`, `menstruationEndDate` : CalendarDate (YYYY-MM-DD)
 *   indépendantes du fuseau horaire
 * - `createdAt`, `updatedAt` : UTCTimestamp pour les métadonnées système
 */
export interface Cycle {
  /** Identifiant unique UUID v4 */
  id: string

  /** Premier jour du cycle (premier jour des règles) — YYYY-MM-DD */
  startDate: CalendarDate

  /**
   * Dernier jour du cycle (veille des règles suivantes).
   * Absent si le cycle est en cours.
   */
  endDate: Option<CalendarDate>

  /**
   * Dernier jour des règles (fin de la menstruation).
   * Distinct de `endDate` qui marque la fin du cycle complet.
   */
  menstruationEndDate: Option<CalendarDate>

  /**
   * Durée totale du cycle en jours.
   * Absent si le cycle est en cours (endDate non renseignée).
   */
  duration: Option<number>

  /**
   * Durée de la menstruation en jours.
   * Absent si menstruationEndDate n'est pas renseignée.
   */
  menstruationDuration: Option<number>

  /**
   * Cycle marqué comme exceptionnel par l'utilisatrice (maladie, stress, etc.).
   * Les cycles exceptionnels sont exclus de TOUS les calculs de prédiction
   * et de statistiques, mais conservés dans l'historique.
   */
  isExceptional: boolean

  /** Raison optionnelle du marquage exceptionnel */
  exceptionalReason: Option<string>

  /** Prédictions calculées pour ce cycle */
  predictions: CyclePredictions

  /** Horodatage de création — UTCTimestamp */
  createdAt: UTCTimestamp

  /** Horodatage de dernière modification — UTCTimestamp */
  updatedAt: UTCTimestamp
}

/**
 * Prédictions associées à un cycle.
 * Regroupées dans un objet dédié pour faciliter la sérialisation.
 */
export interface CyclePredictions {
  ovulation: Option<Prediction<OvulationWindow>>
  nextPeriod: Option<Prediction<DateRange>>
}

// ─── Statistiques ─────────────────────────────────────────────────────────────

/**
 * Statistiques calculées sur l'historique des cycles.
 * Les cycles marqués `isExceptional = true` sont exclus de tous les calculs.
 */
export interface CycleStatistics {
  /** Durée moyenne du cycle en jours (cycles non exceptionnels uniquement) */
  averageCycleLength: number

  /** Durée moyenne des menstruations en jours (cycles non exceptionnels uniquement) */
  averageMenstruationLength: number

  /**
   * Régularité du cycle basée sur l'écart-type σ des durées :
   * - 'regular'      : σ < 3 jours
   * - 'irregular'    : 3 ≤ σ ≤ 7 jours
   * - 'very_irregular' : σ > 7 jours
   */
  cycleRegularity: 'regular' | 'irregular' | 'very_irregular'

  /** Écart-type des durées de cycle (cycles non exceptionnels uniquement) */
  standardDeviation: number

  /** Nombre total de cycles enregistrés (incluant les exceptionnels) */
  totalCyclesRecorded: number

  /** Nombre de cycles exceptionnels exclus des calculs */
  exceptionalCyclesExcluded: number
}

// ─── Prédictions ──────────────────────────────────────────────────────────────

/**
 * Conteneur générique pour une prédiction.
 *
 * `Prediction<OvulationWindow>` contient une fenêtre d'ovulation.
 * `Prediction<DateRange>` contient une plage de dates pour les prochaines règles.
 *
 * Analogue à `Promise<T>` ou `Array<T>` — un conteneur qui peut tenir
 * n'importe quel type de valeur prédite.
 */
export interface Prediction<T> {
  /** La valeur prédite */
  value: T

  /** Niveau de confiance et explication associés */
  confidence: ConfidenceResult

  /** Horodatage UTC du calcul */
  calculatedAt: UTCTimestamp
}

/**
 * Fenêtre d'ovulation prédite.
 *
 * `isBlurred` est toujours `true` : l'ovulation est biologiquement instable
 * et doit être affichée avec une zone de flou visuelle dans l'UI.
 */
export interface OvulationWindow {
  /** Date estimée de l'ovulation — YYYY-MM-DD */
  estimatedDate: CalendarDate

  /** Premier jour de la période féconde (ovulation - 5j) — YYYY-MM-DD */
  fertileWindowStart: CalendarDate

  /** Dernier jour de la période féconde (ovulation + 1j) — YYYY-MM-DD */
  fertileWindowEnd: CalendarDate

  /**
   * Toujours `true` — indique que l'ovulation doit être affichée avec
   * une zone de flou visuelle pour signaler son instabilité biologique.
   */
  isBlurred: true
}

/**
 * Plage de dates avec début et fin.
 * Value Object : deux DateRange avec les mêmes dates sont interchangeables.
 */
export interface DateRange {
  /** Date de début — YYYY-MM-DD */
  startDate: CalendarDate

  /** Date de fin — YYYY-MM-DD */
  endDate: CalendarDate
}

// ─── Niveau de confiance ──────────────────────────────────────────────────────

/**
 * Niveau de confiance d'une prédiction.
 * - 'low'    : < 3 cycles non exceptionnels, ou σ > 7 jours
 * - 'medium' : 3-5 cycles non exceptionnels, ou 3 ≤ σ ≤ 7 jours
 * - 'high'   : ≥ 6 cycles non exceptionnels ET σ < 3 jours
 */
export type ConfidenceLevel = 'low' | 'medium' | 'high'

/**
 * Résultat du calcul de confiance avec explication optionnelle.
 *
 * L'explication est fournie quand `level === 'low'` pour permettre à l'UI
 * d'afficher un message utile à l'utilisatrice (transparence algorithmique) :
 * - 'not_enough_data' : "Enregistrez encore X cycles pour améliorer la précision"
 * - 'too_irregular'   : "Votre cycle est trop irrégulier (σ > 7 jours)"
 */
export interface ConfidenceResult {
  /** Niveau de confiance calculé */
  level: ConfidenceLevel

  /**
   * Explication affichée à l'utilisatrice si `level === 'low'`.
   * `null` si le niveau est 'medium' ou 'high'.
   */
  explanation: Option<'not_enough_data' | 'too_irregular'>

  /**
   * Valeur de l'écart-type σ utilisé pour le calcul.
   * `null` si moins de 3 cycles non exceptionnels (σ non calculable).
   */
  standardDeviation: Option<number>
}
