import {
  isTableAllowlisted,
  isColumnAllowlisted,
  getAllowlistedEntity,
} from '../config/bindableEntities.js';
import { getOracleHealth } from '../database/oracle.js';

const SUPPORTED_FIELD_TYPES = new Set([
  'text',
  'textarea',
  'number',
  'date',
  'time',
  'select',
  'radio',
  'checkbox',
  'heading',
  'divider',
  'table',
]);

const DANGEROUS_SQL_PATTERNS = [
  /;\s*drop\s+/i,
  /;\s*alter\s+/i,
  /;\s*delete\s+/i,
  /;\s*truncate\s+/i,
  /union\s+select/i,
  /--/,
  /\/\*/,
];

/**
 * Validates a FormDefinition before it is permitted to be published.
 * Returns { valid: boolean, issues: Array<{ type, category, message, fieldId? }>, summary: object }
 */
export async function validateFormForPublishing(formDef) {
  const issues = [];

  if (!formDef || typeof formDef !== 'object') {
    return {
      valid: false,
      issues: [{ type: 'error', category: 'structure', message: 'Form definition payload is missing or invalid.' }],
      summary: { totalFields: 0, databaseBindings: 0, optionsBindings: 0, oracleAvailable: false },
    };
  }

  // 1. Structure Checks
  if (!formDef.title || !formDef.title.trim()) {
    issues.push({
      type: 'error',
      category: 'structure',
      message: 'Form title is required.',
    });
  }

  const fields = formDef.fields || {};
  const fieldList = Object.values(fields);
  let dbBindingsCount = 0;
  let optionsBindingsCount = 0;

  if (fieldList.length === 0) {
    issues.push({
      type: 'error',
      category: 'structure',
      message: 'Form must contain at least one field before it can be published.',
    });
  }

  // Verify all fields
  for (const field of fieldList) {
    if (!field.id) {
      issues.push({
        type: 'error',
        category: 'structure',
        message: 'A field is missing its unique identifier.',
      });
      continue;
    }

    if (!SUPPORTED_FIELD_TYPES.has(field.type)) {
      issues.push({
        type: 'error',
        category: 'runtime',
        message: `Field "${field.label || field.id}" has unsupported field type "${field.type}".`,
        fieldId: field.id,
      });
    }

    // Security check on label and help text
    if (field.label && (field.label.includes('<script') || field.label.includes('javascript:'))) {
      issues.push({
        type: 'error',
        category: 'security',
        message: `Field "${field.label}" contains unsafe script expressions.`,
        fieldId: field.id,
      });
    }

    // 2. Database Field Binding Checks
    if (field.dataBinding && field.dataBinding.source === 'oracle') {
      dbBindingsCount++;
      const { table, column, oracleType } = field.dataBinding;

      if (!table || !table.trim()) {
        issues.push({
          type: 'error',
          category: 'binding',
          message: `Field "${field.label || field.id}" has database binding enabled but no target table is specified.`,
          fieldId: field.id,
        });
      } else if (!isTableAllowlisted(table)) {
        issues.push({
          type: 'error',
          category: 'binding',
          message: `Database table "${table}" bound to field "${field.label || field.id}" is not in the security allowlist.`,
          fieldId: field.id,
        });
      }

      if (!column || !column.trim()) {
        issues.push({
          type: 'error',
          category: 'binding',
          message: `Field "${field.label || field.id}" has database binding enabled but no target column is specified.`,
          fieldId: field.id,
        });
      } else if (table && isTableAllowlisted(table) && !isColumnAllowlisted(table, column)) {
        issues.push({
          type: 'error',
          category: 'binding',
          message: `Database column "${column}" on table "${table}" bound to field "${field.label || field.id}" is not allowlisted.`,
          fieldId: field.id,
        });
      }

      // Security check for SQL injection patterns
      if (table && DANGEROUS_SQL_PATTERNS.some((pat) => pat.test(table))) {
        issues.push({
          type: 'error',
          category: 'security',
          message: `Suspicious SQL pattern detected in table name for field "${field.label || field.id}".`,
          fieldId: field.id,
        });
      }
      if (column && DANGEROUS_SQL_PATTERNS.some((pat) => pat.test(column))) {
        issues.push({
          type: 'error',
          category: 'security',
          message: `Suspicious SQL pattern detected in column name for field "${field.label || field.id}".`,
          fieldId: field.id,
        });
      }
    }

    // 3. Dynamic Options Binding Checks
    if (field.optionsBinding && field.optionsBinding.table) {
      optionsBindingsCount++;
      const { table, valueColumn, labelColumn } = field.optionsBinding;

      if (!isTableAllowlisted(table)) {
        issues.push({
          type: 'error',
          category: 'options',
          message: `Lookup table "${table}" on field "${field.label || field.id}" is not allowlisted.`,
          fieldId: field.id,
        });
      }

      if (valueColumn && !isColumnAllowlisted(table, valueColumn)) {
        issues.push({
          type: 'error',
          category: 'options',
          message: `Lookup value column "${valueColumn}" on table "${table}" is not allowlisted.`,
          fieldId: field.id,
        });
      }

      if (labelColumn && !isColumnAllowlisted(table, labelColumn)) {
        issues.push({
          type: 'error',
          category: 'options',
          message: `Lookup label column "${labelColumn}" on table "${table}" is not allowlisted.`,
          fieldId: field.id,
        });
      }
    }
  }

  // 4. Primary Entity & Key Check
  const primaryEntity = formDef.settings?.primaryEntity;
  const primaryKeyColumn = formDef.settings?.primaryKeyColumn;

  if (primaryEntity) {
    if (!isTableAllowlisted(primaryEntity)) {
      issues.push({
        type: 'error',
        category: 'binding',
        message: `Primary entity table "${primaryEntity}" is not in the database security allowlist.`,
      });
    } else {
      const entityDef = getAllowlistedEntity(primaryEntity);
      if (primaryKeyColumn && !isColumnAllowlisted(primaryEntity, primaryKeyColumn)) {
        issues.push({
          type: 'error',
          category: 'binding',
          message: `Primary key column "${primaryKeyColumn}" is not valid for table "${primaryEntity}".`,
        });
      }
    }
  }

  // 4b. Patient Form Behavior Check
  const patientFormMode = formDef.settings?.patientFormMode;
  if (patientFormMode && patientFormMode !== 'NEW_RECORD' && patientFormMode !== 'CONTINUE_EXISTING') {
    issues.push({
      type: 'error',
      category: 'runtime',
      message: `Invalid patient form behavior mode: "${patientFormMode}". Must be NEW_RECORD or CONTINUE_EXISTING.`,
    });
  }

  // 5. Layout & 12-Column Grid Validation
  const layout = formDef.layout || [];
  if (layout.length === 0 && fieldList.length > 0) {
    issues.push({
      type: 'warning',
      category: 'structure',
      message: 'Form has fields defined but no layout sections configured.',
    });
  }

  for (let sIdx = 0; sIdx < layout.length; sIdx++) {
    const section = layout[sIdx];
    const rows = section.rows || [];

    for (let rIdx = 0; rIdx < rows.length; rIdx++) {
      const row = rows[rIdx];
      const columns = row.columns || [];

      if (columns.length > 0) {
        const colSum = columns.reduce((acc, col) => acc + (col.width || 0), 0);
        if (colSum !== 12) {
          issues.push({
            type: 'error',
            category: 'structure',
            message: `Section "${section.title || sIdx + 1}", Row ${rIdx + 1} column widths total ${colSum} instead of exactly 12 columns.`,
          });
        }

        // Verify that every fieldId placed in layout exists in form.fields
        for (const col of columns) {
          for (const fId of col.fieldIds || []) {
            if (!fields[fId]) {
              issues.push({
                type: 'error',
                category: 'structure',
                message: `Layout references field id "${fId}" which does not exist in the form's field definitions.`,
              });
            }
          }
        }
      }
    }
  }

  // 6. Oracle Database Health Check
  let dbConnected = false;
  try {
    const health = await getOracleHealth();
    dbConnected = !!health.connected;
  } catch {
    dbConnected = false;
  }

  if (dbBindingsCount > 0 && !dbConnected) {
    issues.push({
      type: 'warning',
      category: 'binding',
      message: 'Oracle database connection pool is currently unavailable. Users will not be able to fetch or submit database records until connection is restored.',
    });
  }

  const errors = issues.filter((i) => i.type === 'error');
  const isValid = errors.length === 0;

  return {
    valid: isValid,
    issues,
    summary: {
      totalFields: fieldList.length,
      databaseBindings: dbBindingsCount,
      optionsBindings: optionsBindingsCount,
      oracleAvailable: dbConnected,
    },
  };
}
