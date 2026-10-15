import assert from 'assert';

const BASE_URL = 'http://localhost:3001';
const AUTH_KEY = 'formcraft_secret_key_2026';

function logPass(msg) {
  console.log(`✅ [PASS] ${msg}`);
}

function logFail(msg, err) {
  console.error(`❌ [FAIL] ${msg}:`, err);
}

async function request(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const { headers, ...restOptions } = options;
  const res = await fetch(url, {
    ...restOptions,
    headers: {
      'Content-Type': 'application/json',
      ...(headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, ok: res.ok, data, headers: res.headers };
}

async function runTestSuite() {
  console.log('======================================================================');
  console.log('🧪 FORMCRAFT MULTI-DEPARTMENT ASSIGNMENT & ACCESS CONTROL TEST SUITE');
  console.log('======================================================================\n');

  let passed = 0;
  let failed = 0;

  async function check(name, fn) {
    try {
      await fn();
      logPass(name);
      passed++;
    } catch (err) {
      logFail(name, err.message);
      failed++;
    }
  }

  const multiDeptFormId = `test_multidept_${Date.now()}`;
  const legacyDeptFormId = `test_legacy_${Date.now()}`;
  const sharedFormId = `test_shared_${Date.now()}`;
  let multiDeptSlug = '';
  let legacySlug = '';
  let sharedSlug = '';

  console.log('--- 1. Multi-Department Form Creation & Draft Persistence ---');

  // Scenario 1: Create a form and assign Cardiology, Neurology, and Oncology
  await check('1. Create draft form with Cardiology, Neurology, and Oncology assignments', async () => {
    const formDef = {
      id: multiDeptFormId,
      version: '1.0.0',
      title: 'Tri-Department Clinical Assessment',
      description: 'Shared between Cardiology, Neurology, and Oncology',
      settings: {
        submitButtonText: 'Submit Assessment',
        submitAction: 'download_json',
        showResetButton: true,
        patientFormMode: 'NEW_RECORD',
        departmentIds: ['51', '63', '999'],
        departmentNames: ['CARDIOLOGY', 'NEUROLOGY', 'ONCOLOGY'],
      },
      fields: {
        fld_symptom: {
          id: 'fld_symptom',
          name: 'symptom',
          type: 'text',
          label: 'Chief Symptom',
          validation: { required: true },
        },
      },
      layout: [
        {
          id: 'sec_1',
          title: 'Symptoms',
          rows: [
            {
              id: 'row_1',
              columns: [{ id: 'col_1', width: 12, fieldIds: ['fld_symptom'] }],
            },
          ],
        },
      ],
    };

    const res = await request('/api/forms', {
      method: 'POST',
      headers: { 'x-api-key': AUTH_KEY },
      body: JSON.stringify(formDef),
    });

    assert.strictEqual(res.status, 200, `Expected 200, got ${res.status}`);
    assert.strictEqual(res.data.success, true);
    assert.deepStrictEqual(res.data.data.settings.departmentIds, ['51', '63', '999']);
    assert.deepStrictEqual(res.data.data.settings.departmentNames, ['CARDIOLOGY', 'NEUROLOGY', 'ONCOLOGY']);
    multiDeptSlug = res.data.meta.slug;
    assert.ok(multiDeptSlug, 'Expected generated slug');
  });

  // Scenario 2: Save the draft and confirm all three assignments persist
  await check('2. Confirm draft persistence of all 3 department assignments in repository', async () => {
    const res = await request(`/api/forms/${multiDeptFormId}`, {
      headers: { 'x-api-key': AUTH_KEY },
    });
    assert.strictEqual(res.status, 200);
    const draft = res.data.data;
    assert.deepStrictEqual(draft.settings.departmentIds, ['51', '63', '999']);
    assert.deepStrictEqual(draft.settings.departmentNames, ['CARDIOLOGY', 'NEUROLOGY', 'ONCOLOGY']);
    assert.deepStrictEqual(res.data.meta.departmentIds, ['51', '63', '999']);
  });

  // Scenario 3: Reopen the draft and verify selections are restored
  await check('3. Reopen draft and verify multi-department selections are restored', async () => {
    const res = await request(`/api/forms/${multiDeptFormId}`);
    assert.strictEqual(res.status, 200);
    const { data: reopened, meta } = res.data;
    assert.strictEqual(reopened.id, multiDeptFormId);
    assert.strictEqual(reopened.settings.departmentIds.length, 3);
    assert(reopened.settings.departmentIds.includes('51'), 'Contains 51 (Cardiology)');
    assert(reopened.settings.departmentIds.includes('63'), 'Contains 63 (Neurology)');
    assert(reopened.settings.departmentIds.includes('999'), 'Contains 999 (Oncology)');
    // Verify legacy compatibility fields are also populated
    assert.ok(reopened.settings.departmentId, 'Legacy departmentId is populated');
    assert.ok(reopened.settings.departmentName, 'Legacy departmentName is populated');
  });

  // Scenario 4: Publish the form and verify assignments remain intact
  await check('4. Publish form and verify assignments remain intact in frozen version & metadata', async () => {
    const res = await request(`/api/forms/${multiDeptFormId}/publish`, {
      method: 'POST',
      headers: { 'x-api-key': AUTH_KEY },
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);
    assert.strictEqual(res.data.version, 1);
    assert.deepStrictEqual(res.data.meta.departmentIds, ['51', '63', '999']);
    assert.deepStrictEqual(res.data.meta.departmentNames, ['CARDIOLOGY', 'NEUROLOGY', 'ONCOLOGY']);
  });

  console.log('\n--- 2. Multi-Department Visibility & OR Matching ---');

  // Scenario 5: A Cardiology user sees the form
  await check('5. Cardiology user sees the published form in deployed list and runtime', async () => {
    const deployedRes = await request('/api/deployed-forms?department=CARDIOLOGY');
    assert.strictEqual(deployedRes.status, 200);
    const found = deployedRes.data.forms.find((f) => f.id === multiDeptFormId);
    assert.ok(found, 'Form must be visible to CARDIOLOGY');
    assert.deepStrictEqual(found.departmentIds, ['51', '63', '999']);

    // Access by ID '51'
    const deployedByIdRes = await request('/api/deployed-forms?departmentId=51');
    const foundById = deployedByIdRes.data.forms.find((f) => f.id === multiDeptFormId);
    assert.ok(foundById, 'Form must be visible by numeric ID 51');

    // Runtime access with Cardiology context
    const runtimeRes = await request(`/api/runtime/forms/${multiDeptSlug}?department=CARDIOLOGY`);
    assert.strictEqual(runtimeRes.status, 200, 'Cardiology user can access runtime form');
    assert.strictEqual(runtimeRes.data.success, true);
  });

  // Scenario 6: A Neurology user sees the same form
  await check('6. Neurology user sees the same form in deployed list and runtime', async () => {
    const deployedRes = await request('/api/deployed-forms?department=NEUROLOGY');
    assert.strictEqual(deployedRes.status, 200);
    const found = deployedRes.data.forms.find((f) => f.id === multiDeptFormId);
    assert.ok(found, 'Form must be visible to NEUROLOGY');

    // Access by numeric ID 63
    const deployedByIdRes = await request('/api/deployed-forms?departmentId=63');
    const foundById = deployedByIdRes.data.forms.find((f) => f.id === multiDeptFormId);
    assert.ok(foundById, 'Form must be visible by numeric ID 63');

    // Runtime access with Neurology context
    const runtimeRes = await request(`/api/runtime/forms/${multiDeptSlug}?department=NEUROLOGY`);
    assert.strictEqual(runtimeRes.status, 200, 'Neurology user can access runtime form');
  });

  // Scenario 7: An Oncology user sees the same form
  await check('7. Oncology user sees the same form in deployed list and runtime', async () => {
    const deployedRes = await request('/api/deployed-forms?department=ONCOLOGY');
    assert.strictEqual(deployedRes.status, 200);
    const found = deployedRes.data.forms.find((f) => f.id === multiDeptFormId);
    assert.ok(found, 'Form must be visible to ONCOLOGY');

    const runtimeRes = await request(`/api/runtime/forms/${multiDeptSlug}?department=ONCOLOGY`);
    assert.strictEqual(runtimeRes.status, 200, 'Oncology user can access runtime form');
  });

  // Scenario 8: An Orthopedics user does NOT see the form
  await check('8. Orthopedics & Dermatology users do NOT see the form', async () => {
    // Orthopedics check
    const deployedOrtho = await request('/api/deployed-forms?department=ORTHOPAEDICS');
    assert.strictEqual(deployedOrtho.status, 200);
    const foundOrtho = deployedOrtho.data.forms.find((f) => f.id === multiDeptFormId);
    assert.strictEqual(foundOrtho, undefined, 'Form must NOT be visible to ORTHOPAEDICS');

    const runtimeOrtho = await request(`/api/runtime/forms/${multiDeptSlug}?department=ORTHOPAEDICS`);
    assert.strictEqual(runtimeOrtho.status, 403, 'Runtime access must be 403 Forbidden for Orthopedics');
    assert.strictEqual(runtimeOrtho.data.code, 'DEPARTMENT_ACCESS_DENIED');

    // Dermatology check (ID: 53)
    const deployedDerm = await request('/api/deployed-forms?department=53');
    const foundDerm = deployedDerm.data.forms.find((f) => f.id === multiDeptFormId);
    assert.strictEqual(foundDerm, undefined, 'Form must NOT be visible to DERMATOLOGY');

    const runtimeDerm = await request(`/api/runtime/forms/${multiDeptSlug}?departmentId=53`);
    assert.strictEqual(runtimeDerm.status, 403, 'Runtime access must be 403 Forbidden for Dermatology');
  });

  console.log('\n--- 3. Backend Access Control & Security ---');

  // Scenario 9: A user cannot access an unauthorized form through direct runtime request
  await check('9a. Direct runtime request without department context is rejected with 403', async () => {
    const directRes = await request(`/api/runtime/forms/${multiDeptSlug}`);
    assert.strictEqual(directRes.status, 403, 'Direct unauthenticated request to restricted form must be 403');
    assert.strictEqual(directRes.data.code, 'DEPARTMENT_ACCESS_REQUIRED');
  });

  await check('9b. Query parameter spoofing blocked when authenticated department header is present', async () => {
    // User is authenticated as Orthopedics via header, but tries to forge ?department=CARDIOLOGY
    const spoofRes = await request(`/api/runtime/forms/${multiDeptSlug}?department=CARDIOLOGY`, {
      headers: {
        'x-user-department': 'ORTHOPAEDICS',
      },
    });
    assert.strictEqual(spoofRes.status, 403, 'Header context must take precedence over query parameter');
    assert.strictEqual(spoofRes.data.code, 'DEPARTMENT_ACCESS_DENIED');
  });

  await check('9c. Sub-routes (patient-state, submit, patient-data) enforce department restriction', async () => {
    // Unauthorized patient state request
    const stateRes = await request(`/api/runtime/forms/${multiDeptSlug}/patient-state?mrno=159636&department=ORTHOPAEDICS`);
    assert.strictEqual(stateRes.status, 403);

    // Unauthorized form submit request
    const submitRes = await request(`/api/runtime/forms/${multiDeptSlug}/submit`, {
      method: 'POST',
      body: JSON.stringify({ data: { symptom: 'Chest pain' }, department: 'DERMATOLOGY' }),
    });
    assert.strictEqual(submitRes.status, 403);

    // Unauthorized patient-data request
    const dataRes = await request(`/api/forms/${multiDeptSlug}/patient-data?mrno=159636&department=ORTHOPAEDICS`);
    assert.strictEqual(dataRes.status, 403);
  });

  console.log('\n--- 4. Backward Compatibility ---');

  // Scenario 10: Existing forms with single department or organization-wide still work
  await check('10a. Legacy single-department form (CARDIOLOGY only) works seamlessly', async () => {
    // Create form using legacy single-field format
    const legacyForm = {
      id: legacyDeptFormId,
      version: '1.0.0',
      title: 'Legacy Cardiology Only Form',
      description: 'Single department legacy form',
      settings: {
        submitButtonText: 'Submit',
        submitAction: 'download_json',
        showResetButton: true,
        departmentId: '51',
        departmentName: 'CARDIOLOGY',
      },
      fields: {
        fld_pulse: { id: 'fld_pulse', name: 'pulse', type: 'number', label: 'Pulse' },
      },
      layout: [
        { id: 'sec_1', rows: [{ id: 'r_1', columns: [{ id: 'c_1', width: 12, fieldIds: ['fld_pulse'] }] }] },
      ],
    };

    await request('/api/forms', {
      method: 'POST',
      headers: { 'x-api-key': AUTH_KEY },
      body: JSON.stringify(legacyForm),
    });

    const pubRes = await request(`/api/forms/${legacyDeptFormId}/publish`, {
      method: 'POST',
      headers: { 'x-api-key': AUTH_KEY },
    });
    assert.strictEqual(pubRes.status, 200);
    legacySlug = pubRes.data.slug;

    // Cardiology sees it
    const cardioRes = await request(`/api/runtime/forms/${legacySlug}?department=CARDIOLOGY`);
    assert.strictEqual(cardioRes.status, 200, 'Cardiology can access single-dept form');

    // Neurology does not see it
    const neuroRes = await request(`/api/runtime/forms/${legacySlug}?department=NEUROLOGY`);
    assert.strictEqual(neuroRes.status, 403, 'Neurology cannot access Cardiology-only form');
  });

  await check('10b. Organization-wide form (ALL) is accessible across all departments and anonymously', async () => {
    const sharedForm = {
      id: sharedFormId,
      version: '1.0.0',
      title: 'Hospital General Feedback Form',
      description: 'Organization-wide form',
      settings: {
        submitButtonText: 'Submit',
        submitAction: 'download_json',
        showResetButton: true,
        departmentId: 'ALL',
        departmentName: 'All Departments (Organization-wide)',
      },
      fields: {
        fld_feed: { id: 'fld_feed', name: 'feedback', type: 'text', label: 'Feedback' },
      },
      layout: [
        { id: 'sec_1', rows: [{ id: 'r_1', columns: [{ id: 'c_1', width: 12, fieldIds: ['fld_feed'] }] }] },
      ],
    };

    await request('/api/forms', {
      method: 'POST',
      headers: { 'x-api-key': AUTH_KEY },
      body: JSON.stringify(sharedForm),
    });

    const pubRes = await request(`/api/forms/${sharedFormId}/publish`, {
      method: 'POST',
      headers: { 'x-api-key': AUTH_KEY },
    });
    sharedSlug = pubRes.data.slug;

    // Accessible directly without params
    const directRes = await request(`/api/runtime/forms/${sharedSlug}`);
    assert.strictEqual(directRes.status, 200, 'Organization-wide form is accessible directly');

    // Accessible by Orthopedics
    const orthoRes = await request(`/api/runtime/forms/${sharedSlug}?department=ORTHOPAEDICS`);
    assert.strictEqual(orthoRes.status, 200, 'Accessible by Orthopedics');
  });

  console.log('\n--- 5. Edge Cases, Filters, Roles & Cleanup ---');

  // Scenario 11: Invalid department IDs or names do not cause unrestricted visibility
  await check('11. Nonexistent/invalid department parameter returns empty list and denies runtime access', async () => {
    const deployedRes = await request('/api/deployed-forms?department=INVALID_NONEXISTENT_DEPT');
    assert.strictEqual(deployedRes.status, 200);
    const found = deployedRes.data.forms.find((f) => f.id === multiDeptFormId);
    assert.strictEqual(found, undefined, 'Invalid department must not match multi-department form');

    const runtimeRes = await request(`/api/runtime/forms/${multiDeptSlug}?department=INVALID_NONEXISTENT_DEPT`);
    assert.strictEqual(runtimeRes.status, 403, 'Invalid department must receive 403');
  });

  // Scenario 12: Combined Department and Service Center filtering
  await check('12. Combined Department and Service Center filtering works correctly', async () => {
    // Create form with department CARDIOLOGY and service center CARDIOLOGY ICU
    const scFormId = `test_sc_${Date.now()}`;
    const scForm = {
      id: scFormId,
      version: '1.0.0',
      title: 'Cardiology ICU Specific Form',
      settings: {
        submitButtonText: 'Submit',
        submitAction: 'download_json',
        showResetButton: true,
        departmentIds: ['51'],
        departmentNames: ['CARDIOLOGY'],
        serviceCenterId: '294',
        serviceCenterName: 'CARDIOLOGY ICU',
      },
      fields: {
        fld_icu: { id: 'fld_icu', name: 'icu_note', type: 'text', label: 'ICU Note' },
      },
      layout: [
        { id: 'sec_1', rows: [{ id: 'r_1', columns: [{ id: 'c_1', width: 12, fieldIds: ['fld_icu'] }] }] },
      ],
    };

    await request('/api/forms', {
      method: 'POST',
      headers: { 'x-api-key': AUTH_KEY },
      body: JSON.stringify(scForm),
    });

    const pubRes = await request(`/api/forms/${scFormId}/publish`, {
      method: 'POST',
      headers: { 'x-api-key': AUTH_KEY },
    });
    const scSlug = pubRes.data.slug;

    // Matching department + matching SC -> Visible (200)
    const matchRes = await request(`/api/runtime/forms/${scSlug}?department=CARDIOLOGY&serviceCenter=CARDIOLOGY%20ICU`);
    assert.strictEqual(matchRes.status, 200);

    // Matching department + mismatched SC -> Denied (403)
    const mismatchRes = await request(`/api/runtime/forms/${scSlug}?department=CARDIOLOGY&serviceCenter=OPD`);
    assert.strictEqual(mismatchRes.status, 403);

    // Clean up
    await request(`/api/forms/${scFormId}/unpublish`, { method: 'POST', headers: { 'x-api-key': AUTH_KEY } });
    await request(`/api/forms/${scFormId}`, { method: 'DELETE', headers: { 'x-api-key': AUTH_KEY } });
  });

  // Scenario 13: Administrator permissions bypass department restriction
  await check('13. Administrator with x-api-key or x-user-role can access any form', async () => {
    // Admin access without department param
    const adminKeyRes = await request(`/api/runtime/forms/${multiDeptSlug}`, {
      headers: { 'x-api-key': AUTH_KEY },
    });
    assert.strictEqual(adminKeyRes.status, 200, 'Admin with API key can access restricted form');

    const adminRoleRes = await request(`/api/runtime/forms/${multiDeptSlug}`, {
      headers: { 'x-user-role': 'admin' },
    });
    assert.strictEqual(adminRoleRes.status, 200, 'Admin with role header can access restricted form');
  });

  // Scenario 14: Draft protection
  await check('14. Draft forms remain protected from runtime access until published', async () => {
    const draftOnlyId = `test_draft_only_${Date.now()}`;
    const draftSaveRes = await request('/api/forms', {
      method: 'POST',
      headers: { 'x-api-key': AUTH_KEY },
      body: JSON.stringify({
        id: draftOnlyId,
        version: '1.0.0',
        title: 'Draft Only Multi-Dept',
        settings: {
          submitButtonText: 'Submit',
          submitAction: 'download_json',
          showResetButton: true,
          departmentIds: ['51', '63'],
        },
        fields: { f1: { id: 'f1', name: 'f1', type: 'text', label: 'Field 1' } },
        layout: [{ id: 's1', rows: [{ id: 'r1', columns: [{ id: 'c1', width: 12, fieldIds: ['f1'] }] }] }],
      }),
    });
    const draftSlug = draftSaveRes.data?.meta?.slug || 'draft-only-multi-dept';

    const runtimeRes = await request(`/api/runtime/forms/${draftSlug}?department=CARDIOLOGY`);
    assert.strictEqual(runtimeRes.status, 404, 'Draft form must return 404 on runtime');
    assert.strictEqual(runtimeRes.data.code, 'FORM_NOT_PUBLISHED');

    await request(`/api/forms/${draftOnlyId}`, { method: 'DELETE', headers: { 'x-api-key': AUTH_KEY } });
  });

  // Teardown / Cleanup
  console.log('\n--- Cleaning up test forms ---');
  for (const fId of [multiDeptFormId, legacyDeptFormId, sharedFormId]) {
    await request(`/api/forms/${fId}/unpublish`, { method: 'POST', headers: { 'x-api-key': AUTH_KEY } }).catch(() => {});
    await request(`/api/forms/${fId}`, { method: 'DELETE', headers: { 'x-api-key': AUTH_KEY } }).catch(() => {});
  }
  console.log('✓ Test forms cleaned up.');

  console.log('\n======================================================================');
  console.log(`🎉 TEST SUMMARY: ${passed} passed, ${failed} failed`);
  console.log('======================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTestSuite().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
