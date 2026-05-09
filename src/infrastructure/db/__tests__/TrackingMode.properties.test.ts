/**
 * Tests property-based pour la persistance du mode de suivi.
 *
 * Feature: suivi-cycle-menstruel
 *
 * Propriété 19 : Persistance du mode de suivi
 *   Valide : Exigence 8.1
 *
 * Ces tests vérifient les invariants fondamentaux de la persistance du mode de suivi :
 *   - Pour tout mode de suivi M, savePreferences({trackingMode: M}) puis
 *     loadPreferences() retourne exactement M
 *   - Le mode de suivi est préservé après plusieurs sauvegardes successives
 *   - Changer de mode met à jour immédiatement le mode actif
 *   - Le mode de suivi par défaut est 'general' sur un repository vierge
 *   - La persistance du mode ne corrompt pas les autres préférences
 *
 * Outil : fast-check (minimum 100 itérations par propriété)
 */

import * as fc from 'fast-check'
import {
  InMemoryCycleRepository,
  type UserPreferences,
  type TrackingMode,
} from '../CycleRepository'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeRepo(): InMemoryCycleRepository {
  return new InMemoryCycleRepository()
}

/**
 * Construit des UserPreferences complètes avec le mode de suivi fourni.
 * Les autres champs sont des valeurs par défaut stables pour isoler le test.
 */
function makePreferencesWithMode(trackingMode: TrackingMode): UserPreferences {
  return {
    trackingMode,
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

// ─── Arbitraires ─────────────────────────────────────────────────────────────

/**
 * Génère un TrackingMode valide parmi les trois valeurs supportées.
 */
const arbitraryTrackingMode = fc.constantFrom<TrackingMode>(
  'general',
  'trying_to_conceive',
  'natural_contraception',
)

/**
 * Génère une séquence de modes de suivi (pour tester les transitions).
 */
const arbitraryTrackingModeSequence = fc.array(arbitraryTrackingMode, {
  minLength: 1,
  maxLength: 10,
})

/**
 * Génère des UserPreferences complètes avec un trackingMode aléatoire.
 */
const arbitraryPreferencesWithMode: fc.Arbitrary<UserPreferences> = arbitraryTrackingMode.map(
  makePreferencesWithMode,
)

/**
 * Génère des UserPreferences avec tous les champs aléatoires.
 * Utilisé pour vérifier que la persistance du mode ne corrompt pas les autres champs.
 */
const arbitraryFullPreferences: fc.Arbitrary<UserPreferences> = fc.record({
  trackingMode: arbitraryTrackingMode,
  notificationPreferences: fc.record({
    enabled: fc.boolean(),
    periodAdvanceNoticeDays: fc.array(fc.integer({ min: 1, max: 7 }), {
      minLength: 1,
      maxLength: 5,
    }),
    fertileWindowAdvanceNoticeDays: fc.integer({ min: 1, max: 7 }),
    medicationRemindersEnabled: fc.boolean(),
  }),
  medicationReminders: fc.constant([]),
  securitySettings: fc.record({
    authenticationEnabled: fc.boolean(),
    authenticationType: fc.constantFrom('pin' as const, 'biometric' as const),
    autoLockEnabled: fc.boolean(),
    autoLockTimeoutMinutes: fc.integer({ min: 1, max: 60 }),
    cloudBackupEnabled: fc.boolean(),
    recoveryKitGenerated: fc.boolean(),
  }),
  languageCode: fc.constantFrom('fr' as const, 'en' as const),
})

// ─── Propriété 19 : Persistance du mode de suivi ─────────────────────────────

describe('Propriété 19 : Persistance du mode de suivi', () => {
  /**
   * Invariant principal : round-trip du mode de suivi.
   *
   * Pour tout mode de suivi M ∈ {'general', 'trying_to_conceive', 'natural_contraception'},
   * savePreferences({trackingMode: M}) puis loadPreferences() doit retourner
   * exactement M.
   *
   * Valide : Exigence 8.1 — "QUAND une utilisatrice configure son profil, ALORS LE
   * Système DOIT permettre de sélectionner un mode de suivi parmi les options disponibles"
   */
  it('round-trip : loadPreferences(savePreferences(mode)).trackingMode === mode', () => {
    fc.assert(
      fc.property(arbitraryPreferencesWithMode, preferences => {
        const repo = makeRepo()

        const saveResult = repo.savePreferences(preferences)
        expect(saveResult.ok).toBe(true)

        const loadResult = repo.loadPreferences()
        expect(loadResult.ok).toBe(true)
        if (!loadResult.ok) return

        // Le mode de suivi doit être restauré à l'identique
        expect(loadResult.value.trackingMode).toBe(preferences.trackingMode)
      }),
      { numRuns: 100 },
    )
  })

  /**
   * Couverture exhaustive des trois modes.
   *
   * Chaque mode de suivi doit être persisté et restauré correctement.
   * Ce test vérifie explicitement les trois valeurs possibles.
   *
   * Valide : Exigence 8.1
   */
  it('chaque mode de suivi est persisté et restauré correctement', () => {
    const modes: TrackingMode[] = ['general', 'trying_to_conceive', 'natural_contraception']

    for (const mode of modes) {
      const repo = makeRepo()
      const prefs = makePreferencesWithMode(mode)

      const saveResult = repo.savePreferences(prefs)
      expect(saveResult.ok).toBe(true)

      const loadResult = repo.loadPreferences()
      expect(loadResult.ok).toBe(true)
      if (!loadResult.ok) continue

      expect(loadResult.value.trackingMode).toBe(mode)
    }
  })

  /**
   * Changement de mode : la dernière valeur sauvegardée est celle qui est restaurée.
   *
   * Pour toute séquence de modes [M1, M2, ..., Mn], après avoir sauvegardé
   * chaque mode successivement, loadPreferences() doit retourner Mn (le dernier).
   *
   * Valide : Exigence 8.1 — "QUAND une utilisatrice change de mode, ALORS LE Système
   * DOIT adapter immédiatement l'interface et les notifications selon le nouveau mode"
   */
  it('la dernière valeur sauvegardée est celle qui est restaurée après plusieurs changements', () => {
    fc.assert(
      fc.property(arbitraryTrackingModeSequence, modes => {
        const repo = makeRepo()

        // Sauvegarder chaque mode successivement
        for (const mode of modes) {
          const prefs = makePreferencesWithMode(mode)
          const saveResult = repo.savePreferences(prefs)
          expect(saveResult.ok).toBe(true)
        }

        // La valeur restaurée doit être le dernier mode de la séquence
        const lastMode = modes[modes.length - 1]
        const loadResult = repo.loadPreferences()
        expect(loadResult.ok).toBe(true)
        if (!loadResult.ok) return

        expect(loadResult.value.trackingMode).toBe(lastMode)
      }),
      { numRuns: 100 },
    )
  })

  /**
   * Valeur par défaut : 'general' sur un repository vierge.
   *
   * Sans aucune préférence sauvegardée, loadPreferences() doit retourner
   * 'general' comme mode de suivi par défaut.
   *
   * Valide : Exigence 8.1 — le mode général est le mode par défaut
   */
  it('le mode de suivi par défaut est "general" sur un repository vierge', () => {
    const repo = makeRepo()
    const result = repo.loadPreferences()

    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.value.trackingMode).toBe('general')
  })

  /**
   * Isolation : la persistance du mode ne corrompt pas les autres préférences.
   *
   * Pour toutes les préférences P, sauvegarder puis recharger doit préserver
   * toutes les propriétés, pas seulement trackingMode.
   *
   * Valide : Exigence 8.1 — la sélection du mode ne doit pas affecter les
   * autres paramètres de l'application.
   */
  it('la persistance du mode de suivi préserve toutes les autres préférences', () => {
    fc.assert(
      fc.property(arbitraryFullPreferences, preferences => {
        const repo = makeRepo()

        const saveResult = repo.savePreferences(preferences)
        expect(saveResult.ok).toBe(true)

        const loadResult = repo.loadPreferences()
        expect(loadResult.ok).toBe(true)
        if (!loadResult.ok) return

        const loaded = loadResult.value

        // Le mode de suivi doit être préservé
        expect(loaded.trackingMode).toBe(preferences.trackingMode)

        // Les autres préférences doivent aussi être préservées
        expect(loaded.languageCode).toBe(preferences.languageCode)
        expect(loaded.notificationPreferences.enabled).toBe(
          preferences.notificationPreferences.enabled,
        )
        expect(loaded.notificationPreferences.medicationRemindersEnabled).toBe(
          preferences.notificationPreferences.medicationRemindersEnabled,
        )
        expect(loaded.securitySettings.authenticationEnabled).toBe(
          preferences.securitySettings.authenticationEnabled,
        )
        expect(loaded.securitySettings.cloudBackupEnabled).toBe(
          preferences.securitySettings.cloudBackupEnabled,
        )
        expect(loaded.securitySettings.recoveryKitGenerated).toBe(
          preferences.securitySettings.recoveryKitGenerated,
        )
      }),
      { numRuns: 100 },
    )
  })

  /**
   * Injectivité : deux modes différents produisent des préférences différentes.
   *
   * Pour toute paire de modes distincts (M1, M2), les préférences sauvegardées
   * avec M1 et M2 doivent être distinguables après rechargement.
   *
   * Valide : Exigence 8.1 — chaque mode doit être distinct et identifiable
   */
  it('deux modes différents sont distinguables après persistance', () => {
    fc.assert(
      fc.property(arbitraryTrackingMode, arbitraryTrackingMode, (mode1, mode2) => {
        // S'assurer que les deux modes sont différents
        fc.pre(mode1 !== mode2)

        const repo1 = makeRepo()
        const repo2 = makeRepo()

        repo1.savePreferences(makePreferencesWithMode(mode1))
        repo2.savePreferences(makePreferencesWithMode(mode2))

        const load1 = repo1.loadPreferences()
        const load2 = repo2.loadPreferences()

        expect(load1.ok).toBe(true)
        expect(load2.ok).toBe(true)
        if (!load1.ok || !load2.ok) return

        // Les deux modes doivent être différents
        expect(load1.value.trackingMode).not.toBe(load2.value.trackingMode)
        expect(load1.value.trackingMode).toBe(mode1)
        expect(load2.value.trackingMode).toBe(mode2)
      }),
      { numRuns: 100 },
    )
  })

  /**
   * Mise à jour partielle : changer uniquement le mode ne modifie pas les
   * autres préférences déjà sauvegardées.
   *
   * Scénario : l'utilisatrice a configuré ses notifications, puis change de mode.
   * Les préférences de notification doivent rester intactes.
   *
   * Valide : Exigence 8.1 — le changement de mode est une opération isolée
   */
  it('changer le mode de suivi ne modifie pas les préférences de notification', () => {
    fc.assert(
      fc.property(
        arbitraryTrackingMode,
        arbitraryTrackingMode,
        fc.boolean(),
        fc.array(fc.integer({ min: 1, max: 7 }), { minLength: 1, maxLength: 3 }),
        (initialMode, newMode, notificationsEnabled, advanceDays) => {
          const repo = makeRepo()

          // Étape 1 : sauvegarder les préférences initiales avec des notifications configurées
          const initialPrefs: UserPreferences = {
            ...makePreferencesWithMode(initialMode),
            notificationPreferences: {
              enabled: notificationsEnabled,
              periodAdvanceNoticeDays: advanceDays,
              fertileWindowAdvanceNoticeDays: 2,
              medicationRemindersEnabled: true,
            },
          }
          repo.savePreferences(initialPrefs)

          // Étape 2 : changer uniquement le mode de suivi
          const updatedPrefs: UserPreferences = {
            ...initialPrefs,
            trackingMode: newMode,
          }
          repo.savePreferences(updatedPrefs)

          // Étape 3 : vérifier que le mode a changé mais les notifications sont intactes
          const loadResult = repo.loadPreferences()
          expect(loadResult.ok).toBe(true)
          if (!loadResult.ok) return

          const loaded = loadResult.value

          // Le mode doit être le nouveau mode
          expect(loaded.trackingMode).toBe(newMode)

          // Les préférences de notification doivent être préservées
          expect(loaded.notificationPreferences.enabled).toBe(notificationsEnabled)
          expect(loaded.notificationPreferences.periodAdvanceNoticeDays).toEqual(advanceDays)
          expect(loaded.notificationPreferences.fertileWindowAdvanceNoticeDays).toBe(2)
        },
      ),
      { numRuns: 100 },
    )
  })
})

// ─── Tests : Comportement des modes sur les fonctionnalités ──────────────────

describe('Mode de suivi — impact sur les fonctionnalités', () => {
  /**
   * Le mode 'trying_to_conceive' est distinct de 'natural_contraception'.
   *
   * Ces deux modes ont des implications opposées pour la période féconde :
   * - trying_to_conceive : la période féconde est mise en avant (opportunité)
   * - natural_contraception : la période féconde est mise en avant (risque)
   *
   * Ce test vérifie que les deux modes sont bien distincts et persistés
   * correctement, garantissant que l'UI peut les différencier.
   *
   * Valide : Exigences 8.2, 8.3
   */
  it('les modes "trying_to_conceive" et "natural_contraception" sont distincts et persistés correctement', () => {
    const repo = makeRepo()

    // Sauvegarder le mode "essai bébé"
    repo.savePreferences(makePreferencesWithMode('trying_to_conceive'))
    const loadTTC = repo.loadPreferences()
    expect(loadTTC.ok).toBe(true)
    if (loadTTC.ok) {
      expect(loadTTC.value.trackingMode).toBe('trying_to_conceive')
      expect(loadTTC.value.trackingMode).not.toBe('natural_contraception')
    }

    // Changer vers le mode "contraception naturelle"
    repo.savePreferences(makePreferencesWithMode('natural_contraception'))
    const loadNC = repo.loadPreferences()
    expect(loadNC.ok).toBe(true)
    if (loadNC.ok) {
      expect(loadNC.value.trackingMode).toBe('natural_contraception')
      expect(loadNC.value.trackingMode).not.toBe('trying_to_conceive')
    }
  })

  /**
   * Le mode 'general' est le mode neutre par défaut.
   *
   * Valide : Exigence 8.4 — "OÙ le mode 'suivi général' est sélectionné,
   * LE Système DOIT fournir des informations équilibrées sur toutes les phases"
   */
  it('le mode "general" est distinct des deux autres modes', () => {
    fc.assert(
      fc.property(
        fc.constantFrom<TrackingMode>('trying_to_conceive', 'natural_contraception'),
        nonGeneralMode => {
          const repo = makeRepo()

          // Sauvegarder un mode non-général
          repo.savePreferences(makePreferencesWithMode(nonGeneralMode))
          const loadNonGeneral = repo.loadPreferences()
          expect(loadNonGeneral.ok).toBe(true)
          if (loadNonGeneral.ok) {
            expect(loadNonGeneral.value.trackingMode).toBe(nonGeneralMode)
            expect(loadNonGeneral.value.trackingMode).not.toBe('general')
          }

          // Revenir au mode général
          repo.savePreferences(makePreferencesWithMode('general'))
          const loadGeneral = repo.loadPreferences()
          expect(loadGeneral.ok).toBe(true)
          if (loadGeneral.ok) {
            expect(loadGeneral.value.trackingMode).toBe('general')
            expect(loadGeneral.value.trackingMode).not.toBe(nonGeneralMode)
          }
        },
      ),
      { numRuns: 100 },
    )
  })
})
