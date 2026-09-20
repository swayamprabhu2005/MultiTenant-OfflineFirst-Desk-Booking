# Admin Portal - Branch Admin Roster Specification

## Purpose
Manages the assignment, update, and revocation of physical branch administrators with prerequisite gating and instant rollback.

## Requirements
### Requirement: Workspace Configuration Prerequisite Gate
The roster interface SHALL be locked if no branches exist in the organization.

#### Scenario: Locked Roster State
- **GIVEN** an organization with 0 branches in the database
- **WHEN** the administrator visits `/admin/roster`
- **THEN** the interface renders a locked state directing the administrator to complete workspace setup first.

### Requirement: Instant Revocation Rollback
Deleting a branch administrator SHALL instantly revert the branch status to unassigned.

#### Scenario: Administrator Removal
- **WHEN** the administrator sends `DELETE /api/roster/branch-admin/:id`
- **THEN** the user record is deleted, an audit record `REVOKE_BRANCH_ADMIN` is written, and the branch UI reverts immediately to `Pending Assignment` with an `+ Assign` button.
