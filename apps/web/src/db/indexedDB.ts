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
  createdAt: string;
  syncError?: string;
}

export interface OutboxItem {
  operationId: string;
  operationType: 'CREATE_BOOKING' | 'CANCEL_BOOKING';
  payload: any;
  requestHash: string;
  createdAt: string;
  status: 'PENDING' | 'SUCCESS' | 'FAILED' | 'REJECTED';
  retryCount: number;
  lastError?: string;
}

export interface LocalResource {
  id: string;
  floorId: string;
  buildingId: string;
  type: string;
  name: string;
  code: string;
  capacity: number;
  status: string;
  features: string[];
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
  buildings!: Table<LocalBuilding, string>;
  floors!: Table<LocalFloor, string>;
  resources!: Table<LocalResource, string>;
  localBookings!: Table<LocalBooking, string>;
  outbox!: Table<OutboxItem, string>;
  cachedUser!: Table<any, string>;

  constructor() {
    super('DeskBookingOfflineDB');

    this.version(1).stores({
      organizations: 'id, subdomain, code',
      buildings: 'id, organizationId, code',
      floors: 'id, buildingId, floorNumber',
      resources: 'id, floorId, buildingId, type, code',
      localBookings: 'id, organizationId, userId, resourceId, status, operationId, startAt',
      outbox: 'operationId, status, createdAt',
      cachedUser: 'id, email, organizationId',
    });
  }
}

export const db = new DeskBookingDatabase();
