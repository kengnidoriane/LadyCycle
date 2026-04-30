/**
 * Tests property-based pour les types partagés du domaine.
 *
 * Ces tests vérifient les invariants fondamentaux de :
 *   - Result<T, E> : ok/err helpers
 *   - Option<T>    : some/none helpers
 *   - CalendarDate : utilitaires de manipulation de dates
 *
 * Outil : fast-check (minimum 100 itérations par propriété)
 */

import * as fc from 'fast-check'
import { ok, err, some, none } from '../types'
import type { Result, Option } from '../types'
import {
  isValidCalendarDate,
  toCalendarDate,
  addDays,
  subtractDays,
  diffDays,
  isBefore,
  isAfterOrEqual,
  isSameDay,
  isInRange,
  today,
} from '../calendarDate'

// ─── Arbitraires réutilisables ────────────────────────────────────────────────

/**
 * Génère une CalendarDate valide au format YYYY-MM-DD.
 * Plage : 2000-01-01 → 2099-12-31 pour couvrir les cas réalistes.
 * On utilise fc.integer sur les timestamps pour éviter les dates NaN
 * que fc.date() peut générer lors du shrinking.
 */
const MIN_TS = new Date('2000-01-01T00:00:00Z').getTime()
const MAX_TS = new Date('2099-12-31T00:00:00Z').getTime()

const arbitraryCalendarDate = fc
  .integer({ min: MIN_TS, max: MAX_TS })
  .map(ts => new Date(ts).toISOString().split('T')[0])

/**
 * Génère une paire (start, end) où end >= start.
 */
const arbitraryDatePair = fc
  .tuple(arbitraryCalendarDate, fc.integer({ min: 0, max: 365 }))
  .map(([start, offset]) => ({
    start,
    end: addDays(start, offset),
    offset,
  }))

// ─── Tests : Result<T, E> ─────────────────────────────────────────────────────

describe('Result<T, E>', () => {
  it('ok() produit un résultat avec ok=true et la valeur correcte', () => {
    fc.assert(
      fc.property(fc.anything(), value => {
        const result: Result<unknown, never> = ok(value)
        expect(result.ok).toBe(true)
        if (result.ok) {
          expect(result.value).toBe(value)
        }
      }),
      { numRuns: 100 },
    )
  })

  it('err() produit un résultat avec ok=false et l\'erreur correcte', () => {
    fc.assert(
      fc.property(fc.string(), message => {
        const result: Result<never, string> = err(message)
        expect(result.ok).toBe(false)
        if (!result.ok) {
          expect(result.error).toBe(message)
        }
      }),
      { numRuns: 100 },
    )
  })

  it('ok() et err() sont mutuellement exclusifs', () => {
    fc.assert(
      fc.property(fc.anything(), fc.string(), (value, errorMsg) => {
        const success = ok(value)
        const failure = err(errorMsg)
        expect(success.ok).not.toBe(failure.ok)
      }),
      { numRuns: 100 },
    )
  })
})

// ─── Tests : Option<T> ────────────────────────────────────────────────────────

describe('Option<T>', () => {
  it('some() retourne la valeur telle quelle', () => {
    fc.assert(
      fc.property(fc.anything(), value => {
        const opt: Option<unknown> = some(value)
        expect(opt).toBe(value)
      }),
      { numRuns: 100 },
    )
  })

  it('none est null', () => {
    expect(none).toBeNull()
  })

  it('some(null) est distinguable de none uniquement si la valeur n\'est pas null', () => {
    // none est null — some(null) serait ambigu, mais c'est un cas limite documenté
    const opt = some('valeur')
    expect(opt).not.toBeNull()
  })
})

// ─── Tests : isValidCalendarDate ─────────────────────────────────────────────

describe('isValidCalendarDate()', () => {
  it('accepte toutes les dates YYYY-MM-DD valides générées', () => {
    fc.assert(
      fc.property(arbitraryCalendarDate, date => {
        expect(isValidCalendarDate(date)).toBe(true)
      }),
      { numRuns: 200 },
    )
  })

  it('rejette les strings qui ne sont pas au format YYYY-MM-DD', () => {
    const invalidFormats = [
      '15/01/2024',
      '2024.01.15',
      '20240115',
      '2024-1-15',
      '2024-01-5',
      'not-a-date',
      '',
      '2024-13-01', // mois invalide
      '2024-01-32', // jour invalide
    ]
    for (const invalid of invalidFormats) {
      expect(isValidCalendarDate(invalid)).toBe(false)
    }
  })
})

// ─── Tests : addDays / subtractDays ──────────────────────────────────────────

describe('addDays() / subtractDays()', () => {
  it('addDays(date, 0) retourne la même date', () => {
    fc.assert(
      fc.property(arbitraryCalendarDate, date => {
        expect(addDays(date, 0)).toBe(date)
      }),
      { numRuns: 200 },
    )
  })

  it('addDays(date, n) puis subtractDays retourne la date originale (inverse)', () => {
    fc.assert(
      fc.property(
        arbitraryCalendarDate,
        fc.integer({ min: -365, max: 365 }),
        (date, n) => {
          const shifted = addDays(date, n)
          const restored = subtractDays(shifted, n)
          expect(restored).toBe(date)
        },
      ),
      { numRuns: 200 },
    )
  })

  it('addDays(date, n) produit une date valide', () => {
    fc.assert(
      fc.property(
        arbitraryCalendarDate,
        fc.integer({ min: 0, max: 365 }),
        (date, n) => {
          const result = addDays(date, n)
          expect(isValidCalendarDate(result)).toBe(true)
        },
      ),
      { numRuns: 200 },
    )
  })
})

// ─── Tests : diffDays ────────────────────────────────────────────────────────

describe('diffDays()', () => {
  it('diffDays(date, date) === 0 (réflexivité)', () => {
    fc.assert(
      fc.property(arbitraryCalendarDate, date => {
        expect(diffDays(date, date)).toBe(0)
      }),
      { numRuns: 200 },
    )
  })

  it('diffDays(a, b) === -diffDays(b, a) (antisymétrie)', () => {
    fc.assert(
      fc.property(arbitraryDatePair, ({ start, end }) => {
        const forward = diffDays(start, end)
        const backward = diffDays(end, start)
        // Cas particulier : 0 et -0 sont égaux en valeur mais pas avec toBe
        expect(forward + backward).toBe(0)
      }),
      { numRuns: 200 },
    )
  })

  it('diffDays(start, addDays(start, n)) === n', () => {
    fc.assert(
      fc.property(
        arbitraryCalendarDate,
        fc.integer({ min: 0, max: 365 }),
        (date, n) => {
          const future = addDays(date, n)
          expect(diffDays(date, future)).toBe(n)
        },
      ),
      { numRuns: 200 },
    )
  })
})

// ─── Tests : isBefore / isAfterOrEqual ───────────────────────────────────────

describe('isBefore() / isAfterOrEqual()', () => {
  it('isBefore(a, b) est vrai si et seulement si diffDays(a, b) > 0', () => {
    fc.assert(
      fc.property(arbitraryDatePair, ({ start, end, offset }) => {
        if (offset > 0) {
          expect(isBefore(start, end)).toBe(true)
          expect(isBefore(end, start)).toBe(false)
        } else {
          // offset === 0 → même date
          expect(isBefore(start, end)).toBe(false)
        }
      }),
      { numRuns: 200 },
    )
  })

  it('isAfterOrEqual(date, date) est toujours vrai (réflexivité)', () => {
    fc.assert(
      fc.property(arbitraryCalendarDate, date => {
        expect(isAfterOrEqual(date, date)).toBe(true)
      }),
      { numRuns: 200 },
    )
  })

  it('isBefore(a, b) implique isAfterOrEqual(b, a)', () => {
    fc.assert(
      fc.property(arbitraryDatePair, ({ start, end, offset }) => {
        if (offset > 0) {
          expect(isBefore(start, end)).toBe(true)
          expect(isAfterOrEqual(end, start)).toBe(true)
        }
      }),
      { numRuns: 200 },
    )
  })
})

// ─── Tests : isSameDay ───────────────────────────────────────────────────────

describe('isSameDay()', () => {
  it('isSameDay(date, date) est toujours vrai', () => {
    fc.assert(
      fc.property(arbitraryCalendarDate, date => {
        expect(isSameDay(date, date)).toBe(true)
      }),
      { numRuns: 200 },
    )
  })

  it('isSameDay(a, b) est faux si a !== b', () => {
    fc.assert(
      fc.property(arbitraryDatePair, ({ start, end, offset }) => {
        if (offset > 0) {
          expect(isSameDay(start, end)).toBe(false)
        }
      }),
      { numRuns: 200 },
    )
  })
})

// ─── Tests : isInRange ───────────────────────────────────────────────────────

describe('isInRange()', () => {
  it('start et end sont toujours dans leur propre plage', () => {
    fc.assert(
      fc.property(arbitraryDatePair, ({ start, end }) => {
        expect(isInRange(start, start, end)).toBe(true)
        expect(isInRange(end, start, end)).toBe(true)
      }),
      { numRuns: 200 },
    )
  })

  it('une date avant start n\'est pas dans la plage', () => {
    fc.assert(
      fc.property(
        arbitraryCalendarDate,
        fc.integer({ min: 1, max: 30 }),
        fc.integer({ min: 1, max: 30 }),
        (base, before, rangeLen) => {
          const start = addDays(base, before)
          const end = addDays(start, rangeLen)
          expect(isInRange(base, start, end)).toBe(false)
        },
      ),
      { numRuns: 200 },
    )
  })

  it('une date après end n\'est pas dans la plage', () => {
    fc.assert(
      fc.property(
        arbitraryCalendarDate,
        fc.integer({ min: 1, max: 30 }),
        fc.integer({ min: 1, max: 30 }),
        (start, rangeLen, after) => {
          const end = addDays(start, rangeLen)
          const outside = addDays(end, after)
          expect(isInRange(outside, start, end)).toBe(false)
        },
      ),
      { numRuns: 200 },
    )
  })
})

// ─── Tests : today() ─────────────────────────────────────────────────────────

describe('today()', () => {
  it('retourne une CalendarDate valide', () => {
    const t = today()
    expect(isValidCalendarDate(t)).toBe(true)
  })

  it('retourne une date au format YYYY-MM-DD', () => {
    const t = today()
    expect(t).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})

// ─── Tests : toCalendarDate ───────────────────────────────────────────────────

describe('toCalendarDate()', () => {
  it('convertit un objet Date en CalendarDate valide', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: MIN_TS, max: MAX_TS }).map(ts => new Date(ts)),
        date => {
          const result = toCalendarDate(date)
          expect(isValidCalendarDate(result)).toBe(true)
        },
      ),
      { numRuns: 200 },
    )
  })

  it('le résultat est au format YYYY-MM-DD', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: MIN_TS, max: MAX_TS }).map(ts => new Date(ts)),
        date => {
          const result = toCalendarDate(date)
          expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/)
        },
      ),
      { numRuns: 200 },
    )
  })
})
