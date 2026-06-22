/**
 * CycleCalendarGrid — grille calendrier mensuelle avec phases colorées.
 *
 * Chaque jour est teinté selon sa phase. Le jour courant est mis en évidence.
 * Couleurs issues du thème central (PHASE_META) — aucune valeur codée en dur.
 *
 * Exigences : 12.1, 12.3, 2.6
 */

import React, { useMemo } from 'react'
import { View, StyleSheet, TouchableOpacity } from 'react-native'
import type { Cycle } from '../../infrastructure/db/CycleRepository'
import type { PredictionResult } from '../../application/PredictNextCycleUseCase'
import type { CalendarDate } from '../../domain/shared/types'
import type { CyclePhase } from '../../domain/cycle/types'
import { getDayPhase } from './useCalendar'
import { AppText } from '../components'
import { colors, spacing, radii } from '../theme'
import { PHASE_META } from '../shared/phaseMeta'
import { useI18n } from '../i18n/I18nContext'

interface CycleCalendarGridProps {
  year: number
  month: number
  cycles: Cycle[]
  predictions: PredictionResult | null
  onDayPress?: (date: CalendarDate) => void
}

/** Noms de jours localisés (lundi → dimanche), abrégés. */
function localizedDayNames(locale: string): string[] {
  const fmt = new Intl.DateTimeFormat(locale, { weekday: 'short', timeZone: 'UTC' })
  // 2024-01-01 est un lundi (UTC) — on génère lun..dim
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(Date.UTC(2024, 0, 1 + i))
    const label = fmt.format(d).replace('.', '')
    return label.charAt(0).toUpperCase() + label.slice(1)
  })
}

/** Nom de mois localisé (1-12). */
function localizedMonthName(month: number, locale: string): string {
  const d = new Date(Date.UTC(2024, month - 1, 1))
  const label = new Intl.DateTimeFormat(locale, { month: 'long', timeZone: 'UTC' }).format(d)
  return label.charAt(0).toUpperCase() + label.slice(1)
}

function buildMonthGrid(year: number, month: number): Array<CalendarDate | null> {
  const firstDay = new Date(Date.UTC(year, month - 1, 1))
  const startOffset = (firstDay.getUTCDay() + 6) % 7
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const grid: Array<CalendarDate | null> = []
  for (let i = 0; i < startOffset; i++) grid.push(null)
  for (let d = 1; d <= daysInMonth; d++) {
    const mm = String(month).padStart(2, '0')
    const dd = String(d).padStart(2, '0')
    grid.push(`${year}-${mm}-${dd}`)
  }
  return grid
}

function getTodayDate(): CalendarDate {
  return new Date().toISOString().split('T')[0]
}

export function CycleCalendarGrid({
  year,
  month,
  cycles,
  predictions,
  onDayPress,
}: CycleCalendarGridProps): React.JSX.Element {
  const { currentLanguage } = useI18n()
  const locale = currentLanguage === 'en' ? 'en-GB' : 'fr-FR'
  const dayNames = useMemo(() => localizedDayNames(locale), [locale])
  const monthLabel = localizedMonthName(month, locale)

  const today = getTodayDate()
  const grid = useMemo(() => buildMonthGrid(year, month), [year, month])

  return (
    <View style={styles.container}>
      <AppText variant="h3" center style={styles.monthTitle}>
        {monthLabel} {year}
      </AppText>

      <View style={styles.dayNamesRow} accessibilityElementsHidden>
        {dayNames.map((name) => (
          <View key={name} style={styles.cell}>
            <AppText variant="tiny" tone="tertiary">
              {name}
            </AppText>
          </View>
        ))}
      </View>

      <View style={styles.grid}>
        {grid.map((date, index) => {
          if (date === null) {
            return <View key={`empty-${index}`} style={styles.cell} />
          }

          const phase = getDayPhase(date, cycles, predictions) as CyclePhase | null
          const meta = phase ? PHASE_META[phase] : null
          const isToday = date === today
          const dayNumber = parseInt(date.split('-')[2], 10)

          return (
            <TouchableOpacity
              key={date}
              activeOpacity={0.7}
              style={styles.cell}
              onPress={() => onDayPress?.(date)}
              accessibilityRole="button"
              accessibilityLabel={`${dayNumber} ${monthLabel}${isToday ? ", aujourd'hui" : ''}`}
            >
              <View
                style={[
                  styles.dayPill,
                  meta && { backgroundColor: meta.soft },
                  isToday && styles.todayPill,
                ]}
              >
                <AppText
                  variant="caption"
                  style={[
                    isToday && { color: colors.textInverse, fontWeight: '700' },
                    meta && !isToday && { color: meta.text },
                  ]}
                >
                  {dayNumber}
                </AppText>
              </View>
            </TouchableOpacity>
          )
        })}
      </View>

      <PhaseLegend />
    </View>
  )
}

function PhaseLegend(): React.JSX.Element {
  const { currentLanguage } = useI18n()
  const fr = currentLanguage !== 'en'
  const phases: Array<{ phase: CyclePhase; label: string }> = [
    { phase: 'menstrual', label: fr ? 'Règles' : 'Period' },
    { phase: 'follicular', label: fr ? 'Folliculaire' : 'Follicular' },
    { phase: 'ovulation', label: fr ? 'Féconde' : 'Fertile' },
    { phase: 'luteal', label: fr ? 'Lutéale' : 'Luteal' },
  ]

  return (
    <View style={styles.legend} accessibilityLabel="Légende des phases du cycle">
      {phases.map(({ phase, label }) => (
        <View key={phase} style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: PHASE_META[phase].main }]} />
          <AppText variant="tiny" tone="secondary">
            {label}
          </AppText>
        </View>
      ))}
    </View>
  )
}

const CELL_SIZE = 42
const PILL_SIZE = 36

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  monthTitle: {
    marginBottom: spacing.md,
  },
  dayNamesRow: {
    flexDirection: 'row',
    marginBottom: spacing.xs,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  cell: {
    width: `${100 / 7}%`,
    height: CELL_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayPill: {
    width: PILL_SIZE,
    height: PILL_SIZE,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  todayPill: {
    backgroundColor: colors.primary,
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: spacing.md,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  legendDot: {
    width: 9,
    height: 9,
    borderRadius: radii.pill,
  },
})
