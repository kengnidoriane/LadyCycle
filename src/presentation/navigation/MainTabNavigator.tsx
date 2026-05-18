/**
 * MainTabNavigator — Barre de navigation par onglets, sans dépendance externe.
 *
 * Implémentation pure React Native : TouchableOpacity + état local.
 * Évite les problèmes d'assets de @react-navigation sur certaines versions de Metro.
 *
 * 4 onglets :
 * - 📅 Calendrier  (écran principal)
 * - 📊 Statistiques
 * - 🌿 Bien-être
 * - ⚙️ Paramètres
 */

import React, { useState } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
} from 'react-native'
import { CalendarScreen } from '../calendar/CalendarScreen'
import { StatisticsScreen } from '../statistics/StatisticsScreen'
import { WellnessScreen } from '../wellness/WellnessScreen'
import { SettingsScreen } from '../settings/SettingsScreen'

// ─── Types ────────────────────────────────────────────────────────────────────

type TabName = 'calendar' | 'statistics' | 'wellness' | 'settings'

interface Tab {
  name: TabName
  label: string
  emoji: string
  accessibilityLabel: string
}

// ─── Configuration des onglets ────────────────────────────────────────────────

const TABS: Tab[] = [
  { name: 'calendar',   label: 'Calendrier',  emoji: '📅', accessibilityLabel: 'Calendrier du cycle' },
  { name: 'statistics', label: 'Statistiques', emoji: '📊', accessibilityLabel: 'Statistiques et historique' },
  { name: 'wellness',   label: 'Bien-être',   emoji: '🌿', accessibilityLabel: 'Conseils de bien-être' },
  { name: 'settings',   label: 'Paramètres',  emoji: '⚙️', accessibilityLabel: "Paramètres de l'application" },
]

// ─── Composant ────────────────────────────────────────────────────────────────

export function MainTabNavigator(): React.JSX.Element {
  const [activeTab, setActiveTab] = useState<TabName>('calendar')

  return (
    <SafeAreaView style={styles.container}>
      {/* ── Contenu de l'onglet actif ──────────────────────────────────── */}
      <View style={styles.content}>
        {activeTab === 'calendar'   && <CalendarScreen />}
        {activeTab === 'statistics' && <StatisticsScreen />}
        {activeTab === 'wellness'   && <WellnessScreen />}
        {activeTab === 'settings'   && <SettingsScreen />}
      </View>

      {/* ── Barre de navigation ────────────────────────────────────────── */}
      <View style={styles.tabBar} accessibilityRole="tablist">
        {TABS.map((tab) => {
          const isActive = activeTab === tab.name
          return (
            <TouchableOpacity
              key={tab.name}
              style={styles.tabItem}
              onPress={() => setActiveTab(tab.name)}
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
              accessibilityLabel={tab.accessibilityLabel}
            >
              <Text style={[styles.tabEmoji, isActive && styles.tabEmojiActive]}>
                {tab.emoji}
              </Text>
              <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>
                {tab.label}
              </Text>
              {isActive && <View style={styles.activeIndicator} />}
            </TouchableOpacity>
          )
        })}
      </View>
    </SafeAreaView>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  content: {
    flex: 1,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    paddingBottom: 4,
    paddingTop: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 8,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    position: 'relative',
  },
  tabEmoji: {
    fontSize: 22,
    opacity: 0.45,
    marginBottom: 2,
  },
  tabEmojiActive: {
    opacity: 1,
  },
  tabLabel: {
    fontSize: 10,
    color: '#9E9E9E',
    fontWeight: '500',
  },
  tabLabelActive: {
    color: '#E91E63',
    fontWeight: '700',
  },
  activeIndicator: {
    position: 'absolute',
    top: 0,
    width: 24,
    height: 3,
    borderRadius: 2,
    backgroundColor: '#E91E63',
  },
})
