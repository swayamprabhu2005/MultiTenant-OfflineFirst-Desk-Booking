# Employee Booking - Date Range Booking & 7-Day Matrix Specification

## Purpose
Governs multi-day date range filtering, UTC timezone normalization, past date blocking, and the strict 7-day sliding window matrix with week navigation.

## Requirements
### Requirement: Timezone Boundary Normalization
Date strings SHALL be parsed and rendered using local timezone coordinates to prevent date shifting.

#### Scenario: Local Date Parsing
- **WHEN** querying bookings across a date range
- **THEN** date boundaries match local calendar dates (YYYY-MM-DD) without off-by-one shifts caused by UTC conversion.

### Requirement: Strict 7-Day Sliding Window with Week Navigation
Schedule matrices SHALL render strictly 7 consecutive days at a time with `<` (Previous 7 Days) and `>` (Next 7 Days) arrows.

#### Scenario: Week Navigation
- **WHEN** clicking the `>` arrow in any workstation modal
- **THEN** the schedule matrix advances by exactly 7 days and updates the date range header.
