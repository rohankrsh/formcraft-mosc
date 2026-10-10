import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const FORMS_ROOT = path.resolve('server/data/forms');

// Ensure root directory exists
if (!fs.existsSync(FORMS_ROOT)) {
  fs.mkdirSync(FORMS_ROOT, { recursive: true });
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
 * Concrete file-system implementation of FormRepository
 * Supports structure:
 * server/data/forms/
 *   {formId}/
 *     meta.json
 *     draft.json
 *     versions/
 *       v1.json
 *       v2.json
 */
export class FileFormRepository extends FormRepository {
  constructor(rootDir = FORMS_ROOT) {
    super();
    this.rootDir = rootDir;
    this.cache = new Map(); // formId -> { meta, draft, publishedDefinition }
    this.slugIndex = new Map(); // slug -> formId
    this.initialized = false;
  }

  async init() {
    if (this.initialized) return;
    if (!fs.existsSync(this.rootDir)) {
      fs.mkdirSync(this.rootDir, { recursive: true });
    }
    await this.migrateLegacyFiles();
    await this.rebuildIndex();
    this.initialized = true;
  }

  /**
   * Automatically migrates legacy flat JSON files (e.g. form_123.json) into versioned directories
   */
  async migrateLegacyFiles() {
    try {
      const entries = await fs.promises.readdir(this.rootDir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isFile() && entry.name.endsWith('.json')) {
          const filePath = path.join(this.rootDir, entry.name);
          try {
            const raw = await fs.promises.readFile(filePath, 'utf-8');
            const def = JSON.parse(raw);
            const formId = def.id || path.basename(entry.name, '.json');
            def.id = formId;

            const formDir = path.join(this.rootDir, formId);
            const metaPath = path.join(formDir, 'meta.json');
            const draftPath = path.join(formDir, 'draft.json');

            // If the folder doesn't exist yet, create it and migrate
            if (!fs.existsSync(formDir)) {
              await fs.promises.mkdir(formDir, { recursive: true });
              await fs.promises.mkdir(path.join(formDir, 'versions'), { recursive: true });

              const baseSlug = slugify(def.title || formId);
              const uniqueSlug = `${baseSlug}-${generateSlugSuffix(5)}`;

              const now = new Date().toISOString();
              const meta = {
                id: formId,
                name: def.title || 'Untitled Form',
                slug: uniqueSlug,
                status: 'draft',
                currentDraftVersion: 1,
                publishedVersion: null,
                createdAt: now,
                updatedAt: now,
                publishedAt: null,
                primaryEntity: def.settings?.primaryEntity || null,
                permissions: {
                  canView: ['all'],
                  canCreate: ['all'],
                  canEdit: ['all'],
                  canDesign: ['admin'],
                  canPublish: ['admin'],
                  anonymousAccess: true,
                },
              };

              await fs.promises.writeFile(metaPath, JSON.stringify(meta, null, 2), 'utf-8');
              await fs.promises.writeFile(draftPath, JSON.stringify(def, null, 2), 'utf-8');
              console.log(`[FormRepository] Migrated legacy form "${entry.name}" -> "${formId}/" with slug "${uniqueSlug}"`);
            }
          } catch (err) {
            console.warn(`[FormRepository] Error migrating legacy file "${entry.name}":`, err.message);
          }
        }
      }
    } catch (err) {
      console.error('[FormRepository] Migration scan error:', err);
    }
  }

  /**
   * Rebuilds in-memory index from disk
   */
  async rebuildIndex() {
    this.cache.clear();
    this.slugIndex.clear();

    const entries = await fs.promises.readdir(this.rootDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const formId = entry.name;
        const formDir = path.join(this.rootDir, formId);
        const metaPath = path.join(formDir, 'meta.json');
        const draftPath = path.join(formDir, 'draft.json');

        if (fs.existsSync(metaPath)) {
          try {
            const metaRaw = await fs.promises.readFile(metaPath, 'utf-8');
            const meta = JSON.parse(metaRaw);

            let draft = null;
            if (fs.existsSync(draftPath)) {
              const draftRaw = await fs.promises.readFile(draftPath, 'utf-8');
              draft = JSON.parse(draftRaw);
            }

            let publishedDefinition = null;
            if (meta.publishedVersion && meta.status === 'published') {
              const versionPath = path.join(formDir, 'versions', `v${meta.publishedVersion}.json`);
              if (fs.existsSync(versionPath)) {
                const versionRaw = await fs.promises.readFile(versionPath, 'utf-8');
                publishedDefinition = JSON.parse(versionRaw);
              }
            }

            this.cache.set(formId, { meta, draft, publishedDefinition });
            if (meta.slug) {
              this.slugIndex.set(meta.slug.toLowerCase(), formId);
            }
          } catch (err) {
            console.error(`[FormRepository] Error loading form "${formId}":`, err.message);
          }
        }
      }
    }
  }

  /**
   * Ensures slug uniqueness across all active forms
   */
  ensureUniqueSlug(desiredSlug, currentFormId = null) {
    let clean = slugify(desiredSlug);
    if (!clean) clean = 'form';

    // Check if clean itself is taken by another form
    const existingId = this.slugIndex.get(clean);
    if (!existingId || existingId === currentFormId) {
      return clean;
    }

    // Append collision-resistant suffix
    let candidate = `${clean}-${generateSlugSuffix(5)}`;
    while (this.slugIndex.has(candidate) && this.slugIndex.get(candidate) !== currentFormId) {
      candidate = `${clean}-${generateSlugSuffix(5)}`;
    }
    return candidate;
  }

  async listForms() {
    await this.init();
    const result = [];
    for (const [, item] of this.cache.entries()) {
      result.push({
        ...item.meta,
        hasDraft: !!item.draft,
        isPublished: item.meta.status === 'published' && !!item.meta.publishedVersion,
      });
    }
    // Sort by updatedAt descending
    return result.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }

  async getFormById(formId) {
    await this.init();
    if (!formId) return null;

    if (this.cache.has(formId)) {
      return this.cache.get(formId);
    }

    // Check disk if not in cache
    const formDir = path.join(this.rootDir, formId);
    const metaPath = path.join(formDir, 'meta.json');
    if (!fs.existsSync(metaPath)) return null;

    try {
      const meta = JSON.parse(await fs.promises.readFile(metaPath, 'utf-8'));
      const draftPath = path.join(formDir, 'draft.json');
      const draft = fs.existsSync(draftPath)
        ? JSON.parse(await fs.promises.readFile(draftPath, 'utf-8'))
        : null;

      let publishedDefinition = null;
      if (meta.publishedVersion && meta.status === 'published') {
        const vPath = path.join(formDir, 'versions', `v${meta.publishedVersion}.json`);
        if (fs.existsSync(vPath)) {
          publishedDefinition = JSON.parse(await fs.promises.readFile(vPath, 'utf-8'));
        }
      }

      const record = { meta, draft, publishedDefinition };
      this.cache.set(formId, record);
      if (meta.slug) this.slugIndex.set(meta.slug.toLowerCase(), formId);
      return record;
    } catch (err) {
      console.error(`[FormRepository] Failed to read form "${formId}":`, err.message);
      return null;
    }
  }

  async getFormBySlug(slug) {
    await this.init();
    if (!slug) return null;
    const normalized = slug.toLowerCase().trim();
    const formId = this.slugIndex.get(normalized);
    if (!formId) return null;
    return this.getFormById(formId);
  }

  /**
   * Saves or updates a form definition and its metadata.
   * If the form is currently published, this modifies only the draft.
   */
  async saveForm(formDef, metadataUpdates = {}) {
    await this.init();
    if (!formDef) {
      throw new Error('Form definition is required.');
    }

    const formId = formDef.id || `form_${Date.now()}_${generateSlugSuffix(6)}`;
    formDef.id = formId;

    const existing = await this.getFormById(formId);
    const now = new Date().toISOString();

    const formDir = path.join(this.rootDir, formId);
    if (!fs.existsSync(formDir)) {
      await fs.promises.mkdir(formDir, { recursive: true });
      await fs.promises.mkdir(path.join(formDir, 'versions'), { recursive: true });
    }

    let meta;
    if (existing) {
      // Retain existing slug unless explicitly changing or missing
      let slug = existing.meta.slug;
      if (metadataUpdates.slug && metadataUpdates.slug !== slug) {
        slug = this.ensureUniqueSlug(metadataUpdates.slug, formId);
      } else if (!slug) {
        slug = this.ensureUniqueSlug(formDef.title || formId, formId);
      }

      meta = {
        ...existing.meta,
        name: formDef.title || existing.meta.name,
        slug,
        primaryEntity: formDef.settings?.primaryEntity || null,
        updatedAt: now,
        ...metadataUpdates,
      };
    } else {
      const desiredSlug = metadataUpdates.slug || formDef.title || formId;
      const slug = this.ensureUniqueSlug(desiredSlug, formId);

      meta = {
        id: formId,
        name: formDef.title || 'Untitled Form',
        slug,
        status: 'draft',
        currentDraftVersion: 1,
        publishedVersion: null,
        createdAt: now,
        updatedAt: now,
        publishedAt: null,
        primaryEntity: formDef.settings?.primaryEntity || null,
        permissions: {
          canView: ['all'],
          canCreate: ['all'],
          canEdit: ['all'],
          canDesign: ['admin'],
          canPublish: ['admin'],
          anonymousAccess: true,
        },
        ...metadataUpdates,
      };
    }

    // Write meta.json and draft.json
    await fs.promises.writeFile(path.join(formDir, 'meta.json'), JSON.stringify(meta, null, 2), 'utf-8');
    await fs.promises.writeFile(path.join(formDir, 'draft.json'), JSON.stringify(formDef, null, 2), 'utf-8');

    // Also write legacy flat file for complete backward compatibility
    await fs.promises.writeFile(path.join(this.rootDir, `${formId}.json`), JSON.stringify(formDef, null, 2), 'utf-8');

    const publishedDefinition = existing?.publishedDefinition || null;
    const record = { meta, draft: formDef, publishedDefinition };

    // Update caches
    this.cache.set(formId, record);
    if (meta.slug) {
      this.slugIndex.set(meta.slug.toLowerCase(), formId);
    }

    return record;
  }

  /**
   * Creates an immutable published version snapshot and marks status = 'published'
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

    const formDir = path.join(this.rootDir, formId);
    const versionsDir = path.join(formDir, 'versions');
    if (!fs.existsSync(versionsDir)) {
      await fs.promises.mkdir(versionsDir, { recursive: true });
    }

    // Increment published version number
    const newVersion = (existing.meta.publishedVersion || 0) + 1;
    const versionFileName = `v${newVersion}.json`;
    const versionPath = path.join(versionsDir, versionFileName);

    const now = new Date().toISOString();

    // Freeze snapshot into immutable version file
    await fs.promises.writeFile(versionPath, JSON.stringify(definitionToPublish, null, 2), 'utf-8');

    // Update metadata
    const updatedMeta = {
      ...existing.meta,
      name: definitionToPublish.title || existing.meta.name,
      status: 'published',
      publishedVersion: newVersion,
      currentDraftVersion: newVersion + 1,
      publishedAt: now,
      updatedAt: now,
      primaryEntity: definitionToPublish.settings?.primaryEntity || null,
    };

    await fs.promises.writeFile(path.join(formDir, 'meta.json'), JSON.stringify(updatedMeta, null, 2), 'utf-8');

    const record = {
      meta: updatedMeta,
      draft: existing.draft,
      publishedDefinition: definitionToPublish,
    };

    this.cache.set(formId, record);
    this.slugIndex.set(updatedMeta.slug.toLowerCase(), formId);

    return {
      success: true,
      meta: updatedMeta,
      version: newVersion,
      slug: updatedMeta.slug,
      definition: definitionToPublish,
    };
  }

  /**
   * Changes status to 'unpublished'. The runtime URL will now return unavailable.
   */
  async unpublishForm(formId) {
    await this.init();
    const existing = await this.getFormById(formId);
    if (!existing) {
      throw new Error(`Form with id "${formId}" does not exist.`);
    }

    const now = new Date().toISOString();
    const updatedMeta = {
      ...existing.meta,
      status: 'unpublished',
      updatedAt: now,
    };

    const formDir = path.join(this.rootDir, formId);
    await fs.promises.writeFile(path.join(formDir, 'meta.json'), JSON.stringify(updatedMeta, null, 2), 'utf-8');

    const record = {
      ...existing,
      meta: updatedMeta,
    };

    this.cache.set(formId, record);
    return record;
  }

  /**
   * Changes status to 'archived'. Form is inactive but audit history remains.
   */
  async archiveForm(formId) {
    await this.init();
    const existing = await this.getFormById(formId);
    if (!existing) {
      throw new Error(`Form with id "${formId}" does not exist.`);
    }

    const now = new Date().toISOString();
    const updatedMeta = {
      ...existing.meta,
      status: 'archived',
      updatedAt: now,
    };

    const formDir = path.join(this.rootDir, formId);
    await fs.promises.writeFile(path.join(formDir, 'meta.json'), JSON.stringify(updatedMeta, null, 2), 'utf-8');

    const record = {
      ...existing,
      meta: updatedMeta,
    };

    this.cache.set(formId, record);
    return record;
  }

  /**
   * Retrieves the version history for a form
   */
  async getFormVersions(formId) {
    await this.init();
    const formDir = path.join(this.rootDir, formId, 'versions');
    if (!fs.existsSync(formDir)) return [];

    const files = await fs.promises.readdir(formDir);
    const versions = [];

    for (const file of files) {
      if (file.startsWith('v') && file.endsWith('.json')) {
        const versionNum = parseInt(file.replace('v', '').replace('.json', ''), 10);
        try {
          const stat = await fs.promises.stat(path.join(formDir, file));
          versions.push({
            versionNumber: versionNum,
            fileName: file,
            createdAt: stat.birthtime || stat.mtime,
          });
        } catch {
          // ignore
        }
      }
    }

    return versions.sort((a, b) => b.versionNumber - a.versionNumber);
  }

  /**
   * Retrieves a specific version's frozen definition
   */
  async getVersionDefinition(formId, versionNumber) {
    await this.init();
    const versionPath = path.join(this.rootDir, formId, 'versions', `v${versionNumber}.json`);
    if (!fs.existsSync(versionPath)) return null;

    try {
      const raw = await fs.promises.readFile(versionPath, 'utf-8');
      return JSON.parse(raw);
    } catch (err) {
      console.error(`[FormRepository] Failed to read version ${versionNumber} for "${formId}":`, err.message);
      return null;
    }
  }

  /**
   * Duplicates an existing form into a brand new independent draft form
   */
  async duplicateForm(sourceFormId) {
    await this.init();
    const source = await this.getFormById(sourceFormId);
    if (!source) {
      throw new Error(`Source form with id "${sourceFormId}" not found.`);
    }

    const baseDefinition = source.draft || source.publishedDefinition;
    if (!baseDefinition) {
      throw new Error(`Source form has no valid definition to duplicate.`);
    }

    const newFormId = `form_${Date.now()}_${generateSlugSuffix(6)}`;
    const newTitle = `${baseDefinition.title || 'Form'} (Copy)`;
    const newSlug = this.ensureUniqueSlug(newTitle, newFormId);

    // Deep clone definition and assign new ID and title
    const clonedDef = JSON.parse(JSON.stringify(baseDefinition));
    clonedDef.id = newFormId;
    clonedDef.title = newTitle;

    const saved = await this.saveForm(clonedDef, {
      name: newTitle,
      slug: newSlug,
      status: 'draft',
      currentDraftVersion: 1,
      publishedVersion: null,
      publishedAt: null,
    });

    return saved;
  }

  /**
   * Permanently deletes an unpublished or draft form.
   * Rejects with error if the form is currently published.
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

    // Delete directory structure server/data/forms/{formId}
    const formDir = path.join(this.rootDir, formId);
    if (fs.existsSync(formDir)) {
      await fs.promises.rm(formDir, { recursive: true, force: true });
    }

    // Delete legacy single-file format if present
    const legacyPath = path.join(this.rootDir, `${formId}.json`);
    if (fs.existsSync(legacyPath)) {
      await fs.promises.unlink(legacyPath).catch(() => {});
    }

    // Clean up memory cache and slug index
    this.cache.delete(formId);
    if (existing.meta?.slug) {
      this.slugIndex.delete(existing.meta.slug.toLowerCase());
    }

    return {
      success: true,
      message: `Form "${existing.meta?.name || formId}" has been deleted.`,
    };
  }
}

// Export singleton instance of FileFormRepository
export const formRepository = new FileFormRepository();
