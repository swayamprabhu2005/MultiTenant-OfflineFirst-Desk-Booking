import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'path';
import dotenv from 'dotenv';
import { tenantMiddleware } from './middleware/tenant.middleware';
import authRoutes from './routes/auth.routes';
import orgRoutes from './routes/organizations.routes';
import auditRoutes from './routes/audit.routes';
import branchRoutes from './routes/branches.routes';
import rosterRoutes from './routes/roster.routes';
import buildingRoutes from './routes/buildings.routes';
import workspaceRoutes from './routes/workspace.routes';
import branchRosterRoutes from './routes/branch-roster.routes';
import employeeRoutes from './routes/employee.routes';
import notificationRoutes from './routes/notification.routes';
import issuesRoutes from './routes/issues.routes';
import systemRoutes from './routes/system.routes';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

// Helmet Security Headers
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

// Rate Limiting Middleware
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10000, // Generous ceiling to prevent local multi-tab starvation
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    const p = req.path || '';
    return p.startsWith('/api/auth') || p.startsWith('/api/health') || req.ip === '127.0.0.1' || req.ip === '::1';
  },
  message: { error: 'Too many requests, please try again later.' },
});
app.use(limiter);

// CORS configuration
app.use(
  cors({
    origin: true, // Allow custom subdomains dynamically
    credentials: true,
  })
);

// Serve static uploaded screenshots and media
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

app.use(express.json({ limit: '10mb' }));

// Tenant Extraction Middleware
app.use(tenantMiddleware);

// Health Check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'UP',
    tenantSubdomain: (req as any).tenantSubdomain || 'global',
    organizationId: (req as any).organizationId || null,
    timestamp: new Date().toISOString(),
  });
});

// Serve uploaded files statically
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/organizations', orgRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/branches', branchRoutes);
app.use('/api/roster', rosterRoutes);
app.use('/api/buildings', buildingRoutes);
app.use('/api/workspace', workspaceRoutes);
app.use('/api/branch-roster', branchRosterRoutes);
app.use('/api/employee', employeeRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/issues', issuesRoutes);
app.use('/api/system', systemRoutes);

// Error Handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled API Error:', err);
  if (err?.message && err.message.includes("Can't reach database server")) {
    res.status(503).json({
      error: 'Database connection failed. Please ensure PostgreSQL is running at localhost:5432.',
    });
    return;
  }
  res.status(500).json({ error: err.message || 'Internal Server Error' });
});

app.listen(PORT, () => {
  console.log(`🚀 API Server running on port ${PORT}`);
  console.log(`🏢 Multi-Tenant SaaS Control Plane Active`);
});
