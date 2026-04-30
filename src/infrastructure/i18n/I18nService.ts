/**
 * I18nService — Internationalisation (français / anglais).
 *
 * Architecture :
 * - `II18nService`          : interface pure (domaine/application)
 * - `I18nService`           : implémentation concrète (chargement JSON statique)
 * - `InMemoryI18nService`   : implémentation de test (traductions injectées)
 *
 * Principes :
 * - Les libellés UI sont chargés depuis fr.json / en.json
 * - Les conseils de bien-être sont chargés depuis wellness/fr.json / wellness/en.json
 * - Les contenus médicaux (wellness) sont TOUJOURS rédigés manuellement — jamais
 *   de traduction automatique pour garantir la précision médicale
 * - La langue est détectée automatiquement au premier lancement via
 *   react-native-localize, puis persistée dans user_preferences
 * - Le changement de langue est immédiat, sans redémarrage de l'application
 *
 * Exigences : 15.1, 15.2, 15.3, 15.4, 15.5, 15.6
 */

import type { SupportedLanguage } from '../../domain/shared/types'
import type { TrackingMode } from '../db/CycleRepository'

// ─── Types du domaine wellness ────────────────────────────────────────────────

export type CyclePhase = 'menstrual' | 'follicular' | 'ovulation' | 'luteal'
export type AdviceCategory = 'nutrition' | 'exercise' | 'self_care' | 'medical'

/**
 * Un conseil de bien-être associé à une phase du cycle.
 * `modes` est null si le conseil s'applique à tous les modes de suivi.
 */
export interface PhaseAdvice {
  id: string
  category: AdviceCategory
  title: string
  content: string
  modes: TrackingMode[] | null
}

/**
 * Catalogue complet des conseils de bien-être, indexé par phase.
 */
export interface WellnessContent {
  phases: Record<CyclePhase, PhaseAdvice[]>
}

// ─── Interface publique ───────────────────────────────────────────────────────

/**
 * Interface du service d'internationalisation.
 * Implémentée par I18nService (prod) et InMemoryI18nService (test).
 */
export interface II18nService {
  /**
   * Initialise le service avec la langue fournie (détectée ou sauvegardée).
   * Doit être appelé une fois au démarrage, avant tout appel à `t()`.
   */
  initialize(languageCode: SupportedLanguage): void

  /**
   * Retourne la langue actuellement active.
   */
  getCurrentLanguage(): SupportedLanguage

  /**
   * Change la langue active immédiatement.
   * La persistance dans user_preferences est gérée par l'appelant
   * (RecordPeriodUseCase ou SettingsUseCase) via CycleRepository.savePreferences().
   */
  setLanguage(languageCode: SupportedLanguage): void

  /**
   * Traduit une clé UI dans la langue active.
   * Supporte les clés imbriquées avec la notation pointée : "calendar.title".
   * Retourne la clé elle-même si la traduction est introuvable.
   */
  t(key: string): string

  /**
   * Charge le catalogue de conseils de bien-être dans la langue active.
   * Les contenus sont rédigés manuellement — jamais de traduction automatique.
   */
  loadWellnessContent(): WellnessContent

  /**
   * Détecte la langue du système via react-native-localize.
   * Retourne 'fr' si la langue système est supportée, 'fr' par défaut sinon.
   * Utilisé uniquement au premier lancement de l'application.
   */
  detectSystemLanguage(): SupportedLanguage
}

// ─── Langues supportées ───────────────────────────────────────────────────────

const SUPPORTED_LANGUAGES: SupportedLanguage[] = ['fr', 'en']
const DEFAULT_LANGUAGE: SupportedLanguage = 'fr'

// ─── Implémentation principale ────────────────────────────────────────────────

/**
 * Implémentation concrète de II18nService.
 *
 * Charge les traductions depuis les fichiers JSON statiques bundlés avec
 * l'application. Les fichiers wellness/ contiennent des contenus médicaux
 * rédigés manuellement par des professionnels de santé.
 *
 * Détection de la langue système :
 *   - Utilise `react-native-localize` si disponible (appareil physique / émulateur)
 *   - Fallback sur 'fr' si le module natif n'est pas disponible (tests Jest)
 */
export class I18nService implements II18nService {
  private currentLanguage: SupportedLanguage = DEFAULT_LANGUAGE
  private translations: Record<string, unknown> = {}
  private wellnessCache: WellnessContent | null = null

  // Traductions UI chargées statiquement (bundlées avec l'app)
  private static readonly UI_TRANSLATIONS: Record<SupportedLanguage, Record<string, unknown>> = {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    fr: require('./fr.json') as Record<string, unknown>,
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    en: require('./en.json') as Record<string, unknown>,
  }

  // Contenus wellness chargés statiquement (bundlés avec l'app)
  private static readonly WELLNESS_TRANSLATIONS: Record<SupportedLanguage, WellnessContent> = {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    fr: require('./wellness/fr.json') as WellnessContent,
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    en: require('./wellness/en.json') as WellnessContent,
  }

  initialize(languageCode: SupportedLanguage): void {
    this.currentLanguage = this._validateLanguage(languageCode)
    this.translations = I18nService.UI_TRANSLATIONS[this.currentLanguage]
    // Invalider le cache wellness lors du changement de langue
    this.wellnessCache = null
  }

  getCurrentLanguage(): SupportedLanguage {
    return this.currentLanguage
  }

  setLanguage(languageCode: SupportedLanguage): void {
    const validated = this._validateLanguage(languageCode)
    if (validated === this.currentLanguage) return

    this.currentLanguage = validated
    this.translations = I18nService.UI_TRANSLATIONS[this.currentLanguage]
    // Invalider le cache wellness lors du changement de langue
    this.wellnessCache = null
  }

  t(key: string): string {
    const value = this._resolveKey(this.translations, key)
    if (typeof value === 'string') return value

    // Fallback sur le français si la clé est absente dans la langue active
    if (this.currentLanguage !== DEFAULT_LANGUAGE) {
      const fallback = this._resolveKey(
        I18nService.UI_TRANSLATIONS[DEFAULT_LANGUAGE],
        key,
      )
      if (typeof fallback === 'string') return fallback
    }

    // Retourner la clé elle-même si introuvable (évite les crashes UI)
    return key
  }

  loadWellnessContent(): WellnessContent {
    if (this.wellnessCache) return this.wellnessCache
    this.wellnessCache = I18nService.WELLNESS_TRANSLATIONS[this.currentLanguage]
    return this.wellnessCache
  }

  detectSystemLanguage(): SupportedLanguage {
    try {
      // react-native-localize n'est pas dans les dépendances installées —
      // on utilise un require dynamique avec fallback pour éviter les crashes
      // en environnement de test (Jest) ou si le module n'est pas lié.
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const RNLocalize = require('react-native-localize') as {
        getLocales: () => Array<{ languageCode: string }>
      }
      const locales = RNLocalize.getLocales()
      for (const locale of locales) {
        const lang = locale.languageCode.toLowerCase().split('-')[0]
        if (this._isSupportedLanguage(lang)) {
          return lang as SupportedLanguage
        }
      }
    } catch {
      // Module natif non disponible (tests Jest, environnement web)
      // Retourner la langue par défaut silencieusement
    }
    return DEFAULT_LANGUAGE
  }

  // ── Helpers privés ──────────────────────────────────────────────────────────

  /**
   * Résout une clé imbriquée avec la notation pointée.
   * Ex : "calendar.phases.menstrual" → translations.calendar.phases.menstrual
   */
  private _resolveKey(obj: Record<string, unknown>, key: string): unknown {
    const parts = key.split('.')
    let current: unknown = obj
    for (const part of parts) {
      if (current === null || typeof current !== 'object') return undefined
      current = (current as Record<string, unknown>)[part]
    }
    return current
  }

  /**
   * Valide et normalise un code de langue.
   * Retourne DEFAULT_LANGUAGE si le code n'est pas supporté.
   */
  private _validateLanguage(code: SupportedLanguage): SupportedLanguage {
    return this._isSupportedLanguage(code) ? code : DEFAULT_LANGUAGE
  }

  private _isSupportedLanguage(code: string): code is SupportedLanguage {
    return (SUPPORTED_LANGUAGES as string[]).includes(code)
  }
}

// ─── Implémentation de test (InMemory) ───────────────────────────────────────

/**
 * Implémentation de test de II18nService.
 *
 * Accepte des traductions et un contenu wellness injectés directement,
 * sans dépendance aux fichiers JSON ou à react-native-localize.
 * Utilisée dans les tests unitaires de WellnessAdvisor et des Use Cases.
 */
export class InMemoryI18nService implements II18nService {
  private currentLanguage: SupportedLanguage = DEFAULT_LANGUAGE
  private translations: Record<string, unknown>
  private wellnessContent: WellnessContent

  constructor(
    translations: Record<string, unknown> = {},
    wellnessContent: WellnessContent = { phases: createEmptyWellnessPhases() },
    initialLanguage: SupportedLanguage = DEFAULT_LANGUAGE,
  ) {
    this.translations = translations
    this.wellnessContent = wellnessContent
    this.currentLanguage = initialLanguage
  }

  initialize(languageCode: SupportedLanguage): void {
    this.currentLanguage = languageCode
  }

  getCurrentLanguage(): SupportedLanguage {
    return this.currentLanguage
  }

  setLanguage(languageCode: SupportedLanguage): void {
    this.currentLanguage = languageCode
  }

  t(key: string): string {
    const parts = key.split('.')
    let current: unknown = this.translations
    for (const part of parts) {
      if (current === null || typeof current !== 'object') return key
      current = (current as Record<string, unknown>)[part]
    }
    return typeof current === 'string' ? current : key
  }

  loadWellnessContent(): WellnessContent {
    return this.wellnessContent
  }

  detectSystemLanguage(): SupportedLanguage {
    return DEFAULT_LANGUAGE
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Crée un objet WellnessContent vide avec toutes les phases initialisées.
 * Utilisé comme valeur par défaut dans InMemoryI18nService.
 */
function createEmptyWellnessPhases(): Record<CyclePhase, PhaseAdvice[]> {
  return {
    menstrual: [],
    follicular: [],
    ovulation: [],
    luteal: [],
  }
}

/**
 * Singleton de l'I18nService pour l'application.
 * Initialisé au démarrage de l'app avec la langue détectée ou sauvegardée.
 */
export const i18nService = new I18nService()
