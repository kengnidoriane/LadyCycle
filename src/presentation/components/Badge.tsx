/**
 * Badge — pastille colorée (pill) pour statuts : phase, confiance, etc.
 */

import React from 'react'
import { View, StyleSheet } from 'react-native'
import { AppText } from './Text'
import { Icon, IconName } from './Icon'
import { spacing, radii } from '../theme'

interface BadgeProps {
  label: string
  /** Couleur du texte (foncée). */
  color: string
  /** Couleur de fond (claire). */
  background: string
  icon?: IconName
}

export function Badge({
  label,
  color,
  background,
  icon,
}: BadgeProps): React.JSX.Element {
  return (
    <View style={[styles.badge, { backgroundColor: background }]}>
      {icon && <Icon name={icon} size={14} color={color} />}
      <AppText variant="label" style={{ color }}>
        {label}
      </AppText>
    </View>
  )
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radii.pill,
    alignSelf: 'flex-start',
  },
})
