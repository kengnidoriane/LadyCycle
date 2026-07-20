/**
 * MedicationReminderForm — Formulaire d'ajout d'un rappel de médicament.
 *
 * Champs :
 * - Nom du médicament (texte libre)
 * - Fréquence (once_per_cycle, daily, custom)
 * - Délai avant les règles (0-30 jours)
 * - Heure de prise (HH:MM)
 *
 * Exigences : 6.1, 6.5
 */

import React, { useState } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import type { MedicationReminder } from '../../infrastructure/db/CycleRepository'
import { colors, spacing, radii } from '../theme'

// ─── Types ────────────────────────────────────────────────────────────────────

type ReminderFrequency = MedicationReminder['frequency']

interface MedicationReminderFormProps {
  onSave: (reminder: Omit<MedicationReminder, 'id' | 'createdAt' | 'updatedAt'>) => void
  onCancel: () => void
  /** Langue française active (sinon anglais). */
  fr?: boolean
}

// ─── Composant ────────────────────────────────────────────────────────────────

export function MedicationReminderForm({
  onSave,
  onCancel,
  fr = true,
}: MedicationReminderFormProps): React.JSX.Element {
  const [name, setName] = useState('')
  const [frequency, setFrequency] = useState<ReminderFrequency>('once_per_cycle')
  const [timingBeforePeriod, setTimingBeforePeriod] = useState(2)
  const [timeOfDay, setTimeOfDay] = useState('08:00')
  const [errors, setErrors] = useState<Record<string, string>>({})

  // ── Validation ────────────────────────────────────────────────────────────

  function validate(): boolean {
    const newErrors: Record<string, string> = {}

    if (!name.trim()) {
      newErrors['name'] = fr ? 'Le nom du médicament est obligatoire' : 'Medication name is required'
    }

    if (timingBeforePeriod < 0 || timingBeforePeriod > 30) {
      newErrors['timing'] = fr ? 'Le délai doit être entre 0 et 30 jours' : 'The lead time must be between 0 and 30 days'
    }

    const timeRegex = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/
    if (!timeRegex.test(timeOfDay)) {
      newErrors['time'] = fr ? 'Format invalide — utilisez HH:MM (ex: 08:30)' : 'Invalid format — use HH:MM (e.g. 08:30)'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  function handleSave(): void {
    if (!validate()) return

    onSave({
      name: name.trim(),
      frequency,
      timingBeforePeriod,
      timeOfDay,
      enabled: true,
    })
  }

  // ── Rendu ─────────────────────────────────────────────────────────────────

  const FREQUENCY_OPTIONS: Array<{ value: ReminderFrequency; label: string }> = fr
    ? [
        { value: 'once_per_cycle', label: 'Une fois par cycle' },
        { value: 'daily', label: 'Quotidien' },
        { value: 'custom', label: 'Personnalisé' },
      ]
    : [
        { value: 'once_per_cycle', label: 'Once per cycle' },
        { value: 'daily', label: 'Daily' },
        { value: 'custom', label: 'Custom' },
      ]

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>{fr ? 'Nouveau rappel de médicament' : 'New medication reminder'}</Text>

        {/* Nom du médicament */}
        <View style={styles.field}>
          <Text style={styles.label}>{fr ? 'Nom du médicament *' : 'Medication name *'}</Text>
          <TextInput
            style={[styles.input, errors['name'] ? styles.inputError : null]}
            value={name}
            onChangeText={setName}
            placeholder={fr ? 'Ex : Ibuprofène 400mg' : 'e.g. Ibuprofen 400mg'}
            placeholderTextColor={colors.textTertiary}
            accessibilityLabel="Nom du médicament"
            accessibilityHint="Entrez le nom du médicament à rappeler"
            returnKeyType="next"
            autoCapitalize="words"
          />
          {errors['name'] ? (
            <Text style={styles.errorText} accessibilityRole="alert">
              {errors['name']}
            </Text>
          ) : null}
        </View>

        {/* Fréquence */}
        <View style={styles.field}>
          <Text style={styles.label}>{fr ? 'Fréquence' : 'Frequency'}</Text>
          <View
            style={styles.optionGroup}
            accessible={true}
            accessibilityLabel="Fréquence du rappel"
            accessibilityRole="radiogroup"
          >
            {FREQUENCY_OPTIONS.map(opt => (
              <TouchableOpacity
                key={opt.value}
                style={[
                  styles.optionButton,
                  frequency === opt.value && styles.optionButtonSelected,
                ]}
                onPress={() => setFrequency(opt.value)}
                accessibilityRole="radio"
                accessibilityState={{ checked: frequency === opt.value }}
                accessibilityLabel={opt.label}
              >
                <Text
                  style={[
                    styles.optionButtonText,
                    frequency === opt.value && styles.optionButtonTextSelected,
                  ]}
                >
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Délai avant les règles */}
        <View style={styles.field}>
          <Text style={styles.label}>
            {fr
              ? `Délai avant les règles : ${timingBeforePeriod} jour${timingBeforePeriod > 1 ? 's' : ''}`
              : `Lead time before period: ${timingBeforePeriod} day${timingBeforePeriod > 1 ? 's' : ''}`}
          </Text>
          <View style={styles.stepperRow}>
            <TouchableOpacity
              style={[styles.stepperButton, timingBeforePeriod <= 0 && styles.stepperButtonDisabled]}
              onPress={() => setTimingBeforePeriod(d => Math.max(0, d - 1))}
              disabled={timingBeforePeriod <= 0}
              accessibilityLabel="Diminuer le délai d'un jour"
              accessibilityRole="button"
            >
              <Text style={styles.stepperButtonText}>−</Text>
            </TouchableOpacity>
            <Text
              style={styles.stepperValue}
              accessibilityLabel={`${timingBeforePeriod} jour${timingBeforePeriod > 1 ? 's' : ''} avant les règles`}
            >
              {timingBeforePeriod}
            </Text>
            <TouchableOpacity
              style={[styles.stepperButton, timingBeforePeriod >= 30 && styles.stepperButtonDisabled]}
              onPress={() => setTimingBeforePeriod(d => Math.min(30, d + 1))}
              disabled={timingBeforePeriod >= 30}
              accessibilityLabel="Augmenter le délai d'un jour"
              accessibilityRole="button"
            >
              <Text style={styles.stepperButtonText}>+</Text>
            </TouchableOpacity>
          </View>
          {errors['timing'] ? (
            <Text style={styles.errorText} accessibilityRole="alert">
              {errors['timing']}
            </Text>
          ) : null}
        </View>

        {/* Heure de prise */}
        <View style={styles.field}>
          <Text style={styles.label}>{fr ? 'Heure de prise (HH:MM)' : 'Time of day (HH:MM)'}</Text>
          <TextInput
            style={[styles.input, errors['time'] ? styles.inputError : null]}
            value={timeOfDay}
            onChangeText={setTimeOfDay}
            placeholder="08:00"
            placeholderTextColor={colors.textTertiary}
            keyboardType="numbers-and-punctuation"
            accessibilityLabel="Heure de prise du médicament"
            accessibilityHint="Format HH:MM, par exemple 08:30"
            maxLength={5}
          />
          {errors['time'] ? (
            <Text style={styles.errorText} accessibilityRole="alert">
              {errors['time']}
            </Text>
          ) : null}
        </View>

        {/* Boutons */}
        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={onCancel}
            accessibilityLabel="Annuler"
            accessibilityRole="button"
          >
            <Text style={styles.cancelButtonText}>{fr ? 'Annuler' : 'Cancel'}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.saveButton}
            onPress={handleSave}
            accessibilityLabel={fr ? 'Enregistrer le rappel' : 'Save reminder'}
            accessibilityRole="button"
          >
            <Text style={styles.saveButtonText}>{fr ? 'Enregistrer' : 'Save'}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
  },
  scrollContent: {
    padding: spacing.xl,
    paddingBottom: 40,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.xl,
  },
  field: {
    marginBottom: spacing.xl,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.textPrimary,
    backgroundColor: colors.background,
  },
  inputError: {
    borderColor: colors.danger,
  },
  errorText: {
    fontSize: 12,
    color: colors.danger,
    marginTop: 4,
  },
  optionGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  optionButton: {
    paddingHorizontal: 14,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  optionButtonSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  optionButtonText: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  optionButtonTextSelected: {
    color: colors.primaryDark,
    fontWeight: '600',
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  stepperButton: {
    width: 40,
    height: 40,
    borderRadius: radii.pill,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperButtonDisabled: {
    backgroundColor: colors.border,
  },
  stepperButtonText: {
    fontSize: 20,
    color: colors.textInverse,
    fontWeight: '600',
    lineHeight: 24,
  },
  stepperValue: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
    minWidth: 32,
    textAlign: 'center',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 15,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  saveButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: radii.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
  },
  saveButtonText: {
    fontSize: 15,
    color: colors.textInverse,
    fontWeight: '700',
  },
})
