import assert from 'assert';

const BASE_URL = 'http://localhost:3001';

async function runTests() {
  console.log('======================================================================');
  console.log('🧪 FORMCRAFT PATIENT SUBMITTED FORMS & VIEWER TEST SUITE');
  console.log('======================================================================\n');

  let passed = 0;
  let failed = 0;

  function pass(msg) {
    console.log(`✅ [PASS] ${msg}`);
    passed++;
  }

  function fail(msg, err) {
    console.error(`❌ [FAIL] ${msg}`, err);
    failed++;
  }

  const testMrno = '1917960';
  let createdSubmissionId = null;

  // 1. Submit a form for MRNO 1917960 so we have known submissions
  console.log('--- 1. Submitting Form for Patient MRNO 1917960 ---');
  try {
    const submitRes = await fetch(`${BASE_URL}/api/runtime/forms/magj-hospital/submit?department=UROLOGY`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mrno: testMrno,
        data: {
          'fld_1792064901073_bzj5y': 'Automated Test Patient',
          'fld_1792064919799_4eewb': 'Ward 5B Bed 12',
        },
      }),
    });
    assert.strictEqual(submitRes.ok, true, 'Form submission should succeed');
    const submitData = await submitRes.json();
    assert.strictEqual(submitData.success, true);
    createdSubmissionId = submitData.submissionId;
    pass(`Form submitted successfully. Created submission ID: ${createdSubmissionId}`);
  } catch (err) {
    fail('Form submission failed', err.message);
  }

  // 2. Fetch patient submitted forms list: GET /api/patients/:mrno/submitted-forms
  console.log('\n--- 2. Testing GET /api/patients/:mrno/submitted-forms ---');
  try {
    const listRes = await fetch(`${BASE_URL}/api/patients/${testMrno}/submitted-forms`);
    assert.strictEqual(listRes.status, 200, 'Should return 200 OK');
    const listData = await listRes.json();

    assert.strictEqual(listData.success, true, 'Response success should be true');
    assert.ok(listData.patient, 'Response should contain patient object');
    assert.strictEqual(String(listData.patient.mrno), testMrno, 'Patient MRNO should match');
    assert.ok(listData.patient.patientName, 'Patient should have a display name');
    pass('Patient details returned with MRNO and display name');

    assert.ok(Array.isArray(listData.submissions), 'Submissions should be an array');
    assert.ok(listData.submissions.length > 0, 'Should have at least 1 submission');
    pass(`Retrieved ${listData.submissions.length} submission(s) for patient MRNO ${testMrno}`);

    const found = listData.submissions.find((s) => String(s.id) === String(createdSubmissionId));
    assert.ok(found, `Created submission #${createdSubmissionId} should be in the list`);
    assert.ok(found.formName, 'Submission should have a formName');
    assert.ok(found.submittedAt, 'Submission should have submittedAt timestamp');
    assert.ok(found.status, 'Submission should have a status');
    pass(`Submission contains formName "${found.formName}", status "${found.status}", timestamp "${found.submittedAt}"`);

    // Verify ordering: newest first
    if (listData.submissions.length > 1) {
      const t0 = new Date(listData.submissions[0].submittedAt).getTime();
      const t1 = new Date(listData.submissions[1].submittedAt).getTime();
      assert.ok(t0 >= t1, 'Submissions should be sorted newest first');
      pass('Submissions are sorted by timestamp descending (newest first)');
    }
  } catch (err) {
    fail('GET submitted-forms failed', err.message);
  }

  // 3. Fetch single submission detail: GET /api/patients/:mrno/submitted-forms/:submissionId
  console.log('\n--- 3. Testing GET /api/patients/:mrno/submitted-forms/:submissionId ---');
  try {
    const detailRes = await fetch(`${BASE_URL}/api/patients/${testMrno}/submitted-forms/${createdSubmissionId}`);
    assert.strictEqual(detailRes.status, 200, 'Should return 200 OK');
    const detailData = await detailRes.json();

    assert.strictEqual(detailData.success, true, 'Response success should be true');
    assert.ok(detailData.submission, 'Response should contain submission');
    assert.strictEqual(String(detailData.submission.id), String(createdSubmissionId));
    assert.strictEqual(String(detailData.submission.mrno), testMrno);
    assert.ok(detailData.submission.formData, 'Submission should contain formData');
    assert.strictEqual(
      detailData.submission.formData['fld_1792064901073_bzj5y'],
      'Automated Test Patient',
      'Saved field value should match original submitted value'
    );
    pass('Saved submission formData matches exact original submitted data');

    assert.ok(detailData.form, 'Response should contain form definition snapshot');
    assert.ok(detailData.form.title, 'Form snapshot should have a title');
    assert.ok(detailData.form.fields, 'Form snapshot should have fields');
    pass(`Form definition snapshot returned with title "${detailData.form.title}" and schema fields`);
  } catch (err) {
    fail('GET submission detail failed', err.message);
  }

  // 4. Security & Patient Authorization: Cross-patient access prevention
  console.log('\n--- 4. Security: Cross-Patient Access Prevention ---');
  try {
    const wrongMrno = '9999999';
    const unauthorizedRes = await fetch(`${BASE_URL}/api/patients/${wrongMrno}/submitted-forms/${createdSubmissionId}`);
    assert.strictEqual(unauthorizedRes.status, 403, `Cross-patient access should be rejected with 403, got: ${unauthorizedRes.status}`);
    pass(`Cross-patient access strictly blocked with HTTP 403 Forbidden`);
  } catch (err) {
    fail('Cross-patient security check failed', err.message);
  }

  // 5. Non-existent submission ID
  console.log('\n--- 5. Non-Existent Submission ID ---');
  try {
    const nonExistentRes = await fetch(`${BASE_URL}/api/patients/${testMrno}/submitted-forms/88888888`);
    assert.strictEqual(nonExistentRes.status, 404, 'Non-existent submission should return 404');
    pass('Non-existent submission returned 404 Not Found');
  } catch (err) {
    fail('Non-existent submission test failed', err.message);
  }

  // 6. Empty state for patient with 0 submissions
  console.log('\n--- 6. Empty State for Patient with No Submissions ---');
  try {
    const freshMrno = '8888123';
    const emptyRes = await fetch(`${BASE_URL}/api/patients/${freshMrno}/submitted-forms`);
    assert.strictEqual(emptyRes.status, 200, 'Should return 200 OK');
    const emptyData = await emptyRes.json();
    assert.strictEqual(emptyData.success, true);
    assert.ok(Array.isArray(emptyData.submissions));
    assert.strictEqual(emptyData.submissions.length, 0, 'Fresh patient should have 0 submissions');
    pass('Patient without submissions returns empty array gracefully');
  } catch (err) {
    fail('Empty state test failed', err.message);
  }

  // 7. Security: Department filtering and cross-department access prevention
  console.log('\n--- 7. Security: Department Access Enforcement ---');
  try {
    // Cardiology user querying submitted forms: UROLOGY-only form MAGJ HOSPITAL should be filtered out
    const cardioRes = await fetch(`${BASE_URL}/api/patients/${testMrno}/submitted-forms?department=CARDIOLOGY`);
    assert.strictEqual(cardioRes.status, 200);
    const cardioData = await cardioRes.json();
    const hasUrology = cardioData.submissions.some((s) => String(s.id) === String(createdSubmissionId));
    assert.strictEqual(hasUrology, false, 'Cardiology user must not see Urology-restricted form submissions');
    pass('Department filter excludes submissions belonging to unauthorized departments');

    // Urology user querying submitted forms: UROLOGY form IS included
    const urologyRes = await fetch(`${BASE_URL}/api/patients/${testMrno}/submitted-forms?department=UROLOGY`);
    assert.strictEqual(urologyRes.status, 200);
    const urologyData = await urologyRes.json();
    const foundUrology = urologyData.submissions.some((s) => String(s.id) === String(createdSubmissionId));
    assert.strictEqual(foundUrology, true, 'Urology user must see Urology form submissions');
    pass('Department filter includes submissions belonging to authorized departments');

    // Cardiology user attempting to directly fetch detail of Urology submission via URL
    const blockedDetailRes = await fetch(`${BASE_URL}/api/patients/${testMrno}/submitted-forms/${createdSubmissionId}?department=CARDIOLOGY`);
    assert.strictEqual(blockedDetailRes.status, 403, 'Direct access to submission of unauthorized department must return 403');
    pass('Direct submission detail access blocked with HTTP 403 for unauthorized department');
  } catch (err) {
    fail('Department security check failed', err.message);
  }

  console.log('\n======================================================================');
  console.log(`🎉 TEST SUMMARY: ${passed} passed, ${failed} failed`);
  console.log('======================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Test execution error:', err);
  process.exit(1);
});
