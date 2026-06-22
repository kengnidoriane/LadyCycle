/**
 * ScreenHeader — en-tête de sous-écran avec bouton retour cohérent.
 *
 * Utilisé par tous les écrans accessibles « en profondeur » (Détail de cycle,
 * Sécurité, Kit de récupération) pour que le geste de retour soit identique
 * partout : un bouton circulaire avec une flèche, suivi du titre.
 */

import React from 'react'
import { View, StyleSheet, TouchableOpacity } from 'react-native'
import { AppText } from './Text'
import { Icon } from './Icon'
import { colors, spacing, radii } from '../theme'

interface ScreenHeaderProps {
  title: string
  onBack: () => void
  backLabel?: string
}

export function ScreenHeader({
  title,
  onBack,
  backLabel = 'Back',
}: ScreenHeaderProps): React.JSX.Element {
  return (
    <View style={styles.header}>
      <TouchableOpacity
        onPress={onBack}
        style={styles.backButton}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={backLabel}
      >
        <Icon name="arrowLeft" size={22} color={colors.textSecondary} />
      </TouchableOpacity>
      <AppText variant="h2" accessibilityRole="header">
        {title}
      </AppText>
    </View>
  )
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
