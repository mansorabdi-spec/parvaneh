import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api.js'
import { getDaysUntilShamsiExpiry } from '../lib/shamsiDays.js'
import { DEFAULT_RENEWAL_WINDOW_DAYS, loadRenewalWindowDays } from '../lib/renewalWindow.js'

function classifyLicenseTask(task) {
  const name = task?.LicenseTypeName || ''
  const tracking = task?.TrackingNo == null ? '' : String(task.TrackingNo)
  const typeId = Number(task?.LicenseTypeId)
  const byExploitationId = typeId === 68 || tracking.startsWith('11')
  const byEmploymentId = typeId === 67 || tracking.startsWith('2')
  const isExploitation = byExploitationId || (!byEmploymentId && name.includes('بهره'))
  const isEmployment = !isExploitation && (byEmploymentId || name.includes('اشتغال'))
  const isLegalEntity = !isExploitation && !isEmployment && (
    typeId === 137 ||
    name.includes('فعالیت حقوقی') ||
    (name.includes('حقوقی') && name.includes('فعالیت'))
  )
  return { isExploitation, isEmployment, isLegalEntity }
}

function renewPath(task) {
  const { isExploitation, isEmployment } = classifyLicenseTask(task)
  if (isExploitation) return `/licenses/exploitation/renew/${task.RequestID}`
  if (isEmployment) return `/licenses/employment/renew/${task.RequestID}`
  return `/licenses/activity/renew/${task.RequestID}`
}

function changePath(task) {
  const { isExploitation, isEmployment, isLegalEntity } = classifyLicenseTask(task)
  if (isExploitation) return `/licenses/exploitation/change/${task.RequestID}`
  if (isEmployment) return `/licenses/employment/change/${task.RequestID}`
  if (isLegalEntity) return `/licenses/activity/legal/change/${task.RequestID}`
  return `/licenses/activity/change/${task.RequestID}`
}

export default function UserInbox() {
  const navigate = useNavigate()
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [licenseTypes, setLicenseTypes] = useState([])
  const [filters, setFilters] = useState({
    trackingNo: '',
    requestId: '',
    licenseType: '',
    applicantName: '',
    nationalCode: '',
    plateNumber: '',
    vin: '',
    status: ''
  })
  const [renewalWindowDays, setRenewalWindowDays] = useState(DEFAULT_RENEWAL_WINDOW_DAYS)
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 30

  useEffect(() => {
    loadInbox()
    loadLicenseTypes()
    loadRenewalWindowDays().then(setRenewalWindowDays)
  }, [])

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery, filters.trackingNo, filters.licenseType, filters.applicantName, filters.nationalCode, filters.plateNumber, filters.vin, filters.status])

  const loadInbox = async () => {
    try {
      setLoading(true)
      const { data } = await api.get('/api/workflow/my-inbox')
      setTasks(data)
      setError('')
      
      // Log requests with deficiency for debugging
      const deficiencyRequests = data.filter(t => t.HasDeficiency === 1 || t.HasDeficiency === true)
      if (deficiencyRequests.length > 0) {
        console.log('📋 Found requests with deficiency:', deficiencyRequests.map(r => ({
          RequestID: r.RequestID,
          TrackingNo: r.TrackingNo,
          HasDeficiency: r.HasDeficiency,
          SourceType: r.SourceType,
          StepOrder: r.StepOrder,
          StepStatus: r.StepStatus
        })))
      }
    } catch (e) {
      setError(e?.response?.data?.message || 'خطا در بارگذاری کارتابل')
    } finally {
      setLoading(false)
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

  const toFarsiNumber = (num) => {
    if (!num && num !== 0) return ''
    const farsiDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹']
    return String(num).replace(/\d/g, x => farsiDigits[parseInt(x)])
  }

  // Convert Shamsi date string to Date object for comparison
  // Shamsi format: YYYY/MM/DD (e.g., 1405/04/20)
  const shamsiToGregorian = (shamsiDate) => {
    if (!shamsiDate) return null
    try {
      const parts = shamsiDate.split('/')
      if (parts.length !== 3) return null
      
      const year = parseInt(parts[0])
      const month = parseInt(parts[1])
      const day = parseInt(parts[2])
      
      // Convert Shamsi to Gregorian using a simplified algorithm
      // This is an approximation - for production, use a proper Shamsi-to-Gregorian library
      const shamsiStart = new Date(622, 0, 1) // March 21, 622 (Nowruz)
      const daysOffset = (year - 1) * 365 + Math.floor((year - 1) / 33) * 8 + Math.floor(((year - 1) % 33 + 3) / 4)
      
      const monthDays = [31, 31, 31, 31, 31, 31, 30, 30, 30, 30, 30, 29]
      let totalDays = daysOffset + ((month - 1) * 31) + day
      
      const gregorianDate = new Date(shamsiStart.getTime() + totalDays * 24 * 60 * 60 * 1000)
      return gregorianDate
    } catch (e) {
      console.error('Error converting Shamsi date:', e)
      return null
    }
  }

  // Convert Persian/Arabic digits to English digits
  const persianToEnglishDigits = (str) => {
    if (!str) return str
    const persianDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹']
    const arabicDigits = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩']
    const englishDigits = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9']
    
    let result = String(str)
    // Convert Persian digits
    persianDigits.forEach((persian, i) => {
      result = result.replace(new RegExp(persian, 'g'), englishDigits[i])
    })
    // Convert Arabic digits
    arabicDigits.forEach((arabic, i) => {
      result = result.replace(new RegExp(arabic, 'g'), englishDigits[i])
    })
    return result
  }

  // Check if a license has expired based on ExpiryDate
  // Returns true if the license HAS expired (expiry date is before or equal to today)
  // Returns false if the license is still valid (expiry date is after today)
  const isLicenseExpired = (expiryDate, task) => {
    if (!expiryDate) {
      console.log(`[isLicenseExpired] No expiry date for RequestID ${task?.RequestID}, returning false`)
      return false
    }
    
    try {
      // Get today's date in Shamsi format using toLocaleDateString with fa-IR calendar
      const today = new Date()
      
      // Use Intl.DateTimeFormat with Baha'i calendar (fa-IR uses Shamsi)
      const todayShamsi = today.toLocaleDateString('fa-IR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      })
      
      console.log(`[isLicenseExpired] Checking RequestID ${task?.RequestID}:`, {
        expiryDate: expiryDate,
        todayShamsiRaw: todayShamsi,
        todayJsDate: today.toISOString()
      })
      
      // Ensure both are strings and convert to English digits
      const expiryStr = String(expiryDate).trim()
      const todayStrRaw = String(todayShamsi).trim()
      const todayStr = persianToEnglishDigits(todayStrRaw)
      
      console.log(`[isLicenseExpired] After digit conversion:`, {
        expiryStr,
        todayStr
      })
      
      // Extract year, month, day as numbers
      const expiryParts = expiryStr.split('/')
      const todayParts = todayStr.split('/')
      
      if (expiryParts.length !== 3 || todayParts.length !== 3) {
        console.warn(`[isLicenseExpired] Invalid date format: expiry="${expiryStr}", today="${todayStr}"`)
        return false
      }
      
      const expiryYear = parseInt(expiryParts[0])
      const expiryMonth = parseInt(expiryParts[1])
      const expiryDay = parseInt(expiryParts[2])
      
      const todayYear = parseInt(todayParts[0])
      const todayMonth = parseInt(todayParts[1])
      const todayDay = parseInt(todayParts[2])
      
      if (isNaN(expiryYear) || isNaN(expiryMonth) || isNaN(expiryDay) ||
          isNaN(todayYear) || isNaN(todayMonth) || isNaN(todayDay)) {
        console.warn(`[isLicenseExpired] Failed to parse date parts: expiry="${expiryStr}", today="${todayStr}"`)
        return false
      }
      
      // Compare dates numerically: (year, month, day)
      // A license is expired if its expiry date is before or equal to today
      const isExpired = (expiryYear < todayYear) || 
                        (expiryYear === todayYear && expiryMonth < todayMonth) || 
                        (expiryYear === todayYear && expiryMonth === todayMonth && expiryDay <= todayDay)
      
      console.log(`[isLicenseExpired] Result for RequestID ${task?.RequestID}:`, {
        expiryYear, expiryMonth, expiryDay,
        todayYear, todayMonth, todayDay,
        isExpired,
        explanation: isExpired ? 'Expired (expiry date is before or equal to today)' : 'Still valid (expiry date is after today)'
      })
      
      return isExpired
    } catch (e) {
      console.error('[isLicenseExpired] Error checking expiry:', e, 'for expiryDate:', expiryDate)
      return false
    }
  }

  const handleRenewLicense = (task) => {
    navigate(renewPath(task), { state: { task } })
  }

  const handleChangeLicense = (task) => {
    navigate(changePath(task), { state: { task } })
  }

  const formatPlate = (task) => {
    if (!task) return '-'
    const hasParts = task.PlateRegion2 && task.PlateLetter && task.PlateThreeDigits && task.PlateSerial2
    if (hasParts) {
      let letter = String(task.PlateLetter).trim()
      const letterMap = {
        'A': 'ا', 'B': 'ب', 'P': 'پ', 'T': 'ت', 'S': 'س', 'J': 'ج', 'D': 'د', 'Z': 'ز', 'E': 'ع',
        'G': 'گ', 'L': 'ل', 'M': 'م', 'N': 'ن', 'V': 'و', 'H': 'ه', 'Y': 'ی', 'K': 'ک', 'Q': 'ق', 'F': 'ف', 'R': 'ر'
      }
      const u = letter.toUpperCase()
      if (/^[A-Z]$/.test(u) && letterMap[u]) letter = letterMap[u]
      
      return (
        <table style={{ borderCollapse: 'collapse', display: 'inline-table', direction: 'rtl' }}>
          <tbody>
            <tr>
              <td style={{ padding: '0 2px', textAlign: 'center' }}>{toFarsiNumber(task.PlateSerial2)}</td>
              <td style={{ padding: '0 2px', textAlign: 'center' }}> </td>
              <td style={{ padding: '0 2px', textAlign: 'center' }}>{letter}</td>
              <td style={{ padding: '0 2px', textAlign: 'center' }}> </td>
              <td style={{ padding: '0 2px', textAlign: 'center' }}>{toFarsiNumber(task.PlateThreeDigits)}</td>
              <td style={{ padding: '0 2px', textAlign: 'center' }}> </td>
              <td style={{ padding: '0 2px', textAlign: 'center' }}>ایران</td>
              <td style={{ padding: '0 2px', textAlign: 'center' }}> </td>
              <td style={{ padding: '0 2px', textAlign: 'center' }}>{toFarsiNumber(task.PlateRegion2)}</td>
            </tr>
          </tbody>
        </table>
      )
    }
    return task.PlateNumber || '-'
  }

  const handleViewInvoice = (task) => {
    navigate('/payment', {
      state: {
        trackingNo: task.TrackingNo,
        requestId: task.RequestID,
        invoiceViewOnly: task.SourceType === 'my_request'
      }
    })
  }

  const getStatusBadge = (status) => {
    const statusMap = {
      'Pending': { label: 'در انتظار بررسی', color: '#f59e0b' },
      'InProgress': { label: 'در حال بررسی', color: '#3b82f6' },
      'Approved': { label: 'تایید شده', color: '#10b981' },
      'Rejected': { label: 'رد شده', color: '#ef4444' },
      'AwaitingPayment': { label: 'در انتظار پرداخت', color: '#8b5cf6' },
      'Completed': { label: 'تکمیل شده', color: '#059669' },
      'Draft': { label: 'پیش‌نویس', color: '#94a3b8' },
      'Cancelled': { label: 'لغو شده', color: '#64748b' },
      'Suspended': { label: 'معلق', color: '#dc2626' },
      'UnderReview': { label: 'در حال بررسی مجدد', color: '#0891b2' },
      'NotStarted': { label: 'شروع نشده', color: '#71717a' },
      'Waiting': { label: 'در انتظار', color: '#fb923c' }
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

  // Filter tasks based on all filter criteria
  const filteredTasks = tasks.filter(task => {
    // Global search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim()
      const plateNumber = task.PlateNumber?.toLowerCase() || ''
      const vin = task.VIN?.toLowerCase() || ''
      const trackingNo = task.TrackingNo?.toLowerCase() || ''
      if (!(plateNumber.includes(query) || vin.includes(query) || trackingNo.includes(query))) {
        return false
      }
    }
    
    // Column-specific filters
    if (filters.trackingNo && !task.TrackingNo?.toLowerCase().includes(filters.trackingNo.toLowerCase())) return false
    if (filters.requestId && !String(task.RequestID).includes(filters.requestId)) return false
    if (filters.licenseType && !task.LicenseTypeName?.toLowerCase().includes(filters.licenseType.toLowerCase())) return false
    if (filters.applicantName) {
      const fullName = `${task.FirstName || ''} ${task.LastName || ''}`.toLowerCase()
      if (!fullName.includes(filters.applicantName.toLowerCase())) return false
    }
    if (filters.nationalCode && !task.NationalCode?.includes(filters.nationalCode)) return false
    if (filters.plateNumber) {
      const plateStr = `${task.PlateSerial2 || ''}${task.PlateLetter || ''}${task.PlateThreeDigits || ''}${task.PlateRegion2 || ''}`.toLowerCase()
      if (!plateStr.includes(filters.plateNumber.toLowerCase())) return false
    }
    if (filters.vin && !task.VIN?.toLowerCase().includes(filters.vin.toLowerCase())) return false
    if (filters.status && task.RequestStatus !== filters.status) return false
    
    return true
  })

  // Check if there are any deficiency cases
  const deficiencyCases = filteredTasks.filter(task => 
    task.SourceType === 'my_request' && (task.HasDeficiency === true || task.HasDeficiency === 1)
  )

  // Pagination calculations
  const totalPages = Math.ceil(filteredTasks.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const paginatedTasks = filteredTasks.slice(startIndex, endIndex)

  return (
    <div style={{ padding: '20px' }}>
      {deficiencyCases.length > 0 && (
        <div style={{ 
          marginBottom: '20px', 
          padding: '16px 20px', 
          background: '#fef3c7', 
          border: '2px solid #f59e0b',
          borderRadius: '8px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          boxShadow: '0 2px 8px rgba(245, 158, 11, 0.2)'
        }}>
          <div style={{ fontSize: '32px' }}>⚠️</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#92400e', marginBottom: '4px' }}>
              شما {deficiencyCases.length} پرونده با نقص دارید
            </div>
            <div style={{ fontSize: '14px', color: '#78350f' }}>
              لطفاً نسبت به رفع نقص و ویرایش پرونده‌های مشخص شده اقدام نمایید.
            </div>
          </div>
        </div>
      )}
      
      <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
        <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 'bold' }}>کارتابل من</h1>
        
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flex: 1, maxWidth: '600px' }}>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="🔍 جستجو بر اساس شماره پلاک یا VIN..."
            style={{
              flex: 1,
              padding: '10px 16px',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              fontSize: '14px',
              outline: 'none'
            }}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              style={{
                padding: '10px 16px',
                background: '#6b7280',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              ✕ پاک کردن
            </button>
          )}
        </div>
        
        <div style={{ display: 'flex', gap: '8px' }}>
          <button 
            onClick={() => setFilters({
              trackingNo: '',
              licenseType: '',
              applicantName: '',
              nationalCode: '',
              plateNumber: '',
              vin: '',
              status: ''
            })}
            style={{ 
              padding: '8px 16px', 
              background: '#ef4444', 
              color: 'white', 
              border: 'none', 
              borderRadius: '6px', 
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            🗑️ پاک کردن فیلترها
          </button>
          <button 
            onClick={loadInbox}
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

      {filteredTasks.length === 0 ? (
        <div>
          <div className="box" style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>📭</div>
            <div style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '8px' }}>
              {tasks.length === 0 ? 'کارتابل خالی است' : 'نتیجه‌ای یافت نشد'}
            </div>
            <div style={{ fontSize: '14px' }}>
              {tasks.length === 0 
                ? 'در حال حاضر هیچ پرونده‌ای برای بررسی وجود ندارد' 
                : 'با فیلترهای فعلی هیچ پرونده‌ای یافت نشد. لطفاً فیلترها را تغییر دهید.'}
            </div>
            {tasks.length > 0 && (
              <button
                onClick={() => {
                  setFilters({
                    trackingNo: '',
                    licenseType: '',
                    applicantName: '',
                    nationalCode: '',
                    plateNumber: '',
                    vin: '',
                    status: ''
                  })
                  setSearchQuery('')
                }}
                style={{
                  marginTop: '16px',
                  padding: '8px 16px',
                  background: '#ef4444',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                🗑️ پاک کردن همه فیلترها
              </button>
            )}
          </div>
        </div>
      ) : (
        <>
        <div style={{ border: '1px solid #d1d5db', borderRadius: '8px', overflow: 'auto', background: 'white' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '1400px' }}>
            <thead>
              <tr style={{ background: '#f3f4f6', borderBottom: '2px solid #d1d5db' }}>
                <th style={{ padding: '12px', textAlign: 'center', fontWeight: 'bold', width: '60px' }}>ردیف</th>
                <th style={{ padding: '12px', textAlign: 'center', fontWeight: 'bold', width: '100px' }}>شماره درخواست</th>
                <th style={{ padding: '12px', textAlign: 'center', fontWeight: 'bold' }}>نوع</th>
                <th style={{ padding: '12px', textAlign: 'center', fontWeight: 'bold' }}>شماره پیگیری</th>
                <th style={{ padding: '12px', textAlign: 'center', fontWeight: 'bold' }}>نوع پروانه</th>
                <th style={{ padding: '12px', textAlign: 'center', fontWeight: 'bold' }}>متقاضی</th>
                <th style={{ padding: '12px', textAlign: 'center', fontWeight: 'bold' }}>کد ملی</th>
                <th style={{ padding: '12px', textAlign: 'center', fontWeight: 'bold' }}>شماره پلاک</th>
                <th style={{ padding: '12px', textAlign: 'center', fontWeight: 'bold' }}>VIN</th>
                <th style={{ padding: '12px', textAlign: 'center', fontWeight: 'bold' }}>مرحله</th>
                <th style={{ padding: '12px', textAlign: 'center', fontWeight: 'bold' }}>وضعیت</th>
                <th style={{ padding: '12px', textAlign: 'center', fontWeight: 'bold' }}>تاریخ ثبت</th>
                <th style={{ padding: '12px', textAlign: 'center', fontWeight: 'bold' }}>عملیات</th>
              </tr>
              <tr style={{ background: '#f9fafb' }}>
                <td style={{ padding: '8px' }}></td>
                <td style={{ padding: '8px' }}>
                  <input
                    type="text"
                    placeholder="فیلتر..."
                    value={filters.requestId}
                    onChange={(e) => setFilters(f => ({ ...f, requestId: e.target.value }))}
                    style={{ width: '100%', padding: '4px 8px', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '12px' }}
                  />
                </td>
                <td style={{ padding: '8px' }}></td>
                <td style={{ padding: '8px' }}>
                  <input
                    type="text"
                    placeholder="فیلتر..."
                    value={filters.trackingNo}
                    onChange={(e) => setFilters(f => ({ ...f, trackingNo: e.target.value }))}
                    style={{ width: '100%', padding: '4px 8px', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '12px' }}
                  />
                </td>
                <td style={{ padding: '8px' }}>
                  <select
                    value={filters.licenseType}
                    onChange={(e) => setFilters(f => ({ ...f, licenseType: e.target.value }))}
                    style={{ width: '100%', padding: '4px 8px', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '12px' }}
                  >
                    <option value="">همه</option>
                    {licenseTypes.map(lt => (
                      <option key={lt.Id} value={lt.Name}>{lt.Name}</option>
                    ))}
                  </select>
                </td>
                <td style={{ padding: '8px' }}>
                  <input
                    type="text"
                    placeholder="فیلتر..."
                    value={filters.applicantName}
                    onChange={(e) => setFilters(f => ({ ...f, applicantName: e.target.value }))}
                    style={{ width: '100%', padding: '4px 8px', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '12px' }}
                  />
                </td>
                <td style={{ padding: '8px' }}>
                  <input
                    type="text"
                    placeholder="فیلتر..."
                    value={filters.nationalCode}
                    onChange={(e) => setFilters(f => ({ ...f, nationalCode: e.target.value }))}
                    style={{ width: '100%', padding: '4px 8px', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '12px' }}
                  />
                </td>
                <td style={{ padding: '8px' }}>
                  <input
                    type="text"
                    placeholder="فیلتر..."
                    value={filters.plateNumber}
                    onChange={(e) => setFilters(f => ({ ...f, plateNumber: e.target.value }))}
                    style={{ width: '100%', padding: '4px 8px', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '12px' }}
                  />
                </td>
                <td style={{ padding: '8px' }}>
                  <input
                    type="text"
                    placeholder="فیلتر..."
                    value={filters.vin}
                    onChange={(e) => setFilters(f => ({ ...f, vin: e.target.value }))}
                    style={{ width: '100%', padding: '4px 8px', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '12px' }}
                  />
                </td>
                <td style={{ padding: '8px' }}></td>
                <td style={{ padding: '8px' }}>
                  <select
                    value={filters.status}
                    onChange={(e) => setFilters(f => ({ ...f, status: e.target.value }))}
                    style={{ width: '100%', padding: '4px 8px', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '12px' }}
                  >
                    <option value="">همه</option>
                    <option value="Pending">در انتظار بررسی</option>
                    <option value="InProgress">در حال بررسی</option>
                    <option value="Approved">تایید شده</option>
                    <option value="Rejected">رد شده</option>
                    <option value="AwaitingPayment">در انتظار پرداخت</option>
                    <option value="Completed">تکمیل شده</option>
                  </select>
                </td>
                <td style={{ padding: '8px' }}></td>
                <td style={{ padding: '8px' }}></td>
              </tr>
            </thead>
            <tbody>
              {paginatedTasks.map((task, idx) => {
                const globalIndex = startIndex + idx + 1
                const isMyRequest = task.SourceType === 'my_request'
                // Check if request has deficiency
                const hasDeficiency = task.HasDeficiency === true || task.HasDeficiency === 1
                // Determine license type from LicenseTypeId or TrackingNo
                const {
                  isExploitation: isExploitationLicense,
                  isEmployment: isEmploymentLicense,
                  isLegalEntity: isLegalEntityLicense
                } = classifyLicenseTask(task)
                
                // Can edit if: it's my request AND (no expert has reviewed yet OR has deficiency)
                // No expert has reviewed means: StepOrder is 0 (initial submission) or StepOrder is 1 and status is still Pending/NotStarted
                // Once StepOrder >= 1 and any step has been reviewed (not Pending/NotStarted), editing is locked unless there's a deficiency
                const notYetReviewed = task.StepOrder === 0 || 
                                      (task.StepOrder === 1 && (!task.StepStatus || task.StepStatus === 'Pending' || task.StepStatus === 'NotStarted'))
                
                // Allow editing if:
                // 1. It's my request AND not yet reviewed by expert AND no payment
                // 2. OR it has a deficiency (regardless of payment - user MUST be able to fix deficiencies even after payment)
                const isCancelledCase = task.RequestStatus === 'Cancelled' || task.RequestStatus === 'Revoked' || String(task.OperationTypeName || '').includes('ابطال')
                const canEdit = isMyRequest && !isCancelledCase && (
                  (notYetReviewed && !task.HasSuccessfulPayment) || 
                  hasDeficiency
                )
                const canPrint = isMyRequest && task.RequestStatus === 'Approved' && !isCancelledCase
                const hasPaid = task.HasSuccessfulPayment === 1 || task.HasSuccessfulPayment === true
                const canViewInvoice = hasPaid && (isMyRequest || task.SourceType === 'workflow')
                
                // Debug logging for all requests with deficiency OR exploitation licenses
                if (hasDeficiency || isExploitationLicense) {
                  console.log(`🔍 ${hasDeficiency ? '⚠️ DEFICIENCY' : 'Exploitation'} Debug for RequestID ${task.RequestID}:`, {
                    RequestID: task.RequestID,
                    TrackingNo: task.TrackingNo,
                    LicenseTypeName: task.LicenseTypeName,
                    isMyRequest,
                    SourceType: task.SourceType,
                    hasDeficiency,
                    HasDeficiency: task.HasDeficiency,
                    StepOrder: task.StepOrder,
                    StepStatus: task.StepStatus,
                    notYetReviewed,
                    canEdit,
                    RequestStatus: task.RequestStatus,
                    HasSuccessfulPayment: task.HasSuccessfulPayment,
                    '❌ Edit Blocked By': !canEdit ? (
                      !isMyRequest ? 'Not My Request' :
                      task.HasSuccessfulPayment ? 'Has Payment' :
                      !notYetReviewed && !hasDeficiency ? 'Already Reviewed & No Deficiency' :
                      'Unknown'
                    ) : '✅ Can Edit'
                  })
                }
                // Show payment button logic:
                // For Activity and Employment Licenses: Show if no successful payment (online or offline)
                // For Exploitation Licenses: Show if AwaitingPayment OR (no payment and StepOrder >= 3)
                
                const isActivityLicense = !isExploitationLicense && !isEmploymentLicense
                
                // Simple logic for Activity and Employment: just check if no successful payment
                const activityNeedsPayment = isActivityLicense && !task.HasSuccessfulPayment
                const employmentNeedsPayment = isEmploymentLicense && !task.HasSuccessfulPayment
                const exploitationNeedsPayment = isExploitationLicense && !task.HasSuccessfulPayment && (task.RequestStatus === 'AwaitingPayment' || task.StepOrder >= 3)
                
                const needsPayment = isMyRequest && !isCancelledCase && (
                  activityNeedsPayment ||
                  employmentNeedsPayment ||
                  exploitationNeedsPayment
                )
                
                // Debug payment button logic
                if (isExploitationLicense || task.RequestStatus === 'AwaitingPayment' || (!task.HasSuccessfulPayment && task.StepOrder >= 3)) {
                  console.log('💳 Payment Button Debug:', {
                    RequestID: task.RequestID,
                    TrackingNo: task.TrackingNo,
                    isMyRequest,
                    HasSuccessfulPayment: task.HasSuccessfulPayment,
                    notHasSuccessfulPayment: !task.HasSuccessfulPayment,
                    RequestStatus: task.RequestStatus,
                    StepOrder: task.StepOrder,
                    isExploitationLicense,
                    isActivityLicense,
                    isEmploymentLicense,
                    activityNeedsPayment,
                    employmentNeedsPayment,
                    exploitationNeedsPayment,
                    needsPayment
                  })
                }
                
                return (
                  <tr 
                    key={task.WorkflowStepId || `req-${task.RequestID}`}
                    style={{ 
                      borderBottom: idx < tasks.length - 1 ? '1px solid #e5e7eb' : 'none',
                      background: hasDeficiency ? '#fef3c7' : (idx % 2 === 0 ? 'white' : '#f9fafb')
                    }}
                  >
                    <td style={{ padding: '12px', textAlign: 'center', fontWeight: 'bold', color: '#6b7280' }}>
                      {globalIndex}
                    </td>
                    <td style={{ padding: '12px', textAlign: 'center', fontSize: '12px', fontFamily: 'monospace', direction: 'ltr' }}>
                      {task.RequestID}
                    </td>
                    <td style={{ padding: '12px', textAlign: 'center' }}>
                      <span style={{ 
                        padding: '4px 10px', 
                        borderRadius: '12px', 
                        fontSize: '11px',
                        fontWeight: 'bold',
                        background: isMyRequest ? '#dbeafe' : '#fef3c7',
                        color: isMyRequest ? '#1e40af' : '#92400e'
                      }}>
                        {isMyRequest ? 'پرونده من' : 'وظیفه تایید'}
                      </span>
                    </td>
                    <td style={{ padding: '12px', textAlign: 'center', fontWeight: 'bold', color: '#3b82f6' }}>
                      {task.TrackingNo}
                    </td>
                    <td style={{ padding: '12px', textAlign: 'center' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                        <div style={{ 
                          padding: '4px 12px', 
                          borderRadius: '12px', 
                          fontSize: '12px',
                          fontWeight: 'bold',
                          background: '#dbeafe',
                          color: '#1e40af'
                        }}>
                          {(() => {
                            // For LicenseTypeId 137, display "فعالیت حقوقی" instead of "فعالیت"
                            if (task.LicenseTypeId === 137) {
                              return 'فعالیت حقوقی'
                            }
                            return task.LicenseTypeName || (isEmploymentLicense ? 'پروانه اشتغال' : 'پروانه فعالیت')
                          })()}
                        </div>
                        {task.OperationTypeName && (
                          <div style={{ 
                            padding: '2px 8px', 
                            borderRadius: '12px', 
                            fontSize: '11px',
                            fontWeight: 'bold',
                            background: '#f3f4f6',
                            color: '#374151'
                          }}>
                            {task.OperationTypeName}
                          </div>
                        )}
                      </div>
                    </td>
                    <td style={{ padding: '12px', textAlign: 'center' }}>
                      <div style={{ fontWeight: 'bold' }}>{task.FirstName} {task.LastName}</div>
                    </td>
                    <td style={{ padding: '12px', textAlign: 'center', fontSize: '13px', fontFamily: 'monospace', direction: 'ltr' }}>
                      {task.NationalCode || '-'}
                    </td>
                    <td style={{ padding: '12px', textAlign: 'center', direction: 'rtl' }}>
                      {formatPlate(task)}
                    </td>
                    <td style={{ padding: '12px', textAlign: 'center', fontSize: '13px', fontFamily: 'monospace', direction: 'ltr' }}>
                      {task.VIN || '-'}
                    </td>
                    <td style={{ padding: '12px', textAlign: 'center' }}>
                      {task.RoleName ? (
                        <span style={{ 
                          padding: '4px 12px', 
                          borderRadius: '12px', 
                          fontSize: '12px',
                          background: '#e0e7ff',
                          color: '#4f46e5',
                          fontWeight: 'bold'
                        }}>
                          مرحله {task.StepOrder} - {task.RoleName}
                        </span>
                      ) : (
                        <span style={{ fontSize: '12px', color: '#6b7280' }}>
                          {task.StepOrder ? `مرحله ${task.StepOrder}` : '-'}
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '12px', textAlign: 'center' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'center' }}>
                        {getStatusBadge(task.RequestStatus)}
                        {hasDeficiency && task.StepNotes && (
                          <div style={{ 
                            fontSize: '12px', 
                            color: '#92400e',
                            fontWeight: 'bold',
                            background: '#fef3c7',
                            padding: '8px 12px',
                            borderRadius: '8px',
                            border: '2px solid #f59e0b',
                            maxWidth: '250px',
                            marginTop: '6px',
                            boxShadow: '0 2px 4px rgba(245, 158, 11, 0.2)'
                          }}>
                            <div style={{ marginBottom: '4px', fontSize: '13px' }}>🔧 نیاز به رفع نقص</div>
                            <div style={{ fontSize: '11px', fontWeight: 'normal', color: '#78350f', lineHeight: '1.5' }}>
                              {task.StepNotes}
                            </div>
                          </div>
                        )}
                        {!hasDeficiency && task.StepNotes && task.StepNotes.includes('اصلاح شده') && (
                          <span style={{ 
                            fontSize: '11px', 
                            color: '#059669',
                            fontWeight: 'bold',
                            background: '#d1fae5',
                            padding: '2px 8px',
                            borderRadius: '8px'
                          }}>
                            {task.StepNotes}
                          </span>
                        )}
                      </div>
                    </td>
                    <td style={{ padding: '12px', textAlign: 'center', fontSize: '13px', color: '#6b7280' }}>
                      {formatDate(task.RequestCreatedAt)}
                    </td>
                    <td style={{ padding: '12px', textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', flexWrap: 'wrap' }}>
                        {isMyRequest && canEdit && (
                          <button
                            onClick={() => {
                              if (isExploitationLicense) {
                                navigate(`/licenses/exploitation/issue?edit=${task.RequestID}`)
                              } else if (isEmploymentLicense) {
                                navigate(`/licenses/employment/issue?edit=${task.RequestID}`)
                              } else {
                                navigate(`/licenses/activity/issue?edit=${task.RequestID}`)
                              }
                            }}
                            style={{
                              padding: '6px 16px',
                              background: hasDeficiency ? '#ef4444' : '#f59e0b',
                              color: 'white',
                              border: 'none',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              fontSize: '13px',
                              fontWeight: 'bold'
                            }}
                            title={hasDeficiency ? 'رفع نقص' : 'ویرایش پرونده'}
                          >
                            {hasDeficiency ? '⚠️ رفع نقص' : '✏️ ویرایش'}
                          </button>
                        )}
                        {needsPayment && (
                          <button
                            onClick={() => navigate('/payment', { state: { trackingNo: task.TrackingNo, requestId: task.RequestID } })}
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
                          >
                            💳 پرداخت
                          </button>
                        )}
                        {canViewInvoice && (
                          <button
                            onClick={() => handleViewInvoice(task)}
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
                        {isMyRequest && canPrint && (
                          (() => {
                            // Check expiry using the new API endpoint that checks LicenseHistory with both RequestID and TrackingNo
                            const checkExpiryFromApi = async () => {
                              try {
                                const response = await api.get(`/api/workflow/license-expiry-check/${task.RequestID}`)
                                const { isExpired, expiryDate, trackingNo, requestID } = response.data
                                console.log(`🔍 License expiry check for RequestID ${requestID}:`, {
                                  isExpired,
                                  expiryDate,
                                  trackingNo,
                                  requestID
                                })
                                return isExpired
                              } catch (error) {
                                console.error(`❌ Error checking expiry for RequestID ${task.RequestID}:`, error)
                                // If API call fails, fallback to ExpiryDate from task
                                if (task.ExpiryDate) {
                                  return isLicenseExpired(task.ExpiryDate, task)
                                }
                                return false
                              }
                            }
                            
                            // Default: assume not expired
                            let isExpired = false
                            
                            // If we have ExpiryDate from the task, check it as fallback
                            if (task.ExpiryDate) {
                              isExpired = isLicenseExpired(task.ExpiryDate, task)
                            }
                            
                            return (
                              <button
                                onClick={async () => {
                                  // Check expiry from API before allowing print
                                  const expired = await checkExpiryFromApi()
                                  if (expired) {
                                    alert('پروانه منقضی شده است - چاپ غیرفعال')
                                    return
                                  }
                                  
                                  if (isExploitationLicense) {
                                    navigate(`/print-exploitation-license/${task.RequestID}`)
                                  } else if (isEmploymentLicense) {
                                    navigate(`/print-employment-license/${task.RequestID}`)
                                  } else if (isLegalEntityLicense) {
                                    navigate(`/print-legal-entity-license/${task.RequestID}`)
                                  } else {
                                    navigate(`/print-license/${task.RequestID}`)
                                  }
                                }}
                                style={{
                                  padding: '6px 16px',
                                  background: isExpired ? '#d1d5db' : '#8b5cf6',
                                  color: isExpired ? '#9ca3af' : 'white',
                                  border: 'none',
                                  borderRadius: '6px',
                                  cursor: isExpired ? 'not-allowed' : 'pointer',
                                  fontSize: '13px',
                                  fontWeight: 'bold'
                                }}
                                disabled={isExpired}
                                title={isExpired ? 'پروانه منقضی شده است - چاپ غیرفعال' : 'چاپ پروانه'}
                              >
                                🖨️ چاپ پروانه
                              </button>
                            )
                          })()
                        )}
                        {isMyRequest && canPrint && task.ExpiryDate && (
                          <>
                            {(() => {
                              const daysUntilExpiry = getDaysUntilShamsiExpiry(task.ExpiryDate)
                              const isExpired = daysUntilExpiry === null
                                ? isLicenseExpired(task.ExpiryDate, task)
                                : daysUntilExpiry <= 0
                              const canRenewNow = daysUntilExpiry === null
                                ? isExpired
                                : daysUntilExpiry <= renewalWindowDays
                              const renewTitle = !canRenewNow
                                ? `تمدید پروانه - بیش از ${toFarsiNumber(renewalWindowDays)} روز تا انقضا مانده است`
                                : isExpired
                                  ? 'تمدید پروانه - منقضی شده'
                                  : `تمدید پروانه - ${toFarsiNumber(daysUntilExpiry)} روز تا انقضا مانده است`

                              return (
                                <>
                                  <button
                                    onClick={() => handleRenewLicense(task)}
                                    disabled={!canRenewNow}
                                    style={{
                                      padding: '6px 16px',
                                      background: canRenewNow ? '#059669' : '#d1d5db',
                                      color: canRenewNow ? 'white' : '#6b7280',
                                      border: 'none',
                                      borderRadius: '6px',
                                      cursor: canRenewNow ? 'pointer' : 'not-allowed',
                                      fontSize: '13px',
                                      fontWeight: 'bold'
                                    }}
                                    title={renewTitle}
                                  >
                                    🔄 تمدید
                                  </button>
                                  <button
                                    onClick={() => handleChangeLicense(task)}
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
                                    title="درخواست تغییر پروانه فعالیت"
                                  >
                                    📝 تغییر
                                  </button>
                                </>
                              )
                            })()}
                          </>
                        )}
                        {/* Renewal and Change buttons for Employment License - always available for my requests */}
                        {isMyRequest && isEmploymentLicense && !canPrint && (
                          <>
                            <button
                              onClick={() => handleRenewLicense(task)}
                              style={{
                                padding: '6px 16px',
                                background: '#059669',
                                color: 'white',
                                border: 'none',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                fontSize: '13px',
                                fontWeight: 'bold'
                              }}
                              title="تمدید پروانه اشتغال"
                            >
                              🔄 تمدید
                            </button>
                            <button
                              onClick={() => handleChangeLicense(task)}
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
                              title="درخواست تغییر پروانه اشتغال"
                            >
                              📝 تغییر
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => navigate(`/workflow/request/${task.RequestID}`)}
                          style={{
                            padding: '6px 16px',
                            background: isMyRequest ? '#3b82f6' : '#10b981',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '13px',
                            fontWeight: 'bold'
                          }}
                        >
                          {isMyRequest ? '👁️ مشاهده' : '✅ بررسی پرونده'}
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div style={{ 
            marginTop: '20px', 
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'center', 
            gap: '8px',
            flexWrap: 'wrap'
          }}>
            <button
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1}
              style={{
                padding: '8px 12px',
                background: currentPage === 1 ? '#e5e7eb' : '#3b82f6',
                color: currentPage === 1 ? '#9ca3af' : 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                fontSize: '14px',
                fontWeight: 'bold'
              }}
            >
              « اولین
            </button>
            
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              style={{
                padding: '8px 12px',
                background: currentPage === 1 ? '#e5e7eb' : '#3b82f6',
                color: currentPage === 1 ? '#9ca3af' : 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                fontSize: '14px',
                fontWeight: 'bold'
              }}
            >
              ‹ قبلی
            </button>

            <div style={{ 
              padding: '8px 16px', 
              background: '#f3f4f6', 
              borderRadius: '6px',
              fontSize: '14px',
              fontWeight: 'bold',
              color: '#374151'
            }}>
              صفحه {currentPage} از {totalPages} (مجموع: {filteredTasks.length} پرونده)
            </div>

            <button
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              style={{
                padding: '8px 12px',
                background: currentPage === totalPages ? '#e5e7eb' : '#3b82f6',
                color: currentPage === totalPages ? '#9ca3af' : 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                fontSize: '14px',
                fontWeight: 'bold'
              }}
            >
              بعدی ›
            </button>

            <button
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage === totalPages}
              style={{
                padding: '8px 12px',
                background: currentPage === totalPages ? '#e5e7eb' : '#3b82f6',
                color: currentPage === totalPages ? '#9ca3af' : 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                fontSize: '14px',
                fontWeight: 'bold'
              }}
            >
              آخرین »
            </button>
          </div>
        )}
        </>
      )}

      <div style={{ marginTop: '20px', padding: '16px', background: '#eff6ff', borderRadius: '8px', border: '1px solid #bfdbfe' }}>
        <div style={{ fontSize: '14px', color: '#1e40af' }}>
          <strong>💡 راهنما:</strong> در این صفحه، پرونده‌هایی که برای بررسی به شما ارجاع شده‌اند نمایش داده می‌شود. 
          برای مشاهده جزئیات و تصمیم‌گیری روی هر پرونده، دکمه "بررسی پرونده" را کلیک کنید.
        </div>
      </div>
    </div>
  )
}
