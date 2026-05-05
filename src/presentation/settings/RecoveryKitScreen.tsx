/**
 * RecoveryKitScreen — Flux d'activation du Kit de Récupération.
 *
 * Étapes du flux :
 * 1. Introduction : explication en langage simple du Kit de Récupération
 * 2. Génération : affichage des 12 mots BIP-39
 * 3. Confirmation : l'utilisatrice confirme avoir sauvegardé les mots
 * 4. Succès : la synchronisation cloud est débloquée
 *
 * Règle de sécurité : la synchronisation cloud est BLOQUÉE tant que
 * recoveryKitGenerated === false (Exigence 10.6).
 *
 * Exigences : 10.5, 10.6, 10.7
 */

import React, { useState } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  Alert,
} from 'react-native'
import type { RecoveryKit } from '../../infrastructure/crypto/RecoveryKitService'

// ─── Types ────────────────────────────────────────────────────────────────────

type FlowStep = 'intro' | 'generating' | 'display' | 'confirm' | 'success'

interface RecoveryKitScreenProps {
  /** Callback pour générer le kit (délégué à useSettings) */
  onGenerateKit: () => Promise<RecoveryKit | null>
  /** Callback pour confirmer la sauvegarde (débloque la sync cloud) */
  onConfirmSaved: () => Promise<void>
  /** Callback pour fermer l'écran */
  onClose: () => void
}

// ─── Composant ────────────────────────────────────────────────────────────────

/**
 * Flux complet de génération et confirmation du Kit de Récupération.
 *
 * Ce composant guide l'utilisatrice à travers 4 étapes :
 * 1. Explication du kit en langage simple
 * 2. Génération et affichage des 12 mots
 * 3. Confirmation de la sauvegarde
 * 4. Activation de la synchronisation cloud
 */
export function RecoveryKitScreen({
  onGenerateKit,
  onConfirmSaved,
  onClose,
}: RecoveryKitScreenProps): React.JSX.Element {
  const [step, setStep] = useState<FlowStep>('intro')
  const [kit, setKit] = useState<RecoveryKit | null>(null)
  const [hasConfirmedSaved, setHasConfirmedSaved] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)

  // ── Handlers ──────────────────────────────────────────────────────────────

  async function handleGenerate(): Promise<void> {
    setStep('generating')
    setIsProcessing(true)
    try {
      const generated = await onGenerateKit()
      if (generated) {
        setKit(generated)
        setStep('display')
      } else {
        setStep('intro')
        Alert.alert(
          'Erreur',
          'Impossible de générer le Kit de Récupération. Veuillez réessayer.',
        )
      }
    } finally {
      setIsProcessing(false)
    }
  }

  async function handleConfirm(): Promise<void> {
    if (!hasConfirmedSaved) {
      Alert.alert(
        'Confirmation requise',
        'Veuillez confirmer que vous avez sauvegardé vos 12 mots en lieu sûr avant de continuer.',
      )
      return
    }

    setIsProcessing(true)
    try {
      await onConfirmSaved()
      setStep('success')
    } catch {
      Alert.alert(
        'Erreur',
        'Impossible d\'activer la sauvegarde cloud. Veuillez réessayer.',
      )
    } finally {
      setIsProcessing(false)
    }
  }

  // ── Rendu par étape ───────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {step === 'intro' && (
          <IntroStep onGenerate={handleGenerate} onClose={onClose} />
        )}

        {step === 'generating' && (
          <View style={styles.centered}>
            <ActivityIndicator
              size="large"
              color="#E91E63"
              accessibilityLabel="Génération du Kit de Récupération en cours"
            />
            <Text style={styles.generatingText}>
              Génération de votre Kit de Récupération…
            </Text>
          </View>
        )}

        {step === 'display' && kit !== null && (
          <DisplayStep
            kit={kit}
            onContinue={() => setStep('confirm')}
            onBack={() => setStep('intro')}
          />
        )}

        {step === 'confirm' && kit !== null && (
          <ConfirmStep
            kit={kit}
            hasConfirmed={hasConfirmedSaved}
            onToggleConfirm={() => setHasConfirmedSaved(v => !v)}
            onConfirm={handleConfirm}
            onBack={() => setStep('display')}
            isProcessing={isProcessing}
          />
        )}

        {step === 'success' && (
          <SuccessStep onClose={onClose} />
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

// ─── Étape 1 : Introduction ───────────────────────────────────────────────────

interface IntroStepProps {
  onGenerate: () => void
  onClose: () => void
}

function IntroStep({ onGenerate, onClose }: IntroStepProps): React.JSX.Element {
  return (
    <View style={styles.stepContainer}>
      <Text style={styles.stepIcon} accessibilityElementsHidden={true}>🔑</Text>
      <Text style={styles.stepTitle} accessibilityRole="header">
        Kit de Récupération
      </Text>

      <View style={styles.explanationCard}>
        <Text style={styles.explanationTitle}>Pourquoi ce kit ?</Text>
        <Text style={styles.explanationText}>
          Vos données sont chiffrées sur votre téléphone. Si vous perdez votre
          appareil, vous aurez besoin de ce kit pour récupérer vos données depuis
          la sauvegarde cloud.
        </Text>
      </View>

      <View style={styles.explanationCard}>
        <Text style={styles.explanationTitle}>Comment ça fonctionne ?</Text>
        <Text style={styles.explanationText}>
          Nous allons générer une liste de{' '}
          <Text style={styles.bold}>12 mots uniques</Text>. Notez-les sur papier
          et conservez-les en lieu sûr — comme un mot de passe très important.
        </Text>
      </View>

      <View style={[styles.explanationCard, styles.warningCard]}>
        <Text style={styles.warningTitle}>⚠️ Important</Text>
        <Text style={styles.warningText}>
          Sans ces 12 mots, vos données chiffrées seront{' '}
          <Text style={styles.bold}>irrécupérables</Text> en cas de perte de
          votre téléphone. Ne les partagez jamais avec personne.
        </Text>
      </View>

      <TouchableOpacity
        style={styles.primaryButton}
        onPress={onGenerate}
        accessibilityLabel="Générer mon Kit de Récupération"
        accessibilityRole="button"
        accessibilityHint="Génère une liste de 12 mots uniques pour sécuriser vos données"
      >
        <Text style={styles.primaryButtonText}>Générer mon Kit de Récupération</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.secondaryButton}
        onPress={onClose}
        accessibilityLabel="Annuler et revenir aux paramètres"
        accessibilityRole="button"
      >
        <Text style={styles.secondaryButtonText}>Annuler</Text>
      </TouchableOpacity>
    </View>
  )
}

// ─── Étape 2 : Affichage des 12 mots ─────────────────────────────────────────

interface DisplayStepProps {
  kit: RecoveryKit
  onContinue: () => void
  onBack: () => void
}

function DisplayStep({ kit, onContinue, onBack }: DisplayStepProps): React.JSX.Element {
  const words = kit.mnemonic.split(' ')

  return (
    <View style={styles.stepContainer}>
      <Text style={styles.stepIcon} accessibilityElementsHidden={true}>📝</Text>
      <Text style={styles.stepTitle} accessibilityRole="header">
        Vos 12 mots de récupération
      </Text>
      <Text style={styles.stepSubtitle}>
        Notez ces mots dans l'ordre exact sur papier. Ils sont votre seul moyen
        de récupérer vos données.
      </Text>

      {/* Grille des 12 mots */}
      <View
        style={styles.wordsGrid}
        accessible={true}
        accessibilityLabel={`Vos 12 mots de récupération : ${words.join(', ')}`}
        accessibilityRole="text"
      >
        {words.map((word, index) => (
          <View key={index} style={styles.wordCard} accessibilityElementsHidden={true}>
            <Text style={styles.wordNumber}>{index + 1}</Text>
            <Text style={styles.wordText}>{word}</Text>
          </View>
        ))}
      </View>

      <View style={[styles.explanationCard, styles.warningCard]}>
        <Text style={styles.warningText}>
          📵 Ne faites pas de capture d'écran. Notez ces mots sur papier uniquement.
        </Text>
      </View>

      <TouchableOpacity
        style={styles.primaryButton}
        onPress={onContinue}
        accessibilityLabel="J'ai noté mes 12 mots, continuer"
        accessibilityRole="button"
      >
        <Text style={styles.primaryButtonText}>J'ai noté mes mots →</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.secondaryButton}
        onPress={onBack}
        accessibilityLabel="Retour à l'introduction"
        accessibilityRole="button"
      >
        <Text style={styles.secondaryButtonText}>Retour</Text>
      </TouchableOpacity>
    </View>
  )
}

// ─── Étape 3 : Confirmation ───────────────────────────────────────────────────

interface ConfirmStepProps {
  kit: RecoveryKit
  hasConfirmed: boolean
  onToggleConfirm: () => void
  onConfirm: () => void
  onBack: () => void
  isProcessing: boolean
}

function ConfirmStep({
  kit,
  hasConfirmed,
  onToggleConfirm,
  onConfirm,
  onBack,
  isProcessing,
}: ConfirmStepProps): React.JSX.Element {
  // Afficher seulement les 3 premiers et 3 derniers mots pour vérification
  const words = kit.mnemonic.split(' ')
  const previewWords = [
    ...words.slice(0, 3).map((w, i) => ({ num: i + 1, word: w })),
    ...words.slice(9, 12).map((w, i) => ({ num: i + 10, word: w })),
  ]

  return (
    <View style={styles.stepContainer}>
      <Text style={styles.stepIcon} accessibilityElementsHidden={true}>✅</Text>
      <Text style={styles.stepTitle} accessibilityRole="header">
        Confirmez la sauvegarde
      </Text>
      <Text style={styles.stepSubtitle}>
        Vérifiez que vous avez bien noté vos mots en consultant votre liste papier.
      </Text>

      {/* Aperçu partiel pour vérification */}
      <View style={styles.previewCard}>
        <Text style={styles.previewTitle}>Vérification rapide</Text>
        <Text style={styles.previewSubtitle}>
          Confirmez les mots 1-3 et 10-12 sur votre liste papier :
        </Text>
        <View style={styles.previewWords}>
          {previewWords.map(({ num, word }) => (
            <View key={num} style={styles.previewWordRow}>
              <Text style={styles.previewWordNum}>{num}.</Text>
              <Text style={styles.previewWordText}>{word}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Case à cocher de confirmation */}
      <TouchableOpacity
        style={styles.checkboxRow}
        onPress={onToggleConfirm}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: hasConfirmed }}
        accessibilityLabel="J'ai sauvegardé mes 12 mots en lieu sûr"
      >
        <View style={[styles.checkbox, hasConfirmed && styles.checkboxChecked]}>
          {hasConfirmed && (
            <Text style={styles.checkboxMark} accessibilityElementsHidden={true}>
              ✓
            </Text>
          )}
        </View>
        <Text style={styles.checkboxLabel}>
          J'ai noté et sauvegardé mes 12 mots en lieu sûr. Je comprends que sans
          eux, mes données seront irrécupérables.
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.primaryButton, !hasConfirmed && styles.primaryButtonDisabled]}
        onPress={onConfirm}
        disabled={!hasConfirmed || isProcessing}
        accessibilityLabel="Activer la sauvegarde cloud"
        accessibilityRole="button"
        accessibilityState={{ disabled: !hasConfirmed || isProcessing }}
      >
        {isProcessing ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.primaryButtonText}>Activer la sauvegarde cloud</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.secondaryButton}
        onPress={onBack}
        disabled={isProcessing}
        accessibilityLabel="Retour pour revoir les mots"
        accessibilityRole="button"
      >
        <Text style={styles.secondaryButtonText}>Revoir mes mots</Text>
      </TouchableOpacity>
    </View>
  )
}

// ─── Étape 4 : Succès ─────────────────────────────────────────────────────────

interface SuccessStepProps {
  onClose: () => void
}

function SuccessStep({ onClose }: SuccessStepProps): React.JSX.Element {
  return (
    <View style={styles.stepContainer}>
      <Text style={styles.stepIcon} accessibilityElementsHidden={true}>🎉</Text>
      <Text style={styles.stepTitle} accessibilityRole="header">
        Sauvegarde cloud activée !
      </Text>
      <Text style={styles.stepSubtitle}>
        Votre Kit de Récupération est configuré. La synchronisation cloud est
        maintenant active.
      </Text>

      <View style={styles.explanationCard}>
        <Text style={styles.explanationTitle}>Ce qui se passe maintenant</Text>
        <Text style={styles.explanationText}>
          Vos données sont chiffrées localement et sauvegardées de manière
          sécurisée dans le cloud. Seul votre Kit de Récupération peut déchiffrer
          ces données — même nous n'y avons pas accès.
        </Text>
      </View>

      <View style={styles.explanationCard}>
        <Text style={styles.explanationTitle}>En cas de perte de téléphone</Text>
        <Text style={styles.explanationText}>
          Installez l'application sur votre nouvel appareil, choisissez
          "Restaurer depuis le cloud" et entrez vos 12 mots de récupération.
        </Text>
      </View>

      <TouchableOpacity
        style={styles.primaryButton}
        onPress={onClose}
        accessibilityLabel="Terminer et revenir aux paramètres"
        accessibilityRole="button"
      >
        <Text style={styles.primaryButtonText}>Terminé</Text>
      </TouchableOpacity>
    </View>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  generatingText: {
    marginTop: 16,
    fontSize: 15,
    color: '#757575',
    textAlign: 'center',
  },
  stepContainer: {
    alignItems: 'center',
  },
  stepIcon: {
    fontSize: 48,
    marginBottom: 12,
    marginTop: 8,
  },
  stepTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#212121',
    textAlign: 'center',
    marginBottom: 8,
  },
  stepSubtitle: {
    fontSize: 14,
    color: '#616161',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
    paddingHorizontal: 8,
  },
  explanationCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  explanationTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#212121',
    marginBottom: 6,
  },
  explanationText: {
    fontSize: 13,
    color: '#616161',
    lineHeight: 19,
  },
  warningCard: {
    backgroundColor: '#FFF8E1',
    borderLeftWidth: 4,
    borderLeftColor: '#FFA726',
  },
  warningTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#E65100',
    marginBottom: 6,
  },
  warningText: {
    fontSize: 13,
    color: '#BF360C',
    lineHeight: 19,
  },
  bold: {
    fontWeight: '700',
  },
  // ── Grille des mots ──────────────────────────────────────────────────────
  wordsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
    width: '100%',
    justifyContent: 'center',
  },
  wordCard: {
    width: '30%',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  wordNumber: {
    fontSize: 10,
    color: '#BDBDBD',
    fontWeight: '600',
    marginBottom: 2,
  },
  wordText: {
    fontSize: 13,
    color: '#212121',
    fontWeight: '700',
    textAlign: 'center',
  },
  // ── Aperçu de confirmation ───────────────────────────────────────────────
  previewCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    width: '100%',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  previewTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#212121',
    marginBottom: 4,
  },
  previewSubtitle: {
    fontSize: 12,
    color: '#9E9E9E',
    marginBottom: 12,
  },
  previewWords: {
    gap: 6,
  },
  previewWordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  previewWordNum: {
    fontSize: 12,
    color: '#BDBDBD',
    width: 24,
    textAlign: 'right',
  },
  previewWordText: {
    fontSize: 14,
    color: '#212121',
    fontWeight: '600',
  },
  // ── Case à cocher ────────────────────────────────────────────────────────
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 20,
    width: '100%',
    padding: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#BDBDBD',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginTop: 1,
  },
  checkboxChecked: {
    backgroundColor: '#E91E63',
    borderColor: '#E91E63',
  },
  checkboxMark: {
    fontSize: 13,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  checkboxLabel: {
    flex: 1,
    fontSize: 13,
    color: '#424242',
    lineHeight: 19,
  },
  // ── Boutons ──────────────────────────────────────────────────────────────
  primaryButton: {
    backgroundColor: '#E91E63',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    width: '100%',
    marginBottom: 12,
    shadowColor: '#E91E63',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryButtonDisabled: {
    backgroundColor: '#BDBDBD',
    shadowOpacity: 0,
    elevation: 0,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryButton: {
    paddingVertical: 14,
    alignItems: 'center',
    width: '100%',
  },
  secondaryButtonText: {
    fontSize: 15,
    color: '#9E9E9E',
    fontWeight: '500',
  },
})
