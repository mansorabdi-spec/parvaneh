-- =====================================================
-- Migration: Add CalculatedAmount field to payment tables
-- Description: ذخیره مبلغ محاسبه شده در صفحه پرداخت
--              هنگام ثبت پرداخت (آنلاین یا آفلاین)
-- Date: 2026-06-06
-- Note: جداول مقادیر دارند - فقط ADD COLUMN انجام می‌شود
-- =====================================================

-- Add CalculatedAmount to OnlinePayment table
IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 'OnlinePayment' AND COLUMN_NAME = 'CalculatedAmount'
)
BEGIN
    ALTER TABLE OnlinePayment
    ADD CalculatedAmount BIGINT NULL;

    PRINT 'CalculatedAmount column added to OnlinePayment table.';
END
ELSE
BEGIN
    PRINT 'CalculatedAmount column already exists in OnlinePayment table.';
END

GO

-- Add CalculatedAmount to OfflinePayment table
IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 'OfflinePayment' AND COLUMN_NAME = 'CalculatedAmount'
)
BEGIN
    ALTER TABLE OfflinePayment
    ADD CalculatedAmount BIGINT NULL;

    PRINT 'CalculatedAmount column added to OfflinePayment table.';
END
ELSE
BEGIN
    PRINT 'CalculatedAmount column already exists in OfflinePayment table.';
END

GO

PRINT 'Migration completed successfully.';
