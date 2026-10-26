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
        } catch (e) {
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
  console.log('🧪 Starting FormCraft Admin Authentication Test Suite...\n');
  let token = null;
  let cookie = null;

  // Test 1: Empty credentials rejection
  console.log('Test 1: Empty credentials validation');
  const res1 = await request({
    hostname: 'localhost',
    port: 3001,
    path: '/api/admin/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  }, {});
  if (res1.statusCode === 400 && res1.body.success === false) {
    console.log('  ✅ Passed: Rejected empty credentials with 400.');
  } else {
    console.error('  ❌ Failed Test 1:', res1.statusCode, res1.body);
    process.exit(1);
  }

  // Test 2: Invalid password
  console.log('\nTest 2: Incorrect password rejection');
  const res2 = await request({
    hostname: 'localhost',
    port: 3001,
    path: '/api/admin/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  }, { email: 'admin@gmail.com', password: 'WrongPassword!123' });
  if (res2.statusCode === 401 && res2.body.success === false) {
    console.log('  ✅ Passed: Rejected incorrect password with 401.');
  } else {
    console.error('  ❌ Failed Test 2:', res2.statusCode, res2.body);
    process.exit(1);
  }

  // Test 3: Non-existent user
  console.log('\nTest 3: Non-existent email rejection');
  const res3 = await request({
    hostname: 'localhost',
    port: 3001,
    path: '/api/admin/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  }, { email: 'nobody@hospital.org', password: 'SomePassword123' });
  if (res3.statusCode === 401 && res3.body.success === false) {
    console.log('  ✅ Passed: Rejected unknown email with 401 without leaking existence.');
  } else {
    console.error('  ❌ Failed Test 3:', res3.statusCode, res3.body);
    process.exit(1);
  }

  // Test 4: Valid login against Oracle ADMIN_USERS
  console.log('\nTest 4: Valid authentication against Oracle ADMIN_USERS (admin@gmail.com / Admin@123)');
  const res4 = await request({
    hostname: 'localhost',
    port: 3001,
    path: '/api/admin/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  }, { email: 'admin@gmail.com', password: 'Admin@123' });
  
  if (res4.statusCode === 200 && res4.body.success === true && res4.body.admin) {
    token = res4.body.token;
    const setCookie = res4.headers['set-cookie'];
    if (setCookie && setCookie.length > 0) {
      cookie = setCookie[0].split(';')[0];
    }
    console.log('  ✅ Passed: Successfully authenticated against Oracle.');
    console.log('  ✅ Passed: Admin profile returned:', JSON.stringify(res4.body.admin));
    if (!res4.body.admin.password && !res4.body.admin.PASSWORD) {
      console.log('  ✅ Passed: Password hash is strictly excluded from response.');
    } else {
      console.error('  ❌ Failed: Password hash leaked in response!');
      process.exit(1);
    }
    if (cookie && cookie.startsWith('admin_token=')) {
      console.log('  ✅ Passed: Set-Cookie header contains admin_token.');
    } else {
      console.error('  ❌ Failed: Missing admin_token cookie in response header.');
      process.exit(1);
    }
  } else {
    console.error('  ❌ Failed Test 4:', res4.statusCode, res4.body);
    process.exit(1);
  }

  // Test 5: Protected session verification via GET /api/admin/me
  console.log('\nTest 5: Protected session check via GET /api/admin/me using Cookie');
  const res5 = await request({
    hostname: 'localhost',
    port: 3001,
    path: '/api/admin/me',
    method: 'GET',
    headers: {
      Cookie: cookie,
    },
  });
  if (res5.statusCode === 200 && res5.body.success === true && res5.body.admin.email === 'admin@gmail.com') {
    console.log('  ✅ Passed: Session verified via HttpOnly cookie:', res5.body.admin.name);
  } else {
    console.error('  ❌ Failed Test 5:', res5.statusCode, res5.body);
    process.exit(1);
  }

  // Test 6: Protected session verification via Bearer token
  console.log('\nTest 6: Protected session check via GET /api/admin/me using Authorization Bearer');
  const res6 = await request({
    hostname: 'localhost',
    port: 3001,
    path: '/api/admin/me',
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  if (res6.statusCode === 200 && res6.body.success === true && res6.body.admin.email === 'admin@gmail.com') {
    console.log('  ✅ Passed: Session verified via Bearer header.');
  } else {
    console.error('  ❌ Failed Test 6:', res6.statusCode, res6.body);
    process.exit(1);
  }

  // Test 7: Unauthenticated request to protected endpoint rejected
  console.log('\nTest 7: Unauthenticated access rejection');
  const res7 = await request({
    hostname: 'localhost',
    port: 3001,
    path: '/api/admin/me',
    method: 'GET',
  });
  if (res7.statusCode === 401 && res7.body.success === false) {
    console.log('  ✅ Passed: Unauthenticated request correctly rejected with 401.');
  } else {
    console.error('  ❌ Failed Test 7:', res7.statusCode, res7.body);
    process.exit(1);
  }

  // Test 8: Admin Dashboard statistics endpoint GET /api/admin/stats
  console.log('\nTest 8: Dashboard stats retrieval via GET /api/admin/stats');
  const res8 = await request({
    hostname: 'localhost',
    port: 3001,
    path: '/api/admin/stats',
    method: 'GET',
    headers: {
      Cookie: cookie,
    },
  });
  if (res8.statusCode === 200 && res8.body.success === true && res8.body.stats) {
    console.log('  ✅ Passed: Dashboard statistics returned:', JSON.stringify(res8.body.stats, null, 2));
  } else {
    console.error('  ❌ Failed Test 8:', res8.statusCode, res8.body);
    process.exit(1);
  }

  // Test 9: Secure logout via POST /api/admin/logout
  console.log('\nTest 9: Logout and session invalidation via POST /api/admin/logout');
  const res9 = await request({
    hostname: 'localhost',
    port: 3001,
    path: '/api/admin/logout',
    method: 'POST',
    headers: {
      Cookie: cookie,
    },
  });
  if (res9.statusCode === 200 && res9.body.success === true) {
    console.log('  ✅ Passed: Logout succeeded.');
  } else {
    console.error('  ❌ Failed Test 9:', res9.statusCode, res9.body);
    process.exit(1);
  }

  // Test 10: Revoked session rejection after logout
  console.log('\nTest 10: Verification that revoked session cannot be reused');
  const res10 = await request({
    hostname: 'localhost',
    port: 3001,
    path: '/api/admin/me',
    method: 'GET',
    headers: {
      Cookie: cookie,
      Authorization: `Bearer ${token}`,
    },
  });
  if (res10.statusCode === 401 && res10.body.success === false) {
    console.log('  ✅ Passed: Revoked session was rejected with 401.');
  } else {
    console.error('  ❌ Failed Test 10: Revoked session was still accepted!', res10.statusCode, res10.body);
    process.exit(1);
  }

  console.log('\n🎉 ALL 10 ADMIN AUTHENTICATION TESTS PASSED PERFECTLY!\n');
}

runTests().catch((err) => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
