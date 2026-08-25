import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../prisma';
import { TenantRequest } from '../middleware/tenant.middleware';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth.middleware';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-jwt-key-for-multi-tenant-desk-booking-saas';

// Sign In
router.post('/login', async (req: TenantRequest, res: Response) => {
  try {
    const { email, password, organizationCode, subdomain } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Resolve tenant
    let targetOrgId = req.organizationId;

    if (!targetOrgId && (subdomain || organizationCode)) {
      const org = await prisma.organization.findFirst({
        where: {
          OR: [
            subdomain ? { subdomain: subdomain.toLowerCase() } : {},
            organizationCode ? { code: organizationCode.toUpperCase() } : {},
          ],
        },
      });
      if (org) {
        targetOrgId = org.id;
      }
    }

    const user = await prisma.user.findFirst({
      where: {
        email: email.toLowerCase(),
        ...(targetOrgId ? { organizationId: targetOrgId } : {}),
      },
      include: {
        organization: true,
      },
    });

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials or tenant mismatch' });
    }

    const isValidPassword = await bcrypt.compare(password, user.passwordHash);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
        organizationId: user.organizationId,
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department,
        baseBuildingId: user.baseBuildingId,
        organizationId: user.organizationId,
      },
      organization: {
        id: user.organization.id,
        name: user.organization.name,
        code: user.organization.code,
        subdomain: user.organization.subdomain,
        logoUrl: user.organization.logoUrl,
        themeColor: user.organization.themeColor,
      },
    });
  } catch (error: any) {
    console.error('Login error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error during login' });
  }
});

// Current User Profile
router.get('/me', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      include: {
        organization: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department,
        baseBuildingId: user.baseBuildingId,
        organizationId: user.organizationId,
      },
      organization: user.organization,
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// Public Organization Discovery (for tenant selection UI dropdown in dev)
router.get('/organizations', async (req: TenantRequest, res: Response) => {
  try {
    const orgs = await prisma.organization.findMany({
      where: { status: 'ACTIVE' },
      select: {
        id: true,
        name: true,
        code: true,
        subdomain: true,
        logoUrl: true,
        themeColor: true,
      },
    });
    return res.json(orgs);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

export default router;
