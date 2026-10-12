import assert from 'assert';

const BASE_URL = 'http://localhost:3001';
const VITE_URL = 'http://localhost:5174';

function logPass(msg) {
  console.log(`✅ [PASS] ${msg}`);
}

function logFail(msg, err) {
  console.error(`❌ [FAIL] ${msg}:`, err);
}

async function runTests() {
  console.log('======================================================================');
  console.log('🧪 FORMCRAFT PATIENT URL FILTERS & DATABASE PERSISTENCE TEST SUITE');
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

  // 1. Default Behavior (No filters)
  console.log('--- 1. Testing Default Patients Route (No filters) ---');
  await check('/api/patients returns default patient list without filters', async () => {
    const res = await fetch(`${BASE_URL}/api/patients`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert(data.total > 0, `Expected total > 0, got ${data.total}`);
    assert(data.patients.length > 0, 'Expected patients array with items');
    assert.strictEqual(data.page, 1);
  });

  // 2. Department-only filter by name
  console.log('\n--- 2. Testing Department Filter (Name & ID) ---');
  await check('/api/patients?department=CARDIOLOGY filters by department name only', async () => {
    const res = await fetch(`${BASE_URL}/api/patients?department=CARDIOLOGY`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert(data.total > 0, `Expected cardiology patients > 0, got ${data.total}`);
    for (const p of data.patients) {
      assert.strictEqual(p.departmentName.toUpperCase(), 'CARDIOLOGY', `Expected CARDIOLOGY, got ${p.departmentName}`);
    }
  });

  await check('/api/patients?department=51 filters by department numeric ID', async () => {
    const res = await fetch(`${BASE_URL}/api/patients?department=51`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert(data.total > 0, 'Expected matching patients for dept 51');
    for (const p of data.patients) {
      assert.strictEqual(p.departmentName.toUpperCase(), 'CARDIOLOGY');
    }
  });

  // 3. Service Center-only filter by name
  console.log('\n--- 3. Testing Service Center Filter (Name & ID) ---');
  await check('/api/patients?serviceCenter=CARDIOLOGY%20ICU filters by service center name only', async () => {
    const res = await fetch(`${BASE_URL}/api/patients?serviceCenter=CARDIOLOGY%20ICU`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert(data.total > 0, 'Expected service center patients > 0');
    for (const p of data.patients) {
      assert.strictEqual(p.serviceCenter.toUpperCase(), 'CARDIOLOGY ICU');
    }
  });

  await check('/api/patients?serviceCenter=294 filters by service center numeric ID', async () => {
    const res = await fetch(`${BASE_URL}/api/patients?serviceCenter=294`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert(data.total > 0, 'Expected service center patients > 0');
    for (const p of data.patients) {
      assert.strictEqual(p.serviceCenter.toUpperCase(), 'CARDIOLOGY ICU');
    }
  });

  // 4. Combined Department and Service Center filter
  console.log('\n--- 4. Testing Combined Department and Service Center Filters ---');
  await check('/api/patients?department=CARDIOLOGY&serviceCenter=CARDIOLOGY%20ICU matches intersection', async () => {
    const res = await fetch(`${BASE_URL}/api/patients?department=CARDIOLOGY&serviceCenter=CARDIOLOGY%20ICU`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert(data.total > 0, 'Expected combined patients > 0');
    for (const p of data.patients) {
      assert.strictEqual(p.departmentName.toUpperCase(), 'CARDIOLOGY');
      assert.strictEqual(p.serviceCenter.toUpperCase(), 'CARDIOLOGY ICU');
    }
  });

  // 5. Unmatched combination (e.g. CARDIOLOGY + OPD) returns empty list without error
  console.log('\n--- 5. Testing Unmatched / Nonexistent Filters (Empty State) ---');
  await check('/api/patients?department=CARDIOLOGY&serviceCenter=OPD returns empty array (total: 0)', async () => {
    const res = await fetch(`${BASE_URL}/api/patients?department=CARDIOLOGY&serviceCenter=OPD`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.total, 0);
    assert.strictEqual(data.patients.length, 0);
  });

  await check('/api/patients?department=NONEXISTENT_DEPT returns empty array gracefully', async () => {
    const res = await fetch(`${BASE_URL}/api/patients?department=NONEXISTENT_DEPT`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.total, 0);
    assert.strictEqual(data.patients.length, 0);
  });

  // 6. Search and Pagination while retaining filters
  console.log('\n--- 6. Testing Search & Pagination with Active Filters ---');
  await check('/api/patients?department=CARDIOLOGY&search=KARUNAKARAN preserves department and filters by search', async () => {
    const res = await fetch(`${BASE_URL}/api/patients?department=CARDIOLOGY&search=KARUNAKARAN`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert(data.total > 0, 'Expected matching search patient in CARDIOLOGY');
    for (const p of data.patients) {
      assert.strictEqual(p.departmentName.toUpperCase(), 'CARDIOLOGY');
      assert(p.patientName.toUpperCase().includes('KARUNAKARAN'));
    }
  });

  await check('/api/patients?department=CARDIOLOGY&page=2&limit=5 returns page 2 with CARDIOLOGY records', async () => {
    const res = await fetch(`${BASE_URL}/api/patients?department=CARDIOLOGY&page=2&limit=5`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.page, 2);
    assert.strictEqual(data.limit, 5);
    assert(data.patients.length > 0 && data.patients.length <= 5);
    for (const p of data.patients) {
      assert.strictEqual(p.departmentName.toUpperCase(), 'CARDIOLOGY');
    }
  });

  // 7. SQL Injection and Malformed Parameters
  console.log('\n--- 7. Testing Parameter Safety & SQL Injection Defense ---');
  await check('SQL injection payload in department parameter is safely bound and rejected', async () => {
    const payload = encodeURIComponent("' OR 1=1 --");
    const res = await fetch(`${BASE_URL}/api/patients?department=${payload}`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.total, 0);
    assert.strictEqual(data.patients.length, 0);
  });

  // 8. Vite Proxy Integration
  console.log('\n--- 8. Testing Vite Dev Server Proxy Integration ---');
  await check('Vite proxy on http://localhost:5174/api/patients forwards query params', async () => {
    const res = await fetch(`${VITE_URL}/api/patients?department=CARDIOLOGY&serviceCenter=CARDIOLOGY%20ICU`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert(data.total > 0, 'Expected patients via Vite proxy');
    for (const p of data.patients) {
      assert.strictEqual(p.departmentName.toUpperCase(), 'CARDIOLOGY');
      assert.strictEqual(p.serviceCenter.toUpperCase(), 'CARDIOLOGY ICU');
    }
  });

  console.log('\n======================================================================');
  console.log(`🎉 TEST SUMMARY: ${passed} passed, ${failed} failed`);
  console.log('======================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
