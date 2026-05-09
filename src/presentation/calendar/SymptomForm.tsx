/**
 * SymptomForm — Formulaire de saisie des symptômes.
 *
 * Affiche :
 * - Les catégories prédéfinies (douleurs, humeur, énergie, physique, sommeil)
 * - Les types de symptômes pour la catégorie sélectionnée
 * - Le sélecteur d'intensité (1-5) UNIQUEMENT pour la catégorie `pain`
 * - Un champ de notes optionnel
 *
 * Règle métier clé :
 *   Le sélecteur d'intensité n'apparaît que si category === 'pain'.
 *   Cette règle reflète exactement la validation de SymptomTracker.recordSymptom().
 *
 * Accessibilité :
 *   - Chaque élément interactif a un accessibilityLabel
 *   - Le slider d'intensité annonce "Intensité de la douleur : X sur 5"
 *   - Les groupes de boutons utilisent accessibilityRole="radiogroup"
 *
 * Exigences : 5.1, 5.2, 5.3, 5.4
 */

import React, { useState } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ScrollView,
  StyleSheet,
  SafeAreaView,
} from 'react-native'
import type { SymptomCategory, SymptomType } from '../../domain/symptoms/types'
import { SYMPTOM_TYPE_TO_CATEGORY } from '../../domain/symptoms/types'
import { SymptomTracker } from '../../domain/symptoms/SymptomTracker'
import type { CalendarDate } from '../../domain/shared/types'
import { today } from '../../domain/shared/calendarDate'
import { sharedRepository } from './useCalendar'

// ─── Données de configuration des catégories ─────────────────────────────────

interface CategoryConfig {
  label: string
  emoji: string
  color: string
  backgroundColor: string
}

const CATEGORY_CONFIG: Record<SymptomCategory, CategoryConfig> = {
  pain: {
    label: 'Douleurs',
    emoji: '🔴',
    color: '#C62828',
    backgroundColor: '#FFEBEE',
  },
  mood: {
    label: 'Humeur',
    emoji: '💜',
    color: '#6A1B9A',
    backgroundColor: '#F3E5F5',
  },
  energy: {
    label: 'Énergie',
    emoji: '⚡',
    color: '#E65100',
    backgroundColor: '#FFF3E0',
  },
  physical: {
    label: 'Physique',
    emoji: '🌿',
    color: '#2E7D32',
    backgroundColor: '#E8F5E9',
  },
  sleep: {
    label: 'Sommeil',
    emoji: '🌙',
    color: '#1565C0',
    backgroundColor: '#E3F2FD',
  },
}

// ─── Types de symptômes par catégorie ────────────────────────────────────────

const SYMPTOM_TYPES_BY_CATEGORY: Record<SymptomCategory, Array<{ type: SymptomType; label: string }>> = {
  pain: [
    { type: 'cramps', label: 'Crampes' },
    { type: 'headache', label: 'Maux de tête' },
    { type: 'back_pain', label: 'Douleurs dorsales' },
    { type: 'breast_tenderness', label: 'Sensibilité des seins' },
  ],
  mood: [
    { type: 'irritable', label: 'Irritabilité' },
    { type: 'anxious', label: 'Anxiété' },
    { type: 'happy', label: 'Bonne humeur' },
    { type: 'sad', label: 'Tristesse' },
    { type: 'mood_swings', label: 'Sautes d\'humeur' },
  ],
  energy: [
    { type: 'high_energy', label: 'Énergie élevée' },
    { type: 'low_energy', label: 'Énergie faible' },
    { type: 'fatigue', label: 'Fatigue' },
  ],
  physical: [
    { type: 'bloating', label: 'Ballonnements' },
    { type: 'acne', label: 'Acné' },
    { type: 'nausea', label: 'Nausées' },
    { type: 'food_cravings', label: 'Envies alimentaires' },
  ],
  sleep: [
    { type: 'insomnia', label: 'Insomnie' },
    { type: 'good_sleep', label: 'Bon sommeil' },
    { type: 'restless_sleep', label: 'Sommeil agité' },
  ],
}

// ─── Labels d'intensité ───────────────────────────────────────────────────────

const INTENSITY_LABELS: Record<number, string> = {
  1: 'Très légère',
  2: 'Légère',
  3: 'Modérée',
  4: 'Intense',
  5: 'Très intense',
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface SymptomFormProps {
  /** Date pour laquelle enregistrer le symptôme (défaut : aujourd'hui) */
  date?: CalendarDate
  /** Identifiant du cycle associé (optionnel) */
  cycleId?: string
  /** Callback appelé après enregistrement réussi */
  onSuccess?: () => void
  /** Callback appelé si l'utilisatrice annule */
  onCancel?: () => void
}

// ─── Composant ────────────────────────────────────────────────────────────────

/**
 * Formulaire de saisie d'un symptôme.
 *
 * Flux de saisie (≤ 3 interactions) :
 *   1. Sélectionner une catégorie
 *   2. Sélectionner un type de symptôme
 *   3. (Si pain) Sélectionner l'intensité → Enregistrer
 *
 * Exigences : 5.1, 5.2, 5.3, 5.4
 */
export function SymptomForm({
  date,
  cycleId,
  onSuccess,
  onCancel,
}: SymptomFormProps): React.JSX.Element {
  const symptomDate = date ?? today()

  // ── État du formulaire ────────────────────────────────────────────────────

  const [selectedCategory, setSelectedCategory] = useState<SymptomCategory | null>(null)
  const [selectedType, setSelectedType] = useState<SymptomType | null>(null)
  // Intensité : uniquement pour la catégorie 'pain', défaut à 3
  const [intensity, setIntensity] = useState<number>(3)
  const [notes, setNotes] = useState<string>('')
  const [validationError, setValidationError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // ── Handlers ──────────────────────────────────────────────────────────────

  function handleCategorySelect(category: SymptomCategory): void {
    setSelectedCategory(category)
    setSelectedType(null)
    setValidationError(null)
    // Réinitialiser l'intensité à 3 lors du changement de catégorie
    setIntensity(3)
  }

  function handleTypeSelect(type: SymptomType): void {
    setSelectedType(type)
    setValidationError(null)
  }

  function handleIntensitySelect(value: number): void {
    setIntensity(value)
  }

  async function handleSubmit(): Promise<void> {
    // Validation : catégorie et type requis
    if (selectedCategory === null || selectedType === null) {
      setValidationError('Veuillez sélectionner une catégorie et un type de symptôme.')
      return
    }

    setIsSubmitting(true)
    setValidationError(null)

    try {
      const tracker = new SymptomTracker()

      // Préparer les données du symptôme
      const symptomData: { type: SymptomType; intensity?: number; notes?: string } = {
        type: selectedType,
        notes: notes.trim() !== '' ? notes.trim() : undefined,
      }

      // Ajouter l'intensité uniquement pour la catégorie 'pain'
      if (selectedCategory === 'pain') {
        symptomData.intensity = intensity
      }

      const result = tracker.recordSymptom(symptomDate, symptomData, cycleId)

      if (result.ok) {
        // Persister le symptôme dans le repository
        // On charge le cycle actuel et on y ajoute le symptôme
        const cyclesResult = sharedRepository.loadAllCycles()
        if (cyclesResult.ok) {
          const targetCycleId = cycleId ?? findCurrentCycleId(cyclesResult.value, symptomDate)
          if (targetCycleId !== null) {
            const cycleResult = sharedRepository.loadCycle(targetCycleId)
            if (cycleResult.ok && cycleResult.value !== null) {
              const cycle = cycleResult.value
              // Convert domain Symptom to repository Symptom (add cycleId)
              const domainSymptom = result.value
              const repoSymptom = {
                ...domainSymptom,
                cycleId: targetCycleId,
              }
              const updatedCycle = {
                ...cycle,
                symptoms: [...cycle.symptoms, repoSymptom],
              }
              sharedRepository.saveCycle(updatedCycle)
            }
          }
        }

        onSuccess?.()
      } else {
        setValidationError(result.error.message)
      }
    } catch (e) {
      setValidationError(e instanceof Error ? e.message : 'Erreur inattendue')
    } finally {
      setIsSubmitting(false)
    }
  }

  // ── Rendu ─────────────────────────────────────────────────────────────────

  const canSubmit =
    selectedCategory !== null &&
    selectedType !== null &&
    !isSubmitting

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ── En-tête ────────────────────────────────────────────────────── */}
        <View style={styles.header}>
          <Text style={styles.title} accessibilityRole="header">
            Enregistrer un symptôme
          </Text>
          <Text style={styles.dateLabel} accessibilityElementsHidden={true}>
            {formatDate(symptomDate)}
          </Text>
        </View>

        {/* ── Sélection de catégorie ──────────────────────────────────────── */}
        {/* Exigence 5.2 : catégories prédéfinies */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Catégorie</Text>
          <View
            style={styles.categoryGrid}
            accessible={true}
            accessibilityLabel="Sélectionnez une catégorie de symptôme"
            accessibilityRole="radiogroup"
          >
            {(Object.keys(CATEGORY_CONFIG) as SymptomCategory[]).map(category => {
              const config = CATEGORY_CONFIG[category]
              const isSelected = selectedCategory === category
              return (
                <TouchableOpacity
                  key={category}
                  style={[
                    styles.categoryButton,
                    isSelected && {
                      backgroundColor: config.backgroundColor,
                      borderColor: config.color,
                    },
                  ]}
                  onPress={() => handleCategorySelect(category)}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: isSelected }}
                  accessibilityLabel={`${config.label}${isSelected ? ', sélectionné' : ''}`}
                >
                  <Text
                    style={styles.categoryEmoji}
                    accessibilityElementsHidden={true}
                  >
                    {config.emoji}
                  </Text>
                  <Text
                    style={[
                      styles.categoryLabel,
                      isSelected && { color: config.color, fontWeight: '700' },
                    ]}
                  >
                    {config.label}
                  </Text>
                </TouchableOpacity>
              )
            })}
          </View>
        </View>

        {/* ── Sélection du type de symptôme ──────────────────────────────── */}
        {/* Exigence 5.1 : permettre d'enregistrer un ou plusieurs symptômes */}
        {selectedCategory !== null && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Type de symptôme</Text>
            <View
              style={styles.typeGrid}
              accessible={true}
              accessibilityLabel={`Types de symptômes pour la catégorie ${CATEGORY_CONFIG[selectedCategory].label}`}
              accessibilityRole="radiogroup"
            >
              {SYMPTOM_TYPES_BY_CATEGORY[selectedCategory].map(({ type, label }) => {
                const isSelected = selectedType === type
                const config = CATEGORY_CONFIG[selectedCategory]
                return (
                  <TouchableOpacity
                    key={type}
                    style={[
                      styles.typeButton,
                      isSelected && {
                        backgroundColor: config.backgroundColor,
                        borderColor: config.color,
                      },
                    ]}
                    onPress={() => handleTypeSelect(type)}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: isSelected }}
                    accessibilityLabel={`${label}${isSelected ? ', sélectionné' : ''}`}
                  >
                    <Text
                      style={[
                        styles.typeLabel,
                        isSelected && { color: config.color, fontWeight: '700' },
                      ]}
                    >
                      {label}
                    </Text>
                  </TouchableOpacity>
                )
              })}
            </View>
          </View>
        )}

        {/* ── Sélecteur d'intensité (pain uniquement) ─────────────────────── */}
        {/* Exigence 5.3 : intensité 1-5 uniquement pour les douleurs */}
        {selectedCategory === 'pain' && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>
              Intensité de la douleur
            </Text>
            <Text
              style={styles.intensityCurrentLabel}
              accessibilityLabel={`Intensité actuelle : ${INTENSITY_LABELS[intensity]}, ${intensity} sur 5`}
            >
              {intensity} / 5 — {INTENSITY_LABELS[intensity]}
            </Text>
            <View
              style={styles.intensityRow}
              accessible={true}
              accessibilityLabel="Sélecteur d'intensité de la douleur de 1 à 5"
              accessibilityRole="radiogroup"
            >
              {[1, 2, 3, 4, 5].map(value => {
                const isSelected = intensity === value
                return (
                  <TouchableOpacity
                    key={value}
                    style={[
                      styles.intensityButton,
                      isSelected && styles.intensityButtonSelected,
                    ]}
                    onPress={() => handleIntensitySelect(value)}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: isSelected }}
                    accessibilityLabel={`Intensité ${value} sur 5 : ${INTENSITY_LABELS[value]}${isSelected ? ', sélectionné' : ''}`}
                  >
                    <Text
                      style={[
                        styles.intensityButtonText,
                        isSelected && styles.intensityButtonTextSelected,
                      ]}
                    >
                      {value}
                    </Text>
                  </TouchableOpacity>
                )
              })}
            </View>
            {/* Légende des extrêmes */}
            <View style={styles.intensityLegend} accessibilityElementsHidden={true}>
              <Text style={styles.intensityLegendText}>Très légère</Text>
              <Text style={styles.intensityLegendText}>Très intense</Text>
            </View>
          </View>
        )}

        {/* ── Notes optionnelles ──────────────────────────────────────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Notes (optionnel)</Text>
          <TextInput
            style={styles.notesInput}
            value={notes}
            onChangeText={setNotes}
            placeholder="Ajoutez des détails sur ce symptôme…"
            placeholderTextColor="#BDBDBD"
            multiline
            numberOfLines={3}
            maxLength={500}
            accessibilityLabel="Notes sur le symptôme"
            accessibilityHint="Champ optionnel pour ajouter des détails"
          />
        </View>

        {/* ── Message d'erreur de validation ─────────────────────────────── */}
        {validationError !== null && (
          <View
            style={styles.errorContainer}
            accessible={true}
            accessibilityRole="alert"
            accessibilityLabel={validationError}
          >
            <Text style={styles.errorText}>{validationError}</Text>
          </View>
        )}

        {/* ── Boutons d'action ────────────────────────────────────────────── */}
        <View style={styles.actions}>
          {/* Bouton Annuler */}
          {onCancel !== undefined && (
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={onCancel}
              accessibilityLabel="Annuler la saisie du symptôme"
              accessibilityRole="button"
            >
              <Text style={styles.cancelButtonText}>Annuler</Text>
            </TouchableOpacity>
          )}

          {/* Bouton Enregistrer */}
          <TouchableOpacity
            style={[
              styles.submitButton,
              !canSubmit && styles.submitButtonDisabled,
            ]}
            onPress={handleSubmit}
            disabled={!canSubmit}
            accessibilityLabel={
              canSubmit
                ? 'Enregistrer le symptôme'
                : 'Enregistrer le symptôme (sélectionnez une catégorie et un type)'
            }
            accessibilityRole="button"
            accessibilityState={{ disabled: !canSubmit }}
          >
            <Text
              style={[
                styles.submitButtonText,
                !canSubmit && styles.submitButtonTextDisabled,
              ]}
            >
              {isSubmitting ? 'Enregistrement…' : 'Enregistrer'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </SafeAreaView>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Formate une CalendarDate en date lisible.
 * Ex : "2024-01-29" → "29 jan. 2024"
 */
function formatDate(date: CalendarDate): string {
  const [year, month, day] = date.split('-').map(Number)
  const d = new Date(Date.UTC(year, month - 1, day))
  return d.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

/**
 * Trouve l'identifiant du cycle actif pour une date donnée.
 * Retourne null si aucun cycle ne correspond.
 */
function findCurrentCycleId(
  cycles: Array<{ id: string; startDate: CalendarDate; endDate: CalendarDate | null }>,
  date: CalendarDate,
): string | null {
  // Chercher le cycle dont la date est dans la plage [startDate, endDate]
  for (const cycle of cycles) {
    if (date >= cycle.startDate) {
      if (cycle.endDate === null || date <= cycle.endDate) {
        return cycle.id
      }
    }
  }
  return null
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  // ── En-tête ─────────────────────────────────────────────────────────────
  header: {
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#212121',
    marginBottom: 4,
  },
  dateLabel: {
    fontSize: 13,
    color: '#9E9E9E',
  },
  // ── Sections ────────────────────────────────────────────────────────────
  section: {
    marginBottom: 20,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#424242',
    marginBottom: 10,
  },
  // ── Grille de catégories ─────────────────────────────────────────────────
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  categoryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#E0E0E0',
    backgroundColor: '#FAFAFA',
    minWidth: '45%',
    flex: 1,
  },
  categoryEmoji: {
    fontSize: 16,
  },
  categoryLabel: {
    fontSize: 13,
    color: '#424242',
    fontWeight: '500',
  },
  // ── Grille de types ──────────────────────────────────────────────────────
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  typeButton: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#E0E0E0',
    backgroundColor: '#FAFAFA',
  },
  typeLabel: {
    fontSize: 13,
    color: '#424242',
    fontWeight: '500',
  },
  // ── Sélecteur d'intensité ────────────────────────────────────────────────
  intensityCurrentLabel: {
    fontSize: 14,
    color: '#C62828',
    fontWeight: '600',
    marginBottom: 12,
    textAlign: 'center',
  },
  intensityRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  intensityButton: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#E0E0E0',
    backgroundColor: '#FAFAFA',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  intensityButtonSelected: {
    backgroundColor: '#FFEBEE',
    borderColor: '#C62828',
  },
  intensityButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#757575',
  },
  intensityButtonTextSelected: {
    color: '#C62828',
    fontWeight: '700',
  },
  intensityLegend: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  intensityLegendText: {
    fontSize: 11,
    color: '#BDBDBD',
  },
  // ── Notes ────────────────────────────────────────────────────────────────
  notesInput: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    color: '#212121',
    backgroundColor: '#FAFAFA',
    minHeight: 80,
    textAlignVertical: 'top',
  },
  // ── Erreur ───────────────────────────────────────────────────────────────
  errorContainer: {
    backgroundColor: '#FFEBEE',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    borderLeftWidth: 3,
    borderLeftColor: '#EF5350',
  },
  errorText: {
    fontSize: 13,
    color: '#C62828',
    lineHeight: 18,
  },
  // ── Actions ──────────────────────────────────────────────────────────────
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#E0E0E0',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 15,
    color: '#757575',
    fontWeight: '600',
  },
  submitButton: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: '#E91E63',
    alignItems: 'center',
    shadowColor: '#E91E63',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  submitButtonDisabled: {
    backgroundColor: '#F5F5F5',
    shadowOpacity: 0,
    elevation: 0,
  },
  submitButtonText: {
    fontSize: 15,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  submitButtonTextDisabled: {
    color: '#BDBDBD',
  },
  bottomSpacer: {
    height: 20,
  },
})
