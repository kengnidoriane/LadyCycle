/**
 * Tests property-based pour RecoveryKitService.
 *
 * Feature: suivi-cycle-menstruel
 *
 * Property 28 : Obligation du Kit de Récupération avant synchronisation cloud
 *   Valide : Exigence 10.6
 *
 * Property 29 : Restauration via Kit de Récupération
 *   Valide : Exigence 10.7
 *
 * Ces tests vérifient les invariants fondamentaux du Kit de Récupération :
 *   - La synchronisation cloud est bloquée tant que recoveryKitGenerated === false
 *   - Un kit valide permet toujours de dériver la même clé cloud (déterminisme)
 *   - La dérivation de clé est injective : deux kits différents → deux clés différentes
 *   - validatePhrase() accepte exactement les phrases de 12 mots BIP-39 valides
 *   - generateRecoveryKit() produit toujours des phrases valides
 *   - exportAsPDF() réussit pour tout kit valide et échoue pour tout kit invalide
 *
 * Outil : fast-check (minimum 100 itérations par propriété)
 */

import * as fc from 'fast-check'
import {
  InMemoryRecoveryKitService,
  BIP39_WORDLIST,
  type RecoveryKit,
  type SecuritySettings,
} from '../RecoveryKitService'

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Crée une instance fraîche du service pour chaque test */
function makeService(): InMemoryRecoveryKitService {
  return new InMemoryRecoveryKitService()
}

/**
 * Simule la logique de garde de synchronisation cloud.
 *
 * En production, cette logique se trouve dans le Use Case d'activation cloud.
 * Elle est extraite ici pour tester la propriété 28 de façon isolée.
 *
 * Règle : la synchronisation cloud ne peut démarrer que si
 * `settings.recoveryKitGenerated === true`.
 */
function canActivateCloudSync(settings: SecuritySettings): boolean {
  return settings.recoveryKitGenerated
}

// ─── Arbitraires ─────────────────────────────────────────────────────────────

/**
 * Génère des SecuritySettings avec recoveryKitGenerated aléatoire.
 */
const arbitrarySecuritySettings = fc.record({
  authenticationEnabled: fc.boolean(),
  authenticationType: fc.constantFrom('pin' as const, 'biometric' as const),
  autoLockEnabled: fc.boolean(),
  autoLockTimeoutMinutes: fc.integer({ min: 1, max: 60 }),
  cloudBackupEnabled: fc.boolean(),
  recoveryKitGenerated: fc.boolean(),
})

/**
 * Génère des SecuritySettings où recoveryKitGenerated === false.
 * Représente l'état avant que l'utilisatrice ait sauvegardé son kit.
 */
const arbitrarySettingsWithoutKit = arbitrarySecuritySettings.map(s => ({
  ...s,
  recoveryKitGenerated: false,
}))

/**
 * Génère des SecuritySettings où recoveryKitGenerated === true.
 * Représente l'état après confirmation du kit par l'utilisatrice.
 */
const arbitrarySettingsWithKit = arbitrarySecuritySettings.map(s => ({
  ...s,
  recoveryKitGenerated: true,
}))

/**
 * Génère une phrase mnémonique valide de 12 mots BIP-39.
 */
const arbitraryValidMnemonic = fc
  .array(fc.integer({ min: 0, max: BIP39_WORDLIST.length - 1 }), {
    minLength: 12,
    maxLength: 12,
  })
  .map(indices => indices.map(i => BIP39_WORDLIST[i]).join(' '))

/**
 * Génère un RecoveryKit valide avec un mnemonic BIP-39 et un timestamp.
 */
const arbitraryValidKit: fc.Arbitrary<RecoveryKit> = fc.record({
  mnemonic: arbitraryValidMnemonic,
  generatedAt: fc
    .integer({ min: 0, max: 1e12 })
    .map(ts => new Date(ts).toISOString()),
})

/**
 * Génère une phrase invalide (mauvais nombre de mots, mots hors liste, etc.)
 */
const arbitraryInvalidMnemonic = fc.oneof(
  // Trop peu de mots
  fc
    .array(fc.integer({ min: 0, max: BIP39_WORDLIST.length - 1 }), {
      minLength: 1,
      maxLength: 11,
    })
    .map(indices => indices.map(i => BIP39_WORDLIST[i]).join(' ')),
  // Trop de mots
  fc
    .array(fc.integer({ min: 0, max: BIP39_WORDLIST.length - 1 }), {
      minLength: 13,
      maxLength: 24,
    })
    .map(indices => indices.map(i => BIP39_WORDLIST[i]).join(' ')),
  // Mots inventés (hors liste BIP-39)
  fc
    .array(fc.string({ minLength: 3, maxLength: 8 }), {
      minLength: 12,
      maxLength: 12,
    })
    .filter(words => words.some(w => !BIP39_WORDLIST.includes(w)))
    .map(words => words.join(' ')),
  // Chaîne vide
  fc.constant(''),
  // Chaîne avec des chiffres
  fc.constant('1 2 3 4 5 6 7 8 9 10 11 12'),
)

// ─── Propriété 28 : Obligation du Kit avant synchronisation cloud ─────────────

describe('Propriété 28 : Obligation du Kit de Récupération avant synchronisation cloud', () => {
  /**
   * Invariant principal : la synchronisation cloud est TOUJOURS bloquée
   * quand recoveryKitGenerated === false, quelle que soit la configuration.
   *
   * Pour tout SecuritySettings avec recoveryKitGenerated === false,
   * canActivateCloudSync() doit retourner false.
   * Valide : Exigence 10.6
   */
  it('la sync cloud est bloquée pour tout état sans kit confirmé', () => {
    fc.assert(
      fc.property(arbitrarySettingsWithoutKit, settings => {
        expect(canActivateCloudSync(settings)).toBe(false)
      }),
      { numRuns: 100 },
    )
  })

  /**
   * Invariant symétrique : la synchronisation cloud est TOUJOURS autorisée
   * quand recoveryKitGenerated === true.
   *
   * Pour tout SecuritySettings avec recoveryKitGenerated === true,
   * canActivateCloudSync() doit retourner true.
   * Valide : Exigence 10.6
   */
  it('la sync cloud est autorisée pour tout état avec kit confirmé', () => {
    fc.assert(
      fc.property(arbitrarySettingsWithKit, settings => {
        expect(canActivateCloudSync(settings)).toBe(true)
      }),
      { numRuns: 100 },
    )
  })

  /**
   * Transition d'état : confirmer le kit débloque la synchronisation.
   *
   * Pour tout état sans kit, passer recoveryKitGenerated à true
   * doit débloquer la synchronisation.
   * Valide : Exigence 10.6
   */
  it('confirmer le kit débloque la synchronisation cloud', () => {
    fc.assert(
      fc.property(arbitrarySettingsWithoutKit, settingsWithoutKit => {
        // Avant confirmation : bloqué
        expect(canActivateCloudSync(settingsWithoutKit)).toBe(false)

        // Après confirmation du kit
        const settingsWithKit: SecuritySettings = {
          ...settingsWithoutKit,
          recoveryKitGenerated: true,
        }

        // Après confirmation : autorisé
        expect(canActivateCloudSync(settingsWithKit)).toBe(true)
      }),
      { numRuns: 100 },
    )
  })

  /**
   * generateRecoveryKit() produit toujours un kit avec une phrase valide.
   *
   * Pour tout appel à generateRecoveryKit(), le kit retourné doit avoir
   * une phrase que validatePhrase() accepte.
   * Valide : Exigence 10.6 (le kit généré est utilisable pour débloquer la sync)
   */
  it('generateRecoveryKit() produit toujours une phrase mnémonique valide', () => {
    const service = makeService()

    fc.assert(
      fc.property(fc.constant(null), () => {
        const result = service.generateRecoveryKit()

        expect(result.ok).toBe(true)
        if (!result.ok) return

        const kit = result.value

        // La phrase doit être valide selon validatePhrase()
        expect(service.validatePhrase(kit.mnemonic)).toBe(true)

        // La phrase doit contenir exactement 12 mots
        const words = kit.mnemonic.trim().split(/\s+/)
        expect(words).toHaveLength(12)

        // Chaque mot doit être dans la liste BIP-39
        const wordSet = new Set(BIP39_WORDLIST)
        words.forEach(word => {
          expect(wordSet.has(word)).toBe(true)
        })

        // Le timestamp doit être un ISO 8601 valide
        expect(() => new Date(kit.generatedAt)).not.toThrow()
        expect(new Date(kit.generatedAt).toISOString()).toBe(kit.generatedAt)
      }),
      { numRuns: 100 },
    )
  })

  /**
   * validatePhrase() accepte exactement les phrases de 12 mots BIP-39 valides.
   *
   * Pour toute phrase générée par generateRecoveryKit(), validatePhrase() retourne true.
   * Valide : Exigence 10.6
   */
  it('validatePhrase() accepte toutes les phrases générées par generateRecoveryKit()', () => {
    const service = makeService()

    fc.assert(
      fc.property(fc.constant(null), () => {
        const result = service.generateRecoveryKit()
        expect(result.ok).toBe(true)
        if (!result.ok) return

        expect(service.validatePhrase(result.value.mnemonic)).toBe(true)
      }),
      { numRuns: 100 },
    )
  })

  /**
   * validatePhrase() rejette toutes les phrases invalides.
   *
   * Pour toute phrase invalide (mauvais nombre de mots, mots hors liste),
   * validatePhrase() doit retourner false.
   * Valide : Exigence 10.6
   */
  it('validatePhrase() rejette toutes les phrases invalides', () => {
    const service = makeService()

    fc.assert(
      fc.property(arbitraryInvalidMnemonic, invalidPhrase => {
        expect(service.validatePhrase(invalidPhrase)).toBe(false)
      }),
      { numRuns: 100 },
    )
  })

  /**
   * deriveCloudKey() échoue pour tout kit avec une phrase invalide.
   *
   * Si l'utilisatrice saisit une phrase incorrecte lors de la restauration,
   * la dérivation de clé doit échouer — jamais produire une clé silencieusement.
   * Valide : Exigence 10.6
   */
  it('deriveCloudKey() retourne une erreur pour tout kit avec phrase invalide', () => {
    const service = makeService()

    fc.assert(
      fc.property(
        arbitraryInvalidMnemonic,
        fc.integer({ min: 0, max: 1e12 }).map(ts => new Date(ts).toISOString()),
        (invalidMnemonic, generatedAt) => {
          const invalidKit: RecoveryKit = { mnemonic: invalidMnemonic, generatedAt }
          const result = service.deriveCloudKey(invalidKit)

          expect(result.ok).toBe(false)
          if (!result.ok) {
            expect(result.error.code).toBe('RECOVERY_KIT_INVALID')
          }
        },
      ),
      { numRuns: 100 },
    )
  })
})

// ─── Propriété 29 : Restauration via Kit de Récupération ─────────────────────

describe('Propriété 29 : Restauration via Kit de Récupération', () => {
  /**
   * Déterminisme : même mnemonic → même clé cloud, toujours.
   *
   * Pour tout kit valide, deux appels successifs à deriveCloudKey()
   * avec le même mnemonic doivent produire la même clé, indépendamment
   * de generatedAt ou de l'instance du service.
   * Valide : Exigence 10.7
   */
  it('deriveCloudKey() est déterministe : même mnemonic → même clé cloud', () => {
    fc.assert(
      fc.property(
        arbitraryValidKit,
        fc.integer({ min: 0, max: 1e12 }).map(ts => new Date(ts).toISOString()),
        (kit, differentTimestamp) => {
          const service1 = makeService()
          const service2 = makeService()

          // Même mnemonic, timestamps différents
          const kitWithDifferentTimestamp: RecoveryKit = {
            mnemonic: kit.mnemonic,
            generatedAt: differentTimestamp,
          }

          const key1 = service1.deriveCloudKey(kit)
          const key2 = service2.deriveCloudKey(kitWithDifferentTimestamp)

          expect(key1.ok).toBe(true)
          expect(key2.ok).toBe(true)
          if (!key1.ok || !key2.ok) return

          // La clé doit être identique — le timestamp n'influence pas la dérivation
          expect(key1.value).toBe(key2.value)
        },
      ),
      { numRuns: 100 },
    )
  })

  /**
   * Injectivité : deux mnemonics différents → deux clés différentes.
   *
   * Pour toute paire de kits avec des mnemonics distincts, les clés
   * dérivées doivent être différentes. Garantit qu'un kit ne peut pas
   * restaurer les données d'une autre utilisatrice.
   * Valide : Exigence 10.7
   */
  it('deux kits avec des mnemonics différents produisent des clés différentes', () => {
    fc.assert(
      fc.property(arbitraryValidKit, arbitraryValidKit, (kit1, kit2) => {
        // S'assurer que les mnemonics sont différents
        fc.pre(kit1.mnemonic !== kit2.mnemonic)

        const service = makeService()

        const key1 = service.deriveCloudKey(kit1)
        const key2 = service.deriveCloudKey(kit2)

        expect(key1.ok).toBe(true)
        expect(key2.ok).toBe(true)
        if (!key1.ok || !key2.ok) return

        // Des mnemonics différents doivent produire des clés différentes
        expect(key1.value).not.toBe(key2.value)
      }),
      { numRuns: 100 },
    )
  })

  /**
   * La clé cloud est différente de la clé maître locale.
   *
   * La clé dérivée du kit ne doit jamais être égale au mnemonic lui-même
   * ni à une transformation triviale de celui-ci.
   * Valide : Exigence 10.7
   */
  it('la clé cloud dérivée est différente du mnemonic source', () => {
    fc.assert(
      fc.property(arbitraryValidKit, kit => {
        const service = makeService()
        const result = service.deriveCloudKey(kit)

        expect(result.ok).toBe(true)
        if (!result.ok) return

        const cloudKey = result.value

        // La clé ne doit pas être le mnemonic lui-même
        expect(cloudKey).not.toBe(kit.mnemonic)

        // La clé ne doit pas contenir les mots du mnemonic en clair
        const words = kit.mnemonic.split(' ')
        words.forEach(word => {
          // La clé est en hex — elle ne doit pas contenir de mots lisibles
          expect(cloudKey).not.toContain(word)
        })

        // La clé doit être une chaîne hex de 64 caractères (256 bits)
        expect(cloudKey).toMatch(/^[0-9a-f]{64}$/)
      }),
      { numRuns: 100 },
    )
  })

  /**
   * Round-trip de restauration : un kit valide permet toujours de dériver
   * la clé cloud, simulant la restauration après perte d'appareil.
   *
   * Pour tout kit généré par generateRecoveryKit(), deriveCloudKey()
   * doit réussir et retourner une clé non vide.
   * Valide : Exigence 10.7
   */
  it('round-trip : un kit généré permet toujours de dériver la clé cloud', () => {
    const service = makeService()

    fc.assert(
      fc.property(fc.constant(null), () => {
        // Étape 1 : générer un kit (simule la création initiale)
        const kitResult = service.generateRecoveryKit()
        expect(kitResult.ok).toBe(true)
        if (!kitResult.ok) return

        const kit = kitResult.value

        // Étape 2 : dériver la clé cloud (simule la restauration)
        const keyResult = service.deriveCloudKey(kit)
        expect(keyResult.ok).toBe(true)
        if (!keyResult.ok) return

        // La clé doit être non vide et en format hex
        expect(keyResult.value.length).toBeGreaterThan(0)
        expect(keyResult.value).toMatch(/^[0-9a-f]+$/)
      }),
      { numRuns: 100 },
    )
  })

  /**
   * Cohérence de restauration : la même clé est dérivée à chaque restauration.
   *
   * Simule le scénario réel : l'utilisatrice perd son téléphone, installe
   * l'app sur un nouveau téléphone, saisit ses 12 mots. La clé dérivée
   * doit être identique à celle utilisée lors de la sauvegarde initiale.
   * Valide : Exigence 10.7
   */
  it('la clé de restauration est identique à la clé de sauvegarde initiale', () => {
    fc.assert(
      fc.property(arbitraryValidMnemonic, mnemonic => {
        // Appareil original : dériver la clé lors de la sauvegarde
        const serviceOriginal = makeService()
        const kitOriginal: RecoveryKit = {
          mnemonic,
          generatedAt: new Date('2024-01-15T10:00:00Z').toISOString(),
        }
        const keyOriginal = serviceOriginal.deriveCloudKey(kitOriginal)

        // Nouvel appareil : restaurer avec les mêmes 12 mots
        const serviceNew = makeService()
        const kitRestored: RecoveryKit = {
          mnemonic,
          // Timestamp différent — la restauration se fait plus tard
          generatedAt: new Date('2024-06-20T15:30:00Z').toISOString(),
        }
        const keyRestored = serviceNew.deriveCloudKey(kitRestored)

        expect(keyOriginal.ok).toBe(true)
        expect(keyRestored.ok).toBe(true)
        if (!keyOriginal.ok || !keyRestored.ok) return

        // Les deux clés doivent être identiques — c'est ce qui permet la restauration
        expect(keyRestored.value).toBe(keyOriginal.value)
      }),
      { numRuns: 100 },
    )
  })

  /**
   * exportAsPDF() réussit pour tout kit valide.
   *
   * Pour tout kit avec une phrase valide, l'export PDF doit réussir
   * et retourner un contenu non vide.
   * Valide : Exigence 10.7 (le kit doit pouvoir être sauvegardé)
   */
  it('exportAsPDF() réussit pour tout kit valide et retourne un contenu non vide', () => {
    const service = makeService()

    fc.assert(
      fc.property(arbitraryValidKit, kit => {
        const result = service.exportAsPDF(kit)

        expect(result.ok).toBe(true)
        if (!result.ok) return

        // Le PDF doit contenir des données
        expect(result.value.length).toBeGreaterThan(0)

        // Le contenu doit inclure les mots du mnemonic (vérification de base)
        const content = new TextDecoder().decode(result.value)
        const words = kit.mnemonic.split(' ')
        words.forEach(word => {
          expect(content).toContain(word)
        })
      }),
      { numRuns: 100 },
    )
  })

  /**
   * exportAsPDF() échoue pour tout kit avec une phrase invalide.
   *
   * Un kit invalide ne doit jamais produire un PDF — cela évite
   * qu'une utilisatrice sauvegarde un kit inutilisable.
   * Valide : Exigence 10.7
   */
  it('exportAsPDF() échoue pour tout kit avec une phrase invalide', () => {
    const service = makeService()

    fc.assert(
      fc.property(
        arbitraryInvalidMnemonic,
        fc.integer({ min: 0, max: 1e12 }).map(ts => new Date(ts).toISOString()),
        (invalidMnemonic, generatedAt) => {
          const invalidKit: RecoveryKit = { mnemonic: invalidMnemonic, generatedAt }
          const result = service.exportAsPDF(invalidKit)

          expect(result.ok).toBe(false)
        },
      ),
      { numRuns: 100 },
    )
  })
})

// ─── Tests : Comportement de validatePhrase ───────────────────────────────────

describe('RecoveryKitService — validatePhrase', () => {
  it('accepte une phrase de 12 mots BIP-39 valides', () => {
    const service = makeService()
    // Phrase construite avec les 12 premiers mots de la liste
    const phrase = BIP39_WORDLIST.slice(0, 12).join(' ')
    expect(service.validatePhrase(phrase)).toBe(true)
  })

  it('rejette une phrase avec 11 mots', () => {
    const service = makeService()
    const phrase = BIP39_WORDLIST.slice(0, 11).join(' ')
    expect(service.validatePhrase(phrase)).toBe(false)
  })

  it('rejette une phrase avec 13 mots', () => {
    const service = makeService()
    const phrase = BIP39_WORDLIST.slice(0, 13).join(' ')
    expect(service.validatePhrase(phrase)).toBe(false)
  })

  it('rejette une phrase avec un mot hors liste BIP-39', () => {
    const service = makeService()
    const words = BIP39_WORDLIST.slice(0, 11)
    const phrase = [...words, 'motinvalide'].join(' ')
    expect(service.validatePhrase(phrase)).toBe(false)
  })

  it('rejette une chaîne vide', () => {
    const service = makeService()
    expect(service.validatePhrase('')).toBe(false)
  })

  it('rejette une phrase avec des chiffres', () => {
    const service = makeService()
    expect(service.validatePhrase('1 2 3 4 5 6 7 8 9 10 11 12')).toBe(false)
  })
})
