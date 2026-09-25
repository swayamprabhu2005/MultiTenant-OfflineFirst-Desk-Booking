# Offline - IndexedDB Outbox Storage Specification

## Purpose
Provides client-side mutation interception and offline queue storage using IndexedDB (`desk_booking_offline_db`).

## Requirements
### Requirement: Offline Mutation Interception
When disconnected, booking creation and cancellation requests SHALL be intercepted and queued in the IndexedDB Outbox.

#### Scenario: Offline Desk Booking
- **GIVEN** the browser is offline (`navigator.onLine === false`)
- **WHEN** the employee confirms a desk reservation
- **THEN** the request payload is stored in the IndexedDB outbox store, an amber notification is displayed, and the workstation state updates to 'Sync Pending'.
