/**
 * LadyCycle — Point d'entrée de l'application.
 *
 * Responsabilités :
 * - Appeler VersionManager.migrate() au démarrage (Exigence 14.1)
 * - Afficher CalendarScreen comme écran principal
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
import { CalendarScreen } from './src/presentation/calendar/CalendarScreen'
import { InMemoryDatabase, InMemoryVersionManager } from './src/infrastructure/db/VersionManager'
import { ALL_MIGRATIONS } from './src/infrastructure/db/schema'

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

  // Exigence 14.1 : appeler migrate() au démarrage de l'application
  useEffect(() => {
    const result = runMigrations()
    if (result.ok) {
      setMigrationState('success')
    } else {
      setMigrationError(result.error ?? 'Erreur de migration')
      setMigrationState('error')
    }
  }, [])

  return (
    <SafeAreaProvider>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <AppContent
        migrationState={migrationState}
        migrationError={migrationError}
      />
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

  // Migration réussie — afficher l'écran principal
  return <CalendarScreen />
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
