/**
 * useWellness — Hook React pour l'écran des conseils de bien-être.
 *
 * Responsabilités :
 * - Charger les conseils du jour via GetDailyAdviceUseCase
 * - Exposer la phase actuelle du cycle et le mode de suivi
 * - Gérer les états de chargement et d'erreur
 *
 * Ce hook ne contient aucune logique métier — il orchestre GetDailyAdviceUseCase
 * et expose les données à WellnessScreen.
 *
 * Exigences : 11.1, 11.2, 11.3, 11.4, 11.5
 */

import { useState, useEffect, useCallback } from 'react'
import { GetDailyAdviceUseCase } from '../../application/GetDailyAdviceUseCase'
import type { Advice } from '../../domain/wellness/types'
import type { CyclePhase, TrackingMode } from '../../domain/wellness/types'
import { i18nService } from '../../infrastructure/i18n/I18nService'
import { sharedRepository } from '../calendar/useCalendar'

// ─── Types exposés par le hook ────────────────────────────────────────────────

export interface WellnessState {
  /** Conseils du jour triés par priorité */
  advices: Advice[]
  /** Phase actuelle du cycle (null si aucun cycle en cours) */
  currentPhase: CyclePhase | null
  /** Mode de suivi actif */
  trackingMode: TrackingMode
  /** Vrai pendant le chargement initial */
  isLoading: boolean
  /** Message d'erreur si le chargement a échoué */
  error: string | null
  /** Recharger les conseils (après changement de mode ou de phase) */
  refresh: () => void
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Hook principal de l'écran bien-être.
 *
 * Usage :
 *   const { advices, currentPhase, trackingMode, isLoading, error, refresh } = useWellness()
 */
export function useWellness(): WellnessState {
  const [advices, setAdvices] = useState<Advice[]>([])
  const [currentPhase, setCurrentPhase] = useState<CyclePhase | null>(null)
  const [trackingMode, setTrackingMode] = useState<TrackingMode>('general')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      // Charger le mode de suivi depuis les préférences
      const prefsResult = sharedRepository.loadPreferences()
      if (prefsResult.ok) {
        setTrackingMode(prefsResult.value.trackingMode)
      }

      // Charger les conseils via GetDailyAdviceUseCase
      const wellnessContent = i18nService.loadWellnessContent()
      const useCase = new GetDailyAdviceUseCase(sharedRepository, wellnessContent)
      const result = await useCase.execute()

      if (result.ok) {
        setAdvices(result.value)
      } else {
        setError(result.error.message)
      }

      // Déterminer la phase actuelle depuis l'historique des cycles
      const cyclesResult = sharedRepository.loadAllCycles()
      if (cyclesResult.ok && cyclesResult.value.length > 0) {
        // La phase est calculée dans GetDailyAdviceUseCase — on la récupère
        // en inspectant le premier conseil retourné (tous ont la même phase)
        const firstAdvice = result.ok && result.value.length > 0 ? result.value[0] : null
        if (firstAdvice) {
          setCurrentPhase(firstAdvice.phase)
        }
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
    advices,
    currentPhase,
    trackingMode,
    isLoading,
    error,
    refresh: load,
  }
}

// ─── Helpers pour les phases ──────────────────────────────────────────────────

/**
 * Retourne le label et l'emoji associés à une phase du cycle.
 */
export function getPhaseInfo(phase: CyclePhase): {
  label: string
  emoji: string
  color: string
  backgroundColor: string
} {
  switch (phase) {
    case 'menstrual':
      return {
        label: 'Phase menstruelle',
        emoji: '🔴',
        color: '#C62828',
        backgroundColor: '#FFEBEE',
      }
    case 'follicular':
      return {
        label: 'Phase folliculaire',
        emoji: '🟢',
        color: '#2E7D32',
        backgroundColor: '#E8F5E9',
      }
    case 'ovulation':
      return {
        label: 'Phase d\'ovulation',
        emoji: '🟠',
        color: '#E65100',
        backgroundColor: '#FFF3E0',
      }
    case 'luteal':
      return {
        label: 'Phase lutéale',
        emoji: '🟣',
        color: '#4527A0',
        backgroundColor: '#EDE7F6',
      }
  }
}

/**
 * Retourne le label d'une catégorie de conseil.
 */
export function getCategoryLabel(category: Advice['category']): string {
  switch (category) {
    case 'nutrition':
      return '🥗 Nutrition'
    case 'exercise':
      return '🏃 Activité physique'
    case 'self_care':
      return '💆 Bien-être'
    case 'medical':
      return '🩺 Santé'
  }
}

/**
 * Retourne la couleur associée à une catégorie de conseil.
 */
export function getCategoryColor(category: Advice['category']): string {
  switch (category) {
    case 'nutrition':
      return '#388E3C'
    case 'exercise':
      return '#1565C0'
    case 'self_care':
      return '#6A1B9A'
    case 'medical':
      return '#C62828'
  }
}
