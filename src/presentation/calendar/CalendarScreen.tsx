/**
 * CalendarScreen — Écran principal du calendrier du cycle menstruel.
 *
 * Affiche :
 * - La grille calendrier mensuelle avec les phases colorées
 * - La zone de flou visuelle pour l'ovulation prédite (isBlurred: true)
 * - L'indicateur de confiance avec explication si level === 'low'
 * - Un bouton d'accès rapide pour enregistrer les règles (≤ 3 interactions)
 * - La phase actuelle du cycle
 *
 * Ce composant ne contient aucune logique métier — tout est délégué à
 * useCalendar() qui orchestre PredictNextCycleUseCase.
 *
 * Exigences : 12.1, 12.2, 12.3, 12.4, 2.6
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
import { useCalendar } from './useCalendar'
import { CycleCalendarGrid } from './CycleCalendarGrid'
import { OvulationBlurZone } from './OvulationBlurZone'
import { RecordPeriodForm } from './RecordPeriodForm'
import type { CalendarDate } from '../../domain/shared/types'

// ─── Labels de phase ──────────────────────────────────────────────────────────

const PHASE_LABELS: Record<string, string> = {
  menstrual: '🔴 Phase menstruelle',
  follicular: '🟢 Phase folliculaire',
  ovulation: '🟠 Période féconde',
  luteal: '🟣 Phase lutéale',
}

const PHASE_DESCRIPTIONS: Record<string, string> = {
  menstrual: 'Vos règles sont en cours. Prenez soin de vous.',
  follicular: 'Votre énergie remonte. Bonne période pour l\'activité physique.',
  ovulation: 'Période de fertilité maximale. Consultez vos conseils personnalisés.',
  luteal: 'Phase prémenstruelle. Gérez le stress et l\'alimentation.',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Formate une CalendarDate en date lisible.
 * Ex : "2024-01-29" → "29 jan. 2024"
 */
function formatDate(date: string): string {
  const [year, month, day] = date.split('-').map(Number)
  const d = new Date(Date.UTC(year, month - 1, day))
  return d.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

// ─── Composant ────────────────────────────────────────────────────────────────

/**
 * Écran principal du calendrier.
 *
 * Structure :
 * 1. En-tête : phase actuelle + description
 * 2. Grille calendrier mensuelle (navigation mois précédent/suivant)
 * 3. Prédictions : prochaines règles + ovulation avec zone de flou
 * 4. Bouton d'action rapide : "Enregistrer mes règles" (≤ 3 interactions)
 * 5. Formulaire d'enregistrement (modal inline)
 */
export function CalendarScreen(): React.JSX.Element {
  const { predictions, cycles, isLoading, error, refresh } = useCalendar()

  // Navigation mensuelle
  const now = new Date()
  const [displayYear, setDisplayYear] = useState(now.getUTCFullYear())
  const [displayMonth, setDisplayMonth] = useState(now.getUTCMonth() + 1)

  // Affichage du formulaire d'enregistrement
  const [showRecordForm, setShowRecordForm] = useState(false)

  // Jour sélectionné (pour pré-remplir le formulaire)
  const [selectedDate, setSelectedDate] = useState<CalendarDate | null>(null)

  // ── Navigation mensuelle ──────────────────────────────────────────────────

  function goToPreviousMonth(): void {
    if (displayMonth === 1) {
      setDisplayMonth(12)
      setDisplayYear(y => y - 1)
    } else {
      setDisplayMonth(m => m - 1)
    }
  }

  function goToNextMonth(): void {
    if (displayMonth === 12) {
      setDisplayMonth(1)
      setDisplayYear(y => y + 1)
    } else {
      setDisplayMonth(m => m + 1)
    }
  }

  // ── Gestion du formulaire ─────────────────────────────────────────────────

  function handleDayPress(date: CalendarDate): void {
    setSelectedDate(date)
    setShowRecordForm(true)
  }

  function handleRecordSuccess(): void {
    setShowRecordForm(false)
    setSelectedDate(null)
    refresh()
  }

  function handleRecordCancel(): void {
    setShowRecordForm(false)
    setSelectedDate(null)
  }

  // ── Rendu ─────────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator
          size="large"
          color="#E91E63"
          accessibilityLabel="Chargement du calendrier"
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

  const currentPhase = predictions?.currentPhase ?? null
  const phaseLabel = currentPhase ? PHASE_LABELS[currentPhase] : null
  const phaseDescription = currentPhase ? PHASE_DESCRIPTIONS[currentPhase] : null

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Phase actuelle ─────────────────────────────────────────────── */}
        {phaseLabel !== null && (
          <View
            style={styles.phaseCard}
            accessible={true}
            accessibilityLabel={`Phase actuelle : ${phaseLabel}. ${phaseDescription}`}
            accessibilityRole="text"
          >
            <Text style={styles.phaseLabel}>{phaseLabel}</Text>
            {phaseDescription !== null && (
              <Text style={styles.phaseDescription} accessibilityElementsHidden={true}>
                {phaseDescription}
              </Text>
            )}
          </View>
        )}

        {/* ── Grille calendrier ──────────────────────────────────────────── */}
        <View style={styles.calendarContainer}>
          {/* Navigation mois */}
          <View style={styles.monthNav}>
            <TouchableOpacity
              onPress={goToPreviousMonth}
              style={styles.navButton}
              accessibilityLabel="Mois précédent"
              accessibilityRole="button"
            >
              <Text style={styles.navButtonText}>‹</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={goToNextMonth}
              style={styles.navButton}
              accessibilityLabel="Mois suivant"
              accessibilityRole="button"
            >
              <Text style={styles.navButtonText}>›</Text>
            </TouchableOpacity>
          </View>

          <CycleCalendarGrid
            year={displayYear}
            month={displayMonth}
            cycles={cycles}
            predictions={predictions}
            onDayPress={handleDayPress}
          />
        </View>

        {/* ── Prédictions ────────────────────────────────────────────────── */}
        {predictions !== null && (
          <View style={styles.predictionsSection}>
            <Text style={styles.sectionTitle}>Prédictions</Text>

            {/* Prochaines règles */}
            <View
              style={styles.nextPeriodCard}
              accessible={true}
              accessibilityLabel={
                `Prochaines règles prévues le ${formatDate(predictions.nextPeriod.value.startDate)}`
              }
              accessibilityRole="text"
            >
              <Text style={styles.nextPeriodTitle}>🔴 Prochaines règles</Text>
              <Text style={styles.nextPeriodDate}>
                {formatDate(predictions.nextPeriod.value.startDate)}
              </Text>
              <ConfidenceInline confidence={predictions.nextPeriod.confidence} />
            </View>

            {/* Ovulation avec zone de flou */}
            <OvulationBlurZone
              ovulation={predictions.ovulation.value}
              confidence={predictions.ovulation.confidence}
            />
          </View>
        )}

        {/* ── Bouton d'action rapide ─────────────────────────────────────── */}
        {/* Exigence 12.2 : saisie en maximum 3 interactions */}
        <TouchableOpacity
          style={styles.recordButton}
          onPress={() => setShowRecordForm(true)}
          accessibilityLabel="Enregistrer mes règles"
          accessibilityRole="button"
          accessibilityHint="Ouvre le formulaire d'enregistrement des règles"
        >
          <Text style={styles.recordButtonText}>+ Enregistrer mes règles</Text>
        </TouchableOpacity>

        {/* Espace en bas pour le scroll */}
        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* ── Formulaire d'enregistrement (inline modal) ─────────────────── */}
      {showRecordForm && (
        <View style={styles.formOverlay}>
          <RecordPeriodForm
            initialStartDate={selectedDate}
            onSuccess={handleRecordSuccess}
            onCancel={handleRecordCancel}
          />
        </View>
      )}
    </SafeAreaView>
  )
}

// ─── Composant inline pour la confiance des prochaines règles ────────────────

interface ConfidenceInlineProps {
  confidence: { level: string; explanation: string | null }
}

function ConfidenceInline({ confidence }: ConfidenceInlineProps): React.JSX.Element {
  const colors: Record<string, string> = {
    low: '#EF5350',
    medium: '#FFA726',
    high: '#66BB6A',
  }
  const labels: Record<string, string> = {
    low: 'Faible',
    medium: 'Moyenne',
    high: 'Élevée',
  }

  return (
    <Text
      style={[styles.confidenceText, { color: colors[confidence.level] ?? '#9E9E9E' }]}
      accessibilityLabel={`Confiance : ${labels[confidence.level] ?? confidence.level}`}
    >
      Confiance : {labels[confidence.level] ?? confidence.level}
    </Text>
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
  phaseCard: {
    backgroundColor: '#FCE4EC',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#E91E63',
  },
  phaseLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#880E4F',
    marginBottom: 4,
  },
  phaseDescription: {
    fontSize: 13,
    color: '#AD1457',
    lineHeight: 18,
  },
  calendarContainer: {
    marginBottom: 16,
  },
  monthNav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  navButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#F5F5F5',
    minWidth: 40,
    alignItems: 'center',
  },
  navButtonText: {
    fontSize: 20,
    color: '#424242',
    fontWeight: '600',
  },
  predictionsSection: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#212121',
    marginBottom: 12,
  },
  nextPeriodCard: {
    backgroundColor: '#FFEBEE',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#E57373',
  },
  nextPeriodTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#B71C1C',
    marginBottom: 4,
  },
  nextPeriodDate: {
    fontSize: 20,
    fontWeight: '700',
    color: '#C62828',
    marginBottom: 6,
  },
  confidenceText: {
    fontSize: 12,
    fontWeight: '500',
  },
  recordButton: {
    backgroundColor: '#E91E63',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: '#E91E63',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  recordButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  bottomSpacer: {
    height: 24,
  },
  formOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
})
