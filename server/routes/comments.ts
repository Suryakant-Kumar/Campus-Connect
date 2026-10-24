import { Router, Request, Response } from 'express';
import { getPool, isDbConfigured } from '../db.js';
import { authenticate } from '../auth.js';

const router = Router();

/**
 * Get issue comments/chat thread
 * Polled every few seconds on frontend
 */
router.get('/issues/:issueId/comments', authenticate, async (req: Request, res: Response): Promise<void> => {
  if (!isDbConfigured()) {
    res.status(503).json({ error: 'DATABASE_URL is not configured.' });
    return;
  }

  const { issueId } = req.params;
  const currentUser = req.user!;
  const pool = getPool();

  try {
    // Check issue and campus
    const issueRes = await pool.query('SELECT id, campus_id FROM issues WHERE id = $1', [issueId]);
    if (issueRes.rows.length === 0) {
      res.status(404).json({ error: 'Issue not found.' });
      return;
    }
    const issue = issueRes.rows[0];

    if (currentUser.role !== 'founder' && currentUser.campusId !== issue.campus_id) {
      res.status(403).json({ error: 'Access denied.' });
      return;
    }

    // Role visibility: regular users and platform founders do not see internal staff comments (private chat)
    const canSeeInternal = ['worker', 'co_admin', 'admin'].includes(currentUser.role);

    const query = `
      SELECT c.id, c.issue_id, c.content, c.is_internal, c.created_at,
             u.id AS user_id, u.name AS user_name, u.role AS user_role, u.department AS user_department
      FROM issue_comments c
      JOIN users u ON c.user_id = u.id
      WHERE c.issue_id = $1 ${canSeeInternal ? '' : 'AND c.is_internal = false'}
      ORDER BY c.created_at ASC
    `;

    const result = await pool.query(query, [issueId]);

    res.json(result.rows);
  } catch (err: any) {
    console.error('Error fetching issue comments:', err);
    res.status(500).json({ error: 'Failed to retrieve comments.' });
  }
});

/**
 * Post a new comment / chat message on an issue
 */
router.post('/issues/:issueId/comments', authenticate, async (req: Request, res: Response): Promise<void> => {
  if (!isDbConfigured()) {
    res.status(503).json({ error: 'DATABASE_URL is not configured.' });
    return;
  }

  const { issueId } = req.params;
  const { content, isInternal } = req.body;
  const currentUser = req.user!;

  if (!content || typeof content !== 'string' || content.trim() === '') {
    res.status(400).json({ error: 'Comment message cannot be empty.' });
    return;
  }

  const pool = getPool();

  try {
    const issueRes = await pool.query('SELECT id, campus_id FROM issues WHERE id = $1', [issueId]);
    if (issueRes.rows.length === 0) {
      res.status(404).json({ error: 'Issue not found.' });
      return;
    }
    const issue = issueRes.rows[0];

    if (currentUser.role !== 'founder' && currentUser.campusId !== issue.campus_id) {
      res.status(403).json({ error: 'Access denied across different campus.' });
      return;
    }

    // Only staff can mark a note as internal
    const isStaff = ['worker', 'co_admin', 'admin', 'founder'].includes(currentUser.role);
    const flagInternal = Boolean(isInternal && isStaff);

    const insertRes = await pool.query(
      `INSERT INTO issue_comments (issue_id, user_id, content, is_internal)
       VALUES ($1, $2, $3, $4)
       RETURNING id, issue_id, content, is_internal, created_at`,
      [issueId, currentUser.id, content.trim(), flagInternal]
    );

    const comment = insertRes.rows[0];

    res.status(201).json({
      ...comment,
      user_id: currentUser.id,
      user_name: currentUser.name,
      user_role: currentUser.role,
      user_department: currentUser.department,
    });
  } catch (err: any) {
    console.error('Error posting issue comment:', err);
    res.status(500).json({ error: 'Failed to post comment.' });
  }
});

export default router;
