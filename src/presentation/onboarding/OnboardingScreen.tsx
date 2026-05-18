/**
 * OnboardingScreen — Écran de bienvenue au premier lancement.
 *
 * Affiché uniquement quand aucun cycle n'a encore été enregistré.
 * Guide l'utilisatrice en 3 étapes avant d'accéder à l'app principale.
 *
 * Étape 1 : Bienvenue + présentation de l'app
 * Étape 2 : Choix du mode de suivi
 * Étape 3 : Enregistrement du premier cycle (optionnel, peut être ignoré)
 */

import React, { useState } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Dimensions,
} from 'react-native'
import type { TrackingMode } from '../../infrastructure/db/CycleRepository'

const { width: SCREEN_WIDTH } = Dimensions.get('window')

// ─── Types ────────────────────────────────────────────────────────────────────

interface OnboardingScreenProps {
  onComplete: () => void
}

type OnboardingStep = 1 | 2 | 3

// ─── Données des étapes ───────────────────────────────────────────────────────

const FEATURES = [
  { emoji: '📅', label: 'Suivi du cycle', desc: 'Enregistrez vos règles et consultez votre historique' },
  { emoji: '🔮', label: 'Prédictions', desc: 'Anticipez vos prochaines règles et votre ovulation' },
  { emoji: '💊', label: 'Rappels', desc: 'Ne manquez plus vos médicaments ou rendez-vous' },
  { emoji: '🌿', label: 'Bien-être', desc: 'Conseils personnalisés selon votre phase de cycle' },
]

const TRACKING_MODES: Array<{
  value: TrackingMode
  emoji: string
  label: string
  description: string
}> = [
  {
    value: 'general',
    emoji: '📊',
    label: 'Suivi général',
    description: 'Je veux simplement suivre mon cycle et mieux me connaître.',
  },
  {
    value: 'trying_to_conceive',
    emoji: '👶',
    label: 'Essai bébé',
    description: 'Je souhaite concevoir et veux connaître ma période féconde.',
  },
  {
    value: 'natural_contraception',
    emoji: '🛡️',
    label: 'Contraception naturelle',
    description: 'J\'utilise la méthode naturelle et veux identifier les jours à risque.',
  },
]

// ─── Composant principal ──────────────────────────────────────────────────────

export function OnboardingScreen({ onComplete }: OnboardingScreenProps): React.JSX.Element {
  const [step, setStep] = useState<OnboardingStep>(1)
  const [selectedMode, setSelectedMode] = useState<TrackingMode>('general')

  function goNext(): void {
    if (step < 3) {
      setStep((s) => (s + 1) as OnboardingStep)
    } else {
      onComplete()
    }
  }

  function goBack(): void {
    if (step > 1) {
      setStep((s) => (s - 1) as OnboardingStep)
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Indicateur de progression */}
      <View style={styles.progressBar}>
        {([1, 2, 3] as OnboardingStep[]).map((s) => (
          <View
            key={s}
            style={[styles.progressDot, step >= s && styles.progressDotActive]}
            accessibilityLabel={`Étape ${s}${step === s ? ', étape actuelle' : step > s ? ', complétée' : ''}`}
          />
        ))}
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {step === 1 && <StepWelcome />}
        {step === 2 && (
          <StepTrackingMode
            selected={selectedMode}
            onSelect={setSelectedMode}
          />
        )}
        {step === 3 && <StepReady />}
      </ScrollView>

      {/* Boutons de navigation */}
      <View style={styles.footer}>
        {step > 1 ? (
          <TouchableOpacity
            style={styles.backButton}
            onPress={goBack}
            accessibilityLabel="Étape précédente"
            accessibilityRole="button"
          >
            <Text style={styles.backButtonText}>← Retour</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.backButtonPlaceholder} />
        )}

        <TouchableOpacity
          style={styles.nextButton}
          onPress={goNext}
          accessibilityLabel={step === 3 ? "Commencer à utiliser l'application" : 'Étape suivante'}
          accessibilityRole="button"
        >
          <Text style={styles.nextButtonText}>
            {step === 3 ? 'Commencer 🌸' : 'Suivant →'}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  )
}

// ─── Étape 1 : Bienvenue ──────────────────────────────────────────────────────

function StepWelcome(): React.JSX.Element {
  return (
    <View style={stepStyles.container}>
      <Text style={stepStyles.bigEmoji} accessibilityElementsHidden>🌸</Text>
      <Text style={stepStyles.title} accessibilityRole="header">
        Bienvenue sur LadyCycle
      </Text>
      <Text style={stepStyles.subtitle}>
        Votre compagnon de suivi du cycle menstruel, 100 % privé et chiffré.
      </Text>

      <View style={stepStyles.featureList}>
        {FEATURES.map((f) => (
          <View
            key={f.label}
            style={stepStyles.featureRow}
            accessible
            accessibilityLabel={`${f.label} : ${f.desc}`}
          >
            <Text style={stepStyles.featureEmoji} accessibilityElementsHidden>{f.emoji}</Text>
            <View style={stepStyles.featureText}>
              <Text style={stepStyles.featureLabel}>{f.label}</Text>
              <Text style={stepStyles.featureDesc}>{f.desc}</Text>
            </View>
          </View>
        ))}
      </View>

      <View style={stepStyles.privacyNote} accessible accessibilityLabel="Vos données restent sur votre appareil, chiffrées et privées.">
        <Text style={stepStyles.privacyIcon} accessibilityElementsHidden>🔒</Text>
        <Text style={stepStyles.privacyText}>
          Vos données restent sur votre appareil.{'\n'}Chiffrées. Privées. Jamais partagées.
        </Text>
      </View>
    </View>
  )
}

// ─── Étape 2 : Choix du mode ──────────────────────────────────────────────────

interface StepTrackingModeProps {
  selected: TrackingMode
  onSelect: (mode: TrackingMode) => void
}

function StepTrackingMode({ selected, onSelect }: StepTrackingModeProps): React.JSX.Element {
  return (
    <View style={stepStyles.container}>
      <Text style={stepStyles.bigEmoji} accessibilityElementsHidden>🎯</Text>
      <Text style={stepStyles.title} accessibilityRole="header">
        Quel est votre objectif ?
      </Text>
      <Text style={stepStyles.subtitle}>
        Choisissez le mode adapté à votre situation. Vous pourrez le changer à tout moment dans les paramètres.
      </Text>

      <View
        style={stepStyles.modeList}
        accessible
        accessibilityLabel="Sélecteur de mode de suivi"
        accessibilityRole="radiogroup"
      >
        {TRACKING_MODES.map((mode) => (
          <TouchableOpacity
            key={mode.value}
            style={[
              stepStyles.modeCard,
              selected === mode.value && stepStyles.modeCardSelected,
            ]}
            onPress={() => onSelect(mode.value)}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected === mode.value }}
            accessibilityLabel={`${mode.label}. ${mode.description}`}
          >
            <Text style={stepStyles.modeEmoji} accessibilityElementsHidden>{mode.emoji}</Text>
            <View style={stepStyles.modeText}>
              <Text
                style={[
                  stepStyles.modeLabel,
                  selected === mode.value && stepStyles.modeLabelSelected,
                ]}
              >
                {mode.label}
              </Text>
              <Text style={stepStyles.modeDesc}>{mode.description}</Text>
            </View>
            {selected === mode.value && (
              <Text style={stepStyles.modeCheck} accessibilityElementsHidden>✓</Text>
            )}
          </TouchableOpacity>
        ))}
      </View>
    </View>
  )
}

// ─── Étape 3 : Prêt à commencer ───────────────────────────────────────────────

function StepReady(): React.JSX.Element {
  return (
    <View style={stepStyles.container}>
      <Text style={stepStyles.bigEmoji} accessibilityElementsHidden>✨</Text>
      <Text style={stepStyles.title} accessibilityRole="header">
        Tout est prêt !
      </Text>
      <Text style={stepStyles.subtitle}>
        Commencez par enregistrer vos dernières règles pour obtenir vos premières prédictions.
      </Text>

      <View style={stepStyles.tipCard}>
        <Text style={stepStyles.tipTitle}>💡 Conseil de démarrage</Text>
        <Text style={stepStyles.tipText}>
          Plus vous enregistrez de cycles, plus les prédictions seront précises.
          Avec 3 cycles, vous obtenez des prédictions de confiance moyenne.
          Avec 6 cycles ou plus, les prédictions deviennent très fiables.
        </Text>
      </View>

      <View style={stepStyles.tipCard}>
        <Text style={stepStyles.tipTitle}>🔒 Vos données sont sécurisées</Text>
        <Text style={stepStyles.tipText}>
          Toutes vos données sont chiffrées avec AES-256 directement sur votre appareil.
          Aucune information ne quitte votre téléphone sans votre accord explicite.
        </Text>
      </View>
    </View>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  progressBar: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    paddingTop: 16,
    paddingBottom: 8,
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#E0E0E0',
  },
  progressDotActive: {
    backgroundColor: '#E91E63',
    width: 24,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingBottom: 16,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    backgroundColor: '#FAFAFA',
  },
  backButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  backButtonPlaceholder: {
    width: 80,
  },
  backButtonText: {
    fontSize: 15,
    color: '#9E9E9E',
    fontWeight: '500',
  },
  nextButton: {
    backgroundColor: '#E91E63',
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 12,
    shadowColor: '#E91E63',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  nextButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
})

const stepStyles = StyleSheet.create({
  container: {
    paddingTop: 24,
    alignItems: 'center',
  },
  bigEmoji: {
    fontSize: 64,
    marginBottom: 16,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: '#212121',
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 15,
    color: '#757575',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 28,
    maxWidth: SCREEN_WIDTH - 80,
  },
  // ── Features (étape 1) ──────────────────────────────────────────────────
  featureList: {
    width: '100%',
    gap: 12,
    marginBottom: 24,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    gap: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  featureEmoji: {
    fontSize: 26,
    width: 36,
    textAlign: 'center',
  },
  featureText: {
    flex: 1,
  },
  featureLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#212121',
    marginBottom: 2,
  },
  featureDesc: {
    fontSize: 12,
    color: '#9E9E9E',
    lineHeight: 16,
  },
  privacyNote: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    borderRadius: 10,
    padding: 14,
    gap: 10,
    width: '100%',
  },
  privacyIcon: {
    fontSize: 20,
  },
  privacyText: {
    flex: 1,
    fontSize: 12,
    color: '#2E7D32',
    lineHeight: 18,
  },
  // ── Modes (étape 2) ─────────────────────────────────────────────────────
  modeList: {
    width: '100%',
    gap: 12,
  },
  modeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
    borderColor: '#F0F0F0',
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  modeCardSelected: {
    borderColor: '#E91E63',
    backgroundColor: '#FFF0F5',
  },
  modeEmoji: {
    fontSize: 28,
    width: 36,
    textAlign: 'center',
  },
  modeText: {
    flex: 1,
  },
  modeLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: '#424242',
    marginBottom: 3,
  },
  modeLabelSelected: {
    color: '#880E4F',
  },
  modeDesc: {
    fontSize: 12,
    color: '#9E9E9E',
    lineHeight: 17,
  },
  modeCheck: {
    fontSize: 18,
    color: '#E91E63',
    fontWeight: '700',
  },
  // ── Tips (étape 3) ──────────────────────────────────────────────────────
  tipCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 14,
    borderLeftWidth: 4,
    borderLeftColor: '#E91E63',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  tipTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#212121',
    marginBottom: 8,
  },
  tipText: {
    fontSize: 13,
    color: '#616161',
    lineHeight: 20,
  },
})
