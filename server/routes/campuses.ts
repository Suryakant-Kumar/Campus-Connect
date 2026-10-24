import { Router, Request, Response } from 'express';
import { getPool, isDbConfigured } from '../db.js';
import {
  authenticate,
  requireRole,
  resolveCampus,
  checkCampusMembership,
  isReservedSlug,
  generateSafeSlug,
  sanitizeSlug,
  signToken,
} from '../auth.js';

const router = Router();

/**
 * Register a new campus by an authenticated admin
 */
router.post('/register', authenticate, async (req: Request, res: Response): Promise<void> => {
  const currentUser = req.user!;

  if (!['admin', 'founder'].includes(currentUser.role)) {
    res.status(403).json({ error: 'Only admins can register a new campus.' });
    return;
  }

  const { name, type, city, description, address, customSlug } = req.body;

  if (!name || !type) {
    res.status(400).json({ error: 'Campus name and type are required.' });
    return;
  }

  const validTypes = ['university', 'school', 'hostel', 'pg', 'residential_society', 'other'];
  if (!validTypes.includes(type)) {
    res.status(400).json({ error: `Invalid campus type. Must be one of: ${validTypes.join(', ')}` });
    return;
  }

  // Generate or sanitize slug
  let slug = customSlug ? sanitizeSlug(customSlug) : generateSafeSlug(name, city);

  if (isReservedSlug(slug)) {
    res.status(400).json({
      error: `Reserved slug name: "${slug}" cannot be used as a campus subdomain. Reserved names include www, api, admin, platform.`,
    });
    return;
  }

  if (slug.length < 3) {
    res.status(400).json({ error: 'Campus slug must be at least 3 alphanumeric characters.' });
    return;
  }

  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) {
    res.status(400).json({
      error: 'Campus slug may only contain letters, numbers, and single hyphens, with no trailing hyphens.',
    });
    return;
  }

  const pool = getPool();
  try {
    const existing = await pool.query('SELECT id FROM campuses WHERE slug = $1', [slug]);
    if (existing.rows.length > 0) {
      res.status(409).json({ error: `Subdomain/slug "${slug}" is already registered. Please choose another.` });
      return;
    }

    const combinedAddress = city
      ? address
        ? `${city}, ${address}`
        : city
      : address || '';

    const campusRes = await pool.query(
      `INSERT INTO campuses (name, slug, type, description, address, contact_email)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, name, slug, type, description, address, created_at`,
      [name.trim(), slug, type, description || '', combinedAddress, currentUser.email]
    );
    const campus = campusRes.rows[0];

    // Assign admin user to this campus if not already assigned
    await pool.query('UPDATE users SET campus_id = $1 WHERE id = $2', [campus.id, currentUser.id]);

    const token = signToken({
      id: currentUser.id,
      email: currentUser.email,
      name: currentUser.name,
      role: 'admin',
      campusId: campus.id,
      campusSlug: campus.slug,
    });

    res.status(201).json({
      message: 'Campus registered successfully!',
      campus,
      campusLink: `${campus.slug}.campusconnect.com`,
      localLink: `/c/${campus.slug}`,
      token,
      user: {
        id: currentUser.id,
        email: currentUser.email,
        name: currentUser.name,
        role: 'admin',
        campusId: campus.id,
        campusSlug: campus.slug,
      },
    });
  } catch (err: any) {
    console.error('Error creating campus:', err);
    res.status(500).json({ error: err.message || 'Failed to create campus.' });
  }
});

/**
 * Get campus metadata by slug (publicly accessible for loading campus portal branding)
 */
router.get('/by-slug/:slug', async (req: Request, res: Response): Promise<void> => {
  if (!isDbConfigured()) {
    res.status(503).json({ error: 'DATABASE_URL is not configured.' });
    return;
  }

  const { slug } = req.params;
  const pool = getPool();

  try {
    const campusRes = await pool.query(
      `SELECT c.id, c.name, c.slug, c.type, c.description, c.address, c.created_at,
              (SELECT COUNT(*) FROM users u WHERE u.campus_id = c.id) AS member_count,
              (SELECT COUNT(*) FROM issues i WHERE i.campus_id = c.id AND i.status != 'resolved') AS open_issues_count,
              (SELECT COUNT(*) FROM issues i WHERE i.campus_id = c.id AND i.status = 'resolved') AS resolved_issues_count
       FROM campuses c
       WHERE c.slug = $1`,
      [slug.toLowerCase().trim()]
    );

    if (campusRes.rows.length === 0) {
      res.status(404).json({ error: `Campus "${slug}" not found.` });
      return;
    }

    res.json(campusRes.rows[0]);
  } catch (err: any) {
    console.error('Error fetching campus by slug:', err);
    res.status(500).json({ error: 'Failed to retrieve campus information.' });
  }
});

/**
 * List registered campuses for public directory / picker
 */
router.get('/list', async (_req: Request, res: Response): Promise<void> => {
  if (!isDbConfigured()) {
    res.status(503).json({ error: 'DATABASE_URL is not configured.' });
    return;
  }

  const pool = getPool();

  try {
    const result = await pool.query(
      `SELECT c.id, c.name, c.slug, c.type, c.description, c.address, c.created_at,
              (SELECT COUNT(*) FROM users u WHERE u.campus_id = c.id) AS member_count,
              (SELECT COUNT(*) FROM issues i WHERE i.campus_id = c.id) AS total_issues_count,
              (SELECT COUNT(*) FROM issues i WHERE i.campus_id = c.id AND i.status = 'resolved') AS resolved_issues_count
       FROM campuses c
       ORDER BY c.created_at DESC`
    );

    res.json(result.rows);
  } catch (err: any) {
    console.error('Error listing campuses:', err);
    res.status(500).json({ error: 'Failed to list campuses.' });
  }
});

/**
 * Campus internal analytics (Workers, Co-Admins, Admins)
 */
router.get(['/:campusSlug/stats', '/campus/:campusSlug/stats'], authenticate, resolveCampus, checkCampusMembership, async (req: Request, res: Response): Promise<void> => {
  const { campusSlug } = req.params;
  const pool = getPool();

  try {
    const campusRes = await pool.query('SELECT id FROM campuses WHERE slug = $1', [campusSlug.toLowerCase().trim()]);
    if (campusRes.rows.length === 0) {
      res.status(404).json({ error: 'Campus not found.' });
      return;
    }
    const campusId = campusRes.rows[0].id;

    // Issue counts by status
    const statusCounts = await pool.query(
      `SELECT status, COUNT(*) AS count
       FROM issues
       WHERE campus_id = $1
       GROUP BY status`,
      [campusId]
    );

    // Issue counts by urgency
    const urgencyCounts = await pool.query(
      `SELECT urgency, COUNT(*) AS count
       FROM issues
       WHERE campus_id = $1
       GROUP BY urgency`,
      [campusId]
    );

    // Issue counts by category
    const categoryCounts = await pool.query(
      `SELECT category, COUNT(*) AS count
       FROM issues
       WHERE campus_id = $1
       GROUP BY category
       ORDER BY count DESC
       LIMIT 6`,
      [campusId]
    );

    // Member count & worker count
    const memberCounts = await pool.query(
      `SELECT role, COUNT(*) AS count
       FROM users
       WHERE campus_id = $1
       GROUP BY role`,
      [campusId]
    );

    res.json({
      statusCounts: statusCounts.rows,
      urgencyCounts: urgencyCounts.rows,
      categoryCounts: categoryCounts.rows,
      memberCounts: memberCounts.rows,
    });
  } catch (err: any) {
    console.error('Error fetching campus stats:', err);
    res.status(500).json({ error: 'Failed to fetch campus metrics.' });
  }
});

/**
 * Global Founder Only: All campuses view
 */
router.get('/founder/all-campuses', authenticate, requireRole('founder'), async (_req: Request, res: Response): Promise<void> => {
  const pool = getPool();

  try {
    const result = await pool.query(
      `SELECT c.id, c.name, c.slug, c.type, c.status, c.description, c.address, c.contact_email, c.created_at,
              (SELECT COUNT(*) FROM users u WHERE u.campus_id = c.id) AS total_users,
              (SELECT COUNT(*) FROM users u WHERE u.campus_id = c.id AND u.role = 'admin') AS admin_count,
              (SELECT COUNT(*) FROM users u WHERE u.campus_id = c.id AND u.role = 'worker') AS worker_count,
              (SELECT COUNT(*) FROM issues i WHERE i.campus_id = c.id) AS total_issues,
              (SELECT COUNT(*) FROM issues i WHERE i.campus_id = c.id AND i.status = 'resolved') AS resolved_issues,
              (SELECT COUNT(*) FROM issues i WHERE i.campus_id = c.id AND i.urgency = 'critical' AND i.status != 'resolved') AS critical_open_issues
       FROM campuses c
       ORDER BY c.created_at DESC`
    );

    res.json(result.rows);
  } catch (err: any) {
    console.error('Founder error listing all campuses:', err);
    res.status(500).json({ error: 'Failed to retrieve global campuses data.' });
  }
});

/**
 * Global Founder Only: Suspend or Reactivate a campus
 */
router.patch('/founder/campuses/:campusId/status', authenticate, requireRole('founder'), async (req: Request, res: Response): Promise<void> => {
  const { campusId } = req.params;
  const { status } = req.body;

  if (!status || !['active', 'suspended'].includes(status)) {
    res.status(400).json({ error: 'Status must be "active" or "suspended".' });
    return;
  }

  const pool = getPool();
  try {
    const updateRes = await pool.query('UPDATE campuses SET status = $1 WHERE id = $2 RETURNING *', [status, campusId]);
    if (updateRes.rows.length === 0) {
      res.status(404).json({ error: 'Campus not found.' });
      return;
    }

    res.json({
      message: `Campus status successfully updated to ${status}.`,
      campus: updateRes.rows[0],
    });
  } catch (err: any) {
    console.error('Founder error updating campus status:', err);
    res.status(500).json({ error: 'Failed to update campus status.' });
  }
});

/**
 * Global Founder Only: Platform overview analytics
 */
router.get('/founder/analytics', authenticate, requireRole('founder'), async (_req: Request, res: Response): Promise<void> => {
  const pool = getPool();

  try {
    const totalCampuses = await pool.query('SELECT COUNT(*) FROM campuses');
    const totalUsers = await pool.query('SELECT COUNT(*) FROM users');
    const totalIssues = await pool.query('SELECT COUNT(*) FROM issues');
    const resolvedIssues = await pool.query("SELECT COUNT(*) FROM issues WHERE status = 'resolved'");
    const totalUpvotes = await pool.query('SELECT COUNT(*) FROM issue_upvotes');
    const totalComments = await pool.query('SELECT COUNT(*) FROM issue_comments');

    res.json({
      totalCampuses: Number(totalCampuses.rows[0].count),
      totalUsers: Number(totalUsers.rows[0].count),
      totalIssues: Number(totalIssues.rows[0].count),
      resolvedIssues: Number(resolvedIssues.rows[0].count),
      totalUpvotes: Number(totalUpvotes.rows[0].count),
      totalComments: Number(totalComments.rows[0].count),
    });
  } catch (err: any) {
    console.error('Founder error fetching analytics:', err);
    res.status(500).json({ error: 'Failed to retrieve platform analytics.' });
  }
});

export default router;
