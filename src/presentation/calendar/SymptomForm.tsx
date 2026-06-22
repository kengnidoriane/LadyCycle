/**
 * SymptomForm — saisie d'un symptôme du jour.
 *
 * Catégories prédéfinies, types par catégorie, intensité 1-5 (douleurs
 * uniquement), notes. Restylé avec le système de design.
 *
 * Règle métier : le sélecteur d'intensité n'apparaît que si category === 'pain'.
 *
 * Exigences : 5.1, 5.2, 5.3, 5.4
 */

import React, { useState } from 'react'
import { View, StyleSheet, TouchableOpacity, TextInput } from 'react-native'
import type { SymptomCategory, SymptomType } from '../../domain/symptoms/types'
import { SymptomTracker } from '../../domain/symptoms/SymptomTracker'
import type { CalendarDate } from '../../domain/shared/types'
import { today } from '../../domain/shared/calendarDate'
import { sharedRepository } from './useCalendar'
import { AppText, Button, Icon } from '../components'
import type { IconName } from '../components'
import { colors, spacing, radii } from '../theme'
import { useI18n } from '../i18n/I18nContext'

interface CategoryConfig {
  label: string
  icon: IconName
  color: string
  soft: string
}

function getCategoryConfig(fr: boolean): Record<SymptomCategory, CategoryConfig> {
  return {
    pain: { label: fr ? 'Douleurs' : 'Pain', icon: 'droplet', color: colors.phase.menstrual.text, soft: colors.phase.menstrual.soft },
    mood: { label: fr ? 'Humeur' : 'Mood', icon: 'heart', color: colors.phase.luteal.text, soft: colors.phase.luteal.soft },
    energy: { label: fr ? 'Énergie' : 'Energy', icon: 'sparkles', color: colors.phase.ovulation.text, soft: colors.phase.ovulation.soft },
    physical: { label: fr ? 'Physique' : 'Physical', icon: 'leaf', color: colors.phase.follicular.text, soft: colors.phase.follicular.soft },
    sleep: { label: fr ? 'Sommeil' : 'Sleep', icon: 'moon', color: colors.infoText, soft: colors.infoSoft },
  }
}

function getTypesByCategory(fr: boolean): Record<SymptomCategory, Array<{ type: SymptomType; label: string }>> {
  return {
    pain: [
      { type: 'cramps', label: fr ? 'Crampes' : 'Cramps' },
      { type: 'headache', label: fr ? 'Maux de tête' : 'Headache' },
      { type: 'back_pain', label: fr ? 'Douleurs dorsales' : 'Back pain' },
      { type: 'breast_tenderness', label: fr ? 'Sensibilité des seins' : 'Breast tenderness' },
    ],
    mood: [
      { type: 'irritable', label: fr ? 'Irritabilité' : 'Irritability' },
      { type: 'anxious', label: fr ? 'Anxiété' : 'Anxiety' },
      { type: 'happy', label: fr ? 'Bonne humeur' : 'Happy' },
      { type: 'sad', label: fr ? 'Tristesse' : 'Sad' },
      { type: 'mood_swings', label: fr ? "Sautes d'humeur" : 'Mood swings' },
    ],
    energy: [
      { type: 'high_energy', label: fr ? 'Énergie élevée' : 'High energy' },
      { type: 'low_energy', label: fr ? 'Énergie faible' : 'Low energy' },
      { type: 'fatigue', label: fr ? 'Fatigue' : 'Fatigue' },
    ],
    physical: [
      { type: 'bloating', label: fr ? 'Ballonnements' : 'Bloating' },
      { type: 'acne', label: fr ? 'Acné' : 'Acne' },
      { type: 'nausea', label: fr ? 'Nausées' : 'Nausea' },
      { type: 'food_cravings', label: fr ? 'Envies alimentaires' : 'Food cravings' },
    ],
    sleep: [
      { type: 'insomnia', label: fr ? 'Insomnie' : 'Insomnia' },
      { type: 'good_sleep', label: fr ? 'Bon sommeil' : 'Good sleep' },
      { type: 'restless_sleep', label: fr ? 'Sommeil agité' : 'Restless sleep' },
    ],
  }
}

function getIntensityLabels(fr: boolean): Record<number, string> {
  return fr
    ? { 1: 'Très légère', 2: 'Légère', 3: 'Modérée', 4: 'Intense', 5: 'Très intense' }
    : { 1: 'Very mild', 2: 'Mild', 3: 'Moderate', 4: 'Intense', 5: 'Very intense' }
}

interface SymptomFormProps {
  date?: CalendarDate
  cycleId?: string
  onSuccess?: () => void
  onCancel?: () => void
}

export function SymptomForm({ date, cycleId, onSuccess, onCancel }: SymptomFormProps): React.JSX.Element {
  const symptomDate = date ?? today()

  const { currentLanguage } = useI18n()
  const fr = currentLanguage !== 'en'
  const categoryConfig = getCategoryConfig(fr)
  const typesByCategory = getTypesByCategory(fr)
  const intensityLabels = getIntensityLabels(fr)

  const [selectedCategory, setSelectedCategory] = useState<SymptomCategory | null>(null)
  const [selectedType, setSelectedType] = useState<SymptomType | null>(null)
  const [intensity, setIntensity] = useState<number>(3)
  const [notes, setNotes] = useState<string>('')
  const [validationError, setValidationError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  function handleCategorySelect(category: SymptomCategory): void {
    setSelectedCategory(category)
    setSelectedType(null)
    setValidationError(null)
    setIntensity(3)
  }

  async function handleSubmit(): Promise<void> {
    if (selectedCategory === null || selectedType === null) {
      setValidationError(fr ? 'Veuillez sélectionner une catégorie et un type de symptôme.' : 'Please select a category and a symptom type.')
      return
    }

    setIsSubmitting(true)
    setValidationError(null)

    try {
      const tracker = new SymptomTracker()
      const symptomData: { type: SymptomType; intensity?: number; notes?: string } = {
        type: selectedType,
        notes: notes.trim() !== '' ? notes.trim() : undefined,
      }
      if (selectedCategory === 'pain') {
        symptomData.intensity = intensity
      }

      const result = tracker.recordSymptom(symptomDate, symptomData, cycleId)

      if (!result.ok) {
        setValidationError(result.error.message)
        return
      }

      // Rattacher le symptôme à un cycle. Si aucun cycle n'existe pour cette
      // date, on ne perd plus le symptôme silencieusement : on prévient
      // l'utilisatrice qu'il faut d'abord enregistrer des règles.
      const cyclesResult = sharedRepository.loadAllCycles()
      const targetCycleId =
        cyclesResult.ok ? cycleId ?? findCurrentCycleId(cyclesResult.value, symptomDate) : null

      if (targetCycleId === null) {
        setValidationError(
          fr
            ? "Enregistre d'abord tes règles pour pouvoir y rattacher un symptôme."
            : 'Log a period first so the symptom can be attached to a cycle.',
        )
        return
      }

      const cycleResult = sharedRepository.loadCycle(targetCycleId)
      if (cycleResult.ok && cycleResult.value !== null) {
        const cycle = cycleResult.value
        const repoSymptom = { ...result.value, cycleId: targetCycleId }
        sharedRepository.saveCycle({ ...cycle, symptoms: [...cycle.symptoms, repoSymptom] })
      }
      onSuccess?.()
    } catch (e) {
      setValidationError(e instanceof Error ? e.message : fr ? 'Erreur inattendue' : 'Unexpected error')
    } finally {
      setIsSubmitting(false)
    }
  }

  const canSubmit = selectedCategory !== null && selectedType !== null && !isSubmitting
  const activeConfig = selectedCategory ? categoryConfig[selectedCategory] : null

  return (
    <View style={styles.container}>
      <View style={styles.grabber} />

      <View style={styles.header}>
        <View>
          <AppText variant="h3">{fr ? 'Noter un symptôme' : 'Log a symptom'}</AppText>
          <AppText variant="caption" tone="tertiary">
            {formatDate(symptomDate, fr)}
          </AppText>
        </View>
        {onCancel && (
          <TouchableOpacity onPress={onCancel} style={styles.closeButton} accessibilityRole="button" accessibilityLabel={fr ? 'Annuler' : 'Cancel'}>
            <Icon name="close" size={22} color={colors.textSecondary} />
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.body}>
        {/* Catégorie */}
        <AppText variant="label" tone="secondary" style={styles.sectionLabel}>
          {fr ? 'Catégorie' : 'Category'}
        </AppText>
        <View style={styles.categoryGrid} accessibilityRole="radiogroup">
          {(Object.keys(categoryConfig) as SymptomCategory[]).map((category) => {
            const config = categoryConfig[category]
            const isSelected = selectedCategory === category
            return (
              <TouchableOpacity
                key={category}
                activeOpacity={0.7}
                style={[
                  styles.categoryButton,
                  isSelected && { backgroundColor: config.soft, borderColor: config.color },
                ]}
                onPress={() => handleCategorySelect(category)}
                accessibilityRole="radio"
                accessibilityState={{ checked: isSelected }}
                accessibilityLabel={config.label}
              >
                <Icon name={config.icon} size={18} color={isSelected ? config.color : colors.textSecondary} />
                <AppText
                  variant="caption"
                  style={isSelected ? { color: config.color, fontWeight: '700' } : { color: colors.textSecondary }}
                >
                  {config.label}
                </AppText>
              </TouchableOpacity>
            )
          })}
        </View>

        {/* Type */}
        {selectedCategory !== null && activeConfig && (
          <>
            <AppText variant="label" tone="secondary" style={styles.sectionLabel}>
              {fr ? 'Type de symptôme' : 'Symptom type'}
            </AppText>
            <View style={styles.typeGrid} accessibilityRole="radiogroup">
              {typesByCategory[selectedCategory].map(({ type, label }) => {
                const isSelected = selectedType === type
                return (
                  <TouchableOpacity
                    key={type}
                    activeOpacity={0.7}
                    style={[
                      styles.typeButton,
                      isSelected && { backgroundColor: activeConfig.soft, borderColor: activeConfig.color },
                    ]}
                    onPress={() => {
                      setSelectedType(type)
                      setValidationError(null)
                    }}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: isSelected }}
                    accessibilityLabel={label}
                  >
                    <AppText
                      variant="caption"
                      style={isSelected ? { color: activeConfig.color, fontWeight: '700' } : { color: colors.textSecondary }}
                    >
                      {label}
                    </AppText>
                  </TouchableOpacity>
                )
              })}
            </View>
          </>
        )}

        {/* Intensité (douleurs) */}
        {selectedCategory === 'pain' && (
          <>
            <AppText variant="label" tone="secondary" style={styles.sectionLabel}>
              {fr ? 'Intensité de la douleur' : 'Pain intensity'}
            </AppText>
            <AppText variant="caption" center style={[styles.intensityLabel, { color: colors.phase.menstrual.text }]}>
              {intensity} / 5 — {intensityLabels[intensity]}
            </AppText>
            <View style={styles.intensityRow} accessibilityRole="radiogroup">
              {[1, 2, 3, 4, 5].map((value) => {
                const isSelected = intensity === value
                return (
                  <TouchableOpacity
                    key={value}
                    activeOpacity={0.7}
                    style={[styles.intensityButton, isSelected && styles.intensityButtonSelected]}
                    onPress={() => setIntensity(value)}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: isSelected }}
                    accessibilityLabel={fr ? `Intensité ${value} sur 5 : ${intensityLabels[value]}` : `Intensity ${value} of 5: ${intensityLabels[value]}`}
                  >
                    <AppText
                      variant="h3"
                      style={isSelected ? { color: colors.phase.menstrual.text } : { color: colors.textTertiary }}
                    >
                      {value}
                    </AppText>
                  </TouchableOpacity>
                )
              })}
            </View>
          </>
        )}

        {/* Notes */}
        <AppText variant="label" tone="secondary" style={styles.sectionLabel}>
          {fr ? 'Notes (optionnel)' : 'Notes (optional)'}
        </AppText>
        <TextInput
          style={styles.notesInput}
          value={notes}
          onChangeText={setNotes}
          placeholder={fr ? 'Ajoute des détails sur ce symptôme…' : 'Add details about this symptom…'}
          placeholderTextColor={colors.textTertiary}
          multiline
          numberOfLines={3}
          maxLength={500}
          accessibilityLabel={fr ? 'Notes sur le symptôme' : 'Notes about the symptom'}
        />

        {validationError !== null && (
          <View style={styles.errorContainer} accessibilityRole="alert">
            <AppText variant="caption" style={{ color: colors.confidence.low.text }}>
              {validationError}
            </AppText>
          </View>
        )}

        <Button label={fr ? 'Enregistrer' : 'Save'} icon="check" onPress={handleSubmit} loading={isSubmitting} disabled={!canSubmit} style={styles.submit} />
      </View>
    </View>
  )
}

function formatDate(date: CalendarDate, fr: boolean): string {
  const [year, month, day] = date.split('-').map(Number)
  const d = new Date(Date.UTC(year, month - 1, day))
  return d.toLocaleDateString(fr ? 'fr-FR' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
}

function findCurrentCycleId(
  cycles: Array<{ id: string; startDate: CalendarDate; endDate: CalendarDate | null }>,
  date: CalendarDate,
): string | null {
  for (const cycle of cycles) {
    if (date >= cycle.startDate) {
      if (cycle.endDate === null || date <= cycle.endDate) {
        return cycle.id
      }
    }
  }
  return null
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.xxl,
    borderTopRightRadius: radii.xxl,
    maxHeight: '92%',
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
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  closeButton: {
    padding: spacing.sm,
  },
  body: {
    padding: spacing.xl,
  },
  sectionLabel: {
    marginBottom: spacing.sm,
    marginTop: spacing.md,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  categoryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  typeButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: 9,
    borderRadius: radii.pill,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  intensityLabel: {
    fontWeight: '600',
    marginBottom: spacing.md,
  },
  intensityRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  intensityButton: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  intensityButtonSelected: {
    backgroundColor: colors.phase.menstrual.soft,
    borderColor: colors.phase.menstrual.main,
  },
  notesInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: spacing.md,
    fontSize: 14,
    color: colors.textPrimary,
    backgroundColor: colors.background,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  errorContainer: {
    backgroundColor: colors.dangerSoft,
    borderRadius: radii.sm,
    padding: spacing.md,
    marginTop: spacing.md,
    borderLeftWidth: 3,
    borderLeftColor: colors.danger,
  },
  submit: {
    marginTop: spacing.lg,
  },
})
