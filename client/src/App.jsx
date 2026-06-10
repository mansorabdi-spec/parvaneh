import React, { useEffect, useState, lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Link, Navigate } from 'react-router-dom'
import { initAuthFromStorage, setAuthToken } from './lib/api.js'
import { loadUserPermissions, clearPermissions } from './lib/permissions.js'
import ProtectedRoute from './lib/ProtectedRoute.jsx'
import ProtectedLink from './lib/ProtectedLink.jsx'
import DynamicNav from './lib/DynamicNav.jsx'
import './styles.css'

const Home = lazy(() => import('./pages/Home.jsx'))
const IssueLicense = lazy(() => import('./pages/IssueLicense.jsx'))
const Login = lazy(() => import('./pages/Login.jsx'))
const Register = lazy(() => import('./pages/Register.jsx'))
const AdminUsers = lazy(() => import('./pages/AdminUsers.jsx'))
const AdminRoles = lazy(() => import('./pages/AdminRoles.jsx'))
const ChangePassword = lazy(() => import('./pages/ChangePassword.jsx'))
const MyLicenses = lazy(() => import('./pages/MyLicenses.jsx'))
const ApproverTasks = lazy(() => import('./pages/ApproverTasks.jsx'))
const AdminApprovalFlow = lazy(() => import('./pages/AdminApprovalFlow.jsx'))
const AdminLookups = lazy(() => import('./pages/AdminLookups.jsx'))
const AdminLookupValues = lazy(() => import('./pages/AdminLookupValues.jsx'))
const AdminSystemTypes = lazy(() => import('./pages/AdminSystemTypes.jsx'))
const AdminProvinces = lazy(() => import('./pages/AdminProvinces.jsx'))
const FinancialPayment = lazy(() => import('./pages/FinancialPayment.jsx'))
const AdminTariffs = lazy(() => import('./pages/AdminTariffs.jsx'))
const RedirectToBank = lazy(() => import('./pages/RedirectToBank.jsx'))
const PaymentCallback = lazy(() => import('./pages/PaymentCallback.jsx'))
const AdminActivityLicenseReports = lazy(() => import('./pages/AdminActivityLicenseReports.jsx'))
const AdminActivityLicenseDetail = lazy(() => import('./pages/AdminActivityLicenseDetail.jsx'))
const UserInbox = lazy(() => import('./pages/UserInbox.jsx'))
const WorkflowRequestDetail = lazy(() => import('./pages/WorkflowRequestDetail.jsx'))
const AdminAllRequests = lazy(() => import('./pages/AdminAllRequests.jsx'))
const AdminRequestStatusUpdate = lazy(() => import('./pages/AdminRequestStatusUpdate.jsx'))
const PrintLicense = lazy(() => import('./pages/PrintLicense.jsx'))
const PrintLegalEntityLicense = lazy(() => import('./pages/PrintLegalEntityLicense.jsx'))
const PrintEmploymentLicense = lazy(() => import('./pages/PrintEmploymentLicense.jsx'))
const PrintExploitationLicense = lazy(() => import('./pages/PrintExploitationLicense.jsx'))
const VerifyLicense = lazy(() => import('./pages/VerifyLicense.jsx'))
const AdminRolePermissions = lazy(() => import('./pages/AdminRolePermissions.jsx'))
const AdminRolePermissionsManagement = lazy(() => import('./pages/AdminRolePermissionsManagement.jsx'))
const LicenseCancellation = lazy(() => import('./pages/LicenseCancellation.jsx'))
const IssueEmploymentLicense = lazy(() => import('./pages/IssueEmploymentLicense.jsx'))
const IssueExploitationLicense = lazy(() => import('./pages/IssueExploitationLicense.jsx'))
const AdminPrintStatistics = lazy(() => import('./pages/AdminPrintStatistics.jsx'))
const AdminLicenseHistory = lazy(() => import('./pages/AdminLicenseHistory.jsx'))
const UserLicenses = lazy(() => import('./pages/UserLicenses.jsx'))
const ManageCompanies = lazy(() => import('./pages/ManageCompanies.jsx'))

function PageLoader() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '200px' }}>
      <div style={{ width: '32px', height: '32px', border: '3px solid #e5e7eb', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

export default function App() {
  const [token, setToken] = useState(null)
  const [user, setUser] = useState(null)
  const [companyName, setCompanyName] = useState(null)
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'light')

  useEffect(() => {
    const t = initAuthFromStorage()
    if (t) setToken(t)
    // fetch current user if token exists
    if (t) {
      fetch('/api/auth/me', { headers: { Authorization: `Bearer ${t}` } })
        .then(r => r.ok ? r.json() : null)
        .then(data => { 
          if (data?.user) {
            // Normalize user data to ensure consistent property names
            const normalizedUser = {
              ...data.user,
              // Map NationalCode to nationalCode for consistent access
              nationalCode: data.user.NationalCode || data.user.nationalCode
            }
            setUser(normalizedUser)
            
            // Fetch company name if user is کارگزار (بهره بردار)
            if (normalizedUser.Role === 'کارگزار (بهره بردار)' && normalizedUser.nationalCode) {
              fetch(`/api/company/by-manager/${normalizedUser.nationalCode}`, {
                headers: { Authorization: `Bearer ${t}` }
              })
                .then(r => r.ok ? r.json() : null)
                .then(companyData => {
                  if (companyData?.companyName) {
                    setCompanyName(companyData.companyName)
                  }
                })
                .catch(() => {})
            }
          }
        })
        .catch(() => {})
    }
  }, [])

  const onLoggedIn = async ({ token, user }) => {
    setAuthToken(token)
    setToken(token)
    // Normalize user to ensure nationalCode is always present immediately after login
    const normalizedUser = {
      ...user,
      nationalCode: user?.NationalCode || user?.nationalCode
    }
    setUser(normalizedUser)
    // Load user permissions after login
    await loadUserPermissions()
    // Also fetch from /api/auth/me to get authoritative user payload (includes nationalCode from JWT)
    fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.user) {
          const u2 = {
            ...data.user,
            nationalCode: data.user.NationalCode || data.user.nationalCode
          }
          setUser(u2)
          
          // Fetch company name if user is کارگزار (بهره بردار)
          if (u2.Role === 'کارگزار (بهره بردار)' && u2.nationalCode) {
            fetch(`/api/company/by-manager/${u2.nationalCode}`, {
              headers: { Authorization: `Bearer ${token}` }
            })
              .then(r => r.ok ? r.json() : null)
              .then(companyData => {
                if (companyData?.companyName) {
                  setCompanyName(companyData.companyName)
                }
              })
              .catch(() => {})
          }
        }
      })
      .catch(() => {})
  }

  const onLogout = () => {
    setAuthToken(null)
    setToken(null)
    setUser(null)
    setCompanyName(null)
    clearPermissions()
  }

  const onRoleSwitch = async (newRole) => {
    if (!token || !user) return
    
    console.log('🔄 Switching role to:', newRole)
    console.log('Current user:', user)
    
    try {
      // Call backend API to switch role (re-authenticate with new role)
      const response = await fetch('/api/auth/switch-role', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ role: newRole })
      })
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        console.error('❌ Role switch failed:', errorData)
        throw new Error('Failed to switch role')
      }
      
      const data = await response.json()
      console.log('✅ Role switch successful, new data:', data)
      console.log('New token:', data.token)
      console.log('New user:', data.user)
      
      // Update token and user with new role
      setAuthToken(data.token)
      setToken(data.token)
      setUser(data.user)
      
      // Load permissions for new role
      await loadUserPermissions()
      
      console.log('🔃 Reloading page...')
      // Reload the page to refresh all permissions and UI
      window.location.reload()
    } catch (error) {
      console.error('❌ Error switching role:', error)
      alert('خطا در تغییر نقش. لطفاً دوباره تلاش کنید.')
    }
  }

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light'
    setTheme(newTheme)
    localStorage.setItem('theme', newTheme)
  }

  useEffect(() => {
    document.body.className = theme
  }, [theme])

  return (
    <BrowserRouter>
      <div className={`app-wrapper ${theme}`}>
        <header className="main-header">
          {/* Logo and Title on the right */}
          <div className="header-content">
            {/* Logo */}
            <img src="/logo/Logo.png" alt="Logo" className="header-logo" />
            
            {/* System Title */}
            <h1 className="system-title">سامانه صدور پروانه</h1>
          </div>
          
          {/* Navigation on the left */}
          <div className="nav-container">
            <nav className="main-nav">
              {token && <Link to="/">صفحه اصلی</Link>}
              <DynamicNav token={token} />
              {token && <ProtectedLink to="/workflow/inbox" pageKey="workflow_inbox">کارتابل من</ProtectedLink>}
              {!token && <Link to="/login">ورود</Link>}
              {!token && <Link to="/register">ثبت‌نام</Link>}
              {token && <ProtectedLink to="/change-password" pageKey="change_password">تغییر رمز</ProtectedLink>}
            </nav>
            {token && user && (
              <div className="user-info">
                <span className="user-name">{user.LastName || user.FullName || user.NationalCode}</span>
                <span className="user-role">{user.Role || (user.Roles && user.Roles[0]) || 'کاربر'}</span>
                
                {/* Show company name for کارگزار (بهره بردار) users */}
                {user.Role === 'کارگزار (بهره بردار)' && companyName && (
                  <span className="company-name" style={{ 
                    fontSize: '0.9em', 
                    color: '#2563eb',
                    fontWeight: '500',
                    marginRight: '8px'
                  }}>
                    {companyName}
                  </span>
                )}
                
                {/* Role Switcher - only show if user has multiple roles */}
                {user.Roles && user.Roles.length > 1 && (
                  <select 
                    className="role-switcher"
                    value={user.Role || user.Roles[0]}
                    onChange={(e) => onRoleSwitch(e.target.value)}
                    title="تغییر نقش"
                  >
                    {user.Roles.map(role => (
                      <option key={role} value={role}>{role}</option>
                    ))}
                  </select>
                )}
                
                <button className="logout-btn" onClick={onLogout}>خروج</button>
              </div>
            )}
            {/* Theme Toggle */}
            <button className="theme-toggle" onClick={toggleTheme} title="تغییر تم">
              {theme === 'light' ? '🌙' : '☀️'}
            </button>
          </div>
        </header>
        <div className="content-wrapper">
          <div className="content-box">
        <main>
          <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/licenses/activity/issue" element={<ProtectedRoute pageKey="issue_license" element={<IssueLicense user={user} />} />} />
            <Route path="/licenses/activity/renew" element={<ProtectedRoute pageKey="renew_license" element={<div style={{padding: '20px'}}>صفحه تمدید پروانه فعالیت (در دست توسعه)</div>} />} />
            <Route path="/licenses/activity/cancel" element={<ProtectedRoute pageKey="cancel_license" element={<LicenseCancellation />} />} />
            
            {/* Employment License Routes */}
            <Route path="/licenses/employment/issue" element={<ProtectedRoute pageKey="employment_issue" element={<IssueEmploymentLicense user={user} />} />} />
            <Route path="/licenses/employment/renew" element={<ProtectedRoute pageKey="employment_renew" element={<div style={{padding: '20px'}}>صفحه تمدید پروانه اشتغال (در دست توسعه)</div>} />} />
            <Route path="/licenses/employment/revoke" element={<ProtectedRoute pageKey="employment_revoke" element={<div style={{padding: '20px'}}>صفحه ابطال پروانه اشتغال (در دست توسعه)</div>} />} />
            
            <Route path="/licenses/exploitation/issue" element={<ProtectedRoute pageKey="exploitation_issue" element={<IssueExploitationLicense user={user} />} />} />
            <Route path="/licenses/exploitation/renew" element={<ProtectedRoute pageKey="exploitation_renew" element={<div style={{padding: '20px'}}>صفحه تمدید پروانه بهره‌برداری (در دست توسعه)</div>} />} />
            <Route path="/licenses/exploitation/cancel" element={<ProtectedRoute pageKey="exploitation_cancel" element={<div style={{padding: '20px'}}>صفحه ابطال پروانه بهره‌برداری (در دست توسعه)</div>} />} />
            <Route path="/login" element={<Login onLoggedIn={onLoggedIn} />} />
            <Route path="/register" element={<Register onLoggedIn={onLoggedIn} />} />
            <Route path="/admin/users" element={<ProtectedRoute pageKey="admin_users" element={<AdminUsers />} />} />
            <Route path="/admin/roles" element={<ProtectedRoute pageKey="admin_roles" element={<AdminRoles />} />} />
            <Route path="/admin/role-permissions" element={<ProtectedRoute pageKey="admin_role_permissions" element={<AdminRolePermissions />} />} />
            <Route path="/admin/role-permissions-management" element={<ProtectedRoute pageKey="admin_role_permissions" element={<AdminRolePermissionsManagement />} />} />
            <Route path="/admin/approvals-flow" element={<ProtectedRoute pageKey="admin_approvals_flow" element={<AdminApprovalFlow />} />} />
            <Route path="/admin/lookups" element={<ProtectedRoute pageKey="admin_lookups" element={<AdminLookups />} />} />
            <Route path="/admin/lookups/:key" element={<ProtectedRoute pageKey="admin_lookups" element={<AdminLookupValues />} />} />
            <Route path="/admin/systemtypes" element={<ProtectedRoute pageKey="admin_systemtypes" element={<AdminSystemTypes />} />} />
            <Route path="/admin/provinces" element={<ProtectedRoute pageKey="admin_provinces" element={<AdminProvinces />} />} />
            <Route path="/approvals/tasks" element={<ProtectedRoute pageKey="approvals_tasks" element={<ApproverTasks />} />} />
            <Route path="/licenses" element={<ProtectedRoute pageKey="my_licenses" element={<MyLicenses />} />} />
            <Route path="/user/licenses" element={<ProtectedRoute pageKey="user_licenses" element={<UserLicenses />} />} />
            <Route path="/change-password" element={<ProtectedRoute pageKey="change_password" element={<ChangePassword />} />} />
            <Route path="/payment" element={<ProtectedRoute pageKey="payment" element={<FinancialPayment />} />} />
            <Route path="/redirect-to-bank" element={<RedirectToBank />} />
            <Route path="/payment-callback" element={<PaymentCallback />} />
            <Route path="/admin/tariffs" element={<ProtectedRoute pageKey="admin_tariffs" element={<AdminTariffs />} />} />
            <Route path="/admin/reports/activity-licenses" element={<ProtectedRoute pageKey="admin_reports_activity_licenses" element={<AdminActivityLicenseReports />} />} />
            <Route path="/admin/reports/activity-licenses/:vehicleId" element={<ProtectedRoute pageKey="admin_reports_activity_licenses" element={<AdminActivityLicenseDetail />} />} />
            <Route path="/workflow/inbox" element={<ProtectedRoute pageKey="workflow_inbox" element={<UserInbox />} />} />
            <Route path="/workflow/request/:requestId" element={<ProtectedRoute pageKey="workflow_inbox" element={<WorkflowRequestDetail />} />} />
            <Route path="/admin/workflow/requests" element={<ProtectedRoute pageKey="admin_workflow_requests" element={<AdminAllRequests />} />} />
            <Route path="/admin/workflow/requests/:requestId/status-fix" element={<ProtectedRoute pageKey="admin_workflow_requests" element={<AdminRequestStatusUpdate />} />} />
            <Route path="/admin/print-statistics" element={<ProtectedRoute pageKey="admin_print_statistics" element={<AdminPrintStatistics />} />} />
            <Route path="/admin/license-history" element={<ProtectedRoute pageKey="admin_license_history" element={<AdminLicenseHistory />} />} />
            <Route path="/admin/manage-companies" element={<ProtectedRoute pageKey="admin_manage_companies" element={<ManageCompanies />} />} />
            <Route path="/print-employment-license/:requestId" element={<ProtectedRoute pageKey="print_license" element={<PrintEmploymentLicense />} />} />
            <Route path="/print-exploitation-license/:requestId" element={<ProtectedRoute pageKey="print_license" element={<PrintExploitationLicense />} />} />
            <Route path="/print-license/:requestId" element={<ProtectedRoute pageKey="print_license" element={<PrintLicense />} />} />
            <Route path="/print-legal-entity-license/:requestId" element={<ProtectedRoute pageKey="print_license" element={<PrintLegalEntityLicense />} />} />
            <Route path="/verify-license/:trackingNo" element={<VerifyLicense />} />
            <Route path="*" element={<div>صفحه مورد نظر یافت نشد</div>} />
          </Routes>
          </Suspense>
        </main>
          </div>
        </div>
      </div>
    </BrowserRouter>
  )
}
