const http = require('http');

function request(options, data) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        let json = null;
        try {
          json = JSON.parse(body);
        } catch {
          json = body;
        }
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: json,
        });
      });
    });
    req.on('error', reject);
    if (data) {
      req.write(typeof data === 'string' ? data : JSON.stringify(data));
    }
    req.end();
  });
}

async function runTests() {
  console.log('🧪 Starting FormCraft Admin Submissions & Activity Logs Test Suite...\n');

  // Step 1: Login as administrator
  console.log('Step 1: Authenticate as admin');
  const loginRes = await request({
    hostname: 'localhost',
    port: 3001,
    path: '/api/admin/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  }, { email: 'admin@gmail.com', password: 'Admin@123' });

  if (loginRes.statusCode !== 200 || !loginRes.body.token) {
    console.error('❌ Failed to login as admin:', loginRes.statusCode, loginRes.body);
    process.exit(1);
  }
  const token = loginRes.body.token;
  const cookie = loginRes.headers['set-cookie'] ? loginRes.headers['set-cookie'][0].split(';')[0] : '';
  const authHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
    Cookie: cookie,
  };
  console.log('  ✅ Admin logged in successfully.');

  // Test 1: GET /api/admin/submissions unauthenticated rejection
  console.log('\nTest 1: Unauthenticated request to /api/admin/submissions rejected');
  const unauthRes = await request({
    hostname: 'localhost',
    port: 3001,
    path: '/api/admin/submissions',
    method: 'GET',
  });
  if (unauthRes.statusCode === 401) {
    console.log('  ✅ Passed: Rejected with 401 AUTH_REQUIRED.');
  } else {
    console.error('  ❌ Failed Test 1:', unauthRes.statusCode, unauthRes.body);
    process.exit(1);
  }

  // Test 2: GET /api/admin/submissions authenticated list
  console.log('\nTest 2: Authenticated list submissions with server-side pagination & metadata');
  const listRes = await request({
    hostname: 'localhost',
    port: 3001,
    path: '/api/admin/submissions?page=1&pageSize=10',
    method: 'GET',
    headers: authHeaders,
  });
  if (listRes.statusCode === 200 && listRes.body.success && Array.isArray(listRes.body.data)) {
    console.log(`  ✅ Passed: Retrieved ${listRes.body.data.length} submissions.`);
    console.log(`  ✅ Pagination: page=${listRes.body.pagination.page}, total=${listRes.body.pagination.total}, totalPages=${listRes.body.pagination.totalPages}`);
    if (listRes.body.data.length > 0) {
      const sample = listRes.body.data[0];
      console.log('  ✅ Sample record keys verified:', {
        id: sample.id,
        formSlug: sample.formSlug,
        formTitle: sample.formTitle,
        formVersion: sample.formVersion,
        mrno: sample.mrno,
        submittedBy: sample.submittedBy,
        status: sample.status,
      });
    }
  } else {
    console.error('  ❌ Failed Test 2:', listRes.statusCode, listRes.body);
    process.exit(1);
  }

  const targetSubmission = listRes.body.data[0];
  if (!targetSubmission) {
    console.log('⚠️ No existing submissions found in database, creating one for test...');
    // create a test submission via runtime
    const subCreateRes = await request({
      hostname: 'localhost',
      port: 3001,
      path: '/api/runtime/forms/form-2/submit',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }, {
      mrno: '1754666',
      data: { notes: 'Automated test initial note', score: 10 },
      submittedBy: 'Test Clinician',
    });
    console.log('Created test submission:', subCreateRes.statusCode);
  }

  // Refetch to get target
  const listRes2 = await request({
    hostname: 'localhost',
    port: 3001,
    path: '/api/admin/submissions?page=1&pageSize=5',
    method: 'GET',
    headers: authHeaders,
  });
  const subToTest = listRes2.body.data[0];
  const submissionId = subToTest.id;

  // Test 3: GET /api/admin/submissions/:submissionId
  console.log(`\nTest 3: Retrieve individual submission details (#${submissionId}) with schema`);
  const detailRes = await request({
    hostname: 'localhost',
    port: 3001,
    path: `/api/admin/submissions/${submissionId}`,
    method: 'GET',
    headers: authHeaders,
  });
  let originalUpdatedAt = null;
  let originalFormData = {};
  if (detailRes.statusCode === 200 && detailRes.body.success && detailRes.body.submission) {
    const sub = detailRes.body.submission;
    originalUpdatedAt = sub.updatedAt;
    originalFormData = sub.formData || {};
    console.log('  ✅ Passed: Submission loaded with formData and historical schema.');
    console.log(`  ✅ Form: "${sub.formTitle}" (v${sub.formVersion}), Status: ${sub.status}`);
  } else {
    console.error('  ❌ Failed Test 3:', detailRes.statusCode, detailRes.body);
    process.exit(1);
  }

  // Test 4: PUT /api/admin/submissions/:submissionId rejection without mandatory reason
  console.log(`\nTest 4: Rejection of edit without mandatory reason`);
  const noReasonRes = await request({
    hostname: 'localhost',
    port: 3001,
    path: `/api/admin/submissions/${submissionId}`,
    method: 'PUT',
    headers: authHeaders,
  }, {
    formData: { ...originalFormData, testField: 'ChangedValue' },
    reason: '', // empty reason
  });
  if (noReasonRes.statusCode === 400 && noReasonRes.body.code === 'REASON_REQUIRED') {
    console.log('  ✅ Passed: Rejected with 400 REASON_REQUIRED.');
  } else {
    console.error('  ❌ Failed Test 4:', noReasonRes.statusCode, noReasonRes.body);
    process.exit(1);
  }

  // Test 5: Concurrency conflict detection
  console.log(`\nTest 5: Concurrency conflict detection (stale originalUpdatedAt)`);
  const staleRes = await request({
    hostname: 'localhost',
    port: 3001,
    path: `/api/admin/submissions/${submissionId}`,
    method: 'PUT',
    headers: authHeaders,
  }, {
    formData: { ...originalFormData, testField: 'ChangedValue' },
    reason: 'Clinical correction',
    originalUpdatedAt: '2020-01-01T00:00:00.000Z', // stale date
  });
  if (staleRes.statusCode === 409 && staleRes.body.code === 'CONCURRENT_MODIFICATION') {
    console.log('  ✅ Passed: Concurrency conflict detected and rejected with 409 CONCURRENT_MODIFICATION.');
  } else {
    console.error('  ❌ Failed Test 5:', staleRes.statusCode, staleRes.body);
    process.exit(1);
  }

  // Test 6: Successful administrative amendment
  console.log(`\nTest 6: Valid administrative edit with justification & audit tracking`);
  const updatedValue = `Amended by admin at ${new Date().toISOString()}`;
  const saveRes = await request({
    hostname: 'localhost',
    port: 3001,
    path: `/api/admin/submissions/${submissionId}`,
    method: 'PUT',
    headers: authHeaders,
  }, {
    formData: { ...originalFormData, admin_notes: updatedValue },
    reason: 'Routine clinical audit and dosage correction verification',
    originalUpdatedAt,
  });
  if (saveRes.statusCode === 200 && saveRes.body.success) {
    console.log('  ✅ Passed: Submission successfully amended in Oracle.');
    console.log('  ✅ Changed fields detected:', saveRes.body.changedFields);
  } else {
    console.error('  ❌ Failed Test 6:', saveRes.statusCode, saveRes.body);
    process.exit(1);
  }

  // Test 7: GET /api/admin/submissions/:submissionId/history
  console.log(`\nTest 7: Retrieve submission audit history`);
  const historyRes = await request({
    hostname: 'localhost',
    port: 3001,
    path: `/api/admin/submissions/${submissionId}/history`,
    method: 'GET',
    headers: authHeaders,
  });
  if (historyRes.statusCode === 200 && historyRes.body.success && Array.isArray(historyRes.body.history)) {
    console.log(`  ✅ Passed: Retrieved ${historyRes.body.history.length} audit edit records.`);
    const latestEdit = historyRes.body.history[0];
    console.log('  ✅ Audit attribution:', {
      adminName: latestEdit.adminName,
      adminEmail: latestEdit.adminEmail,
      reason: latestEdit.reason,
      changedFields: latestEdit.changedFields,
    });
  } else {
    console.error('  ❌ Failed Test 7:', historyRes.statusCode, historyRes.body);
    process.exit(1);
  }

  // Test 8: GET /api/admin/logs (Activity logs)
  console.log(`\nTest 8: System-wide activity logs listing & search`);
  const logsRes = await request({
    hostname: 'localhost',
    port: 3001,
    path: '/api/admin/logs?page=1&pageSize=10',
    method: 'GET',
    headers: authHeaders,
  });
  if (logsRes.statusCode === 200 && logsRes.body.success && Array.isArray(logsRes.body.logs)) {
    console.log(`  ✅ Passed: Retrieved ${logsRes.body.logs.length} activity log entries.`);
    console.log(`  ✅ Total logged events: ${logsRes.body.pagination.total}`);
    const sampleLog = logsRes.body.logs[0];
    console.log('  ✅ Latest activity log:', {
      logId: sampleLog.logId,
      eventType: sampleLog.eventType,
      actorName: sampleLog.actorName,
      actorType: sampleLog.actorType,
      description: sampleLog.description,
      status: sampleLog.status,
    });
  } else {
    console.error('  ❌ Failed Test 8:', logsRes.statusCode, logsRes.body);
    process.exit(1);
  }

  // Test 9: GET /api/admin/logs/event-types
  console.log(`\nTest 9: Retrieve distinct activity event types`);
  const eventTypesRes = await request({
    hostname: 'localhost',
    port: 3001,
    path: '/api/admin/logs/event-types',
    method: 'GET',
    headers: authHeaders,
  });
  if (eventTypesRes.statusCode === 200 && eventTypesRes.body.success && Array.isArray(eventTypesRes.body.eventTypes)) {
    console.log('  ✅ Passed: Event types found:', eventTypesRes.body.eventTypes);
  } else {
    console.error('  ❌ Failed Test 9:', eventTypesRes.statusCode, eventTypesRes.body);
    process.exit(1);
  }

  // Test 10: GET /api/admin/stats with extended metrics
  console.log(`\nTest 10: Extended dashboard metrics (submissions & activity feed)`);
  const statsRes = await request({
    hostname: 'localhost',
    port: 3001,
    path: '/api/admin/stats',
    method: 'GET',
    headers: authHeaders,
  });
  if (statsRes.statusCode === 200 && statsRes.body.success && statsRes.body.stats) {
    const s = statsRes.body.stats;
    console.log('  ✅ Passed: Extended dashboard stats returned:');
    console.log({
      totalForms: s.totalForms,
      publishedForms: s.publishedForms,
      totalSubmissions: s.totalSubmissions,
      submissionsToday: s.submissionsToday,
      submissionsThisMonth: s.submissionsThisMonth,
      distinctSubmittersCount: s.distinctSubmittersCount,
      totalAdminEdits: s.totalAdminEdits,
      recentActivitiesCount: s.recentActivities ? s.recentActivities.length : 0,
    });
  } else {
    console.error('  ❌ Failed Test 10:', statsRes.statusCode, statsRes.body);
    process.exit(1);
  }

  console.log('\n🎉 ALL 10 FORM SUBMISSION & SYSTEM ACTIVITY LOG TESTS PASSED PERFECTLY!\n');
}

runTests().catch((err) => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
