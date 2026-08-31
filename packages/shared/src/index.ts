export enum Role {
  PLATFORM_ADMIN = 'PLATFORM_ADMIN',
  ORGANIZATION_ADMIN = 'ORGANIZATION_ADMIN',
  BRANCH_ADMIN = 'BRANCH_ADMIN',
  TECH_LEAD = 'TECH_LEAD',
  EMPLOYEE = 'EMPLOYEE',
}

export enum ResourceType {
  CUBICLE = 'CUBICLE',
  DESK = 'DESK',
  BOARD_ROOM = 'BOARD_ROOM',
  MEETING_ROOM = 'MEETING_ROOM',
}

export enum ResourceStatus {
  ACTIVE = 'ACTIVE',
  DISABLED = 'DISABLED',
  MAINTENANCE = 'MAINTENANCE',
}

export enum BookingStatus {
  CONFIRMED = 'CONFIRMED',
  CONFLICT = 'CONFLICT',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
  PENDING = 'PENDING', // Used locally in Dexie IndexedDB before sync
}

export enum BookingSource {
  ONLINE = 'ONLINE',
  OFFLINE = 'OFFLINE',
}

export enum SyncOperationStatus {
  PENDING = 'PENDING',
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
  REJECTED = 'REJECTED',
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
}

export interface BuildingDTO {
  id: string;
  organizationId: string;
  name: string;
  code: string;
  address?: string | null;
  status: string;
  floors?: FloorDTO[];
}

export interface FloorDTO {
  id: string;
  buildingId: string;
  name: string;
  floorNumber: number;
  status: string;
  resources?: ResourceDTO[];
}

export interface ResourceDTO {
  id: string;
  floorId: string;
  type: ResourceType;
  name: string;
  code: string;
  capacity: number;
  status: ResourceStatus;
  features: string[];
}

export interface BookingDTO {
  id: string;
  organizationId: string;
  resourceId: string;
  userId: string;
  createdById: string;
  startAt: string;
  endAt: string;
  status: BookingStatus;
  source: BookingSource;
  operationId: string;
  createdAt: string;
  cancelledAt?: string | null;
  resource?: ResourceDTO;
  user?: UserDTO;
  createdBy?: UserDTO;
}

export interface SyncOperationPayload {
  operationId: string;
  operationType: 'CREATE_BOOKING' | 'CANCEL_BOOKING';
  payload: {
    resourceId?: string;
    userId?: string;
    startAt?: string;
    endAt?: string;
    bookingId?: string;
  };
  requestHash: string;
  createdAt: string;
}

export interface SyncBatchRequest {
  operations: SyncOperationPayload[];
}

export interface SyncOperationResult {
  operationId: string;
  status: SyncOperationStatus;
  booking?: BookingDTO;
  error?: string;
}

export interface SyncBatchResponse {
  results: SyncOperationResult[];
}

export interface BulkSpaceImportItem {
  buildingCode: string;
  buildingName: string;
  floorNumber: number;
  floorName: string;
  resourceCode: string;
  resourceName: string;
  resourceType: ResourceType;
  capacity?: number;
  features?: string[];
}

export interface BulkRosterImportItem {
  name: string;
  email: string;
  role?: Role;
  department?: string;
  baseOfficeBuildingCode?: string;
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
  actorUser?: { name: string; email: string };
}
