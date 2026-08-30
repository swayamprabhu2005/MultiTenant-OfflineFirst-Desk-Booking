import { Router, Response } from 'express';
import { prisma } from '../prisma';
import { authMiddleware, AuthenticatedRequest, requireRole } from '../middleware/auth.middleware';
import { Role } from '@deskbooking/shared';

const router = Router();

// GET all sections for a floor or organization
router.get('/', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { floorId } = req.query;

    const where: any = {};
    if (floorId) {
      where.floorId = String(floorId);
    }

    // Ensure floor belongs to active tenant
    if (floorId) {
      const floor = await prisma.floor.findUnique({
        where: { id: String(floorId) },
        include: { building: true },
      });
      if (!floor || floor.building.organizationId !== req.organizationId!) {
        return res.status(403).json({ error: 'Forbidden: Floor tenant mismatch' });
      }
    } else {
      // Return all sections in active tenant
      where.floor = {
        building: {
          organizationId: req.organizationId!,
        },
      };
    }

    const sections = await prisma.section.findMany({
      where,
      include: {
        floor: {
          include: { building: true },
        },
        resources: {
          orderBy: { sortOrder: 'asc' },
        },
      },
      orderBy: { name: 'asc' },
    });

    return res.json(sections);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// POST Create Section (Org Admin / Platform Admin)
router.post('/', authMiddleware, requireRole([Role.PLATFORM_ADMIN, Role.ORGANIZATION_ADMIN]), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { floorId, name, code, columns } = req.body;
    if (!floorId || !name || !code) {
      return res.status(400).json({ error: 'floorId, name, and code are required' });
    }

    // Verify floor belongs to organization
    const floor = await prisma.floor.findUnique({
      where: { id: floorId },
      include: { building: true },
    });

    if (!floor || floor.building.organizationId !== req.organizationId!) {
      return res.status(404).json({ error: 'Floor not found' });
    }

    // Scoped branch admin check
    if (req.user!.role === Role.ORGANIZATION_ADMIN && req.user!.scopedBranchId) {
      if (floor.building.branchId !== req.user!.scopedBranchId) {
        return res.status(403).json({ error: 'Forbidden: Cannot create section in buildings outside your scoped branch' });
      }
    }

    const section = await prisma.section.create({
      data: {
        floorId,
        name,
        code: code.toUpperCase(),
        columns: columns ? parseInt(columns, 10) : 4,
      },
    });

    await prisma.auditLog.create({
      data: {
        organizationId: req.organizationId!,
        actorUserId: req.user!.id,
        action: 'CREATE_SECTION',
        entityType: 'Section',
        entityId: section.id,
        metadata: { name: section.name, code: section.code, floorId },
      },
    });

    return res.status(201).json(section);
  } catch (error: any) {
    return res.status(400).json({ error: error.message });
  }
});

// PUT Update Section
router.put('/:id', authMiddleware, requireRole([Role.PLATFORM_ADMIN, Role.ORGANIZATION_ADMIN]), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { name, code, columns, status } = req.body;

    const existingSection = await prisma.section.findUnique({
      where: { id },
      include: {
        floor: {
          include: { building: true },
        },
      },
    });

    if (!existingSection || existingSection.floor.building.organizationId !== req.organizationId!) {
      return res.status(404).json({ error: 'Section not found' });
    }

    // Scoped branch admin check
    if (req.user!.role === Role.ORGANIZATION_ADMIN && req.user!.scopedBranchId) {
      if (existingSection.floor.building.branchId !== req.user!.scopedBranchId) {
        return res.status(403).json({ error: 'Forbidden: Cannot update section in buildings outside your scoped branch' });
      }
    }

    const updated = await prisma.section.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(code && { code: code.toUpperCase() }),
        ...(columns !== undefined && { columns: parseInt(columns, 10) }),
        ...(status && { status }),
      },
    });

    await prisma.auditLog.create({
      data: {
        organizationId: req.organizationId!,
        actorUserId: req.user!.id,
        action: 'UPDATE_SECTION',
        entityType: 'Section',
        entityId: id,
      },
    });

    return res.json(updated);
  } catch (error: any) {
    return res.status(400).json({ error: error.message });
  }
});

// DELETE Section
router.delete('/:id', authMiddleware, requireRole([Role.PLATFORM_ADMIN, Role.ORGANIZATION_ADMIN]), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const existingSection = await prisma.section.findUnique({
      where: { id },
      include: {
        floor: {
          include: { building: true },
        },
      },
    });

    if (!existingSection || existingSection.floor.building.organizationId !== req.organizationId!) {
      return res.status(404).json({ error: 'Section not found' });
    }

    // Scoped branch admin check
    if (req.user!.role === Role.ORGANIZATION_ADMIN && req.user!.scopedBranchId) {
      if (existingSection.floor.building.branchId !== req.user!.scopedBranchId) {
        return res.status(403).json({ error: 'Forbidden: Cannot delete section in buildings outside your scoped branch' });
      }
    }

    await prisma.section.delete({
      where: { id },
    });

    await prisma.auditLog.create({
      data: {
        organizationId: req.organizationId!,
        actorUserId: req.user!.id,
        action: 'DELETE_SECTION',
        entityType: 'Section',
        entityId: id,
      },
    });

    return res.json({ message: 'Section deleted successfully' });
  } catch (error: any) {
    return res.status(400).json({ error: error.message });
  }
});

export default router;
