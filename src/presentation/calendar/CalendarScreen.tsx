/**
 * CalendarScreen — vue calendrier mensuelle du cycle.
 *
 * Onglet secondaire (l'accueil reste l'écran phare). Affiche la grille mensuelle
 * colorée par phase, la phase courante et les prédictions détaillées.
 *
 * Exigences : 12.1, 12.2, 12.3, 12.4, 2.6
 */

import React, { useState } from 'react'
import { View, StyleSheet, ActivityIndicator, TouchableOpacity, Modal } from 'react-native'
import { useCalendar } from './useCalendar'
import { CycleCalendarGrid } from './CycleCalendarGrid'
import { OvulationBlurZone } from './OvulationBlurZone'
import { RecordPeriodForm } from './RecordPeriodForm'
import { useI18n } from '../i18n/I18nContext'
import { Screen, AppText, Card, Button, Icon, Badge } from '../components'
import { colors, spacing, radii } from '../theme'
import { PHASE_META, confidenceMeta } from '../shared/phaseMeta'
import type { CalendarDate } from '../../domain/shared/types'

function formatDate(date: string, lang: string): string {
  const [year, month, day] = date.split('-').map(Number)
  const d = new Date(Date.UTC(year, month - 1, day))
  return d.toLocaleDateString(lang === 'en' ? 'en-GB' : 'fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

export function CalendarScreen(): React.JSX.Element {
  const { predictions, cycles, isLoading, error, refresh } = useCalendar()
  const { t, currentLanguage } = useI18n()
  const lang = currentLanguage === 'en' ? 'en' : 'fr'

  const now = new Date()
  const [displayYear, setDisplayYear] = useState(now.getUTCFullYear())
  const [displayMonth, setDisplayMonth] = useState(now.getUTCMonth() + 1)
  const [showRecordForm, setShowRecordForm] = useState(false)
  const [selectedDate, setSelectedDate] = useState<CalendarDate | null>(null)

  function goToPreviousMonth(): void {
    if (displayMonth === 1) {
      setDisplayMonth(12)
      setDisplayYear((y) => y - 1)
    } else {
      setDisplayMonth((m) => m - 1)
    }
  }

  function goToNextMonth(): void {
    if (displayMonth === 12) {
      setDisplayMonth(1)
      setDisplayYear((y) => y + 1)
    } else {
      setDisplayMonth((m) => m + 1)
    }
  }

  function handleDayPress(date: CalendarDate): void {
    setSelectedDate(date)
    setShowRecordForm(true)
  }

  function handleRecordSuccess(): void {
    setShowRecordForm(false)
    setSelectedDate(null)
    refresh()
  }

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    )
  }

  if (error !== null) {
    return (
      <Screen scroll={false} contentStyle={styles.centered}>
        <AppText variant="body" tone="secondary" center>
          {error}
        </AppText>
        <View style={{ height: spacing.lg }} />
        <Button label={t('common.retry')} onPress={refresh} fullWidth={false} />
      </Screen>
    )
  }

  const currentPhase = predictions?.currentPhase ?? null
  const phaseMeta = currentPhase ? PHASE_META[currentPhase] : null
  const hasNoCycles = cycles.length === 0

  return (
    <Screen>
      <AppText variant="h1" style={styles.title} accessibilityRole="header">
        {t('calendar.title')}
      </AppText>

      {/* Phase courante */}
      {!hasNoCycles && phaseMeta && currentPhase && (
        <Card tint={phaseMeta.soft} accent={phaseMeta.main} style={styles.phaseCard}>
          <View style={styles.phaseHeader}>
            <Icon name={phaseMeta.icon} size={18} color={phaseMeta.text} />
            <AppText variant="bodyStrong" style={{ color: phaseMeta.text }}>
              {t(phaseMeta.labelKey)}
            </AppText>
          </View>
          <AppText variant="caption" style={{ color: phaseMeta.text, opacity: 0.9 }}>
            {t(phaseMeta.descKey)}
          </AppText>
        </Card>
      )}

      {/* Navigation mensuelle */}
      <View style={styles.monthNav}>
        <TouchableOpacity
          onPress={goToPreviousMonth}
          style={styles.navButton}
          accessibilityRole="button"
          accessibilityLabel={lang === 'fr' ? 'Mois précédent' : 'Previous month'}
        >
          <Icon name="chevronLeft" size={22} color={colors.textSecondary} />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={goToNextMonth}
          style={styles.navButton}
          accessibilityRole="button"
          accessibilityLabel={lang === 'fr' ? 'Mois suivant' : 'Next month'}
        >
          <Icon name="chevronRight" size={22} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      <CycleCalendarGrid
        year={displayYear}
        month={displayMonth}
        cycles={cycles}
        predictions={predictions}
        onDayPress={handleDayPress}
      />

      {/* Prédictions */}
      {!hasNoCycles && predictions !== null && (
        <View style={styles.predictions}>
          <AppText variant="h3" style={styles.sectionTitle}>
            {lang === 'fr' ? 'Prédictions' : 'Predictions'}
          </AppText>

          <Card
            tint={colors.phase.menstrual.soft}
            accent={colors.phase.menstrual.main}
            style={styles.predCard}
          >
            <View style={styles.phaseHeader}>
              <Icon name="droplet" size={18} color={colors.phase.menstrual.text} />
              <AppText variant="caption" style={{ color: colors.phase.menstrual.text }}>
                {t('predictions.nextPeriod')}
              </AppText>
            </View>
            <AppText variant="h2" style={{ color: colors.phase.menstrual.text }}>
              {formatDate(predictions.nextPeriod.value.startDate, lang)}
            </AppText>
            <View style={styles.confBadge}>
              <Badge
                label={
                  CONF_LABEL[predictions.nextPeriod.confidence.level][lang]
                }
                color={confidenceMeta(predictions.nextPeriod.confidence.level).text}
                background={colors.surface}
              />
            </View>
          </Card>

          <OvulationBlurZone
            ovulation={predictions.ovulation.value}
            confidence={predictions.ovulation.confidence}
            lang={lang}
          />
        </View>
      )}

      {/* Action */}
      <Button
        label={
          hasNoCycles
            ? lang === 'fr'
              ? 'Enregistrer mes premières règles'
              : 'Log my first period'
            : lang === 'fr'
            ? 'Enregistrer mes règles'
            : 'Log my period'
        }
        icon="plus"
        onPress={() => setShowRecordForm(true)}
        style={styles.recordCta}
      />

      <Modal
        visible={showRecordForm}
        animationType="slide"
        transparent
        onRequestClose={() => setShowRecordForm(false)}
      >
        <View style={styles.modalOverlay}>
          <RecordPeriodForm
            initialStartDate={selectedDate}
            onSuccess={handleRecordSuccess}
            onCancel={() => {
              setShowRecordForm(false)
              setSelectedDate(null)
            }}
          />
        </View>
      </Modal>
    </Screen>
  )
}

const CONF_LABEL: Record<string, Record<'fr' | 'en', string>> = {
  low: { fr: 'Confiance faible', en: 'Low confidence' },
  medium: { fr: 'Confiance moyenne', en: 'Medium confidence' },
  high: { fr: 'Confiance élevée', en: 'High confidence' },
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    marginBottom: spacing.lg,
  },
  phaseCard: {
    marginBottom: spacing.lg,
  },
  phaseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  monthNav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  navButton: {
    width: 40,
    height: 40,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  predictions: {
    marginTop: spacing.xl,
  },
  sectionTitle: {
    marginBottom: spacing.md,
  },
  predCard: {
    marginBottom: spacing.md,
  },
  confBadge: {
    flexDirection: 'row',
    marginTop: spacing.sm,
  },
  recordCta: {
    marginTop: spacing.xl,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
})
