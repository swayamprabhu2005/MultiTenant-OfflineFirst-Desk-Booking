export enum Role {
  PLATFORM_ADMIN = 'PLATFORM_ADMIN',
  ORGANIZATION_ADMIN = 'ORGANIZATION_ADMIN',
  BRANCH_ADMIN = 'BRANCH_ADMIN',
  TECH_LEAD = 'TECH_LEAD',
  EMPLOYEE = 'EMPLOYEE',
}

export interface OrganizationDTO {
  id: string;
  name: string;
  code: string;
  subdomain: string;
  logoUrl?: string | null;
  themeColor: string;
  timezone: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface BranchDTO {
  id: string;
  organizationId: string;
  name: string;
  code: string;
  address?: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface BuildingDTO {
  id: string;
  organizationId: string;
  branchId: string;
  name: string;
  code: string;
  address?: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface UserDTO {
  id: string;
  organizationId: string;
  name: string;
  email: string;
  role: Role;
  department?: string | null;
  baseBranchId?: string | null;
  baseBuildingId?: string | null;
  scopedBranchId?: string | null;
  teamLeadId?: string | null;
  mustChangePassword?: boolean;
  status: string;
  createdAt: string;
  organization?: OrganizationDTO | null;
  scopedBranch?: BranchDTO | null;
  baseBranch?: BranchDTO | null;
}

export interface AuditLogDTO {
  id: string;
  organizationId?: string | null;
  actorUserId?: string | null;
  action: string;
  entityType: string;
  entityId: string;
  metadata?: any;
  createdAt: string;
  actorUser?: { name: string; email: string; role?: Role };
}
