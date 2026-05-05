/**
 * ConfidenceBadge — Indicateur de confiance pour les prédictions.
 *
 * Affiche le niveau de confiance (faible / moyen / élevé) avec une explication
 * si le niveau est "faible". Implémente la transparence algorithmique :
 * l'utilisatrice comprend pourquoi la confiance est faible.
 *
 * Exigence 12.4 : afficher la plage de dates probables avec indicateur de
 * confiance ; si confiance "Faible", expliquer la raison.
 */

import React from 'react'
import {
  View,
  Text,
  StyleSheet,
  AccessibilityInfo,
} from 'react-native'
import type { ConfidenceResult } from '../../domain/cycle/types'

// ─── Props ────────────────────────────────────────────────────────────────────

interface ConfidenceBadgeProps {
  confidence: ConfidenceResult
}

// ─── Labels et couleurs ───────────────────────────────────────────────────────

const LEVEL_LABELS: Record<string, string> = {
  low: 'Confiance faible',
  medium: 'Confiance moyenne',
  high: 'Confiance élevée',
}

const LEVEL_COLORS: Record<string, string> = {
  low: '#EF5350',    // Rouge
  medium: '#FFA726', // Orange
  high: '#66BB6A',   // Vert
}

const EXPLANATION_MESSAGES: Record<string, string> = {
  not_enough_data:
    'Enregistrez encore quelques cycles pour améliorer la précision des prédictions.',
  too_irregular:
    'Votre cycle est irrégulier (variation > 7 jours). Les prédictions sont approximatives.',
}

// ─── Composant ────────────────────────────────────────────────────────────────

/**
 * Affiche le niveau de confiance d'une prédiction.
 *
 * - Niveau "high" ou "medium" : badge coloré uniquement
 * - Niveau "low" : badge + message d'explication
 *
 * Accessibilité : le badge annonce son contenu complet via accessibilityLabel.
 */
export function ConfidenceBadge({ confidence }: ConfidenceBadgeProps): React.JSX.Element {
  const label = LEVEL_LABELS[confidence.level] ?? confidence.level
  const color = LEVEL_COLORS[confidence.level] ?? '#BDBDBD'
  const explanation =
    confidence.level === 'low' && confidence.explanation
      ? EXPLANATION_MESSAGES[confidence.explanation]
      : null

  const accessibilityLabel = explanation
    ? `${label}. ${explanation}`
    : label

  return (
    <View
      style={styles.container}
      accessible={true}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="text"
    >
      {/* Badge coloré */}
      <View style={[styles.badge, { backgroundColor: color }]}>
        <Text style={styles.badgeText}>{label}</Text>
      </View>

      {/* Explication si confiance faible */}
      {explanation !== null && (
        <Text style={styles.explanation} accessibilityElementsHidden={true}>
          {explanation}
        </Text>
      )}
    </View>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    marginVertical: 4,
  },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  explanation: {
    marginTop: 6,
    fontSize: 13,
    color: '#757575',
    lineHeight: 18,
  },
})
