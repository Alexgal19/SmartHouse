# Blocked Addresses Display in Coordinator Occupancy Diagram

## Overview
This document describes the implementation that allows blocked addresses to remain visible in the Coordinator Occupancy diagram while clearly indicating their blocked status through visual cues.

## Implementation Date
2026-02-12

## Requirements Met
The system now displays blocked addresses in the Coordinator Occupancy diagram with:
1. ✅ **Visibility** - Blocked addresses remain visible in the diagram for monitoring purposes
2. ✅ **Red Color** - Blocked addresses are displayed in red color
3. ✅ **"Blocked" Label** - Shows "Zablokowany" (Blocked) text overlay on the bar
4. ✅ **Non-Interactive Status** - Marked as disabled/inactive with reduced opacity to indicate blocked status

## File Modified

### [`src/components/dashboard/coordinator-occupancy-chart.tsx`](src/components/dashboard/coordinator-occupancy-chart.tsx)

## Key Changes

### 1. Updated Type Definition
**Added `isBlocked` property to `OccupancyData` type:**
```typescript
type OccupancyData = {
    name: string;
    occupancy: number;
    occupantCount: number;
    capacity: number;
    available: number;
    isBlocked: boolean;  // NEW: Track blocked status
}
```

### 2. Enhanced Color Function
**Modified `getOccupancyColor()` to prioritize blocked status:**
```typescript
const getOccupancyColor = (percentage: number, isBlocked: boolean) => {
    if (isBlocked) {
        return 'hsl(0 84% 60%)'; // red for blocked addresses
    }
    // ... rest of occupancy-based colors
};
```

### 3. Include ALL Addresses (Active and Blocked)
**Changed filtering logic to include blocked addresses:**
```typescript
// BEFORE: Only active addresses
const coordinatorAddresses = getActiveAddresses(
    settings.addresses.filter(a => a.coordinatorIds.includes(selectedCoordinatorId))
);

// AFTER: All addresses for visibility
const coordinatorAddresses = settings.addresses.filter(
    a => a.coordinatorIds.includes(selectedCoordinatorId)
);
```

### 4. Track Blocked Status
**Added `isBlocked` flag to each address data:**
```typescript
const occupancyByAddress: OccupancyData[] = coordinatorAddresses.map(address => {
    const isBlocked = !address.isActive;  // NEW: Detect blocked addresses
    // ... rest of calculations
    return {
        name: address.name,
        occupancy: occupancy,
        occupantCount,
        capacity: totalCapacity,
        available: totalCapacity - occupantCount,
        isBlocked  // NEW: Include blocked status
    }
});
```

### 5. Sort Blocked Addresses to Bottom
**Modified sorting to place blocked addresses at the bottom:**
```typescript
.sort((a, b) => {
    // Sort blocked addresses to the bottom, then by occupancy
    if (a.isBlocked !== b.isBlocked) {
        return a.isBlocked ? 1 : -1;
    }
    return b.occupancy - a.occupancy;
});
```

### 6. Exclude Blocked from Totals
**KPI totals only count active addresses:**
```typescript
// Calculate totals excluding blocked addresses
const totals = managedAddresses.filter(addr => !addr.isBlocked).reduce((acc, address) => {
    acc.capacity += address.capacity;
    acc.occupantCount += address.occupantCount;
    acc.available += address.available;
    return acc;
}, { capacity: 0, occupantCount: 0, available: 0 });
```

### 7. Custom Y-Axis Labels
**Address names in red with reduced opacity for blocked addresses:**
```typescript
tick={({ x, y, payload }) => {
    const data = chartData.data.find(d => d.name === payload.value);
    const isBlocked = data?.isBlocked || false;
    return (
        <text 
            x={x} 
            y={y} 
            dy={4} 
            textAnchor="end" 
            fill={isBlocked ? 'hsl(0 84% 60%)' : 'currentColor'}
            className="text-xs"
            style={{ opacity: isBlocked ? 0.7 : 1 }}
        >
            {payload.value}
        </text>
    );
}}
```

### 8. Enhanced Tooltip
**Tooltip shows blocked status with visual indicators:**
```typescript
<div className={cn(
    "min-w-[12rem] rounded-lg border bg-background/95 p-2 text-sm shadow-xl",
    data.isBlocked && "border-red-500"  // Red border for blocked
)}>
    <div className="font-bold flex items-center gap-2">
        {data.name}
        {data.isBlocked && (
            <span className="text-xs font-semibold text-red-500 bg-red-50 dark:bg-red-950/30 px-1.5 py-0.5 rounded">
                Zablokowany
            </span>
        )}
    </div>
    {data.isBlocked && (
        <div className="mt-1 text-xs text-muted-foreground italic">
            Ten adres jest nieaktywny
        </div>
    )}
    {/* ... occupancy details ... */}
</div>
```

### 9. Visual Bar Styling
**Bars for blocked addresses in red with reduced opacity:**
```typescript
{chartData.data.map((entry, index) => (
    <Cell 
        key={`cell-${index}`} 
        fill={getOccupancyColor(entry.occupancy, entry.isBlocked)}
        opacity={entry.isBlocked ? 0.5 : 1}  // Reduced opacity
    />
))}
```

### 10. Custom Label Display
**Shows "Zablokowany" instead of percentage for blocked addresses:**
```typescript
content={({ x, y, value, index }) => {
    const data = chartData.data[index as number];
    if (!data) return null;
    
    return (
        <g>
            <text 
                x={x} 
                y={y} 
                dx={8} 
                dy={4}
                fill={data.isBlocked ? 'hsl(0 84% 60%)' : 'currentColor'}
                className="text-xs"
                style={{ opacity: data.isBlocked ? 0.7 : 1 }}
            >
                {data.isBlocked ? 'Zablokowany' : `${(value as number).toFixed(0)}%`}
            </text>
        </g>
    );
}}
```

## Visual Indicators Summary

| Element | Active Address | Blocked Address |
|---------|---------------|-----------------|
| **Bar Color** | Green/Orange/Red (by occupancy %) | Red (`hsl(0 84% 60%)`) |
| **Bar Opacity** | 100% | 50% |
| **Address Label Color** | Default (currentColor) | Red |
| **Address Label Opacity** | 100% | 70% |
| **Bar Label Text** | Percentage (e.g., "75%") | "Zablokowany" |
| **Bar Label Color** | Default | Red |
| **Tooltip Border** | Default | Red border |
| **Tooltip Badge** | None | Red "Zablokowany" badge |
| **Tooltip Note** | None | "Ten adres jest nieaktywny" |
| **Position in Chart** | Sorted by occupancy | Sorted to bottom |
| **Included in KPI Totals** | ✅ Yes | ❌ No |

## Behavior

### When an Address is Blocked (`isActive = false`):

1. **Visibility**: Address remains visible in the chart
2. **Visual Distinction**:
   - Bar displayed in red color with 50% opacity
   - Address name in red with 70% opacity
   - Label shows "Zablokowany" instead of occupancy percentage
3. **Tooltip Enhancement**:
   - Red border around tooltip
   - "Zablokowany" badge next to address name
   - Italic note: "Ten adres jest nieaktywny"
4. **Positioning**: Sorted to the bottom of the chart
5. **Statistics**: Excluded from KPI totals (All Places, Occupied, Available)
6. **Monitoring**: Current occupants still visible in tooltip data

### When an Address is Unblocked:

1. Address immediately returns to normal display
2. Bar color reflects occupancy percentage
3. Full opacity restored
4. Percentage label replaces "Zablokowany" text
5. Included in KPI totals
6. Sorted by occupancy with other active addresses

## Benefits

1. **Monitoring**: Coordinators can still see blocked addresses and their current occupants
2. **Clarity**: Blocked status is immediately obvious through multiple visual cues
3. **Data Integrity**: Blocked addresses don't affect statistics but remain visible
4. **Accessibility**: Multiple indicators (color, text, opacity, position) ensure clarity
5. **Consistency**: Maintains the existing chart structure while adding blocked address support

## Testing Verification

To verify the implementation:

1. **Block an Address** in settings
2. **Navigate to Dashboard** and select the coordinator
3. **Verify the blocked address**:
   - Appears in the chart (at the bottom)
   - Displayed in red with reduced opacity
   - Shows "Zablokowany" label
   - Has red tooltip border with blocked badge
   - Excluded from KPI totals at top
4. **Unblock the address** and verify it returns to normal display

## Compatibility

- ✅ Works with existing address blocking system
- ✅ Compatible with room-level blocking
- ✅ Maintains backward compatibility
- ✅ No breaking changes to data structures
- ✅ Responsive design maintained

## Conclusion

The Coordinator Occupancy diagram now successfully displays blocked addresses with clear visual indicators while maintaining visibility for monitoring purposes. Blocked addresses are distinguished through red coloring, reduced opacity, "Zablokowany" labels, and special tooltip styling, while being excluded from capacity statistics and sorted to the bottom of the chart.
