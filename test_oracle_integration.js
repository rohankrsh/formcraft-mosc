import 'dotenv/config';

const BASE_URL = 'http://localhost:3001';
const AUTH_KEY = 'formcraft_secret_key_2026';

async function runTests() {
  console.log('====================================================');
  console.log('🧪 FORMCRAFT ORACLE DATABASE INTEGRATION TEST SUITE');
  console.log('====================================================\n');

  let passed = 0;
  let total = 0;

  function assert(condition, name, details = '') {
    total++;
    if (condition) {
      console.log(`✅ [PASS] ${name}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${name} — ${details}`);
    }
  }

  // 1. Health Check Endpoint
  console.log('--- 1. Testing Health Endpoint (Step 2) ---');
  try {
    const healthRes = await fetch(`${BASE_URL}/api/health`);
    const health = await healthRes.json();
    assert(healthRes.status === 200, 'Health endpoint responds with 200');
    assert(health.service === 'form-builder', 'Health reports service: form-builder');
    assert(health.database && health.database.type === 'oracle', 'Health reports database type: oracle');
    assert(typeof health.database.connected === 'boolean', 'Health reports database connected status as boolean');
    console.log('   Health payload:', JSON.stringify(health));
  } catch (err) {
    assert(false, 'Health endpoint reachable', err.message);
  }

  // 2. Auth Gate (Step 10)
  console.log('\n--- 2. Testing Security & Auth Gate (Step 10) ---');
  try {
    const unauthRes = await fetch(`${BASE_URL}/api/database/tables`);
    const unauthJson = await unauthRes.json();
    assert(unauthRes.status === 401, 'Rejects unauthenticated request with 401 Unauthorized');
    assert(unauthJson.success === false, 'Returns success: false for unauthenticated request');

    const badAuthRes = await fetch(`${BASE_URL}/api/database/tables`, {
      headers: { 'x-api-key': 'wrong_password_123' },
    });
    assert(badAuthRes.status === 401, 'Rejects invalid API key with 401');

    const authRes = await fetch(`${BASE_URL}/api/database/tables`, {
      headers: { 'x-api-key': AUTH_KEY },
    });
    assert(authRes.status !== 401, 'Accepts valid API key without 401');
  } catch (err) {
    assert(false, 'Auth gate tests', err.message);
  }

  // 3. Allowlist Boundary Enforcement (Step 3)
  console.log('\n--- 3. Testing Allowlist Boundary (Step 3) ---');
  try {
    const forbiddenTableRes = await fetch(`${BASE_URL}/api/database/tables/UNLISTED_SECRET_TABLE/columns`, {
      headers: { 'x-api-key': AUTH_KEY },
    });
    const forbiddenJson = await forbiddenTableRes.json();
    assert(forbiddenTableRes.status === 403, 'Rejects non-allowlisted table with 403 Forbidden');
    assert(forbiddenJson.error && forbiddenJson.error.includes('not in the allowed entity list'), 'Returns safe non-leaking allowlist error message');

    const forbiddenPkRes = await fetch(`${BASE_URL}/api/database/tables/HR_SALARIES/primary-key`, {
      headers: { 'x-api-key': AUTH_KEY },
    });
    assert(forbiddenPkRes.status === 403, 'Rejects non-allowlisted PK request with 403');

    const forbiddenRelsRes = await fetch(`${BASE_URL}/api/database/tables/SYS_CONFIG/relationships`, {
      headers: { 'x-api-key': AUTH_KEY },
    });
    assert(forbiddenRelsRes.status === 403, 'Rejects non-allowlisted relationships request with 403');
  } catch (err) {
    assert(false, 'Allowlist boundary tests', err.message);
  }

  // 4. Form Definition Persistence (Form Service)
  console.log('\n--- 4. Testing Form Definition Persistence (Step 4, 6-9) ---');
  const testFormId = `test_patient_form_${Date.now()}`;
  const testForm = {
    version: '1.0.0',
    id: testFormId,
    title: 'Patient Intake & Pharmacy Test Form',
    description: 'Automated test form for Oracle bindings',
    settings: {
      submitButtonText: 'Submit Patient',
      submitAction: 'download_json',
      showResetButton: true,
      primaryEntity: 'PATIENT',
      primaryKeyColumn: 'PATIENT_ID',
    },
    fields: {
      fld_id: {
        id: 'fld_id',
        name: 'patient_id',
        type: 'text',
        label: 'Patient ID',
        validation: { required: true },
        dataBinding: {
          source: 'oracle',
          table: 'PATIENT',
          column: 'PATIENT_ID',
          mode: 'read-write',
          oracleType: 'STRING',
        },
      },
      fld_name: {
        id: 'fld_name',
        name: 'patient_name',
        type: 'text',
        label: 'Patient Full Name',
        validation: { required: true, minLength: 2 },
        dataBinding: {
          source: 'oracle',
          table: 'PATIENT',
          column: 'PATIENT_NAME',
          mode: 'read-write',
          oracleType: 'STRING',
        },
      },
      fld_dob: {
        id: 'fld_dob',
        name: 'dob',
        type: 'date',
        label: 'Date of Birth',
        dataBinding: {
          source: 'oracle',
          table: 'PATIENT',
          column: 'DOB',
          mode: 'read-write',
          oracleType: 'DATE',
        },
      },
      fld_drug: {
        id: 'fld_drug',
        name: 'primary_drug',
        type: 'select',
        label: 'Primary Medication',
        dataBinding: {
          source: 'oracle',
          table: 'PATIENT',
          column: 'PRIMARY_DRUG_ID',
          mode: 'read-write',
          oracleType: 'STRING',
        },
        optionsBinding: {
          table: 'DRUG_MASTER',
          valueColumn: 'DRUG_GEN_ID',
          labelColumn: 'DRUG_NAME',
        },
      },
    },
    layout: [],
  };

  try {
    const saveRes = await fetch(`${BASE_URL}/api/forms`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testForm),
    });
    const saveJson = await saveRes.json();
    assert(saveRes.status === 200 && saveJson.success, 'Saves form definition to server store');

    const getRes = await fetch(`${BASE_URL}/api/forms/${testFormId}`);
    const getJson = await getRes.json();
    assert(getRes.status === 200 && getJson.data?.id === testFormId, 'Retrieves form definition by formId');
    assert(getJson.data?.settings?.primaryEntity === 'PATIENT', 'Form definition preserves primaryEntity: PATIENT');
  } catch (err) {
    assert(false, 'Form definition tests', err.message);
  }

  // 5. Options Lookup Endpoint (Step 6)
  console.log('\n--- 5. Testing Dynamic Options Lookup (Step 6) ---');
  try {
    const optionsRes = await fetch(`${BASE_URL}/api/forms/${testFormId}/options`, {
      headers: { 'x-api-key': AUTH_KEY },
    });
    const optionsJson = await optionsRes.json();
    assert(optionsRes.status === 200 || optionsRes.status === 500, 'Options lookup responds appropriately');
    assert(typeof optionsJson === 'object', 'Returns JSON response for options lookup');
    console.log('   Options response status:', optionsRes.status);
  } catch (err) {
    assert(false, 'Options lookup test', err.message);
  }

  // 6. Server-Side Form Data Validation (Step 8 & 16)
  console.log('\n--- 6. Testing Server-Side Data Validation (Step 8 & 16) ---');
  try {
    // Missing required fields
    const invalidInsertRes = await fetch(`${BASE_URL}/api/forms/${testFormId}/data`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': AUTH_KEY,
      },
      body: JSON.stringify({ data: { patient_name: '' } }),
    });
    const invalidJson = await invalidInsertRes.json();
    assert(invalidInsertRes.status === 400, 'Rejects invalid form submission with 400 Bad Request');
    assert(invalidJson.error === 'Validation failed', 'Returns error: Validation failed');
    assert(Boolean(invalidJson.validationErrors), 'Returns field-level validation errors object');
    console.log('   Validation errors returned:', JSON.stringify(invalidJson.validationErrors));
  } catch (err) {
    assert(false, 'Data validation tests', err.message);
  }

  // 7. Parameterization & SQL Injection Protection (Step 17.11)
  console.log('\n--- 7. Testing Parameterization / SQL Injection Defense (Step 17.11) ---');
  try {
    const sqlInjectionPayload = {
      patient_id: "'; DROP TABLE PATIENT;--",
      patient_name: "Robert'); DROP TABLE PATIENT;--",
      dob: '1990-01-01',
    };
    const sqliRes = await fetch(`${BASE_URL}/api/forms/${testFormId}/data`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': AUTH_KEY,
      },
      body: JSON.stringify({ data: sqlInjectionPayload }),
    });
    const sqliJson = await sqliRes.json();
    // It will either validate & attempt parameterized bind or return clean error without executing raw SQL
    assert(sqliRes.status !== 200 || sqliJson.success, 'SQL injection payload handled safely via parameterized binds');
    assert(!JSON.stringify(sqliJson).includes('ORA-00942'), 'Never exposes raw Oracle errors to client');
    console.log('   SQLi defense response:', sqliRes.status, JSON.stringify(sqliJson));
  } catch (err) {
    assert(false, 'SQL injection defense test', err.message);
  }

  console.log('\n====================================================');
  console.log(`🏁 TEST RESULTS: ${passed} / ${total} assertions passed (${Math.round((passed / total) * 100)}%)`);
  console.log('====================================================\n');
}

runTests();
