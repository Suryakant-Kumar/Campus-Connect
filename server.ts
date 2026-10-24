import express, { Request, Response, NextFunction } from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { initDb, isDbConfigured, getPool, isUsingMock, getDbError } from './server/db.js';
import authRoutes from './server/routes/auth.js';
import campusesRoutes from './server/routes/campuses.js';
import issuesRoutes from './server/routes/issues.js';
import commentsRoutes from './server/routes/comments.js';
import staffRoutes from './server/routes/staff.js';
import { uploadPhotoOnline } from './server/storage.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
export { app };
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

// Body parsing middleware (50mb limit for photo base64 strings if needed)
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

// Request logging in development
app.use((req: Request, _res: Response, next: NextFunction) => {
  if (req.path.startsWith('/api')) {
    console.log(`[API ${req.method}] ${req.path}`);
  }
  next();
});

// Health & Environment Diagnostics Endpoint
app.get('/api/health', async (_req: Request, res: Response) => {
  let dbStatus = isUsingMock() ? 'in_memory_mock' : 'connected';
  let dbError: string | null = getDbError();
  let campusCount = 0;

  try {
    const pool = getPool();
    const test = await pool.query('SELECT COUNT(*) FROM campuses');
    campusCount = parseInt(test.rows[0].count, 10);
  } catch (err: any) {
    dbStatus = 'error';
    dbError = err.message;
  }

  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    database: {
      status: dbStatus,
      configured: isDbConfigured(),
      error: dbError,
      campusCount,
    },
    gemini: {
      configured: Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim() !== ''),
      model: process.env.GEMINI_MODEL || 'gemini-3.8-flash',
    },
    storage: {
      vercelBlob: Boolean(process.env.BLOB_READ_WRITE_TOKEN),
      supabase: Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY),
    },
  });
});

// Stateless Photo Upload Endpoint (Vercel Blob / Supabase Storage)
// Never writes to local disk!
app.post('/api/upload', async (req: Request, res: Response): Promise<void> => {
  try {
    const { data, filename, contentType } = req.body;

    if (!data) {
      res.status(400).json({ error: 'No image data provided.' });
      return;
    }

    let buffer: Buffer;
    let mime = contentType || 'image/jpeg';

    if (typeof data === 'string' && data.startsWith('data:')) {
      const matches = data.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
      if (matches && matches.length === 3) {
        mime = matches[1];
        buffer = Buffer.from(matches[2], 'base64');
      } else {
        buffer = Buffer.from(data.split(',')[1] || data, 'base64');
      }
    } else if (typeof data === 'string') {
      buffer = Buffer.from(data, 'base64');
    } else {
      res.status(400).json({ error: 'Invalid data format.' });
      return;
    }

    const safeFilename = filename || `photo-${Date.now()}.jpg`;
    const result = await uploadPhotoOnline(buffer, safeFilename, mime);

    res.json({
      url: result.url,
      provider: result.provider,
    });
  } catch (err: any) {
    console.error('Upload error:', err);
    res.status(500).json({ error: err.message || 'Failed to upload photo to online storage.' });
  }
});

// Mount API routes
app.use('/api/auth', authRoutes);
app.use('/api/campuses', campusesRoutes);
app.use('/api/campus', campusesRoutes);
app.use('/api', campusesRoutes);
app.use('/api', issuesRoutes);
app.use('/api', commentsRoutes);
app.use('/api', staffRoutes);

// Database schema auto-initialization
if (isDbConfigured()) {
  initDb()
    .then(() => console.log('✅ PostgreSQL Schema Verified and Ready.'))
    .catch((err) => console.error('⚠️ Database schema verification error:', err));
} else {
  console.warn('⚠️ DATABASE_URL is not configured. PostgreSQL connection deferred until set in .env.');
}

async function startServer() {
  // If running inside Vercel serverless environment, do not start local HTTP listener
  if (process.env.VERCEL) {
    return;
  }

  const isProduction = process.env.NODE_ENV === 'production';

  if (!isProduction) {
    // Mount Vite dev server middleware
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Serve production static build
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 CampusConnect full-stack server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Fatal error starting server:', err);
  process.exit(1);
});
