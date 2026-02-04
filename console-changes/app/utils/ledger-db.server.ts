import pg from 'pg';

const { Pool } = pg;

// Database connection pool - initialized lazily
let pool: pg.Pool | null = null;

function getPool(): pg.Pool {
  if (!pool) {
    const connectionString = process.env.LEDGER_DATABASE_URL;

    if (!connectionString) {
      throw new Error('LEDGER_DATABASE_URL environment variable is not set. Run: kubectl port-forward -n formance-system svc/postgresql 5432:5432');
    }

    pool = new Pool({
      connectionString,
      max: 5,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });
  }
  return pool;
}

// Log helper for debugging
function log(message: string, data?: any) {
  console.log(`[ledger-db] ${message}`, data ? JSON.stringify(data) : '');
}

/**
 * Clear all data from a ledger by running SQL delete statements.
 * This removes transactions, accounts, postings, logs, and metadata.
 *
 * Formance Ledger v2 uses a bucket-based schema structure.
 * Each bucket has its own schema with tables like:
 * - transactions
 * - transactions_metadata
 * - accounts
 * - accounts_metadata
 * - moves
 * - logs
 *
 * @param ledgerName - The name of the ledger to clear
 * @param bucketName - The bucket/schema name (defaults to ledger name)
 */
export async function clearLedgerData(
  ledgerName: string,
  bucketName?: string
): Promise<{ success: boolean; message: string; deletedCounts?: Record<string, number> }> {
  const bucket = bucketName || ledgerName;
  const client = await getPool().connect();

  log('Starting clear for ledger', { ledgerName, bucket });

  try {
    // First, discover what schemas and tables exist
    const schemasResult = await client.query(`
      SELECT schema_name FROM information_schema.schemata
      WHERE schema_name NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
    `);
    const availableSchemas = schemasResult.rows.map(r => r.schema_name);
    log('Available schemas', availableSchemas);

    // Also try to find schemas by looking at pg_namespace (more reliable)
    const nsResult = await client.query(`
      SELECT nspname FROM pg_namespace
      WHERE nspname NOT LIKE 'pg_%' AND nspname != 'information_schema'
    `);
    const pgSchemas = nsResult.rows.map(r => r.nspname);
    log('Schemas from pg_namespace', pgSchemas);

    // Combine both approaches
    const allSchemas = [...new Set([...availableSchemas, ...pgSchemas])];
    log('All discovered schemas', allSchemas);

    // Find tables in the bucket schema (or try common patterns)
    // Priority: ledger-specific bucket first, then _default as fallback
    // Ledgers with their own bucket use the bucket name as schema (e.g., "monetae-demo")
    const possibleSchemas = [
      ledgerName,           // Try ledger name first (e.g., "monetae-demo")
      bucket,               // Then bucket name
      `_${ledgerName}`,     // With underscore prefix
      `_${bucket}`,
      '_default',           // Default bucket (fallback)
      'public',
      // Also try any schema that contains 'ledger' or matches common patterns
      ...allSchemas.filter(s => s.includes('ledger') || s.includes('default') || s.startsWith('_')),
    ];
    // Remove duplicates
    const uniqueSchemas = [...new Set(possibleSchemas)];
    log('Will try schemas in order', uniqueSchemas);

    let foundSchema: string | null = null;
    let tables: string[] = [];

    for (const schema of uniqueSchemas) {
      try {
        // Use pg_tables which is more reliable than information_schema
        const tablesResult = await client.query(`
          SELECT tablename FROM pg_tables WHERE schemaname = $1
        `, [schema]);

        if (tablesResult.rows.length > 0) {
          foundSchema = schema;
          tables = tablesResult.rows.map(r => r.tablename);
          log(`Found ${tables.length} tables in schema "${schema}"`, tables);
          break;
        }
      } catch (e: any) {
        log(`Error checking schema "${schema}"`, e.message);
      }
    }

    if (!foundSchema) {
      // Last resort: list ALL tables in ALL schemas to help debug
      try {
        const allTablesResult = await client.query(`
          SELECT schemaname, tablename FROM pg_tables
          WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
          ORDER BY schemaname, tablename
        `);
        const allTables = allTablesResult.rows.map(r => `${r.schemaname}.${r.tablename}`);
        log('All tables in database', allTables);

        // Try to find a schema with ledger-related tables
        const ledgerSchemas = [...new Set(allTablesResult.rows
          .filter(r => r.tablename === 'transactions' || r.tablename === 'accounts')
          .map(r => r.schemaname))];

        if (ledgerSchemas.length > 0) {
          foundSchema = ledgerSchemas[0];
          tables = allTablesResult.rows
            .filter(r => r.schemaname === foundSchema)
            .map(r => r.tablename);
          log(`Auto-discovered ledger schema "${foundSchema}"`, tables);
        }
      } catch (e: any) {
        log('Failed to list all tables', e.message);
      }
    }

    if (!foundSchema) {
      log('No schema found for bucket', { bucket, triedSchemas: uniqueSchemas, allSchemas });
      return {
        success: false,
        message: `No ledger tables found. Tried schemas: ${uniqueSchemas.slice(0, 5).join(', ')}. Available: ${allSchemas.join(', ')}`,
      };
    }

    await client.query('BEGIN');

    const deletedCounts: Record<string, number> = {};

    // Order matters for foreign key constraints
    // Delete dependent tables first, then parent tables
    // Based on actual Formance schema structure
    const deleteOrder = [
      'accounts_volumes',      // balances (causes duplicates if not cleaned)
      'accounts_metadata',     // account metadata
      'transactions_metadata', // transaction metadata
      'moves',                 // individual postings
      'logs',                  // audit log
      'transactions',          // transactions
      'accounts',              // account addresses
    ];

    // Delete from tables that exist, in order
    for (const tableName of deleteOrder) {
      if (!tables.includes(tableName)) continue;

      try {
        // Check if table has a 'ledger' column
        const colCheck = await client.query(`
          SELECT column_name FROM information_schema.columns
          WHERE table_schema = $1 AND table_name = $2 AND column_name = 'ledger'
        `, [foundSchema, tableName]);

        let result;
        if (colCheck.rows.length > 0) {
          // Table has ledger column - filter by it
          result = await client.query(
            `DELETE FROM "${foundSchema}"."${tableName}" WHERE ledger = $1`,
            [ledgerName]
          );
        } else {
          // No ledger column - delete all (assuming single-ledger bucket)
          result = await client.query(`DELETE FROM "${foundSchema}"."${tableName}"`);
        }

        deletedCounts[tableName] = result.rowCount || 0;
        log(`Deleted from ${tableName}`, { count: result.rowCount });
      } catch (e: any) {
        log(`Error deleting from ${tableName}`, { error: e.message });
        // Continue with other tables
      }
    }

    // Delete any remaining tables we might have missed
    for (const tableName of tables) {
      if (deleteOrder.includes(tableName)) continue; // Already handled
      if (deletedCounts[tableName] !== undefined) continue; // Already deleted

      try {
        const result = await client.query(`DELETE FROM "${foundSchema}"."${tableName}"`);
        deletedCounts[tableName] = result.rowCount || 0;
        log(`Deleted from ${tableName} (extra)`, { count: result.rowCount });
      } catch (e: any) {
        log(`Error deleting from ${tableName}`, { error: e.message });
      }
    }

    await client.query('COMMIT');

    const totalDeleted = Object.values(deletedCounts).reduce((a, b) => a + b, 0);
    log('Clear complete', { totalDeleted, deletedCounts });

    return {
      success: true,
      message: `Cleared ${totalDeleted} rows from ledger "${ledgerName}" in schema "${foundSchema}"`,
      deletedCounts,
    };
  } catch (error: any) {
    await client.query('ROLLBACK');
    log('Clear failed', { error: error.message });
    throw new Error(`Failed to clear ledger data: ${error.message}`);
  } finally {
    client.release();
  }
}

/**
 * Alternative approach: Truncate tables within a bucket for a specific ledger.
 * Use this if the standard delete approach is too slow.
 */
export async function truncateLedgerData(
  ledgerName: string,
  bucketName?: string
): Promise<{ success: boolean; message: string }> {
  const bucket = bucketName || ledgerName;
  const client = await getPool().connect();

  try {
    await client.query('BEGIN');

    // For truncate, we need to be more careful - only truncate if this is the only ledger in the bucket
    // First check how many ledgers are in this bucket
    const ledgerCountResult = await client.query(
      `SELECT COUNT(DISTINCT ledger) as count FROM "${bucket}"."transactions"`
    );

    const ledgerCount = parseInt(ledgerCountResult.rows[0]?.count || '0', 10);

    if (ledgerCount > 1) {
      // Multiple ledgers in bucket - use delete instead
      await client.query('ROLLBACK');
      return clearLedgerData(ledgerName, bucketName);
    }

    // Safe to truncate - only one ledger in this bucket
    await client.query(`TRUNCATE TABLE "${bucket}"."logs" CASCADE`);
    await client.query(`TRUNCATE TABLE "${bucket}"."moves" CASCADE`);
    await client.query(`TRUNCATE TABLE "${bucket}"."transactions_metadata" CASCADE`);
    await client.query(`TRUNCATE TABLE "${bucket}"."accounts_metadata" CASCADE`);
    await client.query(`TRUNCATE TABLE "${bucket}"."postings" CASCADE`);
    await client.query(`TRUNCATE TABLE "${bucket}"."transactions" CASCADE`);
    await client.query(`TRUNCATE TABLE "${bucket}"."accounts" CASCADE`);

    await client.query('COMMIT');

    return {
      success: true,
      message: `Truncated all data in bucket ${bucket}`,
    };
  } catch (error: any) {
    await client.query('ROLLBACK');
    throw new Error(`Failed to truncate ledger data: ${error.message}`);
  } finally {
    client.release();
  }
}

/**
 * Check if database connection is configured and working
 */
export async function checkDatabaseConnection(): Promise<boolean> {
  try {
    const client = await getPool().connect();
    await client.query('SELECT 1');
    client.release();
    return true;
  } catch (e) {
    log('Database connection check failed', (e as Error).message);
    return false;
  }
}

/**
 * Debug function to show database structure
 */
export async function debugDatabaseStructure(ledgerName: string): Promise<{
  schemas: string[];
  tablesInDefault: string[];
  ledgersInSystem: string[];
  rowCounts: Record<string, number>;
}> {
  const client = await getPool().connect();

  try {
    // Get all schemas
    const schemasResult = await client.query(`
      SELECT nspname FROM pg_namespace
      WHERE nspname NOT LIKE 'pg_%' AND nspname != 'information_schema'
    `);
    const schemas = schemasResult.rows.map(r => r.nspname);

    // Get tables in _default schema
    const tablesResult = await client.query(`
      SELECT tablename FROM pg_tables WHERE schemaname = '_default'
    `);
    const tablesInDefault = tablesResult.rows.map(r => r.tablename);

    // Get ledgers from _system.ledgers
    let ledgersInSystem: string[] = [];
    try {
      const ledgersResult = await client.query(`
        SELECT name FROM "_system".ledgers ORDER BY name
      `);
      ledgersInSystem = ledgersResult.rows.map(r => r.name);
    } catch (e) {
      log('Could not query _system.ledgers', (e as Error).message);
    }

    // Get row counts for ledger
    const rowCounts: Record<string, number> = {};
    for (const table of ['transactions', 'accounts', 'moves', 'logs']) {
      try {
        const countResult = await client.query(
          `SELECT COUNT(*) as count FROM "_default"."${table}" WHERE ledger = $1`,
          [ledgerName]
        );
        rowCounts[table] = parseInt(countResult.rows[0]?.count || '0', 10);
      } catch (e) {
        rowCounts[table] = -1; // Error
      }
    }

    return { schemas, tablesInDefault, ledgersInSystem, rowCounts };
  } finally {
    client.release();
  }
}
