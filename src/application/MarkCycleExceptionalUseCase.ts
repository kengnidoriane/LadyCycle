/**
 * MarkCycleExceptionalUseCase — Use Case pour marquer/démarquer un cycle comme exceptionnel.
 *
 * Orchestration complète de bout en bout :
 *   1. Charger l'historique via CycleRepository.loadAllCycles()
 *   2. Appeler CycleManager.markCycleAsExceptional() ou unmarkCycleAsExceptional()
 *   3. Persister via CycleRepository.saveCycle()
 *   4. Déclencher un recalcul des prédictions via PredictNextCycleUseCase
 *
 * Responsabilités :
 *   - Coordonner les composants domaine et infrastructure
 *   - Gérer les erreurs de validation et de persistance
 *   - Recalculer les prédictions après modification
 *   - Retourner un Result<Cycle, Error> explicite
 *
 * Exigences : 13.1, 13.2, 13.3, 13.4
 */

import type { Result } from '../domain/shared/types'
import { ok, err } from '../domain/shared/types'
import { CycleManager } from '../domain/cycle/CycleManager'
import type { Cycle } from '../domain/cycle/types'
import type { ICycleRepository } from '../infrastructure/db/CycleRepository'
import type { ValidationError, StorageError } from '../domain/shared/errors'
import { PredictNextCycleUseCase } from './PredictNextCycleUseCase'

// ─── Types d'erreur ───────────────────────────────────────────────────────────

/**
 * Erreur unifiée pour le Use Case.
 * Peut être une erreur de validation (domaine) ou de persistance (infrastructure).
 */
export type MarkCycleExceptionalError = ValidationError | StorageError

// ─── MarkCycleExceptionalUseCase ──────────────────────────────────────────────

/**
 * Use Case pour marquer ou démarquer un cycle comme exceptionnel.
 *
 * Usage typique :
 *   const useCase = new MarkCycleExceptionalUseCase(repository)
 *   const result = await useCase.markAsExceptional('cycle-id', 'Maladie')
 *   if (result.ok) {
 *     console.log('Cycle marqué comme exceptionnel :', result.value)
 *   } else {
 *     console.error('Erreur :', result.error.message)
 *   }
 */
export class MarkCycleExceptionalUseCase {
  private repository: ICycleRepository

  constructor(repository: ICycleRepository) {
    this.repository = repository
  }

  /**
   * Marque un cycle comme exceptionnel.
   *
   * Étapes :
   *   1. Charger l'historique des cycles depuis le repository
   *   2. Créer un CycleManager avec l'historique
   *   3. Marquer le cycle comme exceptionnel (validation)
   *   4. Persister le cycle via repository
   *   5. Recalculer les prédictions avec PredictNextCycleUseCase
   *
   * @param cycleId - Identifiant du cycle à marquer
   * @param reason - Raison optionnelle du marquage (ex: "Maladie", "Stress intense")
   * @returns Result<Cycle, MarkCycleExceptionalError>
   */
  async markAsExceptional(
    cycleId: string,
    reason?: string,
  ): Promise<Result<Cycle, MarkCycleExceptionalError>> {
    // Étape 1 : Charger l'historique des cycles
    const historyResult = this.repository.loadAllCycles()
    if (!historyResult.ok) {
      return err(historyResult.error)
    }

    const cycleHistory = historyResult.value

    // Étape 2 : Créer un CycleManager avec l'historique
    const cycleManager = new CycleManager(cycleHistory)

    // Étape 3 : Marquer le cycle comme exceptionnel (validation)
    const markResult = cycleManager.markCycleAsExceptional(cycleId, reason)
    if (!markResult.ok) {
      return err(markResult.error)
    }

    const updatedCycle = markResult.value

    // Étape 4 : Persister le cycle
    const saveResult = this.repository.saveCycle(updatedCycle as any)
    if (!saveResult.ok) {
      return err(saveResult.error)
    }

    // Étape 5 : Recalculer les prédictions
    // Le marquage d'un cycle comme exceptionnel affecte les prédictions futures
    // car ce cycle sera exclu des calculs
    const predictUseCase = new PredictNextCycleUseCase(this.repository)
    await predictUseCase.execute()

    // Retourner le cycle mis à jour
    return ok(updatedCycle)
  }

  /**
   * Annule le marquage exceptionnel d'un cycle.
   *
   * Étapes :
   *   1. Charger l'historique des cycles depuis le repository
   *   2. Créer un CycleManager avec l'historique
   *   3. Annuler le marquage exceptionnel (validation)
   *   4. Persister le cycle via repository
   *   5. Recalculer les prédictions avec PredictNextCycleUseCase
   *
   * @param cycleId - Identifiant du cycle à démarquer
   * @returns Result<Cycle, MarkCycleExceptionalError>
   */
  async unmarkAsExceptional(
    cycleId: string,
  ): Promise<Result<Cycle, MarkCycleExceptionalError>> {
    // Étape 1 : Charger l'historique des cycles
    const historyResult = this.repository.loadAllCycles()
    if (!historyResult.ok) {
      return err(historyResult.error)
    }

    const cycleHistory = historyResult.value

    // Étape 2 : Créer un CycleManager avec l'historique
    const cycleManager = new CycleManager(cycleHistory)

    // Étape 3 : Annuler le marquage exceptionnel (validation)
    const unmarkResult = cycleManager.unmarkCycleAsExceptional(cycleId)
    if (!unmarkResult.ok) {
      return err(unmarkResult.error)
    }

    const updatedCycle = unmarkResult.value

    // Étape 4 : Persister le cycle
    const saveResult = this.repository.saveCycle(updatedCycle as any)
    if (!saveResult.ok) {
      return err(saveResult.error)
    }

    // Étape 5 : Recalculer les prédictions
    // La réintégration d'un cycle dans les calculs affecte les prédictions futures
    const predictUseCase = new PredictNextCycleUseCase(this.repository)
    await predictUseCase.execute()

    // Retourner le cycle mis à jour
    return ok(updatedCycle)
  }
}
