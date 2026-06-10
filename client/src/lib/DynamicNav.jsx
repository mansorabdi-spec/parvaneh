import React from 'react';
import { usePageAccess } from './usePageAccess';
import ProtectedLink from './ProtectedLink';

/**
 * DynamicNav component that renders navigation based on user permissions
 * @param {Object} props
 * @param {boolean} props.token - Whether user is authenticated
 */
export default function DynamicNav({ token }) {
  const { hasAccess, loading } = usePageAccess();

  if (loading) {
    return null;
  }

  // Check if user has access to any admin pages
  const hasAnyAdminUserPages = token && (
    hasAccess('admin_users') || 
    hasAccess('admin_roles') || 
    hasAccess('admin_role_permissions')
  );

  const hasAnyAdminDataPages = token && (
    hasAccess('admin_lookups') || 
    hasAccess('admin_systemtypes') || 
    hasAccess('admin_provinces') || 
    hasAccess('admin_tariffs') ||
    hasAccess('admin_manage_companies')
  );

  const hasAnyReportPages = token && (
    hasAccess('admin_reports_activity_licenses') ||
    hasAccess('admin_print_statistics') ||
    hasAccess('admin_license_history')
  );

  const hasAnyWorkflowPages = token && (
    hasAccess('admin_workflow_requests') || 
    hasAccess('admin_approvals_flow')
  );

  // Check if user has access to licenses menu
  // First check the menu permission, then fall back to checking individual pages
  const hasLicensesMenuAccess = token && hasAccess('licenses_menu');
  const hasAnyLicensePages = token && (
    hasLicensesMenuAccess ||
    hasAccess('issue_license') || 
    hasAccess('renew_license') || 
    hasAccess('cancel_license') ||
    hasAccess('employment_issue') ||
    hasAccess('employment_renew') ||
    hasAccess('employment_revoke') ||
    hasAccess('exploitation_issue') ||
    hasAccess('exploitation_renew') ||
    hasAccess('exploitation_cancel') ||
    hasAccess('user_licenses')
  );

  const hasAnyActivityLicensePages = token && (
    hasAccess('issue_license') || 
    hasAccess('renew_license') || 
    hasAccess('cancel_license')
  );

  const hasAnyEmploymentLicensePages = token && (
    hasAccess('employment_issue') || 
    hasAccess('employment_renew') || 
    hasAccess('employment_revoke')
  );

  const hasAnyExploitationLicensePages = token && (
    hasAccess('exploitation_issue') || 
    hasAccess('exploitation_renew') || 
    hasAccess('exploitation_cancel')
  );

  return (
    <>
      {/* Licenses Menu */}
      {hasAnyLicensePages && (
        <div className="menu-parent">
          <span className="menu-parent-title">پروانه‌ها ▾</span>
          <div className="submenu">
            {/* User Licenses List */}
            <ProtectedLink to="/user/licenses" pageKey="user_licenses">پروانه‌ها</ProtectedLink>
            
            {/* Activity License Submenu */}
            {hasAnyActivityLicensePages && (
              <div className="submenu-parent">
                <span className="submenu-title">پروانه فعالیت ▾</span>
                <div className="submenu-nested">
                  <ProtectedLink to="/licenses/activity/issue" pageKey="issue_license">صدور</ProtectedLink>
                  <ProtectedLink to="/licenses/activity/renew" pageKey="renew_license">تمدید</ProtectedLink>
                  <ProtectedLink to="/licenses/activity/cancel" pageKey="cancel_license">ابطال</ProtectedLink>
                </div>
              </div>
            )}
            
            {/* Employment License Submenu */}
            {hasAnyEmploymentLicensePages && (
              <div className="submenu-parent">
                <span className="submenu-title">پروانه اشتغال ▾</span>
                <div className="submenu-nested">
                  <ProtectedLink to="/licenses/employment/issue" pageKey="employment_issue">صدور</ProtectedLink>
                  <ProtectedLink to="/licenses/employment/renew" pageKey="employment_renew">تمدید</ProtectedLink>
                  <ProtectedLink to="/licenses/employment/revoke" pageKey="employment_revoke">ابطال</ProtectedLink>
                </div>
              </div>
            )}
            
            {/* Exploitation License Submenu */}
            {hasAnyExploitationLicensePages && (
              <div className="submenu-parent">
                <span className="submenu-title">پروانه بهره‌برداری ▾</span>
                <div className="submenu-nested">
                  <ProtectedLink to="/licenses/exploitation/issue" pageKey="exploitation_issue">صدور</ProtectedLink>
                  <ProtectedLink to="/licenses/exploitation/renew" pageKey="exploitation_renew">تمدید</ProtectedLink>
                  <ProtectedLink to="/licenses/exploitation/cancel" pageKey="exploitation_cancel">ابطال</ProtectedLink>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* User Management Menu */}
      {hasAnyAdminUserPages && (
        <div className="menu-parent">
          <span className="menu-parent-title">مدیریت کاربران ▾</span>
          <div className="submenu">
            <ProtectedLink to="/admin/users" pageKey="admin_users">کاربران</ProtectedLink>
            <ProtectedLink to="/admin/roles" pageKey="admin_roles">نقش‌ها</ProtectedLink>
            <ProtectedLink to="/admin/role-permissions" pageKey="admin_role_permissions">دسترسی‌های نقش‌ها</ProtectedLink>
            <ProtectedLink to="/admin/role-permissions-management" pageKey="admin_role_permissions">مدیریت دسترسی‌ها (RolePermissions)</ProtectedLink>
          </div>
        </div>
      )}

      {/* Data Management Menu */}
      {hasAnyAdminDataPages && (
        <div className="menu-parent">
          <span className="menu-parent-title">مدیریت اطلاعات ▾</span>
          <div className="submenu">
            <ProtectedLink to="/admin/lookups" pageKey="admin_lookups">مدیریت اطلاعات پایه</ProtectedLink>
            <ProtectedLink to="/admin/systemtypes" pageKey="admin_systemtypes">مدیریت انواع سیستم</ProtectedLink>
            <ProtectedLink to="/admin/provinces" pageKey="admin_provinces">استان‌ها و شهرها</ProtectedLink>
            <ProtectedLink to="/admin/tariffs" pageKey="admin_tariffs">مدیریت تعرفه‌ها</ProtectedLink>
            <ProtectedLink to="/admin/manage-companies" pageKey="admin_manage_companies">مدیریت اطلاعات شرکتها</ProtectedLink>
            <ProtectedLink to="/admin/approvals-flow" pageKey="admin_approvals_flow">فرآیند تأیید</ProtectedLink>
          </div>
        </div>
      )}

      {/* Reports Menu */}
      {hasAnyReportPages && (
        <div className="menu-parent">
          <span className="menu-parent-title">گزارشات ▾</span>
          <div className="submenu">
            <ProtectedLink to="/admin/reports/activity-licenses" pageKey="admin_reports_activity_licenses">گزارشات پروانه فعالیت</ProtectedLink>
            <ProtectedLink to="/admin/print-statistics" pageKey="admin_print_statistics">آمار چاپ پروانه‌ها</ProtectedLink>
            <ProtectedLink to="/admin/license-history" pageKey="admin_license_history">تاریخچه پروانه‌ها</ProtectedLink>
          </div>
        </div>
      )}

      {/* Workflow Management Menu */}
      {hasAnyWorkflowPages && (
        <div className="menu-parent">
          <span className="menu-parent-title">مدیریت گردش کار ▾</span>
          <div className="submenu">
            <ProtectedLink to="/admin/workflow/requests" pageKey="admin_workflow_requests">همه درخواست‌ها</ProtectedLink>
          </div>
        </div>
      )}
    </>
  );
}
