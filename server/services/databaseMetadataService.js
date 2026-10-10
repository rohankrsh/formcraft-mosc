import { executeQuery } from '../database/oracle.js';
import {
  isTableAllowlisted,
  isColumnAllowlisted,
  getAllowlistedEntity,
  getAllowlistedTableNames,
} from '../config/bindableEntities.js';

let dictionaryMode = null; // 'USER' or 'ALL'
let cachedOwner = null;

/**
 * Determines whether to use USER_* or ALL_* views based on schema ownership.
 */
async function detectDictionaryMode() {
  if (dictionaryMode) return { mode: dictionaryMode, owner: cachedOwner };

  const dbUser = (process.env.DB_USER || '').toUpperCase();
  try {
    const userCheck = await executeQuery(
      `SELECT table_name FROM user_tables WHERE table_name IN ('PATIENT', 'ADMISSION', 'VITALS', 'DRUG_MASTER')`
    );

    if (userCheck.rows && userCheck.rows.length > 0) {
      dictionaryMode = 'USER';
      cachedOwner = dbUser;
      return { mode: 'USER', owner: dbUser };
    }

    const allCheck = await executeQuery(
      `SELECT owner, table_name FROM all_tables WHERE table_name IN ('PATIENT', 'ADMISSION', 'VITALS', 'DRUG_MASTER')`
    );

    if (allCheck.rows && allCheck.rows.length > 0) {
      dictionaryMode = 'ALL';
      cachedOwner = allCheck.rows[0].OWNER || dbUser;
      return { mode: 'ALL', owner: cachedOwner };
    }
  } catch (err) {
    console.warn('[MetadataService] Could not dynamically detect dictionary mode:', err.message);
  }

  // Default to USER
  dictionaryMode = 'USER';
  cachedOwner = dbUser;
  return { mode: 'USER', owner: dbUser };
}

/**
 * Maps raw Oracle DATA_TYPE to FormCraft high-level oracleType (STRING, NUMBER, DATE).
 */
export function mapOracleType(rawType) {
  if (!rawType) return 'STRING';
  const t = rawType.toUpperCase();
  if (t.includes('NUMBER') || t.includes('FLOAT') || t.includes('INT') || t.includes('DECIMAL')) {
    return 'NUMBER';
  }
  if (t.includes('DATE') || t.includes('TIMESTAMP')) {
    return 'DATE';
  }
  return 'STRING';
}

/**
 * Returns allowlisted tables that are verified in the Oracle data dictionary.
 */
export async function getTables() {
  const allowlistedNames = getAllowlistedTableNames();
  const { mode, owner } = await detectDictionaryMode();

  let sql;
  let binds = {};

  if (mode === 'USER') {
    sql = `SELECT table_name FROM user_tables`;
  } else {
    sql = `SELECT table_name FROM all_tables WHERE owner = :owner`;
    binds = { owner };
  }

  const result = await executeQuery(sql, binds);
  const liveTables = (result.rows || []).map((r) => (r.TABLE_NAME || r.table_name || '').toUpperCase());

  // Intersect with allowlist
  const verifiedTables = allowlistedNames.filter((t) =>
    liveTables.includes(t.toUpperCase())
  );

  return verifiedTables.map((name) => {
    const entity = getAllowlistedEntity(name);
    return {
      table: name,
      primaryKey: entity?.primaryKey || null,
      columnCount: entity?.columns?.length || 0,
    };
  });
}

/**
 * Returns metadata for allowlisted columns of a specific allowlisted table.
 */
export async function getColumns(tableName) {
  if (!isTableAllowlisted(tableName)) {
    const err = new Error(`Access to table '${tableName}' is forbidden.`);
    err.status = 403;
    throw err;
  }

  const upperTable = tableName.trim().toUpperCase();
  const entity = getAllowlistedEntity(upperTable);
  const { mode, owner } = await detectDictionaryMode();

  let sql;
  let binds = { tableName: upperTable };

  if (mode === 'USER') {
    sql = `
      SELECT column_name, data_type, data_length, data_precision, data_scale, nullable, data_default
      FROM user_tab_columns
      WHERE table_name = :tableName
      ORDER BY column_id
    `;
  } else {
    sql = `
      SELECT column_name, data_type, data_length, data_precision, data_scale, nullable, data_default
      FROM all_tab_columns
      WHERE owner = :owner AND table_name = :tableName
      ORDER BY column_id
    `;
    binds.owner = owner;
  }

  const result = await executeQuery(sql, binds);
  const rows = result.rows || [];

  // Filter only allowlisted columns
  const filtered = rows
    .filter((r) => isColumnAllowlisted(upperTable, r.COLUMN_NAME || r.column_name))
    .map((r) => {
      const colName = (r.COLUMN_NAME || r.column_name).toUpperCase();
      const rawType = r.DATA_TYPE || r.data_type;
      return {
        column: colName,
        rawType,
        oracleType: mapOracleType(rawType),
        nullable: (r.NULLABLE || r.nullable) === 'Y',
        dataLength: r.DATA_LENGTH || r.data_length,
        precision: r.DATA_PRECISION || r.data_precision,
        scale: r.DATA_SCALE || r.data_scale,
        isPrimaryKey: entity?.primaryKey === colName,
      };
    });

  return filtered;
}

/**
 * Returns primary key information for an allowlisted table.
 */
export async function getPrimaryKey(tableName) {
  if (!isTableAllowlisted(tableName)) {
    const err = new Error(`Access to table '${tableName}' is forbidden.`);
    err.status = 403;
    throw err;
  }

  const upperTable = tableName.trim().toUpperCase();
  const { mode, owner } = await detectDictionaryMode();

  let sql;
  let binds = { tableName: upperTable };

  if (mode === 'USER') {
    sql = `
      SELECT acc.column_name, ac.constraint_name
      FROM user_constraints ac
      JOIN user_cons_columns acc ON ac.constraint_name = acc.constraint_name
      WHERE ac.constraint_type = 'P' AND ac.table_name = :tableName
      ORDER BY acc.position
    `;
  } else {
    sql = `
      SELECT acc.column_name, ac.constraint_name
      FROM all_constraints ac
      JOIN all_cons_columns acc ON ac.constraint_name = acc.constraint_name AND ac.owner = acc.owner
      WHERE ac.constraint_type = 'P' AND ac.owner = :owner AND ac.table_name = :tableName
      ORDER BY acc.position
    `;
    binds.owner = owner;
  }

  const result = await executeQuery(sql, binds);
  const rows = result.rows || [];

  const columns = rows.map((r) => (r.COLUMN_NAME || r.column_name).toUpperCase());
  return {
    table: upperTable,
    primaryKeyColumns: columns,
    constraintName: rows[0]?.CONSTRAINT_NAME || rows[0]?.constraint_name || null,
  };
}

/**
 * Returns foreign key relationships for an allowlisted table where both sides are allowlisted.
 */
export async function getRelationships(tableName) {
  if (!isTableAllowlisted(tableName)) {
    const err = new Error(`Access to table '${tableName}' is forbidden.`);
    err.status = 403;
    throw err;
  }

  const upperTable = tableName.trim().toUpperCase();
  const { mode, owner } = await detectDictionaryMode();

  let sql;
  let binds = { tableName: upperTable };

  if (mode === 'USER') {
    sql = `
      SELECT
        a.table_name        AS fk_table,
        a.column_name       AS fk_column,
        c.table_name        AS referenced_table,
        d.column_name       AS referenced_column
      FROM user_cons_columns a
      JOIN user_constraints  b ON a.constraint_name = b.constraint_name
      JOIN user_constraints  c ON b.r_constraint_name = c.constraint_name
      JOIN user_cons_columns d ON c.constraint_name = d.constraint_name AND a.position = d.position
      WHERE b.constraint_type = 'R' AND a.table_name = :tableName
    `;
  } else {
    sql = `
      SELECT
        a.table_name        AS fk_table,
        a.column_name       AS fk_column,
        c.table_name        AS referenced_table,
        d.column_name       AS referenced_column
      FROM all_cons_columns a
      JOIN all_constraints  b ON a.constraint_name = b.constraint_name AND a.owner = b.owner
      JOIN all_constraints  c ON b.r_constraint_name = c.constraint_name AND b.r_owner = c.owner
      JOIN all_cons_columns d ON c.constraint_name = d.constraint_name AND c.owner = d.owner AND a.position = d.position
      WHERE b.constraint_type = 'R' AND a.owner = :owner AND a.table_name = :tableName
    `;
    binds.owner = owner;
  }

  const result = await executeQuery(sql, binds);
  const rows = result.rows || [];

  // Filter only relationships where BOTH tables are allowlisted
  const relationships = rows
    .map((r) => ({
      fkTable: (r.FK_TABLE || r.fk_table).toUpperCase(),
      fkColumn: (r.FK_COLUMN || r.fk_column).toUpperCase(),
      referencedTable: (r.REFERENCED_TABLE || r.referenced_table).toUpperCase(),
      referencedColumn: (r.REFERENCED_COLUMN || r.referenced_column).toUpperCase(),
    }))
    .filter(
      (rel) =>
        isTableAllowlisted(rel.fkTable) &&
        isTableAllowlisted(rel.referencedTable) &&
        isColumnAllowlisted(rel.fkTable, rel.fkColumn) &&
        isColumnAllowlisted(rel.referencedTable, rel.referencedColumn)
    );

  return relationships;
}
