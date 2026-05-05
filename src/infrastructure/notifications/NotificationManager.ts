import type { CalendarDate, UTCTimestamp, Result, Option } from '../../domain/shared/types'
import type { Prediction, DateRange, OvulationWindow } from '../../domain/cycle/types'
import { ErrorCode, createError } from '../../domain/shared/errors'
import { err, ok } from '../../domain/shared/types'

/**
 * Mode de suivi de l'utilisatrice.
 * Détermine quelles notifications sont pertinentes.
 */
export type TrackingMode = 'general' | 'trying_to_conceive' | 'natural_contraception'

/**
 * Préférences de notification de l'utilisatrice.
 */
export interface NotificationPreferences {
  /** Notifications activées globalement */
  enabled: boolean

  /** Jours d'avance pour les notifications de règles (ex: [3, 1] = 3 jours avant + 1 jour avant) */
  periodAdvanceNoticeDays: number[]

  /** Jours d'avance pour la notification de période féconde */
  fertileWindowAdvanceNoticeDays: number

  /** Rappels de médicaments activés */
  medicationRemindersEnabled: boolean
}

/**
 * Rappel de médicament configuré par l'utilisatrice.
 */
export interface MedicationReminder {
  id: string
  name: string
  frequency: 'once_per_cycle' | 'daily' | 'custom'
  timingBeforePeriod: number  // jours avant les règles
  timeOfDay: string           // "HH:MM" en heure locale
  enabled: boolean
  createdAt: UTCTimestamp
  updatedAt: UTCTimestamp
}

/**
 * Log d'une prise de médicament.
 * Stocké dans medication_logs avec un horodatage UTC précis.
 */
export interface MedicationLog {
  id: string
  reminderId: string
  scheduledDate: CalendarDate  // Date prévue (YYYY-MM-DD)
  takenAt: Option<UTCTimestamp>  // Heure exacte de prise (ISO 8601 UTC)
  skipped: boolean
}

/**
 * Type de notification planifiée.
 * Utilisé pour identifier et annuler les notifications par type.
 */
type NotificationType = 'period' | 'fertile_window' | 'medication'

/**
 * Notification planifiée avec identifiant unique.
 */
interface ScheduledNotification {
  id: string
  type: NotificationType
  scheduledDate: CalendarDate
  title: string
  body: string
  data?: Record<string, unknown>
}

/**
 * NotificationManager — Gestionnaire des notifications locales.
 *
 * Responsabilités :
 * - Planifier les notifications pour les règles et la période féconde
 * - Gérer les rappels de médicaments
 * - Respecter les préférences utilisateur
 * - Gérer les permissions de notification de manière gracieuse
 *
 * Implémentation actuelle : Mock pour développement sans émulateur.
 * À remplacer par une vraie implémentation avec @react-native-community/push-notification-ios
 * ou react-native-push-notification pour la production.
 *
 * Pourquoi un mock ? Les notifications natives nécessitent un émulateur ou un appareil réel.
 * Ce mock permet de tester la logique métier (calcul des dates, respect des préférences)
 * sans dépendances natives.
 */
export class NotificationManager {
  private scheduledNotifications: Map<string, ScheduledNotification> = new Map()
  private medicationLogs: Map<string, MedicationLog[]> = new Map()
  private permissionsGranted: boolean = true  // Mock : permissions accordées par défaut

  /**
   * Demander les permissions de notification.
   * En production, appelle l'API native (iOS/Android).
   */
  async requestPermissions(): Promise<boolean> {
    // Mock : retourne toujours true
    // En production : utiliser react-native-permissions ou l'API native
    return this.permissionsGranted
  }

  /**
   * Vérifier si les permissions sont accordées.
   */
  async checkPermissions(): Promise<boolean> {
    return this.permissionsGranted
  }

  /**
   * Planifier les notifications pour les prochaines règles.
   *
   * Algorithme :
   * 1. Vérifier que les notifications sont activées
   * 2. Annuler les anciennes notifications de règles
   * 3. Pour chaque délai configuré (ex: [3, 1]), planifier une notification
   *    à la date prédite - délai
   *
   * @param prediction Prédiction des prochaines règles
   * @param preferences Préférences de notification
   */
  async schedulePeriodNotifications(
    prediction: Prediction<DateRange>,
    preferences: NotificationPreferences,
  ): Promise<void> {
    // Si les notifications sont désactivées, ne rien faire
    if (!preferences.enabled) {
      return
    }

    // Vérifier les permissions
    const hasPermissions = await this.checkPermissions()
    if (!hasPermissions) {
      console.warn('Notification permissions not granted. Skipping period notifications.')
      return
    }

    // Annuler les anciennes notifications de règles
    this.cancelNotificationsByType('period')

    // Planifier une notification pour chaque délai configuré
    const predictedDate = prediction.value.startDate
    for (let index = 0; index < preferences.periodAdvanceNoticeDays.length; index++) {
      const daysAdvance = preferences.periodAdvanceNoticeDays[index]
      const notificationDate = this.subtractDays(predictedDate, daysAdvance)
      // Include index to ensure uniqueness when delays array has duplicates
      const notificationId = `period_${daysAdvance}d_${predictedDate}_${index}`

      const notification: ScheduledNotification = {
        id: notificationId,
        type: 'period',
        scheduledDate: notificationDate,
        title: 'Règles prévues bientôt',
        body: `Vos règles sont prévues dans ${daysAdvance} jour${daysAdvance > 1 ? 's' : ''}`,
        data: {
          predictedDate,
          daysAdvance,
          confidence: prediction.confidence.level,
        },
      }

      this.scheduledNotifications.set(notificationId, notification)
      console.log(`[NotificationManager] Scheduled period notification: ${notificationId} on ${notificationDate}`)
    }
  }

  /**
   * Planifier les notifications pour la période féconde.
   *
   * Algorithme :
   * 1. Vérifier que les notifications sont activées
   * 2. Adapter le message selon le mode de suivi :
   *    - trying_to_conceive : "Période féconde optimale"
   *    - natural_contraception : "Attention : période à risque"
   *    - general : "Période féconde"
   * 3. Planifier la notification au début de la fenêtre - délai configuré
   *
   * @param prediction Prédiction de l'ovulation
   * @param mode Mode de suivi actuel
   * @param preferences Préférences de notification
   */
  async scheduleFertileWindowNotifications(
    prediction: Prediction<OvulationWindow>,
    mode: TrackingMode,
    preferences: NotificationPreferences,
  ): Promise<void> {
    // Check if notifications are enabled globally
    if (!preferences.enabled) {
      return
    }

    const hasPermissions = await this.checkPermissions()
    if (!hasPermissions) {
      console.warn('Notification permissions not granted. Skipping fertile window notifications.')
      return
    }

    // Annuler les anciennes notifications de période féconde
    this.cancelNotificationsByType('fertile_window')

    // Adapter le message selon le mode
    let title: string
    let body: string

    switch (mode) {
      case 'trying_to_conceive':
        title = 'Période féconde optimale'
        body = 'Votre période féconde commence bientôt. C\'est le moment idéal pour concevoir.'
        break
      case 'natural_contraception':
        title = 'Attention : période à risque'
        body = 'Votre période féconde commence bientôt. Soyez vigilante si vous utilisez la contraception naturelle.'
        break
      case 'general':
      default:
        title = 'Période féconde'
        body = 'Votre période féconde commence bientôt.'
        break
    }

    // Planifier la notification
    const fertileWindowStart = prediction.value.fertileWindowStart
    const daysAdvance = preferences.fertileWindowAdvanceNoticeDays
    const notificationDate = this.subtractDays(fertileWindowStart, daysAdvance)
    const notificationId = `fertile_window_${fertileWindowStart}`

    const notification: ScheduledNotification = {
      id: notificationId,
      type: 'fertile_window',
      scheduledDate: notificationDate,
      title,
      body,
      data: {
        fertileWindowStart,
        fertileWindowEnd: prediction.value.fertileWindowEnd,
        ovulationDate: prediction.value.estimatedDate,
        mode,
      },
    }

    this.scheduledNotifications.set(notificationId, notification)
    console.log(`[NotificationManager] Scheduled fertile window notification: ${notificationId} on ${notificationDate}`)
  }

  /**
   * Ajouter un rappel de médicament.
   *
   * Le rappel est stocké mais pas encore planifié. La planification se fait
   * automatiquement quand les prochaines règles sont prédites (via scheduleMedicationReminders).
   *
   * @param reminder Configuration du rappel
   * @returns L'ID du rappel créé, ou une erreur de validation
   */
  addMedicationReminder(reminder: MedicationReminder): Result<string, ValidationError> {
    // Validation basique
    if (!reminder.name || reminder.name.trim() === '') {
      return err(createError(
        ErrorCode.MISSING_REQUIRED_FIELD,
        'Le nom du médicament est requis',
        { field: 'name' },
      ))
    }

    if (reminder.timingBeforePeriod < 0 || reminder.timingBeforePeriod > 30) {
      return err(createError(
        ErrorCode.INVALID_DATE_RANGE,
        'Le délai avant les règles doit être entre 0 et 30 jours',
        { timingBeforePeriod: reminder.timingBeforePeriod },
      ))
    }

    // Valider le format de l'heure (HH:MM)
    const timeRegex = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/
    if (!timeRegex.test(reminder.timeOfDay)) {
      return err(createError(
        ErrorCode.INVALID_DATE_FORMAT,
        'Le format de l\'heure doit être HH:MM',
        { timeOfDay: reminder.timeOfDay },
      ))
    }

    console.log(`[NotificationManager] Added medication reminder: ${reminder.id} - ${reminder.name}`)
    return ok(reminder.id)
  }

  /**
   * Planifier les rappels de médicaments pour un cycle prédit.
   *
   * Appelé automatiquement quand les prochaines règles sont prédites.
   * Pour chaque rappel actif, planifie une notification à la date prédite - délai.
   *
   * @param reminders Liste des rappels configurés
   * @param predictedPeriodDate Date prédite des prochaines règles
   * @param preferences Préférences de notification
   */
  async scheduleMedicationReminders(
    reminders: MedicationReminder[],
    predictedPeriodDate: CalendarDate,
    preferences: NotificationPreferences,
  ): Promise<void> {
    // Check if notifications are enabled globally
    if (!preferences.enabled) {
      return
    }

    // Check specifically for medication reminders enabled
    if (!preferences.medicationRemindersEnabled) {
      return
    }

    const hasPermissions = await this.checkPermissions()
    if (!hasPermissions) {
      console.warn('Notification permissions not granted. Skipping medication reminders.')
      return
    }

    // Annuler les anciens rappels de médicaments
    this.cancelNotificationsByType('medication')

    // Planifier chaque rappel actif
    for (const reminder of reminders) {
      if (!reminder.enabled) {
        continue
      }

      const notificationDate = this.subtractDays(predictedPeriodDate, reminder.timingBeforePeriod)
      const notificationId = `medication_${reminder.id}_${predictedPeriodDate}`

      const notification: ScheduledNotification = {
        id: notificationId,
        type: 'medication',
        scheduledDate: notificationDate,
        title: `Rappel : ${reminder.name}`,
        body: `N'oubliez pas de prendre ${reminder.name} à ${reminder.timeOfDay}`,
        data: {
          reminderId: reminder.id,
          medicationName: reminder.name,
          timeOfDay: reminder.timeOfDay,
          scheduledDate: notificationDate,
        },
      }

      this.scheduledNotifications.set(notificationId, notification)
      console.log(`[NotificationManager] Scheduled medication reminder: ${notificationId} on ${notificationDate}`)
    }
  }

  /**
   * Marquer une prise de médicament comme effectuée.
   *
   * Enregistre un horodatage UTC précis (pas une CalendarDate) dans medication_logs.
   * C'est une information médicale précise : "J'ai pris mon ibuprofène à 14h32 UTC".
   *
   * @param reminderId ID du rappel
   * @param takenAt Horodatage UTC précis de la prise
   */
  markMedicationTaken(reminderId: string, takenAt: UTCTimestamp): void {
    // Extraire la date calendrier du timestamp pour le log
    const scheduledDate = takenAt.split('T')[0] as CalendarDate

    const log: MedicationLog = {
      id: `log_${reminderId}_${takenAt}`,
      reminderId,
      scheduledDate,
      takenAt,
      skipped: false,
    }

    // Ajouter le log à la liste des logs pour ce rappel
    const logs = this.medicationLogs.get(reminderId) || []
    logs.push(log)
    this.medicationLogs.set(reminderId, logs)

    console.log(`[NotificationManager] Medication taken: ${reminderId} at ${takenAt}`)
  }

  /**
   * Obtenir l'historique des prises pour un rappel.
   *
   * @param reminderId ID du rappel
   * @returns Liste des logs de prise
   */
  getMedicationLogs(reminderId: string): MedicationLog[] {
    return this.medicationLogs.get(reminderId) || []
  }

  /**
   * Annuler toutes les notifications planifiées.
   *
   * Utilisé quand l'utilisatrice désactive les notifications dans les paramètres.
   */
  cancelAllNotifications(): void {
    this.scheduledNotifications.clear()
    console.log('[NotificationManager] All notifications cancelled')
  }

  /**
   * Annuler les notifications d'un type spécifique.
   *
   * @param type Type de notification à annuler
   */
  private cancelNotificationsByType(type: NotificationType): void {
    const toDelete: string[] = []

    // Convert to array to avoid iterator issues
    const entries = Array.from(this.scheduledNotifications.entries())
    for (const [id, notification] of entries) {
      if (notification.type === type) {
        toDelete.push(id)
      }
    }

    for (const id of toDelete) {
      this.scheduledNotifications.delete(id)
    }

    console.log(`[NotificationManager] Cancelled ${toDelete.length} notifications of type: ${type}`)
  }

  /**
   * Obtenir toutes les notifications planifiées (pour tests).
   */
  getScheduledNotifications(): ScheduledNotification[] {
    return Array.from(this.scheduledNotifications.values())
  }

  /**
   * Soustraire des jours à une CalendarDate.
   *
   * @param date Date au format YYYY-MM-DD
   * @param days Nombre de jours à soustraire
   * @returns Nouvelle date au format YYYY-MM-DD
   */
  private subtractDays(date: CalendarDate, days: number): CalendarDate {
    const d = new Date(date)
    d.setDate(d.getDate() - days)
    return d.toISOString().split('T')[0] as CalendarDate
  }
}

// ── Types d'erreur ────────────────────────────────────────────────────────────

type ValidationError = {
  code: ErrorCode
  message: string
  details?: unknown
  timestamp: UTCTimestamp
}
