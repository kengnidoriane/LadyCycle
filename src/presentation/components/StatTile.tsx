/**
 * StatTile — petite tuile métrique (icône + label + valeur).
 *
 * Utilisée en grille de 2 sur l'accueil et les statistiques.
 */

import React from 'react'
import { View, StyleSheet } from 'react-native'
import { AppText } from './Text'
import { Icon, IconName } from './Icon'
import { colors, spacing, radii } from '../theme'

interface StatTileProps {
  icon: IconName
  label: string
  value: string
  iconColor?: string
}

export function StatTile({
  icon,
  label,
  value,
  iconColor = colors.primary,
}: StatTileProps): React.JSX.Element {
  return (
    <View
      style={styles.tile}
      accessible
      accessibilityLabel={`${label} : ${value}`}
    >
      <Icon name={icon} size={20} color={iconColor} />
      <AppText variant="caption" tone="secondary" style={styles.label}>
        {label}
      </AppText>
      <AppText variant="bodyStrong">{value}</AppText>
    </View>
  )
}

const styles = StyleSheet.create({
  tile: {
    flex: 1,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radii.md,
    padding: spacing.md,
  },
  label: {
    marginTop: spacing.sm,
    marginBottom: 2,
  },
})
