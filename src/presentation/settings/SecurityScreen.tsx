/**
 * SecurityScreen — Écran de configuration de la sécurité et de la confidentialité.
 *
 * Sections :
 * 1. Authentification (PIN, biométrie)
 * 2. Verrouillage automatique
 * 3. Sauvegarde cloud avec Kit de Récupération
 *    - Bloquée tant que recoveryKitGenerated === false (Exigence 10.6)
 *    - Flux : générer le Kit → afficher les 12 mots → confirmer → débloquer
 *
 * Exigences : 10.2, 10.3, 10.4, 10.5, 10.6, 10.7
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
  Alert,
} from 'react-native'
import { useSettings } from './useSettings'
import { RecoveryKitScreen } from './RecoveryKitScreen'
import type { SecuritySettings } from '../../infrastructure/db/CycleRepository'

// ─── Constantes ───────────────────────────────────────────────────────────────

const AUTO_LOCK_OPTIONS = [
  { value: 1, label: '1 minute' },
  { value: 5, label: '5 minutes' },
  { value: 15, label: '15 minutes' },
  { value: 30, label: '30 minutes' },
]

// ─── Composant ────────────────────────────────────────────────────────────────

interface SecurityScreenProps {
  /** Callback pour revenir aux paramètres généraux */
  onBack?: () => void
}

/**
 * Écran de sécurité et confidentialité.
 *
 * Structure :
 * 1. Authentification (PIN / biométrie)
 * 2. Verrouillage automatique
 * 3. Sauvegarde cloud (bloquée sans Kit de Récupération)
 */
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

  // Affichage du flux Kit de Récupération
  const [showRecoveryKitFlow, setShowRecoveryKitFlow] = useState(false)

  // ── États de chargement / erreur ──────────────────────────────────────────

  if (isLoading) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator
          size="large"
          color="#E91E63"
          accessibilityLabel="Chargement des paramètres de sécurité"
        />
        <Text style={styles.loadingText}>Chargement…</Text>
      </SafeAreaView>
    )
  }

  if (error !== null || preferences === null) {
    return (
      <SafeAreaView style={styles.centered}>
        <Text style={styles.errorText} accessibilityRole="alert">
          {error ?? 'Impossible de charger les paramètres de sécurité'}
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

  // ── Flux Kit de Récupération ──────────────────────────────────────────────

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

  // ── Handlers ──────────────────────────────────────────────────────────────

  async function handleAuthToggle(enabled: boolean): Promise<void> {
    if (enabled) {
      // En production : lancer le flux de configuration PIN/biométrie
      // Pour l'instant, activer directement avec le type par défaut
      await updateSecuritySettings({ authenticationEnabled: true })
    } else {
      Alert.alert(
        'Désactiver l\'authentification',
        'Êtes-vous sûre de vouloir désactiver la protection par code PIN ou biométrie ?',
        [
          { text: 'Annuler', style: 'cancel' },
          {
            text: 'Désactiver',
            style: 'destructive',
            onPress: async () => {
              await updateSecuritySettings({
                authenticationEnabled: false,
                autoLockEnabled: false,
              })
            },
          },
        ],
      )
    }
  }

  async function handleAuthTypeChange(type: SecuritySettings['authenticationType']): Promise<void> {
    await updateSecuritySettings({ authenticationType: type })
  }

  async function handleAutoLockToggle(enabled: boolean): Promise<void> {
    await updateSecuritySettings({ autoLockEnabled: enabled })
  }

  async function handleAutoLockTimeoutChange(minutes: number): Promise<void> {
    await updateSecuritySettings({ autoLockTimeoutMinutes: minutes })
  }

  /**
   * Gère l'activation de la sauvegarde cloud.
   * Exigence 10.6 : bloquer la sync tant que recoveryKitGenerated === false.
   */
  async function handleCloudBackupToggle(enabled: boolean): Promise<void> {
    if (enabled) {
      if (!securitySettings.recoveryKitGenerated) {
        // Lancer le flux de génération du Kit de Récupération
        setShowRecoveryKitFlow(true)
      } else {
        // Kit déjà généré — activer directement
        await updateSecuritySettings({ cloudBackupEnabled: true })
      }
    } else {
      Alert.alert(
        'Désactiver la sauvegarde cloud',
        'Vos données ne seront plus sauvegardées dans le cloud. Vos données locales restent intactes.',
        [
          { text: 'Annuler', style: 'cancel' },
          {
            text: 'Désactiver',
            style: 'destructive',
            onPress: async () => {
              await updateSecuritySettings({ cloudBackupEnabled: false })
            },
          },
        ],
      )
    }
  }

  // ── Rendu ─────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* En-tête avec bouton retour */}
        <View style={styles.header}>
          {onBack !== undefined && (
            <TouchableOpacity
              style={styles.backButton}
              onPress={onBack}
              accessibilityLabel="Retour aux paramètres"
              accessibilityRole="button"
            >
              <Text style={styles.backButtonText}>‹ Retour</Text>
            </TouchableOpacity>
          )}
          <Text style={styles.screenTitle} accessibilityRole="header">
            Sécurité
          </Text>
        </View>

        {/* ── Section : Authentification ──────────────────────────────────── */}
        {/* Exigences 10.2, 10.3 */}
        <SectionCard title="🔐 Authentification">
          <Text style={styles.sectionDescription}>
            Protégez l'accès à vos données avec un code PIN ou votre biométrie.
          </Text>

          <SettingsRow
            label="Activer l'authentification"
            accessibilityLabel={`Authentification ${securitySettings.authenticationEnabled ? 'activée' : 'désactivée'}`}
          >
            <Switch
              value={securitySettings.authenticationEnabled}
              onValueChange={handleAuthToggle}
              trackColor={{ false: '#E0E0E0', true: '#F48FB1' }}
              thumbColor={securitySettings.authenticationEnabled ? '#E91E63' : '#BDBDBD'}
              accessibilityLabel="Activer ou désactiver l'authentification"
              accessibilityRole="switch"
              accessibilityState={{ checked: securitySettings.authenticationEnabled }}
            />
          </SettingsRow>

          {securitySettings.authenticationEnabled && (
            <View style={styles.subSection}>
              <Text style={styles.subSectionTitle}>Type d'authentification</Text>
              <View
                style={styles.authTypeRow}
                accessible={true}
                accessibilityLabel="Type d'authentification"
                accessibilityRole="radiogroup"
              >
                <AuthTypeButton
                  value="pin"
                  label="🔢 Code PIN"
                  description="Code à 4-6 chiffres"
                  selected={securitySettings.authenticationType === 'pin'}
                  onPress={() => handleAuthTypeChange('pin')}
                />
                <AuthTypeButton
                  value="biometric"
                  label="👆 Biométrie"
                  description="Face ID / Touch ID"
                  selected={securitySettings.authenticationType === 'biometric'}
                  onPress={() => handleAuthTypeChange('biometric')}
                />
              </View>

              {securitySettings.authenticationType === 'biometric' && (
                <View style={styles.biometricNote}>
                  <Text style={styles.biometricNoteText}>
                    ℹ️ En cas d'échec biométrique, le code PIN sera proposé comme
                    alternative.
                  </Text>
                </View>
              )}
            </View>
          )}
        </SectionCard>

        {/* ── Section : Verrouillage automatique ─────────────────────────── */}
        {/* Exigence 10.4 */}
        {securitySettings.authenticationEnabled && (
          <SectionCard title="⏱️ Verrouillage automatique">
            <SettingsRow
              label="Verrouiller automatiquement"
              accessibilityLabel={`Verrouillage automatique ${securitySettings.autoLockEnabled ? 'activé' : 'désactivé'}`}
            >
              <Switch
                value={securitySettings.autoLockEnabled}
                onValueChange={handleAutoLockToggle}
                trackColor={{ false: '#E0E0E0', true: '#F48FB1' }}
                thumbColor={securitySettings.autoLockEnabled ? '#E91E63' : '#BDBDBD'}
                accessibilityLabel="Activer ou désactiver le verrouillage automatique"
                accessibilityRole="switch"
                accessibilityState={{ checked: securitySettings.autoLockEnabled }}
              />
            </SettingsRow>

            {securitySettings.autoLockEnabled && (
              <View style={styles.subSection}>
                <Text style={styles.subSectionTitle}>Délai de verrouillage</Text>
                <View
                  style={styles.lockTimeoutGrid}
                  accessible={true}
                  accessibilityLabel="Délai avant verrouillage automatique"
                  accessibilityRole="radiogroup"
                >
                  {AUTO_LOCK_OPTIONS.map(opt => (
                    <TouchableOpacity
                      key={opt.value}
                      style={[
                        styles.lockTimeoutOption,
                        securitySettings.autoLockTimeoutMinutes === opt.value &&
                          styles.lockTimeoutOptionSelected,
                      ]}
                      onPress={() => handleAutoLockTimeoutChange(opt.value)}
                      accessibilityRole="radio"
                      accessibilityState={{
                        checked: securitySettings.autoLockTimeoutMinutes === opt.value,
                      }}
                      accessibilityLabel={`${opt.label}${securitySettings.autoLockTimeoutMinutes === opt.value ? ', sélectionné' : ''}`}
                    >
                      <Text
                        style={[
                          styles.lockTimeoutText,
                          securitySettings.autoLockTimeoutMinutes === opt.value &&
                            styles.lockTimeoutTextSelected,
                        ]}
                      >
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}
          </SectionCard>
        )}

        {/* ── Section : Sauvegarde cloud ──────────────────────────────────── */}
        {/* Exigences 10.5, 10.6, 10.7 */}
        <SectionCard title="☁️ Sauvegarde cloud">
          <Text style={styles.sectionDescription}>
            Sauvegardez vos données chiffrées dans le cloud. Seul votre Kit de
            Récupération peut les déchiffrer — même nous n'y avons pas accès.
          </Text>

          {/* Statut du Kit de Récupération */}
          <View
            style={[
              styles.kitStatusCard,
              securitySettings.recoveryKitGenerated
                ? styles.kitStatusCardOk
                : styles.kitStatusCardWarning,
            ]}
            accessible={true}
            accessibilityLabel={
              securitySettings.recoveryKitGenerated
                ? 'Kit de Récupération configuré'
                : 'Kit de Récupération non configuré — requis pour la sauvegarde cloud'
            }
            accessibilityRole="text"
          >
            <Text style={styles.kitStatusIcon} accessibilityElementsHidden={true}>
              {securitySettings.recoveryKitGenerated ? '✅' : '⚠️'}
            </Text>
            <View style={styles.kitStatusContent}>
              <Text style={styles.kitStatusTitle}>
                {securitySettings.recoveryKitGenerated
                  ? 'Kit de Récupération configuré'
                  : 'Kit de Récupération requis'}
              </Text>
              <Text style={styles.kitStatusDescription}>
                {securitySettings.recoveryKitGenerated
                  ? 'Votre kit est prêt. Conservez vos 12 mots en lieu sûr.'
                  : 'Vous devez créer votre Kit de Récupération avant d\'activer la sauvegarde cloud.'}
              </Text>
            </View>
          </View>

          {/* Bouton pour (re)générer le kit */}
          {!securitySettings.recoveryKitGenerated && (
            <TouchableOpacity
              style={styles.generateKitButton}
              onPress={() => setShowRecoveryKitFlow(true)}
              accessibilityLabel="Créer mon Kit de Récupération"
              accessibilityRole="button"
              accessibilityHint="Lance le flux de génération du Kit de Récupération"
            >
              <Text style={styles.generateKitButtonText}>
                🔑 Créer mon Kit de Récupération
              </Text>
            </TouchableOpacity>
          )}

          {/* Toggle sauvegarde cloud */}
          <SettingsRow
            label="Activer la sauvegarde cloud"
            accessibilityLabel={
              securitySettings.cloudBackupEnabled
                ? 'Sauvegarde cloud activée'
                : securitySettings.recoveryKitGenerated
                ? 'Sauvegarde cloud désactivée'
                : 'Sauvegarde cloud bloquée — Kit de Récupération requis'
            }
          >
            <Switch
              value={securitySettings.cloudBackupEnabled}
              onValueChange={handleCloudBackupToggle}
              trackColor={{ false: '#E0E0E0', true: '#F48FB1' }}
              thumbColor={securitySettings.cloudBackupEnabled ? '#E91E63' : '#BDBDBD'}
              accessibilityLabel="Activer ou désactiver la sauvegarde cloud"
              accessibilityRole="switch"
              accessibilityState={{
                checked: securitySettings.cloudBackupEnabled,
                disabled: !securitySettings.recoveryKitGenerated && !securitySettings.cloudBackupEnabled,
              }}
            />
          </SettingsRow>

          {!securitySettings.recoveryKitGenerated && (
            <Text style={styles.cloudBlockedNote}>
              🔒 La sauvegarde cloud sera disponible après la création de votre
              Kit de Récupération.
            </Text>
          )}

          {securitySettings.cloudBackupEnabled && (
            <View style={styles.e2eeNote}>
              <Text style={styles.e2eeNoteText}>
                🛡️ Chiffrement de bout en bout actif. Vos données sont chiffrées
                avant d'être envoyées dans le cloud.
              </Text>
            </View>
          )}
        </SectionCard>

        {/* ── Section : Informations sur le chiffrement ───────────────────── */}
        <SectionCard title="ℹ️ À propos du chiffrement">
          <Text style={styles.infoText}>
            Toutes vos données (cycles, symptômes, prédictions) sont chiffrées
            avec AES-256 directement sur votre appareil. La clé de chiffrement
            est stockée dans le Keystore sécurisé de votre téléphone et ne quitte
            jamais votre appareil.
          </Text>
        </SectionCard>

        <View style={styles.bottomSpacer} />
      </ScrollView>
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
    <View style={cardStyles.card}>
      <Text style={cardStyles.title} accessibilityRole="header">
        {title}
      </Text>
      {children}
    </View>
  )
}

const cardStyles = StyleSheet.create({
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
    marginBottom: 10,
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

interface AuthTypeButtonProps {
  value: string
  label: string
  description: string
  selected: boolean
  onPress: () => void
}

function AuthTypeButton({
  label,
  description,
  selected,
  onPress,
}: AuthTypeButtonProps): React.JSX.Element {
  return (
    <TouchableOpacity
      style={[authStyles.button, selected && authStyles.buttonSelected]}
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={`${label}. ${description}`}
    >
      <Text
        style={[authStyles.label, selected && authStyles.labelSelected]}
      >
        {label}
      </Text>
      <Text
        style={authStyles.description}
        accessibilityElementsHidden={true}
      >
        {description}
      </Text>
    </TouchableOpacity>
  )
}

const authStyles = StyleSheet.create({
  button: {
    flex: 1,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    backgroundColor: '#FAFAFA',
    alignItems: 'center',
  },
  buttonSelected: {
    borderColor: '#E91E63',
    backgroundColor: '#FCE4EC',
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#424242',
    marginBottom: 2,
  },
  labelSelected: {
    color: '#880E4F',
  },
  description: {
    fontSize: 11,
    color: '#9E9E9E',
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
  header: {
    marginBottom: 16,
  },
  backButton: {
    marginBottom: 8,
  },
  backButtonText: {
    fontSize: 15,
    color: '#E91E63',
    fontWeight: '500',
  },
  screenTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#212121',
  },
  sectionDescription: {
    fontSize: 13,
    color: '#757575',
    lineHeight: 18,
    marginBottom: 14,
  },
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
    marginBottom: 10,
  },
  authTypeRow: {
    flexDirection: 'row',
    gap: 10,
  },
  biometricNote: {
    marginTop: 10,
    padding: 10,
    backgroundColor: '#E3F2FD',
    borderRadius: 8,
  },
  biometricNoteText: {
    fontSize: 12,
    color: '#1565C0',
    lineHeight: 17,
  },
  lockTimeoutGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  lockTimeoutOption: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    backgroundColor: '#FAFAFA',
  },
  lockTimeoutOptionSelected: {
    borderColor: '#E91E63',
    backgroundColor: '#FCE4EC',
  },
  lockTimeoutText: {
    fontSize: 13,
    color: '#616161',
  },
  lockTimeoutTextSelected: {
    color: '#880E4F',
    fontWeight: '600',
  },
  // ── Kit de Récupération ──────────────────────────────────────────────────
  kitStatusCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 12,
    borderRadius: 10,
    marginBottom: 14,
  },
  kitStatusCardOk: {
    backgroundColor: '#E8F5E9',
  },
  kitStatusCardWarning: {
    backgroundColor: '#FFF8E1',
  },
  kitStatusIcon: {
    fontSize: 20,
    marginTop: 1,
  },
  kitStatusContent: {
    flex: 1,
  },
  kitStatusTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#212121',
    marginBottom: 3,
  },
  kitStatusDescription: {
    fontSize: 12,
    color: '#616161',
    lineHeight: 17,
  },
  generateKitButton: {
    backgroundColor: '#E91E63',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 14,
  },
  generateKitButtonText: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  cloudBlockedNote: {
    fontSize: 12,
    color: '#9E9E9E',
    fontStyle: 'italic',
    marginTop: 4,
  },
  e2eeNote: {
    marginTop: 10,
    padding: 10,
    backgroundColor: '#E8F5E9',
    borderRadius: 8,
  },
  e2eeNoteText: {
    fontSize: 12,
    color: '#2E7D32',
    lineHeight: 17,
  },
  infoText: {
    fontSize: 13,
    color: '#757575',
    lineHeight: 19,
  },
  bottomSpacer: {
    height: 24,
  },
})
