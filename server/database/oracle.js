import oracledb from 'oracledb';

// Force node-oracledb pure JS Thin mode (default in v6+, does not require Instant Client)
// oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT by default for cleaner query results
oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;
// Automatically return CLOB columns as strings instead of Lob streams
if (Array.isArray(oracledb.fetchAsString)) {
  oracledb.fetchAsString.push(oracledb.CLOB);
} else {
  oracledb.fetchAsString = [oracledb.CLOB];
}

let pool = null;
let isInitializing = false;
let lastError = null;

/**
 * Initializes the Oracle connection pool once during application startup.
 * Does not crash if connection fails or if credentials are not yet configured.
 */
export async function initOraclePool() {
  if (pool) return pool;
  if (isInitializing) return null;

  isInitializing = true;
  lastError = null;

  const user = process.env.DB_USER;
  const password = process.env.DB_PASSWORD;
  const connectString = process.env.DB_CONNECT_STRING;

  if (!user || !password || !connectString) {
    const missing = [];
    if (!user) missing.push('DB_USER');
    if (!password) missing.push('DB_PASSWORD');
    if (!connectString) missing.push('DB_CONNECT_STRING');
    const msg = `Oracle pool initialization skipped: missing environment variable(s): ${missing.join(', ')}`;
    console.warn(`[Oracle Database] ${msg}`);
    lastError = msg;
    isInitializing = false;
    return null;
  }

  try {
    console.log(`[Oracle Database] Initializing connection pool for user "${user}"...`);
    pool = await oracledb.createPool({
      user,
      password,
      connectString,
      poolMin: 2,
      poolMax: 10,
      poolIncrement: 2,
      poolTimeout: 60,
    });
    console.log('[Oracle Database] Connection pool successfully created and ready.');
    return pool;
  } catch (err) {
    lastError = err.message || 'Failed to establish Oracle connection pool.';
    console.error('[Oracle Database] Error creating connection pool:', lastError);
    pool = null;
    return null;
  } finally {
    isInitializing = false;
  }
}

/**
 * Closes the connection pool gracefully on server shutdown.
 */
export async function closeOraclePool() {
  if (pool) {
    try {
      console.log('[Oracle Database] Closing connection pool...');
      await pool.close(5);
      pool = null;
      console.log('[Oracle Database] Connection pool closed.');
    } catch (err) {
      console.error('[Oracle Database] Error closing connection pool:', err.message);
    }
  }
}

/**
 * Returns current health status of the database pool.
 */
export async function getOracleHealth() {
  if (!pool) {
    return {
      connected: false,
      error: lastError || 'Oracle pool is not initialized.',
    };
  }

  let connection;
  try {
    connection = await pool.getConnection();
    const result = await connection.execute('SELECT 1 AS alive FROM DUAL');
    return {
      connected: !!(result && result.rows && result.rows.length > 0),
    };
  } catch (err) {
    return {
      connected: false,
      error: 'Oracle health check ping failed.',
    };
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch (e) {
        // ignore close error
      }
    }
  }
}

/**
 * Acquires a connection, executes SQL with parameterized binds, and releases the connection safely.
 */
export async function executeQuery(sql, binds = {}, options = {}) {
  if (!pool) {
    // Try re-initializing if credentials were provided
    await initOraclePool();
    if (!pool) {
      throw new Error('Database service is currently unavailable.');
    }
  }

  let connection;
  try {
    connection = await pool.getConnection();
    const result = await connection.execute(sql, binds, {
      autoCommit: true,
      ...options,
    });
    return result;
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch (e) {
        // ignore close error
      }
    }
  }
}

/**
 * Executes a callback function inside an atomic transaction (commit on success, rollback on failure).
 */
export async function withTransaction(callback) {
  if (!pool) {
    await initOraclePool();
    if (!pool) {
      throw new Error('Database service is currently unavailable.');
    }
  }

  let connection;
  try {
    connection = await pool.getConnection();
    const result = await callback(connection);
    await connection.commit();
    return result;
  } catch (err) {
    if (connection) {
      try {
        await connection.rollback();
      } catch (rbErr) {
        console.error('[Oracle Database] Rollback error:', rbErr.message);
      }
    }
    throw err;
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch (e) {
        // ignore close error
      }
    }
  }
}

export { oracledb };
