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
        scopedBranchId: user.scopedBranchId,
        teamLeadId: user.teamLeadId,
        mustChangePassword: user.mustChangePassword,
        baseBranchId: user.baseBranchId,
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
        baseBranchId: user.baseBranchId,
        baseBuildingId: user.baseBuildingId,
        scopedBranchId: user.scopedBranchId,
        teamLeadId: user.teamLeadId,
        mustChangePassword: user.mustChangePassword,
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

// Sign Up (Organization + Org Admin user in a single transaction)
router.post('/signup', async (req: TenantRequest, res: Response) => {
  try {
    const { name, email, password, orgName, orgCode, subdomain } = req.body;

    if (!name || !email || !password || !orgName || !orgCode || !subdomain) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });
    if (existingUser) {
      return res.status(400).json({ error: 'User with this email already exists' });
    }

    // Check if organization subdomain or code already exists
    const existingOrg = await prisma.organization.findFirst({
      where: {
        OR: [
          { subdomain: subdomain.toLowerCase() },
          { code: orgCode.toUpperCase() },
        ],
      },
    });
    if (existingOrg) {
      return res.status(400).json({ error: 'Organization subdomain or code already in use' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    // Atomically create Organization and Org Admin User in a transaction
    const result = await prisma.$transaction(async (tx) => {
      const org = await tx.organization.create({
        data: {
          name: orgName,
          code: orgCode.toUpperCase(),
          subdomain: subdomain.toLowerCase(),
          themeColor: '#16a34a', // Default emerald green
        },
      });

      const user = await tx.user.create({
        data: {
          organizationId: org.id,
          name,
          email: email.toLowerCase(),
          passwordHash,
          role: 'ORGANIZATION_ADMIN', // New sign-ups are global Organization Admins
          mustChangePassword: false, // Since they set their own password during sign-up
        },
      });

      return { org, user };
    });

    const token = jwt.sign(
      {
        id: result.user.id,
        email: result.user.email,
        role: result.user.role,
        organizationId: result.user.organizationId,
        mustChangePassword: result.user.mustChangePassword,
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.status(201).json({
      token,
      user: {
        id: result.user.id,
        name: result.user.name,
        email: result.user.email,
        role: result.user.role,
        mustChangePassword: result.user.mustChangePassword,
        organizationId: result.user.organizationId,
      },
      organization: result.org,
    });
  } catch (error: any) {
    console.error('Sign-up error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error during sign-up' });
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
        baseBranchId: user.baseBranchId,
        baseBuildingId: user.baseBuildingId,
        scopedBranchId: user.scopedBranchId,
        teamLeadId: user.teamLeadId,
        mustChangePassword: user.mustChangePassword,
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

// Change Password (Task 4.5)
router.post('/change-password', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long' });
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);

    const updatedUser = await prisma.user.update({
      where: { id: req.user!.id },
      data: {
        passwordHash,
        mustChangePassword: false,
      },
    });

    return res.json({
      success: true,
      message: 'Password changed successfully',
      user: {
        id: updatedUser.id,
        name: updatedUser.name,
        email: updatedUser.email,
        role: updatedUser.role,
        department: updatedUser.department,
        baseBranchId: updatedUser.baseBranchId,
        baseBuildingId: updatedUser.baseBuildingId,
        scopedBranchId: updatedUser.scopedBranchId,
        teamLeadId: updatedUser.teamLeadId,
        mustChangePassword: updatedUser.mustChangePassword,
        organizationId: updatedUser.organizationId,
      },
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// Update User Profile (Task 4.6)
router.patch('/profile', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { baseBranchId, baseBuildingId } = req.body;
    const data: any = {};
    if (baseBranchId !== undefined) data.baseBranchId = baseBranchId || null;
    if (baseBuildingId !== undefined) data.baseBuildingId = baseBuildingId || null;

    const updatedUser = await prisma.user.update({
      where: { id: req.user!.id },
      data,
    });

    return res.json({
      success: true,
      user: {
        id: updatedUser.id,
        name: updatedUser.name,
        email: updatedUser.email,
        role: updatedUser.role,
        department: updatedUser.department,
        baseBranchId: updatedUser.baseBranchId,
        baseBuildingId: updatedUser.baseBuildingId,
        scopedBranchId: updatedUser.scopedBranchId,
        teamLeadId: updatedUser.teamLeadId,
        mustChangePassword: updatedUser.mustChangePassword,
        organizationId: updatedUser.organizationId,
      },
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

export default router;
