/**
 * CalendarDate — date au format YYYY-MM-DD, indépendante du fuseau horaire.
 * Utilisée pour toutes les dates de cycle, symptômes et prédictions.
 *
 * Pourquoi pas `Date` ? Un objet `Date` JavaScript dépend du fuseau horaire
 * de l'appareil. Une utilisatrice qui voyage de Paris à New York pourrait voir
 * ses dates décalées d'un jour. En stockant "2024-01-15" comme string, ce
 * problème disparaît complètement.
 */
export type CalendarDate = string // ex: "2024-01-15"

/**
 * UTCTimestamp — horodatage ISO 8601 UTC précis.
 * Réservé aux logs système : heure exacte de prise de médicament, created_at,
 * updated_at. Jamais utilisé pour les dates de cycle.
 */
export type UTCTimestamp = string // ex: "2024-01-15T10:30:00Z"

/**
 * Langues supportées par l'application.
 * Le français est la langue par défaut si la langue système n'est pas supportée.
 */
export type SupportedLanguage = 'fr' | 'en'

/**
 * Result<T, E> — type de retour pour les opérations qui peuvent échouer.
 *
 * Pourquoi pas `throw` ? Le compilateur TypeScript t'oblige à gérer les deux
 * cas (succès et erreur) quand tu utilises Result. Avec throw, une erreur non
 * gérée peut planter l'app silencieusement.
 *
 * Usage :
 *   const result = cycleManager.recordMenstruation(start, end)
 *   if (result.ok) {
 *     console.log(result.value) // Cycle
 *   } else {
 *     console.error(result.error) // ValidationError
 *   }
 */
export type Result<T, E> =
  | { ok: true; value: T }
  | { ok: false; error: E }

/**
 * Option<T> — valeur qui peut être présente ou absente.
 * Remplace `T | null | undefined` de façon explicite.
 */
export type Option<T> = T | null

// ─── Helpers pour créer des Result ───────────────────────────────────────────

export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value }
}

export function err<E>(error: E): Result<never, E> {
  return { ok: false, error }
}

export function some<T>(value: T): Option<T> {
  return value
}

export const none: Option<never> = null
