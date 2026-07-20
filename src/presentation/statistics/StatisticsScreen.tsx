/**
 * StatisticsScreen — statistiques et historique du cycle.
 *
 * Transparence : indique toujours combien de cycles servent réellement au calcul
 * et combien sont exclus (exceptionnels). Métriques, régularité, graphique,
 * historique cliquable.
 *
 * Exigences : 7.1, 7.2, 7.3, 7.4, 13.3
 */

import React, { useState } from 'react'
import { View, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native'
import { useStatistics, formatRegularity, formatDuration, formatDate } from './useStatistics'
import { CycleDurationChart } from './CycleDurationChart'
import { CycleDetailScreen } from './CycleDetailScreen'
import { Screen, AppText, Card, StatTile, Badge, Button, Icon } from '../components'
import { colors, spacing, radii } from '../theme'
import { useI18n } from '../i18n/I18nContext'
import type { Cycle } from '../../infrastructure/db/CycleRepository'

export function StatisticsScreen(): React.JSX.Element {
  const { statistics, cycles, isLoading, error, refresh, markAsExceptional, unmarkAsExceptional } =
    useStatistics()
  const { currentLanguage } = useI18n()
  const lang = currentLanguage === 'en' ? 'en' : 'fr'
  const fr = lang !== 'en'
  const [selectedCycle, setSelectedCycle] = useState<Cycle | null>(null)

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
        <Button label={fr ? 'Réessayer' : 'Retry'} onPress={refresh} fullWidth={false} />
      </Screen>
    )
  }

  if (selectedCycle !== null) {
    return (
      <CycleDetailScreen
        cycle={selectedCycle}
        onBack={() => setSelectedCycle(null)}
        onMarkExceptional={async (reason) => {
          await markAsExceptional(selectedCycle.id, reason)
          setSelectedCycle(null)
        }}
        onUnmarkExceptional={async () => {
          await unmarkAsExceptional(selectedCycle.id)
          setSelectedCycle(null)
        }}
      />
    )
  }

  const hasStatistics = statistics !== null
  const regularityInfo = hasStatistics
    ? formatRegularity(statistics.cycleRegularity, statistics.standardDeviation, lang)
    : null
  const sortedCycles = [...cycles].sort((a, b) => b.startDate.localeCompare(a.startDate))

  const usedCycles = hasStatistics
    ? statistics.totalCyclesRecorded - statistics.exceptionalCyclesExcluded
    : 0

  return (
    <Screen>
      <AppText variant="h1" style={styles.title} accessibilityRole="header">
        {fr ? 'Statistiques' : 'Statistics'}
      </AppText>

      {hasStatistics && (
        <Card style={styles.statsCard}>
          <AppText variant="caption" tone="tertiary" style={styles.basedOn}>
            {statistics.exceptionalCyclesExcluded > 0
              ? fr
                ? `Basé sur ${usedCycles} cycles · ${statistics.exceptionalCyclesExcluded} exceptionnel${statistics.exceptionalCyclesExcluded > 1 ? 's' : ''} exclu${statistics.exceptionalCyclesExcluded > 1 ? 's' : ''}`
                : `Based on ${usedCycles} cycles · ${statistics.exceptionalCyclesExcluded} exceptional excluded`
              : fr
              ? `Basé sur ${statistics.totalCyclesRecorded} cycle${statistics.totalCyclesRecorded > 1 ? 's' : ''}`
              : `Based on ${statistics.totalCyclesRecorded} cycle${statistics.totalCyclesRecorded > 1 ? 's' : ''}`}
          </AppText>

          <View style={styles.tiles}>
            <StatTile
              icon="clock"
              iconColor={colors.phase.luteal.main}
              label={fr ? 'Durée du cycle' : 'Cycle length'}
              value={formatDuration(statistics.averageCycleLength, lang)}
            />
            <StatTile
              icon="droplet"
              iconColor={colors.phase.menstrual.main}
              label={fr ? 'Durée des règles' : 'Period length'}
              value={formatDuration(statistics.averageMenstruationLength, lang)}
            />
          </View>

          {regularityInfo !== null && (
            <View style={[styles.regularity, { borderLeftColor: regularityInfo.color }]}>
              <AppText variant="bodyStrong" style={{ color: regularityInfo.color }}>
                {regularityInfo.label}
              </AppText>
              <AppText variant="caption" tone="secondary" style={styles.regDesc}>
                {regularityInfo.description}
              </AppText>
            </View>
          )}
        </Card>
      )}

      <CycleDurationChart cycles={cycles} lang={lang} />

      <View style={styles.history}>
        <AppText variant="h3" style={styles.sectionTitle}>
          {fr ? 'Historique' : 'History'} ({cycles.length})
        </AppText>

        {sortedCycles.length === 0 ? (
          <Card>
            <AppText variant="caption" tone="secondary" center>
              {fr ? "Aucun cycle enregistré pour l'instant." : 'No cycles recorded yet.'}
            </AppText>
          </Card>
        ) : (
          sortedCycles.map((cycle) => (
            <CycleHistoryRow
              key={cycle.id}
              cycle={cycle}
              lang={lang}
              onPress={() => setSelectedCycle(cycle)}
            />
          ))
        )}
      </View>
    </Screen>
  )
}

interface CycleHistoryRowProps {
  cycle: Cycle
  lang: 'fr' | 'en'
  onPress: () => void
}

function CycleHistoryRow({ cycle, lang, onPress }: CycleHistoryRowProps): React.JSX.Element {
  const fr = lang !== 'en'
  const ongoing = fr ? 'En cours' : 'Ongoing'
  const startLabel = formatDate(cycle.startDate, lang)
  const endLabel = cycle.endDate ? formatDate(cycle.endDate, lang) : ongoing
  const durationLabel = cycle.duration ? formatDuration(cycle.duration, lang) : null

  const accessibilityLabel = fr
    ? `Cycle du ${startLabel}` +
      (cycle.endDate ? ` au ${endLabel}` : ', en cours') +
      (cycle.isExceptional ? ', marqué comme exceptionnel' : '') +
      '. Appuyez pour voir le détail.'
    : `Cycle from ${startLabel}` +
      (cycle.endDate ? ` to ${endLabel}` : ', ongoing') +
      (cycle.isExceptional ? ', marked as exceptional' : '') +
      '. Tap to view details.'

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={[styles.row, cycle.isExceptional && styles.rowExceptional]}
    >
      <View
        style={[
          styles.rowIndicator,
          { backgroundColor: cycle.isExceptional ? colors.borderStrong : colors.primary },
        ]}
      />
      <View style={styles.rowContent}>
        <View style={styles.rowHeader}>
          <AppText variant="bodyStrong">{startLabel}</AppText>
          {cycle.isExceptional && (
            <Badge
              label={fr ? 'Exceptionnel' : 'Exceptional'}
              color={colors.textSecondary}
              background={colors.surfaceAlt}
            />
          )}
        </View>
        <AppText variant="caption" tone="secondary">
          {endLabel !== ongoing ? `${fr ? 'Fin' : 'End'} : ${endLabel}` : ongoing}
          {durationLabel ? `  ·  ${durationLabel}` : ''}
        </AppText>
      </View>
      <Icon name="chevronRight" size={20} color={colors.textTertiary} />
    </TouchableOpacity>
  )
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
  statsCard: {
    marginBottom: spacing.lg,
  },
  basedOn: {
    marginBottom: spacing.md,
  },
  tiles: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  regularity: {
    backgroundColor: colors.background,
    borderRadius: radii.sm,
    padding: spacing.md,
    borderLeftWidth: 4,
  },
  regDesc: {
    marginTop: 2,
    lineHeight: 18,
  },
  history: {
    marginTop: spacing.lg,
  },
  sectionTitle: {
    marginBottom: spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
    overflow: 'hidden',
    paddingRight: spacing.md,
  },
  rowExceptional: {
    opacity: 0.7,
  },
  rowIndicator: {
    width: 4,
    alignSelf: 'stretch',
  },
  rowContent: {
    flex: 1,
    padding: spacing.md,
  },
  rowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: 2,
  },
})
