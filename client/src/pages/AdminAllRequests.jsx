import React, { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api.js'
import { checkPermission, loadUserPermissions } from '../lib/permissions.js'
import ManualDateInput from '../components/ManualDateInput.jsx'

export default function AdminAllRequests() {
  const navigate = useNavigate()
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState('all') // all, pending, approved, rejected
  const [currentUser, setCurrentUser] = useState(null)
  const [permissionsLoaded, setPermissionsLoaded] = useState(false)
  
  // Pagination state
  const [page, setPage] = useState(1)
  const [pageSize] = useState(30)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  
  // Filter state
  const [filters, setFilters] = useState({
    trackingNo: '',
    licenseType: '',
    operationType: '',
    applicantName: '',
    nationalCode: '',
    plateNumber: '',
    vin: '',
    status: '',
    submittedBy: '',
    dateFrom: '',
    dateTo: '',
    printStatus: 'all' // all, printed, notPrinted
  })
  
  // Local filter state for inputs (for debouncing)
  const [localFilters, setLocalFilters] = useState({
    trackingNo: '',
    licenseType: '',
    operationType: '',
    applicantName: '',
    nationalCode: '',
    plateNumber: '',
    vin: '',
    submittedBy: '',
    dateFrom: '',
    dateTo: ''
  })
  
  const [licenseTypes, setLicenseTypes] = useState([])
  const [operationTypes, setOperationTypes] = useState([])
  const debounceTimer = useRef(null)

  // Helper to convert English numbers to Persian
  const toFarsiNumber = (num) => {
    if (num === null || num === undefined) return ''
    return String(num).replace(/[0-9]/g, d => '۰۱۲۳۴۵۶۷۸۹'[d])
  }

  // Helper to format Iran plate visually using a borderless table
  const formatPlate = (v) => {
    if (!v) return '-'
    const raw = (v.PlateNumber || '').toString().trim()
    if (!raw) return '-'

    // Split tokens like: "626 ع 25 96"
    const parts = raw.split(/\s+/).filter(Boolean)
    if (parts.length < 4) return raw

    // Expect: [serial, letter, three, region]
    let serial = parts[2]
    let letter = parts[1]
    let three = parts[0]
    let region = parts[3]

    // Normalize possible Latin letter to Persian
    const letterMap = {
      'A': 'ا', 'B': 'ب', 'P': 'پ', 'T': 'ت', 'S': 'س', 'J': 'ج', 'D': 'د', 'Z': 'ز', 'E': 'ع',
      'G': 'گ', 'L': 'ل', 'M': 'م', 'N': 'ن', 'V': 'و', 'H': 'ه', 'Y': 'ی', 'K': 'ک', 'Q': 'ق', 'F': 'ف', 'R': 'ر'
    }
    const u = letter.toUpperCase()
    if (/^[A-Z]$/.test(u) && letterMap[u]) letter = letterMap[u]

    return (
      <table style={{ borderCollapse: 'collapse', display: 'inline-table', direction: 'rtl', border: '0' }}>
        <tbody>
          <tr>
            <td style={{ padding: '0 2px', textAlign: 'center', border: '0' }}>{toFarsiNumber(region)}</td>
            <td style={{ padding: '0 2px', textAlign: 'center', border: '0' }}>{letter}</td>
            <td style={{ padding: '0 2px', textAlign: 'center', border: '0' }}>{toFarsiNumber(three)}</td>
            <td style={{ padding: '0 2px', textAlign: 'center', border: '0' }}>ایران</td>
            <td style={{ padding: '0 2px', textAlign: 'center', border: '0' }}>{toFarsiNumber(serial)}</td>
          </tr>
        </tbody>
      </table>
    )
  }

  useEffect(() => {
    loadCurrentUser()
    loadLicenseTypes()
    loadOperationTypes()
    // Load permissions when component mounts
    loadUserPermissions().then(() => {
      setPermissionsLoaded(true)
      console.log('✅ Permissions loaded in AdminAllRequests')
    })
  }, [])
  
  useEffect(() => {
    // Only load requests after currentUser is loaded
    if (currentUser) {
      loadRequests()
    }
  }, [page, filters, currentUser])

  const loadCurrentUser = async () => {
    try {
      const { data } = await api.get('/api/auth/me')
      setCurrentUser(data.user)
    } catch (e) {
      console.error('Error loading current user:', e)
    }
  }
  
  const loadLicenseTypes = async () => {
    try {
      const { data } = await api.get('/api/lookups/values?categoryKey=LicenseType')
      setLicenseTypes(data || [])
    } catch (e) {
      console.error('Error loading license types:', e)
    }
  }
  
  const loadOperationTypes = async () => {
    try {
      const { data } = await api.get('/api/lookups/values?categoryKey=LicenseDocumentType')
      setOperationTypes(data || [])
    } catch (e) {
      console.error('Error loading operation types:', e)
    }
  }

  const loadRequests = async () => {
    try {
      setLoading(true)
      
      // For Print License role, automatically filter to show only Approved requests
      const effectiveFilters = { ...filters }
      if (currentUser?.Role === 'چاپ پروانه') {
        effectiveFilters.status = 'Approved'
      }
      
      // Build query params
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: pageSize.toString(),
        ...effectiveFilters
      })
      
      const { data } = await api.get(`/api/workflow/requests?${params}`)
      setRequests(data.data || [])
      setTotal(data.total || 0)
      setTotalPages(data.totalPages || 0)
      setError('')
    } catch (e) {
      setError(e?.response?.data?.message || 'خطا در بارگذاری درخواست‌ها')
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteRequest = async (requestId, trackingNo) => {
    const confirmMessage = `آیا از حذف این پرونده اطمینان دارید؟\n\nشماره پیگیری: ${trackingNo}\n\nتوجه: این عملیات قابل بازگشت نیست و تمام اطلاعات مرتبط با این پرونده حذف خواهد شد.`
    
    if (!window.confirm(confirmMessage)) {
      return
    }

    try {
      await api.delete(`/api/workflow/requests/${requestId}`)
      alert('پرونده با موفقیت حذف شد')
      loadRequests() // Reload the list
    } catch (e) {
      alert(e?.response?.data?.message || 'خطا در حذف پرونده')
    }
  }

  const handlePrintLicense = (req) => {
    // Determine license type and navigate to appropriate print page
    const requestId = req.RequestID
    const trackingNo = req.TrackingNo
    const licenseTypeId = req.LicenseTypeId
    const companyNationalId = req.CompanyNationalId
    
    let printUrl = ''
    
    // Check license type
    if (licenseTypeId === 68 || trackingNo.startsWith('11')) {
      // Exploitation license (پروانه بهره‌برداری)
      printUrl = `/print-exploitation-license/${requestId}`
    } else if (licenseTypeId === 67 || trackingNo.startsWith('2')) {
      // Employment license (پروانه اشتغال)
      printUrl = `/print-employment-license/${requestId}`
   // } else if (companyNationalId) {
    } else if(licenseTypeId == 137) {
      // Activity license - Legal entity (پروانه فعالیت حقوقی)
      printUrl = `/print-legal-entity-license/${requestId}`
    } else {
      // Activity license - Individual (پروانه فعالیت حقیقی)
      printUrl = `/print-license/${requestId}`
    }
    
    // Open print page in new tab
    window.open(printUrl, '_blank')
  }
  
  const handleViewInvoice = (req) => {
    // Navigate to payment page with tracking number and request ID
    const trackingNo = req.TrackingNo
    const requestId = req.RequestID
    navigate('/payment', { state: { trackingNo, requestId } })
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return '-'
    return new Date(dateStr).toLocaleDateString('fa-IR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getStatusBadge = (status) => {
    const statusMap = {
      'Pending': { label: 'در انتظار بررسی', color: '#f59e0b' },
      'InProgress': { label: 'در حال بررسی', color: '#3b82f6' },
      'Approved': { label: 'تایید شده', color: '#10b981' },
      'Rejected': { label: 'رد شده', color: '#ef4444' }
    }
    const s = statusMap[status] || { label: status, color: '#6b7280' }
    return (
      <span style={{ 
        padding: '4px 12px', 
        borderRadius: '12px', 
        fontSize: '12px', 
        fontWeight: 'bold',
        background: s.color + '20',
        color: s.color
      }}>
        {s.label}
      </span>
    )
  }

  const handleFilterChange = (field, value) => {
    // Update local state immediately for responsive input
    setLocalFilters(prev => ({ ...prev, [field]: value }))
  }
  
  const handleSearch = () => {
    // Apply all local filters to actual filters
    setFilters(prev => ({
      ...prev,
      ...localFilters
    }))
    setPage(1) // Reset to first page when searching
  }
  
  const handleStatusFilterClick = (status) => {
    setFilter(status)
    if (status === 'all') {
      setFilters(prev => ({ ...prev, status: '' }))
    } else if (status === 'pending') {
      // Show both Pending and InProgress
      setFilters(prev => ({ ...prev, status: '' })) // Clear status filter, we'll handle this in frontend
    } else if (status === 'approved') {
      setFilters(prev => ({ ...prev, status: 'Approved' }))
    } else if (status === 'rejected') {
      setFilters(prev => ({ ...prev, status: 'Rejected' }))
    }
    setPage(1)
  }
  
  const filteredRequests = requests.filter(r => {
    if (filter === 'all') return true
    if (filter === 'pending') return r.Status === 'Pending' || r.Status === 'InProgress' || r.Status === 'AwaitingPayment'
    if (filter === 'approved') return r.Status === 'Approved'
    if (filter === 'rejected') return r.Status === 'Rejected'
    return true
  })

  const stats = {
    total: total,
    pending: requests.filter(r => r.Status === 'Pending' || r.Status === 'InProgress' || r.Status === 'AwaitingPayment').length,
    approved: requests.filter(r => r.Status === 'Approved').length,
    rejected: requests.filter(r => r.Status === 'Rejected').length
  }

  if (loading) return (
    <div style={{ padding: '20px' }}>
      <div className="box">در حال بارگذاری...</div>
    </div>
  )

  if (error) return (
    <div style={{ padding: '20px' }}>
      <div className="box" style={{ color: '#ef4444' }}>{error}</div>
    </div>
  )

  return (
    <div style={{ padding: '20px' }}>
      <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 'bold' }}>مدیریت کل درخواست‌ها</h1>
        <button 
          onClick={loadRequests}
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

      {/* Stats Cards - For Print License role, show only approved requests */}
      {currentUser?.Role === 'چاپ پروانه' ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '20px' }}>
          <div style={{ 
            padding: '20px', 
            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', 
            color: 'white', 
            borderRadius: '8px',
            border: '3px solid #111'
          }}>
            <div style={{ fontSize: '32px', fontWeight: 'bold', marginBottom: '8px' }}>{stats.approved}</div>
            <div style={{ fontSize: '14px', opacity: 0.9 }}>پروانه‌های تایید شده</div>
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '20px' }}>
          <div style={{ 
            padding: '20px', 
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', 
            color: 'white', 
            borderRadius: '8px',
            cursor: 'pointer',
            border: filter === 'all' ? '3px solid #111' : 'none'
          }}
          onClick={() => handleStatusFilterClick('all')}>
            <div style={{ fontSize: '32px', fontWeight: 'bold', marginBottom: '8px' }}>{stats.total}</div>
            <div style={{ fontSize: '14px', opacity: 0.9 }}>کل درخواست‌ها</div>
          </div>
          <div style={{ 
            padding: '20px', 
            background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', 
            color: 'white', 
            borderRadius: '8px',
            cursor: 'pointer',
            border: filter === 'pending' ? '3px solid #111' : 'none'
          }}
          onClick={() => handleStatusFilterClick('pending')}>
            <div style={{ fontSize: '32px', fontWeight: 'bold', marginBottom: '8px' }}>{stats.pending}</div>
            <div style={{ fontSize: '14px', opacity: 0.9 }}>در انتظار بررسی</div>
          </div>
          <div style={{ 
            padding: '20px', 
            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', 
            color: 'white', 
            borderRadius: '8px',
            cursor: 'pointer',
            border: filter === 'approved' ? '3px solid #111' : 'none'
          }}
          onClick={() => handleStatusFilterClick('approved')}>
            <div style={{ fontSize: '32px', fontWeight: 'bold', marginBottom: '8px' }}>{stats.approved}</div>
            <div style={{ fontSize: '14px', opacity: 0.9 }}>تایید شده</div>
          </div>
          <div style={{ 
            padding: '20px', 
            background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)', 
            color: 'white', 
            borderRadius: '8px',
            cursor: 'pointer',
            border: filter === 'rejected' ? '3px solid #111' : 'none'
          }}
          onClick={() => handleStatusFilterClick('rejected')}>
            <div style={{ fontSize: '32px', fontWeight: 'bold', marginBottom: '8px' }}>{stats.rejected}</div>
            <div style={{ fontSize: '14px', opacity: 0.9 }}>رد شده</div>
          </div>
        </div>
      )}
      
      {/* Filter inputs */}
      <div style={{ 
        background: 'white', 
        padding: '20px', 
        borderRadius: '8px', 
        marginBottom: '20px',
        border: '1px solid #d1d5db'
      }}>
        <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: 'bold' }}>فیلترها</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
          <input
            type="text"
            placeholder="شماره پیگیری"
            value={localFilters.trackingNo}
            onChange={(e) => handleFilterChange('trackingNo', e.target.value)}
            style={{ padding: '8px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px' }}
          />
          <select
            value={localFilters.licenseType}
            onChange={(e) => handleFilterChange('licenseType', e.target.value)}
            style={{ padding: '8px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px', background: 'white' }}
          >
            <option value="">همه انواع پروانه</option>
            {licenseTypes.map(lt => (
              <option key={lt.Id} value={lt.Name}>{lt.Name}</option>
            ))}
          </select>
          <select
            value={localFilters.operationType}
            onChange={(e) => handleFilterChange('operationType', e.target.value)}
            style={{ padding: '8px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px', background: 'white' }}
          >
            <option value="">همه انواع عملیات</option>
            {operationTypes.map(ot => (
              <option key={ot.Id} value={ot.Name}>{ot.Name}</option>
            ))}
          </select>
          <input
            type="text"
            placeholder="نام متقاضی"
            value={localFilters.applicantName}
            onChange={(e) => handleFilterChange('applicantName', e.target.value)}
            style={{ padding: '8px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px' }}
          />
          <input
            type="text"
            placeholder="کد ملی"
            value={localFilters.nationalCode}
            onChange={(e) => handleFilterChange('nationalCode', e.target.value)}
            style={{ padding: '8px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px' }}
          />
          <input
            type="text"
            placeholder="شماره پلاک"
            value={localFilters.plateNumber}
            onChange={(e) => handleFilterChange('plateNumber', e.target.value)}
            style={{ padding: '8px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px' }}
          />
          <input
            type="text"
            placeholder="VIN"
            value={localFilters.vin}
            onChange={(e) => handleFilterChange('vin', e.target.value)}
            style={{ padding: '8px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px' }}
          />
          <input
            type="text"
            placeholder="ثبت‌کننده"
            value={localFilters.submittedBy}
            onChange={(e) => handleFilterChange('submittedBy', e.target.value)}
            style={{ padding: '8px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px' }}
          />
          <select
            value={filters.status}
            onChange={(e) => {
              setFilters(prev => ({ ...prev, status: e.target.value }))
            }}
            style={{ padding: '8px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px', minWidth: '150px' }}
          >
            <option value="">همه وضعیت‌ها</option>
            <option value="Pending">در انتظار بررسی</option>
            <option value="InProgress">در حال بررسی</option>
            <option value="Approved">تایید شده</option>
            <option value="Rejected">رد شده</option>
            <option value="AwaitingPayment">در انتظار پرداخت</option>
            <option value="Completed">تکمیل شده</option>
            <option value="Cancelled">لغو شده</option>
            <option value="Suspended">معلق</option>
          </select>
          <select
            value={filters.printStatus}
            onChange={(e) => {
              setFilters(prev => ({ ...prev, printStatus: e.target.value }))
            }}
            style={{ padding: '8px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px', minWidth: '150px' }}
          >
            <option value="all">همه پروانه‌ها</option>
            <option value="printed">چاپ شده‌ها</option>
            <option value="notPrinted">چاپ نشده‌ها</option>
          </select>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <label style={{ fontSize: '14px', whiteSpace: 'nowrap' }}>از تاریخ:</label>
            <ManualDateInput
              value={localFilters.dateFrom}
              onChange={(value) => {
                setLocalFilters(prev => ({ ...prev, dateFrom: value }))
              }}
              placeholder="1402/11/25"
              style={{ padding: '8px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px', minWidth: '140px' }}
            />
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <label style={{ fontSize: '14px', whiteSpace: 'nowrap' }}>تا تاریخ:</label>
            <ManualDateInput
              value={localFilters.dateTo}
              onChange={(value) => {
                setLocalFilters(prev => ({ ...prev, dateTo: value }))
              }}
              placeholder="1402/11/25"
              style={{ padding: '8px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px', minWidth: '140px' }}
            />
          </div>
          <button
            onClick={handleSearch}
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
            🔍 جستجو
          </button>
          <button
            onClick={() => {
              setLocalFilters({
                trackingNo: '',
                licenseType: '',
                operationType: '',
                applicantName: '',
                nationalCode: '',
                plateNumber: '',
                vin: '',
                submittedBy: '',
                dateFrom: '',
                dateTo: ''
              })
              setFilters({
                trackingNo: '',
                licenseType: '',
                operationType: '',
                applicantName: '',
                nationalCode: '',
                plateNumber: '',
                vin: '',
                status: '',
                submittedBy: '',
                dateFrom: '',
                dateTo: '',
                printStatus: 'all'
              })
              setPage(1)
            }}
            style={{
              padding: '8px 16px',
              background: '#6b7280',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 'bold'
            }}
          >
            پاک کردن فیلترها
          </button>
        </div>
      </div>

      {/* Requests Table */}
      {filteredRequests.length === 0 ? (
        <div className="box" style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>📭</div>
          <div style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '8px' }}>درخواستی یافت نشد</div>
        </div>
      ) : (
        <div style={{ border: '1px solid #d1d5db', borderRadius: '8px', overflow: 'auto', background: 'white' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '1400px' }}>
            <thead>
              <tr style={{ background: '#f3f4f6', borderBottom: '2px solid #d1d5db' }}>
                <th style={{ padding: '12px', textAlign: 'center', fontWeight: 'bold', width: '60px' }}>ردیف</th>
                <th style={{ padding: '12px', textAlign: 'center', fontWeight: 'bold' }}>شماره پیگیری</th>
                <th style={{ padding: '12px', textAlign: 'center', fontWeight: 'bold' }}>نوع پروانه</th>
                <th style={{ padding: '12px', textAlign: 'center', fontWeight: 'bold' }}>نوع عملیات</th>
                <th style={{ padding: '12px', textAlign: 'center', fontWeight: 'bold' }}>متقاضی</th>
                <th style={{ padding: '12px', textAlign: 'center', fontWeight: 'bold' }}>کد ملی</th>
                <th style={{ padding: '12px', textAlign: 'center', fontWeight: 'bold' }}>شماره پلاک</th>
                <th style={{ padding: '12px', textAlign: 'center', fontWeight: 'bold' }}>VIN</th>
                <th style={{ padding: '12px', textAlign: 'center', fontWeight: 'bold' }}>مرحله جاری</th>
                <th style={{ padding: '12px', textAlign: 'center', fontWeight: 'bold' }}>وضعیت</th>
                <th style={{ padding: '12px', textAlign: 'center', fontWeight: 'bold' }}>تاریخ ثبت</th>
                <th style={{ padding: '12px', textAlign: 'center', fontWeight: 'bold' }}>ثبت‌کننده</th>
                <th style={{ padding: '12px', textAlign: 'center', fontWeight: 'bold' }}>عملیات</th>
              </tr>
            </thead>
            <tbody>
              {filteredRequests.map((req, idx) => (
                <tr 
                  key={req.RequestID}
                  style={{ 
                    borderBottom: idx < filteredRequests.length - 1 ? '1px solid #e5e7eb' : 'none',
                    background: idx % 2 === 0 ? 'white' : '#f9fafb'
                  }}
                >
                  <td style={{ padding: '12px', textAlign: 'center', fontWeight: 'bold', color: '#6b7280' }}>
                    {(page - 1) * pageSize + idx + 1}
                  </td>
                  <td style={{ padding: '12px', textAlign: 'center', fontWeight: 'bold', color: '#3b82f6' }}>
                    {req.TrackingNo}
                  </td>
                  <td style={{ padding: '12px', textAlign: 'center' }}>
                    <div style={{ 
                      padding: '4px 12px', 
                      borderRadius: '12px', 
                      fontSize: '12px',
                      fontWeight: 'bold',
                      background: req.LicenseTypeName?.includes('اشتغال') ? '#fef3c7' : '#dbeafe',
                      color: req.LicenseTypeName?.includes('اشتغال') ? '#92400e' : '#1e40af'
                    }}>
                      {req.LicenseTypeName || '-'}
                    </div>
                  </td>
                  <td style={{ padding: '12px', textAlign: 'center' }}>
                    <div style={{ 
                      padding: '4px 12px', 
                      borderRadius: '12px', 
                      fontSize: '12px',
                      fontWeight: 'bold',
                      background: req.OperationTypeName === 'تمدید اجباری' ? '#fef3c7' : '#dcfce7',
                      color: req.OperationTypeName === 'تمدید اجباری' ? '#92400e' : '#166534'
                    }}>
                      {req.OperationTypeName || 'صدور'}
                    </div>
                  </td>
                  <td style={{ padding: '12px', textAlign: 'center' }}>
                    <div style={{ fontWeight: 'bold' }}>{req.ApplicantName}</div>
                  </td>
                  <td style={{ padding: '12px', textAlign: 'center', fontSize: '13px', fontFamily: 'monospace', direction: 'ltr' }}>
                    {req.NationalCode || '-'}
                  </td>
                  <td style={{ padding: '12px', textAlign: 'center', fontSize: '14px' }}>
                    <div style={{ 
                      direction: 'rtl', 
                      fontFamily: 'Tahoma, Arial, sans-serif',
                      whiteSpace: 'nowrap',
                      letterSpacing: '0px'
                    }}>
                      {formatPlate(req)}
                    </div>
                  </td>
                  <td style={{ padding: '12px', textAlign: 'center', fontSize: '13px', fontFamily: 'monospace', direction: 'ltr' }}>
                    {req.VIN || '-'}
                  </td>
                  <td style={{ padding: '12px', textAlign: 'center' }}>
                    {req.CurrentStepOrder ? (
                      <span style={{ 
                        padding: '4px 12px', 
                        borderRadius: '12px', 
                        fontSize: '12px',
                        background: '#e0e7ff',
                        color: '#4f46e5',
                        fontWeight: 'bold'
                      }}>
                        مرحله {req.CurrentStepOrder}
                      </span>
                    ) : '-'}
                  </td>
                  <td style={{ padding: '12px', textAlign: 'center' }}>
                    {getStatusBadge(req.Status)}
                  </td>
                  <td style={{ padding: '12px', textAlign: 'center', fontSize: '13px', color: '#6b7280' }}>
                    {formatDate(req.CreatedAt)}
                  </td>
                  <td style={{ padding: '12px', textAlign: 'center', fontSize: '13px' }}>
                    {req.SubmittedByUserName || '-'}
                  </td>
                  <td style={{ padding: '12px', textAlign: 'center' }}>
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                      {/* View Details button - hide for Print License role */}
                      {currentUser?.Role !== 'چاپ پروانه' && (
                        <button
                          onClick={() => navigate(`/workflow/request/${req.RequestID}`)}
                          style={{
                            padding: '6px 16px',
                            background: '#3b82f6',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '13px',
                            fontWeight: 'bold'
                          }}
                        >
                          مشاهده جزئیات
                        </button>
                      )}
                      
                      {/* Edit buttons - only for Admin */}
                      {currentUser?.Role === 'Admin' && (
                        <>
                          <button
                            onClick={() => {
                              // Determine license type based on LicenseTypeId or TrackingNo
                              const isExploitation = req.LicenseTypeId === 68 || req.TrackingNo?.startsWith('11');
                              const isEmployment = req.LicenseTypeId === 67 || req.TrackingNo?.startsWith('2');
                              
                              // Navigate to appropriate edit form
                              if (isExploitation) {
                                navigate(`/licenses/exploitation/issue?edit=${req.RequestID}`);
                              } else if (isEmployment) {
                                navigate(`/licenses/employment/issue?edit=${req.RequestID}`);
                              } else {
                                // Activity license
                                navigate(`/licenses/activity/issue?edit=${req.RequestID}`);
                              }
                            }}
                            style={{
                              padding: '6px 16px',
                              background: '#10b981',
                              color: 'white',
                              border: 'none',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              fontSize: '13px',
                              fontWeight: 'bold'
                            }}
                            title="ویرایش پرونده"
                          >
                            ✏️ ویرایش
                          </button>
                          <button
                            onClick={() => navigate(`/admin/workflow/requests/${req.RequestID}/status-fix`)}
                            style={{
                              padding: '6px 16px',
                              background: '#f97316',
                              color: 'white',
                              border: 'none',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              fontSize: '13px',
                              fontWeight: 'bold'
                            }}
                            title="اصلاح وضعیت/مرحله توسط مدیر"
                          >
                            🛠 اصلاح گردش کار
                          </button>
                        </>
                      )}
                      
                      {/* Print License button - check permission or Admin */}
                      {(() => {
                        const isApproved = req.Status === 'Approved';
                        const isAdmin = currentUser?.Role === 'Admin';
                        const hasPrintPermission = checkPermission('print_license');
                        const shouldShow = isApproved && (isAdmin || hasPrintPermission);
                        
                        // Debug log for first request only
                        if (requests.indexOf(req) === 0) {
                          console.log('🖨️ Print button debug:', {
                            requestId: req.RequestID,
                            status: req.Status,
                            isApproved,
                            currentUserRole: currentUser?.Role,
                            isAdmin,
                            hasPrintPermission,
                            shouldShow
                          });
                        }
                        
                        return shouldShow && (
                          <button
                          onClick={() => handlePrintLicense(req)}
                          style={{
                            padding: '6px 16px',
                            background: '#8b5cf6',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '13px',
                            fontWeight: 'bold'
                          }}
                          title="چاپ پروانه"
                        >
                          🖨️ چاپ پروانه
                        </button>
                        );
                      })()}
                      
                      {/* Invoice button - show when request has payments */}
                      {req.HasSuccessfulPayment && (
                        <button
                          onClick={() => handleViewInvoice(req)}
                          style={{
                            padding: '6px 16px',
                            background: '#f59e0b',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '13px',
                            fontWeight: 'bold'
                          }}
                          title="مشاهده فاکتور"
                        >
                          🧾 فاکتور
                        </button>
                      )}
                      
                      {/* Delete button - only for Admin */}
                      {currentUser?.Role === 'Admin' && (
                        <button
                          onClick={() => handleDeleteRequest(req.RequestID, req.TrackingNo)}
                          style={{
                            padding: '6px 16px',
                            background: '#ef4444',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '13px',
                            fontWeight: 'bold'
                          }}
                          title="حذف پرونده"
                        >
                          🗑️ حذف
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      
      {/* Pagination */}
      {filteredRequests.length > 0 && (
        <div style={{ 
          marginTop: '20px', 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center',
          gap: '12px',
          padding: '20px',
          background: 'white',
          borderRadius: '8px',
          border: '1px solid #d1d5db'
        }}>
          <button
            onClick={() => setPage(Math.max(1, page - 1))}
            disabled={page === 1}
            style={{
              padding: '8px 16px',
              background: page === 1 ? '#e5e7eb' : '#3b82f6',
              color: page === 1 ? '#9ca3af' : 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: page === 1 ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              fontWeight: 'bold'
            }}
          >
            قبلی
          </button>
          
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let pageNum;
              if (totalPages <= 5) {
                pageNum = i + 1;
              } else if (page <= 3) {
                pageNum = i + 1;
              } else if (page >= totalPages - 2) {
                pageNum = totalPages - 4 + i;
              } else {
                pageNum = page - 2 + i;
              }
              
              return (
                <button
                  key={pageNum}
                  onClick={() => setPage(pageNum)}
                  style={{
                    padding: '8px 12px',
                    background: page === pageNum ? '#3b82f6' : 'white',
                    color: page === pageNum ? 'white' : '#374151',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: page === pageNum ? 'bold' : 'normal',
                    minWidth: '40px'
                  }}
                >
                  {pageNum}
                </button>
              );
            })}
          </div>
          
          <span style={{ fontSize: '14px', color: '#6b7280' }}>
            صفحه {page} از {totalPages} (مجموع: {total} رکورد)
          </span>
          
          <button
            onClick={() => setPage(Math.min(totalPages, page + 1))}
            disabled={page === totalPages}
            style={{
              padding: '8px 16px',
              background: page === totalPages ? '#e5e7eb' : '#3b82f6',
              color: page === totalPages ? '#9ca3af' : 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: page === totalPages ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              fontWeight: 'bold'
            }}
          >
            بعدی
          </button>
        </div>
      )}
    </div>
  )
}
