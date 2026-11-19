import { sql, getPool } from '../lib/db.js';

/**
 * Log license renewal in the LicenseRenewalHistory table
 * @param {Object} params - License renewal parameters
 * @param {string} params.trackingNo - Tracking number
 * @param {number} params.requestId - Request ID
 * @param {number} params.licenseHistoryId - HistoryID from LicenseHistory table
 * @param {string} params.renewalDate - Renewal date in Shamsi format (e.g., '1405/05/23')
 * @param {string} params.expiryDate - Expiry date in Shamsi format
 * @param {number|null} params.renewedByUserId - User ID who renewed the license
 */
export async function logLicenseRenewal(params) {
  try {
    const {
      trackingNo,
      requestId,
      licenseHistoryId,
      renewalDate,
      expiryDate,
      renewedByUserId = null
    } = params;

    const pool = await getPool();

    await pool.request()
      .input('TrackingNo', sql.NVarChar(30), trackingNo)
      .input('RequestID', sql.BigInt, requestId)
      .input('LicenseHistoryId', sql.BigInt, licenseHistoryId)
      .input('RenewalDate', sql.NVarChar(10), renewalDate)
      .input('ExpiryDate', sql.NVarChar(10), expiryDate)
      .input('RenewedByUserId', sql.Int, renewedByUserId)
      .query(`
        INSERT INTO LicenseRenewalHistory (
          TrackingNo, RequestID, LicenseHistoryId, RenewalDate, ExpiryDate, RenewedByUserId
        )
        VALUES (
          @TrackingNo, @RequestID, @LicenseHistoryId, @RenewalDate, @ExpiryDate, @RenewedByUserId
        )
      `);

    console.log(`✅ License renewal logged: ${trackingNo} renewed by user ${renewedByUserId}`);
    return { success: true };
  } catch (error) {
    console.error('❌ Error logging license renewal:', error);
    throw error;
  }
}
