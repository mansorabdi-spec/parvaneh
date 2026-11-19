import { sql, getPool } from '../lib/db.js';

/**
 * Automatically log license history when a license is issued, renewed, or revoked
 * @param {Object} params - License history parameters
 * @param {number} params.requestId - Request ID
 * @param {string} params.trackingNo - Tracking number
 * @param {number} params.licenseTypeId - License type ID
 * @param {string} params.licenseTypeName - License type name
 * @param {number} params.operationTypeId - Operation type ID (صدور/تمدید)
 * @param {string} params.operationTypeName - Operation type name
 * @param {string} params.eventType - Event type: 'Issued', 'Renewed', 'Revoked', 'Cancelled'
 * @param {number|null} params.vehicleId - Vehicle ID (null for employment licenses)
 * @param {string|null} params.nationalCode - National code (for individuals)
 * @param {string|null} params.companyNationalId - Company national ID (for legal entities)
 * @param {string} params.issueDate - Issue date in Shamsi format (e.g., '1403/09/29')
 * @param {string} params.expiryDate - Expiry date in Shamsi format
 * @param {number|null} params.validityDurationMonths - Validity duration in months (e.g., 12)
 * @param {string} params.status - License status: 'Active', 'Expired', 'Revoked', 'Cancelled'
 * @param {number|null} params.issuedByUserId - User ID who issued the license
 * @param {string|null} params.issuedByUsername - Username who issued the license
 * @param {string|null} params.issuedByRole - Role who issued the license
 * @param {string|null} params.notes - Additional notes
 * @param {Object|null} params.metadata - Additional metadata as object (will be stringified)
 */
export async function logLicenseHistory(params) {
  try {
    const {
      requestId,
      trackingNo,
      licenseTypeId,
      licenseTypeName,
      operationTypeId,
      operationTypeName,
      eventType,
      vehicleId = null,
      nationalCode = null,
      companyNationalId = null,
      issueDate,
      expiryDate,
      validityDurationMonths = null,
      status,
      issuedByUserId = null,
      issuedByUsername = null,
      issuedByRole = null,
      notes = null,
      metadata = null
    } = params;

    const pool = await getPool();

    const metadataJson = metadata ? JSON.stringify(metadata) : null;

    await pool.request()
      .input('RequestID', sql.BigInt, requestId)
      .input('TrackingNo', sql.NVarChar(30), trackingNo)
      .input('LicenseTypeId', sql.Int, licenseTypeId)
      .input('LicenseTypeName', sql.NVarChar(200), licenseTypeName)
      .input('OperationTypeId', sql.Int, operationTypeId)
      .input('OperationTypeName', sql.NVarChar(200), operationTypeName)
      .input('EventType', sql.NVarChar(50), eventType)
      .input('VehicleID', sql.BigInt, vehicleId)
      .input('NationalCode', sql.NVarChar(20), nationalCode)
      .input('CompanyNationalId', sql.NVarChar(100), companyNationalId)
      .input('IssueDate', sql.NVarChar(10), issueDate)
      .input('ExpiryDate', sql.NVarChar(10), expiryDate)
      .input('ValidityDurationMonths', sql.Int, validityDurationMonths)
      .input('Status', sql.NVarChar(20), status)
      .input('IssuedByUserId', sql.Int, issuedByUserId)
      .input('IssuedByUsername', sql.NVarChar(150), issuedByUsername)
      .input('IssuedByRole', sql.NVarChar(50), issuedByRole)
      .input('Notes', sql.NVarChar(sql.MAX), notes)
      .input('Metadata', sql.NVarChar(sql.MAX), metadataJson)
      .query(`
        INSERT INTO LicenseHistory (
          RequestID, TrackingNo, LicenseTypeId, LicenseTypeName, OperationTypeId, OperationTypeName,
          EventType, VehicleID, NationalCode, CompanyNationalId, IssueDate, ExpiryDate,
          ValidityDurationMonths, Status,
          IssuedByUserId, IssuedByUsername, IssuedByRole, Notes, Metadata
        )
        VALUES (
          @RequestID, @TrackingNo, @LicenseTypeId, @LicenseTypeName, @OperationTypeId, @OperationTypeName,
          @EventType, @VehicleID, @NationalCode, @CompanyNationalId, @IssueDate, @ExpiryDate,
          @ValidityDurationMonths, @Status,
          @IssuedByUserId, @IssuedByUsername, @IssuedByRole, @Notes, @Metadata
        )
      `);

    console.log(`✅ License history logged: ${eventType} for tracking ${trackingNo}`);
    return { success: true };
  } catch (error) {
    console.error('❌ Error logging license history:', error);
    throw error;
  }
}

/**
 * Helper function to calculate expiry date based on issue date and validity duration
 * @param {string} issueDate - Shamsi date (e.g., '1403/09/29')
 * @param {number} validityMonths - Validity duration in months (default: 12)
 * @returns {string} - Expiry date in Shamsi format
 */
export function calculateExpiryDate(issueDate, validityMonths = 12) {
  try {
    const parts = issueDate.split('/');
    if (parts.length !== 3) return issueDate;

    let year = parseInt(parts[0]);
    let month = parseInt(parts[1]);
    const day = parts[2];

    month += validityMonths;
    while (month > 12) {
      month -= 12;
      year += 1;
    }

    return `${year}/${String(month).padStart(2, '0')}/${day}`;
  } catch (error) {
    console.error('Error calculating expiry date:', error);
    return issueDate;
  }
}
