# Employee Booking - Date Range Booking Specification

## Purpose
Allows employees to select date ranges and weekdays for recurring bookings, enforcing client-side pre-flight checks.

## Requirements
### Requirement: Pre-Flight Booking Conflict Warnings
The UI SHALL warn the user before submission if any dates within their selected range and weekdays already have a booking.

#### Scenario: Pre-Flight Check
- **WHEN** the employee selects a range containing Wednesday Sep 3, and they already have a booking on that day
- **THEN** the booking dialog displays a warning detailing the conflict on Sep 3

### Requirement: Range Weekday Selection
The employee SHALL be able to select a date range and specific weekdays (e.g. Mon, Wed, Fri) to book within that range.

#### Scenario: Weekday Selection
- **WHEN** the employee picks Aug 29 to Sep 10 and checks Monday and Wednesday
- **THEN** bookings are scheduled only for the Mondays and Wednesdays falling within that window
