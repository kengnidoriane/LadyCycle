/**
 * Button — bouton primaire de LadyCycle.
 *
 * Variantes :
 *   - primary   : fond rose plein (action principale)
 *   - secondary : surface claire bordée
 *   - ghost     : transparent (actions discrètes)
 *
 * Supporte une icône optionnelle, l'état de chargement et le plein largeur.
 */

import React from 'react'
import {
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  View,
  StyleProp,
  ViewStyle,
} from 'react-native'
import { AppText } from './Text'
import { Icon, IconName } from './Icon'
import { colors, spacing, radii, shadows } from '../theme'

type Variant = 'primary' | 'secondary' | 'ghost'

interface ButtonProps {
  label: string
  onPress: () => void
  variant?: Variant
  icon?: IconName
  loading?: boolean
  disabled?: boolean
  fullWidth?: boolean
  style?: StyleProp<ViewStyle>
  accessibilityLabel?: string
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  icon,
  loading = false,
  disabled = false,
  fullWidth = true,
  style,
  accessibilityLabel,
}: ButtonProps): React.JSX.Element {
  const isPrimary = variant === 'primary'
  const isGhost = variant === 'ghost'

  const contentColor = isPrimary
    ? colors.textInverse
    : isGhost
    ? colors.textSecondary
    : colors.primaryDark

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: disabled || loading }}
      style={[
        styles.base,
        variant === 'primary' && styles.primary,
        variant === 'secondary' && styles.secondary,
        variant === 'ghost' && styles.ghost,
        fullWidth && styles.fullWidth,
        (disabled || loading) && styles.disabled,
        isPrimary && !disabled && shadows.primary,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={contentColor} />
      ) : (
        <View style={styles.content}>
          {icon && <Icon name={icon} size={19} color={contentColor} />}
          <AppText
            variant="bodyStrong"
            style={{ color: contentColor }}
            accessibilityElementsHidden
          >
            {label}
          </AppText>
        </View>
      )}
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radii.lg,
    paddingVertical: 15,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  primary: {
    backgroundColor: colors.primary,
  },
  secondary: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  ghost: {
    backgroundColor: 'transparent',
  },
  fullWidth: {
    width: '100%',
  },
  disabled: {
    opacity: 0.5,
  },
})
