# Offline - Background Sync Api Specification

## Purpose
Registers and handles the Service Worker Background Sync API to process the outbox queue when the browser is closed.

## Requirements
### Requirement: SW Background Sync Registration
The system SHALL register a background sync tag ('outbox-sync') with the Service Worker when a PENDING operation is added to the IndexedDB outbox.

#### Scenario: Register Sync Tag
- **WHEN** the employee makes a desk booking while offline
- **THEN** a PENDING operation is added to the outbox and the system registers the 'outbox-sync' tag with the service worker

### Requirement: Background Sync Event Handling
The service worker SHALL catch the 'sync' event for 'outbox-sync' and flush the outbox queue, even if all application tabs are closed.

#### Scenario: SW Sync Trigger
- **WHEN** the browser regains connectivity and the OS triggers the service worker sync event
- **THEN** the service worker flushes the outbox and syncs the bookings to the server
