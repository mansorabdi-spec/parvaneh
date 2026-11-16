import React, { useState, useEffect } from 'react';
import { usePageAccess } from './usePageAccess';
import ProtectedLink from './ProtectedLink';

/**
 * Get current user's role from localStorage token
 * @returns {Object} { primaryRole, roles, isSuperAdminOnly }
 */
function getUserRoleInfo() {
  const token = localStorage.getItem('token') || sessionStorage.getItem('token');
  if (!token) return { primaryRole: null, roles: [], isSuperAdminOnly: false };

  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(atob(base64));
    const primaryRole = payload.role || payload.Role;
    
    // Get roles from localStorage cache
    const rolesStr = localStorage.getItem('userRoles');
    const roles = rolesStr ? JSON.parse(rolesStr) : primaryRole ? [primaryRole] : [];
    
    const hasSuperAdmin = roles.includes('superadmin');
    const hasAdmin = roles.includes('Admin');
    const isSuperAdminOnly = hasSuperAdmin && !hasAdmin;
    
    return { primaryRole, roles, isSuperAdminOnly };
  } catch (e) {
    return { primaryRole: null, roles: [], isSuperAdminOnly: false };
  }
}

/**
 * DynamicNav component that renders navigation based on user permissions
 * @param {Object} props
 * @param {boolean} props.token - Whether user is authenticated
 */
export default function DynamicNav({ token }) {
  const { hasAccess, loading } = usePageAccess();
  const [roleInfo, setRoleInfo] = useState({ primaryRole: null, roles: [], isSuperAdminOnly: false });

  useEffect(() => {
    setRoleInfo(getUserRoleInfo());
  }, [token]);

  const { isSuperAdminOnly } = roleInfo;

  if (loading) {
    return null;
  }

  // Check if user has access to any admin pages
  // For SuperAdmin-only, only show admin_users page
  const hasAdminUsersAccess = token && hasAccess('admin_users');
  const hasAdminRolesAccess = token && hasAccess('admin_roles') && !isSuperAdminOnly;
  const hasRolePermissionsAccess = token && hasAccess('admin_role_permissions') && !isSuperAdminOnly;
  
  const hasAnyAdminUserPages = token && (hasAdminUsersAccess || hasAdminRolesAccess || hasRolePermissionsAccess);

  const hasAdminLookupsAccess = token && hasAccess('admin_lookups');
  const hasAdminSystemTypesAccess = token && hasAccess('admin_systemtypes');
  const hasAdminProvincesAccess = token && hasAccess('admin_provinces');
  const hasAdminTariffsAccess = token && hasAccess('admin_tariffs');
  const hasManageCompaniesAccess = token && hasAccess('admin_manage_companies');
  const hasSiteSettingsAccess = token && hasAccess('admin_site_settings');
  const hasApprovalsFlowAccess = token && hasAccess('admin_approvals_flow') && !isSuperAdminOnly;

  const hasAnyAdminDataPages = token && (
    hasAdminLookupsAccess || 
    hasAdminSystemTypesAccess || 
    hasAdminProvincesAccess || 
    hasAdminTariffsAccess ||
    hasManageCompaniesAccess ||
    hasSiteSettingsAccess ||
    hasApprovalsFlowAccess
  );

  const hasAnyReportPages = token && (
    hasAccess('admin_reports_activity_licenses') ||
    hasAccess('admin_reports_comprehensive') ||
    hasAccess('admin_print_statistics') ||
    hasAccess('admin_license_history')
  );

  const hasAdminWorkflowAccess = token && hasAccess('admin_workflow_requests');
  const hasApprovalsFlowFullAccess = token && hasAccess('admin_approvals_flow') && !isSuperAdminOnly;

  const hasAnyWorkflowPages = token && (hasAdminWorkflowAccess || hasApprovalsFlowFullAccess);

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
    hasAccess('cancel_license') ||
    hasAccess('change_license')
  );

  const hasAnyEmploymentLicensePages = token && (
    hasAccess('employment_issue') || 
    hasAccess('employment_renew') || 
    hasAccess('employment_revoke') ||
    hasAccess('employment_change')
  );

  const hasAnyExploitationLicensePages = token && (
    hasAccess('exploitation_issue') || 
    hasAccess('exploitation_renew') || 
    hasAccess('exploitation_cancel') ||
    hasAccess('exploitation_change')
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
                  <ProtectedLink to="/licenses/activity/change" pageKey="change_license">تغییر</ProtectedLink>
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
                  <ProtectedLink to="/licenses/employment/change" pageKey="employment_change">تغییر</ProtectedLink>
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
                  <ProtectedLink to="/licenses/exploitation/change" pageKey="exploitation_change">تغییر</ProtectedLink>
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
            {hasAdminUsersAccess && (
              <ProtectedLink to="/admin/users" pageKey="admin_users">کاربران</ProtectedLink>
            )}
            {hasAdminRolesAccess && (
              <>
                <ProtectedLink to="/admin/roles" pageKey="admin_roles">نقش‌ها</ProtectedLink>
                <ProtectedLink to="/admin/role-permissions" pageKey="admin_role_permissions">دسترسی‌های نقش‌ها</ProtectedLink>
                <ProtectedLink to="/admin/role-permissions-management" pageKey="admin_role_permissions">مدیریت دسترسی‌ها (RolePermissions)</ProtectedLink>
              </>
            )}
          </div>
        </div>
      )}

      {/* Data Management Menu */}
      {hasAnyAdminDataPages && (
        <div className="menu-parent">
          <span className="menu-parent-title">مدیریت اطلاعات ▾</span>
          <div className="submenu">
            {hasAdminLookupsAccess && (
              <ProtectedLink to="/admin/lookups" pageKey="admin_lookups">مدیریت اطلاعات پایه</ProtectedLink>
            )}
            {hasAdminSystemTypesAccess && (
              <ProtectedLink to="/admin/systemtypes" pageKey="admin_systemtypes">مدیریت انواع سیستم</ProtectedLink>
            )}
            {hasAdminProvincesAccess && (
              <ProtectedLink to="/admin/provinces" pageKey="admin_provinces">استان‌ها و شهرها</ProtectedLink>
            )}
            {hasAdminTariffsAccess && (
              <ProtectedLink to="/admin/tariffs" pageKey="admin_tariffs">مدیریت تعرفه‌ها</ProtectedLink>
            )}
            {hasManageCompaniesAccess && (
              <ProtectedLink to="/admin/manage-companies" pageKey="admin_manage_companies">مدیریت اطلاعات شرکتها</ProtectedLink>
            )}
            {hasApprovalsFlowAccess && (
              <ProtectedLink to="/admin/approvals-flow" pageKey="admin_approvals_flow">فرآیند تأیید</ProtectedLink>
            )}
            {hasSiteSettingsAccess && (
              <ProtectedLink to="/admin/site-settings" pageKey="admin_site_settings">تنظیمات سایت</ProtectedLink>
            )}
          </div>
        </div>
      )}

      {/* Reports Menu */}
      {hasAnyReportPages && (
        <div className="menu-parent">
          <span className="menu-parent-title">گزارشات ▾</span>
          <div className="submenu">
            <ProtectedLink to="/admin/reports/activity-licenses" pageKey="admin_reports_activity_licenses">گزارشات پروانه فعالیت</ProtectedLink>
            <ProtectedLink to="/admin/reports/comprehensive" pageKey="admin_reports_comprehensive">گزارش جامع</ProtectedLink>
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
