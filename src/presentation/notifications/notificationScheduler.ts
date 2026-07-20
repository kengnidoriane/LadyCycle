/**
 * notificationScheduler — câblage réel des notifications.
 *
 * Fait le pont entre les données (préférences + prédictions) et la livraison OS :
 *   1. charge les préférences et l'historique via le repository partagé
 *   2. recalcule les prédictions (PredictNextCycleUseCase)
 *   3. laisse NotificationManager calculer QUOI/QUAND (logique testée)
 *   4. pousse le résultat vers la couche de livraison (Notifee en prod, Noop sinon)
 *
 * À appeler après chaque enregistrement de règles et au démarrage de l'app, pour
 * que les notifications collent toujours à la dernière prédiction.
 */

import { sharedRepository } from '../calendar/useCalendar'
import { PredictNextCycleUseCase } from '../../application/PredictNextCycleUseCase'
import { NotificationManager } from '../../infrastructure/notifications/NotificationManager'
import {
  createNotificationDelivery,
  type INotificationDelivery,
} from '../../infrastructure/notifications/NotificationDelivery'
import { i18nService } from '../../infrastructure/i18n/I18nService'

const delivery: INotificationDelivery = createNotificationDelivery()

/** Demande la permission de notifier (idempotent). Retourne true si accordée. */
export async function ensureNotificationPermission(): Promise<boolean> {
  try {
    return await delivery.requestPermission()
  } catch {
    return false
  }
}

/**
 * Recalcule et (re)programme toutes les notifications selon l'état actuel.
 *
 * @param requestPermission demande la permission avant de programmer (à activer
 *   aux moments naturels : activation dans les réglages, 1er enregistrement).
 */
export async function rescheduleNotifications(requestPermission = false): Promise<void> {
  try {
    const prefsResult = sharedRepository.loadPreferences()
    if (!prefsResult.ok) return
    const prefs = prefsResult.value

    // Rien à programmer si les notifications sont désactivées.
    if (!prefs.notificationPreferences.enabled) {
      await delivery.cancelAll()
      return
    }

    if (requestPermission) {
      const granted = await ensureNotificationPermission()
      if (!granted) return
    }

    // Prédictions à jour.
    const useCase = new PredictNextCycleUseCase(sharedRepository)
    const predResult = await useCase.execute()
    if (!predResult.ok) return
    const predictions = predResult.value

    const lang = i18nService.getCurrentLanguage() === 'en' ? 'en' : 'fr'

    // NotificationManager calcule la liste (logique métier testée).
    const manager = new NotificationManager()
    await manager.schedulePeriodNotifications(
      predictions.nextPeriod,
      prefs.notificationPreferences,
      lang,
    )
    await manager.scheduleFertileWindowNotifications(
      predictions.ovulation,
      prefs.trackingMode,
      prefs.notificationPreferences,
      lang,
    )
    await manager.scheduleMedicationReminders(
      prefs.medicationReminders,
      predictions.nextPeriod.value.startDate,
      prefs.notificationPreferences,
      lang,
    )

    // Livraison : on repart d'une ardoise propre puis on planifie tout.
    await delivery.cancelAll()
    for (const n of manager.getScheduledNotifications()) {
      await delivery.schedule({
        id: n.id,
        date: n.scheduledDate,
        title: n.title,
        body: n.body,
      })
    }
  } catch {
    // Ne jamais faire planter l'app à cause des notifications.
  }
}
