import assert from 'assert';

const BASE_URL = 'http://localhost:3001';

async function request(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': 'formcraft_secret_key_2026',
      ...(options.headers || {}),
    },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, ok: res.ok, data };
}

async function runTests() {
  console.log('=== Starting FormCraft Publishing & Runtime System Tests ===\n');

  // 1. List forms
  console.log('1. Testing GET /api/forms (List forms)...');
  const listRes = await request('/api/forms');
  assert.strictEqual(listRes.status, 200, 'List forms must return 200');
  assert.ok(Array.isArray(listRes.data.data), 'data must be array of forms');
  console.log(`✓ Found ${listRes.data.data.length} forms in repository.`);

  // 2. Create a test form
  console.log('\n2. Testing POST /api/forms (Create Draft Form)...');
  const testFormId = `test_pub_${Date.now()}`;
  const testForm = {
    id: testFormId,
    version: '1.0.0',
    title: 'Patient Registration Form',
    description: 'A test form for patient intake and registration',
    settings: {
      submitButtonText: 'Register Patient',
      submitAction: 'download_json',
      showResetButton: true,
      primaryEntity: 'PATIENT',
      primaryKeyColumn: 'PATIENT_ID',
      enableFetchRecord: true,
      theme: {
        primaryColor: '#2563eb',
        borderRadius: 'lg',
        fontFamily: 'Inter',
      },
    },
    fields: {
      fld_mrn: {
        id: 'fld_mrn',
        name: 'patient_id',
        type: 'number',
        label: 'Patient MRN',
        dataBinding: {
          source: 'oracle',
          table: 'PATIENT',
          column: 'PATIENT_ID',
          mode: 'read-write',
          oracleType: 'NUMBER',
        },
        validation: { required: true },
      },
      fld_name: {
        id: 'fld_name',
        name: 'first_name',
        type: 'text',
        label: 'First Name',
        dataBinding: {
          source: 'oracle',
          table: 'PATIENT',
          column: 'FIRST_NAME',
          mode: 'read-write',
          oracleType: 'STRING',
        },
        validation: { required: true, minLength: 2 },
      },
      fld_gender: {
        id: 'fld_gender',
        name: 'gender',
        type: 'select',
        label: 'Gender',
        dataBinding: {
          source: 'oracle',
          table: 'PATIENT',
          column: 'GENDER',
          mode: 'read-write',
          oracleType: 'STRING',
        },
        options: [
          { label: 'Male', value: 'M' },
          { label: 'Female', value: 'F' },
        ],
      },
    },
    layout: [
      {
        id: 'sec_1',
        title: 'Patient Demographics',
        enableFetchRecord: true,
        rows: [
          {
            id: 'row_1',
            columns: [
              { id: 'col_1', width: 4, fieldIds: ['fld_mrn'] },
              { id: 'col_2', width: 4, fieldIds: ['fld_name'] },
              { id: 'col_3', width: 4, fieldIds: ['fld_gender'] },
            ],
          },
        ],
      },
    ],
  };

  const saveRes = await request('/api/forms', {
    method: 'POST',
    body: JSON.stringify(testForm),
  });
  assert.strictEqual(saveRes.status, 200, 'Save form must return 200');
  assert.ok(saveRes.data.success, 'Save form must succeed');
  assert.ok(saveRes.data.meta.slug, 'Must assign a unique slug');
  const slug = saveRes.data.meta.slug;
  console.log(`✓ Form created with ID: "${testFormId}", slug: "${slug}"`);

  // 3. Verify Draft is NOT yet accessible via runtime
  console.log('\n3. Verifying Draft is not accessible via public runtime route...');
  const runtimeDraftRes = await request(`/api/runtime/forms/${slug}`);
  assert.strictEqual(runtimeDraftRes.status, 404, 'Draft form must return 404 on runtime route');
  console.log(`✓ Runtime correctly returned 404 for draft: "${runtimeDraftRes.data.error}"`);

  // 4. Test Pre-flight Validation
  console.log('\n4. Testing Pre-flight Validation (POST /api/forms/:id/validate)...');
  const valRes = await request(`/api/forms/${testFormId}/validate`, { method: 'POST' });
  assert.strictEqual(valRes.status, 200, 'Validate must return 200');
  assert.strictEqual(valRes.data.validation.valid, true, 'Valid form must pass validation');
  console.log(`✓ Validation passed with ${valRes.data.validation.summary.totalFields} fields, Oracle available: ${valRes.data.validation.summary.oracleAvailable}`);

  // 5. Test Pre-flight Validation with Invalid Column Width (e.g. 10 instead of 12)
  console.log('\n5. Testing Validation Failure on invalid column widths (e.g. sum=10 instead of 12)...');
  const invalidForm = JSON.parse(JSON.stringify(testForm));
  invalidForm.layout[0].rows[0].columns[0].width = 2; // total width now 2+4+4 = 10
  const invalidValRes = await request(`/api/forms/${testFormId}/validate`, {
    method: 'POST',
    body: JSON.stringify({ definition: invalidForm }),
  });
  assert.strictEqual(invalidValRes.data.validation.valid, false, 'Should fail validation when widths do not sum to 12');
  console.log(`✓ Correctly caught layout error: "${invalidValRes.data.validation.issues[0].message}"`);

  // 6. Test Publishing Form
  console.log('\n6. Testing Form Publishing (POST /api/forms/:id/publish)...');
  const pubRes = await request(`/api/forms/${testFormId}/publish`, { method: 'POST' });
  assert.strictEqual(pubRes.status, 200, 'Publish must return 200');
  assert.strictEqual(pubRes.data.version, 1, 'First published version must be 1');
  assert.ok(pubRes.data.runtimeUrl, 'Must return runtime URL');
  console.log(`✓ Form successfully published as v1! Runtime URL: ${pubRes.data.runtimeUrl}`);

  // 7. Test Runtime Access for Published Form
  console.log('\n7. Testing GET /api/runtime/forms/:slug...');
  const runtimeRes = await request(`/api/runtime/forms/${slug}`);
  assert.strictEqual(runtimeRes.status, 200, 'Runtime must return 200 for published form');
  assert.strictEqual(runtimeRes.data.form.version, 1, 'Runtime form version must be 1');
  assert.strictEqual(runtimeRes.data.form.slug, slug, 'Runtime form slug must match');
  assert.ok(runtimeRes.data.form.definition.fields.fld_mrn, 'Definition must include fields');
  console.log(`✓ Runtime served published form definition v${runtimeRes.data.form.version}!`);

  // 8. Test Immutability: Modify Draft in Builder, verify Runtime continues serving v1
  console.log('\n8. Testing Immutability: Editing draft must NOT affect published runtime v1...');
  const modifiedDraft = JSON.parse(JSON.stringify(testForm));
  modifiedDraft.title = 'Patient Registration - DRAFT MODIFICATION';
  modifiedDraft.fields.fld_name.label = 'Patient Full Name (Draft)';

  await request('/api/forms', {
    method: 'POST',
    body: JSON.stringify(modifiedDraft),
  });

  // Verify builder sees the draft modification
  const builderRes = await request(`/api/forms/${testFormId}`);
  assert.strictEqual(builderRes.data.data.title, 'Patient Registration - DRAFT MODIFICATION', 'Builder sees updated draft');

  // Verify runtime still serves frozen v1 snapshot
  const runtimeStillV1 = await request(`/api/runtime/forms/${slug}`);
  assert.strictEqual(runtimeStillV1.data.form.title, 'Patient Registration Form', 'Runtime title must remain v1');
  assert.strictEqual(runtimeStillV1.data.form.definition.fields.fld_name.label, 'First Name', 'Runtime field label must remain v1');
  console.log('✓ Immutability verified: Runtime continued serving frozen v1 while draft was being edited!');

  // 9. Publish v2 and verify Runtime now serves v2
  console.log('\n9. Testing Republish (Publishing v2)...');
  const pubV2Res = await request(`/api/forms/${testFormId}/publish`, { method: 'POST' });
  assert.strictEqual(pubV2Res.status, 200, 'Publish v2 must return 200');
  assert.strictEqual(pubV2Res.data.version, 2, 'Version must increment to 2');

  const runtimeV2 = await request(`/api/runtime/forms/${slug}`);
  assert.strictEqual(runtimeV2.data.form.version, 2, 'Runtime must now serve v2');
  assert.strictEqual(runtimeV2.data.form.title, 'Patient Registration - DRAFT MODIFICATION', 'Runtime title updated to v2');
  console.log('✓ Republishing verified: Runtime updated to v2 cleanly.');

  // 10. Test Runtime Oracle Record Fetch (Fetch Record using MRN: 473585)
  console.log('\n10. Testing Runtime Oracle Record Fetch: GET /api/runtime/forms/:slug/data/473585...');
  const fetchRes = await request(`/api/runtime/forms/${slug}/data/473585`);
  if (fetchRes.status === 200) {
    console.log('✓ Runtime fetched Oracle record:', fetchRes.data.data);
    assert.ok(fetchRes.data.data.patient_id !== undefined || fetchRes.data.data.fld_mrn !== undefined, 'Record data received');
  } else {
    console.log(`(Oracle record fetch returned status ${fetchRes.status}: ${fetchRes.data.error})`);
  }

  // 11. Test Form Duplication
  console.log('\n11. Testing Form Duplication (POST /api/forms/:id/duplicate)...');
  const dupRes = await request(`/api/forms/${testFormId}/duplicate`, { method: 'POST' });
  assert.strictEqual(dupRes.status, 201, 'Duplicate must return 201');
  assert.notStrictEqual(dupRes.data.meta.id, testFormId, 'New form must have new ID');
  assert.notStrictEqual(dupRes.data.meta.slug, slug, 'New form must have new unique slug');
  assert.strictEqual(dupRes.data.meta.status, 'draft', 'Duplicated form must start in draft status');
  console.log(`✓ Duplicated form created: ID "${dupRes.data.meta.id}", slug "${dupRes.data.meta.slug}"`);

  // 12. Test Unpublish
  console.log('\n12. Testing Unpublish (POST /api/forms/:id/unpublish)...');
  const unpubRes = await request(`/api/forms/${testFormId}/unpublish`, { method: 'POST' });
  assert.strictEqual(unpubRes.status, 200, 'Unpublish must return 200');

  const runtimeUnpub = await request(`/api/runtime/forms/${slug}`);
  assert.strictEqual(runtimeUnpub.status, 403, 'Unpublished form must return 403');
  assert.strictEqual(runtimeUnpub.data.code, 'FORM_UNAVAILABLE', 'Must return code FORM_UNAVAILABLE');
  console.log(`✓ Unpublish verified: Runtime returned friendly message: "${runtimeUnpub.data.error}"`);

  console.log('\n=======================================================');
  console.log('🎉 ALL 12 PUBLISHING & RUNTIME BACKEND TESTS PASSED! 🎉');
  console.log('=======================================================\n');
}

runTests().catch((err) => {
  console.error('\n❌ Test failed with error:', err);
  process.exit(1);
});
