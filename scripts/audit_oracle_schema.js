import 'dotenv/config';
import { initOraclePool, closeOraclePool } from '../server/database/oracle.js';

async function audit() {
  console.log('[Audit] Connecting to Oracle Database...');
  const pool = await initOraclePool();
  if (!pool) {
    console.error('[Audit] Could not connect to Oracle database. Check credentials/network.');
    process.exit(1);
  }

  const conn = await pool.getConnection();
  try {
    const userRes = await conn.execute('SELECT USER FROM DUAL');
    console.log('[Audit] Connected DB User:', userRes.rows[0]);

    // Check existing tables starting with FORMCRAFT
    const tablesRes = await conn.execute(
      "SELECT TABLE_NAME FROM USER_TABLES WHERE TABLE_NAME LIKE 'FORMCRAFT%' ORDER BY TABLE_NAME"
    );
    console.log('[Audit] Found FORMCRAFT Tables:', tablesRes.rows);

    for (const r of tablesRes.rows || []) {
      const tName = r.TABLE_NAME;
      const colsRes = await conn.execute(
        'SELECT COLUMN_NAME, DATA_TYPE, DATA_LENGTH, NULLABLE FROM USER_TAB_COLUMNS WHERE TABLE_NAME = :t ORDER BY COLUMN_ID',
        { t: tName }
      );
      console.log(`\n[Audit] Columns for table ${tName}:`);
      console.table(colsRes.rows);

      const countRes = await conn.execute(`SELECT COUNT(*) AS CNT FROM ${tName}`);
      console.log(`[Audit] Total row count in ${tName}:`, countRes.rows[0]);
    }

    // Check sequences
    const seqRes = await conn.execute(
      "SELECT SEQUENCE_NAME FROM USER_SEQUENCES WHERE SEQUENCE_NAME LIKE 'FORMCRAFT%' ORDER BY SEQUENCE_NAME"
    );
    console.log('\n[Audit] Found FORMCRAFT Sequences:', seqRes.rows);

  } catch (err) {
    console.error('[Audit] Error querying Oracle schema:', err);
  } finally {
    await conn.close();
    await closeOraclePool();
  }
}

audit();
