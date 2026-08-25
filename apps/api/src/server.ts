import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { tenantMiddleware } from './middleware/tenant.middleware';
import authRoutes from './routes/auth.routes';
import orgRoutes from './routes/organizations.routes';
import buildingRoutes from './routes/buildings.routes';
import inventoryRoutes from './routes/inventory.routes';
import rosterRoutes from './routes/roster.routes';
import bookingRoutes from './routes/bookings.routes';
import syncRoutes from './routes/sync.routes';
import auditRoutes from './routes/audit.routes';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

// Helmet Security Headers
app.use(helmet());

// Rate Limiting Middleware
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500, // Limit each IP to 500 requests per window
  standardHeaders: true,
  legacyHeaders: false,
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

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/organizations', orgRoutes);
app.use('/api/buildings', buildingRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/roster', rosterRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/sync', syncRoutes);
app.use('/api/audit', auditRoutes);

// Error Handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled API Error:', err);
  res.status(500).json({ error: err.message || 'Internal Server Error' });
});

app.listen(PORT, () => {
  console.log(`🚀 API Server running on port ${PORT}`);
  console.log(`🏢 Multi-Tenant Offline-First Desk Booking Service Active`);
});
