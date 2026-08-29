import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { TenantRequest } from './tenant.middleware';
import { prisma } from '../prisma';
import { Role } from '@deskbooking/shared';

export interface AuthenticatedRequest extends TenantRequest {
  user?: {
    id: string;
    email: string;
    name: string;
    role: Role;
    organizationId: string;
    baseBranchId?: string | null;
    baseBuildingId?: string | null;
    scopedBranchId?: string | null;
    teamLeadId?: string | null;
    mustChangePassword: boolean;
    department?: string | null;
  };
}

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-jwt-key-for-multi-tenant-desk-booking-saas';

export const authMiddleware = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing or invalid token' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    
    // Fetch user to confirm status and exact tenant scoping
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        organizationId: true,
        baseBranchId: true,
        baseBuildingId: true,
        scopedBranchId: true,
        teamLeadId: true,
        mustChangePassword: true,
        department: true,
        status: true,
      },
    });

    if (!user || user.status !== 'ACTIVE') {
      return res.status(401).json({ error: 'Unauthorized: User account inactive or invalid' });
    }

    req.user = user as any;
    // Always scope organizationId from user token for authenticated actions
    req.organizationId = user.organizationId;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Unauthorized: Token verification failed' });
  }
};

export const requireRole = (allowedRoles: Role[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden: Insufficient permissions' });
    }

    next();
  };
};

export const checkBranchScope = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (req.user.role === 'ORGANIZATION_ADMIN' && req.user.scopedBranchId) {
    const scopedBranchId = req.user.scopedBranchId;
    const reqBranchId = req.params.branchId || req.query.branchId || req.body.branchId;

    if (reqBranchId && reqBranchId !== scopedBranchId) {
      return res.status(403).json({
        error: 'Forbidden: Access restricted to scoped branch ' + scopedBranchId,
      });
    }

    // Enforce parameter matching
    if (req.method === 'GET') {
      req.query.branchId = scopedBranchId;
    } else {
      req.body.branchId = scopedBranchId;
    }
  }

  next();
};
