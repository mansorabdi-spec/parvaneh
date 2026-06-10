import React, { useEffect, useState } from 'react'
import { api } from '../lib/api.js'

export default function AdminRolePermissionsManagement() {
  const [permissions, setPermissions] = useState([])
  const [roles, setRoles] = useState([])
  const [permissionKeys, setPermissionKeys] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [viewMode, setViewMode] = useState('table') // 'table' or 'matrix'
  const [selectedRole, setSelectedRole] = useState('')
  const [permissionsByRole, setPermissionsByRole] = useState({})
  
  // Form state
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [formData, setFormData] = useState({
    roleName: '',
    permissionKey: '',
    canView: true,
    canEdit: false
  })
  
  // Filter state
  const [filters, setFilters] = useState({
    roleName: '',
    permissionKey: ''
  })

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      const [permsRes, rolesRes, keysRes, byRoleRes] = await Promise.all([
        api.get('/api/role-permissions'),
        api.get('/api/role-permissions/roles'),
        api.get('/api/role-permissions/permission-keys'),
        api.get('/api/role-permissions/by-role')
      ])
      
      setPermissions(permsRes.data.permissions || [])
      setRoles(rolesRes.data.roles || [])
      setPermissionKeys(keysRes.data.permissionKeys || [])
      setPermissionsByRole(byRoleRes.data.permissions || {})
      setError('')
    } catch (e) {
      setError(e?.response?.data?.message || 'خطا در بارگذاری اطلاعات')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      if (editingId) {
        await api.put(`/api/role-permissions/${editingId}`, {
          canView: formData.canView,
          canEdit: formData.canEdit
        })
        alert('دسترسی با موفقیت به‌روزرسانی شد')
      } else {
        await api.post('/api/role-permissions', formData)
        alert('دسترسی با موفقیت ایجاد شد')
      }
      
      setShowAddForm(false)
      setEditingId(null)
      setFormData({ roleName: '', permissionKey: '', canView: true, canEdit: false })
      loadData()
    } catch (e) {
      alert(e?.response?.data?.message || 'خطا در ذخیره اطلاعات')
    }
  }

  const handleEdit = (perm) => {
    setEditingId(perm.Id)
    setFormData({
      roleName: perm.RoleName,
      permissionKey: perm.PermissionKey,
      canView: perm.CanView,
      canEdit: perm.CanEdit
    })
    setShowAddForm(true)
  }

  const handleDelete = async (id) => {
    if (!confirm('آیا از حذف این دسترسی اطمینان دارید؟')) return
    
    try {
      await api.delete(`/api/role-permissions/${id}`)
      alert('دسترسی با موفقیت حذف شد')
      loadData()
    } catch (e) {
      alert(e?.response?.data?.message || 'خطا در حذف دسترسی')
    }
  }

  const handleMatrixToggle = async (roleName, permissionKey, field, currentValue) => {
    try {
      const perm = permissions.find(p => p.RoleName === roleName && p.PermissionKey === permissionKey)
      
      if (perm) {
        // Update existing permission
        await api.put(`/api/role-permissions/${perm.Id}`, {
          canView: field === 'canView' ? !currentValue : perm.CanView,
          canEdit: field === 'canEdit' ? !currentValue : perm.CanEdit
        })
      } else {
        // Create new permission
        await api.post('/api/role-permissions', {
          roleName,
          permissionKey,
          canView: field === 'canView' ? true : false,
          canEdit: field === 'canEdit' ? true : false
        })
      }
      
      loadData()
    } catch (e) {
      alert(e?.response?.data?.message || 'خطا در به‌روزرسانی دسترسی')
    }
  }

  const filteredPermissions = permissions.filter(p => {
    if (filters.roleName && !p.RoleName.toLowerCase().includes(filters.roleName.toLowerCase())) return false
    if (filters.permissionKey && !p.PermissionKey.toLowerCase().includes(filters.permissionKey.toLowerCase())) return false
    return true
  })

  const getPermissionValue = (roleName, permissionKey, field) => {
    const perm = permissions.find(p => p.RoleName === roleName && p.PermissionKey === permissionKey)
    return perm ? perm[field] : false
  }

  if (loading) return (
    <div style={{ padding: '20px' }}>
      <div className="box">در حال بارگذاری...</div>
    </div>
  )

  return (
    <div style={{ padding: '20px' }}>
      <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0 }}>مدیریت دسترسی‌های نقش‌ها (RolePermissions)</h2>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            onClick={() => setViewMode(viewMode === 'table' ? 'matrix' : 'table')}
            style={{
              padding: '8px 16px',
              background: '#6b7280',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            {viewMode === 'table' ? '📊 نمایش ماتریسی' : '📋 نمایش جدولی'}
          </button>
          <button
            onClick={() => {
              setShowAddForm(!showAddForm)
              setEditingId(null)
              setFormData({ roleName: '', permissionKey: '', canView: true, canEdit: false })
            }}
            style={{
              padding: '8px 16px',
              background: '#10b981',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 'bold'
            }}
          >
            ➕ افزودن دسترسی جدید
          </button>
          <button
            onClick={loadData}
            style={{
              padding: '8px 16px',
              background: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            🔄 بروزرسانی
          </button>
        </div>
      </div>

      {error && (
        <div style={{ padding: '12px', background: '#fee', color: '#c00', borderRadius: '6px', marginBottom: '20px' }}>
          {error}
        </div>
      )}

      {/* Add/Edit Form */}
      {showAddForm && (
        <div className="box" style={{ marginBottom: '20px' }}>
          <h3>{editingId ? 'ویرایش دسترسی' : 'افزودن دسترسی جدید'}</h3>
          <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>نام نقش *</label>
              {editingId ? (
                <input
                  type="text"
                  value={formData.roleName}
                  disabled
                  style={{ width: '100%', padding: '8px', border: '1px solid #d1d5db', borderRadius: '6px', background: '#f3f4f6' }}
                />
              ) : (
                <select
                  value={formData.roleName}
                  onChange={(e) => setFormData({ ...formData, roleName: e.target.value })}
                  required
                  style={{ width: '100%', padding: '8px', border: '1px solid #d1d5db', borderRadius: '6px' }}
                >
                  <option value="">انتخاب کنید...</option>
                  {roles.map(role => (
                    <option key={role} value={role}>{role}</option>
                  ))}
                  <option value="__new__">+ نقش جدید</option>
                </select>
              )}
              {formData.roleName === '__new__' && (
                <input
                  type="text"
                  placeholder="نام نقش جدید"
                  onChange={(e) => setFormData({ ...formData, roleName: e.target.value })}
                  style={{ width: '100%', padding: '8px', border: '1px solid #d1d5db', borderRadius: '6px', marginTop: '8px' }}
                />
              )}
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>کلید دسترسی *</label>
              {editingId ? (
                <input
                  type="text"
                  value={formData.permissionKey}
                  disabled
                  style={{ width: '100%', padding: '8px', border: '1px solid #d1d5db', borderRadius: '6px', background: '#f3f4f6' }}
                />
              ) : (
                <select
                  value={formData.permissionKey}
                  onChange={(e) => setFormData({ ...formData, permissionKey: e.target.value })}
                  required
                  style={{ width: '100%', padding: '8px', border: '1px solid #d1d5db', borderRadius: '6px' }}
                >
                  <option value="">انتخاب کنید...</option>
                  {permissionKeys.map(key => (
                    <option key={key} value={key}>{key}</option>
                  ))}
                  <option value="__new__">+ کلید جدید</option>
                </select>
              )}
              {formData.permissionKey === '__new__' && (
                <input
                  type="text"
                  placeholder="کلید دسترسی جدید"
                  onChange={(e) => setFormData({ ...formData, permissionKey: e.target.value })}
                  style={{ width: '100%', padding: '8px', border: '1px solid #d1d5db', borderRadius: '6px', marginTop: '8px' }}
                />
              )}
            </div>

            <div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={formData.canView}
                  onChange={(e) => setFormData({ ...formData, canView: e.target.checked })}
                  style={{ width: '18px', height: '18px' }}
                />
                <span style={{ fontWeight: 'bold' }}>مشاهده (CanView)</span>
              </label>
            </div>

            <div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={formData.canEdit}
                  onChange={(e) => setFormData({ ...formData, canEdit: e.target.checked })}
                  style={{ width: '18px', height: '18px' }}
                />
                <span style={{ fontWeight: 'bold' }}>ویرایش (CanEdit)</span>
              </label>
            </div>

            <div style={{ gridColumn: '1 / -1', display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => {
                  setShowAddForm(false)
                  setEditingId(null)
                  setFormData({ roleName: '', permissionKey: '', canView: true, canEdit: false })
                }}
                style={{
                  padding: '8px 16px',
                  background: '#6b7280',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer'
                }}
              >
                انصراف
              </button>
              <button
                type="submit"
                style={{
                  padding: '8px 16px',
                  background: '#10b981',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: 'bold'
                }}
              >
                {editingId ? 'به‌روزرسانی' : 'ایجاد'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Table View */}
      {viewMode === 'table' && (
        <div className="box">
          <div style={{ marginBottom: '16px', display: 'flex', gap: '12px' }}>
            <input
              type="text"
              placeholder="فیلتر بر اساس نقش..."
              value={filters.roleName}
              onChange={(e) => setFilters({ ...filters, roleName: e.target.value })}
              style={{ flex: 1, padding: '8px', border: '1px solid #d1d5db', borderRadius: '6px' }}
            />
            <input
              type="text"
              placeholder="فیلتر بر اساس کلید دسترسی..."
              value={filters.permissionKey}
              onChange={(e) => setFilters({ ...filters, permissionKey: e.target.value })}
              style={{ flex: 1, padding: '8px', border: '1px solid #d1d5db', borderRadius: '6px' }}
            />
            <button
              onClick={() => setFilters({ roleName: '', permissionKey: '' })}
              style={{
                padding: '8px 16px',
                background: '#ef4444',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer'
              }}
            >
              پاک کردن فیلتر
            </button>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f3f4f6', borderBottom: '2px solid #d1d5db' }}>
                  <th style={{ padding: '12px', textAlign: 'center', fontWeight: 'bold' }}>ردیف</th>
                  <th style={{ padding: '12px', textAlign: 'center', fontWeight: 'bold' }}>نام نقش</th>
                  <th style={{ padding: '12px', textAlign: 'center', fontWeight: 'bold' }}>کلید دسترسی</th>
                  <th style={{ padding: '12px', textAlign: 'center', fontWeight: 'bold' }}>مشاهده</th>
                  <th style={{ padding: '12px', textAlign: 'center', fontWeight: 'bold' }}>ویرایش</th>
                  <th style={{ padding: '12px', textAlign: 'center', fontWeight: 'bold' }}>تاریخ ایجاد</th>
                  <th style={{ padding: '12px', textAlign: 'center', fontWeight: 'bold' }}>عملیات</th>
                </tr>
              </thead>
              <tbody>
                {filteredPermissions.map((perm, idx) => (
                  <tr 
                    key={perm.Id}
                    style={{ 
                      borderBottom: '1px solid #e5e7eb',
                      background: idx % 2 === 0 ? 'white' : '#f9fafb'
                    }}
                  >
                    <td style={{ padding: '12px', textAlign: 'center' }}>{idx + 1}</td>
                    <td style={{ padding: '12px', textAlign: 'center', fontWeight: 'bold' }}>
                      <span style={{ 
                        padding: '4px 12px', 
                        borderRadius: '12px', 
                        background: '#dbeafe',
                        color: '#1e40af',
                        fontSize: '13px'
                      }}>
                        {perm.RoleName}
                      </span>
                    </td>
                    <td style={{ padding: '12px', textAlign: 'center', fontFamily: 'monospace', fontSize: '13px' }}>
                      {perm.PermissionKey}
                    </td>
                    <td style={{ padding: '12px', textAlign: 'center' }}>
                      {perm.CanView ? (
                        <span style={{ color: '#10b981', fontSize: '20px' }}>✓</span>
                      ) : (
                        <span style={{ color: '#ef4444', fontSize: '20px' }}>✗</span>
                      )}
                    </td>
                    <td style={{ padding: '12px', textAlign: 'center' }}>
                      {perm.CanEdit ? (
                        <span style={{ color: '#10b981', fontSize: '20px' }}>✓</span>
                      ) : (
                        <span style={{ color: '#ef4444', fontSize: '20px' }}>✗</span>
                      )}
                    </td>
                    <td style={{ padding: '12px', textAlign: 'center', fontSize: '12px', color: '#6b7280' }}>
                      {new Date(perm.CreatedAt).toLocaleDateString('fa-IR')}
                    </td>
                    <td style={{ padding: '12px', textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                        <button
                          onClick={() => handleEdit(perm)}
                          style={{
                            padding: '4px 12px',
                            background: '#3b82f6',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '12px'
                          }}
                        >
                          ✏️ ویرایش
                        </button>
                        <button
                          onClick={() => handleDelete(perm.Id)}
                          style={{
                            padding: '4px 12px',
                            background: '#ef4444',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '12px'
                          }}
                        >
                          🗑️ حذف
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredPermissions.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>📭</div>
              <div style={{ fontSize: '18px', fontWeight: 'bold' }}>دسترسی یافت نشد</div>
            </div>
          )}
        </div>
      )}

      {/* Matrix View */}
      {viewMode === 'matrix' && (
        <div className="box">
          <div style={{ marginBottom: '16px' }}>
            <label style={{ fontWeight: 'bold', marginRight: '8px' }}>فیلتر نقش:</label>
            <select
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
              style={{ padding: '8px', border: '1px solid #d1d5db', borderRadius: '6px', minWidth: '200px' }}
            >
              <option value="">همه نقش‌ها</option>
              {roles.map(role => (
                <option key={role} value={role}>{role}</option>
              ))}
            </select>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: '#f3f4f6' }}>
                  <th style={{ padding: '12px', textAlign: 'right', fontWeight: 'bold', position: 'sticky', right: 0, background: '#f3f4f6', zIndex: 1 }}>
                    کلید دسترسی
                  </th>
                  {(selectedRole ? [selectedRole] : roles).map(role => (
                    <th key={role} colSpan={2} style={{ padding: '12px', textAlign: 'center', fontWeight: 'bold', borderLeft: '2px solid #d1d5db' }}>
                      {role}
                    </th>
                  ))}
                </tr>
                <tr style={{ background: '#f9fafb', borderBottom: '2px solid #d1d5db' }}>
                  <th style={{ padding: '8px', textAlign: 'right', position: 'sticky', right: 0, background: '#f9fafb', zIndex: 1 }}></th>
                  {(selectedRole ? [selectedRole] : roles).map(role => (
                    <React.Fragment key={role}>
                      <th style={{ padding: '8px', textAlign: 'center', fontSize: '11px', color: '#6b7280' }}>مشاهده</th>
                      <th style={{ padding: '8px', textAlign: 'center', fontSize: '11px', color: '#6b7280', borderLeft: '2px solid #d1d5db' }}>ویرایش</th>
                    </React.Fragment>
                  ))}
                </tr>
              </thead>
              <tbody>
                {permissionKeys.map((key, idx) => (
                  <tr key={key} style={{ borderBottom: '1px solid #e5e7eb', background: idx % 2 === 0 ? 'white' : '#f9fafb' }}>
                    <td style={{ padding: '12px', fontFamily: 'monospace', fontWeight: 'bold', position: 'sticky', right: 0, background: idx % 2 === 0 ? 'white' : '#f9fafb', zIndex: 1 }}>
                      {key}
                    </td>
                    {(selectedRole ? [selectedRole] : roles).map(role => {
                      const canView = getPermissionValue(role, key, 'CanView')
                      const canEdit = getPermissionValue(role, key, 'CanEdit')
                      return (
                        <React.Fragment key={role}>
                          <td 
                            style={{ 
                              padding: '8px', 
                              textAlign: 'center', 
                              cursor: 'pointer',
                              background: canView ? '#d1fae5' : 'transparent'
                            }}
                            onClick={() => handleMatrixToggle(role, key, 'canView', canView)}
                          >
                            {canView ? '✓' : '—'}
                          </td>
                          <td 
                            style={{ 
                              padding: '8px', 
                              textAlign: 'center', 
                              cursor: 'pointer',
                              background: canEdit ? '#fef3c7' : 'transparent',
                              borderLeft: '2px solid #d1d5db'
                            }}
                            onClick={() => handleMatrixToggle(role, key, 'canEdit', canEdit)}
                          >
                            {canEdit ? '✓' : '—'}
                          </td>
                        </React.Fragment>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ marginTop: '16px', padding: '12px', background: '#eff6ff', borderRadius: '6px', fontSize: '13px' }}>
            <strong>💡 راهنما:</strong> برای تغییر دسترسی‌ها، روی سلول‌های جدول کلیک کنید.
          </div>
        </div>
      )}

      {/* Statistics */}
      <div style={{ marginTop: '20px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
        <div className="box" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#3b82f6' }}>{permissions.length}</div>
          <div style={{ fontSize: '14px', color: '#6b7280', marginTop: '8px' }}>کل دسترسی‌ها</div>
        </div>
        <div className="box" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#10b981' }}>{roles.length}</div>
          <div style={{ fontSize: '14px', color: '#6b7280', marginTop: '8px' }}>تعداد نقش‌ها</div>
        </div>
        <div className="box" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#f59e0b' }}>{permissionKeys.length}</div>
          <div style={{ fontSize: '14px', color: '#6b7280', marginTop: '8px' }}>کلیدهای دسترسی</div>
        </div>
      </div>
    </div>
  )
}
