## Purpose

Maintains local database operations, outbox queueing, network reconnect syncing, and notifications mapping.

## ADDED Requirements

### Requirement: Workbox Caching Scoping
The Workbox service worker configuration SHALL use the NetworkFirst strategy exclusively for GET operations on /api/* endpoints.

#### Scenario: GET Request Cache
- **WHEN** the employee makes a GET request to /api/buildings while online
- **THEN** Workbox caches the response and uses it as fallback when offline

### Requirement: Mutation Exclude from Workbox
Workbox SHALL NOT intercept or retry POST, PATCH, or DELETE operations.

#### Scenario: POST Request Offline Fallback
- **WHEN** the employee makes a booking mutation while offline
- **THEN** the request bypasses Workbox and is handled by the custom outbox queue

### Requirement: floorName Storing on Sync
The system SHALL populate the floorName attribute on LocalBooking records during the sync engine flush success callback.

#### Scenario: Storing Floor Name
- **WHEN** the outbox flushes a desk booking and the server returns success with the resource relationship
- **THEN** the local IndexedDB booking record is updated with the correct floorName
