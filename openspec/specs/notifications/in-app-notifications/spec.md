# Notifications - In App Notifications Specification

## Purpose
Delivers real-time and cached notifications to users for booking assignments, sync conflicts, and sync confirmations.

## Requirements
### Requirement: Notification Trigger and Database Persistence
The system SHALL create a Notification record on the server and save it locally in IndexedDB when key booking events occur.

#### Scenario: Sync Conflict Notification
- **WHEN** the sync engine detects a conflict for an offline booking
- **THEN** a Notification record of type BOOKING_CONFLICT is created and saved to the local notifications table

### Requirement: Bell Icon Unread Count
The application header SHALL render a bell icon with a badge showing the live count of unread notifications.

#### Scenario: Unread Notification Count
- **WHEN** the user has 3 unread notifications in their local table
- **THEN** the header bell icon displays a red "3" badge

### Requirement: Mark as Read UI
The user SHALL be able to mark notifications as read individually or all at once.

#### Scenario: Mark All Read
- **WHEN** the user clicks "Mark all as read" in the notifications panel
- **THEN** all notification statuses change to isRead = true and the badge count resets to zero
