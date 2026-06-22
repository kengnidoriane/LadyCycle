/**
 * LadyCycle — Point d'entrée de l'application.
 *
 * Responsabilités :
 * - Appeler VersionManager.migrate() au démarrage (Exigence 14.1)
 * - Déléguer le routage à AppNavigator (onboarding → main)
 * - Gérer les états de chargement et d'erreur de migration
 *
 * Architecture :
 * - InMemoryVersionManager + InMemoryDatabase pour les tests sans appareil
 * - En production : NativeVersionManager + SQLCipher
 *
 * Exigences : 14.1, 14.2, 14.3, 14.4
 */

import React, { useEffect, useState } from 'react'
import { StatusBar, StyleSheet, View, Text, ActivityIndicator, useColorScheme } from 'react-native'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { AppNavigator } from './src/presentation/navigation/AppNavigator'
import { I18nProvider } from './src/presentation/i18n/I18nContext'
import { InMemoryDatabase, InMemoryVersionManager } from './src/infrastructure/db/VersionManager'
import { ALL_MIGRATIONS } from './src/infrastructure/db/schema'
import { i18nService } from './src/infrastructure/i18n/I18nService'
import { sharedRepository } from './src/presentation/calendar/useCalendar'

// ─── Migration au démarrage ───────────────────────────────────────────────────

/**
 * Exécute les migrations de schéma au démarrage de l'application.
 * Utilise InMemoryVersionManager pour les tests sans appareil physique.
 * En production, remplacer par NativeVersionManager.
 */
function runMigrations(): { ok: boolean; error?: string } {
  try {
    const db = new InMemoryDatabase()
    const versionManager = new InMemoryVersionManager(db, ALL_MIGRATIONS)
    const result = versionManager.migrate()
    if (!result.ok) {
      return { ok: false, error: result.error.message }
    }
    return { ok: true }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'Erreur de migration inconnue',
    }
  }
}

// ─── Composant principal ──────────────────────────────────────────────────────

function App(): React.JSX.Element {
  const isDarkMode = useColorScheme() === 'dark'
  const [migrationState, setMigrationState] = useState<
    'pending' | 'success' | 'error'
  >('pending')
  const [migrationError, setMigrationError] = useState<string | null>(null)

  // Détecte la langue du système au premier rendu (via react-native-localize).
  // Tombe sur 'fr' si la langue système n'est pas supportée ou indisponible.
  // Note : quand un stockage persistant (SQLCipher) sera en place, une langue
  // explicitement choisie par l'utilisatrice devra primer sur la détection.
  const [initialLanguage] = useState(() => i18nService.detectSystemLanguage())

  // Exigence 14.1 : migrer le schéma puis hydrater le stockage persistant
  // (AsyncStorage) AVANT d'afficher l'app, pour que les données enregistrées
  // lors des sessions précédentes soient disponibles dès le premier rendu.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const result = runMigrations()
      if (!result.ok) {
        if (!cancelled) {
          setMigrationError(result.error ?? 'Erreur de migration')
          setMigrationState('error')
        }
        return
      }
      try {
        await sharedRepository.hydrate()
      } catch {
        // L'hydratation est tolérante aux erreurs ; on démarre sur un état vide.
      }
      if (!cancelled) setMigrationState('success')
    })()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <SafeAreaProvider>
      <I18nProvider initialLanguage={initialLanguage}>
        <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
        <AppContent
          migrationState={migrationState}
          migrationError={migrationError}
        />
      </I18nProvider>
    </SafeAreaProvider>
  )
}

// ─── Contenu de l'application ─────────────────────────────────────────────────

interface AppContentProps {
  migrationState: 'pending' | 'success' | 'error'
  migrationError: string | null
}

function AppContent({ migrationState, migrationError }: AppContentProps): React.JSX.Element {
  if (migrationState === 'pending') {
    return (
      <View style={styles.centered}>
        <ActivityIndicator
          size="large"
          color="#E91E63"
          accessibilityLabel="Initialisation de l'application"
        />
        <Text style={styles.loadingText}>Initialisation…</Text>
      </View>
    )
  }

  if (migrationState === 'error') {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText} accessibilityRole="alert">
          Erreur d'initialisation : {migrationError}
        </Text>
      </View>
    )
  }

  // Migration réussie — déléguer le routage à AppNavigator
  return <AppNavigator />
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FAFAFA',
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 15,
    color: '#757575',
  },
  errorText: {
    fontSize: 15,
    color: '#EF5350',
    textAlign: 'center',
  },
})

export default App
