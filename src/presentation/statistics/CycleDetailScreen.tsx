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
import { colors, spacing, radii } from '../theme'
import { useI18n } from '../i18n/I18nContext'
import { ScreenHeader } from '../components'

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

const SYMPTOM_LABELS_FR: Record<string, string> = {
  cramps: 'Crampes',
  headache: 'Maux de tête',
  back_pain: 'Douleurs dorsales',
  breast_tenderness: 'Sensibilité des seins',
  irritable: 'Irritabilité',
  anxious: 'Anxiété',
  happy: 'Bonne humeur',
  sad: 'Tristesse',
  mood_swings: "Sautes d'humeur",
  high_energy: 'Énergie élevée',
  low_energy: 'Énergie faible',
  fatigue: 'Fatigue',
  bloating: 'Ballonnements',
  acne: 'Acné',
  nausea: 'Nausées',
  food_cravings: 'Envies alimentaires',
  insomnia: 'Insomnie',
  good_sleep: 'Bon sommeil',
  restless_sleep: 'Sommeil agité',
}

const SYMPTOM_LABELS_EN: Record<string, string> = {
  cramps: 'Cramps',
  headache: 'Headache',
  back_pain: 'Back pain',
  breast_tenderness: 'Breast tenderness',
  irritable: 'Irritability',
  anxious: 'Anxiety',
  happy: 'Happy',
  sad: 'Sad',
  mood_swings: 'Mood swings',
  high_energy: 'High energy',
  low_energy: 'Low energy',
  fatigue: 'Fatigue',
  bloating: 'Bloating',
  acne: 'Acne',
  nausea: 'Nausea',
  food_cravings: 'Food cravings',
  insomnia: 'Insomnia',
  good_sleep: 'Good sleep',
  restless_sleep: 'Restless sleep',
}

const CATEGORY_LABELS_FR: Record<string, string> = {
  pain: 'Douleurs',
  mood: 'Humeur',
  energy: 'Énergie',
  physical: 'Physique',
  sleep: 'Sommeil',
}

const CATEGORY_LABELS_EN: Record<string, string> = {
  pain: 'Pain',
  mood: 'Mood',
  energy: 'Energy',
  physical: 'Physical',
  sleep: 'Sleep',
}

const CATEGORY_COLORS: Record<string, string> = {
  pain: colors.phase.menstrual.soft,
  mood: colors.phase.luteal.soft,
  energy: colors.phase.ovulation.soft,
  physical: colors.phase.follicular.soft,
  sleep: colors.infoSoft,
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
  const { currentLanguage } = useI18n()
  const lang = currentLanguage === 'en' ? 'en' : 'fr'
  const fr = lang !== 'en'
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
      fr ? 'Réintégrer ce cycle' : 'Restore this cycle',
      fr
        ? 'Ce cycle sera réintégré dans les calculs de statistiques et de prédictions. Continuer ?'
        : 'This cycle will be included again in statistics and predictions. Continue?',
      [
        { text: fr ? 'Annuler' : 'Cancel', style: 'cancel' },
        {
          text: fr ? 'Réintégrer' : 'Restore',
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

  const startLabel = formatDate(cycle.startDate, lang)
  const endLabel = cycle.endDate ? formatDate(cycle.endDate, lang) : fr ? 'En cours' : 'Ongoing'
  const menstruationEndLabel = cycle.menstruationEndDate
    ? formatDate(cycle.menstruationEndDate, lang)
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
        {/* ── En-tête avec retour unifié ─────────────────────────────────── */}
        <ScreenHeader
          title={fr ? 'Détail du cycle' : 'Cycle details'}
          onBack={onBack}
          backLabel={fr ? "Retour à l'historique" : 'Back to history'}
        />

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
                ⚠️ {fr ? 'Cycle exceptionnel — exclu des calculs' : 'Exceptional cycle — excluded from calculations'}
              </Text>
            </View>
          )}

          {/* Dates */}
          <View style={styles.dataRow}>
            <Text style={styles.dataLabel}>{fr ? 'Début des règles' : 'Period start'}</Text>
            <Text style={styles.dataValue}>{startLabel}</Text>
          </View>

          <View style={styles.dataDivider} />

          <View style={styles.dataRow}>
            <Text style={styles.dataLabel}>{fr ? 'Fin des règles' : 'Period end'}</Text>
            <Text style={styles.dataValue}>{menstruationEndLabel}</Text>
          </View>

          {cycle.menstruationDuration !== null && (
            <>
              <View style={styles.dataDivider} />
              <View style={styles.dataRow}>
                <Text style={styles.dataLabel}>{fr ? 'Durée des règles' : 'Period length'}</Text>
                <Text style={styles.dataValue}>
                  {cycle.menstruationDuration} {fr ? `jour${cycle.menstruationDuration > 1 ? 's' : ''}` : `day${cycle.menstruationDuration > 1 ? 's' : ''}`}
                </Text>
              </View>
            </>
          )}

          <View style={styles.dataDivider} />

          <View style={styles.dataRow}>
            <Text style={styles.dataLabel}>{fr ? 'Fin du cycle' : 'Cycle end'}</Text>
            <Text style={styles.dataValue}>{endLabel}</Text>
          </View>

          {cycle.duration !== null && (
            <>
              <View style={styles.dataDivider} />
              <View style={styles.dataRow}>
                <Text style={styles.dataLabel}>{fr ? 'Durée du cycle' : 'Cycle length'}</Text>
                <Text style={[styles.dataValue, styles.dataValueHighlight]}>
                  {cycle.duration} {fr ? 'jours' : 'days'}
                </Text>
              </View>
            </>
          )}

          {/* Raison exceptionnelle */}
          {cycle.isExceptional && cycle.exceptionalReason && (
            <>
              <View style={styles.dataDivider} />
              <View style={styles.dataRow}>
                <Text style={styles.dataLabel}>{fr ? 'Raison' : 'Reason'}</Text>
                <Text style={styles.dataValue}>{cycle.exceptionalReason}</Text>
              </View>
            </>
          )}
        </View>

        {/* ── Symptômes ──────────────────────────────────────────────────── */}
        {/* Exigence 7.5 : afficher les symptômes enregistrés pendant ce cycle */}
        <View style={styles.symptomsSection}>
          <Text style={styles.sectionTitle}>
            {fr ? 'Symptômes' : 'Symptoms'} ({cycle.symptoms.length})
          </Text>

          {cycle.symptoms.length === 0 ? (
            <View style={styles.emptySymptoms}>
              <Text style={styles.emptyText}>
                {fr ? 'Aucun symptôme enregistré pour ce cycle.' : 'No symptoms recorded for this cycle.'}
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
                  lang={lang}
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
                  accessibilityHint={fr ? 'Ce cycle sera exclu des calculs de statistiques et de prédictions' : 'This cycle will be excluded from statistics and predictions'}
                >
                  <Text style={styles.markExceptionalButtonText}>
                    ⚠️ {fr ? 'Marquer comme exceptionnel' : 'Mark as exceptional'}
                  </Text>
                </TouchableOpacity>
              ) : (
                /* Formulaire de raison */
                <View style={styles.reasonForm}>
                  <Text style={styles.reasonFormTitle}>
                    {fr ? 'Raison (optionnelle)' : 'Reason (optional)'}
                  </Text>
                  <Text style={styles.reasonFormHint}>
                    {fr ? 'Ex : maladie, stress intense, voyage, traitement médical…' : 'e.g. illness, intense stress, travel, medication…'}
                  </Text>
                  <TextInput
                    style={styles.reasonInput}
                    value={reason}
                    onChangeText={setReason}
                    placeholder={fr ? 'Saisir une raison…' : 'Enter a reason…'}
                    placeholderTextColor={colors.textTertiary}
                    maxLength={200}
                    multiline
                    accessible={true}
                    accessibilityLabel={fr ? 'Raison du marquage exceptionnel' : 'Reason for marking exceptional'}
                  />
                  <View style={styles.reasonFormActions}>
                    <TouchableOpacity
                      style={styles.cancelReasonButton}
                      onPress={handleCancelMark}
                      disabled={isSubmitting}
                      accessible={true}
                      accessibilityLabel={fr ? 'Annuler le marquage' : 'Cancel marking'}
                      accessibilityRole="button"
                    >
                      <Text style={styles.cancelReasonButtonText}>{fr ? 'Annuler' : 'Cancel'}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.confirmMarkButton}
                      onPress={handleConfirmMark}
                      disabled={isSubmitting}
                      accessible={true}
                      accessibilityLabel={fr ? 'Confirmer le marquage comme exceptionnel' : 'Confirm marking as exceptional'}
                      accessibilityRole="button"
                      accessibilityState={{ busy: isSubmitting }}
                    >
                      {isSubmitting ? (
                        <ActivityIndicator color={colors.textInverse} size="small" />
                      ) : (
                        <Text style={styles.confirmMarkButtonText}>{fr ? 'Confirmer' : 'Confirm'}</Text>
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
              accessibilityLabel={fr ? 'Réintégrer ce cycle dans les calculs' : 'Restore this cycle into calculations'}
              accessibilityRole="button"
              accessibilityHint={fr ? 'Ce cycle sera réintégré dans les statistiques et les prédictions' : 'This cycle will be included again in statistics and predictions'}
            >
              {isSubmitting ? (
                <ActivityIndicator color={colors.primary} size="small" />
              ) : (
                <Text style={styles.unmarkButtonText}>
                  ✓ {fr ? 'Réintégrer dans les calculs' : 'Restore into calculations'}
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
  lang: 'fr' | 'en'
}

/**
 * Groupe de symptômes par catégorie.
 * Affiche le titre de la catégorie et la liste des symptômes.
 */
function SymptomCategoryGroup({ category, symptoms, lang }: SymptomCategoryGroupProps): React.JSX.Element {
  const fr = lang !== 'en'
  const labels = fr ? CATEGORY_LABELS_FR : CATEGORY_LABELS_EN
  const categoryLabel = labels[category] ?? category
  const bgColor = CATEGORY_COLORS[category] ?? '#F5F5F5'

  return (
    <View
      style={[styles.categoryGroup, { backgroundColor: bgColor }]}
      accessible={true}
      accessibilityLabel={fr ? `${categoryLabel} : ${symptoms.length} symptôme${symptoms.length > 1 ? 's' : ''}` : `${categoryLabel}: ${symptoms.length} symptom${symptoms.length > 1 ? 's' : ''}`}
    >
      <Text style={styles.categoryTitle} accessibilityElementsHidden={true}>
        {categoryLabel}
      </Text>
      {symptoms.map(symptom => (
        <SymptomRow key={symptom.id} symptom={symptom} lang={lang} />
      ))}
    </View>
  )
}

// ─── Composant SymptomRow ─────────────────────────────────────────────────────

interface SymptomRowProps {
  symptom: Symptom
  lang: 'fr' | 'en'
}

/**
 * Ligne représentant un symptôme.
 * Affiche le nom, la date, l'intensité (si douleur) et les notes.
 */
function SymptomRow({ symptom, lang }: SymptomRowProps): React.JSX.Element {
  const fr = lang !== 'en'
  const label = (fr ? SYMPTOM_LABELS_FR : SYMPTOM_LABELS_EN)[symptom.type] ?? symptom.type
  const dateLabel = formatDate(symptom.date, lang)

  const accessibilityLabel = fr
    ? `${label} le ${dateLabel}` +
      (symptom.intensity !== null ? `, intensité ${symptom.intensity} sur 5` : '') +
      (symptom.notes ? `, note : ${symptom.notes}` : '')
    : `${label} on ${dateLabel}` +
      (symptom.intensity !== null ? `, intensity ${symptom.intensity} of 5` : '') +
      (symptom.notes ? `, note: ${symptom.notes}` : '')

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
          accessibilityLabel={fr ? `Intensité : ${symptom.intensity} sur 5` : `Intensity: ${symptom.intensity} of 5`}
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
            { backgroundColor: i <= intensity ? colors.primary : colors.surfaceAlt },
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
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.xl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
    gap: spacing.md,
  },
  backButton: {
    padding: spacing.xs,
  },
  backButtonText: {
    fontSize: 16,
    color: colors.primaryDark,
    fontWeight: '600',
  },
  screenTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  cycleCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.lg,
    overflow: 'hidden',
  },
  cycleCardExceptional: {
    opacity: 0.85,
  },
  exceptionalBanner: {
    backgroundColor: colors.phase.ovulation.soft,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.phase.ovulation.main,
  },
  exceptionalBannerText: {
    fontSize: 13,
    color: colors.phase.ovulation.text,
    fontWeight: '600',
  },
  dataRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: 13,
  },
  dataDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginHorizontal: spacing.lg,
  },
  dataLabel: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  dataValue: {
    fontSize: 14,
    color: colors.textPrimary,
    fontWeight: '500',
  },
  dataValueHighlight: {
    color: colors.primaryDark,
    fontWeight: '700',
    fontSize: 16,
  },
  symptomsSection: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  emptySymptoms: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: colors.textTertiary,
    textAlign: 'center',
  },
  categoryGroup: {
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  categoryTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  symptomRow: {
    paddingVertical: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
  },
  symptomRowMain: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  symptomName: {
    fontSize: 14,
    color: colors.textPrimary,
    fontWeight: '500',
  },
  symptomDate: {
    fontSize: 12,
    color: colors.textTertiary,
  },
  symptomNotes: {
    fontSize: 12,
    color: colors.textSecondary,
    fontStyle: 'italic',
    marginTop: 2,
  },
  intensityContainer: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginBottom: 2,
  },
  intensityDot: {
    width: 10,
    height: 10,
    borderRadius: radii.pill,
  },
  actionSection: {
    marginBottom: spacing.sm,
  },
  markExceptionalButton: {
    backgroundColor: colors.phase.ovulation.soft,
    borderRadius: radii.lg,
    paddingVertical: spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.phase.ovulation.main,
  },
  markExceptionalButtonText: {
    fontSize: 15,
    color: colors.phase.ovulation.text,
    fontWeight: '600',
  },
  unmarkButton: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    paddingVertical: spacing.md,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  unmarkButtonText: {
    fontSize: 15,
    color: colors.primaryDark,
    fontWeight: '600',
  },
  reasonForm: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  reasonFormTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  reasonFormHint: {
    fontSize: 12,
    color: colors.textTertiary,
    marginBottom: spacing.md,
    lineHeight: 16,
  },
  reasonInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    padding: spacing.md,
    fontSize: 14,
    color: colors.textPrimary,
    minHeight: 80,
    textAlignVertical: 'top',
    marginBottom: spacing.md,
  },
  reasonFormActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  cancelReasonButton: {
    flex: 1,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radii.sm,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  cancelReasonButtonText: {
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  confirmMarkButton: {
    flex: 2,
    backgroundColor: colors.phase.ovulation.main,
    borderRadius: radii.sm,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  confirmMarkButtonText: {
    fontSize: 14,
    color: colors.textInverse,
    fontWeight: '700',
  },
  bottomSpacer: {
    height: spacing.xxxl,
  },
})
