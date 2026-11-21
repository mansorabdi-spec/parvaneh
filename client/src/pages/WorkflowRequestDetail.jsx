import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api, normalizedApiBaseUrl } from '../lib/api.js'
import { isAdminRoleName, viewerIsSuperAdminOnly } from '../lib/roleVisibility.js'

// Helper to convert English numbers to Persian
const toFarsiNumber = (num) => {
  if (num === null || num === undefined) return ''
  return String(num).replace(/[0-9]/g, d => '۰۱۲۳۴۵۶۷۸۹'[d])
}

export default function WorkflowRequestDetail() {
  const { requestId } = useParams()
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [steps, setSteps] = useState([])
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Helper to format Iran plate visually using a borderless table
  const formatPlate = (v) => {
    if (!v) return '-'
    const hasParts = v.PlateRegion2 && v.PlateLetter && v.PlateThreeDigits && v.PlateSerial2
    if (hasParts) {
      let letter = String(v.PlateLetter).trim()
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
              <td style={{ padding: '0 2px', textAlign: 'center' }}>{toFarsiNumber(v.PlateSerial2)}</td>
              <td style={{ padding: '0 2px', textAlign: 'center' }}> </td>
              <td style={{ padding: '0 2px', textAlign: 'center' }}>{letter}</td>
              <td style={{ padding: '0 2px', textAlign: 'center' }}> </td>
              <td style={{ padding: '0 2px', textAlign: 'center' }}>{toFarsiNumber(v.PlateThreeDigits)}</td>
              <td style={{ padding: '0 2px', textAlign: 'center' }}> </td>
              <td style={{ padding: '0 2px', textAlign: 'center' }}>ایران</td>
               
              
              <td style={{ padding: '0 2px', textAlign: 'center' }}> </td>
              <td style={{ padding: '0 2px', textAlign: 'center' }}>{toFarsiNumber(v.PlateRegion2)}</td>
            </tr>
          </tbody>
        </table>
      )
    }
    return v.PlateNumber || '-'
  }
  const [activeTab, setActiveTab] = useState('info')
  const [imageModal, setImageModal] = useState(null)
  const [decisionModal, setDecisionModal] = useState(null)
  const [decisionNotes, setDecisionNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [fixDeficiencyModal, setFixDeficiencyModal] = useState(null)
  const [fixDeficiencyNotes, setFixDeficiencyNotes] = useState('')
  const [currentUser, setCurrentUser] = useState(null)
  const [labelImage, setLabelImage] = useState(null)
  const [labelImagePreview, setLabelImagePreview] = useState(null)
  const [uploadingLabel, setUploadingLabel] = useState(false)
  const [vehicleLabel, setVehicleLabel] = useState(null)
  const [loadingLabel, setLoadingLabel] = useState(false)
  const [labelImageUrl, setLabelImageUrl] = useState(null)

  useEffect(() => {
    loadCurrentUser()
    loadDetail()
  }, [requestId])

  useEffect(() => {
    // Load vehicle label if data is available
    if (data?.vehicle?.VehicleID) {
      loadVehicleLabel(data.vehicle.VehicleID)
    }
  }, [data?.vehicle?.VehicleID])

  useEffect(() => {
    // Load vehicle label image when label metadata is available
    if (vehicleLabel && data?.vehicle?.VehicleID) {
      loadVehicleLabelImage(data.vehicle.VehicleID)
    }
  }, [vehicleLabel, data?.vehicle?.VehicleID])

  const loadCurrentUser = async () => {
    try {
      const { data } = await api.get('/api/auth/me')
      setCurrentUser(data.user)
    } catch (e) {
      console.error('Error loading current user:', e)
    }
  }

  const handleDeletePayment = async (paymentId) => {
    if (!window.confirm('آیا از حذف این پرداخت اطمینان دارید؟\n\nتوجه: این عملیات قابل بازگشت نیست و اطلاعات فیش بانکی حذف خواهد شد.')) {
      return
    }

    try {
      await api.delete(`/api/payments/offline/${paymentId}`)
      alert('پرداخت با موفقیت حذف شد')
      // Reload the page to refresh payment data
      loadDetail()
    } catch (e) {
      alert(e?.response?.data?.message || 'خطا در حذف پرداخت')
    }
  }

  const loadVehicleLabel = async (vehicleId) => {
    try {
      setLoadingLabel(true)
      const { data } = await api.get(`/api/vehicle-labels/${vehicleId}`)
      if (data && data.length > 0) {
        setVehicleLabel(data[0]) // Get the most recent label
        console.log('✅ Vehicle label loaded:', data[0])
      }
    } catch (e) {
      console.log('ℹ️ No vehicle label found or error loading:', e?.response?.status)
      // Not an error - label might not exist yet
    } finally {
      setLoadingLabel(false)
    }
  }

  const loadVehicleLabelImage = async (vehicleId) => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`/api/vehicle-labels/${vehicleId}/image`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      
      if (response.ok) {
        const blob = await response.blob()
        const imageUrl = URL.createObjectURL(blob)
        setLabelImageUrl(imageUrl)
        console.log('✅ Vehicle label image loaded')
      } else {
        console.log('ℹ️ Vehicle label image not found:', response.status)
      }
    } catch (e) {
      console.error('❌ Error loading vehicle label image:', e)
    }
  }

  const loadDetail = async () => {
    try {
      setLoading(true)
      const [detailRes, stepsRes, historyRes] = await Promise.all([
        api.get(`/api/workflow/requests/${requestId}`),
        api.get(`/api/workflow/requests/${requestId}/steps`),
        api.get(`/api/workflow/requests/${requestId}/history`)
      ])
      console.log('=== Workflow Request Detail Data ===')
      console.log('Full response:', detailRes.data)
      console.log('Payments:', detailRes.data.payments)
      console.log('Person:', detailRes.data.person)
      console.log('====================================')
      setData(detailRes.data)
      setSteps(stepsRes.data)
      setHistory(historyRes.data)
      setError('')
    } catch (e) {
      setError(e?.response?.data?.message || 'خطا در بارگذاری جزئیات')
    } finally {
      setLoading(false)
    }
  }

  const handleLabelImageChange = (e) => {
    const file = e.target.files[0]
    if (!file) return

    // Check file size (max 4MB)
    if (file.size > 4 * 1024 * 1024) {
      alert('حجم فایل نباید بیشتر از 4 مگابایت باشد')
      return
    }

    // Check if it's an image
    if (!file.type.startsWith('image/')) {
      alert('فقط فایل‌های تصویری مجاز هستند')
      return
    }

    setLabelImage(file)
    
    // Create preview
    const reader = new FileReader()
    reader.onloadend = () => {
      setLabelImagePreview(reader.result)
    }
    reader.readAsDataURL(file)
  }

  const handleLabelApproval = async (stepId) => {
    // For label specialist, must upload image before approval
    if (currentUser?.Role === 'کارشناس الصاق برچسب' && !labelImage) {
      alert('لطفاً ابتدا تصویر برچسب را آپلود کنید')
      return
    }

    try {
      setUploadingLabel(true)

      // Upload label image first
      if (labelImage && data?.vehicle?.VehicleID) {
        const formData = new FormData()
        formData.append('labelImage', labelImage)
        formData.append('vehicleId', data.vehicle.VehicleID)
        formData.append('notes', decisionNotes.trim() || '')

        await api.post('/api/vehicle-labels', formData, {
          headers: {
            'Content-Type': 'multipart/form-data'
          }
        })
      }

      // Then approve the workflow step
      await api.post(`/api/workflow/steps/${stepId}/decision`, {
        decision: 'Approved',
        notes: decisionNotes.trim() || null
      })

      setDecisionModal(null)
      setDecisionNotes('')
      setLabelImage(null)
      setLabelImagePreview(null)
      alert('برچسب با موفقیت الصاق و پرونده تایید شد')
      // Navigate to inbox after successful approval
      navigate('/workflow/inbox')
    } catch (e) {
      alert(e?.response?.data?.message || 'خطا در ثبت تصمیم')
    } finally {
      setUploadingLabel(false)
    }
  }

  const handleDecision = async (stepId, decision) => {
    try {
      setSubmitting(true)
      await api.post(`/api/workflow/steps/${stepId}/decision`, {
        decision,
        notes: decisionNotes.trim() || null
      })
      setDecisionModal(null)
      setDecisionNotes('')
      alert(decision === 'Approved' ? 'پرونده با موفقیت تایید شد' : 'پرونده رد شد')
      // Navigate to inbox after successful decision
      navigate('/workflow/inbox')
    } catch (e) {
      alert(e?.response?.data?.message || 'خطا در ثبت تصمیم')
    } finally {
      setSubmitting(false)
    }
  }

  const handleFixDeficiency = async (stepId) => {
    try {
      if (!fixDeficiencyNotes.trim()) {
        alert('لطفا توضیحات رفع نقص را وارد کنید')
        return
      }
      setSubmitting(true)
      await api.post(`/api/workflow/steps/${stepId}/fix-deficiency`, {
        notes: fixDeficiencyNotes.trim()
      })
      setFixDeficiencyModal(null)
      setFixDeficiencyNotes('')
      alert('پرونده برای رفع نقص به مرحله قبل ارجاع شد')
      // Navigate to inbox after successful fix deficiency
      navigate('/workflow/inbox')
    } catch (e) {
      alert(e?.response?.data?.message || 'خطا در ثبت رفع نقص')
    } finally {
      setSubmitting(false)
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

  const getStatusBadge = (status) => {
    const statusMap = {
      'Pending': { label: 'در انتظار', color: '#f59e0b' },
      'Approved': { label: 'تایید شده', color: '#10b981' },
      'Rejected': { label: 'رد شده', color: '#ef4444' },
      'Skipped': { label: 'رد شده', color: '#6b7280' },
      'InProgress': { label: 'در حال بررسی', color: '#3b82f6' }
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

  const getCurrentStep = () => {
    return steps.find(s => s.Status === 'Pending')
  }

  if (loading) return <div className="box">در حال بارگذاری...</div>
  if (error) return <div className="box" style={{ color: '#ef4444' }}>{error}</div>
  if (!data) return <div className="box">اطلاعاتی یافت نشد</div>

  const { request, permissions, person, personDocuments, vehicle, vehicleDocuments, discountDocuments, payments, residences, contacts, company, companyAddresses, companyContacts, companyDocuments } = data
  const currentStep = getCurrentStep()
  
  // Check if current user is a label specialist
  const isLabelSpecialist = currentUser?.Role === 'کارشناس الصاق برچسب'
  
  // Debug logging
  console.log('🔍 Current User:', currentUser)
  console.log('🔍 Current User Role:', currentUser?.Role)
  console.log('🔍 Is Label Specialist:', isLabelSpecialist)
  console.log('🔍 Current Step:', currentStep)
  
  // Check if user has any view permissions or if data exists (for request owner)
  // For label specialists, only show personal info (name, family, national code) and vehicle info
  const canViewPersonInfo = isLabelSpecialist ? true : (permissions?.['view_person_info']?.canView || person !== null)
  const canViewPersonDocs = isLabelSpecialist ? false : (permissions?.['view_person_documents']?.canView || personDocuments?.length > 0)
  const canViewVehicleInfo = isLabelSpecialist ? true : (permissions?.['view_vehicle_info']?.canView || vehicle !== null)
  const canViewVehicleDocs = isLabelSpecialist ? false : (permissions?.['view_vehicle_documents']?.canView || vehicleDocuments?.length > 0)
  const canViewDiscountDocs = isLabelSpecialist ? false : (permissions?.['view_discount_documents']?.canView || discountDocuments?.length > 0)
  const canViewPayments = isLabelSpecialist ? false : (permissions?.['view_payments']?.canView || (payments?.online?.length > 0 || payments?.offline?.length > 0))
  const canViewResidences = isLabelSpecialist ? false : (permissions?.['view_residences']?.canView || residences?.length > 0)
  const canViewContacts = isLabelSpecialist ? false : (permissions?.['view_contacts']?.canView || contacts?.length > 0)
  const canViewCompanyInfo = isLabelSpecialist ? false : (permissions?.['view_person_info']?.canView || company !== null)
  const canViewCompanyAddresses = isLabelSpecialist ? false : (permissions?.['view_residences']?.canView || companyAddresses?.length > 0)
  const canViewCompanyContacts = isLabelSpecialist ? false : (permissions?.['view_contacts']?.canView || companyContacts?.length > 0)
  const canViewCompanyDocs = isLabelSpecialist ? false : (permissions?.['view_person_documents']?.canView || companyDocuments?.length > 0)

  return (
    <div style={{ padding: '20px' }}>
      <button 
        onClick={() => navigate('/admin/workflow/requests')} 
        style={{ 
          marginBottom: '20px',
          padding: '10px 20px', 
          background: '#6b7280', 
          color: 'white', 
          border: 'none', 
          borderRadius: '6px', 
          cursor: 'pointer', 
          fontSize: '14px' 
        }}
      >
        ← بازگشت به کارتابل
      </button>

      {/* Image Modal */}
      {imageModal && (
        <div 
          onClick={() => setImageModal(null)}
          style={{ 
            position: 'fixed', 
            top: 0, 
            left: 0, 
            right: 0, 
            bottom: 0, 
            background: 'rgba(0,0,0,0.8)', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            zIndex: 1000, 
            cursor: 'pointer' 
          }}
        >
          <img src={imageModal} alt="Document" style={{ maxWidth: '90%', maxHeight: '90%', borderRadius: '8px' }} />
        </div>
      )}

      {/* Fix Deficiency Modal */}
      {fixDeficiencyModal && (
        <div 
          style={{ 
            position: 'fixed', 
            top: 0, 
            left: 0, 
            right: 0, 
            bottom: 0, 
            background: 'rgba(0,0,0,0.5)', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            zIndex: 1000 
          }}
        >
          <div style={{ 
            background: 'white', 
            padding: '24px', 
            borderRadius: '8px', 
            maxWidth: '500px', 
            width: '90%' 
          }}
          onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginTop: 0, color: '#f59e0b' }}>
              🔧 رفع نقص
            </h3>
            <p style={{ color: '#6b7280', marginBottom: '16px' }}>
              شماره پیگیری: <strong>{request.trackingNo}</strong>
            </p>
            <p style={{ color: '#374151', marginBottom: '16px', fontSize: '14px' }}>
              با ثبت رفع نقص، پرونده به مرحله قبل ارجاع می‌شود تا نواقص برطرف گردد.
            </p>
            
            <textarea
              value={fixDeficiencyNotes}
              onChange={(e) => setFixDeficiencyNotes(e.target.value)}
              placeholder="توضیحات رفع نقص (الزامی) - لطفا نواقص را به طور دقیق شرح دهید"
              style={{ 
                width: '100%', 
                minHeight: '120px', 
                padding: '12px', 
                border: '2px solid #f59e0b', 
                borderRadius: '6px',
                fontSize: '14px',
                fontFamily: 'inherit'
              }}
            />
            <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
              <button
                onClick={() => handleFixDeficiency(fixDeficiencyModal.stepId)}
                disabled={submitting || !fixDeficiencyNotes.trim()}
                style={{
                  flex: 1,
                  padding: '10px',
                  background: fixDeficiencyNotes.trim() ? '#f59e0b' : '#d1d5db',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: (submitting || !fixDeficiencyNotes.trim()) ? 'not-allowed' : 'pointer',
                  fontSize: '14px',
                  fontWeight: 'bold',
                  opacity: submitting ? 0.6 : 1
                }}
              >
                {submitting ? 'در حال ثبت...' : 'ثبت و ارجاع'}
              </button>
              <button
                onClick={() => {
                  setFixDeficiencyModal(null)
                  setFixDeficiencyNotes('')
                }}
                disabled={submitting}
                style={{
                  flex: 1,
                  padding: '10px',
                  background: '#6b7280',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: submitting ? 'not-allowed' : 'pointer',
                  fontSize: '14px'
                }}
              >
                انصراف
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Decision Modal */}
      {decisionModal && (
        <div 
          style={{ 
            position: 'fixed', 
            top: 0, 
            left: 0, 
            right: 0, 
            bottom: 0, 
            background: 'rgba(0,0,0,0.5)', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            zIndex: 1000 
          }}
          onClick={(e) => {
            // Debug: Log decision modal state
            console.log('🔍 Decision Modal State:', decisionModal)
            console.log('🔍 Is Label Specialist in Modal:', decisionModal.isLabelSpecialist)
          }}
        >
          <div style={{ 
            background: 'white', 
            padding: '24px', 
            borderRadius: '8px', 
            maxWidth: '500px', 
            width: '90%' 
          }}
          onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>
              {decisionModal.isLabelSpecialist ? '📎 الصاق برچسب و تایید' : 
               decisionModal.decision === 'Approved' ? '✅ تایید پرونده' : '❌ رد پرونده'}
            </h3>
            <p style={{ color: '#6b7280', marginBottom: '16px' }}>
              شماره پیگیری: <strong>{request.trackingNo}</strong>
            </p>
            
            {/* Debug info */}
            {console.log('🔍 Rendering modal - isLabelSpecialist:', decisionModal.isLabelSpecialist)}
            
            {/* Image upload for label specialists */}
            {decisionModal.isLabelSpecialist && (
              <div style={{ marginBottom: '16px', padding: '16px', background: '#f3f4f6', borderRadius: '6px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#374151' }}>
                  📷 تصویر برچسب (الزامی - حداکثر 4 مگابایت)
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleLabelImageChange}
                  style={{ 
                    width: '100%', 
                    padding: '8px', 
                    border: '1px solid #d1d5db', 
                    borderRadius: '4px',
                    background: 'white'
                  }}
                />
                {labelImagePreview && (
                  <div style={{ marginTop: '12px', textAlign: 'center' }}>
                    <img 
                      src={labelImagePreview} 
                      alt="پیش‌نمایش برچسب" 
                      style={{ 
                        maxWidth: '100%', 
                        maxHeight: '200px', 
                        borderRadius: '4px',
                        border: '2px solid #10b981'
                      }} 
                    />
                    <p style={{ fontSize: '12px', color: '#10b981', marginTop: '8px' }}>
                      ✅ تصویر انتخاب شد
                    </p>
                  </div>
                )}
              </div>
            )}
            
            <textarea
              value={decisionNotes}
              onChange={(e) => setDecisionNotes(e.target.value)}
              placeholder="توضیحات (اختیاری)"
              style={{ 
                width: '100%', 
                minHeight: '100px', 
                padding: '12px', 
                border: '1px solid #d1d5db', 
                borderRadius: '6px',
                fontSize: '14px',
                fontFamily: 'inherit'
              }}
            />
            <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
              <button
                onClick={() => decisionModal.isLabelSpecialist ? 
                  handleLabelApproval(decisionModal.stepId) : 
                  handleDecision(decisionModal.stepId, decisionModal.decision)}
                disabled={submitting || uploadingLabel || (decisionModal.isLabelSpecialist && !labelImage)}
                style={{
                  flex: 1,
                  padding: '10px',
                  background: decisionModal.decision === 'Approved' ? '#10b981' : '#ef4444',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: (submitting || uploadingLabel) ? 'not-allowed' : 'pointer',
                  fontSize: '14px',
                  fontWeight: 'bold',
                  opacity: (submitting || uploadingLabel) ? 0.6 : 1
                }}
              >
                {uploadingLabel ? 'در حال آپلود برچسب...' : 
                 submitting ? 'در حال ثبت...' : 
                 decisionModal.isLabelSpecialist ? 'الصاق و تایید' : 'تایید'}
              </button>
              <button
                onClick={() => {
                  setDecisionModal(null)
                  setDecisionNotes('')
                }}
                disabled={submitting}
                style={{
                  flex: 1,
                  padding: '10px',
                  background: '#6b7280',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: submitting ? 'not-allowed' : 'pointer',
                  fontSize: '14px'
                }}
              >
                انصراف
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Request Header */}
      <div style={{ 
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', 
        color: 'white', 
        padding: '24px', 
        borderRadius: '8px', 
        marginBottom: '20px' 
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h2 style={{ margin: '0 0 8px 0', fontSize: '24px' }}>پرونده شماره: {request.trackingNo}</h2>
            <div style={{ fontSize: '14px', opacity: 0.9 }}>تاریخ ثبت: {formatDate(request.createdAt)}</div>
          </div>
          <div style={{ textAlign: 'left' }}>
            {getStatusBadge(request.status)}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', borderBottom: '2px solid #e5e7eb' }}>
        {['info', 'steps', 'history'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '12px 24px',
              background: activeTab === tab ? '#3b82f6' : 'transparent',
              color: activeTab === tab ? 'white' : '#6b7280',
              border: 'none',
              borderBottom: activeTab === tab ? '2px solid #3b82f6' : 'none',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 'bold',
              marginBottom: '-2px'
            }}
          >
            {tab === 'info' ? '📋 اطلاعات پرونده' : tab === 'steps' ? '📊 مراحل گردش کار' : '📜 سوابق فرآیند'}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'info' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Person Info */}
          {canViewPersonInfo && person && (
            <div style={{ border: '1px solid #d1d5db', borderRadius: '8px', overflow: 'hidden' }}>
              <div style={{ background: '#3b82f6', color: 'white', padding: '12px 20px', fontSize: '16px', fontWeight: 'bold' }}>
                👤 مشخصات فردی
              </div>
              <div style={{ padding: '20px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px' }}>
                <div className="info-item">
                  <div className="info-label">نام</div>
                  <div className="info-value">{person.FirstName || '-'}</div>
                </div>
                <div className="info-item">
                  <div className="info-label">نام خانوادگی</div>
                  <div className="info-value">{person.LastName || '-'}</div>
                </div>
                <div className="info-item">
                  <div className="info-label">کد ملی</div>
                  <div className="info-value">{person.NationalCode || '-'}</div>
                </div>
                
                {/* Show additional fields only if NOT label specialist */}
                {!isLabelSpecialist && (
                  <>
                    <div className="info-item">
                      <div className="info-label">نام پدر</div>
                      <div className="info-value">{person.FatherName || '-'}</div>
                    </div>
                    <div className="info-item">
                      <div className="info-label"> شماره شناسنامه</div>
                      <div className="info-value">{person.IdSerial || '-'}</div>
                    </div>
                    <div className="info-item">
                      <div className="info-label">تاریخ تولد</div>
                      <div className="info-value">{person.BirthDate || person.BirthDateJalali || '-'}</div>
                    </div>
                    <div className="info-item">
                      <div className="info-label">محل تولد</div>
                      <div className="info-value">
                        {person.BirthProvinceName && person.BirthCityName 
                          ? `${person.BirthProvinceName} - ${person.BirthCityName}`
                          : person.BirthProvinceId || person.BirthCityId ? `${person.BirthProvinceId || ''} - ${person.BirthCityId || ''}` : '-'}
                      </div>
                    </div>
                    <div className="info-item">
                      <div className="info-label">جنسیت</div>
                      <div className="info-value">{person.Gender === 'male' ? 'مرد' : person.Gender === 'female' ? 'زن' : (person.Gender || '-')}</div>
                    </div>
                    <div className="info-item">
                      <div className="info-label">وضعیت تأهل</div>
                      <div className="info-value">{person.MaritalStatus === 'single' ? 'مجرد' : person.MaritalStatus === 'married' ? 'متأهل' : '-'}</div>
                    </div>
                    {person.BloodGroup && (
                      <div className="info-item">
                        <div className="info-label">گروه خون</div>
                        <div className="info-value">{person.BloodGroup}</div>
                      </div>
                    )}
                    {person.EducationLevel && (
                      <div className="info-item">
                        <div className="info-label">سطح تحصیلات</div>
                        <div className="info-value">{person.EducationLevel}</div>
                      </div>
                    )}
                    {person.PhysicalStatus && (
                      <div className="info-item">
                        <div className="info-label">وضعیت جسمانی</div>
                        <div className="info-value">{person.PhysicalStatus}</div>
                      </div>
                    )}
                    {person.MilitaryStatus && (
                      <div className="info-item">
                        <div className="info-label">وضعیت نظام وظیفه</div>
                        <div className="info-value">{person.MilitaryStatus}</div>
                      </div>
                    )}
                    {person.EnglishLevel && (
                      <div className="info-item">
                        <div className="info-label">تسلط به زبان انگلیسی</div>
                        <div className="info-value">{person.EnglishLevel}</div>
                      </div>
                    )}
                  </>
                )}
                <div className="info-item">
                  <div className="info-label">وضعیت ایثارگری</div>
                  <div className="info-value">{person.VeteranStatus}</div>
                </div>
              </div>
            </div>
          )}

          {/* Residences */}
          {canViewResidences && residences && residences.length > 0 && (
            <div style={{ border: '1px solid #d1d5db', borderRadius: '8px', overflow: 'hidden' }}>
              <div style={{ background: '#06b6d4', color: 'white', padding: '12px 20px', fontSize: '16px', fontWeight: 'bold' }}>
                🏠 آدرس‌های محل سکونت
              </div>
              <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {residences.map((r, idx) => (
                  <div key={idx} style={{ padding: '16px', background: '#f9fafb', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '12px' }}>
                      <div className="info-item">
                        <div className="info-label">استان</div>
                        <div className="info-value">{r.ProvinceName || r.ProvinceId || '-'}</div>
                      </div>
                      <div className="info-item">
                        <div className="info-label">شهر</div>
                        <div className="info-value">{r.CityName || r.CityId || '-'}</div>
                      </div>
                      <div className="info-item">
                        <div className="info-label">خیابان اصلی</div>
                        <div className="info-value">{r.MainStreet || '-'}</div>
                      </div>
                      <div className="info-item">
                        <div className="info-label">خیابان فرعی</div>
                        <div className="info-value">{r.SideStreet || '-'}</div>
                      </div>
                      <div className="info-item">
                        <div className="info-label">محله</div>
                        <div className="info-value">{r.District || '-'}</div>
                      </div>
                      <div className="info-item">
                        <div className="info-label">کد پستی</div>
                        <div className="info-value">{r.PostalCode || '-'}</div>
                      </div>
                      <div className="info-item">
                        <div className="info-label">پلاک</div>
                        <div className="info-value">{r.Plaque || '-'}</div>
                      </div>
                      <div className="info-item">
                        <div className="info-label">واحد</div>
                        <div className="info-value">{r.Unit || '-'}</div>
                      </div>
                    </div>
                    {r.Address && (
                      <div className="info-item" style={{ gridColumn: '1 / -1' }}>
                        <div className="info-label">آدرس کامل</div>
                        <div className="info-value">{r.Address}</div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Contacts */}
          {canViewContacts && contacts && contacts.length > 0 && (
            <div style={{ border: '1px solid #d1d5db', borderRadius: '8px', overflow: 'hidden' }}>
              <div style={{ background: '#10b981', color: 'white', padding: '12px 20px', fontSize: '16px', fontWeight: 'bold' }}>
                📞 اطلاعات تماس
              </div>
              <div style={{ padding: '20px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px' }}>
                {contacts.map((c, idx) => (
                  <div key={idx} className="info-item">
                    <div className="info-label">
                      {c.Type === 'mobile' ? '📱 موبایل' : 
                       c.Type === 'phone' ? '☎️ تلفن' : 
                       c.Type === 'email' ? '📧 ایمیل' : 
                       c.Type === 'fax' ? '📠 فکس' : c.Type}
                      {c.IsActive && <span style={{ color: '#10b981', marginRight: '8px' }}>✓ فعال</span>}
                    </div>
                    <div className="info-value">{c.Value}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Company Info */}
          {canViewCompanyInfo && company && (
            <div style={{ border: '1px solid #d1d5db', borderRadius: '8px', overflow: 'hidden' }}>
              <div style={{ background: '#8b5cf6', color: 'white', padding: '12px 20px', fontSize: '16px', fontWeight: 'bold' }}>
                🏭 مشخصات شرکت
              </div>
              <div style={{ padding: '20px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                <div className="info-item">
                  <div className="info-label">نام شرکت</div>
                  <div className="info-value">{company.CompanyName || '-'}</div>
                </div>
                <div className="info-item">
                  <div className="info-label">شناسه ملی</div>
                  <div className="info-value">{company.NationalId || '-'}</div>
                </div>
                <div className="info-item">
                  <div className="info-label">شماره ثبت</div>
                  <div className="info-value">{company.RegistrationNo || '-'}</div>
                </div>
                <div className="info-item">
                  <div className="info-label">نوع شرکت</div>
                  <div className="info-value">{company.CompanyTypeName || '-'}</div>
                </div>
                <div className="info-item">
                  <div className="info-label">نام کارگاه</div>
                  <div className="info-value">{company.WorkshopName || '-'}</div>
                </div>
                <div className="info-item">
                  <div className="info-label">شماره جواز کسب</div>
                  <div className="info-value">{company.BusinessLicenseNo || '-'}</div>
                </div>
                <div className="info-item">
                  <div className="info-label">کد اقتصادی</div>
                  <div className="info-value">{company.EconomicCode || '-'}</div>
                </div>
                <div className="info-item">
                  <div className="info-label">زمینه فعالیت</div>
                  <div className="info-value">{company.ActivityFieldName || '-'}</div>
                </div>
                <div className="info-item">
                  <div className="info-label">میزان تناژ</div>
                  <div className="info-value">{company.TonnageRateName || '-'}</div>
                </div>
                <div className="info-item">
                  <div className="info-label">فعالیت اصلی</div>
                  <div className="info-value">{company.MainActivity || '-'}</div>
                </div>
              </div>
            </div>
          )}

          {/* Company Addresses */}
          {canViewCompanyAddresses && companyAddresses && companyAddresses.length > 0 && (
            <div style={{ border: '1px solid #d1d5db', borderRadius: '8px', overflow: 'hidden' }}>
              <div style={{ background: '#f59e0b', color: 'white', padding: '12px 20px', fontSize: '16px', fontWeight: 'bold' }}>
                🏢 آدرس شرکت
              </div>
              <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {companyAddresses.map((addr, idx) => (
                  <div key={idx} style={{ padding: '16px', background: '#f9fafb', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '12px' }}>
                      <div className="info-item">
                        <div className="info-label">استان</div>
                        <div className="info-value">{addr.ProvinceName || addr.ProvinceId || '-'}</div>
                      </div>
                      <div className="info-item">
                        <div className="info-label">شهر</div>
                        <div className="info-value">{addr.CityName || addr.CityId || '-'}</div>
                      </div>
                      <div className="info-item">
                        <div className="info-label">خیابان اصلی</div>
                        <div className="info-value">{addr.MainStreet || '-'}</div>
                      </div>
                      <div className="info-item">
                        <div className="info-label">خیابان فرعی</div>
                        <div className="info-value">{addr.SideStreet || '-'}</div>
                      </div>
                      <div className="info-item">
                        <div className="info-label">محله</div>
                        <div className="info-value">{addr.District || '-'}</div>
                      </div>
                      <div className="info-item">
                        <div className="info-label">کد پستی</div>
                        <div className="info-value">{addr.PostalCode || '-'}</div>
                      </div>
                      <div className="info-item">
                        <div className="info-label">پلاک</div>
                        <div className="info-value">{addr.Plaque || '-'}</div>
                      </div>
                      <div className="info-item">
                        <div className="info-label">واحد</div>
                        <div className="info-value">{addr.Unit || '-'}</div>
                      </div>
                    </div>
                    {addr.Address && (
                      <div className="info-item" style={{ gridColumn: '1 / -1' }}>
                        <div className="info-label">آدرس کامل</div>
                        <div className="info-value">{addr.Address}</div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Company Contacts */}
          {canViewCompanyContacts && companyContacts && companyContacts.length > 0 && (
            <div style={{ border: '1px solid #d1d5db', borderRadius: '8px', overflow: 'hidden' }}>
              <div style={{ background: '#ec4899', color: 'white', padding: '12px 20px', fontSize: '16px', fontWeight: 'bold' }}>
                📞 اطلاعات تماس شرکت
              </div>
              <div style={{ padding: '20px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px' }}>
                {companyContacts.map((c, idx) => (
                  <div key={idx} className="info-item">
                    <div className="info-label">
                      {c.Type === 'mobile' ? '📱 موبایل' : 
                       c.Type === 'phone' ? '☎️ تلفن' : 
                       c.Type === 'email' ? '📧 ایمیل' : 
                       c.Type === 'fax' ? '📠 فکس' : c.Type}
                      {c.IsActive && <span style={{ color: '#10b981', marginRight: '8px' }}>✓ فعال</span>}
                    </div>
                    <div className="info-value">{c.Value}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Company Documents */}
          {canViewCompanyDocs && companyDocuments && companyDocuments.length > 0 && (
            <div style={{ border: '1px solid #d1d5db', borderRadius: '8px', overflow: 'hidden' }}>
              <div style={{ background: '#14b8a6', color: 'white', padding: '12px 20px', fontSize: '16px', fontWeight: 'bold' }}>
                📄 مستندات شرکت
              </div>
              <div style={{ padding: '20px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px' }}>
                {companyDocuments.map(d => (
                  <div 
                    key={d.DocID}
                    onClick={() => setImageModal(`/api/issue/company/${company.NationalId}/documents/${d.DocID}/content`)}
                    style={{ 
                      border: '1px solid #e5e7eb', 
                      borderRadius: '8px', 
                      overflow: 'hidden', 
                      cursor: 'pointer',
                      transition: 'transform 0.2s',
                      ':hover': { transform: 'scale(1.05)' }
                    }}
                  >
                    <img 
                      src={`/api/issue/company/${company.NationalId}/documents/${d.DocID}/content`} 
                      alt={d.DocTypeName}
                      style={{ width: '100%', height: '150px', objectFit: 'cover' }}
                    />
                    <div style={{ padding: '8px', background: '#f9fafb', fontSize: '12px', fontWeight: 'bold' }}>
                      {d.DocTypeName || d.LookupDocTypeId}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Person Documents */}
          {canViewPersonDocs && personDocuments.length > 0 && (
            <div style={{ border: '1px solid #d1d5db', borderRadius: '8px', overflow: 'hidden' }}>
              <div style={{ background: '#8b5cf6', color: 'white', padding: '12px 20px', fontSize: '16px', fontWeight: 'bold' }}>
                📄 مستندات فردی
              </div>
              <div style={{ padding: '20px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px' }}>
                 {personDocuments.map(d => (
                  <div 
                    key={d.DocID}
                    onClick={() => setImageModal(`/api/issue/personal/${person.NationalCode}/documents/${d.DocID}/content`)}
                    style={{ 
                      border: '1px solid #e5e7eb', 
                      borderRadius: '8px', 
                      overflow: 'hidden', 
                      cursor: 'pointer',
                      transition: 'transform 0.2s',
                      ':hover': { transform: 'scale(1.05)' }
                    }}
                  >
                    <img 
                      src={`/api/issue/personal/${person.NationalCode}/documents/${d.DocID}/content`} 
                      alt={d.DocTypeName}
                      style={{ width: '100%', height: '150px', objectFit: 'cover' }}
                    />
                    <div style={{ padding: '8px', background: '#f9fafb', fontSize: '12px', fontWeight: 'bold' }}>
                      {d.DocTypeName || d.LookupDocTypeId}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Vehicle Info */}
          {canViewVehicleInfo && vehicle && (
            <div style={{ border: '1px solid #d1d5db', borderRadius: '8px', overflow: 'hidden' }}>
              <div style={{ background: '#10b981', color: 'white', padding: '12px 20px', fontSize: '16px', fontWeight: 'bold' }}>
                🚗 مشخصات خودرو
              </div>
              <div style={{ padding: '20px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px' }}>
                <div className="info-item">
                  <div className="info-label">شماره VIN</div>
                  <div className="info-value">{vehicle.VIN || '-'}</div>
                </div>
                <div className="info-item">
                  <div className="info-label">شماره شاسی</div>
                  <div className="info-value">{vehicle.ChassisNo || '-'}</div>
                </div>
                <div className="info-item">
                  <div className="info-label">شماره موتور</div>
                  <div className="info-value">{vehicle.EngineNo || '-'}</div>
                </div>
                <div className="info-item">
                  <div className="info-label">شماره پلاک</div>
                  <div className="info-value" style={{ direction: 'ltr', whiteSpace: 'nowrap', fontFamily: 'monospace' }}>
                    {formatPlate(vehicle)}
                  </div>
                </div>
                <div className="info-item">
                  <div className="info-label">رنگ بدنه</div>
                  <div className="info-value">{vehicle.BodyColor || '-'}</div>
                </div>
                <div className="info-item">
                  <div className="info-label">سال ساخت</div>
                  <div className="info-value">{vehicle.YearManufacture || '-'}</div>
                </div>
                <div className="info-item">
                  <div className="info-label">ظرفیت</div>
                  <div className="info-value">{vehicle.Capacity || '-'}</div>
                </div>
                <div className="info-item">
                  <div className="info-label">تعداد سیلندر</div>
                  <div className="info-value">{vehicle.Cylinders || '-'}</div>
                </div>
                <div className="info-item">
                  <div className="info-label">تعداد محور</div>
                  <div className="info-value">{vehicle.Axles || '-'}</div>
                </div>
                <div className="info-item">
                  <div className="info-label">تعداد چرخ</div>
                  <div className="info-value">{vehicle.Wheels ?? '-'}</div>
                </div>
                <div className="info-item">
                  <div className="info-label">تاریخ بازدید</div>
                  <div className="info-value">{vehicle.InspectionDate || '-'}</div>
                </div>
                <div className="info-item">
                  <div className="info-label">تاریخ برگ سبز</div>
                  <div className="info-value">{vehicle.GreenCardDate || '-'}</div>
                </div>
                <div className="info-item">
                  <div className="info-label">شماره بیمه‌نامه</div>
                  <div className="info-value">{vehicle.InsurancePolicyNo || '-'}</div>
                </div>
                <div className="info-item">
                  <div className="info-label">تاریخ صدور بیمه</div>
                  <div className="info-value">{vehicle.InsuranceIssueDate || '-'}</div>
                </div>
                <div className="info-item">
                  <div className="info-label">تاریخ اعتبار بیمه</div>
                  <div className="info-value">{vehicle.InsuranceValidDate || '-'}</div>
                </div>
                <div className="info-item">
                  <div className="info-label">سریال معاینه فنی</div>
                  <div className="info-value">{vehicle.TechInspectSerial || '-'}</div>
                </div>
                <div className="info-item">
                  <div className="info-label">تاریخ صدور معاینه فنی</div>
                  <div className="info-value">{vehicle.TechInspectIssueDate || '-'}</div>
                </div>
                <div className="info-item">
                  <div className="info-label">تاریخ اعتبار معاینه فنی</div>
                  <div className="info-value">{vehicle.TechInspectValidDate || '-'}</div>
                </div>
              </div>
            </div>
          )}

          {/* Vehicle Documents */}
          {canViewVehicleDocs && vehicleDocuments.length > 0 && (
            <div style={{ border: '1px solid #d1d5db', borderRadius: '8px', overflow: 'hidden' }}>
              <div style={{ background: '#f59e0b', color: 'white', padding: '12px 20px', fontSize: '16px', fontWeight: 'bold' }}>
                📄 مستندات خودرو
              </div>
              <div style={{ padding: '20px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px' }}>
                {vehicleDocuments.map(d => (
                  <div 
                    key={d.DocID}
                    onClick={() => setImageModal(`/api/issue/vehicle/${d.VehicleID}/documents/${d.DocID}/content`)}
                    style={{ border: '1px solid #e5e7eb', borderRadius: '8px', overflow: 'hidden', cursor: 'pointer' }}
                  >
                    <img 
                      src={`/api/issue/vehicle/${d.VehicleID}/documents/${d.DocID}/content`} 
                      alt={d.DocTypeName}
                      style={{ width: '100%', height: '150px', objectFit: 'cover' }}
                    />
                    <div style={{ padding: '8px', background: '#f9fafb', fontSize: '12px', fontWeight: 'bold' }}>
                      {d.DocTypeName || d.LookupDocTypeId}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Discount Documents */}
          {canViewDiscountDocs && discountDocuments.length > 0 && (
            <div style={{ border: '1px solid #d1d5db', borderRadius: '8px', overflow: 'hidden' }}>
              <div style={{ background: '#ec4899', color: 'white', padding: '12px 20px', fontSize: '16px', fontWeight: 'bold' }}>
                💰 مستندات تخفیفات
              </div>
              <div style={{ padding: '20px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px' }}>
                {discountDocuments.map(d => (
                  <div 
                    key={d.DocID}
                    onClick={() => setImageModal(`/api/issue/vehicle/${d.VehicleID}/discount-documents/${d.DocID}/content`)}
                    style={{ border: '1px solid #e5e7eb', borderRadius: '8px', overflow: 'hidden', cursor: 'pointer' }}
                  >
                    <img 
                      src={`/api/issue/vehicle/${d.VehicleID}/discount-documents/${d.DocID}/content`} 
                      alt={d.DocTypeName}
                      style={{ width: '100%', height: '150px', objectFit: 'cover' }}
                    />
                    <div style={{ padding: '8px', background: '#f9fafb' }}>
                      <div style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '4px' }}>{d.DocTypeName || d.LookupDocTypeId}</div>
                      {d.Description && <div style={{ fontSize: '11px', color: '#6b7280' }}>{d.Description}</div>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Payments */}
          {canViewPayments && (payments?.online?.length > 0 || payments?.offline?.length > 0) && (
            <div style={{ border: '1px solid #d1d5db', borderRadius: '8px', overflow: 'hidden' }}>
              <div style={{ background: '#06b6d4', color: 'white', padding: '12px 20px', fontSize: '16px', fontWeight: 'bold' }}>
                💳 اطلاعات پرداخت
              </div>
              <div style={{ padding: '20px' }}>
                {/* Online Payments */}
                {payments?.online?.length > 0 && (
                  <div style={{ marginBottom: '20px' }}>
                    <h4 style={{ marginBottom: '12px', color: '#374151' }}>پرداخت‌های آنلاین</h4>
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                          <tr style={{ background: '#f3f4f6' }}>
                            <th style={{ border: '1px solid #d1d5db', padding: '10px', textAlign: 'center' }}>مبلغ</th>
                            <th style={{ border: '1px solid #d1d5db', padding: '10px', textAlign: 'center' }}>وضعیت</th>
                            <th style={{ border: '1px solid #d1d5db', padding: '10px', textAlign: 'center' }}>روش پرداخت</th>
                            <th style={{ border: '1px solid #d1d5db', padding: '10px', textAlign: 'center' }}>کد پیگیری درگاه</th>
                            <th style={{ border: '1px solid #d1d5db', padding: '10px', textAlign: 'center' }}>تاریخ ایجاد</th>
                            <th style={{ border: '1px solid #d1d5db', padding: '10px', textAlign: 'center' }}>تاریخ پرداخت</th>
                          </tr>
                        </thead>
                        <tbody>
                          {payments.online.map(p => (
                            <tr key={p.Id}>
                              <td style={{ border: '1px solid #d1d5db', padding: '10px', textAlign: 'center' }}>
                                {p.Amount?.toLocaleString('fa-IR')} ریال
                              </td>
                              <td style={{ border: '1px solid #d1d5db', padding: '10px', textAlign: 'center' }}>
                                {getStatusBadge(p.Status)}
                              </td>
                              <td style={{ border: '1px solid #d1d5db', padding: '10px', textAlign: 'center' }}>
                                {p.PaymentChannel === 'Pos'
                                  ? ((p.ViaKiosk === true || p.ViaKiosk === 1) ? 'دستگاه پوز از کیوسک' : 'دستگاه پوز')
                                  : ((p.ViaKiosk === true || p.ViaKiosk === 1) ? 'کیوسک' : 'اینترنتی')}
                              </td>
                              <td style={{ border: '1px solid #d1d5db', padding: '10px', textAlign: 'center' }}>
                                {p.GatewayRef || '-'}
                              </td>
                              <td style={{ border: '1px solid #d1d5db', padding: '10px', textAlign: 'center', fontSize: '13px' }}>
                                {formatDate(p.CreatedAt)}
                              </td>
                              <td style={{ border: '1px solid #d1d5db', padding: '10px', textAlign: 'center', fontSize: '13px' }}>
                                {p.PaidAt ? formatDate(p.PaidAt) : '-'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Offline Payments */}
                {payments?.offline?.length > 0 && (
                  <div>
                    <h4 style={{ marginBottom: '12px', color: '#374151' }}>پرداخت‌های آفلاین (کارتخوان/فیش)</h4>
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                          <tr style={{ background: '#f3f4f6' }}>
                            <th style={{ border: '1px solid #d1d5db', padding: '10px', textAlign: 'center' }}>مبلغ</th>
                            <th style={{ border: '1px solid #d1d5db', padding: '10px', textAlign: 'center' }}>شماره رسید</th>
                            <th style={{ border: '1px solid #d1d5db', padding: '10px', textAlign: 'center' }}>تاریخ پرداخت</th>
                            <th style={{ border: '1px solid #d1d5db', padding: '10px', textAlign: 'center' }}>بانک/شعبه</th>
                            <th style={{ border: '1px solid #d1d5db', padding: '10px', textAlign: 'center' }}>توضیحات</th>
                            <th style={{ border: '1px solid #d1d5db', padding: '10px', textAlign: 'center' }}>فیش</th>
                            {currentUser?.Role === 'کارشناس مالی' && (
                              <th style={{ border: '1px solid #d1d5db', padding: '10px', textAlign: 'center' }}>عملیات</th>
                            )}
                          </tr>
                        </thead>
                        <tbody>
                          {payments.offline.map(p => (
                            <tr key={p.Id}>
                              <td style={{ border: '1px solid #d1d5db', padding: '10px', textAlign: 'center' }}>
                                {p.Amount?.toLocaleString('fa-IR')} ریال
                              </td>
                              <td style={{ border: '1px solid #d1d5db', padding: '10px', textAlign: 'center' }}>
                                {p.ReceiptNo || '-'}
                              </td>
                              <td style={{ border: '1px solid #d1d5db', padding: '10px', textAlign: 'center' }}>
                                {p.PayDate || '-'}
                              </td>
                              <td style={{ border: '1px solid #d1d5db', padding: '10px', textAlign: 'center', fontSize: '13px' }}>
                                {[p.BankName, p.BranchName].filter(Boolean).join(' / ') || '-'}
                              </td>
                              <td style={{ border: '1px solid #d1d5db', padding: '10px', textAlign: 'center', fontSize: '13px' }}>
                                {p.Description || '-'}
                              </td>
                              <td style={{ border: '1px solid #d1d5db', padding: '10px', textAlign: 'center' }}>
                                {p.AttachmentFileName ? (
                                  <button
                                    onClick={async () => {
                                      try {
                                        const token = localStorage.getItem('token');
                                        const response = await fetch(`${normalizedApiBaseUrl}/api/payments/offline/${p.Id}/attachment`, {
                                          headers: {
                                            'Authorization': `Bearer ${token}`
                                          }
                                        });
                                        if (!response.ok) throw new Error('Failed to load image');
                                        const blob = await response.blob();
                                        const imageUrl = URL.createObjectURL(blob);
                                        
                                        // Create modal to display image
                                        const modal = document.createElement('div');
                                        modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.8);display:flex;align-items:center;justify-content:center;z-index:9999;';
                                        modal.innerHTML = `
                                          <div style="position:relative;max-width:90%;max-height:90%;background:white;padding:20px;border-radius:8px;">
                                            <button style="position:absolute;top:10px;right:10px;background:#dc3545;color:white;border:none;border-radius:50%;width:30px;height:30px;cursor:pointer;font-size:18px;" onclick="this.parentElement.parentElement.remove();">×</button>
                                            <img src="${imageUrl}" style="max-width:100%;max-height:80vh;" />
                                          </div>
                                        `;
                                        modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
                                        document.body.appendChild(modal);
                                      } catch (err) {
                                        console.error('Error loading image:', err);
                                        alert('خطا در بارگذاری تصویر فیش');
                                      }
                                    }}
                                    style={{
                                      padding: '4px 12px',
                                      background: '#3b82f6',
                                      color: 'white',
                                      border: 'none',
                                      borderRadius: '4px',
                                      cursor: 'pointer',
                                      fontSize: '12px'
                                    }}
                                  >
                                    👁️ مشاهده فیش
                                  </button>
                                ) : '-'}
                              </td>
                              {currentUser?.Role === 'کارشناس مالی' && (
                                <td style={{ border: '1px solid #d1d5db', padding: '10px', textAlign: 'center' }}>
                                  <button
                                    onClick={() => handleDeletePayment(p.Id)}
                                    style={{
                                      padding: '4px 12px',
                                      background: '#ef4444',
                                      color: 'white',
                                      border: 'none',
                                      borderRadius: '4px',
                                      cursor: 'pointer',
                                      fontSize: '12px',
                                      fontWeight: 'bold'
                                    }}
                                    title="حذف پرداخت"
                                  >
                                    🗑️ حذف
                                  </button>
                                </td>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Vehicle Label Image */}
          {vehicleLabel && vehicle && (
            <div style={{ border: '1px solid #d1d5db', borderRadius: '8px', overflow: 'hidden' }}>
              <div style={{ background: '#8b5cf6', color: 'white', padding: '12px 20px', fontSize: '16px', fontWeight: 'bold' }}>
                🏷️ تصویر برچسب خودرو
              </div>
              <div style={{ padding: '20px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px', marginBottom: '16px' }}>
                  <div className="info-item">
                    <div className="info-label">تاریخ الصاق برچسب</div>
                    <div className="info-value">{formatDate(vehicleLabel.CreatedAt)}</div>
                  </div>
                  <div className="info-item">
                    <div className="info-label">کارشناس الصاق</div>
                    <div className="info-value">{vehicleLabel.UploadedByName || '-'}</div>
                  </div>
                </div>
                
                {vehicleLabel.Notes && (
                  <div style={{ marginBottom: '16px', padding: '12px', background: '#f3f4f6', borderRadius: '6px' }}>
                    <div style={{ fontWeight: 'bold', marginBottom: '4px', color: '#374151' }}>یادداشت:</div>
                    <div style={{ color: '#6b7280' }}>{vehicleLabel.Notes}</div>
                  </div>
                )}
                
                <div style={{ textAlign: 'center' }}>
                  {!labelImageUrl ? (
                    <div style={{ padding: '40px', color: '#6b7280' }}>در حال بارگذاری تصویر...</div>
                  ) : (
                    <div style={{ 
                      border: '2px solid #8b5cf6', 
                      borderRadius: '8px', 
                      overflow: 'hidden',
                      display: 'inline-block',
                      maxWidth: '100%'
                    }}>
                      <img 
                        src={labelImageUrl}
                        alt="تصویر برچسب خودرو"
                        style={{ 
                          maxWidth: '100%', 
                          maxHeight: '500px',
                          display: 'block',
                          cursor: 'pointer'
                        }}
                        onClick={() => {
                          // Open image in modal for full view
                          const modal = document.createElement('div');
                          modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.9);display:flex;align-items:center;justify-content:center;z-index:9999;';
                          modal.innerHTML = `
                            <div style="position:relative;max-width:95%;max-height:95%;">
                              <button style="position:absolute;top:-40px;right:0;background:#ef4444;color:white;border:none;border-radius:6px;padding:8px 16px;cursor:pointer;font-size:16px;" onclick="this.parentElement.parentElement.remove();">✕ بستن</button>
                              <img src="${labelImageUrl}" style="max-width:100%;max-height:90vh;border-radius:8px;" />
                            </div>
                          `;
                          modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
                          document.body.appendChild(modal);
                        }}
                      />
                    </div>
                  )}
                  <div style={{ marginTop: '12px', fontSize: '13px', color: '#6b7280' }}>
                    💡 برای مشاهده تصویر در اندازه بزرگتر، روی آن کلیک کنید
                  </div>
                </div>
              </div>
            </div>
          )}

          {request.finalDescription && (
            <div style={{ border: '1px solid #d1d5db', borderRadius: '8px', overflow: 'hidden' }}>
              <div style={{ background: '#6b7280', color: 'white', padding: '12px 20px', fontSize: '16px', fontWeight: 'bold' }}>
                📝 توضیحات نهایی
              </div>
              <div style={{ padding: '20px', color: '#374151' }}>
                {request.finalDescription}
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'steps' && (
        <div style={{ border: '1px solid #d1d5db', borderRadius: '8px', overflow: 'hidden', background: 'white' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f3f4f6' }}>
                <th style={{ padding: '12px', textAlign: 'center', borderBottom: '2px solid #d1d5db' }}>مرحله</th>
                <th style={{ padding: '12px', textAlign: 'center', borderBottom: '2px solid #d1d5db' }}>نقش</th>
                <th style={{ padding: '12px', textAlign: 'center', borderBottom: '2px solid #d1d5db' }}>وضعیت</th>
                <th style={{ padding: '12px', textAlign: 'center', borderBottom: '2px solid #d1d5db' }}>تصمیم‌گیرنده</th>
                <th style={{ padding: '12px', textAlign: 'center', borderBottom: '2px solid #d1d5db' }}>تاریخ تصمیم</th>
                <th style={{ padding: '12px', textAlign: 'center', borderBottom: '2px solid #d1d5db' }}>توضیحات</th>
              </tr>
            </thead>
            <tbody>
              {steps.filter(step => !(viewerIsSuperAdminOnly() && isAdminRoleName(step.RoleName))).map((step, idx, visibleSteps) => (
                <tr key={step.Id} style={{ borderBottom: idx < visibleSteps.length - 1 ? '1px solid #e5e7eb' : 'none' }}>
                  <td style={{ padding: '12px', textAlign: 'center', fontWeight: 'bold' }}>{step.StepOrder}</td>
                  <td style={{ padding: '12px', textAlign: 'center' }}>{step.RoleName}</td>
                  <td style={{ padding: '12px', textAlign: 'center' }}>{getStatusBadge(step.Status)}</td>
                  <td style={{ padding: '12px', textAlign: 'center' }}>{step.DecidedByUserName || '-'}</td>
                  <td style={{ padding: '12px', textAlign: 'center', fontSize: '13px' }}>{formatDate(step.DecidedAt)}</td>
                  <td style={{ padding: '12px', textAlign: 'center', fontSize: '13px', color: '#6b7280' }}>
                    {step.Notes || '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'history' && (
        <div style={{ border: '1px solid #d1d5db', borderRadius: '8px', background: 'white' }}>
          {history.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>
              هیچ سابقه‌ای ثبت نشده است
            </div>
          ) : (
            <div style={{ padding: '20px' }}>
              {history.filter(h => !(viewerIsSuperAdminOnly() && isAdminRoleName(h.ActionByRole))).map((h, idx, visibleHistory) => (
                <div 
                  key={h.Id}
                  style={{ 
                    padding: '16px', 
                    borderBottom: idx < visibleHistory.length - 1 ? '1px solid #e5e7eb' : 'none',
                    display: 'flex',
                    gap: '16px'
                  }}
                >
                  <div style={{ 
                    width: '40px', 
                    height: '40px', 
                    borderRadius: '50%', 
                    background: h.ActionType === 'FixDeficiency' ? '#fef3c7' : '#e0e7ff', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    fontSize: '18px',
                    flexShrink: 0
                  }}>
                    {h.ActionType === 'Created' ? '📝' : 
                     h.ActionType === 'Approved' ? '✅' : 
                     h.ActionType === 'Rejected' ? '❌' : 
                     h.ActionType === 'FixDeficiency' ? '🔧' : '📋'}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 'bold', marginBottom: '4px', color: h.ActionType === 'FixDeficiency' ? '#f59e0b' : '#111827' }}>
                      {h.ActionType === 'Created' ? 'ایجاد پرونده' : 
                       h.ActionType === 'Approved' ? 'تایید پرونده' :
                       h.ActionType === 'Rejected' ? 'رد پرونده' :
                       h.ActionType === 'FixDeficiency' ? 'رفع نقص - ارجاع به مرحله قبل' : h.ActionType}
                    </div>
                    <div style={{ fontSize: '13px', color: '#6b7280', marginBottom: '4px' }}>
                      توسط: {h.ActionByUserFullName || h.ActionByUserName || 'سیستم'}
                      {h.ActionByRole && !isAdminRoleName(h.ActionByRole) && ` (${h.ActionByRole})`}
                    </div>
                    {h.Notes && (
                      <div style={{ fontSize: '13px', color: '#374151', marginTop: '8px', padding: '8px', background: '#f9fafb', borderRadius: '4px' }}>
                        {h.Notes}
                      </div>
                    )}
                    <div style={{ fontSize: '12px', color: '#9ca3af', marginTop: '8px' }}>
                      {formatDate(h.CreatedAt)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Action Buttons - Bottom Section */}
      {currentStep && permissions['approve_request']?.canView && (
        <div style={{ 
          marginTop: '40px', 
          padding: '24px', 
          background: 'white',
          border: '2px solid #e5e7eb',
          borderRadius: '12px',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
        }}>
          <h3 style={{ 
            margin: '0 0 20px 0', 
            fontSize: '18px', 
            color: '#374151',
            borderBottom: '2px solid #e5e7eb',
            paddingBottom: '12px'
          }}>
            🎯 عملیات پرونده
          </h3>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
            {/* For label specialists, use special approval handler */}
            {isLabelSpecialist ? (
              <button
                onClick={() => {
                  console.log('🔘 Label specialist approval button clicked')
                  console.log('🔘 Setting modal with isLabelSpecialist: true')
                  setDecisionModal({ stepId: currentStep.Id, decision: 'Approved', isLabelSpecialist: true })
                }}
                style={{
                  padding: '14px 32px',
                  background: '#10b981',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '16px',
                  fontWeight: 'bold',
                  boxShadow: '0 2px 4px rgba(16, 185, 129, 0.3)',
                  transition: 'all 0.2s ease'
                }}
                onMouseOver={(e) => e.target.style.transform = 'translateY(-2px)'}
                onMouseOut={(e) => e.target.style.transform = 'translateY(0)'}
              >
                ✅ الصاق برچسب و تایید
              </button>
            ) : (
              <>
                <button
                  onClick={() => setDecisionModal({ stepId: currentStep.Id, decision: 'Approved' })}
                  style={{
                    padding: '14px 32px',
                    background: '#10b981',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '16px',
                    fontWeight: 'bold',
                    boxShadow: '0 2px 4px rgba(16, 185, 129, 0.3)',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseOver={(e) => e.target.style.transform = 'translateY(-2px)'}
                  onMouseOut={(e) => e.target.style.transform = 'translateY(0)'}
                >
                  ✅ تایید درخواست
                </button>
                <button
                  onClick={() => setFixDeficiencyModal({ stepId: currentStep.Id })}
                  style={{
                    padding: '14px 32px',
                    background: '#f59e0b',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '16px',
                    fontWeight: 'bold',
                    boxShadow: '0 2px 4px rgba(245, 158, 11, 0.3)',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseOver={(e) => e.target.style.transform = 'translateY(-2px)'}
                  onMouseOut={(e) => e.target.style.transform = 'translateY(0)'}
                >
                  🔧 رفع نقص
                </button>
                <button
                  onClick={() => setDecisionModal({ stepId: currentStep.Id, decision: 'Rejected' })}
                  style={{
                    padding: '14px 32px',
                    background: '#ef4444',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '16px',
                    fontWeight: 'bold',
                    boxShadow: '0 2px 4px rgba(239, 68, 68, 0.3)',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseOver={(e) => e.target.style.transform = 'translateY(-2px)'}
                  onMouseOut={(e) => e.target.style.transform = 'translateY(0)'}
                >
                  ❌ رد درخواست
                </button>
              </>
            )}
          </div>
        </div>
      )}

      <style>{`
        .info-item {
          padding: 12px;
          background: #f9fafb;
          border-radius: 6px;
          border: 1px solid #e5e7eb;
        }
        .info-label {
          font-size: 12px;
          color: #6b7280;
          margin-bottom: 4px;
        }
        .info-value {
          font-weight: bold;
          color: #111827;
        }
      `}</style>
    </div>
  )
}
