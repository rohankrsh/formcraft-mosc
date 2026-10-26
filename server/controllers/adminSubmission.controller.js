import {
  listAdminSubmissions,
  getAdminSubmissionDetail,
  editAdminSubmission,
  getSubmissionEditHistory,
} from '../services/adminSubmissionService.js';

/**
 * Lists all form submissions system-wide with search, filter, pagination, and sorting.
 * 
 * GET /api/admin/submissions
 */
export async function listSubmissions(req, res) {
  try {
    const {
      page,
      pageSize,
      search,
      formSlug,
      formId,
      mrno,
      submittedBy,
      status,
      startDate,
      endDate,
      sortBy,
      sortOrder,
    } = req.query;

    const result = await listAdminSubmissions({
      page,
      pageSize,
      search,
      formSlug,
      formId,
      mrno,
      submittedBy,
      status,
      startDate,
      endDate,
      sortBy,
      sortOrder,
    });

    return res.json({
      success: true,
      data: result.submissions,
      pagination: result.pagination,
    });
  } catch (err) {
    console.error('[AdminSubmissionController] listSubmissions error:', err.message);
    return res.status(err.status || 500).json({
      success: false,
      error: err.message || 'Failed to retrieve submissions.',
    });
  }
}

/**
 * Retrieves a single submission with its exact historical schema version for viewing or editing.
 * 
 * GET /api/admin/submissions/:submissionId
 */
export async function getSubmission(req, res) {
  const { submissionId } = req.params;
  try {
    const result = await getAdminSubmissionDetail(submissionId);
    return res.json({
      success: true,
      submission: result.submission,
      schema: result.schema,
    });
  } catch (err) {
    console.error(`[AdminSubmissionController] getSubmission(${submissionId}) error:`, err.message);
    return res.status(err.status || 500).json({
      success: false,
      error: err.message || 'Failed to retrieve submission details.',
      code: err.code || 'SUBMISSION_ERROR',
    });
  }
}

/**
 * Saves an administrative amendment to a clinical submission.
 * Enforces audit justification and concurrency control.
 * 
 * PUT /api/admin/submissions/:submissionId
 */
export async function updateSubmission(req, res) {
  const { submissionId } = req.params;
  const clientIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || '127.0.0.1';

  try {
    const { formData, reason, originalUpdatedAt } = req.body || {};

    const result = await editAdminSubmission(
      submissionId,
      { formData, reason, originalUpdatedAt },
      req.admin,
      clientIp
    );

    return res.json({
      success: true,
      message: result.message,
      changedFields: result.changedFields,
      diff: result.diff,
    });
  } catch (err) {
    console.error(`[AdminSubmissionController] updateSubmission(${submissionId}) error:`, err.message);
    const status = err.status || 500;
    return res.status(status).json({
      success: false,
      error: err.message || 'Failed to update submission.',
      code: err.code || 'UPDATE_FAILED',
      currentUpdatedAt: err.currentUpdatedAt || undefined,
    });
  }
}

/**
 * Retrieves the full administrative audit trail of edits for a submission.
 * 
 * GET /api/admin/submissions/:submissionId/history
 */
export async function getSubmissionHistory(req, res) {
  const { submissionId } = req.params;
  try {
    const history = await getSubmissionEditHistory(submissionId);
    return res.json({
      success: true,
      history,
    });
  } catch (err) {
    console.error(`[AdminSubmissionController] getSubmissionHistory(${submissionId}) error:`, err.message);
    return res.status(err.status || 500).json({
      success: false,
      error: err.message || 'Failed to retrieve submission history.',
    });
  }
}
