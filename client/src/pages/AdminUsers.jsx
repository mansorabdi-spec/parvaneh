import React, { useEffect, useMemo, useState } from 'react'
import { api } from '../lib/api.js'
import { isAdminRoleName, viewerIsSuperAdminOnly } from '../lib/roleVisibility.js'

export default function AdminUsers() {
  const [users, setUsers] = useState([])
  const [roles, setRoles] = useState([])
  const [companies, setCompanies] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [savingId, setSavingId] = useState(null)
  const [busyId, setBusyId] = useState(null)
  const [selectedCompany, setSelectedCompany] = useState(null)
  const [companySearchTerm, setCompanySearchTerm] = useState('')
  const [showCompanyDropdown, setShowCompanyDropdown] = useState(false)

  // Admin and superadmin can edit roles. Superadmin cannot see or assign Admin.
  const [canEditRoles, setCanEditRoles] = useState(() => viewerIsSuperAdminOnly())
  const [hideAdmin, setHideAdmin] = useState(() => viewerIsSuperAdminOnly())

  useEffect(() => {
    const checkAdminRole = async () => {
      try {
        const token = localStorage.getItem('token')
        if (!token) {
          setCanEditRoles(false)
          return
        }
        
        const response = await fetch('/api/auth/me', {
          headers: { Authorization: `Bearer ${token}` }
        })
        
        if (!response.ok) throw new Error('Failed to fetch user')
        
        const data = await response.json()
        const currentUser = data?.user || {}
        const roleNames = [currentUser.Role, ...(currentUser.Roles || [])].filter(Boolean)
        const hasAdmin = roleNames.some(isAdminRoleName)
        const hasSuperAdmin = roleNames.includes('superadmin')
        setCanEditRoles(hasAdmin || hasSuperAdmin)
        setHideAdmin(hasSuperAdmin && !hasAdmin)
      } catch (e) {
        console.error('Error checking user roles:', e)
        setCanEditRoles(false)
      }
    }
    
    checkAdminRole()
  }, [])
  
  // Filters state
  const [filters, setFilters] = useState({
    id: '',
    username: '',
    fullName: '',
    email: '',
    status: '',
    primaryRole: '',
    extraRoles: ''
  })
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const recordsPerPage = 30

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const [u, r, c] = await Promise.all([
        api.get('/api/users'),
        api.get('/api/users/roles'),
        api.get('/api/company/all')
      ])
      setUsers(u.data)
      setRoles((r.data || []).map(x => x.Name).filter(name => !hideAdmin || !isAdminRoleName(name)))
      setCompanies(c.data.companies || [])
    } catch (e) {
      setError(e?.response?.data?.message || 'خطا در دریافت اطلاعات کاربران')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [hideAdmin])

  // Filter users based on filter criteria
  const filteredUsers = useMemo(() => {
    return users.filter(user => {
      if (hideAdmin && (isAdminRoleName(user.PrimaryRole) || (user.Roles || []).some(isAdminRoleName))) {
        return false
      }
      // ID filter
      if (filters.id && !String(user.Id).includes(filters.id)) {
        return false
      }
      // Username/National Code filter
      if (filters.username && !(user.NationalCode || user.Username || '').toLowerCase().includes(filters.username.toLowerCase())) {
        return false
      }
      // Full Name filter
      if (filters.fullName && !(user.FullName || '').toLowerCase().includes(filters.fullName.toLowerCase())) {
        return false
      }
      // Email filter
      if (filters.email && !(user.Email || '').toLowerCase().includes(filters.email.toLowerCase())) {
        return false
      }
      // Status filter
      if (filters.status) {
        if (filters.status === 'active' && !user.IsActive) return false
        if (filters.status === 'inactive' && user.IsActive) return false
      }
      // Primary Role filter
      if (filters.primaryRole && user.PrimaryRole !== filters.primaryRole) {
        return false
      }
      // Extra Roles filter
      if (filters.extraRoles) {
        const userRoles = user.Roles || []
        const hasRole = userRoles.some(role => 
          role.toLowerCase().includes(filters.extraRoles.toLowerCase())
        )
        if (!hasRole) return false
      }
      return true
    })
  }, [users, filters, hideAdmin])

  // Paginate filtered users
  const paginatedUsers = useMemo(() => {
    const startIndex = (currentPage - 1) * recordsPerPage
    const endIndex = startIndex + recordsPerPage
    return filteredUsers.slice(startIndex, endIndex)
  }, [filteredUsers, currentPage, recordsPerPage])

  // Calculate total pages
  const totalPages = Math.ceil(filteredUsers.length / recordsPerPage)

  // Handle filter change
  const handleFilterChange = (field, value) => {
    setFilters(prev => ({ ...prev, [field]: value }))
    setCurrentPage(1) // Reset to first page when filter changes
  }

  // Handle page change
  const goToPage = (page) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page)
    }
  }

  // Clear all filters
  const clearFilters = () => {
    setFilters({
      id: '',
      username: '',
      fullName: '',
      email: '',
      status: '',
      primaryRole: '',
      extraRoles: ''
    })
    setCurrentPage(1)
  }

  // Filter companies based on search term
  const filteredCompanies = useMemo(() => {
    if (!companySearchTerm) return companies
    return companies.filter(c => 
      c.CompanyName?.toLowerCase().includes(companySearchTerm.toLowerCase())
    )
  }, [companies, companySearchTerm])

  // Handle company selection
  const handleCompanySelect = (company) => {
    setSelectedCompany(company)
    setCompanySearchTerm(company.CompanyName)
    setShowCompanyDropdown(false)
  }

  // Clear company selection
  const clearCompanySelection = () => {
    setSelectedCompany(null)
    setCompanySearchTerm('')
    setShowCompanyDropdown(false)
  }

  const updateUserRole = async (userId, payload) => {
    setSavingId(userId)
    try {
      const { data } = await api.put(`/api/users/${userId}/roles`, payload)
      setUsers(prev => prev.map(u => (u.Id === userId ? { ...u, ...data } : u)))
    } catch (e) {
      alert(e?.response?.data?.message || 'خطا در ذخیره نقش‌های کاربر')
    } finally {
      setSavingId(null)
    }
  }

  const toggleActive = async (user) => {
    setBusyId(user.Id)
    try {
      const { data } = await api.put(`/api/users/${user.Id}/active`, { isActive: !user.IsActive })
      setUsers(prev => prev.map(u => (u.Id === user.Id ? { ...u, IsActive: data.IsActive } : u)))
    } catch (e) {
      alert(e?.response?.data?.message || 'خطا در تغییر وضعیت کاربر')
    } finally {
      setBusyId(null)
    }
  }

  const resetPassword = async (user) => {
    if (!confirm(`رمز عبور کاربر «${user.Username}» به 123456 ریست شود؟`)) return
    setBusyId(user.Id)
    try {
      await api.post(`/api/users/${user.Id}/reset-password`)
      alert('رمز عبور با موفقیت ریست شد: 123456')
    } catch (e) {
      alert(e?.response?.data?.message || 'خطا در ریست رمز عبور')
    } finally {
      setBusyId(null)
    }
  }

  const deleteUserReq = async (user) => {
    if (!confirm(`کاربر «${user.Username}» حذف شود؟ این عمل قابل بازگشت نیست.`)) return
    setBusyId(user.Id)
    try {
      await api.delete(`/api/users/${user.Id}`)
      setUsers(prev => prev.filter(u => u.Id !== user.Id))
    } catch (e) {
      alert(e?.response?.data?.message || 'خطا در حذف کاربر')
    } finally {
      setBusyId(null)
    }
  }

  // Pass canEditRoles to UserRow component
  const UserRow = ({ user, rowNumber, editable }) => {
    const [primaryRole, setPrimaryRole] = useState(user.PrimaryRole || 'User')
    const [extraRoles, setExtraRoles] = useState(new Set((user.Roles || []).filter(r => r !== primaryRole)))
    const [roleToAdd, setRoleToAdd] = useState('')

    useEffect(() => {
      setPrimaryRole(user.PrimaryRole || 'User')
      setExtraRoles(new Set((user.Roles || []).filter(r => r !== (user.PrimaryRole || 'User'))))
      setRoleToAdd('')
    }, [user])

    const addSelectedRole = () => {
      const r = roleToAdd
      if (!r) return
      if (r === primaryRole) return
      const next = new Set(extraRoles)
      next.add(r)
      setExtraRoles(next)
      setRoleToAdd('')
    }

    const removeRole = (role) => {
      const next = new Set(extraRoles)
      next.delete(role)
      setExtraRoles(next)
    }

    const save = () => {
      updateUserRole(user.Id, { primaryRole, roles: Array.from(extraRoles) })
    }

    const isReadOnly = !editable

    return (
      <tr style={isReadOnly ? { background: '#f9f9f9' } : {}}>
        <td>{rowNumber}</td>
        <td>{user.NationalCode || user.Username}</td>
        <td>{user.FullName}</td>
        <td>{user.Email || '-'}</td>
        <td>{user.IsActive ? 'فعال' : 'غیرفعال'}</td>
        <td>
          <select 
            value={primaryRole} 
            onChange={(e) => setPrimaryRole(e.target.value)}
            disabled={isReadOnly}
            style={isReadOnly ? { background: '#f5f5f5', cursor: 'not-allowed' } : {}}
          >
            {roles.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </td>
        <td>
          <div style={{ display:'flex', alignItems:'center', gap: 8, flexWrap: 'wrap' }}>
            <select 
              value={roleToAdd} 
              onChange={e => setRoleToAdd(e.target.value)}
              disabled={isReadOnly}
              style={isReadOnly ? { background: '#f5f5f5', cursor: 'not-allowed' } : {}}
            >
              <option value="">انتخاب نقش...</option>
              {roles.filter(r => r !== primaryRole && !extraRoles.has(r)).map(r => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
            <button 
              className="btn btn-blue" 
              onClick={addSelectedRole} 
              disabled={!roleToAdd || isReadOnly}
            >
              افزودن
            </button>
            <div style={{ display:'flex', gap: 6, flexWrap: 'wrap' }}>
              {Array.from(extraRoles).map(r => (
                <span key={r} className="badge">
                  {r}
                  <button 
                    className="badge-x" 
                    onClick={() => removeRole(r)} 
                    title="حذف"
                    disabled={isReadOnly}
                  >×</button>
                </span>
              ))}
            </div>
          </div>
        </td>
        <td>
          <button 
            className="btn btn-green" 
            onClick={save} 
            disabled={savingId === user.Id || isReadOnly}
          >
            {savingId === user.Id ? 'در حال ذخیره...' : isReadOnly ? 'غیرفعال' : 'ذخیره نقش‌ها'}
          </button>
          {' '}
          <button className="btn btn-yellow" onClick={() => toggleActive(user)} disabled={busyId === user.Id}>
            {busyId === user.Id ? '...' : (user.IsActive ? 'غیرفعال‌سازی' : 'فعال‌سازی')}
          </button>
          {' '}
          <button className="btn btn-gray" onClick={() => resetPassword(user)} disabled={busyId === user.Id}>ریست رمز</button>
          {' '}
          <button className="btn btn-red" onClick={() => deleteUserReq(user)} disabled={busyId === user.Id}>حذف</button>
        </td>
      </tr>
    )
  }

  if (loading) return <div className="card"><p>در حال بارگذاری...</p></div>
  if (error) return <div className="card"><p style={{ color: '#e00' }}>{error}</p></div>

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2 style={{ margin: 0 }}>مدیریت نقش‌های کاربران</h2>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <span style={{ color: '#666', fontSize: '14px' }}>
            نمایش {paginatedUsers.length} از {filteredUsers.length} کاربر
            {filteredUsers.length !== users.length && ` (از مجموع ${users.length})`}
          </span>
          <button className="btn btn-gray" onClick={clearFilters} style={{ padding: '6px 16px', fontSize: '14px' }}>
            پاک کردن فیلترها
          </button>
        </div>
      </div>

      {/* Company Search Section */}
      <div style={{ 
        marginBottom: '20px', 
        padding: '15px', 
        background: '#f8f9fa', 
        borderRadius: '8px',
        border: '1px solid #dee2e6'
      }}>
        <h3 style={{ margin: '0 0 10px 0', fontSize: '16px', color: '#333' }}>جستجوی شرکت</h3>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div style={{ flex: '1', minWidth: '250px', position: 'relative' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px', fontWeight: 'bold' }}>نام شرکت</label>
            <input
              type="text"
              placeholder="جستجوی نام شرکت..."
              value={companySearchTerm}
              onChange={(e) => setCompanySearchTerm(e.target.value)}
              onFocus={() => setShowCompanyDropdown(true)}
              onBlur={() => setTimeout(() => setShowCompanyDropdown(false), 200)}
              style={{ 
                width: '100%', 
                padding: '8px 12px', 
                fontSize: '14px', 
                border: '1px solid #ced4da', 
                borderRadius: '4px'
              }}
            />
            {showCompanyDropdown && filteredCompanies.length > 0 && !selectedCompany && (
              <div style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                maxHeight: '200px',
                overflowY: 'auto',
                background: 'white',
                border: '1px solid #ced4da',
                borderTop: 'none',
                borderRadius: '0 0 4px 4px',
                zIndex: 1000,
                boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
              }}>
                {filteredCompanies.map((company) => (
                  <div
                    key={company.NationalId}
                    onClick={() => handleCompanySelect(company)}
                    style={{
                      padding: '10px 12px',
                      cursor: 'pointer',
                      borderBottom: '1px solid #f0f0f0',
                      fontSize: '14px'
                    }}
                    onMouseEnter={(e) => e.target.style.background = '#f8f9fa'}
                    onMouseLeave={(e) => e.target.style.background = 'white'}
                  >
                    {company.CompanyName}
                  </div>
                ))}
              </div>
            )}
          </div>
          <div style={{ flex: '1', minWidth: '250px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px', fontWeight: 'bold' }}>کد ملی مدیرعامل</label>
            <input
              type="text"
              value={selectedCompany?.ManagerNationalCode || ''}
              readOnly
              placeholder="کد ملی مدیرعامل..."
              style={{ 
                width: '100%', 
                padding: '8px 12px', 
                fontSize: '14px', 
                border: '1px solid #ced4da', 
                borderRadius: '4px',
                background: '#e9ecef',
                color: '#495057'
              }}
            />
          </div>
          {selectedCompany && (
            <button 
              className="btn btn-red" 
              onClick={clearCompanySelection}
              style={{ marginTop: '28px', padding: '8px 16px', fontSize: '14px' }}
            >
              پاک کردن
            </button>
          )}
        </div>
        {selectedCompany && (
          <div style={{ marginTop: '10px', padding: '10px', background: '#d1ecf1', borderRadius: '4px', fontSize: '13px', color: '#0c5460' }}>
            <strong>شرکت انتخاب شده:</strong> {selectedCompany.CompanyName} | 
            <strong> شناسه ملی:</strong> {selectedCompany.NationalId} | 
            <strong> کد ملی مدیرعامل:</strong> {selectedCompany.ManagerNationalCode || 'ندارد'}
          </div>
        )}
      </div>
      
      <div style={{ overflowX: 'auto' }}>
        <table className="table table-bordered" style={{ width: '100%', minWidth: '1200px' }}>
          <thead>
            <tr>
              <th align="right">ردیف</th>
              <th align="right">نام کاربری</th>
              <th align="right">نام و نام خانوادگی</th>
              <th align="right">ایمیل</th>
              <th align="right">وضعیت</th>
              <th align="right">نقش اصلی</th>
              <th align="right">نقش‌های اضافه</th>
              <th></th>
            </tr>
            <tr style={{ background: '#f8f9fa' }}>
              <th>
                {/* No filter for row number */}
              </th>
              <th>
                <input
                  type="text"
                  placeholder="جستجو..."
                  value={filters.username}
                  onChange={(e) => handleFilterChange('username', e.target.value)}
                  style={{ width: '100%', padding: '4px 8px', fontSize: '13px', border: '1px solid #ddd', borderRadius: '4px' }}
                />
              </th>
              <th>
                <input
                  type="text"
                  placeholder="جستجو..."
                  value={filters.fullName}
                  onChange={(e) => handleFilterChange('fullName', e.target.value)}
                  style={{ width: '100%', padding: '4px 8px', fontSize: '13px', border: '1px solid #ddd', borderRadius: '4px' }}
                />
              </th>
              <th>
                <input
                  type="text"
                  placeholder="جستجو..."
                  value={filters.email}
                  onChange={(e) => handleFilterChange('email', e.target.value)}
                  style={{ width: '100%', padding: '4px 8px', fontSize: '13px', border: '1px solid #ddd', borderRadius: '4px' }}
                />
              </th>
              <th>
                <select
                  value={filters.status}
                  onChange={(e) => handleFilterChange('status', e.target.value)}
                  style={{ width: '100%', padding: '4px 8px', fontSize: '13px', border: '1px solid #ddd', borderRadius: '4px' }}
                >
                  <option value="">همه</option>
                  <option value="active">فعال</option>
                  <option value="inactive">غیرفعال</option>
                </select>
              </th>
              <th>
                <select
                  value={filters.primaryRole}
                  onChange={(e) => handleFilterChange('primaryRole', e.target.value)}
                  style={{ width: '100%', padding: '4px 8px', fontSize: '13px', border: '1px solid #ddd', borderRadius: '4px' }}
                >
                  <option value="">همه نقش‌ها</option>
                  {roles.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </th>
              <th>
                <input
                  type="text"
                  placeholder="جستجو در نقش‌ها..."
                  value={filters.extraRoles}
                  onChange={(e) => handleFilterChange('extraRoles', e.target.value)}
                  style={{ width: '100%', padding: '4px 8px', fontSize: '13px', border: '1px solid #ddd', borderRadius: '4px' }}
                />
              </th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {paginatedUsers.length === 0 ? (
              <tr>
                <td colSpan="8" style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
                  {filteredUsers.length === 0 ? 'کاربری یافت نشد' : 'داده‌ای برای نمایش وجود ندارد'}
                </td>
              </tr>
            ) : (
              paginatedUsers.map((u, index) => {
                const rowNumber = (currentPage - 1) * recordsPerPage + index + 1
                return <UserRow key={u.Id} user={u} rowNumber={rowNumber} editable={canEditRoles} />
              })
            )}
          </tbody>
        </table>
      </div>
      
      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center', 
          gap: '10px', 
          marginTop: '20px',
          padding: '10px'
        }}>
          <button 
            className="btn btn-gray" 
            onClick={() => goToPage(1)} 
            disabled={currentPage === 1}
            style={{ padding: '6px 12px', fontSize: '14px' }}
          >
            اولین
          </button>
          <button 
            className="btn btn-gray" 
            onClick={() => goToPage(currentPage - 1)} 
            disabled={currentPage === 1}
            style={{ padding: '6px 12px', fontSize: '14px' }}
          >
            قبلی
          </button>
          
          <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
            {/* Show page numbers */}
            {(() => {
              const pages = []
              const maxPagesToShow = 5
              let startPage = Math.max(1, currentPage - Math.floor(maxPagesToShow / 2))
              let endPage = Math.min(totalPages, startPage + maxPagesToShow - 1)
              
              if (endPage - startPage < maxPagesToShow - 1) {
                startPage = Math.max(1, endPage - maxPagesToShow + 1)
              }
              
              for (let i = startPage; i <= endPage; i++) {
                pages.push(
                  <button
                    key={i}
                    onClick={() => goToPage(i)}
                    style={{
                      padding: '6px 12px',
                      fontSize: '14px',
                      border: '1px solid #ddd',
                      borderRadius: '4px',
                      background: currentPage === i ? '#007bff' : 'white',
                      color: currentPage === i ? 'white' : '#333',
                      cursor: 'pointer',
                      fontWeight: currentPage === i ? 'bold' : 'normal'
                    }}
                  >
                    {i}
                  </button>
                )
              }
              return pages
            })()}
          </div>
          
          <button 
            className="btn btn-gray" 
            onClick={() => goToPage(currentPage + 1)} 
            disabled={currentPage === totalPages}
            style={{ padding: '6px 12px', fontSize: '14px' }}
          >
            بعدی
          </button>
          <button 
            className="btn btn-gray" 
            onClick={() => goToPage(totalPages)} 
            disabled={currentPage === totalPages}
            style={{ padding: '6px 12px', fontSize: '14px' }}
          >
            آخرین
          </button>
          
          <span style={{ marginRight: '15px', color: '#666', fontSize: '14px' }}>
            صفحه {currentPage} از {totalPages}
          </span>
        </div>
      )}
    </div>
  )
}
