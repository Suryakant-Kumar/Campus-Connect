import { Router, Request, Response } from 'express';
import { getPool, isDbConfigured } from '../db.js';
import {
  hashPassword,
  verifyPassword,
  signToken,
  authenticate,
  isReservedSlug,
  generateSafeSlug,
  sanitizeSlug,
  UserRole,
} from '../auth.js';

const router = Router();

/**
 * Register Admin on main site first
 */
router.post('/register-admin', async (req: Request, res: Response): Promise<void> => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    res.status(400).json({ error: 'Name, email, and password are required.' });
    return;
  }

  if (password.length < 6) {
    res.status(400).json({ error: 'Password must be at least 6 characters.' });
    return;
  }

  const cleanEmail = email.toLowerCase().trim();
  const pool = getPool();

  try {
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [cleanEmail]);
    if (existing.rows.length > 0) {
      res.status(409).json({ error: 'An account with this email already exists. Please log in.' });
      return;
    }

    const { hash, salt } = await hashPassword(password);
    const userRes = await pool.query(
      `INSERT INTO users (campus_id, email, name, password_hash, salt, role)
       VALUES (NULL, $1, $2, $3, $4, 'admin')
       RETURNING id, email, name, role, created_at`,
      [cleanEmail, name.trim(), hash, salt]
    );

    const user = userRes.rows[0];
    const token = signToken({
      id: user.id,
      email: user.email,
      name: user.name,
      role: 'admin',
      campusId: null,
      campusSlug: null,
    });

    res.status(201).json({
      message: 'Admin account created successfully! You can now provision your campus.',
      token,
      user,
    });
  } catch (err: any) {
    console.error('Error registering admin:', err);
    res.status(500).json({ error: err.message || 'Failed to register admin account.' });
  }
});

/**
 * Register main site Admin + Campus in one step
 * Validates name, type, city, generates safe unique slug, blocks reserved names (www, api, admin, platform)
 */
router.post('/register-admin-and-campus', async (req: Request, res: Response): Promise<void> => {
  const {
    adminName,
    adminEmail,
    adminPassword,
    campusName,
    campusSlug,
    campusType,
    city,
    campusDescription,
    campusAddress,
  } = req.body;

  // Validation
  if (!adminName || !adminEmail || !adminPassword || !campusName || !campusType) {
    res.status(400).json({
      error: 'Admin Name, Email, Password, Campus Name, and Campus Type are required.',
    });
    return;
  }

  if (adminPassword.length < 6) {
    res.status(400).json({ error: 'Password must be at least 6 characters.' });
    return;
  }

  const validTypes = ['university', 'school', 'hostel', 'pg', 'residential_society', 'other'];
  if (!validTypes.includes(campusType)) {
    res.status(400).json({ error: `Invalid campus type. Must be one of: ${validTypes.join(', ')}` });
    return;
  }

  // Slug Resolution & Validation
  let cleanSlug = campusSlug ? sanitizeSlug(campusSlug) : generateSafeSlug(campusName, city);

  if (isReservedSlug(cleanSlug)) {
    res.status(400).json({
      error: `Reserved slug name: "${cleanSlug}" cannot be used as a campus subdomain. Reserved names include www, api, admin, platform. Please choose a different slug.`,
    });
    return;
  }

  if (cleanSlug.length < 3) {
    res.status(400).json({
      error: 'Campus slug must be at least 3 alphanumeric characters (e.g. "stanford" or "green-valley").',
    });
    return;
  }

  // Ensure slug contains only letters, numbers, and hyphens
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(cleanSlug)) {
    res.status(400).json({
      error: 'Campus slug may only contain letters, numbers, and single hyphens, with no trailing hyphens.',
    });
    return;
  }

  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Check if slug already exists
    const slugCheck = await client.query('SELECT id FROM campuses WHERE slug = $1', [cleanSlug]);
    if (slugCheck.rows.length > 0) {
      res.status(409).json({ error: `Subdomain/slug "${cleanSlug}" is already registered. Please choose another.` });
      await client.query('ROLLBACK');
      return;
    }

    // Merge city into address if provided
    const combinedAddress = city
      ? campusAddress
        ? `${city}, ${campusAddress}`
        : city
      : campusAddress || '';

    // Insert Campus
    const campusRes = await client.query(
      `INSERT INTO campuses (name, slug, type, description, address, contact_email)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, name, slug, type, description, address, created_at`,
      [campusName.trim(), cleanSlug, campusType, campusDescription || '', combinedAddress, adminEmail.toLowerCase().trim()]
    );
    const campus = campusRes.rows[0];

    // Hash Admin Password
    const { hash, salt } = await hashPassword(adminPassword);

    // Insert Admin User
    const userRes = await client.query(
      `INSERT INTO users (campus_id, email, name, password_hash, salt, role)
       VALUES ($1, $2, $3, $4, $5, 'admin')
       RETURNING id, campus_id, email, name, role, created_at`,
      [campus.id, adminEmail.toLowerCase().trim(), adminName.trim(), hash, salt]
    );
    const user = userRes.rows[0];

    // Log Activity
    await client.query(
      `INSERT INTO activity_logs (campus_id, user_id, action, details)
       VALUES ($1, $2, 'campus_created', $3)`,
      [campus.id, user.id, JSON.stringify({ campusName: campus.name, slug: campus.slug, city })]
    );

    await client.query('COMMIT');

    const token = signToken({
      id: user.id,
      email: user.email,
      name: user.name,
      role: 'admin',
      campusId: campus.id,
      campusSlug: campus.slug,
    });

    res.status(201).json({
      message: 'Campus and Admin account created successfully!',
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        campusId: campus.id,
        campusSlug: campus.slug,
      },
      campus,
      campusLink: `${campus.slug}.campusconnect.com`,
      localLink: `/c/${campus.slug}`,
    });
  } catch (err: any) {
    await client.query('ROLLBACK');
    console.error('Error registering campus and admin:', err);
    res.status(500).json({ error: err.message || 'Failed to create campus and admin account.' });
  } finally {
    client.release();
  }
});

/**
 * Register normal user on a specific campus
 * Users only register via their campus link
 */
router.post('/register-user', async (req: Request, res: Response): Promise<void> => {
  if (!isDbConfigured()) {
    res.status(503).json({ error: 'DATABASE_URL is not configured.' });
    return;
  }

  const { email, password, name, campusSlug, phone, department } = req.body;

  if (!email || !password || !name || !campusSlug) {
    res.status(400).json({ error: 'Email, password, name, and campus slug are required.' });
    return;
  }

  if (password.length < 6) {
    res.status(400).json({ error: 'Password must be at least 6 characters.' });
    return;
  }

  const pool = getPool();

  try {
    // 1. Resolve Campus
    const campusRes = await pool.query('SELECT id, name, slug, type FROM campuses WHERE slug = $1', [campusSlug.toLowerCase().trim()]);
    if (campusRes.rows.length === 0) {
      res.status(404).json({ error: `Campus "${campusSlug}" does not exist.` });
      return;
    }
    const campus = campusRes.rows[0];

    // 2. Check if email already registered in this campus
    const existing = await pool.query('SELECT id FROM users WHERE campus_id = $1 AND email = $2', [
      campus.id,
      email.toLowerCase().trim(),
    ]);
    if (existing.rows.length > 0) {
      res.status(409).json({ error: 'An account with this email already exists for this campus. Please log in.' });
      return;
    }

    // 3. Hash Password
    const { hash, salt } = await hashPassword(password);

    // 4. Role is strictly 'user' for public registration
    const userRes = await pool.query(
      `INSERT INTO users (campus_id, email, name, password_hash, salt, role, phone, department)
       VALUES ($1, $2, $3, $4, $5, 'user', $6, $7)
       RETURNING id, campus_id, email, name, role, phone, department, created_at`,
      [campus.id, email.toLowerCase().trim(), name.trim(), hash, salt, phone || null, department || null]
    );
    const user = userRes.rows[0];

    const token = signToken({
      id: user.id,
      email: user.email,
      name: user.name,
      role: 'user',
      campusId: campus.id,
      campusSlug: campus.slug,
    });

    res.status(201).json({
      message: 'Account created successfully!',
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        campusId: campus.id,
        campusSlug: campus.slug,
        department: user.department,
      },
      campus,
    });
  } catch (err: any) {
    console.error('Error registering user:', err);
    res.status(500).json({ error: err.message || 'Failed to register account.' });
  }
});

/**
 * Universal Login:
 * - If campusSlug is provided: verifies user belongs to this campus
 * - If user is global 'founder': can log in from main portal
 */
router.post('/login', async (req: Request, res: Response): Promise<void> => {
  if (!isDbConfigured()) {
    res.status(503).json({ error: 'DATABASE_URL is not configured.' });
    return;
  }

  const { email, password, campusSlug } = req.body;

  if (!email || !password) {
    res.status(400).json({ error: 'Email and password are required.' });
    return;
  }

  const pool = getPool();

  try {
    const cleanEmail = email.toLowerCase().trim();

    // First check if user is a global founder
    const founderCheck = await pool.query('SELECT * FROM users WHERE email = $1 AND role = $2 AND campus_id IS NULL', [
      cleanEmail,
      'founder',
    ]);

    if (founderCheck.rows.length > 0) {
      const founder = founderCheck.rows[0];
      const valid = await verifyPassword(password, founder.password_hash, founder.salt);
      if (!valid) {
        res.status(401).json({ error: 'Invalid email or password.' });
        return;
      }

      const token = signToken({
        id: founder.id,
        email: founder.email,
        name: founder.name,
        role: 'founder',
        campusId: null,
        campusSlug: null,
      });

      res.json({
        token,
        user: {
          id: founder.id,
          email: founder.email,
          name: founder.name,
          role: 'founder',
          campusId: null,
          campusSlug: null,
        },
        campus: null,
      });
      return;
    }

    // Normal or campus staff login: require campusSlug
    if (!campusSlug) {
      // Check if user is an admin of any campus to provide guidance
      const adminMatch = await pool.query(
        `SELECT u.*, c.slug AS campus_slug, c.name AS campus_name
         FROM users u
         JOIN campuses c ON u.campus_id = c.id
         WHERE u.email = $1`,
        [cleanEmail]
      );

      if (adminMatch.rows.length === 1) {
        const u = adminMatch.rows[0];
        const valid = await verifyPassword(password, u.password_hash, u.salt);
        if (valid) {
          const token = signToken({
            id: u.id,
            email: u.email,
            name: u.name,
            role: u.role as UserRole,
            campusId: u.campus_id,
            campusSlug: u.campus_slug,
          });

          res.json({
            token,
            user: {
              id: u.id,
              email: u.email,
              name: u.name,
              role: u.role,
              campusId: u.campus_id,
              campusSlug: u.campus_slug,
              department: u.department,
            },
            campus: {
              id: u.campus_id,
              name: u.campus_name,
              slug: u.campus_slug,
            },
          });
          return;
        }
      }

      res.status(400).json({ error: 'Please log in through your campus link (e.g. <campus>.campusconnect.com).' });
      return;
    }

    // Resolve campus
    const campusRes = await pool.query('SELECT id, name, slug, type FROM campuses WHERE slug = $1', [campusSlug.toLowerCase().trim()]);
    if (campusRes.rows.length === 0) {
      res.status(404).json({ error: `Campus "${campusSlug}" was not found.` });
      return;
    }
    const campus = campusRes.rows[0];

    // Find user in this campus
    const userRes = await pool.query('SELECT * FROM users WHERE campus_id = $1 AND email = $2', [campus.id, cleanEmail]);
    if (userRes.rows.length === 0) {
      res.status(401).json({ error: 'Invalid email or password for this campus.' });
      return;
    }

    const user = userRes.rows[0];
    const passwordMatch = await verifyPassword(password, user.password_hash, user.salt);
    if (!passwordMatch) {
      res.status(401).json({ error: 'Invalid email or password.' });
      return;
    }

    const token = signToken({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role as UserRole,
      campusId: campus.id,
      campusSlug: campus.slug,
    });

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        campusId: campus.id,
        campusSlug: campus.slug,
        department: user.department,
      },
      campus,
    });
  } catch (err: any) {
    console.error('Error during login:', err);
    res.status(500).json({ error: err.message || 'Login failed.' });
  }
});

/**
 * Register Founder (only if no founder exists yet)
 */
router.post('/register-founder', async (req: Request, res: Response): Promise<void> => {
  if (!isDbConfigured()) {
    res.status(503).json({ error: 'DATABASE_URL is not configured.' });
    return;
  }

  const { email, password, name, secretKey } = req.body;

  // Protect founder registration with optional FOUNDER_REGISTRATION_KEY
  const expectedKey = process.env.FOUNDER_REGISTRATION_KEY || 'founder-init-master-2026';
  if (secretKey !== expectedKey) {
    res.status(403).json({ error: 'Invalid founder registration secret key.' });
    return;
  }

  const pool = getPool();

  try {
    const existing = await pool.query("SELECT id FROM users WHERE role = 'founder'");
    if (existing.rows.length > 0) {
      res.status(409).json({ error: 'A Founder account has already been initialized.' });
      return;
    }

    const { hash, salt } = await hashPassword(password);
    const userRes = await pool.query(
      `INSERT INTO users (campus_id, email, name, password_hash, salt, role)
       VALUES (NULL, $1, $2, $3, $4, 'founder')
       RETURNING id, email, name, role`,
      [email.toLowerCase().trim(), name.trim(), hash, salt]
    );
    const founder = userRes.rows[0];

    const token = signToken({
      id: founder.id,
      email: founder.email,
      name: founder.name,
      role: 'founder',
      campusId: null,
      campusSlug: null,
    });

    res.status(201).json({
      message: 'Global Founder account created.',
      token,
      user: founder,
    });
  } catch (err: any) {
    console.error('Error creating founder:', err);
    res.status(500).json({ error: err.message || 'Failed to create founder account.' });
  }
});

/**
 * Current user session info
 */
router.get('/me', authenticate, async (req: Request, res: Response): Promise<void> => {
  res.json({
    user: req.user,
  });
});

export default router;
