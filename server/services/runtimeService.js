import { formRepository } from '../repositories/formRepository.js';
import * as formDataService from './formDataService.js';

// In-memory cache for ultra-fast runtime lookups of immutable published definitions
const runtimeCache = new Map(); // slug -> { meta, definition }

/**
 * Invalidates runtime cache for a form (by slug or formId)
 */
export function invalidateRuntimeCache(slugOrId) {
  if (!slugOrId) {
    runtimeCache.clear();
    return;
  }
  const key = slugOrId.toLowerCase().trim();
  runtimeCache.delete(key);
}

/**
 * Retrieves ONLY the published FormDefinition for a given unique slug.
 * Enforces form status: returns friendly messages for unpublished or archived forms.
 */
export async function getPublishedFormBySlug(slug) {
  if (!slug) {
    const err = new Error('Form slug is required.');
    err.status = 400;
    throw err;
  }

  const normalizedSlug = slug.toLowerCase().trim();

  // Check in-memory runtime cache
  if (runtimeCache.has(normalizedSlug)) {
    return runtimeCache.get(normalizedSlug);
  }

  const record = await formRepository.getFormBySlug(normalizedSlug);
  if (!record) {
    const err = new Error('Form Not Found: The requested form does not exist or has been removed.');
    err.status = 404;
    err.code = 'FORM_NOT_FOUND';
    throw err;
  }

  const { meta, publishedDefinition } = record;

  if (meta.status === 'unpublished') {
    const err = new Error('This form is currently unavailable. Please contact the administrator.');
    err.status = 403;
    err.code = 'FORM_UNAVAILABLE';
    throw err;
  }

  if (meta.status === 'archived') {
    const err = new Error('This form has been archived and is no longer accessible.');
    err.status = 410;
    err.code = 'FORM_ARCHIVED';
    throw err;
  }

  if (meta.status !== 'published' || !meta.publishedVersion || !publishedDefinition) {
    const err = new Error('This form is currently in draft mode and is not yet published.');
    err.status = 404;
    err.code = 'FORM_NOT_PUBLISHED';
    throw err;
  }

  const result = {
    id: meta.id,
    slug: meta.slug,
    title: publishedDefinition.title || meta.name,
    description: publishedDefinition.description || '',
    version: meta.publishedVersion,
    publishedAt: meta.publishedAt,
    permissions: meta.permissions,
    definition: publishedDefinition,
  };

  // Cache for future requests
  runtimeCache.set(normalizedSlug, result);
  return result;
}

/**
 * Loads dynamic Oracle options for the published form
 */
export async function getRuntimeOptions(slug) {
  const published = await getPublishedFormBySlug(slug);
  return formDataService.getFormOptions(published.definition);
}

/**
 * Fetches an existing Oracle record for the published form by recordId or MRN
 */
export async function getRuntimeRecord(slug, recordId) {
  const published = await getPublishedFormBySlug(slug);
  return formDataService.getRecordData(published.definition, recordId);
}

/**
 * Inserts a new record into Oracle using the published form's configuration
 */
export async function insertRuntimeData(slug, submittedData) {
  const published = await getPublishedFormBySlug(slug);
  return formDataService.insertFormData(published.definition, submittedData);
}

/**
 * Updates an existing record in Oracle using the published form's configuration
 */
export async function updateRuntimeData(slug, recordId, submittedData) {
  const published = await getPublishedFormBySlug(slug);
  return formDataService.updateFormData(published.definition, recordId, submittedData);
}
