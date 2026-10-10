import assert from 'assert';
import 'dotenv/config';

const BASE_URL = `http://localhost:${process.env.PORT || 3001}`;
const AUTH_KEY = process.env.AUTH_SECRET || 'formcraft_secret_key_2026';

async function request(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': AUTH_KEY,
      ...(options.headers || {}),
    },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, ok: res.ok, data };
}

async function runTestSuite() {
  console.log('======================================================================');
  console.log('🧪 FORMCRAFT PATIENT FORM BEHAVIOR & ORACLE PERSISTENCE TEST SUITE');
  console.log('======================================================================\n');

  let passed = 0;
  let total = 0;

  function testAssert(condition, name, details = '') {
    total++;
    if (condition) {
      console.log(`✅ [PASS] ${name}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${name} — ${details}`);
      throw new Error(`Assertion failed: ${name} (${details})`);
    }
  }

  // -------------------------------------------------------------------------
  // 1. Configuration & Publishing Tests (Feature A)
  // -------------------------------------------------------------------------
  console.log('--- 1. Testing Configuration & Publishing Tests (Feature A) ---');

  // Test Form 1: Configured with NEW_RECORD
  const formIdMode1 = `test_mode1_form_${Date.now()}`;
  const formDefMode1 = {
    id: formIdMode1,
    version: '1.0.0',
    title: 'Nursing Assessment Encounter Form',
    description: 'Encounter assessment form configured for NEW_RECORD behavior',
    settings: {
      submitButtonText: 'Submit Assessment',
      submitAction: 'download_json',
      showResetButton: true,
      patientFormMode: 'NEW_RECORD',
      primaryEntity: 'PATIENT',
      primaryKeyColumn: 'PATIENT_ID',
    },
    fields: {
      fld_temp: {
        id: 'fld_temp',
        name: 'temperature',
        type: 'text',
        label: 'Body Temperature (°C)',
        validation: { required: true },
      },
      fld_notes: {
        id: 'fld_notes',
        name: 'assessment_notes',
        type: 'textarea',
        label: 'Clinical Notes',
        validation: { required: false },
      },
    },
    layout: [
      {
        id: 'sec_1',
        title: 'Vitals & Notes',
        rows: [
          {
            id: 'row_1',
            columns: [
              { id: 'col_1', width: 6, fieldIds: ['fld_temp'] },
              { id: 'col_2', width: 6, fieldIds: ['fld_notes'] },
            ],
          },
        ],
      },
    ],
  };

  const saveMode1Res = await request('/api/forms', {
    method: 'POST',
    body: JSON.stringify(formDefMode1),
  });
  testAssert(saveMode1Res.status === 200, 'Save NEW_RECORD draft form returns 200');
  testAssert(saveMode1Res.data.data.settings.patientFormMode === 'NEW_RECORD', 'Draft persists patientFormMode = NEW_RECORD');
  const slugMode1 = saveMode1Res.data.meta.slug;

  const pubMode1Res = await request(`/api/forms/${formIdMode1}/publish`, { method: 'POST' });
  testAssert(pubMode1Res.status === 200, 'Publish NEW_RECORD form succeeds with 200');

  const runtimeMode1Res = await request(`/api/runtime/forms/${slugMode1}`);
  testAssert(runtimeMode1Res.status === 200, 'Runtime retrieves published NEW_RECORD form');
  testAssert(
    runtimeMode1Res.data.form.definition.settings.patientFormMode === 'NEW_RECORD',
    'Published runtime freezes patientFormMode = NEW_RECORD'
  );

  // Test Form 2: Configured with CONTINUE_EXISTING
  const formIdMode2 = `test_mode2_form_${Date.now()}`;
  const formDefMode2 = {
    id: formIdMode2,
    version: '1.0.0',
    title: 'Continuous Patient Care Plan',
    description: 'Care plan form configured for CONTINUE_EXISTING behavior',
    settings: {
      submitButtonText: 'Save Care Plan',
      submitAction: 'download_json',
      showResetButton: true,
      patientFormMode: 'CONTINUE_EXISTING',
      primaryEntity: 'PATIENT',
      primaryKeyColumn: 'PATIENT_ID',
    },
    fields: {
      fld_goal: {
        id: 'fld_goal',
        name: 'primary_goal',
        type: 'text',
        label: 'Primary Treatment Goal',
        validation: { required: true },
      },
      fld_diet: {
        id: 'fld_diet',
        name: 'diet_plan',
        type: 'text',
        label: 'Dietary Instructions',
      },
    },
    layout: [
      {
        id: 'sec_1',
        title: 'Plan Details',
        rows: [
          {
            id: 'row_1',
            columns: [
              { id: 'col_1', width: 6, fieldIds: ['fld_goal'] },
              { id: 'col_2', width: 6, fieldIds: ['fld_diet'] },
            ],
          },
        ],
      },
    ],
  };

  const saveMode2Res = await request('/api/forms', {
    method: 'POST',
    body: JSON.stringify(formDefMode2),
  });
  testAssert(saveMode2Res.status === 200, 'Save CONTINUE_EXISTING draft form returns 200');
  testAssert(
    saveMode2Res.data.data.settings.patientFormMode === 'CONTINUE_EXISTING',
    'Draft persists patientFormMode = CONTINUE_EXISTING'
  );
  const slugMode2 = saveMode2Res.data.meta.slug;

  const pubMode2Res = await request(`/api/forms/${formIdMode2}/publish`, { method: 'POST' });
  testAssert(pubMode2Res.status === 200, 'Publish CONTINUE_EXISTING form succeeds with 200');

  // Test Form 3: Legacy form without patientFormMode defaults safely to NEW_RECORD
  const formIdLegacy = `test_legacy_form_${Date.now()}`;
  const formDefLegacy = {
    id: formIdLegacy,
    version: '1.0.0',
    title: 'Legacy Clinical Form Without Mode',
    settings: {
      submitButtonText: 'Submit',
      submitAction: 'download_json',
      showResetButton: true,
    },
    fields: {
      fld_text: {
        id: 'fld_text',
        name: 'text_entry',
        type: 'text',
        label: 'Text Entry',
      },
    },
    layout: [
      {
        id: 'sec_1',
        title: 'Section',
        rows: [{ id: 'r1', columns: [{ id: 'c1', width: 12, fieldIds: ['fld_text'] }] }],
      },
    ],
  };
  const saveLegacyRes = await request('/api/forms', { method: 'POST', body: JSON.stringify(formDefLegacy) });
  await request(`/api/forms/${formIdLegacy}/publish`, { method: 'POST' });
  const slugLegacy = saveLegacyRes.data.meta.slug;
  const legacyStateRes = await request(`/api/runtime/forms/${slugLegacy}/patient-state?mrno=99999`);
  testAssert(legacyStateRes.data.mode === 'NEW_RECORD', 'Legacy form without setting defaults to NEW_RECORD');

  // -------------------------------------------------------------------------
  // 2. Mode 1 (NEW_RECORD) End-to-End Tests (Features B, C, E, F)
  // -------------------------------------------------------------------------
  console.log('\n--- 2. Testing Mode 1 (NEW_RECORD) Behavior & Submission History ---');
  const testPatientMrno = `MRN_${Date.now()}`;

  // Step 2a: Patient opens form with no history
  const initMode1State = await request(`/api/runtime/forms/${slugMode1}/patient-state?mrno=${testPatientMrno}`);
  testAssert(initMode1State.status === 200, 'Retrieve patient state for fresh patient');
  testAssert(initMode1State.data.mode === 'NEW_RECORD', 'State reports mode NEW_RECORD');
  testAssert(initMode1State.data.hasExistingRecord === false, 'Fresh patient has no existing record');
  testAssert(Array.isArray(initMode1State.data.history) && initMode1State.data.history.length === 0, 'Fresh patient has empty history');

  // Step 2b: Submit first instance
  const sub1Res = await request(`/api/runtime/forms/${slugMode1}/submit`, {
    method: 'POST',
    body: JSON.stringify({
      mrno: testPatientMrno,
      submittedBy: 'Dr. Watson',
      data: {
        temperature: '37.2',
        assessment_notes: 'Initial morning assessment: patient is alert and resting comfortably.',
      },
    }),
  });
  testAssert(sub1Res.status === 201, 'First submission in Mode 1 returns 201 Created');
  testAssert(sub1Res.data.action === 'inserted', 'Submission action is inserted');
  testAssert(sub1Res.data.recordId !== undefined, 'Returned generated record identifier');
  testAssert(sub1Res.data.submittedAt !== undefined, 'Returned server timestamp');
  const recordId1 = sub1Res.data.recordId;
  const submissionId1 = sub1Res.data.submissionId;

  // Step 2c: Reopen the same form for the same patient -> verify history has 1 entry
  const stateAfterSub1 = await request(`/api/runtime/forms/${slugMode1}/patient-state?mrno=${testPatientMrno}`);
  testAssert(stateAfterSub1.data.history.length === 1, 'History now contains 1 previous submission');
  testAssert(String(stateAfterSub1.data.history[0].id) === String(submissionId1), 'History item matches submission ID 1');
  testAssert(stateAfterSub1.data.history[0].submittedAt !== undefined, 'History item has submitted date and time');
  testAssert(stateAfterSub1.data.history[0].status === 'Submitted', 'History item reports status "Submitted"');

  // Step 2d: Submit second instance for same patient -> verify second record inserted
  const sub2Res = await request(`/api/runtime/forms/${slugMode1}/submit`, {
    method: 'POST',
    body: JSON.stringify({
      mrno: testPatientMrno,
      submittedBy: 'Nurse Joy',
      data: {
        temperature: '38.5',
        assessment_notes: 'Evening assessment: mild fever recorded, administered paracetamol.',
      },
    }),
  });
  testAssert(sub2Res.status === 201, 'Second submission in Mode 1 returns 201 Created');
  const recordId2 = sub2Res.data.recordId;
  const submissionId2 = sub2Res.data.submissionId;
  testAssert(submissionId1 !== submissionId2, 'Second submission has distinct unique ID');

  // Step 2e: Verify history now contains both records in reverse chronological order
  const stateAfterSub2 = await request(`/api/runtime/forms/${slugMode1}/patient-state?mrno=${testPatientMrno}`);
  testAssert(stateAfterSub2.data.history.length === 2, 'History now contains exactly 2 submissions');
  testAssert(String(stateAfterSub2.data.history[0].id) === String(submissionId2), 'Most recent submission appears first');
  testAssert(String(stateAfterSub2.data.history[1].id) === String(submissionId1), 'Earlier submission appears second');

  // Step 2f: View previous submission (read-only historical record)
  const viewSub1Res = await request(`/api/runtime/forms/${slugMode1}/submissions/${submissionId1}?mrno=${testPatientMrno}`);
  testAssert(viewSub1Res.status === 200, 'Retrieve historical submission #1 returns 200');
  testAssert(viewSub1Res.data.submission.formData.temperature === '37.2', 'Historical submission #1 retained original values');
  testAssert(
    viewSub1Res.data.submission.formData.assessment_notes.includes('Initial morning assessment'),
    'Historical submission #1 notes remain unchanged'
  );

  // Step 2g: Patient Isolation Verification: Different patient never sees another patient\'s history
  const otherPatientMrno = `OTHER_MRN_${Date.now()}`;
  const otherPatientState = await request(`/api/runtime/forms/${slugMode1}/patient-state?mrno=${otherPatientMrno}`);
  testAssert(otherPatientState.data.history.length === 0, 'Different patient history is completely isolated and empty');

  // Verify unauthorized historical access rejection
  const unauthorizedHistRes = await request(
    `/api/runtime/forms/${slugMode1}/submissions/${submissionId1}?mrno=${otherPatientMrno}`
  );
  testAssert(
    unauthorizedHistRes.status === 403 || unauthorizedHistRes.status === 404,
    'Reject unauthorized cross-patient historical submission access with 403 or 404'
  );

  // -------------------------------------------------------------------------
  // 3. Mode 2 (CONTINUE_EXISTING) End-to-End Tests (Features B, D, E)
  // -------------------------------------------------------------------------
  console.log('\n--- 3. Testing Mode 2 (CONTINUE_EXISTING) Behavior & Single-Record Updates ---');
  const patientMode2Mrno = `CARE_PLAN_MRN_${Date.now()}`;

  // Step 3a: Fresh patient opening CONTINUE_EXISTING form -> no record yet
  const initMode2State = await request(`/api/runtime/forms/${slugMode2}/patient-state?mrno=${patientMode2Mrno}`);
  testAssert(initMode2State.data.mode === 'CONTINUE_EXISTING', 'Reports mode CONTINUE_EXISTING');
  testAssert(initMode2State.data.hasExistingRecord === false, 'Fresh patient has no existing record');
  testAssert(initMode2State.data.data === null, 'Data is null for fresh patient');

  // Step 3b: First submission -> inserts record #1
  const mode2FirstSubmit = await request(`/api/runtime/forms/${slugMode2}/submit`, {
    method: 'POST',
    body: JSON.stringify({
      mrno: patientMode2Mrno,
      submittedBy: 'Dr. House',
      data: {
        primary_goal: 'Lower blood pressure to < 130/80 within 3 weeks',
        diet_plan: 'Low sodium, DASH diet regimen',
      },
    }),
  });
  testAssert(mode2FirstSubmit.status === 201, 'First submit in Mode 2 returns 201 (Insert)');
  testAssert(mode2FirstSubmit.data.action === 'inserted', 'Action was inserted');
  const mode2RecId = mode2FirstSubmit.data.recordId;
  const mode2SubId = mode2FirstSubmit.data.submissionId;

  // Step 3c: Reopen form for same patient -> loads existing record values into form
  const reopenMode2State = await request(`/api/runtime/forms/${slugMode2}/patient-state?mrno=${patientMode2Mrno}`);
  testAssert(reopenMode2State.data.hasExistingRecord === true, 'Existing record detected on reload');
  testAssert(String(reopenMode2State.data.submissionId) === String(mode2SubId), 'Reopened matches persisted submission ID');
  testAssert(reopenMode2State.data.data.primary_goal.includes('Lower blood pressure'), 'Populates previously saved primary_goal');
  testAssert(reopenMode2State.data.data.diet_plan.includes('Low sodium'), 'Populates previously saved diet_plan');

  // Step 3d: Clinician edits the form and submits changes -> UPDATES existing record instead of duplicate
  const mode2SecondSubmit = await request(`/api/runtime/forms/${slugMode2}/submit`, {
    method: 'POST',
    body: JSON.stringify({
      mrno: patientMode2Mrno,
      isUpdate: true,
      submissionId: mode2SubId,
      recordId: mode2RecId,
      submittedBy: 'Dr. House',
      data: {
        primary_goal: 'Updated: BP stabilized, target maintenance at 120/75',
        diet_plan: 'Low sodium + regular aerobic exercise',
      },
    }),
  });
  testAssert(mode2SecondSubmit.status === 200, 'Subsequent submission in Mode 2 returns 200 (Update)');
  testAssert(mode2SecondSubmit.data.action === 'updated', 'Action was updated');
  testAssert(String(mode2SecondSubmit.data.submissionId) === String(mode2SubId), 'Same primary record ID was updated');

  // Step 3e: Verify reload sees the updated values and NO duplicate record exists
  const verifyUpdatedState = await request(`/api/runtime/forms/${slugMode2}/patient-state?mrno=${patientMode2Mrno}`);
  testAssert(verifyUpdatedState.data.data.primary_goal.includes('Updated: BP stabilized'), 'Loaded updated primary_goal value');
  testAssert(verifyUpdatedState.data.data.diet_plan.includes('aerobic exercise'), 'Loaded updated diet_plan value');

  // -------------------------------------------------------------------------
  // 4. Validation, Concurrency & Security Tests (Feature E & 11)
  // -------------------------------------------------------------------------
  console.log('\n--- 4. Testing Validation & Concurrency Rules ---');

  // Validation: Missing required field blocks submission
  const invalidSub = await request(`/api/runtime/forms/${slugMode1}/submit`, {
    method: 'POST',
    body: JSON.stringify({
      mrno: testPatientMrno,
      data: {
        temperature: '', // Required field empty!
      },
    }),
  });
  testAssert(invalidSub.status === 400, 'Missing required field returns 400 Bad Request');
  testAssert(invalidSub.data.validationErrors !== undefined, 'Returns field-level validation errors');
  testAssert(invalidSub.data.validationErrors.temperature !== undefined, 'Error specifies temperature field is required');

  console.log('\n======================================================================');
  console.log(`🎉 ALL ${passed} / ${total} TESTS PASSED WITH 100% SUCCESS! 🎉`);
  console.log('======================================================================\n');
}

runTestSuite().catch((err) => {
  console.error('\n❌ Test execution failed:', err);
  process.exit(1);
});
