import { executeQuery, withTransaction, oracledb } from '../database/oracle.js';
import { getForm } from './formService.js';
import { executeFormQuery } from './queryExecutionService.js';
import {
  isTableAllowlisted,
  isColumnAllowlisted,
  getAllowlistedEntity,
} from '../config/bindableEntities.js';

/**
 * Maps field oracleType ('STRING' | 'NUMBER' | 'DATE') to node-oracledb bind types.
 * Derives explicit type to avoid auto-detection type mismatches (e.g. ORA-01722).
 */
function getExplicitBind(value, oracleType, columnName = '') {
  const typeStr = (oracleType || 'STRING').toUpperCase();
  const colUpper = (columnName || '').toUpperCase();

  if (value === undefined || value === null || value === '') {
    let bindType = oracledb.STRING;
    if (typeStr === 'NUMBER' || colUpper.includes('ID') || colUpper.includes('NO')) bindType = oracledb.NUMBER;
    else if (typeStr === 'DATE') bindType = oracledb.DATE;
    return { val: null, type: bindType };
  }

  // Smart resolution for GENDERID numeric foreign key
  if (colUpper === 'GENDERID' || colUpper === 'GENDER') {
    if (value === 'M' || value === 'Male' || value === '1' || value === 1) {
      return { val: 1, type: oracledb.NUMBER };
    }
    if (value === 'F' || value === 'Female' || value === '2' || value === 2) {
      return { val: 2, type: oracledb.NUMBER };
    }
    const num = Number(value);
    if (!isNaN(num)) return { val: num, type: oracledb.NUMBER };
  }

  if (typeStr === 'NUMBER') {
    const num = Number(value);
    if (isNaN(num)) {
      throw new Error(`Expected numeric value but received: "${value}"`);
    }
    return { val: num, type: oracledb.NUMBER };
  }

  if (typeStr === 'DATE') {
    let dateObj;
    if (value instanceof Date) {
      dateObj = value;
    } else {
      const parsed = new Date(value);
      if (isNaN(parsed.getTime())) {
        throw new Error(`Expected valid date format but received: "${value}"`);
      }
      dateObj = parsed;
    }
    return { val: dateObj, type: oracledb.DATE };
  }

  // Default: STRING
  return { val: String(value), type: oracledb.STRING };
}

/**
 * Formats Oracle values into client-friendly format.
 * Converts Date objects into UTC ISO 'YYYY-MM-DD' strings.
 */
function formatOracleValue(val) {
  if (val === null || val === undefined) return '';
  if (val instanceof Date) {
    return val.toISOString().split('T')[0];
  }
  return val;
}

/**
 * Server-side validation of submitted form data against the FormDefinition schema.
 */
export function validateFormData(form, submittedData) {
  const errors = {};
  const fields = Object.values(form.fields || {});

  for (const field of fields) {
    if (field.type === 'heading' || field.type === 'divider') continue;

    const val = submittedData[field.name] !== undefined ? submittedData[field.name] : submittedData[field.id];
    const rules = field.validation || {};

    // Required check
    if (rules.required) {
      if (field.type === 'pain_assessment') {
        const pVal = typeof val === 'object' && val !== null ? val : {};
        const hasPresence = Boolean(pVal.painPresent);
        const hasLoc = Boolean(pVal.location && String(pVal.location).trim());
        const hasScore = pVal.score !== null && pVal.score !== undefined && pVal.score !== '';
        if (!hasPresence && !hasLoc && !hasScore) {
          errors[field.name || field.id] = rules.customErrorMessage || `${field.label} is required.`;
          continue;
        }
      } else if (
        val === undefined ||
        val === null ||
        val === '' ||
        (Array.isArray(val) && val.length === 0)
      ) {
        errors[field.name || field.id] = rules.customErrorMessage || `${field.label} is required.`;
        continue;
      }
    }

    if (val === undefined || val === null || val === '') continue;

    // Pain Assessment check
    if (field.type === 'pain_assessment') {
      const pVal = typeof val === 'object' && val !== null ? val : {};
      if (pVal.score !== null && pVal.score !== undefined && pVal.score !== '') {
        const num = Number(pVal.score);
        if (isNaN(num) || num < 0 || num > 10 || !Number.isInteger(num)) {
          errors[field.name || field.id] = 'Pain score must be an integer between 0 and 10.';
        }
      }
      if (pVal.painPresent && !['yes', 'no', ''].includes(pVal.painPresent)) {
        errors[field.name || field.id] = 'Pain presence must be Yes or No.';
      }
    }

    // Number check
    if (field.type === 'number') {
      const num = Number(val);
      if (isNaN(num)) {
        errors[field.name || field.id] = 'Must be a valid number.';
        continue;
      }
      if (rules.min !== undefined && num < rules.min) {
        errors[field.name || field.id] = rules.customErrorMessage || `Minimum value is ${rules.min}.`;
      }
      if (rules.max !== undefined && num > rules.max) {
        errors[field.name || field.id] = rules.customErrorMessage || `Maximum value is ${rules.max}.`;
      }
    }

    // String length & pattern check
    if (field.type === 'text' || field.type === 'textarea') {
      const str = String(val);
      if (rules.minLength !== undefined && str.length < rules.minLength) {
        errors[field.name || field.id] = rules.customErrorMessage || `Minimum length is ${rules.minLength} characters.`;
      }
      if (rules.maxLength !== undefined && str.length > rules.maxLength) {
        errors[field.name || field.id] = rules.customErrorMessage || `Maximum length is ${rules.maxLength} characters.`;
      }
      if (rules.pattern) {
        try {
          const reg = new RegExp(rules.pattern);
          if (!reg.test(str)) {
            errors[field.name || field.id] = rules.customErrorMessage || 'Invalid format.';
          }
        } catch {
          // ignore regex pattern compile error
        }
      }
    }
  }

  return errors;
}

/**
 * Step 6: Fetches dynamic lookup options for all fields with optionsBinding in one batched call.
 */
export async function getFormOptions(formId) {
  const form = await getForm(formId);
  if (!form) {
    const err = new Error(`Form with id "${formId}" not found.`);
    err.status = 404;
    throw err;
  }

  const resultOptions = {};
  const fields = Object.values(form.fields || {});

  for (const field of fields) {
    const ob = field.optionsBinding;
    if (!ob || !ob.table || !ob.valueColumn || !ob.labelColumn) continue;

    const table = ob.table.trim().toUpperCase();
    const valCol = ob.valueColumn.trim().toUpperCase();
    const lblCol = ob.labelColumn.trim().toUpperCase();

    // Security check: must exist in allowlist
    if (
      !isTableAllowlisted(table) ||
      !isColumnAllowlisted(table, valCol) ||
      !isColumnAllowlisted(table, lblCol)
    ) {
      console.warn(
        `[FormDataService] Rejected non-allowlisted options binding for field "${field.id}": ${table}.${valCol}`
      );
      continue;
    }

    try {
      const sql = `SELECT ${valCol} AS "value", ${lblCol} AS "label" FROM ${table} ORDER BY ${lblCol} ASC`;
      const queryRes = await executeQuery(sql);
      resultOptions[field.name || field.id] = (queryRes.rows || []).map((r) => ({
        value: String(r.value || r.VALUE || ''),
        label: String(r.label || r.LABEL || ''),
      }));
    } catch (err) {
      console.error(`[FormDataService] Options query failed for ${table}:`, err.message);
      resultOptions[field.name || field.id] = [];
    }
  }

  return resultOptions;
}

const COLUMN_ALIASES = {
  PATIENT: {
    PATIENT_NAME: 'PATIENTNAME',
    FIRST_NAME: 'FIRSTNAME',
    LAST_NAME: 'LASTNAME',
    PHONE: 'MOBILENO',
    MOBILE: 'MOBILENO',
    GENDER: 'GENDERID',
  },
};

export function resolveActualColumn(tableName, requestedCol) {
  const tbl = (tableName || '').toUpperCase();
  const col = (requestedCol || '').toUpperCase();
  if (COLUMN_ALIASES[tbl] && COLUMN_ALIASES[tbl][col]) {
    return COLUMN_ALIASES[tbl][col];
  }
  return col;
}

/**
 * Step 7: Fetches an existing record (prefill) using settings.primaryEntity and settings.primaryKeyColumn.
 */
export async function getRecordData(formId, recordId) {
  const form = await getForm(formId);
  if (!form) {
    const err = new Error(`Form with id "${formId}" not found.`);
    err.status = 404;
    throw err;
  }

  let primaryEntity = form.settings?.primaryEntity?.trim().toUpperCase();
  let primaryKeyColumn = form.settings?.primaryKeyColumn?.trim().toUpperCase();

  // Auto-detect primaryEntity from bound fields if not set in form.settings
  if (!primaryEntity) {
    for (const field of Object.values(form.fields || {})) {
      if (field.dataBinding?.source === 'oracle' && field.dataBinding?.table) {
        const t = field.dataBinding.table.trim().toUpperCase();
        if (isTableAllowlisted(t)) {
          primaryEntity = t;
          const entityDef = getAllowlistedEntity(t);
          primaryKeyColumn = primaryKeyColumn || entityDef?.primaryKey;
          break;
        }
      }
    }
  }

  // Fallback default to PATIENT if querying patient data
  if (!primaryEntity) {
    primaryEntity = 'PATIENT';
    primaryKeyColumn = 'PATIENT_ID';
  }
  if (!primaryKeyColumn) {
    const entityDef = getAllowlistedEntity(primaryEntity);
    primaryKeyColumn = entityDef?.primaryKey || 'PATIENT_ID';
  }

  if (!isTableAllowlisted(primaryEntity) || !isColumnAllowlisted(primaryEntity, primaryKeyColumn)) {
    const err = new Error('Requested database entity is not allowed.');
    err.status = 403;
    throw err;
  }

  // Find all fields bound to this primaryEntity in read or read-write mode
  const boundFields = [];
  const selectedColumns = new Map();
  selectedColumns.set(primaryKeyColumn, resolveActualColumn(primaryEntity, primaryKeyColumn));

  for (const field of Object.values(form.fields || {})) {
    const db = field.dataBinding;
    let col = db?.column?.toUpperCase();

    // Heuristic fallback if field has no explicit column binding: match by label or name
    if (!col) {
      const lbl = (field.label || '').toLowerCase();
      const nm = (field.name || '').toLowerCase();
      if (
        (lbl.includes('patient') && lbl.includes('id')) ||
        lbl.includes('mrn') ||
        nm.includes('patient_id') ||
        nm.includes('mrn')
      ) {
        col = 'PATIENT_ID';
      } else if (lbl.includes('name') || nm.includes('name') || nm.includes('patientname')) {
        col = 'PATIENTNAME';
      } else if (lbl.includes('dob') || lbl.includes('birth') || nm.includes('dob')) {
        col = 'DOB';
      } else if (lbl.includes('mobile') || lbl.includes('phone') || nm.includes('phone') || nm.includes('mobileno')) {
        col = 'MOBILENO';
      } else if (lbl.includes('gender') || nm.includes('gender')) {
        col = 'GENDERID';
      }
    }

    if (col && isColumnAllowlisted(primaryEntity, col)) {
      const actualCol = resolveActualColumn(primaryEntity, col);
      selectedColumns.set(col, actualCol);
      boundFields.push({
        fieldName: field.name || field.id,
        column: col,
        actualColumn: actualCol,
        oracleType: db?.oracleType || 'STRING',
      });
    }
  }

  const selectParts = [];
  for (const [col, actualCol] of selectedColumns.entries()) {
    if (col === actualCol) {
      selectParts.push(actualCol);
    } else {
      selectParts.push(`${actualCol} AS "${col}"`);
    }
  }

  // In PATIENT table, support matching either PATIENT_ID or MRNO
  let whereClause = `${primaryKeyColumn} = :recordId`;
  if (primaryEntity === 'PATIENT' && (primaryKeyColumn === 'PATIENT_ID' || primaryKeyColumn === 'MRNO')) {
    whereClause = `(PATIENT_ID = :recordId OR MRNO = :recordId)`;
  }

  const sql = `SELECT ${selectParts.join(', ')} FROM ${primaryEntity} WHERE ${whereClause}`;
  const binds = { recordId: String(recordId) };

  const queryRes = await executeQuery(sql, binds);
  if (!queryRes.rows || queryRes.rows.length === 0) {
    const err = new Error(`Record "${recordId}" not found in ${primaryEntity}.`);
    err.status = 404;
    throw err;
  }

  const row = queryRes.rows[0];
  const responseData = {};

  // Map Oracle columns back to field IDs/names
  for (const bf of boundFields) {
    let rawVal = row[bf.column] !== undefined ? row[bf.column] : row[bf.actualColumn];
    if (rawVal === undefined) {
      rawVal = row[bf.column.toLowerCase()] !== undefined ? row[bf.column.toLowerCase()] : row[bf.actualColumn.toLowerCase()];
    }
    responseData[bf.fieldName] = formatOracleValue(rawVal);
  }

  // Also execute any configured SQL queries on the form with recordId / parameters
  if (Array.isArray(form.sqlQueries) && form.sqlQueries.length > 0) {
    for (const q of form.sqlQueries) {
      if (q.enabled === false) continue;
      try {
        const queryResult = await executeFormQuery(form, q.id, {
          recordId: String(recordId),
          mrno: String(recordId),
          patient_id: String(recordId),
          patientId: String(recordId),
          ...responseData,
        });
        if (queryResult && queryResult.mappedValues) {
          for (const [k, v] of Object.entries(queryResult.mappedValues)) {
            if (v !== undefined && v !== null && v !== '') {
              responseData[k] = v;
            }
          }
        }
      } catch (qErr) {
        console.warn(`[getRecordData] Notice executing form SQL query "${q.name || q.id}":`, qErr.message);
      }
    }
  }

  // Heuristic lookup for vitalsign weight if form has a weight field and it is not yet populated
  const weightField = Object.values(form.fields || {}).find(
    (f) => (f.name || '').toLowerCase() === 'weight' || (f.label || '').toLowerCase() === 'weight'
  );
  if (weightField && (responseData[weightField.name] === undefined || responseData[weightField.name] === '')) {
    try {
      const pidVal = responseData['patient_id'] || responseData['patientId'] || row['PATIENT_ID'] || recordId;
      const mrnoVal = responseData['mrno'] || row['MRNO'] || recordId;
      const vsSql = `
        SELECT CURRENT_VALUE
        FROM (
          SELECT vs.CURRENT_VALUE
          FROM VITALSIGN vs
          INNER JOIN PATIENT p ON vs.PATIENT_ID = p.PATIENT_ID
          WHERE UPPER(TRIM(vs.PARAMETER_VALUE)) = 'WEIGHT'
            AND vs.CURRENT_VALUE IS NOT NULL
            AND (p.PATIENT_ID = :pid OR p.MRNO = :mrno)
          ORDER BY vs.ENTERED_DATETIME DESC
        )
        WHERE ROWNUM = 1
      `;
      const vsRes = await executeQuery(vsSql, { pid: String(pidVal), mrno: String(mrnoVal) });
      if (vsRes.rows && vsRes.rows.length > 0) {
        const weightVal = vsRes.rows[0].CURRENT_VALUE;
        const numWeight = Number(weightVal);
        responseData[weightField.name] = !isNaN(numWeight) ? numWeight : weightVal;
      }
    } catch (vsErr) {
      console.warn('[getRecordData] Notice fetching vitalsign weight:', vsErr.message);
    }
  }

  // Heuristic lookup for vitalsign height if form has a height field and it is not yet populated
  const heightField = Object.values(form.fields || {}).find(
    (f) => (f.name || '').toLowerCase() === 'height' || (f.label || '').toLowerCase() === 'height'
  );
  if (heightField && (responseData[heightField.name] === undefined || responseData[heightField.name] === '')) {
    try {
      const pidVal = responseData['patient_id'] || responseData['patientId'] || row['PATIENT_ID'] || recordId;
      const mrnoVal = responseData['mrno'] || row['MRNO'] || recordId;
      const htSql = `
        SELECT CURRENT_VALUE
        FROM (
          SELECT vs.CURRENT_VALUE
          FROM VITALSIGN vs
          INNER JOIN PATIENT p ON vs.PATIENT_ID = p.PATIENT_ID
          WHERE UPPER(TRIM(vs.PARAMETER_VALUE)) = 'HEIGHT'
            AND vs.CURRENT_VALUE IS NOT NULL
            AND (p.PATIENT_ID = :pid OR p.MRNO = :mrno)
          ORDER BY vs.ENTERED_DATETIME DESC
        )
        WHERE ROWNUM = 1
      `;
      const htRes = await executeQuery(htSql, { pid: String(pidVal), mrno: String(mrnoVal) });
      if (htRes.rows && htRes.rows.length > 0) {
        const heightVal = htRes.rows[0].CURRENT_VALUE;
        const numHeight = Number(heightVal);
        responseData[heightField.name] = !isNaN(numHeight) ? numHeight : heightVal;
      }
    } catch (htErr) {
      console.warn('[getRecordData] Notice fetching vitalsign height:', htErr.message);
    }
  }

  return responseData;
}

/**
 * Step 8: Inserts new form data into Oracle with explicit bind types inside an atomic transaction.
 */
export async function insertFormData(formId, submittedData) {
  const form = await getForm(formId);
  if (!form) {
    const err = new Error(`Form with id "${formId}" not found.`);
    err.status = 404;
    throw err;
  }

  // 1. Server-side validation
  const validationErrors = validateFormData(form, submittedData);
  if (Object.keys(validationErrors).length > 0) {
    const err = new Error('Validation failed');
    err.status = 400;
    err.validationErrors = validationErrors;
    throw err;
  }

  const primaryEntity = form.settings?.primaryEntity?.trim().toUpperCase();
  const primaryKeyColumn = form.settings?.primaryKeyColumn?.trim().toUpperCase();

  if (!primaryEntity || !primaryKeyColumn) {
    const err = new Error('Form settings do not specify a primaryEntity and primaryKeyColumn for database insertion.');
    err.status = 400;
    throw err;
  }

  if (!isTableAllowlisted(primaryEntity) || !isColumnAllowlisted(primaryEntity, primaryKeyColumn)) {
    const err = new Error('Target entity is not in the security allowlist.');
    err.status = 403;
    throw err;
  }

  // 2. Resolve trusted dataBinding mapping
  const insertColumns = [];
  const insertPlaceholders = [];
  const binds = {};

  // Check if primary key is supplied in data or if we should auto-generate a numeric / id string
  let suppliedPk = submittedData[primaryKeyColumn] || submittedData[primaryKeyColumn.toLowerCase()];

  for (const field of Object.values(form.fields || {})) {
    const db = field.dataBinding;
    if (
      db &&
      db.source === 'oracle' &&
      db.table &&
      db.table.toUpperCase() === primaryEntity &&
      db.column &&
      (db.mode === 'write' || db.mode === 'read-write' || !db.mode)
    ) {
      const col = db.column.toUpperCase();
      if (!isColumnAllowlisted(primaryEntity, col)) continue;
      const actualCol = resolveActualColumn(primaryEntity, col);

      const rawVal = submittedData[field.name] !== undefined ? submittedData[field.name] : submittedData[field.id];
      if (rawVal !== undefined && rawVal !== '') {
        const bindKey = `b_${actualCol}`;
        insertColumns.push(actualCol);
        insertPlaceholders.push(`:${bindKey}`);
        binds[bindKey] = getExplicitBind(rawVal, db.oracleType, actualCol);

        if (col === primaryKeyColumn || actualCol === primaryKeyColumn) {
          suppliedPk = rawVal;
        }
      }
    }
  }

  if (insertColumns.length === 0) {
    throw new Error('No bindable fields found to insert for entity ' + primaryEntity);
  }

  const sql = `INSERT INTO ${primaryEntity} (${insertColumns.join(', ')}) VALUES (${insertPlaceholders.join(', ')})`;

  // 3. Execute inside an atomic transaction
  await withTransaction(async (conn) => {
    await conn.execute(sql, binds);
  });

  return { primaryKey: suppliedPk };
}

/**
 * Step 9: Updates an existing record in Oracle using settings.primaryKeyColumn in WHERE clause.
 */
export async function updateFormData(formId, recordId, submittedData) {
  const form = await getForm(formId);
  if (!form) {
    const err = new Error(`Form with id "${formId}" not found.`);
    err.status = 404;
    throw err;
  }

  if (!recordId) {
    const err = new Error('Record ID is required for update operation.');
    err.status = 400;
    throw err;
  }

  // 1. Validate data
  const validationErrors = validateFormData(form, submittedData);
  if (Object.keys(validationErrors).length > 0) {
    const err = new Error('Validation failed');
    err.status = 400;
    err.validationErrors = validationErrors;
    throw err;
  }

  const primaryEntity = form.settings?.primaryEntity?.trim().toUpperCase();
  const primaryKeyColumn = form.settings?.primaryKeyColumn?.trim().toUpperCase();

  if (!primaryEntity || !primaryKeyColumn) {
    const err = new Error('Form settings do not specify a primaryEntity and primaryKeyColumn for database update.');
    err.status = 400;
    throw err;
  }

  if (!isTableAllowlisted(primaryEntity) || !isColumnAllowlisted(primaryEntity, primaryKeyColumn)) {
    const err = new Error('Target entity is not in the security allowlist.');
    err.status = 403;
    throw err;
  }

  const actualPk = resolveActualColumn(primaryEntity, primaryKeyColumn);

  // 2. Build SET clause
  const setClauses = [];
  const binds = { b_pk: { val: String(recordId), type: oracledb.STRING } };

  for (const field of Object.values(form.fields || {})) {
    const db = field.dataBinding;
    if (
      db &&
      db.source === 'oracle' &&
      db.table &&
      db.table.toUpperCase() === primaryEntity &&
      db.column &&
      (db.mode === 'write' || db.mode === 'read-write' || !db.mode)
    ) {
      const col = db.column.toUpperCase();
      const actualCol = resolveActualColumn(primaryEntity, col);
      // Skip updating primary key column itself in SET clause
      if (col === primaryKeyColumn || actualCol === actualPk) continue;
      if (!isColumnAllowlisted(primaryEntity, col)) continue;

      const rawVal = submittedData[field.name] !== undefined ? submittedData[field.name] : submittedData[field.id];
      if (rawVal !== undefined && rawVal !== '') {
        const bindKey = `b_${actualCol}`;
        setClauses.push(`${actualCol} = :${bindKey}`);
        binds[bindKey] = getExplicitBind(rawVal, db.oracleType, actualCol);
      }
    }
  }

  if (setClauses.length === 0) {
    throw new Error('No bindable fields provided to update for entity ' + primaryEntity);
  }

  const sql = `UPDATE ${primaryEntity} SET ${setClauses.join(', ')} WHERE (${actualPk} = :b_pk OR ${primaryKeyColumn} = :b_pk)`;

  // 3. Execute inside atomic transaction
  let rowsAffected = 0;
  await withTransaction(async (conn) => {
    const res = await conn.execute(sql, binds);
    rowsAffected = res.rowsAffected || 0;
  });

  return { primaryKey: recordId, rowsAffected };
}
