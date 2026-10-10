/**
 * Client API service for fetching allowlisted Oracle metadata.
 * Uses x-api-key for authentication and falls back to allowlist definitions if offline.
 */

export interface AllowlistedTable {
  table: string;
  primaryKey?: string | null;
  columnCount?: number;
}

export interface AllowlistedColumn {
  column: string;
  oracleType: 'STRING' | 'NUMBER' | 'DATE';
  nullable: boolean;
  isPrimaryKey?: boolean;
}

const DEFAULT_AUTH_KEY = 'formcraft_secret_key_2026';

// Client-side fallback allowlist strictly matching server/config/bindableEntities.js
export const FALLBACK_TABLES: Record<string, { pk: string; columns: AllowlistedColumn[] }> = {
  PATIENT: {
    pk: 'PATIENT_ID',
    columns: [
      { column: 'PATIENT_ID', oracleType: 'STRING', nullable: false, isPrimaryKey: true },
      { column: 'PATIENT_NAME', oracleType: 'STRING', nullable: false },
      { column: 'DOB', oracleType: 'DATE', nullable: true },
      { column: 'GENDER', oracleType: 'STRING', nullable: true },
      { column: 'PHONE', oracleType: 'STRING', nullable: true },
      { column: 'EMAIL', oracleType: 'STRING', nullable: true },
      { column: 'ADDRESS', oracleType: 'STRING', nullable: true },
      { column: 'PRIMARY_DRUG_ID', oracleType: 'STRING', nullable: true },
      { column: 'STATUS', oracleType: 'STRING', nullable: true },
    ],
  },
  ADMISSION: {
    pk: 'ADMISSION_ID',
    columns: [
      { column: 'ADMISSION_ID', oracleType: 'STRING', nullable: false, isPrimaryKey: true },
      { column: 'PATIENT_ID', oracleType: 'STRING', nullable: false },
      { column: 'ADMISSION_DATE', oracleType: 'DATE', nullable: false },
      { column: 'DISCHARGE_DATE', oracleType: 'DATE', nullable: true },
      { column: 'ROOM_NO', oracleType: 'STRING', nullable: true },
      { column: 'DOCTOR_NAME', oracleType: 'STRING', nullable: true },
      { column: 'STATUS', oracleType: 'STRING', nullable: true },
    ],
  },
  VITALS: {
    pk: 'VITAL_ID',
    columns: [
      { column: 'VITAL_ID', oracleType: 'STRING', nullable: false, isPrimaryKey: true },
      { column: 'PATIENT_ID', oracleType: 'STRING', nullable: false },
      { column: 'RECORDED_AT', oracleType: 'DATE', nullable: false },
      { column: 'BLOOD_PRESSURE', oracleType: 'STRING', nullable: true },
      { column: 'HEART_RATE', oracleType: 'NUMBER', nullable: true },
      { column: 'TEMPERATURE', oracleType: 'NUMBER', nullable: true },
      { column: 'SPO2', oracleType: 'NUMBER', nullable: true },
    ],
  },
  DRUG_MASTER: {
    pk: 'DRUG_GEN_ID',
    columns: [
      { column: 'DRUG_GEN_ID', oracleType: 'STRING', nullable: false, isPrimaryKey: true },
      { column: 'DRUG_NAME', oracleType: 'STRING', nullable: false },
      { column: 'DOSAGE', oracleType: 'STRING', nullable: true },
      { column: 'CATEGORY', oracleType: 'STRING', nullable: true },
      { column: 'STATUS', oracleType: 'STRING', nullable: true },
    ],
  },
};

/**
 * Fetches allowlisted tables from the backend metadata API.
 */
export async function fetchAllowlistedTables(): Promise<AllowlistedTable[]> {
  try {
    const res = await fetch('/api/database/tables', {
      headers: {
        'x-api-key': DEFAULT_AUTH_KEY,
      },
    });

    if (res.ok) {
      const json = await res.json();
      if (json.success && Array.isArray(json.data) && json.data.length > 0) {
        return json.data;
      }
    }
  } catch (err) {
    console.warn('[DatabaseApi] Fetch tables failed, using allowlist fallback:', err);
  }

  // Fallback to static allowlist if DB is uninitialized or unreachable
  return Object.keys(FALLBACK_TABLES).map((table) => ({
    table,
    primaryKey: FALLBACK_TABLES[table].pk,
    columnCount: FALLBACK_TABLES[table].columns.length,
  }));
}

/**
 * Fetches allowlisted columns for a table.
 */
export async function fetchAllowlistedColumns(tableName: string): Promise<AllowlistedColumn[]> {
  const upper = tableName.toUpperCase();
  try {
    const res = await fetch(`/api/database/tables/${encodeURIComponent(upper)}/columns`, {
      headers: {
        'x-api-key': DEFAULT_AUTH_KEY,
      },
    });

    if (res.ok) {
      const json = await res.json();
      if (json.success && Array.isArray(json.data) && json.data.length > 0) {
        return json.data;
      }
    }
  } catch (err) {
    console.warn(`[DatabaseApi] Fetch columns for "${tableName}" failed, using fallback:`, err);
  }

  // Fallback to static allowlist columns
  return FALLBACK_TABLES[upper]?.columns || [];
}
