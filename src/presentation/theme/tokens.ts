/**
 * Design tokens — source unique de vérité pour l'apparence de LadyCycle.
 *
 * Toute couleur, espacement, rayon, typographie ou ombre utilisé dans l'UI
 * provient de ce fichier. Aucune valeur codée en dur dans les écrans.
 *
 * Palette : rose doux et mûr (pas criard), accents teal / bleu / violet
 * pour les phases du cycle. Pensé pour un rendu clean, prêt pour le Play Store.
 */

// ─── Palette de base (échelles de couleur) ──────────────────────────────────

const pink = {
  50: '#FBEAF0',
  100: '#F4C0D1',
  200: '#ED93B1',
  400: '#D4537E', // couleur primaire de la marque
  600: '#993556',
  800: '#72243E',
  900: '#4B1528',
} as const

const teal = {
  50: '#E1F5EE',
  200: '#5DCAA5',
  400: '#1D9E75',
  600: '#0F6E56',
  800: '#085041',
} as const

const amber = {
  50: '#FAEEDA',
  200: '#FAC775',
  400: '#EF9F27',
  600: '#854F0B',
} as const

const purple = {
  50: '#EEEDFE',
  200: '#AFA9EC',
  400: '#7F77DD',
  600: '#534AB7',
  800: '#3C3489',
} as const

const blue = {
  50: '#E6F1FB',
  400: '#378ADD',
  600: '#185FA5',
} as const

const neutral = {
  0: '#FFFFFF',
  50: '#FBF9F7', // fond d'écran chaud et doux
  100: '#F4F1EC',
  200: '#ECEAE4', // bordures
  300: '#DDDAD2',
  500: '#9E9C97', // texte tertiaire / hints
  600: '#6B6A66', // texte secondaire
  800: '#3A3936',
  900: '#2C2C2A', // texte principal
} as const

// ─── Tokens sémantiques ──────────────────────────────────────────────────────

export const colors = {
  // Marque
  primary: pink[400],
  primaryDark: pink[600],
  primaryDarker: pink[800],
  primarySoft: pink[50],
  primaryMuted: pink[100],

  // Surfaces & fonds
  background: neutral[50],
  surface: neutral[0],
  surfaceAlt: neutral[100],
  border: neutral[200],
  borderStrong: neutral[300],

  // Texte
  textPrimary: neutral[900],
  textSecondary: neutral[600],
  textTertiary: neutral[500],
  textInverse: neutral[0],

  // Phases du cycle
  phase: {
    menstrual: { main: pink[400], soft: pink[50], text: pink[800] },
    follicular: { main: teal[400], soft: teal[50], text: teal[800] },
    ovulation: { main: amber[400], soft: amber[50], text: amber[600] },
    luteal: { main: purple[400], soft: purple[50], text: purple[800] },
  },

  // Niveaux de confiance des prédictions
  confidence: {
    low: { main: '#E24B4A', soft: '#FCEBEB', text: '#A32D2D' },
    medium: { main: amber[400], soft: amber[50], text: amber[600] },
    high: { main: teal[400], soft: teal[50], text: teal[600] },
  },

  // États sémantiques
  success: teal[400],
  successSoft: teal[50],
  warning: amber[400],
  danger: '#E24B4A',
  dangerSoft: '#FCEBEB',
  info: blue[400],
  infoSoft: blue[50],
  infoText: blue[600],

  // Accents utilitaires
  fertile: { main: teal[400], soft: teal[50], text: teal[600] },
} as const

// ─── Échelle d'espacement (base 4) ────────────────────────────────────────────

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const

// ─── Rayons de bordure ──────────────────────────────────────────────────────

export const radii = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
  pill: 999,
} as const

// ─── Typographie ──────────────────────────────────────────────────────────────

export const typography = {
  display: { fontSize: 40, fontWeight: '700' as const, letterSpacing: -0.5 },
  h1: { fontSize: 26, fontWeight: '700' as const, letterSpacing: -0.3 },
  h2: { fontSize: 20, fontWeight: '700' as const },
  h3: { fontSize: 17, fontWeight: '600' as const },
  body: { fontSize: 15, fontWeight: '400' as const },
  bodyStrong: { fontSize: 15, fontWeight: '600' as const },
  caption: { fontSize: 13, fontWeight: '400' as const },
  label: { fontSize: 12, fontWeight: '600' as const },
  tiny: { fontSize: 10, fontWeight: '500' as const },
} as const

// ─── Ombres (multi-plateforme) ────────────────────────────────────────────────

export const shadows = {
  none: {},
  sm: {
    shadowColor: '#1A1A1A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  md: {
    shadowColor: '#1A1A1A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07,
    shadowRadius: 12,
    elevation: 3,
  },
  primary: {
    shadowColor: pink[400],
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.28,
    shadowRadius: 14,
    elevation: 5,
  },
} as const

export const theme = { colors, spacing, radii, typography, shadows } as const
export type Theme = typeof theme
