import * as formDataService from '../services/formDataService.js';

export async function getOptions(req, res) {
  const { formId } = req.params;
  try {
    const options = await formDataService.getFormOptions(formId);
    return res.json({ success: true, data: options });
  } catch (err) {
    console.error(`[FormDataController] getOptions("${formId}") error:`, err);
    return res.status(err.status || 500).json({
      success: false,
      error: err.status === 404 ? err.message : 'Unable to load dropdown options from database.',
    });
  }
}

export async function getRecord(req, res) {
  const { formId, recordId } = req.params;
  try {
    const data = await formDataService.getRecordData(formId, recordId);
    return res.json({ success: true, data });
  } catch (err) {
    console.error(`[FormDataController] getRecord("${formId}", "${recordId}") error:`, err);
    return res.status(err.status || 500).json({
      success: false,
      error: err.status === 404 || err.status === 400 || err.status === 403
        ? err.message
        : 'Unable to retrieve form record from database.',
    });
  }
}

export async function insertData(req, res) {
  const { formId } = req.params;
  const submittedData = req.body?.data || req.body;

  try {
    const result = await formDataService.insertFormData(formId, submittedData);
    return res.status(201).json({ success: true, data: result });
  } catch (err) {
    console.error(`[FormDataController] insertData("${formId}") error:`, err);
    if (err.status === 400 && err.validationErrors) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        validationErrors: err.validationErrors,
      });
    }
    return res.status(err.status || 500).json({
      success: false,
      error: err.status === 400 || err.status === 403 || err.status === 404
        ? err.message
        : 'Unable to save form data to database.',
    });
  }
}

export async function updateData(req, res) {
  const { formId, recordId } = req.params;
  const submittedData = req.body?.data || req.body;

  try {
    const result = await formDataService.updateFormData(formId, recordId, submittedData);
    return res.json({ success: true, data: result });
  } catch (err) {
    console.error(`[FormDataController] updateData("${formId}", "${recordId}") error:`, err);
    if (err.status === 400 && err.validationErrors) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        validationErrors: err.validationErrors,
      });
    }
    return res.status(err.status || 500).json({
      success: false,
      error: err.status === 400 || err.status === 403 || err.status === 404
        ? err.message
        : 'Unable to update form data in database.',
    });
  }
}

export async function executeFormQuery(req, res) {
  const { formId, queryId } = req.params;
  const parameters = req.body?.parameters || req.body || {};
  try {
    const { executeFormQuery: runQuery } = await import('../services/queryExecutionService.js');
    const result = await runQuery(formId, queryId, parameters);
    return res.json(result);
  } catch (err) {
    console.error(`[FormDataController] executeFormQuery("${formId}", "${queryId}") error:`, err.message);
    return res.status(err.status || 500).json({
      success: false,
      error: err.message || 'Unable to execute query.',
    });
  }
}

