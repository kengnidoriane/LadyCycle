/**
 * presentation/wellness — Conseils de bien-être personnalisés.
 *
 * Exports publics :
 * - WellnessScreen  : écran principal avec les conseils du jour par phase et mode
 * - useWellness     : hook React pour les données de bien-être
 * - getPhaseInfo    : helper pour les labels et couleurs de phase
 * - getCategoryLabel : helper pour les labels de catégorie de conseil
 * - getCategoryColor : helper pour les couleurs de catégorie de conseil
 *
 * Exigences : 11.1, 11.2, 11.3, 11.4, 11.5
 */

export { WellnessScreen } from './WellnessScreen'
export { useWellness, getPhaseInfo, getCategoryLabel, getCategoryColor } from './useWellness'
