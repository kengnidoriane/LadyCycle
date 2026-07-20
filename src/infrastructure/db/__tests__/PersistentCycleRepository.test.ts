/**
 * Tests de PersistentCycleRepository.
 *
 * Vérifie le cœur de la promesse : les données survivent à un « redémarrage »
 * de l'app, simulé en créant une nouvelle instance de repository qui hydrate
 * depuis le même stockage AsyncStorage (mocké en mémoire dans jest.setup.js).
 */

import AsyncStorage from '@react-native-async-storage/async-storage'
import { PersistentCycleRepository } from '../PersistentCycleRepository'
import type { Cycle, UserPreferences } from '../CycleRepository'

// Réinitialise le stockage mocké entre chaque test pour les isoler.
beforeEach(async () => {
  await AsyncStorage.clear()
})

function makeCycle(id: string, startDate: string): Cycle {
  return {
    id,
    startDate,
    endDate: null,
    menstruationEndDate: null,
    duration: null,
    menstruationDuration: null,
    isExceptional: false,
    exceptionalReason: null,
    symptoms: [],
    predictions: { ovulation: null, nextPeriod: null },
    createdAt: '2026-06-01T00:00:00.000Z',
    updatedAt: '2026-06-01T00:00:00.000Z',
  } as unknown as Cycle
}

/** Laisse les écritures asynchrones (fire-and-forget) se vider. */
const flush = () => new Promise<void>((r) => setImmediate(() => r()))

describe('PersistentCycleRepository', () => {
  it('conserve les cycles après un redémarrage simulé', async () => {
    const repo1 = new PersistentCycleRepository()
    await repo1.hydrate()
    repo1.saveCycle(makeCycle('c1', '2026-05-01'))
    repo1.saveCycle(makeCycle('c2', '2026-06-01'))
    await flush()

    // « Redémarrage » : nouvelle instance qui hydrate depuis le stockage.
    const repo2 = new PersistentCycleRepository()
    await repo2.hydrate()

    const result = repo2.loadAllCycles()
    expect(result.ok).toBe(true)
    if (result.ok) {
      const ids = result.value.map((c) => c.id).sort()
      expect(ids).toEqual(['c1', 'c2'])
    }
  })

  it('conserve les préférences après un redémarrage simulé', async () => {
    const repo1 = new PersistentCycleRepository()
    await repo1.hydrate()
    const current = repo1.loadPreferences()
    expect(current.ok).toBe(true)
    if (current.ok) {
      const updated: UserPreferences = { ...current.value, languageCode: 'en' }
      repo1.savePreferences(updated)
    }
    await flush()

    const repo2 = new PersistentCycleRepository()
    await repo2.hydrate()
    const reloaded = repo2.loadPreferences()
    expect(reloaded.ok).toBe(true)
    if (reloaded.ok) {
      expect(reloaded.value.languageCode).toBe('en')
    }
  })

  it('reflète la suppression après redémarrage', async () => {
    const repo1 = new PersistentCycleRepository()
    await repo1.hydrate()
    repo1.saveCycle(makeCycle('keep', '2026-05-01'))
    repo1.saveCycle(makeCycle('remove', '2026-06-01'))
    await flush()
    repo1.deleteCycle('remove')
    await flush()

    const repo2 = new PersistentCycleRepository()
    await repo2.hydrate()
    const result = repo2.loadAllCycles()
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.map((c) => c.id)).toEqual(['keep'])
    }
  })
})
