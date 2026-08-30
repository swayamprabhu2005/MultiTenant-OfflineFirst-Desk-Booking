## MODIFIED Requirements

### Requirement: Bell Icon Unread Count
The application header SHALL render a bell icon with a badge showing the live count of unread notifications, and click-triggers SHALL toggle a dropdown panel which auto-dismisses when clicking outside.

#### Scenario: Unread Notification Count
- **WHEN** the user has 3 unread notifications in their local table
- **THEN** the header bell icon displays a red "3" badge

#### Scenario: Dismiss Notification Panel on Click Outside
- **WHEN** the notification dropdown panel is open and the user clicks outside the panel area
- **THEN** the notification dropdown panel is closed automatically
