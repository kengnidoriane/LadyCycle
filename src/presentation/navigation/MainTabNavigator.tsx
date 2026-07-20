/**
 * MainTabNavigator — barre d'onglets de LadyCycle.
 *
 * Navigation épurée à 4 onglets, icônes vectorielles (pas d'émojis) :
 *   - Accueil      (écran phare : anneau de cycle)
 *   - Calendrier
 *   - Statistiques
 *   - Réglages
 *
 * Le bien-être n'est plus un onglet : il est intégré à l'accueil sous forme de
 * carte contextuelle (minimalisme — une intention claire par zone).
 *
 * Implémentation pure React Native (état local), sans dépendance @react-navigation.
 */

import React, { useState } from 'react'
import { View, TouchableOpacity, StyleSheet } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { HomeScreen } from '../home/HomeScreen'
import { CalendarScreen } from '../calendar/CalendarScreen'
import { StatisticsScreen } from '../statistics/StatisticsScreen'
import { SettingsScreen } from '../settings/SettingsScreen'
import { AppText, Icon } from '../components'
import type { IconName } from '../components'
import { useI18n } from '../i18n/I18nContext'
import { colors, spacing, radii, shadows } from '../theme'

type TabName = 'home' | 'calendar' | 'statistics' | 'settings'

interface Tab {
  name: TabName
  icon: IconName
  labelKey: string
}

const TABS: Tab[] = [
  { name: 'home', icon: 'home', labelKey: 'nav.home' },
  { name: 'calendar', icon: 'calendar', labelKey: 'nav.calendar' },
  { name: 'statistics', icon: 'chart', labelKey: 'nav.stats' },
  { name: 'settings', icon: 'settings', labelKey: 'nav.settings' },
]

export function MainTabNavigator(): React.JSX.Element {
  const [activeTab, setActiveTab] = useState<TabName>('home')
  const insets = useSafeAreaInsets()
  const { t } = useI18n()

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        {activeTab === 'home' && <HomeScreen onOpenSettings={() => setActiveTab('settings')} />}
        {activeTab === 'calendar' && <CalendarScreen />}
        {activeTab === 'statistics' && <StatisticsScreen />}
        {activeTab === 'settings' && <SettingsScreen />}
      </View>

      <View
        style={[styles.tabBar, { paddingBottom: Math.max(insets.bottom, spacing.sm) }]}
        accessibilityRole="tablist"
      >
        {TABS.map((tab) => {
          const isActive = activeTab === tab.name
          const color = isActive ? colors.primary : colors.textTertiary
          return (
            <TouchableOpacity
              key={tab.name}
              style={styles.tabItem}
              activeOpacity={0.7}
              onPress={() => setActiveTab(tab.name)}
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
              accessibilityLabel={t(tab.labelKey)}
            >
              <Icon name={tab.icon} size={23} color={color} strokeWidth={isActive ? 2.4 : 2} />
              <AppText
                variant="tiny"
                style={{ color, marginTop: 3 }}
                accessibilityElementsHidden
              >
                {t(tab.labelKey)}
              </AppText>
            </TouchableOpacity>
          )
        })}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
    ...shadows.md,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xs,
  },
})
