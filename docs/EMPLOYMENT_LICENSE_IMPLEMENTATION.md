# Employment License (پروانه اشتغال) Implementation Summary

## Overview
This document tracks the implementation of the Employment License module, which is separate from but shares common entities (Persons, Vehicles) with the Activity License module.

## Completed Work

### 1. Database Schema ✅
**File**: `server/database/migrations/create_employment_requests.sql`

Created four new tables:
- **EmploymentRequests**: Main table for employment license requests
  - Similar structure to VehicleRequests but separate
  - Fields: RequestID, PersonID, VehicleID (optional), TrackingNo, Status, DiscountStatus, etc.
  - Links to Persons and Vehicles tables
  
- **EmploymentRequestWorkflowSteps**: Tracks approval workflow steps
  - Different workflow from Activity License
  - Fields: StepID, RequestID, StepOrder, RoleName, Status, ApprovedByUserId, Notes
  
- **EmploymentRequestProcessHistory**: Audit trail for all actions
  - Fields: HistoryID, RequestID, UserId, Action, Notes, CreatedAt
  
- **EmploymentDiscountDocuments**: Discount documents specific to employment licenses
  - Fields: DocID, RequestID, PersonID, DocTypeId, FilePath, FileName

**Status**: SQL migration file created, needs to be executed on database

### 2. Backend API ✅
**Files Created**:
- `server/src/controllers/persons.controller.js`
- `server/src/routes/modules/persons.js`

**Endpoints Implemented**:
- `GET /api/persons/by-national-code/:nationalCode` - Check if person exists by national code
- `POST /api/persons/upsert` - Create or update person information

**Features**:
- Search person by 10-digit national code
- Returns person info, residences, and contacts if found
- Allows creating new person or updating existing
- Integrated with authentication middleware

**Status**: Backend routes registered in `server/src/routes/index.js`

### 3. Frontend Page ✅
**File**: `client/src/pages/IssueEmploymentLicense.jsx`

**Features Implemented**:
- 4-step wizard interface:
  1. **ثبت مشخصات** (Register Information)
  2. **بارگذاری مستندات** (Upload Documents)
  3. **پیوست تخفیفات** (Attach Discounts)
  4. **تکمیل عملیات** (Complete Operation)

**Step 1 - Register Information**:
- National code input with "Check Existing Info" button
- Searches Persons table by national code
- Auto-fills form if person found
- Allows manual entry if person not found
- Includes:
  - Personal information (name, father name, birth date, gender, etc.)
  - Vehicle plate entry (4-part Iranian plate format)
  - Residence information (with add/remove capability)
  - Contact information (with add/remove capability)
  - Other information (blood group, education, military status, etc.)

**Steps 2-4**: Placeholder structure ready for implementation

**Styling**: Complete CSS included with wizard steps, form grids, and responsive design

**Status**: Frontend page created, needs to be registered in App.jsx routes

## Pending Work

### 1. Frontend Integration ⏳
- [ ] Add route to `client/src/App.jsx` for `/licenses/employment/issue`
- [ ] Import IssueEmploymentLicense component
- [ ] Add Employment License menu to navigation with 3 submenus:
  - صدور (Issue) → /licenses/employment/issue
  - تمدید (Renew) → /licenses/employment/renew
  - ابطال (Revoke) → /licenses/employment/revoke

### 2. Complete Step 1 Implementation ⏳
- [ ] Finish residence form fields (currently placeholder)
- [ ] Finish contact form fields (currently placeholder)
- [ ] Add validation for all required fields
- [ ] Implement city loading when province is selected
- [ ] Add "Other Information" section (blood group, education, etc.)

### 3. Step 2 - Upload Documents ⏳
- [ ] Reuse document upload logic from IssueLicense.jsx
- [ ] Integrate with /api/uploads endpoint
- [ ] Display uploaded documents list
- [ ] Allow document deletion

### 4. Step 3 - Attach Discounts ⏳
- [ ] Reuse discount document logic from IssueLicense.jsx
- [ ] Upload to EmploymentDiscountDocuments table
- [ ] Link documents to person (not vehicle)

### 5. Step 4 - Complete Operation ⏳
- [ ] Display summary of all entered information
- [ ] Implement final submission logic
- [ ] Create EmploymentRequest record
- [ ] Initialize workflow steps
- [ ] Generate tracking number
- [ ] Redirect to success page or inbox

### 6. Backend Controllers ⏳
- [ ] Create `employment.controller.js` for employment license operations
- [ ] Implement tracking number generation (similar to activity license)
- [ ] Implement request submission endpoint
- [ ] Implement workflow initialization
- [ ] Add routes for employment license operations

### 7. Additional Pages ⏳
- [ ] Create `RenewEmploymentLicense.jsx` for renewal (تمدید)
- [ ] Create `RevokeEmploymentLicense.jsx` for revocation (ابطال)
- [ ] Create employment license print page
- [ ] Create employment license detail view

### 8. Database Execution ⏳
- [ ] Run migration script to create tables
- [ ] Add sample data for testing
- [ ] Verify foreign key constraints

### 9. Testing ⏳
- [ ] Test person lookup by national code
- [ ] Test new person creation
- [ ] Test existing person update
- [ ] Test complete wizard flow
- [ ] Test validation
- [ ] Test file uploads

## Next Steps

1. **Execute Database Migration**: Run the SQL script to create the new tables
2. **Register Frontend Route**: Add the IssueEmploymentLicense page to App.jsx
3. **Add Menu Items**: Update navigation to include Employment License menu
4. **Complete Step 1**: Finish all form fields in the register information step
5. **Test Basic Flow**: Test national code lookup and form population

## Notes

- Employment License shares Persons and Vehicles tables with Activity License
- Employment License has its own request table (EmploymentRequests) separate from VehicleRequests
- Workflow steps will be different from Activity License
- Tracking number generation will follow similar pattern to Activity License
- Document upload and discount logic can be reused from Activity License with minor modifications

## File Structure

```
server/
├── database/migrations/
│   └── create_employment_requests.sql (NEW)
├── src/
│   ├── controllers/
│   │   └── persons.controller.js (NEW)
│   └── routes/modules/
│       └── persons.js (NEW)

client/
└── src/pages/
    └── IssueEmploymentLicense.jsx (NEW)
```

## API Endpoints

### Persons
- `GET /api/persons/by-national-code/:nationalCode` - Get person by national code
- `POST /api/persons/upsert` - Create or update person

### Employment License (To be implemented)
- `POST /api/employment/create-request` - Create employment license request
- `GET /api/employment/requests` - List employment requests
- `GET /api/employment/request/:id` - Get employment request details
- `POST /api/employment/submit-documents` - Upload documents
- `POST /api/employment/submit-discount-docs` - Upload discount documents
- `POST /api/employment/finalize` - Finalize and submit request
