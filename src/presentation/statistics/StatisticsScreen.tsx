/**
 * StatisticsScreen — Écran des statistiques du cycle menstruel.
 *
 * Affiche :
 * - Durée moyenne du cycle et des menstruations
 * - Régularité du cycle (σ traduit en langage naturel)
 * - Nombre de cycles exceptionnels exclus des calculs (transparence)
 * - Graphique d'évolution des durées (si ≥ 6 cycles complets)
 * - Liste de l'historique des cycles avec accès au détail
 *
 * Ce composant ne contient aucune logique métier — tout est délégué à
 * useStatistics() qui orchestre CycleManager et MarkCycleExceptionalUseCase.
 *
 * Exigences : 7.1, 7.2, 7.3, 7.4, 13.3
 */

import React, { useState } from 'react'
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  SafeAreaView,
} from 'react-native'
import { useStatistics, formatRegularity, formatDuration, formatDate } from './useStatistics'
import { CycleDurationChart } from './CycleDurationChart'
import { CycleDetailScreen } from './CycleDetailScreen'
import type { Cycle } from '../../infrastructure/db/CycleRepository'

// ─── Composant ────────────────────────────────────────────────────────────────

/**
 * Écran des statistiques et de l'historique des cycles.
 *
 * Structure :
 * 1. Carte des statistiques globales (moyenne, régularité, cycles exclus)
 * 2. Graphique d'évolution (conditionnel — ≥ 6 cycles)
 * 3. Liste de l'historique des cycles
 * 4. Vue détail d'un cycle (modal inline)
 */
export function StatisticsScreen(): React.JSX.Element {
  const { statistics, cycles, isLoading, error, refresh, markAsExceptional, unmarkAsExceptional } =
    useStatistics()

  // Cycle sélectionné pour la vue détail
  const [selectedCycle, setSelectedCycle] = useState<Cycle | null>(null)

  // ── Rendu états de chargement / erreur ────────────────────────────────────

  if (isLoading) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator
          size="large"
          color="#E91E63"
          accessibilityLabel="Chargement des statistiques"
        />
        <Text style={styles.loadingText}>Chargement…</Text>
      </SafeAreaView>
    )
  }

  if (error !== null) {
    return (
      <SafeAreaView style={styles.centered}>
        <Text style={styles.errorText} accessibilityRole="alert">
          {error}
        </Text>
        <TouchableOpacity
          style={styles.retryButton}
          onPress={refresh}
          accessibilityLabel="Réessayer le chargement"
          accessibilityRole="button"
        >
          <Text style={styles.retryButtonText}>Réessayer</Text>
        </TouchableOpacity>
      </SafeAreaView>
    )
  }

  // ── Vue détail d'un cycle ─────────────────────────────────────────────────

  if (selectedCycle !== null) {
    return (
      <CycleDetailScreen
        cycle={selectedCycle}
        onBack={() => setSelectedCycle(null)}
        onMarkExceptional={async (reason) => {
          await markAsExceptional(selectedCycle.id, reason)
          // Mettre à jour le cycle sélectionné depuis la liste rechargée
          setSelectedCycle(null)
        }}
        onUnmarkExceptional={async () => {
          await unmarkAsExceptional(selectedCycle.id)
          setSelectedCycle(null)
        }}
      />
    )
  }

  // ── Rendu principal ───────────────────────────────────────────────────────

  const hasStatistics = statistics !== null
  const regularityInfo = hasStatistics
    ? formatRegularity(statistics.cycleRegularity, statistics.standardDeviation)
    : null

  // Cycles triés du plus récent au plus ancien pour l'historique
  const sortedCycles = [...cycles].sort((a, b) =>
    b.startDate.localeCompare(a.startDate),
  )

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── En-tête ────────────────────────────────────────────────────── */}
        <Text style={styles.screenTitle} accessibilityRole="header">
          Statistiques
        </Text>

        {/* ── Carte des statistiques globales ────────────────────────────── */}
        {hasStatistics && (
          <View
            style={styles.statsCard}
            accessible={true}
            accessibilityLabel={
              `Statistiques basées sur ${statistics.totalCyclesRecorded - statistics.exceptionalCyclesExcluded} cycles` +
              (statistics.exceptionalCyclesExcluded > 0
                ? `, ${statistics.exceptionalCyclesExcluded} cycle${statistics.exceptionalCyclesExcluded > 1 ? 's' : ''} exceptionnel${statistics.exceptionalCyclesExcluded > 1 ? 's' : ''} exclu${statistics.exceptionalCyclesExcluded > 1 ? 's' : ''}`
                : '')
            }
            accessibilityRole="summary"
          >
            {/* Titre avec note sur les cycles exclus */}
            <View style={styles.statsCardHeader}>
              <Text style={styles.statsCardTitle}>Mes statistiques</Text>
              {/* Exigence 13.3 : indiquer le nombre de cycles exceptionnels exclus */}
              {statistics.exceptionalCyclesExcluded > 0 && (
                <Text
                  style={styles.exceptionalNote}
                  accessibilityElementsHidden={true}
                >
                  Basé sur {statistics.totalCyclesRecorded - statistics.exceptionalCyclesExcluded} cycles
                  {' '}({statistics.exceptionalCyclesExcluded} exceptionnel{statistics.exceptionalCyclesExcluded > 1 ? 's' : ''} exclu{statistics.exceptionalCyclesExcluded > 1 ? 's' : ''})
                </Text>
              )}
              {statistics.exceptionalCyclesExcluded === 0 && (
                <Text
                  style={styles.exceptionalNote}
                  accessibilityElementsHidden={true}
                >
                  Basé sur {statistics.totalCyclesRecorded} cycle{statistics.totalCyclesRecorded > 1 ? 's' : ''}
                </Text>
              )}
            </View>

            {/* Grille des métriques */}
            <View style={styles.metricsGrid}>
              {/* Durée moyenne du cycle */}
              {/* Exigence 7.2 : durée moyenne du cycle */}
              <MetricCard
                icon="🔄"
                label="Durée du cycle"
                value={formatDuration(statistics.averageCycleLength)}
                accessibilityLabel={`Durée moyenne du cycle : ${formatDuration(statistics.averageCycleLength)}`}
              />

              {/* Durée moyenne des menstruations */}
              {/* Exigence 7.2 : durée moyenne des menstruations */}
              <MetricCard
                icon="🔴"
                label="Durée des règles"
                value={formatDuration(statistics.averageMenstruationLength)}
                accessibilityLabel={`Durée moyenne des règles : ${formatDuration(statistics.averageMenstruationLength)}`}
              />
            </View>

            {/* Régularité du cycle */}
            {/* Exigence 7.3 : régularité basée sur σ, traduite en langage naturel */}
            {regularityInfo !== null && (
              <View
                style={[styles.regularityCard, { borderLeftColor: regularityInfo.color }]}
                accessible={true}
                accessibilityLabel={`Régularité : ${regularityInfo.label}. ${regularityInfo.description}`}
                accessibilityRole="text"
              >
                <Text style={[styles.regularityLabel, { color: regularityInfo.color }]}>
                  {regularityInfo.label}
                </Text>
                <Text style={styles.regularityDescription} accessibilityElementsHidden={true}>
                  {regularityInfo.description}
                </Text>
              </View>
            )}
          </View>
        )}

        {/* ── Graphique d'évolution ───────────────────────────────────────── */}
        {/* Exigence 7.4 : graphique conditionnel (≥ 6 cycles) */}
        <CycleDurationChart cycles={cycles} />

        {/* ── Historique des cycles ───────────────────────────────────────── */}
        {/* Exigence 7.1 : afficher tous les cycles enregistrés */}
        <View style={styles.historySection}>
          <Text style={styles.sectionTitle}>
            Historique ({cycles.length} cycle{cycles.length > 1 ? 's' : ''})
          </Text>

          {sortedCycles.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>
                Aucun cycle enregistré pour l'instant.{'\n'}
                Commencez par enregistrer vos règles depuis le calendrier.
              </Text>
            </View>
          ) : (
            sortedCycles.map(cycle => (
              <CycleHistoryRow
                key={cycle.id}
                cycle={cycle}
                onPress={() => setSelectedCycle(cycle)}
              />
            ))
          )}
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </SafeAreaView>
  )
}

// ─── Composant MetricCard ─────────────────────────────────────────────────────

interface MetricCardProps {
  icon: string
  label: string
  value: string
  accessibilityLabel: string
}

function MetricCard({ icon, label, value, accessibilityLabel }: MetricCardProps): React.JSX.Element {
  return (
    <View
      style={metricStyles.card}
      accessible={true}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="text"
    >
      <Text style={metricStyles.icon} accessibilityElementsHidden={true}>{icon}</Text>
      <Text style={metricStyles.value}>{value}</Text>
      <Text style={metricStyles.label} accessibilityElementsHidden={true}>{label}</Text>
    </View>
  )
}

const metricStyles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: '#FFF0F5',
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  icon: {
    fontSize: 22,
    marginBottom: 6,
  },
  value: {
    fontSize: 18,
    fontWeight: '700',
    color: '#880E4F',
    marginBottom: 2,
  },
  label: {
    fontSize: 11,
    color: '#AD1457',
    textAlign: 'center',
  },
})

// ─── Composant CycleHistoryRow ────────────────────────────────────────────────

interface CycleHistoryRowProps {
  cycle: Cycle
  onPress: () => void
}

/**
 * Ligne de l'historique représentant un cycle.
 * Affiche les dates, la durée, le badge exceptionnel si applicable.
 * Appuyable pour accéder au détail du cycle.
 */
function CycleHistoryRow({ cycle, onPress }: CycleHistoryRowProps): React.JSX.Element {
  const startLabel = formatDate(cycle.startDate)
  const endLabel = cycle.endDate ? formatDate(cycle.endDate) : 'En cours'
  const durationLabel = cycle.duration
    ? `${cycle.duration} jours`
    : cycle.endDate
    ? '—'
    : 'En cours'

  const accessibilityLabel =
    `Cycle du ${startLabel}` +
    (cycle.endDate ? ` au ${endLabel}, ${durationLabel}` : ', en cours') +
    (cycle.isExceptional ? ', marqué comme exceptionnel' : '') +
    `. Appuyez pour voir le détail.`

  return (
    <TouchableOpacity
      style={[styles.historyRow, cycle.isExceptional && styles.historyRowExceptional]}
      onPress={onPress}
      accessible={true}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      accessibilityHint="Ouvre le détail de ce cycle"
    >
      {/* Indicateur de couleur */}
      <View
        style={[
          styles.historyRowIndicator,
          { backgroundColor: cycle.isExceptional ? '#BDBDBD' : '#E91E63' },
        ]}
        accessibilityElementsHidden={true}
      />

      {/* Contenu */}
      <View style={styles.historyRowContent}>
        <View style={styles.historyRowHeader}>
          <Text style={styles.historyRowDate}>{startLabel}</Text>
          {cycle.isExceptional && (
            <View style={styles.exceptionalBadge} accessibilityElementsHidden={true}>
              <Text style={styles.exceptionalBadgeText}>Exceptionnel</Text>
            </View>
          )}
        </View>
        <Text style={styles.historyRowDetails} accessibilityElementsHidden={true}>
          {endLabel !== 'En cours' ? `Fin : ${endLabel}` : '🔴 En cours'}
          {cycle.duration ? `  ·  ${durationLabel}` : ''}
        </Text>
        {cycle.symptoms.length > 0 && (
          <Text style={styles.historyRowSymptoms} accessibilityElementsHidden={true}>
            {cycle.symptoms.length} symptôme{cycle.symptoms.length > 1 ? 's' : ''} enregistré{cycle.symptoms.length > 1 ? 's' : ''}
          </Text>
        )}
      </View>

      {/* Chevron */}
      <Text style={styles.historyRowChevron} accessibilityElementsHidden={true}>›</Text>
    </TouchableOpacity>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FAFAFA',
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 15,
    color: '#757575',
  },
  errorText: {
    fontSize: 15,
    color: '#EF5350',
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: '#E91E63',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  screenTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#212121',
    marginBottom: 16,
  },
  // ── Carte statistiques ──────────────────────────────────────────────────
  statsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  statsCardHeader: {
    marginBottom: 14,
  },
  statsCardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#212121',
    marginBottom: 2,
  },
  exceptionalNote: {
    fontSize: 12,
    color: '#9E9E9E',
  },
  metricsGrid: {
    flexDirection: 'row',
    marginHorizontal: -4,
    marginBottom: 14,
  },
  regularityCard: {
    backgroundColor: '#FAFAFA',
    borderRadius: 8,
    padding: 12,
    borderLeftWidth: 4,
  },
  regularityLabel: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  regularityDescription: {
    fontSize: 13,
    color: '#616161',
    lineHeight: 18,
  },
  // ── Historique ──────────────────────────────────────────────────────────
  historySection: {
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#212121',
    marginBottom: 12,
  },
  emptyState: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: 14,
    color: '#9E9E9E',
    textAlign: 'center',
    lineHeight: 20,
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginBottom: 8,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  historyRowExceptional: {
    opacity: 0.75,
  },
  historyRowIndicator: {
    width: 4,
    alignSelf: 'stretch',
  },
  historyRowContent: {
    flex: 1,
    padding: 14,
  },
  historyRowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 3,
  },
  historyRowDate: {
    fontSize: 15,
    fontWeight: '600',
    color: '#212121',
  },
  historyRowDetails: {
    fontSize: 13,
    color: '#757575',
    marginBottom: 2,
  },
  historyRowSymptoms: {
    fontSize: 12,
    color: '#9E9E9E',
  },
  historyRowChevron: {
    fontSize: 20,
    color: '#BDBDBD',
    paddingRight: 14,
    fontWeight: '300',
  },
  exceptionalBadge: {
    backgroundColor: '#EEEEEE',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  exceptionalBadgeText: {
    fontSize: 10,
    color: '#757575',
    fontWeight: '600',
  },
  bottomSpacer: {
    height: 24,
  },
})
