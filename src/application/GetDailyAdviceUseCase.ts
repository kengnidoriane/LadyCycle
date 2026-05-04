/**
 * GetDailyAdviceUseCase — Use Case pour obtenir les conseils de bien-être du jour.
 *
 * Orchestration :
 *   1. Déterminer la phase actuelle du cycle via CycleManager.getCurrentCycle()
 *   2. Charger les symptômes récents via SymptomTracker
 *   3. Appeler WellnessAdvisor.getDailyAdvice(phase, mode, recentSymptoms)
 *
 * Responsabilités :
 *   - Coordonner les composants domaine (CycleManager, SymptomTracker, WellnessAdvisor)
 *   - Calculer la phase actuelle du cycle à partir de la date d'aujourd'hui
 *   - Retourner les conseils adaptés à la phase, au mode et aux symptômes
 *
 * Exigences : 8.1, 8.2, 8.3, 8.4, 8.5, 11.1
 */

import type { Result, Option } from '../domain/shared/types'
import { ok, err, none } from '../domain/shared/types'
import { today, diffDays, addDays } from '../domain/shared/calendarDate'
import type { CyclePhase } from '../domain/cycle/types'
import { CycleManager } from '../domain/cycle/CycleManager'
import { SymptomTracker } from '../domain/symptoms/SymptomTracker'
import { WellnessAdvisor } from '../domain/wellness/WellnessAdvisor'
import type { Advice, TrackingMode, WellnessContent } from '../domain/wellness/types'
import type { Symptom } from '../domain/symptoms/types'
import type { ICycleRepository, Cycle } from '../infrastructure/db/CycleRepository'
import type { ValidationError } from '../domain/shared/errors'
import { ErrorCode, createError } from '../domain/shared/errors'

// ─── Types d'erreur ───────────────────────────────────────────────────────────

/**
 * Erreur unifiée pour le Use Case.
 */
export type GetDailyAdviceError = ValidationError

// ─── GetDailyAdviceUseCase ────────────────────────────────────────────────────

/**
 * Use Case pour obtenir les conseils de bien-être du jour.
 *
 * Usage typique :
 *   const useCase = new GetDailyAdviceUseCase(repository, wellnessContent)
 *   const result = await useCase.execute()
 *   if (result.ok) {
 *     console.log('Conseils du jour :', result.value)
 *   } else {
 *     console.error('Erreur :', result.error.message)
 *   }
 */
export class GetDailyAdviceUseCase {
  private repository: ICycleRepository
  private wellnessAdvisor: WellnessAdvisor

  constructor(repository: ICycleRepository, wellnessContent: WellnessContent) {
    this.repository = repository
    this.wellnessAdvisor = new WellnessAdvisor(wellnessContent)
  }

  /**
   * Exécute le Use Case : obtenir les conseils de bien-être du jour.
   *
   * Étapes :
   *   1. Charger l'historique des cycles depuis le repository
   *   2. Créer un CycleManager avec l'historique
   *   3. Obtenir le cycle en cours
   *   4. Déterminer la phase actuelle du cycle
   *   5. Charger les préférences utilisateur (mode de suivi)
   *   6. Charger les symptômes récents (derniers 7 jours)
   *   7. Appeler WellnessAdvisor.getDailyAdvice()
   *
   * @returns Result<Advice[], GetDailyAdviceError>
   */
  async execute(): Promise<Result<Advice[], GetDailyAdviceError>> {
    // Étape 1 : Charger l'historique des cycles
    const historyResult = this.repository.loadAllCycles()
    if (!historyResult.ok) {
      return err(
        createError(
          ErrorCode.STORAGE_READ_FAILED,
          'Impossible de charger l\'historique des cycles',
          { originalError: historyResult.error },
        ) as ValidationError,
      )
    }

    const cycleHistory = historyResult.value

    // Étape 2 : Créer un CycleManager avec l'historique
    const cycleManager = new CycleManager(cycleHistory)

    // Étape 3 : Obtenir le cycle en cours
    const currentCycle = cycleManager.getCurrentCycle()

    // Si aucun cycle en cours, retourner des conseils généraux (phase menstruelle par défaut)
    if (currentCycle === null) {
      const preferencesResult = this.repository.loadPreferences()
      const mode: TrackingMode = preferencesResult.ok
        ? preferencesResult.value.trackingMode
        : 'general'

      const advices = this.wellnessAdvisor.getDailyAdvice('menstrual', mode, [])
      return ok(advices)
    }

    // Étape 4 : Déterminer la phase actuelle du cycle
    const currentPhase = this._calculateCurrentPhase(currentCycle)

    // Étape 5 : Charger les préférences utilisateur (mode de suivi)
    const preferencesResult = this.repository.loadPreferences()
    if (!preferencesResult.ok) {
      return err(
        createError(
          ErrorCode.STORAGE_READ_FAILED,
          'Impossible de charger les préférences utilisateur',
          { originalError: preferencesResult.error },
        ) as ValidationError,
      )
    }

    const mode = preferencesResult.value.trackingMode

    // Étape 6 : Charger les symptômes récents (derniers 7 jours)
    const recentSymptoms = this._loadRecentSymptoms(currentCycle)

    // Étape 7 : Appeler WellnessAdvisor.getDailyAdvice()
    const advices = this.wellnessAdvisor.getDailyAdvice(
      currentPhase,
      mode,
      recentSymptoms,
    )

    return ok(advices)
  }

  /**
   * Calcule la phase actuelle du cycle à partir de la date d'aujourd'hui.
   *
   * Algorithme :
   * - Jours 1 à menstruation_duration → phase menstruelle
   * - Jours suivants jusqu'à ovulation - 1 → phase folliculaire
   * - Jours ovulation - 2 à ovulation + 1 → phase d'ovulation
   * - Jours restants jusqu'à la fin du cycle → phase lutéale
   *
   * Ce calcul utilise uniquement des CalendarDate et des fonctions pures —
   * pas de `new Date()` qui dépendrait du fuseau horaire du téléphone.
   *
   * @param cycle - Cycle en cours
   * @returns Phase actuelle du cycle
   */
  private _calculateCurrentPhase(cycle: Cycle): CyclePhase {
    const todayDate = today()
    const cycleStartDate = cycle.startDate

    // Calculer le jour du cycle (1-indexed)
    const dayOfCycle = diffDays(cycleStartDate, todayDate) + 1

    // Phase menstruelle : jours 1 à menstruation_duration
    // Calculer la durée de menstruation depuis menstruationEndDate
    let menstruationDuration = 5 // défaut 5 jours
    if (cycle.menstruationEndDate) {
      menstruationDuration = diffDays(cycle.startDate, cycle.menstruationEndDate) + 1
    }

    if (dayOfCycle <= menstruationDuration) {
      return 'menstrual'
    }

    // Déterminer la date d'ovulation prédite
    // Si une prédiction existe, l'utiliser ; sinon, estimer à J-14 avant la fin du cycle
    let ovulationDay: number

    if (cycle.predictions?.ovulation?.predictedDate) {
      const ovulationDate = cycle.predictions.ovulation.predictedDate
      ovulationDay = diffDays(cycleStartDate, ovulationDate) + 1
    } else {
      // Estimation par défaut : ovulation à J-14 avant la fin du cycle
      // Durée de cycle par défaut : 28 jours
      const cycleDuration = cycle.duration ?? 28
      ovulationDay = cycleDuration - 14
    }

    // Phase d'ovulation : jours ovulation - 2 à ovulation + 1
    const ovulationStart = ovulationDay - 2
    const ovulationEnd = ovulationDay + 1

    if (dayOfCycle >= ovulationStart && dayOfCycle <= ovulationEnd) {
      return 'ovulation'
    }

    // Phase folliculaire : jours après menstruation jusqu'à ovulation - 3
    if (dayOfCycle < ovulationStart) {
      return 'follicular'
    }

    // Phase lutéale : jours après ovulation jusqu'à la fin du cycle
    return 'luteal'
  }

  /**
   * Charge les symptômes récents (derniers 7 jours) pour le cycle en cours.
   *
   * @param cycle - Cycle en cours
   * @returns Tableau de symptômes récents
   */
  private _loadRecentSymptoms(cycle: Cycle): Symptom[] {
    // Si le cycle n'a pas de symptômes, retourner un tableau vide
    if (!cycle.symptoms || cycle.symptoms.length === 0) {
      return []
    }

    const todayDate = today()
    const sevenDaysAgo = addDays(todayDate, -7)

    // Filtrer les symptômes des 7 derniers jours
    return cycle.symptoms.filter((symptom: Symptom) => {
      const symptomDate = symptom.date
      const daysDiff = diffDays(sevenDaysAgo, symptomDate)
      return daysDiff >= 0 && daysDiff <= 7
    })
  }
}
