import { Router, Request, Response } from 'express';
import { getPool, isDbConfigured } from '../db.js';
import {
  authenticate,
  requireRole,
  resolveCampus,
  checkCampusMembership,
} from '../auth.js';
import { analyzeIssueWithGemini } from '../ai.js';

const router = Router();

/**
 * List campus issues with filters, upvote counts, comments count, and search
 */
router.get(
  '/campus/:campusSlug/issues',
  authenticate,
  resolveCampus,
  checkCampusMembership,
  async (req: Request, res: Response): Promise<void> => {
  if (!isDbConfigured()) {
    res.status(503).json({ error: 'DATABASE_URL is not configured.' });
    return;
  }

  const { campusSlug } = req.params;
  const { status, category, urgency, filter, search } = req.query;
  const currentUser = req.user!;
  const pool = getPool();

  try {
    // Resolve campus
    const campusRes = await pool.query('SELECT id FROM campuses WHERE slug = $1', [campusSlug.toLowerCase().trim()]);
    if (campusRes.rows.length === 0) {
      res.status(404).json({ error: 'Campus not found.' });
      return;
    }
    const campusId = campusRes.rows[0].id;

    const conditions: string[] = ['i.campus_id = $1'];
    const params: any[] = [campusId];

    // Status filter
    if (status && status !== 'all') {
      params.push(status);
      conditions.push(`i.status = $${params.length}`);
    }

    // Category filter
    if (category && category !== 'all') {
      params.push(category);
      conditions.push(`i.category = $${params.length}`);
    }

    // Urgency filter
    if (urgency && urgency !== 'all') {
      params.push(urgency);
      conditions.push(`i.urgency = $${params.length}`);
    }

    // User personal filter
    if (filter === 'my_issues') {
      params.push(currentUser.id);
      conditions.push(`i.created_by = $${params.length}`);
    } else if (filter === 'assigned_to_me') {
      params.push(currentUser.id);
      conditions.push(`i.assigned_to = $${params.length}`);
    }

    // Search filter
    if (search && typeof search === 'string' && search.trim() !== '') {
      params.push(`%${search.trim().toLowerCase()}%`);
      conditions.push(`(LOWER(i.title) LIKE $${params.length} OR LOWER(i.description) LIKE $${params.length} OR LOWER(i.location) LIKE $${params.length})`);
    }

    // Current user upvote param
    params.push(currentUser.id);
    const userIdParamIndex = params.length;

    const query = `
      SELECT i.id, i.campus_id, i.title, i.description, i.category, i.location, i.photo_url,
             i.status, i.urgency, i.ai_analysis, i.ai_flagged, i.ai_flag_reason,
             i.resolution_notes, i.resolution_photo_url, i.resolved_at,
             i.created_at, i.updated_at,
             u.id AS creator_id, u.name AS creator_name, u.email AS creator_email,
             w.id AS worker_id, w.name AS worker_name, w.department AS worker_department,
             (SELECT COUNT(*) FROM issue_upvotes uo WHERE uo.issue_id = i.id) AS upvotes_count,
             EXISTS(SELECT 1 FROM issue_upvotes uo WHERE uo.issue_id = i.id AND uo.user_id = $${userIdParamIndex}) AS has_upvoted,
             (SELECT COUNT(*) FROM issue_comments ic WHERE ic.issue_id = i.id) AS comments_count
      FROM issues i
      JOIN users u ON i.created_by = u.id
      LEFT JOIN users w ON i.assigned_to = w.id
      WHERE ${conditions.join(' AND ')}
      ORDER BY 
        CASE 
          WHEN i.status = 'open' AND i.urgency = 'critical' THEN 1
          WHEN i.status = 'in_progress' AND i.urgency = 'critical' THEN 2
          WHEN i.status = 'open' AND i.urgency = 'high' THEN 3
          WHEN i.status = 'open' THEN 4
          WHEN i.status = 'in_progress' THEN 5
          ELSE 6
        END,
        i.created_at DESC
      LIMIT 100
    `;

    const result = await pool.query(query, params);

    res.json(result.rows);
  } catch (err: any) {
    console.error('Error fetching campus issues:', err);
    res.status(500).json({ error: 'Failed to retrieve campus issues.' });
  }
});

/**
 * Raise a new issue (with server-side Gemini AI triage)
 */
router.post(
  '/campus/:campusSlug/issues',
  authenticate,
  resolveCampus,
  checkCampusMembership,
  async (req: Request, res: Response): Promise<void> => {
  if (!isDbConfigured()) {
    res.status(503).json({ error: 'DATABASE_URL is not configured.' });
    return;
  }

  const { campusSlug } = req.params;
  const { title, description, category, location, photoUrl } = req.body;
  const currentUser = req.user!;

  if (!title || !description || !category || !location) {
    res.status(400).json({ error: 'Title, description, category, and specific location are required.' });
    return;
  }

  const pool = getPool();

  try {
    const campusRes = await pool.query('SELECT id, name FROM campuses WHERE slug = $1', [campusSlug.toLowerCase().trim()]);
    if (campusRes.rows.length === 0) {
      res.status(404).json({ error: 'Campus not found.' });
      return;
    }
    const campus = campusRes.rows[0];

    // 1. Run Server-Side Gemini AI Check
    console.log(`Running Gemini AI triage for issue: "${title}" on campus ${campus.name}...`);
    const aiResult = await analyzeIssueWithGemini(title, description, category, location);

    // 2. Insert into PostgreSQL issues
    const insertRes = await pool.query(
      `INSERT INTO issues (
        campus_id, created_by, title, description, category, location, photo_url,
        status, urgency, ai_analysis, ai_flagged, ai_flag_reason
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'open', $8, $9, $10, $11)
      RETURNING *`,
      [
        campus.id,
        currentUser.id,
        title.trim(),
        description.trim(),
        aiResult.suggestedCategory || category,
        location.trim(),
        photoUrl || null,
        aiResult.urgency,
        JSON.stringify(aiResult),
        aiResult.isFlagged,
        aiResult.flagReason,
      ]
    );

    const createdIssue = insertRes.rows[0];

    // 3. Log Activity
    await pool.query(
      `INSERT INTO activity_logs (campus_id, user_id, action, details)
       VALUES ($1, $2, 'issue_created', $3)`,
      [
        campus.id,
        currentUser.id,
        JSON.stringify({
          issueId: createdIssue.id,
          title: createdIssue.title,
          urgency: createdIssue.urgency,
          aiProvider: aiResult.aiProvider,
        }),
      ]
    );

    res.status(201).json({
      message: aiResult.isFlagged
        ? 'Issue submitted, but flagged for admin review by automated safety checks.'
        : 'Issue submitted successfully with AI validation!',
      issue: {
        ...createdIssue,
        creator_id: currentUser.id,
        creator_name: currentUser.name,
        upvotes_count: 0,
        has_upvoted: false,
        comments_count: 0,
      },
      aiAnalysis: aiResult,
    });
  } catch (err: any) {
    console.error('Error creating issue:', err);
    res.status(500).json({ error: err.message || 'Failed to submit issue.' });
  }
});

/**
 * Toggle Upvote on an Issue
 */
router.post('/issues/:issueId/upvote', authenticate, async (req: Request, res: Response): Promise<void> => {
  const { issueId } = req.params;
  const currentUser = req.user!;
  const pool = getPool();

  try {
    // Check issue existence and campus match
    const issueRes = await pool.query('SELECT id, campus_id FROM issues WHERE id = $1', [issueId]);
    if (issueRes.rows.length === 0) {
      res.status(404).json({ error: 'Issue not found.' });
      return;
    }

    const issue = issueRes.rows[0];
    if (currentUser.role !== 'founder' && currentUser.campusId !== issue.campus_id) {
      res.status(403).json({ error: 'You can only upvote issues within your own campus.' });
      return;
    }

    // Check if already upvoted
    const existing = await pool.query('SELECT id FROM issue_upvotes WHERE issue_id = $1 AND user_id = $2', [
      issueId,
      currentUser.id,
    ]);

    let hasUpvoted = false;

    if (existing.rows.length > 0) {
      // Remove upvote
      await pool.query('DELETE FROM issue_upvotes WHERE issue_id = $1 AND user_id = $2', [issueId, currentUser.id]);
      hasUpvoted = false;
    } else {
      // Add upvote
      await pool.query('INSERT INTO issue_upvotes (issue_id, user_id) VALUES ($1, $2)', [issueId, currentUser.id]);
      hasUpvoted = true;
    }

    // Get fresh total count
    const countRes = await pool.query('SELECT COUNT(*) FROM issue_upvotes WHERE issue_id = $1', [issueId]);
    const upvotesCount = Number(countRes.rows[0].count);

    res.json({
      hasUpvoted,
      upvotesCount,
    });
  } catch (err: any) {
    console.error('Error toggling upvote:', err);
    res.status(500).json({ error: 'Failed to toggle upvote.' });
  }
});

/**
 * Update Issue Status (workers, co_admins, admins)
 */
router.patch('/issues/:issueId/status', authenticate, async (req: Request, res: Response): Promise<void> => {
  const { issueId } = req.params;
  const { status, resolutionNotes, resolutionPhotoUrl } = req.body;
  const currentUser = req.user!;
  const pool = getPool();

  const validStatuses = ['open', 'in_progress', 'resolved', 'rejected'];
  if (!validStatuses.includes(status)) {
    res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
    return;
  }

  // Ensure role is at least worker
  if (!['worker', 'co_admin', 'admin', 'founder'].includes(currentUser.role)) {
    res.status(403).json({ error: 'Only assigned workers, co-admins, and admins can change issue status.' });
    return;
  }

  try {
    const issueRes = await pool.query('SELECT * FROM issues WHERE id = $1', [issueId]);
    if (issueRes.rows.length === 0) {
      res.status(404).json({ error: 'Issue not found.' });
      return;
    }

    const issue = issueRes.rows[0];
    if (currentUser.role !== 'founder' && currentUser.campusId !== issue.campus_id) {
      res.status(403).json({ error: 'Access denied across different campus.' });
      return;
    }

    const isResolved = status === 'resolved';

    const updateRes = await pool.query(
      `UPDATE issues
       SET status = $1,
           resolution_notes = CASE WHEN $2::text IS NOT NULL THEN $2 ELSE resolution_notes END,
           resolution_photo_url = CASE WHEN $3::text IS NOT NULL THEN $3 ELSE resolution_photo_url END,
           resolved_at = CASE WHEN $4::boolean THEN NOW() ELSE resolved_at END,
           updated_at = NOW()
       WHERE id = $5
       RETURNING *`,
      [status, resolutionNotes || null, resolutionPhotoUrl || null, isResolved, issueId]
    );

    // Auto add resolution note to comments if provided
    if (isResolved && resolutionNotes) {
      await pool.query(
        `INSERT INTO issue_comments (issue_id, user_id, content, is_internal)
         VALUES ($1, $2, $3, false)`,
        [issueId, currentUser.id, `✅ Resolution Summary: ${resolutionNotes}`]
      );
    }

    // Log Activity
    await pool.query(
      `INSERT INTO activity_logs (campus_id, user_id, action, details)
       VALUES ($1, $2, 'status_updated', $3)`,
      [issue.campus_id, currentUser.id, JSON.stringify({ issueId, oldStatus: issue.status, newStatus: status })]
    );

    res.json({
      message: `Issue marked as ${status}.`,
      issue: updateRes.rows[0],
    });
  } catch (err: any) {
    console.error('Error updating issue status:', err);
    res.status(500).json({ error: 'Failed to update issue status.' });
  }
});

/**
 * Assign Worker to Issue (Co-Admin or Admin only)
 */
router.patch('/issues/:issueId/assign', authenticate, requireRole('co_admin'), async (req: Request, res: Response): Promise<void> => {
  const { issueId } = req.params;
  const { workerId } = req.body;
  const currentUser = req.user!;
  const pool = getPool();

  try {
    const issueRes = await pool.query('SELECT * FROM issues WHERE id = $1', [issueId]);
    if (issueRes.rows.length === 0) {
      res.status(404).json({ error: 'Issue not found.' });
      return;
    }
    const issue = issueRes.rows[0];

    if (currentUser.role !== 'founder' && currentUser.campusId !== issue.campus_id) {
      res.status(403).json({ error: 'Access denied.' });
      return;
    }

    // If workerId is provided, verify worker belongs to this campus
    let workerName = 'Unassigned';
    if (workerId) {
      const workerRes = await pool.query('SELECT id, name, role FROM users WHERE id = $1 AND campus_id = $2', [
        workerId,
        issue.campus_id,
      ]);
      if (workerRes.rows.length === 0) {
        res.status(400).json({ error: 'Selected worker does not belong to this campus.' });
        return;
      }
      workerName = workerRes.rows[0].name;
    }

    const updateRes = await pool.query(
      `UPDATE issues
       SET assigned_to = $1,
           status = CASE WHEN status = 'open' AND $1::uuid IS NOT NULL THEN 'in_progress' ELSE status END,
           updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [workerId || null, issueId]
    );

    // Add automated note
    await pool.query(
      `INSERT INTO issue_comments (issue_id, user_id, content, is_internal)
       VALUES ($1, $2, $3, false)`,
      [issueId, currentUser.id, workerId ? `Assigned to worker ${workerName}.` : 'Worker unassigned. Ticket returned to pool.']
    );

    res.json({
      message: workerId ? `Assigned to ${workerName}.` : 'Issue unassigned.',
      issue: updateRes.rows[0],
    });
  } catch (err: any) {
    console.error('Error assigning worker:', err);
    res.status(500).json({ error: 'Failed to assign worker.' });
  }
});

export default router;
