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

// Platform Admin Delete Organization (with full cascade purge)
router.delete('/:id', authMiddleware, requireRole([Role.PLATFORM_ADMIN]), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const org = await prisma.organization.findUnique({
      where: { id },
    });

    if (!org) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    if (org.subdomain.toLowerCase() === 'system' || org.code.toUpperCase() === 'SYSTEM') {
      return res.status(400).json({ error: 'Cannot delete the core platform administration organization' });
    }

    // Atomic cascade deletion of all tenant data
    await prisma.$transaction(async (tx) => {
      // 1. Delete all bookings for this tenant
      await tx.booking.deleteMany({ where: { organizationId: id } });
      // 2. Delete all meeting rooms
      await tx.meetingRoom.deleteMany({ where: { organizationId: id } });
      // 3. Delete all desks
      await tx.desk.deleteMany({ where: { organizationId: id } });
      // 4. Delete all floor sections
      await tx.section.deleteMany({ where: { organizationId: id } });
      // 5. Delete all building floors
      await tx.floor.deleteMany({ where: { organizationId: id } });
      // 6. Delete all buildings
      await tx.building.deleteMany({ where: { organizationId: id } });
      // 7. Delete all branches
      await tx.branch.deleteMany({ where: { organizationId: id } });
      // 8. Delete all users belonging to this organization
      await tx.user.deleteMany({ where: { organizationId: id } });
      // 9. Delete tenant-scoped audit logs
      await tx.auditLog.deleteMany({ where: { organizationId: id } });
      // 10. Delete the organization itself
      await tx.organization.delete({ where: { id } });
    });

    // Record audit log under platform admin
    await prisma.auditLog.create({
      data: {
        organizationId: req.user!.organizationId,
        actorUserId: req.user!.id,
        action: 'DELETE_ORGANIZATION',
        entityType: 'Organization',
        entityId: id,
        metadata: {
          name: org.name,
          code: org.code,
          subdomain: org.subdomain,
        },
      },
    });

    return res.json({
      success: true,
      message: `Organization "${org.name}" and all associated resources have been permanently deleted.`,
    });
  } catch (error: any) {
    console.error('Failed to delete organization:', error);
    return res.status(500).json({ error: error.message });
  }
});

export default router;
