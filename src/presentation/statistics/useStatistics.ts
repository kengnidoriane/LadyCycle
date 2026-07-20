/**
 * useStatistics — Hook React pour l'écran des statistiques et de l'historique.
 *
 * Responsabilités :
 * - Charger l'historique des cycles via le repository
 * - Calculer les statistiques via CycleManager.calculateStatistics()
 * - Exposer les données prêtes à l'affichage
 * - Gérer les états de chargement et d'erreur
 *
 * Ce hook ne contient aucune logique métier — il orchestre les composants
 * domaine et expose les données à StatisticsScreen et CycleDetailScreen.
 *
 * Exigences : 7.1, 7.2, 7.3, 7.4, 7.5, 13.1, 13.3, 13.4
 */

import { useState, useEffect, useCallback } from 'react'
import { CycleManager } from '../../domain/cycle/CycleManager'
import { MarkCycleExceptionalUseCase } from '../../application/MarkCycleExceptionalUseCase'
import type { CycleStatistics } from '../../domain/cycle/types'
import type { Cycle } from '../../infrastructure/db/CycleRepository'
import { sharedRepository } from '../calendar/useCalendar'

// ─── Types exposés par le hook ────────────────────────────────────────────────

export interface StatisticsState {
  /** Statistiques calculées sur les cycles non exceptionnels */
  statistics: CycleStatistics | null
  /** Historique complet des cycles (incluant les exceptionnels) */
  cycles: Cycle[]
  /** Vrai pendant le chargement initial */
  isLoading: boolean
  /** Message d'erreur si le chargement a échoué */
  error: string | null
  /** Recharger les données */
  refresh: () => void
  /** Marquer un cycle comme exceptionnel */
  markAsExceptional: (cycleId: string, reason?: string) => Promise<void>
  /** Annuler le marquage exceptionnel d'un cycle */
  unmarkAsExceptional: (cycleId: string) => Promise<void>
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Hook principal des statistiques.
 *
 * Usage :
 *   const { statistics, cycles, isLoading, error, refresh } = useStatistics()
 */
export function useStatistics(): StatisticsState {
  const [statistics, setStatistics] = useState<CycleStatistics | null>(null)
  const [cycles, setCycles] = useState<Cycle[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      // Charger l'historique des cycles
      const cyclesResult = sharedRepository.loadAllCycles()
      if (!cyclesResult.ok) {
        setError(cyclesResult.error.message)
        return
      }

      const loadedCycles = cyclesResult.value
      setCycles(loadedCycles)

      // Calculer les statistiques via CycleManager (logique pure)
      const domainCycles = loadedCycles.map(c => ({
        ...c,
        predictions: { ovulation: null, nextPeriod: null },
      }))
      const manager = new CycleManager(domainCycles)
      setStatistics(manager.calculateStatistics())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur inattendue')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  // ── Actions ───────────────────────────────────────────────────────────────

  const markAsExceptional = useCallback(
    async (cycleId: string, reason?: string): Promise<void> => {
      const useCase = new MarkCycleExceptionalUseCase(sharedRepository)
      const result = await useCase.markAsExceptional(cycleId, reason)
      if (result.ok) {
        await load()
      } else {
        setError(result.error.message)
      }
    },
    [load],
  )

  const unmarkAsExceptional = useCallback(
    async (cycleId: string): Promise<void> => {
      const useCase = new MarkCycleExceptionalUseCase(sharedRepository)
      const result = await useCase.unmarkAsExceptional(cycleId)
      if (result.ok) {
        await load()
      } else {
        setError(result.error.message)
      }
    },
    [load],
  )

  return {
    statistics,
    cycles,
    isLoading,
    error,
    refresh: load,
    markAsExceptional,
    unmarkAsExceptional,
  }
}

// ─── Helpers pour l'affichage des statistiques ───────────────────────────────

/**
 * Traduit la régularité du cycle en message lisible pour l'utilisatrice.
 * L'écart-type σ est converti en langage naturel — jamais affiché brut.
 *
 * Exigence 7.3 : afficher la régularité du cycle.
 */
export function formatRegularity(
  regularity: 'regular' | 'irregular' | 'very_irregular',
  standardDeviation: number,
  lang: 'fr' | 'en' = 'fr',
): { label: string; description: string; color: string } {
  const fr = lang !== 'en'
  const sd = Math.round(standardDeviation)
  switch (regularity) {
    case 'regular':
      return {
        label: fr ? 'Régulier ✓' : 'Regular ✓',
        description: fr
          ? `Vos cycles varient de ±${sd} jour${standardDeviation >= 1.5 ? 's' : ''} en moyenne.`
          : `Your cycles vary by ±${sd} day${standardDeviation >= 1.5 ? 's' : ''} on average.`,
        color: '#66BB6A',
      }
    case 'irregular':
      return {
        label: fr ? 'Irrégulier' : 'Irregular',
        description: fr
          ? `Vos cycles varient de ±${sd} jours en moyenne.`
          : `Your cycles vary by ±${sd} days on average.`,
        color: '#FFA726',
      }
    case 'very_irregular':
      return {
        label: fr ? 'Très irrégulier' : 'Very irregular',
        description: fr
          ? `Vos cycles varient de ±${sd} jours. Les prédictions sont approximatives.`
          : `Your cycles vary by ±${sd} days. Predictions are approximate.`,
        color: '#EF5350',
      }
  }
}

/**
 * Formate une durée en jours en texte lisible.
 * Ex : 28.3 → "28 jours" / "28 days"
 */
export function formatDuration(days: number, lang: 'fr' | 'en' = 'fr'): string {
  const rounded = Math.round(days)
  if (lang === 'en') return `${rounded} day${rounded > 1 ? 's' : ''}`
  return `${rounded} jour${rounded > 1 ? 's' : ''}`
}

/**
 * Formate une CalendarDate en date lisible selon la langue.
 * Ex : "2024-01-29" → "29 janv. 2024" / "29 Jan 2024"
 */
export function formatDate(date: string, lang: 'fr' | 'en' = 'fr'): string {
  const [year, month, day] = date.split('-').map(Number)
  const d = new Date(Date.UTC(year, month - 1, day))
  return d.toLocaleDateString(lang === 'en' ? 'en-GB' : 'fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  })
}
