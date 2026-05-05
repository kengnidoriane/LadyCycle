/**
 * OvulationBlurZone — Zone de flou visuelle pour la date d'ovulation prédite.
 *
 * L'ovulation est biologiquement instable. Afficher une date précise donnerait
 * une fausse impression de certitude. Ce composant affiche la fenêtre d'ovulation
 * avec un gradient d'opacité pour communiquer honnêtement l'incertitude.
 *
 * Exigence 2.6 : présenter la date d'ovulation avec une zone de flou visuelle
 * distincte pour signaler son instabilité biologique.
 */

import React from 'react'
import {
  View,
  Text,
  StyleSheet,
} from 'react-native'
import type { OvulationWindow } from '../../domain/cycle/types'
import type { ConfidenceResult } from '../../domain/cycle/types'
import { ConfidenceBadge } from './ConfidenceBadge'

// ─── Props ────────────────────────────────────────────────────────────────────

interface OvulationBlurZoneProps {
  ovulation: OvulationWindow
  confidence: ConfidenceResult
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Formate une CalendarDate (YYYY-MM-DD) en date lisible en français.
 * Ex : "2024-01-29" → "29 jan."
 */
function formatDate(date: string): string {
  const [year, month, day] = date.split('-').map(Number)
  const d = new Date(Date.UTC(year, month - 1, day))
  return d.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  })
}

// ─── Composant ────────────────────────────────────────────────────────────────

/**
 * Affiche la fenêtre d'ovulation avec une zone de flou visuelle.
 *
 * Structure :
 * - Titre "Ovulation estimée" avec icône d'incertitude
 * - Date estimée centrale (opacité réduite pour signaler l'incertitude)
 * - Période féconde (début → fin)
 * - Badge de confiance
 *
 * Accessibilité : annonce la date estimée et la période féconde complète.
 */
export function OvulationBlurZone({
  ovulation,
  confidence,
}: OvulationBlurZoneProps): React.JSX.Element {
  const fertileStart = formatDate(ovulation.fertileWindowStart)
  const fertileEnd = formatDate(ovulation.fertileWindowEnd)
  const estimatedDate = formatDate(ovulation.estimatedDate)

  const accessibilityLabel =
    `Ovulation estimée le ${estimatedDate}. ` +
    `Période féconde du ${fertileStart} au ${fertileEnd}. ` +
    `Cette date est une estimation — la biologie est variable.`

  return (
    <View
      style={styles.container}
      accessible={true}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="text"
    >
      {/* En-tête avec icône d'incertitude */}
      <View style={styles.header}>
        <Text style={styles.uncertaintyIcon} accessibilityElementsHidden={true}>
          〜
        </Text>
        <Text style={styles.title}>Ovulation estimée</Text>
      </View>

      {/* Date centrale avec opacité réduite (zone de flou) */}
      <View style={styles.blurZone} accessibilityElementsHidden={true}>
        {/* Gradient simulé avec des vues superposées */}
        <View style={[styles.blurEdge, styles.blurLeft]} />
        <View style={styles.dateContainer}>
          <Text style={styles.estimatedDate}>{estimatedDate}</Text>
          <Text style={styles.uncertaintyNote}>± quelques jours</Text>
        </View>
        <View style={[styles.blurEdge, styles.blurRight]} />
      </View>

      {/* Période féconde */}
      <View style={styles.fertileWindow} accessibilityElementsHidden={true}>
        <Text style={styles.fertileLabel}>Période féconde</Text>
        <Text style={styles.fertileRange}>
          {fertileStart} → {fertileEnd}
        </Text>
      </View>

      {/* Indicateur de confiance */}
      <ConfidenceBadge confidence={confidence} />
    </View>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const OVULATION_COLOR = '#FFB74D'
const OVULATION_BG = '#FFF8E1'

const styles = StyleSheet.create({
  container: {
    backgroundColor: OVULATION_BG,
    borderRadius: 12,
    padding: 16,
    marginVertical: 8,
    borderLeftWidth: 4,
    borderLeftColor: OVULATION_COLOR,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  uncertaintyIcon: {
    fontSize: 18,
    color: OVULATION_COLOR,
    marginRight: 6,
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
    color: '#5D4037',
  },
  blurZone: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    height: 56,
  },
  blurEdge: {
    width: 32,
    height: '100%',
    borderRadius: 8,
  },
  blurLeft: {
    // Simule un fondu depuis transparent vers la couleur
    backgroundColor: OVULATION_BG,
    opacity: 0.9,
  },
  blurRight: {
    backgroundColor: OVULATION_BG,
    opacity: 0.9,
  },
  dateContainer: {
    flex: 1,
    alignItems: 'center',
    opacity: 0.75, // Opacité réduite pour signaler l'incertitude
  },
  estimatedDate: {
    fontSize: 22,
    fontWeight: '700',
    color: '#E65100',
  },
  uncertaintyNote: {
    fontSize: 11,
    color: '#BF360C',
    marginTop: 2,
    fontStyle: 'italic',
  },
  fertileWindow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFE0B2',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 10,
  },
  fertileLabel: {
    fontSize: 13,
    color: '#E65100',
    fontWeight: '500',
  },
  fertileRange: {
    fontSize: 13,
    color: '#BF360C',
    fontWeight: '600',
  },
})
