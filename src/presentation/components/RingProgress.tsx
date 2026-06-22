/**
 * RingProgress — anneau de progression du cycle.
 *
 * Signature de LadyCycle : l'anneau se « précise » visuellement à mesure que
 * la confiance de l'algorithme augmente.
 *   - low    → trait estompé + halo pointillé extérieur (incertitude assumée)
 *   - medium → trait plus affirmé, sans halo
 *   - high   → trait franc et net, pleine opacité
 *
 * Honnêteté radicale : on ne fait pas semblant d'être précis quand on ne l'est pas.
 *
 * Le contenu central (jour, compte à rebours…) est passé en `children` et
 * superposé au centre de l'anneau.
 */

import React from 'react'
import { View, StyleSheet } from 'react-native'
import Svg, { Circle } from 'react-native-svg'
import { colors } from '../theme'

type Confidence = 'low' | 'medium' | 'high'

interface RingProgressProps {
  /** Progression de 0 à 1 (position dans le cycle). */
  progress: number
  /** Niveau de confiance de la prédiction — pilote la « netteté » de l'anneau. */
  confidence?: Confidence
  /** Couleur principale de l'arc (par défaut : couleur de phase). */
  color?: string
  /** Diamètre total de l'anneau. */
  size?: number
  /** Épaisseur du trait. */
  thickness?: number
  children?: React.ReactNode
}

const CONFIDENCE_OPACITY: Record<Confidence, number> = {
  low: 0.5,
  medium: 0.82,
  high: 1,
}

export function RingProgress({
  progress,
  confidence = 'high',
  color = colors.primary,
  size = 230,
  thickness = 14,
  children,
}: RingProgressProps): React.JSX.Element {
  const clamped = Math.max(0, Math.min(1, progress))
  const center = size / 2
  const radius = (size - thickness) / 2
  const circumference = 2 * Math.PI * radius
  const dashOffset = circumference * (1 - clamped)

  // Halo pointillé extérieur : présent uniquement quand la confiance n'est pas élevée
  const showUncertaintyHalo = confidence !== 'high'
  const haloRadius = radius + thickness * 0.75

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        {/* Halo d'incertitude (pointillé, très léger) */}
        {showUncertaintyHalo && (
          <Circle
            cx={center}
            cy={center}
            r={haloRadius}
            stroke={color}
            strokeWidth={1.5}
            strokeOpacity={confidence === 'low' ? 0.35 : 0.2}
            strokeDasharray="2 7"
            fill="none"
          />
        )}

        {/* Rail de fond */}
        <Circle
          cx={center}
          cy={center}
          r={radius}
          stroke={colors.surfaceAlt}
          strokeWidth={thickness}
          fill="none"
        />

        {/* Arc de progression */}
        <Circle
          cx={center}
          cy={center}
          r={radius}
          stroke={color}
          strokeOpacity={CONFIDENCE_OPACITY[confidence]}
          strokeWidth={thickness}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          fill="none"
          transform={`rotate(-90 ${center} ${center})`}
        />
      </Svg>

      {/* Contenu central superposé */}
      <View style={styles.center} pointerEvents="none">
        {children}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
