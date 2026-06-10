import React, { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api.js'

export default function AdminActivityLicenseReports() {
  const navigate = useNavigate()
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage] = useState(10)
  const [lookups, setLookups] = useState({})

  useEffect(() => {
    loadReports()
    loadLookups()
  }, [])

  const loadReports = async () => {
    try {
      setLoading(true)
      const { data } = await api.get('/api/reports/activity-licenses')
      setReports(data || [])
      setError('')
    } catch (e) {
      setError(e?.response?.data?.message || 'خطا در بارگذاری گزارشات')
    } finally {
      setLoading(false)
    }
  }

  const loadLookups = async () => {
    try {
      const [vehicleTypes, fuelTypes, activityCategories] = await Promise.all([
        api.get('/api/lookups/values', { params: { categoryKey: 'VehicleType' } }),
        api.get('/api/lookups/values', { params: { categoryKey: 'FuelType' } }),
        api.get('/api/lookups/values', { params: { categoryKey: 'ActivityCategory' } })
      ])
      setLookups({
        vehicleTypes: vehicleTypes.data || [],
        fuelTypes: fuelTypes.data || [],
        activityCategories: activityCategories.data || []
      })
    } catch (e) {
      console.error('Error loading lookups:', e)
    }
  }

  const getLookupName = (id, type) => {
    const list = lookups[type] || []
    const item = list.find(x => String(x.Id || x.ID) === String(id))
    return item?.Name || item?.name || id
  }

  const handleView = (vehicleId) => {
    navigate(`/admin/reports/activity-licenses/${vehicleId}`)
  }

  const handleInvoice = (vehicleId) => {
    // TODO: Implement invoice view
    alert(`نمایش فاکتور برای خودرو ${vehicleId}`)
  }

  const handlePrint = (vehicleId) => {
    // TODO: Implement license printing
    alert(`چاپ پروانه برای خودرو ${vehicleId}`)
  }

  const handleExportToExcel = () => {
    const csvContent = [
      ['شناسه', 'VIN', 'شاسی', 'نام', 'نام خانوادگی', 'کد ملی', 'تلفن', 'نوع وسیله', 'تناژ', 'نوع سوخت', 'رسته فعالیت', 'سال ساخت', 'پلاک', 'تاریخ بیمه', 'تاریخ معاینه فنی', 'تاریخ ایجاد'],
      ...filteredReports.map(r => [
        r.VehicleID,
        r.VIN,
        r.ChassisNo,
        r.FirstName || '-',
        r.LastName || '-',
        r.RegistrarNationalCode || '-',
        r.MobilePhone || '-',
        getLookupName(r.VehicleKindId, 'vehicleTypes'),
        r.Capacity,
        getLookupName(r.FuelTypeId, 'fuelTypes'),
        getLookupName(r.ActivityCategoryId, 'activityCategories'),
        r.YearManufacture,
        `${r.PlateSerial2}-${r.PlateThreeDigits} ${r.PlateLetter} ${r.PlateRegion2}`,
        r.InsuranceValidDateJalali,
        r.TechInspectValidDateJalali,
        new Date(r.CreatedAt).toLocaleDateString('fa-IR')
      ])
    ].map(row => row.join(',')).join('\n')

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `گزارشات_پروانه_فعالیت_${new Date().toISOString().split('T')[0]}.csv`
    link.click()
  }

  const filteredReports = useMemo(() => {
    if (!searchTerm) return reports
    const term = searchTerm.toLowerCase()
    return reports.filter(r => 
      String(r.VehicleID).includes(term) ||
      String(r.VIN || '').toLowerCase().includes(term) ||
      String(r.ChassisNo || '').toLowerCase().includes(term) ||
      String(r.FirstName || '').toLowerCase().includes(term) ||
      String(r.LastName || '').toLowerCase().includes(term) ||
      String(r.RegistrarNationalCode || '').includes(term) ||
      String(r.MobilePhone || '').includes(term)
    )
  }, [reports, searchTerm])

  const paginatedReports = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage
    return filteredReports.slice(startIndex, startIndex + itemsPerPage)
  }, [filteredReports, currentPage, itemsPerPage])

  const totalPages = Math.ceil(filteredReports.length / itemsPerPage)

  if (loading) return <div className="box">در حال بارگذاری...</div>
  if (error) return <div className="box error-text">{error}</div>

  return (
    <div className="box" style={{ padding: '24px' }}>
      <div className="box-title" style={{ background: '#3b82f6', color: 'white', padding: '12px 16px', borderRadius: '8px 8px 0 0', marginBottom: '20px' }}>
        گزارشات پروانه فعالیت
      </div>
      
      {/* Search and Export */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', alignItems: 'center' }}>
        <input
          type="text"
          placeholder="جستجو در گزارشات (VIN، شاسی، نام، کد ملی، تلفن)..."
          value={searchTerm}
          onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
          style={{ flex: 1, padding: '10px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px' }}
        />
        <button
          onClick={handleExportToExcel}
          style={{ padding: '10px 20px', background: '#10b981', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '14px', fontWeight: 'bold' }}
        >
          📊 خروجی اکسل
        </button>
      </div>

      <div style={{ overflowX: 'auto', border: '1px solid #d1d5db', borderRadius: '8px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead>
            <tr style={{ background: '#f3f4f6' }}>
              <th style={{ border: '1px solid #d1d5db', padding: '12px 8px', textAlign: 'center', fontWeight: 'bold' }}>شناسه</th>
              <th style={{ border: '1px solid #d1d5db', padding: '12px 8px', textAlign: 'center', fontWeight: 'bold' }}>VIN</th>
              <th style={{ border: '1px solid #d1d5db', padding: '12px 8px', textAlign: 'center', fontWeight: 'bold' }}>شاسی</th>
              <th style={{ border: '1px solid #d1d5db', padding: '12px 8px', textAlign: 'center', fontWeight: 'bold' }}>نام</th>
              <th style={{ border: '1px solid #d1d5db', padding: '12px 8px', textAlign: 'center', fontWeight: 'bold' }}>نام خانوادگی</th>
              <th style={{ border: '1px solid #d1d5db', padding: '12px 8px', textAlign: 'center', fontWeight: 'bold' }}>کد ملی</th>
              <th style={{ border: '1px solid #d1d5db', padding: '12px 8px', textAlign: 'center', fontWeight: 'bold' }}>تلفن</th>
              <th style={{ border: '1px solid #d1d5db', padding: '12px 8px', textAlign: 'center', fontWeight: 'bold' }}>نوع وسیله</th>
              <th style={{ border: '1px solid #d1d5db', padding: '12px 8px', textAlign: 'center', fontWeight: 'bold' }}>تناژ</th>
              <th style={{ border: '1px solid #d1d5db', padding: '12px 8px', textAlign: 'center', fontWeight: 'bold' }}>نوع سوخت</th>
              <th style={{ border: '1px solid #d1d5db', padding: '12px 8px', textAlign: 'center', fontWeight: 'bold' }}>رسته فعالیت</th>
              <th style={{ border: '1px solid #d1d5db', padding: '12px 8px', textAlign: 'center', fontWeight: 'bold' }}>سال ساخت</th>
              <th style={{ border: '1px solid #d1d5db', padding: '12px 8px', textAlign: 'center', fontWeight: 'bold' }}>پلاک</th>
              <th style={{ border: '1px solid #d1d5db', padding: '12px 8px', textAlign: 'center', fontWeight: 'bold' }}>تاریخ بیمه</th>
              <th style={{ border: '1px solid #d1d5db', padding: '12px 8px', textAlign: 'center', fontWeight: 'bold' }}>تاریخ معاینه فنی</th>
              <th style={{ border: '1px solid #d1d5db', padding: '12px 8px', textAlign: 'center', fontWeight: 'bold' }}>عملیات</th>
            </tr>
          </thead>
          <tbody>
            {paginatedReports.length === 0 ? (
              <tr>
                <td colSpan="16" style={{ border: '1px solid #d1d5db', textAlign: 'center', padding: '20px', color: '#6b7280' }}>
                  {searchTerm ? 'نتیجه‌ای یافت نشد' : 'هیچ گزارشی یافت نشد'}
                </td>
              </tr>
            ) : (
              paginatedReports.map((r, idx) => (
                <tr key={r.VehicleID} style={{ background: idx % 2 === 0 ? 'white' : '#f9fafb' }}>
                  <td style={{ border: '1px solid #d1d5db', padding: '10px 8px', textAlign: 'center' }}>{r.VehicleID}</td>
                  <td style={{ border: '1px solid #d1d5db', padding: '10px 8px', textAlign: 'center' }}>{r.VIN}</td>
                  <td style={{ border: '1px solid #d1d5db', padding: '10px 8px', textAlign: 'center' }}>{r.ChassisNo}</td>
                  <td style={{ border: '1px solid #d1d5db', padding: '10px 8px', textAlign: 'center' }}>{r.FirstName || '-'}</td>
                  <td style={{ border: '1px solid #d1d5db', padding: '10px 8px', textAlign: 'center' }}>{r.LastName || '-'}</td>
                  <td style={{ border: '1px solid #d1d5db', padding: '10px 8px', textAlign: 'center' }}>{r.RegistrarNationalCode || '-'}</td>
                  <td style={{ border: '1px solid #d1d5db', padding: '10px 8px', textAlign: 'center' }}>{r.MobilePhone || '-'}</td>
                  <td style={{ border: '1px solid #d1d5db', padding: '10px 8px', textAlign: 'center' }}>{getLookupName(r.VehicleKindId, 'vehicleTypes')}</td>
                  <td style={{ border: '1px solid #d1d5db', padding: '10px 8px', textAlign: 'center' }}>{r.Capacity}</td>
                  <td style={{ border: '1px solid #d1d5db', padding: '10px 8px', textAlign: 'center' }}>{getLookupName(r.FuelTypeId, 'fuelTypes')}</td>
                  <td style={{ border: '1px solid #d1d5db', padding: '10px 8px', textAlign: 'center' }}>{getLookupName(r.ActivityCategoryId, 'activityCategories')}</td>
                  <td style={{ border: '1px solid #d1d5db', padding: '10px 8px', textAlign: 'center' }}>{r.YearManufacture}</td>
                  <td style={{ border: '1px solid #d1d5db', padding: '10px 8px', textAlign: 'center' }}>
                    {r.PlateSerial2}-{r.PlateThreeDigits} {r.PlateLetter} {r.PlateRegion2}
                  </td>
                  <td style={{ border: '1px solid #d1d5db', padding: '10px 8px', textAlign: 'center' }}>{r.InsuranceValidDateJalali}</td>
                  <td style={{ border: '1px solid #d1d5db', padding: '10px 8px', textAlign: 'center' }}>{r.TechInspectValidDateJalali}</td>
                  <td style={{ border: '1px solid #d1d5db', padding: '10px 8px', textAlign: 'center' }}>
                    <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', flexWrap: 'wrap' }}>
                      <button
                        onClick={() => handleView(r.VehicleID)}
                        title="نمایش جزئیات"
                        style={{ padding: '6px 12px', fontSize: '12px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                      >
                        👁️ نمایش
                      </button>
                      <button
                        onClick={() => handleInvoice(r.VehicleID)}
                        title="نمایش فاکتور"
                        style={{ padding: '6px 12px', fontSize: '12px', background: '#8b5cf6', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                      >
                        🧾 فاکتور
                      </button>
                      <button
                        onClick={() => handlePrint(r.VehicleID)}
                        title="چاپ پروانه"
                        style={{ padding: '6px 12px', fontSize: '12px', background: '#10b981', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                      >
                        🖨️ چاپ
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', marginTop: '20px' }}>
          <button
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            style={{ padding: '8px 16px', border: '1px solid #d1d5db', borderRadius: '4px', background: currentPage === 1 ? '#f3f4f6' : 'white', cursor: currentPage === 1 ? 'not-allowed' : 'pointer' }}
          >
            قبلی
          </button>
          <span style={{ padding: '8px 16px', fontSize: '14px' }}>
            صفحه {currentPage} از {totalPages} ({filteredReports.length} رکورد)
          </span>
          <button
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            style={{ padding: '8px 16px', border: '1px solid #d1d5db', borderRadius: '4px', background: currentPage === totalPages ? '#f3f4f6' : 'white', cursor: currentPage === totalPages ? 'not-allowed' : 'pointer' }}
          >
            بعدی
          </button>
        </div>
      )}
    </div>
  )
}
