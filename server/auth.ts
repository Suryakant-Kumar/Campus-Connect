import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { getPool } from './db.js';

export type UserRole = 'user' | 'worker' | 'co_admin' | 'admin' | 'founder';

// Hierarchy: founder > admin > co_admin > worker > user
const ROLE_HIERARCHY: Record<UserRole, number> = {
  founder: 100,
  admin: 50,
  co_admin: 40,
  worker: 20,
  user: 10,
};

export const RESERVED_SLUGS = new Set([
  'www',
  'api',
  'admin',
  'platform',
  'app',
  'c',
  'auth',
  'campuses',
  'campus',
  'dashboard',
  'settings',
  'founder',
  'help',
  'status',
  'assets',
  'static',
  'public',
  'null',
  'undefined',
]);

/**
 * Check if a slug is a reserved system name
 */
export function isReservedSlug(slug: string): boolean {
  if (!slug) return true;
  return RESERVED_SLUGS.has(slug.toLowerCase().trim());
}

/**
 * Generate a safe slug containing only letters, numbers, and hyphens.
 * Deduplicates hyphens and strips leading/trailing hyphens.
 */
export function sanitizeSlug(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Generate a safe unique slug from campus name and optional city.
 * Guarantees only letters, numbers, and hyphens, and blocks reserved names.
 */
export function generateSafeSlug(name: string, city?: string): string {
  let base = sanitizeSlug(name);
  if (city && city.trim() !== '') {
    const cleanCity = sanitizeSlug(city);
    if (cleanCity && !base.includes(cleanCity)) {
      base = `${base}-${cleanCity}`;
    }
  }

  if (!base || base.length < 2) {
    base = `campus-${Math.random().toString(36).substring(2, 6)}`;
  }

  // If reserved name, append '-campus'
  if (isReservedSlug(base)) {
    base = `${base}-campus`;
  }

  return base;
}

export interface TokenPayload {
  userId: string;
  email: string;
  name: string;
  role: UserRole;
  campusId: string | null;
  campusSlug: string | null;
  exp: number; // Unix timestamp in seconds (7 days)
  iat: number;
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  campusId: string | null;
  campusSlug: string | null;
  department?: string | null;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
      campus?: {
        id: string;
        name: string;
        slug: string;
        type: string;
      };
    }
  }
}

const SESSION_SECRET = process.env.SESSION_SECRET || 'campusconnect-secure-hmac-secret-salt-2026-production';

/**
 * Hash password with scrypt and a random salt
 */
export async function hashPassword(password: string): Promise<{ hash: string; salt: string }> {
  return new Promise((resolve, reject) => {
    const salt = crypto.randomBytes(16).toString('hex');
    crypto.scrypt(password, salt, 64, (err, derivedKey) => {
      if (err) return reject(err);
      resolve({
        hash: derivedKey.toString('hex'),
        salt,
      });
    });
  });
}

/**
 * Verify password against stored scrypt hash and salt
 */
export async function verifyPassword(password: string, storedHash: string, salt: string): Promise<boolean> {
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, 64, (err, derivedKey) => {
      if (err) return reject(err);
      const keyBuffer = derivedKey;
      const hashBuffer = Buffer.from(storedHash, 'hex');
      if (keyBuffer.length !== hashBuffer.length) {
        return resolve(false);
      }
      resolve(crypto.timingSafeEqual(keyBuffer, hashBuffer));
    });
  });
}

/**
 * Sign token using HMAC SHA-256 with 7-day expiration
 */
export function signToken(user: {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  campusId: string | null;
  campusSlug: string | null;
}): string {
  const now = Math.floor(Date.now() / 1000);
  const exp = now + 7 * 24 * 60 * 60; // 7 days

  const payload: TokenPayload = {
    userId: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    campusId: user.campusId,
    campusSlug: user.campusSlug,
    iat: now,
    exp,
  };

  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', SESSION_SECRET).update(payloadB64).digest('base64url');

  return `${payloadB64}.${signature}`;
}

/**
 * Verify HMAC token and return payload if valid and unexpired
 */
export function verifyToken(token: string): TokenPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 2) return null;

    const [payloadB64, signature] = parts;
    const expectedSignature = crypto.createHmac('sha256', SESSION_SECRET).update(payloadB64).digest('base64url');

    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
      return null;
    }

    const payload: TokenPayload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));

    const now = Math.floor(Date.now() / 1000);
    if (payload.exp < now) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

/**
 * Extract token from Authorization Bearer header or Cookie
 */
export function extractToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7).trim();
  }
  return null;
}

/**
 * Middleware: Verify user authentication and load active user from database
 */
export async function authenticate(req: Request, res: Response, next: NextFunction): Promise<void> {
  const token = extractToken(req);
  if (!token) {
    res.status(401).json({ error: 'Authentication required. Please log in.' });
    return;
  }

  const payload = verifyToken(token);
  if (!payload) {
    res.status(401).json({ error: 'Session expired or invalid. Please log in again.' });
    return;
  }

  try {
    const pool = getPool();
    const result = await pool.query(
      `SELECT u.id, u.email, u.name, u.role, u.campus_id, u.department, c.slug AS campus_slug
       FROM users u
       LEFT JOIN campuses c ON u.campus_id = c.id
       WHERE u.id = $1`,
      [payload.userId]
    );

    if (result.rows.length === 0) {
      res.status(401).json({ error: 'User account not found.' });
      return;
    }

    const row = result.rows[0];
    req.user = {
      id: row.id,
      email: row.email,
      name: row.name,
      role: row.role as UserRole,
      campusId: row.campus_id,
      campusSlug: row.campus_slug,
      department: row.department,
    };

    next();
  } catch (error) {
    console.error('Authentication database query error:', error);
    res.status(500).json({ error: 'Internal authentication verification error.' });
  }
}

/**
 * Optional authentication: loads user if token is valid, but does not block if not logged in
 */
export async function optionalAuthenticate(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const token = extractToken(req);
  if (!token) return next();

  const payload = verifyToken(token);
  if (!payload) return next();

  try {
    const pool = getPool();
    const result = await pool.query(
      `SELECT u.id, u.email, u.name, u.role, u.campus_id, u.department, c.slug AS campus_slug
       FROM users u
       LEFT JOIN campuses c ON u.campus_id = c.id
       WHERE u.id = $1`,
      [payload.userId]
    );

    if (result.rows.length > 0) {
      const row = result.rows[0];
      req.user = {
        id: row.id,
        email: row.email,
        name: row.name,
        role: row.role as UserRole,
        campusId: row.campus_id,
        campusSlug: row.campus_slug,
        department: row.department,
      };
    }
  } catch {
    // Continue without req.user
  }
  next();
}

/**
 * Enforce minimum role level.
 * Example: requireRole('co_admin') allows 'co_admin', 'admin', and 'founder'.
 */
export function requireRole(minimumRole: UserRole) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized. Please sign in.' });
      return;
    }

    const userWeight = ROLE_HIERARCHY[req.user.role] ?? 0;
    const requiredWeight = ROLE_HIERARCHY[minimumRole] ?? 0;

    if (userWeight < requiredWeight) {
      res.status(403).json({
        error: `Access denied. Requires '${minimumRole}' privileges or higher.`,
      });
      return;
    }

    next();
  };
}

/**
 * Helper to extract campus slug from host or path if present
 */
export function extractSlugFromHostOrPath(req: Request): string | null {
  // Check path /c/:slug
  const pathMatch = req.path.match(/^\/c\/([a-z0-9-]+)/i);
  if (pathMatch) return pathMatch[1].toLowerCase();

  // Check host subdomain (e.g. mit.localhost or mit.campusconnect.com)
  const host = req.hostname || req.headers.host || '';
  const cleanHost = host.split(':')[0].toLowerCase();
  const parts = cleanHost.split('.');

  if (parts.length === 2 && parts[1] === 'localhost' && parts[0] !== 'localhost') {
    return parts[0];
  }

  if (parts.length >= 3 && !cleanHost.endsWith('run.app') && !cleanHost.endsWith('cloudrun.app')) {
    const sub = parts[0];
    if (!RESERVED_SLUGS.has(sub)) return sub;
  }

  return null;
}

/**
 * Middleware: Resolves the campus from request context (params, header, query, host, path).
 * Queries database/mock to ensure the campus exists.
 * Returns 404 if the campus cannot be found.
 */
export async function resolveCampus(req: Request, res: Response, next: NextFunction): Promise<void> {
  const targetSlug = (
    req.params.campusSlug ||
    req.query.campus ||
    req.headers['x-campus-slug'] ||
    extractSlugFromHostOrPath(req)
  ) as string | undefined;

  if (!targetSlug || typeof targetSlug !== 'string' || targetSlug.trim() === '') {
    res.status(400).json({ error: 'Campus slug is required.' });
    return;
  }

  const cleanSlug = targetSlug.toLowerCase().trim();
  const pool = getPool();

  try {
    const campusRes = await pool.query(
      'SELECT id, name, slug, type, description, address FROM campuses WHERE slug = $1',
      [cleanSlug]
    );

    if (campusRes.rows.length === 0) {
      res.status(404).json({ error: `Campus "${cleanSlug}" not found.` });
      return;
    }

    req.campus = campusRes.rows[0];
    next();
  } catch (err: any) {
    console.error('Error resolving campus:', err);
    res.status(500).json({ error: 'Internal server error resolving campus.' });
  }
}

/**
 * Middleware: Validates that the authenticated user is an active member of the resolved campus.
 * Must run after `authenticate` and `resolveCampus`.
 * Returns 403 if the user belongs to a different campus.
 */
export function checkCampusMembership(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized. Please sign in.' });
    return;
  }

  if (!req.campus) {
    res.status(500).json({ error: 'Campus context missing in middleware chain.' });
    return;
  }

  // Founder has global oversight
  if (req.user.role === 'founder') {
    return next();
  }

  // Check that user's campus matches resolved campus
  if (req.user.campusId !== req.campus.id) {
    res.status(403).json({
      error: 'Forbidden. You do not belong to this campus domain.',
    });
    return;
  }

  next();
}

/**
 * Complete middleware chain for any campus route:
 * 1. Read token & authenticate
 * 2. Resolve campus from slug (404 if not found)
 * 3. Check active membership in THAT campus (403 if mismatched)
 * 4. Check role requirement if specified (403 if insufficient)
 */
export function campusGuard(minimumRole?: UserRole) {
  return [
    authenticate,
    resolveCampus,
    checkCampusMembership,
    ...(minimumRole ? [requireRole(minimumRole)] : []),
  ];
}

/**
 * Backward compatibility alias for enforceCampusIsolation
 */
export const enforceCampusIsolation = [resolveCampus, checkCampusMembership];

