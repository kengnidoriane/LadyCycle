/**
 * WellnessAdvisor — Fournisseur de conseils de bien-être personnalisés.
 *
 * Architecture :
 * - Logique pure dans domain/ — pas de dépendances externes
 * - Le catalogue de conseils est injecté via le constructeur (injection de dépendance)
 * - En production : contenu chargé depuis I18nService.loadWellnessContent()
 * - En test : contenu fictif injecté directement
 *
 * Principes :
 * - Les conseils sont filtrés selon la phase du cycle
 * - Les conseils sont adaptés au mode de suivi (essai bébé, contraception, général)
 * - Les conseils sont priorisés selon les symptômes récents
 * - Pas de données statiques en dur — tout vient du catalogue injecté
 *
 * Exigences : 11.1, 11.2, 11.3, 11.4, 11.5
 */

import type { Symptom, SymptomType } from '../symptoms/types'
import type {
  Advice,
  AdviceCategory,
  AdvicePriority,
  CyclePhase,
  PhaseAdvice,
  TrackingMode,
  WellnessContent,
} from './types'

// ─── Interface publique ───────────────────────────────────────────────────────

/**
 * WellnessAdvisor fournit des conseils de bien-être personnalisés.
 *
 * Le catalogue de conseils est injecté via le constructeur — pas de dépendance
 * directe à I18nService pour préserver la pureté du domaine.
 */
export class WellnessAdvisor {
  private readonly content: WellnessContent

  /**
   * Crée un WellnessAdvisor avec le catalogue de conseils fourni.
   *
   * @param content - Catalogue de conseils chargé depuis I18nService.loadWellnessContent()
   */
  constructor(content: WellnessContent) {
    this.content = content
  }

  /**
   * Obtient les conseils de bien-être pour aujourd'hui.
   *
   * Filtre les conseils selon :
   * - La phase actuelle du cycle
   * - Le mode de suivi sélectionné
   * - Les symptômes récents (pour prioriser les conseils pertinents)
   *
   * @param currentPhase - Phase actuelle du cycle
   * @param mode - Mode de suivi sélectionné
   * @param recentSymptoms - Symptômes récents (derniers 7 jours)
   * @returns Liste de conseils triés par priorité (high → medium → low)
   *
   * Exigences : 11.1, 11.2, 11.3, 11.4, 11.5
   */
  getDailyAdvice(
    currentPhase: CyclePhase,
    mode: TrackingMode,
    recentSymptoms: Symptom[],
  ): Advice[] {
    // 1. Charger les conseils pour la phase actuelle
    const phaseAdvices = this.content.phases[currentPhase] || []

    // 2. Filtrer selon le mode de suivi
    const filteredAdvices = phaseAdvices.filter((advice) =>
      this._isApplicableToMode(advice, mode),
    )

    // 3. Convertir en Advice avec priorité calculée
    const advices = filteredAdvices.map((phaseAdvice) =>
      this._toAdvice(phaseAdvice, currentPhase, recentSymptoms),
    )

    // 4. Trier par priorité (high → medium → low)
    return advices.sort((a, b) => this._comparePriority(a.priority, b.priority))
  }

  /**
   * Obtient des conseils spécifiques à un symptôme.
   *
   * Retourne les conseils de la catégorie 'medical' ou 'self_care' qui
   * correspondent au type de symptôme fourni.
   *
   * @param symptomType - Type de symptôme (ex: 'cramps', 'headache')
   * @returns Liste de conseils applicables au symptôme
   *
   * Exigence : 11.1
   */
  getSymptomAdvice(symptomType: SymptomType): Advice[] {
    const allAdvices: Advice[] = []

    // Parcourir toutes les phases pour trouver les conseils pertinents
    for (const phase of Object.keys(this.content.phases) as CyclePhase[]) {
      const phaseAdvices = this.content.phases[phase] || []

      for (const phaseAdvice of phaseAdvices) {
        // Filtrer les conseils médicaux ou de self-care
        if (
          phaseAdvice.category === 'medical' ||
          phaseAdvice.category === 'self_care'
        ) {
          // Vérifier si le conseil mentionne le symptôme dans son contenu
          if (this._isRelevantToSymptom(phaseAdvice, symptomType)) {
            allAdvices.push(
              this._toAdvice(phaseAdvice, phase, [], 'high'), // Priorité haute pour les conseils symptômes
            )
          }
        }
      }
    }

    return allAdvices
  }

  // ── Helpers privés ──────────────────────────────────────────────────────────

  /**
   * Vérifie si un conseil est applicable au mode de suivi.
   *
   * - Si advice.modes === null → applicable à tous les modes
   * - Sinon → applicable uniquement si le mode est dans la liste
   */
  private _isApplicableToMode(advice: PhaseAdvice, mode: TrackingMode): boolean {
    if (advice.modes === null) return true
    return advice.modes.includes(mode)
  }

  /**
   * Convertit un PhaseAdvice en Advice avec priorité calculée.
   *
   * La priorité est déterminée par :
   * - Les symptômes récents (si le conseil est pertinent pour un symptôme → high)
   * - La catégorie du conseil (medical → high, nutrition/exercise → medium, self_care → low)
   */
  private _toAdvice(
    phaseAdvice: PhaseAdvice,
    phase: CyclePhase,
    recentSymptoms: Symptom[] = [],
    forcePriority?: AdvicePriority,
  ): Advice {
    const priority =
      forcePriority || this._calculatePriority(phaseAdvice, recentSymptoms)

    return {
      id: phaseAdvice.id,
      category: phaseAdvice.category,
      title: phaseAdvice.title,
      content: phaseAdvice.content,
      phase,
      priority,
    }
  }

  /**
   * Calcule la priorité d'un conseil selon les symptômes récents.
   *
   * Règles :
   * - Si le conseil est pertinent pour un symptôme récent → high
   * - Si category === 'medical' → high
   * - Si category === 'nutrition' ou 'exercise' → medium
   * - Si category === 'self_care' → low
   */
  private _calculatePriority(
    advice: PhaseAdvice,
    recentSymptoms: Symptom[],
  ): AdvicePriority {
    // Vérifier si le conseil est pertinent pour un symptôme récent
    for (const symptom of recentSymptoms) {
      if (this._isRelevantToSymptom(advice, symptom.type)) {
        return 'high'
      }
    }

    // Priorité par catégorie
    switch (advice.category) {
      case 'medical':
        return 'high'
      case 'nutrition':
      case 'exercise':
        return 'medium'
      case 'self_care':
        return 'low'
      default:
        return 'medium'
    }
  }

  /**
   * Vérifie si un conseil est pertinent pour un symptôme.
   *
   * Heuristique simple : cherche le type de symptôme dans l'ID ou le contenu du conseil.
   * Ex: un conseil avec id "menstrual_cramps_relief" est pertinent pour 'cramps'
   */
  private _isRelevantToSymptom(
    advice: PhaseAdvice,
    symptomType: SymptomType,
  ): boolean {
    const searchText = `${advice.id} ${advice.title} ${advice.content}`.toLowerCase()
    const symptomKeyword = symptomType.toLowerCase().replace('_', ' ')
    return searchText.includes(symptomKeyword)
  }

  /**
   * Compare deux priorités pour le tri.
   * Ordre : high > medium > low
   */
  private _comparePriority(a: AdvicePriority, b: AdvicePriority): number {
    const order: Record<AdvicePriority, number> = { high: 0, medium: 1, low: 2 }
    return order[a] - order[b]
  }
}
