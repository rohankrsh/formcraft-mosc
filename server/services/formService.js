import { formRepository } from '../repositories/formRepository.js';
import { validateFormForPublishing } from './publishService.js';

/**
 * Saves or updates a form definition and draft.
 */
export async function saveForm(formDefinition, metadata = {}) {
  if (!formDefinition || !formDefinition.id) {
    throw new Error('Form definition must contain an "id" property.');
  }
  const record = await formRepository.saveForm(formDefinition, metadata);
  return record.draft;
}

/**
 * Retrieves a form definition by its id or slug.
 * Prioritizes draft definition for builder/editing, falling back to published definition.
 */
export async function getForm(idOrSlug) {
  if (!idOrSlug) return null;
  // If idOrSlug is already a FormDefinition object, return it
  if (typeof idOrSlug === 'object' && idOrSlug.id) {
    return idOrSlug;
  }

  // Check by ID
  let record = await formRepository.getFormById(idOrSlug);
  // If not found by ID, check by slug
  if (!record) {
    record = await formRepository.getFormBySlug(idOrSlug);
  }

  if (!record) return null;
  return record.draft || record.publishedDefinition;
}

/**
 * Retrieves full form record including metadata, draft, and publishedDefinition.
 */
export async function getFormRecord(idOrSlug) {
  if (!idOrSlug) return null;
  let record = await formRepository.getFormById(idOrSlug);
  if (!record) {
    record = await formRepository.getFormBySlug(idOrSlug);
  }
  return record;
}

/**
 * Lists all stored forms with metadata, status, version, and primaryEntity.
 */
export async function listForms() {
  const forms = await formRepository.listForms();
  return forms.map((f) => ({
    id: f.id,
    title: f.name || 'Untitled Form',
    name: f.name || 'Untitled Form',
    slug: f.slug,
    status: f.status,
    currentDraftVersion: f.currentDraftVersion,
    publishedVersion: f.publishedVersion,
    primaryEntity: f.primaryEntity || null,
    departmentId: f.departmentId || null,
    departmentName: f.departmentName || null,
    serviceCenterId: f.serviceCenterId || null,
    serviceCenterName: f.serviceCenterName || null,
    createdAt: f.createdAt,
    updatedAt: f.updatedAt,
    publishedAt: f.publishedAt,
  }));
}

/**
 * Validates and publishes a form, creating an immutable version snapshot.
 */
export async function publishForm(formId, options = {}) {
  const record = await formRepository.getFormById(formId);
  if (!record) {
    const err = new Error(`Form with id "${formId}" not found.`);
    err.status = 404;
    throw err;
  }

  const draft = record.draft;
  if (!draft) {
    const err = new Error(`Form "${formId}" has no draft definition to publish.`);
    err.status = 400;
    throw err;
  }

  // Pre-publish validation
  const validation = await validateFormForPublishing(draft);
  if (!validation.valid) {
    const err = new Error('Form publishing validation failed.');
    err.status = 422;
    err.validation = validation;
    throw err;
  }

  // Publish and freeze immutable version snapshot
  const result = await formRepository.publishForm(formId, draft);
  return {
    ...result,
    validation,
  };
}

/**
 * Unpublishes a form, taking it offline from runtime.
 */
export async function unpublishForm(formId) {
  return formRepository.unpublishForm(formId);
}

/**
 * Archives a form.
 */
export async function archiveForm(formId) {
  return formRepository.archiveForm(formId);
}

/**
 * Gets version history for a form.
 */
export async function getFormVersions(formId) {
  return formRepository.getFormVersions(formId);
}

/**
 * Gets a specific frozen version definition.
 */
export async function getVersionDefinition(formId, versionNumber) {
  return formRepository.getVersionDefinition(formId, versionNumber);
}

/**
 * Duplicates a form into a new draft with unique ID and slug.
 */
export async function duplicateForm(formId) {
  return formRepository.duplicateForm(formId);
}

/**
 * Permanently deletes a form (only permitted if not published).
 */
export async function deleteForm(formId) {
  return formRepository.deleteForm(formId);
}
