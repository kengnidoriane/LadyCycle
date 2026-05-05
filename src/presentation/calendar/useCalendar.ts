/**
 * useCalendar — Hook React pour le calendrier du cycle menstruel.
 *
 * Responsabilités :
 * - Charger les prédictions via PredictNextCycleUseCase
 * - Charger l'historique des cycles via le repository
 * - Exposer les données prêtes à l'affichage (phases, prédictions, confiance)
 * - Gérer les états de chargement et d'erreur
 *
 * Ce hook ne contient aucune logique métier — il orchestre les Use Cases
 * et expose les données à CalendarScreen.
 *
 * Exigences : 12.1, 12.2, 12.3, 12.4, 2.6
 */

import { useState, useEffect, useCallback } from 'react'
import type { PredictionResult } from '../../application/PredictNextCycleUseCase'
import { PredictNextCycleUseCase } from '../../application/PredictNextCycleUseCase'
import type { Cycle } from '../../infrastructure/db/CycleRepository'
import { InMemoryCycleRepository } from '../../infrastructure/db/CycleRepository'
import type { CalendarDate } from '../../domain/shared/types'

// ─── Types exposés par le hook ────────────────────────────────────────────────

export interface CalendarState {
  /** Prédictions complètes (phase, ovulation, prochaines règles) */
  predictions: PredictionResult | null
  /** Historique des cycles chargés */
  cycles: Cycle[]
  /** Vrai pendant le chargement initial */
  isLoading: boolean
  /** Message d'erreur si le chargement a échoué */
  error: string | null
  /** Recharger les données (après enregistrement d'un nouveau cycle) */
  refresh: () => void
}

// ─── Repository partagé (singleton pour l'app) ────────────────────────────────
// En production, ce serait NativeCycleRepository injecté via un contexte React.
// Pour l'instant, InMemoryCycleRepository permet de tester sans appareil physique.
const sharedRepository = new InMemoryCycleRepository()

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Hook principal du calendrier.
 *
 * Usage :
 *   const { predictions, cycles, isLoading, error, refresh } = useCalendar()
 */
export function useCalendar(): CalendarState {
  const [predictions, setPredictions] = useState<PredictionResult | null>(null)
  const [cycles, setCycles] = useState<Cycle[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      // Charger l'historique des cycles
      const cyclesResult = sharedRepository.loadAllCycles()
      if (cyclesResult.ok) {
        setCycles(cyclesResult.value)
      }

      // Calculer les prédictions
      const useCase = new PredictNextCycleUseCase(sharedRepository)
      const result = await useCase.execute()

      if (result.ok) {
        setPredictions(result.value)
      } else {
        setError(result.error.message)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur inattendue')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  return {
    predictions,
    cycles,
    isLoading,
    error,
    refresh: load,
  }
}

// ─── Helpers pour les couleurs de phase ──────────────────────────────────────

/**
 * Retourne la couleur associée à une phase du cycle.
 * Utilisé par CalendarScreen pour colorier les jours du calendrier.
 *
 * Exigence 12.3 : code couleur cohérent pour les phases.
 */
export function getPhaseColor(phase: string): string {
  switch (phase) {
    case 'menstrual':
      return '#E57373'   // Rouge doux — menstruation
    case 'follicular':
      return '#81C784'   // Vert doux — phase folliculaire
    case 'ovulation':
      return '#FFB74D'   // Orange doux — ovulation / période féconde
    case 'luteal':
      return '#9575CD'   // Violet doux — phase lutéale
    default:
      return '#BDBDBD'   // Gris — inconnu
  }
}

/**
 * Détermine la phase d'un jour donné en fonction des prédictions.
 *
 * @param date - Date au format YYYY-MM-DD
 * @param cycles - Historique des cycles
 * @param predictions - Prédictions calculées
 * @returns Phase du cycle pour ce jour, ou null si hors cycle connu
 */
export function getDayPhase(
  date: CalendarDate,
  cycles: Cycle[],
  predictions: PredictionResult | null,
): string | null {
  if (!predictions) return null

  // Vérifier si le jour est dans une période de menstruation connue
  for (const cycle of cycles) {
    if (date >= cycle.startDate) {
      const menstruationEnd = cycle.menstruationEndDate ?? addDaysToDate(cycle.startDate, 4)
      if (date <= menstruationEnd) {
        return 'menstrual'
      }
    }
  }

  // Vérifier la période féconde prédite
  const fertileStart = predictions.ovulation.value.fertileWindowStart
  const fertileEnd = predictions.ovulation.value.fertileWindowEnd
  if (date >= fertileStart && date <= fertileEnd) {
    return 'ovulation'
  }

  // Vérifier la phase lutéale (après ovulation, avant prochaines règles)
  const ovulationDate = predictions.ovulation.value.estimatedDate
  const nextPeriodStart = predictions.nextPeriod.value.startDate
  if (date > ovulationDate && date < nextPeriodStart) {
    return 'luteal'
  }

  // Vérifier les prochaines règles prédites
  const nextPeriodEnd = predictions.nextPeriod.value.endDate
  if (date >= nextPeriodStart && date <= nextPeriodEnd) {
    return 'menstrual'
  }

  return 'follicular'
}

/**
 * Ajoute N jours à une CalendarDate.
 * Fonction utilitaire locale pour éviter l'import circulaire.
 */
function addDaysToDate(date: CalendarDate, n: number): CalendarDate {
  const d = new Date(date + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().split('T')[0]
}

/**
 * Expose le repository partagé pour que RecordPeriodForm puisse l'utiliser.
 * En production, ce serait injecté via un contexte React.
 */
export { sharedRepository }
