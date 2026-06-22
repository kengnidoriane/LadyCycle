/**
 * AppNavigator — Routeur racine de l'application.
 *
 * Gère deux états :
 * - 'onboarding' : premier lancement (aucun cycle enregistré)
 * - 'main'       : application principale avec barre de navigation
 *
 * La décision est prise au démarrage en vérifiant si des cycles existent.
 */

import React, { useState, useEffect } from 'react'
import { View, StyleSheet } from 'react-native'
import { OnboardingScreen } from '../onboarding/OnboardingScreen'
import { MainTabNavigator } from './MainTabNavigator'
import { sharedRepository } from '../calendar/useCalendar'
import { colors } from '../theme'

type AppScreen = 'loading' | 'onboarding' | 'main'

export function AppNavigator(): React.JSX.Element {
  const [screen, setScreen] = useState<AppScreen>('loading')

  useEffect(() => {
    const result = sharedRepository.loadAllCycles()
    const hasCycles = result.ok && result.value.length > 0
    setScreen(hasCycles ? 'main' : 'onboarding')
  }, [])

  if (screen === 'loading') {
    return <View style={styles.blank} />
  }

  if (screen === 'onboarding') {
    return <OnboardingScreen onComplete={() => setScreen('main')} />
  }

  return <MainTabNavigator />
}

const styles = StyleSheet.create({
  blank: {
    flex: 1,
    backgroundColor: colors.background,
  },
})
