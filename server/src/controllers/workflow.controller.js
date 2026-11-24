import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Joi from 'joi';
import { getPool, sql } from '../lib/db.js';
import { ensureOnlinePaymentChannel } from '../lib/ensureOnlinePaymentChannel.js';
import { logLicenseHistory, calculateExpiryDate } from '../utils/licenseHistoryLogger.js';
import { logLicenseRenewal } from '../utils/licenseRenewalLogger.js';
import { getCurrentShamsiDate, addOneYearShamsi, shamsiToGregorian, gregorianToShamsi } from '../utils/shamsiDateUtils.js';

// Public endpoint to verify license by tracking number (no authentication required)
export async function verifyLicenseByTracking(req, res, next) {
  try {
    const { trackingNo } = req.params;
    
    console.log(`🔍 Public verify request for tracking: ${trackingNo}`);
    
    if (!trackingNo) {
      return res.status(400).json({ message: 'Tracking number is required' });
    }
    
    const pool = await getPool();
    
    // Get request details
    const requestResult = await pool.request()
      .input('TrackingNo', sql.NVarChar(30), trackingNo)
      .query(`
        SELECT 
          vr.RequestID,
          vr.TrackingNo,
          vr.Status,
          vr.LicenseTypeId,
          vr.OperationTypeId,
          vr.CreatedAt,
          vr.NationalCode,
          vr.VehicleID,
          lt.Name AS LicenseTypeName,
          ot.Name AS OperationTypeName
        FROM VehicleRequests vr
        LEFT JOIN LookupValue lt ON vr.LicenseTypeId = lt.Id
        LEFT JOIN LookupValue ot ON vr.OperationTypeId = ot.Id
        WHERE vr.TrackingNo = @TrackingNo
      `);
    
    if (requestResult.recordset.length === 0) {
      console.log(`❌ License not found for tracking: ${trackingNo}`);
      return res.status(404).json({ message: 'License not found' });
    }
    
    const request = requestResult.recordset[0];
    console.log(`✅ Request found: ${request.RequestID}`);
    
    // Get person details
    const personResult = await pool.request()
      .input('NationalCode', sql.NVarChar(10), request.NationalCode)
      .query(`
        SELECT 
          p.NationalCode,
          p.FirstName,
          p.LastName,
          p.FatherName,
          p.BirthDateJalali,
          p.IdSerial,
          city.Name AS BirthCityName
        FROM Persons p
        LEFT JOIN LookupValue city ON p.BirthCityId = city.Id
        WHERE p.NationalCode = @NationalCode
      `);
    
    const person = personResult.recordset[0] || null;
    console.log(`✅ Person found: ${person?.FirstName} ${person?.LastName}`);
    
    // Get vehicle details if exists (only if VehicleID is not null)
    let vehicle = null;
    if (request.VehicleID) {
      const vehicleResult = await pool.request()
        .input('VehicleID', sql.BigInt, request.VehicleID)
        .query(`
          SELECT 
            VehicleID,
            PlateSerial2,
            PlateThreeDigits,
            PlateLetter,
            PlateRegion2,
            ChassisNo,
            YearManufacture,
            Capacity
          FROM Vehicles
          WHERE VehicleID = @VehicleID
        `);
      
      vehicle = vehicleResult.recordset[0] || null;
      console.log(`✅ Vehicle found: ${vehicle?.ChassisNo || 'N/A'}`);
    } else {
      console.log(`ℹ️ No vehicle associated with this request (exploitation license)`);
    }
    
    // Get company details if exists (for exploitation licenses)
    const companyResult = await pool.request()
      .input('NationalCode', sql.NVarChar(10), request.NationalCode)
      .query(`
        SELECT 
          ci.NationalId,
          ci.CompanyName,
          ci.RegistrationNo,
          ci.RegistrationDate,
          af.Name AS ActivityFieldName,
          tr.Name AS TonnageRateName,
          regCity.name AS RegistrationCityName
        FROM CompanyInfo ci
        LEFT JOIN LookupValue af ON ci.ActivityFieldId = af.Id
        LEFT JOIN LookupValue tr ON ci.TonnageRateId = tr.Id
        LEFT JOIN Cities regCity ON ci.RegistrationCityId = regCity.ID
        WHERE ci.NationalCode = @NationalCode
      `);
    
    const company = companyResult.recordset[0] || null;
    console.log(`✅ Company found: ${company?.CompanyName || 'N/A'}`);
    
    // Return public-safe data
    const response = {
      request: {
        requestId: request.RequestID,
        trackingNo: request.TrackingNo,
        status: request.Status,
        licenseTypeName: request.LicenseTypeName,
        operationTypeName: request.OperationTypeName,
        createdAt: request.CreatedAt
      },
      person,
      vehicle,
      company
    };
    
    console.log(`✅ Returning verification data for ${trackingNo}`);
    res.json(response);
  } catch (e) {
    console.error(`❌ Error in verifyLicenseByTracking:`, e);
    next(e);
  }
}

// Get user's inbox (کارتابل) - all requests assigned to them based on CURRENT ACTIVE ROLE
export async function getMyInbox(req, res, next) {
  try {
    const userId = req.user.id;
    const currentRole = req.user.role; // Use only the current active role from JWT
    
    console.log(`📥 Loading inbox for user ${userId} with current role: ${currentRole}`);
    
    const pool = await getPool();
    
    // Check if workflow tables exist
    const tableCheck = await pool.request()
      .query(`
        SELECT COUNT(*) AS TableCount 
        FROM INFORMATION_SCHEMA.TABLES 
        WHERE TABLE_NAME IN ('RequestWorkflowSteps', 'VehicleRequests')
      `);
    
    if (tableCheck.recordset[0].TableCount < 2) {
      // Tables don't exist yet - return empty inbox
      console.log('⚠️ Workflow tables not found, returning empty inbox');
      return res.json([]);
    }
    
    // Get all pending workflow steps assigned to current role + user's own submitted requests
    const request = pool.request();
    request.input('UserId', sql.Int, userId);
    request.input('CurrentRole', sql.NVarChar(50), currentRole);
    
    // Split into two separate queries for better performance
    
    // Query 1: Workflow tasks assigned to current role
    // Show each request only at its current pending step (minimum StepOrder among Pending steps)
    // Using subquery instead of CTE and WITHOUT NOLOCK hints to avoid SQL Server syntax issues
    const workflowQuery = `
      SELECT
        rws.Id AS WorkflowStepId,
        rws.RequestID,
        rws.StepOrder,
        rws.RoleName,
        rws.[Status] AS StepStatus,
        rws.Notes AS StepNotes,
        rws.CreatedAt AS AssignedAt,
        vr.TrackingNo,
        vr.[Status] AS RequestStatus,
        vr.CreatedAt AS RequestCreatedAt,
        vr.SubmittedByUserId,
        vr.HasDeficiency,
        vr.DeficiencySenderStepOrder,
        vr.LicenseTypeId,
        lt.Name AS LicenseTypeName,
        vr.OperationTypeId,
        ot.Name AS OperationTypeName,
        v.VIN,
        v.ChassisNo,
        v.PlateSerial2,
        v.PlateThreeDigits,
        v.PlateLetter,
        v.PlateRegion2,
        COALESCE(p.FirstName, '') AS FirstName,
        COALESCE(p.LastName, ci.CompanyName, '') AS LastName,
        COALESCE(vr.CompanyNationalId, vr.NationalCode, v.RegistrarNationalCode) AS NationalCode,
        lh.ExpiryDate,
        'workflow' AS SourceType,
        CASE 
          WHEN EXISTS (
            SELECT 1 FROM OnlinePayment op
            WHERE op.RequestID = vr.RequestID AND op.PayedBit = 1
          ) THEN 1
          WHEN EXISTS (
            SELECT 1 FROM OfflinePayment ofp
            WHERE ofp.RequestID = vr.RequestID
          ) THEN 1
          ELSE 0
        END AS HasSuccessfulPayment
      FROM RequestWorkflowSteps rws
      INNER JOIN VehicleRequests vr ON rws.RequestID = vr.RequestID
      INNER JOIN (
        SELECT
          RequestID,
          MIN(StepOrder) AS MinPendingStep
        FROM RequestWorkflowSteps
        WHERE [Status] = 'Pending'
        GROUP BY RequestID
      ) ps ON rws.RequestID = ps.RequestID AND rws.StepOrder = ps.MinPendingStep
      LEFT JOIN Vehicles v ON vr.VehicleID = v.VehicleID
      LEFT JOIN Persons p ON vr.NationalCode = p.NationalCode
      LEFT JOIN CompanyInfo ci ON vr.CompanyNationalId = ci.NationalId
      LEFT JOIN LookupValue lt ON vr.LicenseTypeId = lt.Id
      LEFT JOIN LookupValue ot ON vr.OperationTypeId = ot.Id
      LEFT JOIN (
        SELECT lh1.*
        FROM LicenseHistory lh1
        INNER JOIN (
          SELECT TrackingNo, MAX(CreatedAt) AS MaxCreatedAt
          FROM LicenseHistory
          WHERE [Status] = 'Active'
          GROUP BY TrackingNo
        ) lh2 ON lh1.TrackingNo = lh2.TrackingNo AND lh1.CreatedAt = lh2.MaxCreatedAt
      ) lh ON vr.TrackingNo = lh.TrackingNo
      WHERE rws.[Status] = 'Pending'
        AND LTRIM(RTRIM(rws.RoleName)) = LTRIM(RTRIM(@CurrentRole))
        AND (rws.AssignedUserId IS NULL OR rws.AssignedUserId = @UserId)
        AND NOT (vr.HasDeficiency = 1 AND vr.DeficiencySenderStepOrder = rws.StepOrder)
      ORDER BY vr.CreatedAt DESC
    `;
    
    const workflowRequest = pool.request();
    workflowRequest.input('UserId', sql.Int, userId);
    workflowRequest.input('CurrentRole', sql.NVarChar(50), currentRole);
    
    // Set a shorter timeout for this request
    workflowRequest.timeout = 10000; // 10 seconds
    
    let workflowTasks = [];
    try {
      const workflowResult = await workflowRequest.query(workflowQuery);
      workflowTasks = workflowResult.recordset || [];
      console.log(`✅ Workflow query returned ${workflowTasks.length} results for role: ${currentRole}`);
    } catch (err) {
      console.error('⚠️ Workflow query error:', err.message);
      // Continue without workflow tasks if error occurs
    }
    
    // Query 2: User's own submitted requests (increased limit to show all user requests)
    // Using subquery instead of CTE to avoid SQL Server syntax issues
    const myRequestsQuery = `
      SELECT 
        NULL AS WorkflowStepId,
        vr.RequestID,
        vr.CurrentStepOrder AS StepOrder,
        NULL AS RoleName,
        NULL AS StepStatus,
        NULL AS StepNotes,
        vr.CreatedAt AS AssignedAt,
        vr.TrackingNo,
        vr.[Status] AS RequestStatus,
        vr.CreatedAt AS RequestCreatedAt,
        vr.SubmittedByUserId,
        vr.HasDeficiency,
        vr.DeficiencySenderStepOrder,
        vr.LicenseTypeId,
        lt.Name AS LicenseTypeName,
        vr.OperationTypeId,
        ot.Name AS OperationTypeName,
        v.VIN,
        v.ChassisNo,
        v.PlateSerial2,
        v.PlateThreeDigits,
        v.PlateLetter,
        v.PlateRegion2,
        COALESCE(p.FirstName, '') AS FirstName,
        COALESCE(p.LastName, ci.CompanyName, '') AS LastName,
        COALESCE(vr.CompanyNationalId, vr.NationalCode, v.RegistrarNationalCode) AS NationalCode,
        lh.ExpiryDate,
        'my_request' AS SourceType,
        CASE 
          WHEN EXISTS (
            SELECT 1 FROM OnlinePayment op WITH (NOLOCK) 
            WHERE op.RequestID = vr.RequestID AND op.PayedBit = 1
          ) THEN 1
          WHEN EXISTS (
            SELECT 1 FROM OfflinePayment ofp WITH (NOLOCK) 
            WHERE ofp.RequestID = vr.RequestID
          ) THEN 1
          ELSE 0
        END AS HasSuccessfulPayment
      FROM VehicleRequests vr WITH (NOLOCK)
      LEFT JOIN Vehicles v WITH (NOLOCK) ON vr.VehicleID = v.VehicleID
      LEFT JOIN Persons p WITH (NOLOCK) ON vr.NationalCode = p.NationalCode
      LEFT JOIN CompanyInfo ci WITH (NOLOCK) ON vr.CompanyNationalId = ci.NationalId
      LEFT JOIN LookupValue lt WITH (NOLOCK) ON vr.LicenseTypeId = lt.Id
      LEFT JOIN LookupValue ot WITH (NOLOCK) ON vr.OperationTypeId = ot.Id
      LEFT JOIN (
        SELECT lh1.*,
          ROW_NUMBER() OVER (PARTITION BY lh1.TrackingNo ORDER BY lh1.CreatedAt DESC, lh1.HistoryID DESC) AS rn
        FROM LicenseHistory lh1 WITH (NOLOCK)
        WHERE lh1.[Status] = 'Active'
      ) lh ON vr.TrackingNo = lh.TrackingNo AND lh.rn = 1
      WHERE vr.SubmittedByUserId = @UserId
      ORDER BY vr.CreatedAt DESC
    `;
    
    const myRequestsRequest = pool.request();
    myRequestsRequest.input('UserId', sql.Int, userId);
    myRequestsRequest.timeout = 10000; // 10 seconds
    
    let myRequests = [];
    try {
      const myRequestsResult = await myRequestsRequest.query(myRequestsQuery);
      myRequests = myRequestsResult.recordset || [];
    } catch (err) {
      console.error('⚠️ My requests query timeout, skipping user requests:', err.message);
      // Continue without user requests if timeout occurs
    }
    
    // Combine results and remove duplicates
    const allTasks = [...workflowTasks, ...myRequests];
    const uniqueTasks = allTasks.filter((task, index, self) =>
      index === self.findIndex((t) => t.RequestID === task.RequestID)
    );
    
    // Sort by creation date descending
    uniqueTasks.sort((a, b) => new Date(b.RequestCreatedAt) - new Date(a.RequestCreatedAt));
    
    res.json(uniqueTasks);
  } catch (e) {
    next(e);
  }
}

// Get request detail with role-based filtering
export async function getRequestDetail(req, res, next) {
  try {
    const requestId = Number(req.params.requestId);
    const userId = req.user.id;
    const userRole = req.user.role;
    const userRoles = [userRole, ...(req.user.roles || [])];
    
    if (!requestId) return res.status(400).json({ message: 'Missing requestId' });
    
    const pool = await getPool();
    
    // Check if workflow tables exist
    const tableCheck = await pool.request()
      .query(`
        SELECT COUNT(*) AS TableCount 
        FROM INFORMATION_SCHEMA.TABLES 
        WHERE TABLE_NAME IN ('RequestWorkflowSteps', 'RolePermissions', 'VehicleRequests')
      `);
    
    if (tableCheck.recordset[0].TableCount < 3) {
      return res.status(503).json({ 
        message: 'Workflow system not initialized. Please run the workflow.sql migration script.' 
      });
    }
    
    // Get user permissions for their roles
    const permRequest = pool.request();
    const roleParams = userRoles.map((r, i) => `@role${i}`).join(',');
    userRoles.forEach((r, i) => permRequest.input(`role${i}`, sql.NVarChar(50), r));
    
    const permResult = await permRequest.query(`
      SELECT DISTINCT PermissionKey, MAX(CAST(CanView AS INT)) AS CanView, MAX(CAST(CanEdit AS INT)) AS CanEdit
      FROM RolePermissions
      WHERE RoleName IN (${roleParams})
      GROUP BY PermissionKey
    `);
    
    const permissions = {};
    permResult.recordset.forEach(p => {
      permissions[p.PermissionKey] = { canView: !!p.CanView, canEdit: !!p.CanEdit };
    });
    
    // Get request basic info with license type and operation type names
    const reqResult = await pool.request()
      .input('RequestID', sql.BigInt, requestId)
      .query(`
        SELECT 
          vr.*, 
          v.RegistrarNationalCode,
          lt.Name AS LicenseTypeName,
          ot.Name AS OperationTypeName,
          (
            SELECT TOP 1 lh.IssueDate
            FROM LicenseHistory lh
            WHERE lh.TrackingNo = vr.TrackingNo
              AND NULLIF(LTRIM(RTRIM(lh.IssueDate)), N'') IS NOT NULL
              AND (
                lh.EventType = N'Issued'
                OR (
                  lh.OperationTypeName = N'صدور'
                  AND ISNULL(lh.EventType, N'') NOT IN (N'Renewed', N'Revoked', N'Cancelled')
                )
              )
            ORDER BY
              TRY_CAST(PARSENAME(REPLACE(lh.IssueDate, '/', '.'), 3) AS INT) ASC,
              TRY_CAST(PARSENAME(REPLACE(lh.IssueDate, '/', '.'), 2) AS INT) ASC,
              TRY_CAST(PARSENAME(REPLACE(lh.IssueDate, '/', '.'), 1) AS INT) ASC,
              lh.CreatedAt ASC,
              lh.HistoryID ASC
          ) AS FirstIssueDate,
          (
            SELECT TOP 1 COALESCE(orig.CompletedAt, orig.CreatedAt)
            FROM VehicleRequests orig
            INNER JOIN LookupValue otOrig ON orig.OperationTypeId = otOrig.Id
            WHERE orig.TrackingNo = vr.TrackingNo
              AND otOrig.Name = N'صدور'
            ORDER BY orig.CreatedAt ASC, orig.RequestID ASC
          ) AS FirstIssueAt,
          (
            SELECT TOP 1 lrh.RenewalDate
            FROM LicenseRenewalHistory lrh
            WHERE lrh.TrackingNo = vr.TrackingNo
              AND NULLIF(LTRIM(RTRIM(lrh.RenewalDate)), N'') IS NOT NULL
            ORDER BY
              TRY_CAST(PARSENAME(REPLACE(lrh.RenewalDate, '/', '.'), 3) AS INT) DESC,
              TRY_CAST(PARSENAME(REPLACE(lrh.RenewalDate, '/', '.'), 2) AS INT) DESC,
              TRY_CAST(PARSENAME(REPLACE(lrh.RenewalDate, '/', '.'), 1) AS INT) DESC,
              lrh.CreatedAt DESC,
              lrh.Id DESC
          ) AS RenewalDate,
          (
            SELECT TOP 1 lh.IssueDate
            FROM LicenseHistory lh
            WHERE lh.TrackingNo = vr.TrackingNo
              AND NULLIF(LTRIM(RTRIM(lh.IssueDate)), N'') IS NOT NULL
              AND (
                lh.EventType = N'Renewed'
                OR lh.OperationTypeName LIKE N'%تمدید%'
              )
            ORDER BY
              TRY_CAST(PARSENAME(REPLACE(lh.IssueDate, '/', '.'), 3) AS INT) DESC,
              TRY_CAST(PARSENAME(REPLACE(lh.IssueDate, '/', '.'), 2) AS INT) DESC,
              TRY_CAST(PARSENAME(REPLACE(lh.IssueDate, '/', '.'), 1) AS INT) DESC,
              lh.CreatedAt DESC,
              lh.HistoryID DESC
          ) AS HistoryRenewalDate,
          (
            SELECT COUNT(*)
            FROM LicenseRenewalHistory lrh
            WHERE lrh.RequestID = vr.RequestID
          ) AS RenewalRecordCount
        FROM VehicleRequests vr
        LEFT JOIN Vehicles v ON vr.VehicleID = v.VehicleID
        LEFT JOIN LookupValue lt ON vr.LicenseTypeId = lt.Id
        LEFT JOIN LookupValue ot ON vr.OperationTypeId = ot.Id
        WHERE vr.RequestID = @RequestID
      `);
    
    console.log(`🔍 Request ${requestId} query result:`, reqResult.recordset[0]);
    
    const request = reqResult.recordset[0];
    if (!request) return res.status(404).json({ message: 'Request not found' });
    
    // Get vehicleId from request
    let vehicleId = request.VehicleID;
    
    // For employment licenses (LicenseTypeId = 67), use request.NationalCode (applicant)
    // For activity licenses, use RegistrarNationalCode (vehicle owner) if available
    // This ensures employment licenses show the applicant's info, not the vehicle owner's info
    const isEmploymentLicense = request.LicenseTypeId === 67;
    const nationalCode = isEmploymentLicense 
      ? request.NationalCode 
      : (request.RegistrarNationalCode || request.NationalCode);
    
    // Check if user is the owner of this request (by userId or by national code)
    const userNationalCodeResult = await pool.request()
      .input('UserId', sql.Int, userId)
      .query('SELECT NationalCode FROM Users WHERE Id = @UserId');
    const userNationalCode = userNationalCodeResult.recordset[0]?.NationalCode;
    
    const isOwner = request.SubmittedByUserId === userId || 
                    (userNationalCode && nationalCode && userNationalCode === nationalCode);
    
    // Check if user has permission to view this request
    // User can view if: they are the owner OR they have any view permission OR request is approved
    const hasAnyViewPermission = permissions['view_person_info']?.canView ||
                                  permissions['view_vehicle_info']?.canView ||
                                  permissions['view_payments']?.canView ||
                                  permissions['view_discounts']?.canView ||
                                  permissions['admin_workflow_requests']?.canView;
    
    const isApprovedForPrint = request.Status?.toLowerCase() === 'approved';
    
    if (!isOwner && !hasAnyViewPermission && !isApprovedForPrint) {
      return res.status(403).json({ 
        message: 'دسترسی به این عملیات ندارید',
        error: 'Access denied: You do not have permission to view this request'
      });
    }
    
    // Handle VehicleID if it's an array (take first element)
    if (Array.isArray(vehicleId)) {
      vehicleId = vehicleId[0];
    }
    
    // Convert to number if it's a string
    const actualVehicleId = typeof vehicleId === 'string' ? parseInt(vehicleId, 10) : vehicleId;
    
    // For employment licenses, VehicleID may be NULL (they don't have a specific vehicle)
    // Only validate if VehicleID is provided
    if (vehicleId !== null && vehicleId !== undefined && (!actualVehicleId || isNaN(actualVehicleId))) {
      console.error('ERROR - Invalid VehicleID:', { 
        original: request.VehicleID, 
        vehicleId, 
        actualVehicleId, 
        type: typeof actualVehicleId 
      });
      return res.status(400).json({ 
        message: 'Invalid vehicle ID in request. The request may be corrupted.',
        requestId
      });
    }
    
    // Company that supervised registration when the request was submitted by a broker (کارگزار)
    let supervisorCompanyName = null;
    if (request.SubmittedByUserId) {
      const supervisorResult = await pool.request()
        .input('SubmittedByUserId', sql.Int, request.SubmittedByUserId)
        .input('BrokerRole', sql.NVarChar(50), 'کارگزار (بهره بردار)')
        .query(`
          SELECT TOP 1 ci.CompanyName
          FROM Users u
          INNER JOIN CompanyInfo ci
            ON LTRIM(RTRIM(ci.ManagerNationalCode)) = LTRIM(RTRIM(u.NationalCode))
          WHERE u.Id = @SubmittedByUserId
            AND (
              u.Role = @BrokerRole
              OR EXISTS (
                SELECT 1
                FROM UserRoles ur
                INNER JOIN Roles r ON r.Id = ur.RoleId
                WHERE ur.UserId = u.Id AND r.Name = @BrokerRole
              )
            )
            AND ci.CompanyName IS NOT NULL
            AND LTRIM(RTRIM(ci.CompanyName)) <> N''
          ORDER BY ci.CreatedAt DESC
        `);
      supervisorCompanyName = supervisorResult.recordset[0]?.CompanyName || null;
    }

    // Build response based on permissions
    const response = {
      request: {
        requestId: request.RequestID,
        vehicleId: request.VehicleID || null,
        trackingNo: request.TrackingNo,
        status: request.Status || 'Pending', // Default to Pending if column doesn't exist
        currentStepOrder: request.CurrentStepOrder || null,
        finalDescription: request.FinalDescription || null,
        createdAt: request.CreatedAt,
        completedAt: request.CompletedAt || null,
        submittedByUserId: request.SubmittedByUserId || null,
        // License and operation type
        licenseTypeId: request.LicenseTypeId || null,
        licenseTypeName: request.LicenseTypeName || null,
        operationTypeId: request.OperationTypeId || null,
        operationTypeName: request.OperationTypeName || null,
        // National codes (person or company)
        nationalCode: request.NationalCode || null,
        companyNationalId: request.CompanyNationalId || null,
        // Payment and discount info
        originalAmount: request.OriginalAmount || null,
        discountAmount: request.DiscountAmount || null,
        finalAmount: request.FinalAmount || null,
        discountStatus: request.DiscountStatus || null,
        discountApprovedBy: request.DiscountApprovedBy || null,
        discountApprovedAt: request.DiscountApprovedAt || null,
        discountNotes: request.DiscountNotes || null,
        // Deficiency info
        hasDeficiency: request.HasDeficiency || false,
        deficiencySenderStepOrder: request.DeficiencySenderStepOrder || null,
        deficiencySenderUserId: request.DeficiencySenderUserId || null,
        // Tonnage (for exploitation licenses)
        tonnageFromTon: request.TonnageFromTon || null,
        tonnageToTon: request.TonnageToTon || null,
        hasCancellationAttachment: fs.existsSync(path.join(cancellationUploadDir(), `${request.RequestID}.bin`)),
        // First issuance of this license, not the date of the request being printed.
        // A tracking number can be renewed for many years.
        issueDate: request.FirstIssueDate
          || (request.FirstIssueAt ? gregorianToShamsi(new Date(request.FirstIssueAt)) : null),
        // Latest renewal across every renewal of this tracking number.
        renewalDate: request.RenewalDate
          || request.HistoryRenewalDate
          || (
            request.OperationTypeName && String(request.OperationTypeName).includes('تمدید') && request.CompletedAt
              ? gregorianToShamsi(new Date(request.CompletedAt))
              : null
          ),
        // Company name printed as "تحت نظارت ..." when the registrar is a broker
        supervisorCompanyName
      },
      permissions,
      person: null,
      personDocuments: [],
      vehicle: null,
      vehicleDocuments: [],
      discounts: [],
      discountDocuments: [],
      payments: [],
      residences: [],
      contacts: [],
      company: null,
      companyAddresses: [],
      companyContacts: [],
      companyDocuments: [],
      manager: null
    };
    
    // Check if request is approved - if so, always show person and vehicle data for printing
    const isApproved = request.Status?.toLowerCase() === 'approved';
    
    // Person info - show if user has permission, is owner, or request is approved
    if ((permissions['view_person_info']?.canView || isOwner || isApproved) && nationalCode) {
      const personResult = await pool.request()
        .input('NationalCode', sql.NVarChar(20), nationalCode)
        .query(`
          SELECT 
            p.*,
            prov.Name AS BirthProvinceName,
            city.Name AS BirthCityName,
            poi.DrivingLicenseNo,
            poi.DrivingLicenseIssueDate,
            poi.DrivingLicenseExpiryDate,
            poi.CertificateType,
            poi.HealthCardNo,
            poi.InsuranceType
          FROM Persons p
          LEFT JOIN Provinces prov ON p.BirthProvinceId = prov.Id
          LEFT JOIN Cities city ON p.BirthCityId = city.Id AND city.ProvinceId = p.BirthProvinceId
          LEFT JOIN PersonOtherInfo poi ON p.NationalCode = poi.NationalCode
          WHERE p.NationalCode = @NationalCode
        `);
      response.person = personResult.recordset[0] || null;
      
      // Residences
      const residencesResult = await pool.request()
        .input('NationalCode', sql.NVarChar(20), nationalCode)
        .query(`
          SELECT 
            pr.*, 
            p.Name AS ProvinceName,
            c.Name AS CityName
          FROM PersonResidences pr
          LEFT JOIN Provinces p ON pr.ProvinceId = p.Id
          LEFT JOIN Cities c ON pr.CityId = c.Id
          WHERE pr.NationalCode = @NationalCode
        `);
      response.residences = residencesResult.recordset || [];
      
      // Contacts
      const contactsResult = await pool.request()
        .input('NationalCode', sql.NVarChar(20), nationalCode)
        .query('SELECT * FROM PersonContacts WHERE NationalCode = @NationalCode');
      response.contacts = contactsResult.recordset || [];
      
      // PersonOtherInfo - for employment licenses (additional person info)
      const personOtherInfoResult = await pool.request()
        .input('NationalCode', sql.NVarChar(20), nationalCode)
        .query('SELECT * FROM PersonOtherInfo WHERE NationalCode = @NationalCode');
      response.personOtherInfo = personOtherInfoResult.recordset[0] || null;
    }
    
    // Person documents
    if ((permissions['view_person_documents']?.canView || isOwner || isApproved) && nationalCode) {
      const docsResult = await pool.request()
        .input('NationalCode', sql.NVarChar(20), nationalCode)
        .query(`
          SELECT pd.DocID, pd.NationalCode, pd.LookupDocTypeId, lv.Name AS DocTypeName,
                 pd.MimeType, pd.SizeBytes, pd.CreatedAt
          FROM PersonDocuments pd
          LEFT JOIN LookupValue lv ON lv.Id = pd.LookupDocTypeId
          WHERE pd.NationalCode = @NationalCode
        `);
      response.personDocuments = docsResult.recordset || [];
    }
    
    // Vehicle info - only load if VehicleID exists (not for employment licenses)
    if ((permissions['view_vehicle_info']?.canView || isOwner || isApproved) && actualVehicleId) {
      const vehicleResult = await pool.request()
        .input('VehicleID', sql.BigInt, actualVehicleId)
        .query(`
          SELECT 
            v.*,
            ISNULL(vt.VehicleTypeName, '') AS VehicleKindName,
            ISNULL(st.systemname, '') AS SystemName,
            ISNULL(tt.tipname, '') AS TipName,
            ISNULL(ft.Name, '') AS FuelTypeName,
            ISNULL(ic.Name, '') AS InsuranceCompanyName,
            ISNULL(ac.Name, '') AS ActivityCategoryName,
            ISNULL(pt.Name, '') AS PlateTypeName,
            ISNULL(trt.Name, '') AS TrackerTypeName
          FROM Vehicles v
          LEFT JOIN VehicleType vt ON v.VehicleKindId = vt.ID
          LEFT JOIN Systemtype st ON v.SystemId = st.ID
          LEFT JOIN Tiptype tt ON v.SystemTipId = tt.ID
          LEFT JOIN LookupValue ft ON v.FuelTypeId = ft.Id
          LEFT JOIN LookupValue ic ON v.InsuranceCompanyId = ic.Id
          LEFT JOIN LookupValue ac ON v.ActivityCategoryId = ac.Id
          LEFT JOIN LookupValue pt ON v.PlateTypeId = pt.Id
          LEFT JOIN LookupValue trt ON v.TrackerTypeId = trt.Id
          WHERE v.VehicleID = @VehicleID
        `);
      response.vehicle = vehicleResult.recordset[0] || null;
      
      // Log vehicle data for debugging
      if (response.vehicle) {
        console.log('🚗 Vehicle data:', {
          VehicleID: response.vehicle.VehicleID,
          VehicleKindId: response.vehicle.VehicleKindId,
          VehicleKindName: response.vehicle.VehicleKindName,
          SystemId: response.vehicle.SystemId,
          SystemName: response.vehicle.SystemName,
          SystemTipId: response.vehicle.SystemTipId,
          TipName: response.vehicle.TipName,
          RegistrarNationalCode: response.vehicle.RegistrarNationalCode
        });
      }
    }
    
    // Company info - for legal entity licenses or exploitation licenses
    // Load AFTER vehicle data so we can use RegistrarNationalCode if needed
    // Both exploitation licenses AND legal entity activity licenses use request.CompanyNationalId
    // CompanyNationalId contains the company's NationalId (شناسه ملی - 11 digits)
    // NationalCode is only used for individual licenses (points to Persons table)
    let companySearchCode = request.CompanyNationalId || request.NationalCode;
    
    // Fallback: If CompanyNationalId is null but vehicle exists, try to find company by vehicle's RegistrarNationalCode
    if (!companySearchCode && response.vehicle?.RegistrarNationalCode) {
      console.log('🏢 CompanyNationalId is null, trying to find company by vehicle RegistrarNationalCode:', response.vehicle.RegistrarNationalCode);
      companySearchCode = response.vehicle.RegistrarNationalCode;
    }
    
    console.log('🏢 Company search:', { 
      requestId, 
      CompanyNationalId: request.CompanyNationalId,
      requestNationalCode: request.NationalCode,
      vehicleRegistrarNationalCode: response.vehicle?.RegistrarNationalCode,
      loggedInUserNationalCode: nationalCode, 
      companySearchCode: companySearchCode,
      hasPermission: permissions['view_person_info']?.canView,
      isOwner,
      isApproved
    });
    
    if ((permissions['view_person_info']?.canView || isOwner || isApproved) && companySearchCode) {
      // Try to find company by NationalId first, then by NationalCode (owner's national code)
      const companyResult = await pool.request()
        .input('SearchCode', sql.NVarChar(100), companySearchCode)
        .query(`
          SELECT 
            ci.*,
            ct.Name AS CompanyTypeName,
            af.Name AS ActivityFieldName,
            tr.Name AS TonnageRateName,
            regCity.name AS RegistrationCityName,
            regCity.ProvinceId AS RegistrationProvinceId
          FROM CompanyInfo ci
          LEFT JOIN LookupValue ct ON ci.CompanyTypeId = ct.Id
          LEFT JOIN LookupValue af ON ci.ActivityFieldId = af.Id
          LEFT JOIN LookupValue tr ON ci.TonnageRateId = tr.Id
          LEFT JOIN Cities regCity ON ci.RegistrationCityId = regCity.ID
          WHERE LTRIM(RTRIM(ci.NationalId)) = LTRIM(RTRIM(@SearchCode))
             OR LTRIM(RTRIM(ci.NationalCode)) = LTRIM(RTRIM(@SearchCode))
        `);
      console.log('🏢 Company query result:', { 
        recordCount: companyResult.recordset.length,
        records: companyResult.recordset.map(r => ({ NationalId: r.NationalId, CompanyName: r.CompanyName, NationalCode: r.NationalCode }))
      });
      response.company = companyResult.recordset[0] || null;
      console.log('🏢 Company result:', { found: !!response.company, companyName: response.company?.CompanyName });
      
      // Use company's NationalId for related tables if company was found
      if (response.company?.NationalId) {
        const companyNationalId = response.company.NationalId;
        
        // Company Addresses
        const companyAddressesResult = await pool.request()
          .input('NationalId', sql.NVarChar(100), companyNationalId)
          .query(`
            SELECT 
              ca.*,
              p.Name AS ProvinceName,
              c.Name AS CityName
            FROM CompanyAddresses ca
            LEFT JOIN Provinces p ON ca.ProvinceId = p.Id
            LEFT JOIN Cities c ON ca.CityId = c.Id
            WHERE ca.NationalId = @NationalId
          `);
        response.companyAddresses = companyAddressesResult.recordset || [];
        
        // Company Contacts
        const companyContactsResult = await pool.request()
          .input('NationalId', sql.NVarChar(100), companyNationalId)
          .query('SELECT * FROM CompanyContacts WHERE NationalId = @NationalId');
        response.companyContacts = companyContactsResult.recordset || [];
        
        // Company Documents
        const companyDocsResult = await pool.request()
          .input('NationalId', sql.NVarChar(100), companyNationalId)
          .query(`
            SELECT cd.DocID, cd.NationalId, cd.LookupDocTypeId, lv.Name AS DocTypeName,
                   cd.MimeType, cd.SizeBytes, cd.CreatedAt
            FROM CompanyDocuments cd
            LEFT JOIN LookupValue lv ON lv.Id = cd.LookupDocTypeId
            WHERE cd.NationalId = @NationalId
          `);
        response.companyDocuments = companyDocsResult.recordset || [];
        
        // Company Representative - get from CompanyRepresentatives table (with error handling)
        try {
          const companyRepResult = await pool.request()
            .input('NationalId', sql.NVarChar(100), companyNationalId)
            .query(`
              SELECT 
                Id,
                NationalId,
                RepresentativeNationalCode,
                BirthDate,
                PowerOfAttorneyNo,
                CreatedAt,
                UpdatedAt
              FROM CompanyRepresentatives
              WHERE NationalId = @NationalId
            `);
          response.companyRepresentative = companyRepResult.recordset[0] || null;
          console.log('👥 Company representative loaded:', response.companyRepresentative ? 'Found' : 'Not found');
        } catch (repErr) {
          console.warn('⚠️ Could not load company representative (table might not exist):', repErr.message);
          response.companyRepresentative = null;
        }
      }
      
      // Manager/Representative info - prioritize CompanyRepresentatives table
      // First try to get representative info from CompanyRepresentatives table
      if (response.company?.ManagerNationalCode) {
        console.log('👥 Loading manager from CompanyInfo.ManagerNationalCode:', response.company.ManagerNationalCode);
        
        const managerResult = await pool.request()
          .input('NationalCode', sql.NVarChar(20), response.company.ManagerNationalCode)
          .query(`
            SELECT 
              p.*,
              prov.Name AS BirthProvinceName,
              city.Name AS BirthCityName
            FROM Persons p
            LEFT JOIN Provinces prov ON p.BirthProvinceId = prov.Id
            LEFT JOIN Cities city ON p.BirthCityId = city.Id AND city.ProvinceId = p.BirthProvinceId
            WHERE p.NationalCode = @NationalCode
          `);
        
        response.manager = managerResult.recordset[0] || null;
        
        if (response.manager) {
          console.log('✅ Manager loaded from ManagerNationalCode:', {
            name: `${response.manager.FirstName} ${response.manager.LastName}`,
            nationalCode: response.manager.NationalCode
          });
        } else {
          console.warn('⚠️ ManagerNationalCode found but person not in Persons table');
        }
      }

      // Fallback: If manager not found, try CompanyRepresentatives
      if (!response.manager && response.companyRepresentative?.RepresentativeNationalCode) {
        console.log('👥 Fallback: Loading representative from CompanyRepresentatives table:', response.companyRepresentative.RepresentativeNationalCode);
        
        const repPersonResult = await pool.request()
          .input('NationalCode', sql.NVarChar(20), response.companyRepresentative.RepresentativeNationalCode)
          .query(`
            SELECT 
              p.*,
              prov.Name AS BirthProvinceName,
              city.Name AS BirthCityName
            FROM Persons p
            LEFT JOIN Provinces prov ON p.BirthProvinceId = prov.Id
            LEFT JOIN Cities city ON p.BirthCityId = city.Id AND city.ProvinceId = p.BirthProvinceId
            WHERE p.NationalCode = @NationalCode
          `);
        
        if (repPersonResult.recordset[0]) {
          response.manager = {
            ...repPersonResult.recordset[0],
            RepresentativeBirthDate: response.companyRepresentative.BirthDate,
            PowerOfAttorneyNo: response.companyRepresentative.PowerOfAttorneyNo
          };
          console.log('✅ Manager loaded from representative:', {
            name: `${response.manager.FirstName} ${response.manager.LastName}`,
            nationalCode: response.manager.NationalCode,
            idSerial: response.manager.IdSerial,
            birthDate: response.manager.RepresentativeBirthDate
          });
        } else {
          console.warn('⚠️ Representative national code found but person not in Persons table');
        }
      }
      
      // Log if no manager data found at all
      if (!response.manager) {
        console.warn('⚠️ No manager/representative data found for company:', response.company?.CompanyName);
      }
    }
    
    // Vehicle documents - only load if VehicleID exists
    if ((permissions['view_vehicle_documents']?.canView || isOwner || isApproved) && actualVehicleId) {
      const vDocsResult = await pool.request()
        .input('VehicleID', sql.BigInt, actualVehicleId)
        .query(`
          SELECT vd.DocID, vd.VehicleID, vd.LookupDocTypeId, lv.Name AS DocTypeName,
                 vd.MimeType, vd.SizeBytes, vd.CreatedAt
          FROM VehicleDocuments vd
          LEFT JOIN LookupValue lv ON lv.Id = vd.LookupDocTypeId
          WHERE vd.VehicleID = @VehicleID
        `);
      response.vehicleDocuments = vDocsResult.recordset || [];
    }
    
    // Discount documents
    if (permissions['view_discount_documents']?.canView || isOwner || isApproved) {
      const discDocsResult = await pool.request()
        .input('VehicleID', sql.BigInt, actualVehicleId)
        .query(`
          SELECT vdd.DocID, vdd.VehicleID, vdd.LookupDocTypeId, lv.Name AS DocTypeName,
                 vdd.Description, vdd.MimeType, vdd.SizeBytes, vdd.CreatedAt
          FROM VehicleDiscountDocuments vdd
          LEFT JOIN LookupValue lv ON lv.Id = vdd.LookupDocTypeId
          WHERE vdd.VehicleID = @VehicleID
        `);
      response.discountDocuments = discDocsResult.recordset || [];
    }
    
    // Payments - get both online and offline payments for this request
    if (permissions['view_payments']?.canView || isOwner || isApproved) {
      // Online payments
      await ensureOnlinePaymentChannel(pool);
      const onlinePaymentsResult = await pool.request()
        .input('RequestID', sql.BigInt, requestId)
        .query(`
          SELECT 
            Id, VehicleID, TrackingNo, Amount, UserId, PayedBit, 
            Description, Status, GatewayRef, GatewayAuthority, 
            CreatedAt, PaidAt, RequestID, PaymentChannel, ViaKiosk,
            'Online' AS PaymentType
          FROM OnlinePayment
          WHERE RequestID = @RequestID
          ORDER BY CreatedAt DESC
        `);
      
      // Offline payments
      const offlinePaymentsResult = await pool.request()
        .input('RequestID', sql.BigInt, requestId)
        .query(`
          SELECT 
            Id, VehicleID, TrackingNo, Amount, PayDate, ReceiptNo, 
            Description, BankName, BranchName, AttachmentFileName, 
            AttachmentContentType, UserId, RequestID, CreatedAt,
            'Offline' AS PaymentType
          FROM OfflinePayment
          WHERE RequestID = @RequestID
          ORDER BY CreatedAt DESC
        `);
      
      response.payments = {
        online: onlinePaymentsResult.recordset || [],
        offline: offlinePaymentsResult.recordset || []
      };
    }
    
    // Get discount documents with their percentages from LookupValue
    const discountDocsResult = await pool.request()
      .input('VehicleID', sql.BigInt, vehicleId)
      .query(`
        SELECT 
          d.DocID,
          d.VehicleID,
          d.LookupDocTypeId,
          lv.Name AS DocTypeName,
          lv.DiscountPercentage,
          d.Description,
          d.CreatedAt
        FROM VehicleDiscountDocuments d
        LEFT JOIN LookupValue lv ON lv.Id = d.LookupDocTypeId
        WHERE d.VehicleID = @VehicleID
        ORDER BY d.DocID DESC
      `);
    
    response.discountDocuments = discountDocsResult.recordset || [];
    response.discountInfo = {
      status: request.DiscountStatus,
      originalAmount: request.OriginalAmount,
      discountAmount: request.DiscountAmount,
      finalAmount: request.FinalAmount,
      approvedBy: request.DiscountApprovedBy,
      approvedAt: request.DiscountApprovedAt,
      notes: request.DiscountNotes,
      hasDiscountDocs: (discountDocsResult.recordset || []).length > 0
    };
    
    res.json(response);
  } catch (e) {
    next(e);
  }
}

// Get workflow steps for a request
export async function getRequestWorkflowSteps(req, res, next) {
  try {
    const requestId = Number(req.params.requestId);
    if (!requestId) return res.status(400).json({ message: 'Missing requestId' });
    
    const pool = await getPool();
    
    // Check if workflow tables exist
    const tableCheck = await pool.request()
      .query(`
        SELECT COUNT(*) AS TableCount 
        FROM INFORMATION_SCHEMA.TABLES 
        WHERE TABLE_NAME = 'RequestWorkflowSteps'
      `);
    
    if (tableCheck.recordset[0].TableCount === 0) {
      return res.json([]);
    }
    
    const result = await pool.request()
      .input('RequestID', sql.BigInt, requestId)
      .query(`
        SELECT 
          rws.*,
          u.FullName AS DecidedByUserName,
          au.FullName AS AssignedUserName
        FROM RequestWorkflowSteps rws
        LEFT JOIN Users u ON rws.DecidedByUserId = u.Id
        LEFT JOIN Users au ON rws.AssignedUserId = au.Id
        WHERE rws.RequestID = @RequestID
        ORDER BY rws.StepOrder
      `);
    
    res.json(result.recordset || []);
  } catch (e) {
    next(e);
  }
}

// Get process history for a request
export async function getRequestHistory(req, res, next) {
  try {
    const requestId = Number(req.params.requestId);
    if (!requestId) return res.status(400).json({ message: 'Missing requestId' });
    
    const pool = await getPool();
    
    // Check if workflow tables exist
    const tableCheck = await pool.request()
      .query(`
        SELECT COUNT(*) AS TableCount 
        FROM INFORMATION_SCHEMA.TABLES 
        WHERE TABLE_NAME = 'RequestProcessHistory'
      `);
    
    if (tableCheck.recordset[0].TableCount === 0) {
      return res.json([]);
    }
    
    const result = await pool.request()
      .input('RequestID', sql.BigInt, requestId)
      .query(`
        SELECT 
          rph.*,
          u.FullName AS ActionByUserFullName
        FROM RequestProcessHistory rph
        LEFT JOIN Users u ON rph.ActionByUserId = u.Id
        WHERE rph.RequestID = @RequestID
        ORDER BY rph.CreatedAt DESC
      `);
    
    res.json(result.recordset || []);
  } catch (e) {
    next(e);
  }
}

// Approve or reject a workflow step
const decisionSchema = Joi.object({
  decision: Joi.string().valid('Approved', 'Rejected').required(),
  notes: Joi.string().allow('', null).max(2000)
});

export async function makeDecision(req, res, next) {
  try {
    const workflowStepId = Number(req.params.stepId);
    const { error, value } = decisionSchema.validate(req.body);
    
    if (error) return res.status(400).json({ message: error.message });
    if (!workflowStepId) return res.status(400).json({ message: 'Missing stepId' });
    
    const userId = req.user.id;
    const userName = req.user.username;
    const userRole = req.user.role;
    const userRoles = [userRole, ...(req.user.roles || [])];
    
    const pool = await getPool();
    const tx = new sql.Transaction(pool);
    await tx.begin();
    
    try {
      // Get workflow step
      const stepResult = await new sql.Request(tx)
        .input('Id', sql.BigInt, workflowStepId)
        .query('SELECT * FROM RequestWorkflowSteps WHERE Id = @Id');
      
      const step = stepResult.recordset[0];
      if (!step) {
        await tx.rollback();
        return res.status(404).json({ message: 'Workflow step not found' });
      }
      
      // Check if user has permission (role matches)
      if (!userRoles.includes(step.RoleName)) {
        await tx.rollback();
        return res.status(403).json({ message: 'You do not have permission for this step' });
      }
      
      // Check if already decided
      if (step.Status !== 'Pending') {
        await tx.rollback();
        return res.status(400).json({ message: 'This step has already been decided' });
      }
      
      // Check if previous steps are completed
      const prevResult = await new sql.Request(tx)
        .input('RequestID', sql.BigInt, step.RequestID)
        .input('StepOrder', sql.Int, step.StepOrder)
        .query(`
          SELECT 1 FROM RequestWorkflowSteps
          WHERE RequestID = @RequestID 
            AND StepOrder < @StepOrder 
            AND Status IN ('Pending', 'Rejected')
        `);
      
      if (prevResult.recordset.length > 0) {
        await tx.rollback();
        return res.status(400).json({ message: 'Previous steps must be completed first' });
      }
      
      // Update workflow step
      const newStatus = value.decision === 'Approved' ? 'Approved' : 'Rejected';
      await new sql.Request(tx)
        .input('Id', sql.BigInt, workflowStepId)
        .input('Status', sql.NVarChar(20), newStatus)
        .input('Decision', sql.NVarChar(20), value.decision)
        .input('Notes', sql.NVarChar(sql.MAX), value.notes || null)
        .input('DecidedByUserId', sql.Int, userId)
        .input('DecidedAt', sql.DateTime2, new Date())
        .query(`
          UPDATE RequestWorkflowSteps
          SET Status = @Status, Decision = @Decision, Notes = @Notes,
              DecidedByUserId = @DecidedByUserId, DecidedAt = @DecidedAt
          WHERE Id = @Id
        `);
      
      // Update request status
      let requestStatus = 'InProgress';
      let completedAt = null;
      
      // Special case: If this is step 0 (discount approval), handle it differently
      // Both approval and rejection should allow payment, not end the workflow
      if (step.StepOrder === 0) {
          console.log(`🔍 Processing discount decision for step 0, RequestID: ${step.RequestID}, Decision: ${value.decision}`);
          requestStatus = 'Pending';
          
          // Calculate discount amounts properly for both Approved and Rejected
          const discountStatus = value.decision === 'Approved' ? 'Approved' : 'Rejected';
          
          // Get vehicle capacity and calculate tariff amount (needed for both approval and rejection)
          const vehicleResult = await new sql.Request(tx)
            .input('RequestID', sql.BigInt, step.RequestID)
            .query(`
              SELECT v.Capacity, vr.VehicleID
              FROM VehicleRequests vr
              INNER JOIN Vehicles v ON vr.VehicleID = v.VehicleID
              WHERE vr.RequestID = @RequestID
            `);
          
          const capacity = vehicleResult.recordset[0]?.Capacity;
          const vehicleId = vehicleResult.recordset[0]?.VehicleID;
          
          // Parse capacity to get tonnage (e.g., "5 تن" -> 5)
          const tonnage = capacity ? parseFloat(capacity.replace(/[^\d.]/g, '')) : 0;
          
          // Get tariff based on tonnage
          const tariffResult = await new sql.Request(tx)
            .input('Tonnage', sql.Decimal(10, 2), tonnage)
            .query(`
              SELECT TOP 1 Amount
              FROM Tariffs
              WHERE 
                (FromTon IS NULL OR CAST(REPLACE(FromTon, ' تن', '') AS DECIMAL(10,2)) <= @Tonnage)
                AND (ToTon IS NULL OR CAST(REPLACE(ToTon, ' تن', '') AS DECIMAL(10,2)) >= @Tonnage)
              ORDER BY Id DESC
            `);
          
          const tariffAmount = tariffResult.recordset[0]?.Amount || 1000000;
          
          // Calculate original amount with 10% VAT (always calculated for both approval and rejection)
          const originalAmount = Math.round(tariffAmount * 1.1);
          
          let discountAmount = 0;
          let finalAmount = originalAmount;
          
          // Only calculate discount if approved
          if (value.decision === 'Approved') {
            // Get discount documents and their percentages
            const discountDocsResult = await new sql.Request(tx)
              .input('VehicleID', sql.BigInt, vehicleId)
              .query(`
                SELECT lv.DiscountPercentage
                FROM VehicleDiscountDocuments vdd
                INNER JOIN LookupValue lv ON vdd.LookupDocTypeId = lv.Id
                WHERE vdd.VehicleID = @VehicleID AND lv.DiscountPercentage IS NOT NULL
              `);
            
            // Calculate total discount percentage (additive)
            const totalDiscountPercentage = discountDocsResult.recordset.reduce(
              (sum, doc) => sum + (doc.DiscountPercentage || 0), 
              0
            );
            
            // Cap at 100%
            const cappedPercentage = Math.min(totalDiscountPercentage, 100);
            
            // Calculate discount amount
            discountAmount = Math.round((originalAmount * cappedPercentage) / 100);
            finalAmount = originalAmount - discountAmount;
            
            console.log(`💰 Discount calculation: Original=${originalAmount} (${tariffAmount} + 10% VAT), Discount=${discountAmount} (${cappedPercentage}%), Final=${finalAmount}`);
          }
          
          // Update VehicleRequests with calculated amounts
          await new sql.Request(tx)
            .input('RequestID', sql.BigInt, step.RequestID)
            .input('DiscountStatus', sql.NVarChar(20), discountStatus)
            .input('OriginalAmount', sql.Decimal(18, 2), originalAmount)
            .input('DiscountAmount', sql.Decimal(18, 2), discountAmount)
            .input('FinalAmount', sql.Decimal(18, 2), finalAmount)
            .query(`
              UPDATE VehicleRequests
              SET DiscountStatus = @DiscountStatus,
                  OriginalAmount = @OriginalAmount,
                  DiscountAmount = @DiscountAmount,
                  FinalAmount = @FinalAmount
              WHERE RequestID = @RequestID
            `);
          
          console.log(`✅ Discount ${value.decision} completed for request ${step.RequestID}:`);
          console.log(`   - DiscountStatus: ${discountStatus}`);
          console.log(`   - OriginalAmount: ${originalAmount}`);
          console.log(`   - DiscountAmount: ${discountAmount}`);
          console.log(`   - FinalAmount: ${finalAmount}`);
          console.log(`   - RequestStatus: Pending (awaiting payment)`);
      } else {
        // Normal workflow steps (not step 0)
        if (value.decision === 'Rejected') {
          requestStatus = 'Rejected';
          completedAt = new Date();
          
          // Mark all subsequent steps as skipped
          await new sql.Request(tx)
            .input('RequestID', sql.BigInt, step.RequestID)
            .input('StepOrder', sql.Int, step.StepOrder)
            .query(`
              UPDATE RequestWorkflowSteps
              SET Status = 'Skipped'
              WHERE RequestID = @RequestID AND StepOrder > @StepOrder AND Status IN ('Pending', 'NotStarted')
            `);
        } else {
          // Step approved - check if this is Step 2 (کارشناس تایید محل) for exploitation licenses
          // If so, pause workflow and wait for payment before advancing
          const isExploitationLicense = await new sql.Request(tx)
            .input('RequestID', sql.BigInt, step.RequestID)
            .query(`
              SELECT vr.LicenseTypeId, vr.TrackingNo, ot.Name AS OperationTypeName
              FROM VehicleRequests vr
              LEFT JOIN LookupValue ot ON vr.OperationTypeId = ot.Id
              WHERE vr.RequestID = @RequestID
            `);
          
          const licenseTypeId = isExploitationLicense.recordset[0]?.LicenseTypeId;
          const trackingNo = isExploitationLicense.recordset[0]?.TrackingNo;
          const operationTypeName = isExploitationLicense.recordset[0]?.OperationTypeName || '';
          // Check for exploitation license (format: 11YY-NNNN)
          const isExploitation = licenseTypeId === 68 || trackingNo?.startsWith('11');
          const isRenewal = String(operationTypeName).includes('تمدید');
          
          // Debug logging
          console.log(`🔍 Checking if should pause for payment:`);
          console.log(`   - LicenseTypeId: ${licenseTypeId}`);
          console.log(`   - TrackingNo: ${trackingNo}`);
          console.log(`   - isExploitation: ${isExploitation}`);
          console.log(`   - StepOrder: ${step.StepOrder}`);
          console.log(`   - RoleName: "${step.RoleName}"`);
          console.log(`   - RoleName length: ${step.RoleName?.length}`);
          
          // Renewal follows the steps configured for تمدید پروانه بهره برداری
          // and does not stop for payment after the location expert.
          const shouldPauseForPayment = isExploitation &&
                                        !isRenewal &&
                                        step.StepOrder === 2 && 
                                        step.RoleName === 'کارشناس تایید محل';
          
          console.log(`   - shouldPauseForPayment: ${shouldPauseForPayment}`);
          
          if (shouldPauseForPayment) {
            // Pause workflow - set status to AwaitingPayment
            requestStatus = 'AwaitingPayment';
            
            // Ensure Step 3 remains in NotStarted status (don't activate it)
            await new sql.Request(tx)
              .input('RequestID', sql.BigInt, step.RequestID)
              .input('StepOrder', sql.Int, 3)
              .query(`
                UPDATE RequestWorkflowSteps
                SET Status = 'NotStarted'
                WHERE RequestID = @RequestID AND StepOrder = @StepOrder
              `);
            
            console.log(`⏸️ Step 2 (کارشناس تایید محل) approved for exploitation license - pausing workflow for payment`);
            console.log(`   Request will remain in AwaitingPayment status until payment is completed`);
            console.log(`   Step 3 will remain inactive until payment is completed`);
          } else {
            // Normal flow - check if there's a next step
            const nextStepResult = await new sql.Request(tx)
              .input('RequestID', sql.BigInt, step.RequestID)
              .input('StepOrder', sql.Int, step.StepOrder)
              .query(`
                SELECT TOP 1 Id, StepOrder, RoleName
                FROM RequestWorkflowSteps
                WHERE RequestID = @RequestID AND StepOrder > @StepOrder
                ORDER BY StepOrder ASC
              `);
            
            if (nextStepResult.recordset.length > 0) {
              // There is a next step - activate it
              const nextStep = nextStepResult.recordset[0];
              await new sql.Request(tx)
                .input('Id', sql.BigInt, nextStep.Id)
                .query(`
                  UPDATE RequestWorkflowSteps
                  SET Status = 'Pending'
                  WHERE Id = @Id
                `);
              
              requestStatus = 'InProgress';
              console.log(`✅ Step ${step.StepOrder} approved, activated next step ${nextStep.StepOrder} (${nextStep.RoleName})`);
            } else {
              // No more steps - workflow is complete
              requestStatus = 'Approved';
              completedAt = new Date();
              console.log(`✅ Final step ${step.StepOrder} approved, marking request as Approved`);
            }
          }
        }
      }
      
      await new sql.Request(tx)
        .input('RequestID', sql.BigInt, step.RequestID)
        .input('Status', sql.NVarChar(50), requestStatus)
        .input('CurrentStepOrder', sql.Int, step.StepOrder)
        .input('CompletedAt', sql.DateTime2, completedAt)
        .query(`
          UPDATE VehicleRequests
          SET Status = @Status, CurrentStepOrder = @CurrentStepOrder, CompletedAt = @CompletedAt
          WHERE RequestID = @RequestID
        `);
      
      // Add to process history
      await new sql.Request(tx)
        .input('RequestID', sql.BigInt, step.RequestID)
        .input('ActionType', sql.NVarChar(50), value.decision === 'Approved' ? 'Approved' : 'Rejected')
        .input('ActionByUserId', sql.Int, userId)
        .input('ActionByUserName', sql.NVarChar(150), userName)
        .input('ActionByRole', sql.NVarChar(50), step.RoleName)
        .input('FromStatus', sql.NVarChar(50), 'Pending')
        .input('ToStatus', sql.NVarChar(50), requestStatus)
        .input('StepOrder', sql.Int, step.StepOrder)
        .input('Notes', sql.NVarChar(sql.MAX), value.notes || null)
        .query(`
          INSERT INTO RequestProcessHistory 
          (RequestID, ActionType, ActionByUserId, ActionByUserName, ActionByRole, FromStatus, ToStatus, StepOrder, Notes)
          VALUES (@RequestID, @ActionType, @ActionByUserId, @ActionByUserName, @ActionByRole, @FromStatus, @ToStatus, @StepOrder, @Notes)
        `);
      
      await tx.commit();
      
      // Debug: Log workflow completion details
      console.log(`📋 Workflow decision completed:`);
      console.log(`   - RequestID: ${step.RequestID}`);
      console.log(`   - RequestStatus: ${requestStatus}`);
      console.log(`   - CompletedAt: ${completedAt}`);
      console.log(`   - StepOrder: ${step.StepOrder}`);
      console.log(`   - RoleName: ${step.RoleName}`);
      
      // If license is approved, automatically log to license history
      if (requestStatus === 'Approved' && completedAt) {
        console.log(`✅ Final approval detected - starting license logging process for RequestID: ${step.RequestID}`);
        try {
          // Get request details for license history
          const requestDetailsResult = await pool.request()
            .input('RequestID', sql.BigInt, step.RequestID)
            .query(`
              SELECT 
                vr.RequestID,
                vr.TrackingNo,
                vr.LicenseTypeId,
                vr.OperationTypeId,
                vr.VehicleID,
                vr.NationalCode,
                vr.CompanyNationalId,
                vr.CompletedAt,
                lt.Name AS LicenseTypeName,
                ot.Name AS OperationTypeName
              FROM VehicleRequests vr
              LEFT JOIN LookupValue lt ON vr.LicenseTypeId = lt.Id
              LEFT JOIN LookupValue ot ON vr.OperationTypeId = ot.Id
              WHERE vr.RequestID = @RequestID
            `);
          
          if (requestDetailsResult.recordset.length > 0) {
            const requestDetails = requestDetailsResult.recordset[0];
            
            const isCancellation = String(requestDetails.OperationTypeName || '').includes('ابطال');
            if (isCancellation) {
              await deactivateApprovedLicense(pool, requestDetails, {
                userId,
                userName,
                roleName: step.RoleName
              });
              console.log(`🛑 License ${requestDetails.TrackingNo} cancelled after workflow approval`);
            } else {
            // Determine event type based on operation type
            let eventType = 'Issued';
            if (requestDetails.OperationTypeName && requestDetails.OperationTypeName.includes('تمدید')) {
              eventType = 'Renewed';
            }
            
            // Get current Shamsi date
            const issueDate = getCurrentShamsiDate();
            
            // Calculate expiry date (1 year validity)
            const expiryDate = addOneYearShamsi(issueDate);
            const validityMonths = 12;
            
            // Log license history
            let licenseHistoryId = null;
            try {
              const licenseHistoryResult = await pool.request()
                .input('RequestID', sql.BigInt, requestDetails.RequestID)
                .query(`
                  SELECT TOP 1 HistoryID FROM LicenseHistory 
                  WHERE RequestID = @RequestID 
                  ORDER BY CreatedAt DESC
                `);
              
              licenseHistoryId = licenseHistoryResult.recordset[0]?.HistoryID;
              console.log(`🔍 Found LicenseHistory record: HistoryID = ${licenseHistoryId} for RequestID = ${requestDetails.RequestID}`);
            } catch (historyLookupError) {
              console.error('⚠️ Failed to lookup LicenseHistory:', historyLookupError);
            }
            
            // Fallback: Try to find by TrackingNo if RequestID didn't work
            if (!licenseHistoryId && requestDetails.TrackingNo) {
              try {
                const licenseHistoryByTrackingResult = await pool.request()
                  .input('TrackingNo', sql.NVarChar(30), requestDetails.TrackingNo)
                  .query(`
                    SELECT TOP 1 HistoryID FROM LicenseHistory 
                    WHERE TrackingNo = @TrackingNo 
                    ORDER BY CreatedAt DESC
                  `);
                
                licenseHistoryId = licenseHistoryByTrackingResult.recordset[0]?.HistoryID;
                console.log(`🔍 Fallback: Found LicenseHistory by TrackingNo: HistoryID = ${licenseHistoryId}`);
              } catch (trackingLookupError) {
                console.error('⚠️ Failed to lookup LicenseHistory by TrackingNo:', trackingLookupError);
              }
            }
            
            await logLicenseHistory({
              requestId: requestDetails.RequestID,
              trackingNo: requestDetails.TrackingNo,
              licenseTypeId: requestDetails.LicenseTypeId,
              licenseTypeName: requestDetails.LicenseTypeName,
              operationTypeId: requestDetails.OperationTypeId,
              operationTypeName: requestDetails.OperationTypeName,
              eventType: eventType,
              vehicleId: requestDetails.VehicleID,
              nationalCode: requestDetails.NationalCode,
              companyNationalId: requestDetails.CompanyNationalId,
              issueDate: issueDate,
              expiryDate: expiryDate,
              validityDurationMonths: validityMonths,
              status: 'Active',
              issuedByUserId: userId,
              issuedByUsername: userName,
              issuedByRole: step.RoleName,
              notes: `License ${eventType.toLowerCase()} via workflow approval`,
              metadata: {
                workflowStepId: workflowStepId,
                finalStepOrder: step.StepOrder,
                approvalNotes: value.notes
              }
            });
            
            console.log(`📝 License history logged for approved request ${requestDetails.TrackingNo}`);
            
            // If this is a renewal, also log to LicenseRenewalHistory
            if (eventType === 'Renewed' && licenseHistoryId) {
              try {
                await logLicenseRenewal({
                  trackingNo: requestDetails.TrackingNo,
                  requestId: requestDetails.RequestID,
                  licenseHistoryId: licenseHistoryId,
                  renewalDate: issueDate,
                  expiryDate: expiryDate,
                  renewedByUserId: userId
                });
                
                console.log(`📝 License renewal history logged for ${requestDetails.TrackingNo}`);
              } catch (renewalError) {
                console.error('⚠️ Failed to log license renewal:', renewalError);
                // Don't fail the approval if renewal logging fails
              }
            }
            }
          }
        } catch (historyError) {
          // Log error but don't fail the approval
          console.error('⚠️ Failed to log license history:', historyError);
        }
      }
      
      res.json({ 
        success: true, 
        requestStatus,
        message: value.decision === 'Approved' ? 'Request approved successfully' : 'Request rejected'
      });
    } catch (err) {
      await tx.rollback();
      throw err;
    }
  } catch (e) {
    next(e);
  }
}

// Fix deficiency - return request to previous step with notes
const fixDeficiencySchema = Joi.object({
  notes: Joi.string().required().min(1).max(2000).messages({
    'string.empty': 'توضیحات رفع نقص الزامی است',
    'any.required': 'توضیحات رفع نقص الزامی است'
  })
});

export async function fixDeficiency(req, res, next) {
  try {
    const workflowStepId = Number(req.params.stepId);
    const { error, value } = fixDeficiencySchema.validate(req.body);
    
    if (error) return res.status(400).json({ message: error.message });
    if (!workflowStepId) return res.status(400).json({ message: 'Missing stepId' });
    
    const userId = req.user.id;
    const userName = req.user.username;
    const userRole = req.user.role;
    const userRoles = [userRole, ...(req.user.roles || [])];
    
    const pool = await getPool();
    const tx = new sql.Transaction(pool);
    await tx.begin();
    
    try {
      // Get current workflow step
      const stepResult = await new sql.Request(tx)
        .input('Id', sql.BigInt, workflowStepId)
        .query('SELECT * FROM RequestWorkflowSteps WHERE Id = @Id');
      
      const currentStep = stepResult.recordset[0];
      if (!currentStep) {
        await tx.rollback();
        return res.status(404).json({ message: 'Workflow step not found' });
      }
      
      // Check if user has permission (role matches)
      if (!userRoles.includes(currentStep.RoleName)) {
        await tx.rollback();
        return res.status(403).json({ message: 'You do not have permission for this step' });
      }
      
      // Check if already decided
      if (currentStep.Status !== 'Pending') {
        await tx.rollback();
        return res.status(400).json({ message: 'This step has already been decided' });
      }
      
      // Get request information to find the original submitter
      const requestResult = await new sql.Request(tx)
        .input('RequestID', sql.BigInt, currentStep.RequestID)
        .query(`
          SELECT vr.SubmittedByUserId, vr.VehicleID, v.RegistrarNationalCode
          FROM VehicleRequests vr
          INNER JOIN Vehicles v ON vr.VehicleID = v.VehicleID
          WHERE vr.RequestID = @RequestID
        `);
      
      const requestInfo = requestResult.recordset[0];
      
      // Determine target step based on business rules:
      // 1. Default: Return to the user who created the request (متقاضی/کاربر مستقل)
      // 2. Exception: If current role is "رییس اداره صدور پروانه", return to "کارشناس صدور پروانه"
      
      let targetStep;
      let targetStepDescription;
      
      if (currentStep.RoleName === 'رییس اداره صدور پروانه') {
        // Exception: Find the "کارشناس صدور پروانه" step
        const expertStepResult = await new sql.Request(tx)
          .input('RequestID', sql.BigInt, currentStep.RequestID)
          .input('RoleName', sql.NVarChar(50), 'کارشناس صدور پروانه')
          .query(`
            SELECT TOP 1 * 
            FROM RequestWorkflowSteps
            WHERE RequestID = @RequestID 
              AND RoleName = @RoleName
            ORDER BY StepOrder ASC
          `);
        
        targetStep = expertStepResult.recordset[0];
        targetStepDescription = 'کارشناس صدور پروانه';
        
        if (!targetStep) {
          await tx.rollback();
          return res.status(400).json({ message: 'کارشناس صدور پروانه step not found' });
        }
      } else {
        // Default: Return to the original submitter (first step - متقاضی)
        // Find the first step (متقاضی/کاربر مستقل)
        const firstStepResult = await new sql.Request(tx)
          .input('RequestID', sql.BigInt, currentStep.RequestID)
          .query(`
            SELECT TOP 1 * 
            FROM RequestWorkflowSteps
            WHERE RequestID = @RequestID 
              AND StepOrder > 0
            ORDER BY StepOrder ASC
          `);
        
        targetStep = firstStepResult.recordset[0];
        targetStepDescription = 'متقاضی (کاربر مستقل)';
        
        if (!targetStep) {
          await tx.rollback();
          return res.status(400).json({ message: 'No target step found to return to' });
        }
      }
      
      // Mark current step as completed with deficiency status
      // This removes it from the expert/manager's inbox
      await new sql.Request(tx)
        .input('Id', sql.BigInt, workflowStepId)
        .input('Status', sql.NVarChar(20), 'FixDeficiency')
        .input('DecidedByUserId', sql.Int, userId)
        .input('DecidedAt', sql.DateTime2, new Date())
        .input('Notes', sql.NVarChar(sql.MAX), `رفع نقص: ${value.notes}`)
        .query(`
          UPDATE RequestWorkflowSteps
          SET Status = @Status,
              DecidedByUserId = @DecidedByUserId,
              DecidedAt = @DecidedAt,
              Notes = @Notes
          WHERE Id = @Id
        `);
      
      // Reset target step to Pending so it can be worked on again
      // Store the deficiency sender's step order in AssignedUserId temporarily for tracking
      await new sql.Request(tx)
        .input('Id', sql.BigInt, targetStep.Id)
        .input('Status', sql.NVarChar(20), 'Pending')
        .input('DecidedByUserId', sql.Int, null)
        .input('DecidedAt', sql.DateTime2, null)
        .input('Notes', sql.NVarChar(sql.MAX), `رفع نقص از ${currentStep.RoleName}: ${value.notes}`)
        .input('AssignedUserId', sql.Int, userId)
        .query(`
          UPDATE RequestWorkflowSteps
          SET Status = @Status,
              Decision = NULL,
              DecidedByUserId = @DecidedByUserId,
              DecidedAt = @DecidedAt,
              Notes = @Notes,
              AssignedUserId = @AssignedUserId
          WHERE Id = @Id
        `);
      
      // Update request to go back to target step and track deficiency sender
      // IMPORTANT: We store the STEP ID (not StepOrder) because StepOrder can change
      // when workflow is filtered (e.g., online payment removes financial expert)
      console.log('📝 Storing deficiency sender info:', {
        requestId: currentStep.RequestID,
        currentStepId: currentStep.Id,
        currentStepOrder: currentStep.StepOrder,
        currentStepRole: currentStep.RoleName,
        deficiencySenderUserId: userId,
        targetStepOrder: targetStep.StepOrder,
        targetStepRole: targetStep.RoleName
      });
      
      await new sql.Request(tx)
        .input('RequestID', sql.BigInt, currentStep.RequestID)
        .input('CurrentStepOrder', sql.Int, targetStep.StepOrder)
        .input('Status', sql.NVarChar(20), 'InProgress')
        .input('DeficiencySenderStepOrder', sql.Int, currentStep.Id) // Store step ID, not StepOrder
        .input('DeficiencySenderUserId', sql.Int, userId)
        .input('HasDeficiency', sql.Bit, 1)
        .query(`
          UPDATE VehicleRequests
          SET CurrentStepOrder = @CurrentStepOrder,
              Status = @Status,
              DeficiencySenderStepOrder = @DeficiencySenderStepOrder,
              DeficiencySenderUserId = @DeficiencySenderUserId,
              HasDeficiency = @HasDeficiency
          WHERE RequestID = @RequestID
        `);
      
      // Add to process history
      await new sql.Request(tx)
        .input('RequestID', sql.BigInt, currentStep.RequestID)
        .input('ActionType', sql.NVarChar(50), 'FixDeficiency')
        .input('ActionByUserId', sql.Int, userId)
        .input('ActionByUserName', sql.NVarChar(100), userName)
        .input('ActionByRole', sql.NVarChar(50), userRole)
        .input('FromStatus', sql.NVarChar(50), 'InProgress')
        .input('ToStatus', sql.NVarChar(50), 'InProgress')
        .input('StepOrder', sql.Int, currentStep.StepOrder)
        .input('Notes', sql.NVarChar(sql.MAX), `رفع نقص - ارجاع به ${targetStepDescription} (مرحله ${targetStep.StepOrder}): ${value.notes}`)
        .query(`
          INSERT INTO RequestProcessHistory 
          (RequestID, ActionType, ActionByUserId, ActionByUserName, ActionByRole, FromStatus, ToStatus, StepOrder, Notes)
          VALUES (@RequestID, @ActionType, @ActionByUserId, @ActionByUserName, @ActionByRole, @FromStatus, @ToStatus, @StepOrder, @Notes)
        `);
      
      await tx.commit();
      
      console.log(`✅ Request ${currentStep.RequestID} returned to step ${targetStep.StepOrder} (${targetStepDescription}) for deficiency fix`);
      
      res.json({ 
        success: true, 
        message: `پرونده برای رفع نقص به ${targetStepDescription} ارجاع شد`,
        returnedToStep: targetStep.StepOrder,
        returnedToRole: targetStep.RoleName,
        targetDescription: targetStepDescription
      });
    } catch (err) {
      await tx.rollback();
      throw err;
    }
  } catch (e) {
    console.error('❌ Error in fixDeficiency:', e);
    next(e);
  }
}

// Initialize workflow steps when a request is created
// paymentType: 'online' or 'offline' - determines if financial expert step should be included
export async function initializeWorkflow(requestId, userId, pool, paymentType = 'offline') {
  try {
    console.log(`🔄 Initializing workflow for request ${requestId} with payment type: ${paymentType}`);
    
    // Check if workflow tables exist first
    const tableCheck = await pool.request()
      .query(`
        SELECT COUNT(*) AS TableCount 
        FROM INFORMATION_SCHEMA.TABLES 
        WHERE TABLE_NAME IN ('RequestWorkflowSteps', 'RequestProcessHistory', 'GlobalApprovalFlowSteps')
      `);
    
    if (tableCheck.recordset[0].TableCount < 3) {
      throw new Error('Workflow tables not found. Please run the workflow.sql migration script.');
    }
    
    // Determine license type from request's tracking number
    // TrackingNo format: 2XXX-NNNNN for Employment, 3XXX-NNNNN for Activity
    const requestInfo = await pool.request()
      .input('RequestID', sql.BigInt, requestId)
      .query('SELECT TrackingNo FROM VehicleRequests WHERE RequestID = @RequestID');
    
    const trackingNo = requestInfo.recordset[0]?.TrackingNo || '';
    const licenseType = trackingNo.startsWith('2') ? 'Employment' : 'Activity';
    
    console.log(`📋 Request ${requestId} has tracking ${trackingNo}, determined license type: ${licenseType}`);
    
    // Get global approval flow for this license type
    const flowResult = await pool.request()
      .input('LicenseType', sql.NVarChar(20), licenseType)
      .query('SELECT StepOrder, RoleName FROM GlobalApprovalFlowSteps WHERE LicenseType = @LicenseType ORDER BY StepOrder');
    
    let steps = flowResult.recordset;
    if (steps.length === 0) {
      throw new Error(`No ${licenseType} approval flow configured. Please configure the approval flow in admin panel.`);
    }
    
    // If payment is online, skip the financial expert step
    if (paymentType === 'online') {
      const originalCount = steps.length;
      steps = steps.filter(step => step.RoleName !== 'کارشناس مالی' && step.RoleName !== 'Financial Expert');
      console.log(`✅ Online payment detected: Filtered out financial expert step (${originalCount} → ${steps.length} steps)`);
      
      // Re-order steps after filtering
      steps = steps.map((step, index) => ({
        ...step,
        StepOrder: index + 1
      }));
    }
        // Create workflow steps for this request
    const tx = new sql.Transaction(pool);
    await tx.begin();
    
    try {
      for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        // First step should be 'Pending' (active), others 'NotStarted'
        const stepStatus = (i === 0) ? 'Pending' : 'NotStarted';
        
        await new sql.Request(tx)
          .input('RequestID', sql.BigInt, requestId)
          .input('StepOrder', sql.Int, step.StepOrder)
          .input('RoleName', sql.NVarChar(50), step.RoleName)
          .input('Status', sql.NVarChar(20), stepStatus)
          .query(`
            INSERT INTO RequestWorkflowSteps (RequestID, StepOrder, RoleName, Status)
            VALUES (@RequestID, @StepOrder, @RoleName, @Status)
          `);
      }
      
      // Update request with initial status - start at step 1
      await new sql.Request(tx)
        .input('RequestID', sql.BigInt, requestId)
        .input('Status', sql.NVarChar(50), 'InProgress')
        .input('CurrentStepOrder', sql.Int, 1)
        .input('SubmittedByUserId', sql.Int, userId)
        .query(`
          UPDATE VehicleRequests
          SET Status = @Status, CurrentStepOrder = @CurrentStepOrder, SubmittedByUserId = @SubmittedByUserId
          WHERE RequestID = @RequestID
        `);
      
      // Add to process history
      await new sql.Request(tx)
        .input('RequestID', sql.BigInt, requestId)
        .input('ActionType', sql.NVarChar(50), paymentType === 'online' ? 'PaymentCompleted' : 'Created')
        .input('ActionByUserId', sql.Int, userId)
        .input('ActionByUserName', sql.NVarChar(150), 'System')
        .input('FromStatus', sql.NVarChar(50), 'Draft')
        .input('ToStatus', sql.NVarChar(50), 'InProgress')
        .input('StepOrder', sql.Int, 1)
        .input('Notes', sql.NVarChar(sql.MAX), paymentType === 'online' ? `پرداخت آنلاین با موفقیت انجام شد - ارجاع به ${steps[0].RoleName}` : 'پرونده ایجاد شد')
        .query(`
          INSERT INTO RequestProcessHistory 
          (RequestID, ActionType, ActionByUserId, ActionByUserName, FromStatus, ToStatus, StepOrder, Notes)
          VALUES (@RequestID, @ActionType, @ActionByUserId, @ActionByUserName, @FromStatus, @ToStatus, @StepOrder, @Notes)
        `);
      
      await tx.commit();
      
      console.log(`✅ Workflow initialized for request ${requestId}. First step (${steps[0].RoleName}) is now active.`);
    } catch (err) {
      await tx.rollback();
      throw err;
    }
  } catch (e) {
    throw e;
  }
}

// Get all requests (for admin) with filtering and pagination
export async function getAllRequests(req, res, next) {
  try {
    const pool = await getPool();
    
    // Check if workflow tables exist
    const tableCheck = await pool.request()
      .query(`
        SELECT COUNT(*) AS TableCount 
        FROM INFORMATION_SCHEMA.TABLES 
        WHERE TABLE_NAME = 'VehicleRequests'
      `);
    
    if (tableCheck.recordset[0].TableCount === 0) {
      return res.json({ data: [], total: 0, page: 1, pageSize: 30 });
    }
    
    // Get pagination parameters
    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 30;
    const offset = (page - 1) * pageSize;
    
    // Get filter parameters
    const filters = {
      trackingNo: req.query.trackingNo || '',
      licenseType: req.query.licenseType || '',
      operationType: req.query.operationType || '',
      applicantName: req.query.applicantName || '',
      nationalCode: req.query.nationalCode || '',
      plateNumber: req.query.plateNumber || '',
      vin: req.query.vin || '',
      status: req.query.status || '',
      submittedBy: req.query.submittedBy || '',
      dateFrom: req.query.dateFrom || '',
      dateTo: req.query.dateTo || '',
      printStatus: req.query.printStatus || 'all' // all, printed, notPrinted
    };
    
    // Build WHERE clause for filters
    let whereConditions = [];
    const request = pool.request();
    
    if (filters.trackingNo) {
      whereConditions.push('vr.TrackingNo LIKE @TrackingNo');
      request.input('TrackingNo', sql.NVarChar, `%${filters.trackingNo}%`);
    }
    if (filters.licenseType) {
      whereConditions.push('lt.Name LIKE @LicenseType');
      request.input('LicenseType', sql.NVarChar, `%${filters.licenseType}%`);
    }
    if (filters.operationType) {
      whereConditions.push('ot.Name LIKE @OperationType');
      request.input('OperationType', sql.NVarChar, `%${filters.operationType}%`);
    }
    if (filters.applicantName) {
      whereConditions.push('(ci.CompanyName LIKE @ApplicantName OR p.FirstName LIKE @ApplicantName OR p.LastName LIKE @ApplicantName)');
      request.input('ApplicantName', sql.NVarChar, `%${filters.applicantName}%`);
    }
    if (filters.nationalCode) {
      whereConditions.push(`(
        vr.NationalCode LIKE @NationalCode
        OR vr.CompanyNationalId LIKE @NationalCode
        OR srcIdent.NationalCode LIKE @NationalCode
        OR srcIdent.CompanyNationalId LIKE @NationalCode
        OR v.RegistrarNationalCode LIKE @NationalCode
      )`);
      request.input('NationalCode', sql.NVarChar, `%${filters.nationalCode}%`);
    }
    if (filters.plateNumber) {
      whereConditions.push('(v.PlateThreeDigits LIKE @PlateNumber OR v.PlateLetter LIKE @PlateNumber OR v.PlateRegion2 LIKE @PlateNumber OR v.PlateSerial2 LIKE @PlateNumber)');
      request.input('PlateNumber', sql.NVarChar, `%${filters.plateNumber}%`);
    }
    if (filters.vin) {
      whereConditions.push('v.VIN LIKE @VIN');
      request.input('VIN', sql.NVarChar, `%${filters.vin}%`);
    }
    if (filters.status) {
      whereConditions.push('vr.Status = @Status');
      request.input('Status', sql.NVarChar, filters.status);
    }
    if (filters.submittedBy) {
      whereConditions.push('u.FullName LIKE @SubmittedBy');
      request.input('SubmittedBy', sql.NVarChar, `%${filters.submittedBy}%`);
    }
    
    // Date range filters (convert Shamsi to Gregorian)
    if (filters.dateFrom) {
      try {
        const gregorianDateFrom = shamsiToGregorian(filters.dateFrom);
        // Set to start of day
        gregorianDateFrom.setHours(0, 0, 0, 0);
        whereConditions.push('vr.CreatedAt >= @DateFrom');
        request.input('DateFrom', sql.DateTime, gregorianDateFrom);
      } catch (e) {
        console.error('Invalid dateFrom format:', filters.dateFrom, e.message);
      }
    }
    
    if (filters.dateTo) {
      try {
        const gregorianDateTo = shamsiToGregorian(filters.dateTo);
        // Set to end of day
        gregorianDateTo.setHours(23, 59, 59, 999);
        whereConditions.push('vr.CreatedAt <= @DateTo');
        request.input('DateTo', sql.DateTime, gregorianDateTo);
      } catch (e) {
        console.error('Invalid dateTo format:', filters.dateTo, e.message);
      }
    }
    
    // Print status filter
    if (filters.printStatus === 'printed') {
      whereConditions.push('lpl.RequestID IS NOT NULL');
    } else if (filters.printStatus === 'notPrinted') {
      whereConditions.push('lpl.RequestID IS NULL');
    }
    
    const whereClause = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : '';
    
    // Get total count for pagination
    const countQuery = `
      SELECT COUNT(DISTINCT vr.RequestID) AS Total
      FROM VehicleRequests vr
      LEFT JOIN Vehicles v ON vr.VehicleID = v.VehicleID
      -- Earliest request on this tracking number that actually stored the applicant.
      -- Activity renewals are inserted without NationalCode/CompanyNationalId.
      LEFT JOIN (
        SELECT
          TrackingNo,
          NULLIF(LTRIM(RTRIM(NationalCode)), N'') AS NationalCode,
          NULLIF(LTRIM(RTRIM(CompanyNationalId)), N'') AS CompanyNationalId
        FROM (
          SELECT
            TrackingNo,
            NationalCode,
            CompanyNationalId,
            ROW_NUMBER() OVER (
              PARTITION BY TrackingNo
              ORDER BY
                CASE
                  WHEN NULLIF(LTRIM(RTRIM(NationalCode)), N'') IS NOT NULL
                    OR NULLIF(LTRIM(RTRIM(CompanyNationalId)), N'') IS NOT NULL
                  THEN 0 ELSE 1
                END,
                CreatedAt ASC,
                RequestID ASC
            ) AS rn
          FROM VehicleRequests
          WHERE TrackingNo IS NOT NULL
        ) rankedIdentity
        WHERE rn = 1
          AND (NationalCode IS NOT NULL OR CompanyNationalId IS NOT NULL)
      ) srcIdent ON srcIdent.TrackingNo = vr.TrackingNo
      LEFT JOIN Persons p ON p.NationalCode = COALESCE(
        NULLIF(LTRIM(RTRIM(vr.NationalCode)), N''),
        srcIdent.NationalCode,
        CASE
          WHEN COALESCE(NULLIF(LTRIM(RTRIM(vr.CompanyNationalId)), N''), srcIdent.CompanyNationalId) IS NULL
          THEN NULLIF(LTRIM(RTRIM(v.RegistrarNationalCode)), N'')
        END
      )
      LEFT JOIN CompanyInfo ci ON ci.NationalId = COALESCE(
        NULLIF(LTRIM(RTRIM(vr.CompanyNationalId)), N''),
        srcIdent.CompanyNationalId,
        CASE
          WHEN COALESCE(NULLIF(LTRIM(RTRIM(vr.NationalCode)), N''), srcIdent.NationalCode) IS NULL
          THEN NULLIF(LTRIM(RTRIM(v.RegistrarNationalCode)), N'')
        END
      )
      LEFT JOIN Users u ON vr.SubmittedByUserId = u.Id
      LEFT JOIN LookupValue lt ON vr.LicenseTypeId = lt.Id
      LEFT JOIN LookupValue ot ON vr.OperationTypeId = ot.Id
      LEFT JOIN (
        SELECT DISTINCT RequestID FROM LicensePrintLog
      ) lpl ON vr.RequestID = lpl.RequestID
      LEFT JOIN (
        SELECT lh1.*
        FROM LicenseHistory lh1
        INNER JOIN (
          SELECT TrackingNo, MAX(CreatedAt) AS MaxCreatedAt
          FROM LicenseHistory
          WHERE [Status] = 'Active'
          GROUP BY TrackingNo
        ) lh2 ON lh1.TrackingNo = lh2.TrackingNo AND lh1.CreatedAt = lh2.MaxCreatedAt
      ) lh ON vr.TrackingNo = lh.TrackingNo
      ${whereClause}
    `;
    
    const countResult = await request.query(countQuery);
    const total = countResult.recordset[0].Total;
    
    // Get paginated data with proper plate format
    const dataQuery = `
      SELECT 
        vr.RequestID,
        vr.TrackingNo,
        vr.Status,
        vr.CurrentStepOrder,
        vr.CreatedAt,
        vr.CompletedAt,
        vr.LicenseTypeId,
        vr.OperationTypeId,
        vr.NationalCode as RequestNationalCode,
        vr.CompanyNationalId as RequestCompanyNationalId,
        v.VIN,
        v.ChassisNo,
        -- Proper Iranian plate format: ThreeDigits + Letter + TwoDigits + Region + Serial
        CASE 
          WHEN v.PlateThreeDigits IS NOT NULL AND v.PlateLetter IS NOT NULL 
               AND v.PlateRegion2 IS NOT NULL AND v.PlateSerial2 IS NOT NULL
          THEN RTRIM(v.PlateThreeDigits) + N' ' + RTRIM(v.PlateLetter) + N' ' + 
               RTRIM(v.PlateRegion2) + N' ' + RTRIM(v.PlateSerial2)
          ELSE N'-'
        END AS PlateNumber,
        -- Person details
        p.FirstName,
        p.LastName,
        -- Company details
        ci.CompanyName,
        -- Applicant: company name, then person. Renewal rows often have empty
        -- NationalCode/CompanyNationalId; joins below fall back to the original
        -- license (same tracking number) and the vehicle registrar.
        CASE
          WHEN NULLIF(LTRIM(RTRIM(ci.CompanyName)), N'') IS NOT NULL THEN ci.CompanyName
          WHEN NULLIF(LTRIM(RTRIM(p.FirstName)), N'') IS NOT NULL
               AND NULLIF(LTRIM(RTRIM(p.LastName)), N'') IS NOT NULL
            THEN p.FirstName + N' ' + p.LastName
          WHEN NULLIF(LTRIM(RTRIM(p.FirstName)), N'') IS NOT NULL THEN p.FirstName
          WHEN NULLIF(LTRIM(RTRIM(p.LastName)), N'') IS NOT NULL THEN p.LastName
          ELSE N'-'
        END AS ApplicantName,
        -- Companies show شناسه ملی; individuals show کد ملی.
        COALESCE(
          NULLIF(LTRIM(RTRIM(vr.CompanyNationalId)), N''),
          srcIdent.CompanyNationalId,
          CASE WHEN NULLIF(LTRIM(RTRIM(ci.CompanyName)), N'') IS NOT NULL THEN NULLIF(LTRIM(RTRIM(ci.NationalId)), N'') END,
          NULLIF(LTRIM(RTRIM(vr.NationalCode)), N''),
          srcIdent.NationalCode,
          NULLIF(LTRIM(RTRIM(p.NationalCode)), N''),
          N'-'
        ) AS NationalCode,
        u.FullName AS SubmittedByUserName,
        lt.Name AS LicenseTypeName,
        ot.Name AS OperationTypeName,
        -- Print status: check if license has been printed
        CASE WHEN lpl.RequestID IS NOT NULL THEN 1 ELSE 0 END AS IsPrinted,
        -- Expiry date from LicenseHistory
        lh.ExpiryDate,
        -- Payment status: check if request has successful online or offline payment
        CASE 
          WHEN EXISTS (
            SELECT 1 FROM OnlinePayment op 
            WHERE op.RequestID = vr.RequestID
              AND (op.PayedBit = 1 OR op.Status = 'Successful')
          ) OR EXISTS (
            SELECT 1 FROM OfflinePayment ofp 
            WHERE ofp.RequestID = vr.RequestID
          ) THEN 1
          ELSE 0
        END AS HasSuccessfulPayment
      FROM VehicleRequests vr
      LEFT JOIN Vehicles v ON vr.VehicleID = v.VehicleID
      -- Earliest request on this tracking number that actually stored the applicant.
      -- Activity renewals are inserted without NationalCode/CompanyNationalId.
      LEFT JOIN (
        SELECT
          TrackingNo,
          NULLIF(LTRIM(RTRIM(NationalCode)), N'') AS NationalCode,
          NULLIF(LTRIM(RTRIM(CompanyNationalId)), N'') AS CompanyNationalId
        FROM (
          SELECT
            TrackingNo,
            NationalCode,
            CompanyNationalId,
            ROW_NUMBER() OVER (
              PARTITION BY TrackingNo
              ORDER BY
                CASE
                  WHEN NULLIF(LTRIM(RTRIM(NationalCode)), N'') IS NOT NULL
                    OR NULLIF(LTRIM(RTRIM(CompanyNationalId)), N'') IS NOT NULL
                  THEN 0 ELSE 1
                END,
                CreatedAt ASC,
                RequestID ASC
            ) AS rn
          FROM VehicleRequests
          WHERE TrackingNo IS NOT NULL
        ) rankedIdentity
        WHERE rn = 1
          AND (NationalCode IS NOT NULL OR CompanyNationalId IS NOT NULL)
      ) srcIdent ON srcIdent.TrackingNo = vr.TrackingNo
      LEFT JOIN Persons p ON p.NationalCode = COALESCE(
        NULLIF(LTRIM(RTRIM(vr.NationalCode)), N''),
        srcIdent.NationalCode,
        CASE
          WHEN COALESCE(NULLIF(LTRIM(RTRIM(vr.CompanyNationalId)), N''), srcIdent.CompanyNationalId) IS NULL
          THEN NULLIF(LTRIM(RTRIM(v.RegistrarNationalCode)), N'')
        END
      )
      LEFT JOIN CompanyInfo ci ON ci.NationalId = COALESCE(
        NULLIF(LTRIM(RTRIM(vr.CompanyNationalId)), N''),
        srcIdent.CompanyNationalId,
        CASE
          WHEN COALESCE(NULLIF(LTRIM(RTRIM(vr.NationalCode)), N''), srcIdent.NationalCode) IS NULL
          THEN NULLIF(LTRIM(RTRIM(v.RegistrarNationalCode)), N'')
        END
      )
      LEFT JOIN Users u ON vr.SubmittedByUserId = u.Id
      LEFT JOIN LookupValue lt ON vr.LicenseTypeId = lt.Id
      LEFT JOIN LookupValue ot ON vr.OperationTypeId = ot.Id
      LEFT JOIN (
        SELECT DISTINCT RequestID FROM LicensePrintLog
      ) lpl ON vr.RequestID = lpl.RequestID
      LEFT JOIN (
        SELECT lh1.*
        FROM LicenseHistory lh1
        INNER JOIN (
          SELECT TrackingNo, MAX(CreatedAt) AS MaxCreatedAt
          FROM LicenseHistory
          WHERE [Status] = 'Active'
          GROUP BY TrackingNo
        ) lh2 ON lh1.TrackingNo = lh2.TrackingNo AND lh1.CreatedAt = lh2.MaxCreatedAt
      ) lh ON vr.TrackingNo = lh.TrackingNo
      ${whereClause}
      ORDER BY vr.CreatedAt DESC
      OFFSET @Offset ROWS
      FETCH NEXT @PageSize ROWS ONLY
    `;
    
    request.input('Offset', sql.Int, offset);
    request.input('PageSize', sql.Int, pageSize);
    
    const result = await request.query(dataQuery);
    
    res.json({
      data: result.recordset || [],
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize)
    });
  } catch (e) {
    console.error('Error in getAllRequests:', e);
    next(e);
  }
}

// Update request (for edit mode)
const updateRequestSchema = Joi.object({
  finalDescription: Joi.string().allow('', null).max(2000),
  paymentInfo: Joi.object({
    amount: Joi.string().allow('', null),
    paymentDate: Joi.string().allow('', null),
    referenceNumber: Joi.string().allow('', null),
    trackingCode: Joi.string().allow('', null),
    status: Joi.string().allow('', null),
    description: Joi.string().allow('', null).max(1000)
  }).optional()
});

export async function updateRequest(req, res, next) {
  try {
    const requestId = Number(req.params.requestId);
    const userId = req.user.id;
    
    // Get user's roles to check for superadmin
    const pool = await getPool();
    const rolesResult = await pool.request()
      .input('userId', sql.Int, userId)
      .query(`
        SELECT DISTINCT r.Name AS RoleName
        FROM (
          SELECT @userId AS UserId, (SELECT Role FROM Users WHERE Id=@userId) AS RoleName
          UNION ALL
          SELECT ur.UserId, r.Name FROM UserRoles ur JOIN Roles r ON r.Id = ur.RoleId WHERE ur.UserId = @userId
        ) x
        JOIN Roles r ON r.Name = x.RoleName
      `);
    
    const userRoles = rolesResult.recordset.map(r => r.RoleName);
    const hasAdmin = userRoles.includes('Admin');
    const hasDeputyAdmin = userRoles.includes('superadmin');
    
    // Check if user has permission to edit requests
    if (!hasAdmin && !hasDeputyAdmin) {
      return res.status(403).json({ 
        message: 'شما اجازه ویرایش این درخواست را ندارید',
        error: 'Access denied: You do not have permission to edit this request'
      });
    }
    
    if (!requestId) return res.status(400).json({ message: 'Missing requestId' });
    
    const { error, value } = updateRequestSchema.validate(req.body);
    if (error) return res.status(400).json({ message: error.details[0].message });
    
    const { finalDescription, paymentInfo } = value;
    
    const tx = new sql.Transaction(pool);
    await tx.begin();
    
    try {
      // Update request description
      if (finalDescription !== undefined) {
        await new sql.Request(tx)
          .input('RequestID', sql.BigInt, requestId)
          .input('FinalDescription', sql.NVarChar(2000), finalDescription || null)
          .query(`
            UPDATE VehicleRequests
            SET FinalDescription = @FinalDescription
            WHERE RequestID = @RequestID
          `);
      }
      
      // Update or insert payment information
      if (paymentInfo) {
        // Get VehicleID and TrackingNo from request
        const requestInfo = await new sql.Request(tx)
          .input('RequestID', sql.BigInt, requestId)
          .query(`
            SELECT VehicleID, TrackingNo FROM VehicleRequests WHERE RequestID = @RequestID
          `);
        
        if (requestInfo.recordset.length === 0) {
          throw new Error('Request not found');
        }
        
        const { VehicleID, TrackingNo } = requestInfo.recordset[0];
        
        // Check if offline payment exists
        const paymentCheck = await new sql.Request(tx)
          .input('TrackingNo', sql.NVarChar(30), TrackingNo)
          .query(`
            SELECT Id FROM OfflinePayment WHERE TrackingNo = @TrackingNo
          `);
        
        if (paymentCheck.recordset.length > 0) {
          // Update existing offline payment
          await new sql.Request(tx)
            .input('Id', sql.BigInt, paymentCheck.recordset[0].Id)
            .input('Amount', sql.Int, paymentInfo.amount ? parseInt(paymentInfo.amount) : null)
            .input('PayDate', sql.NVarChar(10), paymentInfo.paymentDate || null)
            .input('ReceiptNo', sql.NVarChar(50), paymentInfo.referenceNumber || null)
            .input('Description', sql.NVarChar(sql.MAX), paymentInfo.description || null)
            .query(`
              UPDATE OfflinePayment
              SET Amount = ISNULL(@Amount, Amount),
                  PayDate = ISNULL(@PayDate, PayDate),
                  ReceiptNo = ISNULL(@ReceiptNo, ReceiptNo),
                  Description = ISNULL(@Description, Description)
              WHERE Id = @Id
            `);
        } else if (paymentInfo.amount || paymentInfo.referenceNumber) {
          // Insert new offline payment
          // Use the requestId from function parameter (already available)
          await new sql.Request(tx)
            .input('VehicleID', sql.BigInt, VehicleID)
            .input('TrackingNo', sql.NVarChar(30), TrackingNo)
            .input('Amount', sql.Int, paymentInfo.amount ? parseInt(paymentInfo.amount) : 0)
            .input('PayDate', sql.NVarChar(10), paymentInfo.paymentDate || '')
            .input('ReceiptNo', sql.NVarChar(50), paymentInfo.referenceNumber || '')
            .input('Description', sql.NVarChar(sql.MAX), paymentInfo.description || null)
            .input('UserId', sql.BigInt, userId)
            .input('RequestID', sql.BigInt, requestId)
            .query(`
              INSERT INTO OfflinePayment (VehicleID, TrackingNo, Amount, PayDate, ReceiptNo, Description, UserId, RequestID, CreatedAt)
              VALUES (@VehicleID, @TrackingNo, @Amount, @PayDate, @ReceiptNo, @Description, @UserId, @RequestID, SYSUTCDATETIME())
            `);
        }
      }
      
      // Check if request has deficiency that needs to be returned to sender
      const requestInfoResult = await new sql.Request(tx)
        .input('RequestID', sql.BigInt, requestId)
        .query(`
          SELECT HasDeficiency, DeficiencySenderStepOrder, DeficiencySenderUserId
          FROM VehicleRequests
          WHERE RequestID = @RequestID
        `);
      
      const requestInfo = requestInfoResult.recordset[0];
      let reassignMessage = '';
      let wasReassigned = false;
      
      if (requestInfo && requestInfo.HasDeficiency && requestInfo.DeficiencySenderStepOrder) {
        // This is a deficiency fix - return to the sender
        const senderStepOrder = requestInfo.DeficiencySenderStepOrder;
        const senderUserId = requestInfo.DeficiencySenderUserId;
        
        // Get the sender's step information
        const senderStepResult = await new sql.Request(tx)
          .input('RequestID', sql.BigInt, requestId)
          .input('StepOrder', sql.Int, senderStepOrder)
          .query(`
            SELECT Id, RoleName FROM RequestWorkflowSteps
            WHERE RequestID = @RequestID AND StepOrder = @StepOrder
          `);
        
        if (senderStepResult.recordset.length > 0) {
          const senderStep = senderStepResult.recordset[0];
          
          // Get sender's name
          const senderUserResult = await new sql.Request(tx)
            .input('UserId', sql.Int, senderUserId)
            .query(`SELECT FullName FROM Users WHERE Id = @UserId`);
          
          const senderName = senderUserResult.recordset.length > 0 ? senderUserResult.recordset[0].FullName : senderStep.RoleName;
          
          // Reset the sender's step to Pending
          await new sql.Request(tx)
            .input('StepId', sql.BigInt, senderStep.Id)
            .input('SenderUserId', sql.Int, senderUserId)
            .query(`
              UPDATE RequestWorkflowSteps
              SET Status = 'Pending',
                  AssignedUserId = @SenderUserId,
                  DecidedByUserId = NULL,
                  DecidedAt = NULL,
                  Notes = 'رفع نقص انجام شد - بازگشت از کاربر'
              WHERE Id = @StepId
            `);
          
          // Update request to point to sender's step and clear deficiency flags
          await new sql.Request(tx)
            .input('RequestID', sql.BigInt, requestId)
            .input('CurrentStepOrder', sql.Int, senderStepOrder)
            .query(`
              UPDATE VehicleRequests
              SET CurrentStepOrder = @CurrentStepOrder,
                  HasDeficiency = 0,
                  DeficiencySenderStepOrder = NULL,
                  DeficiencySenderUserId = NULL
              WHERE RequestID = @RequestID
            `);
          
          reassignMessage = ` و پرونده پس از رفع نقص به ${senderName} ارجاع شد`;
          wasReassigned = true;
        }
      } else {
        // Original logic: Find the user who rejected this request
        const rejectorResult = await new sql.Request(tx)
          .input('RequestID', sql.BigInt, requestId)
          .query(`
            SELECT TOP 1 
              rws.Id AS WorkflowStepId,
              rws.DecidedByUserId,
              rws.RoleName,
              u.FullName
            FROM RequestWorkflowSteps rws
            LEFT JOIN Users u ON rws.DecidedByUserId = u.Id
            WHERE rws.RequestID = @RequestID 
              AND rws.Status = 'Rejected'
            ORDER BY rws.DecidedAt DESC
          `);
        
        if (rejectorResult.recordset.length > 0) {
          const rejector = rejectorResult.recordset[0];
          const workflowStepId = rejector.WorkflowStepId;
          const rejectorUserId = rejector.DecidedByUserId;
          const rejectorName = rejector.FullName;
          
          // Reset the rejected workflow step to Pending and assign it back to the rejector
          // Also mark it as corrected by user
          await new sql.Request(tx)
            .input('WorkflowStepId', sql.BigInt, workflowStepId)
            .input('RejectorUserId', sql.Int, rejectorUserId)
            .query(`
              UPDATE RequestWorkflowSteps
              SET Status = 'Pending',
                  AssignedUserId = @RejectorUserId,
                  DecidedByUserId = NULL,
                  DecidedAt = NULL,
                  Notes = 'اصلاح شده توسط کاربر'
              WHERE Id = @WorkflowStepId
            `);
          reassignMessage = ` و پرونده به ${rejectorName} ارجاع مجدد شد`;
          wasReassigned = true;
        }
      }
      
      // Add to process history
      await new sql.Request(tx)
        .input('RequestID', sql.BigInt, requestId)
        .input('ActionType', sql.NVarChar(50), 'Updated')
        .input('ActionByUserId', sql.Int, userId)
        .input('Notes', sql.NVarChar(2000), 'درخواست توسط کاربر ویرایش شد' + reassignMessage)
        .query(`
          INSERT INTO RequestProcessHistory 
          (RequestID, ActionType, ActionByUserId, Notes)
          VALUES (@RequestID, @ActionType, @ActionByUserId, @Notes)
        `);
      
      await tx.commit();
      res.json({ 
        message: 'تغییرات با موفقیت ذخیره شد' + reassignMessage,
        reassigned: wasReassigned
      });
    } catch (err) {
      console.error('❌ Transaction error in updateRequest:', err);
      try {
        await tx.rollback();
      } catch (rollbackErr) {
        console.error('❌ Rollback error:', rollbackErr);
      }
      throw err;
    }
  } catch (e) {
    console.error('❌ Error in updateRequest:', e);
    next(e);
  }
}

// Notify users about request changes
export async function notifyRequestChanges(req, res, next) {
  try {
    const requestId = Number(req.params.requestId);
    const userId = req.user.id;
    
    if (!requestId) return res.status(400).json({ message: 'Missing requestId' });
    
    const pool = await getPool();
    
    // Find the user who rejected this request (if any)
    const rejectorResult = await pool.request()
      .input('RequestID', sql.BigInt, requestId)
      .query(`
        SELECT TOP 1 
          rws.DecidedByUserId,
          u.FullName,
          u.Email
        FROM RequestWorkflowSteps rws
        LEFT JOIN Users u ON rws.DecidedByUserId = u.Id
        WHERE rws.RequestID = @RequestID 
          AND rws.Status = 'Rejected'
        ORDER BY rws.DecidedAt DESC
      `);
    
    if (rejectorResult.recordset.length > 0) {
      const rejector = rejectorResult.recordset[0];
      
      // Get request details for notification
      const requestResult = await pool.request()
        .input('RequestID', sql.BigInt, requestId)
        .query(`
          SELECT TrackingNo FROM VehicleRequests WHERE RequestID = @RequestID
        `);
      
      const trackingNo = requestResult.recordset[0]?.TrackingNo;
      
      // Create notification (you can implement a notifications table or send email)
      // For now, we'll add it to process history
      await pool.request()
        .input('RequestID', sql.BigInt, requestId)
        .input('ActionType', sql.NVarChar(50), 'ChangeNotification')
        .input('ActionByUserId', sql.Int, userId)
        .input('Notes', sql.NVarChar(2000), `تغییراتی در درخواست ${trackingNo} اعمال شد. کاربر ${rejector.FullName} مطلع گردید.`)
        .query(`
          INSERT INTO RequestProcessHistory 
          (RequestID, ActionType, ActionByUserId, Notes)
          VALUES (@RequestID, @ActionType, @ActionByUserId, @Notes)
        `);
      
      res.json({ 
        message: 'اطلاع‌رسانی با موفقیت انجام شد',
        notifiedUser: rejector.FullName
      });
    } else {
      res.json({ message: 'کاربر رد کننده‌ای یافت نشد' });
    }
  } catch (e) {
    next(e);
  }
}

// Delete a request (Admin and superadmin)
export async function deleteRequest(req, res, next) {
  try {
    const requestId = Number(req.params.requestId);
    const userId = req.user.id;
    const userRole = req.user.role;
    
    // Get user's roles to check for superadmin
    const pool = await getPool();
    const rolesResult = await pool.request()
      .input('userId', sql.Int, userId)
      .query(`
        SELECT DISTINCT r.Name AS RoleName
        FROM (
          SELECT @userId AS UserId, (SELECT Role FROM Users WHERE Id=@userId) AS RoleName
          UNION ALL
          SELECT ur.UserId, r.Name FROM UserRoles ur JOIN Roles r ON r.Id = ur.RoleId WHERE ur.UserId = @userId
        ) x
        JOIN Roles r ON r.Name = x.RoleName
      `);
    
    const userRoles = rolesResult.recordset.map(r => r.RoleName);
    const hasAdmin = userRoles.includes('Admin');
    const hasDeputyAdmin = userRoles.includes('superadmin');
    
    if (!requestId) {
      return res.status(400).json({ message: 'شناسه درخواست الزامی است' });
    }
    
    // Admin and superadmin can delete requests
    if (!hasAdmin && !hasDeputyAdmin) {
      return res.status(403).json({ message: 'فقط مدیر سیستم و superadmin می‌توانند پرونده را حذف کنند' });
    }
    
    console.log(`🗑️ Admin user ${userId} attempting to delete request ${requestId}`);
    
    // Check if request exists
    const checkResult = await pool.request()
      .input('RequestID', sql.BigInt, requestId)
      .query('SELECT RequestID, TrackingNo, VehicleID FROM VehicleRequests WHERE RequestID = @RequestID');
    
    if (checkResult.recordset.length === 0) {
      return res.status(404).json({ message: 'پرونده یافت نشد' });
    }
    
    const request = checkResult.recordset[0];
    const vehicleId = request.VehicleID;
    
    // Delete in transaction to ensure data integrity
    const transaction = pool.transaction();
    await transaction.begin();
    
    try {
      // Delete workflow steps
      await new sql.Request(transaction)
        .input('RequestID', sql.BigInt, requestId)
        .query('DELETE FROM RequestWorkflowSteps WHERE RequestID = @RequestID');
      
      // Delete process history
      await new sql.Request(transaction)
        .input('RequestID', sql.BigInt, requestId)
        .query('DELETE FROM RequestProcessHistory WHERE RequestID = @RequestID');
      
      // Delete online payments
      await new sql.Request(transaction)
        .input('RequestID', sql.BigInt, requestId)
        .query('DELETE FROM OnlinePayment WHERE RequestID = @RequestID');
      
      // Delete offline payments
      await new sql.Request(transaction)
        .input('RequestID', sql.BigInt, requestId)
        .query('DELETE FROM OfflinePayment WHERE RequestID = @RequestID');
      
      // Delete discount documents
      await new sql.Request(transaction)
        .input('RequestID', sql.BigInt, requestId)
        .query('DELETE FROM VehicleDiscountDocuments WHERE RequestID = @RequestID');
      
      // Delete vehicle labels
      await new sql.Request(transaction)
        .input('RequestID', sql.BigInt, requestId)
        .query('DELETE FROM VehicleLabel WHERE RequestID = @RequestID');
      
      // Delete license print logs
      await new sql.Request(transaction)
        .input('RequestID', sql.BigInt, requestId)
        .query('DELETE FROM LicensePrintLog WHERE RequestID = @RequestID');

      // Delete license history records (to satisfy FK constraints)
      await new sql.Request(transaction)
        .input('RequestID', sql.BigInt, requestId)
        .query('DELETE FROM LicenseHistory WHERE RequestID = @RequestID');
      
      // Delete the request itself
      await new sql.Request(transaction)
        .input('RequestID', sql.BigInt, requestId)
        .query('DELETE FROM VehicleRequests WHERE RequestID = @RequestID');
      
      await transaction.commit();
      
      console.log(`✅ Request ${requestId} deleted successfully by admin user ${userId}`);
      
      res.json({ 
        message: 'پرونده با موفقیت حذف شد',
        deletedRequestId: requestId,
        trackingNo: request.TrackingNo
      });
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  } catch (e) {
    console.error('❌ Error deleting request:', e);
    next(e);
  }
}

// Admin-only: Manually fix workflow status and step
const adminFixStatusSchema = Joi.object({
  targetStatus: Joi.string().required().max(50),
  targetStepOrder: Joi.number().integer().required().min(0),
  assignedUserId: Joi.number().integer().optional().allow(null),
  notes: Joi.string().allow('', null).max(2000)
});

export async function adminFixWorkflowStatus(req, res, next) {
  try {
    const requestId = Number(req.params.requestId);
    const userId = req.user.id;
    const userRole = req.user.role;

    if (!requestId) {
      return res.status(400).json({ message: 'شناسه درخواست الزامی است' });
    }

    // Only Admin can use this powerful operation
    if (userRole !== 'Admin') {
      return res.status(403).json({ message: 'فقط مدیر سیستم می‌تواند وضعیت گردش‌کار را به صورت دستی اصلاح کند' });
    }

    const { error, value } = adminFixStatusSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ message: error.details[0].message });
    }

    const { targetStatus, targetStepOrder, assignedUserId, notes } = value;

    const pool = await getPool();
    const tx = new sql.Transaction(pool);
    await tx.begin();

    try {
      // Load current request state
      const currentReqResult = await new sql.Request(tx)
        .input('RequestID', sql.BigInt, requestId)
        .query(`
          SELECT RequestID, TrackingNo, Status, CurrentStepOrder
          FROM VehicleRequests
          WHERE RequestID = @RequestID
        `);

      if (currentReqResult.recordset.length === 0) {
        throw new Error('Request not found');
      }

      const currentReq = currentReqResult.recordset[0];
      const oldStatus = currentReq.Status || 'Pending';
      const oldStepOrder = currentReq.CurrentStepOrder;

      // Update VehicleRequests with new status and step
      let completedAt = null;
      const normalizedStatus = String(targetStatus);
      if (normalizedStatus === 'Approved' || normalizedStatus === 'Rejected' || normalizedStatus === 'Completed' || normalizedStatus === 'Cancelled') {
        completedAt = new Date();
      }

      await new sql.Request(tx)
        .input('RequestID', sql.BigInt, requestId)
        .input('Status', sql.NVarChar(50), normalizedStatus)
        .input('CurrentStepOrder', sql.Int, targetStepOrder)
        .input('CompletedAt', sql.DateTime2, completedAt)
        .query(`
          UPDATE VehicleRequests
          SET Status = @Status,
              CurrentStepOrder = @CurrentStepOrder,
              CompletedAt = @CompletedAt
          WHERE RequestID = @RequestID
        `);

      // Update target workflow step to Pending and adjust assignment
      const stepResult = await new sql.Request(tx)
        .input('RequestID', sql.BigInt, requestId)
        .input('StepOrder', sql.Int, targetStepOrder)
        .query(`
          SELECT Id, RoleName
          FROM RequestWorkflowSteps
          WHERE RequestID = @RequestID AND StepOrder = @StepOrder
        `);

      if (stepResult.recordset.length > 0) {
        const step = stepResult.recordset[0];

        await new sql.Request(tx)
          .input('StepId', sql.BigInt, step.Id)
          .input('Status', sql.NVarChar(50), normalizedStatus)
          .input('AssignedUserId', sql.Int, assignedUserId || null)
          .query(`
            UPDATE RequestWorkflowSteps
            SET Status = @Status,
                AssignedUserId = @AssignedUserId,
                DecidedByUserId = NULL,
                DecidedAt = NULL
            WHERE Id = @StepId
          `);
      }

      // Log admin change in process history
      const adminNotes = notes || '';
      const historyNotes = `اصلاح وضعیت توسط مدیر سیستم. از وضعیت ${oldStatus} (مرحله ${oldStepOrder ?? '-'} ) به ${normalizedStatus} (مرحله ${targetStepOrder}). ${adminNotes}`;

      await new sql.Request(tx)
        .input('RequestID', sql.BigInt, requestId)
        .input('ActionType', sql.NVarChar(50), 'AdminStatusChange')
        .input('ActionByUserId', sql.Int, userId)
        .input('Notes', sql.NVarChar(2000), historyNotes)
        .query(`
          INSERT INTO RequestProcessHistory
          (RequestID, ActionType, ActionByUserId, Notes)
          VALUES (@RequestID, @ActionType, @ActionByUserId, @Notes)
        `);

      await tx.commit();

      res.json({
        success: true,
        message: 'وضعیت و مرحله پرونده با موفقیت توسط مدیر اصلاح شد',
        oldStatus,
        oldStepOrder,
        newStatus: normalizedStatus,
        newStepOrder: targetStepOrder
      });
    } catch (err) {
      await tx.rollback();
      throw err;
    }
  } catch (e) {
    console.error('❌ Error in adminFixWorkflowStatus:', e);
    next(e);
  }
}

// Discount approval schema
const discountApprovalSchema = Joi.object({
  decision: Joi.string().valid('Approved', 'Rejected').required(),
  notes: Joi.string().allow('', null).max(1000),
  approvedDiscounts: Joi.array().items(
    Joi.object({
      docTypeId: Joi.number().integer().required(),
      percentage: Joi.number().min(0).max(100).required()
    })
  ).when('decision', {
    is: 'Approved',
    then: Joi.required(),
    otherwise: Joi.optional()
  })
});

// Approve or reject discount request
export async function approveDiscount(req, res, next) {
  try {
    const requestId = Number(req.params.requestId);
    const userId = req.user.id;
    const userRole = req.user.role;
    
    if (!requestId) {
      return res.status(400).json({ message: 'شناسه درخواست الزامی است' });
    }
    
    // Validate request body
    const { error, value } = discountApprovalSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ message: error.message });
    }
    
    const { decision, notes, approvedDiscounts } = value;
    
    // Only license specialist can approve discounts
    if (userRole !== 'کارشناس صدور پروانه' && userRole !== 'Admin') {
      return res.status(403).json({ message: 'فقط کارشناس صدور پروانه می‌تواند تخفیف را تایید یا رد کند' });
    }
    
    console.log(`💰 User ${userId} (${userRole}) ${decision === 'Approved' ? 'approving' : 'rejecting'} discount for request ${requestId}`);
    
    const pool = await getPool();
    
    // Get request details
    const requestResult = await pool.request()
      .input('RequestID', sql.BigInt, requestId)
      .query(`
        SELECT 
          vr.RequestID,
          vr.TrackingNo,
          vr.VehicleID,
          vr.DiscountStatus,
          vr.OriginalAmount,
          v.VehicleTypeId
        FROM VehicleRequests vr
        INNER JOIN Vehicles v ON vr.VehicleID = v.VehicleID
        WHERE vr.RequestID = @RequestID
      `);
    
    if (requestResult.recordset.length === 0) {
      return res.status(404).json({ message: 'درخواست یافت نشد' });
    }
    
    const request = requestResult.recordset[0];
    
    // Check if discount is pending
    if (request.DiscountStatus !== 'Pending') {
      return res.status(400).json({ message: 'وضعیت تخفیف این درخواست قابل تغییر نیست' });
    }
    
    let discountAmount = 0;
    let finalAmount = request.OriginalAmount || 0;
    
    if (decision === 'Approved' && approvedDiscounts && approvedDiscounts.length > 0) {
      // Calculate total discount percentage (additive)
      const totalDiscountPercentage = approvedDiscounts.reduce((sum, d) => sum + d.percentage, 0);
      
      // Cap at 100%
      const cappedPercentage = Math.min(totalDiscountPercentage, 100);
      
      // Calculate discount amount
      discountAmount = (request.OriginalAmount * cappedPercentage) / 100;
      finalAmount = request.OriginalAmount - discountAmount;
      
      console.log(`💵 Discount calculation: ${request.OriginalAmount} - ${discountAmount} (${cappedPercentage}%) = ${finalAmount}`);
    }
    
    // Update request with discount decision
    await pool.request()
      .input('RequestID', sql.BigInt, requestId)
      .input('DiscountStatus', sql.NVarChar(20), decision === 'Approved' ? 'Approved' : 'Rejected')
      .input('DiscountAmount', sql.Decimal(18, 2), discountAmount)
      .input('FinalAmount', sql.Decimal(18, 2), finalAmount)
      .input('DiscountApprovedBy', sql.Int, userId)
      .input('DiscountApprovedAt', sql.DateTime2, new Date())
      .input('DiscountNotes', sql.NVarChar(1000), notes || null)
      .query(`
        UPDATE VehicleRequests
        SET 
          DiscountStatus = @DiscountStatus,
          DiscountAmount = @DiscountAmount,
          FinalAmount = @FinalAmount,
          DiscountApprovedBy = @DiscountApprovedBy,
          DiscountApprovedAt = @DiscountApprovedAt,
          DiscountNotes = @DiscountNotes
        WHERE RequestID = @RequestID
      `);
    
    // Add to process history
    await pool.request()
      .input('RequestID', sql.BigInt, requestId)
      .input('ActionType', sql.NVarChar(50), decision === 'Approved' ? 'DiscountApproved' : 'DiscountRejected')
      .input('ActionByUserId', sql.Int, userId)
      .input('Notes', sql.NVarChar(2000), 
        decision === 'Approved' 
          ? `تخفیف تایید شد. مبلغ اصلی: ${request.OriginalAmount} ریال، تخفیف: ${discountAmount} ریال، مبلغ نهایی: ${finalAmount} ریال. ${notes || ''}`
          : `تخفیف رد شد. ${notes || ''}`
      )
      .query(`
        INSERT INTO RequestProcessHistory 
        (RequestID, ActionType, ActionByUserId, Notes)
        VALUES (@RequestID, @ActionType, @ActionByUserId, @Notes)
      `);
    
    // Mark the discount approval workflow step as complete
    await pool.request()
      .input('RequestID', sql.BigInt, requestId)
      .input('Status', sql.NVarChar(20), decision === 'Approved' ? 'Approved' : 'Rejected')
      .input('ProcessedByUserId', sql.Int, userId)
      .input('ProcessedAt', sql.DateTime2, new Date())
      .input('Notes', sql.NVarChar(2000), notes || null)
      .query(`
        UPDATE RequestWorkflowSteps
        SET Status = @Status,
            ProcessedByUserId = @ProcessedByUserId,
            ProcessedAt = @ProcessedAt,
            Notes = @Notes
        WHERE RequestID = @RequestID AND StepOrder = 0
      `);
    
    // Update request status to 'Pending' (waiting for payment)
    // Do NOT mark as Completed - that happens after payment and full workflow
    await pool.request()
      .input('RequestID', sql.BigInt, requestId)
      .input('Status', sql.NVarChar(20), 'Pending')
      .query(`
        UPDATE VehicleRequests
        SET Status = @Status
        WHERE RequestID = @RequestID
      `);
    
    console.log(`✅ Discount ${decision} for request ${requestId}, status set to Pending (awaiting payment)`);
    
    res.json({
      message: decision === 'Approved' ? 'تخفیف با موفقیت تایید شد. کاربر می‌تواند پرداخت کند.' : 'تخفیف رد شد. کاربر می‌تواند پرداخت کند.',
      discountStatus: decision === 'Approved' ? 'Approved' : 'Rejected',
      originalAmount: request.OriginalAmount,
      discountAmount: discountAmount,
      finalAmount: finalAmount,
      canProceedToPayment: true
    });
  } catch (e) {
    console.error('❌ Error approving discount:', e);
    next(e);
  }
}

// Get deficiency status for a request
export async function getDeficiencyStatus(req, res, next) {
  try {
    const requestId = Number(req.params.requestId);
    const userId = req.user.id;
    const userRole = req.user.role;
    
    if (!requestId) {
      return res.status(400).json({ message: 'Missing requestId' });
    }
    
    const pool = await getPool();
    
    // Get user's roles to check for superadmin
    const rolesResult = await pool.request()
      .input('userId', sql.Int, userId)
      .query(`
        SELECT DISTINCT r.Name AS RoleName
        FROM (
          SELECT @userId AS UserId, (SELECT Role FROM Users WHERE Id=@userId) AS RoleName
          UNION ALL
          SELECT ur.UserId, r.Name FROM UserRoles ur JOIN Roles r ON r.Id = ur.RoleId WHERE ur.UserId = @userId
        ) x
        JOIN Roles r ON r.Name = x.RoleName
      `);
    
    const userRoles = rolesResult.recordset.map(r => r.RoleName);
    const hasAdmin = userRoles.includes('Admin');
    const hasDeputyAdmin = userRoles.includes('superadmin');
    
    // Get the request and check if user is the owner
    const requestResult = await pool.request()
      .input('RequestID', sql.BigInt, requestId)
      .input('UserId', sql.Int, userId)
      .query(`
        SELECT 
          vr.HasDeficiency,
          vr.DeficiencySenderStepOrder,
          vr.DeficiencySenderUserId,
          vr.SubmittedByUserId
        FROM VehicleRequests vr
        WHERE vr.RequestID = @RequestID
      `);
    
    if (requestResult.recordset.length === 0) {
      return res.status(404).json({ message: 'Request not found' });
    }
    
    const request = requestResult.recordset[0];
    
    // Admin and superadmin can view any request's deficiency status
    // Regular users can only view their own requests
    if (!hasAdmin && !hasDeputyAdmin && request.SubmittedByUserId !== userId) {
      return res.status(403).json({ message: 'You do not have permission to view this request' });
    }
    
    res.json({
      hasDeficiency: request.HasDeficiency === 1 || request.HasDeficiency === true,
      deficiencySenderStepOrder: request.DeficiencySenderStepOrder,
      deficiencySenderUserId: request.DeficiencySenderUserId
    });
  } catch (e) {
    console.error('❌ Error getting deficiency status:', e);
    next(e);
  }
}

// Submit corrections after fixing deficiency
export async function submitCorrections(req, res, next) {
  try {
    const requestId = Number(req.params.requestId);
    const userId = req.user.id;
    const userName = req.user.username;
    
    if (!requestId) {
      return res.status(400).json({ message: 'Missing requestId' });
    }
    
    const pool = await getPool();
    const tx = new sql.Transaction(pool);
    await tx.begin();
    
    try {
      // Get the request and verify ownership and deficiency status
      const requestResult = await new sql.Request(tx)
        .input('RequestID', sql.BigInt, requestId)
        .input('UserId', sql.Int, userId)
        .query(`
          SELECT 
            vr.HasDeficiency,
            vr.DeficiencySenderStepOrder,
            vr.DeficiencySenderUserId,
            vr.SubmittedByUserId,
            vr.TrackingNo
          FROM VehicleRequests vr
          WHERE vr.RequestID = @RequestID
        `);
      
      if (requestResult.recordset.length === 0) {
        await tx.rollback();
        return res.status(404).json({ message: 'Request not found' });
      }
      
      const request = requestResult.recordset[0];
      
      // Check if user is the owner of the request
      if (request.SubmittedByUserId !== userId) {
        await tx.rollback();
        return res.status(403).json({ message: 'You do not have permission to modify this request' });
      }
      
      // Check if request has deficiency
      if (!request.HasDeficiency || !request.DeficiencySenderStepOrder) {
        await tx.rollback();
        return res.status(400).json({ message: 'This request does not have a deficiency status' });
      }
      
      // DeficiencySenderStepOrder now contains the STEP ID (not StepOrder)
      // This was changed to fix the issue where StepOrder can change based on payment type
      const senderStepId = request.DeficiencySenderStepOrder;
      const senderUserId = request.DeficiencySenderUserId;
      
      console.log('📋 Deficiency sender info:', {
        senderStepId,
        senderUserId,
        requestId
      });
      
      // Get the sender's step information by ID (not StepOrder)
      const senderStepResult = await new sql.Request(tx)
        .input('StepId', sql.BigInt, senderStepId)
        .query(`
          SELECT Id, RoleName, Status, StepOrder, DecidedByUserId
          FROM RequestWorkflowSteps
          WHERE Id = @StepId
        `);
      
      console.log('📋 Sender step query result:', senderStepResult.recordset);
      
      if (senderStepResult.recordset.length === 0) {
        await tx.rollback();
        return res.status(400).json({ message: 'Sender step not found' });
      }
      
      const senderStep = senderStepResult.recordset[0];
      console.log('📋 Sender step found:', senderStep);
      
      // Use the role name for the message (not the user's full name)
      const senderName = senderStep.RoleName;
      
      // Mark all previous steps as Completed so they don't block the inbox query
      console.log('🔄 Marking previous steps as Completed');
      await new sql.Request(tx)
        .input('RequestID', sql.BigInt, requestId)
        .input('TargetStepOrder', sql.Int, senderStep.StepOrder)
        .query(`
          UPDATE RequestWorkflowSteps
          SET Status = 'Completed',
              DecidedAt = SYSUTCDATETIME(),
              Notes = ISNULL(Notes, '') + ' [Auto-completed for deficiency fix]'
          WHERE RequestID = @RequestID 
            AND StepOrder < @TargetStepOrder
            AND Status = 'Pending'
        `);
      
      // Reset the sender's step to Pending
      console.log('🔄 Resetting sender step to Pending:', {
        stepId: senderStep.Id,
        roleName: senderStep.RoleName,
        assignedUserId: senderUserId
      });
      
      await new sql.Request(tx)
        .input('StepId', sql.BigInt, senderStep.Id)
        .input('SenderUserId', sql.Int, senderUserId)
        .query(`
          UPDATE RequestWorkflowSteps
          SET Status = 'Pending',
              AssignedUserId = @SenderUserId,
              DecidedByUserId = NULL,
              DecidedAt = NULL,
              Notes = 'رفع نقص انجام شد - بازگشت از کاربر'
          WHERE Id = @StepId
        `);
      
      // Update request to point to sender's step and clear deficiency flags
      console.log('🔄 Updating request CurrentStepOrder to:', senderStep.StepOrder);
      
      await new sql.Request(tx)
        .input('RequestID', sql.BigInt, requestId)
        .input('CurrentStepOrder', sql.Int, senderStep.StepOrder)
        .query(`
          UPDATE VehicleRequests
          SET CurrentStepOrder = @CurrentStepOrder,
              HasDeficiency = 0,
              DeficiencySenderStepOrder = NULL,
              DeficiencySenderUserId = NULL
          WHERE RequestID = @RequestID
        `);
      
      // Add to process history
      await new sql.Request(tx)
        .input('RequestID', sql.BigInt, requestId)
        .input('ActionType', sql.NVarChar(50), 'CorrectionSubmitted')
        .input('ActionByUserId', sql.Int, userId)
        .input('ActionByUserName', sql.NVarChar(100), userName)
        .input('Notes', sql.NVarChar(sql.MAX), `رفع نقص انجام شد و پرونده به ${senderName} ارجاع شد`)
        .query(`
          INSERT INTO RequestProcessHistory (
            RequestID, ActionType, ActionByUserId, ActionByUserName, 
            Notes, CreatedAt
          )
          VALUES (
            @RequestID, @ActionType, @ActionByUserId, @ActionByUserName,
            @Notes, SYSUTCDATETIME()
          )
        `);
      
      await tx.commit();
      
      console.log(`✅ Corrections submitted for request ${requestId}, reassigned to ${senderName}`);
      
      res.json({
        message: `پرونده با موفقیت به ${senderName} ارجاع شد`,
        trackingNo: request.TrackingNo,
        reassignedTo: senderName,
        reassignedToStepOrder: senderStep.StepOrder
      });
    } catch (err) {
      try {
        await tx.rollback();
      } catch (rollbackErr) {
        console.error('Error rolling back transaction:', rollbackErr);
      }
      throw err;
    }
  } catch (e) {
    console.error('❌ Error submitting corrections:', e);
    next(e);
  }
}

// Check if company already has an existing exploitation license request
export async function checkExistingExploitationLicense(req, res, next) {
  try {
    const { registrationNo, nationalId } = req.query;
    
    if (!registrationNo && !nationalId) {
      return res.status(400).json({ message: 'Registration number or National ID is required' });
    }
    
    const pool = await getPool();
    
    // First, find the company by registration number or national ID
    let companyQuery = '';
    let inputParam = '';
    
    if (registrationNo) {
      companyQuery = 'SELECT NationalId, CompanyName, RegistrationNo FROM CompanyInfo WHERE RegistrationNo = @RegistrationNo';
      inputParam = registrationNo;
    } else {
      companyQuery = 'SELECT NationalId, CompanyName, RegistrationNo FROM CompanyInfo WHERE NationalId = @NationalId';
      inputParam = nationalId;
    }
    
    const companyResult = await pool.request()
      .input(registrationNo ? 'RegistrationNo' : 'NationalId', sql.NVarChar(50), inputParam)
      .query(companyQuery);
    
    if (companyResult.recordset.length === 0) {
      // Company doesn't exist yet, so no existing request
      return res.json({ exists: false });
    }
    
    const company = companyResult.recordset[0];
    
    // Check if there's an existing exploitation license request for this company
    // LicenseTypeId = 68 for exploitation licenses (پروانه بهره‌برداری)
    const requestResult = await pool.request()
      .input('NationalId', sql.NVarChar(50), company.NationalId)
      .query(`
        SELECT TOP 1
          vr.RequestID,
          vr.TrackingNo,
          vr.Status,
          vr.CreatedAt,
          lt.Name AS LicenseTypeName
        FROM VehicleRequests vr
        INNER JOIN CompanyInfo ci ON vr.NationalCode = ci.NationalCode
        LEFT JOIN LookupValue lt ON vr.LicenseTypeId = lt.Id
        WHERE ci.NationalId = @NationalId
          AND vr.LicenseTypeId = 68
        ORDER BY vr.CreatedAt DESC
      `);
    
    if (requestResult.recordset.length > 0) {
      const existingRequest = requestResult.recordset[0];
      console.log(`✅ Found existing exploitation license for company: ${company.CompanyName}`);
      
      return res.json({
        exists: true,
        request: {
          requestId: existingRequest.RequestID,
          trackingNo: existingRequest.TrackingNo,
          status: existingRequest.Status,
          createdAt: existingRequest.CreatedAt,
          licenseTypeName: existingRequest.LicenseTypeName
        },
        company: {
          nationalId: company.NationalId,
          companyName: company.CompanyName,
          registrationNo: company.RegistrationNo
        }
      });
    }
    
    console.log(`ℹ️ No existing exploitation license found for company: ${company.CompanyName}`);
    return res.json({ exists: false });
    
  } catch (e) {
    console.error('❌ Error checking existing exploitation license:', e);
    next(e);
  }
}

function cancellationUploadDir() {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../uploads/cancellations');
}

function cancelFlowKey(source) {
  const name = String(source.LicenseTypeName || '');
  const tracking = String(source.TrackingNo || '');
  if (source.LicenseTypeId === 68 || tracking.startsWith('11') || name.includes('بهره')) return 'Exploitation_Cancel';
  if (source.LicenseTypeId === 67 || tracking.startsWith('2') || name.includes('اشتغال')) return 'Employment_Cancel';
  return 'Activity_Cancel';
}

async function ensureCancelOperationType(pool) {
  const existing = await pool.request()
    .query(`SELECT TOP 1 Id FROM LookupValue WHERE Name = N'ابطال' ORDER BY Id`);
  if (existing.recordset[0]?.Id) return existing.recordset[0].Id;

  const sample = await pool.request()
    .query(`SELECT TOP 1 CategoryId FROM LookupValue WHERE Name = N'تمدید' ORDER BY Id`);
  const categoryId = sample.recordset[0]?.CategoryId;
  if (!categoryId) {
    const error = new Error('نوع عملیات ابطال در سیستم تعریف نشده است');
    error.statusCode = 500;
    throw error;
  }
  const inserted = await pool.request()
    .input('CategoryId', sql.Int, categoryId)
    .query(`
      INSERT INTO LookupValue (CategoryId, Code, Name, IsActive, IsRequired, SortOrder)
      OUTPUT INSERTED.Id
      VALUES (@CategoryId, N'CANCEL', N'ابطال', 1, 0, 90)
    `);
  return inserted.recordset[0].Id;
}

async function deactivateApprovedLicense(pool, requestDetails, { userId, userName, roleName }) {
  const reason = String(requestDetails.FinalDescription || 'ابطال پروانه').slice(0, 2000);
  const today = getCurrentShamsiDate();
  const current = await pool.request()
    .input('TrackingNo', sql.NVarChar(30), requestDetails.TrackingNo)
    .query(`
      SELECT TOP 1 IssueDate, ExpiryDate
      FROM LicenseHistory
      WHERE TrackingNo = @TrackingNo AND Status = N'Active'
      ORDER BY HistoryID DESC
    `);
  const issueDate = current.recordset[0]?.IssueDate || today;
  const expiryDate = current.recordset[0]?.ExpiryDate || today;

  await pool.request()
    .input('TrackingNo', sql.NVarChar(30), requestDetails.TrackingNo)
    .input('UserId', sql.Int, userId || null)
    .input('UserName', sql.NVarChar(150), userName || null)
    .input('Reason', sql.NVarChar(2000), reason)
    .query(`
      UPDATE LicenseHistory
      SET Status = N'Cancelled',
          RevokedAt = SYSUTCDATETIME(),
          RevokedByUserId = @UserId,
          RevokedByUsername = @UserName,
          RevocationReason = @Reason,
          UpdatedAt = SYSUTCDATETIME()
      WHERE TrackingNo = @TrackingNo AND Status = N'Active'
    `);

  await pool.request()
    .input('TrackingNo', sql.NVarChar(30), requestDetails.TrackingNo)
    .input('RequestID', sql.BigInt, requestDetails.RequestID)
    .query(`
      UPDATE VehicleRequests
      SET Status = N'Cancelled'
      WHERE TrackingNo = @TrackingNo
        AND RequestID <> @RequestID
        AND Status = N'Approved'
    `);

  await logLicenseHistory({
    requestId: requestDetails.RequestID,
    trackingNo: requestDetails.TrackingNo,
    licenseTypeId: requestDetails.LicenseTypeId,
    licenseTypeName: requestDetails.LicenseTypeName,
    operationTypeId: requestDetails.OperationTypeId,
    operationTypeName: requestDetails.OperationTypeName,
    eventType: 'Cancelled',
    vehicleId: requestDetails.VehicleID,
    nationalCode: requestDetails.NationalCode,
    companyNationalId: requestDetails.CompanyNationalId,
    issueDate,
    expiryDate,
    validityDurationMonths: 0,
    status: 'Cancelled',
    issuedByUserId: userId,
    issuedByUsername: userName,
    issuedByRole: roleName,
    notes: reason
  });
}

export async function startLicenseCancellation(req, res, next) {
  try {
    const sourceId = Number(req.params.requestId);
    const reason = String(req.body?.reason || '').trim();
    if (!sourceId) return res.status(400).json({ message: 'پرونده نامعتبر است' });
    if (!reason) return res.status(400).json({ message: 'توضیحات دلیل ابطال را به طور کامل وارد کنید.' });
    if (req.file && req.file.size > 2 * 1024 * 1024) {
      return res.status(400).json({ message: 'حجم فایل نباید بیشتر از 2 مگابایت باشد.' });
    }

    const pool = await getPool();
    const sourceResult = await pool.request()
      .input('RequestID', sql.BigInt, sourceId)
      .query(`
        SELECT vr.RequestID, vr.TrackingNo, vr.Status, vr.LicenseTypeId, vr.VehicleID,
               vr.NationalCode, vr.CompanyNationalId, vr.SubmittedByUserId, lt.Name AS LicenseTypeName
        FROM VehicleRequests vr
        LEFT JOIN LookupValue lt ON vr.LicenseTypeId = lt.Id
        WHERE vr.RequestID = @RequestID
      `);
    const source = sourceResult.recordset[0];
    if (!source) return res.status(404).json({ message: 'پرونده یافت نشد' });
    const roles = [req.user?.role, ...(req.user?.roles || [])].filter(Boolean);
    const isStaff = roles.includes('Admin') || roles.includes('superadmin');
    const isOwner = Number(source.SubmittedByUserId) === Number(req.user?.id);
    if (!isStaff && !isOwner) {
      return res.status(403).json({ message: 'اجازه ثبت ابطال را ندارید' });
    }
    if (source.Status !== 'Approved') {
      return res.status(400).json({ message: 'فقط پرونده‌ای که پروانه دارد قابل ابطال است' });
    }

    const activeLicense = await pool.request()
      .input('TrackingNo', sql.NVarChar(30), source.TrackingNo)
      .query(`
        SELECT TOP 1 HistoryID
        FROM LicenseHistory
        WHERE TrackingNo = @TrackingNo AND Status = N'Active'
      `);
    if (!activeLicense.recordset[0]) {
      return res.status(400).json({ message: 'این پرونده پروانه فعال ندارد' });
    }

    const openCancellation = await pool.request()
      .input('TrackingNo', sql.NVarChar(30), source.TrackingNo)
      .query(`
        SELECT TOP 1 vr.RequestID
        FROM VehicleRequests vr
        INNER JOIN LookupValue ot ON vr.OperationTypeId = ot.Id
        WHERE vr.TrackingNo = @TrackingNo
          AND ot.Name LIKE N'%ابطال%'
          AND vr.Status IN (N'Pending', N'InProgress', N'AwaitingPayment')
      `);
    if (openCancellation.recordset[0]) {
      return res.status(400).json({ message: 'برای این پروانه یک درخواست ابطال در حال بررسی است' });
    }

    const flowKey = cancelFlowKey(source);
    const flowResult = await pool.request()
      .input('LicenseType', sql.NVarChar(30), flowKey)
      .query(`
        SELECT StepOrder, RoleName
        FROM GlobalApprovalFlowSteps
        WHERE LicenseType = @LicenseType
        ORDER BY StepOrder
      `);
    if (!flowResult.recordset.length) {
      return res.status(400).json({ message: 'فرآیند تایید ابطال این نوع پروانه در مدیریت فرآیند تایید تعریف نشده است' });
    }

    const operationTypeId = await ensureCancelOperationType(pool);
    const inserted = await pool.request()
      .input('NationalCode', sql.NVarChar(20), source.NationalCode || null)
      .input('CompanyNationalId', sql.NVarChar(100), source.CompanyNationalId || null)
      .input('VehicleID', sql.BigInt, source.VehicleID || null)
      .input('LicenseTypeId', sql.Int, source.LicenseTypeId)
      .input('OperationTypeId', sql.Int, operationTypeId)
      .input('FinalDescription', sql.NVarChar(2000), reason.slice(0, 2000))
      .input('TrackingNo', sql.NVarChar(30), source.TrackingNo)
      .input('SubmittedByUserId', sql.Int, req.user.id)
      .query(`
        INSERT INTO VehicleRequests (
          NationalCode, CompanyNationalId, VehicleID, LicenseTypeId, OperationTypeId,
          FinalDescription, TrackingNo, SubmittedByUserId, DiscountStatus, OriginalAmount, FinalAmount
        )
        OUTPUT INSERTED.RequestID
        VALUES (
          @NationalCode, @CompanyNationalId, @VehicleID, @LicenseTypeId, @OperationTypeId,
          @FinalDescription, @TrackingNo, @SubmittedByUserId, N'None', 0, 0
        )
      `);
    const newRequestId = inserted.recordset[0]?.RequestID;
    if (!newRequestId) return res.status(500).json({ message: 'ثبت درخواست ابطال انجام نشد' });

    if (req.file) {
      const dir = cancellationUploadDir();
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, `${newRequestId}.bin`), req.file.buffer);
      fs.writeFileSync(path.join(dir, `${newRequestId}.json`), JSON.stringify({
        fileName: req.file.originalname,
        mimeType: req.file.mimetype || 'application/octet-stream',
        size: req.file.size
      }));
    }

    const firstStepOrder = Math.min(...flowResult.recordset.map((step) => Number(step.StepOrder)));
    let firstRole = '';
    for (const step of flowResult.recordset) {
      const isFirst = Number(step.StepOrder) === firstStepOrder;
      if (isFirst) firstRole = step.RoleName;
      await pool.request()
        .input('RequestID', sql.BigInt, newRequestId)
        .input('StepOrder', sql.Int, step.StepOrder)
        .input('RoleName', sql.NVarChar(50), step.RoleName)
        .input('Status', sql.NVarChar(20), isFirst ? 'Pending' : 'NotStarted')
        .query(`
          INSERT INTO RequestWorkflowSteps (RequestID, StepOrder, RoleName, Status, Notes, CreatedAt)
          VALUES (@RequestID, @StepOrder, @RoleName, @Status, NULL, GETDATE())
        `);
    }

    await pool.request()
      .input('RequestID', sql.BigInt, newRequestId)
      .input('CurrentStepOrder', sql.Int, firstStepOrder)
      .query(`
        UPDATE VehicleRequests
        SET Status = N'InProgress', CurrentStepOrder = @CurrentStepOrder
        WHERE RequestID = @RequestID
      `);

    await pool.request()
      .input('RequestID', sql.BigInt, newRequestId)
      .input('ActionByUserId', sql.Int, req.user.id)
      .input('ActionByUserName', sql.NVarChar(150), req.user.username || 'System')
      .input('StepOrder', sql.Int, firstStepOrder)
      .input('Notes', sql.NVarChar(sql.MAX), `درخواست ابطال ثبت شد و برای بررسی به ${firstRole} ارجاع شد`)
      .query(`
        INSERT INTO RequestProcessHistory
          (RequestID, ActionType, ActionByUserId, ActionByUserName, FromStatus, ToStatus, StepOrder, Notes)
        VALUES
          (@RequestID, N'Created', @ActionByUserId, @ActionByUserName, N'Draft', N'InProgress', @StepOrder, @Notes)
      `);

    res.status(201).json({
      requestId: newRequestId,
      trackingNo: source.TrackingNo,
      message: 'درخواست ابطال ثبت شد و طبق مراحل تعریف‌شده برای بررسی کارشناسان ارسال شد'
    });
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ message: error.message });
    console.error('startLicenseCancellation failed:', error);
    next(error);
  }
}

export async function getCancellationAttachment(req, res, next) {
  try {
    const requestId = String(req.params.requestId || '').replace(/\D/g, '');
    if (!requestId) return res.status(400).json({ message: 'پرونده نامعتبر است' });
    const binPath = path.join(cancellationUploadDir(), `${requestId}.bin`);
    const metaPath = path.join(cancellationUploadDir(), `${requestId}.json`);
    if (!fs.existsSync(binPath) || !fs.existsSync(metaPath)) {
      return res.status(404).json({ message: 'پیوستی برای این درخواست نیست' });
    }
    const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
    const filename = meta.fileName || 'attachment';
    const encoded = encodeURIComponent(filename);
    const ascii = filename.replace(/[^\x00-\x7F]/g, '_');
    res.setHeader('Content-Type', meta.mimeType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${ascii}"; filename*=UTF-8''${encoded}`);
    fs.createReadStream(binPath).pipe(res);
  } catch (error) {
    next(error);
  }
}
