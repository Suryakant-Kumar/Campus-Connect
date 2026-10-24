import { Router, Request, Response } from 'express';
import { getPool, isDbConfigured } from '../db.js';
import {
  authenticate,
  requireRole,
  hashPassword,
  resolveCampus,
  checkCampusMembership,
  UserRole,
} from '../auth.js';

const router = Router();

/**
 * Get staff members (workers, co-admins, admins) for assignment and team directory
 * Middleware: read token, resolve campus, check active membership in THAT campus
 */
router.get(
  '/campus/:campusSlug/staff',
  authenticate,
  resolveCampus,
  checkCampusMembership,
  async (req: Request, res: Response): Promise<void> => {
    const campus = req.campus!;
    const pool = getPool();

    try {
      const result = await pool.query(
        `SELECT u.id, u.name, u.email, u.role, u.department, u.phone, u.created_at,
                (SELECT COUNT(*) FROM issues i WHERE i.assigned_to = u.id AND i.status != 'resolved') AS active_assigned_count,
                (SELECT COUNT(*) FROM issues i WHERE i.assigned_to = u.id AND i.status = 'resolved') AS resolved_count
         FROM users u
         WHERE u.campus_id = $1 AND u.role IN ('worker', 'co_admin', 'admin')
         ORDER BY 
           CASE u.role 
             WHEN 'admin' THEN 1 
             WHEN 'co_admin' THEN 2 
             WHEN 'worker' THEN 3 
             ELSE 4 
           END,
           u.name ASC`,
        [campus.id]
      );

      res.json(result.rows);
    } catch (err: any) {
      console.error('Error fetching campus staff:', err);
      res.status(500).json({ error: 'Failed to retrieve staff directory.' });
    }
  }
);

/**
 * Get all members and roles in this campus (for people & role management)
 * Co-Admin and Admin only
 */
router.get(
  '/campus/:campusSlug/members',
  authenticate,
  resolveCampus,
  checkCampusMembership,
  requireRole('co_admin'),
  async (req: Request, res: Response): Promise<void> => {
    const campus = req.campus!;
    const pool = getPool();

    try {
      const result = await pool.query(
        `SELECT u.id, u.name, u.email, u.role, u.department, u.phone, u.created_at,
                (SELECT COUNT(*) FROM issues i WHERE i.assigned_to = u.id AND i.status != 'resolved') AS active_assigned_count,
                (SELECT COUNT(*) FROM issues i WHERE i.assigned_to = u.id AND i.status = 'resolved') AS resolved_count
         FROM users u
         WHERE u.campus_id = $1
         ORDER BY 
           CASE u.role 
             WHEN 'admin' THEN 1 
             WHEN 'co_admin' THEN 2 
             WHEN 'worker' THEN 3 
             ELSE 4 
           END,
           u.name ASC`,
        [campus.id]
      );

      res.json(result.rows);
    } catch (err: any) {
      console.error('Error fetching campus members:', err);
      res.status(500).json({ error: 'Failed to retrieve members directory.' });
    }
  }
);

/**
 * Add staff member (Worker or Co-Admin)
 * Admin only! Worker/User can NEVER call this!
 */
router.post(
  '/campus/:campusSlug/staff',
  authenticate,
  resolveCampus,
  checkCampusMembership,
  requireRole('admin'),
  async (req: Request, res: Response): Promise<void> => {
    const campus = req.campus!;
    const { name, email, password, role, department, phone } = req.body;

    if (!name || !email || !password || !role) {
      res.status(400).json({ error: 'Name, email, password, and role are required.' });
      return;
    }

    const allowedRoles: UserRole[] = ['worker', 'co_admin'];
    if (!allowedRoles.includes(role)) {
      res.status(400).json({ error: 'Staff role must be "worker" or "co_admin".' });
      return;
    }

    if (password.length < 6) {
      res.status(400).json({ error: 'Password must be at least 6 characters.' });
      return;
    }

    const pool = getPool();
    try {
      // Check if email already registered in this campus
      const existing = await pool.query('SELECT id FROM users WHERE campus_id = $1 AND email = $2', [
        campus.id,
        email.toLowerCase().trim(),
      ]);
      if (existing.rows.length > 0) {
        res.status(409).json({ error: 'A staff member or user with this email already exists in this campus.' });
        return;
      }

      const { hash, salt } = await hashPassword(password);

      const userRes = await pool.query(
        `INSERT INTO users (campus_id, email, name, password_hash, salt, role, department, phone)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id, campus_id, email, name, role, department, phone, created_at`,
        [campus.id, email.toLowerCase().trim(), name.trim(), hash, salt, role, department || null, phone || null]
      );

      const newStaff = userRes.rows[0];

      // Log Activity
      await pool.query(
        `INSERT INTO activity_logs (campus_id, user_id, action, details)
         VALUES ($1, $2, 'staff_added', $3)`,
        [campus.id, req.user!.id, JSON.stringify({ staffId: newStaff.id, role: newStaff.role, email: newStaff.email })]
      );

      res.status(201).json({
        message: `${role === 'co_admin' ? 'Co-Admin' : 'Worker'} added successfully!`,
        staff: newStaff,
      });
    } catch (err: any) {
      console.error('Error adding staff member:', err);
      res.status(500).json({ error: err.message || 'Failed to add staff member.' });
    }
  }
);

/**
 * Update member role in the same campus
 * Admin can change roles (co_admin, worker, user) of people in the same campus.
 * Co-admin cannot change admins.
 * Regular users and workers cannot call this (403).
 */
const handleRoleUpdate = async (req: Request, res: Response): Promise<void> => {
  const { userId } = req.params;
  const { role } = req.body;
  const currentUser = req.user!;
  const campus = req.campus!;

  if (!role || !['user', 'worker', 'co_admin', 'admin'].includes(role)) {
    res.status(400).json({ error: 'Valid role is required (user, worker, co_admin).' });
    return;
  }

  // Regular user and worker cannot call role management
  if (currentUser.role === 'user' || currentUser.role === 'worker') {
    res.status(403).json({ error: 'Access denied. You do not have permission to manage member roles.' });
    return;
  }

  const pool = getPool();
  try {
    // Find target user in this campus
    const targetRes = await pool.query(
      'SELECT id, role, name, email, campus_id FROM users WHERE id = $1 AND campus_id = $2',
      [userId, campus.id]
    );

    if (targetRes.rows.length === 0) {
      res.status(404).json({ error: 'Member not found in this campus.' });
      return;
    }

    const target = targetRes.rows[0];

    // Co-admin cannot change admins!
    if (currentUser.role === 'co_admin') {
      if (target.role === 'admin') {
        res.status(403).json({ error: 'Co-admins cannot modify admin accounts.' });
        return;
      }
      if (role === 'admin') {
        res.status(403).json({ error: 'Co-admins cannot promote members to admin.' });
        return;
      }
    }

    // Admin cannot change fellow admins or founder unless founder
    if (currentUser.role === 'admin' && target.role === 'admin' && target.id !== currentUser.id) {
      res.status(403).json({ error: 'Admins cannot modify fellow admin accounts.' });
      return;
    }

    // Execute role update
    const updateRes = await pool.query(
      `UPDATE users SET role = $1 WHERE id = $2 AND campus_id = $3`,
      [role, userId, campus.id]
    );

    // Log Activity
    await pool.query(
      `INSERT INTO activity_logs (campus_id, user_id, action, details)
       VALUES ($1, $2, 'role_changed', $3)`,
      [campus.id, currentUser.id, JSON.stringify({ targetUserId: userId, newRole: role, previousRole: target.role })]
    );

    res.json({
      message: `Role for ${target.name} updated to ${role}.`,
      user: {
        id: target.id,
        name: target.name,
        email: target.email,
        role,
        campusId: campus.id,
      },
    });
  } catch (err: any) {
    console.error('Error updating member role:', err);
    res.status(500).json({ error: err.message || 'Failed to update member role.' });
  }
};

router.patch(
  '/campus/:campusSlug/members/:userId/role',
  authenticate,
  resolveCampus,
  checkCampusMembership,
  handleRoleUpdate
);
router.patch(
  '/campus/:campusSlug/staff/:userId/role',
  authenticate,
  resolveCampus,
  checkCampusMembership,
  handleRoleUpdate
);
router.patch(
  '/campus/:campusSlug/users/:userId/role',
  authenticate,
  resolveCampus,
  checkCampusMembership,
  handleRoleUpdate
);

/**
 * Remove a staff member (Worker or Co-Admin)
 * Admin only! Lower roles cannot call this.
 */
router.delete(
  '/campus/:campusSlug/staff/:userId',
  authenticate,
  resolveCampus,
  checkCampusMembership,
  requireRole('admin'),
  async (req: Request, res: Response): Promise<void> => {
    const { userId } = req.params;
    const currentUser = req.user!;
    const campus = req.campus!;
    const pool = getPool();

    if (userId === currentUser.id) {
      res.status(400).json({ error: 'You cannot remove your own admin account.' });
      return;
    }

    try {
      // Check target user
      const targetRes = await pool.query('SELECT id, role, name FROM users WHERE id = $1 AND campus_id = $2', [
        userId,
        campus.id,
      ]);
      if (targetRes.rows.length === 0) {
        res.status(404).json({ error: 'Staff member not found.' });
        return;
      }

      const target = targetRes.rows[0];
      if (target.role === 'admin' && currentUser.role !== 'founder') {
        res.status(403).json({ error: 'Only a founder can remove the primary campus admin.' });
        return;
      }

      // Reassign issues assigned to this worker to null
      await pool.query('UPDATE issues SET assigned_to = NULL WHERE assigned_to = $1', [userId]);

      // Delete user
      await pool.query('DELETE FROM users WHERE id = $1', [userId]);

      res.json({ message: `Staff member ${target.name} has been removed.` });
    } catch (err: any) {
      console.error('Error removing staff member:', err);
      res.status(500).json({ error: 'Failed to remove staff member.' });
    }
  }
);

export default router;
