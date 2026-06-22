/**
 * SettingsScreen — réglages de l'application.
 *
 * Sections : mode de suivi, langue, notifications, rappels de médicaments,
 * accès sécurité. Restylé avec le système de design (cartes, icônes, tokens).
 *
 * Exigences : 4.4, 4.5, 6.1, 6.5, 8.1, 8.5, 15.2, 15.3
 */

import React, { useState } from 'react'
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Switch,
  ActivityIndicator,
  Modal,
} from 'react-native'
import { useSettings } from './useSettings'
import { MedicationReminderForm } from './MedicationReminderForm'
import { SecurityScreen } from './SecurityScreen'
import { Screen, AppText, Card, Button, Icon } from '../components'
import type { IconName } from '../components'
import { colors, spacing, radii } from '../theme'
import type { TrackingMode, MedicationReminder } from '../../infrastructure/db/CycleRepository'
import type { SupportedLanguage } from '../../domain/shared/types'

function getModeOptions(fr: boolean): Array<{
  value: TrackingMode
  icon: IconName
  label: string
  description: string
}> {
  return [
    {
      value: 'general',
      icon: 'chart',
      label: fr ? 'Suivi général' : 'General tracking',
      description: fr
        ? 'Informations équilibrées sur toutes les phases du cycle'
        : 'Balanced information across all cycle phases',
    },
    {
      value: 'trying_to_conceive',
      icon: 'heart',
      label: fr ? 'Essai bébé' : 'Trying to conceive',
      description: fr
        ? 'Met en évidence la période féconde et les notifications de fertilité'
        : 'Highlights the fertile window and fertility notifications',
    },
    {
      value: 'natural_contraception',
      icon: 'shield',
      label: fr ? 'Contraception naturelle' : 'Natural contraception',
      description: fr
        ? 'Affiche les avertissements sur les jours à risque'
        : 'Shows warnings about high-risk days',
    },
  ]
}

const LANGUAGE_OPTIONS: Array<{ value: SupportedLanguage; label: string }> = [
  { value: 'fr', label: 'Français' },
  { value: 'en', label: 'English' },
]

const ADVANCE_NOTICE_OPTIONS = [1, 2, 3, 4, 5, 6, 7]

const SWITCH_TRACK = { false: colors.border, true: colors.primaryMuted }

interface SettingsScreenProps {
  onNavigateToSecurity?: () => void
}

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

  const [showReminderForm, setShowReminderForm] = useState(false)
  const [showSecurity, setShowSecurity] = useState(false)
  const fr = currentLanguage !== 'en'

  if (showSecurity) {
    return <SecurityScreen onBack={() => setShowSecurity(false)} />
  }

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    )
  }

  if (error !== null || preferences === null) {
    return (
      <Screen scroll={false} contentStyle={styles.centered}>
        <AppText variant="body" tone="secondary" center>
          {error ?? (fr ? 'Impossible de charger les paramètres' : 'Could not load settings')}
        </AppText>
        <View style={{ height: spacing.lg }} />
        <Button label={fr ? 'Réessayer' : 'Retry'} onPress={refresh} fullWidth={false} />
      </Screen>
    )
  }

  const { trackingMode, notificationPreferences, medicationReminders } = preferences

  async function handleAdvanceNoticeToggle(days: number): Promise<void> {
    const current = notificationPreferences.periodAdvanceNoticeDays
    const updated = current.includes(days)
      ? current.filter((d) => d !== days)
      : [...current, days].sort((a, b) => b - a)
    await updateNotificationPreferences({ periodAdvanceNoticeDays: updated })
  }

  return (
    <Screen>
      <AppText variant="h1" style={styles.title} accessibilityRole="header">
        {fr ? 'Réglages' : 'Settings'}
      </AppText>

      {/* Mode de suivi */}
      <Section title={fr ? 'Mode de suivi' : 'Tracking mode'}>
        <View accessibilityRole="radiogroup">
          {getModeOptions(fr).map((opt) => {
            const selected = trackingMode === opt.value
            return (
              <TouchableOpacity
                key={opt.value}
                activeOpacity={0.7}
                style={[styles.modeOption, selected && styles.modeOptionSelected]}
                onPress={() => setTrackingMode(opt.value)}
                accessibilityRole="radio"
                accessibilityState={{ checked: selected }}
                accessibilityLabel={`${opt.label}. ${opt.description}`}
              >
                <Icon
                  name={opt.icon}
                  size={20}
                  color={selected ? colors.primaryDark : colors.textSecondary}
                />
                <View style={styles.modeText}>
                  <AppText
                    variant="bodyStrong"
                    style={selected ? { color: colors.primaryDark } : undefined}
                  >
                    {opt.label}
                  </AppText>
                  <AppText variant="caption" tone="secondary" style={styles.modeDesc}>
                    {opt.description}
                  </AppText>
                </View>
                {selected && <Icon name="check" size={18} color={colors.primary} />}
              </TouchableOpacity>
            )
          })}
        </View>
      </Section>

      {/* Langue */}
      <Section title={fr ? 'Langue' : 'Language'}>
        <AppText variant="caption" tone="tertiary" style={styles.note}>
          {fr
            ? "Le changement s'applique immédiatement à toute l'interface."
            : 'The change applies immediately across the whole interface.'}
        </AppText>
        <View style={styles.langRow}>
          {LANGUAGE_OPTIONS.map((opt) => {
            const selected = currentLanguage === opt.value
            return (
              <TouchableOpacity
                key={opt.value}
                activeOpacity={0.7}
                style={[styles.langButton, selected && styles.langButtonSelected]}
                onPress={() => setLanguage(opt.value)}
                accessibilityRole="radio"
                accessibilityState={{ checked: selected }}
                accessibilityLabel={opt.label}
              >
                <AppText
                  variant="bodyStrong"
                  style={selected ? { color: colors.primaryDark } : { color: colors.textSecondary }}
                >
                  {opt.label}
                </AppText>
              </TouchableOpacity>
            )
          })}
        </View>
      </Section>

      {/* Notifications */}
      <Section title="Notifications">
        <Row label={fr ? 'Activer les notifications' : 'Enable notifications'}>
          <Switch
            value={notificationPreferences.enabled}
            onValueChange={(enabled) => updateNotificationPreferences({ enabled })}
            trackColor={SWITCH_TRACK}
            thumbColor={notificationPreferences.enabled ? colors.primary : colors.textTertiary}
          />
        </Row>

        {notificationPreferences.enabled && (
          <>
            <View style={styles.subSection}>
              <AppText variant="label" tone="secondary">
                {fr ? 'Rappels avant les règles' : 'Reminders before your period'}
              </AppText>
              <AppText variant="tiny" tone="tertiary" style={styles.subNote}>
                {fr ? 'Sélectionnez les délais souhaités (1 à 7 jours)' : 'Choose your preferred lead times (1 to 7 days)'}
              </AppText>
              <View style={styles.chipsGrid}>
                {ADVANCE_NOTICE_OPTIONS.map((days) => {
                  const isSelected =
                    notificationPreferences.periodAdvanceNoticeDays.includes(days)
                  return (
                    <DayChip
                      key={days}
                      label={`${days}j`}
                      selected={isSelected}
                      onPress={() => handleAdvanceNoticeToggle(days)}
                      accessibilityLabel={fr ? `${days} jour${days > 1 ? 's' : ''} avant` : `${days} day${days > 1 ? 's' : ''} before`}
                    />
                  )
                })}
              </View>
            </View>

            <View style={styles.subSection}>
              <AppText variant="label" tone="secondary">
                {fr ? 'Rappel avant la période féconde' : 'Reminder before the fertile window'}
              </AppText>
              <View style={styles.chipsGrid}>
                {[1, 2, 3].map((days) => {
                  const isSelected =
                    notificationPreferences.fertileWindowAdvanceNoticeDays === days
                  return (
                    <DayChip
                      key={days}
                      label={`${days}j`}
                      selected={isSelected}
                      onPress={() =>
                        updateNotificationPreferences({ fertileWindowAdvanceNoticeDays: days })
                      }
                      accessibilityLabel={fr ? `${days} jour${days > 1 ? 's' : ''} avant` : `${days} day${days > 1 ? 's' : ''} before`}
                    />
                  )
                })}
              </View>
            </View>
          </>
        )}
      </Section>

      {/* Rappels de médicaments */}
      <Section title={fr ? 'Rappels de médicaments' : 'Medication reminders'}>
        <Row label={fr ? 'Activer les rappels' : 'Enable reminders'}>
          <Switch
            value={notificationPreferences.medicationRemindersEnabled}
            onValueChange={(enabled) =>
              updateNotificationPreferences({ medicationRemindersEnabled: enabled })
            }
            trackColor={SWITCH_TRACK}
            thumbColor={
              notificationPreferences.medicationRemindersEnabled
                ? colors.primary
                : colors.textTertiary
            }
          />
        </Row>

        {medicationReminders.length > 0 && (
          <View style={styles.reminderList}>
            {medicationReminders.map((reminder) => (
              <MedicationReminderRow
                key={reminder.id}
                reminder={reminder}
                fr={fr}
                onToggle={(enabled) => toggleMedicationReminder(reminder.id, enabled)}
                onRemove={() => removeMedicationReminder(reminder.id)}
              />
            ))}
          </View>
        )}

        <TouchableOpacity
          activeOpacity={0.7}
          style={styles.addReminder}
          onPress={() => setShowReminderForm(true)}
          accessibilityRole="button"
          accessibilityLabel={fr ? 'Ajouter un rappel de médicament' : 'Add a medication reminder'}
        >
          <Icon name="plus" size={18} color={colors.primaryDark} />
          <AppText variant="bodyStrong" style={{ color: colors.primaryDark }}>
            {fr ? 'Ajouter un rappel' : 'Add a reminder'}
          </AppText>
        </TouchableOpacity>
      </Section>

      {/* Sécurité */}
      <Section title={fr ? 'Sécurité et confidentialité' : 'Security & privacy'}>
          <TouchableOpacity
            activeOpacity={0.7}
            style={styles.navRow}
            onPress={onNavigateToSecurity ?? (() => setShowSecurity(true))}
            accessibilityRole="button"
            accessibilityLabel={fr ? 'Accéder aux paramètres de sécurité' : 'Open security settings'}
          >
            <Icon name="lock" size={22} color={colors.primaryDark} />
            <View style={styles.navText}>
              <AppText variant="bodyStrong">
                {fr ? 'Authentification et chiffrement' : 'Authentication & encryption'}
              </AppText>
              <AppText variant="caption" tone="secondary">
                {fr ? 'PIN, biométrie, Kit de Récupération, sauvegarde cloud' : 'PIN, biometrics, Recovery Kit, cloud backup'}
              </AppText>
            </View>
            <Icon name="chevronRight" size={20} color={colors.textTertiary} />
          </TouchableOpacity>
      </Section>

      <View style={styles.privacyFooter}>
        <Icon name="lock" size={14} color={colors.success} />
        <AppText variant="caption" style={{ color: colors.phase.follicular.text }}>
          {fr ? 'Tes données restent sur ton appareil, chiffrées.' : 'Your data stays on your device, encrypted.'}
        </AppText>
      </View>

      <Modal
        visible={showReminderForm}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowReminderForm(false)}
      >
        <MedicationReminderForm
          fr={fr}
          onSave={async (reminder) => {
            await addMedicationReminder(reminder)
            setShowReminderForm(false)
          }}
          onCancel={() => setShowReminderForm(false)}
        />
      </Modal>
    </Screen>
  )
}

// ─── Sous-composants ──────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <Card style={styles.section}>
      <AppText variant="h3" style={styles.sectionTitle} accessibilityRole="header">
        {title}
      </AppText>
      {children}
    </Card>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <View style={styles.row} accessible accessibilityLabel={label}>
      <AppText variant="body" style={styles.rowLabel}>
        {label}
      </AppText>
      {children}
    </View>
  )
}

function DayChip({
  label,
  selected,
  onPress,
  accessibilityLabel,
}: {
  label: string
  selected: boolean
  onPress: () => void
  accessibilityLabel: string
}): React.JSX.Element {
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      style={[styles.chip, selected && styles.chipSelected]}
      onPress={onPress}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={accessibilityLabel}
    >
      <AppText
        variant="caption"
        style={selected ? { color: colors.primaryDark, fontWeight: '700' } : { color: colors.textSecondary }}
      >
        {label}
      </AppText>
    </TouchableOpacity>
  )
}

function MedicationReminderRow({
  reminder,
  onToggle,
  onRemove,
  fr,
}: {
  reminder: MedicationReminder
  onToggle: (enabled: boolean) => void
  onRemove: () => void
  fr: boolean
}): React.JSX.Element {
  const frequencyLabels: Record<MedicationReminder['frequency'], string> = fr
    ? { once_per_cycle: 'Une fois par cycle', daily: 'Quotidien', custom: 'Personnalisé' }
    : { once_per_cycle: 'Once per cycle', daily: 'Daily', custom: 'Custom' }

  return (
    <View style={styles.reminderRow}>
      <View style={styles.reminderContent}>
        <AppText variant="bodyStrong">{reminder.name}</AppText>
        <AppText variant="caption" tone="tertiary">
          {frequencyLabels[reminder.frequency]} · {reminder.timingBeforePeriod}{fr ? 'j avant' : 'd before'} · {reminder.timeOfDay}
        </AppText>
      </View>
      <Switch
        value={reminder.enabled}
        onValueChange={onToggle}
        trackColor={SWITCH_TRACK}
        thumbColor={reminder.enabled ? colors.primary : colors.textTertiary}
      />
      <TouchableOpacity
        style={styles.removeButton}
        onPress={onRemove}
        accessibilityRole="button"
        accessibilityLabel={fr ? `Supprimer le rappel ${reminder.name}` : `Delete reminder ${reminder.name}`}
      >
        <Icon name="trash" size={16} color={colors.danger} />
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    marginBottom: spacing.lg,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    marginBottom: spacing.md,
  },
  note: {
    marginBottom: spacing.md,
    fontStyle: 'italic',
  },
  modeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
    backgroundColor: colors.background,
  },
  modeOptionSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  modeText: {
    flex: 1,
  },
  modeDesc: {
    marginTop: 2,
    lineHeight: 16,
  },
  langRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  langButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  langButtonSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
  },
  rowLabel: {
    flex: 1,
    marginRight: spacing.md,
  },
  subSection: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  subNote: {
    marginTop: 2,
    marginBottom: spacing.sm,
  },
  chipsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    minWidth: 44,
    alignItems: 'center',
  },
  chipSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  reminderList: {
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  reminderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.sm,
  },
  reminderContent: {
    flex: 1,
  },
  removeButton: {
    width: 30,
    height: 30,
    borderRadius: radii.pill,
    backgroundColor: colors.dangerSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addReminder: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.primaryMuted,
    borderStyle: 'dashed',
    marginTop: spacing.sm,
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  navText: {
    flex: 1,
  },
  privacyFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
})
