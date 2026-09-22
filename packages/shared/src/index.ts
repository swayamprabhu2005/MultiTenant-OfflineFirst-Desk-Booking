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
  workspaceSetupAt?: string | null;
  defaultBranchAdminPassword?: string | null;
  operatingMode?: 'CENTRALIZED' | 'DELEGATED';
  allowBranchFloorPlanEdit?: boolean;
  allowBranchRosterManagement?: boolean;
  allowBranchProxyBooking?: boolean;
  allowBranchIssueResolution?: boolean;
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
  isActive?: boolean;
  status: string;
  createdAt: string;
  organization?: OrganizationDTO | null;
  scopedBranch?: BranchDTO | null;
  baseBranch?: BranchDTO | null;
}

export interface BranchEmployeeDTO {
  id: string;
  name: string;
  email: string;
  department?: string | null;
  isActive: boolean;
  mustChangePassword: boolean;
  createdAt: string;
}

export interface WorkspaceSetupStatusDTO {
  hasSetup: boolean;
  workspaceSetupAt?: string | null;
  isLocked: boolean;
  remainingMs: number;
  hoursLeft: number;
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

export enum SessionType {
  SESSION_1 = 'SESSION_1', // Morning: 09:00 - 13:30
  SESSION_2 = 'SESSION_2', // Afternoon: 13:30 - 18:00
  FULL_DAY = 'FULL_DAY',   // All Sessions: 09:00 - 18:00
  CUSTOM = 'CUSTOM',       // Custom user-defined hours and minutes
}

export enum ResourceType {
  DESK = 'DESK',
  MEETING_ROOM = 'MEETING_ROOM',
}

export interface BookingDTO {
  id: string;
  organizationId: string;
  resourceType: ResourceType;
  deskId?: string | null;
  desk?: DeskDTO | null;
  meetingRoomId?: string | null;
  meetingRoom?: MeetingRoomDTO | null;
  userId: string;
  user?: { id: string; name: string; email: string; department?: string | null } | null;
  bookedByUserId?: string | null;
  bookedByUser?: { id: string; name: string; email: string } | null;
  sessionType: SessionType;
  slotType: string;
  title?: string | null;
  attendeesCount?: number | null;
  durationMinutes?: number | null;
  startTime: string;
  endTime: string;
  status: 'CONFIRMED' | 'CANCELLED' | 'RELEASED';
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export enum IssueStatus {
  OPEN = 'OPEN',
  IN_PROGRESS = 'IN_PROGRESS',
  RESOLVED = 'RESOLVED',
}

export enum IssuePriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

export interface IssueMessageDTO {
  id: string;
  issueReportId: string;
  senderId: string;
  senderName: string;
  senderRole: string;
  message: string;
  createdAt: string;
}

export interface IssueReportDTO {
  id: string;
  title: string;
  description: string;
  category?: string | null;
  priority: IssuePriority;
  screenshotUrl?: string | null;
  clientVersion?: string | null;
  deviceInfo?: string | null;
  systemDiagnostics?: Record<string, any> | null;
  status: IssueStatus;
  targetLevel?: string | null; // "BRANCH_ADMIN" | "ORGANIZATION_ADMIN" | "PLATFORM_ADMIN"
  branchId?: string | null;
  resolutionNote?: string | null;
  commendationNote?: string | null;
  commendationAuthor?: string | null;
  reporterId: string;
  reporter?: {
    id: string;
    name: string;
    email: string;
    role: Role;
  };
  organizationId: string;
  organization?: {
    id: string;
    name: string;
    code: string;
    subdomain: string;
  };
  resolvedById?: string | null;
  resolvedBy?: {
    id: string;
    name: string;
    email: string;
  } | null;
  messages?: IssueMessageDTO[];
  createdAt: string;
  updatedAt: string;
}

