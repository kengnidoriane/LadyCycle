/**
 * Icon — jeu d'icônes vectorielles « ligne » de LadyCycle.
 *
 * Construites avec react-native-svg (pas d'émojis, pas de dépendance de police).
 * Style cohérent : trait de 2px, extrémités arrondies, viewBox 24×24.
 *
 * Usage : <Icon name="home" size={22} color={colors.primary} />
 */

import React from 'react'
import Svg, { Path, Circle, Line, Polyline, Rect } from 'react-native-svg'
import { colors } from '../theme'

export type IconName =
  | 'home'
  | 'calendar'
  | 'chart'
  | 'settings'
  | 'bell'
  | 'plus'
  | 'droplet'
  | 'flower'
  | 'leaf'
  | 'chevronLeft'
  | 'chevronRight'
  | 'arrowLeft'
  | 'arrowRight'
  | 'check'
  | 'close'
  | 'lock'
  | 'shield'
  | 'heart'
  | 'sparkles'
  | 'target'
  | 'pencil'
  | 'trash'
  | 'info'
  | 'clock'
  | 'pill'
  | 'moon'

interface IconProps {
  name: IconName
  size?: number
  color?: string
  strokeWidth?: number
}

export function Icon({
  name,
  size = 24,
  color = colors.textPrimary,
  strokeWidth = 2,
}: IconProps): React.JSX.Element {
  const stroke = color
  const common = {
    stroke,
    strokeWidth,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    fill: 'none' as const,
  }

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {renderIcon(name, common, color)}
    </Svg>
  )
}

function renderIcon(
  name: IconName,
  c: {
    stroke: string
    strokeWidth: number
    strokeLinecap: 'round'
    strokeLinejoin: 'round'
    fill: 'none'
  },
  color: string,
): React.JSX.Element {
  switch (name) {
    case 'home':
      return (
        <>
          <Path d="M3 11 L12 3 L21 11" {...c} />
          <Path d="M5 9.5 V20 H19 V9.5" {...c} />
          <Path d="M9.5 20 V14 H14.5 V20" {...c} />
        </>
      )

    case 'calendar':
      return (
        <>
          <Rect x="3.5" y="5" width="17" height="16" rx="2.5" {...c} />
          <Line x1="3.5" y1="9.5" x2="20.5" y2="9.5" {...c} />
          <Line x1="8" y1="3" x2="8" y2="6.5" {...c} />
          <Line x1="16" y1="3" x2="16" y2="6.5" {...c} />
        </>
      )

    case 'chart':
      return (
        <>
          <Line x1="4" y1="20" x2="20" y2="20" {...c} />
          <Rect x="6" y="12" width="3.2" height="6" rx="1" {...c} />
          <Rect x="11.4" y="8" width="3.2" height="10" rx="1" {...c} />
          <Rect x="16.8" y="5" width="3.2" height="13" rx="1" {...c} />
        </>
      )

    case 'settings':
      return (
        <>
          <Circle cx="12" cy="12" r="3" {...c} />
          <Path
            d="M12 2.5 L13.4 5 A7.5 7.5 0 0 1 16 6.6 L18.8 6 L20.5 9 L18.6 11 A7.5 7.5 0 0 1 18.6 13 L20.5 15 L18.8 18 L16 17.4 A7.5 7.5 0 0 1 13.4 19 L12 21.5 L10.6 19 A7.5 7.5 0 0 1 8 17.4 L5.2 18 L3.5 15 L5.4 13 A7.5 7.5 0 0 1 5.4 11 L3.5 9 L5.2 6 L8 6.6 A7.5 7.5 0 0 1 10.6 5 Z"
            {...c}
          />
        </>
      )

    case 'bell':
      return (
        <>
          <Path d="M6 9 A6 6 0 0 1 18 9 C18 14 19.5 16 19.5 16 H4.5 C4.5 16 6 14 6 9 Z" {...c} />
          <Path d="M10 19 A2 2 0 0 0 14 19" {...c} />
        </>
      )

    case 'plus':
      return (
        <>
          <Line x1="12" y1="5" x2="12" y2="19" {...c} />
          <Line x1="5" y1="12" x2="19" y2="12" {...c} />
        </>
      )

    case 'droplet':
      return <Path d="M12 3 C12 3 5.5 10 5.5 14.5 A6.5 6.5 0 0 0 18.5 14.5 C18.5 10 12 3 12 3 Z" {...c} />

    case 'flower':
      return (
        <>
          <Circle cx="12" cy="12" r="2.5" {...c} />
          <Path d="M12 9.5 C10 6 14 6 12 9.5" {...c} />
          <Path d="M14.5 12 C18 10 18 14 14.5 12" {...c} />
          <Path d="M12 14.5 C14 18 10 18 12 14.5" {...c} />
          <Path d="M9.5 12 C6 14 6 10 9.5 12" {...c} />
        </>
      )

    case 'leaf':
      return (
        <>
          <Path d="M5 19 C5 11 11 5 19 5 C19 13 13 19 5 19 Z" {...c} />
          <Line x1="5" y1="19" x2="14" y2="10" {...c} />
        </>
      )

    case 'chevronLeft':
      return <Polyline points="15 5 8 12 15 19" {...c} />

    case 'chevronRight':
      return <Polyline points="9 5 16 12 9 19" {...c} />

    case 'arrowLeft':
      return (
        <>
          <Line x1="20" y1="12" x2="4" y2="12" {...c} />
          <Polyline points="10 6 4 12 10 18" {...c} />
        </>
      )

    case 'arrowRight':
      return (
        <>
          <Line x1="4" y1="12" x2="20" y2="12" {...c} />
          <Polyline points="14 6 20 12 14 18" {...c} />
        </>
      )

    case 'check':
      return <Polyline points="5 13 10 18 19 6" {...c} />

    case 'close':
      return (
        <>
          <Line x1="6" y1="6" x2="18" y2="18" {...c} />
          <Line x1="18" y1="6" x2="6" y2="18" {...c} />
        </>
      )

    case 'lock':
      return (
        <>
          <Rect x="5" y="11" width="14" height="9" rx="2" {...c} />
          <Path d="M8 11 V8 A4 4 0 0 1 16 8 V11" {...c} />
          <Circle cx="12" cy="15.5" r="1.2" fill={color} stroke="none" />
        </>
      )

    case 'shield':
      return (
        <>
          <Path d="M12 3 L19 6 V11 C19 16 12 21 12 21 C12 21 5 16 5 11 V6 Z" {...c} />
          <Polyline points="9 12 11 14 15 9.5" {...c} />
        </>
      )

    case 'heart':
      return (
        <Path
          d="M12 20 C12 20 4 14.5 4 9 A4 4 0 0 1 12 7 A4 4 0 0 1 20 9 C20 14.5 12 20 12 20 Z"
          {...c}
        />
      )

    case 'sparkles':
      return (
        <>
          <Path d="M12 4 L13.4 9.6 L19 11 L13.4 12.4 L12 18 L10.6 12.4 L5 11 L10.6 9.6 Z" {...c} />
          <Path d="M18 16 L18.6 18 L20.5 18.5 L18.6 19 L18 21 L17.4 19 L15.5 18.5 L17.4 18 Z" {...c} />
        </>
      )

    case 'target':
      return (
        <>
          <Circle cx="12" cy="12" r="8" {...c} />
          <Circle cx="12" cy="12" r="4" {...c} />
          <Circle cx="12" cy="12" r="1" fill={color} stroke="none" />
        </>
      )

    case 'pencil':
      return (
        <>
          <Path d="M4 20 L4 16 L15 5 L19 9 L8 20 Z" {...c} />
          <Line x1="13" y1="7" x2="17" y2="11" {...c} />
        </>
      )

    case 'trash':
      return (
        <>
          <Line x1="4.5" y1="7" x2="19.5" y2="7" {...c} />
          <Path d="M9 7 V5 A1.5 1.5 0 0 1 10.5 3.5 H13.5 A1.5 1.5 0 0 1 15 5 V7" {...c} />
          <Path d="M6.5 7 L7.5 20 A1.5 1.5 0 0 0 9 21.5 H15 A1.5 1.5 0 0 0 16.5 20 L17.5 7" {...c} />
        </>
      )

    case 'info':
      return (
        <>
          <Circle cx="12" cy="12" r="9" {...c} />
          <Line x1="12" y1="11" x2="12" y2="16" {...c} />
          <Circle cx="12" cy="8" r="0.6" fill={color} stroke="none" />
        </>
      )

    case 'clock':
      return (
        <>
          <Circle cx="12" cy="12" r="9" {...c} />
          <Polyline points="12 7 12 12 16 14" {...c} />
        </>
      )

    case 'pill':
      return (
        <>
          <Rect x="3.5" y="8" width="17" height="8" rx="4" {...c} />
          <Line x1="12" y1="8" x2="12" y2="16" {...c} />
        </>
      )

    case 'moon':
      return <Path d="M19 13 A8 8 0 1 1 11 4 A6.5 6.5 0 0 0 19 13 Z" {...c} />

    default:
      return <Circle cx="12" cy="12" r="8" {...c} />
  }
}
