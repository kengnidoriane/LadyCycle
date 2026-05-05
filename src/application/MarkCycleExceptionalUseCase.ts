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
import type { Cycle as DomainCycle } from '../domain/cycle/types'
import type { Cycle as RepoCycle, ICycleRepository } from '../infrastructure/db/CycleRepository'
import type { ValidationError, StorageError } from '../domain/shared/errors'
import { ErrorCode, createError } from '../domain/shared/errors'
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
   */
  async markAsExceptional(
    cycleId: string,
    reason?: string,
  ): Promise<Result<RepoCycle, MarkCycleExceptionalError>> {
    // Étape 1 : Charger l'historique des cycles
    const historyResult = this.repository.loadAllCycles()
    if (!historyResult.ok) {
      return err(historyResult.error)
    }

    const cycleHistory = historyResult.value

    // Convert repo cycles to domain cycles for CycleManager
    const domainHistory: DomainCycle[] = cycleHistory.map(c => ({
      ...c,
      menstruationDuration: c.menstruationDuration,
      predictions: { ovulation: null, nextPeriod: null },
    }))

    // Étape 2 : Créer un CycleManager avec l'historique
    const cycleManager = new CycleManager(domainHistory)

    // Étape 3 : Marquer le cycle comme exceptionnel (validation)
    const markResult = cycleManager.markCycleAsExceptional(cycleId, reason)
    if (!markResult.ok) {
      return err(markResult.error)
    }

    const updatedDomainCycle = markResult.value

    // Find the original repo cycle to preserve repo-specific fields
    const originalRepoCycle = cycleHistory.find(c => c.id === cycleId)
    if (!originalRepoCycle) {
      return err(createError(
        ErrorCode.MISSING_REQUIRED_FIELD,
        `Cycle introuvable : ${cycleId}`,
      ) as ValidationError)
    }

    // Étape 4 : Convertir vers le format repository et persister
    const updatedRepoCycle: RepoCycle = {
      ...originalRepoCycle,
      isExceptional: updatedDomainCycle.isExceptional,
      exceptionalReason: updatedDomainCycle.exceptionalReason,
      updatedAt: updatedDomainCycle.updatedAt,
    }

    const saveResult = this.repository.saveCycle(updatedRepoCycle)
    if (!saveResult.ok) {
      return err(saveResult.error)
    }

    // Étape 5 : Recalculer les prédictions
    const predictUseCase = new PredictNextCycleUseCase(this.repository)
    await predictUseCase.execute()

    return ok(updatedRepoCycle)
  }

  /**
   * Annule le marquage exceptionnel d'un cycle.
   */
  async unmarkAsExceptional(
    cycleId: string,
  ): Promise<Result<RepoCycle, MarkCycleExceptionalError>> {
    // Étape 1 : Charger l'historique des cycles
    const historyResult = this.repository.loadAllCycles()
    if (!historyResult.ok) {
      return err(historyResult.error)
    }

    const cycleHistory = historyResult.value

    // Convert repo cycles to domain cycles for CycleManager
    const domainHistory: DomainCycle[] = cycleHistory.map(c => ({
      ...c,
      menstruationDuration: c.menstruationDuration,
      predictions: { ovulation: null, nextPeriod: null },
    }))

    // Étape 2 : Créer un CycleManager avec l'historique
    const cycleManager = new CycleManager(domainHistory)

    // Étape 3 : Annuler le marquage exceptionnel (validation)
    const unmarkResult = cycleManager.unmarkCycleAsExceptional(cycleId)
    if (!unmarkResult.ok) {
      return err(unmarkResult.error)
    }

    const updatedDomainCycle = unmarkResult.value

    // Find the original repo cycle to preserve repo-specific fields
    const originalRepoCycle = cycleHistory.find(c => c.id === cycleId)
    if (!originalRepoCycle) {
      return err(createError(
        ErrorCode.MISSING_REQUIRED_FIELD,
        `Cycle introuvable : ${cycleId}`,
      ) as ValidationError)
    }

    // Étape 4 : Convertir vers le format repository et persister
    const updatedRepoCycle: RepoCycle = {
      ...originalRepoCycle,
      isExceptional: updatedDomainCycle.isExceptional,
      exceptionalReason: updatedDomainCycle.exceptionalReason,
      updatedAt: updatedDomainCycle.updatedAt,
    }

    const saveResult = this.repository.saveCycle(updatedRepoCycle)
    if (!saveResult.ok) {
      return err(saveResult.error)
    }

    // Étape 5 : Recalculer les prédictions
    const predictUseCase = new PredictNextCycleUseCase(this.repository)
    await predictUseCase.execute()

    return ok(updatedRepoCycle)
  }
}
