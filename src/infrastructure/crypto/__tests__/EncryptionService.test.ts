/**
 * Tests property-based pour EncryptionService.
 *
 * Feature: suivi-cycle-menstruel
 * Property 25: Chiffrement des données stockées
 *
 * Valide : Exigence 10.1
 *
 * Ces tests vérifient les invariants fondamentaux du service de chiffrement :
 *   - Les données chiffrées ne contiennent jamais le plaintext en clair
 *   - Le round-trip encrypt → decrypt restaure exactement les données originales
 *   - Des clés différentes produisent des chiffrements différents
 *   - Des IVs différents produisent des chiffrements différents (même données, même clé)
 *   - Le service refuse d'opérer s'il n'est pas initialisé
 *
 * Outil : fast-check (minimum 100 itérations par propriété)
 */

import * as fc from 'fast-check'
import {
  InMemoryEncryptionService,
  InMemoryKeyStore,
} from '../EncryptionService'

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Crée un service initialisé avec la clé fournie.
 */
async function makeInitializedService(
  masterKey: string = 'test-master-key-32-bytes-padding!',
): Promise<InMemoryEncryptionService> {
  const keyStore = new InMemoryKeyStore(masterKey)
  const service = new InMemoryEncryptionService(keyStore)
  const result = await service.initialize()
  if (!result.ok) {
    throw new Error(`Échec de l'initialisation : ${result.error.message}`)
  }
  return service
}

// ─── Arbitraires ─────────────────────────────────────────────────────────────

/**
 * Génère des données sérialisées représentatives (JSON de cycle, symptôme, etc.)
 * Couvre les cas : chaînes courtes, longues, avec caractères spéciaux, JSON.
 */
const arbitrarySerializedData = fc.oneof(
  // Chaîne simple
  fc.string({ minLength: 1, maxLength: 500 }),
  // JSON de cycle (cas d'usage principal)
  fc.record({
    id: fc.uuid(),
    startDate: fc.constant('2024-01-15'),
    duration: fc.integer({ min: 21, max: 35 }),
    isExceptional: fc.boolean(),
  }).map(obj => JSON.stringify(obj)),
  // JSON de symptôme
  fc.record({
    id: fc.uuid(),
    date: fc.constant('2024-01-15'),
    type: fc.constantFrom('cramps', 'headache', 'fatigue', 'bloating'),
    category: fc.constantFrom('pain', 'mood', 'energy', 'physical', 'sleep'),
    intensity: fc.option(fc.integer({ min: 1, max: 5 })),
  }).map(obj => JSON.stringify(obj)),
  // Données de préférences
  fc.record({
    trackingMode: fc.constantFrom('general', 'trying_to_conceive', 'natural_contraception'),
    languageCode: fc.constantFrom('fr', 'en'),
  }).map(obj => JSON.stringify(obj)),
)

/**
 * Génère une clé maître valide (non vide, longueur raisonnable).
 */
const arbitraryMasterKey = fc.string({ minLength: 16, maxLength: 64 })

// ─── Propriété 25 : Chiffrement des données stockées ─────────────────────────

describe('Propriété 25 : Chiffrement des données stockées', () => {
  /**
   * Invariant principal : les données chiffrées ne contiennent jamais
   * le plaintext en clair.
   *
   * Pour toutes les données sérialisées D d'au moins 4 caractères,
   * encrypt(D) ne doit pas contenir D comme sous-chaîne.
   * Valide : Exigence 10.1
   */
  it('les données chiffrées ne contiennent jamais le plaintext en clair', async () => {
    const service = await makeInitializedService()

    // On filtre les données trop courtes (< 4 chars) car pour des chaînes
    // très courtes, une coïncidence hex est possible (ex: "a" peut apparaître
    // dans n'importe quelle chaîne hex). La propriété significative est que
    // les données structurées (JSON, UUIDs, dates) ne sont jamais en clair.
    const meaningfulData = arbitrarySerializedData.filter(d => d.length >= 4)

    await fc.assert(
      fc.asyncProperty(meaningfulData, async data => {
        const result = service.encrypt(data)

        expect(result.ok).toBe(true)
        if (!result.ok) return

        const encrypted = result.value

        // Le ciphertext ne doit pas contenir le plaintext tel quel
        expect(encrypted).not.toContain(data)

        // Le ciphertext doit être différent du plaintext
        expect(encrypted).not.toBe(data)
      }),
      { numRuns: 100 },
    )
  })

  /**
   * Round-trip : decrypt(encrypt(D)) === D pour toutes les données D.
   *
   * C'est la propriété fondamentale de tout système de chiffrement :
   * les données doivent être récupérables intactes après chiffrement/déchiffrement.
   * Valide : Exigence 10.1
   */
  it('round-trip : decrypt(encrypt(data)) === data pour toutes les données', async () => {
    const service = await makeInitializedService()

    await fc.assert(
      fc.asyncProperty(arbitrarySerializedData, async data => {
        const encryptResult = service.encrypt(data)
        expect(encryptResult.ok).toBe(true)
        if (!encryptResult.ok) return

        const decryptResult = service.decrypt(encryptResult.value)
        expect(decryptResult.ok).toBe(true)
        if (!decryptResult.ok) return

        expect(decryptResult.value).toBe(data)
      }),
      { numRuns: 100 },
    )
  })

  /**
   * Isolation des clés : deux services avec des clés différentes produisent
   * des chiffrements différents pour les mêmes données.
   *
   * Garantit que compromettre une clé ne compromet pas les données chiffrées
   * avec une autre clé.
   * Valide : Exigence 10.1
   */
  it('des clés maîtres différentes produisent des chiffrements différents', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbitrarySerializedData,
        arbitraryMasterKey,
        arbitraryMasterKey,
        async (data, key1, key2) => {
          // S'assurer que les deux clés sont différentes
          fc.pre(key1 !== key2)

          const service1 = await makeInitializedService(key1)
          const service2 = await makeInitializedService(key2)

          const result1 = service1.encrypt(data)
          const result2 = service2.encrypt(data)

          expect(result1.ok).toBe(true)
          expect(result2.ok).toBe(true)
          if (!result1.ok || !result2.ok) return

          // Les chiffrements avec des clés différentes doivent être différents
          expect(result1.value).not.toBe(result2.value)
        },
      ),
      { numRuns: 100 },
    )
  })

  /**
   * Non-déterminisme : deux appels successifs à encrypt() sur les mêmes données
   * produisent des résultats différents (grâce à l'IV aléatoire).
   *
   * C'est une propriété de sécurité essentielle : si le chiffrement était
   * déterministe, un attaquant pourrait détecter que deux entrées sont identiques
   * en comparant les ciphertexts.
   * Valide : Exigence 10.1
   */
  it('deux chiffrements successifs des mêmes données produisent des résultats différents (IV aléatoire)', async () => {
    const service = await makeInitializedService()

    await fc.assert(
      fc.asyncProperty(arbitrarySerializedData, async data => {
        const result1 = service.encrypt(data)
        const result2 = service.encrypt(data)

        expect(result1.ok).toBe(true)
        expect(result2.ok).toBe(true)
        if (!result1.ok || !result2.ok) return

        // Les deux chiffrements doivent être différents (IV différent à chaque appel)
        // Note : probabilité de collision ≈ 1/2^96 — négligeable
        expect(result1.value).not.toBe(result2.value)

        // Mais les deux doivent se déchiffrer vers la même valeur
        const dec1 = service.decrypt(result1.value)
        const dec2 = service.decrypt(result2.value)
        expect(dec1.ok).toBe(true)
        expect(dec2.ok).toBe(true)
        if (!dec1.ok || !dec2.ok) return
        expect(dec1.value).toBe(data)
        expect(dec2.value).toBe(data)
      }),
      { numRuns: 100 },
    )
  })

  /**
   * Intégrité : la modification du ciphertext doit provoquer un échec
   * ou retourner des données corrompues (jamais le plaintext original).
   *
   * Note : cette propriété est vérifiée sur des données d'au moins 8 caractères
   * pour éviter les faux positifs sur des données très courtes où une altération
   * d'un seul byte peut par coïncidence produire le même résultat.
   * En production, AES-GCM garantit cette propriété cryptographiquement.
   * Valide : Exigence 10.1
   */
  it('un ciphertext altéré ne produit jamais le plaintext original (données structurées)', async () => {
    const service = await makeInitializedService()

    // Utiliser uniquement des données JSON structurées (longueur significative)
    // pour éviter les faux positifs sur des chaînes très courtes
    const structuredData = fc.record({
      id: fc.uuid(),
      startDate: fc.constant('2024-01-15'),
      duration: fc.integer({ min: 21, max: 35 }),
      isExceptional: fc.boolean(),
    }).map(obj => JSON.stringify(obj))

    await fc.assert(
      fc.asyncProperty(
        structuredData,
        fc.integer({ min: 5, max: 20 }), // position d'altération (pas le début)
        async (data, pos) => {
          const encryptResult = service.encrypt(data)
          expect(encryptResult.ok).toBe(true)
          if (!encryptResult.ok) return

          const encrypted = encryptResult.value

          // S'assurer que la position est dans la partie ciphertext (après le séparateur)
          const sepIdx = encrypted.indexOf(':')
          if (sepIdx === -1) return
          const ciphertextPart = encrypted.substring(sepIdx + 1)
          if (ciphertextPart.length < 10) return

          // Altérer un byte dans la partie ciphertext (pas l'IV)
          const altPos = sepIdx + 1 + (pos % Math.max(1, ciphertextPart.length - 2))
          const alteredChar = encrypted[altPos] === 'a' ? 'b' : 'a'
          const alteredCiphertext =
            encrypted.substring(0, altPos) +
            alteredChar +
            encrypted.substring(altPos + 1)

          const decryptResult = service.decrypt(alteredCiphertext)

          // Soit le déchiffrement échoue (hex invalide), soit il retourne des données différentes
          if (decryptResult.ok) {
            expect(decryptResult.value).not.toBe(data)
          }
          // Un échec de déchiffrement est aussi acceptable (comportement sécurisé)
        },
      ),
      { numRuns: 100 },
    )
  })

  /**
   * Données JSON de cycle : cas d'usage principal de l'application.
   *
   * Vérifie spécifiquement que les données de cycle (le type de données
   * le plus sensible de l'application) sont correctement chiffrées.
   * Valide : Exigence 10.1
   */
  it('les données de cycle JSON sont chiffrées et récupérables intactes', async () => {
    const service = await makeInitializedService()

    const cycleArb = fc.record({
      id: fc.uuid(),
      startDate: fc
        .integer({
          min: new Date('2020-01-01').getTime(),
          max: new Date('2030-12-31').getTime(),
        })
        .map(ts => new Date(ts).toISOString().split('T')[0]),
      duration: fc.integer({ min: 21, max: 35 }),
      isExceptional: fc.boolean(),
      exceptionalReason: fc.option(fc.string({ maxLength: 100 })),
    })

    await fc.assert(
      fc.asyncProperty(cycleArb, async cycle => {
        const serialized = JSON.stringify(cycle)
        const encryptResult = service.encrypt(serialized)

        expect(encryptResult.ok).toBe(true)
        if (!encryptResult.ok) return

        // Le ciphertext ne doit pas contenir les données sensibles en clair
        expect(encryptResult.value).not.toContain(cycle.id)
        expect(encryptResult.value).not.toContain(cycle.startDate)

        // Le round-trip doit restaurer exactement les données
        const decryptResult = service.decrypt(encryptResult.value)
        expect(decryptResult.ok).toBe(true)
        if (!decryptResult.ok) return

        const restored = JSON.parse(decryptResult.value)
        expect(restored).toEqual(cycle)
      }),
      { numRuns: 100 },
    )
  })
})

// ─── Tests : Comportement avant initialisation ────────────────────────────────

describe('EncryptionService — comportement avant initialisation', () => {
  /**
   * Le service doit refuser d'opérer s'il n'est pas initialisé.
   * Garantit qu'aucune donnée n'est chiffrée/déchiffrée avec une clé invalide.
   */
  it('encrypt() retourne une erreur si le service n\'est pas initialisé', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1 }), data => {
        const service = new InMemoryEncryptionService()
        // Ne pas appeler initialize()

        const result = service.encrypt(data)
        expect(result.ok).toBe(false)
        if (!result.ok) {
          expect(result.error.code).toBe('ENCRYPTION_NOT_INITIALIZED')
        }
      }),
      { numRuns: 100 },
    )
  })

  it('decrypt() retourne une erreur si le service n\'est pas initialisé', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1 }), data => {
        const service = new InMemoryEncryptionService()
        // Ne pas appeler initialize()

        const result = service.decrypt(data)
        expect(result.ok).toBe(false)
        if (!result.ok) {
          expect(result.error.code).toBe('ENCRYPTION_NOT_INITIALIZED')
        }
      }),
      { numRuns: 100 },
    )
  })

  it('isInitialized() retourne false avant initialize()', () => {
    const service = new InMemoryEncryptionService()
    expect(service.isInitialized()).toBe(false)
  })

  it('isInitialized() retourne true après initialize() réussi', async () => {
    const service = await makeInitializedService()
    expect(service.isInitialized()).toBe(true)
  })
})

// ─── Tests : Gestion des formats invalides ────────────────────────────────────

describe('EncryptionService — gestion des formats invalides', () => {
  /**
   * decrypt() doit gérer gracieusement les données mal formées.
   */
  it('decrypt() retourne une erreur pour un ciphertext sans séparateur', async () => {
    const service = await makeInitializedService()

    const invalidCiphertexts = [
      'nodivider',
      '',
      'abc',
      '12345678901234567890',
    ]

    for (const invalid of invalidCiphertexts) {
      const result = service.decrypt(invalid)
      expect(result.ok).toBe(false)
    }
  })

  it('decrypt() retourne une erreur pour un ciphertext avec IV ou ciphertext vide', async () => {
    const service = await makeInitializedService()

    // Format iv:ciphertext mais avec une partie vide
    const invalidCiphertexts = [
      ':ciphertext',  // IV vide
      'iv:',          // ciphertext vide
    ]

    for (const invalid of invalidCiphertexts) {
      const result = service.decrypt(invalid)
      expect(result.ok).toBe(false)
    }
  })
})

// ─── Tests : Isolation entre services ────────────────────────────────────────

describe('EncryptionService — isolation entre services', () => {
  /**
   * Un service ne peut pas déchiffrer les données chiffrées par un autre
   * service avec une clé différente.
   *
   * Simule le scénario où un attaquant tente de déchiffrer des données
   * avec une clé incorrecte. Testé sur des données structurées (JSON)
   * pour éviter les faux positifs sur des données très courtes.
   */
  it('un service ne peut pas déchiffrer les données d\'un autre service avec une clé différente', async () => {
    // Utiliser des données JSON structurées (longueur significative)
    // pour éviter les coïncidences XOR sur des données d'1 byte
    const structuredData = fc.record({
      id: fc.uuid(),
      startDate: fc.constant('2024-01-15'),
      duration: fc.integer({ min: 21, max: 35 }),
    }).map(obj => JSON.stringify(obj))

    await fc.assert(
      fc.asyncProperty(
        structuredData,
        async data => {
          const service1 = await makeInitializedService('clé-service-1-padding-32bytes!!')
          const service2 = await makeInitializedService('clé-service-2-padding-32bytes!!')

          const encryptResult = service1.encrypt(data)
          expect(encryptResult.ok).toBe(true)
          if (!encryptResult.ok) return

          // service2 tente de déchiffrer les données de service1
          const decryptResult = service2.decrypt(encryptResult.value)

          // Soit le déchiffrement échoue, soit il retourne des données différentes
          if (decryptResult.ok) {
            expect(decryptResult.value).not.toBe(data)
          }
          // Un échec est le comportement attendu et sécurisé
        },
      ),
      { numRuns: 100 },
    )
  })
})
