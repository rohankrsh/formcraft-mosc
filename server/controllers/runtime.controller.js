import * as runtimeService from '../services/runtimeService.js';
import * as submissionService from '../services/submissionService.js';

export async function getPublishedForm(req, res) {
  const { slug } = req.params;
  try {
    const form = await runtimeService.getPublishedFormBySlug(slug);
    return res.json({ success: true, form });
  } catch (err) {
    console.error(`[RuntimeController] getPublishedForm("${slug}") error:`, err.message);
    const status = err.status || 500;
    return res.status(status).json({
      success: false,
      code: err.code || 'RUNTIME_ERROR',
      error: err.message || 'Unable to retrieve form.',
    });
  }
}

export async function getRuntimeOptions(req, res) {
  const { slug } = req.params;
  try {
    const options = await runtimeService.getRuntimeOptions(slug);
    return res.json({ success: true, data: options });
  } catch (err) {
    console.error(`[RuntimeController] getRuntimeOptions("${slug}") error:`, err.message);
    const status = err.status || 500;
    return res.status(status).json({
      success: false,
      code: err.code || 'RUNTIME_OPTIONS_ERROR',
      error: status === 404 || status === 403 || status === 410
        ? err.message
        : 'Unable to load dropdown options from database.',
    });
  }
}

export async function getRuntimeRecord(req, res) {
  const { slug, recordId } = req.params;
  try {
    const data = await runtimeService.getRuntimeRecord(slug, recordId);
    return res.json({ success: true, data });
  } catch (err) {
    console.error(`[RuntimeController] getRuntimeRecord("${slug}", "${recordId}") error:`, err.message);
    const status = err.status || 500;
    return res.status(status).json({
      success: false,
      code: err.code || 'RUNTIME_RECORD_ERROR',
      error: status === 404 || status === 400 || status === 403 || status === 410
        ? err.message
        : 'Unable to retrieve form record from database.',
    });
  }
}

/**
 * Feature D & A: Retrieves patient form state according to mode (NEW_RECORD or CONTINUE_EXISTING).
 * GET /api/runtime/forms/:slug/patient-state?mrno=:mrno
 */
export async function getPatientFormState(req, res) {
  const { slug } = req.params;
  const { mrno, patientId, admissionNumber } = req.query;

  try {
    const result = await submissionService.getPatientFormState(slug, {
      mrno,
      patientId,
      admissionNumber,
    });
    return res.json(result);
  } catch (err) {
    console.error(`[RuntimeController] getPatientFormState("${slug}") error:`, err.message);
    const status = err.status || 500;
    return res.status(status).json({
      success: false,
      code: err.code || 'PATIENT_STATE_ERROR',
      error: status === 404 || status === 400 || status === 403 || status === 410
        ? err.message
        : 'Unable to resolve patient form state.',
    });
  }
}

/**
 * Feature C: Retrieves previous submissions for current form and patient.
 * GET /api/runtime/forms/:slug/submissions?mrno=:mrno
 */
export async function getSubmissionHistory(req, res) {
  const { slug } = req.params;
  const { mrno, patientId } = req.query;

  try {
    const submissions = await submissionService.getSubmissionHistory(slug, {
      mrno,
      patientId,
    });
    return res.json({ success: true, submissions });
  } catch (err) {
    console.error(`[RuntimeController] getSubmissionHistory("${slug}") error:`, err.message);
    const status = err.status || 500;
    return res.status(status).json({
      success: false,
      code: err.code || 'SUBMISSION_HISTORY_ERROR',
      error: status === 404 || status === 400 || status === 403 || status === 410
        ? err.message
        : 'Unable to retrieve submission history.',
    });
  }
}

/**
 * Feature C & 9.D: Retrieves one historical submission for read-only viewing.
 * GET /api/runtime/forms/:slug/submissions/:submissionId?mrno=:mrno
 */
export async function getHistoricalSubmission(req, res) {
  const { slug, submissionId, id } = req.params;
  const targetId = submissionId || id;
  const { mrno, patientId } = req.query;

  try {
    const submission = await submissionService.getHistoricalSubmission(slug, targetId, {
      mrno,
      patientId,
    });
    return res.json({ success: true, submission });
  } catch (err) {
    console.error(`[RuntimeController] getHistoricalSubmission("${slug}", "${targetId}") error:`, err.message);
    const status = err.status || 500;
    return res.status(status).json({
      success: false,
      code: err.code || 'HISTORICAL_SUBMISSION_ERROR',
      error: status === 404 || status === 400 || status === 403 || status === 410
        ? err.message
        : 'Unable to retrieve historical submission.',
    });
  }
}

/**
 * Feature E: Mode-aware form submission to Oracle Database.
 * POST /api/runtime/forms/:slug/submit
 */
export async function submitForm(req, res) {
  const { slug } = req.params;
  const payload = req.body || {};
  const formData = payload.data !== undefined ? payload.data : payload;

  const mrno = payload.mrno || req.query.mrno;
  const patientId = payload.patientId || req.query.patientId;
  const admissionNumber = payload.admissionNumber || req.query.admissionNumber;
  const submittedBy = payload.submittedBy || 'Clinician';
  const isUpdate = Boolean(payload.isUpdate);
  const recordId = payload.recordId || null;
  const submissionId = payload.submissionId || null;

  try {
    const result = await submissionService.saveFormSubmission(slug, {
      data: formData,
      mrno,
      patientId,
      admissionNumber,
      submittedBy,
      isUpdate,
      recordId,
      submissionId,
    });
    return res.status(result.action === 'inserted' ? 201 : 200).json({
      success: true,
      ...result,
      data: result,
    });
  } catch (err) {
    console.error(`[RuntimeController] submitForm("${slug}") error:`, err.message);
    if (err.status === 400 && err.validationErrors) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_FAILED',
        error: 'Validation failed',
        validationErrors: err.validationErrors,
      });
    }
    const status = err.status || 500;
    return res.status(status).json({
      success: false,
      code: err.code || 'RUNTIME_SUBMIT_ERROR',
      error: status === 400 || status === 403 || status === 404 || status === 410
        ? err.message
        : 'Unable to save form data to database.',
    });
  }
}

export async function insertRuntimeData(req, res) {
  const { slug } = req.params;
  const submittedData = req.body?.data || req.body;
  const mrno = req.body?.mrno || req.query.mrno;

  try {
    // If mrno is present, route through mode-aware submissionService
    if (mrno) {
      const result = await submissionService.saveFormSubmission(slug, {
        data: submittedData,
        mrno,
        patientId: req.body?.patientId || req.query.patientId,
        admissionNumber: req.body?.admissionNumber || req.query.admissionNumber,
        submittedBy: req.body?.submittedBy || 'Clinician',
        isUpdate: false,
      });
      return res.status(201).json({ success: true, data: result });
    }

    const result = await runtimeService.insertRuntimeData(slug, submittedData);
    return res.status(201).json({ success: true, data: result });
  } catch (err) {
    console.error(`[RuntimeController] insertRuntimeData("${slug}") error:`, err.message);
    if (err.status === 400 && err.validationErrors) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_FAILED',
        error: 'Validation failed',
        validationErrors: err.validationErrors,
      });
    }
    const status = err.status || 500;
    return res.status(status).json({
      success: false,
      code: err.code || 'RUNTIME_INSERT_ERROR',
      error: status === 400 || status === 403 || status === 404 || status === 410
        ? err.message
        : 'Unable to save form data to database.',
    });
  }
}

export async function updateRuntimeData(req, res) {
  const { slug, recordId } = req.params;
  const submittedData = req.body?.data || req.body;
  const mrno = req.body?.mrno || req.query.mrno;

  try {
    if (mrno) {
      const result = await submissionService.saveFormSubmission(slug, {
        data: submittedData,
        mrno,
        patientId: req.body?.patientId || req.query.patientId,
        admissionNumber: req.body?.admissionNumber || req.query.admissionNumber,
        submittedBy: req.body?.submittedBy || 'Clinician',
        isUpdate: true,
        recordId,
        submissionId: req.body?.submissionId,
      });
      return res.json({ success: true, data: result });
    }

    const result = await runtimeService.updateRuntimeData(slug, recordId, submittedData);
    return res.json({ success: true, data: result });
  } catch (err) {
    console.error(`[RuntimeController] updateRuntimeData("${slug}", "${recordId}") error:`, err.message);
    if (err.status === 400 && err.validationErrors) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_FAILED',
        error: 'Validation failed',
        validationErrors: err.validationErrors,
      });
    }
    const status = err.status || 500;
    return res.status(status).json({
      success: false,
      code: err.code || 'RUNTIME_UPDATE_ERROR',
      error: status === 400 || status === 403 || status === 404 || status === 410
        ? err.message
        : 'Unable to update form data in database.',
    });
  }
}

export async function executeRuntimeQuery(req, res) {
  const { slug, queryId } = req.params;
  const parameters = req.body?.parameters || req.body || {};
  try {
    const published = await runtimeService.getPublishedFormBySlug(slug);
    const { executeFormQuery: runQuery } = await import('../services/queryExecutionService.js');
    const result = await runQuery(published.definition, queryId, parameters);
    return res.json(result);
  } catch (err) {
    console.error(`[RuntimeController] executeRuntimeQuery("${slug}", "${queryId}") error:`, err.message);
    const status = err.status || 500;
    return res.status(status).json({
      success: false,
      code: err.code || 'RUNTIME_QUERY_ERROR',
      error: status === 400 || status === 403 || status === 404 || status === 410
        ? err.message
        : 'Unable to execute database query.',
    });
  }
}
