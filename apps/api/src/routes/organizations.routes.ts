import { Router, Response } from 'express';
import { prisma } from '../prisma';
import { authMiddleware, AuthenticatedRequest, requireRole } from '../middleware/auth.middleware';
import { Role } from '@deskbooking/shared';

const router = Router();

// Get active tenant details or all tenant organizations (Platform Admin)
router.get('/', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (req.user?.role === Role.PLATFORM_ADMIN) {
      const orgs = await prisma.organization.findMany({
        include: {
          _count: {
            select: { users: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
      return res.json(orgs);
    }

    // Scoped to own tenant
    const org = await prisma.organization.findUnique({
      where: { id: req.user!.organizationId },
      include: {
        _count: {
          select: { users: true },
        },
      },
    });
    return res.json(org ? [org] : []);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// Platform Admin Create Organization
router.post('/', authMiddleware, requireRole([Role.PLATFORM_ADMIN]), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name, code, subdomain, logoUrl, themeColor, timezone } = req.body;

    if (!name || !code || !subdomain) {
      return res.status(400).json({ error: 'Name, code, and subdomain are required' });
    }

    const newOrg = await prisma.organization.create({
      data: {
        name,
        code: code.toUpperCase(),
        subdomain: subdomain.toLowerCase(),
        logoUrl: logoUrl || null,
        themeColor: themeColor || '#16a34a',
        timezone: timezone || 'UTC',
      },
    });

    await prisma.auditLog.create({
      data: {
        organizationId: newOrg.id,
        actorUserId: req.user!.id,
        action: 'CREATE_ORGANIZATION',
        entityType: 'Organization',
        entityId: newOrg.id,
        metadata: { name: newOrg.name, subdomain: newOrg.subdomain },
      },
    });

    return res.status(201).json(newOrg);
  } catch (error: any) {
    return res.status(400).json({ error: error.message });
  }
});

// Organization Admin Update Branding & Dynamic White-Label Theme Tokens
router.patch('/:id/branding', authMiddleware, requireRole([Role.PLATFORM_ADMIN, Role.ORGANIZATION_ADMIN]), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    if (req.user?.role === Role.ORGANIZATION_ADMIN && req.user.organizationId !== id) {
      return res.status(403).json({ error: 'Forbidden: Cannot edit another organization' });
    }

    const { themeColor, logoUrl, name } = req.body;

    const updated = await prisma.organization.update({
      where: { id },
      data: {
        ...(themeColor ? { themeColor } : {}),
        ...(logoUrl !== undefined ? { logoUrl } : {}),
        ...(name ? { name } : {}),
      },
    });

    await prisma.auditLog.create({
      data: {
        organizationId: id,
        actorUserId: req.user!.id,
        action: 'UPDATE_BRANDING',
        entityType: 'Organization',
        entityId: id,
        metadata: { themeColor, logoUrl, name },
      },
    });

    return res.json(updated);
  } catch (error: any) {
    return res.status(400).json({ error: error.message });
  }
});

export default router;
