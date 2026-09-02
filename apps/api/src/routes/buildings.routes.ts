import { Router, Response } from 'express';
import { prisma } from '../prisma';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth.middleware';

const router = Router();

// GET all buildings for branch
router.get('/', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { branchId } = req.query;
    const where: any = {
      organizationId: req.organizationId!,
    };

    if (branchId) {
      where.branchId = String(branchId);
    }

    const buildings = await prisma.building.findMany({
      where,
      orderBy: { name: 'asc' },
    });

    return res.json(buildings);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

export default router;
