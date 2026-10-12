import * as formService from '../services/formService.js';
import { validateFormForPublishing } from '../services/publishService.js';
import { invalidateRuntimeCache } from '../services/runtimeService.js';
import { resolveDepartment, matchesDepartmentScope } from '../services/departmentFilterService.js';

export async function saveForm(req, res) {
  try {
    const formDef = req.body?.definition || req.body;
    const metadata = req.body?.metadata || {};

    if (!formDef || !formDef.id) {
      return res.status(400).json({
        success: false,
        error: 'Form definition payload must include an "id" field.',
      });
    }

    const saved = await formService.saveForm(formDef, metadata);
    const fullRecord = await formService.getFormRecord(formDef.id);

    return res.json({
      success: true,
      data: saved,
      meta: fullRecord?.meta,
    });
  } catch (err) {
    console.error('[FormController] saveForm error:', err);
    return res.status(500).json({
      success: false,
      error: err.message || 'Failed to save form definition.',
    });
  }
}

export async function getForm(req, res) {
  const { formId } = req.params;
  try {
    const record = await formService.getFormRecord(formId);
    if (!record) {
      return res.status(404).json({
        success: false,
        error: `Form definition "${formId}" not found.`,
      });
    }

    const baseUrl = process.env.PUBLIC_FORM_BASE_URL || `${req.protocol}://${req.get('host')}`;
    const runtimeUrl = record.meta?.slug ? `${baseUrl}/forms/${record.meta.slug}` : null;

    return res.json({
      success: true,
      data: record.draft || record.publishedDefinition,
      meta: record.meta,
      publishedVersion: record.meta?.publishedVersion,
      runtimeUrl,
    });
  } catch (err) {
    console.error(`[FormController] getForm("${formId}") error:`, err);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve form definition.',
    });
  }
}

export async function listForms(req, res) {
  try {
    const { department, departmentId, serviceCenter, serviceCenterId } = req.query;
    let forms = await formService.listForms();

    if (department || departmentId) {
      const resolvedDept = await resolveDepartment(department || departmentId);
      const rawSc = serviceCenter || serviceCenterId;
      forms = forms.filter((f) => matchesDepartmentScope(f, resolvedDept, rawSc));
    }

    const baseUrl = process.env.PUBLIC_FORM_BASE_URL || `${req.protocol}://${req.get('host')}`;

    const formsWithUrls = forms.map((f) => ({
      ...f,
      runtimeUrl: f.slug ? `${baseUrl}/forms/${f.slug}` : null,
    }));

    return res.json({ success: true, data: formsWithUrls });
  } catch (err) {
    console.error('[FormController] listForms error:', err);
    return res.status(500).json({
      success: false,
      error: 'Failed to list form definitions.',
    });
  }
}

export async function validateForm(req, res) {
  const { formId } = req.params;
  try {
    const record = await formService.getFormRecord(formId);
    if (!record) {
      return res.status(404).json({
        success: false,
        error: `Form definition "${formId}" not found.`,
      });
    }

    const definitionToValidate = req.body?.definition || record.draft || record.publishedDefinition;
    const validationResult = await validateFormForPublishing(definitionToValidate);

    return res.json({
      success: true,
      validation: validationResult,
    });
  } catch (err) {
    console.error(`[FormController] validateForm("${formId}") error:`, err);
    return res.status(500).json({
      success: false,
      error: 'Failed to run form publishing validation.',
    });
  }
}

export async function publishForm(req, res) {
  const { formId } = req.params;
  try {
    // If client supplied draft changes along with publish request, save draft first
    if (req.body?.definition) {
      await formService.saveForm(req.body.definition, req.body.metadata || {});
    }

    const result = await formService.publishForm(formId);
    invalidateRuntimeCache(result.slug);
    invalidateRuntimeCache(formId);

    const baseUrl = process.env.PUBLIC_FORM_BASE_URL || `${req.protocol}://${req.get('host')}`;
    const runtimeUrl = `${baseUrl}/forms/${result.slug}`;

    return res.json({
      success: true,
      message: `Form successfully published as version v${result.version}!`,
      version: result.version,
      slug: result.slug,
      runtimeUrl,
      meta: result.meta,
      validation: result.validation,
    });
  } catch (err) {
    console.error(`[FormController] publishForm("${formId}") error:`, err.message);
    const status = err.status || 500;
    return res.status(status).json({
      success: false,
      error: err.message || 'Failed to publish form.',
      validation: err.validation || null,
    });
  }
}

export async function unpublishForm(req, res) {
  const { formId } = req.params;
  try {
    const record = await formService.unpublishForm(formId);
    invalidateRuntimeCache(record.meta?.slug);
    invalidateRuntimeCache(formId);

    return res.json({
      success: true,
      message: 'Form has been unpublished and is no longer accessible to runtime users.',
      meta: record.meta,
    });
  } catch (err) {
    console.error(`[FormController] unpublishForm("${formId}") error:`, err);
    return res.status(err.status || 500).json({
      success: false,
      error: err.message || 'Failed to unpublish form.',
    });
  }
}

export async function archiveForm(req, res) {
  const { formId } = req.params;
  try {
    const record = await formService.archiveForm(formId);
    invalidateRuntimeCache(record.meta?.slug);
    invalidateRuntimeCache(formId);

    return res.json({
      success: true,
      message: 'Form has been archived.',
      meta: record.meta,
    });
  } catch (err) {
    console.error(`[FormController] archiveForm("${formId}") error:`, err);
    return res.status(err.status || 500).json({
      success: false,
      error: err.message || 'Failed to archive form.',
    });
  }
}

export async function getFormVersions(req, res) {
  const { formId } = req.params;
  try {
    const versions = await formService.getFormVersions(formId);
    return res.json({ success: true, data: versions });
  } catch (err) {
    console.error(`[FormController] getFormVersions("${formId}") error:`, err);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve form versions.',
    });
  }
}

export async function getVersionDefinition(req, res) {
  const { formId, version } = req.params;
  try {
    const versionNum = parseInt(version, 10);
    const definition = await formService.getVersionDefinition(formId, versionNum);
    if (!definition) {
      return res.status(404).json({
        success: false,
        error: `Version v${version} for form "${formId}" not found.`,
      });
    }
    return res.json({ success: true, data: definition });
  } catch (err) {
    console.error(`[FormController] getVersionDefinition("${formId}", "${version}") error:`, err);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve version definition.',
    });
  }
}

export async function duplicateForm(req, res) {
  const { formId } = req.params;
  try {
    const duplicated = await formService.duplicateForm(formId);
    return res.status(201).json({
      success: true,
      message: 'Form duplicated successfully.',
      data: duplicated.draft,
      meta: duplicated.meta,
    });
  } catch (err) {
    console.error(`[FormController] duplicateForm("${formId}") error:`, err);
    return res.status(err.status || 500).json({
      success: false,
      error: err.message || 'Failed to duplicate form.',
    });
  }
}

export async function deleteForm(req, res) {
  const { formId } = req.params;
  try {
    const result = await formService.deleteForm(formId);
    invalidateRuntimeCache(formId);
    return res.json(result);
  } catch (err) {
    console.error(`[FormController] deleteForm("${formId}") error:`, err);
    return res.status(err.status || 500).json({
      success: false,
      error: err.message || 'Failed to delete form.',
    });
  }
}

export async function getDeployedForms(req, res) {
  try {
    const { department, departmentId, serviceCenter, serviceCenterId } = req.query;
    const rawDept = department || departmentId;
    const rawSc = serviceCenter || serviceCenterId;

    const resolvedDept = await resolveDepartment(rawDept);

    const forms = await formService.listForms();
    const deployed = forms.filter((f) => f.status === 'published' && f.publishedVersion);
    const filtered = deployed.filter((f) => matchesDepartmentScope(f, resolvedDept, rawSc));

    const baseUrl = process.env.PUBLIC_FORM_BASE_URL || `${req.protocol}://${req.get('host')}`;

    const formsWithUrls = filtered.map((f) => ({
      id: f.id,
      title: f.title || f.name || 'Untitled Form',
      slug: f.slug,
      publishedVersion: f.publishedVersion,
      version: f.publishedVersion,
      runtimeUrl: f.slug ? `/forms/${f.slug}` : `/runtime/forms/${f.id}`,
      fullUrl: f.slug ? `${baseUrl}/forms/${f.slug}` : `${baseUrl}/runtime/forms/${f.id}`,
      publishedAt: f.publishedAt,
      departmentId: f.departmentId || null,
      departmentName: f.departmentName || null,
      serviceCenterId: f.serviceCenterId || null,
      serviceCenterName: f.serviceCenterName || null,
    }));

    return res.json({
      success: true,
      forms: formsWithUrls,
      data: formsWithUrls,
    });
  } catch (err) {
    console.error('[FormController] getDeployedForms error:', err);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve deployed forms.',
      forms: [],
    });
  }
}

