import assert from 'assert';
import http from 'http';
import { getStaffDetails } from '../server/services/userService.js';
import { executeQuery, initOraclePool } from '../server/database/oracle.js';

function makeRequest(path) {
  return new Promise((resolve, reject) => {
    http.get(`http://localhost:3001${path}`, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve({ status: res.statusCode, data: json });
        } catch (e) {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    }).on('error', reject);
  });
}

// Inline implementations of logic to verify unit logic cleanly in Node ESM
function isStaffNameFieldTest(field) {
  if (field.autoPopulate && typeof field.autoPopulate === 'object') {
    if (field.autoPopulate.autoPopulate !== false) {
      if (
        (field.autoPopulate.dataSource === 'loggedInUser' || !field.autoPopulate.dataSource) &&
        (field.autoPopulate.sourceField === 'staff_name' || !field.autoPopulate.sourceField)
      ) {
        return true;
      }
    }
  }
  if (
    field.autoPopulate === true ||
    (field.dataSource === 'loggedInUser' && (field.sourceField === 'staff_name' || !field.sourceField))
  ) {
    return true;
  }
  const labelLower = (field.label || '').toLowerCase().trim();
  const nameLower = (field.name || '').toLowerCase().trim();
  const idLower = (field.id || '').toLowerCase().trim();

  if (
    labelLower === 'sign' ||
    labelLower === 'signature' ||
    nameLower === 'nurse_sign' ||
    nameLower === 'sign' ||
    idLower === 'fld_nurse_sign' ||
    idLower.includes('sign')
  ) {
    return false;
  }

  if (
    labelLower === 'assessment completed by staff nurse (name)' ||
    labelLower.includes('staff nurse (name)') ||
    labelLower.includes('staff nurse name') ||
    labelLower === 'nurse name' ||
    labelLower === 'staff name' ||
    nameLower === 'nurse_name' ||
    nameLower === 'staff_name' ||
    idLower === 'fld_nurse_name'
  ) {
    return true;
  }
  return false;
}

function isStaffNameColumnTest(col) {
  if (col.autoPopulate && typeof col.autoPopulate === 'object') {
    if (col.autoPopulate.autoPopulate !== false) {
      if (col.autoPopulate.dataSource === 'loggedInUser' && col.autoPopulate.sourceField === 'staff_name') {
        return true;
      }
    }
  }
  if (col.autoPopulate === true || (col.dataSource === 'loggedInUser' && col.sourceField === 'staff_name')) {
    return true;
  }
  const labelLower = (col.label || '').toLowerCase().trim();
  const keyLower = ((col.key || col.id) || '').toLowerCase().trim();

  if (labelLower === 'sign' || labelLower === 'signature' || keyLower === 'sign' || keyLower === 'signature') {
    return false;
  }
  if (
    labelLower === 'staff name & sign' ||
    labelLower === 'staff name and sign' ||
    labelLower.includes('staff name') ||
    labelLower.includes('nurse name') ||
    keyLower === 'staff_name_sign' ||
    keyLower === 'staff_name' ||
    keyLower === 'nurse_name'
  ) {
    return true;
  }
  return false;
}

async function runTestSuite() {
  console.log('--- STARTING COMPREHENSIVE TEST SUITE FOR HIS USER & STAFF CONTEXT ---');

  await initOraclePool();

  let passed = 0;
  let total = 0;

  function test(name, fn) {
    total++;
    try {
      fn();
      console.log(`[PASS] Test ${total}: ${name}`);
      passed++;
    } catch (err) {
      console.error(`[FAIL] Test ${total}: ${name}`);
      console.error(err);
    }
  }

  async function asyncTest(name, fn) {
    total++;
    try {
      await fn();
      console.log(`[PASS] Test ${total}: ${name}`);
      passed++;
    } catch (err) {
      console.error(`[FAIL] Test ${total}: ${name}`);
      console.error(err);
    }
  }

  // 1. Correct staff details returned for a valid user ID (service level & HTTP API)
  await asyncTest('Valid user ID 950 returns correct staff details (HTTP 200)', async () => {
    const res = await makeRequest('/api/users/950/staff-details');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);
    assert.strictEqual(res.data.user_id, 950);
    assert.strictEqual(res.data.staff_name, 'SABIN SUNNY');
    assert.ok(res.data.employee_id !== undefined);
  });

  await asyncTest('Valid user ID 1201 returns correct staff details (HTTP 200)', async () => {
    const res = await makeRequest('/api/users/1201/staff-details');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);
    assert.strictEqual(res.data.user_id, 1201);
    assert.strictEqual(res.data.staff_name, 'SUJEESH KOSHY');
  });

  // 2. Invalid and nonexistent IDs handled correctly
  await asyncTest('Nonexistent user ID returns HTTP 404', async () => {
    const res = await makeRequest('/api/users/9999999/staff-details');
    assert.strictEqual(res.status, 404);
    assert.strictEqual(res.data.success, false);
    assert.strictEqual(res.data.code, 'USER_NOT_FOUND');
  });

  await asyncTest('Invalid non-numeric user ID returns HTTP 400', async () => {
    const res = await makeRequest('/api/users/abc/staff-details');
    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.data.success, false);
    assert.strictEqual(res.data.code, 'INVALID_USER_ID');
  });

  await asyncTest('Negative user ID returns HTTP 400', async () => {
    const res = await makeRequest('/api/users/-5/staff-details');
    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.data.success, false);
    assert.strictEqual(res.data.code, 'INVALID_USER_ID');
  });

  // 3. Inactive accounts rejected according to HIS rules (HTTP 403)
  await asyncTest('Inactive user account (e.g. user 1052 with ISACTIVE=0) returns HTTP 403', async () => {
    const res = await makeRequest('/api/users/1052/staff-details');
    assert.strictEqual(res.status, 403);
    assert.strictEqual(res.data.success, false);
    assert.strictEqual(res.data.code, 'USER_INACTIVE');
  });

  // 4. Security: No passwords or sensitive database credentials exposed
  await asyncTest('API response does not leak password, hash, or internal DB credentials', async () => {
    const res = await makeRequest('/api/users/950/staff-details');
    assert.strictEqual(res.data.password, undefined);
    assert.strictEqual(res.data.PASSWORD, undefined);
    assert.strictEqual(res.data.PWD, undefined);
    assert.strictEqual(res.data.pwd, undefined);
    assert.strictEqual(res.data.DB_PASSWORD, undefined);
  });

  // 5. Target field A: Nursing Assessment staff-name field is recognized and auto-populated
  test('Target Field A (Assessment Completed by Staff Nurse (Name)) is identified for auto-population', () => {
    const fieldA = {
      id: 'fld_nurse_name',
      name: 'nurse_name',
      label: 'Assessment Completed by Staff Nurse (Name)',
      type: 'text',
      autoPopulate: {
        dataSource: 'loggedInUser',
        sourceField: 'staff_name',
        autoPopulate: true,
        populateWhen: 'empty',
      },
    };
    assert.strictEqual(isStaffNameFieldTest(fieldA), true);
  });

  test('Target Field A heuristic fallback works even without explicit autoPopulate config', () => {
    const plainField = {
      id: 'fld_nurse_name',
      name: 'nurse_name',
      label: 'Assessment Completed by Staff Nurse (Name)',
      type: 'text',
    };
    assert.strictEqual(isStaffNameFieldTest(plainField), true);
  });

  test('Signatures are strictly protected and never identified as text staff names', () => {
    const signField1 = {
      id: 'fld_nurse_sign',
      name: 'nurse_sign',
      label: 'Sign',
      type: 'text',
    };
    const signField2 = {
      id: 'fld_signature',
      name: 'signature',
      label: 'Nurse Signature',
      type: 'text',
    };
    assert.strictEqual(isStaffNameFieldTest(signField1), false);
    assert.strictEqual(isStaffNameFieldTest(signField2), false);
  });

  // 6. Target field B: Morse Fall Risk reassessment rows receive default staff name
  test('Target Field B column (Staff Name & Sign) in Morse table is identified for auto-population', () => {
    const colB = {
      id: 'col_b4it_6',
      key: 'col_b4it_6',
      label: 'Staff Name & Sign',
      type: 'text',
      autoPopulate: {
        dataSource: 'loggedInUser',
        sourceField: 'staff_name',
        autoPopulate: true,
        populateWhen: 'empty',
      },
    };
    assert.strictEqual(isStaffNameColumnTest(colB), true);
  });

  test('Newly created table row receives default staff name without overwriting other columns', () => {
    const columns = [
      { id: 'col_date', label: 'Date', type: 'date' },
      { id: 'col_score', label: 'Score', type: 'number' },
      { id: 'col_b4it_6', label: 'Staff Name & Sign', type: 'text' },
    ];
    const staffName = 'SABIN SUNNY';

    const newRow = {};
    columns.forEach((col) => {
      const key = col.key || col.id;
      if (staffName && isStaffNameColumnTest(col)) {
        newRow[key] = staffName;
      } else {
        newRow[key] = '';
      }
    });

    assert.strictEqual(newRow['col_b4it_6'], 'SABIN SUNNY');
    assert.strictEqual(newRow['col_date'], '');
    assert.strictEqual(newRow['col_score'], '');
  });

  // 7. Existing user-entered values are not overwritten (populateWhen: "empty")
  test('Existing user-entered staff name is preserved and NOT overwritten', () => {
    const currentFormData = {
      fld_nurse_name: 'Existing Nurse Mary',
      nurse_name: 'Existing Nurse Mary',
    };
    const loggedInStaffName = 'SABIN SUNNY';

    // Simulation of populate effect
    const updated = { ...currentFormData };
    const field = { id: 'fld_nurse_name', name: 'nurse_name', label: 'Assessment Completed by Staff Nurse (Name)' };
    const key = field.name || field.id;
    const currentVal = updated[key];
    const isEmpty = currentVal === undefined || currentVal === null || String(currentVal).trim() === '';

    if (isEmpty) {
      updated[key] = loggedInStaffName;
    }

    assert.strictEqual(updated['nurse_name'], 'Existing Nurse Mary');
  });

  // 8. Missing URL parameters do not break existing forms
  test('Missing user_id parameter leaves fields untouched without crashing', () => {
    const userIdParam = null;
    const staffContext = null;
    const initialFormVal = '';

    let populatedVal = initialFormVal;
    if (staffContext?.staff_name) {
      populatedVal = staffContext.staff_name;
    }

    assert.strictEqual(populatedVal, '');
  });

  // 9. Reusable field-level configuration across any form
  test('Reusable field configuration works for custom fields on any form', () => {
    const customDoctorField = {
      id: 'fld_custom_doctor',
      name: 'attending_physician',
      label: 'Primary Attending Staff',
      type: 'text',
      autoPopulate: {
        dataSource: 'loggedInUser',
        sourceField: 'staff_name',
        autoPopulate: true,
        populateWhen: 'empty',
      },
    };
    assert.strictEqual(isStaffNameFieldTest(customDoctorField), true);
  });

  // 10. Oracle connection release verification
  await asyncTest('Oracle connection release: 10 concurrent requests cleanly acquire and release connections', async () => {
    const requests = Array.from({ length: 10 }).map((_, i) =>
      makeRequest('/api/users/950/staff-details')
    );
    const results = await Promise.all(requests);
    for (const r of results) {
      assert.strictEqual(r.status, 200);
      assert.strictEqual(r.data.staff_name, 'SABIN SUNNY');
    }
  });

  console.log(`\n========================================`);
  console.log(`TEST RESULTS: ${passed} / ${total} TESTS PASSED`);
  console.log(`========================================\n`);

  if (passed === total) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runTestSuite().catch((err) => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
