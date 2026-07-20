/**
 * SecurityScreen — page « Confidentialité ».
 *
 * Décrit honnêtement le modèle réel de l'app : tout est stocké uniquement sur le
 * téléphone, sans compte et sans envoi réseau. Les fonctionnalités de sécurité
 * avancées (verrouillage PIN/biométrie, sauvegarde cloud chiffrée, kit de
 * récupération) ne sont pas encore fonctionnelles — elles sont donc retirées de
 * l'UI tant qu'elles ne sont pas réellement implémentées, pour ne rien promettre
 * de faux (important pour une app de santé).
 */

import React from 'react'
import { View, StyleSheet } from 'react-native'
import { Screen, ScreenHeader, AppText, Card, Icon } from '../components'
import { colors, spacing, radii } from '../theme'
import { useI18n } from '../i18n/I18nContext'

interface SecurityScreenProps {
  onBack?: () => void
}

export function SecurityScreen({ onBack }: SecurityScreenProps): React.JSX.Element {
  const { currentLanguage } = useI18n()
  const fr = currentLanguage !== 'en'

  const points: Array<{ icon: 'lock' | 'droplet' | 'shield'; text: string }> = [
    {
      icon: 'lock',
      text: fr
        ? 'Tes données restent uniquement sur ton téléphone.'
        : 'Your data stays only on your phone.',
    },
    {
      icon: 'shield',
      text: fr
        ? "L'app ne crée aucun compte et ne demande aucune inscription."
        : 'The app creates no account and requires no sign-up.',
    },
    {
      icon: 'droplet',
      text: fr
        ? "Rien n'est envoyé sur internet sans ton accord explicite."
        : 'Nothing is sent online without your explicit consent.',
    },
  ]

  return (
    <Screen>
      <ScreenHeader
        title={fr ? 'Confidentialité' : 'Privacy'}
        onBack={onBack ?? (() => {})}
        backLabel={fr ? 'Retour aux réglages' : 'Back to settings'}
      />

      <Card tint={colors.successSoft} style={styles.hero}>
        <View style={styles.heroIcon}>
          <Icon name="lock" size={26} color={colors.phase.follicular.text} />
        </View>
        <AppText variant="h3" center style={{ color: colors.phase.follicular.text }}>
          {fr ? 'Tes données t’appartiennent' : 'Your data belongs to you'}
        </AppText>
        <AppText
          variant="caption"
          center
          style={[styles.heroText, { color: colors.phase.follicular.text }]}
        >
          {fr
            ? 'LadyCycle fonctionne entièrement sur ton téléphone, sans compte.'
            : 'LadyCycle runs entirely on your phone, with no account.'}
        </AppText>
      </Card>

      <Card style={styles.section}>
        {points.map((p, i) => (
          <View key={i} style={[styles.point, i > 0 && styles.pointDivider]}>
            <Icon name={p.icon} size={20} color={colors.primaryDark} />
            <AppText variant="body" style={styles.pointText}>
              {p.text}
            </AppText>
          </View>
        ))}
      </Card>

      <AppText variant="caption" tone="tertiary" style={styles.footnote}>
        {fr
          ? 'Le verrouillage par code et la sauvegarde chiffrée arriveront dans une prochaine version.'
          : 'App lock and encrypted backup are coming in a future version.'}
      </AppText>
    </Screen>
  )
}

const styles = StyleSheet.create({
  hero: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  heroIcon: {
    width: 56,
    height: 56,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  heroText: {
    marginTop: spacing.xs,
    lineHeight: 19,
    paddingHorizontal: spacing.md,
  },
  section: {
    marginBottom: spacing.lg,
  },
  point: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  pointDivider: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  pointText: {
    flex: 1,
    lineHeight: 20,
  },
  footnote: {
    textAlign: 'center',
    paddingHorizontal: spacing.lg,
    lineHeight: 18,
  },
})
