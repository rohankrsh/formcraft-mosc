/**
 * Security Allowlist for FormCraft Database Bindings.
 * Only tables and columns explicitly defined in this file may ever be
 * inspected, queried, inserted into, or updated by the form engine.
 */

export const BINDABLE_ENTITIES = [
  {
    table: 'PATIENT',
    primaryKey: 'PATIENT_ID',
    columns: [
      'PATIENT_ID',
      'MRNO',
      'PATIENTNAME',
      'PATIENT_NAME',
      'FIRSTNAME',
      'FIRST_NAME',
      'MIDDLENAME',
      'LASTNAME',
      'LAST_NAME',
      'DOB',
      'AGE',
      'GENDER',
      'GENDERID',
      'MOBILENO',
      'PHONE',
      'EMAIL',
      'ADDRESS',
      'BLOOD_GROUP',
      'BLOODBANKBLOODGROUP',
      'AADHAAR_NO',
      'PANNUM',
      'PRIMARY_DRUG_ID',
      'STATUS',
    ],
  },
  {
    table: 'ADMISSION',
    primaryKey: 'ADMISSION_ID',
    columns: [
      'ADMISSION_ID',
      'PATIENT_ID',
      'ADMISSION_DATE',
      'DISCHARGE_DATE',
      'ROOM_NO',
      'DOCTOR_NAME',
      'STATUS',
    ],
  },
  {
    table: 'VITALS',
    primaryKey: 'VITAL_ID',
    columns: [
      'VITAL_ID',
      'PATIENT_ID',
      'RECORDED_AT',
      'BLOOD_PRESSURE',
      'HEART_RATE',
      'TEMPERATURE',
      'SPO2',
    ],
  },
  {
    table: 'VITALSIGN',
    primaryKey: 'VITAL_SIGN_ID',
    columns: [
      'VITAL_SIGN_ID',
      'PATIENT_ID',
      'PARAMETER_VALUE',
      'CURRENT_VALUE',
      'ENTERED_DATETIME',
      'UOM_ID',
      'STATUS',
    ],
  },
  {
    table: 'DRUG_MASTER',
    primaryKey: 'DRUG_GEN_ID',
    columns: [
      'DRUG_GEN_ID',
      'DRUG_NAME',
      'DOSAGE',
      'CATEGORY',
      'STATUS',
    ],
  },
];

/**
 * Returns whether a given table name is present in the allowlist (case-insensitive).
 */
export function isTableAllowlisted(tableName) {
  if (!tableName || typeof tableName !== 'string') return false;
  const upper = tableName.trim().toUpperCase();
  return BINDABLE_ENTITIES.some((entity) => entity.table.toUpperCase() === upper);
}

/**
 * Returns whether a given column is allowed for the specified table (case-insensitive).
 */
export function isColumnAllowlisted(tableName, columnName) {
  if (!tableName || !columnName) return false;
  const upperTable = tableName.trim().toUpperCase();
  const upperCol = columnName.trim().toUpperCase();

  const entity = BINDABLE_ENTITIES.find(
    (e) => e.table.toUpperCase() === upperTable
  );
  if (!entity) return false;

  return entity.columns.some((col) => col.toUpperCase() === upperCol);
}

/**
 * Retrieves the allowlist entry for a table.
 */
export function getAllowlistedEntity(tableName) {
  if (!tableName) return null;
  const upper = tableName.trim().toUpperCase();
  return BINDABLE_ENTITIES.find((e) => e.table.toUpperCase() === upper) || null;
}

/**
 * Returns all allowlisted table names.
 */
export function getAllowlistedTableNames() {
  return BINDABLE_ENTITIES.map((e) => e.table);
}
