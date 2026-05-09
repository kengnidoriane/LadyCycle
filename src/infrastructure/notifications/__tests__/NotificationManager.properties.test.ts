/**
 * Property-Based Tests for NotificationManager
 *
 * Ces tests utilisent fast-check pour vérifier que les propriétés de correction
 * sont respectées pour toutes les entrées valides générées aléatoirement.
 *
 * Feature: suivi-cycle-menstruel
 */

import * as fc from 'fast-check'
import { NotificationManager } from '../NotificationManager'
import type {
  NotificationPreferences,
  MedicationReminder,
  TrackingMode,
} from '../NotificationManager'
import type { Prediction, DateRange, OvulationWindow } from '../../../domain/cycle/types'
import type { CalendarDate, UTCTimestamp } from '../../../domain/shared/types'

// ── Générateurs fast-check ────────────────────────────────────────────────────

/**
 * Générateur de CalendarDate (YYYY-MM-DD).
 * Génère des dates entre 2020 et 2030.
 * Uses integer-based generation to avoid invalid dates.
 */
const calendarDateArb = fc
  .tuple(
    fc.integer({ min: 2020, max: 2030 }), // year
    fc.integer({ min: 1, max: 12 }),      // month
    fc.integer({ min: 1, max: 28 })       // day (1-28 to avoid invalid dates like Feb 30)
  )
  .map(([year, month, day]) => {
    const monthStr = month.toString().padStart(2, '0')
    const dayStr = day.toString().padStart(2, '0')
    return `${year}-${monthStr}-${dayStr}` as CalendarDate
  })

/**
 * Générateur de UTCTimestamp (ISO 8601).
 * Uses integer-based generation to avoid invalid dates.
 */
const utcTimestampArb = fc
  .tuple(
    fc.integer({ min: 2020, max: 2030 }), // year
    fc.integer({ min: 1, max: 12 }),      // month
    fc.integer({ min: 1, max: 28 }),      // day
    fc.integer({ min: 0, max: 23 }),      // hour
    fc.integer({ min: 0, max: 59 }),      // minute
    fc.integer({ min: 0, max: 59 }),      // second
    fc.integer({ min: 0, max: 999 })      // millisecond
  )
  .map(([year, month, day, hour, minute, second, ms]) => {
    const monthStr = month.toString().padStart(2, '0')
    const dayStr = day.toString().padStart(2, '0')
    const hourStr = hour.toString().padStart(2, '0')
    const minuteStr = minute.toString().padStart(2, '0')
    const secondStr = second.toString().padStart(2, '0')
    const msStr = ms.toString().padStart(3, '0')
    return `${year}-${monthStr}-${dayStr}T${hourStr}:${minuteStr}:${secondStr}.${msStr}Z` as UTCTimestamp
  })

/**
 * Générateur de délais de notification (1-7 jours).
 */
const notificationDelayArb = fc.integer({ min: 1, max: 7 })

/**
 * Générateur de liste de délais de notification.
 */
const notificationDelaysArb = fc.array(notificationDelayArb, { minLength: 1, maxLength: 5 })

/**
 * Générateur de NotificationPreferences.
 */
const notificationPreferencesArb = fc.record({
  enabled: fc.boolean(),
  periodAdvanceNoticeDays: notificationDelaysArb,
  fertileWindowAdvanceNoticeDays: notificationDelayArb,
  medicationRemindersEnabled: fc.boolean(),
})

/**
 * Générateur de Prediction<DateRange> pour les règles.
 */
const periodPredictionArb = fc
  .tuple(calendarDateArb, fc.integer({ min: 3, max: 7 }))
  .map(([startDate, duration]) => {
    const start = new Date(startDate)
    const end = new Date(start)
    end.setDate(end.getDate() + duration - 1)
    const endDate = end.toISOString().split('T')[0] as CalendarDate

    return {
      value: {
        startDate,
        endDate,
      },
      confidence: {
        level: 'high' as const,
        explanation: null,
        standardDeviation: 1.5,
      },
      calculatedAt: new Date().toISOString() as UTCTimestamp,
    } as Prediction<DateRange>
  })

/**
 * Générateur de Prediction<OvulationWindow>.
 */
const ovulationPredictionArb = calendarDateArb.map((estimatedDate) => {
  const ovulationDate = new Date(estimatedDate)
  const fertileStart = new Date(ovulationDate)
  fertileStart.setDate(fertileStart.getDate() - 5)
  const fertileEnd = new Date(ovulationDate)
  fertileEnd.setDate(fertileEnd.getDate() + 1)

  return {
    value: {
      estimatedDate,
      fertileWindowStart: fertileStart.toISOString().split('T')[0] as CalendarDate,
      fertileWindowEnd: fertileEnd.toISOString().split('T')[0] as CalendarDate,
      isBlurred: true as const,
    },
    confidence: {
      level: 'high' as const,
      explanation: null,
      standardDeviation: 1.5,
    },
    calculatedAt: new Date().toISOString() as UTCTimestamp,
  } as Prediction<OvulationWindow>
})

/**
 * Générateur de TrackingMode.
 */
const trackingModeArb = fc.constantFrom<TrackingMode>(
  'general',
  'trying_to_conceive',
  'natural_contraception',
)

/**
 * Générateur de MedicationReminder.
 */
const medicationReminderArb = fc.record({
  id: fc.uuid(),
  name: fc.string({ minLength: 1, maxLength: 50 }),
  frequency: fc.constantFrom<'once_per_cycle' | 'daily' | 'custom'>(
    'once_per_cycle',
    'daily',
    'custom',
  ),
  timingBeforePeriod: fc.integer({ min: 0, max: 7 }),
  timeOfDay: fc
    .tuple(fc.integer({ min: 0, max: 23 }), fc.integer({ min: 0, max: 59 }))
    .map(([h, m]) => `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`),
  enabled: fc.boolean(),
  createdAt: utcTimestampArb,
  updatedAt: utcTimestampArb,
})

// ── Helpers ────────────────────────────────────────────────────────────────────

/**
 * Soustraire des jours à une CalendarDate.
 */
function subtractDays(date: CalendarDate, days: number): CalendarDate {
  const d = new Date(date)
  d.setDate(d.getDate() - days)
  return d.toISOString().split('T')[0] as CalendarDate
}

// ── Tests de Propriété ─────────────────────────────────────────────────────────

describe('NotificationManager - Property-Based Tests', () => {
  /**
   * Feature: suivi-cycle-menstruel
   * Property 10: Planification des notifications selon les préférences
   *
   * **Validates: Requirements 4.1, 4.2, 4.5**
   *
   * Pour toute prédiction de règles à la date D et toute configuration de
   * notifications avec des délais [d1, d2, ..., dn], le système doit planifier
   * exactement n notifications aux dates [D - d1, D - d2, ..., D - dn].
   */
  test('Property 10: Notifications are scheduled according to preferences', async () => {
    await fc.assert(
      fc.asyncProperty(
        periodPredictionArb,
        notificationDelaysArb,
        async (prediction, delays) => {
          const manager = new NotificationManager()

          // Créer des préférences actives
          const preferences: NotificationPreferences = {
            enabled: true,
            periodAdvanceNoticeDays: delays,
            fertileWindowAdvanceNoticeDays: 1,
            medicationRemindersEnabled: false,
          }

          // Planifier les notifications
          await manager.schedulePeriodNotifications(prediction, preferences)

          // Vérifier que le nombre de notifications planifiées correspond
          const scheduled = manager.getScheduledNotifications()
          const periodNotifications = scheduled.filter((n) => n.type === 'period')

          expect(periodNotifications).toHaveLength(delays.length)

          // Vérifier que chaque notification est planifiée à la bonne date
          const predictedDate = prediction.value.startDate
          const expectedDates = delays.map((delay) => subtractDays(predictedDate, delay))

          for (const notification of periodNotifications) {
            expect(expectedDates).toContain(notification.scheduledDate)
          }
        },
      ),
      { numRuns: 100 },
    )
  })

  /**
   * Feature: suivi-cycle-menstruel
   * Property 11: Désactivation complète des notifications
   *
   * **Validates: Requirement 4.4**
   *
   * Pour tout état du système avec des notifications planifiées, la désactivation
   * des notifications doit annuler toutes les notifications planifiées, résultant
   * en zéro notification active.
   */
  test('Property 11: Disabling notifications cancels all scheduled notifications', async () => {
    await fc.assert(
      fc.asyncProperty(
        periodPredictionArb,
        notificationDelaysArb,
        async (prediction, delays) => {
          const manager = new NotificationManager()

          // Planifier des notifications
          const preferences: NotificationPreferences = {
            enabled: true,
            periodAdvanceNoticeDays: delays,
            fertileWindowAdvanceNoticeDays: 1,
            medicationRemindersEnabled: false,
          }
          await manager.schedulePeriodNotifications(prediction, preferences)

          // Vérifier qu'il y a des notifications planifiées
          const beforeCancel = manager.getScheduledNotifications()
          expect(beforeCancel.length).toBeGreaterThan(0)

          // Annuler toutes les notifications
          manager.cancelAllNotifications()

          // Vérifier qu'il n'y a plus de notifications
          const afterCancel = manager.getScheduledNotifications()
          expect(afterCancel).toHaveLength(0)
        },
      ),
      { numRuns: 100 },
    )
  })

  /**
   * Feature: suivi-cycle-menstruel
   * Property 14: Planification automatique des rappels de médicaments
   *
   * **Validates: Requirement 6.2**
   *
   * Pour tout rappel de médicament configuré avec un délai de t jours avant les
   * règles, et pour toute prédiction de règles à la date D (CalendarDate), le
   * système doit planifier automatiquement le rappel à la date D - t.
   */
  test('Property 14: Medication reminders are scheduled automatically', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(medicationReminderArb, { minLength: 1, maxLength: 5 }),
        calendarDateArb,
        notificationPreferencesArb,
        async (reminders, predictedDate, preferences) => {
          const manager = new NotificationManager()

          // Activer les rappels de médicaments
          const activePreferences = {
            ...preferences,
            enabled: true,
            medicationRemindersEnabled: true,
          }

          // Planifier les rappels
          await manager.scheduleMedicationReminders(reminders, predictedDate, activePreferences)

          // Vérifier que chaque rappel actif est planifié
          const scheduled = manager.getScheduledNotifications()
          const medicationNotifications = scheduled.filter((n) => n.type === 'medication')

          const enabledReminders = reminders.filter((r) => r.enabled)
          expect(medicationNotifications).toHaveLength(enabledReminders.length)

          // Vérifier que chaque notification est planifiée à la bonne date
          for (const reminder of enabledReminders) {
            const expectedDate = subtractDays(predictedDate, reminder.timingBeforePeriod)
            const notification = medicationNotifications.find(
              (n) => n.data?.reminderId === reminder.id,
            )

            expect(notification).toBeDefined()
            expect(notification?.scheduledDate).toBe(expectedDate)
          }
        },
      ),
      { numRuns: 100 },
    )
  })

  /**
   * Feature: suivi-cycle-menstruel
   * Property 15: Enregistrement de la prise de médicaments avec horodatage UTC
   *
   * **Validates: Requirement 6.3**
   *
   * Pour tout rappel de médicament planifié, le marquage de la prise comme
   * effectuée doit créer une entrée dans l'historique des prises avec un
   * horodatage UTC précis (`taken_at`), distinct de la date calendrier planifiée.
   */
  test('Property 15: Medication taken is recorded with UTC timestamp', () => {
    fc.assert(
      fc.property(fc.uuid(), utcTimestampArb, (reminderId, takenAt) => {
        const manager = new NotificationManager()

        // Marquer la prise
        manager.markMedicationTaken(reminderId, takenAt)

        // Vérifier que le log existe
        const logs = manager.getMedicationLogs(reminderId)
        expect(logs).toHaveLength(1)

        const log = logs[0]
        expect(log.reminderId).toBe(reminderId)
        expect(log.takenAt).toBe(takenAt)
        expect(log.skipped).toBe(false)

        // Vérifier que takenAt est un UTCTimestamp (contient 'T' et 'Z')
        expect(log.takenAt).toMatch(/T.*Z/)

        // Vérifier que scheduledDate est une CalendarDate (YYYY-MM-DD)
        expect(log.scheduledDate).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      }),
      { numRuns: 100 },
    )
  })

  /**
   * Feature: suivi-cycle-menstruel
   * Property 16: Récurrence des rappels de médicaments
   *
   * **Validates: Requirement 6.4**
   *
   * Pour tout rappel configuré comme récurrent, le système doit planifier ce
   * rappel pour chaque nouveau cycle prédit, avec le même délai relatif aux
   * règles prévues.
   */
  test('Property 16: Recurring medication reminders are scheduled for each cycle', async () => {
    await fc.assert(
      fc.asyncProperty(
        medicationReminderArb,
        fc.array(calendarDateArb, { minLength: 2, maxLength: 5 }),
        notificationPreferencesArb,
        async (reminder, predictedDates, preferences) => {
          const manager = new NotificationManager()

          // Activer les rappels
          const activePreferences = {
            ...preferences,
            enabled: true,
            medicationRemindersEnabled: true,
          }

          // Activer le rappel
          const activeReminder = { ...reminder, enabled: true }

          // Planifier pour chaque cycle prédit
          for (const predictedDate of predictedDates) {
            await manager.scheduleMedicationReminders([activeReminder], predictedDate, activePreferences)

            // Vérifier que le rappel est planifié avec le bon délai
            const scheduled = manager.getScheduledNotifications()
            const medicationNotifications = scheduled.filter((n) => n.type === 'medication')

            const expectedDate = subtractDays(predictedDate, activeReminder.timingBeforePeriod)
            const notification = medicationNotifications.find(
              (n) => n.scheduledDate === expectedDate && n.data?.reminderId === activeReminder.id,
            )

            expect(notification).toBeDefined()
          }
        },
      ),
      { numRuns: 100 },
    )
  })

  /**
   * Feature: suivi-cycle-menstruel
   * Property 20: Adaptation des notifications selon le mode
   *
   * **Validates: Requirements 8.2, 8.5**
   *
   * Pour tout changement de mode de suivi, le système doit immédiatement mettre
   * à jour les notifications planifiées pour correspondre aux préférences du
   * nouveau mode (par exemple, activer les notifications de période féconde en
   * mode "essai bébé").
   */
  test('Property 20: Notifications adapt to tracking mode', async () => {
    await fc.assert(
      fc.asyncProperty(
        ovulationPredictionArb,
        trackingModeArb,
        notificationPreferencesArb,
        async (prediction, mode, preferences) => {
          const manager = new NotificationManager()

          // Activer les notifications
          const activePreferences = { ...preferences, enabled: true }

          // Planifier les notifications de période féconde
          await manager.scheduleFertileWindowNotifications(prediction, mode, activePreferences)

          // Vérifier qu'une notification est planifiée
          const scheduled = manager.getScheduledNotifications()
          const fertileNotifications = scheduled.filter((n) => n.type === 'fertile_window')

          expect(fertileNotifications).toHaveLength(1)

          const notification = fertileNotifications[0]

          // Vérifier que le message est adapté au mode
          switch (mode) {
            case 'trying_to_conceive':
              expect(notification.title).toContain('optimale')
              expect(notification.body).toContain('concevoir')
              break
            case 'natural_contraception':
              expect(notification.title).toContain('risque')
              expect(notification.body).toContain('vigilante')
              break
            case 'general':
              expect(notification.title).toContain('féconde')
              break
          }

          // Vérifier que les données incluent le mode
          expect(notification.data?.mode).toBe(mode)
        },
      ),
      { numRuns: 100 },
    )
  })

  /**
   * Test supplémentaire : Les notifications désactivées ne sont pas planifiées
   */
  test('Notifications are not scheduled when disabled', () => {
    fc.assert(
      fc.property(periodPredictionArb, notificationPreferencesArb, (prediction, preferences) => {
        const manager = new NotificationManager()

        // Désactiver les notifications
        const disabledPreferences = { ...preferences, enabled: false }

        // Tenter de planifier
        manager.schedulePeriodNotifications(prediction, disabledPreferences)

        // Vérifier qu'aucune notification n'est planifiée
        const scheduled = manager.getScheduledNotifications()
        expect(scheduled).toHaveLength(0)
      }),
      { numRuns: 100 },
    )
  })
})
