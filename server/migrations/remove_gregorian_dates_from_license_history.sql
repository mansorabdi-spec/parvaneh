-- Migration: Remove Gregorian date fields from LicenseHistory table
-- Since the system only works with Shamsi dates, these fields are not needed

USE [parvaneh2]
GO

-- Drop the Gregorian date columns
ALTER TABLE [dbo].[LicenseHistory]
DROP COLUMN [IssueDateGregorian], [ExpiryDateGregorian];
GO

PRINT 'Successfully removed IssueDateGregorian and ExpiryDateGregorian columns from LicenseHistory table';
GO
