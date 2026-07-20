/**
 * Tests de la couche de livraison des notifications.
 *
 * Vérifie l'adaptateur Notifee via un faux module (pas de dépendance native) :
 *   - une notification future est bien planifiée avec le bon timestamp
 *   - une notification dont la date est passée est ignorée
 *   - Noop ne fait rien et ne plante pas
 */

import {
  NoopNotificationDelivery,
  NotifeeNotificationDelivery,
} from '../NotificationDelivery'

// Faux module Notifee : enregistre les appels au lieu d'appeler l'OS.
function fakeNotifee() {
  const created: any[] = []
  return {
    module: {
      default: {
        requestPermission: jest.fn(async () => ({ authorizationStatus: 1 })),
        createChannel: jest.fn(async () => 'cycle'),
        createTriggerNotification: jest.fn(async (notif: any, trigger: any) => {
          created.push({ notif, trigger })
        }),
        cancelNotification: jest.fn(async () => {}),
        cancelAllNotifications: jest.fn(async () => {}),
      },
    },
    created,
  }
}

function isoDay(offsetDays: number): string {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  return d.toISOString().split('T')[0]
}

describe('NotifeeNotificationDelivery', () => {
  it('planifie une notification future avec un déclencheur horodaté', async () => {
    const fake = fakeNotifee()
    const delivery = new NotifeeNotificationDelivery(fake.module)

    const futureDate = isoDay(5)
    await delivery.schedule({
      id: 'period_3d',
      date: futureDate,
      title: 'Tes règles approchent',
      body: 'Dans 3 jours.',
      hour: 9,
    })

    expect(fake.created).toHaveLength(1)
    const { notif, trigger } = fake.created[0]
    expect(notif.id).toBe('period_3d')
    expect(notif.title).toBe('Tes règles approchent')
    expect(trigger.type).toBe(0) // TimestampTrigger
    const [y, m, d] = futureDate.split('-').map(Number)
    expect(trigger.timestamp).toBe(new Date(y, m - 1, d, 9, 0, 0, 0).getTime())
  })

  it('ignore une notification dont la date est déjà passée', async () => {
    const fake = fakeNotifee()
    const delivery = new NotifeeNotificationDelivery(fake.module)

    await delivery.schedule({
      id: 'past',
      date: isoDay(-2),
      title: 'x',
      body: 'y',
    })

    expect(fake.created).toHaveLength(0)
  })

  it('demande la permission et reflète le statut accordé', async () => {
    const fake = fakeNotifee()
    const delivery = new NotifeeNotificationDelivery(fake.module)
    await expect(delivery.requestPermission()).resolves.toBe(true)
  })
})

describe('NoopNotificationDelivery', () => {
  it('ne fait rien et accorde la permission', async () => {
    const noop = new NoopNotificationDelivery()
    await expect(noop.requestPermission()).resolves.toBe(true)
    await expect(
      noop.schedule({ id: 'a', date: '2030-01-01', title: 't', body: 'b' }),
    ).resolves.toBeUndefined()
    await expect(noop.cancelAll()).resolves.toBeUndefined()
  })
})
