/**
 * SettingsScreen — Écran des paramètres de l'application.
 *
 * Sections :
 * 1. Mode de suivi (general, trying_to_conceive, natural_contraception)
 * 2. Langue (Français / English) — changement immédiat sans redémarrage
 * 3. Notifications (activation/désactivation, délais 1-7 jours)
 * 4. Rappels de médicaments (liste + ajout/suppression)
 * 5. Lien vers l'écran de sécurité
 *
 * Ce composant ne contient aucune logique métier — tout est délégué à
 * useSettings() qui orchestre CycleRepository et I18nService.
 *
 * Exigences : 4.4, 4.5, 6.1, 6.5, 8.1, 8.5, 15.2, 15.3
 */

import React, { useState } from 'react'
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Switch,
  ActivityIndicator,
  StyleSheet,
  SafeAreaView,
  Modal,
} from 'react-native'
import { useSettings } from './useSettings'
import { MedicationReminderForm } from './MedicationReminderForm'
import type { TrackingMode, MedicationReminder } from '../../infrastructure/db/CycleRepository'
import type { SupportedLanguage } from '../../domain/shared/types'

// ─── Constantes ───────────────────────────────────────────────────────────────

const TRACKING_MODE_OPTIONS: Array<{ value: TrackingMode; label: string; description: string }> = [
  {
    value: 'general',
    label: '📊 Suivi général',
    description: 'Informations équilibrées sur toutes les phases du cycle',
  },
  {
    value: 'trying_to_conceive',
    label: '👶 Essai bébé',
    description: 'Met en évidence la période féconde et les notifications de fertilité',
  },
  {
    value: 'natural_contraception',
    label: '🛡️ Contraception naturelle',
    description: 'Affiche les avertissements sur les jours à risque',
  },
]

const LANGUAGE_OPTIONS: Array<{ value: SupportedLanguage; label: string; flag: string }> = [
  { value: 'fr', label: 'Français', flag: '🇫🇷' },
  { value: 'en', label: 'English', flag: '🇬🇧' },
]

/** Délais disponibles pour les notifications (1 à 7 jours) */
const ADVANCE_NOTICE_OPTIONS = [1, 2, 3, 4, 5, 6, 7]

// ─── Composant ────────────────────────────────────────────────────────────────

interface SettingsScreenProps {
  /** Callback pour naviguer vers l'écran de sécurité */
  onNavigateToSecurity?: () => void
}

/**
 * Écran des paramètres.
 *
 * Structure :
 * 1. Mode de suivi
 * 2. Langue
 * 3. Notifications
 * 4. Rappels de médicaments
 * 5. Sécurité (lien)
 */
export function SettingsScreen({ onNavigateToSecurity }: SettingsScreenProps): React.JSX.Element {
  const {
    preferences,
    isLoading,
    error,
    currentLanguage,
    setTrackingMode,
    setLanguage,
    updateNotificationPreferences,
    addMedicationReminder,
    removeMedicationReminder,
    toggleMedicationReminder,
    refresh,
  } = useSettings()

  // Affichage du formulaire d'ajout de rappel
  const [showReminderForm, setShowReminderForm] = useState(false)

  // ── États de chargement / erreur ──────────────────────────────────────────

  if (isLoading) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator
          size="large"
          color="#E91E63"
          accessibilityLabel="Chargement des paramètres"
        />
        <Text style={styles.loadingText}>Chargement…</Text>
      </SafeAreaView>
    )
  }

  if (error !== null || preferences === null) {
    return (
      <SafeAreaView style={styles.centered}>
        <Text style={styles.errorText} accessibilityRole="alert">
          {error ?? 'Impossible de charger les paramètres'}
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

  const { trackingMode, notificationPreferences, medicationReminders } = preferences

  // ── Handlers ──────────────────────────────────────────────────────────────

  async function handleTrackingModeChange(mode: TrackingMode): Promise<void> {
    await setTrackingMode(mode)
  }

  async function handleLanguageChange(lang: SupportedLanguage): Promise<void> {
    await setLanguage(lang)
  }

  async function handleNotificationsToggle(enabled: boolean): Promise<void> {
    await updateNotificationPreferences({ enabled })
  }

  async function handleMedicationRemindersToggle(enabled: boolean): Promise<void> {
    await updateNotificationPreferences({ medicationRemindersEnabled: enabled })
  }

  /**
   * Ajoute ou retire un délai de la liste des délais de notification.
   * Exigence 4.5 : délais configurables de 1 à 7 jours.
   */
  async function handleAdvanceNoticeToggle(days: number): Promise<void> {
    const current = notificationPreferences.periodAdvanceNoticeDays
    const updated = current.includes(days)
      ? current.filter(d => d !== days)
      : [...current, days].sort((a, b) => b - a) // tri décroissant
    await updateNotificationPreferences({ periodAdvanceNoticeDays: updated })
  }

  async function handleFertileWindowAdvanceChange(days: number): Promise<void> {
    await updateNotificationPreferences({ fertileWindowAdvanceNoticeDays: days })
  }

  // ── Rendu ─────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.screenTitle} accessibilityRole="header">
          Paramètres
        </Text>

        {/* ── Section : Mode de suivi ─────────────────────────────────────── */}
        {/* Exigences 8.1, 8.5 */}
        <SectionCard title="Mode de suivi">
          <View
            accessible={true}
            accessibilityLabel="Sélecteur de mode de suivi"
            accessibilityRole="radiogroup"
          >
            {TRACKING_MODE_OPTIONS.map(opt => (
              <TouchableOpacity
                key={opt.value}
                style={[
                  styles.modeOption,
                  trackingMode === opt.value && styles.modeOptionSelected,
                ]}
                onPress={() => handleTrackingModeChange(opt.value)}
                accessibilityRole="radio"
                accessibilityState={{ checked: trackingMode === opt.value }}
                accessibilityLabel={`${opt.label}. ${opt.description}`}
              >
                <View style={styles.modeOptionContent}>
                  <Text
                    style={[
                      styles.modeOptionLabel,
                      trackingMode === opt.value && styles.modeOptionLabelSelected,
                    ]}
                  >
                    {opt.label}
                  </Text>
                  <Text
                    style={styles.modeOptionDescription}
                    accessibilityElementsHidden={true}
                  >
                    {opt.description}
                  </Text>
                </View>
                {trackingMode === opt.value && (
                  <Text
                    style={styles.checkmark}
                    accessibilityElementsHidden={true}
                  >
                    ✓
                  </Text>
                )}
              </TouchableOpacity>
            ))}
          </View>
        </SectionCard>

        {/* ── Section : Langue ────────────────────────────────────────────── */}
        {/* Exigences 15.2, 15.3 : changement immédiat sans redémarrage */}
        <SectionCard title="Langue">
          <Text style={styles.sectionNote}>
            Le changement s'applique immédiatement à toute l'interface.
          </Text>
          <View
            style={styles.languageRow}
            accessible={true}
            accessibilityLabel="Sélecteur de langue"
            accessibilityRole="radiogroup"
          >
            {LANGUAGE_OPTIONS.map(opt => (
              <TouchableOpacity
                key={opt.value}
                style={[
                  styles.languageButton,
                  currentLanguage === opt.value && styles.languageButtonSelected,
                ]}
                onPress={() => handleLanguageChange(opt.value)}
                accessibilityRole="radio"
                accessibilityState={{ checked: currentLanguage === opt.value }}
                accessibilityLabel={`${opt.label}${currentLanguage === opt.value ? ', sélectionné' : ''}`}
              >
                <Text style={styles.languageFlag} accessibilityElementsHidden={true}>
                  {opt.flag}
                </Text>
                <Text
                  style={[
                    styles.languageLabel,
                    currentLanguage === opt.value && styles.languageLabelSelected,
                  ]}
                >
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </SectionCard>

        {/* ── Section : Notifications ─────────────────────────────────────── */}
        {/* Exigences 4.4, 4.5 */}
        <SectionCard title="Notifications">
          {/* Activation globale */}
          <SettingsRow
            label="Activer les notifications"
            accessibilityLabel={`Notifications ${notificationPreferences.enabled ? 'activées' : 'désactivées'}`}
          >
            <Switch
              value={notificationPreferences.enabled}
              onValueChange={handleNotificationsToggle}
              trackColor={{ false: '#E0E0E0', true: '#F48FB1' }}
              thumbColor={notificationPreferences.enabled ? '#E91E63' : '#BDBDBD'}
              accessibilityLabel="Activer ou désactiver toutes les notifications"
              accessibilityRole="switch"
              accessibilityState={{ checked: notificationPreferences.enabled }}
            />
          </SettingsRow>

          {notificationPreferences.enabled && (
            <>
              {/* Délais pour les règles */}
              <View style={styles.subSection}>
                <Text style={styles.subSectionTitle}>
                  Rappels avant les règles
                </Text>
                <Text style={styles.subSectionNote}>
                  Sélectionnez les délais souhaités (1 à 7 jours)
                </Text>
                <View
                  style={styles.daysGrid}
                  accessible={true}
                  accessibilityLabel="Délais de notification avant les règles"
                  accessibilityRole="group"
                >
                  {ADVANCE_NOTICE_OPTIONS.map(days => {
                    const isSelected = notificationPreferences.periodAdvanceNoticeDays.includes(days)
                    return (
                      <TouchableOpacity
                        key={days}
                        style={[styles.dayChip, isSelected && styles.dayChipSelected]}
                        onPress={() => handleAdvanceNoticeToggle(days)}
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: isSelected }}
                        accessibilityLabel={`${days} jour${days > 1 ? 's' : ''} avant${isSelected ? ', sélectionné' : ''}`}
                      >
                        <Text
                          style={[styles.dayChipText, isSelected && styles.dayChipTextSelected]}
                        >
                          {days}j
                        </Text>
                      </TouchableOpacity>
                    )
                  })}
                </View>
              </View>

              {/* Délai pour la période féconde */}
              <View style={styles.subSection}>
                <Text style={styles.subSectionTitle}>
                  Rappel avant la période féconde
                </Text>
                <View
                  style={styles.daysGrid}
                  accessible={true}
                  accessibilityLabel="Délai de notification avant la période féconde"
                  accessibilityRole="radiogroup"
                >
                  {[1, 2, 3].map(days => {
                    const isSelected =
                      notificationPreferences.fertileWindowAdvanceNoticeDays === days
                    return (
                      <TouchableOpacity
                        key={days}
                        style={[styles.dayChip, isSelected && styles.dayChipSelected]}
                        onPress={() => handleFertileWindowAdvanceChange(days)}
                        accessibilityRole="radio"
                        accessibilityState={{ checked: isSelected }}
                        accessibilityLabel={`${days} jour${days > 1 ? 's' : ''} avant${isSelected ? ', sélectionné' : ''}`}
                      >
                        <Text
                          style={[styles.dayChipText, isSelected && styles.dayChipTextSelected]}
                        >
                          {days}j
                        </Text>
                      </TouchableOpacity>
                    )
                  })}
                </View>
              </View>
            </>
          )}
        </SectionCard>

        {/* ── Section : Rappels de médicaments ────────────────────────────── */}
        {/* Exigences 6.1, 6.5 */}
        <SectionCard title="Rappels de médicaments">
          <SettingsRow
            label="Activer les rappels"
            accessibilityLabel={`Rappels de médicaments ${notificationPreferences.medicationRemindersEnabled ? 'activés' : 'désactivés'}`}
          >
            <Switch
              value={notificationPreferences.medicationRemindersEnabled}
              onValueChange={handleMedicationRemindersToggle}
              trackColor={{ false: '#E0E0E0', true: '#F48FB1' }}
              thumbColor={
                notificationPreferences.medicationRemindersEnabled ? '#E91E63' : '#BDBDBD'
              }
              accessibilityLabel="Activer ou désactiver les rappels de médicaments"
              accessibilityRole="switch"
              accessibilityState={{ checked: notificationPreferences.medicationRemindersEnabled }}
            />
          </SettingsRow>

          {/* Liste des rappels existants */}
          {medicationReminders.length > 0 && (
            <View style={styles.reminderList}>
              {medicationReminders.map(reminder => (
                <MedicationReminderRow
                  key={reminder.id}
                  reminder={reminder}
                  onToggle={enabled => toggleMedicationReminder(reminder.id, enabled)}
                  onRemove={() => removeMedicationReminder(reminder.id)}
                />
              ))}
            </View>
          )}

          {/* Bouton d'ajout */}
          <TouchableOpacity
            style={styles.addReminderButton}
            onPress={() => setShowReminderForm(true)}
            accessibilityLabel="Ajouter un rappel de médicament"
            accessibilityRole="button"
          >
            <Text style={styles.addReminderButtonText}>+ Ajouter un rappel</Text>
          </TouchableOpacity>
        </SectionCard>

        {/* ── Section : Sécurité ──────────────────────────────────────────── */}
        {onNavigateToSecurity !== undefined && (
          <SectionCard title="Sécurité et confidentialité">
            <TouchableOpacity
              style={styles.navigationRow}
              onPress={onNavigateToSecurity}
              accessibilityLabel="Accéder aux paramètres de sécurité"
              accessibilityRole="button"
              accessibilityHint="Ouvre l'écran de configuration de l'authentification et du Kit de Récupération"
            >
              <View style={styles.navigationRowContent}>
                <Text style={styles.navigationRowIcon}>🔒</Text>
                <View style={styles.navigationRowText}>
                  <Text style={styles.navigationRowLabel}>
                    Authentification et chiffrement
                  </Text>
                  <Text style={styles.navigationRowDescription}>
                    PIN, biométrie, Kit de Récupération, sauvegarde cloud
                  </Text>
                </View>
              </View>
              <Text style={styles.navigationRowChevron} accessibilityElementsHidden={true}>
                ›
              </Text>
            </TouchableOpacity>
          </SectionCard>
        )}

        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* ── Modal : Formulaire d'ajout de rappel ────────────────────────── */}
      <Modal
        visible={showReminderForm}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowReminderForm(false)}
        accessibilityViewIsModal={true}
      >
        <MedicationReminderForm
          onSave={async reminder => {
            await addMedicationReminder(reminder)
            setShowReminderForm(false)
          }}
          onCancel={() => setShowReminderForm(false)}
        />
      </Modal>
    </SafeAreaView>
  )
}

// ─── Composants auxiliaires ───────────────────────────────────────────────────

interface SectionCardProps {
  title: string
  children: React.ReactNode
}

function SectionCard({ title, children }: SectionCardProps): React.JSX.Element {
  return (
    <View style={sectionStyles.card}>
      <Text style={sectionStyles.title} accessibilityRole="header">
        {title}
      </Text>
      {children}
    </View>
  )
}

const sectionStyles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: '#212121',
    marginBottom: 14,
  },
})

interface SettingsRowProps {
  label: string
  accessibilityLabel?: string
  children: React.ReactNode
}

function SettingsRow({ label, accessibilityLabel, children }: SettingsRowProps): React.JSX.Element {
  return (
    <View
      style={rowStyles.row}
      accessible={true}
      accessibilityLabel={accessibilityLabel ?? label}
    >
      <Text style={rowStyles.label}>{label}</Text>
      {children}
    </View>
  )
}

const rowStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
    marginBottom: 8,
  },
  label: {
    fontSize: 14,
    color: '#424242',
    flex: 1,
    marginRight: 12,
  },
})

interface MedicationReminderRowProps {
  reminder: MedicationReminder
  onToggle: (enabled: boolean) => void
  onRemove: () => void
}

function MedicationReminderRow({
  reminder,
  onToggle,
  onRemove,
}: MedicationReminderRowProps): React.JSX.Element {
  const frequencyLabels: Record<MedicationReminder['frequency'], string> = {
    once_per_cycle: 'Une fois par cycle',
    daily: 'Quotidien',
    custom: 'Personnalisé',
  }

  return (
    <View
      style={reminderRowStyles.row}
      accessible={true}
      accessibilityLabel={`Rappel : ${reminder.name}, ${frequencyLabels[reminder.frequency]}, ${reminder.timingBeforePeriod} jour${reminder.timingBeforePeriod > 1 ? 's' : ''} avant les règles à ${reminder.timeOfDay}`}
    >
      <View style={reminderRowStyles.content}>
        <Text style={reminderRowStyles.name}>{reminder.name}</Text>
        <Text style={reminderRowStyles.details} accessibilityElementsHidden={true}>
          {frequencyLabels[reminder.frequency]} · {reminder.timingBeforePeriod}j avant · {reminder.timeOfDay}
        </Text>
      </View>
      <Switch
        value={reminder.enabled}
        onValueChange={onToggle}
        trackColor={{ false: '#E0E0E0', true: '#F48FB1' }}
        thumbColor={reminder.enabled ? '#E91E63' : '#BDBDBD'}
        accessibilityLabel={`${reminder.enabled ? 'Désactiver' : 'Activer'} le rappel ${reminder.name}`}
        accessibilityRole="switch"
        accessibilityState={{ checked: reminder.enabled }}
      />
      <TouchableOpacity
        style={reminderRowStyles.removeButton}
        onPress={onRemove}
        accessibilityLabel={`Supprimer le rappel ${reminder.name}`}
        accessibilityRole="button"
      >
        <Text style={reminderRowStyles.removeButtonText}>✕</Text>
      </TouchableOpacity>
    </View>
  )
}

const reminderRowStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
    gap: 8,
  },
  content: {
    flex: 1,
  },
  name: {
    fontSize: 14,
    fontWeight: '600',
    color: '#212121',
    marginBottom: 2,
  },
  details: {
    fontSize: 12,
    color: '#9E9E9E',
  },
  removeButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FFEBEE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeButtonText: {
    fontSize: 12,
    color: '#EF5350',
    fontWeight: '700',
  },
})

// ─── Styles principaux ────────────────────────────────────────────────────────

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
  screenTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#212121',
    marginBottom: 16,
  },
  sectionNote: {
    fontSize: 12,
    color: '#9E9E9E',
    marginBottom: 12,
    fontStyle: 'italic',
  },
  // ── Mode de suivi ───────────────────────────────────────────────────────
  modeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    marginBottom: 8,
    backgroundColor: '#FAFAFA',
  },
  modeOptionSelected: {
    borderColor: '#E91E63',
    backgroundColor: '#FCE4EC',
  },
  modeOptionContent: {
    flex: 1,
  },
  modeOptionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#424242',
    marginBottom: 2,
  },
  modeOptionLabelSelected: {
    color: '#880E4F',
  },
  modeOptionDescription: {
    fontSize: 12,
    color: '#9E9E9E',
    lineHeight: 16,
  },
  checkmark: {
    fontSize: 16,
    color: '#E91E63',
    fontWeight: '700',
    marginLeft: 8,
  },
  // ── Langue ──────────────────────────────────────────────────────────────
  languageRow: {
    flexDirection: 'row',
    gap: 12,
  },
  languageButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    backgroundColor: '#FAFAFA',
  },
  languageButtonSelected: {
    borderColor: '#E91E63',
    backgroundColor: '#FCE4EC',
  },
  languageFlag: {
    fontSize: 20,
  },
  languageLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#424242',
  },
  languageLabelSelected: {
    color: '#880E4F',
  },
  // ── Notifications ────────────────────────────────────────────────────────
  subSection: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F5F5F5',
  },
  subSectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#616161',
    marginBottom: 4,
  },
  subSectionNote: {
    fontSize: 11,
    color: '#BDBDBD',
    marginBottom: 10,
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  dayChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    backgroundColor: '#FAFAFA',
    minWidth: 44,
    alignItems: 'center',
  },
  dayChipSelected: {
    borderColor: '#E91E63',
    backgroundColor: '#FCE4EC',
  },
  dayChipText: {
    fontSize: 13,
    color: '#616161',
    fontWeight: '500',
  },
  dayChipTextSelected: {
    color: '#880E4F',
    fontWeight: '700',
  },
  // ── Rappels de médicaments ───────────────────────────────────────────────
  reminderList: {
    marginTop: 8,
    marginBottom: 12,
  },
  addReminderButton: {
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E91E63',
    borderStyle: 'dashed',
    alignItems: 'center',
    marginTop: 8,
  },
  addReminderButtonText: {
    fontSize: 14,
    color: '#E91E63',
    fontWeight: '600',
  },
  // ── Navigation vers sécurité ─────────────────────────────────────────────
  navigationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  navigationRowContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  navigationRowIcon: {
    fontSize: 22,
  },
  navigationRowText: {
    flex: 1,
  },
  navigationRowLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#212121',
    marginBottom: 2,
  },
  navigationRowDescription: {
    fontSize: 12,
    color: '#9E9E9E',
  },
  navigationRowChevron: {
    fontSize: 22,
    color: '#BDBDBD',
    fontWeight: '300',
  },
  bottomSpacer: {
    height: 24,
  },
})
