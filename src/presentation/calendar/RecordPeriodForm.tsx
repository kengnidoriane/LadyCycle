/**
 * RecordPeriodForm — Formulaire d'enregistrement d'une menstruation.
 *
 * Permet à l'utilisatrice d'enregistrer le début et la fin de ses règles
 * en maximum 3 interactions :
 *   1. Tap "Aujourd'hui" pour la date de début
 *   2. Tap "Aujourd'hui" pour la date de fin (ou même jour si 1 jour)
 *   3. Tap "Enregistrer"
 *
 * Validation :
 * - La date de fin doit être ≥ à la date de début (Exigence 1.3)
 * - Les deux dates sont obligatoires
 * - Les erreurs de validation sont affichées en temps réel
 *
 * Ce composant appelle RecordPeriodUseCase à la soumission.
 *
 * Exigences : 1.1, 1.2, 1.3, 12.2
 */

import React, { useState } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import { DatePickerField } from './DatePickerField'
import { RecordPeriodUseCase } from '../../application/RecordPeriodUseCase'
import { sharedRepository } from './useCalendar'
import type { CalendarDate } from '../../domain/shared/types'

// ─── Props ────────────────────────────────────────────────────────────────────

interface RecordPeriodFormProps {
  /** Date de début pré-remplie (ex : jour sélectionné dans le calendrier) */
  initialStartDate?: CalendarDate | null
  /** Callback appelé après un enregistrement réussi */
  onSuccess: () => void
  /** Callback appelé si l'utilisatrice annule */
  onCancel: () => void
}

// ─── Composant ────────────────────────────────────────────────────────────────

/**
 * Formulaire d'enregistrement d'une menstruation.
 *
 * Structure :
 * 1. En-tête avec titre et bouton Annuler
 * 2. Champ "Date de début" avec bouton Aujourd'hui
 * 3. Champ "Date de fin" avec bouton Aujourd'hui
 * 4. Message d'erreur global (validation ou persistance)
 * 5. Bouton "Enregistrer"
 *
 * Flux optimal (3 interactions) :
 *   → Tap "Aujourd'hui" (début) → Tap "Aujourd'hui" (fin) → Tap "Enregistrer"
 */
export function RecordPeriodForm({
  initialStartDate,
  onSuccess,
  onCancel,
}: RecordPeriodFormProps): React.JSX.Element {
  const [startDate, setStartDate] = useState<CalendarDate | null>(
    initialStartDate ?? null,
  )
  const [endDate, setEndDate] = useState<CalendarDate | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [globalError, setGlobalError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<{
    startDate?: string
    endDate?: string
  }>({})

  // ── Validation ────────────────────────────────────────────────────────────

  /**
   * Valide le formulaire et retourne true si tout est correct.
   * Met à jour fieldErrors avec les messages d'erreur.
   */
  function validate(): boolean {
    const errors: { startDate?: string; endDate?: string } = {}

    if (!startDate) {
      errors.startDate = 'La date de début est obligatoire.'
    }

    if (!endDate) {
      errors.endDate = 'La date de fin est obligatoire.'
    }

    // Exigence 1.3 : la date de fin doit être ≥ à la date de début
    if (startDate && endDate && endDate < startDate) {
      errors.endDate = 'La date de fin doit être égale ou postérieure à la date de début.'
    }

    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }

  // ── Soumission ────────────────────────────────────────────────────────────

  async function handleSubmit(): Promise<void> {
    setGlobalError(null)

    if (!validate()) return
    if (!startDate || !endDate) return

    setIsSubmitting(true)

    try {
      const useCase = new RecordPeriodUseCase(sharedRepository)
      const result = await useCase.execute(startDate, endDate)

      if (result.ok) {
        onSuccess()
      } else {
        // Mapper les codes d'erreur en messages lisibles
        const errorCode = result.error.code
        if (errorCode === 'INVALID_DATE_RANGE') {
          setFieldErrors(prev => ({
            ...prev,
            endDate: 'La date de fin doit être égale ou postérieure à la date de début.',
          }))
        } else {
          setGlobalError(
            result.error.message || 'Une erreur est survenue. Veuillez réessayer.',
          )
        }
      }
    } catch (e) {
      setGlobalError(
        e instanceof Error ? e.message : 'Une erreur inattendue est survenue.',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  // ── Gestion des changements de dates ──────────────────────────────────────

  function handleStartDateChange(date: CalendarDate | null): void {
    setStartDate(date)
    setFieldErrors(prev => ({ ...prev, startDate: undefined }))
    setGlobalError(null)

    // Si la date de fin est avant la nouvelle date de début, la réinitialiser
    if (date && endDate && endDate < date) {
      setEndDate(null)
      setFieldErrors(prev => ({ ...prev, endDate: undefined }))
    }
  }

  function handleEndDateChange(date: CalendarDate | null): void {
    setEndDate(date)
    setFieldErrors(prev => ({ ...prev, endDate: undefined }))
    setGlobalError(null)
  }

  // ── Rendu ─────────────────────────────────────────────────────────────────

  const canSubmit = startDate !== null && endDate !== null && !isSubmitting

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.keyboardAvoid}
    >
      <View style={styles.container}>
        {/* En-tête */}
        <View style={styles.header}>
          <Text style={styles.title} accessibilityRole="header">
            Enregistrer mes règles
          </Text>
          <TouchableOpacity
            onPress={onCancel}
            style={styles.cancelButton}
            accessible={true}
            accessibilityLabel="Annuler l'enregistrement"
            accessibilityRole="button"
            disabled={isSubmitting}
          >
            <Text style={styles.cancelButtonText}>Annuler</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.scrollView}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Instruction rapide */}
          <Text style={styles.instruction}>
            Appuyez sur "Aujourd'hui" pour remplir rapidement les dates.
          </Text>

          {/* Champ date de début */}
          {/* Exigence 1.1 : enregistrer la date de début */}
          <DatePickerField
            label="Date de début des règles"
            value={startDate}
            onChange={handleStartDateChange}
            error={fieldErrors.startDate}
            maxDate={new Date().toISOString().split('T')[0]}
            accessibilityLabel="Date de début des règles"
          />

          {/* Champ date de fin */}
          {/* Exigence 1.2 : enregistrer la date de fin */}
          <DatePickerField
            label="Date de fin des règles"
            value={endDate}
            onChange={handleEndDateChange}
            error={fieldErrors.endDate}
            minDate={startDate ?? undefined}
            maxDate={new Date().toISOString().split('T')[0]}
            accessibilityLabel="Date de fin des règles"
          />

          {/* Résumé de la durée (si les deux dates sont renseignées) */}
          {startDate !== null && endDate !== null && endDate >= startDate && (
            <DurationSummary startDate={startDate} endDate={endDate} />
          )}

          {/* Erreur globale */}
          {globalError !== null && (
            <View
              style={styles.globalErrorContainer}
              accessible={true}
              accessibilityRole="alert"
              accessibilityLiveRegion="assertive"
            >
              <Text style={styles.globalErrorText}>{globalError}</Text>
            </View>
          )}

          {/* Bouton Enregistrer */}
          <TouchableOpacity
            style={[styles.submitButton, !canSubmit && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={!canSubmit}
            accessible={true}
            accessibilityLabel={
              isSubmitting ? 'Enregistrement en cours…' : 'Enregistrer mes règles'
            }
            accessibilityRole="button"
            accessibilityState={{ disabled: !canSubmit, busy: isSubmitting }}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.submitButtonText}>Enregistrer</Text>
            )}
          </TouchableOpacity>

          <View style={styles.bottomSpacer} />
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  )
}

// ─── Résumé de la durée ───────────────────────────────────────────────────────

interface DurationSummaryProps {
  startDate: CalendarDate
  endDate: CalendarDate
}

/**
 * Affiche un résumé de la durée des règles calculée à partir des dates.
 * Fournit un retour visuel immédiat à l'utilisatrice.
 */
function DurationSummary({ startDate, endDate }: DurationSummaryProps): React.JSX.Element {
  const start = new Date(startDate + 'T00:00:00Z')
  const end = new Date(endDate + 'T00:00:00Z')
  const durationDays =
    Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1

  const durationText =
    durationDays === 1
      ? '1 jour de règles'
      : `${durationDays} jours de règles`

  return (
    <View
      style={summaryStyles.container}
      accessible={true}
      accessibilityLabel={`Durée calculée : ${durationText}`}
      accessibilityRole="text"
    >
      <Text style={summaryStyles.icon}>📅</Text>
      <Text style={summaryStyles.text}>{durationText}</Text>
    </View>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  keyboardAvoid: {
    flex: 1,
  },
  container: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#212121',
  },
  cancelButton: {
    padding: 8,
  },
  cancelButtonText: {
    fontSize: 15,
    color: '#9E9E9E',
    fontWeight: '500',
  },
  scrollView: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  instruction: {
    fontSize: 13,
    color: '#757575',
    marginBottom: 20,
    lineHeight: 18,
  },
  globalErrorContainer: {
    backgroundColor: '#FFEBEE',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    borderLeftWidth: 3,
    borderLeftColor: '#EF5350',
  },
  globalErrorText: {
    fontSize: 13,
    color: '#C62828',
    lineHeight: 18,
  },
  submitButton: {
    backgroundColor: '#E91E63',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
    shadowColor: '#E91E63',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  submitButtonDisabled: {
    backgroundColor: '#F48FB1',
    shadowOpacity: 0,
    elevation: 0,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  bottomSpacer: {
    height: 32,
  },
})

const summaryStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3E5F5',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    gap: 8,
  },
  icon: {
    fontSize: 16,
  },
  text: {
    fontSize: 14,
    color: '#6A1B9A',
    fontWeight: '600',
  },
})
