# License Print Logging Feature

## Overview
This feature tracks all license printing events in the database, allowing administrators to view statistics and generate reports about which licenses have been printed, when, and by whom.

## Database Schema

### LicensePrintLog Table
A new table `LicensePrintLog` has been created to store print event information:

```sql
CREATE TABLE [dbo].[LicensePrintLog](
    [PrintLogId] [bigint] IDENTITY(1,1) NOT NULL PRIMARY KEY,
    [RequestID] [bigint] NOT NULL,
    [TrackingNo] [nvarchar](30) NOT NULL,
    [LicenseType] [nvarchar](50) NOT NULL,
    [PrintedByUserId] [int] NULL,
    [PrintedByUsername] [nvarchar](100) NULL,
    [PrintedAt] [datetime2](7) NOT NULL DEFAULT GETDATE(),
    [IpAddress] [nvarchar](50) NULL,
    [UserAgent] [nvarchar](500) NULL,
    [Notes] [nvarchar](max) NULL
)
```

**Fields:**
- `PrintLogId`: Unique identifier for each print event
- `RequestID`: Foreign key to VehicleRequests table
- `TrackingNo`: Tracking number of the request
- `LicenseType`: Type of license ('Activity', 'Exploitation', 'Employment', 'LegalEntity')
- `PrintedByUserId`: User ID who printed the license (nullable)
- `PrintedByUsername`: Username who printed the license
- `PrintedAt`: Timestamp when the license was printed
- `IpAddress`: IP address of the user who printed
- `UserAgent`: Browser user agent string
- `Notes`: Additional notes (for future use)

**Indexes:**
- Primary key on `PrintLogId`
- Index on `RequestID` for fast lookups
- Index on `PrintedAt` for date-based queries
- Index on `LicenseType` for statistics

## Backend Implementation

### API Endpoints

#### 1. Log Print Event
**POST** `/api/printlog/log`

Logs a license print event to the database.

**Request Body:**
```json
{
  "requestId": 123,
  "trackingNo": "100-1234567890",
  "licenseType": "Activity"
}
```

**Response:**
```json
{
  "message": "Print event logged successfully",
  "printLogId": 456
}
```

#### 2. Get Print Logs by Request
**GET** `/api/printlog/request/:requestId`

Retrieves all print logs for a specific request.

**Response:**
```json
{
  "logs": [
    {
      "PrintLogId": 1,
      "RequestID": 123,
      "TrackingNo": "100-1234567890",
      "LicenseType": "Activity",
      "PrintedByUsername": "admin",
      "PrintedAt": "2025-11-11T08:30:00",
      "IpAddress": "192.168.1.1"
    }
  ],
  "totalPrints": 1
}
```

#### 3. Check if Printed
**GET** `/api/printlog/check/:requestId`

Checks if a request has been printed before.

**Response:**
```json
{
  "isPrinted": true,
  "printCount": 2,
  "lastPrintedAt": "2025-11-11T08:30:00",
  "lastPrintedBy": "admin"
}
```

#### 4. Get All Print Logs (with filters)
**GET** `/api/printlog/all`

Retrieves all print logs with optional filters and pagination.

**Query Parameters:**
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 50)
- `licenseType`: Filter by license type
- `startDate`: Filter by start date
- `endDate`: Filter by end date
- `trackingNo`: Search by tracking number
- `userId`: Filter by user ID

**Response:**
```json
{
  "logs": [...],
  "pagination": {
    "page": 1,
    "limit": 50,
    "totalCount": 150,
    "totalPages": 3
  }
}
```

#### 5. Get Print Statistics
**GET** `/api/printlog/statistics`

Retrieves comprehensive print statistics.

**Query Parameters:**
- `startDate`: Start date for statistics (optional)
- `endDate`: End date for statistics (optional)

**Response:**
```json
{
  "totalPrints": 500,
  "printsByLicenseType": [
    { "LicenseType": "Activity", "PrintCount": 300 },
    { "LicenseType": "Exploitation", "PrintCount": 150 },
    { "LicenseType": "Employment", "PrintCount": 50 }
  ],
  "printsByUser": [
    { "PrintedByUsername": "admin", "PrintCount": 200 },
    { "PrintedByUsername": "user1", "PrintCount": 150 }
  ],
  "printsByDate": [...],
  "multiPrintRequests": [
    { "RequestID": 123, "TrackingNo": "100-1234567890", "PrintCount": 3 }
  ]
}
```

### Controller: printlog.controller.js
Located at: `server/src/controllers/printlog.controller.js`

Contains all the logic for logging and retrieving print events.

### Routes: printlog.js
Located at: `server/src/routes/printlog.js`

Defines all API routes for print logging functionality.

## Frontend Implementation

### Utility Function: printLogger.js
Located at: `client/src/utils/printLogger.js`

Provides helper functions for logging print events:

```javascript
import { logLicensePrint } from '../utils/printLogger.js'

// Log a print event
await logLicensePrint(requestId, trackingNo, 'Activity')

// Check if printed
const status = await checkIfPrinted(requestId)

// Get print logs
const logs = await getPrintLogs(requestId)
```

### Updated Print Pages
All print pages have been updated to automatically log print events:

1. **PrintLicense.jsx** - Activity licenses (حقیقی)
2. **PrintLegalEntityLicense.jsx** - Activity licenses (حقوقی)
3. **PrintExploitationLicense.jsx** - Exploitation licenses
4. **PrintEmploymentLicense.jsx** - Employment licenses

Each page now:
- Imports the `logLicensePrint` utility
- Calls the logging function before opening the print dialog
- Passes the correct license type for tracking

### Admin Print Statistics Page
**Route:** `/admin/print-statistics`
**Component:** `AdminPrintStatistics.jsx`

Features:
- **Statistics Cards**: Display total prints and breakdown by license type
- **Top Users**: Shows users with the most prints
- **Filters**: Filter by license type, date range, and tracking number
- **Print Logs Table**: Detailed list of all print events with pagination
- **Multiple Prints Warning**: Highlights requests that have been printed multiple times

## Installation Steps

### 1. Run Database Migrations

Execute the following SQL scripts in order:

```sql
-- Create LicensePrintLog table
server/migrations/create_license_print_log_table.sql

-- Add admin_print_statistics page permission
server/migrations/add_print_statistics_page.sql
```

### 2. Restart Backend Server

The backend routes are automatically registered. Just restart the server:

```bash
cd server
npm run dev
```

### 3. Access Admin Panel

Navigate to: `/admin/print-statistics`

Only users with Admin role can access this page.

## Usage

### For Users
When printing a license, the system automatically logs:
- Who printed it
- When it was printed
- What type of license
- IP address and browser information

No additional action is required from users.

### For Administrators

1. **View Statistics**: Go to `/admin/print-statistics`
2. **Filter Data**: Use the filter options to narrow down results
3. **Export Data**: (Future feature) Export statistics to Excel/PDF
4. **Monitor Multiple Prints**: Check which requests have been printed multiple times

## Benefits

1. **Audit Trail**: Complete history of all license prints
2. **Statistics**: Understand printing patterns and usage
3. **Fraud Prevention**: Detect unusual printing activity
4. **Compliance**: Meet regulatory requirements for record-keeping
5. **Resource Planning**: Analyze printing trends for better resource allocation

## Security Considerations

- All print log endpoints require authentication
- Only authenticated users can log print events
- Admin role required to view statistics and logs
- IP addresses and user agents are logged for security auditing

## Future Enhancements

1. Export statistics to Excel/PDF
2. Email notifications for multiple prints
3. Print approval workflow for sensitive licenses
4. Integration with physical printer logs
5. Dashboard widgets for real-time statistics
6. Scheduled reports sent to administrators

## Troubleshooting

### Print events not being logged
- Check if the database migration was run successfully
- Verify that the backend routes are registered in `routes/index.js`
- Check browser console for any API errors
- Ensure user is authenticated

### Statistics page not accessible
- Verify the page permission was added to the database
- Check if the user has Admin role
- Clear browser cache and reload

### Missing data in logs
- Ensure all print pages have been updated with the logging code
- Check if the `logLicensePrint` function is being called before `window.print()`
- Verify network requests in browser developer tools

## Database Queries for Manual Analysis

### Get total prints by license type
```sql
SELECT LicenseType, COUNT(*) as PrintCount
FROM LicensePrintLog
GROUP BY LicenseType
ORDER BY PrintCount DESC
```

### Get requests printed multiple times
```sql
SELECT RequestID, TrackingNo, COUNT(*) as PrintCount
FROM LicensePrintLog
GROUP BY RequestID, TrackingNo
HAVING COUNT(*) > 1
ORDER BY PrintCount DESC
```

### Get prints by date
```sql
SELECT CAST(PrintedAt AS DATE) as PrintDate, COUNT(*) as PrintCount
FROM LicensePrintLog
WHERE PrintedAt >= DATEADD(day, -30, GETDATE())
GROUP BY CAST(PrintedAt AS DATE)
ORDER BY PrintDate DESC
```

### Get user printing activity
```sql
SELECT 
    PrintedByUsername,
    COUNT(*) as TotalPrints,
    MIN(PrintedAt) as FirstPrint,
    MAX(PrintedAt) as LastPrint
FROM LicensePrintLog
GROUP BY PrintedByUsername
ORDER BY TotalPrints DESC
```

## Support

For issues or questions, contact the development team or refer to the main project documentation.
