import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { formRepository } from '../server/repositories/formRepository.js';
import { executeQuery } from '../server/database/oracle.js';

async function runIndependenceTest() {
  console.log('======================================================');
  console.log('PHASE NINE: ORACLE PERSISTENCE INDEPENDENCE VERIFICATION');
  console.log('======================================================');

  const formsDir = path.resolve('server/data/forms');
  const tempDisabledDir = path.resolve('server/data/forms_disabled_for_test');

  const formsExisted = fs.existsSync(formsDir);
  if (formsExisted) {
    console.log(`[Independence Test] Renaming "${formsDir}" -> "${tempDisabledDir}"...`);
    fs.renameSync(formsDir, tempDisabledDir);
  }

  try {
    // Confirm forms directory does not exist
    if (fs.existsSync(formsDir)) {
      throw new Error('Failed to disable server/data/forms directory.');
    }
    console.log('[Independence Test] Confirmed: server/data/forms is completely inaccessible.');

    // 1. List Forms from Oracle
    console.log('\n--- 1. Testing listForms() purely from Oracle ---');
    const forms = await formRepository.listForms();
    console.log(`Found ${forms.length} forms in Oracle:`);
    for (const f of forms) {
      console.log(`  - [${f.id}] "${f.name}" (status: ${f.status}, draftRev: ${f.currentDraftVersion}, pubVer: ${f.publishedVersion}, depts: ${f.departmentNames?.join(', ') || 'None'})`);
    }
    if (forms.length < 4) {
      throw new Error(`Expected at least 4 forms in Oracle, found ${forms.length}`);
    }

    // 2. Test getFormById() for each form to ensure draft & published definitions load from Oracle CLOBs
    console.log('\n--- 2. Testing getFormById() draft and published definitions from Oracle ---');
    for (const f of forms) {
      const full = await formRepository.getFormById(f.id);
      if (!full) throw new Error(`Form ${f.id} could not be retrieved from Oracle.`);
      const draftFields = Object.keys(full.draft?.fields || {}).length;
      const pubFields = Object.keys(full.publishedDefinition?.fields || {}).length;
      console.log(`  - Form [${f.id}]: draft fields = ${draftFields}, published fields = ${pubFields}`);
      if (f.status === 'published' && f.publishedVersion && pubFields === 0) {
        throw new Error(`Published form ${f.id} returned 0 published fields from Oracle!`);
      }
    }

    // 3. Test getVersionDefinition() for immutable historical versions from Oracle
    console.log('\n--- 3. Testing getVersionDefinition() immutable versions from Oracle ---');
    const vRes = await executeQuery('SELECT COUNT(*) AS CNT FROM FORMCRAFT_FORM_VERSIONS');
    const versionCount = vRes.rows[0].CNT;
    console.log(`Oracle FORMCRAFT_FORM_VERSIONS count: ${versionCount}`);
    if (versionCount < 14) {
      throw new Error(`Expected at least 14 version records in Oracle, found ${versionCount}`);
    }

    const testV7 = await formRepository.getVersionDefinition('mosc_initial_nursing_assessment', 7);
    if (!testV7 || Object.keys(testV7.fields || {}).length !== 107) {
      throw new Error(`Failed to load version 7 for mosc_initial_nursing_assessment from Oracle!`);
    }
    console.log(`  - mosc_initial_nursing_assessment v7 verified: ${Object.keys(testV7.fields).length} fields`);

    const testV4 = await formRepository.getVersionDefinition('anaesthesia_procedural_docket', 4);
    if (!testV4 || Object.keys(testV4.fields || {}).length !== 88) {
      throw new Error(`Failed to load version 4 for anaesthesia_procedural_docket from Oracle!`);
    }
    console.log(`  - anaesthesia_procedural_docket v4 verified: ${Object.keys(testV4.fields).length} fields`);

    // 4. Test HTTP API calls against the live server
    console.log('\n--- 4. Testing Live HTTP APIs with server/data/forms disabled ---');
    const formsHttp = await fetch('http://localhost:3001/api/forms').then(r => r.json());
    console.log(`  - GET /api/forms returned ${formsHttp.data?.length} forms`);
    if (!formsHttp.success || formsHttp.data?.length < 4) {
      throw new Error('GET /api/forms failed while forms directory was disabled.');
    }

    const deployedHttp = await fetch('http://localhost:3001/api/deployed-forms').then(r => r.json());
    console.log(`  - GET /api/deployed-forms returned ${deployedHttp.forms?.length} deployed forms`);
    if (!deployedHttp.success || deployedHttp.forms?.length < 2) {
      throw new Error('GET /api/deployed-forms failed while forms directory was disabled.');
    }

    const runtimeHttp = await fetch('http://localhost:3001/api/runtime/forms/mosc_initial_nursing_assessment').then(r => r.json());
    console.log(`  - GET /api/runtime/forms/mosc_initial_nursing_assessment returned: title="${runtimeHttp.form?.title}", fields=${Object.keys(runtimeHttp.form?.definition?.fields || {}).length}`);
    if (!runtimeHttp.success || Object.keys(runtimeHttp.form?.definition?.fields || {}).length !== 107) {
      throw new Error('GET /api/runtime/forms failed while forms directory was disabled.');
    }

    // 5. Test Historical Submissions API
    console.log('\n--- 5. Testing Historical Patient Submissions API with server/data/forms disabled ---');
    const subListHttp = await fetch('http://localhost:3001/api/patients/1754666/submitted-forms').then(r => r.json());
    console.log(`  - Patient 1754666 submissions count: ${subListHttp.submissions?.length}`);
    if (subListHttp.submissions?.length === 0) {
      throw new Error('Patient submissions could not be retrieved from Oracle.');
    }

    const sampleSub = subListHttp.submissions[0];
    const subDetailHttp = await fetch(`http://localhost:3001/api/patients/1754666/submitted-forms/${sampleSub.id}`).then(r => r.json());
    console.log(`  - Submission #${sampleSub.id} detail: formVersion=${subDetailHttp.submission?.formVersion}, formFields=${Object.keys(subDetailHttp.form?.fields || {}).length}, dataFields=${Object.keys(subDetailHttp.submission?.formData || {}).length}`);
    if (!subDetailHttp.success || Object.keys(subDetailHttp.form?.fields || {}).length === 0) {
      throw new Error('Submission detail failed to reconstruct form schema from Oracle version snapshot.');
    }

    console.log('\n======================================================');
    console.log('SUCCESS: All persistence verification tests passed with 100% independence from local JSON files!');
    console.log('======================================================');
  } finally {
    // Restore directory
    if (formsExisted && fs.existsSync(tempDisabledDir)) {
      console.log(`\n[Independence Test Cleanup] Restoring "${tempDisabledDir}" -> "${formsDir}"...`);
      fs.renameSync(tempDisabledDir, formsDir);
      console.log('[Independence Test Cleanup] Original directory restored successfully.');
    }
  }
}

runIndependenceTest().then(() => {
  process.exit(0);
}).catch(err => {
  console.error('[Independence Test FATAL ERROR]:', err);
  process.exit(1);
});
