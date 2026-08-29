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
            sections: {
              include: {
                resources: {
                  orderBy: { code: 'asc' },
                },
              },
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
    const { name, code, address, branchId } = req.body;
    if (!name || !code || !branchId) {
      return res.status(400).json({ error: 'Building name, code, and branchId are required' });
    }

    const building = await prisma.building.create({
      data: {
        organizationId: req.organizationId!,
        branchId,
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

// POST Create Resource under Section
router.post('/sections/:sectionId/resources', authMiddleware, requireRole([Role.PLATFORM_ADMIN, Role.ORGANIZATION_ADMIN]), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { sectionId } = req.params;
    const { name, code, type, capacity, features, hasPC, columnSpan, sortOrder } = req.body;

    if (!name || !code) {
      return res.status(400).json({ error: 'Resource name and code are required' });
    }

    const section = await prisma.section.findUnique({
      where: { id: sectionId },
      include: {
        floor: {
          include: { building: true },
        },
      },
    });

    if (!section || section.floor.building.organizationId !== req.organizationId!) {
      return res.status(404).json({ error: 'Section not found' });
    }

    const resource = await prisma.resource.create({
      data: {
        sectionId,
        name,
        code: code.toUpperCase(),
        type: (type || ResourceType.CUBICLE) as any,
        capacity: capacity ? parseInt(capacity, 10) : 1,
        features: Array.isArray(features) ? features : [],
        hasPC: !!hasPC,
        columnSpan: columnSpan ? parseInt(columnSpan, 10) : 1,
        sortOrder: sortOrder ? parseInt(sortOrder, 10) : null,
      },
    });

    return res.status(201).json(resource);
  } catch (error: any) {
    return res.status(400).json({ error: error.message });
  }
});

// GET live occupancy for building
router.get('/:id/occupancy', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const bookings = await prisma.booking.findMany({
      where: {
        organizationId: req.organizationId!,
        status: 'CONFIRMED',
        startAt: { gte: todayStart },
        endAt: { lte: todayEnd },
        resource: {
          section: {
            floor: {
              buildingId: id,
            },
          },
        },
      },
      include: {
        user: {
          select: { name: true, email: true, department: true },
        },
        resource: {
          select: { name: true, code: true, type: true },
        },
      },
    });

    return res.json(bookings);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

export default router;
