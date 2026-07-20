/**
 * AppText — composant texte typé sur l'échelle typographique du thème.
 *
 * Évite de répéter fontSize / fontWeight / color partout. Une variante = un style.
 * Usage : <AppText variant="h1">Titre</AppText>
 */

import React from 'react'
import { Text, StyleSheet, TextProps, TextStyle } from 'react-native'
import { colors, typography } from '../theme'

type Variant =
  | 'display'
  | 'h1'
  | 'h2'
  | 'h3'
  | 'body'
  | 'bodyStrong'
  | 'caption'
  | 'label'
  | 'tiny'

type Tone = 'primary' | 'secondary' | 'tertiary' | 'inverse' | 'brand'

interface AppTextProps extends TextProps {
  variant?: Variant
  tone?: Tone
  center?: boolean
}

const TONE_COLORS: Record<Tone, string> = {
  primary: colors.textPrimary,
  secondary: colors.textSecondary,
  tertiary: colors.textTertiary,
  inverse: colors.textInverse,
  brand: colors.primaryDark,
}

export function AppText({
  variant = 'body',
  tone = 'primary',
  center = false,
  style,
  ...rest
}: AppTextProps): React.JSX.Element {
  const variantStyle = typography[variant] as TextStyle
  return (
    <Text
      style={[
        variantStyle,
        { color: TONE_COLORS[tone] },
        center && styles.center,
        style,
      ]}
      {...rest}
    />
  )
}

const styles = StyleSheet.create({
  center: { textAlign: 'center' },
})
