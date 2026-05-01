import type { CalendarDate, Result, Option } from '../shared/types'
import type { ValidationError } from '../shared/errors'
import { createError, ErrorCode } from '../shared/errors'
import type { Symptom, SymptomType, SymptomTrend } from './types'
import { SYMPTOM_TYPE_TO_CATEGORY } from './types'
import type { CyclePhase } from '../cycle/types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Génère un identifiant unique UUID v4.
 * Implémentation simple pour le domaine pur (0 dépendances externes).
 * En production, remplacer par crypto.randomUUID() si disponible.
 */
function generateId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

/**
 * SymptomTracker — Gestionnaire du suivi des symptômes.
 *
 * Composant de domaine pur (0 dépendances externes).
 *
 * Responsabilités :
 * - Enregistrer les symptômes quotidiens avec validation conditionnelle de l'intensité
 * - Associer les symptômes aux cycles
 * - Fournir des analyses de tendances
 *
 * Règle de validation :
 * - Pour category === 'pain' : intensity DOIT être dans [1-5]
 * - Pour category !== 'pain' : intensity DOIT être undefined ou null
 */
export class SymptomTracker {
  private symptoms: Map<string, Symptom> = new Map()
  private symptomsByCycle: Map<string, Set<string>> = new Map()
  private symptomsByDate: Map<CalendarDate, Set<string>> = new Map()

  /**
   * Enregistre un nouveau symptôme.
   *
   * Validation :
   * - Si category === 'pain', intensity doit être dans [1-5]
   * - Si category !== 'pain', intensity doit être undefined ou null
   *
   * @param date - Date du symptôme (YYYY-MM-DD)
   * @param symptomData - Données du symptôme (type, intensity, notes)
   * @param cycleId - Identifiant du cycle associé (optionnel)
   * @returns Result<Symptom, ValidationError>
   */
  recordSymptom(
    date: CalendarDate,
    symptomData: {
      type: SymptomType
      intensity?: number
      notes?: string
    },
    cycleId?: string,
  ): Result<Symptom, ValidationError> {
    const { type, intensity, notes } = symptomData

    // Déterminer la catégorie depuis le type
    const category = SYMPTOM_TYPE_TO_CATEGORY[type]

    // Validation conditionnelle de l'intensité
    if (category === 'pain') {
      // Pour les douleurs, l'intensité est OBLIGATOIRE et doit être dans [1-5]
      if (intensity === undefined || intensity === null) {
        return {
          ok: false,
          error: createError(
            ErrorCode.INVALID_SYMPTOM_INTENSITY,
            'Intensity is required for pain symptoms',
            { type, category, intensity },
          ) as ValidationError,
        }
      }

      if (intensity < 1 || intensity > 5) {
        return {
          ok: false,
          error: createError(
            ErrorCode.INVALID_SYMPTOM_INTENSITY,
            `Intensity must be between 1 and 5 for pain symptoms, got ${intensity}`,
            { type, category, intensity },
          ) as ValidationError,
        }
      }
    } else {
      // Pour les autres catégories, l'intensité doit être absente
      if (intensity !== undefined && intensity !== null) {
        return {
          ok: false,
          error: createError(
            ErrorCode.INVALID_SYMPTOM_INTENSITY,
            `Intensity must not be provided for ${category} symptoms`,
            { type, category, intensity },
          ) as ValidationError,
        }
      }
    }

    // Créer le symptôme
    const symptom: Symptom = {
      id: generateId(),
      date,
      type,
      category,
      intensity: intensity ?? null,
      notes: notes ?? null,
      createdAt: new Date().toISOString(),
    }

    // Stocker le symptôme
    this.symptoms.set(symptom.id, symptom)

    // Indexer par date
    if (!this.symptomsByDate.has(date)) {
      this.symptomsByDate.set(date, new Set())
    }
    this.symptomsByDate.get(date)!.add(symptom.id)

    // Indexer par cycle si fourni
    if (cycleId) {
      if (!this.symptomsByCycle.has(cycleId)) {
        this.symptomsByCycle.set(cycleId, new Set())
      }
      this.symptomsByCycle.get(cycleId)!.add(symptom.id)
    }

    return { ok: true, value: symptom }
  }

  /**
   * Récupère tous les symptômes pour une date donnée.
   *
   * @param date - Date au format YYYY-MM-DD
   * @returns Tableau de symptômes (vide si aucun)
   */
  getSymptomsForDate(date: CalendarDate): Symptom[] {
    const symptomIds = this.symptomsByDate.get(date)
    if (!symptomIds) return []

    return Array.from(symptomIds)
      .map(id => this.symptoms.get(id))
      .filter((s): s is Symptom => s !== undefined)
  }

  /**
   * Récupère tous les symptômes pour un cycle donné.
   *
   * @param cycleId - Identifiant du cycle
   * @returns Tableau de symptômes (vide si aucun)
   */
  getSymptomsForCycle(cycleId: string): Symptom[] {
    const symptomIds = this.symptomsByCycle.get(cycleId)
    if (!symptomIds) return []

    return Array.from(symptomIds)
      .map(id => this.symptoms.get(id))
      .filter((s): s is Symptom => s !== undefined)
  }

  /**
   * Analyse les tendances d'un symptôme sur plusieurs cycles.
   *
   * Note : Cette implémentation est simplifiée pour le MVP.
   * Une version complète nécessiterait l'accès aux données de cycles
   * pour déterminer les phases (menstrual, follicular, ovulation, luteal).
   *
   * @param symptomType - Type de symptôme à analyser
   * @param cycleCount - Nombre de cycles à analyser
   * @returns Tendances du symptôme
   */
  analyzeSymptomTrends(
    symptomType: SymptomType,
    cycleCount: number,
  ): SymptomTrend {
    // Filtrer les symptômes du type demandé
    const relevantSymptoms = Array.from(this.symptoms.values()).filter(
      s => s.type === symptomType,
    )

    // Calculer l'intensité moyenne (pour les douleurs uniquement)
    const symptomsWithIntensity = relevantSymptoms.filter(
      s => s.intensity !== null,
    )
    const averageIntensity =
      symptomsWithIntensity.length > 0
        ? symptomsWithIntensity.reduce((sum, s) => sum + (s.intensity ?? 0), 0) /
          symptomsWithIntensity.length
        : 0

    // Pour le MVP, retourner une structure simplifiée
    // Une implémentation complète nécessiterait l'intégration avec CycleManager
    // pour déterminer les phases communes
    return {
      symptomType,
      averageIntensity,
      commonPhases: [], // À implémenter avec l'intégration CycleManager
      frequency: 0, // À implémenter avec l'intégration CycleManager
    }
  }

  /**
   * Associe un symptôme existant à un cycle.
   * Utile pour réassocier des symptômes après modification de cycles.
   *
   * @param symptomId - Identifiant du symptôme
   * @param cycleId - Identifiant du cycle
   */
  associateSymptomToCycle(symptomId: string, cycleId: string): void {
    if (!this.symptoms.has(symptomId)) return

    if (!this.symptomsByCycle.has(cycleId)) {
      this.symptomsByCycle.set(cycleId, new Set())
    }
    this.symptomsByCycle.get(cycleId)!.add(symptomId)
  }

  /**
   * Supprime un symptôme.
   *
   * @param symptomId - Identifiant du symptôme à supprimer
   */
  deleteSymptom(symptomId: string): void {
    const symptom = this.symptoms.get(symptomId)
    if (!symptom) return

    // Retirer des index
    const dateSymptoms = this.symptomsByDate.get(symptom.date)
    if (dateSymptoms) {
      dateSymptoms.delete(symptomId)
      if (dateSymptoms.size === 0) {
        this.symptomsByDate.delete(symptom.date)
      }
    }

    // Retirer de tous les cycles
    for (const cycleSymptoms of this.symptomsByCycle.values()) {
      cycleSymptoms.delete(symptomId)
    }

    // Supprimer le symptôme
    this.symptoms.delete(symptomId)
  }

  /**
   * Récupère tous les symptômes enregistrés.
   * Utile pour les exports et les analyses globales.
   *
   * @returns Tableau de tous les symptômes
   */
  getAllSymptoms(): Symptom[] {
    return Array.from(this.symptoms.values())
  }
}
