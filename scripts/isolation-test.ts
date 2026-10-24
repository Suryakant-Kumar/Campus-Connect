import assert from 'assert';
import crypto from 'crypto';

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  expectedStatus?: number;
  actualStatus?: number;
}

const results: TestResult[] = [];

async function recordTest(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    results.push({ name, passed: true });
    console.log(`  ✅ PASS: ${name}`);
  } catch (err: any) {
    results.push({
      name,
      passed: false,
      error: err.message,
      expectedStatus: err.expectedStatus,
      actualStatus: err.actualStatus,
    });
    console.error(`  ❌ FAIL: ${name}`);
    console.error(`     Reason: ${err.message}`);
  }
}

async function request(
  baseUrl: string,
  path: string,
  options: {
    method?: string;
    token?: string;
    body?: any;
    headers?: Record<string, string>;
  } = {}
): Promise<{ status: number; data: any; headers: Headers }> {
  const url = `${baseUrl}${path}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  if (options.token) {
    headers['Authorization'] = `Bearer ${options.token}`;
  }

  const res = await fetch(url, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const text = await res.text();
  let data: any = null;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }

  return {
    status: res.status,
    data,
    headers: res.headers,
  };
}

async function resolveBaseUrl(): Promise<string> {
  const testUrl = 'http://127.0.0.1:3000';
  try {
    const res = await fetch(`${testUrl}/api/health`, { signal: AbortSignal.timeout(1500) });
    if (res.ok) {
      console.log(`[Isolation Test] Connecting to running server at ${testUrl}`);
      return testUrl;
    }
  } catch {
    // Port 3000 not responding, launch server on port 3001
  }

  console.log('[Isolation Test] Port 3000 not active. Spawning internal test server...');
  const { app } = await import('../server.js');
  return new Promise((resolve) => {
    const server = app.listen(0, '127.0.0.1', () => {
      const addr = server.address() as any;
      const url = `http://127.0.0.1:${addr.port}`;
      console.log(`[Isolation Test] Spawned test server at ${url}`);
      resolve(url);
    });
  });
}

function createExpiredToken(payload: any, secret: string = 'campusconnect-secure-hmac-secret-salt-2026-production'): string {
  const expiredPayload = {
    ...payload,
    iat: Math.floor(Date.now() / 1000) - 7200,
    exp: Math.floor(Date.now() / 1000) - 3600, // expired 1 hour ago
  };

  const payloadB64 = Buffer.from(JSON.stringify(expiredPayload)).toString('base64url');
  const signature = crypto.createHmac('sha256', secret).update(payloadB64).digest('base64url');
  return `${payloadB64}.${signature}`;
}

async function runIsolationTestSuite() {
  console.log('\n======================================================');
  console.log('🛡️  RUNNING CAMPUSCONNECT MULTI-TENANT ISOLATION TESTS');
  console.log('======================================================\n');

  const baseUrl = await resolveBaseUrl();
  const timestamp = Date.now();

  // Test setup identifiers
  const slugA = `iso-campus-a-${timestamp}`;
  const slugB = `iso-campus-b-${timestamp}`;

  let tokenAdminA: string = '';
  let tokenAdminB: string = '';
  let campusA: any = null;
  let campusB: any = null;

  let tokenUserA: string = '';
  let userA: any = null;
  let tokenUserB: string = '';
  let userB: any = null;

  let tokenWorkerA: string = '';
  let workerA: any = null;

  let issueA: any = null;
  let issueB: any = null;

  console.log('--- Phase 1: Setup Campuses, Admins, Users, and Roles ---');

  await recordTest('Main Site: Admin registers, provisions Campus A with safe unique slug', async () => {
    const res = await request(baseUrl, '/api/auth/register-admin-and-campus', {
      method: 'POST',
      body: {
        adminName: 'Admin Alpha',
        adminEmail: `admin-a-${timestamp}@alpha.edu`,
        adminPassword: 'Password123!',
        campusName: 'Campus Alpha University',
        campusType: 'university',
        city: 'Boston',
        campusSlug: slugA,
      },
    });

    assert.equal(res.status, 201, `Expected status 201, got ${res.status}: ${JSON.stringify(res.data)}`);
    assert.ok(res.data.token, 'Token must be issued');
    assert.equal(res.data.user.role, 'admin', 'User must have role admin');
    assert.ok(res.data.campusLink, 'Must return campus link');
    tokenAdminA = res.data.token;
    campusA = res.data.campus;
  });

  await recordTest('Main Site: Admin registers, provisions Campus B with safe unique slug', async () => {
    const res = await request(baseUrl, '/api/auth/register-admin-and-campus', {
      method: 'POST',
      body: {
        adminName: 'Admin Beta',
        adminEmail: `admin-b-${timestamp}@beta.edu`,
        adminPassword: 'Password123!',
        campusName: 'Campus Beta College',
        campusType: 'university',
        city: 'Seattle',
        campusSlug: slugB,
      },
    });

    assert.equal(res.status, 201, `Expected status 201, got ${res.status}`);
    tokenAdminB = res.data.token;
    campusB = res.data.campus;
  });

  await recordTest('Main Site: Rejects registration with reserved slug names (admin, api, www, platform)', async () => {
    for (const reserved of ['admin', 'api', 'www', 'platform']) {
      const res = await request(baseUrl, '/api/auth/register-admin-and-campus', {
        method: 'POST',
        body: {
          adminName: 'Bad Slug Admin',
          adminEmail: `bad-${reserved}-${timestamp}@example.com`,
          adminPassword: 'Password123!',
          campusName: 'Reserved Campus',
          campusType: 'university',
          city: 'Anywhere',
          campusSlug: reserved,
        },
      });
      assert.equal(res.status, 400, `Expected 400 for reserved slug "${reserved}", got ${res.status}`);
    }
  });

  await recordTest('Campus Link: User registers on Campus A link -> role is automatically "user"', async () => {
    const res = await request(baseUrl, '/api/auth/register-user', {
      method: 'POST',
      body: {
        name: 'Alice Student',
        email: `alice-${timestamp}@alpha.edu`,
        password: 'Password123!',
        campusSlug: slugA,
        department: 'Computer Science',
      },
    });

    assert.equal(res.status, 201, `Expected 201, got ${res.status}`);
    assert.equal(res.data.user.role, 'user', 'Public registration on campus link must yield role "user"');
    assert.equal(res.data.user.campusId, campusA.id);
    tokenUserA = res.data.token;
    userA = res.data.user;
  });

  await recordTest('Campus Link: User registers on Campus B link -> role is automatically "user"', async () => {
    const res = await request(baseUrl, '/api/auth/register-user', {
      method: 'POST',
      body: {
        name: 'Bob Student',
        email: `bob-${timestamp}@beta.edu`,
        password: 'Password123!',
        campusSlug: slugB,
      },
    });

    assert.equal(res.status, 201, `Expected 201, got ${res.status}`);
    assert.equal(res.data.user.role, 'user', 'Role must be "user"');
    assert.equal(res.data.user.campusId, campusB.id);
    tokenUserB = res.data.token;
    userB = res.data.user;
  });

  await recordTest('Admin creates Worker on Campus A', async () => {
    const res = await request(baseUrl, `/api/campus/${slugA}/staff`, {
      method: 'POST',
      token: tokenAdminA,
      body: {
        name: 'Alex Maintenance',
        email: `alex-worker-${timestamp}@alpha.edu`,
        password: 'Password123!',
        role: 'worker',
        department: 'Electrical',
      },
    });

    assert.equal(res.status, 201, `Expected 201, got ${res.status}`);
    assert.equal(res.data.staff.role, 'worker');
    workerA = res.data.staff;

    // Log in worker to get worker token
    const loginRes = await request(baseUrl, '/api/auth/login', {
      method: 'POST',
      body: {
        email: workerA.email,
        password: 'Password123!',
        campusSlug: slugA,
      },
    });
    assert.equal(loginRes.status, 200);
    tokenWorkerA = loginRes.data.token;
  });

  await recordTest('Create seed issues in Campus A and Campus B', async () => {
    const resA = await request(baseUrl, `/api/campus/${slugA}/issues`, {
      method: 'POST',
      token: tokenUserA,
      body: {
        title: 'Broken ceiling light in Lab 101',
        description: 'Fluorescent fixture is flickering and buzzing loudly.',
        category: 'Electricity',
        location: 'Room 101, Science Block',
      },
    });
    assert.equal(resA.status, 201);
    issueA = resA.data.issue;

    const resB = await request(baseUrl, `/api/campus/${slugB}/issues`, {
      method: 'POST',
      token: tokenUserB,
      body: {
        title: 'Water tap leaking in West Washroom',
        description: 'Sink faucet does not shut off completely, wasting water.',
        category: 'Plumbing',
        location: '2nd Floor West Washroom',
      },
    });
    assert.equal(resB.status, 201);
    issueB = resB.data.issue;
  });

  console.log('\n--- Phase 2: Campus Isolation Tests (Campus A cannot read or write Campus B) ---');

  await recordTest('Isolation: Campus A user cannot read Campus B issues (GET /api/campus/:slugB/issues -> 403)', async () => {
    const res = await request(baseUrl, `/api/campus/${slugB}/issues`, {
      token: tokenUserA,
    });
    assert.equal(res.status, 403, `Expected 403 Forbidden, got ${res.status}`);
  });

  await recordTest('Isolation: Campus A user cannot write issues to Campus B (POST /api/campus/:slugB/issues -> 403)', async () => {
    const res = await request(baseUrl, `/api/campus/${slugB}/issues`, {
      method: 'POST',
      token: tokenUserA,
      body: {
        title: 'Cross-campus trespassing report',
        description: 'Trying to file into campus B without belonging to it.',
        category: 'Security',
        location: 'Somewhere',
      },
    });
    assert.equal(res.status, 403, `Expected 403 Forbidden, got ${res.status}`);
  });

  await recordTest('Isolation: Campus A user cannot read Campus B stats (GET /api/campus/:slugB/stats -> 403)', async () => {
    const res = await request(baseUrl, `/api/campus/${slugB}/stats`, {
      token: tokenUserA,
    });
    assert.equal(res.status, 403, `Expected 403 Forbidden, got ${res.status}`);
  });

  await recordTest('Isolation: Campus A user cannot read Campus B staff (GET /api/campus/:slugB/staff -> 403)', async () => {
    const res = await request(baseUrl, `/api/campus/${slugB}/staff`, {
      token: tokenUserA,
    });
    assert.equal(res.status, 403, `Expected 403 Forbidden, got ${res.status}`);
  });

  await recordTest('Isolation: Campus A user cannot upvote an issue in Campus B (POST /api/issues/:issueBId/upvote -> 403)', async () => {
    const res = await request(baseUrl, `/api/issues/${issueB.id}/upvote`, {
      method: 'POST',
      token: tokenUserA,
    });
    assert.equal(res.status, 403, `Expected 403 Forbidden, got ${res.status}`);
  });

  await recordTest('Isolation: Campus A user cannot comment on an issue in Campus B (POST /api/issues/:issueBId/comments -> 403)', async () => {
    const res = await request(baseUrl, `/api/issues/${issueB.id}/comments`, {
      method: 'POST',
      token: tokenUserA,
      body: {
        content: 'Cross campus malicious comment injection',
      },
    });
    assert.equal(res.status, 403, `Expected 403 Forbidden, got ${res.status}`);
  });

  await recordTest('Isolation: Non-existent campus returns 404 (GET /api/campus/non-existent-xyz/issues -> 404)', async () => {
    const res = await request(baseUrl, '/api/campus/non-existent-slug-xyz/issues', {
      token: tokenUserA,
    });
    assert.equal(res.status, 404, `Expected 404 Not Found, got ${res.status}`);
  });

  console.log('\n--- Phase 3: Role Boundaries (User cannot call Admin or Worker APIs) ---');

  await recordTest('Role Guard: Regular user cannot call worker status update (PATCH /api/issues/:id/status -> 403)', async () => {
    const res = await request(baseUrl, `/api/issues/${issueA.id}/status`, {
      method: 'PATCH',
      token: tokenUserA,
      body: {
        status: 'resolved',
        resolutionNotes: 'Self-resolved by regular user without authorization',
      },
    });
    assert.equal(res.status, 403, `Expected 403 Forbidden for regular user, got ${res.status}`);
  });

  await recordTest('Role Guard: Regular user cannot add staff (POST /api/campus/:slug/staff -> 403)', async () => {
    const res = await request(baseUrl, `/api/campus/${slugA}/staff`, {
      method: 'POST',
      token: tokenUserA,
      body: {
        name: 'Illegal Staff',
        email: `illegal-${timestamp}@alpha.edu`,
        password: 'Password123!',
        role: 'worker',
      },
    });
    assert.equal(res.status, 403, `Expected 403 Forbidden for regular user, got ${res.status}`);
  });

  await recordTest('Role Guard: Regular user cannot delete staff (DELETE /api/campus/:slug/staff/:id -> 403)', async () => {
    const res = await request(baseUrl, `/api/campus/${slugA}/staff/${workerA.id}`, {
      method: 'DELETE',
      token: tokenUserA,
    });
    assert.equal(res.status, 403, `Expected 403 Forbidden for regular user, got ${res.status}`);
  });

  await recordTest('Role Guard: Regular user cannot change member roles (PATCH /api/campus/:slug/members/:id/role -> 403)', async () => {
    const res = await request(baseUrl, `/api/campus/${slugA}/members/${userA.id}/role`, {
      method: 'PATCH',
      token: tokenUserA,
      body: {
        role: 'admin',
      },
    });
    assert.equal(res.status, 403, `Expected 403 Forbidden for regular user, got ${res.status}`);
  });

  console.log('\n--- Phase 4: Role Boundaries (Worker cannot call Admin APIs & Co-Admin checks) ---');

  await recordTest('Role Guard: Worker cannot add staff (POST /api/campus/:slug/staff -> 403)', async () => {
    const res = await request(baseUrl, `/api/campus/${slugA}/staff`, {
      method: 'POST',
      token: tokenWorkerA,
      body: {
        name: 'Worker Created Staff',
        email: `worker-staff-${timestamp}@alpha.edu`,
        password: 'Password123!',
        role: 'worker',
      },
    });
    assert.equal(res.status, 403, `Expected 403 Forbidden for worker, got ${res.status}`);
  });

  await recordTest('Role Guard: Worker cannot delete staff (DELETE /api/campus/:slug/staff/:id -> 403)', async () => {
    const res = await request(baseUrl, `/api/campus/${slugA}/staff/${workerA.id}`, {
      method: 'DELETE',
      token: tokenWorkerA,
    });
    assert.equal(res.status, 403, `Expected 403 Forbidden for worker, got ${res.status}`);
  });

  await recordTest('Role Guard: Worker cannot change member roles (PATCH /api/campus/:slug/members/:id/role -> 403)', async () => {
    const res = await request(baseUrl, `/api/campus/${slugA}/members/${userA.id}/role`, {
      method: 'PATCH',
      token: tokenWorkerA,
      body: {
        role: 'co_admin',
      },
    });
    assert.equal(res.status, 403, `Expected 403 Forbidden for worker, got ${res.status}`);
  });

  await recordTest('Role Legitimate Action: Worker CAN update issue status (PATCH /api/issues/:id/status -> 200)', async () => {
    const res = await request(baseUrl, `/api/issues/${issueA.id}/status`, {
      method: 'PATCH',
      token: tokenWorkerA,
      body: {
        status: 'in_progress',
        resolutionNotes: 'Technician Alex dispatched with tools and spare lamp bulbs.',
      },
    });
    assert.equal(res.status, 200, `Expected 200 OK for worker updating issue status, got ${res.status}`);
  });

  let tokenCoAdminA: string = '';
  await recordTest('Admin changes member role to co_admin (Admin can change roles in same campus)', async () => {
    // Promote userA to co_admin
    const res = await request(baseUrl, `/api/campus/${slugA}/members/${userA.id}/role`, {
      method: 'PATCH',
      token: tokenAdminA,
      body: {
        role: 'co_admin',
      },
    });
    assert.equal(res.status, 200, `Expected 200 OK for admin changing role, got ${res.status}`);

    // Log in as userA now that they are co_admin
    const loginRes = await request(baseUrl, '/api/auth/login', {
      method: 'POST',
      body: {
        email: userA.email,
        password: 'Password123!',
        campusSlug: slugA,
      },
    });
    assert.equal(loginRes.status, 200);
    assert.equal(loginRes.data.user.role, 'co_admin');
    tokenCoAdminA = loginRes.data.token;
  });

  await recordTest('Role Guard: Co-Admin CANNOT change admin accounts (co_admin cannot change admins -> 403)', async () => {
    // Get Admin A ID from /api/me
    const meAdmin = await request(baseUrl, '/api/auth/me', { token: tokenAdminA });
    const adminAId = meAdmin.data.user.id;

    // Co-Admin tries to demote Admin A to worker
    const res = await request(baseUrl, `/api/campus/${slugA}/members/${adminAId}/role`, {
      method: 'PATCH',
      token: tokenCoAdminA,
      body: {
        role: 'worker',
      },
    });
    assert.equal(res.status, 403, `Expected 403 Forbidden when co_admin tries to change admin, got ${res.status}`);
  });

  console.log('\n--- Phase 5: Token Security (Tampered and Expired Tokens Rejected) ---');

  await recordTest('Token Security: Valid token accesses GET /api/auth/me -> 200', async () => {
    const res = await request(baseUrl, '/api/auth/me', { token: tokenUserA });
    assert.equal(res.status, 200, `Expected 200 OK, got ${res.status}`);
    assert.ok(res.data.user);
  });

  await recordTest('Token Security: Missing token is rejected with 401', async () => {
    const res = await request(baseUrl, '/api/auth/me');
    assert.equal(res.status, 401, `Expected 401 Unauthorized, got ${res.status}`);
  });

  await recordTest('Token Security: Tampered signature token is rejected with 401', async () => {
    const parts = tokenUserA.split('.');
    const tamperedSig = `${parts[0]}.${parts[1].slice(0, -6)}XYZ123`;
    const res = await request(baseUrl, '/api/auth/me', { token: tamperedSig });
    assert.equal(res.status, 401, `Expected 401 Unauthorized for tampered signature, got ${res.status}`);
  });

  await recordTest('Token Security: Tampered payload token is rejected with 401', async () => {
    const parts = tokenUserA.split('.');
    // Modify payload
    const decodedPayload = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
    decodedPayload.role = 'admin'; // attempted role escalation
    const fakePayloadB64 = Buffer.from(JSON.stringify(decodedPayload)).toString('base64url');
    const tamperedToken = `${fakePayloadB64}.${parts[1]}`;

    const res = await request(baseUrl, '/api/auth/me', { token: tamperedToken });
    assert.equal(res.status, 401, `Expected 401 Unauthorized for tampered payload, got ${res.status}`);
  });

  await recordTest('Token Security: Expired token is rejected with 401', async () => {
    const expiredToken = createExpiredToken({
      userId: userA.id,
      email: userA.email,
      name: userA.name,
      role: 'user',
      campusId: campusA.id,
      campusSlug: campusA.slug,
    });

    const res = await request(baseUrl, '/api/auth/me', { token: expiredToken });
    assert.equal(res.status, 401, `Expected 401 Unauthorized for expired token, got ${res.status}`);
  });

  console.log('\n======================================================');
  const passedCount = results.filter((r) => r.passed).length;
  const failedCount = results.filter((r) => !r.passed).length;
  console.log(`📊 TEST SUMMARY: ${passedCount} PASSED / ${failedCount} FAILED (${results.length} total)`);
  console.log('======================================================\n');

  if (failedCount > 0) {
    console.error(`❌ Isolation test suite failed with ${failedCount} error(s).`);
    process.exit(1);
  } else {
    console.log('🎉 ALL ISOLATION & ROLE SECURITY TESTS PASSED SUCCESSFULLY!');
    process.exit(0);
  }
}

runIsolationTestSuite().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
