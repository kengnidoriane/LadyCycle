/**
 * RecoveryKitScreen — flux d'activation du Kit de Récupération (12 mots BIP-39).
 *
 * Étapes : intro → génération → affichage des 12 mots → confirmation → succès.
 * La sync cloud reste bloquée tant que le kit n'est pas confirmé (Exigence 10.6).
 * Restylé avec le système de design.
 *
 * Exigences : 10.5, 10.6, 10.7
 */

import React, { useState } from 'react'
import { View, StyleSheet, ActivityIndicator, Alert, TouchableOpacity } from 'react-native'
import { Screen, AppText, Card, Button, Icon } from '../components'
import { colors, spacing, radii } from '../theme'
import { useI18n } from '../i18n/I18nContext'
import type { RecoveryKit } from '../../infrastructure/crypto/RecoveryKitService'

type FlowStep = 'intro' | 'generating' | 'display' | 'confirm' | 'success'

interface RecoveryKitScreenProps {
  onGenerateKit: () => Promise<RecoveryKit | null>
  onConfirmSaved: () => Promise<void>
  onClose: () => void
}

export function RecoveryKitScreen({
  onGenerateKit,
  onConfirmSaved,
  onClose,
}: RecoveryKitScreenProps): React.JSX.Element {
  const { currentLanguage } = useI18n()
  const fr = currentLanguage !== 'en'
  const [step, setStep] = useState<FlowStep>('intro')
  const [kit, setKit] = useState<RecoveryKit | null>(null)
  const [hasConfirmedSaved, setHasConfirmedSaved] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)

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
        Alert.alert(fr ? 'Erreur' : 'Error', fr ? 'Impossible de générer le Kit de Récupération. Réessaie.' : 'Could not generate the Recovery Kit. Please try again.')
      }
    } finally {
      setIsProcessing(false)
    }
  }

  async function handleConfirm(): Promise<void> {
    if (!hasConfirmedSaved) {
      Alert.alert(
        fr ? 'Confirmation requise' : 'Confirmation required',
        fr ? 'Confirme que tu as sauvegardé tes 12 mots en lieu sûr.' : 'Confirm that you have saved your 12 words in a safe place.',
      )
      return
    }
    setIsProcessing(true)
    try {
      await onConfirmSaved()
      setStep('success')
    } catch {
      Alert.alert(fr ? 'Erreur' : 'Error', fr ? "Impossible d'activer la sauvegarde cloud. Réessaie." : 'Could not enable cloud backup. Please try again.')
    } finally {
      setIsProcessing(false)
    }
  }

  if (step === 'generating') {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
        <AppText variant="body" tone="secondary" center style={{ marginTop: spacing.lg }}>
          {fr ? 'Génération de ton Kit de Récupération…' : 'Generating your Recovery Kit…'}
        </AppText>
      </View>
    )
  }

  return (
    <Screen>
      {step === 'intro' && <IntroStep fr={fr} onGenerate={handleGenerate} onClose={onClose} />}
      {step === 'display' && kit !== null && (
        <DisplayStep fr={fr} kit={kit} onContinue={() => setStep('confirm')} onBack={() => setStep('intro')} />
      )}
      {step === 'confirm' && kit !== null && (
        <ConfirmStep
          fr={fr}
          kit={kit}
          hasConfirmed={hasConfirmedSaved}
          onToggleConfirm={() => setHasConfirmedSaved((v) => !v)}
          onConfirm={handleConfirm}
          onBack={() => setStep('display')}
          isProcessing={isProcessing}
        />
      )}
      {step === 'success' && <SuccessStep fr={fr} onClose={onClose} />}
    </Screen>
  )
}

// ─── Étape : intro ────────────────────────────────────────────────────────────

function IntroStep({ fr, onGenerate, onClose }: { fr: boolean; onGenerate: () => void; onClose: () => void }): React.JSX.Element {
  return (
    <View>
      <StepHeader icon="lock" title={fr ? 'Kit de Récupération' : 'Recovery Kit'} />

      <Card style={styles.block}>
        <AppText variant="bodyStrong" style={styles.blockTitle}>
          {fr ? 'Pourquoi ce kit ?' : 'Why this kit?'}
        </AppText>
        <AppText variant="caption" tone="secondary" style={styles.blockText}>
          {fr
            ? 'Tes données sont chiffrées sur ton téléphone. Si tu perds ton appareil, ce kit est le seul moyen de récupérer tes données depuis la sauvegarde cloud.'
            : 'Your data is encrypted on your phone. If you lose your device, this kit is the only way to recover your data from the cloud backup.'}
        </AppText>
      </Card>

      <Card style={styles.block}>
        <AppText variant="bodyStrong" style={styles.blockTitle}>
          {fr ? 'Comment ça marche ?' : 'How does it work?'}
        </AppText>
        <AppText variant="caption" tone="secondary" style={styles.blockText}>
          {fr
            ? 'On va générer une liste de 12 mots uniques. Note-les sur papier et garde-les en lieu sûr — comme un mot de passe très important.'
            : 'We’ll generate a list of 12 unique words. Write them on paper and keep them somewhere safe — like a very important password.'}
        </AppText>
      </Card>

      <Card tint={colors.phase.ovulation.soft} accent={colors.phase.ovulation.main} style={styles.block}>
        <View style={styles.warnHeader}>
          <Icon name="info" size={18} color={colors.phase.ovulation.text} />
          <AppText variant="bodyStrong" style={{ color: colors.phase.ovulation.text }}>
            {fr ? 'Important' : 'Important'}
          </AppText>
        </View>
        <AppText variant="caption" style={[styles.blockText, { color: colors.phase.ovulation.text }]}>
          {fr
            ? 'Sans ces 12 mots, tes données chiffrées seront irrécupérables en cas de perte du téléphone. Ne les partage jamais.'
            : 'Without these 12 words, your encrypted data will be unrecoverable if you lose your phone. Never share them.'}
        </AppText>
      </Card>

      <Button label={fr ? 'Générer mon Kit de Récupération' : 'Generate my Recovery Kit'} icon="lock" onPress={onGenerate} style={styles.primary} />
      <Button label={fr ? 'Annuler' : 'Cancel'} variant="ghost" onPress={onClose} />
    </View>
  )
}

// ─── Étape : affichage ────────────────────────────────────────────────────────

function DisplayStep({ fr, kit, onContinue, onBack }: { fr: boolean; kit: RecoveryKit; onContinue: () => void; onBack: () => void }): React.JSX.Element {
  const words = kit.mnemonic.split(' ')
  return (
    <View>
      <StepHeader icon="pencil" title={fr ? 'Tes 12 mots de récupération' : 'Your 12 recovery words'} />
      <AppText variant="caption" tone="secondary" center style={styles.subtitle}>
        {fr
          ? "Note ces mots dans l'ordre exact sur papier. Ils sont ton seul moyen de récupérer tes données."
          : 'Write these words in the exact order on paper. They are your only way to recover your data.'}
      </AppText>

      <View
        style={styles.wordsGrid}
        accessibilityLabel={fr ? `Tes 12 mots de récupération : ${words.join(', ')}` : `Your 12 recovery words: ${words.join(', ')}`}
      >
        {words.map((word, index) => (
          <View key={index} style={styles.wordCard} accessibilityElementsHidden>
            <AppText variant="tiny" tone="tertiary">
              {index + 1}
            </AppText>
            <AppText variant="bodyStrong" center>
              {word}
            </AppText>
          </View>
        ))}
      </View>

      <Card tint={colors.phase.ovulation.soft} accent={colors.phase.ovulation.main} style={styles.block}>
        <AppText variant="caption" style={{ color: colors.phase.ovulation.text }}>
          {fr
            ? "Ne fais pas de capture d'écran. Note ces mots sur papier uniquement."
            : 'Do not take a screenshot. Write these words on paper only.'}
        </AppText>
      </Card>

      <Button label={fr ? "J'ai noté mes mots" : 'I’ve written my words'} icon="arrowRight" onPress={onContinue} style={styles.primary} />
      <Button label={fr ? 'Retour' : 'Back'} variant="ghost" onPress={onBack} />
    </View>
  )
}

// ─── Étape : confirmation ─────────────────────────────────────────────────────

function ConfirmStep({
  fr,
  kit,
  hasConfirmed,
  onToggleConfirm,
  onConfirm,
  onBack,
  isProcessing,
}: {
  fr: boolean
  kit: RecoveryKit
  hasConfirmed: boolean
  onToggleConfirm: () => void
  onConfirm: () => void
  onBack: () => void
  isProcessing: boolean
}): React.JSX.Element {
  const words = kit.mnemonic.split(' ')
  const previewWords = [
    ...words.slice(0, 3).map((w, i) => ({ num: i + 1, word: w })),
    ...words.slice(9, 12).map((w, i) => ({ num: i + 10, word: w })),
  ]

  return (
    <View>
      <StepHeader icon="check" title={fr ? 'Confirme la sauvegarde' : 'Confirm the backup'} />
      <AppText variant="caption" tone="secondary" center style={styles.subtitle}>
        {fr
          ? 'Vérifie que tu as bien noté tes mots en consultant ta liste papier.'
          : 'Check that you wrote your words correctly using your paper list.'}
      </AppText>

      <Card style={styles.block}>
        <AppText variant="bodyStrong" style={styles.blockTitle}>
          {fr ? 'Vérification rapide' : 'Quick check'}
        </AppText>
        <AppText variant="caption" tone="tertiary" style={styles.blockText}>
          {fr ? 'Confirme les mots 1-3 et 10-12 sur ta liste papier :' : 'Confirm words 1-3 and 10-12 on your paper list:'}
        </AppText>
        <View style={styles.previewWords}>
          {previewWords.map(({ num, word }) => (
            <View key={num} style={styles.previewRow}>
              <AppText variant="caption" tone="tertiary" style={styles.previewNum}>
                {num}.
              </AppText>
              <AppText variant="bodyStrong">{word}</AppText>
            </View>
          ))}
        </View>
      </Card>

      <TouchableOpacity
        activeOpacity={0.8}
        style={styles.checkboxRow}
        onPress={onToggleConfirm}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: hasConfirmed }}
        accessibilityLabel={fr ? "J'ai sauvegardé mes 12 mots en lieu sûr" : 'I have saved my 12 words in a safe place'}
      >
        <View style={[styles.checkbox, hasConfirmed && styles.checkboxChecked]}>
          {hasConfirmed && <Icon name="check" size={14} color={colors.textInverse} />}
        </View>
        <AppText variant="caption" style={styles.checkboxLabel}>
          {fr
            ? "J'ai noté et sauvegardé mes 12 mots en lieu sûr. Je comprends que sans eux, mes données seront irrécupérables."
            : 'I have written and saved my 12 words in a safe place. I understand that without them, my data will be unrecoverable.'}
        </AppText>
      </TouchableOpacity>

      <Button
        label={fr ? 'Activer la sauvegarde cloud' : 'Enable cloud backup'}
        icon="shield"
        onPress={onConfirm}
        loading={isProcessing}
        disabled={!hasConfirmed}
        style={styles.primary}
      />
      <Button label={fr ? 'Revoir mes mots' : 'Review my words'} variant="ghost" onPress={onBack} />
    </View>
  )
}

// ─── Étape : succès ───────────────────────────────────────────────────────────

function SuccessStep({ fr, onClose }: { fr: boolean; onClose: () => void }): React.JSX.Element {
  return (
    <View>
      <StepHeader icon="sparkles" title={fr ? 'Sauvegarde cloud activée' : 'Cloud backup enabled'} />
      <AppText variant="caption" tone="secondary" center style={styles.subtitle}>
        {fr
          ? 'Ton Kit de Récupération est configuré. La synchronisation cloud est maintenant active.'
          : 'Your Recovery Kit is set up. Cloud sync is now active.'}
      </AppText>

      <Card style={styles.block}>
        <AppText variant="bodyStrong" style={styles.blockTitle}>
          {fr ? 'Ce qui se passe maintenant' : 'What happens now'}
        </AppText>
        <AppText variant="caption" tone="secondary" style={styles.blockText}>
          {fr
            ? "Tes données sont chiffrées localement puis sauvegardées dans le cloud. Seul ton Kit de Récupération peut les déchiffrer — même nous n'y avons pas accès."
            : 'Your data is encrypted locally then backed up to the cloud. Only your Recovery Kit can decrypt it — not even we can access it.'}
        </AppText>
      </Card>

      <Card style={styles.block}>
        <AppText variant="bodyStrong" style={styles.blockTitle}>
          {fr ? 'En cas de perte de téléphone' : 'If you lose your phone'}
        </AppText>
        <AppText variant="caption" tone="secondary" style={styles.blockText}>
          {fr
            ? "Installe l'app sur ton nouvel appareil, choisis « Restaurer depuis le cloud » et entre tes 12 mots de récupération."
            : 'Install the app on your new device, choose “Restore from cloud” and enter your 12 recovery words.'}
        </AppText>
      </Card>

      <Button label={fr ? 'Terminé' : 'Done'} icon="check" onPress={onClose} style={styles.primary} />
    </View>
  )
}

// ─── Commun ───────────────────────────────────────────────────────────────────

function StepHeader({ icon, title }: { icon: 'lock' | 'pencil' | 'check' | 'sparkles'; title: string }): React.JSX.Element {
  return (
    <View style={styles.stepHeader}>
      <View style={styles.stepIcon}>
        <Icon name={icon} size={32} color={colors.primary} />
      </View>
      <AppText variant="h1" center accessibilityRole="header">
        {title}
      </AppText>
    </View>
  )
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    padding: spacing.xxl,
  },
  stepHeader: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  stepIcon: {
    width: 72,
    height: 72,
    borderRadius: radii.pill,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  subtitle: {
    lineHeight: 19,
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.sm,
  },
  block: {
    marginBottom: spacing.md,
  },
  blockTitle: {
    marginBottom: spacing.xs,
  },
  blockText: {
    lineHeight: 19,
  },
  warnHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  primary: {
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  wordsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
    justifyContent: 'center',
  },
  wordCard: {
    width: '30%',
    backgroundColor: colors.surface,
    borderRadius: radii.sm,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  previewWords: {
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  previewNum: {
    width: 24,
    textAlign: 'right',
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    marginBottom: spacing.lg,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: radii.sm,
    borderWidth: 2,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  checkboxChecked: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  checkboxLabel: {
    flex: 1,
    lineHeight: 19,
  },
})
