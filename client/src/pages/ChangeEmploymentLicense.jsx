import React, { useEffect, useState } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { api } from '../lib/api.js'

/**
 * ChangeEmploymentLicense - Page for requesting changes to employment license
 * Route: /licenses/employment/change/:requestId
 */
export default function ChangeEmploymentLicense({ user }) {
  const navigate = useNavigate()
  const { requestId } = useParams()
  const location = useLocation()
  
  const changeRequestId = requestId
  const reqData = location.state?.req || location.state?.RequestData
  
  const [loadingChangeData, setLoadingChangeData] = useState(false)
  const [isChangeMode, setIsChangeMode] = useState(!!changeRequestId)
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  // Personal state
  const [personal, setPersonal] = useState({
    firstName: '', lastName: '', fatherName: '',
    nationalCode: (user?.Role === 'کارگزار (بهره بردار)' || user?.role === 'کارگزار (بهره بردار)') ? '' : (user?.nationalCode || ''),
    idSerial: '', birthProvinceId: '', birthCityId: '', birthDate: '',
    gender: 'مرد', maritalStatus: 'متاهل',
    residences: [], contacts: []
  })
  
  // Change reason and description
  const [changeReason, setChangeReason] = useState('')
  const [changeDescription, setChangeDescription] = useState('')
  
  // Payment states
  const [finalTrackingNo, setFinalTrackingNo] = useState('')
  const [secondsLeft, setSecondsLeft] = useState(5)

  // Load request data when in change mode
  useEffect(() => {
    if (changeRequestId) {
      console.log('📝 Change mode detected for employment, loading request:', changeRequestId)
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

  // Load existing request data for change
  const loadRequestForChange = async (reqId) => {
    try {
      console.log('📝 Change mode - Loading employment request for change:', reqId)
      const { data } = await api.get(`/api/workflow/requests/${reqId}`)
      
      // Load personal info
      if (data.person) {
        const personalData = {
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
          residences: data.residences?.map(res => ({
            provinceId: res.ProvinceId,
            cityId: res.CityId,
            address: res.Address,
            postalCode: res.PostalCode,
            plaque: res.Plaque,
            unit: res.Unit,
            phone: res.Phone,
            isActive: res.IsActive
          })) || [],
          contacts: data.contacts?.map(contact => ({
            type: contact.Type,
            value: contact.Value,
            isActive: contact.IsActive
          })) || []
        }
        setPersonal(personalData)
      }
      
      console.log('✅ Employment request data loaded successfully for change')
      setLoadingChangeData(false)
    } catch (error) {
      console.error('❌ Error loading employment request for change:', error)
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
    if (finalTrackingNo) {
      return
    }
    
    if (isSubmitting) {
      return
    }
    
    setIsSubmitting(true)
    try {
      const trackingNo = changeRequestId || reqData?.TrackingNo || reqData?.request?.TrackingNo
      
      const { data } = await api.post('/api/issue/employment/change', {
        trackingNo: trackingNo,
        changeReason: changeReason,
        changeDescription: changeDescription
      })
      setFinalTrackingNo(data.trackingNo)
      setDoneMessage('درخواست تغییر با موفقیت ثبت شد')
      console.log('✅ Employment change request created:', data)
    } catch (error) {
      console.error('Error submitting employment change request:', error)
      alert(error?.response?.data?.message || 'خطا در ثبت درخواست تغییر. لطفاً مجدداً تلاش کنید.')
      setIsSubmitting(false)
    }
  }

  // Show loading state while loading change data
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
      <h2>📝 درخواست تغییر پروانه اشتغال</h2>
      {isChangeMode && (
        <div style={{ 
          padding: '12px', 
          background: '#fef3c7', 
          border: '1px solid #fbbf24', 
          borderRadius: '8px', 
          marginBottom: '16px',
          fontSize: '14px'
        }}>
          <strong>⚠️ توجه:</strong> شما در حال درخواست تغییر اطلاعات پروانه اشتغال هستید. تغییرات شما پس از تأیید کارشناسان اعمال خواهد شد.
        </div>
      )}

      <div style={{ padding: '20px', background: '#fff', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
        {/* Personal Info Section */}
        <div className="box" style={{ marginBottom: '20px' }}>
          <div className="box-title">مشخصات فردی</div>
          <div style={{ padding: '20px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: '16px' }}>
              <label style={{ gridColumn: 'span 1', fontWeight: '600' }}>نام <span style={{ color: '#ef4444' }}>*</span></label>
              <input 
                type="text" 
                value={personal.firstName} 
                onChange={(e) => setPersonal({ ...personal, firstName: e.target.value })} 
                placeholder="نام" 
                disabled={isChangeMode}
                style={{ gridColumn: 'span 3' }}
              />
              
              <label style={{ gridColumn: 'span 1', fontWeight: '600' }}>نام خانوادگی <span style={{ color: '#ef4444' }}>*</span></label>
              <input 
                type="text" 
                value={personal.lastName} 
                onChange={(e) => setPersonal({ ...personal, lastName: e.target.value })} 
                placeholder="نام خانوادگی" 
                disabled={isChangeMode}
                style={{ gridColumn: 'span 3' }}
              />
              
              <label style={{ gridColumn: 'span 1', fontWeight: '600' }}>کد ملی</label>
              <input 
                type="text" 
                value={personal.nationalCode} 
                onChange={(e) => setPersonal({ ...personal, nationalCode: e.target.value.replace(/[^0-9]/g, '') })} 
                placeholder="کد ملی" 
                maxLength={10}
                disabled={isChangeMode}
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
                <p style={{ margin: 0, color: '#065f46', fontWeight: 600 }}>درخواست تغییر با موفقیت ثبت شد</p>
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