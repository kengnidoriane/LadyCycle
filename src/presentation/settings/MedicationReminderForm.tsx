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

// ─── Types ────────────────────────────────────────────────────────────────────

type ReminderFrequency = MedicationReminder['frequency']

interface MedicationReminderFormProps {
  onSave: (reminder: Omit<MedicationReminder, 'id' | 'createdAt' | 'updatedAt'>) => void
  onCancel: () => void
}

// ─── Composant ────────────────────────────────────────────────────────────────

export function MedicationReminderForm({
  onSave,
  onCancel,
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
      newErrors['name'] = 'Le nom du médicament est obligatoire'
    }

    if (timingBeforePeriod < 0 || timingBeforePeriod > 30) {
      newErrors['timing'] = 'Le délai doit être entre 0 et 30 jours'
    }

    const timeRegex = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/
    if (!timeRegex.test(timeOfDay)) {
      newErrors['time'] = 'Format invalide — utilisez HH:MM (ex: 08:30)'
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

  const FREQUENCY_OPTIONS: Array<{ value: ReminderFrequency; label: string }> = [
    { value: 'once_per_cycle', label: 'Une fois par cycle' },
    { value: 'daily', label: 'Quotidien' },
    { value: 'custom', label: 'Personnalisé' },
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
        <Text style={styles.title}>Nouveau rappel de médicament</Text>

        {/* Nom du médicament */}
        <View style={styles.field}>
          <Text style={styles.label}>Nom du médicament *</Text>
          <TextInput
            style={[styles.input, errors['name'] ? styles.inputError : null]}
            value={name}
            onChangeText={setName}
            placeholder="Ex : Ibuprofène 400mg"
            placeholderTextColor="#BDBDBD"
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
          <Text style={styles.label}>Fréquence</Text>
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
            Délai avant les règles : {timingBeforePeriod} jour{timingBeforePeriod > 1 ? 's' : ''}
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
          <Text style={styles.label}>Heure de prise (HH:MM)</Text>
          <TextInput
            style={[styles.input, errors['time'] ? styles.inputError : null]}
            value={timeOfDay}
            onChangeText={setTimeOfDay}
            placeholder="08:00"
            placeholderTextColor="#BDBDBD"
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
            <Text style={styles.cancelButtonText}>Annuler</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.saveButton}
            onPress={handleSave}
            accessibilityLabel="Enregistrer le rappel"
            accessibilityRole="button"
          >
            <Text style={styles.saveButtonText}>Enregistrer</Text>
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
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#212121',
    marginBottom: 20,
  },
  field: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#424242',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#212121',
    backgroundColor: '#FAFAFA',
  },
  inputError: {
    borderColor: '#EF5350',
  },
  errorText: {
    fontSize: 12,
    color: '#EF5350',
    marginTop: 4,
  },
  optionGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  optionButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    backgroundColor: '#FAFAFA',
  },
  optionButtonSelected: {
    borderColor: '#E91E63',
    backgroundColor: '#FCE4EC',
  },
  optionButtonText: {
    fontSize: 13,
    color: '#616161',
  },
  optionButtonTextSelected: {
    color: '#880E4F',
    fontWeight: '600',
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  stepperButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E91E63',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperButtonDisabled: {
    backgroundColor: '#E0E0E0',
  },
  stepperButtonText: {
    fontSize: 20,
    color: '#FFFFFF',
    fontWeight: '600',
    lineHeight: 24,
  },
  stepperValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#212121',
    minWidth: 32,
    textAlign: 'center',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 15,
    color: '#616161',
    fontWeight: '600',
  },
  saveButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: '#E91E63',
    alignItems: 'center',
  },
  saveButtonText: {
    fontSize: 15,
    color: '#FFFFFF',
    fontWeight: '700',
  },
})
