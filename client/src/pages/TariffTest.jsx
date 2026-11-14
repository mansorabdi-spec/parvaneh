import React, { useState, useEffect } from 'react'
import { api } from '../lib/api.js'
import './TariffTest.css'

export default function TariffTest() {
  const [licenseType, setLicenseType] = useState('Activity') // Activity, Employment, Exploitation
  const [operationType, setOperationType] = useState('صدور') // صدور, تمدید, تمدید اجباری
  const [capacityTon, setCapacityTon] = useState('4')
  const [nationalCode, setNationalCode] = useState('')
  const [companyNationalId, setCompanyNationalId] = useState('')
  const [vehicleKindId, setVehicleKindId] = useState('')
  const [tariffs, setTariffs] = useState([])
  const [operationTypes, setOperationTypes] = useState([])
  const [selectedTariff, setSelectedTariff] = useState(null)
  const [calculatedAmount, setCalculatedAmount] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Load operation types
  useEffect(() => {
    loadOperationTypes()
    loadTariffs()
  }, [])

  // Recalculate when any parameter changes
  useEffect(() => {
    if (tariffs.length > 0) {
      calculateAmount()
    }
  }, [licenseType, operationType, capacityTon, tariffs])

  const loadOperationTypes = async () => {
    try {
      const res = await api.get('/api/lookups/values', {
        params: { categoryKey: 'OperationType' }
      })
      setOperationTypes(res.data || [])
      console.log('📦 Loaded operation types:', res.data)
      // Default to صدور
      if (res.data?.length > 0) {
        const defaultOp = res.data.find(o => o.Name === 'صدور') || res.data[0]
        setOperationType(defaultOp.Name)
      }
    } catch (e) {
      console.error('Error loading operation types:', e)
      // Fallback to default operation types
      setOperationTypes([
        { Id: 1, Name: 'صدور' },
        { Id: 2, Name: 'تمدید' },
        { Id: 3, Name: 'تمدید اجباری' }
      ])
    }
  }

  const loadTariffs = async () => {
    try {
      const res = await api.get('/api/tariffs')
      setTariffs(res.data || [])
      console.log('📦 Loaded tariffs:', res.data)
    } catch (e) {
      console.error('Error loading tariffs:', e)
      setError('خطا در بارگذاری تعرفه‌ها')
    }
  }

  const calculateAmount = () => {
    try {
      const cap = parseFloat(capacityTon) || 0
      const licenseTypeName = licenseType === 'Activity' ? 'پروانه فعالیت' :
        licenseType === 'Employment' ? 'پروانه اشتغال' : 'پروانه بهره‌برداری'
      
      // Determine target DocType based on operation type
      let targetDocType = 'صدور'
      if (operationType === 'تمدید اجباری') {
        targetDocType = 'تمدید اجباری'
      } else if (operationType === 'تمدید') {
        targetDocType = 'تمدید'
      }

      console.log('🔍 Searching for tariff:', {
        licenseTypeName,
        targetDocType,
        capacity: cap
      })

      // Find matching tariff
      let match = null
      for (const t of tariffs) {
        const tariffDocTypeName = t.DocTypeName || ''
        const tariffLicenseType = (t.LicenseType || t.licenseType || '').trim()
        
        // Check DocType match
        if (tariffDocTypeName !== targetDocType) {
          continue
        }
        
        // Check LicenseType match
        const tariffIsEmployment = tariffLicenseType.includes('اشتغال')
        const tariffIsActivity = tariffLicenseType.includes('فعالیت')
        const tariffIsExploitation = tariffLicenseType.includes('بهره')
        
        if (licenseType === 'Employment' && !tariffIsEmployment) continue
        if (licenseType === 'Activity' && !tariffIsActivity) continue
        if (licenseType === 'Exploitation' && !tariffIsExploitation) continue
        
        // Check capacity range
        const from = parseFloat(t.FromTon ?? t.fromTon ?? 0)
        const to = parseFloat(t.ToTon ?? t.toTon ?? 999999)
        
        if (cap >= from && cap <= to) {
          match = t
          break
        }
      }

      setSelectedTariff(match)
      
      if (match) {
        const tariffAmount = Number(match.Amount ?? match.amount ?? 0)
        const vat = Math.round(tariffAmount * 0.10)
        const total = tariffAmount + vat
        
        setCalculatedAmount({
          tariffId: match.Id,
          title: `${operationType} ${licenseTypeName} از ${match.FromTon ?? ''} تا ${match.ToTon ?? ''} تن`,
          baseAmount: tariffAmount,
          vat: vat,
          total: total,
          fromTon: match.FromTon,
          toTon: match.ToTon
        })
      } else {
        setCalculatedAmount(null)
        setError(`تعرفه‌ای برای پارامترهای انتخاب شده یافت نشد:\n${operationType} ${licenseTypeName} - تناژ ${cap} تن`)
      }
    } catch (e) {
      setError('خطا در محاسبه: ' + e.message)
    }
  }

  // Get all tariffs for display
  const displayTariffs = tariffs.filter(t => {
    if (licenseType === 'Activity') return (t.LicenseType || '').includes('فعالیت')
    if (licenseType === 'Employment') return (t.LicenseType || '').includes('اشتغال')
    if (licenseType === 'Exploitation') return (t.LicenseType || '').includes('بهره')
    return true
  })

  return (
    <div className="tariff-test-container">
      <h1>🧪 تست محاسبه تعرفه</h1>
      
      <div className="test-section">
        <h2>پارامترهای ورودی</h2>
        <div className="form-grid">
          <div className="form-group">
            <label>نوع پروانه</label>
            <select value={licenseType} onChange={e => setLicenseType(e.target.value)}>
              <option value="Activity">پروانه فعالیت</option>
              <option value="Employment">پروانه اشتغال</option>
              <option value="Exploitation">پروانه بهره‌برداری</option>
            </select>
          </div>
          
          <div className="form-group">
            <label>نوع عملیات</label>
            <select value={operationType} onChange={e => setOperationType(e.target.value)}>
              {operationTypes.map(op => (
                <option key={op.Id} value={op.Name}>{op.Name}</option>
              ))}
            </select>
          </div>
          
          <div className="form-group">
            <label>تناژ (تن)</label>
            <input
              type="number"
              step="0.1"
              value={capacityTon}
              onChange={e => setCapacityTon(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="result-section">
        <h2>نتیجه محاسبه</h2>
        {loading && <div className="loading">در حال محاسبه...</div>}
        {error && <div className="error">{error}</div>}
        
        {calculatedAmount && (
          <div className="calculation-result">
            <div className="result-card success">
              <h3>✅ تعرفه یافت شد:</h3>
              <div className="result-row">
                <span className="label">عنوان تعرفه:</span>
                <span className="value">{calculatedAmount.title}</span>
              </div>
              <div className="result-row">
                <span className="label">مبلغ پایه:</span>
                <span className="value">{calculatedAmount.baseAmount.toLocaleString()} ریال</span>
              </div>
              <div className="result-row">
                <span className="label">ارزش افزوده (10%):</span>
                <span className="value">{calculatedAmount.vat.toLocaleString()} ریال</span>
              </div>
              <div className="result-row total">
                <span className="label">مبلغ کل:</span>
                <span className="value">{calculatedAmount.total.toLocaleString()} ریال</span>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="tariffs-list-section">
        <h2>📋 لیست تعرفه‌های موجود</h2>
        <p>نوع پروانه: {licenseType === 'Activity' ? 'پروانه فعالیت' : licenseType === 'Employment' ? 'پروانه اشتغال' : 'پروانه بهره‌برداری'}</p>
        <table className="tariffs-table">
          <thead>
            <tr>
              <th>Id</th>
              <th>نوع پروانه</th>
              <th>نوع سند</th>
              <th>از تناژ</th>
              <th>تا تناژ</th>
              <th>مبلغ (ریال)</th>
              <th>وضعیت</th>
            </tr>
          </thead>
          <tbody>
            {displayTariffs.map(t => {
              const cap = parseFloat(capacityTon) || 0
              const from = parseFloat(t.FromTon ?? t.fromTon ?? 0)
              const to = parseFloat(t.ToTon ?? t.toTon ?? 999999)
              const isMatch = cap >= from && cap <= to
              
              return (
                <tr key={t.Id} className={isMatch ? 'matched' : ''}>
                  <td>{t.Id}</td>
                  <td>{t.LicenseType}</td>
                  <td>{t.DocTypeName}</td>
                  <td>{t.FromTon ?? '-'}</td>
                  <td>{t.ToTon ?? '-'}</td>
                  <td>{(t.Amount ?? 0).toLocaleString()}</td>
                  <td>{isMatch ? '✅ انتخاب شده' : ''}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="test-section">
        <h2>🔍 تست با کد رهگیری</h2>
        <div className="form-group">
          <label>کد رهگیری</label>
          <div className="tracking-input-group">
            <input
              type="text"
              placeholder="مثال: 3318-30025"
              onChange={e => setNationalCode(e.target.value)}
            />
            <button
              onClick={async () => {
                if (!nationalCode.trim()) {
                  setError('لطفاً کد رهگیری را وارد کنید')
                  return
                }
                setLoading(true)
                setError('')
                try {
                  const res = await api.get(`/requests/by-tracking/${nationalCode.trim()}`)
                  const req = res.data
                  console.log('📋 Request found:', req)
                  
                  // Update form with request data
                  setLicenseType(req.LicenseTypeName?.includes('اشتغال') ? 'Employment' :
                    req.LicenseTypeName?.includes('بهره') ? 'Exploitation' : 'Activity')
                  setOperationType(req.OperationTypeName || 'صدور')
                  setCapacityTon(req.TonnageFromTon || req.TonnageToTon || '4')
                  
                  // Reload tariffs to find match
                  const tariffsRes = await api.get('/api/tariffs')
                  setTariffs(tariffsRes.data || [])
                  
                  setTimeout(() => {
                    calculateAmount()
                  }, 100)
                } catch (e) {
                  setError('خطا در یافتن درخواست: ' + (e.response?.data?.message || e.message))
                } finally {
                  setLoading(false)
                }
              }}
              className="btn-primary"
            >
              جست و جو
            </button>
          </div>
        </div>
      </div>

      <div className="test-section">
        <h2>📊 اطلاعات فنی برای دیباگ</h2>
        <pre className="debug-info">
          {JSON.stringify({
            licenseType,
            operationType,
            capacityTon: parseFloat(capacityTon) || 0,
            tariffsCount: tariffs.length,
            matchedTariff: selectedTariff,
            calculatedAmount
          }, null, 2)}
        </pre>
      </div>
    </div>
  )
}