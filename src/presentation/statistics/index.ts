/**
 * presentation/statistics — Statistiques, historique et détail des cycles.
 *
 * Exports publics :
 * - StatisticsScreen   : écran principal avec statistiques et historique
 * - CycleDetailScreen  : vue détail d'un cycle avec symptômes et marquage exceptionnel
 * - CycleDurationChart : graphique d'évolution des durées (≥ 6 cycles)
 * - useStatistics      : hook React pour les données des statistiques
 *
 * Exigences : 7.1, 7.2, 7.3, 7.4, 7.5, 13.1, 13.3, 13.4
 */

export { StatisticsScreen } from './StatisticsScreen'
export { CycleDetailScreen } from './CycleDetailScreen'
export { CycleDurationChart } from './CycleDurationChart'
export { useStatistics, formatRegularity, formatDuration, formatDate } from './useStatistics'
