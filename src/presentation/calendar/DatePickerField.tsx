/**
 * DatePickerField — Sélecteur de date CalendarDate (YYYY-MM-DD).
 *
 * Composant de saisie de date adapté aux contraintes du projet :
 * - Stocke les dates au format CalendarDate (YYYY-MM-DD), indépendant du fuseau horaire
 * - Affiche la date en format lisible (ex : "15 jan. 2024")
 * - Propose un bouton "Aujourd'hui" pour la saisie rapide (1 interaction)
 * - Affiche un sélecteur de date natif via TextInput avec validation
 *
 * Note : React Native ne fournit pas de DatePicker natif cross-platform.
 * Ce composant utilise un TextInput avec validation de format pour rester
 * compatible sans dépendances supplémentaires. En production, on utiliserait
 * @react-native-community/datetimepicker.
 *
 * Exigences : 1.1, 1.2, 12.2 (saisie en ≤ 3 interactions)
 */

import React, { useState } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
} from 'react-native'
import type { CalendarDate } from '../../domain/shared/types'

// ─── Props ────────────────────────────────────────────────────────────────────

interface DatePickerFieldProps {
  /** Label affiché au-dessus du champ */
  label: string
  /** Valeur actuelle (YYYY-MM-DD ou null) */
  value: CalendarDate | null
  /** Callback quand la date change */
  onChange: (date: CalendarDate | null) => void
  /** Message d'erreur à afficher sous le champ */
  error?: string | null
  /** Date minimale autorisée (YYYY-MM-DD) */
  minDate?: CalendarDate
  /** Date maximale autorisée (YYYY-MM-DD) */
  maxDate?: CalendarDate
  /** Identifiant pour l'accessibilité */
  accessibilityLabel?: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Retourne la date d'aujourd'hui au format YYYY-MM-DD (UTC).
 */
function getTodayDate(): CalendarDate {
  return new Date().toISOString().split('T')[0]
}

/**
 * Valide qu'une chaîne est une CalendarDate valide (YYYY-MM-DD).
 */
function isValidCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  if (month < 1 || month > 12) return false
  if (day < 1 || day > 31) return false
  // Vérifier que la date existe réellement
  const d = new Date(Date.UTC(year, month - 1, day))
  return (
    d.getUTCFullYear() === year &&
    d.getUTCMonth() === month - 1 &&
    d.getUTCDate() === day
  )
}

/**
 * Formate une CalendarDate en date lisible.
 * Ex : "2024-01-15" → "15 jan. 2024"
 */
function formatDisplayDate(date: CalendarDate): string {
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
 * Champ de saisie de date avec bouton "Aujourd'hui".
 *
 * Flux de saisie (≤ 3 interactions) :
 * 1. Tap sur "Aujourd'hui" → date remplie automatiquement (1 interaction)
 * 2. OU : tap sur le champ → saisir YYYY-MM-DD → valider (2-3 interactions)
 *
 * Validation en temps réel : le format YYYY-MM-DD est vérifié à chaque frappe.
 */
export function DatePickerField({
  label,
  value,
  onChange,
  error,
  minDate,
  maxDate,
  accessibilityLabel,
}: DatePickerFieldProps): React.JSX.Element {
  const [inputText, setInputText] = useState(value ?? '')
  const [isFocused, setIsFocused] = useState(false)

  const today = getTodayDate()
  const displayValue = value ? formatDisplayDate(value) : ''

  function handleTodayPress(): void {
    const todayDate = today
    setInputText(todayDate)
    onChange(todayDate)
  }

  function handleTextChange(text: string): void {
    setInputText(text)

    // Valider et mettre à jour si le format est correct
    if (text === '') {
      onChange(null)
    } else if (isValidCalendarDate(text)) {
      // Vérifier les contraintes min/max
      if (minDate && text < minDate) return
      if (maxDate && text > maxDate) return
      onChange(text as CalendarDate)
    }
  }

  function handleBlur(): void {
    setIsFocused(false)
    // Si le texte n'est pas une date valide, réinitialiser
    if (inputText && !isValidCalendarDate(inputText)) {
      setInputText(value ?? '')
    }
  }

  const a11yLabel = accessibilityLabel ?? label

  return (
    <View style={styles.container}>
      {/* Label */}
      <Text style={styles.label} nativeID={`label-${a11yLabel}`}>
        {label}
      </Text>

      {/* Champ de saisie + bouton Aujourd'hui */}
      <View style={styles.inputRow}>
        <View
          style={[
            styles.inputContainer,
            isFocused && styles.inputFocused,
            error ? styles.inputError : null,
          ]}
        >
          {/* Affichage de la date formatée quand non focalisé */}
          {!isFocused && value !== null ? (
            <TouchableOpacity
              style={styles.displayValue}
              onPress={() => setIsFocused(true)}
              accessible={true}
              accessibilityLabel={`${a11yLabel} : ${displayValue}. Appuyez pour modifier.`}
              accessibilityRole="button"
            >
              <Text style={styles.displayValueText}>{displayValue}</Text>
            </TouchableOpacity>
          ) : (
            <TextInput
              style={styles.textInput}
              value={inputText}
              onChangeText={handleTextChange}
              onFocus={() => setIsFocused(true)}
              onBlur={handleBlur}
              placeholder="AAAA-MM-JJ"
              placeholderTextColor="#BDBDBD"
              keyboardType="numeric"
              maxLength={10}
              accessible={true}
              accessibilityLabel={`${a11yLabel}, format année-mois-jour`}
              accessibilityHint="Saisissez la date au format AAAA-MM-JJ ou appuyez sur Aujourd'hui"
            />
          )}
        </View>

        {/* Bouton Aujourd'hui — 1 interaction pour la date du jour */}
        <TouchableOpacity
          style={[
            styles.todayButton,
            value === today && styles.todayButtonActive,
          ]}
          onPress={handleTodayPress}
          accessible={true}
          accessibilityLabel={`Définir ${label.toLowerCase()} à aujourd'hui`}
          accessibilityRole="button"
        >
          <Text
            style={[
              styles.todayButtonText,
              value === today && styles.todayButtonTextActive,
            ]}
          >
            Aujourd'hui
          </Text>
        </TouchableOpacity>
      </View>

      {/* Message d'erreur */}
      {error ? (
        <Text
          style={styles.errorText}
          accessible={true}
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
        >
          {error}
        </Text>
      ) : null}
    </View>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#424242',
    marginBottom: 6,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  inputContainer: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: '#E0E0E0',
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    minHeight: 48,
    justifyContent: 'center',
  },
  inputFocused: {
    borderColor: '#E91E63',
  },
  inputError: {
    borderColor: '#EF5350',
  },
  displayValue: {
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  displayValueText: {
    fontSize: 15,
    color: '#212121',
  },
  textInput: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#212121',
  },
  todayButton: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#FCE4EC',
    borderWidth: 1.5,
    borderColor: '#F48FB1',
  },
  todayButtonActive: {
    backgroundColor: '#E91E63',
    borderColor: '#E91E63',
  },
  todayButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#E91E63',
  },
  todayButtonTextActive: {
    color: '#FFFFFF',
  },
  errorText: {
    marginTop: 4,
    fontSize: 12,
    color: '#EF5350',
  },
})
