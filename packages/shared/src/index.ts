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

export interface FloorDTO {
  id: string;
  organizationId: string;
  buildingId: string;
  code: string;
  floorNumber: number;
  name: string;
  sections?: SectionDTO[];
}

export interface SectionDTO {
  id: string;
  organizationId: string;
  floorId: string;
  name: string;
  direction: string;
  standardDeskCount: number;
  hdmiDeskCount: number;
  desks?: DeskDTO[];
  meetingRoom?: MeetingRoomDTO | null;
}

export interface DeskDTO {
  id: string;
  organizationId: string;
  sectionId: string;
  deskCode: string;
  deskNumber: number;
  hasHdmi: boolean;
  isMeetingRoom: boolean;
  status: 'AVAILABLE' | 'BOOKED';
}

export interface MeetingRoomDTO {
  id: string;
  organizationId: string;
  sectionId: string;
  name: string;
  capacity: number;
  hasHdmi: boolean;
  hdmiCount: number;
}

export interface BookingDTO {
  id: string;
  organizationId: string;
  deskId: string;
  userId: string;
  startTime: string;
  endTime: string;
  status: 'CONFIRMED' | 'CANCELLED';
  createdAt: string;
  updatedAt: string;
  desk?: DeskDTO & {
    section?: SectionDTO & {
      floor?: FloorDTO & {
        building?: BuildingDTO & {
          branch?: BranchDTO;
        };
      };
    };
  };
  user?: UserDTO;
}

export interface EmployeeDashboardSummaryDTO {
  activeBooking: BookingDTO | null;
  totalBookings: number;
  assignedBranch: BranchDTO | null;
  branchStats: {
    totalDesks: number;
    availableDesks: number;
    occupiedDesks: number;
    meetingRoomCount: number;
  };
  recentBookings: BookingDTO[];
}
