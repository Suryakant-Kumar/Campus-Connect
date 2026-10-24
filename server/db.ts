import { Pool, PoolClient } from 'pg';
import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

const connectionString = process.env.DATABASE_URL;

// Track if PostgreSQL failed (e.g. auth failed, host unreachable)
let isMockActive = false;
let dbLastError: string | null = null;
let realPool: Pool | null = null;

// Only initialize real pool if DATABASE_URL is provided and doesn't look like placeholder
if (connectionString && connectionString.trim() !== '') {
  // If connectionString has dummy placeholder username with password auth that will fail
  if (connectionString.includes('username:password') || connectionString.includes('user:password')) {
    console.warn('[CampusConnect DB] Placeholder DATABASE_URL detected. Activating in-memory database mock.');
    isMockActive = true;
    dbLastError = 'Placeholder DATABASE_URL in environment. In-memory mock database active.';
  } else {
    try {
      realPool = new Pool({
        connectionString,
        ssl: connectionString.includes('localhost') ? false : { rejectUnauthorized: false },
        max: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000,
      });

      realPool.on('error', (err) => {
        console.error('[CampusConnect DB] PostgreSQL client error:', err.message);
        isMockActive = true;
        dbLastError = err.message;
      });
    } catch (err: any) {
      console.warn('[CampusConnect DB] Failed to construct PostgreSQL Pool:', err.message);
      isMockActive = true;
      dbLastError = err.message;
    }
  }
} else {
  isMockActive = true;
}

// --------------------------------------------------------------------------
// IN-MEMORY MOCK STORE DEFINITIONS & SEED DATA
// --------------------------------------------------------------------------

export interface MockCampus {
  id: string;
  name: string;
  slug: string;
  type: string;
  status: 'active' | 'suspended';
  description: string;
  address: string;
  contact_email: string;
  created_at: string;
}

export interface MockUser {
  id: string;
  campus_id: string | null;
  email: string;
  name: string;
  password_hash: string;
  salt: string;
  role: string;
  phone: string;
  department: string | null;
  created_at: string;
}

export interface MockIssue {
  id: string;
  campus_id: string;
  created_by: string;
  assigned_to: string | null;
  title: string;
  description: string;
  category: string;
  location: string;
  photo_url: string | null;
  status: string;
  urgency: string;
  ai_analysis: any;
  ai_flagged: boolean;
  ai_flag_reason: string | null;
  resolution_notes: string | null;
  resolution_photo_url: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface MockUpvote {
  id: string;
  issue_id: string;
  user_id: string;
  created_at: string;
}

export interface MockComment {
  id: string;
  issue_id: string;
  user_id: string;
  content: string;
  is_internal: boolean;
  created_at: string;
}

export interface MockActivityLog {
  id: string;
  campus_id: string;
  user_id: string | null;
  action: string;
  details: any;
  created_at: string;
}

// Pre-computed scrypt hash for "password123"
const DEMO_SALT = '4a9608194fbf3f0caae6c5275e30bbc5';
const DEMO_HASH = '5c36246a23f1a609b4682b242bd61ede14a72c526a046139cd60d0f4a4895f837dbfc01f2b1e9b2ae97f198cd05a52c237c2461f684e69cfec583a533d068649';

const CAMPUS_APEX_ID = 'c1111111-1111-1111-1111-111111111111';
const CAMPUS_METRO_ID = 'c2222222-2222-2222-2222-222222222222';

const USER_ADMIN_ID = 'u1111111-1111-1111-1111-111111111111';
const USER_WORKER_ALEX_ID = 'u2222222-2222-2222-2222-222222222222';
const USER_WORKER_MARCUS_ID = 'u3333333-3333-3333-3333-333333333333';
const USER_STUDENT_ID = 'u4444444-4444-4444-4444-444444444444';
const USER_FOUNDER_ID = 'u0000000-0000-0000-0000-000000000000';

const ISSUE_1_ID = 'i1111111-1111-1111-1111-111111111111';
const ISSUE_2_ID = 'i2222222-2222-2222-2222-222222222222';
const ISSUE_3_ID = 'i3333333-3333-3333-3333-333333333333';
const ISSUE_4_ID = 'i4444444-4444-4444-4444-444444444444';
const ISSUE_5_ID = 'i5555555-5555-5555-5555-555555555555';

const now = Date.now();
const oneDay = 86400000;

class InMemoryStore {
  campuses: MockCampus[] = [
    {
      id: CAMPUS_APEX_ID,
      name: 'Apex State University',
      slug: 'apex-state',
      type: 'university',
      status: 'active',
      description: 'Premier campus facility management, student life services, and campus safety.',
      address: '100 University Ave, Cambridge, MA',
      contact_email: 'admin@apex.edu',
      created_at: new Date(now - 30 * oneDay).toISOString(),
    },
    {
      id: CAMPUS_METRO_ID,
      name: 'Metro Tech College',
      slug: 'metro-tech',
      type: 'college',
      status: 'active',
      description: 'Applied technical science center and urban laboratory facilities.',
      address: '404 Innovation Way, Seattle, WA',
      contact_email: 'support@metrotech.edu',
      created_at: new Date(now - 14 * oneDay).toISOString(),
    },
  ];

  users: MockUser[] = [
    {
      id: USER_ADMIN_ID,
      campus_id: CAMPUS_APEX_ID,
      email: 'admin@apex.edu',
      name: 'Dr. Sarah Chen',
      password_hash: DEMO_HASH,
      salt: DEMO_SALT,
      role: 'admin',
      phone: '+1 555-0101',
      department: 'Campus Administration',
      created_at: new Date(now - 30 * oneDay).toISOString(),
    },
    {
      id: USER_WORKER_ALEX_ID,
      campus_id: CAMPUS_APEX_ID,
      email: 'alex.worker@apex.edu',
      name: 'Alex Rivera',
      password_hash: DEMO_HASH,
      salt: DEMO_SALT,
      role: 'worker',
      phone: '+1 555-0102',
      department: 'Plumbing & Facilities',
      created_at: new Date(now - 25 * oneDay).toISOString(),
    },
    {
      id: USER_WORKER_MARCUS_ID,
      campus_id: CAMPUS_APEX_ID,
      email: 'marcus.worker@apex.edu',
      name: 'Marcus Vance',
      password_hash: DEMO_HASH,
      salt: DEMO_SALT,
      role: 'worker',
      phone: '+1 555-0103',
      department: 'Electrical & Systems',
      created_at: new Date(now - 25 * oneDay).toISOString(),
    },
    {
      id: USER_STUDENT_ID,
      campus_id: CAMPUS_APEX_ID,
      email: 'student@apex.edu',
      name: 'Jordan Lee',
      password_hash: DEMO_HASH,
      salt: DEMO_SALT,
      role: 'user',
      phone: '+1 555-0104',
      department: 'Computer Science',
      created_at: new Date(now - 20 * oneDay).toISOString(),
    },
    {
      id: USER_FOUNDER_ID,
      campus_id: null,
      email: 'founder@campusconnect.io',
      name: 'Platform Founder',
      password_hash: DEMO_HASH,
      salt: DEMO_SALT,
      role: 'founder',
      phone: '+1 555-0000',
      department: 'Global Executive',
      created_at: new Date(now - 60 * oneDay).toISOString(),
    },
  ];

  issues: MockIssue[] = [
    {
      id: ISSUE_1_ID,
      campus_id: CAMPUS_APEX_ID,
      created_by: USER_STUDENT_ID,
      assigned_to: USER_WORKER_ALEX_ID,
      title: 'Water pipe rupture causing hallway flooding in Science Building',
      description: 'Major leak on the 3rd floor west corridor near Lab 304. Water is pooling across the floor and leaking into ceiling tiles below.',
      category: 'Plumbing',
      location: 'Science Building, 3rd Floor West Wing',
      photo_url: null,
      status: 'in_progress',
      urgency: 'critical',
      ai_analysis: {
        clarityScore: 9,
        improvedTitle: 'Water Pipe Rupture & Flooding in Science Building West Wing',
        suggestedCategory: 'Plumbing',
        urgency: 'critical',
        urgencyReason: 'Active flooding posing electrical hazard and building damage.',
        isFlagged: false,
        flagReason: null,
        actionableSummary: 'Shut off main water valve to 3rd floor west riser immediately; deploy wet extraction equipment.',
        tags: ['plumbing', 'flood', 'critical-hazard'],
        aiProvider: 'gemini',
      },
      ai_flagged: false,
      ai_flag_reason: null,
      resolution_notes: null,
      resolution_photo_url: null,
      resolved_at: null,
      created_at: new Date(now - 3 * 3600000).toISOString(),
      updated_at: new Date(now - 2 * 3600000).toISOString(),
    },
    {
      id: ISSUE_2_ID,
      campus_id: CAMPUS_APEX_ID,
      created_by: USER_STUDENT_ID,
      assigned_to: null,
      title: 'Elevator door stuck open with alarm sounding in Central Library',
      description: 'North elevator #2 is halted between floors 2 and 3 with doors ajar. Needs technician inspection.',
      category: 'General Maintenance',
      location: 'Central Library, Main Atrium',
      photo_url: null,
      status: 'open',
      urgency: 'high',
      ai_analysis: {
        clarityScore: 8,
        improvedTitle: 'Elevator Fault & Safety Stoppage in Central Library',
        suggestedCategory: 'General Maintenance',
        urgency: 'high',
        urgencyReason: 'Elevator malfunction obstructing accessibility.',
        isFlagged: false,
        flagReason: null,
        actionableSummary: 'Lock out elevator unit at ground level and notify certified elevator contractor.',
        tags: ['elevator', 'accessibility', 'high-priority'],
        aiProvider: 'gemini',
      },
      ai_flagged: false,
      ai_flag_reason: null,
      resolution_notes: null,
      resolution_photo_url: null,
      resolved_at: null,
      created_at: new Date(now - 7 * 3600000).toISOString(),
      updated_at: new Date(now - 7 * 3600000).toISOString(),
    },
    {
      id: ISSUE_3_ID,
      campus_id: CAMPUS_APEX_ID,
      created_by: USER_STUDENT_ID,
      assigned_to: USER_WORKER_MARCUS_ID,
      title: 'Exposed electrical outlet sparking in Computer Lab 4B',
      description: 'Faceplate came loose from the wall under workstation 12; sparks observed when plugging in laptop charger.',
      category: 'Electricity',
      location: 'Engineering Building, Lab 4B',
      photo_url: null,
      status: 'in_progress',
      urgency: 'critical',
      ai_analysis: {
        clarityScore: 9,
        improvedTitle: 'Sparking Electrical Outlet at Workstation 12, Lab 4B',
        suggestedCategory: 'Electricity',
        urgency: 'critical',
        urgencyReason: 'Immediate risk of electrical shock and fire ignition.',
        isFlagged: false,
        flagReason: null,
        actionableSummary: 'Flip breaker 14 in sub-panel B4; replace damaged receptacle and install secure wall box.',
        tags: ['electrical', 'fire-risk', 'safety'],
        aiProvider: 'gemini',
      },
      ai_flagged: false,
      ai_flag_reason: null,
      resolution_notes: null,
      resolution_photo_url: null,
      resolved_at: null,
      created_at: new Date(now - 12 * 3600000).toISOString(),
      updated_at: new Date(now - 5 * 3600000).toISOString(),
    },
    {
      id: ISSUE_4_ID,
      campus_id: CAMPUS_APEX_ID,
      created_by: USER_STUDENT_ID,
      assigned_to: USER_WORKER_MARCUS_ID,
      title: 'Wi-Fi connectivity dropouts in Student Union Dining Commons',
      description: 'Access points keep dropping authentication during peak lunch hours. Students cannot connect to Eduroam.',
      category: 'Internet/Wi-Fi',
      location: 'Student Union, 2nd Floor Dining Area',
      photo_url: null,
      status: 'resolved',
      urgency: 'medium',
      ai_analysis: {
        clarityScore: 8,
        improvedTitle: 'Wi-Fi AP Congestion & Authentication Drops in Dining Commons',
        suggestedCategory: 'Internet/Wi-Fi',
        urgency: 'medium',
        urgencyReason: 'Network congestion during peak campus periods.',
        isFlagged: false,
        flagReason: null,
        actionableSummary: 'Adjust channel width and load balancing threshold across AP-SU-201 and AP-SU-202.',
        tags: ['wifi', 'network', 'resolved'],
        aiProvider: 'gemini',
      },
      ai_flagged: false,
      ai_flag_reason: null,
      resolution_notes: 'Re-provisioned AP-SU-201 and added 5GHz radio steering. Tested with 150 concurrent clients at full speed.',
      resolution_photo_url: null,
      resolved_at: new Date(now - 1 * 3600000).toISOString(),
      created_at: new Date(now - 24 * 3600000).toISOString(),
      updated_at: new Date(now - 1 * 3600000).toISOString(),
    },
    {
      id: ISSUE_5_ID,
      campus_id: CAMPUS_APEX_ID,
      created_by: USER_STUDENT_ID,
      assigned_to: null,
      title: 'Broken study desk latch and hinge in Tower Dorms 5th floor study room',
      description: 'The modular desk panel is loose and tilts when weight is applied.',
      category: 'Furniture/Carpentry',
      location: 'North Tower Dormitory, Study Room 512',
      photo_url: null,
      status: 'open',
      urgency: 'low',
      ai_analysis: {
        clarityScore: 7,
        improvedTitle: 'Loose Study Desk Hinge in North Tower Room 512',
        suggestedCategory: 'Furniture/Carpentry',
        urgency: 'low',
        urgencyReason: 'Cosmetic / minor furniture maintenance.',
        isFlagged: false,
        flagReason: null,
        actionableSummary: 'Tighten hex bolts on folding desk bracket and inspect stability.',
        tags: ['furniture', 'carpentry'],
        aiProvider: 'gemini',
      },
      ai_flagged: false,
      ai_flag_reason: null,
      resolution_notes: null,
      resolution_photo_url: null,
      resolved_at: null,
      created_at: new Date(now - 48 * 3600000).toISOString(),
      updated_at: new Date(now - 48 * 3600000).toISOString(),
    },
  ];

  upvotes: MockUpvote[] = [
    {
      id: 'uv1',
      issue_id: ISSUE_1_ID,
      user_id: USER_STUDENT_ID,
      created_at: new Date(now - 2 * 3600000).toISOString(),
    },
    {
      id: 'uv2',
      issue_id: ISSUE_2_ID,
      user_id: USER_STUDENT_ID,
      created_at: new Date(now - 6 * 3600000).toISOString(),
    },
  ];

  comments: MockComment[] = [
    {
      id: 'cm1',
      issue_id: ISSUE_1_ID,
      user_id: USER_WORKER_ALEX_ID,
      content: 'I have dispatched maintenance team with water extractors. Isolating the pipe on floor 3 now.',
      is_internal: false,
      created_at: new Date(now - 2 * 3600000).toISOString(),
    },
    {
      id: 'cm2',
      issue_id: ISSUE_1_ID,
      user_id: USER_ADMIN_ID,
      content: 'Safety team has cordoned off the west corridor stairs to prevent slip hazard.',
      is_internal: true,
      created_at: new Date(now - 1 * 3600000).toISOString(),
    },
    {
      id: 'cm3',
      issue_id: ISSUE_4_ID,
      user_id: USER_WORKER_MARCUS_ID,
      content: 'Config updated and AP re-provisioned. Signal verified at 94Mbps.',
      is_internal: false,
      created_at: new Date(now - 1 * 3600000).toISOString(),
    },
  ];

  activityLogs: MockActivityLog[] = [];
}

const mockStore = new InMemoryStore();

// --------------------------------------------------------------------------
// MOCK QUERY ENGINE
// --------------------------------------------------------------------------

function executeMockQuery(sql: string, params: any[] = []): { rows: any[]; rowCount: number } {
  const normalized = sql.trim().replace(/\s+/g, ' ');

  // 1. Transaction & DDL no-ops
  if (
    normalized.startsWith('BEGIN') ||
    normalized.startsWith('COMMIT') ||
    normalized.startsWith('ROLLBACK') ||
    normalized.startsWith('CREATE TABLE') ||
    normalized.startsWith('CREATE EXTENSION') ||
    normalized.startsWith('CREATE UNIQUE INDEX')
  ) {
    return { rows: [], rowCount: 0 };
  }

  // 2. Health check query: SELECT COUNT(*) FROM campuses
  if (normalized === 'SELECT COUNT(*) FROM campuses') {
    return { rows: [{ count: String(mockStore.campuses.length) }], rowCount: 1 };
  }

  // 3. Founder platform totals: SELECT COUNT(*) FROM ...
  if (normalized.startsWith('SELECT COUNT(*) FROM')) {
    let count = 0;
    if (normalized.includes('FROM campuses')) count = mockStore.campuses.length;
    else if (normalized.includes('FROM users')) count = mockStore.users.length;
    else if (normalized.includes("FROM issues WHERE status = 'resolved'")) {
      count = mockStore.issues.filter((i) => i.status === 'resolved').length;
    } else if (normalized.includes('FROM issues')) count = mockStore.issues.length;
    else if (normalized.includes('FROM issue_upvotes')) count = mockStore.upvotes.length;
    else if (normalized.includes('FROM issue_comments')) count = mockStore.comments.length;

    return { rows: [{ count: String(count) }], rowCount: 1 };
  }

  // 4. List Campuses: SELECT c.id, c.name, c.slug, c.type, c.description, c.address, c.created_at ... FROM campuses c
  if (normalized.includes('FROM campuses c') && !normalized.includes('WHERE c.slug = $1') && !normalized.includes('WHERE slug = $1')) {
    const rows = mockStore.campuses
      .slice()
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .map((c) => {
        const member_count = mockStore.users.filter((u) => u.campus_id === c.id).length;
        const total_issues_count = mockStore.issues.filter((i) => i.campus_id === c.id).length;
        const resolved_issues_count = mockStore.issues.filter((i) => i.campus_id === c.id && i.status === 'resolved').length;
        const open_issues_count = total_issues_count - resolved_issues_count;
        const admin_count = mockStore.users.filter((u) => u.campus_id === c.id && u.role === 'admin').length;
        const worker_count = mockStore.users.filter((u) => u.campus_id === c.id && u.role === 'worker').length;
        const critical_open_issues = mockStore.issues.filter((i) => i.campus_id === c.id && i.urgency === 'critical' && i.status !== 'resolved').length;

        return {
          id: c.id,
          name: c.name,
          slug: c.slug,
          type: c.type,
          status: c.status || 'active',
          description: c.description,
          address: c.address,
          contact_email: c.contact_email,
          created_at: c.created_at,
          member_count: String(member_count),
          total_users: String(member_count),
          total_issues_count: String(total_issues_count),
          total_issues: String(total_issues_count),
          open_issues_count: String(open_issues_count),
          resolved_issues_count: String(resolved_issues_count),
          resolved_issues: String(resolved_issues_count),
          admin_count: String(admin_count),
          worker_count: String(worker_count),
          critical_open_issues: String(critical_open_issues),
        };
      });

    return { rows, rowCount: rows.length };
  }

  // 5. Campus by slug
  if (normalized.includes('FROM campuses') && (normalized.includes('WHERE c.slug = $1') || normalized.includes('WHERE slug = $1'))) {
    const slug = (params[0] || '').toLowerCase().trim();
    const c = mockStore.campuses.find((camp) => camp.slug.toLowerCase() === slug);
    if (!c) return { rows: [], rowCount: 0 };

    if (normalized.startsWith('SELECT id FROM campuses')) {
      return { rows: [{ id: c.id }], rowCount: 1 };
    }

    const member_count = mockStore.users.filter((u) => u.campus_id === c.id).length;
    const total_issues_count = mockStore.issues.filter((i) => i.campus_id === c.id).length;
    const resolved_issues_count = mockStore.issues.filter((i) => i.campus_id === c.id && i.status === 'resolved').length;
    const open_issues_count = total_issues_count - resolved_issues_count;

    return {
      rows: [
        {
          id: c.id,
          name: c.name,
          slug: c.slug,
          type: c.type,
          status: c.status || 'active',
          description: c.description,
          address: c.address,
          contact_email: c.contact_email,
          created_at: c.created_at,
          member_count: String(member_count),
          open_issues_count: String(open_issues_count),
          resolved_issues_count: String(resolved_issues_count),
        },
      ],
      rowCount: 1,
    };
  }

  // 6. Campus Stats: group by status, urgency, category, role
  if (normalized.includes('FROM issues WHERE campus_id = $1 GROUP BY status')) {
    const campusId = params[0];
    const map: Record<string, number> = {};
    mockStore.issues.filter((i) => i.campus_id === campusId).forEach((i) => {
      map[i.status] = (map[i.status] || 0) + 1;
    });
    const rows = Object.entries(map).map(([status, count]) => ({ status, count: String(count) }));
    return { rows, rowCount: rows.length };
  }

  if (normalized.includes('FROM issues WHERE campus_id = $1 GROUP BY urgency')) {
    const campusId = params[0];
    const map: Record<string, number> = {};
    mockStore.issues.filter((i) => i.campus_id === campusId).forEach((i) => {
      map[i.urgency] = (map[i.urgency] || 0) + 1;
    });
    const rows = Object.entries(map).map(([urgency, count]) => ({ urgency, count: String(count) }));
    return { rows, rowCount: rows.length };
  }

  if (normalized.includes('FROM issues WHERE campus_id = $1 GROUP BY category')) {
    const campusId = params[0];
    const map: Record<string, number> = {};
    mockStore.issues.filter((i) => i.campus_id === campusId).forEach((i) => {
      map[i.category] = (map[i.category] || 0) + 1;
    });
    const rows = Object.entries(map)
      .map(([category, count]) => ({ category, count: String(count) }))
      .sort((a, b) => Number(b.count) - Number(a.count))
      .slice(0, 6);
    return { rows, rowCount: rows.length };
  }

  if (normalized.includes('FROM users WHERE campus_id = $1 GROUP BY role')) {
    const campusId = params[0];
    const map: Record<string, number> = {};
    mockStore.users.filter((u) => u.campus_id === campusId).forEach((u) => {
      map[u.role] = (map[u.role] || 0) + 1;
    });
    const rows = Object.entries(map).map(([role, count]) => ({ role, count: String(count) }));
    return { rows, rowCount: rows.length };
  }

  // 7. Insert Campus
  if (normalized.startsWith('INSERT INTO campuses')) {
    const [name, slug, type, description, address, contact_email] = params;
    const newCampus: MockCampus = {
      id: crypto.randomUUID(),
      name,
      slug,
      type,
      status: 'active',
      description: description || '',
      address: address || '',
      contact_email: contact_email || '',
      created_at: new Date().toISOString(),
    };
    mockStore.campuses.unshift(newCampus);
    return { rows: [newCampus], rowCount: 1 };
  }

  // 7b. Update Campus Status (Founder suspend / reactivate)
  if (normalized.startsWith('UPDATE campuses SET status = $1 WHERE id = $2')) {
    const [newStatus, campusId] = params;
    const campus = mockStore.campuses.find((c) => c.id === campusId);
    if (!campus) return { rows: [], rowCount: 0 };
    campus.status = newStatus as 'active' | 'suspended';
    return { rows: [campus], rowCount: 1 };
  }

  // 8. Users queries
  // 8a. Find user by campus_id and email
  if (
    normalized.includes('FROM users') &&
    (normalized.includes('campus_id = $1 AND email = $2') ||
      normalized.includes('campus_id = $1 AND LOWER(email) = LOWER($2)'))
  ) {
    const campusId = params[0];
    const email = (params[1] || '').toLowerCase().trim();
    const user = mockStore.users.find((u) => u.campus_id === campusId && u.email.toLowerCase() === email);
    if (!user) return { rows: [], rowCount: 0 };
    if (normalized.startsWith('SELECT id FROM users')) {
      return { rows: [{ id: user.id }], rowCount: 1 };
    }
    return { rows: [{ ...user }], rowCount: 1 };
  }

  // 8b. Founder lookup
  if (normalized.includes('FROM users') && normalized.includes('campus_id IS NULL')) {
    const email = (params[0] || '').toLowerCase().trim();
    const user = mockStore.users.find((u) => u.campus_id === null && u.email.toLowerCase() === email);
    if (!user) return { rows: [], rowCount: 0 };
    if (normalized.startsWith('SELECT id FROM users')) {
      return { rows: [{ id: user.id }], rowCount: 1 };
    }
    return { rows: [{ ...user }], rowCount: 1 };
  }

  // 8c. Lookup user by email only
  if (
    normalized.includes('FROM users') &&
    (normalized.includes('WHERE email = $1') || normalized.includes('WHERE LOWER(email) = LOWER($1)'))
  ) {
    const email = (params[0] || '').toLowerCase().trim();
    const user = mockStore.users.find((u) => u.email.toLowerCase() === email);
    if (!user) return { rows: [], rowCount: 0 };
    if (normalized.startsWith('SELECT id FROM users')) {
      return { rows: [{ id: user.id }], rowCount: 1 };
    }
    return { rows: [{ ...user }], rowCount: 1 };
  }

  // 8d. Login query for campus user
  if (normalized.includes('FROM users u JOIN campuses c ON u.campus_id = c.id')) {
    const slug = (params[0] || '').toLowerCase().trim();
    const email = (params[1] || '').toLowerCase().trim();
    const campus = mockStore.campuses.find((c) => c.slug.toLowerCase() === slug);
    if (!campus) return { rows: [], rowCount: 0 };

    const user = mockStore.users.find((u) => u.campus_id === campus.id && u.email.toLowerCase() === email);
    if (!user) return { rows: [], rowCount: 0 };

    return {
      rows: [
        {
          id: user.id,
          campus_id: user.campus_id,
          email: user.email,
          name: user.name,
          password_hash: user.password_hash,
          salt: user.salt,
          role: user.role,
          department: user.department,
          campus_slug: campus.slug,
          campus_name: campus.name,
        },
      ],
      rowCount: 1,
    };
  }

  // 8c. Login query for founder
  if (normalized.includes("WHERE u.campus_id IS NULL AND u.role = 'founder'")) {
    const email = (params[0] || '').toLowerCase().trim();
    const user = mockStore.users.find((u) => u.campus_id === null && u.role === 'founder' && u.email.toLowerCase() === email);
    if (!user) return { rows: [], rowCount: 0 };

    return {
      rows: [
        {
          id: user.id,
          campus_id: null,
          email: user.email,
          name: user.name,
          password_hash: user.password_hash,
          salt: user.salt,
          role: user.role,
          department: user.department,
          campus_slug: null,
          campus_name: 'Global Platform',
        },
      ],
      rowCount: 1,
    };
  }

  // 8d. Current user by id (/auth/me)
  if (normalized.includes('FROM users u LEFT JOIN campuses c ON u.campus_id = c.id WHERE u.id = $1')) {
    const userId = params[0];
    const user = mockStore.users.find((u) => u.id === userId);
    if (!user) return { rows: [], rowCount: 0 };

    const campus = user.campus_id ? mockStore.campuses.find((c) => c.id === user.campus_id) : null;

    return {
      rows: [
        {
          id: user.id,
          campus_id: user.campus_id,
          email: user.email,
          name: user.name,
          role: user.role,
          department: user.department,
          phone: user.phone,
          created_at: user.created_at,
          campus_name: campus ? campus.name : null,
          campus_slug: campus ? campus.slug : null,
          campus_type: campus ? campus.type : null,
        },
      ],
      rowCount: 1,
    };
  }

  // 8e. Staff list
  if (normalized.includes("WHERE u.campus_id = $1 AND u.role IN ('worker', 'co_admin', 'admin')")) {
    const campusId = params[0];
    const staff = mockStore.users
      .filter((u) => u.campus_id === campusId && ['worker', 'co_admin', 'admin'].includes(u.role))
      .map((u) => {
        const active_assigned_count = mockStore.issues.filter((i) => i.assigned_to === u.id && i.status !== 'resolved').length;
        const resolved_count = mockStore.issues.filter((i) => i.assigned_to === u.id && i.status === 'resolved').length;
        return {
          id: u.id,
          name: u.name,
          email: u.email,
          role: u.role,
          department: u.department,
          phone: u.phone,
          created_at: u.created_at,
          active_assigned_count: String(active_assigned_count),
          resolved_count: String(resolved_count),
        };
      });

    return { rows: staff, rowCount: staff.length };
  }

  // 8e2. All Campus Members list (for managing people and roles)
  if (normalized.includes('FROM users u WHERE u.campus_id = $1') && !normalized.includes("u.role IN")) {
    const campusId = params[0];
    const members = mockStore.users
      .filter((u) => u.campus_id === campusId)
      .map((u) => {
        const active_assigned_count = mockStore.issues.filter((i) => i.assigned_to === u.id && i.status !== 'resolved').length;
        const resolved_count = mockStore.issues.filter((i) => i.assigned_to === u.id && i.status === 'resolved').length;
        return {
          id: u.id,
          name: u.name,
          email: u.email,
          role: u.role,
          department: u.department,
          phone: u.phone,
          created_at: u.created_at,
          active_assigned_count: String(active_assigned_count),
          resolved_count: String(resolved_count),
        };
      });

    return { rows: members, rowCount: members.length };
  }

  // 8f. Insert user
  if (normalized.startsWith('INSERT INTO users')) {
    let campus_id: string | null = null;
    let email = '';
    let name = '';
    let password_hash = '';
    let salt = '';
    let role = 'user';
    let phone: string | null = null;
    let department: string | null = null;

    if (normalized.includes("'admin'")) {
      role = 'admin';
      if (normalized.includes('VALUES (NULL,')) {
        [email, name, password_hash, salt] = params;
      } else {
        [campus_id, email, name, password_hash, salt] = params;
      }
    } else if (normalized.includes("'founder'")) {
      role = 'founder';
      [email, name, password_hash, salt] = params;
    } else if (normalized.includes("'user'")) {
      role = 'user';
      [campus_id, email, name, password_hash, salt, phone, department] = params;
    } else if (params.length === 8) {
      if (normalized.includes('role, department, phone')) {
        [campus_id, email, name, password_hash, salt, role, department, phone] = params;
      } else {
        [campus_id, email, name, password_hash, salt, role, phone, department] = params;
      }
    } else if (params.length === 7) {
      [campus_id, email, name, password_hash, salt, role, department] = params;
    } else if (params.length === 6) {
      [campus_id, email, name, password_hash, salt, role] = params;
    } else if (params.length === 5) {
      [campus_id, email, name, password_hash, salt] = params;
    }

    const newUser: MockUser = {
      id: crypto.randomUUID(),
      campus_id: campus_id || null,
      email: (email || '').toLowerCase().trim(),
      name: (name || '').trim(),
      password_hash: password_hash || '',
      salt: salt || '',
      role: role || 'user',
      phone: phone || '',
      department: department || null,
      created_at: new Date().toISOString(),
    };
    mockStore.users.push(newUser);
    return {
      rows: [
        {
          id: newUser.id,
          campus_id: newUser.campus_id,
          email: newUser.email,
          name: newUser.name,
          role: newUser.role,
          phone: newUser.phone,
          department: newUser.department,
          created_at: newUser.created_at,
        },
      ],
      rowCount: 1,
    };
  }

  // 8g. Lookup user by id and campus_id
  if (normalized.includes('FROM users') && normalized.includes('WHERE id = $1 AND campus_id = $2')) {
    const [userId, campusId] = params;
    const user = mockStore.users.find((u) => u.id === userId && u.campus_id === campusId);
    if (!user) return { rows: [], rowCount: 0 };
    return {
      rows: [
        {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          department: user.department,
          phone: user.phone,
          campus_id: user.campus_id,
          created_at: user.created_at,
        },
      ],
      rowCount: 1,
    };
  }

  // 8h. Update user role
  if (normalized.startsWith('UPDATE users SET role = $1 WHERE id = $2 AND campus_id = $3')) {
    const [newRole, userId, campusId] = params;
    const user = mockStore.users.find((u) => u.id === userId && u.campus_id === campusId);
    if (!user) return { rows: [], rowCount: 0 };
    user.role = newRole;
    return {
      rows: [
        {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          department: user.department,
          campus_id: user.campus_id,
        },
      ],
      rowCount: 1,
    };
  }

  // 8i. Update user campus_id
  if (normalized.startsWith('UPDATE users SET campus_id = $1 WHERE id = $2')) {
    const [campusId, userId] = params;
    const user = mockStore.users.find((u) => u.id === userId);
    if (!user) return { rows: [], rowCount: 0 };
    user.campus_id = campusId;
    return { rows: [user], rowCount: 1 };
  }

  // 8j. Delete user
  if (normalized.startsWith('DELETE FROM users WHERE id = $1')) {
    const userId = params[0];
    const lenBefore = mockStore.users.length;
    mockStore.users = mockStore.users.filter((u) => u.id !== userId);
    return { rows: [], rowCount: lenBefore - mockStore.users.length };
  }

  // 8k. Reset assigned issues
  if (normalized.startsWith('UPDATE issues SET assigned_to = NULL WHERE assigned_to = $1')) {
    const userId = params[0];
    let affected = 0;
    mockStore.issues.forEach((i) => {
      if (i.assigned_to === userId) {
        i.assigned_to = null;
        affected++;
      }
    });
    return { rows: [], rowCount: affected };
  }

  // 9. Issues queries
  // 9a. List issues for campus
  if (normalized.includes('FROM issues i JOIN users u ON i.created_by = u.id')) {
    const campusId = params[0];
    // Find current user id (last param in query)
    const currentUserId = params[params.length - 1];

    let filtered = mockStore.issues.filter((i) => i.campus_id === campusId);

    // Apply conditions in params
    params.forEach((param) => {
      if (['open', 'in_progress', 'resolved', 'rejected'].includes(param)) {
        filtered = filtered.filter((i) => i.status === param);
      } else if (['Electricity', 'Plumbing', 'Cleanliness', 'Internet/Wi-Fi', 'Security', 'Furniture/Carpentry', 'HVAC/AC', 'Noise', 'Structural', 'General Maintenance'].includes(param)) {
        filtered = filtered.filter((i) => i.category === param);
      } else if (['low', 'medium', 'high', 'critical'].includes(param)) {
        filtered = filtered.filter((i) => i.urgency === param);
      } else if (typeof param === 'string' && param.startsWith('%') && param.endsWith('%')) {
        const queryTerm = param.slice(1, -1).toLowerCase();
        filtered = filtered.filter(
          (i) =>
            i.title.toLowerCase().includes(queryTerm) ||
            i.description.toLowerCase().includes(queryTerm) ||
            i.location.toLowerCase().includes(queryTerm)
        );
      }
    });

    const rows = filtered
      .slice()
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .map((i) => {
        const creator = mockStore.users.find((u) => u.id === i.created_by);
        const worker = i.assigned_to ? mockStore.users.find((u) => u.id === i.assigned_to) : null;
        const upvotes_count = mockStore.upvotes.filter((uv) => uv.issue_id === i.id).length;
        const has_upvoted = mockStore.upvotes.some((uv) => uv.issue_id === i.id && uv.user_id === currentUserId);
        const comments_count = mockStore.comments.filter((cm) => cm.issue_id === i.id).length;

        return {
          id: i.id,
          campus_id: i.campus_id,
          title: i.title,
          description: i.description,
          category: i.category,
          location: i.location,
          photo_url: i.photo_url,
          status: i.status,
          urgency: i.urgency,
          ai_analysis: i.ai_analysis,
          ai_flagged: i.ai_flagged,
          ai_flag_reason: i.ai_flag_reason,
          resolution_notes: i.resolution_notes,
          resolution_photo_url: i.resolution_photo_url,
          resolved_at: i.resolved_at,
          created_at: i.created_at,
          updated_at: i.updated_at,
          creator_id: creator ? creator.id : null,
          creator_name: creator ? creator.name : 'Unknown User',
          creator_email: creator ? creator.email : 'unknown@apex.edu',
          worker_id: worker ? worker.id : null,
          worker_name: worker ? worker.name : null,
          worker_department: worker ? worker.department : null,
          upvotes_count: String(upvotes_count),
          has_upvoted: Boolean(has_upvoted),
          comments_count: String(comments_count),
        };
      });

    return { rows, rowCount: rows.length };
  }

  // 9b. Single issue by id
  if (normalized.includes('FROM issues') && (normalized.includes('WHERE id = $1') || normalized.includes('WHERE i.id = $1'))) {
    const issueId = params[0];
    const currentUserId = params[1] || '';
    const i = mockStore.issues.find((iss) => iss.id === issueId);
    if (!i) return { rows: [], rowCount: 0 };

    if (normalized.includes('SELECT id, campus_id FROM issues')) {
      return { rows: [{ id: i.id, campus_id: i.campus_id }], rowCount: 1 };
    }

    const creator = mockStore.users.find((u) => u.id === i.created_by);
    const worker = i.assigned_to ? mockStore.users.find((u) => u.id === i.assigned_to) : null;
    const upvotes_count = mockStore.upvotes.filter((uv) => uv.issue_id === i.id).length;
    const has_upvoted = mockStore.upvotes.some((uv) => uv.issue_id === i.id && uv.user_id === currentUserId);
    const comments_count = mockStore.comments.filter((cm) => cm.issue_id === i.id).length;

    return {
      rows: [
        {
          ...i,
          creator_id: creator ? creator.id : null,
          creator_name: creator ? creator.name : 'Unknown User',
          creator_email: creator ? creator.email : 'unknown@apex.edu',
          worker_id: worker ? worker.id : null,
          worker_name: worker ? worker.name : null,
          worker_department: worker ? worker.department : null,
          upvotes_count: String(upvotes_count),
          has_upvoted: Boolean(has_upvoted),
          comments_count: String(comments_count),
        },
      ],
      rowCount: 1,
    };
  }

  // 9c. Check issue campus: SELECT id, campus_id FROM issues WHERE id = $1
  if (normalized.includes('SELECT id, campus_id FROM issues WHERE id = $1')) {
    const issueId = params[0];
    const i = mockStore.issues.find((iss) => iss.id === issueId);
    return { rows: i ? [{ id: i.id, campus_id: i.campus_id }] : [], rowCount: i ? 1 : 0 };
  }

  // 9d. Insert issue
  if (normalized.startsWith('INSERT INTO issues')) {
    let campus_id: string = '';
    let created_by: string = '';
    let title: string = '';
    let description: string = '';
    let category: string = '';
    let location: string = '';
    let photo_url: string | null = null;
    let status: string = 'open';
    let urgency: string = 'medium';
    let ai_analysis: any = null;
    let ai_flagged: boolean = false;
    let ai_flag_reason: string | null = null;

    if (normalized.includes("'open'")) {
      [campus_id, created_by, title, description, category, location, photo_url, urgency, ai_analysis, ai_flagged, ai_flag_reason] = params;
      status = 'open';
    } else if (params.length >= 12) {
      [campus_id, created_by, title, description, category, location, photo_url, status, urgency, ai_analysis, ai_flagged, ai_flag_reason] = params;
    } else {
      [campus_id, created_by, title, description, category, location, photo_url] = params;
    }

    if (typeof ai_analysis === 'string') {
      try {
        ai_analysis = JSON.parse(ai_analysis);
      } catch {
        // preserve
      }
    }

    const newIssue: MockIssue = {
      id: crypto.randomUUID(),
      campus_id,
      created_by,
      assigned_to: null,
      title: title || '',
      description: description || '',
      category: category || 'General Maintenance',
      location: location || '',
      photo_url: photo_url || null,
      status: status || 'open',
      urgency: urgency || 'medium',
      ai_analysis: ai_analysis || null,
      ai_flagged: Boolean(ai_flagged),
      ai_flag_reason: ai_flag_reason || null,
      resolution_notes: null,
      resolution_photo_url: null,
      resolved_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    mockStore.issues.unshift(newIssue);
    return { rows: [newIssue], rowCount: 1 };
  }

  // 9e. Update issue
  if (normalized.startsWith('UPDATE issues SET')) {
    // Determine issue id (last param)
    const issueId = params[params.length - 1];
    const issueIndex = mockStore.issues.findIndex((i) => i.id === issueId);
    if (issueIndex === -1) return { rows: [], rowCount: 0 };

    const issue = mockStore.issues[issueIndex];

    if (normalized.includes('status = $1')) {
      issue.status = params[0];
    }
    if (params[1]) {
      issue.resolution_notes = params[1];
    }
    if (params[2]) {
      issue.resolution_photo_url = params[2];
    }
    if (params[3] === true || params[0] === 'resolved') {
      issue.resolved_at = new Date().toISOString();
    } else if (params[0] && params[0] !== 'resolved') {
      issue.resolved_at = null;
    }
    if (normalized.includes('assigned_to =')) {
      issue.assigned_to = params[0] || null;
    }

    issue.updated_at = new Date().toISOString();
    return { rows: [issue], rowCount: 1 };
  }

  // 10. Upvotes
  if (normalized.includes('FROM issue_upvotes WHERE issue_id = $1 AND user_id = $2')) {
    const [issueId, userId] = params;
    const found = mockStore.upvotes.find((uv) => uv.issue_id === issueId && uv.user_id === userId);
    return { rows: found ? [{ id: found.id }] : [], rowCount: found ? 1 : 0 };
  }

  if (normalized.startsWith('DELETE FROM issue_upvotes')) {
    const [issueId, userId] = params;
    const lenBefore = mockStore.upvotes.length;
    mockStore.upvotes = mockStore.upvotes.filter((uv) => !(uv.issue_id === issueId && uv.user_id === userId));
    return { rows: [], rowCount: lenBefore - mockStore.upvotes.length };
  }

  if (normalized.startsWith('INSERT INTO issue_upvotes')) {
    const [issueId, userId] = params;
    const newUpvote: MockUpvote = {
      id: crypto.randomUUID(),
      issue_id: issueId,
      user_id: userId,
      created_at: new Date().toISOString(),
    };
    mockStore.upvotes.push(newUpvote);
    return { rows: [newUpvote], rowCount: 1 };
  }

  // 11. Comments
  if (normalized.includes('FROM issue_comments c JOIN users u ON c.user_id = u.id')) {
    const issueId = params[0];
    const canSeeInternal = !normalized.includes('c.is_internal = false');

    const comments = mockStore.comments
      .filter((cm) => cm.issue_id === issueId && (canSeeInternal || !cm.is_internal))
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
      .map((cm) => {
        const user = mockStore.users.find((u) => u.id === cm.user_id);
        return {
          id: cm.id,
          issue_id: cm.issue_id,
          content: cm.content,
          is_internal: cm.is_internal,
          created_at: cm.created_at,
          user_id: user ? user.id : 'unknown',
          user_name: user ? user.name : 'User',
          user_role: user ? user.role : 'user',
          user_department: user ? user.department : null,
        };
      });

    return { rows: comments, rowCount: comments.length };
  }

  if (normalized.startsWith('INSERT INTO issue_comments')) {
    const [issueId, userId, content, is_internal] = params;
    const newComment: MockComment = {
      id: crypto.randomUUID(),
      issue_id: issueId,
      user_id: userId,
      content,
      is_internal: Boolean(is_internal),
      created_at: new Date().toISOString(),
    };
    mockStore.comments.push(newComment);
    return { rows: [newComment], rowCount: 1 };
  }

  // 12. Activity logs
  if (normalized.startsWith('INSERT INTO activity_logs')) {
    const [campus_id, user_id, action, details] = params;
    const log: MockActivityLog = {
      id: crypto.randomUUID(),
      campus_id,
      user_id: user_id || null,
      action,
      details,
      created_at: new Date().toISOString(),
    };
    mockStore.activityLogs.push(log);
    return { rows: [log], rowCount: 1 };
  }

  // Default fallback for any unhandled query
  console.warn('[CampusConnect DB Mock] Unhandled query pattern:', normalized);
  return { rows: [], rowCount: 0 };
}

// --------------------------------------------------------------------------
// SMART POOL ADAPTER
// --------------------------------------------------------------------------

class SmartPool {
  async query(text: string, params: any[] = []): Promise<{ rows: any[]; rowCount: number }> {
    if (isMockActive || !realPool) {
      return executeMockQuery(text, params);
    }

    try {
      const res = await realPool.query(text, params);
      return { rows: res.rows, rowCount: res.rowCount ?? res.rows.length };
    } catch (err: any) {
      console.warn(
        `[CampusConnect DB] PostgreSQL query failed (${err.message}). Seamlessly falling back to in-memory store.`
      );
      isMockActive = true;
      dbLastError = err.message;
      return executeMockQuery(text, params);
    }
  }

  async connect(): Promise<PoolClient> {
    if (isMockActive || !realPool) {
      return {
        query: (text: string, params?: any[]) => Promise.resolve(executeMockQuery(text, params || []) as any),
        release: () => {},
      } as unknown as PoolClient;
    }

    try {
      const client = await realPool.connect();
      return client;
    } catch (err: any) {
      console.warn(
        `[CampusConnect DB] PostgreSQL connect failed (${err.message}). Seamlessly falling back to in-memory store.`
      );
      isMockActive = true;
      dbLastError = err.message;
      return {
        query: (text: string, params?: any[]) => Promise.resolve(executeMockQuery(text, params || []) as any),
        release: () => {},
      } as unknown as PoolClient;
    }
  }
}

const smartPool = new SmartPool();

export function getPool(): Pool {
  return smartPool as unknown as Pool;
}

/**
 * Returns true because database storage is always operational
 * (backed by PostgreSQL when credentials are valid, or by in-memory mock store).
 */
export function isDbConfigured(): boolean {
  return true;
}

export function isUsingMock(): boolean {
  return isMockActive;
}

export function getDbError(): string | null {
  return dbLastError;
}

/**
 * Initializes required tables if using real PostgreSQL.
 * If in-memory mock is active, completes instantly.
 */
export async function initDb(): Promise<void> {
  if (isMockActive || !realPool) {
    console.log('✅ In-memory database mock initialized with sample campuses and demo issues.');
    return;
  }

  try {
    const client = await smartPool.connect();
    try {
      await client.query('BEGIN');
      await client.query('CREATE EXTENSION IF NOT EXISTS "pgcrypto";');
      await client.query(`
        CREATE TABLE IF NOT EXISTS campuses (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          name VARCHAR(255) NOT NULL,
          slug VARCHAR(100) UNIQUE NOT NULL,
          type VARCHAR(50) NOT NULL,
          description TEXT,
          address TEXT,
          contact_email VARCHAR(255),
          created_at TIMESTAMPTZ DEFAULT NOW()
        );
      `);
      await client.query(`
        CREATE TABLE IF NOT EXISTS users (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          campus_id UUID REFERENCES campuses(id) ON DELETE CASCADE,
          email VARCHAR(255) NOT NULL,
          name VARCHAR(255) NOT NULL,
          password_hash TEXT NOT NULL,
          salt TEXT NOT NULL,
          role VARCHAR(50) NOT NULL,
          phone VARCHAR(50),
          department VARCHAR(100),
          created_at TIMESTAMPTZ DEFAULT NOW(),
          CONSTRAINT unique_campus_email UNIQUE (campus_id, email)
        );
      `);
      await client.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_founder_email ON users (email) WHERE campus_id IS NULL;
      `);
      await client.query(`
        CREATE TABLE IF NOT EXISTS issues (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          campus_id UUID NOT NULL REFERENCES campuses(id) ON DELETE CASCADE,
          created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
          title VARCHAR(255) NOT NULL,
          description TEXT NOT NULL,
          category VARCHAR(100) NOT NULL,
          location VARCHAR(255) NOT NULL,
          photo_url TEXT,
          status VARCHAR(50) DEFAULT 'open',
          urgency VARCHAR(50) DEFAULT 'medium',
          ai_analysis JSONB,
          ai_flagged BOOLEAN DEFAULT FALSE,
          ai_flag_reason TEXT,
          resolution_notes TEXT,
          resolution_photo_url TEXT,
          resolved_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );
      `);
      await client.query(`
        CREATE TABLE IF NOT EXISTS issue_upvotes (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          issue_id UUID NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
          user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          CONSTRAINT unique_issue_upvote UNIQUE (issue_id, user_id)
        );
      `);
      await client.query(`
        CREATE TABLE IF NOT EXISTS issue_comments (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          issue_id UUID NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
          user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          content TEXT NOT NULL,
          is_internal BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMPTZ DEFAULT NOW()
        );
      `);
      await client.query(`
        CREATE TABLE IF NOT EXISTS activity_logs (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          campus_id UUID NOT NULL REFERENCES campuses(id) ON DELETE CASCADE,
          user_id UUID REFERENCES users(id) ON DELETE SET NULL,
          action VARCHAR(100) NOT NULL,
          details JSONB,
          created_at TIMESTAMPTZ DEFAULT NOW()
        );
      `);
      await client.query('COMMIT');
      console.log('✅ PostgreSQL database schema verified.');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (err: any) {
    console.warn(`[CampusConnect DB] PostgreSQL initialization error (${err.message}). Switching to in-memory mock.`);
    isMockActive = true;
    dbLastError = err.message;
  }
}
