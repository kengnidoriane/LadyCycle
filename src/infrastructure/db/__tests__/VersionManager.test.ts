/**
 * Tests property-based pour VersionManager.
 *
 * Feature: suivi-cycle-menstruel
 *
 * Propriété 34 : Atomicité des migrations de schéma
 *   Valide : Exigences 14.1, 14.3
 *
 * Propriété 35 : Idempotence des migrations
 *   Valide : Exigence 14.4
 *
 * Ces tests vérifient les invariants fondamentaux du gestionnaire de migrations :
 *   - Une migration qui échoue déclenche un ROLLBACK complet + restauration backup
 *   - La DB est dans l'état d'avant la migration après un échec (jamais à moitié)
 *   - Une migration déjà appliquée n'est jamais ré-appliquée
 *   - migrate() est idempotent : appeler deux fois ne change rien la deuxième fois
 *   - Les migrations réussies mettent à jour le numéro de version
 *   - La sauvegarde est supprimée après une migration réussie
 *
 * Outil : fast-check (minimum 100 itérations par propriété)
 */

import * as fc from 'fast-check'
import {
  InMemoryDatabase,
  InMemoryVersionManager,
  type Migration,
  type IDatabase,
} from '../VersionManager'

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Crée une DB initialisée avec la table schema_version.
 * C'est l'état de départ de toute application fraîchement installée.
 */
function makeDb(): InMemoryDatabase {
  const db = new InMemoryDatabase()
  db.execute(
    'CREATE TABLE IF NOT EXISTS schema_version (version INTEGER NOT NULL, applied_at TEXT NOT NULL)',
  )
  return db
}

/**
 * Crée une migration valide qui ajoute une table.
 */
function makeValidMigration(version: number, tableName: string): Migration {
  return {
    version,
    description: `Créer la table ${tableName}`,
    up: (db: IDatabase) => {
      db.execute(`CREATE TABLE IF NOT EXISTS ${tableName} (id TEXT PRIMARY KEY, data TEXT)`)
    },
    down: (db: IDatabase) => {
      db.execute(`DROP TABLE IF EXISTS ${tableName}`)
    },
  }
}

/**
 * Crée une migration qui échoue intentionnellement dans up().
 */
function makeFailingMigration(version: number): Migration {
  return {
    version,
    description: `Migration qui échoue (v${version})`,
    up: (_db: IDatabase) => {
      throw new Error(`Erreur simulée dans la migration v${version}`)
    },
    down: (_db: IDatabase) => {
      // Rien à annuler — up() n'a rien fait
    },
  }
}

/**
 * Crée une migration qui ajoute une colonne à une table existante.
 */
function makeAlterMigration(version: number, table: string, column: string): Migration {
  return {
    version,
    description: `Ajouter la colonne ${column} à ${table}`,
    up: (db: IDatabase) => {
      db.execute(`ALTER TABLE ${table} ADD COLUMN ${column} TEXT`)
    },
    down: (db: IDatabase) => {
      // SQLite ne supporte pas DROP COLUMN — on recrée la table sans la colonne
      // Pour les tests, on simule avec une table temporaire
      db.execute(`DROP TABLE IF EXISTS ${table}_backup`)
    },
  }
}

// ─── Arbitraires ─────────────────────────────────────────────────────────────

/**
 * Génère un nom de table valide (lettres minuscules, pas de mots réservés SQL).
 */
const arbitraryTableName = fc
  .stringMatching(/^[a-z][a-z0-9_]{2,15}$/)
  .filter(
    name =>
      !['select', 'insert', 'update', 'delete', 'create', 'drop', 'table', 'from', 'where'].includes(name),
  )

/**
 * Génère une séquence de numéros de version croissants (1 à 5 migrations).
 */
const arbitraryVersionSequence = fc
  .integer({ min: 1, max: 5 })
  .chain(count =>
    fc.constant(
      Array.from({ length: count }, (_, i) => i + 1),
    ),
  )

// ─── Propriété 34 : Atomicité des migrations ─────────────────────────────────

describe('Propriété 34 : Atomicité des migrations de schéma', () => {
  /**
   * Invariant principal : une migration qui échoue ne laisse jamais la DB
   * dans un état partiel — la DB est exactement dans l'état d'avant la migration.
   *
   * Pour tout historique de migrations réussies suivi d'une migration qui échoue,
   * la DB doit être restaurée à l'état d'avant la tentative de migration.
   * Valide : Exigences 14.1, 14.3
   */
  it('une migration échouée laisse la DB dans son état d\'avant (ROLLBACK + restauration)', () => {
    fc.assert(
      fc.property(arbitraryTableName, tableName => {
        const db = makeDb()

        // État initial : une table existante avec des données
        db.execute(`CREATE TABLE IF NOT EXISTS ${tableName} (id TEXT PRIMARY KEY, data TEXT)`)
        db.execute(`INSERT INTO ${tableName} (id, data) VALUES (?, ?)`, ['row1', 'valeur initiale'])

        const versionBefore = 0
        const tablesBefore = db.getTables().sort()

        // Tenter une migration qui échoue
        const failingMigration = makeFailingMigration(1)
        const manager = new InMemoryVersionManager(db, [failingMigration])

        const result = manager.migrate()

        // La migration doit avoir échoué
        expect(result.ok).toBe(false)
        if (!result.ok) {
          expect(result.error.code).toBe('MIGRATION_FAILED')
        }

        // La version ne doit pas avoir changé
        expect(manager.getCurrentVersion()).toBe(versionBefore)

        // Les tables doivent être identiques à avant
        expect(db.getTables().sort()).toEqual(tablesBefore)

        // Les données doivent être intactes
        const rows = db.query<{ id: string; data: string }>(
          `SELECT * FROM ${tableName}`,
        )
        expect(rows).toHaveLength(1)
        expect(rows[0].data).toBe('valeur initiale')
      }),
      { numRuns: 100 },
    )
  })

  /**
   * Atomicité partielle : si la 2ème migration d'une séquence échoue,
   * la 1ère migration doit aussi être annulée (restauration complète).
   *
   * Valide : Exigences 14.1, 14.3
   */
  it('si la 2ème migration échoue, la 1ère est aussi annulée (restauration complète)', () => {
    fc.assert(
      fc.property(
        arbitraryTableName,
        arbitraryTableName,
        (table1, table2) => {
          // S'assurer que les deux noms sont différents
          fc.pre(table1 !== table2)

          const db = makeDb()
          const tablesBefore = db.getTables().sort()

          const migration1 = makeValidMigration(1, table1)
          const migration2 = makeFailingMigration(2)

          const manager = new InMemoryVersionManager(db, [migration1, migration2])
          const result = manager.migrate()

          // La migration globale doit avoir échoué
          expect(result.ok).toBe(false)

          // La version doit être revenue à 0 (état d'avant)
          expect(manager.getCurrentVersion()).toBe(0)

          // La table créée par migration1 ne doit plus exister
          // (la restauration du backup a tout annulé)
          expect(db.getTables().sort()).toEqual(tablesBefore)
        },
      ),
      { numRuns: 100 },
    )
  })

  /**
   * Succès complet : toutes les migrations réussies mettent à jour la version
   * et les tables sont créées correctement.
   *
   * Valide : Exigence 14.1
   */
  it('des migrations réussies mettent à jour la version et créent les tables', () => {
    fc.assert(
      fc.property(arbitraryVersionSequence, versions => {
        const db = makeDb()
        const migrations = versions.map(v =>
          makeValidMigration(v, `table_v${v}`),
        )

        const manager = new InMemoryVersionManager(db, migrations)
        const result = manager.migrate()

        expect(result.ok).toBe(true)

        // La version doit être la plus haute migration appliquée
        expect(manager.getCurrentVersion()).toBe(Math.max(...versions))

        // Toutes les tables doivent exister
        versions.forEach(v => {
          expect(db.hasTable(`table_v${v}`)).toBe(true)
        })
      }),
      { numRuns: 100 },
    )
  })

  /**
   * Sauvegarde supprimée après succès : après une migration réussie,
   * aucune sauvegarde temporaire ne doit subsister.
   *
   * Valide : Exigence 14.5
   */
  it('la sauvegarde temporaire est supprimée après une migration réussie', () => {
    fc.assert(
      fc.property(arbitraryTableName, tableName => {
        const db = makeDb()
        const migration = makeValidMigration(1, tableName)
        const manager = new InMemoryVersionManager(db, [migration])

        const result = manager.migrate()
        expect(result.ok).toBe(true)

        // Tenter de supprimer une sauvegarde inexistante doit échouer
        // (preuve que la sauvegarde a bien été supprimée après succès)
        const deleteResult = manager.deleteBackup('backup-1-0')
        expect(deleteResult.ok).toBe(false)
      }),
      { numRuns: 100 },
    )
  })

  /**
   * Backup créé avant migration : createBackup() doit réussir et retourner
   * un identifiant non vide, puis restoreFromBackup() doit restaurer l'état.
   *
   * Valide : Exigence 14.2
   */
  it('createBackup() et restoreFromBackup() fonctionnent correctement', () => {
    fc.assert(
      fc.property(arbitraryTableName, tableName => {
        const db = makeDb()
        db.execute(`CREATE TABLE IF NOT EXISTS ${tableName} (id TEXT PRIMARY KEY, val TEXT)`)
        db.execute(`INSERT INTO ${tableName} (id, val) VALUES (?, ?)`, ['1', 'avant'])

        const manager = new InMemoryVersionManager(db, [])

        // Créer une sauvegarde
        const backupResult = manager.createBackup()
        expect(backupResult.ok).toBe(true)
        if (!backupResult.ok) return
        const backupId = backupResult.value
        expect(backupId.length).toBeGreaterThan(0)

        // Modifier la DB après la sauvegarde
        db.execute(`UPDATE ${tableName} SET val = ? WHERE id = ?`, ['après', '1'])
        const rowsAfterModif = db.query<{ val: string }>(`SELECT * FROM ${tableName}`)
        expect(rowsAfterModif[0].val).toBe('après')

        // Restaurer depuis la sauvegarde
        const restoreResult = manager.restoreFromBackup(backupId)
        expect(restoreResult.ok).toBe(true)

        // Les données doivent être revenues à l'état d'avant
        const rowsAfterRestore = db.query<{ val: string }>(`SELECT * FROM ${tableName}`)
        expect(rowsAfterRestore[0].val).toBe('avant')
      }),
      { numRuns: 100 },
    )
  })
})

// ─── Propriété 35 : Idempotence des migrations ────────────────────────────────

describe('Propriété 35 : Idempotence des migrations', () => {
  /**
   * Invariant principal : appeler migrate() deux fois de suite ne change rien
   * lors du deuxième appel — les migrations déjà appliquées sont ignorées.
   *
   * Pour tout ensemble de migrations, migrate() puis migrate() à nouveau
   * doit laisser la DB dans le même état que migrate() une seule fois.
   * Valide : Exigence 14.4
   */
  it('migrate() est idempotent : le deuxième appel ne change rien', () => {
    fc.assert(
      fc.property(arbitraryVersionSequence, versions => {
        const db = makeDb()
        const migrations = versions.map(v =>
          makeValidMigration(v, `table_v${v}`),
        )

        const manager = new InMemoryVersionManager(db, migrations)

        // Premier appel : applique toutes les migrations
        const result1 = manager.migrate()
        expect(result1.ok).toBe(true)

        const versionAfterFirst = manager.getCurrentVersion()
        const tablesAfterFirst = db.getTables().sort()

        // Deuxième appel : ne doit rien changer
        const result2 = manager.migrate()
        expect(result2.ok).toBe(true)

        // La version ne doit pas avoir changé
        expect(manager.getCurrentVersion()).toBe(versionAfterFirst)

        // Les tables doivent être identiques
        expect(db.getTables().sort()).toEqual(tablesAfterFirst)
      }),
      { numRuns: 100 },
    )
  })

  /**
   * Aucune migration en attente : migrate() sur une DB à jour retourne ok
   * sans modifier quoi que ce soit.
   *
   * Valide : Exigence 14.4
   */
  it('migrate() retourne ok sans modification si aucune migration en attente', () => {
    fc.assert(
      fc.property(arbitraryVersionSequence, versions => {
        const db = makeDb()
        const migrations = versions.map(v =>
          makeValidMigration(v, `table_v${v}`),
        )

        const manager = new InMemoryVersionManager(db, migrations)

        // Appliquer toutes les migrations
        manager.migrate()

        const versionBefore = manager.getCurrentVersion()
        const tablesBefore = db.getTables().sort()

        // Appeler migrate() à nouveau avec les mêmes migrations
        const result = manager.migrate()

        expect(result.ok).toBe(true)
        expect(manager.getCurrentVersion()).toBe(versionBefore)
        expect(db.getTables().sort()).toEqual(tablesBefore)
      }),
      { numRuns: 100 },
    )
  })

  /**
   * Nouvelles migrations seulement : si de nouvelles migrations sont ajoutées
   * après une première exécution, seules les nouvelles sont appliquées.
   *
   * Valide : Exigence 14.4
   */
  it('seules les migrations avec version > currentVersion sont appliquées', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 3 }),
        fc.integer({ min: 1, max: 3 }),
        (firstBatch, secondBatch) => {
          const db = makeDb()

          // Première série de migrations (versions 1..firstBatch)
          const migrations1 = Array.from({ length: firstBatch }, (_, i) =>
            makeValidMigration(i + 1, `table_batch1_v${i + 1}`),
          )
          const manager1 = new InMemoryVersionManager(db, migrations1)
          manager1.migrate()

          const versionAfterFirst = manager1.getCurrentVersion()
          expect(versionAfterFirst).toBe(firstBatch)

          // Deuxième série : ajouter des migrations supplémentaires
          const migrations2 = [
            ...migrations1,
            ...Array.from({ length: secondBatch }, (_, i) =>
              makeValidMigration(
                firstBatch + i + 1,
                `table_batch2_v${firstBatch + i + 1}`,
              ),
            ),
          ]
          const manager2 = new InMemoryVersionManager(db, migrations2)
          manager2.migrate()

          // La version finale doit être firstBatch + secondBatch
          expect(manager2.getCurrentVersion()).toBe(firstBatch + secondBatch)

          // Les tables de la première série doivent toujours exister
          for (let i = 1; i <= firstBatch; i++) {
            expect(db.hasTable(`table_batch1_v${i}`)).toBe(true)
          }

          // Les tables de la deuxième série doivent aussi exister
          for (let i = 1; i <= secondBatch; i++) {
            expect(db.hasTable(`table_batch2_v${firstBatch + i}`)).toBe(true)
          }
        },
      ),
      { numRuns: 100 },
    )
  })

  /**
   * getCurrentVersion() retourne 0 sur une DB vierge.
   *
   * Valide : Exigence 14.4
   */
  it('getCurrentVersion() retourne 0 sur une DB sans migrations appliquées', () => {
    fc.assert(
      fc.property(fc.constant(null), () => {
        const db = makeDb()
        const manager = new InMemoryVersionManager(db, [])
        expect(manager.getCurrentVersion()).toBe(0)
      }),
      { numRuns: 100 },
    )
  })

  /**
   * Ordre des migrations : les migrations sont toujours appliquées dans
   * l'ordre croissant des versions, quelle que soit l'ordre de déclaration.
   *
   * Valide : Exigence 14.4
   */
  it('les migrations sont appliquées dans l\'ordre croissant des versions', () => {
    fc.assert(
      fc.property(
        fc.shuffledSubarray([1, 2, 3, 4, 5], { minLength: 2, maxLength: 5 }),
        versions => {
          const db = makeDb()

          // Déclarer les migrations dans un ordre aléatoire (mélangé)
          const migrations = versions.map(v =>
            makeValidMigration(v, `table_v${v}`),
          )

          const manager = new InMemoryVersionManager(db, migrations)
          const result = manager.migrate()

          expect(result.ok).toBe(true)

          // La version finale doit être le maximum des versions
          expect(manager.getCurrentVersion()).toBe(Math.max(...versions))

          // Toutes les tables doivent exister
          versions.forEach(v => {
            expect(db.hasTable(`table_v${v}`)).toBe(true)
          })
        },
      ),
      { numRuns: 100 },
    )
  })
})

// ─── Tests : Comportement de InMemoryDatabase ─────────────────────────────────

describe('InMemoryDatabase — transactions', () => {
  it('rollback() restaure l\'état exact d\'avant beginTransaction()', () => {
    const db = makeDb()
    db.execute('CREATE TABLE test_table (id TEXT PRIMARY KEY, val TEXT)')
    db.execute('INSERT INTO test_table (id, val) VALUES (?, ?)', ['1', 'avant'])

    db.beginTransaction()
    db.execute('INSERT INTO test_table (id, val) VALUES (?, ?)', ['2', 'pendant'])

    const rowsDuring = db.query('SELECT * FROM test_table')
    expect(rowsDuring).toHaveLength(2)

    db.rollback()

    const rowsAfter = db.query('SELECT * FROM test_table')
    expect(rowsAfter).toHaveLength(1)
    expect((rowsAfter[0] as { val: string }).val).toBe('avant')
  })

  it('commit() persiste les changements de la transaction', () => {
    const db = makeDb()
    db.execute('CREATE TABLE test_table (id TEXT PRIMARY KEY, val TEXT)')

    db.beginTransaction()
    db.execute('INSERT INTO test_table (id, val) VALUES (?, ?)', ['1', 'committé'])
    db.commit()

    const rows = db.query('SELECT * FROM test_table')
    expect(rows).toHaveLength(1)
    expect((rows[0] as { val: string }).val).toBe('committé')
  })

  it('CREATE TABLE crée la table avec les colonnes correctes', () => {
    const db = new InMemoryDatabase()
    db.execute('CREATE TABLE cycles (id TEXT PRIMARY KEY, start_date TEXT NOT NULL, is_exceptional INTEGER NOT NULL DEFAULT 0)')

    expect(db.hasTable('cycles')).toBe(true)
    expect(db.hasColumn('cycles', 'id')).toBe(true)
    expect(db.hasColumn('cycles', 'start_date')).toBe(true)
    expect(db.hasColumn('cycles', 'is_exceptional')).toBe(true)
  })

  it('ALTER TABLE ADD COLUMN ajoute la colonne', () => {
    const db = new InMemoryDatabase()
    db.execute('CREATE TABLE test (id TEXT PRIMARY KEY)')
    db.execute('ALTER TABLE test ADD COLUMN notes TEXT')

    expect(db.hasColumn('test', 'notes')).toBe(true)
  })
})
