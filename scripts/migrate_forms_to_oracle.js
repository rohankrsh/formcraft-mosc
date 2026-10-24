import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { executeQuery, withTransaction, initOraclePool, closeOraclePool } from '../server/database/oracle.js';
import { normalizeDepartmentAssignment } from '../server/services/departmentFilterService.js';

const FORMS_ROOT = path.resolve('server/data/forms');
const isDryRun = process.argv.includes('--dry-run');

/**
 * Creates a safety backup of server/data/forms before migration
 */
async function backupSourceFiles() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = path.resolve(`server/data/forms_backup_${timestamp}`);
  console.log(`[Migrate] Creating safety backup at ${backupDir}...`);
  await fs.promises.cp(FORMS_ROOT, backupDir, { recursive: true });
  console.log(`[Migrate] Backup completed successfully.`);
  return backupDir;
}

/**
 * Migration execution function
 */
async function migrateForms() {
  console.log(`=== FormCraft JSON to Oracle Migration ===`);
  console.log(`Mode: ${isDryRun ? 'DRY-RUN (Simulated, no writes)' : 'LIVE EXECUTION'}`);

  if (!fs.existsSync(FORMS_ROOT)) {
    console.error(`[Migrate] Forms root directory "${FORMS_ROOT}" not found!`);
    process.exit(1);
  }

  const pool = await initOraclePool();
  if (!pool) {
    console.error(`[Migrate] Cannot connect to Oracle database. Check credentials.`);
    process.exit(1);
  }

  let backupPath = null;
  if (!isDryRun) {
    backupPath = await backupSourceFiles();
  }

  const entries = await fs.promises.readdir(FORMS_ROOT, { withFileTypes: true });
  const formDirectories = entries.filter((e) => e.isDirectory());

  console.log(`[Migrate] Found ${formDirectories.length} form directories to process.`);

  const summary = {
    formsProcessed: 0,
    formsInserted: 0,
    formsExisting: 0,
    draftsInserted: 0,
    versionsInserted: 0,
    versionsSkipped: 0,
    departmentsInserted: 0,
    serviceCentersInserted: 0,
    errors: [],
  };

  for (const dir of formDirectories) {
    const formId = dir.name;
    const formDir = path.join(FORMS_ROOT, formId);
    const metaPath = path.join(formDir, 'meta.json');
    const draftPath = path.join(formDir, 'draft.json');
    const versionsDir = path.join(formDir, 'versions');

    summary.formsProcessed++;
    console.log(`\n------------------------------------------------------------`);
    console.log(`Processing Form: "${formId}"`);

    // 1. Read metadata
    let meta = null;
    if (fs.existsSync(metaPath)) {
      try {
        meta = JSON.parse(await fs.promises.readFile(metaPath, 'utf-8'));
      } catch (err) {
        console.error(`  [Error] Failed to parse ${metaPath}:`, err.message);
        summary.errors.push({ formId, step: 'parse_meta', error: err.message });
        continue;
      }
    } else {
      console.warn(`  [Warning] meta.json missing for "${formId}", synthesizing default meta.`);
      meta = {
        id: formId,
        name: formId,
        slug: formId,
        status: 'draft',
        currentDraftVersion: 1,
        publishedVersion: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    }

    // 2. Read draft
    let draft = null;
    if (fs.existsSync(draftPath)) {
      try {
        draft = JSON.parse(await fs.promises.readFile(draftPath, 'utf-8'));
      } catch (err) {
        console.error(`  [Error] Failed to parse ${draftPath}:`, err.message);
        summary.errors.push({ formId, step: 'parse_draft', error: err.message });
      }
    }

    // Fallback if draft is missing but flat file exists
    if (!draft) {
      const flatPath = path.join(FORMS_ROOT, `${formId}.json`);
      if (fs.existsSync(flatPath)) {
        try {
          draft = JSON.parse(await fs.promises.readFile(flatPath, 'utf-8'));
          console.log(`  [Notice] Loaded draft from legacy flat file: ${flatPath}`);
        } catch {}
      }
    }

    // 3. Scan version files
    const versionSnapshots = [];
    if (fs.existsSync(versionsDir)) {
      const vFiles = await fs.promises.readdir(versionsDir);
      for (const vFile of vFiles) {
        if (vFile.startsWith('v') && vFile.endsWith('.json')) {
          const vNumStr = vFile.slice(1, -5);
          const vNum = parseInt(vNumStr, 10);
          if (!isNaN(vNum)) {
            try {
              const vRaw = await fs.promises.readFile(path.join(versionsDir, vFile), 'utf-8');
              const vDef = JSON.parse(vRaw);
              versionSnapshots.push({
                versionNumber: vNum,
                definition: vDef,
                rawJson: vRaw,
              });
            } catch (err) {
              console.error(`  [Error] Failed to read version snapshot ${vFile}:`, err.message);
              summary.errors.push({ formId, step: `read_version_${vFile}`, error: err.message });
            }
          }
        }
      }
    }
    versionSnapshots.sort((a, b) => a.versionNumber - b.versionNumber);

    console.log(`  Metadata: Name="${meta.name}", Slug="${meta.slug}", Status="${meta.status}", PublishedV=${meta.publishedVersion}`);
    console.log(`  Draft Available: ${!!draft}`);
    console.log(`  Version Snapshots Found: ${versionSnapshots.map((v) => 'v' + v.versionNumber).join(', ') || 'None'}`);

    // Department normalization
    const deptNorm = normalizeDepartmentAssignment({
      departmentIds: meta.departmentIds || draft?.settings?.departmentIds,
      departmentNames: meta.departmentNames || draft?.settings?.departmentNames,
      departmentId: meta.departmentId || draft?.settings?.departmentId,
      departmentName: meta.departmentName || draft?.settings?.departmentName,
    });

    console.log(`  Departments: [${deptNorm.departmentIds.join(', ')}] (isShared: ${deptNorm.isShared})`);

    // Service Center normalization
    let serviceCenterIds = [];
    let serviceCenterNames = [];
    if (Array.isArray(meta.serviceCenterIds)) {
      serviceCenterIds = meta.serviceCenterIds;
    } else if (meta.serviceCenterId) {
      serviceCenterIds = [meta.serviceCenterId];
    } else if (draft?.settings?.serviceCenterId) {
      serviceCenterIds = [draft.settings.serviceCenterId];
    }

    if (Array.isArray(meta.serviceCenterNames)) {
      serviceCenterNames = meta.serviceCenterNames;
    } else if (meta.serviceCenterName) {
      serviceCenterNames = [meta.serviceCenterName];
    } else if (draft?.settings?.serviceCenterName) {
      serviceCenterNames = [draft.settings.serviceCenterName];
    }

    if (isDryRun) {
      console.log(`  [Dry-Run] Would migrate form "${formId}" with ${versionSnapshots.length} versions to Oracle.`);
      summary.formsInserted++;
      if (draft) summary.draftsInserted++;
      summary.versionsInserted += versionSnapshots.length;
      summary.departmentsInserted += deptNorm.departmentIds.length;
      summary.serviceCentersInserted += serviceCenterIds.length;
      continue;
    }

    // LIVE MIGRATION IN TRANSACTION
    try {
      await withTransaction(async (conn) => {
        // A. Insert/Update FORMCRAFT_FORMS
        const checkSql = "SELECT ID, CURRENT_DRAFT_REVISION, PUBLISHED_VERSION FROM FORMCRAFT_FORMS WHERE ID = :id";
        const checkRes = await conn.execute(checkSql, { id: formId });

        const createdAt = meta.createdAt ? new Date(meta.createdAt) : new Date();
        const updatedAt = meta.updatedAt ? new Date(meta.updatedAt) : new Date();
        const publishedVersion = meta.publishedVersion || null;
        const currentDraftRevision = meta.currentDraftVersion || 1;
        const primaryEntity = meta.primaryEntity || draft?.settings?.primaryEntity || null;

        if (checkRes.rows && checkRes.rows.length > 0) {
          console.log(`  [Notice] Form "${formId}" already exists in FORMCRAFT_FORMS. Updating metadata...`);
          summary.formsExisting++;
          const updateSql = `
            UPDATE FORMCRAFT_FORMS
            SET NAME = :name,
                SLUG = :slug,
                STATUS = :status,
                CURRENT_DRAFT_REVISION = :draftRev,
                PUBLISHED_VERSION = :pubVer,
                PRIMARY_ENTITY = :primaryEntity,
                UPDATED_AT = :updatedAt
            WHERE ID = :id
          `;
          await conn.execute(updateSql, {
            name: meta.name || formId,
            slug: meta.slug || formId,
            status: meta.status || 'draft',
            draftRev: currentDraftRevision,
            pubVer: publishedVersion,
            primaryEntity,
            updatedAt,
            id: formId,
          });
        } else {
          console.log(`  [Action] Inserting form "${formId}" into FORMCRAFT_FORMS...`);
          const insertSql = `
            INSERT INTO FORMCRAFT_FORMS (
              ID, NAME, SLUG, STATUS, CURRENT_DRAFT_REVISION,
              PUBLISHED_VERSION, PRIMARY_ENTITY, CREATED_AT, UPDATED_AT
            ) VALUES (
              :id, :name, :slug, :status, :draftRev,
              :pubVer, :primaryEntity, :createdAt, :updatedAt
            )
          `;
          await conn.execute(insertSql, {
            id: formId,
            name: meta.name || formId,
            slug: meta.slug || formId,
            status: meta.status || 'draft',
            draftRev: currentDraftRevision,
            pubVer: publishedVersion,
            primaryEntity,
            createdAt,
            updatedAt,
          });
          summary.formsInserted++;
        }

        // B. Insert/Update FORMCRAFT_FORM_DRAFTS
        if (draft) {
          const draftJson = JSON.stringify(draft);
          const draftCheck = await conn.execute("SELECT FORM_ID FROM FORMCRAFT_FORM_DRAFTS WHERE FORM_ID = :id", { id: formId });
          if (draftCheck.rows && draftCheck.rows.length > 0) {
            console.log(`  [Notice] Updating existing draft for "${formId}"...`);
            await conn.execute(`
              UPDATE FORMCRAFT_FORM_DRAFTS
              SET DEFINITION_JSON = :defJson,
                  REVISION_NUMBER = :revNum,
                  UPDATED_AT = :updatedAt
              WHERE FORM_ID = :id
            `, {
              defJson: draftJson,
              revNum: currentDraftRevision,
              updatedAt,
              id: formId,
            });
          } else {
            console.log(`  [Action] Inserting draft for "${formId}"...`);
            await conn.execute(`
              INSERT INTO FORMCRAFT_FORM_DRAFTS (
                FORM_ID, REVISION_NUMBER, DEFINITION_JSON, UPDATED_AT
              ) VALUES (
                :id, :revNum, :defJson, :updatedAt
              )
            `, {
              id: formId,
              revNum: currentDraftRevision,
              defJson: draftJson,
              updatedAt,
            });
            summary.draftsInserted++;
          }
        }

        // C. Insert Published Version Snapshots
        for (const vSnap of versionSnapshots) {
          const vCheck = await conn.execute(
            "SELECT ID FROM FORMCRAFT_FORM_VERSIONS WHERE FORM_ID = :id AND VERSION_NUMBER = :vNum",
            { id: formId, vNum: vSnap.versionNumber }
          );

          if (vCheck.rows && vCheck.rows.length > 0) {
            console.log(`  [Notice] Version v${vSnap.versionNumber} already in FORMCRAFT_FORM_VERSIONS. Skipping.`);
            summary.versionsSkipped++;
          } else {
            console.log(`  [Action] Inserting version v${vSnap.versionNumber} snapshot into FORMCRAFT_FORM_VERSIONS...`);
            await conn.execute(`
              INSERT INTO FORMCRAFT_FORM_VERSIONS (
                FORM_ID, VERSION_NUMBER, DEFINITION_JSON, PUBLISHED_AT, PUBLISHED_BY, CHANGE_SUMMARY
              ) VALUES (
                :id, :vNum, :defJson, :pubAt, :pubBy, :summary
              )
            `, {
              id: formId,
              vNum: vSnap.versionNumber,
              defJson: vSnap.rawJson,
              pubAt: updatedAt,
              pubBy: 'Migration Utility',
              summary: `Migrated from filesystem v${vSnap.versionNumber}.json`,
            });
            summary.versionsInserted++;
          }
        }

        // D. Insert Department Mappings
        await conn.execute("DELETE FROM FORMCRAFT_FORM_DEPARTMENTS WHERE FORM_ID = :id", { id: formId });
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
          summary.departmentsInserted++;
        }

        // E. Insert Service Center Mappings
        await conn.execute("DELETE FROM FORMCRAFT_FORM_SERVICE_CENTERS WHERE FORM_ID = :id", { id: formId });
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
          summary.serviceCentersInserted++;
        }
      });

      console.log(`  [Success] Form "${formId}" successfully committed to Oracle.`);
    } catch (dbErr) {
      console.error(`  [Error] Failed to persist "${formId}" to Oracle:`, dbErr.message);
      summary.errors.push({ formId, step: 'db_transaction', error: dbErr.message });
    }
  }

  console.log(`\n============================================================`);
  console.log(`MIGRATION SUMMARY REPORT:`);
  console.log(`Forms processed:            ${summary.formsProcessed}`);
  console.log(`Forms inserted:             ${summary.formsInserted}`);
  console.log(`Forms existing:             ${summary.formsExisting}`);
  console.log(`Drafts inserted:            ${summary.draftsInserted}`);
  console.log(`Version snapshots inserted: ${summary.versionsInserted}`);
  console.log(`Version snapshots skipped:  ${summary.versionsSkipped}`);
  console.log(`Department mappings saved:  ${summary.departmentsInserted}`);
  console.log(`Service Center mappings:    ${summary.serviceCentersInserted}`);
  console.log(`Errors encountered:         ${summary.errors.length}`);
  if (summary.errors.length > 0) {
    console.error(`Errors list:`, summary.errors);
  }
  if (backupPath) {
    console.log(`Original JSON backup kept at: ${backupPath}`);
  }
  console.log(`============================================================\n`);

  // Verification step
  if (!isDryRun && summary.errors.length === 0) {
    console.log(`[Verification] Validating Oracle stored records...`);
    const countForms = await executeQuery("SELECT COUNT(*) AS CNT FROM FORMCRAFT_FORMS");
    const countDrafts = await executeQuery("SELECT COUNT(*) AS CNT FROM FORMCRAFT_FORM_DRAFTS");
    const countVersions = await executeQuery("SELECT COUNT(*) AS CNT FROM FORMCRAFT_FORM_VERSIONS");
    const countDepts = await executeQuery("SELECT COUNT(*) AS CNT FROM FORMCRAFT_FORM_DEPARTMENTS");
    console.log(`Oracle Verification Counts:`, {
      forms: countForms.rows[0].CNT,
      drafts: countDrafts.rows[0].CNT,
      versions: countVersions.rows[0].CNT,
      departments: countDepts.rows[0].CNT,
    });
  }

  await closeOraclePool();
}

migrateForms().catch((e) => {
  console.error('[Migrate] Fatal unhandled error:', e);
  process.exit(1);
});
