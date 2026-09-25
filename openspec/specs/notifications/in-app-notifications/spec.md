# Notifications - In-App Notification Center Specification

## Purpose
Delivers real-time in-app notifications with unread badge counters and an activity stream.

## Requirements
### Requirement: Real-Time Activity Stream
The system SHALL record and display notifications for booking events, approvals, and cancellations.

#### Scenario: Notification Delivery
- **WHEN** a reservation is confirmed or released
- **THEN** an in-app notification is pushed to the user's notification drawer with an unread badge counter in the top navigation bar.
