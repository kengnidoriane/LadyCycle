/**
 * OnboardingScreen — accueil au premier lancement (3 étapes).
 *
 * 1. Bienvenue + valeurs (privé, prédictions qui s'améliorent)
 * 2. Choix du mode de suivi
 * 3. Prêt à commencer
 *
 * Restylé avec le système de design : icônes vectorielles, palette douce,
 * ton intime. Met en avant la signature dès la première étape : « plus tu
 * enregistres, plus c'est précis ».
 */

import React, { useState } from 'react'
import { View, StyleSheet, TouchableOpacity } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { AppText, Button, Card, Icon } from '../components'
import type { IconName } from '../components'
import { colors, spacing, radii } from '../theme'
import { useI18n } from '../i18n/I18nContext'
import type { TrackingMode } from '../../infrastructure/db/CycleRepository'

interface OnboardingScreenProps {
  onComplete: () => void
}

type OnboardingStep = 1 | 2 | 3

function getFeatures(fr: boolean): Array<{ icon: IconName; label: string; desc: string }> {
  return [
    {
      icon: 'calendar',
      label: fr ? 'Suivi du cycle' : 'Cycle tracking',
      desc: fr ? 'Enregistre tes règles et consulte ton historique' : 'Log your period and view your history',
    },
    {
      icon: 'sparkles',
      label: fr ? 'Prédictions qui s’améliorent' : 'Predictions that improve',
      desc: fr ? 'Plus tu enregistres, plus c’est précis' : 'The more you log, the more accurate it gets',
    },
    {
      icon: 'bell',
      label: fr ? 'Rappels' : 'Reminders',
      desc: fr ? 'Ne manque plus tes règles ni tes médicaments' : 'Never miss your period or your medication',
    },
    {
      icon: 'leaf',
      label: fr ? 'Bien-être' : 'Wellness',
      desc: fr ? 'Conseils adaptés à ta phase de cycle' : 'Tips tailored to your cycle phase',
    },
  ]
}

function getModes(fr: boolean): Array<{
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
        ? 'Je veux simplement suivre mon cycle et mieux me connaître.'
        : 'I just want to track my cycle and understand it better.',
    },
    {
      value: 'trying_to_conceive',
      icon: 'heart',
      label: fr ? 'Essai bébé' : 'Trying to conceive',
      description: fr
        ? 'Je souhaite concevoir et connaître ma période féconde.'
        : 'I want to conceive and know my fertile window.',
    },
    {
      value: 'natural_contraception',
      icon: 'shield',
      label: fr ? 'Contraception naturelle' : 'Natural contraception',
      description: fr ? 'Je veux identifier les jours à risque.' : 'I want to identify high-risk days.',
    },
  ]
}

export function OnboardingScreen({ onComplete }: OnboardingScreenProps): React.JSX.Element {
  const [step, setStep] = useState<OnboardingStep>(1)
  const [selectedMode, setSelectedMode] = useState<TrackingMode>('general')
  const insets = useSafeAreaInsets()
  const { currentLanguage } = useI18n()
  const fr = currentLanguage !== 'en'

  function goNext(): void {
    if (step < 3) setStep((s) => (s + 1) as OnboardingStep)
    else onComplete()
  }

  function goBack(): void {
    if (step > 1) setStep((s) => (s - 1) as OnboardingStep)
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top + spacing.lg }]}>
      {/* Progression */}
      <View style={styles.progress}>
        {([1, 2, 3] as OnboardingStep[]).map((s) => (
          <View
            key={s}
            style={[styles.progressDot, step >= s && styles.progressDotActive]}
            accessibilityLabel={`Étape ${s}${step === s ? ', étape actuelle' : ''}`}
          />
        ))}
      </View>

      <View style={styles.content}>
        {step === 1 && <StepWelcome fr={fr} />}
        {step === 2 && <StepMode fr={fr} selected={selectedMode} onSelect={setSelectedMode} />}
        {step === 3 && <StepReady fr={fr} />}
      </View>

      {/* Navigation */}
      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}>
        {step > 1 ? (
          <Button label={fr ? 'Retour' : 'Back'} icon="arrowLeft" variant="ghost" fullWidth={false} onPress={goBack} />
        ) : (
          <View style={{ width: 80 }} />
        )}
        <Button
          label={step === 3 ? (fr ? 'Commencer' : 'Get started') : fr ? 'Suivant' : 'Next'}
          icon={step === 3 ? 'check' : 'arrowRight'}
          fullWidth={false}
          onPress={goNext}
          style={styles.nextButton}
        />
      </View>
    </View>
  )
}

// ─── Étape 1 ──────────────────────────────────────────────────────────────────

function StepWelcome({ fr }: { fr: boolean }): React.JSX.Element {
  return (
    <View style={styles.step}>
      <View style={styles.bigIcon}>
        <Icon name="flower" size={48} color={colors.primary} />
      </View>
      <AppText variant="h1" center style={styles.stepTitle}>
        {fr ? 'Bienvenue sur LadyCycle' : 'Welcome to LadyCycle'}
      </AppText>
      <AppText variant="body" tone="secondary" center style={styles.stepSubtitle}>
        {fr
          ? 'Ton compagnon de suivi du cycle. Tes données restent privées, rien que pour toi.'
          : 'Your cycle-tracking companion. Your data stays private — just for you.'}
      </AppText>

      <View style={styles.featureList}>
        {getFeatures(fr).map((f) => (
          <Card key={f.label} style={styles.featureRow}>
            <View style={styles.featureIcon}>
              <Icon name={f.icon} size={20} color={colors.primary} />
            </View>
            <View style={styles.featureText}>
              <AppText variant="bodyStrong">{f.label}</AppText>
              <AppText variant="caption" tone="secondary">
                {f.desc}
              </AppText>
            </View>
          </Card>
        ))}
      </View>

      <Card tint={colors.successSoft} style={styles.privacyNote}>
        <Icon name="lock" size={18} color={colors.phase.follicular.text} />
        <AppText variant="caption" style={[styles.privacyText, { color: colors.phase.follicular.text }]}>
          {fr
            ? 'Tes données restent sur ton téléphone. Privées. Protégées. Jamais partagées.'
            : 'Your data stays on your phone. Private. Protected. Never shared.'}
        </AppText>
      </Card>
    </View>
  )
}

// ─── Étape 2 ──────────────────────────────────────────────────────────────────

function StepMode({
  fr,
  selected,
  onSelect,
}: {
  fr: boolean
  selected: TrackingMode
  onSelect: (mode: TrackingMode) => void
}): React.JSX.Element {
  return (
    <View style={styles.step}>
      <View style={styles.bigIcon}>
        <Icon name="target" size={44} color={colors.primary} />
      </View>
      <AppText variant="h1" center style={styles.stepTitle}>
        {fr ? 'Quel est ton objectif ?' : 'What is your goal?'}
      </AppText>
      <AppText variant="body" tone="secondary" center style={styles.stepSubtitle}>
        {fr
          ? 'Tu pourras le changer à tout moment dans les réglages.'
          : 'You can change it any time in settings.'}
      </AppText>

      <View style={styles.modeList} accessibilityRole="radiogroup">
        {getModes(fr).map((mode) => {
          const isSelected = selected === mode.value
          return (
            <TouchableOpacity
              key={mode.value}
              activeOpacity={0.7}
              style={[styles.modeCard, isSelected && styles.modeCardSelected]}
              onPress={() => onSelect(mode.value)}
              accessibilityRole="radio"
              accessibilityState={{ checked: isSelected }}
              accessibilityLabel={`${mode.label}. ${mode.description}`}
            >
              <Icon
                name={mode.icon}
                size={22}
                color={isSelected ? colors.primaryDark : colors.textSecondary}
              />
              <View style={styles.modeText}>
                <AppText
                  variant="bodyStrong"
                  style={isSelected ? { color: colors.primaryDark } : undefined}
                >
                  {mode.label}
                </AppText>
                <AppText variant="caption" tone="secondary">
                  {mode.description}
                </AppText>
              </View>
              {isSelected && <Icon name="check" size={18} color={colors.primary} />}
            </TouchableOpacity>
          )
        })}
      </View>
    </View>
  )
}

// ─── Étape 3 ──────────────────────────────────────────────────────────────────

function StepReady({ fr }: { fr: boolean }): React.JSX.Element {
  return (
    <View style={styles.step}>
      <View style={styles.bigIcon}>
        <Icon name="sparkles" size={44} color={colors.primary} />
      </View>
      <AppText variant="h1" center style={styles.stepTitle}>
        {fr ? 'Tout est prêt' : 'You’re all set'}
      </AppText>
      <AppText variant="body" tone="secondary" center style={styles.stepSubtitle}>
        {fr
          ? 'Commence par enregistrer tes dernières règles pour obtenir tes premières prédictions.'
          : 'Start by logging your last period to get your first predictions.'}
      </AppText>

      <Card accent={colors.primary} style={styles.tipCard}>
        <View style={styles.tipHeader}>
          <Icon name="sparkles" size={18} color={colors.primaryDark} />
          <AppText variant="bodyStrong">
            {fr ? 'Plus tu enregistres, plus c’est précis' : 'The more you log, the more accurate it gets'}
          </AppText>
        </View>
        <AppText variant="caption" tone="secondary" style={styles.tipText}>
          {fr
            ? 'Dès 3 cycles, tes prédictions passent en confiance moyenne. À partir de 6 cycles, elles deviennent très fiables. L’app te dira toujours où elle en est.'
            : 'From 3 cycles, your predictions reach medium confidence. From 6 cycles, they become very reliable. The app always tells you where it stands.'}
        </AppText>
      </Card>

      <Card accent={colors.success} style={styles.tipCard}>
        <View style={styles.tipHeader}>
          <Icon name="lock" size={18} color={colors.phase.follicular.text} />
          <AppText variant="bodyStrong">
            {fr ? 'Tes données sont protégées' : 'Your data is protected'}
          </AppText>
        </View>
        <AppText variant="caption" tone="secondary" style={styles.tipText}>
          {fr
            ? 'Tout est gardé en sécurité sur ton téléphone, comme dans un coffre. Toi seule y as accès, et rien n’est envoyé sans ton accord.'
            : 'Everything is kept safe on your phone, like in a vault. Only you can access it, and nothing is sent without your consent.'}
        </AppText>
      </Card>
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  progress: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.sm,
    paddingBottom: spacing.sm,
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: radii.pill,
    backgroundColor: colors.border,
  },
  progressDotActive: {
    backgroundColor: colors.primary,
    width: 24,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.xxl,
  },
  step: {
    alignItems: 'center',
    paddingTop: spacing.xl,
  },
  bigIcon: {
    width: 96,
    height: 96,
    borderRadius: radii.pill,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
  },
  stepTitle: {
    marginBottom: spacing.sm,
  },
  stepSubtitle: {
    marginBottom: spacing.xxl,
    lineHeight: 22,
    paddingHorizontal: spacing.md,
  },
  featureList: {
    width: '100%',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  featureIcon: {
    width: 40,
    height: 40,
    borderRadius: radii.md,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureText: {
    flex: 1,
  },
  privacyNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    width: '100%',
  },
  privacyText: {
    flex: 1,
    lineHeight: 18,
  },
  modeList: {
    width: '100%',
    gap: spacing.md,
  },
  modeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modeCardSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  modeText: {
    flex: 1,
  },
  tipCard: {
    width: '100%',
    marginBottom: spacing.md,
  },
  tipHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  tipText: {
    lineHeight: 19,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  nextButton: {
    paddingHorizontal: spacing.xxl,
  },
})
