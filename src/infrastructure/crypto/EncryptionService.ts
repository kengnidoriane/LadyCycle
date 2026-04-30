/**
 * EncryptionService — chiffrement AES-256 via SQLCipher.
 *
 * Architecture :
 * - `IEncryptionService`      : interface pure (domaine/application)
 * - `IKeyStore`               : abstraction du Keystore/Keychain natif
 * - `NativeEncryptionService` : implémentation production (SQLCipher + Keystore)
 * - `InMemoryEncryptionService`: implémentation de test (AES simulé, sans natif)
 *
 * Règle de sécurité : la clé maître ne quitte JAMAIS le Keystore/Keychain.
 * Elle est récupérée, utilisée pour dériver la clé SQLCipher, puis effacée
 * de la mémoire vive.
 *
 * Exigences : 10.1, 10.2
 */

import { type Result, ok, err } from '../../domain/shared/types'
import {
  type EncryptionError,
  ErrorCode,
  createError,
} from '../../domain/shared/errors'

// ─── Interface publique ───────────────────────────────────────────────────────

/**
 * Interface du service de chiffrement.
 * Implémentée par NativeEncryptionService (prod) et InMemoryEncryptionService (test).
 */
export interface IEncryptionService {
  /**
   * Initialise le service avec la clé maître stockée dans le Keystore/Keychain.
   * Doit être appelé une fois au démarrage de l'application.
   * La clé maître est récupérée depuis le stockage sécurisé natif — elle n'est
   * jamais passée en paramètre depuis l'extérieur.
   */
  initialize(): Promise<Result<void, EncryptionError>>

  /**
   * Chiffre une chaîne de caractères (données sérialisées en JSON).
   * Retourne une chaîne base64 contenant IV + données chiffrées.
   */
  encrypt(data: string): Result<string, EncryptionError>

  /**
   * Déchiffre une chaîne précédemment chiffrée par encrypt().
   */
  decrypt(encryptedData: string): Result<string, EncryptionError>

  /**
   * Indique si le service a été initialisé avec succès.
   */
  isInitialized(): boolean
}

/**
 * Abstraction du stockage sécurisé natif (Keystore Android / Keychain iOS).
 * Permet d'injecter un faux stockage dans les tests.
 */
export interface IKeyStore {
  /**
   * Récupère la clé maître depuis le stockage sécurisé.
   * Génère et stocke une nouvelle clé si elle n'existe pas encore.
   */
  getMasterKey(): Promise<string>

  /**
   * Stocke la clé maître dans le stockage sécurisé.
   */
  setMasterKey(key: string): Promise<void>
}

// ─── Constantes ───────────────────────────────────────────────────────────────

/** Séparateur entre IV et ciphertext dans la chaîne chiffrée */
const SEPARATOR = ':'

/** Longueur de l'IV en bytes (96 bits recommandé pour AES-GCM) */
const IV_LENGTH = 12

// ─── Implémentation de test (InMemory) ───────────────────────────────────────

/**
 * Implémentation de test de IKeyStore.
 * Stocke la clé en mémoire — jamais utilisée en production.
 */
export class InMemoryKeyStore implements IKeyStore {
  private key: string

  constructor(masterKey: string = 'test-master-key-32-bytes-padding!') {
    this.key = masterKey
  }

  async getMasterKey(): Promise<string> {
    return this.key
  }

  async setMasterKey(key: string): Promise<void> {
    this.key = key
  }
}

/**
 * Implémentation de test de IEncryptionService.
 *
 * Utilise un XOR déterministe avec la clé pour simuler le chiffrement.
 * IMPORTANT : cette implémentation est UNIQUEMENT pour les tests unitaires.
 * Elle garantit les mêmes invariants que AES-256 :
 *   - encrypt(data) !== data (les données chiffrées diffèrent du plaintext)
 *   - decrypt(encrypt(data)) === data (round-trip)
 *   - encrypt(data, key1) !== encrypt(data, key2) si key1 !== key2
 *
 * En production, NativeEncryptionService utilise SQLCipher AES-256.
 */
export class InMemoryEncryptionService implements IEncryptionService {
  private initialized = false
  private masterKey: string = ''

  constructor(private readonly keyStore: IKeyStore = new InMemoryKeyStore()) {}

  async initialize(): Promise<Result<void, EncryptionError>> {
    try {
      this.masterKey = await this.keyStore.getMasterKey()
      this.initialized = true
      return ok(undefined)
    } catch (e) {
      return err(
        createError(
          ErrorCode.ENCRYPTION_NOT_INITIALIZED,
          'Échec de l\'initialisation du service de chiffrement',
          e,
        ) as EncryptionError,
      )
    }
  }

  encrypt(data: string): Result<string, EncryptionError> {
    if (!this.initialized) {
      return err(
        createError(
          ErrorCode.ENCRYPTION_NOT_INITIALIZED,
          'EncryptionService non initialisé — appelez initialize() d\'abord',
        ) as EncryptionError,
      )
    }

    try {
      // Générer un IV pseudo-aléatoire (IV_LENGTH bytes, encodé en hex)
      const iv = generatePseudoRandomIV(IV_LENGTH)
      // Dériver les bytes-clé à partir de la clé maître et de l'IV
      const keyBytes = deriveKeyBytes(this.masterKey, iv, 32)
      // Chiffrer : XOR byte-à-byte sur les bytes UTF-8 du plaintext
      const ciphertext = xorEncryptBytes(data, keyBytes)
      // Format : iv:ciphertext (tous deux en hex)
      const encrypted = `${iv}${SEPARATOR}${ciphertext}`
      return ok(encrypted)
    } catch (e) {
      return err(
        createError(
          ErrorCode.ENCRYPTION_FAILED,
          'Échec du chiffrement',
          e,
        ) as EncryptionError,
      )
    }
  }

  decrypt(encryptedData: string): Result<string, EncryptionError> {
    if (!this.initialized) {
      return err(
        createError(
          ErrorCode.ENCRYPTION_NOT_INITIALIZED,
          'EncryptionService non initialisé — appelez initialize() d\'abord',
        ) as EncryptionError,
      )
    }

    try {
      const separatorIndex = encryptedData.indexOf(SEPARATOR)
      if (separatorIndex === -1) {
        return err(
          createError(
            ErrorCode.DECRYPTION_FAILED,
            'Format de données chiffrées invalide — séparateur manquant',
          ) as EncryptionError,
        )
      }

      const iv = encryptedData.substring(0, separatorIndex)
      const ciphertext = encryptedData.substring(separatorIndex + 1)

      if (!iv || !ciphertext) {
        return err(
          createError(
            ErrorCode.DECRYPTION_FAILED,
            'Format de données chiffrées invalide — IV ou ciphertext vide',
          ) as EncryptionError,
        )
      }

      // Dériver les mêmes bytes-clé qu'à l'encryption (déterministe)
      const keyBytes = deriveKeyBytes(this.masterKey, iv, 32)
      // Déchiffrer : XOR est son propre inverse sur les bytes
      const plaintext = xorDecryptBytes(ciphertext, keyBytes)

      if (plaintext === null) {
        return err(
          createError(
            ErrorCode.DECRYPTION_FAILED,
            'Format de données chiffrées invalide — hex malformé',
          ) as EncryptionError,
        )
      }

      return ok(plaintext)
    } catch (e) {
      return err(
        createError(
          ErrorCode.DECRYPTION_FAILED,
          'Échec du déchiffrement',
          e,
        ) as EncryptionError,
      )
    }
  }

  isInitialized(): boolean {
    return this.initialized
  }
}

// ─── Implémentation production (stub) ────────────────────────────────────────

/**
 * Implémentation production de IEncryptionService.
 *
 * En production, cette classe délègue à :
 *   - `react-native-keychain` pour le Keystore/Keychain natif
 *   - `react-native-sqlcipher-storage` pour le chiffrement AES-256 de la DB
 *
 * Le chiffrement des données individuelles (encrypt/decrypt) utilise
 * l'API Web Crypto (disponible dans React Native via le polyfill) avec
 * AES-GCM 256 bits.
 *
 * NOTE : Cette classe nécessite un émulateur/appareil physique pour fonctionner.
 * Pour les tests unitaires, utiliser InMemoryEncryptionService.
 */
export class NativeEncryptionService implements IEncryptionService {
  private initialized = false

  /**
   * @param keyStore - Implémentation du stockage sécurisé natif.
   *   En production : instance de NativeKeyStore (react-native-keychain).
   *   En test d'intégration : instance de InMemoryKeyStore.
   */
  constructor(private readonly keyStore: IKeyStore) {}

  async initialize(): Promise<Result<void, EncryptionError>> {
    // En production :
    // 1. Appeler keyStore.getMasterKey() → récupère ou génère la clé depuis Keychain/Keystore
    // 2. Dériver la clé SQLCipher avec PBKDF2 (100 000 itérations, SHA-256)
    // 3. Ouvrir la base SQLCipher avec cette clé dérivée
    // 4. Effacer la clé dérivée de la mémoire vive
    //
    // Cette implémentation est un stub — le vrai code nécessite les modules natifs.
    return err(
      createError(
        ErrorCode.ENCRYPTION_NOT_INITIALIZED,
        'NativeEncryptionService nécessite un appareil physique ou un émulateur. ' +
          'Utilisez InMemoryEncryptionService pour les tests.',
      ) as EncryptionError,
    )
  }

  encrypt(_data: string): Result<string, EncryptionError> {
    if (!this.initialized) {
      return err(
        createError(
          ErrorCode.ENCRYPTION_NOT_INITIALIZED,
          'EncryptionService non initialisé',
        ) as EncryptionError,
      )
    }
    // Production : utiliser AES-GCM 256 via Web Crypto API
    return err(
      createError(
        ErrorCode.ENCRYPTION_FAILED,
        'Non implémenté — nécessite les modules natifs',
      ) as EncryptionError,
    )
  }

  decrypt(_encryptedData: string): Result<string, EncryptionError> {
    if (!this.initialized) {
      return err(
        createError(
          ErrorCode.ENCRYPTION_NOT_INITIALIZED,
          'EncryptionService non initialisé',
        ) as EncryptionError,
      )
    }
    return err(
      createError(
        ErrorCode.DECRYPTION_FAILED,
        'Non implémenté — nécessite les modules natifs',
      ) as EncryptionError,
    )
  }

  isInitialized(): boolean {
    return this.initialized
  }
}

// ─── Fonctions utilitaires internes ──────────────────────────────────────────

/**
 * Génère un IV pseudo-aléatoire de `length` bytes, encodé en hex.
 * En production, utiliser crypto.getRandomValues() (Web Crypto API).
 */
function generatePseudoRandomIV(length: number): string {
  // Utilise Math.random() uniquement pour les tests — jamais en production
  const bytes = new Array(length)
    .fill(0)
    .map(() => Math.floor(Math.random() * 256))
  return bytes.map(b => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Dérive un tableau de bytes-clé à partir de la clé maître et de l'IV.
 * Simule PBKDF2 pour les tests — en production, utiliser la vraie PBKDF2.
 *
 * Retourne un tableau de bytes (0-255) de longueur `length`.
 */
function deriveKeyBytes(masterKey: string, iv: string, length: number): number[] {
  // Mélange masterKey + iv pour produire des bytes pseudo-aléatoires
  const combined = masterKey + iv
  const keyBytes: number[] = []
  for (let i = 0; i < length; i++) {
    // Hachage simple mais déterministe : combine position, masterKey et IV
    const a = combined.charCodeAt(i % combined.length)
    const b = combined.charCodeAt((i * 7 + 3) % combined.length)
    const c = combined.charCodeAt((i * 13 + 5) % combined.length)
    keyBytes.push((a ^ b ^ c ^ (i * 31)) & 0xff)
  }
  return keyBytes
}

/**
 * Encode un tableau de bytes en chaîne hexadécimale.
 */
function bytesToHex(bytes: number[]): string {
  return bytes.map(b => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Décode une chaîne hexadécimale en tableau de bytes.
 * Retourne null si la chaîne n'est pas un hex valide.
 */
function hexToBytes(hex: string): number[] | null {
  if (hex.length % 2 !== 0) return null
  const bytes: number[] = []
  for (let i = 0; i < hex.length; i += 2) {
    const byte = parseInt(hex.substring(i, i + 2), 16)
    if (isNaN(byte)) return null
    bytes.push(byte)
  }
  return bytes
}

/**
 * Encode une chaîne UTF-8 en tableau de bytes.
 * Gère les caractères multi-bytes (Unicode).
 */
function stringToBytes(str: string): number[] {
  const bytes: number[] = []
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i)
    if (code < 0x80) {
      bytes.push(code)
    } else if (code < 0x800) {
      bytes.push(0xc0 | (code >> 6))
      bytes.push(0x80 | (code & 0x3f))
    } else {
      bytes.push(0xe0 | (code >> 12))
      bytes.push(0x80 | ((code >> 6) & 0x3f))
      bytes.push(0x80 | (code & 0x3f))
    }
  }
  return bytes
}

/**
 * Décode un tableau de bytes UTF-8 en chaîne.
 */
function bytesToString(bytes: number[]): string {
  let str = ''
  let i = 0
  while (i < bytes.length) {
    const byte = bytes[i]
    if (byte < 0x80) {
      str += String.fromCharCode(byte)
      i++
    } else if ((byte & 0xe0) === 0xc0) {
      const code = ((byte & 0x1f) << 6) | (bytes[i + 1] & 0x3f)
      str += String.fromCharCode(code)
      i += 2
    } else {
      const code =
        ((byte & 0x0f) << 12) |
        ((bytes[i + 1] & 0x3f) << 6) |
        (bytes[i + 2] & 0x3f)
      str += String.fromCharCode(code)
      i += 3
    }
  }
  return str
}

/**
 * Chiffrement XOR opérant sur les bytes bruts du plaintext.
 *
 * Processus :
 *   1. Convertir le plaintext en bytes UTF-8
 *   2. XOR chaque byte avec le byte-clé correspondant (cyclique)
 *   3. Encoder le résultat en hex
 *
 * Propriétés garanties :
 *   - xorEncryptBytes(xorEncryptBytes(data, key), key) === data  (round-trip)
 *   - Le résultat hex ne contient jamais le plaintext original
 *   - Des clés différentes produisent des résultats différents
 */
function xorEncryptBytes(input: string, keyBytes: number[]): string {
  if (keyBytes.length === 0) {
    throw new Error('La clé de chiffrement ne peut pas être vide')
  }

  const inputBytes = stringToBytes(input)
  const outputBytes = inputBytes.map(
    (byte, i) => byte ^ keyBytes[i % keyBytes.length],
  )
  return bytesToHex(outputBytes)
}

/**
 * Déchiffrement XOR : inverse de xorEncryptBytes.
 * Retourne null si le hex est invalide.
 */
function xorDecryptBytes(hexCiphertext: string, keyBytes: number[]): string | null {
  if (keyBytes.length === 0) {
    throw new Error('La clé de chiffrement ne peut pas être vide')
  }

  const ciphertextBytes = hexToBytes(hexCiphertext)
  if (ciphertextBytes === null) return null

  const plaintextBytes = ciphertextBytes.map(
    (byte, i) => byte ^ keyBytes[i % keyBytes.length],
  )
  return bytesToString(plaintextBytes)
}
