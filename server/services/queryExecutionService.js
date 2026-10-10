import { executeQuery } from '../database/oracle.js';
import { getForm } from './formService.js';
import { isTableAllowlisted, getAllowlistedTableNames } from '../config/bindableEntities.js';

/**
 * Strips SQL comments and leading/trailing whitespace.
 */
function cleanSql(sql) {
  if (!sql || typeof sql !== 'string') return '';
  return sql
    .replace(/--.*$/gm, '') // single-line comments
    .replace(/\/\*[\s\S]*?\*\//g, '') // multi-line comments
    .trim();
}

/**
 * Extracts bind variable names (e.g. :mrno, :patientId) from SQL string.
 * Ignores binds inside single-quoted string literals.
 */
export function extractBindVariables(sql) {
  if (!sql || typeof sql !== 'string') return [];
  // Strip string literals to avoid false positives inside quotes
  const strippedSql = sql.replace(/'(?:''|[^'])*'/g, "''");
  const regex = /:([a-zA-Z][a-zA-Z0-9_]*)/g;
  const binds = new Set();
  let match;
  while ((match = regex.exec(strippedSql)) !== null) {
    binds.add(match[1]);
  }
  return Array.from(binds);
}

function createValidationError(msg) {
  const err = new Error(msg);
  err.status = 400;
  return err;
}

/**
 * Validates that a SQL string is strictly a safe, read-only SELECT statement
 * querying only allowlisted tables.
 */
export function validateSafeSelectSql(sql) {
  const cleaned = cleanSql(sql);
  if (!cleaned) {
    throw createValidationError('SQL query cannot be empty.');
  }

  // Prevent multiple statements separated by semicolon
  const statements = cleaned.split(';').filter((s) => s.trim().length > 0);
  if (statements.length > 1) {
    throw createValidationError('Multiple SQL statements are not permitted.');
  }

  const singleSql = statements[0].trim();

  // Must begin with SELECT or WITH (for CTEs leading to SELECT)
  if (!/^(SELECT|WITH)\s+/i.test(singleSql)) {
    throw createValidationError('Only read-only SELECT queries are permitted.');
  }

  // Strictly disallow DML, DDL, and administrative keywords
  const forbiddenKeywords = [
    '\\bINSERT\\b',
    '\\bUPDATE\\b',
    '\\bDELETE\\b',
    '\\bDROP\\b',
    '\\bALTER\\b',
    '\\bTRUNCATE\\b',
    '\\bCREATE\\b',
    '\\bREPLACE\\b',
    '\\bMERGE\\b',
    '\\bEXEC\\b',
    '\\bEXECUTE\\b',
    '\\bGRANT\\b',
    '\\bREVOKE\\b',
    '\\bDECLARE\\b',
    '\\bBEGIN\\b',
    '\\bCOMMIT\\b',
    '\\bROLLBACK\\b',
    '\\bLOCK\\b',
  ];

  for (const pattern of forbiddenKeywords) {
    const reg = new RegExp(pattern, 'i');
    if (reg.test(singleSql)) {
      throw createValidationError(`Operation not allowed: query contains forbidden keyword (${pattern.replace(/\\b/g, '')}).`);
    }
  }

  return singleSql;
}

/**
 * Formats values returned by Oracle into JSON-serializable primitives.
 */
function formatRowValues(row) {
  if (!row || typeof row !== 'object') return row;
  const formatted = {};
  for (const [key, val] of Object.entries(row)) {
    if (val === null || val === undefined) {
      formatted[key] = null;
    } else if (val instanceof Date) {
      formatted[key] = val.toISOString().split('T')[0];
    } else {
      formatted[key] = val;
    }
  }
  return formatted;
}

/**
 * Sanitizes errors so internal DB credentials or connection strings are never exposed.
 */
function sanitizeDbError(err) {
  const msg = err.message || 'Database query execution failed.';
  // Mask connection strings or passwords if inadvertently present
  return msg
    .replace(/(password|pwd)=[^;]*/gi, '$1=***')
    .replace(/(user|usr)=[^;]*/gi, '$1=***')
    .replace(/ORA-\d+:\s*/gi, '');
}

/**
 * Previews and tests a SQL query against Oracle with provided parameter values.
 */
export async function testQueryPreview(sql, parameters = {}) {
  const validatedSql = validateSafeSelectSql(sql);
  const detectedBinds = extractBindVariables(validatedSql);

  // Prepare bind parameters object
  const binds = {};
  for (const bindName of detectedBinds) {
    let val = parameters[bindName] !== undefined ? parameters[bindName] : null;
    if (bindName.toLowerCase().includes('mrn') && val !== null && val !== undefined && val !== '') {
      val = String(val).trim();
    }
    binds[bindName] = val === '' ? null : val;
  }

  try {
    const result = await executeQuery(validatedSql, binds, { maxRows: 10 });

    // Extract column names from Oracle metaData or first row
    let columns = [];
    if (result.metaData && Array.isArray(result.metaData)) {
      columns = result.metaData.map((m) => m.name);
    } else if (result.rows && result.rows.length > 0) {
      columns = Object.keys(result.rows[0]);
    }

    const rows = (result.rows || []).map(formatRowValues);

    return {
      success: true,
      columns,
      rows,
      rowCount: rows.length,
      detectedParameters: detectedBinds,
    };
  } catch (err) {
    console.error('[QueryExecutionService] testQueryPreview error:', err.message);
    const safeError = sanitizeDbError(err);
    const errorObj = new Error(safeError);
    errorObj.status = 400;
    throw errorObj;
  }
}

/**
 * Executes a configured SqlQueryDefinition for a form, populating parameters from the request.
 */
export async function executeFormQuery(formOrId, queryId, parameterValues = {}) {
  let form = formOrId;
  if (typeof formOrId === 'string') {
    form = await getForm(formOrId);
    if (!form) {
      const err = new Error(`Form with id "${formOrId}" not found.`);
      err.status = 404;
      throw err;
    }
  }

  const queries = form.sqlQueries || [];
  const query = queries.find((q) => q.id === queryId);
  if (!query) {
    const err = new Error(`SQL Query with id "${queryId}" not found on this form.`);
    err.status = 404;
    throw err;
  }

  if (query.enabled === false) {
    const err = new Error(`SQL Query "${query.name || queryId}" is disabled.`);
    err.status = 400;
    throw err;
  }

  const validatedSql = validateSafeSelectSql(query.sql);
  const detectedBinds = extractBindVariables(validatedSql);

  // Build bind values using parameterMappings
  const binds = {};
  for (const bindName of detectedBinds) {
    const mapping = query.parameterMappings?.[bindName];
    let val = null;

    if (mapping) {
      if (mapping.source === 'static') {
        val = mapping.value;
      } else if (mapping.source === 'form' && mapping.fieldKey) {
        val = parameterValues[mapping.fieldKey];
      } else if (mapping.source === 'context') {
        val = parameterValues[mapping.fieldKey || bindName];
      }
    }

    // Direct fallback if supplied in parameterValues with exact or case-insensitive bind name
    if (val === undefined || val === null) {
      if (parameterValues[bindName] !== undefined) {
        val = parameterValues[bindName];
      } else {
        const lowerBind = bindName.toLowerCase();
        for (const [k, v] of Object.entries(parameterValues)) {
          if (
            k.toLowerCase() === lowerBind ||
            k.toLowerCase().replace(/[^a-z0-9]/g, '') === lowerBind ||
            (lowerBind === 'mrno' && k.toLowerCase().includes('mrn')) ||
            (lowerBind === 'patient_id' && (k.toLowerCase().includes('patient_id') || k.toLowerCase().includes('patientid')))
          ) {
            val = v;
            break;
          }
        }
      }
    }

    if (bindName.toLowerCase().includes('mrn') && val !== null && val !== undefined && val !== '') {
      binds[bindName] = String(val).trim();
    } else {
      binds[bindName] = val === undefined || val === '' ? null : val;
    }
  }

  try {
    const result = await executeQuery(validatedSql, binds, { maxRows: 1 });
    const row = result.rows && result.rows.length > 0 ? formatRowValues(result.rows[0]) : null;

    // Apply result mappings: map SQL column names / aliases to form field keys (field.name)
    const mappedValues = {};
    if (row && query.resultMappings) {
      for (const [colName, fieldKey] of Object.entries(query.resultMappings)) {
        if (!fieldKey) continue;
        // Check exact match, uppercase match, and lowercase match in row
        if (row[colName] !== undefined) {
          mappedValues[fieldKey] = row[colName];
        } else if (row[colName.toUpperCase()] !== undefined) {
          mappedValues[fieldKey] = row[colName.toUpperCase()];
        } else if (row[colName.toLowerCase()] !== undefined) {
          mappedValues[fieldKey] = row[colName.toLowerCase()];
        }
      }
    }

    // Auto-map fallback for form fields if not explicitly mapped
    if (row && form.fields) {
      const formFields = Object.values(form.fields || {});
      const rowKeys = Object.keys(row);

      for (const f of formFields) {
        if (f.type === 'heading' || f.type === 'divider') continue;
        const fKey = f.name || f.id;
        if (mappedValues[fKey] !== undefined && mappedValues[fKey] !== null) continue;

        const fNameClean = (f.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        const fLabelClean = (f.label || '').toLowerCase().replace(/[^a-z0-9]/g, '');

        for (const col of rowKeys) {
          const colClean = col.toLowerCase().replace(/[^a-z0-9]/g, '');
          const isDirectMatch =
            (fNameClean && colClean === fNameClean) ||
            (fLabelClean && colClean === fLabelClean) ||
            col.toLowerCase() === (f.name || '').toLowerCase() ||
            col.toLowerCase() === (f.label || '').toLowerCase();

          const isNameMatch =
            (colClean === 'patientname' || colClean === 'firstname') &&
            (fNameClean.includes('name') || fLabelClean.includes('name'));

          if (isDirectMatch || isNameMatch) {
            if (row[col] !== undefined && row[col] !== null) {
              mappedValues[fKey] = row[col];
              break;
            }
          }
        }
      }
    }

    return {
      success: true,
      rawRow: row,
      mappedValues,
    };
  } catch (err) {
    console.error(`[QueryExecutionService] executeFormQuery("${queryId}") error:`, err.message);
    const safeError = sanitizeDbError(err);
    const errorObj = new Error(safeError);
    errorObj.status = 400;
    throw errorObj;
  }
}
