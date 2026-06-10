import React, { useEffect, useState } from 'react'
import { api } from '../lib/api.js'
import { useNavigate } from 'react-router-dom'

export default function AdminPrintStatistics() {
  const navigate = useNavigate()
  const [currentUser, setCurrentUser] = useState(null)
  const [statistics, setStatistics] = useState(null)
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  
  // Filters
  const [filters, setFilters] = useState({
    licenseType: '',
    startDate: '',
    endDate: '',
    trackingNo: '',
    page: 1,
    limit: 20
  })

  useEffect(() => {
    loadCurrentUser()
  }, [])

  useEffect(() => {
    // Don't do anything if user is not loaded yet
    if (!currentUser) return
    
    // Redirect if not admin
    if (currentUser.Role !== 'Admin') {
      navigate('/')
      return
    }
    
    // Load data if user is admin
    loadStatistics()
    loadLogs()
  }, [currentUser, filters])

  const loadCurrentUser = async () => {
    try {
      const { data } = await api.get('/api/auth/me')
      setCurrentUser(data.user)
    } catch (e) {
      console.error('Error loading current user:', e)
      navigate('/')
    }
  }

  const loadStatistics = async () => {
    try {
      const params = {}
      if (filters.startDate) params.startDate = filters.startDate
      if (filters.endDate) params.endDate = filters.endDate

      const { data } = await api.get('/api/printlog/statistics', { params })
      setStatistics(data)
    } catch (e) {
      console.error('Error loading statistics:', e)
      setError('خطا در بارگذاری آمار')
    }
  }

  const loadLogs = async () => {
    try {
      setLoading(true)
      const params = { ...filters }
      
      const { data } = await api.get('/api/printlog/all', { params })
      setLogs(data.logs)
      setError('')
    } catch (e) {
      console.error('Error loading logs:', e)
      setError('خطا در بارگذاری لیست چاپ‌ها')
    } finally {
      setLoading(false)
    }
  }

  const handleFilterChange = (field, value) => {
    setFilters(prev => ({ ...prev, [field]: value, page: 1 }))
  }

  const formatDateTime = (dateStr) => {
    if (!dateStr) return ''
    const date = new Date(dateStr)
    return date.toLocaleDateString('fa-IR') + ' ' + date.toLocaleTimeString('fa-IR')
  }

  const getLicenseTypeLabel = (type) => {
    const labels = {
      'Activity': 'پروانه فعالیت',
      'Exploitation': 'پروانه بهره‌برداری',
      'Employment': 'پروانه اشتغال',
      'LegalEntity': 'پروانه فعالیت حقوقی'
    }
    return labels[type] || type
  }

  // Show loading while user is being fetched
  if (!currentUser) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <div>در حال بارگذاری...</div>
      </div>
    )
  }

  // Redirect if not admin (this should not render as useEffect handles navigation)
  if (currentUser.Role !== 'Admin') {
    return null
  }

  return (
    <div style={{ padding: '20px', maxWidth: '1400px', margin: '0 auto' }}>
      <h1 style={{ marginBottom: '30px', color: '#333' }}>📊 آمار و گزارش چاپ پروانه‌ها</h1>

      {error && (
        <div style={{ 
          padding: '15px', 
          background: '#fee', 
          color: '#c33', 
          borderRadius: '8px',
          marginBottom: '20px'
        }}>
          {error}
        </div>
      )}

      {/* Statistics Cards */}
      {statistics && (
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
          gap: '20px',
          marginBottom: '30px'
        }}>
          <div style={{
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white',
            padding: '25px',
            borderRadius: '12px',
            boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
          }}>
            <div style={{ fontSize: '14px', opacity: 0.9 }}>مجموع چاپ‌ها</div>
            <div style={{ fontSize: '36px', fontWeight: 'bold', marginTop: '10px' }}>
              {statistics.totalPrints?.toLocaleString('fa-IR')}
            </div>
          </div>

          {statistics.printsByLicenseType?.map((item, idx) => (
            <div key={idx} style={{
              background: idx % 3 === 0 ? 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)' :
                         idx % 3 === 1 ? 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)' :
                         'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
              color: 'white',
              padding: '25px',
              borderRadius: '12px',
              boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
            }}>
              <div style={{ fontSize: '14px', opacity: 0.9 }}>
                {getLicenseTypeLabel(item.LicenseType)}
              </div>
              <div style={{ fontSize: '36px', fontWeight: 'bold', marginTop: '10px' }}>
                {item.PrintCount?.toLocaleString('fa-IR')}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Top Users */}
      {statistics?.printsByUser && statistics.printsByUser.length > 0 && (
        <div style={{ 
          background: 'white', 
          padding: '20px', 
          borderRadius: '12px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          marginBottom: '30px'
        }}>
          <h3 style={{ marginBottom: '15px' }}>👥 کاربران برتر (بیشترین چاپ)</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
            {statistics.printsByUser.map((user, idx) => (
              <div key={idx} style={{
                padding: '12px',
                background: '#f8f9fa',
                borderRadius: '8px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <span>{user.PrintedByUsername}</span>
                <span style={{ fontWeight: 'bold', color: '#667eea' }}>
                  {user.PrintCount?.toLocaleString('fa-IR')}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div style={{ 
        background: 'white', 
        padding: '20px', 
        borderRadius: '12px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        marginBottom: '20px'
      }}>
        <h3 style={{ marginBottom: '15px' }}>🔍 فیلترها</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px' }}>نوع پروانه</label>
            <select
              value={filters.licenseType}
              onChange={(e) => handleFilterChange('licenseType', e.target.value)}
              style={{
                width: '100%',
                padding: '8px',
                borderRadius: '6px',
                border: '1px solid #ddd'
              }}
            >
              <option value="">همه</option>
              <option value="Activity">پروانه فعالیت</option>
              <option value="Exploitation">پروانه بهره‌برداری</option>
              <option value="Employment">پروانه اشتغال</option>
              <option value="LegalEntity">پروانه فعالیت حقوقی</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px' }}>شماره پیگیری</label>
            <input
              type="text"
              value={filters.trackingNo}
              onChange={(e) => handleFilterChange('trackingNo', e.target.value)}
              placeholder="جستجو..."
              style={{
                width: '100%',
                padding: '8px',
                borderRadius: '6px',
                border: '1px solid #ddd'
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px' }}>از تاریخ</label>
            <input
              type="date"
              value={filters.startDate}
              onChange={(e) => handleFilterChange('startDate', e.target.value)}
              style={{
                width: '100%',
                padding: '8px',
                borderRadius: '6px',
                border: '1px solid #ddd'
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px' }}>تا تاریخ</label>
            <input
              type="date"
              value={filters.endDate}
              onChange={(e) => handleFilterChange('endDate', e.target.value)}
              style={{
                width: '100%',
                padding: '8px',
                borderRadius: '6px',
                border: '1px solid #ddd'
              }}
            />
          </div>
        </div>
      </div>

      {/* Print Logs Table */}
      <div style={{ 
        background: 'white', 
        padding: '20px', 
        borderRadius: '12px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
      }}>
        <h3 style={{ marginBottom: '15px' }}>📋 تاریخچه چاپ پروانه‌ها</h3>
        
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px' }}>در حال بارگذاری...</div>
        ) : logs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
            هیچ رکوردی یافت نشد
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f8f9fa', borderBottom: '2px solid #dee2e6' }}>
                  <th style={{ padding: '12px', textAlign: 'right' }}>ردیف</th>
                  <th style={{ padding: '12px', textAlign: 'right' }}>شماره پیگیری</th>
                  <th style={{ padding: '12px', textAlign: 'right' }}>نوع پروانه</th>
                  <th style={{ padding: '12px', textAlign: 'right' }}>متقاضی</th>
                  <th style={{ padding: '12px', textAlign: 'right' }}>چاپ شده توسط</th>
                  <th style={{ padding: '12px', textAlign: 'right' }}>تاریخ چاپ</th>
                  <th style={{ padding: '12px', textAlign: 'right' }}>IP</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log, idx) => (
                  <tr key={log.PrintLogId} style={{ borderBottom: '1px solid #dee2e6' }}>
                    <td style={{ padding: '12px' }}>
                      {((filters.page - 1) * filters.limit + idx + 1).toLocaleString('fa-IR')}
                    </td>
                    <td style={{ padding: '12px', fontFamily: 'monospace' }}>
                      {log.TrackingNo}
                    </td>
                    <td style={{ padding: '12px' }}>
                      <span style={{
                        padding: '4px 12px',
                        borderRadius: '12px',
                        fontSize: '12px',
                        background: log.LicenseType === 'Activity' ? '#e3f2fd' :
                                   log.LicenseType === 'Exploitation' ? '#fff3e0' :
                                   log.LicenseType === 'Employment' ? '#f3e5f5' : '#e8f5e9',
                        color: log.LicenseType === 'Activity' ? '#1976d2' :
                               log.LicenseType === 'Exploitation' ? '#f57c00' :
                               log.LicenseType === 'Employment' ? '#7b1fa2' : '#388e3c'
                      }}>
                        {getLicenseTypeLabel(log.LicenseType)}
                      </span>
                    </td>
                    <td style={{ padding: '12px' }}>
                      {log.ApplicantName || log.CompanyName || '-'}
                    </td>
                    <td style={{ padding: '12px' }}>
                      {log.PrintedByUsername}
                    </td>
                    <td style={{ padding: '12px', fontSize: '13px' }}>
                      {formatDateTime(log.PrintedAt)}
                    </td>
                    <td style={{ padding: '12px', fontSize: '12px', color: '#666' }}>
                      {log.IpAddress || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        <div style={{ 
          marginTop: '20px', 
          display: 'flex', 
          justifyContent: 'center',
          gap: '10px'
        }}>
          <button
            onClick={() => handleFilterChange('page', Math.max(1, filters.page - 1))}
            disabled={filters.page === 1}
            style={{
              padding: '8px 16px',
              borderRadius: '6px',
              border: '1px solid #ddd',
              background: filters.page === 1 ? '#f5f5f5' : 'white',
              cursor: filters.page === 1 ? 'not-allowed' : 'pointer'
            }}
          >
            قبلی
          </button>
          <span style={{ padding: '8px 16px' }}>
            صفحه {filters.page.toLocaleString('fa-IR')}
          </span>
          <button
            onClick={() => handleFilterChange('page', filters.page + 1)}
            disabled={logs.length < filters.limit}
            style={{
              padding: '8px 16px',
              borderRadius: '6px',
              border: '1px solid #ddd',
              background: logs.length < filters.limit ? '#f5f5f5' : 'white',
              cursor: logs.length < filters.limit ? 'not-allowed' : 'pointer'
            }}
          >
            بعدی
          </button>
        </div>
      </div>

      {/* Multiple Prints Warning */}
      {statistics?.multiPrintRequests && statistics.multiPrintRequests.length > 0 && (
        <div style={{ 
          background: 'white', 
          padding: '20px', 
          borderRadius: '12px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          marginTop: '20px'
        }}>
          <h3 style={{ marginBottom: '15px', color: '#f57c00' }}>⚠️ پرونده‌های با چاپ مکرر</h3>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#fff3e0', borderBottom: '2px solid #ffb74d' }}>
                  <th style={{ padding: '12px', textAlign: 'right' }}>شماره پیگیری</th>
                  <th style={{ padding: '12px', textAlign: 'right' }}>تعداد چاپ</th>
                </tr>
              </thead>
              <tbody>
                {statistics.multiPrintRequests.map((item, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid #dee2e6' }}>
                    <td style={{ padding: '12px', fontFamily: 'monospace' }}>
                      {item.TrackingNo}
                    </td>
                    <td style={{ padding: '12px', fontWeight: 'bold', color: '#f57c00' }}>
                      {item.PrintCount.toLocaleString('fa-IR')} بار
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
