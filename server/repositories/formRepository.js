import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { executeQuery, withTransaction, getOracleHealth } from '../database/oracle.js';
import { runMigrations } from '../database/migrationRunner.js';
import { normalizeDepartmentAssignment } from '../services/departmentFilterService.js';

const FORMS_ROOT = path.resolve('server/data/forms');

/**
 * Normalizes Date or timestamp objects into clean ISO strings.
 */
function toIso(val) {
  if (!val) return null;
  if (val instanceof Date) return val.toISOString();
  if (typeof val === 'string') return val;
  return String(val);
}

/**
 * Safely extracts text from string or node-oracledb Lob stream, then parses JSON.
 */
async function parseClobJson(val, fallback = null) {
  if (!val) return fallback;
  if (typeof val === 'object' && typeof val.getData !== 'function') return val;
  let text = '';
  try {
    if (typeof val === 'string') {
      text = val;
    } else if (val && typeof val.getData === 'function') {
      text = await val.getData();
    } else if (val) {
      text = String(val);
    }
    return JSON.parse(text);
  } catch (err) {
    console.warn('[OracleFormRepository] Notice parsing CLOB JSON:', err.message);
    return fallback;
  }
}

/**
 * Base abstract interface for form storage
 */
export class FormRepository {
  async init() {}
  async listForms() {}
  async getFormById(formId) {}
  async getFormBySlug(slug) {}
  async saveForm(formDef, metadataUpdates) {}
  async publishForm(formId, options) {}
  async unpublishForm(formId) {}
  async archiveForm(formId) {}
  async getFormVersions(formId) {}
  async getVersionDefinition(formId, versionNumber) {}
  async duplicateForm(sourceFormId) {}
  async deleteForm(formId) {}
}

/**
 * Normalizes title into a clean URL-safe slug
 */
export function slugify(text) {
  if (!text || typeof text !== 'string') return 'form';
  const clean = text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return clean || 'form';
}

/**
 * Generates a collision-resistant unique slug suffix
 */
export function generateSlugSuffix(length = 5) {
  return crypto.randomBytes(Math.ceil(length / 2)).toString('hex').slice(0, length);
}

/**
 * Authoritative Oracle Database Implementation of FormRepository
 * 
 * Persists all form metadata, drafts, immutable version snapshots,
 * and department / service-center mappings in Oracle Database.
 */
export class OracleFormRepository extends FormRepository {
  constructor() {
    super();
    this.initialized = false;
  }

  async init() {
    if (this.initialized) return;
    try {
      const { initOraclePool } = await import('../database/oracle.js');
      await initOraclePool();
      await runMigrations();
    } catch (migErr) {
      console.warn('[OracleFormRepository] Migration check notice:', migErr.message);
    }
    this.initialized = true;
    console.log('[OracleFormRepository] Connected to Oracle Database as authoritative persistence.');
  }

  /**
   * Ensures slug uniqueness across all forms in Oracle Database
   */
  async ensureUniqueSlug(desiredSlug, currentFormId = null) {
    let clean = slugify(desiredSlug);
    if (!clean) clean = 'form';

    const checkSql = 'SELECT ID FROM FORMCRAFT_FORMS WHERE LOWER(SLUG) = LOWER(:s)';
    const res = await executeQuery(checkSql, { s: clean });
    if (!res.rows || res.rows.length === 0 || (currentFormId && res.rows[0].ID === currentFormId)) {
      return clean;
    }

    let candidate = `${clean}-${generateSlugSuffix(5)}`;
    let found = true;
    while (found) {
      const cRes = await executeQuery(checkSql, { s: candidate });
      if (!cRes.rows || cRes.rows.length === 0 || (currentFormId && cRes.rows[0].ID === currentFormId)) {
        found = false;
      } else {
        candidate = `${clean}-${generateSlugSuffix(5)}`;
      }
    }
    return candidate;
  }

  /**
   * Lists all stored forms with metadata, department assignments, and publication status.
   */
  async listForms() {
    await this.init();
    const formsSql = `
      SELECT ID, NAME, SLUG, STATUS, CURRENT_DRAFT_REVISION,
             PUBLISHED_VERSION, PRIMARY_ENTITY, CREATED_AT, UPDATED_AT
      FROM FORMCRAFT_FORMS
      ORDER BY UPDATED_AT DESC
    `;
    const formsRes = await executeQuery(formsSql);
    const formRows = formsRes.rows || [];

    if (formRows.length === 0) return [];

    // Fetch department assignments in bulk
    const deptSql = 'SELECT FORM_ID, DEPARTMENT_ID, DEPARTMENT_NAME FROM FORMCRAFT_FORM_DEPARTMENTS ORDER BY FORM_ID';
    const deptRes = await executeQuery(deptSql);
    const deptMap = new Map();
    for (const r of deptRes.rows || []) {
      const fId = r.FORM_ID;
      if (!deptMap.has(fId)) deptMap.set(fId, { ids: [], names: [] });
      const entry = deptMap.get(fId);
      entry.ids.push(r.DEPARTMENT_ID);
      if (r.DEPARTMENT_NAME) entry.names.push(r.DEPARTMENT_NAME);
    }

    // Fetch service center assignments in bulk
    const svcSql = 'SELECT FORM_ID, SERVICE_CENTER_ID, SERVICE_CENTER_NAME FROM FORMCRAFT_FORM_SERVICE_CENTERS ORDER BY FORM_ID';
    const svcRes = await executeQuery(svcSql);
    const svcMap = new Map();
    for (const r of svcRes.rows || []) {
      const fId = r.FORM_ID;
      if (!svcMap.has(fId)) svcMap.set(fId, { ids: [], names: [] });
      const entry = svcMap.get(fId);
      entry.ids.push(r.SERVICE_CENTER_ID);
      if (r.SERVICE_CENTER_NAME) entry.names.push(r.SERVICE_CENTER_NAME);
    }

    return formRows.map((r) => {
      const fId = r.ID;
      const deptEntry = deptMap.get(fId) || { ids: ['ALL'], names: ['All Departments (Organization-wide)'] };
      const deptNorm = normalizeDepartmentAssignment({
        departmentIds: deptEntry.ids,
        departmentNames: deptEntry.names,
      });

      const svcEntry = svcMap.get(fId) || { ids: [], names: [] };

      return {
        id: r.ID,
        title: r.NAME || 'Untitled Form',
        name: r.NAME || 'Untitled Form',
        slug: r.SLUG,
        status: r.STATUS || 'draft',
        currentDraftVersion: r.CURRENT_DRAFT_REVISION || 1,
        publishedVersion: r.PUBLISHED_VERSION || null,
        primaryEntity: r.PRIMARY_ENTITY || null,
        createdAt: toIso(r.CREATED_AT),
        updatedAt: toIso(r.UPDATED_AT),
        departmentIds: deptNorm.departmentIds,
        departmentNames: deptNorm.departmentNames,
        departmentId:
          deptNorm.departmentIds.length === 1
            ? deptNorm.departmentIds[0]
            : (deptNorm.isShared ? 'ALL' : deptNorm.departmentIds[0] || null),
        departmentName:
          deptNorm.departmentNames.length === 1
            ? deptNorm.departmentNames[0]
            : (deptNorm.isShared ? 'All Departments (Organization-wide)' : deptNorm.departmentNames.join(', ') || null),
        serviceCenterId: svcEntry.ids[0] || null,
        serviceCenterName: svcEntry.names[0] || null,
        serviceCenterIds: svcEntry.ids,
        serviceCenterNames: svcEntry.names,
        hasDraft: true,
        isPublished: r.STATUS === 'published' && !!r.PUBLISHED_VERSION,
        permissions: {
          canView: ['all'],
          canCreate: ['all'],
          canEdit: ['all'],
          canDesign: ['admin'],
          canPublish: ['admin'],
          anonymousAccess: true,
        },
      };
    });
  }

  /**
   * Retrieves complete form record by Form ID.
   */
  async getFormById(formId) {
    await this.init();
    if (!formId) return null;

    const formSql = `
      SELECT ID, NAME, SLUG, DESCRIPTION, STATUS, CURRENT_DRAFT_REVISION,
             PUBLISHED_VERSION, PRIMARY_ENTITY, CREATED_AT, UPDATED_AT
      FROM FORMCRAFT_FORMS
      WHERE ID = :id
    `;
    const formRes = await executeQuery(formSql, { id: formId });
    if (!formRes.rows || formRes.rows.length === 0) return null;
    const formRow = formRes.rows[0];

    // Read draft
    const draftSql = 'SELECT REVISION_NUMBER, DEFINITION_JSON FROM FORMCRAFT_FORM_DRAFTS WHERE FORM_ID = :id';
    const draftRes = await executeQuery(draftSql, { id: formId });
    const draft = (draftRes.rows && draftRes.rows.length > 0)
      ? await parseClobJson(draftRes.rows[0].DEFINITION_JSON)
      : null;

    // Read published definition if active
    let publishedDefinition = null;
    if (formRow.PUBLISHED_VERSION && formRow.STATUS === 'published') {
      const verSql = 'SELECT DEFINITION_JSON FROM FORMCRAFT_FORM_VERSIONS WHERE FORM_ID = :id AND VERSION_NUMBER = :v';
      const verRes = await executeQuery(verSql, { id: formId, v: formRow.PUBLISHED_VERSION });
      if (verRes.rows && verRes.rows.length > 0) {
        publishedDefinition = await parseClobJson(verRes.rows[0].DEFINITION_JSON);
      }
    }

    // Read departments
    const deptSql = 'SELECT DEPARTMENT_ID, DEPARTMENT_NAME FROM FORMCRAFT_FORM_DEPARTMENTS WHERE FORM_ID = :id';
    const deptRes = await executeQuery(deptSql, { id: formId });
    const deptIds = (deptRes.rows || []).map((r) => r.DEPARTMENT_ID);
    const deptNames = (deptRes.rows || []).map((r) => r.DEPARTMENT_NAME).filter(Boolean);
    const deptNorm = normalizeDepartmentAssignment({ departmentIds: deptIds, departmentNames: deptNames });

    // Read service centers
    const svcSql = 'SELECT SERVICE_CENTER_ID, SERVICE_CENTER_NAME FROM FORMCRAFT_FORM_SERVICE_CENTERS WHERE FORM_ID = :id';
    const svcRes = await executeQuery(svcSql, { id: formId });
    const svcIds = (svcRes.rows || []).map((r) => r.SERVICE_CENTER_ID);
    const svcNames = (svcRes.rows || []).map((r) => r.SERVICE_CENTER_NAME).filter(Boolean);

    const meta = {
      id: formRow.ID,
      name: formRow.NAME,
      slug: formRow.SLUG,
      description: formRow.DESCRIPTION || '',
      status: formRow.STATUS,
      currentDraftVersion: formRow.CURRENT_DRAFT_REVISION,
      publishedVersion: formRow.PUBLISHED_VERSION,
      primaryEntity: formRow.PRIMARY_ENTITY,
      createdAt: toIso(formRow.CREATED_AT),
      updatedAt: toIso(formRow.UPDATED_AT),
      departmentIds: deptNorm.departmentIds,
      departmentNames: deptNorm.departmentNames,
      departmentId:
        deptNorm.departmentIds.length === 1
          ? deptNorm.departmentIds[0]
          : (deptNorm.isShared ? 'ALL' : deptNorm.departmentIds[0] || null),
      departmentName:
        deptNorm.departmentNames.length === 1
          ? deptNorm.departmentNames[0]
          : (deptNorm.isShared ? 'All Departments (Organization-wide)' : deptNorm.departmentNames.join(', ') || null),
      serviceCenterId: svcIds[0] || null,
      serviceCenterName: svcNames[0] || null,
      serviceCenterIds: svcIds,
      serviceCenterNames: svcNames,
      permissions: {
        canView: ['all'],
        canCreate: ['all'],
        canEdit: ['all'],
        canDesign: ['admin'],
        canPublish: ['admin'],
        anonymousAccess: true,
      },
    };

    return { meta, draft, publishedDefinition };
  }

  /**
   * Retrieves complete form record by runtime slug.
   */
  async getFormBySlug(slug) {
    await this.init();
    if (!slug) return null;

    const findSql = 'SELECT ID FROM FORMCRAFT_FORMS WHERE LOWER(SLUG) = LOWER(:s)';
    const res = await executeQuery(findSql, { s: slug.trim() });
    if (!res.rows || res.rows.length === 0) return null;
    return this.getFormById(res.rows[0].ID);
  }

  /**
   * Saves or updates a draft form definition into Oracle Database inside an atomic transaction.
   */
  async saveForm(formDef, metadataUpdates = {}) {
    await this.init();
    if (!formDef || !formDef.id) {
      throw new Error('Form definition must contain an "id" property.');
    }

    const formId = formDef.id;
    const existing = await this.getFormById(formId);

    const desiredSlug = metadataUpdates.slug || existing?.meta?.slug || formDef.title || formId;
    const slug = await this.ensureUniqueSlug(desiredSlug, formId);

    const deptNorm = normalizeDepartmentAssignment({
      departmentIds: metadataUpdates.departmentIds || formDef.settings?.departmentIds || existing?.meta?.departmentIds,
      departmentNames: metadataUpdates.departmentNames || formDef.settings?.departmentNames || existing?.meta?.departmentNames,
      departmentId: metadataUpdates.departmentId || formDef.settings?.departmentId || existing?.meta?.departmentId,
      departmentName: metadataUpdates.departmentName || formDef.settings?.departmentName || existing?.meta?.departmentName,
    });

    let serviceCenterIds = metadataUpdates.serviceCenterIds || formDef.settings?.serviceCenterIds || existing?.meta?.serviceCenterIds || [];
    let serviceCenterNames = metadataUpdates.serviceCenterNames || formDef.settings?.serviceCenterNames || existing?.meta?.serviceCenterNames || [];
    if (metadataUpdates.serviceCenterId && !serviceCenterIds.includes(metadataUpdates.serviceCenterId)) {
      serviceCenterIds = [metadataUpdates.serviceCenterId, ...serviceCenterIds];
    }

    const draftRevision = existing?.meta?.currentDraftVersion || 1;
    const publishedVersion = existing?.meta?.publishedVersion || null;
    const primaryEntity = formDef.settings?.primaryEntity || metadataUpdates.primaryEntity || existing?.meta?.primaryEntity || null;
    const formName = formDef.title || metadataUpdates.name || existing?.meta?.name || 'Untitled Form';
    const formStatus = metadataUpdates.status || existing?.meta?.status || 'draft';

    const draftJson = JSON.stringify(formDef);

    await withTransaction(async (conn) => {
      // 1. Upsert FORMCRAFT_FORMS
      const checkRes = await conn.execute('SELECT ID FROM FORMCRAFT_FORMS WHERE ID = :id', { id: formId });
      if (checkRes.rows && checkRes.rows.length > 0) {
        await conn.execute(`
          UPDATE FORMCRAFT_FORMS
          SET NAME = :name,
              SLUG = :slug,
              STATUS = :status,
              PRIMARY_ENTITY = :primaryEntity,
              UPDATED_AT = SYSTIMESTAMP
          WHERE ID = :id
        `, {
          name: formName,
          slug,
          status: formStatus,
          primaryEntity,
          id: formId,
        });
      } else {
        await conn.execute(`
          INSERT INTO FORMCRAFT_FORMS (
            ID, NAME, SLUG, STATUS, CURRENT_DRAFT_REVISION,
            PUBLISHED_VERSION, PRIMARY_ENTITY, CREATED_AT, UPDATED_AT
          ) VALUES (
            :id, :name, :slug, :status, :rev,
            :pubVer, :primaryEntity, SYSTIMESTAMP, SYSTIMESTAMP
          )
        `, {
          id: formId,
          name: formName,
          slug,
          status: formStatus,
          rev: draftRevision,
          pubVer: publishedVersion,
          primaryEntity,
        });
      }

      // 2. Upsert FORMCRAFT_FORM_DRAFTS
      const draftCheck = await conn.execute('SELECT FORM_ID FROM FORMCRAFT_FORM_DRAFTS WHERE FORM_ID = :id', { id: formId });
      if (draftCheck.rows && draftCheck.rows.length > 0) {
        await conn.execute(`
          UPDATE FORMCRAFT_FORM_DRAFTS
          SET DEFINITION_JSON = :defJson,
              REVISION_NUMBER = REVISION_NUMBER + 1,
              UPDATED_AT = SYSTIMESTAMP
          WHERE FORM_ID = :id
        `, {
          defJson: draftJson,
          id: formId,
        });
      } else {
        await conn.execute(`
          INSERT INTO FORMCRAFT_FORM_DRAFTS (
            FORM_ID, REVISION_NUMBER, DEFINITION_JSON, UPDATED_AT
          ) VALUES (
            :id, 1, :defJson, SYSTIMESTAMP
          )
        `, {
          id: formId,
          defJson: draftJson,
        });
      }

      // 3. Sync Departments
      await conn.execute('DELETE FROM FORMCRAFT_FORM_DEPARTMENTS WHERE FORM_ID = :id', { id: formId });
      for (let i = 0; i < deptNorm.departmentIds.length; i++) {
        const dId = deptNorm.departmentIds[i];
        const dName = deptNorm.departmentNames[i] || (dId === 'ALL' ? 'All Departments (Organization-wide)' : null);
        await conn.execute(`
          INSERT INTO FORMCRAFT_FORM_DEPARTMENTS (
            FORM_ID, DEPARTMENT_ID, DEPARTMENT_NAME, ASSIGNED_AT
          ) VALUES (
            :fId, :dId, :dName, SYSTIMESTAMP
          )
        `, { fId: formId, dId, dName });
      }

      // 4. Sync Service Centers
      await conn.execute('DELETE FROM FORMCRAFT_FORM_SERVICE_CENTERS WHERE FORM_ID = :id', { id: formId });
      for (let i = 0; i < serviceCenterIds.length; i++) {
        const sId = serviceCenterIds[i];
        const sName = serviceCenterNames[i] || null;
        await conn.execute(`
          INSERT INTO FORMCRAFT_FORM_SERVICE_CENTERS (
            FORM_ID, SERVICE_CENTER_ID, SERVICE_CENTER_NAME, ASSIGNED_AT
          ) VALUES (
            :fId, :sId, :sName, SYSTIMESTAMP
          )
        `, { fId: formId, sId, sName });
      }
    });

    return this.getFormById(formId);
  }

  /**
   * Publishes a new immutable version snapshot to FORMCRAFT_FORM_VERSIONS.
   */
  async publishForm(formId, validatedDefinition = null) {
    await this.init();
    const existing = await this.getFormById(formId);
    if (!existing) {
      throw new Error(`Form with id "${formId}" does not exist.`);
    }

    const definitionToPublish = validatedDefinition || existing.draft;
    if (!definitionToPublish) {
      throw new Error(`Cannot publish form "${formId}" without a valid form definition.`);
    }

    const deptNorm = normalizeDepartmentAssignment({
      departmentIds: definitionToPublish.settings?.departmentIds ?? existing.meta?.departmentIds,
      departmentNames: definitionToPublish.settings?.departmentNames ?? existing.meta?.departmentNames,
      departmentId: definitionToPublish.settings?.departmentId ?? existing.meta?.departmentId,
      departmentName: definitionToPublish.settings?.departmentName ?? existing.meta?.departmentName,
    });

    const vJson = JSON.stringify(definitionToPublish);
    let newVersion = (existing.meta?.publishedVersion || 0) + 1;

    await withTransaction(async (conn) => {
      // Safely compute next version number
      const vRes = await conn.execute(
        'SELECT NVL(MAX(VERSION_NUMBER), 0) AS MAX_VER FROM FORMCRAFT_FORM_VERSIONS WHERE FORM_ID = :id',
        { id: formId }
      );
      if (vRes.rows && vRes.rows.length > 0) {
        const maxV = Number(vRes.rows[0].MAX_VER || 0);
        newVersion = Math.max(newVersion, maxV + 1);
      }

      // Insert immutable snapshot into FORMCRAFT_FORM_VERSIONS
      await conn.execute(`
        INSERT INTO FORMCRAFT_FORM_VERSIONS (
          FORM_ID, VERSION_NUMBER, DEFINITION_JSON, PUBLISHED_AT, PUBLISHED_BY, CHANGE_SUMMARY
        ) VALUES (
          :id, :vNum, :defJson, SYSTIMESTAMP, :pubBy, :summary
        )
      `, {
        id: formId,
        vNum: newVersion,
        defJson: vJson,
        pubBy: 'Clinician / FormCraft Builder',
        summary: `Published version ${newVersion}`,
      });

      // Update FORMCRAFT_FORMS
      await conn.execute(`
        UPDATE FORMCRAFT_FORMS
        SET NAME = :name,
            STATUS = 'published',
            PUBLISHED_VERSION = :pubVer,
            CURRENT_DRAFT_REVISION = CURRENT_DRAFT_REVISION + 1,
            PRIMARY_ENTITY = :primaryEntity,
            UPDATED_AT = SYSTIMESTAMP
        WHERE ID = :id
      `, {
        name: definitionToPublish.title || existing.meta.name,
        pubVer: newVersion,
        primaryEntity: definitionToPublish.settings?.primaryEntity || existing.meta.primaryEntity || null,
        id: formId,
      });

      // Sync departments
      await conn.execute('DELETE FROM FORMCRAFT_FORM_DEPARTMENTS WHERE FORM_ID = :id', { id: formId });
      for (let i = 0; i < deptNorm.departmentIds.length; i++) {
        const dId = deptNorm.departmentIds[i];
        const dName = deptNorm.departmentNames[i] || (dId === 'ALL' ? 'All Departments (Organization-wide)' : null);
        await conn.execute(`
          INSERT INTO FORMCRAFT_FORM_DEPARTMENTS (
            FORM_ID, DEPARTMENT_ID, DEPARTMENT_NAME, ASSIGNED_AT
          ) VALUES (
            :fId, :dId, :dName, SYSTIMESTAMP
          )
        `, { fId: formId, dId, dName });
      }
    });

    const updated = await this.getFormById(formId);
    return {
      success: true,
      meta: updated.meta,
      version: newVersion,
      slug: updated.meta.slug,
      definition: definitionToPublish,
    };
  }

  /**
   * Sets status to 'unpublished' in Oracle Database
   */
  async unpublishForm(formId) {
    await this.init();
    await executeQuery(
      "UPDATE FORMCRAFT_FORMS SET STATUS = 'unpublished', UPDATED_AT = SYSTIMESTAMP WHERE ID = :id",
      { id: formId }
    );
    return { success: true, message: `Form "${formId}" has been unpublished.` };
  }

  /**
   * Sets status to 'archived' in Oracle Database
   */
  async archiveForm(formId) {
    await this.init();
    await executeQuery(
      "UPDATE FORMCRAFT_FORMS SET STATUS = 'archived', UPDATED_AT = SYSTIMESTAMP WHERE ID = :id",
      { id: formId }
    );
    return { success: true, message: `Form "${formId}" has been archived.` };
  }

  /**
   * Returns list of version numbers and publish timestamps from FORMCRAFT_FORM_VERSIONS
   */
  async getFormVersions(formId) {
    await this.init();
    const sql = `
      SELECT VERSION_NUMBER, PUBLISHED_AT, PUBLISHED_BY, CHANGE_SUMMARY
      FROM FORMCRAFT_FORM_VERSIONS
      WHERE FORM_ID = :id
      ORDER BY VERSION_NUMBER DESC
    `;
    const res = await executeQuery(sql, { id: formId });
    return (res.rows || []).map((r) => ({
      versionNumber: Number(r.VERSION_NUMBER),
      fileName: `v${r.VERSION_NUMBER}.json`,
      createdAt: toIso(r.PUBLISHED_AT),
      publishedBy: r.PUBLISHED_BY || 'Clinician',
      changeSummary: r.CHANGE_SUMMARY || null,
    }));
  }

  /**
   * Returns the exact frozen snapshot JSON definition from Oracle FORMCRAFT_FORM_VERSIONS
   */
  async getVersionDefinition(formId, versionNumber) {
    await this.init();
    const sql = `
      SELECT DEFINITION_JSON
      FROM FORMCRAFT_FORM_VERSIONS
      WHERE FORM_ID = :id AND VERSION_NUMBER = :v
    `;
    const res = await executeQuery(sql, { id: formId, v: Number(versionNumber) });
    if (!res.rows || res.rows.length === 0) return null;
    return await parseClobJson(res.rows[0].DEFINITION_JSON);
  }

  /**
   * Duplicates an existing form into a new draft in Oracle Database
   */
  async duplicateForm(sourceFormId) {
    await this.init();
    const source = await this.getFormById(sourceFormId);
    if (!source) {
      throw new Error(`Source form with id "${sourceFormId}" not found.`);
    }

    const newFormId = `form_${Date.now()}`;
    const newTitle = `${source.draft?.title || source.meta?.name || 'Form'} (Copy)`;
    const newSlug = await this.ensureUniqueSlug(newTitle, newFormId);

    const duplicatedDef = {
      ...(source.draft || source.publishedDefinition || {}),
      id: newFormId,
      title: newTitle,
    };

    return this.saveForm(duplicatedDef, {
      name: newTitle,
      slug: newSlug,
      status: 'draft',
      currentDraftVersion: 1,
      publishedVersion: null,
      publishedAt: null,
    });
  }

  /**
   * Permanently deletes an unpublished form from Oracle Database
   */
  async deleteForm(formId) {
    await this.init();
    const existing = await this.getFormById(formId);
    if (!existing) {
      const err = new Error(`Form with id "${formId}" does not exist.`);
      err.status = 404;
      throw err;
    }

    if (existing.meta?.status === 'published') {
      const err = new Error('Cannot delete a published form. Please unpublish it first.');
      err.status = 400;
      throw err;
    }

    // Cascade deletes draft, versions, departments, service centers via foreign keys
    await executeQuery('DELETE FROM FORMCRAFT_FORMS WHERE ID = :id', { id: formId });

    return {
      success: true,
      message: `Form "${existing.meta?.name || formId}" has been deleted from Oracle Database.`,
    };
  }
}

/**
 * Concrete file-system implementation of FormRepository (Legacy Reference)
 */
export class FileFormRepository extends FormRepository {
  constructor(rootDir = FORMS_ROOT) {
    super();
    this.rootDir = rootDir;
    this.cache = new Map();
    this.slugIndex = new Map();
    this.initialized = false;
  }

  async init() {
    if (this.initialized) return;
    if (!fs.existsSync(this.rootDir)) {
      fs.mkdirSync(this.rootDir, { recursive: true });
    }
    this.initialized = true;
  }

  async listForms() {
    return [];
  }

  async getFormById() {
    return null;
  }

  async getFormBySlug() {
    return null;
  }
}

// Export singleton authoritative instance of OracleFormRepository
export const formRepository = new OracleFormRepository();
