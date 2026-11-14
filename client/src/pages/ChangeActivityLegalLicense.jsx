import React, { useEffect, useState } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { api } from '../lib/api.js'

export default function ChangeActivityLegalLicense({ user }) {
  const navigate = useNavigate()
  const { requestId } = useParams()
  const location = useLocation()
  const changeRequestId = requestId
  const reqData = location.state?.req || location.state?.RequestData
  
  const [doneMessage, setDoneMessage] = useState('')
  const [isChangeMode, setIsChangeMode] = useState(!!changeRequestId)
  const [loadingChangeData, setLoadingChangeData] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  // Company information for legal entities
  const [companyInfo, setCompanyInfo] = useState({
    tonnageRateId: '', companyName: '', nationalId: '', workshopName: '', businessLicenseNo: '',
    economicCode: '', mainActivity: '', activityFieldId: '', companyTypeId: '',
    registrationDate: '', businessLicenseValidFrom: '', businessLicenseValidTo: '',
    parentCompanyId: '', registrationCityId: '', addresses: [], contacts: []
  })
  
  // Company representative
  const [companyRepresentative, setCompanyRepresentative] = useState({
    nationalCode: '', birthDate: '', powerOfAttorneyNo: ''
  })
  
  // CEO personal info
  const [personal, setPersonal] = useState({
    firstName: '', lastName: '', fatherName: '',
    nationalCode: '',
    idSerial: '', birthProvinceId: '', birthCityId: '', birthDate: '',
    gender: 'مرد', maritalStatus: 'متاهل',
  })
  
  // Change reason and description
  const [changeReason, setChangeReason] = useState('')
  const [changeDescription, setChangeDescription] = useState('')
  
  // Payment states
  const [finalTrackingNo, setFinalTrackingNo] = useState('')
  const [secondsLeft, setSecondsLeft] = useState(5)
  const [editModeTrackingNo, setEditModeTrackingNo] = useState('')
  
  // Lookups
  const [lkCompanyTypes, setLkCompanyTypes] = useState([])
  const [lkTonnageRates, setLkTonnageRates] = useState([])
  const [lkActivityFields, setLkActivityFields] = useState([])
  const [provinces, setProvinces] = useState([])
  const [citiesByProv, setCitiesByProv] = useState({})
  const [allCities, setAllCities] = useState([])

  // Load request data when in change mode
  useEffect(() => {
    if (changeRequestId) {
      console.log('📝 Change Activity Legal License mode detected, loading request:', changeRequestId)
      setIsChangeMode(true)
      setLoadingChangeData(true)
      loadRequestForChange(changeRequestId)
    }
  }, [changeRequestId])

  // Countdown timer for auto-redirect to payment page
  useEffect(() => {
    if (finalTrackingNo && secondsLeft > 0) {
      const timer = setTimeout(() => {
        setSecondsLeft(prev => prev - 1)
      }, 1000)
      return () => clearTimeout(timer)
    } else if (finalTrackingNo && secondsLeft === 0) {
      navigate(`/payment?trackingNo=${finalTrackingNo}`)
    }
  }, [finalTrackingNo, secondsLeft, navigate])

  // Load lookups and provinces
  useEffect(() => {
    const loadLookup = async (key) => {
      try {
        const { data } = await api.get('/api/lookups/values', { params: { categoryKey: key, active: true } })
        return data || []
      } catch (err) {
        console.error(`Failed to load lookup ${key}:`, err)
        return []
      }
    }

    const loadProvinces = async () => {
      try {
        const { data } = await api.get('/api/provinces')
        setProvinces(data || [])
        
        const allCitiesArray = []
        for (const prov of (data || [])) {
          try {
            const { data: cities } = await api.get(`/api/provinces/${prov.Id || prov.ID}/cities`)
            allCitiesArray.push(...(cities || []))
          } catch (e) {
            console.error(`Failed to load cities for province ${prov.Id || prov.ID}`, e)
          }
        }
        setAllCities(allCitiesArray)
      } catch (err) {
        console.error('Failed to load provinces:', err)
      }
    }

    // Load all data in parallel
    ;(async () => {
      const [ct, tr, af] = await Promise.all([
        loadLookup('CompanyType'),
        loadLookup('TonnageRate'),
        loadLookup('ActivityCategory')
      ])
      
      setLkCompanyTypes(ct || [])
      setLkTonnageRates(tr || [])
      setLkActivityFields(af || [])
    })()

    loadProvinces()
  }, [])

  // Load cities for a province
  const loadCities = async (provId) => {
    if (!provId) return []
    if (citiesByProv[provId]) return citiesByProv[provId]
    try {
      const { data } = await api.get(`/api/provinces/${provId}/cities`)
      setCitiesByProv(prev => ({ ...prev, [provId]: data || [] }))
      return data || []
    } catch {
      return []
    }
  }

  // Load existing request data for change
  const loadRequestForChange = async (reqId) => {
    try {
      console.log('📝 Change Activity Legal License - Loading request for change:', reqId)
      const { data } = await api.get(`/api/workflow/requests/${reqId}`)
      console.log('📋 Request info:', data.request)
      console.log('🏢 Company:', data.company)
      
      setEditModeTrackingNo(data.request?.trackingNo || data.TrackingNo || '')
      
      // Load company info for legal entities
      if (data.company) {
        setCompanyInfo({
          tonnageRateId: data.company.TonnageRateId?.toString() || '',
          companyName: data.company.CompanyName || '',
          nationalId: data.company.NationalId || '',
          workshopName: data.company.WorkshopName || '',
          businessLicenseNo: data.company.BusinessLicenseNo || '',
          economicCode: data.company.EconomicCode || '',
          mainActivity: data.company.MainActivity || '',
          activityFieldId: data.company.ActivityFieldId?.toString() || '',
          companyTypeId: data.company.CompanyTypeId?.toString() || '',
          registrationDate: data.company.RegistrationDate || '',
          businessLicenseValidFrom: data.company.BusinessLicenseValidFrom || '',
          businessLicenseValidTo: data.company.BusinessLicenseValidTo || '',
          parentCompanyId: data.company.ParentCompanyId?.toString() || '',
          registrationCityId: data.company.RegistrationCityId?.toString() || '',
          addresses: data.companyAddresses?.map(addr => ({
            provinceId: addr.ProvinceId,
            cityId: addr.CityId,
            mainStreet: addr.MainStreet || '',
            sideStreet: addr.SideStreet || '',
            district: addr.District || '',
            postalCode: addr.PostalCode || '',
            plaque: addr.Plaque || '',
            unit: addr.Unit || '',
            address: addr.Address || ''
          })) || [],
          contacts: data.companyContacts?.map(contact => ({
            type: contact.Type,
            value: contact.Value,
            isActive: contact.IsActive
          })) || []
        })
        
        // Load company representative info
        if (data.companyRepresentative) {
          setCompanyRepresentative({
            nationalCode: data.companyRepresentative.RepresentativeNationalCode || '',
            birthDate: data.companyRepresentative.BirthDate || '',
            powerOfAttorneyNo: data.companyRepresentative.PowerOfAttorneyNo || ''
          })
        }
      }
      
      // Load personal info (CEO)
      if (data.person) {
        setPersonal({
          firstName: data.person.FirstName || '',
          lastName: data.person.LastName || '',
          fatherName: data.person.FatherName || '',
          nationalCode: data.person.NationalCode || '',
          idSerial: data.person.IdSerial || '',
          birthProvinceId: data.person.BirthProvinceId?.toString() || '',
          birthCityId: data.person.BirthCityId?.toString() || '',
          birthDate: data.person.BirthDateJalali || '',
          gender: data.person.Gender || '',
          maritalStatus: data.person.MaritalStatus || '',
        })
      }
      
      console.log('✅ Request data loaded successfully for change activity legal license')
      setLoadingChangeData(false)
    } catch (error) {
      console.error('❌ Error loading request for change:', error)
      alert('خطا در بارگذاری اطلاعات پرونده')
      setLoadingChangeData(false)
    }
  }

  // Submit change request handler
  const handleChangeSubmit = async () => {
    if (!changeReason) {
      alert('لطفاً دلیل تغییر را وارد کنید')
      return
    }
    if (finalTrackingNo || isSubmitting) {
      return
    }
    
    setIsSubmitting(true)
    try {
      const trackingNo = changeRequestId || reqData?.TrackingNo || reqData?.request?.TrackingNo
      
      const { data } = await api.post('/api/issue/legal/change', {
        trackingNo: trackingNo,
        changeReason: changeReason,
        changeDescription: changeDescription,
        companyInfo: companyInfo,
        personal: personal
      })
      setFinalTrackingNo(data.trackingNo)
      setDoneMessage('درخواست تغییر پروانه فعالیت حقوقی با موفقیت ثبت شد')
      console.log('✅ Change activity legal request created:', data)
    } catch (error) {
      console.error('Error submitting change request:', error)
      alert(error?.response?.data?.message || 'خطا در ثبت درخواست تغییر. لطفاً مجدداً تلاش کنید.')
      setIsSubmitting(false)
    }
  }

  // Helper functions
  const getProvinceName = (provId) => {
    const p = provinces.find(pp => String(pp.Id ?? pp.ID ?? pp.ProvinceId ?? pp.provinceId) == String(provId))
    return p?.Name || p?.name || p?.ProvinceName || p?.provincename || ''
  }

  const getCityName = (provId, cityId) => {
    const list = citiesByProv[provId] || []
    const c = list.find(cc => String(cc.Id ?? cc.ID ?? cc.CityId ?? cc.cityId) == String(cityId))
    return c?.Name || c?.name || c?.CityName || c?.cityname || ''
  }

  // Show loading state
  if (loadingChangeData) {
    return (
      <div className="card" dir="rtl">
        <h2>در حال بارگذاری اطلاعات...</h2>
        <div style={{ padding: '40px', textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>⏳</div>
          <div style={{ fontSize: '16px', color: '#6b7280' }}>
            لطفاً صبر کنید، اطلاعات درخواست در حال بارگذاری است...
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="card" dir="rtl">
      <h2>📝 درخواست تغییر پروانه فعالیت حقوقی</h2>
      {isChangeMode && (
        <div style={{ 
          padding: '12px', 
          background: '#dbeafe', 
          border: '1px solid #3b82f6', 
          borderRadius: '8px', 
          marginBottom: '16px',
          fontSize: '14px'
        }}>
          <strong>📝 اطلاعات پرونده:</strong> شماره پیگیری: {editModeTrackingNo}
        </div>
      )}

      <div style={{ padding: '20px', background: '#fff', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
        {/* Company Info Section */}
        <div className="box" style={{ marginBottom: '20px' }}>
          <div className="box-title">مشخصات شرکت</div>
          <div style={{ padding: '20px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: '16px' }}>
              <label style={{ gridColumn: 'span 1', fontWeight: '600' }}>نام شرکت <span style={{ color: '#ef4444' }}>*</span></label>
              <input 
                type="text" 
                value={companyInfo.companyName} 
                onChange={(e) => setCompanyInfo({ ...companyInfo, companyName: e.target.value })} 
                placeholder="نام شرکت"
                style={{ gridColumn: 'span 3' }}
              />
              
              <label style={{ gridColumn: 'span 1', fontWeight: '600' }}>شناسه ملی <span style={{ color: '#ef4444' }}>*</span></label>
              <input 
                type="text" 
                value={companyInfo.nationalId} 
                onChange={(e) => setCompanyInfo({ ...companyInfo, nationalId: e.target.value })} 
                placeholder="شناسه ملی"
                maxLength={11}
                style={{ gridColumn: 'span 3' }}
              />
              
              <label style={{ gridColumn: 'span 1', fontWeight: '600' }}>نام کارگاه</label>
              <input 
                type="text" 
                value={companyInfo.workshopName} 
                onChange={(e) => setCompanyInfo({ ...companyInfo, workshopName: e.target.value })} 
                placeholder="نام کارگاه"
                style={{ gridColumn: 'span 3' }}
              />
              
              <label style={{ gridColumn: 'span 1', fontWeight: '600' }}>نرخ تناژ</label>
              <select 
                value={companyInfo.tonnageRateId || ''} 
                onChange={(e) => setCompanyInfo({ ...companyInfo, tonnageRateId: e.target.value })}
                style={{ gridColumn: 'span 3' }}
              >
                <option value="">انتخاب کنید</option>
                {lkTonnageRates.map(tr => (
                  <option key={tr.Id} value={tr.Id}>{tr.Name}</option>
                ))}
              </select>
              
              <label style={{ gridColumn: 'span 1', fontWeight: '600' }}>نوع شرکت</label>
              <select 
                value={companyInfo.companyTypeId || ''} 
                onChange={(e) => setCompanyInfo({ ...companyInfo, companyTypeId: e.target.value })}
                style={{ gridColumn: 'span 3' }}
              >
                <option value="">انتخاب کنید</option>
                {lkCompanyTypes.map(ct => (
                  <option key={ct.Id} value={ct.Id}>{ct.Name}</option>
                ))}
              </select>
              
              <label style={{ gridColumn: 'span 1', fontWeight: '600' }}>شماره ثبت</label>
              <input 
                type="text" 
                value={companyInfo.businessLicenseNo} 
                onChange={(e) => setCompanyInfo({ ...companyInfo, businessLicenseNo: e.target.value })} 
                placeholder="شماره ثبت"
                style={{ gridColumn: 'span 3' }}
              />
              
              <label style={{ gridColumn: 'span 1', fontWeight: '600' }}>تاریخ ثبت</label>
              <input 
                type="text" 
                value={companyInfo.registrationDate} 
                onChange={(e) => setCompanyInfo({ ...companyInfo, registrationDate: e.target.value })} 
                placeholder="تاریخ ثبت"
                style={{ gridColumn: 'span 3' }}
              />
              
              <label style={{ gridColumn: 'span 1', fontWeight: '600' }}>کد اقتصادی</label>
              <input 
                type="text" 
                value={companyInfo.economicCode} 
                onChange={(e) => setCompanyInfo({ ...companyInfo, economicCode: e.target.value })} 
                placeholder="کد اقتصادی"
                maxLength={11}
                style={{ gridColumn: 'span 3' }}
              />
              
              <label style={{ gridColumn: 'span 1', fontWeight: '600' }}>فعالیت اصلی</label>
              <input 
                type="text" 
                value={companyInfo.mainActivity} 
                onChange={(e) => setCompanyInfo({ ...companyInfo, mainActivity: e.target.value })} 
                placeholder="فعالیت اصلی"
                style={{ gridColumn: 'span 3' }}
              />
              
              <label style={{ gridColumn: 'span 1', fontWeight: '600' }}>زمین فعالیت</label>
              <select 
                value={companyInfo.activityFieldId || ''} 
                onChange={(e) => setCompanyInfo({ ...companyInfo, activityFieldId: e.target.value })}
                style={{ gridColumn: 'span 3' }}
              >
                <option value="">انتخاب کنید</option>
                {lkActivityFields.map(af => (
                  <option key={af.Id} value={af.Id}>{af.Name}</option>
                ))}
              </select>
              
              <label style={{ gridColumn: 'span 1', fontWeight: '600' }}>تاریخ اعتبار مجوز</label>
              <input 
                type="text" 
                value={companyInfo.businessLicenseValidFrom} 
                onChange={(e) => setCompanyInfo({ ...companyInfo, businessLicenseValidFrom: e.target.value })} 
                placeholder="تاریخ اعتبار"
                style={{ gridColumn: 'span 3' }}
              />
              
              <label style={{ gridColumn: 'span 1', fontWeight: '600' }}>تاریخ انقضا مجوز</label>
              <input 
                type="text" 
                value={companyInfo.businessLicenseValidTo} 
                onChange={(e) => setCompanyInfo({ ...companyInfo, businessLicenseValidTo: e.target.value })} 
                placeholder="تاریخ انقضا"
                style={{ gridColumn: 'span 3' }}
              />
            </div>
          </div>
        </div>

        {/* CEO Info Section */}
        <div className="box" style={{ marginBottom: '20px' }}>
          <div className="box-title">مشخصات مدیرعامل</div>
          <div style={{ padding: '20px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: '16px' }}>
              <label style={{ gridColumn: 'span 1', fontWeight: '600' }}>نام <span style={{ color: '#ef4444' }}>*</span></label>
              <input 
                type="text" 
                value={personal.firstName} 
                onChange={(e) => setPersonal({ ...personal, firstName: e.target.value })} 
                placeholder="نام"
                style={{ gridColumn: 'span 3' }}
              />
              
              <label style={{ gridColumn: 'span 1', fontWeight: '600' }}>نام خانوادگی <span style={{ color: '#ef4444' }}>*</span></label>
              <input 
                type="text" 
                value={personal.lastName} 
                onChange={(e) => setPersonal({ ...personal, lastName: e.target.value })} 
                placeholder="نام خانوادگی"
                style={{ gridColumn: 'span 3' }}
              />
              
              <label style={{ gridColumn: 'span 1', fontWeight: '600' }}>کد ملی</label>
              <input 
                type="text" 
                value={personal.nationalCode} 
                onChange={(e) => setPersonal({ ...personal, nationalCode: e.target.value.replace(/[^0-9]/g, '') })} 
                placeholder="کد ملی"
                maxLength={10}
                style={{ gridColumn: 'span 3' }}
              />
              
              <label style={{ gridColumn: 'span 1', fontWeight: '600' }}>نام پدر</label>
              <input 
                type="text" 
                value={personal.fatherName} 
                onChange={(e) => setPersonal({ ...personal, fatherName: e.target.value })} 
                placeholder="نام پدر"
                style={{ gridColumn: 'span 3' }}
              />
            </div>
          </div>
        </div>

        {/* Change Reason Section */}
        <div className="box" style={{ marginBottom: '20px' }}>
          <div className="box-title">دلایل تغییر</div>
          <div style={{ padding: '20px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: '16px' }}>
              <label style={{ gridColumn: 'span 2', fontWeight: '600' }}>دلیل تغییر <span style={{ color: '#ef4444' }}>*</span></label>
              <textarea 
                rows={4} 
                value={changeReason} 
                onChange={(e) => setChangeReason(e.target.value)} 
                placeholder="لطفاً دلیل درخواست تغییر را وارد کنید" 
                style={{ gridColumn: 'span 10', resize: 'vertical' }} 
                dir="rtl"
              />
              
              <label style={{ gridColumn: 'span 2', fontWeight: '600' }}>توضیحات اضافی</label>
              <textarea 
                rows={4} 
                value={changeDescription} 
                onChange={(e) => setChangeDescription(e.target.value)} 
                placeholder="توضیحات اختیاری" 
                style={{ gridColumn: 'span 10', resize: 'vertical' }} 
                dir="rtl"
              />
            </div>
          </div>
        </div>

        {/* Submit Section */}
        <div className="box">
          <div className="box-title">تکمیل درخواست تغییر</div>
          <div style={{ padding: '20px', textAlign: 'center' }}>
            <button 
              onClick={handleChangeSubmit}
              disabled={!changeReason || finalTrackingNo || isSubmitting}
              className="btn-primary"
              style={{ 
                padding: '12px 40px', 
                fontSize: '16px',
                background: finalTrackingNo ? '#10b981' : isSubmitting ? '#94a3b8' : '#3b82f6',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                cursor: finalTrackingNo || isSubmitting ? 'not-allowed' : 'pointer',
                fontWeight: '600'
              }}
            >
              {finalTrackingNo ? 'ثبت شده ✓' : isSubmitting ? 'در حال ثبت...' : 'ثبت درخواست تغییر'}
            </button>
            
            {finalTrackingNo && (
              <div style={{ 
                marginTop: '20px', 
                padding: '16px', 
                background: '#d1fae5', 
                borderRadius: '8px', 
                textAlign: 'center' 
              }}>
                <p style={{ margin: 0, color: '#065f46', fontWeight: 600 }}>{doneMessage}</p>
                <p style={{ margin: '8px 0 0 0', color: '#065f46' }}>شماره پیگیری: {finalTrackingNo}</p>
                <p style={{ margin: '8px 0 0 0', color: '#065f46' }}>
                  {secondsLeft > 0 ? `انتقال خودکار به صفحه پرداخت در ${secondsLeft} ثانیه...` : 'در حال انتقال...'}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      <style>{`
        .box {
          margin: 25px 0;
          border: 2px solid #e2e8f0;
          border-radius: 10px;
          background: #ffffff;
          overflow: hidden;
        }
        .box-title {
          background: #78909c;
          color: #fff;
          padding: 12px 16px;
          font-weight: 700;
          font-size: 16px;
        }
        .btn-primary {
          background: #3b82f6;
          border: 1px solid #60a5fa;
          color: #fff;
          padding: 8px 16px;
          border-radius: 8px;
          cursor: pointer;
          font-weight: 600;
        }
        .btn-primary:hover { background: #2563eb; }
        .btn-primary:disabled {
          background: #94a3b8;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  )
}