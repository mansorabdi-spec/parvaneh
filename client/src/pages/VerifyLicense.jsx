import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api } from '../lib/api.js'

export default function VerifyLicense() {
  const { trackingNo } = useParams()
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    loadLicenseData()
  }, [trackingNo])

  const loadLicenseData = async () => {
    try {
      setLoading(true)
      // Use public endpoint - no authentication required
      const { data: response } = await api.get(`/api/workflow/verify/${trackingNo}`)
      setData(response)
      setError('')
    } catch (e) {
      console.error('Error loading license data:', e)
      if (e.response?.status === 404) {
        setError('پروانه یافت نشد')
      } else {
        setError('خطا در بارگذاری اطلاعات پروانه')
      }
    } finally {
      setLoading(false)
    }
  }

  const toFarsiNumber = (num) => {
    if (!num && num !== 0) return ''
    const farsiDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹']
    return String(num).replace(/\d/g, (x) => farsiDigits[parseInt(x)])
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return ''
    const date = new Date(dateStr)
    return date.toLocaleDateString('fa-IR', { year: 'numeric', month: '2-digit', day: '2-digit' })
  }

  const getStatusBadge = (status) => {
    const statusMap = {
      'Pending': { label: 'در انتظار بررسی', color: '#f59e0b', bg: '#fef3c7' },
      'InProgress': { label: 'در حال بررسی', color: '#3b82f6', bg: '#dbeafe' },
      'Approved': { label: 'تایید شده', color: '#10b981', bg: '#d1fae5' },
      'Rejected': { label: 'رد شده', color: '#ef4444', bg: '#fee2e2' }
    }
    const s = statusMap[status] || { label: status, color: '#6b7280', bg: '#f3f4f6' }
    return (
      <span style={{ 
        padding: '8px 16px', 
        borderRadius: '8px', 
        fontSize: '16px', 
        fontWeight: 'bold',
        background: s.bg,
        color: s.color,
        display: 'inline-block'
      }}>
        {s.label}
      </span>
    )
  }

  if (loading) return (
    <div style={{ padding: '40px', textAlign: 'center', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ fontSize: '20px', color: '#6b7280' }}>در حال بارگذاری...</div>
    </div>
  )

  if (error) return (
    <div style={{ padding: '40px', textAlign: 'center', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ fontSize: '24px', color: '#ef4444', marginBottom: '20px' }}>❌</div>
      <div style={{ fontSize: '20px', color: '#ef4444', marginBottom: '30px' }}>{error}</div>
      <button
        onClick={() => navigate('/')}
        style={{
          padding: '12px 32px',
          background: '#3b82f6',
          color: 'white',
          border: 'none',
          borderRadius: '8px',
          fontSize: '16px',
          fontWeight: 'bold',
          cursor: 'pointer'
        }}
      >
        بازگشت به صفحه اصلی
      </button>
    </div>
  )

  if (!data || !data.request) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <div style={{ fontSize: '18px', color: '#f59e0b' }}>پروانه یافت نشد</div>
      </div>
    )
  }

  const { request, person, vehicle, company, companyDocuments, manager } = data
  const isApproved = request.status?.toLowerCase() === 'approved'
  
  // Determine license type
  const licenseTypeName = request.licenseTypeName || request.LicenseTypeName || ''
  const isExploitationLicense = licenseTypeName.includes('بهره برداری')
  const isEmploymentLicense = licenseTypeName.includes('اشتغال')
  const isLegalEntityLicense = licenseTypeName.includes('فعالیت حقوقی')

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', padding: '40px 20px' }}>
      <div style={{ maxWidth: '800px', margin: '0 auto', background: 'white', borderRadius: '16px', boxShadow: '0 20px 60px rgba(0,0,0,0.3)', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', padding: '30px', textAlign: 'center', color: 'white' }}>
          <div style={{ fontSize: '48px', marginBottom: '10px' }}>✓</div>
          <h1 style={{ margin: '0 0 10px 0', fontSize: '28px', fontWeight: 'bold' }}>اعتبارسنجی پروانه فعالیت</h1>
          <p style={{ margin: 0, fontSize: '16px', opacity: 0.9 }}>
            {isExploitationLicense ? 'پروانه بهره‌برداری وسایل نقلیه باربر' : 'سامانه صدور پروانه فعالیت وسایل نقلیه باربر'}
          </p>
        </div>

        {/* Content */}
        <div style={{ padding: '40px' }}>
          {/* License Status */}
          <div style={{ textAlign: 'center', marginBottom: '40px' }}>
            <div style={{ fontSize: '16px', color: '#6b7280', marginBottom: '10px' }}>وضعیت پروانه</div>
            {getStatusBadge(request.status)}
          </div>

          {/* License Number */}
          <div style={{ background: '#f9fafb', padding: '24px', borderRadius: '12px', marginBottom: '30px', textAlign: 'center' }}>
            <div style={{ fontSize: '14px', color: '#6b7280', marginBottom: '8px' }}>شماره پروانه</div>
            <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#1f2937', fontFamily: 'monospace' }}>
              {toFarsiNumber(request.trackingNo)}
            </div>
          </div>

          {/* Person Information */}
          <div style={{ marginBottom: '30px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 'bold', color: '#1f2937', marginBottom: '16px', paddingBottom: '8px', borderBottom: '2px solid #e5e7eb' }}>
              اطلاعات متقاضی
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
              <div>
                <div style={{ fontSize: '13px', color: '#6b7280', marginBottom: '4px' }}>نام و نام خانوادگی</div>
                <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#1f2937' }}>
                  {person?.FirstName} {person?.LastName}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '13px', color: '#6b7280', marginBottom: '4px' }}>کد ملی</div>
                <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#1f2937', fontFamily: 'monospace' }}>
                  {toFarsiNumber(person?.NationalCode)}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '13px', color: '#6b7280', marginBottom: '4px' }}>نام پدر</div>
                <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#1f2937' }}>
                  {person?.FatherName || '-'}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '13px', color: '#6b7280', marginBottom: '4px' }}>شماره شناسنامه</div>
                <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#1f2937', fontFamily: 'monospace' }}>
                  {toFarsiNumber(person?.IdSerial) || '-'}
                </div>
              </div>
            </div>
          </div>

          {/* Company Information (for exploitation licenses and legal entity licenses) or Vehicle Information */}
          {(isExploitationLicense || isLegalEntityLicense) ? (
            <div style={{ marginBottom: '30px' }}>
              <h2 style={{ fontSize: '20px', fontWeight: 'bold', color: '#1f2937', marginBottom: '16px', paddingBottom: '8px', borderBottom: '2px solid #e5e7eb' }}>
                اطلاعات شرکت
              </h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
                <div>
                  <div style={{ fontSize: '13px', color: '#6b7280', marginBottom: '4px' }}>نام شرکت</div>
                  <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#1f2937' }}>
                    {company?.CompanyName || '-'}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '13px', color: '#6b7280', marginBottom: '4px' }}>شماره ثبت</div>
                  <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#1f2937', fontFamily: 'monospace' }}>
                    {toFarsiNumber(company?.RegistrationNo) || '-'}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '13px', color: '#6b7280', marginBottom: '4px' }}>تاریخ ثبت</div>
                  <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#1f2937' }}>
                    {company?.RegistrationDate || '-'}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '13px', color: '#6b7280', marginBottom: '4px' }}>رشته فعالیت</div>
                  <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#1f2937' }}>
                    {company?.ActivityFieldName || '-'}
                  </div>
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                  <div style={{ fontSize: '13px', color: '#6b7280', marginBottom: '4px' }}>درجه</div>
                  <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#1f2937' }}>
                    {company?.TonnageRateName || '-'}
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {/* Company Documents - show for legal entity licenses */}
          {isLegalEntityLicense && companyDocuments && companyDocuments.length > 0 && (
            <div style={{ marginBottom: '30px' }}>
              <h2 style={{ fontSize: '20px', fontWeight: 'bold', color: '#1f2937', marginBottom: '16px', paddingBottom: '8px', borderBottom: '2px solid #e5e7eb' }}>
                مستندات شرکت
              </h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
                {companyDocuments.map((doc, idx) => (
                  <div key={idx} style={{ padding: '12px', background: '#f9fafb', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
                    <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#1f2937', marginBottom: '4px' }}>
                      {doc.DocTypeName || 'مدرک شرکت'}
                    </div>
                    <div style={{ fontSize: '12px', color: '#6b7280' }}>
                      تاریخ بارگذاری: {formatDate(doc.CreatedAt)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Vehicle Information */}
          {!isLegalEntityLicense && !isExploitationLicense && (
            <div style={{ marginBottom: '30px' }}>
              <h2 style={{ fontSize: '20px', fontWeight: 'bold', color: '#1f2937', marginBottom: '16px', paddingBottom: '8px', borderBottom: '2px solid #e5e7eb' }}>
                اطلاعات وسیله نقلیه
              </h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
                <div>
                  <div style={{ fontSize: '13px', color: '#6b7280', marginBottom: '4px' }}>نوع وسیله نقلیه</div>
                  <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#1f2937' }}>
                    {vehicle?.VehicleKindName || '-'}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '13px', color: '#6b7280', marginBottom: '4px' }}>شماره پلاک</div>
                  <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#1f2937', fontFamily: 'monospace', direction: 'ltr' }}>
                    {vehicle?.PlateSerial2 && vehicle?.PlateThreeDigits && vehicle?.PlateLetter && vehicle?.PlateRegion2
                      ? `${toFarsiNumber(vehicle.PlateRegion2)} / ${toFarsiNumber(vehicle.PlateThreeDigits)} ${vehicle.PlateLetter} ${toFarsiNumber(vehicle.PlateSerial2)}`
                      : '-'}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '13px', color: '#6b7280', marginBottom: '4px' }}>شماره شاسی</div>
                  <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#1f2937', fontFamily: 'monospace' }}>
                    {vehicle?.ChassisNo || '-'}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '13px', color: '#6b7280', marginBottom: '4px' }}>مدل</div>
                  <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#1f2937' }}>
                    {toFarsiNumber(vehicle?.YearManufacture) || '-'}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Issue Date */}
          {isApproved && (
            <div style={{ background: '#d1fae5', padding: '20px', borderRadius: '12px', marginBottom: '30px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ fontSize: '32px' }}>✓</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#065f46', marginBottom: '4px' }}>
                    این پروانه معتبر است
                  </div>
                  <div style={{ fontSize: '14px', color: '#047857' }}>
                    تاریخ صدور: {formatDate(request.createdAt)}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginTop: '30px' }}>
            <button
              onClick={() => navigate('/')}
              style={{
                padding: '12px 32px',
                background: '#6b7280',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '16px',
                fontWeight: 'bold',
                cursor: 'pointer'
              }}
            >
              بازگشت به صفحه اصلی
            </button>
            {isApproved && (
              <button
                onClick={() => {
                  if (isExploitationLicense) {
                    navigate(`/print-exploitation-license/${request.requestId}`)
                  } else if (isEmploymentLicense) {
                    navigate(`/print-employment-license/${request.requestId}`)
                  } else if (isLegalEntityLicense) {
                    navigate(`/print-legal-entity-license/${request.requestId}`)
                  } else {
                    navigate(`/print-license/${request.requestId}`)
                  }
                }}
                style={{
                  padding: '12px 32px',
                  background: '#8b5cf6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '16px',
                  fontWeight: 'bold',
                  cursor: 'pointer'
                }}
              >
                مشاهده پروانه کامل
              </button>
            )}
          </div>

          {/* Footer Note */}
          <div style={{ marginTop: '40px', padding: '20px', background: '#f9fafb', borderRadius: '8px', textAlign: 'center' }}>
            <p style={{ margin: 0, fontSize: '13px', color: '#6b7280', lineHeight: '1.8' }}>
              این صفحه برای اعتبارسنجی پروانه‌های صادر شده توسط سازمان حمل و نقل بار شهرداری تبریز طراحی شده است.
              <br />
              در صورت مشاهده هرگونه تخلف یا سوء استفاده، لطفاً با مراجع ذیربط تماس حاصل فرمایید.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
