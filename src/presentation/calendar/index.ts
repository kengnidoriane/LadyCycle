/**
 * presentation/calendar — Calendrier du cycle menstruel et formulaires de saisie.
 *
 * Exports publics :
 * - CalendarScreen    : écran principal avec calendrier, phases et prédictions
 * - RecordPeriodForm  : formulaire d'enregistrement d'une menstruation
 * - SymptomForm       : formulaire de saisie des symptômes (catégorie, type, intensité)
 * - CycleCalendarGrid : grille calendrier mensuelle avec phases colorées
 * - OvulationBlurZone : zone de flou visuelle pour l'ovulation prédite
 * - ConfidenceBadge   : indicateur de confiance avec explication
 * - DatePickerField   : sélecteur de date CalendarDate
 * - useCalendar       : hook React pour les données du calendrier
 *
 * Exigences : 12.1, 12.2, 12.3, 12.4, 2.6, 1.1, 1.2, 1.3, 5.1, 5.2, 5.3, 5.4
 */

export { CalendarScreen } from './CalendarScreen'
export { RecordPeriodForm } from './RecordPeriodForm'
export { SymptomForm } from './SymptomForm'
export { CycleCalendarGrid } from './CycleCalendarGrid'
export { OvulationBlurZone } from './OvulationBlurZone'
export { ConfidenceBadge } from './ConfidenceBadge'
export { DatePickerField } from './DatePickerField'
export { useCalendar, getPhaseColor, getDayPhase } from './useCalendar'
