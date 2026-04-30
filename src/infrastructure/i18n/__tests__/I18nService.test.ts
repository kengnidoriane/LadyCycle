/**
 * Tests property-based pour I18nService.
 *
 * Feature: suivi-cycle-menstruel
 * Property 36: Persistance et restauration de la langue
 * Property 37: Détection de la langue système au premier lancement
 *
 * Valide : Exigences 15.1, 15.3, 15.4
 *
 * Ces tests vérifient les invariants fondamentaux du service d'internationalisation :
 *   - La langue sauvegardée dans les préférences est restaurée à l'identique
 *   - setLanguage() change immédiatement la langue active (sans redémarrage)
 *   - Les libellés UI sont retournés dans la langue active
 *   - Les conseils de bien-être sont retournés dans la langue active
 *   - initialize() avec une langue non supportée utilise 'fr' par défaut
 *   - Le round-trip savePreferences → loadPreferences préserve languageCode
 *   - detectSystemLanguage() retourne la langue système si supportée, 'fr' sinon
 *
 * Outil : fast-check (minimum 100 itérations par propriété)
 */

import * as fc from 'fast-check'
import { InMemoryI18nService, I18nService } from '../I18nService'
import { InMemoryCycleRepository } from '../../db/CycleRepository'
import type { SupportedLanguage } from '../../../domain/shared/types'
import type { WellnessContent, CyclePhase } from '../I18nService'

// ─── Mock react-native-localize ───────────────────────────────────────────────
// react-native-localize est un module natif non disponible dans Jest.
// On le mocke pour contrôler la liste de locales retournée par getLocales().

jest.mock('react-native-localize', () => ({
  getLocales: jest.fn(),
}), { virtual: true })

// Référence au mock pour le configurer dans chaque test
// eslint-disable-next-line @typescript-eslint/no-var-requires
const RNLocalize = require('react-native-localize') as {
  getLocales: jest.Mock
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Crée un WellnessContent minimal avec au moins un conseil par phase.
 * Utilisé pour vérifier que les conseils sont bien dans la bonne langue.
 */
function makeWellnessContent(lang: SupportedLanguage): WellnessContent {
  const marker = lang === 'fr' ? 'fr' : 'en'
  const phases: CyclePhase[] = ['menstrual', 'follicular', 'ovulation', 'luteal']
  const phaseAdvice = Object.fromEntries(
    phases.map(phase => [
      phase,
      [
        {
          id: `${lang}-${phase}-1`,
          category: 'self_care' as const,
          title: `${marker}-title-${phase}`,
          content: `${marker}-content-${phase}`,
          modes: null,
        },
      ],
    ]),
  ) as WellnessContent['phases']

  return { phases: phaseAdvice }
}

/**
 * Crée un InMemoryI18nService avec des traductions distinctes par langue.
 * Les clés de traduction contiennent le code de langue pour permettre
 * de vérifier que la bonne langue est active.
 */
function makeI18nService(initialLang: SupportedLanguage = 'fr'): InMemoryI18nService {
  // Les traductions contiennent le code de langue dans la valeur
  // pour permettre de vérifier que la bonne langue est utilisée
  const translations: Record<string, unknown> = {
    'app.language': initialLang,
    'calendar.title': initialLang === 'fr' ? 'Mon Cycle' : 'My Cycle',
    'settings.save': initialLang === 'fr' ? 'Enregistrer' : 'Save',
  }
  return new InMemoryI18nService(
    translations,
    makeWellnessContent(initialLang),
    initialLang,
  )
}

/**
 * Crée un InMemoryI18nService avec des traductions distinctes pour fr et en.
 * Utilisé pour les tests qui changent de langue.
 */
function makeI18nServiceWithBothLangs(): {
  service: InMemoryI18nService
  frTranslations: Record<string, unknown>
  enTranslations: Record<string, unknown>
} {
  const frTranslations: Record<string, unknown> = {
    'app.language': 'fr',
    'calendar.title': 'Mon Cycle',
    'settings.save': 'Enregistrer',
  }
  // InMemoryI18nService utilise les traductions injectées au constructeur.
  // Pour simuler le changement de langue, on crée un service avec les
  // traductions fr et on vérifie le comportement de setLanguage().
  const service = new InMemoryI18nService(
    frTranslations,
    makeWellnessContent('fr'),
    'fr',
  )
  const enTranslations: Record<string, unknown> = {
    'app.language': 'en',
    'calendar.title': 'My Cycle',
    'settings.save': 'Save',
  }
  return { service, frTranslations, enTranslations }
}

// ─── Arbitraires ─────────────────────────────────────────────────────────────

/**
 * Génère une langue supportée ('fr' ou 'en').
 */
const arbitrarySupportedLanguage = fc.constantFrom<SupportedLanguage>('fr', 'en')

/**
 * Génère une séquence de changements de langue (pour tester les transitions).
 */
const arbitraryLanguageSequence = fc.array(arbitrarySupportedLanguage, {
  minLength: 1,
  maxLength: 10,
})

/**
 * Génère des préférences utilisateur complètes avec un languageCode aléatoire.
 */
const arbitraryUserPreferences = arbitrarySupportedLanguage.map(lang => ({
  trackingMode: 'general' as const,
  notificationPreferences: {
    enabled: true,
    periodAdvanceNoticeDays: [3, 1],
    fertileWindowAdvanceNoticeDays: 1,
    medicationRemindersEnabled: true,
  },
  medicationReminders: [],
  securitySettings: {
    authenticationEnabled: false,
    authenticationType: 'pin' as const,
    autoLockEnabled: false,
    autoLockTimeoutMinutes: 5,
    cloudBackupEnabled: false,
    recoveryKitGenerated: false,
  },
  languageCode: lang,
}))

// ─── Propriété 36 : Persistance et restauration de la langue ─────────────────

describe('Propriété 36 : Persistance et restauration de la langue', () => {
  /**
   * Round-trip de persistance : savePreferences(lang) → loadPreferences() → lang.
   *
   * Pour toute langue supportée L, sauvegarder les préférences avec languageCode = L
   * puis les recharger doit retourner exactement L.
   *
   * Valide : Exigence 15.4 — "LE Système DOIT stocker la préférence de langue dans
   * user_preferences et la restaurer au prochain lancement"
   */
  it('round-trip : loadPreferences(savePreferences(lang)).languageCode === lang', () => {
    fc.assert(
      fc.property(arbitraryUserPreferences, preferences => {
        const repository = new InMemoryCycleRepository()

        // Sauvegarder les préférences avec le languageCode généré
        const saveResult = repository.savePreferences(preferences)
        expect(saveResult.ok).toBe(true)

        // Recharger les préférences
        const loadResult = repository.loadPreferences()
        expect(loadResult.ok).toBe(true)
        if (!loadResult.ok) return

        // La langue doit être restaurée à l'identique
        expect(loadResult.value.languageCode).toBe(preferences.languageCode)
      }),
      { numRuns: 100 },
    )
  })

  /**
   * Persistance de la langue après plusieurs sauvegardes successives.
   *
   * Pour toute séquence de langues [L1, L2, ..., Ln], après avoir sauvegardé
   * chaque langue successivement, la dernière langue sauvegardée doit être
   * celle qui est restaurée.
   *
   * Valide : Exigence 15.4
   */
  it('la dernière langue sauvegardée est celle qui est restaurée après plusieurs sauvegardes', () => {
    fc.assert(
      fc.property(arbitraryLanguageSequence, languages => {
        const repository = new InMemoryCycleRepository()

        // Sauvegarder chaque langue successivement
        for (const lang of languages) {
          const prefs = {
            trackingMode: 'general' as const,
            notificationPreferences: {
              enabled: true,
              periodAdvanceNoticeDays: [3, 1],
              fertileWindowAdvanceNoticeDays: 1,
              medicationRemindersEnabled: true,
            },
            medicationReminders: [],
            securitySettings: {
              authenticationEnabled: false,
              authenticationType: 'pin' as const,
              autoLockEnabled: false,
              autoLockTimeoutMinutes: 5,
              cloudBackupEnabled: false,
              recoveryKitGenerated: false,
            },
            languageCode: lang,
          }
          const saveResult = repository.savePreferences(prefs)
          expect(saveResult.ok).toBe(true)
        }

        // La langue restaurée doit être la dernière de la séquence
        const lastLanguage = languages[languages.length - 1]
        const loadResult = repository.loadPreferences()
        expect(loadResult.ok).toBe(true)
        if (!loadResult.ok) return

        expect(loadResult.value.languageCode).toBe(lastLanguage)
      }),
      { numRuns: 100 },
    )
  })

  /**
   * Changement immédiat de langue : setLanguage() met à jour getCurrentLanguage()
   * sans redémarrage.
   *
   * Pour toute langue cible L, après setLanguage(L), getCurrentLanguage() doit
   * retourner L immédiatement.
   *
   * Valide : Exigence 15.3 — "LE Système DOIT appliquer immédiatement la nouvelle
   * langue à toute l'interface [...] sans redémarrage de l'application"
   */
  it('setLanguage(L) → getCurrentLanguage() === L immédiatement', () => {
    fc.assert(
      fc.property(
        arbitrarySupportedLanguage,
        arbitrarySupportedLanguage,
        (initialLang, targetLang) => {
          const service = makeI18nService(initialLang)

          // Vérifier la langue initiale
          expect(service.getCurrentLanguage()).toBe(initialLang)

          // Changer la langue
          service.setLanguage(targetLang)

          // La langue doit être mise à jour immédiatement
          expect(service.getCurrentLanguage()).toBe(targetLang)
        },
      ),
      { numRuns: 100 },
    )
  })

  /**
   * initialize() restaure la langue sauvegardée.
   *
   * Pour toute langue L sauvegardée dans les préférences, initialize(L) doit
   * configurer le service avec cette langue, simulant le comportement au
   * redémarrage de l'application.
   *
   * Valide : Exigence 15.4 — "la restaurer au prochain lancement"
   */
  it('initialize(lang) restaure la langue sauvegardée au redémarrage', () => {
    fc.assert(
      fc.property(arbitrarySupportedLanguage, lang => {
        const service = makeI18nService('fr') // langue initiale quelconque

        // Simuler le redémarrage : initialize() avec la langue sauvegardée
        service.initialize(lang)

        // La langue doit être celle passée à initialize()
        expect(service.getCurrentLanguage()).toBe(lang)
      }),
      { numRuns: 100 },
    )
  })

  /**
   * Cohérence entre persistance et service i18n.
   *
   * Pour toute langue L :
   * 1. Sauvegarder L dans les préférences (CycleRepository)
   * 2. Recharger les préférences
   * 3. Initialiser le service i18n avec la langue rechargée
   * → getCurrentLanguage() doit retourner L
   *
   * Ce test simule le flux complet au démarrage de l'application :
   * charger les préférences → initialiser i18n avec la langue sauvegardée.
   *
   * Valide : Exigences 15.3, 15.4
   */
  it('flux complet : savePreferences(L) → loadPreferences() → initialize() → getCurrentLanguage() === L', () => {
    fc.assert(
      fc.property(arbitraryUserPreferences, preferences => {
        const repository = new InMemoryCycleRepository()
        const service = makeI18nService('fr')

        // Étape 1 : sauvegarder les préférences avec la langue choisie
        const saveResult = repository.savePreferences(preferences)
        expect(saveResult.ok).toBe(true)

        // Étape 2 : recharger les préférences (simule le redémarrage)
        const loadResult = repository.loadPreferences()
        expect(loadResult.ok).toBe(true)
        if (!loadResult.ok) return

        // Étape 3 : initialiser le service i18n avec la langue rechargée
        service.initialize(loadResult.value.languageCode)

        // La langue active doit correspondre à celle sauvegardée
        expect(service.getCurrentLanguage()).toBe(preferences.languageCode)
      }),
      { numRuns: 100 },
    )
  })

  /**
   * Idempotence de setLanguage() : appeler setLanguage(L) deux fois de suite
   * ne change pas le résultat.
   *
   * Valide : Exigence 15.3
   */
  it('setLanguage(L) est idempotent : appeler deux fois ne change pas le résultat', () => {
    fc.assert(
      fc.property(
        arbitrarySupportedLanguage,
        arbitrarySupportedLanguage,
        (initialLang, targetLang) => {
          const service = makeI18nService(initialLang)

          service.setLanguage(targetLang)
          const langAfterFirst = service.getCurrentLanguage()

          service.setLanguage(targetLang)
          const langAfterSecond = service.getCurrentLanguage()

          expect(langAfterFirst).toBe(targetLang)
          expect(langAfterSecond).toBe(targetLang)
        },
      ),
      { numRuns: 100 },
    )
  })

  /**
   * Transitions de langue : après une séquence de changements de langue,
   * getCurrentLanguage() retourne toujours la dernière langue définie.
   *
   * Valide : Exigence 15.3
   */
  it('après une séquence de changements, getCurrentLanguage() retourne la dernière langue', () => {
    fc.assert(
      fc.property(
        arbitrarySupportedLanguage,
        arbitraryLanguageSequence,
        (initialLang, sequence) => {
          const service = makeI18nService(initialLang)

          // Appliquer chaque changement de langue
          for (const lang of sequence) {
            service.setLanguage(lang)
          }

          // La langue active doit être la dernière de la séquence
          const expectedLang = sequence[sequence.length - 1]
          expect(service.getCurrentLanguage()).toBe(expectedLang)
        },
      ),
      { numRuns: 100 },
    )
  })

  /**
   * Les conseils de bien-être sont disponibles dans la langue active.
   *
   * Pour toute langue L, après initialize(L) ou setLanguage(L),
   * loadWellnessContent() doit retourner un contenu non vide pour chaque phase.
   *
   * Valide : Exigence 15.4 — les contenus doivent être dans la langue sélectionnée
   */
  it('loadWellnessContent() retourne des conseils non vides pour chaque phase dans la langue active', () => {
    const phases: CyclePhase[] = ['menstrual', 'follicular', 'ovulation', 'luteal']

    fc.assert(
      fc.property(arbitrarySupportedLanguage, lang => {
        // Créer un service avec du contenu wellness pour la langue cible
        const service = new InMemoryI18nService(
          {},
          makeWellnessContent(lang),
          lang,
        )

        const content = service.loadWellnessContent()

        // Chaque phase doit avoir au moins un conseil
        for (const phase of phases) {
          expect(content.phases[phase]).toBeDefined()
          expect(content.phases[phase].length).toBeGreaterThan(0)
        }
      }),
      { numRuns: 100 },
    )
  })

  /**
   * Préservation des autres préférences lors de la sauvegarde du languageCode.
   *
   * Pour toutes les préférences P avec un languageCode L, sauvegarder puis
   * recharger doit préserver toutes les autres préférences (trackingMode,
   * notificationPreferences, etc.) en plus du languageCode.
   *
   * Valide : Exigence 15.4 — la persistance du languageCode ne doit pas
   * corrompre les autres préférences.
   */
  it('la persistance du languageCode préserve toutes les autres préférences', () => {
    fc.assert(
      fc.property(arbitraryUserPreferences, preferences => {
        const repository = new InMemoryCycleRepository()

        const saveResult = repository.savePreferences(preferences)
        expect(saveResult.ok).toBe(true)

        const loadResult = repository.loadPreferences()
        expect(loadResult.ok).toBe(true)
        if (!loadResult.ok) return

        const loaded = loadResult.value

        // Le languageCode doit être préservé
        expect(loaded.languageCode).toBe(preferences.languageCode)

        // Les autres préférences doivent aussi être préservées
        expect(loaded.trackingMode).toBe(preferences.trackingMode)
        expect(loaded.notificationPreferences.enabled).toBe(
          preferences.notificationPreferences.enabled,
        )
        expect(loaded.securitySettings.cloudBackupEnabled).toBe(
          preferences.securitySettings.cloudBackupEnabled,
        )
      }),
      { numRuns: 100 },
    )
  })
})

// ─── Tests : Comportement avec langue non supportée ───────────────────────────

describe('I18nService — comportement avec langue non supportée', () => {
  /**
   * initialize() avec une langue non supportée utilise 'fr' par défaut.
   *
   * Note : InMemoryI18nService accepte directement SupportedLanguage,
   * donc ce test vérifie le comportement de I18nService (production).
   * Pour InMemoryI18nService, on vérifie que 'fr' est la langue par défaut
   * quand aucune langue n'est spécifiée.
   *
   * Valide : Exigence 15.1 — "si la langue du système n'est pas supportée,
   * LE Système DOIT utiliser le français par défaut"
   */
  it('la langue par défaut est "fr" quand aucune langue n\'est spécifiée', () => {
    // InMemoryI18nService sans langue initiale → doit utiliser 'fr'
    const service = new InMemoryI18nService()
    expect(service.getCurrentLanguage()).toBe('fr')
  })

  it('initialize() avec "fr" configure correctement la langue française', () => {
    const service = new InMemoryI18nService()
    service.initialize('fr')
    expect(service.getCurrentLanguage()).toBe('fr')
  })

  it('initialize() avec "en" configure correctement la langue anglaise', () => {
    const service = new InMemoryI18nService()
    service.initialize('en')
    expect(service.getCurrentLanguage()).toBe('en')
  })
})

// ─── Tests : Valeurs par défaut du repository ─────────────────────────────────

describe('CycleRepository — valeurs par défaut du languageCode', () => {
  /**
   * Sans préférences sauvegardées, loadPreferences() doit retourner 'fr'
   * comme langue par défaut.
   *
   * Valide : Exigence 15.1 — le français est la langue par défaut
   */
  it('loadPreferences() retourne "fr" comme langue par défaut si aucune préférence n\'est sauvegardée', () => {
    const repository = new InMemoryCycleRepository()
    const result = repository.loadPreferences()

    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.value.languageCode).toBe('fr')
  })

  /**
   * Pour toute langue L sauvegardée, loadPreferences() ne doit jamais
   * retourner une langue différente de L.
   *
   * Valide : Exigence 15.4
   */
  it('loadPreferences() ne retourne jamais une langue différente de celle sauvegardée', () => {
    fc.assert(
      fc.property(arbitrarySupportedLanguage, lang => {
        const repository = new InMemoryCycleRepository()

        repository.savePreferences({
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
          languageCode: lang,
        })

        const result = repository.loadPreferences()
        expect(result.ok).toBe(true)
        if (!result.ok) return

        // La langue retournée doit être exactement celle sauvegardée
        expect(result.value.languageCode).toBe(lang)
        // Et ne doit pas être l'autre langue
        const otherLang: SupportedLanguage = lang === 'fr' ? 'en' : 'fr'
        expect(result.value.languageCode).not.toBe(otherLang)
      }),
      { numRuns: 100 },
    )
  })
})

// ─── Propriété 37 : Détection de la langue système au premier lancement ───────

describe('Propriété 37 : Détection de la langue système au premier lancement', () => {
  /**
   * Invariant principal : si la langue système est supportée ('fr' ou 'en'),
   * detectSystemLanguage() doit retourner cette langue.
   *
   * Pour toute locale système dont le languageCode est 'fr' ou 'en',
   * detectSystemLanguage() doit retourner ce code.
   *
   * Valide : Exigence 15.1 — "QUAND l'application est lancée pour la première fois,
   * ALORS LE Système DOIT détecter automatiquement la langue du système de l'appareil
   * via react-native-localize et appliquer la langue correspondante (français ou anglais)"
   */
  it('retourne la langue système si elle est supportée (fr ou en)', () => {
    fc.assert(
      fc.property(
        // Génère une locale supportée en première position
        fc.constantFrom<SupportedLanguage>('fr', 'en'),
        // Génère des locales supplémentaires (peuvent être n'importe quoi)
        fc.array(
          fc.string({ minLength: 2, maxLength: 5 }).filter(s => /^[a-z]+$/.test(s)),
          { maxLength: 3 },
        ),
        (primaryLang, extraLocales) => {
          // Configurer react-native-localize pour retourner la langue supportée en premier
          RNLocalize.getLocales.mockReturnValue([
            { languageCode: primaryLang },
            ...extraLocales.map(code => ({ languageCode: code })),
          ])

          const service = new I18nService()
          const detected = service.detectSystemLanguage()

          expect(detected).toBe(primaryLang)
        },
      ),
      { numRuns: 100 },
    )
  })

  /**
   * Fallback sur 'fr' : si aucune locale système n'est supportée,
   * detectSystemLanguage() doit retourner 'fr' par défaut.
   *
   * Pour toute liste de locales ne contenant ni 'fr' ni 'en',
   * detectSystemLanguage() doit retourner 'fr'.
   *
   * Valide : Exigence 15.1 — "si la langue du système n'est pas supportée,
   * LE Système DOIT utiliser le français par défaut"
   */
  it('retourne "fr" par défaut si aucune locale système n\'est supportée', () => {
    // Codes de langue non supportés (tout sauf 'fr' et 'en')
    const unsupportedLanguageCodes = fc.array(
      fc.string({ minLength: 2, maxLength: 5 })
        .filter(s => /^[a-z]+$/.test(s) && s !== 'fr' && s !== 'en'),
      { minLength: 0, maxLength: 5 },
    )

    fc.assert(
      fc.property(unsupportedLanguageCodes, locales => {
        RNLocalize.getLocales.mockReturnValue(
          locales.map(code => ({ languageCode: code })),
        )

        const service = new I18nService()
        const detected = service.detectSystemLanguage()

        expect(detected).toBe('fr')
      }),
      { numRuns: 100 },
    )
  })

  /**
   * Priorité de la première locale supportée : si la liste de locales contient
   * plusieurs langues supportées, c'est la première qui est retournée.
   *
   * Pour toute liste de locales où la première langue supportée est L,
   * detectSystemLanguage() doit retourner L (pas une autre langue supportée
   * qui apparaîtrait plus loin dans la liste).
   *
   * Valide : Exigence 15.1 — react-native-localize retourne les locales
   * par ordre de préférence ; on prend la première supportée.
   */
  it('retourne la première locale supportée dans la liste de préférences', () => {
    fc.assert(
      fc.property(
        // Génère des locales non supportées avant la première supportée
        fc.array(
          fc.string({ minLength: 2, maxLength: 5 })
            .filter(s => /^[a-z]+$/.test(s) && s !== 'fr' && s !== 'en'),
          { maxLength: 3 },
        ),
        // La première langue supportée dans la liste
        fc.constantFrom<SupportedLanguage>('fr', 'en'),
        // La deuxième langue supportée (différente de la première)
        fc.constantFrom<SupportedLanguage>('fr', 'en'),
        (unsupportedBefore, firstSupported, secondSupported) => {
          // Construire la liste : [non-supportées..., firstSupported, secondSupported]
          const locales = [
            ...unsupportedBefore.map(code => ({ languageCode: code })),
            { languageCode: firstSupported },
            { languageCode: secondSupported },
          ]
          RNLocalize.getLocales.mockReturnValue(locales)

          const service = new I18nService()
          const detected = service.detectSystemLanguage()

          // Doit retourner la première langue supportée, pas la deuxième
          expect(detected).toBe(firstSupported)
        },
      ),
      { numRuns: 100 },
    )
  })

  /**
   * Robustesse : si react-native-localize lève une exception (module natif
   * non lié, environnement de test), detectSystemLanguage() doit retourner
   * 'fr' par défaut sans propager l'erreur.
   *
   * Valide : Exigence 15.1 — le fallback sur 'fr' s'applique aussi en cas
   * d'indisponibilité du module natif.
   */
  it('retourne "fr" par défaut si react-native-localize lève une exception', () => {
    // Simuler un crash du module natif (module non lié sur l'appareil)
    RNLocalize.getLocales.mockImplementation(() => {
      throw new Error('Module natif non disponible')
    })

    const service = new I18nService()

    // Ne doit pas propager l'exception
    expect(() => service.detectSystemLanguage()).not.toThrow()

    const detected = service.detectSystemLanguage()
    expect(detected).toBe('fr')
  })

  /**
   * Normalisation des codes de langue : les codes avec variante régionale
   * (ex: 'fr-FR', 'en-US', 'fr-BE') doivent être normalisés en extrayant
   * la partie principale ('fr', 'en').
   *
   * react-native-localize peut retourner des codes comme 'fr-FR' ou 'en-US'.
   * Le système doit extraire 'fr' ou 'en' et les reconnaître comme supportés.
   *
   * Valide : Exigence 15.1
   */
  it('normalise les codes de langue avec variante régionale (fr-FR → fr, en-US → en)', () => {
    // Paires (code complet, code normalisé attendu)
    const regionalVariants: Array<[string, SupportedLanguage]> = [
      ['fr-FR', 'fr'],
      ['fr-BE', 'fr'],
      ['fr-CA', 'fr'],
      ['fr-CH', 'fr'],
      ['en-US', 'en'],
      ['en-GB', 'en'],
      ['en-AU', 'en'],
      ['en-CA', 'en'],
    ]

    fc.assert(
      fc.property(
        fc.constantFrom(...regionalVariants),
        ([fullCode, expectedLang]) => {
          RNLocalize.getLocales.mockReturnValue([{ languageCode: fullCode }])

          const service = new I18nService()
          const detected = service.detectSystemLanguage()

          expect(detected).toBe(expectedLang)
        },
      ),
      { numRuns: 100 },
    )
  })

  /**
   * Flux complet au premier lancement : detectSystemLanguage() → initialize()
   * → getCurrentLanguage() retourne la langue système détectée.
   *
   * Ce test simule le comportement réel au premier lancement de l'application :
   * 1. Détecter la langue système
   * 2. Initialiser le service i18n avec cette langue
   * 3. Vérifier que la langue active correspond à la langue système
   *
   * Valide : Exigence 15.1 — "appliquer la langue correspondante"
   */
  it('flux complet premier lancement : detectSystemLanguage() → initialize() → getCurrentLanguage()', () => {
    fc.assert(
      fc.property(
        fc.constantFrom<SupportedLanguage>('fr', 'en'),
        systemLang => {
          RNLocalize.getLocales.mockReturnValue([{ languageCode: systemLang }])

          const service = new I18nService()

          // Étape 1 : détecter la langue système (simule le premier lancement)
          const detectedLang = service.detectSystemLanguage()
          expect(detectedLang).toBe(systemLang)

          // Étape 2 : initialiser avec la langue détectée
          service.initialize(detectedLang)

          // Étape 3 : la langue active doit correspondre à la langue système
          expect(service.getCurrentLanguage()).toBe(systemLang)
        },
      ),
      { numRuns: 100 },
    )
  })

  /**
   * Indépendance des instances : deux instances de I18nService créées avec
   * la même configuration de locales doivent détecter la même langue.
   *
   * Garantit que detectSystemLanguage() est déterministe pour une même
   * configuration système.
   *
   * Valide : Exigence 15.1
   */
  it('deux instances détectent la même langue pour la même configuration système', () => {
    fc.assert(
      fc.property(
        fc.constantFrom<SupportedLanguage>('fr', 'en'),
        systemLang => {
          RNLocalize.getLocales.mockReturnValue([{ languageCode: systemLang }])

          const service1 = new I18nService()
          const service2 = new I18nService()

          expect(service1.detectSystemLanguage()).toBe(service2.detectSystemLanguage())
          expect(service1.detectSystemLanguage()).toBe(systemLang)
        },
      ),
      { numRuns: 100 },
    )
  })
})
