-- =============================================
-- Migration: Add SuperAdmin Role
-- Date: 2026-08-20
-- Description: Create SuperAdmin role with limited admin permissions
-- =============================================

USE [parvaneh]
GO

-- Step 1: Create SuperAdmin role if it doesn't exist
IF NOT EXISTS (SELECT 1 FROM dbo.Roles WHERE Name = 'superadmin')
BEGIN
    INSERT INTO dbo.Roles (Name) VALUES ('superadmin');
    PRINT 'نقش superadmin ایجاد شد.';
END
ELSE
BEGIN
    PRINT 'نقش superadmin از قبل وجود دارد.';
END
GO

-- Step 2: Copy all permissions from Admin role to SuperAdmin role
-- This gives SuperAdmin the same permissions as Admin initially
-- Then we'll restrict specific pages in the frontend

PRINT 'برای تنظیم دسترسی‌ها، از صفحه مدیریت دسترسی‌های نقش استفاده کنید.';
PRINT 'نقش superadmin نباید دسترسی‌های زیر را داشته باشد:';
PRINT '1. فرآیند تأیید (admin_approvals_flow)';
PRINT '2. تنظیمات سایت (admin_site_settings)';
PRINT '3. نقش‌ها (admin_roles)';
PRINT '4. دسترسی نقش‌ها (admin_role_permissions)';
PRINT '5. مدیریت دسترسی‌ها (admin_role_permissions_management)';
GO
