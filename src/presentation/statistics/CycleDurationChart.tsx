/**
 * CycleDurationChart — Graphique d'évolution des durées de cycle.
 *
 * Affiché uniquement si l'utilisatrice a enregistré ≥ 6 cycles complets.
 * En dessous de 6 cycles, un graphique avec 2-3 points n'a pas de valeur
 * informative et peut induire en erreur (design conditionnel).
 *
 * Implémentation : graphique en barres SVG-like via des View React Native.
 * Pas de dépendance externe — utilise uniquement les primitives RN.
 *
 * Exigence 7.4 : afficher le graphique d'évolution des durées (≥ 6 cycles).
 */

import React from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
} from 'react-native'
import type { Cycle } from '../../infrastructure/db/CycleRepository'
import { colors, spacing, radii } from '../theme'

// ─── Props ────────────────────────────────────────────────────────────────────

interface CycleDurationChartProps {
  /** Cycles complets (avec durée connue), non exceptionnels, triés par date */
  cycles: Cycle[]
  /** Langue d'affichage. */
  lang?: 'fr' | 'en'
}

// ─── Constantes ───────────────────────────────────────────────────────────────

const MIN_CYCLES_FOR_CHART = 6
const BAR_WIDTH = 32
const BAR_GAP = 8
const MAX_BAR_HEIGHT = 120
const CHART_PADDING = 16

// ─── Composant ────────────────────────────────────────────────────────────────

/**
 * Graphique en barres de l'évolution des durées de cycle.
 *
 * Affiché uniquement si ≥ 6 cycles complets non exceptionnels.
 * Chaque barre représente la durée d'un cycle, colorée selon la régularité
 * par rapport à la moyenne.
 */
export function CycleDurationChart({ cycles, lang = 'fr' }: CycleDurationChartProps): React.JSX.Element | null {
  const fr = lang !== 'en'
  // Filtrer les cycles complets non exceptionnels avec durée connue
  const completedCycles = cycles
    .filter(c => !c.isExceptional && c.duration !== null)
    .sort((a, b) => a.startDate.localeCompare(b.startDate))

  // Exigence 7.4 : afficher seulement si ≥ 6 cycles
  if (completedCycles.length < MIN_CYCLES_FOR_CHART) {
    return null
  }

  const durations = completedCycles.map(c => c.duration as number)
  const maxDuration = Math.max(...durations)
  const minDuration = Math.min(...durations)
  const avgDuration = durations.reduce((s, d) => s + d, 0) / durations.length

  // Normaliser les hauteurs des barres
  const range = maxDuration - minDuration || 1
  const getBarHeight = (duration: number): number => {
    return CHART_PADDING + ((duration - minDuration) / range) * (MAX_BAR_HEIGHT - CHART_PADDING)
  }

  // Couleur de la barre selon l'écart à la moyenne
  const getBarColor = (duration: number): string => {
    const diff = Math.abs(duration - avgDuration)
    if (diff <= 2) return colors.primary       // proche de la moyenne
    if (diff <= 5) return colors.warning        // écart modéré
    return colors.danger                        // écart important
  }

  // Formater le mois d'un cycle
  const formatMonth = (startDate: string): string => {
    const [year, month] = startDate.split('-').map(Number)
    const d = new Date(Date.UTC(year, month - 1, 1))
    return d.toLocaleDateString(fr ? 'fr-FR' : 'en-GB', { month: 'short', timeZone: 'UTC' })
  }

  return (
    <View
      style={styles.container}
      accessible={true}
      accessibilityLabel={fr ? `Graphique d'évolution des durées de cycle sur ${completedCycles.length} cycles` : `Cycle length chart over ${completedCycles.length} cycles`}
      accessibilityRole="image"
    >
      <Text style={styles.title}>{fr ? 'Évolution des durées' : 'Length over time'}</Text>
      <Text style={styles.subtitle}>
        {completedCycles.length} {fr ? 'cycles · Moyenne :' : 'cycles · Average:'} {Math.round(avgDuration)} {fr ? 'jours' : 'days'}
      </Text>

      {/* Ligne de référence de la moyenne */}
      <View style={styles.chartWrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.barsContainer}
          accessibilityElementsHidden={true}
        >
          {completedCycles.map((cycle, index) => {
            const barHeight = getBarHeight(cycle.duration as number)
            const barColor = getBarColor(cycle.duration as number)
            const isLast = index === completedCycles.length - 1

            return (
              <View
                key={cycle.id}
                style={[styles.barWrapper, isLast && styles.barWrapperLast]}
              >
                {/* Valeur au-dessus de la barre */}
                <Text style={styles.barValue}>{cycle.duration}</Text>

                {/* Barre */}
                <View
                  style={[
                    styles.bar,
                    {
                      height: barHeight,
                      backgroundColor: barColor,
                    },
                  ]}
                />

                {/* Label du mois en dessous */}
                <Text style={styles.barLabel}>{formatMonth(cycle.startDate)}</Text>
              </View>
            )
          })}
        </ScrollView>

        {/* Ligne de la moyenne (positionnée en overlay) */}
        <View
          style={[
            styles.averageLine,
            {
              bottom:
                styles.barLabel.fontSize +
                (styles.barLabel.marginTop ?? 0) +
                getBarHeight(avgDuration) +
                4,
            },
          ]}
          accessibilityElementsHidden={true}
        />
      </View>

      {/* Légende */}
      <View style={styles.legend} accessibilityElementsHidden={true}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: colors.primary }]} />
          <Text style={styles.legendText}>{fr ? 'Proche de la moyenne' : 'Close to average'}</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: colors.warning }]} />
          <Text style={styles.legendText}>{fr ? 'Écart modéré' : 'Moderate variation'}</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: colors.danger }]} />
          <Text style={styles.legendText}>{fr ? 'Écart important' : 'Large variation'}</Text>
        </View>
      </View>
    </View>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
  },
  chartWrapper: {
    position: 'relative',
    marginBottom: 12,
  },
  barsContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingBottom: 4,
  },
  barWrapper: {
    width: BAR_WIDTH,
    marginRight: BAR_GAP,
    alignItems: 'center',
  },
  barWrapperLast: {
    marginRight: 0,
  },
  barValue: {
    fontSize: 10,
    color: colors.textSecondary,
    fontWeight: '600',
    marginBottom: 2,
  },
  bar: {
    width: BAR_WIDTH - 4,
    borderRadius: radii.sm,
    minHeight: 8,
  },
  barLabel: {
    fontSize: 10,
    color: colors.textTertiary,
    marginTop: 4,
    textAlign: 'center',
  },
  averageLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: colors.primary,
    opacity: 0.4,
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 11,
    color: colors.textSecondary,
  },
})
