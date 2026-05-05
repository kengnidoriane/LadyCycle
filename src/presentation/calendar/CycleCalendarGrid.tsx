/**
 * CycleCalendarGrid — Grille calendrier mensuelle avec phases colorées.
 *
 * Affiche un mois du calendrier avec chaque jour coloré selon sa phase :
 * - Rouge doux    : menstruation
 * - Vert doux     : phase folliculaire
 * - Orange doux   : ovulation / période féconde
 * - Violet doux   : phase lutéale
 *
 * Exigences :
 * - 12.1 : calendrier visuel avec phases clairement identifiées
 * - 12.3 : code couleur cohérent pour les phases
 * - 2.6  : zone de flou pour l'ovulation (délégué à OvulationBlurZone)
 */

import React, { useMemo } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native'
import type { Cycle } from '../../infrastructure/db/CycleRepository'
import type { PredictionResult } from '../../application/PredictNextCycleUseCase'
import type { CalendarDate } from '../../domain/shared/types'
import { getDayPhase, getPhaseColor } from './useCalendar'

// ─── Props ────────────────────────────────────────────────────────────────────

interface CycleCalendarGridProps {
  /** Année affichée */
  year: number
  /** Mois affiché (1-12) */
  month: number
  /** Historique des cycles pour colorier les jours passés */
  cycles: Cycle[]
  /** Prédictions pour colorier les jours futurs */
  predictions: PredictionResult | null
  /** Callback quand l'utilisatrice tape sur un jour */
  onDayPress?: (date: CalendarDate) => void
}

// ─── Constantes ───────────────────────────────────────────────────────────────

const DAY_NAMES = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']

const MONTH_NAMES = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
]

const PHASE_LABELS: Record<string, string> = {
  menstrual: 'Menstruation',
  follicular: 'Phase folliculaire',
  ovulation: 'Période féconde',
  luteal: 'Phase lutéale',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Génère toutes les dates d'un mois donné au format YYYY-MM-DD.
 * Inclut les jours vides en début de semaine pour aligner sur lundi.
 */
function buildMonthGrid(year: number, month: number): Array<CalendarDate | null> {
  const firstDay = new Date(Date.UTC(year, month - 1, 1))
  // getUTCDay() : 0=dim, 1=lun, ..., 6=sam → on veut lundi=0
  const startOffset = (firstDay.getUTCDay() + 6) % 7

  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate()

  const grid: Array<CalendarDate | null> = []

  // Jours vides avant le 1er du mois
  for (let i = 0; i < startOffset; i++) {
    grid.push(null)
  }

  // Jours du mois
  for (let d = 1; d <= daysInMonth; d++) {
    const mm = String(month).padStart(2, '0')
    const dd = String(d).padStart(2, '0')
    grid.push(`${year}-${mm}-${dd}`)
  }

  return grid
}

/**
 * Retourne la date d'aujourd'hui au format YYYY-MM-DD (UTC).
 */
function getTodayDate(): CalendarDate {
  return new Date().toISOString().split('T')[0]
}

// ─── Composant ────────────────────────────────────────────────────────────────

/**
 * Grille calendrier mensuelle avec phases colorées.
 *
 * Chaque cellule de jour est colorée selon sa phase du cycle.
 * Le jour actuel est mis en évidence avec un contour.
 * Les jours vides (avant le 1er) sont affichés en gris clair.
 */
export function CycleCalendarGrid({
  year,
  month,
  cycles,
  predictions,
  onDayPress,
}: CycleCalendarGridProps): React.JSX.Element {
  const today = getTodayDate()

  // Construire la grille une seule fois par mois
  const grid = useMemo(() => buildMonthGrid(year, month), [year, month])

  return (
    <View style={styles.container}>
      {/* En-tête du mois */}
      <Text style={styles.monthTitle} accessibilityRole="header">
        {MONTH_NAMES[month - 1]} {year}
      </Text>

      {/* Noms des jours */}
      <View style={styles.dayNamesRow} accessibilityElementsHidden={true}>
        {DAY_NAMES.map(name => (
          <View key={name} style={styles.dayNameCell}>
            <Text style={styles.dayNameText}>{name}</Text>
          </View>
        ))}
      </View>

      {/* Grille des jours */}
      <View style={styles.grid}>
        {grid.map((date, index) => {
          if (date === null) {
            // Cellule vide
            return <View key={`empty-${index}`} style={styles.dayCell} />
          }

          const phase = getDayPhase(date, cycles, predictions)
          const phaseColor = phase ? getPhaseColor(phase) : null
          const isToday = date === today
          const dayNumber = parseInt(date.split('-')[2], 10)
          const phaseLabel = phase ? PHASE_LABELS[phase] : 'Aucune phase'

          return (
            <TouchableOpacity
              key={date}
              style={[
                styles.dayCell,
                phaseColor !== null && { backgroundColor: phaseColor + '40' }, // 25% opacité
                isToday && styles.todayCell,
              ]}
              onPress={() => onDayPress?.(date)}
              accessible={true}
              accessibilityLabel={`${dayNumber} ${MONTH_NAMES[month - 1]}, ${phaseLabel}${isToday ? ', aujourd\'hui' : ''}`}
              accessibilityRole="button"
              accessibilityHint="Appuyez pour voir les détails de ce jour"
            >
              <Text
                style={[
                  styles.dayNumber,
                  isToday && styles.todayNumber,
                  phase === 'menstrual' && styles.menstrualDayNumber,
                ]}
              >
                {dayNumber}
              </Text>
              {/* Indicateur de phase (petit point coloré) */}
              {phase !== null && (
                <View
                  style={[
                    styles.phaseIndicator,
                    { backgroundColor: phaseColor ?? '#BDBDBD' },
                  ]}
                  accessibilityElementsHidden={true}
                />
              )}
            </TouchableOpacity>
          )
        })}
      </View>

      {/* Légende des phases */}
      <PhaseLegend />
    </View>
  )
}

// ─── Légende ──────────────────────────────────────────────────────────────────

/**
 * Légende des couleurs de phase.
 * Exigence 12.3 : code couleur cohérent et identifiable.
 */
function PhaseLegend(): React.JSX.Element {
  const phases: Array<{ phase: string; label: string }> = [
    { phase: 'menstrual', label: 'Règles' },
    { phase: 'follicular', label: 'Folliculaire' },
    { phase: 'ovulation', label: 'Féconde' },
    { phase: 'luteal', label: 'Lutéale' },
  ]

  return (
    <View style={legendStyles.container} accessibilityLabel="Légende des phases du cycle">
      {phases.map(({ phase, label }) => (
        <View key={phase} style={legendStyles.item}>
          <View
            style={[legendStyles.dot, { backgroundColor: getPhaseColor(phase) }]}
            accessibilityElementsHidden={true}
          />
          <Text style={legendStyles.label}>{label}</Text>
        </View>
      ))}
    </View>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const CELL_SIZE = 44

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  monthTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#212121',
    textAlign: 'center',
    marginBottom: 12,
  },
  dayNamesRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  dayNameCell: {
    width: CELL_SIZE,
    alignItems: 'center',
    paddingVertical: 4,
  },
  dayNameText: {
    fontSize: 12,
    color: '#9E9E9E',
    fontWeight: '500',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    marginVertical: 2,
  },
  todayCell: {
    borderWidth: 2,
    borderColor: '#E91E63',
  },
  dayNumber: {
    fontSize: 14,
    color: '#212121',
    fontWeight: '400',
  },
  todayNumber: {
    fontWeight: '700',
    color: '#E91E63',
  },
  menstrualDayNumber: {
    color: '#C62828',
  },
  phaseIndicator: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginTop: 2,
  },
})

const legendStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F5F5F5',
    gap: 12,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  label: {
    fontSize: 11,
    color: '#757575',
  },
})
