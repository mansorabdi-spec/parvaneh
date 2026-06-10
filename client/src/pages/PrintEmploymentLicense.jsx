import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api } from '../lib/api.js'
import { QRCodeSVG } from 'qrcode.react'
import { logLicensePrint } from '../utils/printLogger.js'
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'

export default function PrintEmploymentLicense() {
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
      console.log('Employment license data loaded:', response)
      
      // Load personal photo from PersonDocuments
      // Priority 1: LookupDocTypeId = 168
      // Priority 2: LookupDocTypeId = 24 (fallback)
      if (response?.person?.NationalCode && response?.personDocuments) {
        try {
          // First, try to find photo with LookupDocTypeId = 168
          let photoDoc = response.personDocuments.find(doc => 
            doc.LookupDocTypeId === 168 || doc.lookupDocTypeId === 168
          )
          
          // If not found, fallback to LookupDocTypeId = 24
          if (!photoDoc) {
            photoDoc = response.personDocuments.find(doc => 
              doc.LookupDocTypeId === 24 || doc.lookupDocTypeId === 24
            )
          }
          
          if (photoDoc && photoDoc.DocID) {
            // Fetch the actual photo content using the DocID
            const photoResponse = await api.get(
              `/api/issue/personal/${response.person.NationalCode}/documents/${photoDoc.DocID}/content`,
              { responseType: 'blob' }
            )
            if (photoResponse.data) {
              const photoBlob = photoResponse.data
              const photoUrl = URL.createObjectURL(photoBlob)
              response.person.photoUrl = photoUrl
              console.log('Photo loaded successfully from LookupDocTypeId:', photoDoc.LookupDocTypeId || photoDoc.lookupDocTypeId)
            }
          } else {
            console.warn('No photo document found with LookupDocTypeId 168 or 24')
          }
        } catch (docErr) {
          console.error('Error loading personal photo:', docErr)
        }
      }
      
      setData(response)
      setError('')
    } catch (e) {
      console.error('Error loading license data:', e)
      setError(e?.response?.data?.message || 'خطا در بارگذاری اطلاعات پروانه')
    } finally {
      setLoading(false)
    }
  }

  // Export PDF with exact card size (82mm x 52mm) and no extra margins/spaces
  // Renders the card to canvas and writes it into a PDF of the exact size.
  const handleExportPdf = async () => {
    const card = document.querySelector('.employment-license-card')
    if (!card) {
      alert('خطا: محتوای کارت یافت نشد. لطفا صفحه را رفرش کنید.')
      return
    }

    // Log print event to database
    if (data?.request?.requestId && data?.request?.trackingNo) {
      await logLicensePrint(
        data.request.requestId,
        data.request.trackingNo,
        'Employment'
      )
    }

    // Ensure web fonts are fully loaded before rendering to canvas (prevents garbled text)
    try {
      if (document.fonts && document.fonts.ready) {
        await Promise.race([
          document.fonts.ready,
          new Promise(resolve => setTimeout(resolve, 800)) // safety timeout
        ])
      }
    } catch {}

    // Add a temporary class to stabilize fonts during export (affects only the title)
    card.classList.add('exporting')
    let canvas
    try {
      // First attempt: high quality
      canvas = await html2canvas(card, {
        scale: 4,
        useCORS: true,
        allowTaint: true,
        foreignObjectRendering: true,
        backgroundColor: '#ffffff',
        letterRendering: true,
        logging: false
      })
      if (!canvas || !canvas.width || !canvas.height) {
        throw new Error('Empty canvas')
      }
    } catch (e) {
      // Fallback attempt with simpler options
      canvas = await html2canvas(card, {
        scale: 3,
        useCORS: true,
        allowTaint: true,
        foreignObjectRendering: true,
        backgroundColor: '#ffffff',
        logging: false
      })
    } finally {
      card.classList.remove('exporting')
    }
    // Detect blank canvas (all white/transparent) and fallback to iframe print
    try {
      const ctx = canvas.getContext('2d')
      const sample = ctx.getImageData(0, 0, 10, 10).data
      let hasNonWhite = false
      for (let i = 0; i < sample.length; i += 4) {
        const r = sample[i], g = sample[i+1], b = sample[i+2], a = sample[i+3]
        if (!(a === 0 || (r === 255 && g === 255 && b === 255))) { hasNonWhite = true; break }
      }
      if (!hasNonWhite) {
        // Fallback to iframe print (user selects Save as PDF)
        const styleEl = document.querySelector('style[data-print-license-styles]')
        const componentStyles = styleEl ? styleEl.innerHTML : ''
        const styles = `
          <style>
            @page { size: 82mm 52mm; margin: 0; }
            html, body { width: 82mm; height: 52mm; margin: 0; padding: 0; background: #ffffff; direction: rtl; }
            .print-wrapper { width: 82mm; height: 52mm; display: flex; align-items: center; justify-content: center; overflow: hidden; }
            .employment-license-card { width: 82mm; height: 52mm; page-break-inside: avoid; box-shadow: none !important; }
            table, tr, td, thead, tbody, tfoot { page-break-inside: avoid; }
            * { -webkit-print-color-adjust: exact; print-color-adjust: exact; color-adjust: exact; }
          </style>
          <style>${componentStyles}</style>
        `
        const html = `<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8" />${styles}</head><body><div class="print-wrapper">${card.outerHTML}</div></body></html>`
        const iframe = document.createElement('iframe')
        iframe.style.position = 'fixed'; iframe.style.right = '0'; iframe.style.bottom = '0'; iframe.style.width = '0'; iframe.style.height = '0'; iframe.style.border = '0'
        document.body.appendChild(iframe)
        const doc = iframe.contentDocument || iframe.contentWindow.document
        doc.open(); doc.write(html); doc.close()
        setTimeout(() => { iframe.contentWindow.focus(); iframe.contentWindow.print(); setTimeout(() => document.body.removeChild(iframe), 800) }, 300)
        return
      }
    } catch {}
    const imgData = canvas.toDataURL('image/png')

    // Create PDF with exact landscape size 82x52mm (width x height)
    const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: [52, 82] })
    // Place the image to fully fill the page
    pdf.addImage(imgData, 'PNG', 0, 0, 82, 52, undefined, 'FAST')
    const fileName = `employment-card-${(data?.request?.trackingNo || String(Date.now())).replace(/[^\w-]+/g,'_')}.pdf`
    pdf.save(fileName)
  }

  const handlePrint = async () => {
    // Find the card to print
    const card = document.querySelector('.employment-license-card')
    if (!card) {
      alert('خطا: محتوای پروانه یافت نشد. لطفا صفحه را رفرش کنید.')
      return
    }

    // Log print event to database
    if (data?.request?.requestId && data?.request?.trackingNo) {
      await logLicensePrint(
        data.request.requestId,
        data.request.trackingNo,
        'Employment'
      )
    }

    // Create a hidden iframe (not a popup)
    const iframe = document.createElement('iframe')
    iframe.style.position = 'fixed'
    iframe.style.right = '0'
    iframe.style.bottom = '0'
    iframe.style.width = '0'
    iframe.style.height = '0'
    iframe.style.border = '0'
    document.body.appendChild(iframe)

    // Capture the component styles defined in this file so the iframe has the same CSS
    const styleEl = document.querySelector('style[data-print-license-styles]')
    const componentStyles = styleEl ? styleEl.innerHTML : ''

    const styles = `
      <style>
        ${componentStyles}
      </style>
      <style>
        /* Force EXACTLY one small page */
        @page { size: 82mm 52mm; margin: 0; }
        html, body { width: 82mm; height: 52mm; margin: 0; padding: 0; background: #ffffff; direction: rtl; }
        .print-wrapper { width: 82mm; height: 52mm; display: flex; align-items: center; justify-content: center; overflow: hidden; }
        .employment-license-card { width: 82mm; height: 52mm; page-break-inside: avoid; box-shadow: none !important; }
        table, tr, td, thead, tbody, tfoot { page-break-inside: avoid; }
        img { max-width: 100%; height: auto; }
        * { -webkit-print-color-adjust: exact; print-color-adjust: exact; color-adjust: exact; }

        /* Ensure header spacing in print to avoid text touching the photo */
        .license-header-table { width: 100%; border-collapse: separate; border-spacing: 0 0; table-layout: fixed; }
        .spacer-cell { width: 6px; }
        .license-header-table tr { height: 75px; }
        .license-header-table td { border: none; padding: 0; vertical-align: top; }
        .logo-cell { width: 60px; padding: 0 !important; text-align: right; }
        .title-cell { padding: 8px 12px 8px 20px !important; text-align: center; vertical-align: middle; box-sizing: border-box; overflow: hidden; }
        .photo-cell { width: 60px; padding: 7px 0 0 14px !important; text-align: left; vertical-align: top; box-sizing: border-box; }
        .license-subtitle { white-space: nowrap; padding-left: 8px !important; box-sizing: border-box; }
      </style>
    `

    const html = `
      <!doctype html>
      <html lang="fa" dir="rtl">
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          ${styles}
          <title>چاپ پروانه اشتغال</title>
        </head>
        <body>
          <div class="print-wrapper">${card.outerHTML}</div>
        </body>
      </html>
    `

    const doc = iframe.contentDocument || iframe.contentWindow.document
    doc.open()
    doc.write(html)
    doc.close()

    const doPrint = () => {
      try {
        iframe.contentWindow.focus()
        iframe.contentWindow.print()
      } finally {
        setTimeout(() => {
          document.body.removeChild(iframe)
        }, 500)
      }
    }

    // Give the iframe a moment to load images/fonts
    setTimeout(doPrint, 250)
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

  const isApproved = data?.request?.status?.toLowerCase() === 'approved'
  
  if (!data || !data.request) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <div style={{ fontSize: '18px', color: '#f59e0b' }}>پرونده یافت نشد</div>
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

  const { request, person, vehicle } = data

  return (
    <>
      {/* Print Button - Hidden when printing */}
      <div className="no-print" style={{ 
        padding: '20px', 
        textAlign: 'center', 
        background: '#f3f4f6',
        borderBottom: '2px solid #d1d5db',
        display: 'flex',
        gap: '12px',
        justifyContent: 'center',
        alignItems: 'center'
      }}>
        <button
          onClick={handlePrint}
          style={{
            padding: '12px 32px',
            background: '#10b981',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontSize: '16px',
            fontWeight: 'bold',
            cursor: 'pointer'
          }}
        >
          🖨️ چاپ پروانه اشتغال
        </button>
        <button
          onClick={handleExportPdf}
          style={{
            padding: '12px 24px',
            background: '#2563eb',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontSize: '16px',
            fontWeight: 'bold',
            cursor: 'pointer'
          }}
        >
          ⬇️ خروجی PDF (82×52)
        </button>
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
            cursor: 'pointer'
          }}
        >
          بازگشت به کارتابل
        </button>
      </div>

      {/* Employment License Card - 82mm x 52mm */}
      <div className="employment-license-container" id="print-container">
        <div className="employment-license-card" id="license-card">
          {/* Decorative Border */}
          <div className="decorative-border"></div>
          
          {/* Header Section - Using table for equal heights */}
          <table className="license-header-table">
            <tbody>
              <tr>
                <td className="logo-cell">
                  <img src="/logo/logo4.png" alt="لوگو" className="logo-image" width="40" height="40" />
                </td>
                <td className="title-cell">
                  <div className="license-title">پروانـه اشتغال</div>
                  <div className="license-subtitle">حمل‌ونقل بار درون شهری تبریز و حومه</div>
                  <div className="license-description">
                    به موجب این پروانه، راننده با مشخصات ذیل مجاز به انجام فعالیت در امور حمل‌ونقل بار
                    درون شهری تبریز و حومه با وسیله نقلیه تعیین شده می‌باشد.
                  </div>
                </td>
                {/* Fixed spacer to ensure definite gap before photo in print engines */}
                <td className="spacer-cell"></td>
                <td className="photo-cell">
                  {person?.photoUrl ? (
                    <img src={person.photoUrl} alt="عکس" className="photo-image" width="60" height="75" />
                  ) : (
                    <div className="no-photo">عکس</div>
                  )}
                </td>
              </tr>
            </tbody>
          </table>

          {/* Blue Separator */}
          <div className="blue-separator"></div>
          
          {/* QR Code - Positioned absolutely on far left with 7px spacing */}
          <div className="qr-code-section">
            <QRCodeSVG 
              value={`${window.location.origin}/verify/${request.trackingNo}`}
              size={50}
              level="L"
              bgColor="#ffffff"
              fgColor="#000000"
              includeMargin={false}
            />
          </div>

          {/* Information Table - 5 rows x 3 columns, borderless */}
          <div className="info-section">
            <table className="license-info-table">
              <tbody>
                {/* سطر اول */}
                <tr>
                  {/* ستون 1: شماره پروانه */}
                  <td className="table-cell">
                    <span className="info-label">شماره پروانه:</span>
                    <span className="info-value" style={{ direction: 'ltr', display: 'inline-block', unicodeBidi: 'embed' }}>{toFarsiNumber(request.trackingNo || '')}</span>
                  </td>
                  
                  {/* ستون 2 و 3: تاریخ اخذ پروانه */}
                  <td className="table-cell" colSpan={2}>
                    <span className="info-label">تاریخ اخذ پروانه:</span>
                    <span className="info-value">{formatDate(request.completedAt || request.createdAt)}</span>
                  </td>
                </tr>

                {/* سطر دوم */}
                <tr>
                  {/* ستون 1، 2 و 3 ادغام شده: نام و نام خانوادگی */}
                  <td className="table-cell" colSpan={3}>
                    <span className="info-label">نام و نام خانوادگی:</span>
                    <span className="info-value">{person?.FirstName} {person?.LastName}</span>
                  </td>
                </tr>

                {/* سطر سوم */}
                <tr>
                  {/* ستون 1: تاریخ تولد */}
                  <td className="table-cell">
                    <span className="info-label">تاریخ تولد:</span>
                    <span className="info-value">{person?.BirthDateJalali}</span>
                  </td>
                  
                  {/* ستون 2: نوع گواهینامه */}
                  <td className="table-cell">
                    <span className="info-label">نوع گواهینامه:</span>
                    <span className="info-value">{person?.CertificateType || 'پایه ۱'}</span>
                  </td>
                  
                  {/* ستون 3: بخش امضا (ادغام سطرهای 3، 4، 5) */}
                  <td className="table-cell signature-cell" rowSpan={3}>
                    <div className="signature-container">
                      <img src="/logo/emza6.png" alt="امضا" className="signature-img" width="30" height="12" crossOrigin="anonymous" />
                      <div className="signature-title-text">مدیر عامل سازمان حمل و نقل بار</div>
                      <div className="signature-name-text">احمد زارعی</div>
                    </div>
                  </td>
                </tr>

                {/* سطر چهارم */}
                <tr>
                  {/* ستون 1: کد ملی */}
                  <td className="table-cell">
                    <span className="info-label">کد ملی:</span>
                    <span className="info-value">{toFarsiNumber(person?.NationalCode || '')}</span>
                  </td>
                  
                  {/* ستون 2: شماره گواهینامه */}
                  <td className="table-cell">
                    <span className="info-label">شماره گواهینامه:</span>
                    <span className="info-value license-number">{toFarsiNumber(person?.DrivingLicenseNo || '')}</span>
                  </td>
                  {/* ستون 3 ادغام شده */}
                </tr>

                {/* سطر پنجم */}
                <tr>
                  {/* ستون 1: نوع فعالیت */}
                  <td className="table-cell" colSpan={2}>
                    <span className="info-label">نوع فعالیت:</span>
                    <span className="info-value">{vehicle?.ActivityCategoryName || 'حمل بار عمومی'}</span>
                  </td>
                  {/* ستون 2 خالی (ادغام شده با ستون 1) */}
                  {/* ستون 3 ادغام شده */}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Styles */}
      <style data-print-license-styles>{`
        /* 
         * CMYK COLOR SYSTEM FOR PRINT ACCURACY
         * =====================================
         * This stylesheet uses CMYK (device-cmyk) color values for accurate printing.
         * Each color has both CMYK and RGB fallback for browser compatibility.
         * 
         * Color Reference:
         * - Background (#d1d1b9): CMYK(0%, 0%, 12%, 18%) - Light beige
         * - Border (#cc9765): CMYK(0%, 25%, 50%, 20%) - Copper/bronze
         * - Blue Separator (#5fb8e0): CMYK(63%, 12%, 0%, 12%) - Light blue
         * - Black text: CMYK(0%, 0%, 0%, 100%) - Pure black
         * - Gray labels: CMYK(0%, 0%, 0%, 58%) - Medium gray
         */
        
        * {
          box-sizing: border-box;
        }

        body {
          margin: 0;
          padding: 0;
          font-family: 'Vazirmatn', 'Tahoma', sans-serif;
        }

        /* Print styles */
        @media print {
          @page {
            size: A4 landscape;
            margin: 15mm;
          }

          body {
            background: white;
          }

          .no-print {
            display: none !important;
          }

          .employment-license-container {
            background: white;
            padding: 0;
            min-height: auto;
            display: flex;
            justify-content: center;
            align-items: center;
          }

          .employment-license-card {
            page-break-inside: avoid;
          }

          /* Ensure CMYK colors print exactly as specified */
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color-adjust: exact !important;
            color-rendering: optimizeQuality !important;
          }
        }

        .employment-license-container {
          background:rgb(235, 233, 229);
          min-height: 100vh;
          display: flex;
          justify-content: center;
          align-items: center;
          padding: 20px;
        }

        /* Employment License Card - 82mm x 52mm (Credit card size) */
        .employment-license-card {
          width: 82mm;
          height: 52mm;
          /* CMYK: 0%, 0%, 12%, 18% - Light beige background */
          background: color(device-cmyk 0 0 0.12 0.18);
          background:rgb(253, 184,123); /* RGB fallback */
          border: 2px solid color(device-cmyk 0 0.2 0.5 0.17);
          border: 2px solid #d4af37; /* RGB fallback - Gold border */
          border-radius: 8px;
          position: relative;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        }
        
        @media screen {
          .employment-license-card {
            overflow: hidden;
          }
        }
        
        @media print {
          .employment-license-card {
            overflow: visible;
          }
        }

        /* Decorative Border - All sides equal */
        .decorative-border {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          border: 3px solid transparent;
          /* CMYK: 0%, 25%, 50%, 20% - Copper/bronze color */
          border-image: repeating-linear-gradient(
            0deg,
            color(device-cmyk 0 0.25 0.5 0.2) 0px,
            color(device-cmyk 0 0.25 0.5 0.2) 8px,
            transparent 8px,
            transparent 16px
          ) 3;
          border-image: repeating-linear-gradient(
            0deg,
            #cc9765 0px,
            #cc9765 8px,
            transparent 8px,
            transparent 16px
          ) 3; /* RGB fallback */
          pointer-events: none;
        }
        
        .decorative-border::before,
        .decorative-border::after {
          content: '';
          position: absolute;
          /* CMYK: 0%, 25%, 50%, 20% */
          background: repeating-linear-gradient(
            90deg,
            color(device-cmyk 0 0.25 0.5 0.2) 0px,
            color(device-cmyk 0 0.25 0.5 0.2) 8px,
            transparent 8px,
            transparent 16px
          );
          background: repeating-linear-gradient(
            90deg,
            #cc9765 0px,
            #cc9765 8px,
            transparent 8px,
            transparent 16px
          ); /* RGB fallback */
        }
        
        .decorative-border::before {
          top: 0;
          left: 0;
          right: 0;
          height: 3px;
        }
        
        .decorative-border::after {
          bottom: 0;
          left: 0;
          right: 0;
          height: 3px;
        }

        /* Header Section - Table Layout */
        .license-header-table {
          width: 100%;
          border-collapse: collapse;
          table-layout: fixed;
        }

        .license-header-table tr {
          height: 75px;
        }

        .license-header-table td {
          border: none;
          padding: 0;
          vertical-align: top;
        }

        /* Fixed spacer cell to guarantee a gap between title and photo */
        .spacer-cell { width: 6px; }

        /* Header table ensures a tiny gap between cells (avoid text touching the photo) */
        .license-header-table {
          width: 100%;
          border-collapse: separate;
          border-spacing: 0 0; /* no gap between logo and title; spacer cell handles title->photo */
        }

        /* Logo Cell - Flush to top-right corner */
        .logo-cell {
          width: 60px;
          padding: 0 !important;
          text-align: right;
        }

        .logo-image {
          width: 60px;
          height: 60px;
          object-fit: contain;
          display: block;
          margin: 0;
        }

        /* Title Cell - Center */
        .title-cell {
          padding: 8px 9px 8px 20px !important; /* reduce right padding; keep left padding for photo gap */
          text-align: right; /* no extra space before logo */
          vertical-align: middle;
          overflow: hidden; /* avoid any print-engine overlap */
        }

        /* Photo Cell - Left side with 7px spacing from top and left */
        .photo-cell {
          width: 60px;
          padding: 7px 0 0 14px !important; /* further left padding to keep distance from text */
          text-align: left;
          vertical-align: top;
        }

        .photo-image {
          width: 60px;
          height: 75px;
          object-fit: cover;
          display: block;
          /* CMYK: 0%, 0%, 0%, 36% - Medium gray border */
          border: 1px solid color(device-cmyk 0 0 0 0.36);
          border: 1px solid #9ca3af; /* RGB fallback */
          border-radius: 4px;
        }

        .no-photo {
          width: 60px;
          height: 75px;
          /* CMYK: 0%, 0%, 0%, 18% - Light gray background */
          background: color(device-cmyk 0 0 0 0.18);
          background: #d1d5db; /* RGB fallback */
          /* CMYK: 0%, 0%, 0%, 36% - Medium gray border */
          border: 1px solid color(device-cmyk 0 0 0 0.36);
          border: 1px solid #9ca3af; /* RGB fallback */
          border-radius: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 10px;
          /* CMYK: 0%, 0%, 0%, 58% */
          color: color(device-cmyk 0 0 0 0.58);
          color: #6b7280; /* RGB fallback */
        }

        /* QR Code Section - Positioned absolutely on far left with 7px spacing */
        .qr-code-section {
          position: absolute;
          left: 8px;
          top: 90px;
          width: 50px;
          height: 50px;
          /* CMYK: 0%, 0%, 0%, 0% - Pure white */
          background: color(device-cmyk 0 0 0 0);
          background: white; /* RGB fallback */
          /* CMYK: 0%, 0%, 0%, 18% - Light gray border */
          border: 1px solid color(device-cmyk 0 0 0 0.18);
          border: 1px solid #d1d5db; /* RGB fallback */
          border-radius: 2px;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 2px;
          z-index: 50; /* keep above table content */
        }

        .qr-code-section svg {
          width: 100%;
          height: 100%;
        }

        /* Title Section Styles */
        .license-title {
          font-size: 18px;
          font-weight: bold;
          margin: 0 0 4px 0;
          /* CMYK: 0%, 0%, 0%, 100% - Pure black */
          color: color(device-cmyk 0 0 0 1);
          color: #000; /* RGB fallback */
          font-family: 'Titr', 'Vazirmatn', sans-serif;
          letter-spacing: 1px;
        }

        .license-subtitle {
          font-size: 9px;
          font-weight: bold;
          margin: 0px 0;
          /* CMYK: 0%, 0%, 0%, 78% - Dark gray */
          color: color(device-cmyk 0 0 0 0.78);
          color: #1f2937; /* RGB fallback */
          white-space: nowrap;
          padding-left: 1px; /* extra safety space from photo on the left in RTL */
          box-sizing: border-box;
        }

        .license-description {
          font-size: 7px;
          line-height: 1.1;
          text-align: center;
          margin-top: 1px;
          /* CMYK: 0%, 0%, 0%, 75% - Medium gray */
          color: color(device-cmyk 0 0 0 0.75);
          color: #374151; /* RGB fallback */
        }

        /* Blue Separator */
        .blue-separator {
          height: 4px;
          /* CMYK: 63%, 12%, 0%, 12% - Light blue */
          background: color(device-cmyk 0.63 0.12 0 0.12);
          background: #5fb8e0; /* RGB fallback */
          margin: 0;
        }

        /* Information Section - Table Layout */
        .info-section {
          /* Add left padding to reserve space for the absolutely positioned QR code */
          padding: 6px 10px 6px 38px;
          /* unify with card background */
          background: transparent;
        }

        /* License Info Table - Borderless */
        .license-info-table {
          width: 100%;
          border-collapse: collapse;
          border: none;
        }

        .license-info-table tbody {
          border: none;
        }

        .license-info-table tr {
          border: none;
        }

        .table-cell {
          border: none;
          padding: 3px 4px;
          vertical-align: middle;
          text-align: right;
          font-size: 8px;
          white-space: nowrap; /* keep each cell on a single line */
        }

        .table-cell .info-label {
          /* CMYK: 0%, 0%, 0%, 58% - Medium gray for labels */
          color: color(device-cmyk 0 0 0 0.58);
          color: #6b7280; /* RGB fallback */
          font-weight: normal;
          margin-left: 4px;
          white-space: nowrap; /* do not wrap labels */
        }

        .table-cell .info-value {
          /* CMYK: 0%, 0%, 0%, 100% - Pure black for values */
          color: color(device-cmyk 0 0 0 1);
          color: #000; /* RGB fallback */
          font-weight: bold;
          white-space: nowrap; /* do not wrap values */
        }

        /* QR Cell in Table */
        .table-cell.qr-cell {
          text-align: center;
          vertical-align: middle;
          padding: 2px;
        }

        /* Signature Cell in Table */
        .table-cell.signature-cell {
          text-align: center;
          vertical-align: middle;
          padding: 2px 4px;
          width: 80px; /* reserve width for signature so long texts don't squeeze it */
        }

        .signature-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 2px;
          padding-top: 17px;
        }

        .signature-img {
          width: 30px;
          height: auto;
          display: block;
          margin: 0 auto 2px auto;
        }

        .signature-title-text {
          font-size: 5px;
          /* CMYK: 0%, 0%, 0%, 58% - Medium gray */
          color: color(device-cmyk 0 0 0 0.58);
           color: #000; /* RGB fallback */
          text-align: center;
          line-height: 1.2;
        }

        .signature-name-text {
          font-size: 7px;
          /* CMYK: 0%, 0%, 0%, 100% - Pure black */
          color: color(device-cmyk 0 0 0 1);
          color: #000; /* RGB fallback */
          font-weight: bold;
          text-align: center;
        }

        /* Long driving license numbers: allow wrapping/constraints and slight downsizing */
        .license-number {
          display: inline-block;
          max-width: 95px; /* do not let the value expand the layout */
          white-space: normal; /* override default nowrap for .info-value */
          overflow-wrap: anywhere; /* break long digit sequences if needed */
          direction: ltr;
          unicode-bidi: embed;
          font-size: 7px; /* slightly smaller to fit long values */
        }
      `}</style>
    </>
  )
}
