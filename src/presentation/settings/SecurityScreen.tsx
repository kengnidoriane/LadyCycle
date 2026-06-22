/**
 * SecurityScreen — sécurité et confidentialité.
 *
 * Authentification (PIN/biométrie), verrouillage auto, sauvegarde cloud E2EE
 * (bloquée tant que le Kit de Récupération n'est pas généré — Exigence 10.6).
 * Restylé avec le système de design.
 *
 * Exigences : 10.2, 10.3, 10.4, 10.5, 10.6, 10.7
 */

import React, { useState } from 'react'
import { View, StyleSheet, TouchableOpacity, Switch, ActivityIndicator, Alert } from 'react-native'
import { useSettings } from './useSettings'
import { RecoveryKitScreen } from './RecoveryKitScreen'
import { Screen, ScreenHeader, AppText, Card, Button, Icon } from '../components'
import { colors, spacing, radii } from '../theme'
import { useI18n } from '../i18n/I18nContext'

const AUTO_LOCK_OPTIONS = [
  { value: 1, label: '1 min' },
  { value: 5, label: '5 min' },
  { value: 15, label: '15 min' },
  { value: 30, label: '30 min' },
]

const SWITCH_TRACK = { false: colors.border, true: colors.primaryMuted }

interface SecurityScreenProps {
  onBack?: () => void
}

export function SecurityScreen({ onBack }: SecurityScreenProps): React.JSX.Element {
  const {
    preferences,
    isLoading,
    error,
    updateSecuritySettings,
    generateRecoveryKit,
    confirmRecoveryKitSaved,
    refresh,
  } = useSettings()
  const { currentLanguage } = useI18n()
  const fr = currentLanguage !== 'en'

  const [showRecoveryKitFlow, setShowRecoveryKitFlow] = useState(false)

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
          {error ?? (fr ? 'Impossible de charger les paramètres de sécurité' : 'Could not load security settings')}
        </AppText>
        <View style={{ height: spacing.lg }} />
        <Button label={fr ? 'Réessayer' : 'Retry'} onPress={refresh} fullWidth={false} />
      </Screen>
    )
  }

  if (showRecoveryKitFlow) {
    return (
      <RecoveryKitScreen
        onGenerateKit={generateRecoveryKit}
        onConfirmSaved={confirmRecoveryKitSaved}
        onClose={() => {
          setShowRecoveryKitFlow(false)
          refresh()
        }}
      />
    )
  }

  const { securitySettings } = preferences

  async function handleAuthToggle(enabled: boolean): Promise<void> {
    if (enabled) {
      await updateSecuritySettings({ authenticationEnabled: true })
    } else {
      Alert.alert(
        fr ? "Désactiver l'authentification" : 'Disable authentication',
        fr
          ? 'Êtes-vous sûre de vouloir désactiver la protection par code PIN ou biométrie ?'
          : 'Are you sure you want to disable PIN or biometric protection?',
        [
          { text: fr ? 'Annuler' : 'Cancel', style: 'cancel' },
          {
            text: fr ? 'Désactiver' : 'Disable',
            style: 'destructive',
            onPress: async () => {
              await updateSecuritySettings({ authenticationEnabled: false, autoLockEnabled: false })
            },
          },
        ],
      )
    }
  }

  async function handleCloudBackupToggle(enabled: boolean): Promise<void> {
    if (enabled) {
      if (!securitySettings.recoveryKitGenerated) {
        setShowRecoveryKitFlow(true)
      } else {
        await updateSecuritySettings({ cloudBackupEnabled: true })
      }
    } else {
      Alert.alert(
        fr ? 'Désactiver la sauvegarde cloud' : 'Disable cloud backup',
        fr
          ? 'Vos données ne seront plus sauvegardées dans le cloud. Vos données locales restent intactes.'
          : 'Your data will no longer be backed up to the cloud. Your local data stays intact.',
        [
          { text: fr ? 'Annuler' : 'Cancel', style: 'cancel' },
          {
            text: fr ? 'Désactiver' : 'Disable',
            style: 'destructive',
            onPress: async () => {
              await updateSecuritySettings({ cloudBackupEnabled: false })
            },
          },
        ],
      )
    }
  }

  return (
    <Screen>
      {/* En-tête avec retour unifié */}
      <ScreenHeader
        title={fr ? 'Sécurité' : 'Security'}
        onBack={onBack ?? (() => {})}
        backLabel={fr ? 'Retour aux réglages' : 'Back to settings'}
      />

      {/* Authentification */}
      <Card style={styles.section}>
        <SectionHeader icon="lock" title={fr ? 'Authentification' : 'Authentication'} />
        <AppText variant="caption" tone="secondary" style={styles.desc}>
          {fr
            ? "Protège l'accès à tes données avec un code PIN ou ta biométrie."
            : 'Protect access to your data with a PIN or biometrics.'}
        </AppText>
        <Row label={fr ? "Activer l'authentification" : 'Enable authentication'}>
          <Switch
            value={securitySettings.authenticationEnabled}
            onValueChange={handleAuthToggle}
            trackColor={SWITCH_TRACK}
            thumbColor={securitySettings.authenticationEnabled ? colors.primary : colors.textTertiary}
          />
        </Row>

        {securitySettings.authenticationEnabled && (
          <View style={styles.subSection}>
            <AppText variant="label" tone="secondary" style={styles.subTitle}>
              {fr ? "Type d'authentification" : 'Authentication type'}
            </AppText>
            <View style={styles.authTypeRow}>
              <AuthTypeButton
                icon="pill"
                label={fr ? 'Code PIN' : 'PIN code'}
                description={fr ? '4-6 chiffres' : '4-6 digits'}
                selected={securitySettings.authenticationType === 'pin'}
                onPress={() => updateSecuritySettings({ authenticationType: 'pin' })}
              />
              <AuthTypeButton
                icon="check"
                label={fr ? 'Biométrie' : 'Biometrics'}
                description="Face / Touch ID"
                selected={securitySettings.authenticationType === 'biometric'}
                onPress={() => updateSecuritySettings({ authenticationType: 'biometric' })}
              />
            </View>
          </View>
        )}
      </Card>

      {/* Verrouillage auto */}
      {securitySettings.authenticationEnabled && (
        <Card style={styles.section}>
          <SectionHeader icon="clock" title={fr ? 'Verrouillage automatique' : 'Auto-lock'} />
          <Row label={fr ? 'Verrouiller automatiquement' : 'Lock automatically'}>
            <Switch
              value={securitySettings.autoLockEnabled}
              onValueChange={(enabled) => updateSecuritySettings({ autoLockEnabled: enabled })}
              trackColor={SWITCH_TRACK}
              thumbColor={securitySettings.autoLockEnabled ? colors.primary : colors.textTertiary}
            />
          </Row>
          {securitySettings.autoLockEnabled && (
            <View style={styles.subSection}>
              <AppText variant="label" tone="secondary" style={styles.subTitle}>
                {fr ? 'Délai de verrouillage' : 'Lock delay'}
              </AppText>
              <View style={styles.chipsRow}>
                {AUTO_LOCK_OPTIONS.map((opt) => {
                  const selected = securitySettings.autoLockTimeoutMinutes === opt.value
                  return (
                    <TouchableOpacity
                      key={opt.value}
                      activeOpacity={0.7}
                      style={[styles.chip, selected && styles.chipSelected]}
                      onPress={() => updateSecuritySettings({ autoLockTimeoutMinutes: opt.value })}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: selected }}
                      accessibilityLabel={opt.label}
                    >
                      <AppText
                        variant="caption"
                        style={selected ? { color: colors.primaryDark, fontWeight: '700' } : { color: colors.textSecondary }}
                      >
                        {opt.label}
                      </AppText>
                    </TouchableOpacity>
                  )
                })}
              </View>
            </View>
          )}
        </Card>
      )}

      {/* Sauvegarde cloud */}
      <Card style={styles.section}>
        <SectionHeader icon="shield" title={fr ? 'Sauvegarde cloud' : 'Cloud backup'} />
        <AppText variant="caption" tone="secondary" style={styles.desc}>
          {fr
            ? "Sauvegarde tes données chiffrées. Seul ton Kit de Récupération peut les déchiffrer — même nous n'y avons pas accès."
            : 'Back up your encrypted data. Only your Recovery Kit can decrypt it — not even we can access it.'}
        </AppText>

        {/* Statut du kit */}
        <View
          style={[
            styles.kitStatus,
            { backgroundColor: securitySettings.recoveryKitGenerated ? colors.successSoft : colors.phase.ovulation.soft },
          ]}
        >
          <Icon
            name={securitySettings.recoveryKitGenerated ? 'check' : 'info'}
            size={20}
            color={securitySettings.recoveryKitGenerated ? colors.phase.follicular.text : colors.phase.ovulation.text}
          />
          <View style={styles.kitStatusText}>
            <AppText variant="bodyStrong">
              {securitySettings.recoveryKitGenerated
                ? fr ? 'Kit de Récupération configuré' : 'Recovery Kit configured'
                : fr ? 'Kit de Récupération requis' : 'Recovery Kit required'}
            </AppText>
            <AppText variant="caption" tone="secondary">
              {securitySettings.recoveryKitGenerated
                ? fr ? 'Conserve tes 12 mots en lieu sûr.' : 'Keep your 12 words in a safe place.'
                : fr ? "À créer avant d'activer la sauvegarde cloud." : 'Create it before enabling cloud backup.'}
            </AppText>
          </View>
        </View>

        {!securitySettings.recoveryKitGenerated && (
          <Button
            label={fr ? 'Créer mon Kit de Récupération' : 'Create my Recovery Kit'}
            icon="lock"
            onPress={() => setShowRecoveryKitFlow(true)}
            style={styles.kitButton}
          />
        )}

        <Row label={fr ? 'Activer la sauvegarde cloud' : 'Enable cloud backup'}>
          <Switch
            value={securitySettings.cloudBackupEnabled}
            onValueChange={handleCloudBackupToggle}
            trackColor={SWITCH_TRACK}
            thumbColor={securitySettings.cloudBackupEnabled ? colors.primary : colors.textTertiary}
          />
        </Row>

        {securitySettings.cloudBackupEnabled && (
          <View style={styles.e2eeNote}>
            <Icon name="shield" size={16} color={colors.phase.follicular.text} />
            <AppText variant="caption" style={{ color: colors.phase.follicular.text, flex: 1 }}>
              {fr
                ? "Chiffrement de bout en bout actif. Tes données sont chiffrées avant l'envoi."
                : 'End-to-end encryption active. Your data is encrypted before upload.'}
            </AppText>
          </View>
        )}
      </Card>

      {/* À propos */}
      <Card style={styles.section}>
        <SectionHeader icon="info" title={fr ? 'À propos du chiffrement' : 'About encryption'} />
        <AppText variant="caption" tone="secondary" style={{ lineHeight: 19 }}>
          {fr
            ? "Toutes tes données (cycles, symptômes, prédictions) sont chiffrées avec AES-256 directement sur ton appareil. La clé est stockée dans le Keystore sécurisé du téléphone et ne quitte jamais l'appareil."
            : 'All your data (cycles, symptoms, predictions) is encrypted with AES-256 directly on your device. The key is stored in the phone’s secure Keystore and never leaves the device.'}
        </AppText>
      </Card>
    </Screen>
  )
}

function SectionHeader({ icon, title }: { icon: 'lock' | 'clock' | 'shield' | 'info'; title: string }): React.JSX.Element {
  return (
    <View style={styles.sectionHeader}>
      <Icon name={icon} size={18} color={colors.primaryDark} />
      <AppText variant="h3" accessibilityRole="header">
        {title}
      </AppText>
    </View>
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

function AuthTypeButton({
  icon,
  label,
  description,
  selected,
  onPress,
}: {
  icon: 'pill' | 'check'
  label: string
  description: string
  selected: boolean
  onPress: () => void
}): React.JSX.Element {
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      style={[styles.authButton, selected && styles.authButtonSelected]}
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={`${label}. ${description}`}
    >
      <Icon name={icon} size={20} color={selected ? colors.primaryDark : colors.textSecondary} />
      <AppText variant="caption" style={selected ? { color: colors.primaryDark, fontWeight: '700' } : undefined}>
        {label}
      </AppText>
      <AppText variant="tiny" tone="tertiary">
        {description}
      </AppText>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  backButton: {
    padding: spacing.xs,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  desc: {
    lineHeight: 18,
    marginBottom: spacing.md,
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
  subTitle: {
    marginBottom: spacing.sm,
  },
  authTypeRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  authButton: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  authButtonSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  chipSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  kitStatus: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radii.md,
    marginBottom: spacing.md,
  },
  kitStatusText: {
    flex: 1,
  },
  kitButton: {
    marginBottom: spacing.md,
  },
  e2eeNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.successSoft,
    borderRadius: radii.sm,
  },
})
