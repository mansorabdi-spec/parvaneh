import React, { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api } from '../lib/api.js'
import { QRCodeSVG } from 'qrcode.react'
import { logLicensePrint } from '../utils/printLogger.js'

// Component to auto-adjust font size to fit text in one line
function AutoFitText({ children, baseFontSize = 22, minFontSize = 8, style = {} }) {
  const containerRef = useRef(null)
  const [fontSize, setFontSize] = useState(baseFontSize)

  useEffect(() => {
    const adjustFontSize = () => {
      const container = containerRef.current
      if (!container) return

      const p = container.querySelector('p')
      if (!p) return

      // Get container width
      const containerWidth = container.offsetWidth
      
      // Reset to base font size and force single line
      p.style.fontSize = `${baseFontSize}px`
      p.style.whiteSpace = 'nowrap'
      
      // Check if content overflows horizontally
      let newFontSize = baseFontSize
      
      while (newFontSize > minFontSize && p.scrollWidth > containerWidth) {
        newFontSize -= 0.5
        p.style.fontSize = `${newFontSize}px`
      }
      
      setFontSize(newFontSize)
    }

    // Run adjustment after render and after delays
    adjustFontSize()
    const timer1 = setTimeout(adjustFontSize, 100)
    const timer2 = setTimeout(adjustFontSize, 500)
    
    // Re-adjust on window resize and before print
    window.addEventListener('resize', adjustFontSize)
    window.addEventListener('beforeprint', adjustFontSize)
    
    return () => {
      clearTimeout(timer1)
      clearTimeout(timer2)
      window.removeEventListener('resize', adjustFontSize)
      window.removeEventListener('beforeprint', adjustFontSize)
    }
  }, [children, baseFontSize, minFontSize])

  return (
    <div 
      ref={containerRef} 
      style={{
        ...style,
        width: '100%'
      }}
    >
      {children}
    </div>
  )
}

// Keep "جهت انجام سرویس" and "تحت نظارت" on one line, same as the individual license.
function ServiceSupervisionLine({ activityName, supervisorName, baseFontSize = 15.984 }) {
  const lineRef = useRef(null)

  useEffect(() => {
    const fit = () => {
      const el = lineRef.current
      if (!el || el.clientWidth === 0) return

      const minFontSize = baseFontSize * 0.7
      el.style.whiteSpace = 'nowrap'
      let size = baseFontSize
      el.style.fontSize = `${size}px`

      while (size > minFontSize && el.scrollWidth > el.clientWidth) {
        size = Math.max(minFontSize, Math.round((size - 0.25) * 100) / 100)
        el.style.fontSize = `${size}px`
      }

      el.style.whiteSpace = el.scrollWidth > el.clientWidth + 1 ? 'normal' : 'nowrap'
    }

    fit()
    const timers = [50, 150, 400].map((ms) => setTimeout(fit, ms))
    window.addEventListener('resize', fit)
    window.addEventListener('beforeprint', fit)
    return () => {
      timers.forEach(clearTimeout)
      window.removeEventListener('resize', fit)
      window.removeEventListener('beforeprint', fit)
    }
  }, [activityName, supervisorName, baseFontSize])

  return (
    <p ref={lineRef} className="service-line">
      جهت انجام سرویس <span className="db-value">{activityName || 'حمل بار عمومی'}</span>
      {supervisorName ? <> تحت نظارت <span className="db-value">{supervisorName}</span></> : null}
    </p>
  )
}

export default function PrintLegalEntityLicense() {
  const { requestId } = useParams()
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    loadLicenseData()
  }, [requestId])

  const loadLicenseData = async () => {
    try {
      setLoading(true)
      const { data: response } = await api.get(`/api/workflow/requests/${requestId}`)
      console.log('License data loaded:', response)
      setData(response)
      setError('')
    } catch (e) {
      console.error('Error loading license data:', e)
      setError(e?.response?.data?.message || 'خطا در بارگذاری اطلاعات پروانه')
    } finally {
      setLoading(false)
    }
  }

  const handlePrint = async () => {
    // Debug: Log data before printing
    console.log('Printing license with data:', { person: data?.person, vehicle: data?.vehicle, request: data?.request })
    
    // Check if content exists
    const container = document.querySelector('.license-container')
    const page = document.querySelector('.license-page')
    console.log('Container exists:', !!container, 'Page exists:', !!page)
    console.log('Container display:', container ? window.getComputedStyle(container).display : 'N/A')
    console.log('Page display:', page ? window.getComputedStyle(page).display : 'N/A')
    
    if (!container || !page) {
      alert('خطا: محتوای پروانه یافت نشد. لطفا صفحه را رفرش کنید.')
      return
    }
    
    // Log print event to database
    if (data?.request?.requestId && data?.request?.trackingNo) {
      await logLicensePrint(
        data.request.requestId,
        data.request.trackingNo,
        'LegalEntity'
      )
    }
    
    // Small delay to ensure styles are loaded
    setTimeout(() => {
      window.print()
    }, 100)
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return ''
    const date = new Date(dateStr)
    return date.toLocaleDateString('fa-IR', { year: 'numeric', month: '2-digit', day: '2-digit' })
  }

  const toFarsiNumber = (num) => {
    if (!num && num !== 0) return ''
    const farsiDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹']
    return String(num).replace(/\d/g, (x) => farsiDigits[parseInt(x)])
  }

  if (loading) return (
    <div style={{ padding: '40px', textAlign: 'center' }}>
      <div style={{ fontSize: '18px' }}>در حال بارگذاری...</div>
    </div>
  )

  if (error) return (
    <div style={{ padding: '40px', textAlign: 'center', color: '#ef4444' }}>
      <div style={{ fontSize: '18px' }}>{error}</div>
    </div>
  )

  // Check if request is approved (case-insensitive)
  const isApproved = data?.request?.status?.toLowerCase() === 'approved'
  
  if (!data || !data.request) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <div style={{ fontSize: '18px', color: '#f59e0b' }}>
          پرونده یافت نشد
        </div>
      </div>
    )
  }
  
  if (!isApproved) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <div style={{ fontSize: '18px', color: '#f59e0b' }}>
          این پروانه هنوز تایید نشده است (وضعیت: {data.request.status})
        </div>
        <button
          onClick={() => navigate('/workflow/inbox')}
          style={{
            marginTop: '20px',
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
          بازگشت به کارتابل
        </button>
      </div>
    )
  }

  const { request, person, vehicle, company, manager } = data

  return (
    <>
      {/* Print Button - Hidden when printing */}
      <div className="no-print" style={{ 
        padding: '20px', 
        textAlign: 'center', 
        background: '#f3f4f6',
        borderBottom: '2px solid #d1d5db',
        display: 'flex',
        gap: '16px',
        justifyContent: 'center',
        alignItems: 'center'
      }}>
        <button
          onClick={() => navigate('/workflow/inbox')}
          style={{
            padding: '12px 32px',
            background: '#6b7280',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontSize: '16px',
            fontWeight: 'bold',
            cursor: 'pointer',
            boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
          }}
        >
          ← بازگشت به کارتابل
        </button>
        <button
          onClick={handlePrint}
          style={{
            padding: '12px 32px',
            background: '#8b5cf6',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontSize: '16px',
            fontWeight: 'bold',
            cursor: 'pointer',
            boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
          }}
        >
          🖨️ چاپ پروانه
        </button>
      </div>

      {/* License Certificate */}
      <div className="license-container">
        <div className="license-page">
          {/* 2x2 Table Layout - No borders */}
          
          
          <table className="header-table">
            <tbody>
              <tr>
                {/* Row 1, Column 1: Logo */}
                <td className="header-cell logo-cell">
                
                </td>
                {/* Row 1, Column 2: Title */}
                <td className="header-cell title-cell">
                  <h1 className="license-title">پروانه  فعالیت</h1>
                  <h2 className="license-subtitle">وسایل  نقلیه  باربر</h2>
                  <h3 className="license-subtitle">اشخاص  حقوقی</h3>
                </td>
              </tr>
              <tr>
                {/* Row 2, Column 1: License Info */}
                <td className="header-cell info-cell">
                  <table className="info-table">
                    <tbody>
                      <tr>
                        <td className="info-label">شماره پروانه</td>
                        <td className="info-value"><span className="db-value1">{toFarsiNumber(request.trackingNo)}</span></td>
                      </tr>
                      <tr>
                        <td className="info-label">تاریخ صدور</td>
                        <td className="info-value"><span className="db-value1">{request.issueDate ? toFarsiNumber(request.issueDate) : formatDate(request.createdAt)}</span></td>
                      </tr>
                   
                      <tr>
                        <td className="info-label">تاریخ تمدید </td>
                        <td className="info-value">
                          {data?.request?.renewalDate ? toFarsiNumber(data.request.renewalDate) : '________'}
                        </td>
                      </tr>
                      <tr>
                        <td className="info-label">مدت اعتبار</td>
                        <td className="info-value">یکسال</td>
                      </tr>
                    </tbody>
                  </table>
                </td>
                {/* Row 2, Column 2: Legal Text */}
                <td className="header-cell legal-cell">
                  <p className="legal-text">
                    (این پروانه مستند به ماده ۹ قانون، توسعه حمل و نقل عمومی و مدیریت مصرف سوخت مصوبه ۱۵۳۳۶۲/۶۸۵ مورخه ۸۶/۱۰/۰۱ و آیین نامه مدیریت
                    حمل و نقل بار و مسافر در شهر و حومه و دستور العمل مدیریت حمل و نقل بار درونشهری بشماره ۳۵۹۹۲ مورخه ۹۸/۰۸/۱۸ وزارت کشور صادر گردیده
                    است)
                  </p>
                </td>
              </tr>
            </tbody>
          </table>

          {/* Person Information - Table format for justified alignment */}
          <AutoFitText className="person-info-text indented-section" baseFontSize={15.984} minFontSize={10}>
            <table style={{ width: '100%', borderCollapse: 'collapse', border: 'none', tableLayout: 'fixed' }}>
              <tbody>
                <tr>
                  <td style={{ border: 'none', padding: '4px 0', fontSize: '15.984px', textAlign: 'justify', textAlignLast: 'justify' }}>
                    <span style={{ display: 'inline-block', whiteSpace: 'nowrap' }}> به موجب این پروانه شرکت</span>   <span className="db-value">{company?.CompanyName || ''}</span>   <span style={{ display: 'inline-block', whiteSpace: 'nowrap' }}>به شماره ثبت</span>   <span className="db-value">{toFarsiNumber(company?.RegistrationNo) || ''}</span>  
                  </td>
                </tr>
              </tbody>
            </table>
          </AutoFitText>
          <AutoFitText className="person-info-text indented-section" baseFontSize={15.984} minFontSize={10}>
            <table style={{ width: '100%', borderCollapse: 'collapse', border: 'none', tableLayout: 'fixed' }}>
              <tbody>
              <tr>
                  <td style={{ border: 'none', padding: '4px 0', fontSize: '15.984px', textAlign: 'justify', textAlignLast: 'justify' }}>
                    <span style={{ display: 'inline-block', whiteSpace: 'nowrap' }}> به مدیریت</span>   <span className="db-value">{manager?.FirstName || ''}</span>   <span className="db-value">{manager?.LastName || ''}</span>   <span style={{ display: 'inline-block', whiteSpace: 'nowrap' }}> فرزند</span>   <span className="db-value">{manager?.FatherName || ''}</span>   <span style={{ display: 'inline-block', whiteSpace: 'nowrap' }}> شماره شناسنامه</span>   <span className="db-value">{toFarsiNumber(manager?.IdSerial || manager?.IdentitySerial) || ''}</span>
                  </td>
                </tr>
                <tr>
                  <td style={{ border: 'none', padding: '4px 0', fontSize: '15.984px', textAlign: 'justify', textAlignLast: 'justify' }}>
                    <span style={{ display: 'inline-block', whiteSpace: 'nowrap' }}>صادره از</span>   <span className="db-value">{manager?.BirthCityName || ''}</span>   <span style={{ display: 'inline-block', whiteSpace: 'nowrap' }}>تاریخ تولد</span>   <span className="db-value">{manager?.BirthDateJalali || formatDate(manager?.RepresentativeBirthDate || manager?.BirthDate) || ''}</span>   <span style={{ display: 'inline-block', whiteSpace: 'nowrap' }}>کد ملی</span>   <span className="db-value">{toFarsiNumber(manager?.NationalCode) || ''}</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </AutoFitText>



          {/* Permission Text */}
          <div className="license-permission indented-section">
            <p>اجازه دارد از وسیله نقلیه باربر با مشخصات زیر:</p>
          </div>

          {/* Vehicle Information - Table format for justified alignment */}
          <AutoFitText className="vehicle-info-text indented-section" baseFontSize={15.984} minFontSize={10}>
            <table style={{ width: '100%', borderCollapse: 'collapse', border: 'none', tableLayout: 'fixed' }}>
              <tbody>
                <tr>
                  <td style={{ border: 'none', padding: '4px 0', fontSize: '15.984px', textAlign: 'justify', textAlignLast: 'justify' }}>
                    <span className="vehicle-label" style={{ display: 'inline-block', whiteSpace: 'nowrap' }}>نوع وسیله نقلیه</span>   <span className="vehicle-value">{vehicle?.VehicleKindName || ''}</span>   <span className="vehicle-label" style={{ display: 'inline-block', whiteSpace: 'nowrap' }}>سیستم</span>   <span className="vehicle-value">{vehicle?.SystemName || ''}</span>   <span className="vehicle-label" style={{ display: 'inline-block', whiteSpace: 'nowrap' }}>تیپ خودرو</span>   <span className="vehicle-value">{vehicle?.TipName || ''}</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </AutoFitText>
          <AutoFitText className="vehicle-info-text indented-section" baseFontSize={15.984} minFontSize={10}>
            <table style={{ width: '100%', borderCollapse: 'collapse', border: 'none', tableLayout: 'fixed' }}>
              <tbody>
                <tr>
                  <td style={{ border: 'none', padding: '4px 0', fontSize: '15.984px', textAlign: 'justify', textAlignLast: 'justify' }}>
                    <span className="vehicle-label" style={{ display: 'inline-block', whiteSpace: 'nowrap' }}>مدل</span>   <span className="vehicle-value">{toFarsiNumber(vehicle?.YearManufacture) || ''}</span>   <span className="vehicle-label" style={{ display: 'inline-block', whiteSpace: 'nowrap' }}>ظرفیت</span>   <span className="vehicle-value">{toFarsiNumber(vehicle?.Capacity)} تن</span>   <span className="vehicle-label" style={{ display: 'inline-block', whiteSpace: 'nowrap' }}>تعداد سیلندر</span>   <span className="vehicle-value">{toFarsiNumber(vehicle?.Cylinders) || ''}</span>   <span className="vehicle-label" style={{ display: 'inline-block', whiteSpace: 'nowrap' }}>نوع سوخت</span>   <span className="vehicle-value">{vehicle?.FuelTypeName || ''}</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </AutoFitText>
          <AutoFitText className="vehicle-info-text indented-section" baseFontSize={15.984} minFontSize={10}>
            <table style={{ width: '100%', borderCollapse: 'collapse', border: 'none', tableLayout: 'fixed' }}>
              <tbody>
                <tr>
                  <td style={{ border: 'none', padding: '4px 0', fontSize: '15.984px', textAlign: 'justify', textAlignLast: 'justify' }}>
                    <span className="vehicle-label" style={{ display: 'inline-block', whiteSpace: 'nowrap' }}>تعداد محور</span>   <span className="vehicle-value">{toFarsiNumber(vehicle?.Axles) || ''}</span>   <span className="vehicle-label" style={{ display: 'inline-block', whiteSpace: 'nowrap' }}>تعداد چرخ</span>   <span className="vehicle-value">{toFarsiNumber(vehicle?.Wheels) || ''}</span>   <span className="vehicle-label" style={{ display: 'inline-block', whiteSpace: 'nowrap' }}>رنگ بدنه</span>   <span className="vehicle-value">{vehicle?.BodyColor || ''}</span>   <span className="vehicle-label" style={{ display: 'inline-block', whiteSpace: 'nowrap' }}>به شماره انتظامی</span>   <span className="vehicle-value">{vehicle?.PlateSerial2 && vehicle?.PlateThreeDigits && vehicle?.PlateLetter && vehicle?.PlateRegion2
                        ? `${toFarsiNumber(vehicle.PlateRegion2)} / ${toFarsiNumber(vehicle.PlateThreeDigits)} ${vehicle.PlateLetter} ${toFarsiNumber(vehicle.PlateSerial2)}`
                        : ''}</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </AutoFitText>
          <AutoFitText className="vehicle-info-text indented-section" baseFontSize={15.984} minFontSize={10}>
            <table style={{ width: '100%', borderCollapse: 'collapse', border: 'none', tableLayout: 'fixed' }}>
              <tbody>
                <tr>
                  <td style={{ border: 'none', padding: '4px 0', fontSize: '15.984px', textAlign: 'justify', textAlignLast: 'justify' }}>
                    <span className="vehicle-label" style={{ display: 'inline-block', whiteSpace: 'nowrap' }}>شماره موتور</span>   <span className="vehicle-value">{vehicle?.EngineNo || ''}</span>   <span className="vehicle-label" style={{ display: 'inline-block', whiteSpace: 'nowrap' }}>شماره شاسی</span>   <span className="vehicle-value">{vehicle?.ChassisNo || ''}</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </AutoFitText>

          {/* Company Info */}
          <div className="license-company indented-section">
            <ServiceSupervisionLine
              activityName={vehicle?.ActivityCategoryName}
              supervisorName={request.supervisorCompanyName || company?.CompanyName}
            />
          </div>

          {/* Final Note */}
          <div className="license-note indented-section">
            <p>در طول مدت اعتبار پروانه در امر حمل و نقل کالا و بار درون شهری و حومه استفاده نماید</p>
          </div>

          {/* Signature Section */}
          <div className="signature-section">
            <table style={{ width: '100%', borderCollapse: 'collapse', border: 'none' }}>
              <tbody>
                <tr>
                  {/* QR Code - Right Side */}
                  <td style={{ border: 'none', width: '120px', verticalAlign: 'top', paddingRight: '40px', textAlign: 'right' }}>
                    <QRCodeSVG 
                      value={`${window.location.origin}/verify-license/${request.trackingNo}`}
                      size={80}
                      level="M"
                      includeMargin={false}
                    />
                  </td>
                  
                  {/* Signature - Left Side */}
                  <td style={{ border: 'none', textAlign: 'left', verticalAlign: 'top' }}>
                    <div className="signature-box">
                      <p className="signature-name">&nbsp;&nbsp;&nbsp;احمد زارعی &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; </p>
                      <p className="signature-title">مدیر عامل سازمان حمل و نقل بار شهرداری تبریز</p>
                      <p style={{marginRight: '200px'}}>
                      <img src="/logo/emza5.jpg" alt="امضا" className="signature-image" />

                      </p>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

        </div>
      </div>

      {/* Print Styles */}
      <style>{`
        @media print {
          @page {
            size: A4;
            margin: 15mm;
          }
          
          /* Hide navigation and UI elements */
          .no-print,
          nav,
          header:not(.license-header),
          footer,
          aside,
          .sidebar,
          .navbar,
          .menu,
          .navigation,
          .app-header,
          .app-sidebar,
          .app-nav {
            display: none !important;
            visibility: hidden !important;
          }
          
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            border: none !important;
            outline: none !important;
            box-shadow: none !important;
          }
          
          body {
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
          }
          
          /* Make license container and all children visible */
          .license-container,
          .license-container * {
            visibility: visible !important;
          }
          
          .license-container {
            display: block !important;
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
            position: relative !important;
            border: none !important;
            box-shadow: none !important;
            outline: none !important;
          }
          
          .license-page {
            display: block !important;
            border: none !important;
            border-radius: 0 !important;
            padding: 0 !important;
            background: white !important;
            position: relative !important;
            min-height: 100% !important;
          }

          .header-table,
          .header-table *,
          .person-info-text,
          .license-permission,
          .vehicle-info-text,
          .license-company,
          .license-note,
          .signature-section {
            display: block !important;
            visibility: visible !important;
            border: none !important;
            border-radius: 0 !important;
          }

          .header-table {
            display: table !important;
            border: none !important;
          }

          .header-table tbody {
            display: table-row-group !important;
          }

          .header-table tr {
            display: table-row !important;
          }

          .header-table td {
            display: table-cell !important;
            border: none !important;
            border-radius: 0 !important;
          }

          h1, h2, h3, p, span, div {
            visibility: visible !important;
            color: #000 !important;
          }
        }

        * {
          box-sizing: border-box;
        }

        body {
          font-family: 'BNazanin', 'Tahoma', 'Arial', sans-serif;
          direction: rtl;
          margin: 0;
          padding: 0;
        }

        .license-container {
          max-width: 210mm;
          margin: 20px auto;
          background: white;
          padding: 15mm;
          font-family: 'BNazanin', 'Tahoma', 'Arial', sans-serif;
          direction: rtl;
          text-align: right;
          border: none;
        }

        .license-page {
          border: none !important;
          border-radius: 0 !important;
          padding: 0;
          min-height: 257mm;
          position: relative;
          background: white;
        }

        .header-table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 20px;
          border: none;
        }

        .header-cell {
          border: none;
          padding: 10px;
          vertical-align: top;
        }

        .logo-cell {
          width: 25%;
          text-align: center;
        }

        .title-cell {
          width: 73%;
          text-align: center;
        }

        .info-cell {
          width: 27%;
          text-align: right;
          font-size: 11px;
          padding-right: 15px;
          vertical-align: top;
        }

        .legal-cell {
          width: 73%;
          text-align: justify;
          padding-right: 20px;
        }

        .license-logo-placeholder {
          width: 80px;
          height: 80px;
          background: #f0f0f0;
          border: none;
          border-radius: 50%;
          margin: 0 auto;
        }

        .info-table {
          width: 100%;
          border-collapse: collapse;
          border: none;
        }

        .info-table td {
          border: none;
          padding: 2px 5px;
          text-align: right;
          font-size: 15px;
          color: #000;
          white-space: nowrap;
        }

        .info-label {
          text-align: right;
          font-weight: normal;
          font-size: 15px;
        }

        .info-value {
          text-align: right;
          font-weight: normal;
          font-size: 15px;
        }
        
        .db-value1 {
          font-weight: normal;
          display: inline;
          white-space: nowrap;
        }

        .legal-text {
          margin: 0;
          font-size: 13.4px;
          line-height: 2.032;
          color: #000;
          text-align: justify;
        }

        .person-info-text {
          margin: 15px 0;
          text-align: right;
          line-height: 2.286;
        }

        .person-info-text p {
          margin: 5px 0;
          font-size: 14.32px;
          color: #000;
        }

        .indented-section {
          margin-right: 1cm;
        }

        .db-value {
          font-weight: bold;
            padding-left: 12px;  /* یا مقدار دلخواه شما */
            padding-right: 12px;
        }

           .db-value1 {
          font-weight: normal;
        }

        .license-info-row {
          display: flex;
          justify-content: space-around;
          align-items: center;
          padding: 8px 0;
          margin: 8px 0;
          border-bottom: none;
        }

        .license-info-item {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .license-info-item .license-label {
          font-size: 15.984px;
        }

        .license-info-item .license-value {
          font-size: 17.316px;
          font-weight: bold;
        }

        .license-title {
          font-size: 40px;
          font-weight: bold;
          margin: 0 0 3px 0;
          color: #000;
          font-family: 'B Titr';
        }

        .license-subtitle {
          font-size: 33px;
          font-weight: bold;
          margin: 2px 0;
          color: #000;
          font-family: 'B Titr';
        }

        .license-subtitle2 {
          font-size: 19.98px;
          margin: 4px 0;
          color: #000;
        }

        .license-info-box {
          background: #f5f5f5;
          border: none;
          padding: 8px 10px;
          margin: 10px 0;
          text-align: justify;
          line-height: 2.132;
        }

        .license-description {
          margin: 0;
          font-size: 12.654px;
          color: #000;
        }

        .license-content {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
          margin: 12px 0;
        }

        .license-column {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .license-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 5px 0;
          border-bottom: none;
        }

        .license-label {
          font-weight: normal;
          font-size: 15.984px;
          color: #000;
        }

        .license-value {
          font-weight: bold;
          font-size: 17.316px;
          color: #000;
        }

        .license-single-row {
          margin: 10px 0;
          padding: 6px 8px;
          background: #fafafa;
          border-radius: 0;
          display: flex;
          justify-content: space-around;
          align-items: center;
        }

        .license-inline-item {
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }

        .license-inline-item .license-label {
          margin-right: 6px;
        }

        .license-permission {
          text-align: right;
          margin: 12px 0;
          font-size: 17.316px;
          font-weight: normal;
          color: #000;
        }

        .license-permission p {
          margin: 0;
        }

        .vehicle-info-text {
          margin: 15px 0;
          text-align: right;
          line-height: 2.64;
        }

        .vehicle-info-text p {
          margin: 8px 0;
          font-size: 15.984px;
        }

        .vehicle-info-text .vehicle-label {
          font-size: 14.652px;
          color: #000;
          font-weight: normal;
        }

        .vehicle-info-text .vehicle-value {
          font-weight: bold;
          font-size: 18.648px;
          color: #000;
          padding-left: 6px;  
          padding-right: 6px;
        }

        .license-company {
          text-align:right;
          margin: 12px 0;
          font-size: 15.984px;
          color: #000;
        }

        .license-company p {
          margin: 3px 0;
        }

        .service-line {
          width: 100%;
          text-align: right;
          line-height: 1.8;
        }

        .company-name {
          font-weight: bold;
        }

        .license-note {
          text-align: right;
          margin: 12px 0;
          font-size: 14.652px;
          line-height: 2.132;
          color: #000;
        }

        .license-note p {
          margin: 0;
        }

        .signature-section {
          margin-top: 30px;
          padding-right: 40px;
        }

        .signature-box {
          text-align: left;
        }

        .signature-name {
          font-weight: bold;
          font-size: 18.648px;
          margin: 6px 0;
          color: #000;
        }

        .signature-title {
          font-size: 14.652px;
          margin: 4px 0 8px 0;
          color: #000;
        }

        .signature-image {
          width: 120px;
          height: auto;
          margin: 0 auto;
          display: block;
        }

      `}</style>
    </>
  )
}
