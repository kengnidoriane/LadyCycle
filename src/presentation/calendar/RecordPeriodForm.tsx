/**
 * RecordPeriodForm — enregistrement d'une menstruation par sélection de plage.
 *
 * UX intuitive : on touche le premier jour de ses règles sur le calendrier, puis
 * le dernier — la plage se remplit visuellement. Un raccourci « Aujourd'hui »
 * couvre le cas le plus courant (mes règles ont commencé aujourd'hui).
 *
 * Plus de saisie au format AAAA-MM-JJ, plus de double bouton « Today ».
 *
 * Exigences : 1.1, 1.2, 1.3, 12.2
 */

import React, { useState } from 'react'
import { View, StyleSheet, TouchableOpacity } from 'react-native'
import { RecordPeriodUseCase } from '../../application/RecordPeriodUseCase'
import { sharedRepository } from './useCalendar'
import type { CalendarDate } from '../../domain/shared/types'
import { today as todayDate, diffDays } from '../../domain/shared/calendarDate'
import { AppText, Button, Icon } from '../components'
import { colors, spacing, radii } from '../theme'
import { useI18n } from '../i18n/I18nContext'

interface RecordPeriodFormProps {
  initialStartDate?: CalendarDate | null
  onSuccess: () => void
  onCancel: () => void
}

export function RecordPeriodForm({
  initialStartDate,
  onSuccess,
  onCancel,
}: RecordPeriodFormProps): React.JSX.Element {
  const { currentLanguage } = useI18n()
  const fr = currentLanguage !== 'en'
  const locale = fr ? 'fr-FR' : 'en-GB'
  const today = todayDate()

  const [startDate, setStartDate] = useState<CalendarDate | null>(initialStartDate ?? null)
  const [endDate, setEndDate] = useState<CalendarDate | null>(initialStartDate ?? null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Mois affiché dans le calendrier
  const initial = initialStartDate ?? today
  const [displayYear, setDisplayYear] = useState(Number(initial.slice(0, 4)))
  const [displayMonth, setDisplayMonth] = useState(Number(initial.slice(5, 7)))

  // ── Sélection de plage ──────────────────────────────────────────────────────

  function handleDayPress(date: CalendarDate): void {
    if (date > today) return // pas de règles dans le futur
    setError(null)

    // Aucun début, ou plage déjà complète, ou clic avant le début → nouveau début
    if (startDate === null || endDate !== startDate || date < startDate) {
      setStartDate(date)
      setEndDate(date)
    } else {
      // Un seul jour sélectionné, on étend jusqu'à `date`
      setEndDate(date)
    }
  }

  function selectToday(): void {
    setError(null)
    setStartDate(today)
    setEndDate(today)
    setDisplayYear(Number(today.slice(0, 4)))
    setDisplayMonth(Number(today.slice(5, 7)))
  }

  function goPrevMonth(): void {
    if (displayMonth === 1) {
      setDisplayMonth(12)
      setDisplayYear((y) => y - 1)
    } else setDisplayMonth((m) => m - 1)
  }

  function goNextMonth(): void {
    if (displayMonth === 12) {
      setDisplayMonth(1)
      setDisplayYear((y) => y + 1)
    } else setDisplayMonth((m) => m + 1)
  }

  // ── Soumission ──────────────────────────────────────────────────────────────

  async function handleSubmit(): Promise<void> {
    if (startDate === null) {
      setError(fr ? 'Sélectionne au moins le premier jour de tes règles.' : 'Select at least the first day of your period.')
      return
    }
    const finalEnd = endDate ?? startDate
    setIsSubmitting(true)
    setError(null)
    try {
      const useCase = new RecordPeriodUseCase(sharedRepository)
      const result = await useCase.execute(startDate, finalEnd)
      if (result.ok) {
        onSuccess()
      } else {
        setError(result.error.message || (fr ? 'Une erreur est survenue. Réessaie.' : 'An error occurred. Please try again.'))
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : fr ? 'Une erreur inattendue est survenue.' : 'An unexpected error occurred.')
    } finally {
      setIsSubmitting(false)
    }
  }

  // ── Résumé ──────────────────────────────────────────────────────────────────

  const durationDays =
    startDate !== null && endDate !== null ? diffDays(startDate, endDate) + 1 : 0
  const summary =
    startDate !== null
      ? durationDays === 1
        ? fr ? `${formatDay(startDate, locale)} · 1 jour` : `${formatDay(startDate, locale)} · 1 day`
        : fr
        ? `${formatDay(startDate, locale)} → ${formatDay(endDate!, locale)} · ${durationDays} jours`
        : `${formatDay(startDate, locale)} → ${formatDay(endDate!, locale)} · ${durationDays} days`
      : null

  return (
    <View style={styles.container}>
      <View style={styles.grabber} />

      {/* En-tête */}
      <View style={styles.header}>
        <AppText variant="h3" accessibilityRole="header">
          {fr ? 'Enregistrer mes règles' : 'Log my period'}
        </AppText>
        <TouchableOpacity
          onPress={onCancel}
          style={styles.closeButton}
          accessibilityRole="button"
          accessibilityLabel={fr ? 'Annuler' : 'Cancel'}
          disabled={isSubmitting}
        >
          <Icon name="close" size={22} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      <View style={styles.body}>
        <AppText variant="caption" tone="secondary" style={styles.instruction}>
          {fr
            ? 'Touche le premier puis le dernier jour de tes règles.'
            : 'Tap the first then the last day of your period.'}
        </AppText>

        {/* Raccourci aujourd'hui */}
        <TouchableOpacity
          style={[styles.todayChip, startDate === today && endDate === today && styles.todayChipActive]}
          activeOpacity={0.7}
          onPress={selectToday}
          accessibilityRole="button"
          accessibilityLabel={fr ? "Mes règles ont commencé aujourd'hui" : 'My period started today'}
        >
          <Icon
            name="droplet"
            size={16}
            color={startDate === today && endDate === today ? colors.textInverse : colors.primaryDark}
          />
          <AppText
            variant="caption"
            style={{
              color: startDate === today && endDate === today ? colors.textInverse : colors.primaryDark,
              fontWeight: '600',
            }}
          >
            {fr ? "Commencé aujourd'hui" : 'Started today'}
          </AppText>
        </TouchableOpacity>

        {/* Calendrier */}
        <RangeCalendar
          year={displayYear}
          month={displayMonth}
          start={startDate}
          end={endDate}
          today={today}
          locale={locale}
          onPrev={goPrevMonth}
          onNext={goNextMonth}
          onDayPress={handleDayPress}
        />

        {/* Résumé de la sélection */}
        {summary !== null && (
          <View style={styles.summary}>
            <Icon name="droplet" size={16} color={colors.phase.menstrual.text} />
            <AppText variant="bodyStrong" style={{ color: colors.phase.menstrual.text }}>
              {summary}
            </AppText>
          </View>
        )}

        {error !== null && (
          <View style={styles.errorBox} accessibilityRole="alert">
            <AppText variant="caption" style={{ color: colors.confidence.low.text }}>
              {error}
            </AppText>
          </View>
        )}

        <Button
          label={fr ? 'Enregistrer' : 'Save'}
          icon="check"
          onPress={handleSubmit}
          loading={isSubmitting}
          disabled={startDate === null || isSubmitting}
          style={styles.save}
        />
      </View>
    </View>
  )
}

// ─── Calendrier à sélection de plage ──────────────────────────────────────────

interface RangeCalendarProps {
  year: number
  month: number
  start: CalendarDate | null
  end: CalendarDate | null
  today: CalendarDate
  locale: string
  onPrev: () => void
  onNext: () => void
  onDayPress: (date: CalendarDate) => void
}

function RangeCalendar({
  year,
  month,
  start,
  end,
  today,
  locale,
  onPrev,
  onNext,
  onDayPress,
}: RangeCalendarProps): React.JSX.Element {
  const grid = buildMonthGrid(year, month)
  const dayNames = localizedDayNames(locale)
  const monthLabel = capitalize(
    new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString(locale, {
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    }),
  )

  return (
    <View style={styles.calendar}>
      <View style={styles.monthNav}>
        <TouchableOpacity onPress={onPrev} style={styles.navBtn} accessibilityRole="button" accessibilityLabel="Previous month">
          <Icon name="chevronLeft" size={20} color={colors.textSecondary} />
        </TouchableOpacity>
        <AppText variant="bodyStrong">{monthLabel}</AppText>
        <TouchableOpacity onPress={onNext} style={styles.navBtn} accessibilityRole="button" accessibilityLabel="Next month">
          <Icon name="chevronRight" size={20} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      <View style={styles.weekRow}>
        {dayNames.map((d, i) => (
          <View key={i} style={styles.cell}>
            <AppText variant="tiny" tone="tertiary">
              {d}
            </AppText>
          </View>
        ))}
      </View>

      <View style={styles.grid}>
        {grid.map((date, index) => {
          if (date === null) return <View key={`e-${index}`} style={styles.cell} />

          const isFuture = date > today
          const isStart = date === start
          const isEnd = date === end
          const inRange = start !== null && end !== null && date >= start && date <= end
          const isToday = date === today
          const dayNum = Number(date.slice(8, 10))

          return (
            <View key={date} style={styles.cell}>
              <TouchableOpacity
                activeOpacity={isFuture ? 1 : 0.7}
                disabled={isFuture}
                onPress={() => onDayPress(date)}
                accessibilityRole="button"
                accessibilityState={{ selected: inRange, disabled: isFuture }}
                style={[
                  styles.dayPill,
                  inRange && styles.dayInRange,
                  (isStart || isEnd) && styles.dayEndpoint,
                  isToday && !inRange && styles.dayToday,
                ]}
              >
                <AppText
                  variant="caption"
                  style={[
                    isFuture && { color: colors.borderStrong },
                    inRange && !(isStart || isEnd) && { color: colors.primaryDark },
                    (isStart || isEnd) && { color: colors.textInverse, fontWeight: '700' },
                  ]}
                >
                  {dayNum}
                </AppText>
              </TouchableOpacity>
            </View>
          )
        })}
      </View>
    </View>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildMonthGrid(year: number, month: number): Array<CalendarDate | null> {
  const firstDay = new Date(Date.UTC(year, month - 1, 1))
  const startOffset = (firstDay.getUTCDay() + 6) % 7
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const grid: Array<CalendarDate | null> = []
  for (let i = 0; i < startOffset; i++) grid.push(null)
  for (let d = 1; d <= daysInMonth; d++) {
    grid.push(`${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`)
  }
  return grid
}

function localizedDayNames(locale: string): string[] {
  const fmt = new Intl.DateTimeFormat(locale, { weekday: 'narrow', timeZone: 'UTC' })
  return Array.from({ length: 7 }, (_, i) => capitalize(fmt.format(new Date(Date.UTC(2024, 0, 1 + i)))))
}

function formatDay(date: CalendarDate, locale: string): string {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString(locale, {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  })
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const CELL = 40
const PILL = 34

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.xxl,
    borderTopRightRadius: radii.xxl,
    paddingTop: spacing.sm,
  },
  grabber: {
    width: 40,
    height: 4,
    borderRadius: radii.pill,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginBottom: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  closeButton: {
    padding: spacing.sm,
  },
  body: {
    padding: spacing.xl,
  },
  instruction: {
    marginBottom: spacing.md,
    lineHeight: 18,
  },
  todayChip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.primaryMuted,
    backgroundColor: colors.primarySoft,
    marginBottom: spacing.lg,
  },
  todayChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  calendar: {
    backgroundColor: colors.background,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  navBtn: {
    width: 36,
    height: 36,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  weekRow: {
    flexDirection: 'row',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  cell: {
    width: `${100 / 7}%`,
    height: CELL,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayPill: {
    width: PILL,
    height: PILL,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayInRange: {
    backgroundColor: colors.primarySoft,
  },
  dayEndpoint: {
    backgroundColor: colors.primary,
  },
  dayToday: {
    borderWidth: 1.5,
    borderColor: colors.primaryMuted,
  },
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.phase.menstrual.soft,
    borderRadius: radii.md,
    padding: spacing.md,
    marginTop: spacing.lg,
  },
  errorBox: {
    backgroundColor: colors.dangerSoft,
    borderRadius: radii.sm,
    padding: spacing.md,
    marginTop: spacing.md,
    borderLeftWidth: 3,
    borderLeftColor: colors.danger,
  },
  save: {
    marginTop: spacing.lg,
  },
})
