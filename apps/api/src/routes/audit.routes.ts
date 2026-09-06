import { Router, Response } from 'express';
import { prisma } from '../prisma';
import { authMiddleware, AuthenticatedRequest, requireRole } from '../middleware/auth.middleware';
import { Role } from '@deskbooking/shared';

const router = Router();

router.get('/', authMiddleware, requireRole([Role.PLATFORM_ADMIN, Role.ORGANIZATION_ADMIN, Role.BRANCH_ADMIN]), async (req: AuthenticatedRequest, res: Response) => {
  try {
    let where: any = {};
    if (req.user?.role === Role.PLATFORM_ADMIN) {
      where = { action: 'CREATE_ORGANIZATION' };
    } else if (req.user?.role === Role.BRANCH_ADMIN) {
      const branchId = req.user.scopedBranchId || req.user.baseBranchId;
      where = {
        organizationId: req.organizationId!,
        OR: [
          { actorUserId: req.user.id },
          ...(branchId ? [{ entityId: branchId }] : []),
        ],
      };
    } else {
      where = { organizationId: req.organizationId! };
    }

    const logs = await prisma.auditLog.findMany({
      where,
      include: {
        actorUser: {
          select: { name: true, email: true, role: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return res.json(logs);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

export default router;
