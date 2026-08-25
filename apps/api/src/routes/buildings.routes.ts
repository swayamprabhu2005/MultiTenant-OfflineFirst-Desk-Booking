import { Router, Response } from 'express';
import { prisma } from '../prisma';
import { authMiddleware, AuthenticatedRequest, requireRole } from '../middleware/auth.middleware';
import { Role, ResourceType, ResourceStatus } from '@deskbooking/shared';

const router = Router();

// GET all buildings with floors and resources for the active tenant
router.get('/', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const buildings = await prisma.building.findMany({
      where: {
        organizationId: req.organizationId!,
      },
      include: {
        floors: {
          orderBy: { floorNumber: 'asc' },
          include: {
            resources: {
              orderBy: { code: 'asc' },
            },
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    return res.json(buildings);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// POST Create Building (Org Admin / Platform Admin)
router.post('/', authMiddleware, requireRole([Role.PLATFORM_ADMIN, Role.ORGANIZATION_ADMIN]), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name, code, address } = req.body;
    if (!name || !code) {
      return res.status(400).json({ error: 'Building name and code are required' });
    }

    const building = await prisma.building.create({
      data: {
        organizationId: req.organizationId!,
        name,
        code: code.toUpperCase(),
        address: address || null,
      },
    });

    await prisma.auditLog.create({
      data: {
        organizationId: req.organizationId!,
        actorUserId: req.user!.id,
        action: 'CREATE_BUILDING',
        entityType: 'Building',
        entityId: building.id,
        metadata: { name: building.name, code: building.code },
      },
    });

    return res.status(201).json(building);
  } catch (error: any) {
    return res.status(400).json({ error: error.message });
  }
});

// POST Create Floor under Building
router.post('/:buildingId/floors', authMiddleware, requireRole([Role.PLATFORM_ADMIN, Role.ORGANIZATION_ADMIN]), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { buildingId } = req.params;
    const { name, floorNumber } = req.body;

    if (!name || floorNumber === undefined) {
      return res.status(400).json({ error: 'Floor name and floorNumber are required' });
    }

    // Verify building belongs to tenant
    const building = await prisma.building.findFirst({
      where: { id: buildingId, organizationId: req.organizationId! },
    });

    if (!building) {
      return res.status(404).json({ error: 'Building not found or tenant access denied' });
    }

    const floor = await prisma.floor.create({
      data: {
        buildingId,
        name,
        floorNumber: parseInt(floorNumber, 10),
      },
    });

    return res.status(201).json(floor);
  } catch (error: any) {
    return res.status(400).json({ error: error.message });
  }
});

// POST Create Resource under Floor
router.post('/floors/:floorId/resources', authMiddleware, requireRole([Role.PLATFORM_ADMIN, Role.ORGANIZATION_ADMIN]), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { floorId } = req.params;
    const { name, code, type, capacity, features } = req.body;

    if (!name || !code) {
      return res.status(400).json({ error: 'Resource name and code are required' });
    }

    const floor = await prisma.floor.findUnique({
      where: { id: floorId },
      include: { building: true },
    });

    if (!floor || floor.building.organizationId !== req.organizationId!) {
      return res.status(404).json({ error: 'Floor not found' });
    }

    const resource = await prisma.resource.create({
      data: {
        floorId,
        name,
        code: code.toUpperCase(),
        type: (type || ResourceType.CUBICLE) as any,
        capacity: capacity ? parseInt(capacity, 10) : 1,
        features: Array.isArray(features) ? features : [],
      },
    });

    return res.status(201).json(resource);
  } catch (error: any) {
    return res.status(400).json({ error: error.message });
  }
});

export default router;
