# Employee Booking - Colleague Proxy Booking Specification

## Purpose
Enables employees to search for branch colleagues and book workstations on their behalf.

## Requirements
### Requirement: Colleague Search & Proxy Assignment
Employees SHALL be able to search active colleagues in their branch and assign reservations.

#### Scenario: Proxy Reservation Creation
- **GIVEN** an employee selecting a desk in the inspector modal
- **WHEN** selecting 'For Colleague', searching, and confirming booking with `colleagueUserId`
- **THEN** the reservation records the colleague as the beneficiary while auditing the authenticated user as the booking creator.
