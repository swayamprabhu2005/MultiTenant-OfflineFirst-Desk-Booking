# Technical Design: Cascading Excel Engine & 3-Color Visual Parity

## 1. Excel Dynamic Cascading Formulas
- Buildings Sheet: `=UPPER(TRIM(Organization!A5))`
- Floors Sheet: `=IF(ISBLANK(B5),"",VLOOKUP(B5,Buildings!A$5:B$50,2,FALSE))`
- Sections Sheet: Cascading lookup to parent Floors and Buildings.
- Meeting Room Conditional Formatting:
  - Rule: `=UPPER(TRIM($G5))="YES"`
  - Formatting: Fills cell in light gray (`#E2E8F0`), locks desk capacity, highlights room capacity in yellow (`#FEF08A`).

## 2. Server-Side Parser Hardening
- Evaluates `cell.result ?? cell.value` to handle calculated formula values.
- Performs atomic validation pass across all relational tiers before database modification.

## 3. 3-Color Contextual CAD Parity
- Workstation Component calculates ownership:
  ```ts
  const isMyBooking = desk.bookings?.some(b => b.userId === currentUser.id);
  const isBooked = desk.bookings && desk.bookings.length > 0;
  const isPending = pendingDeskIds.includes(desk.id);
  ```
- Line 1: Code (`C-01`)
- Line 2: PC monitor icon (HDMI display indicator)
- Line 3: Status Tag (`Available`, `Your Desk`, `Booked`, `Sync Pending`)
