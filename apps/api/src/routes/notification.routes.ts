import { Router, Response } from 'express';
import { prisma } from '../prisma';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth.middleware';

const router = Router();

export interface InAppNotification {
  id: string;
  type: 'BOOKING_CONFIRMED' | 'PROXY_BOOKING' | 'BOOKING_CANCELLED' | 'ADMIN_BROADCAST' | 'SYSTEM';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  metadata?: Record<string, any>;
}

// In-memory user read tracking (userId -> ISO string of last read timestamp)
const userLastReadMap = new Map<string, string>();
// In-memory user cleared tracking (userId -> ISO string of cleared before timestamp)
const userClearedBeforeMap = new Map<string, string>();

/**
 * GET /api/notifications
 * Returns recent activity stream notifications for the current authenticated user
 */
router.get('/', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const orgId = req.organizationId!;
    const user = req.user!;
    const lastReadTimestamp = userLastReadMap.get(user.id) || '1970-01-01T00:00:00.000Z';
    const clearedBeforeTimestamp = userClearedBeforeMap.get(user.id) || '1970-01-01T00:00:00.000Z';

    const notifications: InAppNotification[] = [];

    // 1. Fetch relevant bookings for user (both self and proxy)
    const bookings = await prisma.booking.findMany({
      where: {
        organizationId: orgId,
        OR: [
          { userId: user.id },
          { bookedByUserId: user.id },
        ],
        createdAt: { gte: new Date(clearedBeforeTimestamp) },
      },
      include: {
        desk: {
          include: {
            section: {
              include: {
                floor: {
                  include: {
                    building: {
                      include: {
                        branch: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
        meetingRoom: {
          include: {
            section: {
              include: {
                floor: {
                  include: {
                    building: {
                      include: {
                        branch: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
        user: { select: { id: true, name: true, email: true } },
        bookedByUser: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 25,
    });

    for (const b of bookings) {
      const isProxyForMe = b.bookedByUserId && b.bookedByUserId !== user.id && b.userId === user.id;
      const isProxyMadeByMe = b.bookedByUserId === user.id && b.userId !== user.id;
      const resourceLabel = b.meetingRoom ? `Meeting Room ${b.meetingRoom.name}` : `Workstation ${b.desk?.deskCode || 'N/A'}`;
      const deskCode = b.desk?.deskCode || b.meetingRoom?.name || 'N/A';
      const branchName = b.desk?.section?.floor?.building?.branch?.name || b.meetingRoom?.section?.floor?.building?.branch?.name || 'Facility';
      const sectionName = b.desk?.section?.name || b.meetingRoom?.section?.name || 'Main Area';
      const dateStr = b.startTime.toISOString().split('T')[0];

      if (b.status === 'CANCELLED') {
        notifications.push({
          id: `cancelled-${b.id}`,
          type: 'BOOKING_CANCELLED',
          title: 'Reservation Released',
          message: `Reservation for ${resourceLabel} (${sectionName}, ${branchName}) on ${dateStr} was released.`,
          timestamp: b.updatedAt.toISOString(),
          read: b.updatedAt.toISOString() <= lastReadTimestamp,
          metadata: { bookingId: b.id, deskCode, branchName, date: dateStr },
        });
      } else if (isProxyForMe) {
        notifications.push({
          id: `proxy-recv-${b.id}`,
          type: 'PROXY_BOOKING',
          title: 'Resource Reserved on Your Behalf',
          message: `${b.bookedByUser?.name || 'A colleague'} reserved ${resourceLabel} in ${branchName} for you on ${dateStr}.`,
          timestamp: b.createdAt.toISOString(),
          read: b.createdAt.toISOString() <= lastReadTimestamp,
          metadata: { bookingId: b.id, bookedBy: b.bookedByUser?.name, deskCode, branchName, date: dateStr },
        });
      } else if (isProxyMadeByMe) {
        notifications.push({
          id: `proxy-made-${b.id}`,
          type: 'BOOKING_CONFIRMED',
          title: 'Proxy Reservation Confirmed',
          message: `Successfully reserved ${resourceLabel} for ${b.user.name} in ${branchName} on ${dateStr}.`,
          timestamp: b.createdAt.toISOString(),
          read: b.createdAt.toISOString() <= lastReadTimestamp,
          metadata: { bookingId: b.id, targetUser: b.user.name, deskCode, branchName, date: dateStr },
        });
      } else {
        notifications.push({
          id: `booking-${b.id}`,
          type: 'BOOKING_CONFIRMED',
          title: 'Booking Confirmed',
          message: `Your reservation for ${resourceLabel} (${sectionName}, ${branchName}) on ${dateStr} is confirmed.`,
          timestamp: b.createdAt.toISOString(),
          read: b.createdAt.toISOString() <= lastReadTimestamp,
          metadata: { bookingId: b.id, deskCode, branchName, date: dateStr },
        });
      }
    }

    // 2. If Branch Admin or Org Admin, check for recent workspace changes or roster additions
    if (['BRANCH_ADMIN', 'ORGANIZATION_ADMIN'].includes(user.role)) {
      const recentAudit = await prisma.auditLog.findMany({
        where: {
          organizationId: orgId,
          createdAt: { gte: new Date(clearedBeforeTimestamp) },
          action: { in: ['ADD_CUBICLE', 'UPLOAD_BRANCH_FLOOR_PLAN', 'BULK_IMPORT_ROSTER'] },
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
      });

      for (const a of recentAudit) {
        let title = 'Workspace Update';
        let msg = `System update completed: ${a.action}`;
        if (a.action === 'ADD_CUBICLE') {
          title = 'New Cubicle Added';
          const meta = a.metadata as any;
          msg = `New workstation ${meta?.deskCode || ''} was registered on ${meta?.sectionName || 'the floor'}.`;
        } else if (a.action === 'UPLOAD_BRANCH_FLOOR_PLAN') {
          title = 'Floor Plan Ingested';
          msg = 'A new architectural floor plan configuration was successfully applied.';
        }

        notifications.push({
          id: `audit-${a.id}`,
          type: 'ADMIN_BROADCAST',
          title,
          message: msg,
          timestamp: a.createdAt.toISOString(),
          read: a.createdAt.toISOString() <= lastReadTimestamp,
          metadata: a.metadata as any,
        });
      }
    }

    // Sort by timestamp descending
    notifications.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // Calculate unread count
    const unreadCount = notifications.filter((n) => !n.read).length;

    return res.json({
      success: true,
      notifications,
      unreadCount,
      lastReadAt: lastReadTimestamp,
    });
  } catch (error: any) {
    console.error('Failed to load notifications:', error);
    return res.status(500).json({ error: error.message || 'Failed to retrieve notifications.' });
  }
});

/**
 * POST /api/notifications/mark-read
 * Marks all notifications as read for current user
 */
router.post('/mark-read', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user!;
    const nowIso = new Date().toISOString();
    userLastReadMap.set(user.id, nowIso);

    return res.json({
      success: true,
      message: 'All notifications marked as read.',
      unreadCount: 0,
      lastReadAt: nowIso,
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/notifications/clear
 * Clears notification activity stream for current user
 */
router.post('/clear', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user!;
    const nowIso = new Date().toISOString();
    userClearedBeforeMap.set(user.id, nowIso);
    userLastReadMap.set(user.id, nowIso);

    return res.json({
      success: true,
      message: 'Notification history cleared.',
      unreadCount: 0,
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

export default router;
