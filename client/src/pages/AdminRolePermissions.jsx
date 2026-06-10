import React, { useEffect, useState } from 'react';

export default function AdminRolePermissions() {
  const [roles, setRoles] = useState([]);
  const [pages, setPages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [selectedRole, setSelectedRole] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('token');
      
      // Fetch all pages
      const pagesRes = await fetch('/api/permissions/pages', {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (!pagesRes.ok) throw new Error('خطا در دریافت صفحات');
      const pagesData = await pagesRes.json();
      setPages(pagesData.pages || []);
      
      // Fetch roles with permissions
      const rolesRes = await fetch('/api/permissions/roles', {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (!rolesRes.ok) throw new Error('خطا در دریافت نقش‌ها');
      const rolesData = await rolesRes.json();
      setRoles(rolesData.roles || []);
      
      if (rolesData.roles && rolesData.roles.length > 0) {
        setSelectedRole(rolesData.roles[0]);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePermissionToggle = async (roleId, pageId, currentAccess) => {
    setError('');
    setSuccess('');
    
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/permissions/roles/${roleId}/pages/${pageId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ canAccess: !currentAccess })
      });
      
      if (!res.ok) throw new Error('خطا در تغییر دسترسی');
      
      setSuccess('دسترسی با موفقیت تغییر یافت');
      
      // Update local state
      setRoles(prevRoles => 
        prevRoles.map(role => {
          if (role.Id === roleId) {
            return {
              ...role,
              Permissions: role.Permissions.map(perm => 
                perm.PageId === pageId 
                  ? { ...perm, CanAccess: !currentAccess }
                  : perm
              )
            };
          }
          return role;
        })
      );
      
      // Update selected role if it's the one being modified
      if (selectedRole && selectedRole.Id === roleId) {
        setSelectedRole(prev => ({
          ...prev,
          Permissions: prev.Permissions.map(perm => 
            perm.PageId === pageId 
              ? { ...perm, CanAccess: !currentAccess }
              : perm
          )
        }));
      }
      
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleBulkUpdate = async (roleId, permissions) => {
    setError('');
    setSuccess('');
    
    try {
      const token = localStorage.getItem('token');
      const permissionsArray = permissions.map(p => ({
        pageId: p.PageId,
        canAccess: p.CanAccess
      }));
      
      const res = await fetch(`/api/permissions/roles/${roleId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ permissions: permissionsArray })
      });
      
      if (!res.ok) throw new Error('خطا در به‌روزرسانی دسترسی‌ها');
      
      setSuccess('دسترسی‌ها با موفقیت به‌روزرسانی شد');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleSelectAll = (roleId) => {
    setRoles(prevRoles => 
      prevRoles.map(role => {
        if (role.Id === roleId) {
          return {
            ...role,
            Permissions: role.Permissions.map(perm => ({ ...perm, CanAccess: true }))
          };
        }
        return role;
      })
    );
    
    if (selectedRole && selectedRole.Id === roleId) {
      setSelectedRole(prev => ({
        ...prev,
        Permissions: prev.Permissions.map(perm => ({ ...perm, CanAccess: true }))
      }));
    }
  };

  const handleDeselectAll = (roleId) => {
    setRoles(prevRoles => 
      prevRoles.map(role => {
        if (role.Id === roleId) {
          return {
            ...role,
            Permissions: role.Permissions.map(perm => ({ ...perm, CanAccess: false }))
          };
        }
        return role;
      })
    );
    
    if (selectedRole && selectedRole.Id === roleId) {
      setSelectedRole(prev => ({
        ...prev,
        Permissions: prev.Permissions.map(perm => ({ ...perm, CanAccess: false }))
      }));
    }
  };

  if (loading) {
    return <div className="loading">در حال بارگذاری...</div>;
  }

  return (
    <div style={{ padding: '20px' }}>
      <h2>مدیریت دسترسی‌های نقش‌ها</h2>
      <p style={{ color: '#666', marginBottom: '20px' }}>
        در این بخش می‌توانید تعیین کنید که هر نقش به کدام صفحات دسترسی دارد
      </p>

      {error && (
        <div style={{ 
          padding: '12px', 
          background: '#fee', 
          color: '#c33', 
          borderRadius: '4px',
          marginBottom: '20px'
        }}>
          {error}
        </div>
      )}

      {success && (
        <div style={{ 
          padding: '12px', 
          background: '#efe', 
          color: '#3c3', 
          borderRadius: '4px',
          marginBottom: '20px'
        }}>
          {success}
        </div>
      )}

      <div style={{ display: 'flex', gap: '20px', marginBottom: '20px' }}>
        <div style={{ flex: '0 0 200px' }}>
          <h3 style={{ marginBottom: '10px' }}>نقش‌ها</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {roles.map(role => (
              <button
                key={role.Id}
                onClick={() => setSelectedRole(role)}
                style={{
                  padding: '12px',
                  background: selectedRole?.Id === role.Id ? '#3b82f6' : '#f3f4f6',
                  color: selectedRole?.Id === role.Id ? 'white' : '#1f2937',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  textAlign: 'right',
                  fontWeight: selectedRole?.Id === role.Id ? 'bold' : 'normal',
                  transition: 'all 0.2s'
                }}
              >
                {role.Name}
              </button>
            ))}
          </div>
        </div>

        <div style={{ flex: 1 }}>
          {selectedRole ? (
            <>
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                marginBottom: '20px'
              }}>
                <h3>دسترسی‌های نقش: {selectedRole.Name}</h3>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    onClick={() => handleSelectAll(selectedRole.Id)}
                    style={{
                      padding: '8px 16px',
                      background: '#10b981',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer'
                    }}
                  >
                    انتخاب همه
                  </button>
                  <button
                    onClick={() => handleDeselectAll(selectedRole.Id)}
                    style={{
                      padding: '8px 16px',
                      background: '#ef4444',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer'
                    }}
                  >
                    حذف همه
                  </button>
                  <button
                    onClick={() => handleBulkUpdate(selectedRole.Id, selectedRole.Permissions)}
                    style={{
                      padding: '8px 16px',
                      background: '#3b82f6',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer'
                    }}
                  >
                    ذخیره تغییرات
                  </button>
                </div>
              </div>

              <div style={{ 
                background: 'white', 
                borderRadius: '8px', 
                border: '1px solid #e5e7eb',
                overflow: 'hidden'
              }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}>
                      <th style={{ padding: '12px', textAlign: 'right', fontWeight: 'bold' }}>
                        عنوان صفحه
                      </th>
                      <th style={{ padding: '12px', textAlign: 'right', fontWeight: 'bold' }}>
                        مسیر
                      </th>
                      <th style={{ padding: '12px', textAlign: 'right', fontWeight: 'bold' }}>
                        توضیحات
                      </th>
                      <th style={{ padding: '12px', textAlign: 'center', fontWeight: 'bold', width: '120px' }}>
                        دسترسی
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedRole.Permissions && selectedRole.Permissions.length > 0 ? (
                      selectedRole.Permissions.map(perm => (
                        <tr 
                          key={perm.PageId}
                          style={{ 
                            borderBottom: '1px solid #e5e7eb',
                            background: perm.CanAccess ? '#f0fdf4' : 'white'
                          }}
                        >
                          <td style={{ padding: '12px' }}>{perm.PageTitle}</td>
                          <td style={{ padding: '12px', fontFamily: 'monospace', fontSize: '13px' }}>
                            {perm.PagePath}
                          </td>
                          <td style={{ padding: '12px', color: '#6b7280', fontSize: '14px' }}>
                            {perm.Description || '-'}
                          </td>
                          <td style={{ padding: '12px', textAlign: 'center' }}>
                            <label style={{ 
                              display: 'inline-flex', 
                              alignItems: 'center',
                              cursor: 'pointer'
                            }}>
                              <input
                                type="checkbox"
                                checked={perm.CanAccess}
                                onChange={() => handlePermissionToggle(
                                  selectedRole.Id, 
                                  perm.PageId, 
                                  perm.CanAccess
                                )}
                                style={{ 
                                  width: '20px', 
                                  height: '20px',
                                  cursor: 'pointer'
                                }}
                              />
                            </label>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="4" style={{ padding: '20px', textAlign: 'center', color: '#6b7280' }}>
                          هیچ صفحه‌ای یافت نشد
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <div style={{ 
              padding: '40px', 
              textAlign: 'center', 
              color: '#6b7280',
              background: '#f9fafb',
              borderRadius: '8px'
            }}>
              لطفاً یک نقش را انتخاب کنید
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
