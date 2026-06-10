# Vehicle Type Cascading Dropdown Implementation

## Overview
This document describes the implementation of a three-level cascading dropdown system for vehicle registration in the activity license issuance page.

## New Cascading Flow
The previous flow was:
- **نوع وسیله نقلیه (Vehicle Type)** - from LookupValue table
- **سیستم ناوگان (System)** - updated on selection, from Systemtype table
- **تیپ ناوگان (Tip)** - updated based on System

The new flow is:
1. **نوع وسیله نقلیه (Vehicle Type)** - User selects from VehicleType table (e.g., سواری، باری، مسافربری)
2. **سیستم ناوگان (System)** - Filtered by selected Vehicle Type from Systemtype table
3. **تیپ ناوگان (Tip)** - Filtered by selected System from Tiptype table

## Database Changes

### New Table: VehicleType
Created a new parent table to categorize vehicle types:

```sql
CREATE TABLE [dbo].[VehicleType](
    [ID] [int] IDENTITY(1,1) NOT NULL,
    [VehicleTypeName] [nvarchar](100) NOT NULL,
    [ID_User] [int] NULL,
    [CreatedAt] [datetime] NULL DEFAULT GETDATE(),
    [UpdatedAt] [datetime] NULL,
    CONSTRAINT [PK_VehicleType] PRIMARY KEY CLUSTERED ([ID] ASC)
)
```

### Modified Table: Systemtype
Added foreign key to VehicleType:

```sql
ALTER TABLE [dbo].[Systemtype]
ADD [VehicleTypeID] [int] NULL

ALTER TABLE [dbo].[Systemtype] WITH CHECK 
ADD CONSTRAINT [FK_Systemtype_VehicleType] FOREIGN KEY([VehicleTypeID])
REFERENCES [dbo].[VehicleType] ([ID])
ON DELETE CASCADE
```

### Migration File
Location: `server/migrations/create_vehicle_type_table.sql`

## Backend Implementation

### New Controller: vehicletypes.controller.js
Location: `server/src/controllers/vehicletypes.controller.js`

**Endpoints:**
- `GET /api/vehicletypes` - Get all vehicle types
- `GET /api/vehicletypes/:vehicleTypeId/systems` - Get systems by vehicle type
- `GET /api/vehicletypes/systems/all` - Get all systems (without filter)
- `GET /api/vehicletypes/systems/:systemId/tips` - Get tips by system
- `POST /api/vehicletypes` - Create vehicle type (Admin only)
- `PUT /api/vehicletypes/:id` - Update vehicle type (Admin only)
- `DELETE /api/vehicletypes/:id` - Delete vehicle type (Admin only)

**Key Functions:**
- `getAllVehicleTypes()` - Returns all vehicle types ordered by name
- `getSystemsByVehicleType(vehicleTypeId)` - Returns systems filtered by vehicle type
- `getTipsBySystem(systemId)` - Returns tips filtered by system
- `createVehicleType()` - Creates new vehicle type (admin)
- `updateVehicleType()` - Updates existing vehicle type (admin)
- `deleteVehicleType()` - Deletes vehicle type (admin)

### Routes Registration
- Created: `server/src/routes/modules/vehicletypes.js`
- Registered in: `server/src/routes/index.js` at `/api/vehicletypes`

## Frontend Implementation

### Updated File: IssueLicense.jsx
Location: `client/src/pages/IssueLicense.jsx`

**State Changes:**
- Added `vehicleTypes` state to store vehicle types from VehicleType table
- Modified `systems` state to be filtered by vehicle type
- Modified `systemTips` state to be filtered by system

**New Functions:**
- `loadVehicleTypes()` - Loads all vehicle types on component mount
- `loadSystemsByVehicleType(vehicleTypeId)` - Loads systems filtered by vehicle type
- `loadTips(systemId)` - Updated to use new endpoint for loading tips

**Dropdown Implementation:**
```javascript
// Vehicle Type Dropdown
<select 
  value={vehicle.vehicleKindId} 
  onChange={async (e) => {
    const vehicleTypeId = e.target.value
    setVehicle(v => ({ ...v, vehicleKindId: vehicleTypeId, systemId: '', systemTipId: '' }))
    await loadSystemsByVehicleType(vehicleTypeId)
    setSystemTips([])
  }}
>
  <option value="">انتخاب کنید...</option>
  {vehicleTypes.map(vt => (
    <option key={vt.ID} value={vt.ID}>{vt.VehicleTypeName}</option>
  ))}
</select>

// System Dropdown (disabled until Vehicle Type selected)
<select 
  value={vehicle.systemId} 
  onChange={async (e) => {
    const systemId = e.target.value
    setVehicle(v => ({ ...v, systemId, systemTipId: '' }))
    await loadTips(systemId)
  }}
  disabled={!vehicle.vehicleKindId}
>
  <option value="">
    {!vehicle.vehicleKindId ? 'ابتدا نوع وسیله نقلیه را انتخاب کنید...' : 'انتخاب کنید...'}
  </option>
  {systems.map(s => (
    <option key={s.ID} value={s.ID}>{s.systemname}</option>
  ))}
</select>

// Tip Dropdown (disabled until System selected)
<select 
  value={vehicle.systemTipId} 
  onChange={e => setVehicle(v => ({ ...v, systemTipId: e.target.value }))} 
  disabled={!vehicle.systemId}
>
  <option value="">
    {!vehicle.systemId ? 'ابتدا سیستم ناوگان را انتخاب کنید...' : 'انتخاب کنید...'}
  </option>
  {systemTips.map(t => (
    <option key={t.ID} value={t.ID}>{t.tipname}</option>
  ))}
</select>
```

**Edit Mode Support:**
Updated `loadRequestForEdit()` function to properly load cascading dropdowns when editing existing requests:
- Loads systems for the saved vehicle type
- Loads tips for the saved system
- Ensures all dropdowns display correct values

## Installation & Setup Instructions

### Step 1: Run Database Migration
Execute the migration script to create the VehicleType table and add foreign key to Systemtype:

```powershell
# Using sqlcmd
sqlcmd -S YOUR_SERVER -d parvaneh -i "server/migrations/create_vehicle_type_table.sql"

# Or using SQL Server Management Studio
# Open and execute: server/migrations/create_vehicle_type_table.sql
```

### Step 2: Populate VehicleType Table
The migration includes sample vehicle types:
- سواری (Passenger cars)
- باری (Cargo/Trucks)
- مسافربری (Passenger transport)
- کشاورزی (Agricultural)
- موتورسیکلت (Motorcycles)
- ویژه (Special)

You can add more types via the admin API or SQL:
```sql
INSERT INTO VehicleType (VehicleTypeName, ID_User)
VALUES (N'نوع جدید', NULL)
```

### Step 3: Update Systemtype Records
**IMPORTANT:** You must manually categorize your existing system types by assigning VehicleTypeID to each record:

```sql
-- Example: Assign truck systems to باری (Cargo) vehicle type
UPDATE Systemtype 
SET VehicleTypeID = 2  -- Assuming ID=2 is باری
WHERE systemname LIKE N'%کامیون%' OR systemname LIKE N'%وانت%'

-- Example: Assign passenger car systems to سواری
UPDATE Systemtype 
SET VehicleTypeID = 1  -- Assuming ID=1 is سواری
WHERE systemname LIKE N'%سواری%' OR systemname LIKE N'%خودرو%'

-- Example: Assign bus systems to مسافربری
UPDATE Systemtype 
SET VehicleTypeID = 3  -- Assuming ID=3 is مسافربری
WHERE systemname LIKE N'%اتوبوس%' OR systemname LIKE N'%مینی%بوس%'
```

**You need to review all your Systemtype records and assign appropriate VehicleTypeID values.**

### Step 4: Verify Frontend Connection
The frontend automatically loads vehicle types on page load. Verify:
1. Navigate to: https://ftml.tabriz.ir/licenses/activity/issue
2. Go to the vehicle registration step (مرحله سوم)
3. Check that the نوع وسیله نقلیه dropdown shows vehicle types
4. Select a vehicle type and verify سیستم ناوگان dropdown populates
5. Select a system and verify تیپ ناوگان dropdown populates

## API Testing

### Get All Vehicle Types
```bash
GET /api/vehicletypes
Authorization: Bearer {token}

Response:
[
  { "ID": 1, "VehicleTypeName": "سواری", "CreatedAt": "2025-11-15T...", "UpdatedAt": null },
  { "ID": 2, "VehicleTypeName": "باری", "CreatedAt": "2025-11-15T...", "UpdatedAt": null }
]
```

### Get Systems by Vehicle Type
```bash
GET /api/vehicletypes/2/systems
Authorization: Bearer {token}

Response:
[
  { "ID": 15, "systemname": "کامیون کوچک", "VehicleTypeID": 2 },
  { "ID": 16, "systemname": "کامیون بزرگ", "VehicleTypeID": 2 }
]
```

### Get Tips by System
```bash
GET /api/vehicletypes/systems/15/tips
Authorization: Bearer {token}

Response:
[
  { "ID": 45, "tipname": "تک کابین", "SystemtypeID": 15 },
  { "ID": 46, "tipname": "دو کابین", "SystemtypeID": 15 }
]
```

## Troubleshooting

### Issue: Systems dropdown is empty after selecting vehicle type
**Solution:** Ensure Systemtype records have VehicleTypeID assigned. Check:
```sql
SELECT * FROM Systemtype WHERE VehicleTypeID IS NULL
```

### Issue: Edit mode doesn't show correct dropdown values
**Solution:** The `loadRequestForEdit()` function now properly loads cascading dropdowns. Check browser console for any API errors.

### Issue: Database constraint violation when deleting vehicle type
**Solution:** The foreign key uses CASCADE delete, so deleting a vehicle type will also delete all associated systems and tips. This is intentional to maintain referential integrity.

## Future Enhancements

1. **Admin UI for Vehicle Type Management**
   - Create an admin page to manage vehicle types (CRUD operations)
   - Location: `/admin/vehicle-types`

2. **Bulk Update Tool**
   - Create a tool to help categorize existing Systemtype records
   - Visual interface to assign vehicle types to systems

3. **Import/Export**
   - Export current categorization
   - Import categorization from Excel/CSV

## Files Modified/Created

### Created Files:
1. `server/migrations/create_vehicle_type_table.sql`
2. `server/src/controllers/vehicletypes.controller.js`
3. `server/src/routes/modules/vehicletypes.js`
4. `docs/VEHICLE_TYPE_CASCADING_DROPDOWN_IMPLEMENTATION.md`

### Modified Files:
1. `server/src/routes/index.js` - Added vehicle types routes
2. `client/src/pages/IssueLicense.jsx` - Updated cascading dropdown logic

## Notes
- The vehicle state field `vehicleKindId` is reused to store the VehicleType ID (not from lookup anymore)
- All existing vehicle records in the database will still work, but will need VehicleTypeID assigned to show in filtered dropdowns
- The old LookupValue-based VehicleType is no longer used for this dropdown

## Support
For questions or issues, contact the development team.

Last Updated: 2025-11-15
