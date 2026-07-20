/**
 * HomeScreen — écran d'accueil « Aujourd'hui ».
 *
 * Écran phare du redesign. D'un coup d'œil :
 *   - où en suis-je dans mon cycle (anneau + jour + phase)
 *   - dans combien de temps mes prochaines règles
 *   - la fiabilité actuelle de l'algorithme, présentée honnêtement
 *
 * Minimalisme radical : une seule intention par zone, beaucoup de calme visuel.
 * L'anneau se « précise » à mesure que la confiance monte (signature LadyCycle).
 */

import React, { useState } from 'react'
import { View, StyleSheet, ActivityIndicator, Modal, TouchableOpacity } from 'react-native'
import { useCalendar } from '../calendar/useCalendar'
import { useI18n } from '../i18n/I18nContext'
import {
  Screen,
  AppText,
  RingProgress,
  Button,
  Card,
  Badge,
  StatTile,
  Icon,
} from '../components'
import { colors, spacing, radii } from '../theme'
import { PHASE_META, confidenceMeta } from '../shared/phaseMeta'
import { computeCycleSummary } from './cycleSummary'
import { confidenceCopy } from './confidenceText'
import { RecordPeriodForm } from '../calendar/RecordPeriodForm'
import { SymptomForm } from '../calendar/SymptomForm'
import { WellnessScreen } from '../wellness/WellnessScreen'
import type { CalendarDate } from '../../domain/shared/types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatLongDate(lang: string): string {
  const d = new Date()
  return d.toLocaleDateString(lang === 'en' ? 'en-GB' : 'fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
}

function formatShortDate(date: CalendarDate, lang: string): string {
  const [y, m, day] = date.split('-').map(Number)
  const d = new Date(Date.UTC(y, m - 1, day))
  return d.toLocaleDateString(lang === 'en' ? 'en-GB' : 'fr-FR', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  })
}

const CONF_LABEL: Record<string, Record<'fr' | 'en', string>> = {
  low: { fr: 'Faible', en: 'Low' },
  medium: { fr: 'Moyenne', en: 'Medium' },
  high: { fr: 'Élevée', en: 'High' },
}

// ─── Composant ────────────────────────────────────────────────────────────────

interface HomeScreenProps {
  /** Bascule vers un autre onglet (ex: la cloche ouvre les Réglages). */
  onOpenSettings?: () => void
}

export function HomeScreen({ onOpenSettings }: HomeScreenProps = {}): React.JSX.Element {
  const { predictions, cycles, isLoading, error, refresh } = useCalendar()
  const { t, currentLanguage } = useI18n()

  const [showRecordForm, setShowRecordForm] = useState(false)
  const [showSymptomForm, setShowSymptomForm] = useState(false)
  const [showWellness, setShowWellness] = useState(false)

  const summary = computeCycleSummary(predictions, cycles)

  function handleRecordSuccess(): void {
    setShowRecordForm(false)
    refresh()
  }

  // ── États de chargement / erreur ──────────────────────────────────────────
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

  const lang = currentLanguage === 'en' ? 'en' : 'fr'

  return (
    <Screen>
      {/* ── En-tête ─────────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <View>
          <AppText variant="caption" tone="secondary">
            {lang === 'fr' ? 'Bonjour' : 'Hello'}
          </AppText>
          <AppText variant="h2" style={styles.dateText}>
            {formatLongDate(lang)}
          </AppText>
        </View>
        <TouchableOpacity
          style={styles.bell}
          activeOpacity={0.7}
          onPress={onOpenSettings}
          accessibilityRole="button"
          accessibilityLabel={lang === 'fr' ? 'Notifications et réglages' : 'Notifications and settings'}
        >
          <Icon name="bell" size={20} color={colors.primaryDark} />
        </TouchableOpacity>
      </View>

      {summary === null ? (
        <EmptyHome lang={lang} onRecord={() => setShowRecordForm(true)} />
      ) : (
        <>
          {/* ── Anneau de cycle ───────────────────────────────────────── */}
          <View style={styles.ringWrap}>
            <RingProgress
              progress={summary.progress}
              confidence={summary.confidence}
              color={PHASE_META[summary.phase].main}
            >
              <RingCenter
                cycleDay={summary.cycleDay}
                phaseLabel={t(PHASE_META[summary.phase].labelKey)}
                phaseColor={PHASE_META[summary.phase].text}
                daysUntil={summary.daysUntilNextPeriod}
                lang={lang}
              />
            </RingProgress>
          </View>

          {/* ── Période féconde du jour ───────────────────────────────── */}
          {summary.isFertileToday && (
            <View style={styles.fertileRow}>
              <Badge
                label={lang === 'fr' ? 'Période féconde aujourd’hui' : 'Fertile window today'}
                icon="flower"
                color={colors.fertile.text}
                background={colors.fertile.soft}
              />
            </View>
          )}

          {/* ── Carte signature : progression de la confiance ─────────── */}
          <ConfidenceCard summary={summary} lang={lang} />

          {/* ── Action principale ─────────────────────────────────────── */}
          <Button
            label={lang === 'fr' ? 'Enregistrer aujourd’hui' : 'Log today'}
            icon="plus"
            onPress={() => setShowRecordForm(true)}
            style={styles.cta}
          />

          {/* ── Actions secondaires discrètes ─────────────────────────── */}
          <View style={styles.quickRow}>
            <QuickAction
              icon="heart"
              label={lang === 'fr' ? 'Symptôme' : 'Symptom'}
              onPress={() => setShowSymptomForm(true)}
            />
            <QuickAction
              icon="leaf"
              label={lang === 'fr' ? 'Bien-être' : 'Wellness'}
              onPress={() => setShowWellness(true)}
            />
          </View>

          {/* ── Tuiles statistiques ───────────────────────────────────── */}
          <View style={styles.tiles}>
            <StatTile
              icon="droplet"
              iconColor={colors.phase.menstrual.main}
              label={t('predictions.nextPeriod')}
              value={formatShortDate(summary.nextPeriodStart, lang)}
            />
            <StatTile
              icon="chart"
              iconColor={confidenceMeta(summary.confidence).main}
              label={lang === 'fr' ? 'Confiance' : 'Confidence'}
              value={CONF_LABEL[summary.confidence][lang]}
            />
          </View>
        </>
      )}

      {/* ── Formulaire d'enregistrement ─────────────────────────────────── */}
      <Modal
        visible={showRecordForm}
        animationType="slide"
        transparent
        onRequestClose={() => setShowRecordForm(false)}
      >
        <View style={styles.modalOverlay}>
          <RecordPeriodForm
            initialStartDate={null}
            onSuccess={handleRecordSuccess}
            onCancel={() => setShowRecordForm(false)}
          />
        </View>
      </Modal>

      {/* ── Formulaire de symptôme ──────────────────────────────────────── */}
      <Modal
        visible={showSymptomForm}
        animationType="slide"
        transparent
        onRequestClose={() => setShowSymptomForm(false)}
      >
        <View style={styles.modalOverlay}>
          <SymptomForm
            onSuccess={() => {
              setShowSymptomForm(false)
              refresh()
            }}
            onCancel={() => setShowSymptomForm(false)}
          />
        </View>
      </Modal>

      {/* ── Bien-être (plein écran) ─────────────────────────────────────── */}
      <Modal
        visible={showWellness}
        animationType="slide"
        onRequestClose={() => setShowWellness(false)}
      >
        <View style={styles.wellnessModal}>
          <View style={styles.wellnessHeader}>
            <Button
              label={lang === 'fr' ? 'Fermer' : 'Close'}
              icon="close"
              variant="ghost"
              fullWidth={false}
              onPress={() => setShowWellness(false)}
            />
          </View>
          <WellnessScreen />
        </View>
      </Modal>
    </Screen>
  )
}

// ─── Contenu central de l'anneau ──────────────────────────────────────────────

interface RingCenterProps {
  cycleDay: number
  phaseLabel: string
  phaseColor: string
  daysUntil: number
  lang: 'fr' | 'en'
}

function RingCenter({
  cycleDay,
  phaseLabel,
  phaseColor,
  daysUntil,
  lang,
}: RingCenterProps): React.JSX.Element {
  let bigValue: string
  let caption: string

  if (daysUntil > 0) {
    bigValue = String(daysUntil)
    caption =
      lang === 'fr'
        ? daysUntil === 1
          ? 'jour avant les règles'
          : 'jours avant les règles'
        : daysUntil === 1
        ? 'day until period'
        : 'days until period'
  } else if (daysUntil === 0) {
    bigValue = '•'
    caption = lang === 'fr' ? 'règles prévues aujourd’hui' : 'period expected today'
  } else {
    bigValue = String(Math.abs(daysUntil))
    caption = lang === 'fr' ? 'jours de retard' : 'days late'
  }

  return (
    <View style={styles.ringCenter}>
      <AppText variant="label" style={{ color: phaseColor }}>
        {(lang === 'fr' ? 'Jour ' : 'Day ') + cycleDay} · {phaseLabel}
      </AppText>
      <AppText variant="display" style={styles.bigValue}>
        {bigValue}
      </AppText>
      <AppText variant="caption" tone="secondary" center style={styles.ringCaption}>
        {caption}
      </AppText>
    </View>
  )
}

// ─── Carte de progression de la confiance (signature) ─────────────────────────

function ConfidenceCard({
  summary,
  lang,
}: {
  summary: NonNullable<ReturnType<typeof computeCycleSummary>>
  lang: 'fr' | 'en'
}): React.JSX.Element {
  const copy = confidenceCopy(summary.confidenceMessage, lang)
  const meta = confidenceMeta(summary.confidence)
  const isReached = summary.confidenceMessage.kind === 'reached'

  return (
    <Card tint={meta.soft} style={styles.confCard}>
      <View style={styles.confHeader}>
        <Icon name={isReached ? 'sparkles' : 'chart'} size={18} color={meta.text} />
        <AppText variant="bodyStrong" style={{ color: meta.text }}>
          {copy.title}
        </AppText>
      </View>
      <AppText variant="caption" style={[styles.confDetail, { color: meta.text }]}>
        {copy.detail}
      </AppText>
      {/* Jauge de progression vers la confiance élevée */}
      <ConfidenceMeter level={summary.confidence} color={meta.main} />
    </Card>
  )
}

function ConfidenceMeter({
  level,
  color,
}: {
  level: 'low' | 'medium' | 'high'
  color: string
}): React.JSX.Element {
  const steps: Array<'low' | 'medium' | 'high'> = ['low', 'medium', 'high']
  const activeIndex = steps.indexOf(level)
  return (
    <View style={styles.meter}>
      {steps.map((step, i) => (
        <View
          key={step}
          style={[
            styles.meterSegment,
            { backgroundColor: i <= activeIndex ? color : colors.surfaceAlt },
          ]}
        />
      ))}
    </View>
  )
}

// ─── Action rapide discrète ───────────────────────────────────────────────────

function QuickAction({
  icon,
  label,
  onPress,
}: {
  icon: 'heart' | 'leaf'
  label: string
  onPress: () => void
}): React.JSX.Element {
  return (
    <TouchableOpacity
      style={styles.quickAction}
      activeOpacity={0.7}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Icon name={icon} size={18} color={colors.primaryDark} />
      <AppText variant="caption" style={{ color: colors.primaryDark, fontWeight: '600' }}>
        {label}
      </AppText>
    </TouchableOpacity>
  )
}

// ─── État vide ────────────────────────────────────────────────────────────────

function EmptyHome({
  lang,
  onRecord,
}: {
  lang: 'fr' | 'en'
  onRecord: () => void
}): React.JSX.Element {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Icon name="flower" size={44} color={colors.primary} />
      </View>
      <AppText variant="h2" center style={styles.emptyTitle}>
        {lang === 'fr' ? 'Commence ton suivi' : 'Start tracking'}
      </AppText>
      <AppText variant="body" tone="secondary" center style={styles.emptyText}>
        {lang === 'fr'
          ? 'Enregistre tes dernières règles pour obtenir tes premières prédictions.'
          : 'Log your last period to get your first predictions.'}
      </AppText>
      <Button
        label={lang === 'fr' ? 'Enregistrer mes règles' : 'Log my period'}
        icon="plus"
        onPress={onRecord}
      />
    </View>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  dateText: {
    textTransform: 'capitalize',
    marginTop: 2,
  },
  bell: {
    width: 40,
    height: 40,
    borderRadius: radii.pill,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringWrap: {
    alignItems: 'center',
    marginVertical: spacing.md,
  },
  ringCenter: {
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
  },
  bigValue: {
    color: colors.textPrimary,
    marginVertical: 2,
  },
  ringCaption: {
    maxWidth: 130,
  },
  fertileRow: {
    alignItems: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  confCard: {
    marginTop: spacing.lg,
  },
  confHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  confDetail: {
    opacity: 0.9,
    lineHeight: 19,
  },
  meter: {
    flexDirection: 'row',
    gap: 6,
    marginTop: spacing.md,
  },
  meterSegment: {
    flex: 1,
    height: 6,
    borderRadius: radii.pill,
  },
  cta: {
    marginTop: spacing.lg,
  },
  quickRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  quickAction: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: radii.md,
    backgroundColor: colors.primarySoft,
  },
  tiles: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.md,
  },
  empty: {
    alignItems: 'center',
    paddingTop: spacing.xxxl,
  },
  emptyIcon: {
    width: 96,
    height: 96,
    borderRadius: radii.pill,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
  },
  emptyTitle: {
    marginBottom: spacing.sm,
  },
  emptyText: {
    marginBottom: spacing.xxl,
    paddingHorizontal: spacing.lg,
    lineHeight: 22,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  wellnessModal: {
    flex: 1,
    backgroundColor: colors.background,
  },
  wellnessHeader: {
    alignItems: 'flex-end',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
})
