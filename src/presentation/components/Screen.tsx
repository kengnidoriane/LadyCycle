/**
 * Screen — conteneur d'écran standard.
 *
 * Gère le fond, les marges de sécurité et le défilement optionnel.
 * Tous les écrans principaux sont enveloppés dans ce composant pour garantir
 * une mise en page cohérente.
 */

import React from 'react'
import {
  View,
  ScrollView,
  StyleSheet,
  StyleProp,
  ViewStyle,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { colors, spacing } from '../theme'

interface ScreenProps {
  children: React.ReactNode
  scroll?: boolean
  contentStyle?: StyleProp<ViewStyle>
}

export function Screen({
  children,
  scroll = true,
  contentStyle,
}: ScreenProps): React.JSX.Element {
  const insets = useSafeAreaInsets()
  const padding = {
    paddingTop: insets.top + spacing.sm,
    paddingHorizontal: spacing.xl,
  }

  if (!scroll) {
    return (
      <View style={[styles.root, padding, contentStyle]}>{children}</View>
    )
  }

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={[
          padding,
          styles.scrollContent,
          contentStyle,
        ]}
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    paddingBottom: spacing.xxxl,
  },
})
