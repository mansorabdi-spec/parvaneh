# Employment License Number Calculation - Updated

## Overview
The employment license tracking number calculation has been updated to match the activity license logic, providing more detailed information in the license number itself.

## Format: `2XYY-NNNNN`

### Components

| Position | Component | Description | Example |
|----------|-----------|-------------|---------|
| **2** | Fixed Digit | Always `2` for employment licenses | `2` |
| **X** | Vehicle Type | Based on vehicle capacity (1-4) | `2` |
| **YY** | Activity Category | Code from LookupValue table | `01` |
| **NNNNN** | Sequential | Unique sequential number per prefix | `30488` |

### Example: `2201-30488`
- `2` = Employment license
- `2` = Vehicle type 2 (500-3500kg capacity)
- `01` = Activity category code 01
- `30488` = Sequential number 30488

---

## Vehicle Type Calculation (X)

The vehicle type is determined by the vehicle's capacity in kilograms:

| Capacity Range (kg) | Vehicle Type (X) | Description |
|---------------------|------------------|-------------|
| 0 - 499 kg | `1` | Very light vehicles |
| 500 - 3,500 kg | `2` | Light vehicles |
| 3,501 - 6,000 kg | `3` | Medium vehicles |
| 6,001 - 100,000 kg | `4` | Heavy vehicles |
| Out of range | `4` | Default to heavy |

**Note:** Capacity is stored in tons in the database but converted to kg for calculation:
```javascript
const capacityKg = capacityTon * 1000
```

---

## Activity Category Code (YY)

The activity category code comes from the `LookupValue` table:
- Linked via `Vehicles.ActivityCategoryId`
- Uses the `Code` field from `LookupValue`
- Always padded to 2 digits (e.g., `1` becomes `01`)
- Defaults to `00` if not set

---

## Sequential Number (NNNNN)

- Managed by the `SequenceCounters` table
- **Single shared counter** for all employment licenses (using 'DEFAULT' prefix)
- Prevents duplicate numbers even if records are deleted
- Always padded to 5 digits
- Globally unique across all vehicle types and activities

**Example sequences:**
- `2101-00001`, `2201-00002`, `2202-00003` (Different types/activities, same sequence)
- `2101-00004`, `2301-00005`, `2402-00006` (Sequential numbering continues)

**Note:** Unlike activity licenses, employment licenses use a single sequential counter, not separate counters per prefix combination.

---

## Comparison: Activity vs Employment Licenses

| Aspect | Activity License | Employment License |
|--------|-----------------|-------------------|
| **Prefix** | `3` | `2` |
| **Format** | `3XYY-NNNNN` | `2XYY-NNNNN` |
| **X Logic** | Vehicle capacity (1-4) | **Same** - Vehicle capacity (1-4) |
| **YY Logic** | Activity category code | **Same** - Activity category code |
| **Sequential** | Per prefix (separate counters) | **Global** (single shared counter) |

---

## Implementation Details

### Location
```
File: server/src/controllers/issue.controller.js
Function: createEmploymentRequest()
Lines: 1674-1743
```

### Key Steps

1. **Validate VehicleId**
   ```javascript
   if (!vehicleId) {
     return res.status(400).json({ message: 'Missing vehicleId for employment license' });
   }
   ```

2. **Fetch Vehicle Data**
   ```sql
   SELECT 
     v.Capacity,
     v.ActivityCategoryId,
     lv.Code AS ActivityCategoryCode
   FROM Vehicles v
   LEFT JOIN LookupValue lv ON lv.Id = v.ActivityCategoryId
   WHERE v.VehicleID = @VehicleID
   ```

3. **Calculate Vehicle Type**
   ```javascript
   const capacityKg = capacityTon * 1000
   let vehicleType = '4' // default
   if (capacityKg <= 499) vehicleType = '1'
   else if (capacityKg <= 3500) vehicleType = '2'
   else if (capacityKg <= 6000) vehicleType = '3'
   ```

4. **Build Prefix**
   ```javascript
   const paddedActivityCode = activityCode.toString().padStart(2, '0')
   const prefix = `2${vehicleType}${paddedActivityCode}`
   ```

5. **Get Sequential Number**
   ```javascript
   // Use 'DEFAULT' for a single shared counter across all employment licenses
   const sequentialNumber = await getNextSequence(pool, 'Employment', 'DEFAULT')
   ```

6. **Generate Tracking Number**
   ```javascript
   const trackingNo = `${prefix}-${sequentialNumber.toString().padStart(5, '0')}`
   ```

---

## Benefits of the New System

### 1. **Detailed Information Encoding**
The license number now contains meaningful information:
- Vehicle size/capacity category
- Activity type
- Unique identifier

### 2. **Consistency Across License Types**
Both activity and employment licenses use the same logic, differing only in the first digit.

### 3. **Better Organization**
The prefix encoding (2XYY) makes it easier to:
- Identify vehicle type at a glance
- Track licenses by activity category
- Generate statistics by vehicle/activity combination
- Maintain chronological order through shared sequential numbering

### 4. **Scalability**
The system can handle:
- 4 vehicle types
- 99 activity categories (00-99)
- 99,999 total employment licenses (shared sequential counter)

**Total capacity:** 99,999 unique employment licenses

**Note:** The sequential number is shared across all combinations, so the limit is 99,999 total licenses, not per combination. The prefix (2XYY) provides categorization without affecting the sequential capacity.

---

## Migration Notes

### Old Format (Before)
```
Format: 2000-NNNNN
Example: 2000-30488
- Fixed prefix: 2000
- No vehicle/activity information
- Single sequential counter
```

### New Format (After)
```
Format: 2XYY-NNNNN
Example: 2201-30488
- Dynamic prefix: 2XYY
- Vehicle type: X (capacity-based)
- Activity category: YY (from lookup)
- Global sequential counter (shared across all employment licenses)
```

### Existing Licenses
- Old licenses with format `2000-XXXXX` remain valid
- New licenses will use the enhanced format
- The system supports both formats

---

## Testing

To test the new employment license number generation:

1. Create an employment license request with a vehicle
2. Check the vehicle's capacity in the `Vehicles` table
3. Verify the activity category code in `LookupValue`
4. Confirm the generated tracking number matches the format `2XYY-NNNNN`
5. Check console logs for detailed generation information

**Console output example:**
```
📊 Generated employment tracking number: 2201-00015 (Capacity: 1500kg, Type: 2, Activity: 01, Seq: 15)
```

---

## Database Dependencies

### Tables Used
- **Vehicles**: Source of capacity and activity category
- **LookupValue**: Source of activity category codes
- **SequenceCounters**: Manages sequential numbers per prefix
- **VehicleRequests**: Stores the generated tracking number

### Required Fields
- `Vehicles.Capacity` (decimal) - Vehicle capacity in tons
- `Vehicles.ActivityCategoryId` (int) - FK to LookupValue
- `LookupValue.Code` (nvarchar) - Activity category code
- `SequenceCounters.Prefix` (nvarchar) - Tracking number prefix

---

## Updated: November 29, 2025
