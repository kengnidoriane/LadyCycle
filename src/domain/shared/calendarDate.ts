import type { CalendarDate } from './types'

/**
 * Utilitaires pour manipuler les CalendarDate (YYYY-MM-DD).
 *
 * Règle d'or : toujours forcer UTC avec 'T00:00:00Z' lors de la conversion
 * depuis un objet Date. Sans ça, un fuseau horaire négatif (ex: UTC-5) peut
 * décaler la date d'un jour.
 */

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/

/**
 * Vérifie qu'une string est au format YYYY-MM-DD valide.
 */
export function isValidCalendarDate(value: string): value is CalendarDate {
  if (!DATE_REGEX.test(value)) return false
  const d = new Date(value + 'T00:00:00Z')
  return !isNaN(d.getTime())
}

/**
 * Convertit un objet Date en CalendarDate YYYY-MM-DD (en UTC).
 * Exemple : new Date('2024-01-15T23:00:00-05:00') → "2024-01-16"
 */
export function toCalendarDate(date: Date): CalendarDate {
  return date.toISOString().split('T')[0]
}

/**
 * Retourne la date d'aujourd'hui en CalendarDate.
 */
export function today(): CalendarDate {
  return toCalendarDate(new Date())
}

/**
 * Ajoute n jours à une CalendarDate.
 * Exemple : addDays("2024-01-15", 14) → "2024-01-29"
 */
export function addDays(date: CalendarDate, n: number): CalendarDate {
  const d = new Date(date + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + n)
  return toCalendarDate(d)
}

/**
 * Soustrait n jours à une CalendarDate.
 * Exemple : subtractDays("2024-01-29", 14) → "2024-01-15"
 */
export function subtractDays(date: CalendarDate, n: number): CalendarDate {
  return addDays(date, -n)
}

/**
 * Calcule la différence en jours entre deux CalendarDate.
 * Retourne un nombre positif si b > a, négatif si b < a.
 * Exemple : diffDays("2024-01-15", "2024-01-20") → 5
 */
export function diffDays(a: CalendarDate, b: CalendarDate): number {
  const dateA = new Date(a + 'T00:00:00Z')
  const dateB = new Date(b + 'T00:00:00Z')
  const msPerDay = 1000 * 60 * 60 * 24
  return Math.round((dateB.getTime() - dateA.getTime()) / msPerDay)
}

/**
 * Vérifie si a est strictement avant b.
 */
export function isBefore(a: CalendarDate, b: CalendarDate): boolean {
  return diffDays(a, b) > 0
}

/**
 * Vérifie si a est après ou égal à b.
 */
export function isAfterOrEqual(a: CalendarDate, b: CalendarDate): boolean {
  return diffDays(b, a) >= 0
}

/**
 * Vérifie si a est égal à b.
 */
export function isSameDay(a: CalendarDate, b: CalendarDate): boolean {
  return a === b
}

/**
 * Vérifie si une date est comprise dans un intervalle [start, end] inclus.
 */
export function isInRange(
  date: CalendarDate,
  start: CalendarDate,
  end: CalendarDate,
): boolean {
  return isAfterOrEqual(date, start) && isAfterOrEqual(end, date)
}
