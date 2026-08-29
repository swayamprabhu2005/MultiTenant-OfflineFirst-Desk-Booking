import { Router, Response } from 'express';
import { prisma } from '../prisma';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth.middleware';

const router = Router();

// GET all notifications for current user
router.get('/', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const notifications = await prisma.notification.findMany({
      where: { userId: req.user!.id },
      orderBy: { createdAt: 'desc' },
    });
    return res.json(notifications);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// PATCH mark single notification as read
router.patch('/:id/read', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const notification = await prisma.notification.findFirst({
      where: { id, userId: req.user!.id },
    });

    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    const updated = await prisma.notification.update({
      where: { id },
      data: { isRead: true },
    });

    return res.json(updated);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// POST mark all notifications as read
router.post('/read-all', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    await prisma.notification.updateMany({
      where: { userId: req.user!.id, isRead: false },
      data: { isRead: true },
    });
    return res.json({ message: 'All notifications marked as read' });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

export default router;
