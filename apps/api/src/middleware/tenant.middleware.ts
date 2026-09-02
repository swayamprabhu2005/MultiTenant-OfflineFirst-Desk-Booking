import { Request, Response, NextFunction } from 'express';
import { prisma } from '../prisma';

export interface TenantRequest extends Request {
  tenantSubdomain?: string;
  organizationId?: string;
  organization?: any;
}

export const tenantMiddleware = async (
  req: TenantRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    let subdomain: string | undefined = undefined;

    // 1. Check custom header (useful for development & local UI tenant switcher)
    const headerSubdomain = req.headers['x-tenant-subdomain'] as string;
    if (headerSubdomain && headerSubdomain.trim() !== '') {
      subdomain = headerSubdomain.trim().toLowerCase();
    } else {
      // 2. Parse Host header (e.g. acme.deskbooking.com or acme.localhost:4000)
      const host = req.headers.host || '';
      const hostWithoutPort = host.split(':')[0];
      const parts = hostWithoutPort.split('.');

      if (parts.length >= 2 && parts[0] !== 'www' && parts[0] !== 'localhost') {
        subdomain = parts[0].toLowerCase();
      }
    }

    if (subdomain) {
      req.tenantSubdomain = subdomain;
      const org = await prisma.organization.findUnique({
        where: { subdomain },
      });
      if (org) {
        req.organizationId = org.id;
        req.organization = org;
      }
    }

    next();
  } catch (error) {
    console.error('Tenant middleware error:', error);
    next(error);
  }
};
