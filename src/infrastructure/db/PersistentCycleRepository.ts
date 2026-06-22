/**
 * PersistentCycleRepository — persistance réelle via AsyncStorage.
 *
 * Stratégie « write-through » : la Map en mémoire reste la source de vérité pour
 * les lectures/écritures synchrones (interface ICycleRepository inchangée), et
 * chaque écriture est répercutée de façon asynchrone dans AsyncStorage.
 *
 * Au démarrage, `hydrate()` recharge l'état depuis AsyncStorage AVANT que l'app
 * ne lise les données — c'est ce qui permet aux cycles de survivre à la
 * fermeture de l'application.
 *
 * Note : AsyncStorage n'est pas chiffré. Le chiffrement SQLCipher reste une
 * évolution future ; cette implémentation garantit d'abord la durabilité.
 */

import AsyncStorage from '@react-native-async-storage/async-storage'
import { InMemoryCycleRepository } from './CycleRepository'
import type { Cycle, UserPreferences } from './CycleRepository'
import type { Result } from '../../domain/shared/types'
import type { StorageError } from '../../domain/shared/errors'

const CYCLES_KEY = 'ladycycle:cycles:v1'
const PREFS_KEY = 'ladycycle:preferences:v1'

export class PersistentCycleRepository extends InMemoryCycleRepository {
  private hydrated = false

  /**
   * Recharge l'état depuis AsyncStorage. Idempotent et tolérant aux erreurs
   * (en cas d'échec, on démarre sur un état vide plutôt que de planter).
   */
  async hydrate(): Promise<void> {
    if (this.hydrated) return
    try {
      const [cyclesRaw, prefsRaw] = await Promise.all([
        AsyncStorage.getItem(CYCLES_KEY),
        AsyncStorage.getItem(PREFS_KEY),
      ])
      if (cyclesRaw) {
        const entries = JSON.parse(cyclesRaw) as Array<[string, string]>
        this.cycles = new Map(entries)
      }
      if (prefsRaw) {
        this.preferences = prefsRaw
      }
    } catch {
      // Données corrompues ou indisponibles → démarrage sur état vide.
    } finally {
      this.hydrated = true
    }
  }

  // ── Écritures : déléguer à InMemory puis persister en arrière-plan ──────────

  saveCycle(cycle: Cycle): Result<void, StorageError> {
    const result = super.saveCycle(cycle)
    if (result.ok) void this.flushCycles()
    return result
  }

  deleteCycle(cycleId: string): Result<void, StorageError> {
    const result = super.deleteCycle(cycleId)
    if (result.ok) void this.flushCycles()
    return result
  }

  savePreferences(preferences: UserPreferences): Result<void, StorageError> {
    const result = super.savePreferences(preferences)
    if (result.ok) void this.flushPreferences()
    return result
  }

  // ── Flush asynchrone (fire-and-forget, tolérant aux erreurs) ────────────────

  private async flushCycles(): Promise<void> {
    try {
      const entries = Array.from(this.cycles.entries())
      await AsyncStorage.setItem(CYCLES_KEY, JSON.stringify(entries))
    } catch {
      // Échec d'écriture disque non bloquant : l'état mémoire reste correct.
    }
  }

  private async flushPreferences(): Promise<void> {
    try {
      if (this.preferences !== null) {
        await AsyncStorage.setItem(PREFS_KEY, this.preferences)
      }
    } catch {
      // idem
    }
  }
}
