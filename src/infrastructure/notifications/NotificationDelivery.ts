/**
 * NotificationDelivery — couche de « livraison » des notifications locales.
 *
 * Sépare le CALCUL des notifications (NotificationManager : quoi/quand) de leur
 * AFFICHAGE réel par l'OS. On peut ainsi tester toute la logique sans dépendance
 * native, et brancher la vraie implémentation (Notifee) en production.
 *
 * Deux implémentations :
 *   - NoopNotificationDelivery      : journalise, ne planifie rien (tests / dev)
 *   - NotifeeNotificationDelivery   : planifie de vraies notifications OS
 *
 * `createNotificationDelivery()` tente de charger Notifee ; si le module natif
 * n'est pas lié (tests Jest, build sans la lib), il retombe silencieusement sur
 * l'implémentation Noop — l'app ne plante jamais.
 */

import type { CalendarDate } from '../../domain/shared/types'

/** Une notification prête à être planifiée par l'OS. */
export interface DeliverableNotification {
  id: string
  /** Date calendaire de déclenchement (YYYY-MM-DD) — déclenchée à `hour` locale. */
  date: CalendarDate
  title: string
  body: string
  /** Heure locale de déclenchement (0-23). Par défaut 9h. */
  hour?: number
}

/** Contrat de livraison des notifications. */
export interface INotificationDelivery {
  /** Demande la permission de notifier. Retourne true si accordée. */
  requestPermission(): Promise<boolean>
  /** Planifie (ou remplace) une notification à sa date. Ignore les dates passées. */
  schedule(notification: DeliverableNotification): Promise<void>
  /** Annule une notification par id. */
  cancel(id: string): Promise<void>
  /** Annule toutes les notifications planifiées par l'app. */
  cancelAll(): Promise<void>
}

// ─── Implémentation Noop (tests / dev sans natif) ─────────────────────────────

export class NoopNotificationDelivery implements INotificationDelivery {
  async requestPermission(): Promise<boolean> {
    return true
  }
  async schedule(_notification: DeliverableNotification): Promise<void> {
    // Ne planifie rien — la logique métier est testée par NotificationManager.
  }
  async cancel(_id: string): Promise<void> {}
  async cancelAll(): Promise<void> {}
}

// ─── Implémentation Notifee (production) ──────────────────────────────────────

/**
 * Livraison réelle via @notifee/react-native.
 *
 * Chargée dynamiquement : si la lib n'est pas installée/liée, `createNotificationDelivery`
 * ne l'instancie pas et l'app utilise Noop à la place.
 */
export class NotifeeNotificationDelivery implements INotificationDelivery {
  private notifee: any
  private channelId: string | null = null

  constructor(notifeeModule: any) {
    this.notifee = notifeeModule.default ?? notifeeModule
  }

  async requestPermission(): Promise<boolean> {
    const settings = await this.notifee.requestPermission()
    // AuthorizationStatus.AUTHORIZED === 1, PROVISIONAL === 2
    return settings.authorizationStatus >= 1
  }

  private async ensureChannel(): Promise<string> {
    if (this.channelId) return this.channelId
    const id: string = await this.notifee.createChannel({
      id: 'cycle',
      name: 'Cycle',
      importance: 4, // HIGH
    })
    this.channelId = id
    return id
  }

  async schedule(n: DeliverableNotification): Promise<void> {
    const fireDate = triggerTimestamp(n.date, n.hour ?? 9)
    if (fireDate <= Date.now()) return // ne pas planifier dans le passé

    const channelId = await this.ensureChannel()
    await this.notifee.createTriggerNotification(
      {
        id: n.id,
        title: n.title,
        body: n.body,
        android: { channelId, pressAction: { id: 'default' } },
      },
      { type: 0 /* TimestampTrigger */, timestamp: fireDate },
    )
  }

  async cancel(id: string): Promise<void> {
    await this.notifee.cancelNotification(id)
  }

  async cancelAll(): Promise<void> {
    await this.notifee.cancelAllNotifications()
  }
}

// ─── Fabrique ─────────────────────────────────────────────────────────────────

let cached: INotificationDelivery | null = null

/**
 * Retourne l'implémentation de livraison disponible.
 * Tente Notifee ; retombe sur Noop si le module natif n'est pas présent.
 */
export function createNotificationDelivery(): INotificationDelivery {
  if (cached) return cached
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const notifee = require('@notifee/react-native')
    cached = new NotifeeNotificationDelivery(notifee)
  } catch {
    cached = new NoopNotificationDelivery()
  }
  return cached
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Convertit une date calendaire + heure locale en timestamp (ms). */
function triggerTimestamp(date: CalendarDate, hour: number): number {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(y, m - 1, d, hour, 0, 0, 0).getTime()
}
