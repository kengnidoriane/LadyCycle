/**
 * I18nContext — Contexte React pour l'internationalisation.
 *
 * Fournit la fonction `t()` et `currentLanguage` à tous les composants.
 * Quand la langue change, tous les composants qui utilisent `useI18n()` se
 * re-rendent automatiquement — sans redémarrage de l'application.
 *
 * Exigences : 15.2, 15.3
 */

import React, { createContext, useContext, useState, useCallback } from 'react'
import type { SupportedLanguage } from '../../domain/shared/types'
import { i18nService } from '../../infrastructure/i18n/I18nService'

// ─── Types ────────────────────────────────────────────────────────────────────

interface I18nContextValue {
  /** Traduit une clé UI dans la langue active */
  t: (key: string) => string
  /** Langue actuellement active */
  currentLanguage: SupportedLanguage
  /** Change la langue et force le re-rendu de tous les composants */
  setLanguage: (lang: SupportedLanguage) => void
}

// ─── Contexte ─────────────────────────────────────────────────────────────────

const I18nContext = createContext<I18nContextValue>({
  t: (key) => key,
  currentLanguage: 'fr',
  setLanguage: () => {},
})

// ─── Provider ─────────────────────────────────────────────────────────────────

interface I18nProviderProps {
  children: React.ReactNode
  initialLanguage?: SupportedLanguage
}

export function I18nProvider({
  children,
  initialLanguage = 'fr',
}: I18nProviderProps): React.JSX.Element {
  const [currentLanguage, setCurrentLanguage] = useState<SupportedLanguage>(() => {
    i18nService.initialize(initialLanguage)
    return initialLanguage
  })

  const setLanguage = useCallback((lang: SupportedLanguage) => {
    i18nService.setLanguage(lang)
    setCurrentLanguage(lang)
  }, [])

  const t = useCallback(
    (key: string) => i18nService.t(key),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [currentLanguage], // re-crée t() quand la langue change
  )

  return (
    <I18nContext.Provider value={{ t, currentLanguage, setLanguage }}>
      {children}
    </I18nContext.Provider>
  )
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Hook pour accéder aux traductions dans n'importe quel composant.
 *
 * Usage :
 *   const { t, currentLanguage, setLanguage } = useI18n()
 *   <Text>{t('calendar.title')}</Text>
 */
export function useI18n(): I18nContextValue {
  return useContext(I18nContext)
}
