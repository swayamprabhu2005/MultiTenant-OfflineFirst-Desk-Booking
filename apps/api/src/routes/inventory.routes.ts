import { Router, Response } from 'express';
import { parse } from 'csv-parse/sync';
import { prisma } from '../prisma';
import { authMiddleware, AuthenticatedRequest, requireRole } from '../middleware/auth.middleware';
import { Role, ResourceType } from '@deskbooking/shared';

const router = Router();

// 1. Manual Numeric Counter Fallback Space Generator
router.post('/generate-numeric', authMiddleware, requireRole([Role.PLATFORM_ADMIN, Role.ORGANIZATION_ADMIN]), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { buildingId, floorNumber, floorName, resourceType, count, prefix, features, sectionId: requestedSectionId } = req.body;

    if (!buildingId || count === undefined || count <= 0) {
      return res.status(400).json({ error: 'buildingId and positive count are required' });
    }

    const building = await prisma.building.findFirst({
      where: { id: buildingId, organizationId: req.organizationId! },
    });

    if (!building) {
      return res.status(404).json({ error: 'Building not found' });
    }

    const targetFloorNum = parseInt(floorNumber || 1, 10);
    let floor = await prisma.floor.findUnique({
      where: {
        buildingId_floorNumber: {
          buildingId,
          floorNumber: targetFloorNum,
        },
      },
    });

    if (!floor) {
      floor = await prisma.floor.create({
        data: {
          buildingId,
          floorNumber: targetFloorNum,
          name: floorName || `Floor ${targetFloorNum}`,
        },
      });
    }

    // Resolve target section
    let sectionId = requestedSectionId;
    if (!sectionId) {
      let section = await prisma.section.findFirst({
        where: { floorId: floor.id, code: 'MAIN' }
      });
      if (!section) {
        section = await prisma.section.create({
          data: {
            floorId: floor.id,
            code: 'MAIN',
            name: 'Main Section',
            columns: 4
          }
        });
      }
      sectionId = section.id;
    }

    const type: ResourceType = resourceType || ResourceType.CUBICLE;
    const itemPrefix = prefix || (type === ResourceType.CUBICLE ? 'CUB' : type === ResourceType.DESK ? 'DSK' : 'RM');
    const createdResources = [];

    // Find current occupied indices in the section to prevent overlapping
    const currentResources = await prisma.resource.findMany({
      where: { sectionId },
      select: { sortOrder: true }
    });
    const occupied = currentResources.map(r => r.sortOrder).filter(idx => idx !== null && idx !== undefined) as number[];
    let nextIdx = 0;

    for (let i = 1; i <= parseInt(count, 10); i++) {
      const code = `${itemPrefix}-${targetFloorNum}${i.toString().padStart(2, '0')}`;
      const name = `${type === ResourceType.CUBICLE ? 'Cubicle' : 'Desk'} ${targetFloorNum}${i.toString().padStart(2, '0')}`;

      // Find next unoccupied index
      while (occupied.includes(nextIdx)) {
        nextIdx++;
      }
      occupied.push(nextIdx);

      const resItem = await prisma.resource.upsert({
        where: {
          sectionId_code: {
            sectionId,
            code,
          },
        },
        update: {
          name,
          type: type as any,
          features: Array.isArray(features) ? features : ['Power Outlet', 'Ethernet'],
        },
        create: {
          sectionId,
          code,
          name,
          type: type as any,
          capacity: type === ResourceType.BOARD_ROOM ? 10 : type === ResourceType.MEETING_ROOM ? 4 : 1,
          features: Array.isArray(features) ? features : ['Power Outlet', 'Ethernet'],
          sortOrder: nextIdx,
        },
      });
      createdResources.push(resItem);
    }

    await prisma.auditLog.create({
      data: {
        organizationId: req.organizationId!,
        actorUserId: req.user!.id,
        action: 'GENERATE_NUMERIC_INVENTORY',
        entityType: 'Resource',
        entityId: floor.id,
        metadata: { count, type, buildingId, floorNumber: targetFloorNum },
      },
    });

    return res.json({
      message: `Successfully generated ${createdResources.length} ${type.toLowerCase()} resources`,
      floor,
      count: createdResources.length,
      resources: createdResources,
    });
  } catch (error: any) {
    console.error('Numeric generation error:', error);
    return res.status(500).json({ error: error.message });
  }
});

// 2. CSV Space Inventory Upload Parser
router.post('/import-csv', authMiddleware, requireRole([Role.PLATFORM_ADMIN, Role.ORGANIZATION_ADMIN]), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { csvContent } = req.body;

    if (!csvContent || typeof csvContent !== 'string') {
      return res.status(400).json({ error: 'csvContent string is required' });
    }

    const records = parse(csvContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });

    if (!Array.isArray(records) || records.length === 0) {
      return res.status(400).json({ error: 'CSV file is empty or formatted incorrectly' });
    }

    let createdCount = 0;
    const orgId = req.organizationId!;

    for (const record of records) {
      const bCode = (record.buildingCode || record.BuildingCode || 'MAIN').toUpperCase();
      const bName = record.buildingName || record.BuildingName || `Building ${bCode}`;
      const fNum = parseInt(record.floorNumber || record.FloorNumber || '1', 10);
      const fName = record.floorName || record.FloorName || `Floor ${fNum}`;
      const rCode = (record.resourceCode || record.ResourceCode || record.deskCode || '').toUpperCase();
      const rName = record.resourceName || record.ResourceName || record.deskName || `Space ${rCode}`;
      const rawType = (record.resourceType || record.ResourceType || record.type || 'CUBICLE').toUpperCase();

      if (!rCode) continue;

      let rType: ResourceType = ResourceType.CUBICLE;
      if (rawType.includes('DESK') || rawType === 'HOT_DESK') rType = ResourceType.DESK;
      else if (rawType.includes('BOARD')) rType = ResourceType.BOARD_ROOM;
      else if (rawType.includes('MEETING')) rType = ResourceType.MEETING_ROOM;

      let branch = await prisma.branch.findFirst({
        where: { organizationId: orgId, code: 'MAIN' }
      });
      if (!branch) {
        branch = await prisma.branch.create({
          data: {
            organizationId: orgId,
            code: 'MAIN',
            name: 'Main Branch',
          }
        });
      }

      let building = await prisma.building.findUnique({
        where: { organizationId_code: { organizationId: orgId, code: bCode } },
      });

      if (!building) {
        building = await prisma.building.create({
          data: { organizationId: orgId, branchId: branch.id, code: bCode, name: bName },
        });
      }

      let floor = await prisma.floor.findUnique({
        where: { buildingId_floorNumber: { buildingId: building.id, floorNumber: fNum } },
      });

      if (!floor) {
        floor = await prisma.floor.create({
          data: { buildingId: building.id, floorNumber: fNum, name: fName },
        });
      }

      // Find or create default section for this floor
      let section = await prisma.section.findFirst({
        where: { floorId: floor.id, code: 'MAIN' }
      });
      if (!section) {
        section = await prisma.section.create({
          data: {
            floorId: floor.id,
            code: 'MAIN',
            name: 'Main Section',
            columns: 4
          }
        });
      }

      const featuresRaw = record.features || record.Features || '';
      const featuresArr = typeof featuresRaw === 'string' && featuresRaw.length > 0
        ? featuresRaw.split(';').map((s: string) => s.trim())
        : ['Power Outlet', 'Wi-Fi'];

      await prisma.resource.upsert({
        where: { sectionId_code: { sectionId: section.id, code: rCode } },
        update: { name: rName, type: rType as any, features: featuresArr },
        create: {
          sectionId: section.id,
          code: rCode,
          name: rName,
          type: rType as any,
          capacity: rType === ResourceType.BOARD_ROOM ? 10 : rType === ResourceType.MEETING_ROOM ? 4 : 1,
          features: featuresArr,
        },
      });

      createdCount++;
    }

    await prisma.auditLog.create({
      data: {
        organizationId: orgId,
        actorUserId: req.user!.id,
        action: 'CSV_SPACE_INVENTORY_IMPORT',
        entityType: 'Resource',
        entityId: orgId,
        metadata: { importedRecords: createdCount },
      },
    });

    return res.json({
      message: `Successfully processed CSV inventory. Imported/updated ${createdCount} items.`,
      count: createdCount,
    });
  } catch (error: any) {
    console.error('CSV import error:', error);
    return res.status(500).json({ error: error.message });
  }
});

// 3. Delete Resource
router.delete('/resources/:id', authMiddleware, requireRole([Role.PLATFORM_ADMIN, Role.ORGANIZATION_ADMIN]), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    // Verify resource belongs to active tenant
    const resource = await prisma.resource.findUnique({
      where: { id },
      include: {
        section: {
          include: {
            floor: {
              include: { building: true },
            },
          },
        },
      },
    });

    if (!resource || resource.section.floor.building.organizationId !== req.organizationId!) {
      return res.status(404).json({ error: 'Resource not found or access denied' });
    }

    // Delete associated bookings first
    await prisma.booking.deleteMany({
      where: { resourceId: id },
    });

    await prisma.resource.delete({
      where: { id },
    });

    await prisma.auditLog.create({
      data: {
        organizationId: req.organizationId!,
        actorUserId: req.user!.id,
        action: 'DELETE_RESOURCE',
        entityType: 'Resource',
        entityId: id,
        metadata: { code: resource.code, name: resource.name },
      },
    });

    return res.json({ success: true, message: 'Resource deleted successfully' });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// 4. Patch Resource (e.g. for sortOrder/drag-and-drop movement)
router.patch('/resources/:id', authMiddleware, requireRole([Role.PLATFORM_ADMIN, Role.ORGANIZATION_ADMIN]), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { sortOrder, name, type, capacity, hasPC, features } = req.body;

    const resource = await prisma.resource.findUnique({
      where: { id },
      include: {
        section: {
          include: {
            floor: {
              include: { building: true },
            },
          },
        },
      },
    });

    if (!resource || resource.section.floor.building.organizationId !== req.organizationId!) {
      return res.status(404).json({ error: 'Resource not found or access denied' });
    }

    const updated = await prisma.resource.update({
      where: { id },
      data: {
        ...(sortOrder !== undefined ? { sortOrder: sortOrder !== null ? parseInt(sortOrder, 10) : null } : {}),
        ...(name !== undefined ? { name } : {}),
        ...(type !== undefined ? { type: type as any } : {}),
        ...(capacity !== undefined ? { capacity: parseInt(capacity, 10) } : {}),
        ...(hasPC !== undefined ? { hasPC: !!hasPC } : {}),
        ...(features !== undefined ? { features: Array.isArray(features) ? features : [] } : {}),
      },
    });

    return res.json(updated);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

export default router;
