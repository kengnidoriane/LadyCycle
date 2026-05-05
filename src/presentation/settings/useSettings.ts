/**
 * useSettings — Hook React pour l'écran des paramètres.
 *
 * Responsabilités :
 * - Charger et sauvegarder les préférences utilisateur via CycleRepository
 * - Gérer le changement de langue via I18nService (immédiat, sans redémarrage)
 * - Gérer les rappels de médicaments (ajout, suppression, activation)
 * - Gérer les paramètres de notification
 * - Gérer les paramètres de sécurité et le Kit de Récupération
 *
 * Ce hook ne contient aucune logique métier — il orchestre les services
 * d'infrastructure et expose les données à SettingsScreen et SecurityScreen.
 *
 * Exigences : 4.4, 4.5, 6.1, 6.5, 8.1, 8.5, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7, 15.2, 15.3
 */

import { useState, useEffect, useCallback } from 'react'
import type {
  UserPreferences,
  TrackingMode,
  NotificationPreferences,
  MedicationReminder,
  SecuritySettings,
} from '../../infrastructure/db/CycleRepository'
import { InMemoryCycleRepository } from '../../infrastructure/db/CycleRepository'
import type { SupportedLanguage } from '../../domain/shared/types'
import { i18nService } from '../../infrastructure/i18n/I18nService'
import type { RecoveryKit } from '../../infrastructure/crypto/RecoveryKitService'
import { InMemoryRecoveryKitService } from '../../infrastructure/crypto/RecoveryKitService'

// ─── Repository et services partagés ─────────────────────────────────────────
// En production, ces instances seraient injectées via un contexte React.
// On importe le même repository partagé que useCalendar pour la cohérence.
import { sharedRepository } from '../calendar/useCalendar'

const recoveryKitService = new InMemoryRecoveryKitService()

// ─── Types exposés par le hook ────────────────────────────────────────────────

export interface SettingsState {
  /** Préférences complètes chargées depuis le repository */
  preferences: UserPreferences | null
  /** Vrai pendant le chargement initial */
  isLoading: boolean
  /** Message d'erreur si le chargement a échoué */
  error: string | null
  /** Langue actuellement active */
  currentLanguage: SupportedLanguage

  // ── Actions ──────────────────────────────────────────────────────────────

  /** Changer le mode de suivi (persiste immédiatement) */
  setTrackingMode: (mode: TrackingMode) => Promise<void>

  /** Changer la langue (appliqué immédiatement via I18nService, persisté) */
  setLanguage: (lang: SupportedLanguage) => Promise<void>

  /** Mettre à jour les préférences de notification */
  updateNotificationPreferences: (prefs: Partial<NotificationPreferences>) => Promise<void>

  /** Ajouter un rappel de médicament */
  addMedicationReminder: (reminder: Omit<MedicationReminder, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>

  /** Supprimer un rappel de médicament */
  removeMedicationReminder: (reminderId: string) => Promise<void>

  /** Activer ou désactiver un rappel de médicament */
  toggleMedicationReminder: (reminderId: string, enabled: boolean) => Promise<void>

  /** Mettre à jour les paramètres de sécurité */
  updateSecuritySettings: (settings: Partial<SecuritySettings>) => Promise<void>

  /** Générer un Kit de Récupération (retourne le kit pour affichage) */
  generateRecoveryKit: () => Promise<RecoveryKit | null>

  /** Confirmer la sauvegarde du Kit de Récupération (débloque la sync cloud) */
  confirmRecoveryKitSaved: () => Promise<void>

  /** Recharger les préférences */
  refresh: () => void
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Hook principal des paramètres.
 *
 * Usage :
 *   const { preferences, setTrackingMode, setLanguage, ... } = useSettings()
 */
export function useSettings(): SettingsState {
  const [preferences, setPreferences] = useState<UserPreferences | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentLanguage, setCurrentLanguage] = useState<SupportedLanguage>(
    i18nService.getCurrentLanguage(),
  )

  // ── Chargement ────────────────────────────────────────────────────────────

  const load = useCallback(() => {
    setIsLoading(true)
    setError(null)

    try {
      const result = sharedRepository.loadPreferences()
      if (result.ok) {
        setPreferences(result.value)
        setCurrentLanguage(result.value.languageCode)
      } else {
        setError(result.error.message)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur inattendue')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  // ── Helpers de persistance ────────────────────────────────────────────────

  /**
   * Sauvegarde les préférences mises à jour et met à jour l'état local.
   */
  const savePreferences = useCallback(
    async (updated: UserPreferences): Promise<void> => {
      const result = sharedRepository.savePreferences(updated)
      if (result.ok) {
        setPreferences(updated)
      } else {
        setError(result.error.message)
        throw new Error(result.error.message)
      }
    },
    [],
  )

  /**
   * Charge les préférences actuelles ou retourne les valeurs par défaut.
   */
  const getCurrentPreferences = useCallback((): UserPreferences => {
    if (preferences) return preferences
    const result = sharedRepository.loadPreferences()
    return result.ok ? result.value : createDefaultPreferences()
  }, [preferences])

  // ── Actions ───────────────────────────────────────────────────────────────

  const setTrackingMode = useCallback(
    async (mode: TrackingMode): Promise<void> => {
      const current = getCurrentPreferences()
      await savePreferences({ ...current, trackingMode: mode })
    },
    [getCurrentPreferences, savePreferences],
  )

  /**
   * Change la langue immédiatement via I18nService (sans redémarrage),
   * puis persiste dans user_preferences.
   *
   * Exigences 15.2, 15.3 : changement immédiat, persisté.
   */
  const setLanguage = useCallback(
    async (lang: SupportedLanguage): Promise<void> => {
      // 1. Appliquer immédiatement via I18nService (Context + Provider pattern)
      i18nService.setLanguage(lang)
      setCurrentLanguage(lang)

      // 2. Persister dans user_preferences
      const current = getCurrentPreferences()
      await savePreferences({ ...current, languageCode: lang })
    },
    [getCurrentPreferences, savePreferences],
  )

  const updateNotificationPreferences = useCallback(
    async (prefs: Partial<NotificationPreferences>): Promise<void> => {
      const current = getCurrentPreferences()
      const updated: UserPreferences = {
        ...current,
        notificationPreferences: {
          ...current.notificationPreferences,
          ...prefs,
        },
      }
      await savePreferences(updated)
    },
    [getCurrentPreferences, savePreferences],
  )

  const addMedicationReminder = useCallback(
    async (
      reminder: Omit<MedicationReminder, 'id' | 'createdAt' | 'updatedAt'>,
    ): Promise<void> => {
      const current = getCurrentPreferences()
      const now = new Date().toISOString()
      const newReminder: MedicationReminder = {
        ...reminder,
        id: generateId(),
        createdAt: now,
        updatedAt: now,
      }
      const updated: UserPreferences = {
        ...current,
        medicationReminders: [...current.medicationReminders, newReminder],
      }
      await savePreferences(updated)
    },
    [getCurrentPreferences, savePreferences],
  )

  const removeMedicationReminder = useCallback(
    async (reminderId: string): Promise<void> => {
      const current = getCurrentPreferences()
      const updated: UserPreferences = {
        ...current,
        medicationReminders: current.medicationReminders.filter(
          r => r.id !== reminderId,
        ),
      }
      await savePreferences(updated)
    },
    [getCurrentPreferences, savePreferences],
  )

  const toggleMedicationReminder = useCallback(
    async (reminderId: string, enabled: boolean): Promise<void> => {
      const current = getCurrentPreferences()
      const now = new Date().toISOString()
      const updated: UserPreferences = {
        ...current,
        medicationReminders: current.medicationReminders.map(r =>
          r.id === reminderId ? { ...r, enabled, updatedAt: now } : r,
        ),
      }
      await savePreferences(updated)
    },
    [getCurrentPreferences, savePreferences],
  )

  const updateSecuritySettings = useCallback(
    async (settings: Partial<SecuritySettings>): Promise<void> => {
      const current = getCurrentPreferences()
      const updated: UserPreferences = {
        ...current,
        securitySettings: {
          ...current.securitySettings,
          ...settings,
        },
      }
      await savePreferences(updated)
    },
    [getCurrentPreferences, savePreferences],
  )

  /**
   * Génère un Kit de Récupération BIP-39 de 12 mots.
   * Retourne le kit pour affichage — ne marque pas encore recoveryKitGenerated.
   * L'utilisatrice doit confirmer la sauvegarde avant de débloquer la sync cloud.
   *
   * Exigence 10.6 : générer le kit avant d'autoriser la synchronisation.
   */
  const generateRecoveryKit = useCallback(async (): Promise<RecoveryKit | null> => {
    const result = recoveryKitService.generateRecoveryKit()
    if (result.ok) {
      return result.value
    }
    setError(result.error.message)
    return null
  }, [])

  /**
   * Confirme que l'utilisatrice a sauvegardé le Kit de Récupération.
   * Marque recoveryKitGenerated = true et active la sauvegarde cloud.
   *
   * Exigence 10.6 : bloquer la sync tant que le kit n'est pas confirmé.
   */
  const confirmRecoveryKitSaved = useCallback(async (): Promise<void> => {
    const current = getCurrentPreferences()
    const updated: UserPreferences = {
      ...current,
      securitySettings: {
        ...current.securitySettings,
        recoveryKitGenerated: true,
        cloudBackupEnabled: true,
      },
    }
    await savePreferences(updated)
  }, [getCurrentPreferences, savePreferences])

  return {
    preferences,
    isLoading,
    error,
    currentLanguage,
    setTrackingMode,
    setLanguage,
    updateNotificationPreferences,
    addMedicationReminder,
    removeMedicationReminder,
    toggleMedicationReminder,
    updateSecuritySettings,
    generateRecoveryKit,
    confirmRecoveryKitSaved,
    refresh: load,
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

function createDefaultPreferences(): UserPreferences {
  return {
    trackingMode: 'general',
    notificationPreferences: {
      enabled: true,
      periodAdvanceNoticeDays: [3, 1],
      fertileWindowAdvanceNoticeDays: 1,
      medicationRemindersEnabled: true,
    },
    medicationReminders: [],
    securitySettings: {
      authenticationEnabled: false,
      authenticationType: 'pin',
      autoLockEnabled: false,
      autoLockTimeoutMinutes: 5,
      cloudBackupEnabled: false,
      recoveryKitGenerated: false,
    },
    languageCode: 'fr',
  }
}
