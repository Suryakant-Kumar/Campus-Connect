import {
  Campus,
  User,
  Issue,
  IssueComment,
  StaffMember,
  CampusStats,
  FounderAnalytics,
} from './types';

const TOKEN_KEY = 'campusconnect_auth_token';

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearStoredToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

/**
 * Detect campus slug from current hostname or query parameter
 * Examples:
 * - "oxford.campusconnect.com" -> "oxford"
 * - "greenvalley.localhost" -> "greenvalley"
 * - "https://myapp.com/?campus=greenvalley" -> "greenvalley"
 */
export function detectCampusSlug(): string | null {
  const url = new URL(window.location.href);

  // 1. Check path /c/slug if used
  const pathMatch = window.location.pathname.match(/^\/c\/([a-z0-9-]+)/i);
  if (pathMatch) {
    return pathMatch[1].toLowerCase();
  }

  // 2. Check URL query param ?campus=slug (essential for preview and iframe testing)
  const paramCampus = url.searchParams.get('campus');
  if (paramCampus && paramCampus.trim() !== '') {
    return paramCampus.trim().toLowerCase();
  }

  // 3. Check Subdomain (e.g. mit.localhost or mit.campusconnect.com)
  const hostname = window.location.hostname;
  const parts = hostname.split('.');

  // Support <slug>.localhost
  if (parts.length === 2 && parts[1] === 'localhost' && parts[0] !== 'localhost') {
    return parts[0].toLowerCase();
  }

  // Support <slug>.campusconnect.com
  if (parts.length >= 3 && !hostname.endsWith('run.app') && !hostname.endsWith('cloudrun.app')) {
    const subdomain = parts[0].toLowerCase();
    const reserved = ['www', 'app', 'api', 'admin', 'platform', 'status', 'help'];
    if (!reserved.includes(subdomain)) {
      return subdomain;
    }
  }

  return null;
}

export async function apiRequest<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getStoredToken();
  const headers = new Headers(options.headers || {});

  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const campusSlug = detectCampusSlug();
  if (campusSlug) {
    headers.set('x-campus-slug', campusSlug);
  }

  const response = await fetch(endpoint, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const message = data?.error || `Request failed with status ${response.status}`;
    throw new Error(message);
  }

  return data as T;
}

// Auth API
export async function registerAdminAndCampus(body: {
  adminName: string;
  adminEmail: string;
  adminPassword: string;
  campusName: string;
  campusSlug?: string;
  campusType: string;
  city?: string;
  campusDescription?: string;
  campusAddress?: string;
}) {
  const res = await apiRequest<{ token: string; user: User; campus: Campus; campusLink: string; localLink?: string }>(
    '/api/auth/register-admin-and-campus',
    {
      method: 'POST',
      body: JSON.stringify(body),
    }
  );
  setStoredToken(res.token);
  return res;
}

export async function registerUser(body: {
  email: string;
  password: string;
  name: string;
  campusSlug: string;
  phone?: string;
  department?: string;
}) {
  const res = await apiRequest<{ token: string; user: User; campus: Campus }>(
    '/api/auth/register-user',
    {
      method: 'POST',
      body: JSON.stringify(body),
    }
  );
  setStoredToken(res.token);
  return res;
}

export async function loginUser(body: {
  email: string;
  password: string;
  campusSlug?: string;
}) {
  const res = await apiRequest<{ token: string; user: User; campus: Campus | null }>(
    '/api/auth/login',
    {
      method: 'POST',
      body: JSON.stringify(body),
    }
  );
  setStoredToken(res.token);
  return res;
}

export async function getCurrentUser() {
  return apiRequest<{ user: User }>('/api/auth/me');
}

// Campuses API
export async function getCampusBySlug(slug: string) {
  return apiRequest<Campus>(`/api/campuses/by-slug/${slug}`);
}

export async function listAllCampuses() {
  return apiRequest<Campus[]>('/api/campuses/list');
}

export async function getCampusStats(slug: string) {
  return apiRequest<CampusStats>(`/api/campuses/${slug}/stats`);
}

// Issues API
export async function getCampusIssues(
  slug: string,
  filters: {
    status?: string;
    category?: string;
    urgency?: string;
    filter?: string;
    search?: string;
  } = {}
) {
  const params = new URLSearchParams();
  if (filters.status && filters.status !== 'all') params.set('status', filters.status);
  if (filters.category && filters.category !== 'all') params.set('category', filters.category);
  if (filters.urgency && filters.urgency !== 'all') params.set('urgency', filters.urgency);
  if (filters.filter && filters.filter !== 'all') params.set('filter', filters.filter);
  if (filters.search && filters.search.trim() !== '') params.set('search', filters.search.trim());

  const qs = params.toString();
  return apiRequest<Issue[]>(`/api/campus/${slug}/issues${qs ? `?${qs}` : ''}`);
}

export async function createIssue(
  slug: string,
  body: {
    title: string;
    description: string;
    category: string;
    location: string;
    photoUrl?: string | null;
  }
) {
  return apiRequest<{ message: string; issue: Issue; aiAnalysis: any }>(
    `/api/campus/${slug}/issues`,
    {
      method: 'POST',
      body: JSON.stringify(body),
    }
  );
}

export async function toggleIssueUpvote(issueId: string) {
  return apiRequest<{ hasUpvoted: boolean; upvotesCount: number }>(
    `/api/issues/${issueId}/upvote`,
    {
      method: 'POST',
    }
  );
}

export async function updateIssueStatus(
  issueId: string,
  body: {
    status: 'open' | 'in_progress' | 'resolved' | 'rejected';
    resolutionNotes?: string;
    resolutionPhotoUrl?: string;
  }
) {
  return apiRequest<{ message: string; issue: Issue }>(`/api/issues/${issueId}/status`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export async function assignIssueWorker(issueId: string, workerId: string | null) {
  return apiRequest<{ message: string; issue: Issue }>(`/api/issues/${issueId}/assign`, {
    method: 'PATCH',
    body: JSON.stringify({ workerId }),
  });
}

// Comments / Chat API
export async function getIssueComments(issueId: string) {
  return apiRequest<IssueComment[]>(`/api/issues/${issueId}/comments`);
}

export async function postIssueComment(
  issueId: string,
  content: string,
  isInternal: boolean = false
) {
  return apiRequest<IssueComment>(`/api/issues/${issueId}/comments`, {
    method: 'POST',
    body: JSON.stringify({ content, isInternal }),
  });
}

// Staff API (Admin Only)
export async function getCampusStaff(slug: string) {
  return apiRequest<StaffMember[]>(`/api/campus/${slug}/staff`);
}

export async function addCampusStaff(
  slug: string,
  body: {
    name: string;
    email: string;
    password: string;
    role: 'worker' | 'co_admin';
    department?: string;
    phone?: string;
  }
) {
  return apiRequest<{ message: string; staff: StaffMember }>(`/api/campus/${slug}/staff`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function removeCampusStaff(slug: string, userId: string) {
  return apiRequest<{ message: string }>(`/api/campus/${slug}/staff/${userId}`, {
    method: 'DELETE',
  });
}

export async function getCampusMembers(slug: string) {
  return apiRequest<StaffMember[]>(`/api/campus/${slug}/members`);
}

// Founder API (Founder Only)
export async function getFounderCampuses() {
  return apiRequest<any[]>('/api/campuses/founder/all-campuses');
}

export async function getFounderAnalytics() {
  return apiRequest<FounderAnalytics>('/api/campuses/founder/analytics');
}

export async function updateCampusStatus(campusId: string, status: 'active' | 'suspended') {
  return apiRequest<{ message: string; campus: any }>(`/api/campuses/founder/campuses/${campusId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}

// Update staff or member role
export async function updateMemberRole(campusSlug: string, userId: string, role: string) {
  return apiRequest<{ message: string; user: User }>(
    `/api/campus/${campusSlug}/members/${userId}/role`,
    {
      method: 'PATCH',
      body: JSON.stringify({ role }),
    }
  );
}

// Stateless Photo Upload
export async function uploadPhotoOnline(base64Data: string, filename?: string) {
  return apiRequest<{ url: string; provider: string }>('/api/upload', {
    method: 'POST',
    body: JSON.stringify({
      data: base64Data,
      filename,
    }),
  });
}

// System Health Check
export async function getSystemHealth() {
  return apiRequest<{
    status: string;
    database: {
      status: string;
      configured: boolean;
      error: string | null;
      campusCount: number;
    };
    gemini: {
      configured: boolean;
      model: string;
    };
    storage: {
      vercelBlob: boolean;
      supabase: boolean;
    };
  }>('/api/health');
}
