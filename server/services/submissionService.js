import fs from 'fs';
import path from 'path';
import { executeQuery, withTransaction, oracledb, getOracleHealth } from '../database/oracle.js';
import { getPublishedFormBySlug } from './runtimeService.js';
import { validateFormData, insertFormData, updateFormData } from './formDataService.js';
import * as patientService from './patientService.js';

const SUBMISSIONS_DIR = path.resolve('server/data/submissions');
if (!fs.existsSync(SUBMISSIONS_DIR)) {
  fs.mkdirSync(SUBMISSIONS_DIR, { recursive: true });
}

/**
 * Normalizes Date or timestamp objects into clean ISO strings.
 */
function toIsoString(val) {
  if (!val) return null;
  if (val instanceof Date) return val.toISOString();
  if (typeof val === 'string') return val;
  return String(val);
}

/**
 * Safely extracts string from node-oracledb Lob object or string, then parses JSON.
 */
async function parseFormDataFromRow(rawFormData) {
  if (!rawFormData) return {};
  let str = '';
  if (typeof rawFormData === 'string') {
    str = rawFormData;
  } else if (rawFormData && typeof rawFormData.getData === 'function') {
    str = await rawFormData.getData();
  } else if (rawFormData) {
    str = String(rawFormData);
  }
  try {
    return JSON.parse(str);
  } catch {
    return {};
  }
}

/**
 * File-system fallback for submissions when Oracle database is offline.
 */
async function getFileSubmissions(slug, mrno) {
  try {
    const filePath = path.join(SUBMISSIONS_DIR, `${slug}_${mrno}.json`);
    if (fs.existsSync(filePath)) {
      const raw = await fs.promises.readFile(filePath, 'utf-8');
      return JSON.parse(raw);
    }
  } catch (err) {
    console.warn('[SubmissionService] Notice reading fallback submissions file:', err.message);
  }
  return [];
}

async function saveFileSubmission(slug, mrno, record) {
  try {
    const filePath = path.join(SUBMISSIONS_DIR, `${slug}_${mrno}.json`);
    let records = await getFileSubmissions(slug, mrno);
    const existingIndex = records.findIndex((r) => String(r.id) === String(record.id));
    if (existingIndex >= 0) {
      records[existingIndex] = { ...records[existingIndex], ...record, updatedAt: new Date().toISOString() };
    } else {
      records.unshift(record);
    }
    await fs.promises.writeFile(filePath, JSON.stringify(records, null, 2), 'utf-8');
  } catch (err) {
    console.warn('[SubmissionService] Notice writing fallback submission file:', err.message);
  }
}

/**
 * Resolves patient information (MRNO, PATIENT_ID, ADMISSION_NUMBER) from MRNO parameter.
 */
async function resolvePatientContext(mrno, inputPatientId, inputAdmissionNumber) {
  let resolvedMrno = mrno ? String(mrno).trim() : '';
  let resolvedPatientId = inputPatientId ? String(inputPatientId).trim() : '';
  let resolvedAdmissionNumber = inputAdmissionNumber ? String(inputAdmissionNumber).trim() : '';

  if (resolvedMrno && (!resolvedPatientId || !resolvedAdmissionNumber)) {
    try {
      const p = await patientService.getPatientByMrno(resolvedMrno);
      if (p) {
        if (!resolvedPatientId && (p.patient_id || p.patientId)) {
          resolvedPatientId = String(p.patient_id || p.patientId);
        }
        if (!resolvedAdmissionNumber && (p.admission_number || p.admissionNumber)) {
          resolvedAdmissionNumber = String(p.admission_number || p.admissionNumber);
        }
      }
    } catch (pErr) {
      // Patient might not be in inpatients view; non-fatal
      console.warn('[SubmissionService] Patient resolution notice for MRNO:', resolvedMrno, pErr.message);
    }
  }

  return {
    mrno: resolvedMrno,
    patientId: resolvedPatientId,
    admissionNumber: resolvedAdmissionNumber,
  };
}

/**
 * Feature D & A: Retrieves patient form state according to form mode.
 * - NEW_RECORD: returns mode and previous submission history.
 * - CONTINUE_EXISTING: returns existing record data if present, or blank state.
 */
export async function getPatientFormState(slug, { mrno, patientId, admissionNumber } = {}) {
  const published = await getPublishedFormBySlug(slug);
  const form = published.definition;
  const mode = form.settings?.patientFormMode || 'NEW_RECORD';

  const patient = await resolvePatientContext(mrno, patientId, admissionNumber);
  const normalizedMrno = patient.mrno;
  const normalizedPatientId = patient.patientId;

  if (!normalizedMrno && !normalizedPatientId) {
    return {
      success: true,
      mode,
      hasExistingRecord: false,
      data: null,
      history: [],
    };
  }

  const health = await getOracleHealth();
  const dbAvailable = health.connected;

  if (mode === 'CONTINUE_EXISTING') {
    if (dbAvailable) {
      try {
        const sql = `
          SELECT ID, FORM_ID, FORM_SLUG, FORM_VERSION, PATIENT_ID, MRNO, ADMISSION_NUMBER,
                 RECORD_ID, SUBMITTED_AT, UPDATED_AT, STATUS, SUBMISSION_MODE, FORM_DATA
          FROM FORMCRAFT_SUBMISSIONS
          WHERE (UPPER(FORM_SLUG) = UPPER(:b_slug) OR UPPER(FORM_ID) = UPPER(:b_formId))
            AND (
              (:b_mrno IS NOT NULL AND MRNO = :b_mrno)
              OR (:b_patId IS NOT NULL AND PATIENT_ID = :b_patId)
            )
          ORDER BY NVL(UPDATED_AT, SUBMITTED_AT) DESC
          FETCH FIRST 1 ROWS ONLY
        `;

        const binds = {
          b_slug: slug,
          b_formId: form.id || slug,
          b_mrno: normalizedMrno || null,
          b_patId: normalizedPatientId || null,
        };

        const res = await executeQuery(sql, binds);
        if (res.rows && res.rows.length > 0) {
          const row = res.rows[0];
          const parsedData = await parseFormDataFromRow(row.FORM_DATA);


          return {
            success: true,
            mode: 'CONTINUE_EXISTING',
            hasExistingRecord: true,
            recordId: row.RECORD_ID || row.ID,
            submissionId: row.ID,
            submittedAt: toIsoString(row.SUBMITTED_AT),
            updatedAt: toIsoString(row.UPDATED_AT),
            status: row.STATUS || 'Submitted',
            data: parsedData,
          };
        }
      } catch (err) {
        console.warn('[SubmissionService] Notice querying CONTINUE_EXISTING from Oracle:', err.message);
      }
    }

    // Fallback file storage check
    const fileRecords = await getFileSubmissions(slug, normalizedMrno);
    if (fileRecords.length > 0) {
      const latest = fileRecords[0];
      return {
        success: true,
        mode: 'CONTINUE_EXISTING',
        hasExistingRecord: true,
        recordId: latest.recordId || latest.id,
        submissionId: latest.id,
        submittedAt: latest.submittedAt,
        updatedAt: latest.updatedAt,
        status: latest.status || 'Submitted',
        data: latest.formData || latest.data || {},
      };
    }

    return {
      success: true,
      mode: 'CONTINUE_EXISTING',
      hasExistingRecord: false,
      data: null,
    };
  }

  // mode === 'NEW_RECORD'
  const history = await getSubmissionHistory(slug, {
    mrno: normalizedMrno,
    patientId: normalizedPatientId,
  });

  return {
    success: true,
    mode: 'NEW_RECORD',
    hasExistingRecord: false,
    history,
  };
}

/**
 * Feature C: Retrieves previous submissions for current form and patient.
 */
export async function getSubmissionHistory(slug, { mrno, patientId } = {}) {
  const published = await getPublishedFormBySlug(slug);
  const form = published.definition;

  const normalizedMrno = mrno ? String(mrno).trim() : '';
  const normalizedPatientId = patientId ? String(patientId).trim() : '';

  if (!normalizedMrno && !normalizedPatientId) {
    return [];
  }

  const health = await getOracleHealth();
  if (health.connected) {
    try {
      const sql = `
        SELECT ID, RECORD_ID, FORM_ID, FORM_SLUG, FORM_VERSION, PATIENT_ID, MRNO,
               ADMISSION_NUMBER, SUBMITTED_AT, UPDATED_AT, SUBMITTED_BY, STATUS, SUBMISSION_MODE
        FROM FORMCRAFT_SUBMISSIONS
        WHERE (UPPER(FORM_SLUG) = UPPER(:b_slug) OR UPPER(FORM_ID) = UPPER(:b_formId))
          AND (
            (:b_mrno IS NOT NULL AND MRNO = :b_mrno)
            OR (:b_patId IS NOT NULL AND PATIENT_ID = :b_patId)
          )
        ORDER BY SUBMITTED_AT DESC
      `;

      const binds = {
        b_slug: slug,
        b_formId: form.id || slug,
        b_mrno: normalizedMrno || null,
        b_patId: normalizedPatientId || null,
      };

      const res = await executeQuery(sql, binds);
      if (res.rows) {
        return res.rows.map((r) => ({
          id: r.ID,
          recordId: r.RECORD_ID || r.ID,
          formId: r.FORM_ID,
          formSlug: r.FORM_SLUG,
          formVersion: r.FORM_VERSION,
          patientId: r.PATIENT_ID,
          mrno: r.MRNO,
          admissionNumber: r.ADMISSION_NUMBER,
          submittedAt: toIsoString(r.SUBMITTED_AT),
          updatedAt: toIsoString(r.UPDATED_AT),
          submittedBy: r.SUBMITTED_BY || 'Clinician',
          status: r.STATUS || 'Submitted',
          submissionMode: r.SUBMISSION_MODE || 'NEW_RECORD',
        }));
      }
    } catch (err) {
      console.warn('[SubmissionService] Notice querying history from Oracle:', err.message);
    }
  }

  // Fallback file storage
  const fileRecords = await getFileSubmissions(slug, normalizedMrno);
  return fileRecords.map((r) => ({
    id: r.id,
    recordId: r.recordId || r.id,
    formId: r.formId || form.id,
    formSlug: r.formSlug || slug,
    formVersion: r.formVersion || 1,
    patientId: r.patientId,
    mrno: r.mrno,
    admissionNumber: r.admissionNumber,
    submittedAt: r.submittedAt,
    updatedAt: r.updatedAt,
    submittedBy: r.submittedBy || 'Clinician',
    status: r.status || 'Submitted',
    submissionMode: r.submissionMode || 'NEW_RECORD',
  }));
}

/**
 * Feature C & 9.D: Retrieves one historical submission by ID for read-only viewing.
 * Strictly verifies patient and form ownership to prevent unauthorized access.
 */
export async function getHistoricalSubmission(slug, submissionId, { mrno, patientId } = {}) {
  const published = await getPublishedFormBySlug(slug);
  const form = published.definition;

  const normalizedMrno = mrno ? String(mrno).trim() : '';
  const normalizedPatientId = patientId ? String(patientId).trim() : '';

  const health = await getOracleHealth();
  if (health.connected) {
    try {
      const sql = `
        SELECT ID, RECORD_ID, FORM_ID, FORM_SLUG, FORM_VERSION, PATIENT_ID, MRNO,
               ADMISSION_NUMBER, SUBMITTED_AT, UPDATED_AT, SUBMITTED_BY, STATUS, SUBMISSION_MODE, FORM_DATA
        FROM FORMCRAFT_SUBMISSIONS
        WHERE ID = :b_id
          AND (UPPER(FORM_SLUG) = UPPER(:b_slug) OR UPPER(FORM_ID) = UPPER(:b_formId))
      `;

      const binds = {
        b_id: Number(submissionId),
        b_slug: slug,
        b_formId: form.id || slug,
      };

      const res = await executeQuery(sql, binds);
      if (res.rows && res.rows.length > 0) {
        const row = res.rows[0];

        // Patient authorization check
        if (normalizedMrno && row.MRNO && String(row.MRNO) !== normalizedMrno) {
          const err = new Error('Unauthorized access: submission belongs to a different patient.');
          err.status = 403;
          throw err;
        }

        const parsedData = await parseFormDataFromRow(row.FORM_DATA);


        return {
          id: row.ID,
          recordId: row.RECORD_ID || row.ID,
          formId: row.FORM_ID,
          formSlug: row.FORM_SLUG,
          formVersion: row.FORM_VERSION,
          patientId: row.PATIENT_ID,
          mrno: row.MRNO,
          admissionNumber: row.ADMISSION_NUMBER,
          submittedAt: toIsoString(row.SUBMITTED_AT),
          updatedAt: toIsoString(row.UPDATED_AT),
          submittedBy: row.SUBMITTED_BY || 'Clinician',
          status: row.STATUS || 'Submitted',
          submissionMode: row.SUBMISSION_MODE || 'NEW_RECORD',
          formData: parsedData,
        };
      }
    } catch (err) {
      if (err.status === 403) throw err;
      console.warn('[SubmissionService] Notice querying historical submission from Oracle:', err.message);
    }
  }

  // Fallback to file storage
  const fileRecords = await getFileSubmissions(slug, normalizedMrno);
  const found = fileRecords.find((r) => String(r.id) === String(submissionId));
  if (!found) {
    const err = new Error(`Submission #${submissionId} not found.`);
    err.status = 404;
    throw err;
  }

  return {
    id: found.id,
    recordId: found.recordId || found.id,
    formId: found.formId || form.id,
    formSlug: found.formSlug || slug,
    formVersion: found.formVersion || 1,
    patientId: found.patientId,
    mrno: found.mrno,
    admissionNumber: found.admissionNumber,
    submittedAt: found.submittedAt,
    updatedAt: found.updatedAt,
    submittedBy: found.submittedBy || 'Clinician',
    status: found.status || 'Submitted',
    submissionMode: found.submissionMode || 'NEW_RECORD',
    formData: found.formData || found.data || {},
  };
}

/**
 * Feature E: Persists form submission into Oracle Database inside an atomic transaction.
 * - Mode 1 (NEW_RECORD): Inserts a new record every time.
 * - Mode 2 (CONTINUE_EXISTING): Updates existing record if present; inserts if first time.
 */
export async function saveFormSubmission(slug, {
  data,
  mrno,
  patientId,
  admissionNumber,
  submittedBy = 'Clinician',
  isUpdate = false,
  recordId = null,
  submissionId = null,
}) {
  const published = await getPublishedFormBySlug(slug);
  const form = published.definition;

  // 1. Server-side validation
  const validationErrors = validateFormData(form, data);
  if (Object.keys(validationErrors).length > 0) {
    const err = new Error('Validation failed');
    err.status = 400;
    err.validationErrors = validationErrors;
    throw err;
  }

  const mode = form.settings?.patientFormMode || 'NEW_RECORD';
  const patient = await resolvePatientContext(mrno, patientId, admissionNumber);
  const finalMrno = patient.mrno;
  const finalPatientId = patient.patientId;
  const finalAdmissionNumber = patient.admissionNumber;

  const nowIso = new Date().toISOString();
  let targetRecordId = recordId;
  let targetSubmissionId = submissionId;

  // 2. Check if primaryEntity is configured for clinical table mapping
  const primaryEntity = form.settings?.primaryEntity?.trim().toUpperCase();
  const primaryKeyColumn = form.settings?.primaryKeyColumn?.trim().toUpperCase();
  let entityOpPerformed = false;

  if (primaryEntity && primaryKeyColumn) {
    try {
      if (mode === 'CONTINUE_EXISTING' && (isUpdate || targetRecordId)) {
        const updateRes = await updateFormData(form, targetRecordId, data);
        targetRecordId = updateRes.primaryKey || targetRecordId;
        entityOpPerformed = true;
      } else {
        const insertRes = await insertFormData(form, data);
        targetRecordId = insertRes.primaryKey || targetRecordId;
        entityOpPerformed = true;
      }
    } catch (entityErr) {
      // If error is validation failure, rethrow immediately
      if (entityErr.status === 400) throw entityErr;
      console.warn(`[SubmissionService] Clinical entity ${primaryEntity} operation notice:`, entityErr.message);
    }
  }

  // 3. Oracle Transaction persistence in FORMCRAFT_SUBMISSIONS
  const health = await getOracleHealth();
  let oracleSaved = false;

  if (health.connected) {
    try {
      await withTransaction(async (conn) => {
        // Mode 2 Update check
        if (mode === 'CONTINUE_EXISTING' && (targetSubmissionId || isUpdate)) {
          let resolvedSubId = targetSubmissionId;
          if (!resolvedSubId && finalMrno) {
            const checkSql = `
              SELECT ID FROM FORMCRAFT_SUBMISSIONS
              WHERE (UPPER(FORM_SLUG) = UPPER(:b_slug) OR UPPER(FORM_ID) = UPPER(:b_formId))
                AND (MRNO = :b_mrno OR (:b_patId IS NOT NULL AND PATIENT_ID = :b_patId))
              ORDER BY NVL(UPDATED_AT, SUBMITTED_AT) DESC
              FETCH FIRST 1 ROWS ONLY
            `;
            const checkRes = await conn.execute(checkSql, {
              b_slug: slug,
              b_formId: form.id || slug,
              b_mrno: finalMrno,
              b_patId: finalPatientId || null,
            });
            if (checkRes.rows && checkRes.rows.length > 0) {
              resolvedSubId = checkRes.rows[0].ID;
            }
          }

          if (resolvedSubId) {
            const updateSql = `
              UPDATE FORMCRAFT_SUBMISSIONS
              SET FORM_DATA = :b_formData,
                  UPDATED_AT = SYSTIMESTAMP,
                  STATUS = 'Updated',
                  SUBMITTED_BY = NVL(:b_user, SUBMITTED_BY),
                  RECORD_ID = NVL(:b_recId, RECORD_ID)
              WHERE ID = :b_id
            `;
            await conn.execute(updateSql, {
              b_formData: JSON.stringify(data),
              b_user: submittedBy || null,
              b_recId: targetRecordId != null ? String(targetRecordId) : null,
              b_id: resolvedSubId,
            });

            targetSubmissionId = resolvedSubId;
            oracleSaved = true;
            return;
          }
        }

        // Mode 1 INSERT or first INSERT for Mode 2
        const insertSql = `
          INSERT INTO FORMCRAFT_SUBMISSIONS (
            FORM_ID, FORM_SLUG, FORM_VERSION, PATIENT_ID, MRNO, ADMISSION_NUMBER,
            RECORD_ID, SUBMITTED_AT, UPDATED_AT, SUBMITTED_BY, STATUS, SUBMISSION_MODE, FORM_DATA
          ) VALUES (
            :b_formId, :b_slug, :b_version, :b_patId, :b_mrno, :b_admNo,
            :b_recId, SYSTIMESTAMP, SYSTIMESTAMP, :b_user, 'Submitted', :b_mode, :b_formData
          ) RETURNING ID INTO :out_id
        `;

        const res = await conn.execute(insertSql, {
          b_formId: form.id || slug,
          b_slug: slug,
          b_version: published.version || 1,
          b_patId: finalPatientId || null,
          b_mrno: finalMrno || null,
          b_admNo: finalAdmissionNumber || null,
          b_recId: targetRecordId != null ? String(targetRecordId) : null,
          b_user: submittedBy || null,
          b_mode: mode,
          b_formData: JSON.stringify(data),
          out_id: { type: oracledb.NUMBER, dir: oracledb.BIND_OUT },
        });

        if (res.outBinds && res.outBinds.out_id && res.outBinds.out_id.length > 0) {
          targetSubmissionId = res.outBinds.out_id[0];
        }
        oracleSaved = true;
      });
    } catch (txErr) {
      console.error('[SubmissionService] Transaction error persisting to FORMCRAFT_SUBMISSIONS:', txErr.message);
      // If no clinical entity operation was performed and Oracle transaction failed, throw error
      if (!entityOpPerformed) {
        throw new Error('Unable to persist form submission to Oracle Database: ' + txErr.message);
      }
    }
  }

  // Generate fallback IDs if Oracle was in degraded mode
  if (!targetSubmissionId) {
    targetSubmissionId = Date.now();
  }
  if (!targetRecordId) {
    targetRecordId = targetSubmissionId;
  }

  // Backup / local cache
  const auditRecord = {
    id: targetSubmissionId,
    recordId: targetRecordId,
    formId: form.id || slug,
    formSlug: slug,
    formVersion: published.version || 1,
    patientId: finalPatientId,
    mrno: finalMrno,
    admissionNumber: finalAdmissionNumber,
    submittedAt: nowIso,
    updatedAt: isUpdate ? nowIso : undefined,
    submittedBy,
    status: isUpdate ? 'Updated' : 'Submitted',
    submissionMode: mode,
    formData: data,
  };
  await saveFileSubmission(slug, finalMrno || 'general', auditRecord);

  return {
    success: true,
    action: isUpdate ? 'updated' : 'inserted',
    recordId: targetRecordId,
    submissionId: targetSubmissionId,
    submittedAt: nowIso,
    updatedAt: isUpdate ? nowIso : undefined,
    status: isUpdate ? 'Updated' : 'Submitted',
    mode,
  };
}
