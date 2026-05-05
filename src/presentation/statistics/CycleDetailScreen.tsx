/**
 * CycleDetailScreen — Vue détail d'un cycle passé avec ses symptômes.
 *
 * Affiche :
 * - Toutes les données du cycle (dates, durée, isExceptional, raison)
 * - Liste des symptômes enregistrés pendant ce cycle
 * - Bouton pour marquer/démarquer le cycle comme exceptionnel
 * - Formulaire de saisie de la raison (optionnelle) lors du marquage
 *
 * Ce composant appelle MarkCycleExceptionalUseCase via les callbacks
 * fournis par useStatistics().
 *
 * Exigences : 7.5, 13.1, 13.4
 */

import React, { useState } from 'react'
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  StyleSheet,
  SafeAreaView,
  Alert,
} from 'react-native'
import type { Cycle, Symptom } from '../../infrastructure/db/CycleRepository'
import { formatDate } from './useStatistics'

// ─── Props ────────────────────────────────────────────────────────────────────

interface CycleDetailScreenProps {
  /** Cycle à afficher */
  cycle: Cycle
  /** Retour à la liste */
  onBack: () => void
  /** Marquer le cycle comme exceptionnel avec raison optionnelle */
  onMarkExceptional: (reason?: string) => Promise<void>
  /** Annuler le marquage exceptionnel */
  onUnmarkExceptional: () => Promise<void>
}

// ─── Labels des symptômes ─────────────────────────────────────────────────────

const SYMPTOM_LABELS: Record<string, string> = {
  // Douleurs
  cramps: 'Crampes',
  headache: 'Maux de tête',
  back_pain: 'Douleurs dorsales',
  breast_tenderness: 'Sensibilité des seins',
  // Humeur
  irritable: 'Irritabilité',
  anxious: 'Anxiété',
  happy: 'Bonne humeur',
  sad: 'Tristesse',
  mood_swings: 'Sautes d\'humeur',
  // Énergie
  high_energy: 'Énergie élevée',
  low_energy: 'Énergie faible',
  fatigue: 'Fatigue',
  // Physique
  bloating: 'Ballonnements',
  acne: 'Acné',
  nausea: 'Nausées',
  food_cravings: 'Envies alimentaires',
  // Sommeil
  insomnia: 'Insomnie',
  good_sleep: 'Bon sommeil',
  restless_sleep: 'Sommeil agité',
}

const CATEGORY_LABELS: Record<string, string> = {
  pain: '🔴 Douleurs',
  mood: '💜 Humeur',
  energy: '⚡ Énergie',
  physical: '🌿 Physique',
  sleep: '🌙 Sommeil',
}

const CATEGORY_COLORS: Record<string, string> = {
  pain: '#FFEBEE',
  mood: '#F3E5F5',
  energy: '#FFF9C4',
  physical: '#E8F5E9',
  sleep: '#E3F2FD',
}

// ─── Composant ────────────────────────────────────────────────────────────────

/**
 * Vue détail d'un cycle passé.
 *
 * Structure :
 * 1. En-tête avec bouton retour
 * 2. Carte des données du cycle (dates, durée, statut exceptionnel)
 * 3. Section symptômes groupés par catégorie
 * 4. Bouton marquer/démarquer comme exceptionnel
 * 5. Formulaire de raison (si marquage en cours)
 */
export function CycleDetailScreen({
  cycle,
  onBack,
  onMarkExceptional,
  onUnmarkExceptional,
}: CycleDetailScreenProps): React.JSX.Element {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showReasonForm, setShowReasonForm] = useState(false)
  const [reason, setReason] = useState('')

  // ── Actions ───────────────────────────────────────────────────────────────

  async function handleMarkExceptional(): Promise<void> {
    setShowReasonForm(true)
  }

  async function handleConfirmMark(): Promise<void> {
    setIsSubmitting(true)
    try {
      await onMarkExceptional(reason.trim() || undefined)
    } finally {
      setIsSubmitting(false)
      setShowReasonForm(false)
      setReason('')
    }
  }

  function handleCancelMark(): void {
    setShowReasonForm(false)
    setReason('')
  }

  async function handleUnmarkExceptional(): Promise<void> {
    Alert.alert(
      'Réintégrer ce cycle',
      'Ce cycle sera réintégré dans les calculs de statistiques et de prédictions. Continuer ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Réintégrer',
          style: 'default',
          onPress: async () => {
            setIsSubmitting(true)
            try {
              await onUnmarkExceptional()
            } finally {
              setIsSubmitting(false)
            }
          },
        },
      ],
    )
  }

  // ── Données formatées ─────────────────────────────────────────────────────

  const startLabel = formatDate(cycle.startDate)
  const endLabel = cycle.endDate ? formatDate(cycle.endDate) : 'En cours'
  const menstruationEndLabel = cycle.menstruationEndDate
    ? formatDate(cycle.menstruationEndDate)
    : '—'

  // Grouper les symptômes par catégorie
  const symptomsByCategory = cycle.symptoms.reduce<Record<string, Symptom[]>>(
    (acc, symptom) => {
      const cat = symptom.category
      if (!acc[cat]) acc[cat] = []
      acc[cat].push(symptom)
      return acc
    },
    {},
  )

  const categoryOrder = ['pain', 'mood', 'energy', 'physical', 'sleep']

  // ── Rendu ─────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── En-tête ────────────────────────────────────────────────────── */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={onBack}
            style={styles.backButton}
            accessible={true}
            accessibilityLabel="Retour à l'historique"
            accessibilityRole="button"
          >
            <Text style={styles.backButtonText}>‹ Retour</Text>
          </TouchableOpacity>
          <Text style={styles.screenTitle} accessibilityRole="header">
            Détail du cycle
          </Text>
        </View>

        {/* ── Carte des données du cycle ─────────────────────────────────── */}
        {/* Exigences 7.5, 13.1 : afficher toutes les données du cycle */}
        <View
          style={[styles.cycleCard, cycle.isExceptional && styles.cycleCardExceptional]}
          accessible={true}
          accessibilityLabel={
            `Cycle du ${startLabel}` +
            (cycle.endDate ? ` au ${endLabel}` : ', en cours') +
            (cycle.duration ? `, durée ${cycle.duration} jours` : '') +
            (cycle.isExceptional ? ', marqué comme exceptionnel' : '')
          }
          accessibilityRole="summary"
        >
          {/* Badge exceptionnel */}
          {cycle.isExceptional && (
            <View style={styles.exceptionalBanner} accessibilityElementsHidden={true}>
              <Text style={styles.exceptionalBannerText}>
                ⚠️ Cycle exceptionnel — exclu des calculs
              </Text>
            </View>
          )}

          {/* Dates */}
          <View style={styles.dataRow}>
            <Text style={styles.dataLabel}>Début des règles</Text>
            <Text style={styles.dataValue}>{startLabel}</Text>
          </View>

          <View style={styles.dataDivider} />

          <View style={styles.dataRow}>
            <Text style={styles.dataLabel}>Fin des règles</Text>
            <Text style={styles.dataValue}>{menstruationEndLabel}</Text>
          </View>

          {cycle.menstruationDuration !== null && (
            <>
              <View style={styles.dataDivider} />
              <View style={styles.dataRow}>
                <Text style={styles.dataLabel}>Durée des règles</Text>
                <Text style={styles.dataValue}>
                  {cycle.menstruationDuration} jour{cycle.menstruationDuration > 1 ? 's' : ''}
                </Text>
              </View>
            </>
          )}

          <View style={styles.dataDivider} />

          <View style={styles.dataRow}>
            <Text style={styles.dataLabel}>Fin du cycle</Text>
            <Text style={styles.dataValue}>{endLabel}</Text>
          </View>

          {cycle.duration !== null && (
            <>
              <View style={styles.dataDivider} />
              <View style={styles.dataRow}>
                <Text style={styles.dataLabel}>Durée du cycle</Text>
                <Text style={[styles.dataValue, styles.dataValueHighlight]}>
                  {cycle.duration} jours
                </Text>
              </View>
            </>
          )}

          {/* Raison exceptionnelle */}
          {cycle.isExceptional && cycle.exceptionalReason && (
            <>
              <View style={styles.dataDivider} />
              <View style={styles.dataRow}>
                <Text style={styles.dataLabel}>Raison</Text>
                <Text style={styles.dataValue}>{cycle.exceptionalReason}</Text>
              </View>
            </>
          )}
        </View>

        {/* ── Symptômes ──────────────────────────────────────────────────── */}
        {/* Exigence 7.5 : afficher les symptômes enregistrés pendant ce cycle */}
        <View style={styles.symptomsSection}>
          <Text style={styles.sectionTitle}>
            Symptômes ({cycle.symptoms.length})
          </Text>

          {cycle.symptoms.length === 0 ? (
            <View style={styles.emptySymptoms}>
              <Text style={styles.emptyText}>
                Aucun symptôme enregistré pour ce cycle.
              </Text>
            </View>
          ) : (
            categoryOrder
              .filter(cat => symptomsByCategory[cat]?.length > 0)
              .map(cat => (
                <SymptomCategoryGroup
                  key={cat}
                  category={cat}
                  symptoms={symptomsByCategory[cat]}
                />
              ))
          )}
        </View>

        {/* ── Action : marquer / démarquer comme exceptionnel ────────────── */}
        {/* Exigences 13.1, 13.4 : permettre de marquer/démarquer */}
        <View style={styles.actionSection}>
          {!cycle.isExceptional ? (
            <>
              {!showReasonForm ? (
                <TouchableOpacity
                  style={styles.markExceptionalButton}
                  onPress={handleMarkExceptional}
                  disabled={isSubmitting}
                  accessible={true}
                  accessibilityLabel="Marquer ce cycle comme exceptionnel"
                  accessibilityRole="button"
                  accessibilityHint="Ce cycle sera exclu des calculs de statistiques et de prédictions"
                >
                  <Text style={styles.markExceptionalButtonText}>
                    ⚠️ Marquer comme exceptionnel
                  </Text>
                </TouchableOpacity>
              ) : (
                /* Formulaire de raison */
                <View style={styles.reasonForm}>
                  <Text style={styles.reasonFormTitle}>
                    Raison (optionnelle)
                  </Text>
                  <Text style={styles.reasonFormHint}>
                    Ex : maladie, stress intense, voyage, traitement médical…
                  </Text>
                  <TextInput
                    style={styles.reasonInput}
                    value={reason}
                    onChangeText={setReason}
                    placeholder="Saisir une raison…"
                    placeholderTextColor="#BDBDBD"
                    maxLength={200}
                    multiline
                    accessible={true}
                    accessibilityLabel="Raison du marquage exceptionnel"
                    accessibilityHint="Optionnel — décrivez pourquoi ce cycle est exceptionnel"
                  />
                  <View style={styles.reasonFormActions}>
                    <TouchableOpacity
                      style={styles.cancelReasonButton}
                      onPress={handleCancelMark}
                      disabled={isSubmitting}
                      accessible={true}
                      accessibilityLabel="Annuler le marquage"
                      accessibilityRole="button"
                    >
                      <Text style={styles.cancelReasonButtonText}>Annuler</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.confirmMarkButton}
                      onPress={handleConfirmMark}
                      disabled={isSubmitting}
                      accessible={true}
                      accessibilityLabel="Confirmer le marquage comme exceptionnel"
                      accessibilityRole="button"
                      accessibilityState={{ busy: isSubmitting }}
                    >
                      {isSubmitting ? (
                        <ActivityIndicator color="#FFFFFF" size="small" />
                      ) : (
                        <Text style={styles.confirmMarkButtonText}>Confirmer</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </>
          ) : (
            /* Bouton démarquer */
            /* Exigence 13.4 : annuler le marquage exceptionnel */
            <TouchableOpacity
              style={styles.unmarkButton}
              onPress={handleUnmarkExceptional}
              disabled={isSubmitting}
              accessible={true}
              accessibilityLabel="Réintégrer ce cycle dans les calculs"
              accessibilityRole="button"
              accessibilityHint="Ce cycle sera réintégré dans les statistiques et les prédictions"
            >
              {isSubmitting ? (
                <ActivityIndicator color="#E91E63" size="small" />
              ) : (
                <Text style={styles.unmarkButtonText}>
                  ✓ Réintégrer dans les calculs
                </Text>
              )}
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </SafeAreaView>
  )
}

// ─── Composant SymptomCategoryGroup ──────────────────────────────────────────

interface SymptomCategoryGroupProps {
  category: string
  symptoms: Symptom[]
}

/**
 * Groupe de symptômes par catégorie.
 * Affiche le titre de la catégorie et la liste des symptômes.
 */
function SymptomCategoryGroup({ category, symptoms }: SymptomCategoryGroupProps): React.JSX.Element {
  const categoryLabel = CATEGORY_LABELS[category] ?? category
  const bgColor = CATEGORY_COLORS[category] ?? '#F5F5F5'

  return (
    <View
      style={[styles.categoryGroup, { backgroundColor: bgColor }]}
      accessible={true}
      accessibilityLabel={`${categoryLabel} : ${symptoms.length} symptôme${symptoms.length > 1 ? 's' : ''}`}
    >
      <Text style={styles.categoryTitle} accessibilityElementsHidden={true}>
        {categoryLabel}
      </Text>
      {symptoms.map(symptom => (
        <SymptomRow key={symptom.id} symptom={symptom} />
      ))}
    </View>
  )
}

// ─── Composant SymptomRow ─────────────────────────────────────────────────────

interface SymptomRowProps {
  symptom: Symptom
}

/**
 * Ligne représentant un symptôme.
 * Affiche le nom, la date, l'intensité (si douleur) et les notes.
 */
function SymptomRow({ symptom }: SymptomRowProps): React.JSX.Element {
  const label = SYMPTOM_LABELS[symptom.type] ?? symptom.type
  const dateLabel = formatDate(symptom.date)

  const accessibilityLabel =
    `${label} le ${dateLabel}` +
    (symptom.intensity !== null ? `, intensité ${symptom.intensity} sur 5` : '') +
    (symptom.notes ? `, note : ${symptom.notes}` : '')

  return (
    <View
      style={styles.symptomRow}
      accessible={true}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="text"
    >
      <View style={styles.symptomRowMain}>
        <Text style={styles.symptomName}>{label}</Text>
        <Text style={styles.symptomDate} accessibilityElementsHidden={true}>
          {dateLabel}
        </Text>
      </View>

      {/* Intensité (douleurs uniquement) */}
      {symptom.intensity !== null && (
        <IntensityDots
          intensity={symptom.intensity}
          accessibilityLabel={`Intensité : ${symptom.intensity} sur 5`}
        />
      )}

      {/* Notes */}
      {symptom.notes && (
        <Text style={styles.symptomNotes} accessibilityElementsHidden={true}>
          {symptom.notes}
        </Text>
      )}
    </View>
  )
}

// ─── Composant IntensityDots ──────────────────────────────────────────────────

interface IntensityDotsProps {
  intensity: number
  accessibilityLabel: string
}

/**
 * Affiche l'intensité d'un symptôme sous forme de points colorés (1-5).
 * Représentation visuelle accessible.
 */
function IntensityDots({ intensity, accessibilityLabel }: IntensityDotsProps): React.JSX.Element {
  return (
    <View
      style={styles.intensityContainer}
      accessible={true}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="text"
    >
      {[1, 2, 3, 4, 5].map(i => (
        <View
          key={i}
          style={[
            styles.intensityDot,
            { backgroundColor: i <= intensity ? '#E91E63' : '#F5F5F5' },
          ]}
          accessibilityElementsHidden={true}
        />
      ))}
    </View>
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
  // ── En-tête ─────────────────────────────────────────────────────────────
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 12,
  },
  backButton: {
    padding: 4,
  },
  backButtonText: {
    fontSize: 16,
    color: '#E91E63',
    fontWeight: '600',
  },
  screenTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#212121',
  },
  // ── Carte cycle ──────────────────────────────────────────────────────────
  cycleCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginBottom: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  cycleCardExceptional: {
    opacity: 0.85,
    borderWidth: 1,
    borderColor: '#EEEEEE',
  },
  exceptionalBanner: {
    backgroundColor: '#FFF8E1',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#FFE082',
  },
  exceptionalBannerText: {
    fontSize: 13,
    color: '#F57F17',
    fontWeight: '600',
  },
  dataRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  dataDivider: {
    height: 1,
    backgroundColor: '#F5F5F5',
    marginHorizontal: 16,
  },
  dataLabel: {
    fontSize: 14,
    color: '#757575',
  },
  dataValue: {
    fontSize: 14,
    color: '#212121',
    fontWeight: '500',
  },
  dataValueHighlight: {
    color: '#E91E63',
    fontWeight: '700',
    fontSize: 16,
  },
  // ── Symptômes ────────────────────────────────────────────────────────────
  symptomsSection: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#212121',
    marginBottom: 12,
  },
  emptySymptoms: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#9E9E9E',
    textAlign: 'center',
  },
  categoryGroup: {
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
  categoryTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#424242',
    marginBottom: 8,
  },
  symptomRow: {
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
  },
  symptomRowMain: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  symptomName: {
    fontSize: 14,
    color: '#212121',
    fontWeight: '500',
  },
  symptomDate: {
    fontSize: 12,
    color: '#9E9E9E',
  },
  symptomNotes: {
    fontSize: 12,
    color: '#757575',
    fontStyle: 'italic',
    marginTop: 2,
  },
  intensityContainer: {
    flexDirection: 'row',
    gap: 4,
    marginBottom: 2,
  },
  intensityDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  // ── Actions ──────────────────────────────────────────────────────────────
  actionSection: {
    marginBottom: 8,
  },
  markExceptionalButton: {
    backgroundColor: '#FFF8E1',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FFE082',
  },
  markExceptionalButtonText: {
    fontSize: 15,
    color: '#F57F17',
    fontWeight: '600',
  },
  unmarkButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#E91E63',
  },
  unmarkButtonText: {
    fontSize: 15,
    color: '#E91E63',
    fontWeight: '600',
  },
  // ── Formulaire de raison ─────────────────────────────────────────────────
  reasonForm: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  reasonFormTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#212121',
    marginBottom: 4,
  },
  reasonFormHint: {
    fontSize: 12,
    color: '#9E9E9E',
    marginBottom: 12,
    lineHeight: 16,
  },
  reasonInput: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#212121',
    minHeight: 80,
    textAlignVertical: 'top',
    marginBottom: 12,
  },
  reasonFormActions: {
    flexDirection: 'row',
    gap: 10,
  },
  cancelReasonButton: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  cancelReasonButtonText: {
    fontSize: 14,
    color: '#757575',
    fontWeight: '600',
  },
  confirmMarkButton: {
    flex: 2,
    backgroundColor: '#F57F17',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  confirmMarkButtonText: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  bottomSpacer: {
    height: 32,
  },
})
