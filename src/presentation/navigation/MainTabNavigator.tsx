/**
 * MainTabNavigator — Barre de navigation principale en bas de l'écran.
 *
 * 4 onglets :
 * - Calendrier  (écran principal)
 * - Statistiques
 * - Bien-être
 * - Paramètres
 *
 * Utilise @react-navigation/bottom-tabs avec react-native-screens.
 */

import React from 'react'
import { Text, StyleSheet } from 'react-native'
import { NavigationContainer } from '@react-navigation/native'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { CalendarScreen } from '../calendar/CalendarScreen'
import { StatisticsScreen } from '../statistics/StatisticsScreen'
import { WellnessScreen } from '../wellness/WellnessScreen'
import { SettingsScreen } from '../settings/SettingsScreen'

// ─── Types ────────────────────────────────────────────────────────────────────

type TabParamList = {
  Calendrier: undefined
  Statistiques: undefined
  'Bien-être': undefined
  Paramètres: undefined
}

const Tab = createBottomTabNavigator<TabParamList>()

// ─── Icônes texte (pas de dépendance icon library) ───────────────────────────

const TAB_ICONS: Record<string, string> = {
  Calendrier: '📅',
  Statistiques: '📊',
  'Bien-être': '🌿',
  Paramètres: '⚙️',
}

function TabIcon({ name, focused }: { name: string; focused: boolean }): React.JSX.Element {
  return (
    <Text style={[tabIconStyles.icon, focused && tabIconStyles.iconFocused]}>
      {TAB_ICONS[name] ?? '●'}
    </Text>
  )
}

const tabIconStyles = StyleSheet.create({
  icon: {
    fontSize: 22,
    opacity: 0.5,
  },
  iconFocused: {
    opacity: 1,
  },
})

// ─── Composant ────────────────────────────────────────────────────────────────

export function MainTabNavigator(): React.JSX.Element {
  return (
    <NavigationContainer>
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarIcon: ({ focused }) => (
            <TabIcon name={route.name} focused={focused} />
          ),
          tabBarActiveTintColor: '#E91E63',
          tabBarInactiveTintColor: '#9E9E9E',
          tabBarStyle: {
            backgroundColor: '#FFFFFF',
            borderTopColor: '#F0F0F0',
            borderTopWidth: 1,
            height: 60,
            paddingBottom: 8,
            paddingTop: 4,
          },
          tabBarLabelStyle: {
            fontSize: 11,
            fontWeight: '600',
          },
        })}
      >
        <Tab.Screen
          name="Calendrier"
          component={CalendarScreen}
          options={{
            tabBarAccessibilityLabel: 'Calendrier du cycle',
          }}
        />
        <Tab.Screen
          name="Statistiques"
          component={StatisticsScreen}
          options={{
            tabBarAccessibilityLabel: 'Statistiques et historique',
          }}
        />
        <Tab.Screen
          name="Bien-être"
          component={WellnessScreen}
          options={{
            tabBarAccessibilityLabel: 'Conseils de bien-être',
          }}
        />
        <Tab.Screen
          name="Paramètres"
          component={SettingsScreen}
          options={{
            tabBarAccessibilityLabel: 'Paramètres de l\'application',
          }}
        />
      </Tab.Navigator>
    </NavigationContainer>
  )
}
