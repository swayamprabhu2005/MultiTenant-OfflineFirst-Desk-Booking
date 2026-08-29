import Dexie, { Table } from 'dexie';

export interface LocalBooking {
  id: string;
  organizationId: string;
  resourceId: string;
  resourceName?: string;
  buildingName?: string;
  floorName?: string;
  userId: string;
  userName?: string;
  createdById: string;
  startAt: string;
  endAt: string;
  status: 'CONFIRMED' | 'CONFLICT' | 'FAILED' | 'CANCELLED' | 'PENDING';
  source: 'ONLINE' | 'OFFLINE';
  operationId: string;
  recurringGroupId?: string | null;
  createdAt: string;
  syncError?: string;
}

export interface OutboxItem {
  operationId: string;
  operationType: 'CREATE_BOOKING' | 'CANCEL_BOOKING' | 'UPDATE_PROFILE';
  payload: any;
  requestHash: string;
  createdAt: string;
  status: 'PENDING' | 'SUCCESS' | 'FAILED' | 'REJECTED';
  retryCount: number;
  lastError?: string;
}

export interface LocalResource {
  id: string;
  sectionId: string;
  buildingId: string;
  type: string;
  name: string;
  code: string;
  capacity: number;
  status: string;
  features: string[];
  hasPC?: boolean;
  columnSpan?: number;
  sortOrder?: number | null;
}

export interface LocalBuilding {
  id: string;
  organizationId: string;
  name: string;
  code: string;
  address?: string;
}

export interface LocalFloor {
  id: string;
  buildingId: string;
  name: string;
  floorNumber: number;
}

export class DeskBookingDatabase extends Dexie {
  organizations!: Table<any, string>;
  branches!: Table<any, string>;
  buildings!: Table<LocalBuilding, string>;
  floors!: Table<LocalFloor, string>;
  sections!: Table<any, string>;
  resources!: Table<LocalResource, string>;
  localBookings!: Table<LocalBooking, string>;
  outbox!: Table<OutboxItem, string>;
  cachedUser!: Table<any, string>;
  notifications!: Table<any, string>;

  constructor() {
    super('DeskBookingOfflineDB');

    // Define schema version 2 including branches, sections, and notifications
    this.version(2).stores({
      organizations: 'id, subdomain, code',
      branches: 'id, organizationId, code',
      buildings: 'id, organizationId, code, branchId',
      floors: 'id, buildingId, floorNumber',
      sections: 'id, floorId, code',
      resources: 'id, sectionId, type, code',
      localBookings: 'id, organizationId, userId, resourceId, status, operationId, startAt, recurringGroupId',
      outbox: 'operationId, status, createdAt',
      cachedUser: 'id, email, organizationId',
      notifications: 'id, userId, type, isRead, createdAt',
    });
  }
}

export const db = new DeskBookingDatabase();
