/**
 * Card — surface blanche réutilisable.
 *
 * Variante `soft` : fond teinté (couleur passée en `tint`) sans ombre, pour les
 * encarts d'information. Variante par défaut : surface blanche bordée + ombre légère.
 */

import React from 'react'
import { View, StyleSheet, StyleProp, ViewStyle } from 'react-native'
import { colors, spacing, radii, shadows } from '../theme'

interface CardProps {
  children: React.ReactNode
  /** Couleur de fond teintée (encart d'info). Si absente : surface blanche. */
  tint?: string
  /** Couleur de la barre d'accent à gauche (optionnelle). */
  accent?: string
  padded?: boolean
  style?: StyleProp<ViewStyle>
  accessibilityLabel?: string
}

export function Card({
  children,
  tint,
  accent,
  padded = true,
  style,
  accessibilityLabel,
}: CardProps): React.JSX.Element {
  const isSoft = tint !== undefined
  return (
    <View
      accessible={accessibilityLabel !== undefined}
      accessibilityLabel={accessibilityLabel}
      style={[
        styles.base,
        padded && styles.padded,
        isSoft
          ? { backgroundColor: tint }
          : [styles.surface, shadows.sm],
        accent !== undefined && {
          borderLeftWidth: 4,
          borderLeftColor: accent,
        },
        style,
      ]}
    >
      {children}
    </View>
  )
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radii.lg,
  },
  padded: {
    padding: spacing.lg,
  },
  surface: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
})
