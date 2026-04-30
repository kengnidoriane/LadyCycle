/**
 * VersionManager — Gestionnaire des migrations de schéma SQLite.
 *
 * Architecture :
 * - `IDatabase`              : abstraction de la base de données (injectable)
 * - `IVersionManager`        : interface publique du gestionnaire
 * - `Migration`              : définition d'une migration individuelle
 * - `InMemoryVersionManager` : implémentation complète pour les tests
 * - `NativeVersionManager`   : stub production (nécessite SQLCipher natif)
 *
 * Processus de migration transactionnelle (Exigence 14.1, 14.2, 14.3) :
 *   1. Lire la version actuelle depuis schema_version
 *   2. Identifier les migrations à appliquer (version actuelle → cible)
 *   3. Créer une sauvegarde du fichier .db chiffré
 *   4. Pour chaque migration :
 *      a. BEGIN TRANSACTION
 *      b. Appliquer up(db)
 *      c. Mettre à jour schema_version
 *      d. COMMIT si succès, ROLLBACK + restauration backup si erreur
 *   5. Supprimer la sauvegarde temporaire si tout a réussi
 *
 * Idempotence (Exigence 14.4) :
 *   - Le numéro de version est stocké dans schema_version
 *   - migrate() ne ré-applique jamais une migration déjà effectuée
 *
 * Exigences : 14.1, 14.2, 14.3, 14.4, 14.5
 */

import { type Result, ok, err } from '../../domain/shared/types'
import {
  type MigrationError,
  type StorageError,
  ErrorCode,
  createError,
} from '../../domain/shared/errors'

// ─── Abstraction de la base de données ───────────────────────────────────────

/**
 * Interface minimale d'une base de données SQLite.
 * Permet d'injecter une implémentation en mémoire pour les tests.
 */
export interface IDatabase {
  /** Exécute une requête SQL sans retour de données */
  execute(sql: string, params?: unknown[]): void
  /** Exécute une requête SQL et retourne les lignes */
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): T[]
  /** Démarre une transaction */
  beginTransaction(): void
  /** Valide la transaction en cours */
  commit(): void
  /** Annule la transaction en cours */
  rollback(): void
}

// ─── Interface Migration ──────────────────────────────────────────────────────

/**
 * Définition d'une migration individuelle de schéma.
 *
 * Chaque migration doit être :
 * - Atomique : up() et down() s'exécutent dans une transaction
 * - Idempotente : ne jamais ré-appliquer si version >= migration.version
 * - Réversible : down() annule exactement ce que up() a fait
 */
export interface Migration {
  /** Numéro de version cible après application de cette migration */
  version: number
  /** Description lisible de la migration */
  description: string
  /** Applique la migration (ALTER TABLE, CREATE TABLE, etc.) */
  up: (db: IDatabase) => void
  /** Annule la migration (DROP TABLE, etc.) — utilisé pour les rollbacks */
  down: (db: IDatabase) => void
}

// ─── Interface publique ───────────────────────────────────────────────────────

/**
 * Interface du gestionnaire de versions de schéma.
 * Implémentée par InMemoryVersionManager (test) et NativeVersionManager (prod).
 */
export interface IVersionManager {
  /**
   * Retourne la version actuelle du schéma.
   * Retourne 0 si la table schema_version n'existe pas encore.
   */
  getCurrentVersion(): number

  /**
   * Applique toutes les migrations en attente de manière transactionnelle.
   * Processus : backup → migrations atomiques → suppression backup.
   * En cas d'erreur : ROLLBACK + restauration backup.
   */
  migrate(): Result<void, MigrationError>

  /**
   * Crée une sauvegarde de la base de données avant migration.
   * Retourne le chemin (ou identifiant) de la sauvegarde créée.
   */
  createBackup(): Result<string, StorageError>

  /**
   * Restaure la base de données depuis une sauvegarde.
   * Utilisé en cas d'échec de migration.
   */
  restoreFromBackup(backupId: string): Result<void, StorageError>

  /**
   * Supprime une sauvegarde temporaire après migration réussie.
   */
  deleteBackup(backupId: string): Result<void, StorageError>
}

// ─── Implémentation de test (InMemory) ───────────────────────────────────────

/**
 * État interne d'une base de données en mémoire.
 * Représente le schéma et les données à un instant donné.
 */
interface DatabaseSnapshot {
  version: number
  tables: Set<string>
  columns: Map<string, Set<string>> // table → colonnes
  data: Map<string, unknown[]>      // table → lignes
}

/**
 * Implémentation en mémoire de IDatabase pour les tests.
 *
 * Simule les opérations SQL essentielles :
 * - CREATE TABLE / DROP TABLE
 * - ALTER TABLE ADD COLUMN
 * - INSERT / SELECT sur schema_version
 * - BEGIN TRANSACTION / COMMIT / ROLLBACK
 *
 * Le ROLLBACK restaure l'état exact d'avant la transaction (snapshot).
 */
export class InMemoryDatabase implements IDatabase {
  private tables: Set<string> = new Set()
  private columns: Map<string, Set<string>> = new Map()
  private data: Map<string, unknown[]> = new Map()
  private transactionSnapshot: DatabaseSnapshot | null = null
  private inTransaction = false

  execute(sql: string, params?: unknown[]): void {
    const normalized = sql.trim().toUpperCase()

    if (normalized.startsWith('CREATE TABLE')) {
      this._handleCreateTable(sql)
    } else if (normalized.startsWith('DROP TABLE')) {
      this._handleDropTable(sql)
    } else if (normalized.startsWith('ALTER TABLE')) {
      this._handleAlterTable(sql)
    } else if (normalized.startsWith('INSERT INTO')) {
      this._handleInsert(sql, params)
    } else if (normalized.startsWith('UPDATE')) {
      this._handleUpdate(sql, params)
    } else if (normalized.startsWith('DELETE FROM')) {
      this._handleDelete(sql, params)
    }
    // Autres instructions SQL ignorées silencieusement (pragmas, etc.)
  }

  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): T[] {
    const normalized = sql.trim().toUpperCase()

    if (normalized.startsWith('SELECT')) {
      return this._handleSelect<T>(sql, params)
    }
    return []
  }

  beginTransaction(): void {
    if (this.inTransaction) return
    // Sauvegarder l'état actuel pour le ROLLBACK
    this.transactionSnapshot = this._snapshot()
    this.inTransaction = true
  }

  commit(): void {
    this.transactionSnapshot = null
    this.inTransaction = false
  }

  rollback(): void {
    if (this.transactionSnapshot) {
      this._restore(this.transactionSnapshot)
      this.transactionSnapshot = null
    }
    this.inTransaction = false
  }

  /** Vérifie si une table existe */
  hasTable(name: string): boolean {
    return this.tables.has(name.toLowerCase())
  }

  /** Vérifie si une colonne existe dans une table */
  hasColumn(table: string, column: string): boolean {
    return this.columns.get(table.toLowerCase())?.has(column.toLowerCase()) ?? false
  }

  /** Retourne toutes les tables existantes */
  getTables(): string[] {
    return Array.from(this.tables)
  }

  // ── Handlers SQL internes ─────────────────────────────────────────────────

  private _handleCreateTable(sql: string): void {
    // Extraire le nom de la table : CREATE TABLE [IF NOT EXISTS] <name>
    const match = sql.match(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(\w+)/i)
    if (!match) return

    const tableName = match[1].toLowerCase()
    if (this.tables.has(tableName)) return // IF NOT EXISTS

    this.tables.add(tableName)

    // Extraire les colonnes depuis la définition entre parenthèses
    const colsMatch = sql.match(/\(([^)]+)\)/s)
    if (colsMatch) {
      const colDefs = colsMatch[1].split(',')
      const cols = new Set<string>()
      for (const def of colDefs) {
        const colName = def.trim().split(/\s+/)[0]
        if (colName && !colName.toUpperCase().startsWith('FOREIGN') &&
            !colName.toUpperCase().startsWith('PRIMARY') &&
            !colName.toUpperCase().startsWith('UNIQUE')) {
          cols.add(colName.toLowerCase())
        }
      }
      this.columns.set(tableName, cols)
    } else {
      this.columns.set(tableName, new Set())
    }

    this.data.set(tableName, [])
  }

  private _handleDropTable(sql: string): void {
    const match = sql.match(/DROP\s+TABLE\s+(?:IF\s+EXISTS\s+)?(\w+)/i)
    if (!match) return
    const tableName = match[1].toLowerCase()
    this.tables.delete(tableName)
    this.columns.delete(tableName)
    this.data.delete(tableName)
  }

  private _handleAlterTable(sql: string): void {
    // ALTER TABLE <name> ADD COLUMN <col> <type>
    const match = sql.match(/ALTER\s+TABLE\s+(\w+)\s+ADD\s+(?:COLUMN\s+)?(\w+)/i)
    if (!match) return
    const tableName = match[1].toLowerCase()
    const colName = match[2].toLowerCase()
    if (!this.columns.has(tableName)) {
      this.columns.set(tableName, new Set())
    }
    this.columns.get(tableName)!.add(colName)
  }

  private _handleInsert(sql: string, params?: unknown[]): void {
    // INSERT INTO <table> (<cols>) VALUES (?)
    const tableMatch = sql.match(/INSERT\s+INTO\s+(\w+)/i)
    if (!tableMatch) return
    const tableName = tableMatch[1].toLowerCase()

    const colsMatch = sql.match(/\(([^)]+)\)\s+VALUES/i)
    const valsMatch = sql.match(/VALUES\s*\(([^)]+)\)/i)

    if (!colsMatch || !valsMatch) return

    const cols = colsMatch[1].split(',').map(c => c.trim().toLowerCase())
    const placeholders = valsMatch[1].split(',').map(v => v.trim())

    const row: Record<string, unknown> = {}
    cols.forEach((col, i) => {
      if (params && placeholders[i] === '?') {
        row[col] = params[i]
      } else {
        // Valeur littérale (enlever les guillemets)
        row[col] = placeholders[i].replace(/^['"]|['"]$/g, '')
      }
    })

    if (!this.data.has(tableName)) {
      this.data.set(tableName, [])
    }
    this.data.get(tableName)!.push(row)
  }

  private _handleUpdate(sql: string, params?: unknown[]): void {
    // UPDATE <table> SET <col> = ? WHERE <col> = ?
    const tableMatch = sql.match(/UPDATE\s+(\w+)\s+SET/i)
    if (!tableMatch) return
    const tableName = tableMatch[1].toLowerCase()

    const setMatch = sql.match(/SET\s+(\w+)\s*=\s*\?/i)
    const whereMatch = sql.match(/WHERE\s+(\w+)\s*=\s*\?/i)

    if (!setMatch || !params) return

    const setCol = setMatch[1].toLowerCase()
    const rows = this.data.get(tableName) ?? []

    if (whereMatch && params.length >= 2) {
      const whereCol = whereMatch[1].toLowerCase()
      const whereVal = params[1]
      this.data.set(
        tableName,
        rows.map(r => {
          const row = r as Record<string, unknown>
          if (row[whereCol] === whereVal) {
            return { ...row, [setCol]: params[0] }
          }
          return row
        }),
      )
    } else {
      // UPDATE sans WHERE : mettre à jour toutes les lignes
      this.data.set(
        tableName,
        rows.map(r => ({ ...(r as Record<string, unknown>), [setCol]: params[0] })),
      )
    }
  }

  private _handleDelete(sql: string, params?: unknown[]): void {
    const tableMatch = sql.match(/DELETE\s+FROM\s+(\w+)/i)
    if (!tableMatch) return
    const tableName = tableMatch[1].toLowerCase()

    const whereMatch = sql.match(/WHERE\s+(\w+)\s*=\s*\?/i)
    if (whereMatch && params?.length) {
      const whereCol = whereMatch[1].toLowerCase()
      const whereVal = params[0]
      const rows = this.data.get(tableName) ?? []
      this.data.set(
        tableName,
        rows.filter(r => (r as Record<string, unknown>)[whereCol] !== whereVal),
      )
    } else {
      this.data.set(tableName, [])
    }
  }

  private _handleSelect<T>(sql: string, params?: unknown[]): T[] {
    const tableMatch = sql.match(/FROM\s+(\w+)/i)
    if (!tableMatch) return []
    const tableName = tableMatch[1].toLowerCase()

    const rows = (this.data.get(tableName) ?? []) as T[]

    const whereMatch = sql.match(/WHERE\s+(\w+)\s*=\s*\?/i)
    if (whereMatch && params?.length) {
      const whereCol = whereMatch[1].toLowerCase()
      const whereVal = params[0]
      return rows.filter(
        r => (r as Record<string, unknown>)[whereCol] === whereVal,
      )
    }

    return [...rows]
  }

  // ── Snapshot / Restore pour ROLLBACK ─────────────────────────────────────

  private _snapshot(): DatabaseSnapshot {
    const tables = new Set(this.tables)
    const columns = new Map<string, Set<string>>()
    for (const [t, cols] of this.columns) {
      columns.set(t, new Set(cols))
    }
    const data = new Map<string, unknown[]>()
    for (const [t, rows] of this.data) {
      data.set(t, rows.map(r => ({ ...(r as object) })))
    }
    return { version: this.getCurrentVersionFromData(), tables, columns, data }
  }

  private _restore(snapshot: DatabaseSnapshot): void {
    this.tables = new Set(snapshot.tables)
    this.columns = new Map<string, Set<string>>()
    for (const [t, cols] of snapshot.columns) {
      this.columns.set(t, new Set(cols))
    }
    this.data = new Map<string, unknown[]>()
    for (const [t, rows] of snapshot.data) {
      this.data.set(t, rows.map(r => ({ ...(r as object) })))
    }
  }

  private getCurrentVersionFromData(): number {
    const rows = this.data.get('schema_version') ?? []
    if (rows.length === 0) return 0
    const last = rows[rows.length - 1] as Record<string, unknown>
    return typeof last['version'] === 'number' ? last['version'] : 0
  }
}

/**
 * Implémentation en mémoire de IVersionManager pour les tests.
 *
 * Simule le processus complet de migration transactionnelle :
 * - createBackup() : sérialise l'état de la DB dans une Map en mémoire
 * - migrate() : applique les migrations dans des transactions simulées
 * - restoreFromBackup() : restaure l'état sérialisé
 * - deleteBackup() : supprime la sauvegarde de la Map
 *
 * Propriétés garanties :
 * - Atomicité : un échec dans up() déclenche rollback() + restauration backup
 * - Idempotence : migrate() ne ré-applique jamais une migration déjà effectuée
 */
export class InMemoryVersionManager implements IVersionManager {
  private backups: Map<string, string> = new Map() // backupId → JSON sérialisé
  private backupCounter = 0

  constructor(
    private readonly db: InMemoryDatabase,
    private readonly migrations: Migration[],
  ) {
    // Trier les migrations par version croissante
    this.migrations = [...migrations].sort((a, b) => a.version - b.version)
  }

  getCurrentVersion(): number {
    try {
      const rows = this.db.query<{ version: number }>(
        'SELECT version FROM schema_version',
      )
      if (rows.length === 0) return 0
      return rows[rows.length - 1].version
    } catch {
      return 0
    }
  }

  migrate(): Result<void, MigrationError> {
    const currentVersion = this.getCurrentVersion()

    // Filtrer les migrations à appliquer (version > currentVersion)
    const pending = this.migrations.filter(m => m.version > currentVersion)

    // Rien à faire — déjà à jour
    if (pending.length === 0) {
      return ok(undefined)
    }

    // Étape 1 : créer une sauvegarde avant toute modification
    const backupResult = this.createBackup()
    if (!backupResult.ok) {
      return err(
        createError(
          ErrorCode.MIGRATION_BACKUP_FAILED,
          'Impossible de créer la sauvegarde avant migration',
          backupResult.error,
        ) as MigrationError,
      )
    }
    const backupId = backupResult.value

    // Étape 2 : appliquer chaque migration dans sa propre transaction
    for (const migration of pending) {
      this.db.beginTransaction()
      try {
        // Appliquer la migration
        migration.up(this.db)

        // Mettre à jour le numéro de version
        this._upsertVersion(migration.version)

        this.db.commit()
      } catch (e) {
        // Échec : ROLLBACK de la transaction en cours
        this.db.rollback()

        // Restaurer le backup pour garantir l'état d'avant toutes les migrations
        const restoreResult = this.restoreFromBackup(backupId)
        if (!restoreResult.ok) {
          // Cas extrême : la restauration elle-même a échoué
          return err(
            createError(
              ErrorCode.MIGRATION_FAILED,
              `Migration v${migration.version} échouée et restauration impossible`,
              { migrationError: e, restoreError: restoreResult.error },
            ) as MigrationError,
          )
        }

        return err(
          createError(
            ErrorCode.MIGRATION_FAILED,
            `Migration v${migration.version} "${migration.description}" échouée — base restaurée`,
            e,
          ) as MigrationError,
        )
      }
    }

    // Étape 3 : supprimer la sauvegarde temporaire après succès
    this.deleteBackup(backupId)

    return ok(undefined)
  }

  createBackup(): Result<string, StorageError> {
    try {
      const backupId = `backup-${++this.backupCounter}-${Date.now()}`

      // Sérialiser l'état complet de la DB en JSON
      const snapshot = {
        tables: Array.from(this.db.getTables()),
        // Capturer les données via des SELECT sur chaque table connue
        data: this._serializeAllData(),
      }

      this.backups.set(backupId, JSON.stringify(snapshot))
      return ok(backupId)
    } catch (e) {
      return err(
        createError(
          ErrorCode.STORAGE_WRITE_FAILED,
          'Échec de la création de la sauvegarde',
          e,
        ) as StorageError,
      )
    }
  }

  restoreFromBackup(backupId: string): Result<void, StorageError> {
    const serialized = this.backups.get(backupId)
    if (!serialized) {
      return err(
        createError(
          ErrorCode.STORAGE_READ_FAILED,
          `Sauvegarde introuvable : ${backupId}`,
        ) as StorageError,
      )
    }

    try {
      const snapshot = JSON.parse(serialized) as {
        tables: string[]
        data: Record<string, unknown[]>
      }

      // Reconstruire la DB depuis le snapshot
      // 1. Supprimer toutes les tables actuelles
      for (const table of this.db.getTables()) {
        this.db.execute(`DROP TABLE IF EXISTS ${table}`)
      }

      // 2. Recréer les tables et réinsérer les données
      for (const [table, rows] of Object.entries(snapshot.data)) {
        if (rows.length === 0) {
          // Recréer la table vide (structure minimale)
          this._recreateEmptyTable(table)
          continue
        }

        const firstRow = rows[0] as Record<string, unknown>
        const cols = Object.keys(firstRow)
        const colDefs = cols.map(c => `${c} TEXT`).join(', ')
        this.db.execute(`CREATE TABLE IF NOT EXISTS ${table} (${colDefs})`)

        for (const row of rows) {
          const r = row as Record<string, unknown>
          const colList = cols.join(', ')
          const placeholders = cols.map(() => '?').join(', ')
          const values = cols.map(c => r[c])
          this.db.execute(
            `INSERT INTO ${table} (${colList}) VALUES (${placeholders})`,
            values,
          )
        }
      }

      return ok(undefined)
    } catch (e) {
      return err(
        createError(
          ErrorCode.DATA_CORRUPTED,
          `Échec de la restauration depuis la sauvegarde ${backupId}`,
          e,
        ) as StorageError,
      )
    }
  }

  deleteBackup(backupId: string): Result<void, StorageError> {
    if (!this.backups.has(backupId)) {
      return err(
        createError(
          ErrorCode.STORAGE_READ_FAILED,
          `Sauvegarde introuvable : ${backupId}`,
        ) as StorageError,
      )
    }
    this.backups.delete(backupId)
    return ok(undefined)
  }

  // ── Helpers internes ──────────────────────────────────────────────────────

  private _upsertVersion(version: number): void {
    const existing = this.db.query<{ version: number }>('SELECT version FROM schema_version')
    if (existing.length === 0) {
      this.db.execute(
        'INSERT INTO schema_version (version, applied_at) VALUES (?, ?)',
        [version, new Date().toISOString()],
      )
    } else {
      const currentVersion = existing[existing.length - 1].version
      this.db.execute(
        'UPDATE schema_version SET version = ? WHERE version = ?',
        [version, currentVersion],
      )
    }
  }

  private _serializeAllData(): Record<string, unknown[]> {
    const result: Record<string, unknown[]> = {}
    for (const table of this.db.getTables()) {
      result[table] = this.db.query(`SELECT * FROM ${table}`)
    }
    return result
  }

  private _recreateEmptyTable(table: string): void {
    // Tables connues avec leur structure minimale
    const knownSchemas: Record<string, string> = {
      schema_version: 'version INTEGER NOT NULL, applied_at TEXT NOT NULL',
      cycles: 'id TEXT PRIMARY KEY, start_date TEXT NOT NULL, is_exceptional INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL',
      symptoms: 'id TEXT PRIMARY KEY, cycle_id TEXT NOT NULL, date TEXT NOT NULL, type TEXT NOT NULL, category TEXT NOT NULL, created_at TEXT NOT NULL',
      predictions: 'id TEXT PRIMARY KEY, cycle_id TEXT NOT NULL, prediction_type TEXT NOT NULL, predicted_date TEXT NOT NULL, confidence_level TEXT NOT NULL, calculated_at TEXT NOT NULL',
      medication_reminders: 'id TEXT PRIMARY KEY, name TEXT NOT NULL, frequency TEXT NOT NULL, timing_before_period INTEGER NOT NULL, time_of_day TEXT NOT NULL, enabled INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL, updated_at TEXT NOT NULL',
      medication_logs: 'id TEXT PRIMARY KEY, reminder_id TEXT NOT NULL, scheduled_date TEXT NOT NULL, skipped INTEGER NOT NULL DEFAULT 0',
      user_preferences: 'key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL',
    }
    const schema = knownSchemas[table] ?? 'id TEXT PRIMARY KEY'
    this.db.execute(`CREATE TABLE IF NOT EXISTS ${table} (${schema})`)
  }
}

// ─── Implémentation production (stub) ────────────────────────────────────────

/**
 * Implémentation production de IVersionManager.
 *
 * En production, cette classe délègue à :
 *   - `react-native-sqlcipher-storage` pour les opérations SQL
 *   - Le système de fichiers natif pour les sauvegardes du fichier .db
 *
 * NOTE : Cette classe nécessite un émulateur/appareil physique.
 * Pour les tests unitaires, utiliser InMemoryVersionManager.
 */
export class NativeVersionManager implements IVersionManager {
  getCurrentVersion(): number {
    // En production : SELECT version FROM schema_version via SQLCipher
    return 0
  }

  migrate(): Result<void, MigrationError> {
    return err(
      createError(
        ErrorCode.MIGRATION_FAILED,
        'NativeVersionManager nécessite un appareil physique ou un émulateur. ' +
          'Utilisez InMemoryVersionManager pour les tests.',
      ) as MigrationError,
    )
  }

  createBackup(): Result<string, StorageError> {
    // En production : copier le fichier .db chiffré vers un chemin temporaire
    return err(
      createError(
        ErrorCode.STORAGE_WRITE_FAILED,
        'Non implémenté — nécessite les modules natifs',
      ) as StorageError,
    )
  }

  restoreFromBackup(_backupId: string): Result<void, StorageError> {
    return err(
      createError(
        ErrorCode.STORAGE_READ_FAILED,
        'Non implémenté — nécessite les modules natifs',
      ) as StorageError,
    )
  }

  deleteBackup(_backupId: string): Result<void, StorageError> {
    return err(
      createError(
        ErrorCode.STORAGE_WRITE_FAILED,
        'Non implémenté — nécessite les modules natifs',
      ) as StorageError,
    )
  }
}
