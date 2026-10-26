import { executeQuery, withTransaction, getOracleHealth } from '../database/oracle.js';
import { formRepository } from '../repositories/formRepository.js';
import * as patientService from './patientService.js';
import { updateFormData } from './formDataService.js';
import { logActivity } from './activityLogService.js';

/**
 * Safely extracts string from node-oracledb Lob object or string, then parses JSON.
 */
async function parseClobJson(clobOrStr) {
  if (!clobOrStr) return {};
  let str = '';
  if (typeof clobOrStr === 'string') {
    str = clobOrStr;
  } else if (clobOrStr && typeof clobOrStr.getData === 'function') {
    str = await clobOrStr.getData();
  } else {
    str = String(clobOrStr);
  }
  try {
    return JSON.parse(str);
  } catch {
    return {};
  }
}

/**
 * Normalizes Date or timestamp into clean ISO string.
 */
function toIso(val) {
  if (!val) return null;
  if (val instanceof Date) return val.toISOString();
  return String(val);
}

/**
 * Shallow / deep comparison of two form data objects to identify changed keys and values.
 */
function computeDataDiff(oldData = {}, newData = {}) {
  const diff = {};
  const allKeys = new Set([...Object.keys(oldData || {}), ...Object.keys(newData || {})]);

  for (const key of allKeys) {
    const oldVal = oldData ? oldData[key] : undefined;
    const newVal = newData ? newData[key] : undefined;

    const oldStr = JSON.stringify(oldVal === undefined ? null : oldVal);
    const newStr = JSON.stringify(newVal === undefined ? null : newVal);

    if (oldStr !== newStr) {
      diff[key] = {
        from: oldVal !== undefined ? oldVal : null,
        to: newVal !== undefined ? newVal : null,
      };
    }
  }

  return diff;
}

/**
 * Retrieves paginated list of all submissions system-wide with search, filter, and sorting.
 */
export async function listAdminSubmissions({
  page = 1,
  pageSize = 15,
  search = '',
  formSlug = '',
  formId = '',
  mrno = '',
  submittedBy = '',
  status = '',
  startDate = '',
  endDate = '',
  sortBy = 'submittedAt',
  sortOrder = 'desc',
} = {}) {
  const p = Math.max(1, Number(page) || 1);
  const size = Math.min(100, Math.max(5, Number(pageSize) || 15));
  const offset = (p - 1) * size;

  const conditions = ['1=1'];
  const binds = {
    b_offset: offset,
    b_limit: size,
  };

  if (search && search.trim()) {
    conditions.push(`(
      UPPER(s.FORM_SLUG) LIKE :b_search
      OR UPPER(s.FORM_ID) LIKE :b_search
      OR UPPER(s.MRNO) LIKE :b_search
      OR UPPER(s.SUBMITTED_BY) LIKE :b_search
      OR TO_CHAR(s.ID) = :b_search_exact
      OR UPPER(f.NAME) LIKE :b_search
      OR UPPER(p.PATIENTNAME) LIKE :b_search
    )`);
    const cleanSearch = search.trim();
    binds.b_search = `%${cleanSearch.toUpperCase()}%`;
    binds.b_search_exact = cleanSearch;
  }

  if (formSlug && formSlug.trim()) {
    conditions.push('LOWER(s.FORM_SLUG) = LOWER(:b_form_slug)');
    binds.b_form_slug = formSlug.trim();
  }

  if (formId && formId.trim()) {
    conditions.push('s.FORM_ID = :b_form_id');
    binds.b_form_id = formId.trim();
  }

  if (mrno && mrno.trim()) {
    conditions.push('s.MRNO = :b_mrno');
    binds.b_mrno = mrno.trim();
  }

  if (submittedBy && submittedBy.trim()) {
    conditions.push('UPPER(s.SUBMITTED_BY) LIKE :b_submitted_by');
    binds.b_submitted_by = `%${submittedBy.trim().toUpperCase()}%`;
  }

  if (status && status.trim() && status !== 'all') {
    conditions.push('UPPER(s.STATUS) = UPPER(:b_status)');
    binds.b_status = status.trim();
  }

  if (startDate && startDate.trim()) {
    conditions.push('s.SUBMITTED_AT >= TO_TIMESTAMP_TZ(:b_start_date, \'YYYY-MM-DD"T"HH24:MI:SS.FF3"Z"\')');
    try {
      binds.b_start_date = new Date(startDate).toISOString();
    } catch {
      delete binds.b_start_date;
      conditions.pop();
    }
  }

  if (endDate && endDate.trim()) {
    conditions.push('s.SUBMITTED_AT <= TO_TIMESTAMP_TZ(:b_end_date, \'YYYY-MM-DD"T"HH24:MI:SS.FF3"Z"\')');
    try {
      const d = new Date(endDate);
      d.setHours(23, 59, 59, 999);
      binds.b_end_date = d.toISOString();
    } catch {
      delete binds.b_end_date;
      conditions.pop();
    }
  }

  // Sorting
  let sortColumn = 's.SUBMITTED_AT';
  if (sortBy === 'updatedAt') sortColumn = 'NVL(s.UPDATED_AT, s.SUBMITTED_AT)';
  else if (sortBy === 'id') sortColumn = 's.ID';
  else if (sortBy === 'formSlug') sortColumn = 's.FORM_SLUG';
  else if (sortBy === 'mrno') sortColumn = 's.MRNO';
  else if (sortBy === 'status') sortColumn = 's.STATUS';

  const orderDir = String(sortOrder).toLowerCase() === 'asc' ? 'ASC' : 'DESC';

  const whereClause = conditions.join(' AND ');

  const sql = `
    SELECT
      s.ID,
      s.FORM_ID,
      s.FORM_SLUG,
      s.FORM_VERSION,
      s.PATIENT_ID,
      s.MRNO,
      s.ADMISSION_NUMBER,
      s.RECORD_ID,
      s.SUBMITTED_AT,
      s.UPDATED_AT,
      s.SUBMITTED_BY,
      s.STATUS,
      s.SUBMISSION_MODE,
      f.NAME AS FORM_TITLE,
      p.PATIENTNAME AS PATIENT_NAME,
      (SELECT COUNT(*) FROM FORMCRAFT_SUBMISSION_EDITS e WHERE e.SUBMISSION_ID = s.ID) AS EDIT_COUNT,
      COUNT(*) OVER() AS TOTAL_COUNT
    FROM FORMCRAFT_SUBMISSIONS s
    LEFT JOIN FORMCRAFT_FORMS f ON s.FORM_ID = f.ID OR s.FORM_SLUG = f.SLUG
    LEFT JOIN PATIENT p ON s.MRNO = p.MRNO
    WHERE ${whereClause}
    ORDER BY ${sortColumn} ${orderDir} NULLS LAST
    OFFSET :b_offset ROWS FETCH NEXT :b_limit ROWS ONLY
  `;

  const res = await executeQuery(sql, binds);
  const rows = res.rows || [];
  const total = rows.length > 0 ? Number(rows[0].TOTAL_COUNT || rows[0].total_count || 0) : 0;

  const submissions = rows.map((r) => ({
    id: r.ID,
    formId: r.FORM_ID,
    formSlug: r.FORM_SLUG,
    formTitle: r.FORM_TITLE || r.FORM_SLUG || 'Untitled Form',
    formVersion: Number(r.FORM_VERSION) || 1,
    patientId: r.PATIENT_ID,
    mrno: r.MRNO,
    patientName: r.PATIENT_NAME || null,
    admissionNumber: r.ADMISSION_NUMBER,
    recordId: r.RECORD_ID,
    submittedAt: toIso(r.SUBMITTED_AT),
    updatedAt: toIso(r.UPDATED_AT) || toIso(r.SUBMITTED_AT),
    submittedBy: r.SUBMITTED_BY || 'Clinician',
    status: r.STATUS || 'Submitted',
    submissionMode: r.SUBMISSION_MODE || 'NEW_RECORD',
    editCount: Number(r.EDIT_COUNT) || 0,
  }));

  return {
    submissions,
    pagination: {
      page: p,
      pageSize: size,
      total,
      totalPages: Math.ceil(total / size) || 1,
    },
  };
}

/**
 * Retrieves an individual submission and its exact historical version schema for viewing or editing.
 */
export async function getAdminSubmissionDetail(submissionId) {
  const numId = Number(submissionId);
  if (isNaN(numId)) {
    const err = new Error('Invalid submission ID.');
    err.status = 400;
    throw err;
  }

  const sql = `
    SELECT
      s.ID,
      s.FORM_ID,
      s.FORM_SLUG,
      s.FORM_VERSION,
      s.PATIENT_ID,
      s.MRNO,
      s.ADMISSION_NUMBER,
      s.RECORD_ID,
      s.SUBMITTED_AT,
      s.UPDATED_AT,
      s.SUBMITTED_BY,
      s.STATUS,
      s.SUBMISSION_MODE,
      s.FORM_DATA,
      f.NAME AS FORM_TITLE,
      (SELECT COUNT(*) FROM FORMCRAFT_SUBMISSION_EDITS e WHERE e.SUBMISSION_ID = s.ID) AS EDIT_COUNT
    FROM FORMCRAFT_SUBMISSIONS s
    LEFT JOIN FORMCRAFT_FORMS f ON s.FORM_ID = f.ID OR s.FORM_SLUG = f.SLUG
    WHERE s.ID = :b_id
  `;

  const res = await executeQuery(sql, { b_id: numId });
  if (!res.rows || res.rows.length === 0) {
    const err = new Error(`Submission #${submissionId} not found.`);
    err.status = 404;
    err.code = 'SUBMISSION_NOT_FOUND';
    throw err;
  }

  const row = res.rows[0];
  const formData = await parseClobJson(row.FORM_DATA);

  // 1. Resolve Patient Demographics if MRNO is present
  let patientInfo = null;
  if (row.MRNO) {
    try {
      patientInfo = await patientService.getPatientByMrno(row.MRNO);
    } catch {
      // Non-fatal if patient lookup fails
    }
  }

  // 2. Resolve Form Definition and the Exact Version Schema
  let schema = null;
  let formRecord = null;
  const formVer = Number(row.FORM_VERSION) || 1;

  try {
    if (row.FORM_ID) formRecord = await formRepository.getFormById(row.FORM_ID);
    if (!formRecord && row.FORM_SLUG) formRecord = await formRepository.getFormBySlug(row.FORM_SLUG);
  } catch {
    // ignore
  }

  // Attempt to retrieve exact version snapshot from FORMCRAFT_FORM_VERSIONS
  if (formRecord?.id) {
    try {
      schema = await formRepository.getVersionDefinition(formRecord.id, formVer);
    } catch {
      // ignore
    }
  }

  // Fallback to published or draft definition if specific version snapshot is not found
  if (!schema && formRecord) {
    schema = formRecord.publishedDefinition || formRecord.draft;
  }

  // Final fallback: synthesize basic definition from form_data keys if schema missing
  if (!schema) {
    schema = {
      version: '1.0.0',
      id: row.FORM_ID || `form_${row.ID}`,
      title: row.FORM_TITLE || row.FORM_SLUG || 'Submitted Clinical Form',
      settings: {
        submitButtonText: 'Submit',
        submitAction: 'download_json',
        showResetButton: false,
      },
      fields: Object.keys(formData).reduce((acc, key) => {
        acc[key] = {
          id: key,
          name: key,
          label: key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
          type: typeof formData[key] === 'number' ? 'number' : 'text',
        };
        return acc;
      }, {}),
      layout: [
        {
          id: 'sec_auto_1',
          title: 'Submitted Clinical Data',
          rows: [
            {
              id: 'row_auto_1',
              columns: [
                {
                  id: 'col_auto_1',
                  width: 12,
                  fieldIds: Object.keys(formData),
                },
              ],
            },
          ],
        },
      ],
    };
  }

  const submission = {
    id: row.ID,
    formId: row.FORM_ID,
    formSlug: row.FORM_SLUG,
    formTitle: row.FORM_TITLE || schema.title || row.FORM_SLUG,
    formVersion: formVer,
    patientId: row.PATIENT_ID,
    mrno: row.MRNO,
    admissionNumber: row.ADMISSION_NUMBER,
    recordId: row.RECORD_ID,
    submittedAt: toIso(row.SUBMITTED_AT),
    updatedAt: toIso(row.UPDATED_AT) || toIso(row.SUBMITTED_AT),
    submittedBy: row.SUBMITTED_BY || 'Clinician',
    status: row.STATUS || 'Submitted',
    submissionMode: row.SUBMISSION_MODE || 'NEW_RECORD',
    formData,
    editCount: Number(row.EDIT_COUNT) || 0,
    patient: patientInfo,
  };

  return {
    submission,
    schema,
  };
}

/**
 * Saves an authorized administrative edit with audit trail and concurrency protection.
 * 
 * @param {number|string} submissionId
 * @param {Object} payload
 * @param {Object} payload.formData - Updated field values
 * @param {string} payload.reason - Clinical justification for change (mandatory)
 * @param {string} [payload.originalUpdatedAt] - Concurrency timestamp check
 * @param {Object} adminUser - Authenticated admin from verified session
 * @param {string} clientIp - Requester IP address
 */
export async function editAdminSubmission(
  submissionId,
  { formData, reason, originalUpdatedAt },
  adminUser,
  clientIp = '127.0.0.1'
) {
  const numId = Number(submissionId);
  if (isNaN(numId)) {
    const err = new Error('Invalid submission ID.');
    err.status = 400;
    throw err;
  }

  if (!reason || typeof reason !== 'string' || reason.trim().length < 5) {
    const err = new Error('A valid reason (minimum 5 characters) is mandatory for clinical submission edits.');
    err.status = 400;
    err.code = 'REASON_REQUIRED';
    throw err;
  }

  if (!formData || typeof formData !== 'object') {
    const err = new Error('Field values payload (formData) must be a non-empty object.');
    err.status = 400;
    err.code = 'INVALID_FORM_DATA';
    throw err;
  }

  // Retrieve current submission state
  const currentSql = `
    SELECT
      ID, FORM_ID, FORM_SLUG, FORM_VERSION, RECORD_ID, MRNO,
      SUBMITTED_BY, SUBMITTED_AT, UPDATED_AT, STATUS, FORM_DATA
    FROM FORMCRAFT_SUBMISSIONS
    WHERE ID = :b_id
  `;
  const currentRes = await executeQuery(currentSql, { b_id: numId });
  if (!currentRes.rows || currentRes.rows.length === 0) {
    const err = new Error(`Submission #${submissionId} does not exist.`);
    err.status = 404;
    err.code = 'SUBMISSION_NOT_FOUND';
    throw err;
  }

  const current = currentRes.rows[0];
  const currentUpdatedAtIso = toIso(current.UPDATED_AT) || toIso(current.SUBMITTED_AT);

  // Concurrency Check (Optimistic Concurrency Control)
  if (originalUpdatedAt) {
    const clientTime = new Date(originalUpdatedAt).getTime();
    const serverTime = new Date(currentUpdatedAtIso).getTime();

    // Allow slight tolerance of 1000ms for timestamp formatting
    if (Math.abs(clientTime - serverTime) > 1000) {
      const err = new Error('This submission was modified by another administrator since you opened it. Please refresh to inspect the latest changes.');
      err.status = 409;
      err.code = 'CONCURRENT_MODIFICATION';
      err.currentUpdatedAt = currentUpdatedAtIso;
      throw err;
    }
  }

  const previousData = await parseClobJson(current.FORM_DATA);
  const diff = computeDataDiff(previousData, formData);
  const changedKeys = Object.keys(diff);

  if (changedKeys.length === 0) {
    const err = new Error('No field changes detected compared to the current submitted values.');
    err.status = 400;
    err.code = 'NO_CHANGES_DETECTED';
    throw err;
  }

  // Load form definition to check if Oracle database primaryEntity binding needs update
  let formRecord = null;
  try {
    if (current.FORM_ID) formRecord = await formRepository.getFormById(current.FORM_ID);
    if (!formRecord && current.FORM_SLUG) formRecord = await formRepository.getFormBySlug(current.FORM_SLUG);
  } catch {
    // non-fatal
  }

  const cleanReason = reason.trim();
  const changedFieldsSummary = changedKeys.join(', ');
  let editAuditId = null;

  // Execute database transaction
  await withTransaction(async (conn) => {
    // 1. Insert detailed audit record into FORMCRAFT_SUBMISSION_EDITS
    const insertEditSql = `
      INSERT INTO FORMCRAFT_SUBMISSION_EDITS (
        SUBMISSION_ID, ADMIN_ID, ADMIN_NAME, ADMIN_EMAIL, REASON,
        CHANGED_FIELDS, PREVIOUS_DATA, UPDATED_DATA, DIFF_JSON, IP_ADDRESS, CREATED_AT
      ) VALUES (
        :b_subId, :b_adminId, :b_adminName, :b_adminEmail, :b_reason,
        :b_fields, :b_prevData, :b_updData, :b_diff, :b_ip, SYSTIMESTAMP
      )
    `;

    await conn.execute(insertEditSql, {
      b_subId: numId,
      b_adminId: adminUser.admin_id || null,
      b_adminName: adminUser.name || 'Administrator',
      b_adminEmail: adminUser.email || null,
      b_reason: cleanReason,
      b_fields: changedFieldsSummary.slice(0, 4000),
      b_prevData: JSON.stringify(previousData),
      b_updData: JSON.stringify(formData),
      b_diff: JSON.stringify(diff),
      b_ip: clientIp || null,
    });

    // 2. Update FORMCRAFT_SUBMISSIONS preserving original submitter and submission date
    const updateSubSql = `
      UPDATE FORMCRAFT_SUBMISSIONS
      SET FORM_DATA = :b_formData,
          STATUS = 'Amended',
          UPDATED_AT = SYSTIMESTAMP
      WHERE ID = :b_id
    `;

    await conn.execute(updateSubSql, {
      b_formData: JSON.stringify(formData),
      b_id: numId,
    });

    // 3. Sync to bound Oracle clinical table if form definition has primaryEntity & primaryKeyColumn
    const formDef = formRecord?.publishedDefinition || formRecord?.draft;
    const primaryEntity = formDef?.settings?.primaryEntity?.trim().toUpperCase();
    const primaryKeyColumn = formDef?.settings?.primaryKeyColumn?.trim().toUpperCase();
    const recordId = current.RECORD_ID;

    if (primaryEntity && primaryKeyColumn && recordId) {
      try {
        await updateFormData(formDef, recordId, formData);
        console.log(`[AdminSubmissionService] Synchronized amendment for Submission #${numId} to clinical table ${primaryEntity} (PK: ${recordId})`);
      } catch (entityErr) {
        console.warn(`[AdminSubmissionService] Notice: Clinical table ${primaryEntity} sync failed:`, entityErr.message);
      }
    }
  });

  // 4. Log event to system activity logs
  await logActivity({
    eventType: 'SUBMISSION_EDITED',
    entityType: 'SUBMISSION',
    entityId: String(numId),
    actorType: 'admin',
    actorId: String(adminUser.admin_id),
    actorName: adminUser.name,
    description: `Submission #${numId} (${current.FORM_SLUG || 'form'}) amended by ${adminUser.name}: "${cleanReason}"`,
    details: {
      submissionId: numId,
      formSlug: current.FORM_SLUG,
      mrno: current.MRNO,
      reason: cleanReason,
      changedFieldsCount: changedKeys.length,
      changedFields: changedKeys,
    },
    ipAddress: clientIp,
    status: 'SUCCESS',
  });

  return {
    success: true,
    message: `Submission #${numId} successfully amended. Changes recorded in clinical audit trail.`,
    changedFields: changedKeys,
    diff,
  };
}

/**
 * Retrieves the complete audit history of administrative edits for a submission.
 */
export async function getSubmissionEditHistory(submissionId) {
  const numId = Number(submissionId);
  if (isNaN(numId)) {
    const err = new Error('Invalid submission ID.');
    err.status = 400;
    throw err;
  }

  const sql = `
    SELECT
      ID,
      SUBMISSION_ID,
      ADMIN_ID,
      ADMIN_NAME,
      ADMIN_EMAIL,
      REASON,
      CHANGED_FIELDS,
      PREVIOUS_DATA,
      UPDATED_DATA,
      DIFF_JSON,
      IP_ADDRESS,
      CREATED_AT
    FROM FORMCRAFT_SUBMISSION_EDITS
    WHERE SUBMISSION_ID = :b_id
    ORDER BY CREATED_AT DESC
  `;

  const res = await executeQuery(sql, { b_id: numId });
  const rows = res.rows || [];

  const history = await Promise.all(
    rows.map(async (r) => {
      const diff = await parseClobJson(r.DIFF_JSON);
      return {
        id: r.ID,
        submissionId: r.SUBMISSION_ID,
        adminId: r.ADMIN_ID,
        adminName: r.ADMIN_NAME || 'Administrator',
        adminEmail: r.ADMIN_EMAIL,
        reason: r.REASON,
        changedFields: (r.CHANGED_FIELDS || '').split(',').map((s) => s.trim()).filter(Boolean),
        diff,
        ipAddress: r.IP_ADDRESS,
        createdAt: toIso(r.CREATED_AT),
      };
    })
  );

  return history;
}
