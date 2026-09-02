import { Router, Response } from 'express';
import { prisma } from '../prisma';
import { authMiddleware, AuthenticatedRequest, requireRole } from '../middleware/auth.middleware';
import { Role } from '@deskbooking/shared';

const router = Router();

// GET all branches for the active tenant
router.get('/', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const currentUser = req.user!;
    const where: any = {
      organizationId: req.organizationId!,
    };

    // If scoped branch admin, restrict list to their branch only
    if (currentUser.role === Role.BRANCH_ADMIN && currentUser.scopedBranchId) {
      where.id = currentUser.scopedBranchId;
    }

    const branches = await prisma.branch.findMany({
      where,
      orderBy: { name: 'asc' },
    });

    return res.json(branches);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// POST Create Branch (Org Admin / Platform Admin)
router.post('/', authMiddleware, requireRole([Role.PLATFORM_ADMIN, Role.ORGANIZATION_ADMIN]), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name, code, address } = req.body;
    if (!name || !code) {
      return res.status(400).json({ error: 'Branch name and code are required' });
    }

    // Branch Admin with scopedBranchId cannot create other branches
    if (req.user!.role === Role.BRANCH_ADMIN && req.user!.scopedBranchId) {
      return res.status(403).json({ error: 'Forbidden: Branch admins cannot create other branches' });
    }

    const branch = await prisma.branch.create({
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
        action: 'CREATE_BRANCH',
        entityType: 'Branch',
        entityId: branch.id,
        metadata: { name: branch.name, code: branch.code },
      },
    });

    return res.status(201).json(branch);
  } catch (error: any) {
    return res.status(400).json({ error: error.message });
  }
});

// PUT Update Branch
router.put('/:id', authMiddleware, requireRole([Role.PLATFORM_ADMIN, Role.ORGANIZATION_ADMIN]), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { name, code, address, status } = req.body;

    const existingBranch = await prisma.branch.findFirst({
      where: { id, organizationId: req.organizationId! },
    });

    if (!existingBranch) {
      return res.status(404).json({ error: 'Branch not found' });
    }

    // Branch Admin cannot edit branches outside their scope
    if (req.user!.role === Role.BRANCH_ADMIN && req.user!.scopedBranchId && req.user!.scopedBranchId !== id) {
      return res.status(403).json({ error: 'Forbidden: Cannot edit branches outside your scope' });
    }

    const updated = await prisma.branch.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(code && { code: code.toUpperCase() }),
        ...(address !== undefined && { address }),
        ...(status && { status }),
      },
    });

    await prisma.auditLog.create({
      data: {
        organizationId: req.organizationId!,
        actorUserId: req.user!.id,
        action: 'UPDATE_BRANCH',
        entityType: 'Branch',
        entityId: id,
      },
    });

    return res.json(updated);
  } catch (error: any) {
    return res.status(400).json({ error: error.message });
  }
});

// DELETE Delete Branch
router.delete('/:id', authMiddleware, requireRole([Role.PLATFORM_ADMIN, Role.ORGANIZATION_ADMIN]), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const existingBranch = await prisma.branch.findFirst({
      where: { id, organizationId: req.organizationId! },
    });

    if (!existingBranch) {
      return res.status(404).json({ error: 'Branch not found' });
    }

    // Branch Admin cannot delete branches
    if (req.user!.role === Role.BRANCH_ADMIN) {
      return res.status(403).json({ error: 'Forbidden: Branch admins cannot delete branches' });
    }

    await prisma.branch.delete({
      where: { id },
    });

    await prisma.auditLog.create({
      data: {
        organizationId: req.organizationId!,
        actorUserId: req.user!.id,
        action: 'DELETE_BRANCH',
        entityType: 'Branch',
        entityId: id,
      },
    });

    return res.json({ message: 'Branch deleted successfully' });
  } catch (error: any) {
    return res.status(400).json({ error: error.message });
  }
});

export default router;
