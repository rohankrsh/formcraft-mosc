import 'dotenv/config';
import oracledb from 'oracledb';

async function verifyOwnership() {
  console.log('[Diagnostic] Checking Oracle connection parameters:');
  console.log(`  User: ${process.env.DB_USER}`);
  console.log(`  Connect String: ${process.env.DB_CONNECT_STRING}`);
  console.log(`  Password present: ${!!process.env.DB_PASSWORD}`);

  if (!process.env.DB_PASSWORD) {
    console.log('[Diagnostic] DB_PASSWORD is empty in .env. Please supply DB_PASSWORD in .env to run verification.');
    return;
  }

  let connection;
  try {
    connection = await oracledb.getConnection({
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      connectString: process.env.DB_CONNECT_STRING,
    });
    console.log('[Diagnostic] Successfully connected to Oracle in Thin mode!');

    // 1. Query USER_TABLES
    console.log('\n[Diagnostic] 1. Checking USER_TABLES for PATIENT, ADMISSION, VITALS, DRUG_MASTER...');
    const userTablesResult = await connection.execute(
      `SELECT table_name FROM user_tables WHERE table_name IN ('PATIENT', 'ADMISSION', 'VITALS', 'DRUG_MASTER')`
    );
    const userTables = (userTablesResult.rows || []).map((r) => r[0]);
    console.log('  user_tables matches:', userTables);

    // 2. Query ALL_TABLES
    console.log('\n[Diagnostic] 2. Checking ALL_TABLES for PATIENT, ADMISSION, VITALS, DRUG_MASTER...');
    const allTablesResult = await connection.execute(
      `SELECT owner, table_name FROM all_tables WHERE table_name IN ('PATIENT', 'ADMISSION', 'VITALS', 'DRUG_MASTER')`
    );
    console.log('  all_tables matches:', allTablesResult.rows);

    if (userTables.length > 0) {
      console.log('\n[Finding] smitajuly06 owns the target tables in USER_TABLES. Use USER_* views.');
    } else {
      console.log('\n[Finding] Target tables not found in USER_TABLES. Check ALL_TABLES owners above.');
    }
  } catch (err) {
    console.error('[Diagnostic] Connection error:', err.message);
  } finally {
    if (connection) {
      try {
        await connection.close();
        console.log('[Diagnostic] Connection closed.');
      } catch (e) {
        console.error(e);
      }
    }
  }
}

verifyOwnership();
