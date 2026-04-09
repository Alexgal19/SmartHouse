# Address and Room Blocking Implementation Summary

## Overview
This document describes the implementation of a comprehensive filtering system that excludes blocked addresses and rooms from all statistics, capacity calculations, diagrams, and summary lists throughout the application.

## Implementation Date
2026-02-12

## Blocking Criteria

An address or room is considered **blocked** (inactive) when:

### For Addresses:
- `address.isActive === false`

### For Rooms:
- `room.isActive === false` OR
- `room.isLocked === true` OR
- The parent address is blocked (`address.isActive === false`)

## Files Created

### 1. `/src/lib/address-filters.ts`
**Purpose:** Centralized utility functions for filtering blocked addresses and rooms

**Key Functions:**
- `isAddressActive(address)` - Check if an address is active
- `isRoomActive(room, parentAddress)` - Check if a room is active (considers parent address)
- `getActiveAddresses(addresses)` - Filter array to only active addresses
- `getActiveRooms(address)` - Get only active rooms from an address
- `getActiveAddressCapacity(address)` - Calculate total capacity of active rooms in an address
- `getTotalActiveCapacity(addresses)` - Calculate total capacity across all active addresses
- `isRoomActiveInAddress(address, roomName)` - Check if a specific room in an address is active
- `getAddressesWithActiveRooms(addresses)` - Filter to addresses with at least one active room
- `countActiveAddressesInUse(occupants, allAddresses)` - Count unique active addresses being used

## Files Modified

### 1. `/src/components/dashboard/kpi-cards.tsx`
**Changes:**
- Imported `countActiveAddressesInUse` utility function
- Modified "Używane mieszkania" (Apartments in Use) KPI to only count active addresses
- Now correctly excludes blocked addresses from the count

**Impact:**
- When an address is blocked, it's immediately removed from the "Apartments in Use" count
- When an address is unblocked, it's automatically included in the count

### 2. `/src/components/dashboard/coordinator-occupancy-chart.tsx`
**Changes:**
- Imported `getActiveAddresses` and `getActiveAddressCapacity` utility functions
- Filters coordinator addresses to only include active ones
- Calculates capacity using only active (non-blocked) rooms
- Updated totals calculation to exclude blocked addresses/rooms

**Impact:**
- Occupancy percentages now accurately reflect only active capacity
- Blocked addresses don't appear in the occupancy chart
- Total capacity KPIs (All Places, Occupied, Available) exclude blocked addresses/rooms

### 3. `/src/components/housing-view.tsx`
**Changes:**
- Imported `getActiveAddresses`, `getActiveRooms`, and `getActiveAddressCapacity` utility functions
- Modified `useHousingData` hook to calculate capacity using only active rooms
- Updated available places calculation per locality to exclude blocked addresses
- Added `isLocked` property to room data structure

**Impact:**
- Capacity counts in housing view only include active rooms
- Available places badges show accurate counts excluding blocked addresses/rooms
- Blocked addresses are visually distinguished but excluded from capacity calculations

### 4. `/src/components/address-preview-dialog.tsx`
**Changes:**
- Imported `isRoomActive` utility function
- Modified room activity check to use centralized filtering logic
- Updated locality summary to only include active rooms in totals

**Impact:**
- Room selection dialog only shows available capacity from active rooms
- Blocked rooms are marked as unavailable and excluded from statistics
- Locality summaries accurately reflect only active capacity

### 5. `/src/components/dashboard/charts.tsx`
**Changes:**
- Imported `isAddressActive` utility function
- Modified NZ occupancy calculations to skip blocked addresses
- Modified deductions calculations to skip blocked addresses
- Added address activity checks before including data in charts

**Impact:**
- "Ilość osób (NZ) wg Lokalizacji" chart excludes blocked addresses
- "Potrącenia" (Deductions) chart excludes deductions from blocked addresses
- Statistics are only calculated for active addresses

## Behavior Summary

### When an Address is Blocked (`isActive = false`):

1. **Dashboard KPIs:**
   - Removed from "Używane mieszkania" count
   - Occupants still counted in employee/non-employee totals (status-based, not location-based)

2. **Coordinator Occupancy Chart:**
   - Address removed from the chart entirely
   - Capacity excluded from totals (All Places, Occupied, Available)

3. **Housing View:**
   - Address visually marked as blocked (red border, badge)
   - Capacity set to 0 (only active rooms counted)
   - Available places = 0
   - Excluded from locality's available places count

4. **Address Preview Dialog:**
   - Rooms marked as inactive/unavailable
   - Excluded from locality summaries
   - Cannot be selected for new assignments

5. **Dashboard Charts:**
   - NZ occupancy: Excluded from location statistics
   - Deductions: Excluded from deduction aggregations

### When a Room is Blocked (`isActive = false` or `isLocked = true`):

1. **Capacity Calculations:**
   - Room capacity not counted in address total capacity
   - Room capacity not counted in overall statistics

2. **Housing View:**
   - Room visually marked as blocked/locked
   - Room's capacity excluded from available places
   - Occupants visible but room unavailable for new assignments

3. **Address Preview Dialog:**
   - Room marked as unavailable
   - Cannot be selected for new assignments
   - Excluded from capacity totals

### When Unblocking:

1. **Address Unblocked:**
   - Immediately reappears in all statistics
   - Capacity recalculated including active rooms
   - Available for new assignments

2. **Room Unblocked:**
   - Room capacity immediately added to totals
   - Available places increased
   - Available for new assignments

## Technical Implementation Details

### Centralized Logic
All blocking logic is centralized in `/src/lib/address-filters.ts`, ensuring:
- Consistent behavior across all components
- Single source of truth for blocking rules
- Easy maintenance and updates
- Type-safe implementations

### Reactive Updates
The implementation uses React's `useMemo` hooks, ensuring:
- Automatic recalculation when address/room status changes
- No manual refresh required
- Efficient re-rendering (only when dependencies change)

### Data Integrity
- Existing occupants in blocked addresses/rooms remain visible
- Historical data preserved
- Only future assignments affected
- Statistics reflect current active capacity

## Testing Recommendations

To verify the implementation:

1. **Block an Address:**
   - Check "Używane mieszkania" KPI decreases
   - Verify address disappears from coordinator occupancy chart
   - Confirm available places update in housing view
   - Check NZ occupancy chart excludes the address

2. **Block a Room:**
   - Verify capacity decreases in housing view
   - Check available places update correctly
   - Confirm room unavailable in address preview dialog

3. **Unblock Address/Room:**
   - Verify immediate reappearance in all statistics
   - Confirm capacity recalculated correctly
   - Check available for new assignments

4. **Multiple Scenarios:**
   - Block address with multiple rooms
   - Block individual rooms in active address
   - Mix of blocked/unblocked in same locality
   - Verify locality summaries accurate in all cases

## Future Considerations

1. **Audit Trail:** Consider adding logging when addresses/rooms are blocked/unblocked
2. **Notifications:** Consider notifying coordinators when their addresses are blocked
3. **Bulk Operations:** Consider UI for bulk blocking/unblocking
4. **Historical Analytics:** Consider separate views for blocked vs active capacity over time
5. **Reporting:** Consider reports showing blocking history and reasons

## Conclusion

The implementation successfully ensures that all statistics, capacity calculations, diagrams, and summary lists throughout the application automatically exclude blocked addresses and rooms. The blocking/unblocking behavior is immediate, consistent, and applied uniformly across all features that display room availability, capacity metrics, occupancy statistics, or aggregate data related to addresses and rooms.
