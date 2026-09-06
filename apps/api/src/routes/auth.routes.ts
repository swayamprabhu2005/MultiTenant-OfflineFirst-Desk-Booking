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
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = await prisma.user.findFirst({
      where: {
        email: email.toLowerCase(),
      },
      include: {
        organization: true,
      },
    });

    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    if (user.status !== 'ACTIVE' || user.isActive === false) {
      return res.status(403).json({ error: 'This account has been deactivated. Please contact your administrator.' });
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
        mustChangePassword: user.mustChangePassword,
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
        scopedBranchId: user.scopedBranchId,
        mustChangePassword: user.mustChangePassword,
        isActive: user.isActive,
        status: user.status,
        organizationId: user.organizationId,
        organization: {
          id: user.organization.id,
          name: user.organization.name,
          code: user.organization.code,
          subdomain: user.organization.subdomain,
          logoUrl: user.organization.logoUrl,
          themeColor: user.organization.themeColor,
        },
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

// Sign Up (Organization + Org Admin user in a single atomic transaction)
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

    // Atomically create Organization, Org Admin User, and AuditLog in a transaction
    const result = await prisma.$transaction(async (tx: any) => {
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
          role: 'ORGANIZATION_ADMIN',
          mustChangePassword: false,
        },
      });

      await tx.auditLog.create({
        data: {
          organizationId: org.id,
          actorUserId: user.id,
          action: 'CREATE_ORGANIZATION',
          entityType: 'Organization',
          entityId: org.id,
          metadata: {
            orgName: org.name,
            subdomain: org.subdomain,
            adminName: user.name,
            adminEmail: user.email,
          },
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
        organization: result.org,
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
        scopedBranch: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (user.status !== 'ACTIVE' || user.isActive === false) {
      return res.status(403).json({ error: 'Account has been deactivated.' });
    }

    return res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department,
        scopedBranchId: user.scopedBranchId,
        scopedBranch: user.scopedBranch,
        mustChangePassword: user.mustChangePassword,
        isActive: user.isActive,
        status: user.status,
        organizationId: user.organizationId,
        organization: user.organization,
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

// Mandatory First-Time Force Password Change
router.post('/force-password-change', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 8) {
      return res.status(400).json({ error: 'New password must be at least 8 characters long.' });
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);

    const updatedUser = await prisma.user.update({
      where: { id: req.user!.id },
      data: {
        passwordHash,
        mustChangePassword: false,
      },
    });

    await prisma.auditLog.create({
      data: {
        organizationId: updatedUser.organizationId,
        actorUserId: updatedUser.id,
        action: 'FORCE_PASSWORD_CHANGE_COMPLETED',
        entityType: 'User',
        entityId: updatedUser.id,
        metadata: { email: updatedUser.email },
      },
    });

    return res.json({
      success: true,
      message: 'Password successfully updated. Your account is fully unlocked.',
      user: {
        id: updatedUser.id,
        name: updatedUser.name,
        email: updatedUser.email,
        role: updatedUser.role,
        mustChangePassword: false,
        scopedBranchId: updatedUser.scopedBranchId,
      },
    });
  } catch (error: any) {
    console.error('Force password change error:', error);
    return res.status(500).json({ error: error.message });
  }
});

// Standard Authenticated Change Password
router.post('/change-password', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!newPassword || newPassword.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters long.' });
    }

    const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (currentPassword) {
      const isMatch = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!isMatch) {
        return res.status(400).json({ error: 'Current password does not match.' });
      }
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
        organizationId: updatedUser.organizationId,
      },
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// Self-Service Forgot Password Request
router.post('/forgot-password', async (req: TenantRequest, res: Response) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email address is required.' });
    }

    const user = await prisma.user.findFirst({
      where: { email: email.toLowerCase() },
      include: { organization: true },
    });

    if (user) {
      await prisma.auditLog.create({
        data: {
          organizationId: user.organizationId,
          actorUserId: user.id,
          action: 'PASSWORD_RECOVERY_REQUESTED',
          entityType: 'User',
          entityId: user.id,
          metadata: { email: user.email },
        },
      });
    }

    return res.json({
      success: true,
      message: 'If an account exists for this corporate email, password recovery instructions have been initiated.',
    });
  } catch (error: any) {
    console.error('Forgot password error:', error);
    return res.status(500).json({ error: error.message });
  }
});

// Self-Service Reset Password
router.post('/reset-password', async (req: TenantRequest, res: Response) => {
  try {
    const { email, newPassword } = req.body;

    if (!email || !newPassword || newPassword.length < 8) {
      return res.status(400).json({ error: 'Valid email and a password of at least 8 characters are required.' });
    }

    const user = await prisma.user.findFirst({
      where: { email: email.toLowerCase() },
    });

    if (!user) {
      return res.status(404).json({ error: 'No account found with this email address.' });
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        mustChangePassword: false,
      },
    });

    return res.json({
      success: true,
      message: 'Password reset successful. Please log in with your new password.',
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

export default router;
