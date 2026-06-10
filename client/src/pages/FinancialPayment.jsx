import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams, Link } from 'react-router-dom';
import { api, initAuthFromStorage, normalizedApiBaseUrl } from '../lib/api';
import { checkPermission, loadUserPermissions } from '../lib/permissions.js';
import { computeInvoiceSecurityCode, INVOICE_SECURITY_FORMULA_STEPS } from '../lib/invoiceSecurityCode.js';
import { paymentService } from '../services/paymentService';
import { toast } from 'react-toastify';
import { formatNumber, parseNumberLike } from '../lib/number';
import { normalizeDigits } from '../lib/string';
 
import DatePicker from 'react-multi-date-picker';
import persian from 'react-date-object/calendars/persian';
import persian_fa from 'react-date-object/locales/persian_fa';
import DateObject from 'react-date-object';
import { QRCodeSVG } from 'qrcode.react';

export default function FinancialPayment() {
  // Open a new window with only the printable content to avoid blank print issues
  const handlePrintInvoice = () => {
    try {
      const node = printRef.current
      if (!node) {
        console.warn('Printable node not found')
        window.print()
        return
      }
      const printContents = node.innerHTML
      const printWindow = window.open('', '_blank')
      if (!printWindow) {
        // Popup blocked; fallback
        window.print()
        return
      }
      printWindow.document.open()
      printWindow.document.write(`<!doctype html>
<html lang="fa" dir="rtl">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>چاپ فاکتور پرداخت</title>
<style>
  body { font-family: Vazirmatn, Tahoma, Arial, sans-serif; color:#000; background:#fff; margin:0; padding:24px; }
  .payment-header { border-bottom:2px solid #000; margin-bottom:16px; padding-bottom:8px; }
  table { border-collapse:collapse; width:100%; }
  table.payment-info td, table.payment-items td, table.payment-items th { border:1px solid #000; padding:8px; }
  table.payment-items th { background:#f0f0f0; }
  .total-label, .total-amount { font-weight:bold; }
  .payment-qr-section { margin-top:16px; }
  .payment-qr-security-row { display:flex; flex-direction:row-reverse; gap:20px; align-items:flex-start; }
  .payment-security-code-box { border:2px solid #000; padding:10px; }
  .payment-security-code-value { font-size:22px; font-weight:bold; letter-spacing:0.1em; }
  .payment-security-formula summary { display:none; }
  .payment-security-formula ol { font-size:9px; }
  /* Hide non-print elements */
  .no-print, .payment-method, .payment-actions, .withdraw-box, button, .btn { display: none !important; }
  @page { size: A4; margin: 15mm; }
  @media print {
    * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
</style>
</head>
<body>
<div class="print-root">${printContents}</div>
<script>
  window.addEventListener('load', function(){
    setTimeout(function(){ window.print(); window.close(); }, 100);
  });
</script>
</body>
</html>`)
      printWindow.document.close()
      printWindow.focus()
    } catch (e) {
      console.error('Print failed, falling back to window.print()', e)
      window.print()
    }
  }
  const { state } = useLocation()
  const [searchParams] = useSearchParams()
  
  // Read trackingNo from both state (navigation) and URL query parameters
  const trackingNo = state?.trackingNo || searchParams.get('trackingNo') || ''
  const stateRequestId = state?.requestId || searchParams.get('requestId') || null
  const invoiceViewOnly = state?.invoiceViewOnly === true
  // Hardcoded seller (organization) information
  const ORG_INFO = {
    name: 'سازمان مدیریت حمل و نقل بار شهرداری تبریز ',
    province: 'آذربایجان شرقی',
    city: 'تبریز',
    address: 'تبریز-میدان آذربایجان-پشت شرکت شیر پاستوریزه پگاه-جاده باقرخان(سبزی کاران)-',
    postalCode: '5173865957',
    economicCode: '15835839314',
    nationalId: '14006722170',
    phone: '041-34751597',
    registrationNo: '',
    logoUrl: null
  }
  const [org, setOrg] = useState(ORG_INFO)
  const [buyer, setBuyer] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [vehicle, setVehicle] = useState(null)
  const [company, setCompany] = useState(null) // For legal entity (حقوقی) requests
  const [tariffs, setTariffs] = useState([])
  const [selectedTariff, setSelectedTariff] = useState(null)
  const [paymentHistory, setPaymentHistory] = useState({ online: [], offline: [] })
  const [requestId, setRequestId] = useState(null)
  const [discountInfo, setDiscountInfo] = useState(null)
  const [requestDetails, setRequestDetails] = useState(null)
  const [hasDeficiency, setHasDeficiency] = useState(false)
  const [submittingCorrections, setSubmittingCorrections] = useState(false)
  const [workflowSteps, setWorkflowSteps] = useState([])
  const [canAccessPayment, setCanAccessPayment] = useState(false)
  const [trainingFee, setTrainingFee] = useState(0) // Training fee for exploitation licenses
  const [permissionsLoaded, setPermissionsLoaded] = useState(false)
  const navigate = useNavigate()
  const printRef = useRef(null)

  useEffect(() => {
    loadUserPermissions().then(() => setPermissionsLoaded(true))
  }, [])

  const showPaymentManageActions = permissionsLoaded && checkPermission('view_payments', true) && !invoiceViewOnly

  useEffect(() => {
    (async () => {
      try {
        initAuthFromStorage()
        // Buyer info will be loaded from request details (applicant info)

        let reqId = stateRequestId // Try to use requestId from state first
        
        let resolvedVehicle = null

        // Try to load vehicle by tracking (for activity licenses)
        if (trackingNo) {
          try {
            const veh = await api.get(`/api/vehicles/by-tracking/${encodeURIComponent(trackingNo)}`)
            resolvedVehicle = veh.data || null
            setVehicle(resolvedVehicle)
            console.log('🚗 Vehicle data received (by tracking):', veh.data)
            
            // Get RequestID from vehicle/tracking data (check both cases)
            if (!reqId) {
              reqId = veh.data?.RequestID || veh.data?.requestId
            }
          } catch (err) {
            console.warn('⚠️ Vehicle not found by tracking number (might be employment license):', err.response?.status)
            // For employment licenses, we need to get RequestID from request details first
            // So we'll try to find the request by tracking number
            try {
              const reqByTracking = await api.get(`/api/requests/by-tracking/${encodeURIComponent(trackingNo)}`)
              if (reqByTracking.data) {
                reqId = reqByTracking.data.RequestID
                console.log('📋 RequestID found by tracking:', reqId)
              }
            } catch (err2) {
              console.warn('⚠️ Could not find request by tracking number:', err2)
            }
          }
        }
        
        if (reqId) {
          console.log('📋 RequestID found:', reqId)
          setRequestId(reqId)
          
          // Load request details (license type, operation type, etc.)
          try {
            const reqDetails = await api.get(`/api/requests/${reqId}`)
            setRequestDetails(reqDetails.data)
            console.log('📋 Request details loaded:', reqDetails.data)
            
            // Load applicant (buyer) information from Persons table
            // For legal entity requests, load manager info; for individual requests, load person info
            // Check both PascalCase and camelCase (backend sends PascalCase)
            const companyNationalId = reqDetails.data?.CompanyNationalId || reqDetails.data?.companyNationalId;
            const nationalCode = reqDetails.data?.NationalCode || reqDetails.data?.nationalCode;
            
            if (companyNationalId) {
              // Legal entity request - load company and manager info
              try {
                console.log('🏢 Loading company by national ID:', companyNationalId)
                const companyData = await api.get(`/api/issue/company/${encodeURIComponent(companyNationalId)}`)
                console.log('🏢 Company data received:', companyData.data)
                
                // Store company data for display
                if (companyData.data?.company) {
                  setCompany(companyData.data.company)
                  console.log('✅ Company info stored:', companyData.data.company.CompanyName, companyData.data.company.NationalId)
                }
                
                if (companyData.data?.company && companyData.data.company.ManagerNationalCode) {
                  console.log('👤 Loading manager by national code:', companyData.data.company.ManagerNationalCode)
                  const managerData = await api.get(`/api/persons/by-national-code/${encodeURIComponent(companyData.data.company.ManagerNationalCode)}`)
                  console.log('👤 Manager data received:', managerData.data)
                  
                  if (managerData.data?.person) {
                    setBuyer({
                      nationalCode: managerData.data.person.NationalCode,
                      firstName: managerData.data.person.FirstName,
                      lastName: managerData.data.person.LastName,
                      phone: managerData.data.person.MobileNumber || '',
                      companyName: companyData.data.company.CompanyName
                    })
                    console.log('✅ Buyer (manager) info loaded successfully:', managerData.data.person.FirstName, managerData.data.person.LastName)
                  } else {
                    console.warn('⚠️ Manager person data not found in response')
                  }
                } else {
                  console.warn('⚠️ Company data does not have ManagerNationalCode field. Available fields:', Object.keys(companyData.data?.company || {}))
                }
              } catch (err) {
                console.error('❌ Error loading manager info for legal entity request:', err)
                console.error('❌ Error details:', err.response?.data || err.message)
              }
            } else if (nationalCode) {
              // Individual request - load person info
              try {
                console.log('👤 Loading person by national code:', nationalCode)
                const personData = await api.get(`/api/persons/by-national-code/${encodeURIComponent(nationalCode)}`)
                console.log('👤 Person data received:', personData.data)
                
                if (personData.data?.person) {
                  setBuyer({
                    nationalCode: personData.data.person.NationalCode,
                    firstName: personData.data.person.FirstName,
                    lastName: personData.data.person.LastName,
                    phone: personData.data.person.MobileNumber || ''
                  })
                  console.log('✅ Buyer (applicant) info loaded successfully:', personData.data.person.FirstName, personData.data.person.LastName)
                } else {
                  console.warn('⚠️ Person data not found in response')
                }
              } catch (err) {
                console.error('❌ Error loading person info for individual request:', err)
                console.error('❌ Error details:', err.response?.data || err.message)
              }
            } else {
              console.warn('⚠️ Request has neither companyNationalId nor nationalCode - cannot load buyer info')
              console.warn('⚠️ Request data fields:', Object.keys(reqDetails.data || {}))
            }
            
            // Always load full vehicle record (includes plate fields) when request has VehicleID
            if (reqDetails.data?.VehicleID) {
              try {
                const vehicleByRequestVehicleId = await api.get(`/api/vehicles/${encodeURIComponent(reqDetails.data.VehicleID)}`)
                if (vehicleByRequestVehicleId.data) {
                  resolvedVehicle = vehicleByRequestVehicleId.data
                  setVehicle(resolvedVehicle)
                  console.log('🚗 Vehicle loaded by request VehicleID:', vehicleByRequestVehicleId.data)
                }
              } catch (err) {
                console.warn('⚠️ Could not load vehicle by request VehicleID:', err)
              }
            }

            // Fallback only when request vehicle could not be resolved
            if (reqDetails.data?.NationalCode && !resolvedVehicle) {
              try {
                const vehicleByNationalCode = await api.get(`/api/vehicles/by-national-code/${encodeURIComponent(reqDetails.data.NationalCode)}`)
                if (vehicleByNationalCode.data) {
                  resolvedVehicle = vehicleByNationalCode.data
                  setVehicle(resolvedVehicle)
                  console.log('🚗 Vehicle loaded by national code (fallback):', vehicleByNationalCode.data)
                }
              } catch (err) {
                console.warn('⚠️ Could not load vehicle by national code fallback:', err)

                // If vehicle not found, try to load company information (for legal entity requests)
                try {
                  const companyByNationalCode = await api.get(`/api/companies/by-owner/${encodeURIComponent(reqDetails.data.NationalCode)}`)
                  if (companyByNationalCode.data?.company) {
                    setCompany(companyByNationalCode.data.company)
                    console.log('🏢 Company loaded by national code:', companyByNationalCode.data.company)
                    
                    // Create a vehicle-like object with Capacity from company's TonnageRate
                    // This allows the tariff calculation logic to work without changes
                    const vehicleLikeObject = {
                      VehicleID: null,
                      Capacity: companyByNationalCode.data.company.Capacity || companyByNationalCode.data.company.TonnageRateName,
                      IsCompany: true, // Flag to indicate this is company data
                      CompanyName: companyByNationalCode.data.company.CompanyName,
                      NationalId: companyByNationalCode.data.company.NationalId
                    }
                    resolvedVehicle = vehicleLikeObject
                    setVehicle(vehicleLikeObject)
                    console.log('🏢 Created vehicle-like object from company data:', vehicleLikeObject)
                  }
                } catch (companyErr) {
                  console.warn('⚠️ Could not load company by national code:', companyErr)
                }
              }
            }
          } catch (err) {
            console.warn('⚠️ Could not load request details:', err)
          }
          
          // Load workflow steps to check approval status
          await loadWorkflowSteps(reqId)
          // Load payment history for this request
          await loadPaymentHistory(reqId)
          // Load discount information
          await loadDiscountInfo(reqId)
          // Load deficiency status
          await loadDeficiencyStatus(reqId)
        } else {
          console.warn('⚠️ No RequestID found in vehicle data or state')
        }
        
        // Load tariffs
        const tf = await api.get('/api/tariffs')
        setTariffs(tf.data || [])
        
        // Load training fee from lookup (for exploitation licenses)
        try {
          const lookupValues = await api.get('/api/lookups/values?categoryKey=OperatingLicenseTrainingFee')
          if (lookupValues.data && lookupValues.data.length > 0) {
            // Get the first active value
            const trainingFeeValue = lookupValues.data.find(v => v.IsActive)
            if (trainingFeeValue) {
              // The fee amount should be stored in the Code or ExtraJson field
              const feeAmount = Number(trainingFeeValue.Code) || 0
              setTrainingFee(feeAmount)
              console.log('💰 Training fee loaded from lookup:', feeAmount)
            }
          }
        } catch (err) {
          console.warn('⚠️ Could not load training fee from lookup:', err)
          // Default to 0 if lookup fails
          setTrainingFee(0)
        }
      } catch (e) {
        console.warn(e)
        setError('خطا در دریافت اطلاعات پرداخت')
      } finally {
        setLoading(false)
      }
    })()
  }, [trackingNo, stateRequestId])

  const loadWorkflowSteps = async (reqId) => {
    try {
      console.log('📋 Loading workflow steps for RequestID:', reqId)
      const response = await api.get(`/api/workflow/requests/${reqId}/steps`)
      const steps = response.data || []
      setWorkflowSteps(steps)
      console.log('✅ Workflow steps loaded:', steps)
      
      // Check if this is an exploitation license request
      if (requestDetails?.LicenseTypeId === 68 || trackingNo?.startsWith('100-')) {
        // For exploitation licenses, check if Step 2 (کارشناس تایید محل) is approved
        const step2 = steps.find(s => s.StepOrder === 2 && s.RoleName === 'کارشناس تایید محل')
        
        if (step2 && step2.Status === 'Approved') {
          console.log('✅ Step 2 (کارشناس تایید محل) is approved - payment access granted')
          setCanAccessPayment(true)
        } else {
          console.log('⚠️ Step 2 (کارشناس تایید محل) not yet approved - payment access denied')
          setCanAccessPayment(false)
        }
      } else {
        // For other license types, allow payment access (existing behavior)
        setCanAccessPayment(true)
      }
    } catch (e) {
      console.error('❌ Error loading workflow steps:', e)
      // On error, default to allowing access to maintain backward compatibility
      setCanAccessPayment(true)
    }
  }

  const loadPaymentHistory = async (reqId) => {
    try {
      console.log('💳 Loading payment history for RequestID:', reqId)
      
      // Fetch online payments
      const onlineRes = await api.get(`/api/payments/online?requestId=${reqId}`)
      console.log('✅ Online payments loaded:', onlineRes.data)
      
      // Fetch offline payments  
      const offlineRes = await api.get(`/api/payments/offline?requestId=${reqId}`)
      console.log('✅ Offline payments loaded:', offlineRes.data)
      
      setPaymentHistory({
        online: onlineRes.data || [],
        offline: offlineRes.data || []
      })
      
      console.log('📊 Payment history state updated')
    } catch (e) {
      console.error('❌ Error loading payment history:', e)
      console.error('Error details:', e.response?.data || e.message)
    }
  }

  const loadDiscountInfo = async (reqId) => {
    try {
      console.log('💰 Loading discount info for RequestID:', reqId)
      const res = await api.get(`/api/discounts/request/${reqId}`)
      setDiscountInfo(res.data)
    } catch (e) {
      console.error('Error loading discount info:', e)
    }
  }

  const loadDeficiencyStatus = async (reqId) => {
    try {
      console.log('🔍 Loading deficiency status for RequestID:', reqId)
      const res = await api.get(`/api/workflow/requests/${reqId}/deficiency-status`)
      console.log('📋 Deficiency status response:', res.data)
      const deficiencyStatus = res.data?.hasDeficiency || false
      setHasDeficiency(deficiencyStatus)
      console.log('✅ HasDeficiency set to:', deficiencyStatus)
    } catch (e) {
      console.error('❌ Error loading deficiency status:', e)
      console.error('Error details:', e.response?.data)
      setHasDeficiency(false)
    }
  }

  const handleSubmitCorrections = async () => {
    console.log('🚀 Submit corrections button clicked')
    console.log('📋 Current requestId:', requestId)
    console.log('📋 Current hasDeficiency:', hasDeficiency)
    
    if (!requestId) {
      console.error('❌ No requestId available')
      toast.error('شناسه درخواست یافت نشد')
      return
    }

    if (!window.confirm('آیا از ارسال پرونده جهت بررسی مجدد اطمینان دارید؟')) {
      console.log('⚠️ User cancelled submission')
      return
    }

    try {
      setSubmittingCorrections(true)
      console.log('📤 Sending POST request to submit corrections...')
      const response = await api.post(`/api/workflow/requests/${requestId}/submit-corrections`)
      console.log('✅ Corrections submitted successfully:', response.data)
      toast.success('پرونده با موفقیت جهت بررسی ارسال شد')
      
      // Redirect to user inbox after a short delay
      console.log('🔄 Redirecting to inbox in 1.5 seconds...')
      setTimeout(() => {
        console.log('➡️ Navigating to /workflow/inbox')
        navigate('/workflow/inbox')
      }, 1500)
    } catch (e) {
      console.error('❌ Error submitting corrections:', e)
      console.error('Error response:', e.response?.data)
      toast.error(e?.response?.data?.message || 'خطا در ارسال پرونده')
    } finally {
      setSubmittingCorrections(false)
    }
  }

  // Helpers to normalize and parse numeric strings possibly containing Persian/Arabic digits
  function normalizeDigits(str) {
    if (str == null) return ''
    const map = {
      '۰': '0','۱': '1','۲': '2','۳': '3','۴': '4','۵': '5','۶': '6','۷': '7','۸': '8','۹': '9',
      '٠': '0','١': '1','٢': '2','٣': '3','٤': '4','٥': '5','٦': '6','٧': '7','٨': '8','٩': '9'
    }
    return String(str).split('').map(ch => map[ch] ?? ch).join('')
  }
  function parseNumberLike(str) {
    const s = normalizeDigits(str).replace(/[\s,]+/g, '').replace(/٫/g, '.')
    const n = Number(s)
    return isNaN(n) ? null : n
  }

  // Calculate error message when items cannot be calculated
  const [calculationError, setCalculationError] = useState('')
  
  // Build dynamic items using tariffs, vehicle capacity, and document type
  const items = useMemo(() => {
    if (!requestDetails) {
      return []
    }
    
    // For exploitation licenses (بهره برداری), use the pre-calculated amount from the request
    // because vehicle data may not exist in the Vehicles table
    const isExploitationLicense = requestDetails.LicenseTypeName?.includes('بهره') || 
                                   requestDetails.LicenseTypeName?.includes('برداری') ||
                                   requestDetails.LicenseTypeId === 68
    
    if (isExploitationLicense && requestDetails.OriginalAmount) {
      const amount = Number(requestDetails.OriginalAmount || 0)
      const training = Number(trainingFee || 0)
      // Calculate VAT from sum of amount + training fee
      const subtotal = amount + training
      const vat = Math.round(subtotal * 0.10)
      const licenseTypeName = requestDetails.LicenseTypeName || 'پروانه بهره برداری'
      const operationTypeName = requestDetails.OperationTypeName || 'صدور'
      
      // Include tonnage range in the title if available
      const fromTon = requestDetails.TonnageFromTon
      const toTon = requestDetails.TonnageToTon
      let title = `${operationTypeName} ${licenseTypeName}`
      
      if (fromTon != null && toTon != null) {
        title = `${operationTypeName} ${licenseTypeName} از ${fromTon} تا ${toTon} تن`
      }
      
      console.log('💰 Using pre-calculated amount for exploitation license:', { 
        amount, 
        training,
        subtotal,
        vat,
        licenseTypeName,
        operationTypeName,
        fromTon,
        toTon,
        title
      })
      
      // Update selectedTariff state
      const newTariff = {
        id: 'precalculated',
        title,
        price: amount + training + vat,
        originalAmount: amount,
        trainingFee: training,
        vatAmount: vat
      }
      
      setSelectedTariff(prev => {
        if (!prev || JSON.stringify(prev) !== JSON.stringify(newTariff)) {
          return newTariff
        }
        return prev
      })
      
      // Build items array with training fee
      const itemsArray = [
        { title, amount, desc: '' }
      ]
      
      // Add training fee if it exists
      if (training > 0) {
        itemsArray.push({ title: 'هزینه آموزش', amount: training, desc: '' })
      }
      
      // Add VAT calculated from subtotal
      itemsArray.push({ title: 'درصد مالیات ارزش افزوده 10', amount: vat, desc: '' })
      
      return itemsArray
    }
    
    // For other license types, calculate tariff from vehicle data
    if (!vehicle) {
      return []
    }
    
    if (!tariffs?.length) {
      return []
    }

    // Guard against mixing another vehicle of the same owner in pricing calculation
    if (requestDetails.VehicleID && vehicle.VehicleID && Number(requestDetails.VehicleID) !== Number(vehicle.VehicleID)) {
      console.error('⚠️ Vehicle mismatch for tariff calculation', {
        requestVehicleId: requestDetails.VehicleID,
        loadedVehicleId: vehicle.VehicleID
      })
      return []
    }
    
    const cap = parseNumberLike(vehicle.Capacity)
    if (cap == null) {
      return []
    }
    
    // Get document type ID from request details (for employment license, this is the operation type)
    const docTypeId = requestDetails.OperationTypeId || requestDetails.LicenseTypeId
    
    // Determine license type name from request details
    const licenseTypeName = requestDetails.LicenseTypeName || ''
    
    console.log('💰 Calculating tariff for:', { 
      cap, 
      docTypeId, 
      licenseTypeName,
      requestLicenseTypeId: requestDetails.LicenseTypeId,
      requestOperationTypeId: requestDetails.OperationTypeId
    })
    
    // Find matching tariff based on DocTypeId, LicenseType string, and capacity
    let match = null
    for (const t of tariffs) {
      // Match DocTypeId (this is the operation type like "صدور")
      const tariffDocTypeId = t.DocTypeId || t.docTypeId
      if (tariffDocTypeId !== docTypeId) {
        console.log(`⏭️ Skipping tariff ${t.Id}: DocTypeId mismatch (${tariffDocTypeId} !== ${docTypeId})`)
        continue
      }
      
      // Match LicenseType string (like "پروانه اشتغال" or "پروانه فعالیت")
      const tariffLicenseType = (t.LicenseType || t.licenseType || '').trim()
      const isEmploymentLicense = licenseTypeName.includes('اشتغال') || licenseTypeName === 'اشتغال'
      const isActivityLicense = licenseTypeName.includes('فعالیت') || licenseTypeName === 'فعالیت'
      
      const tariffIsEmployment = tariffLicenseType.includes('اشتغال')
      const tariffIsActivity = tariffLicenseType.includes('فعالیت')
      
      // Check if license types match
      if (isEmploymentLicense && !tariffIsEmployment) {
        console.log(`⏭️ Skipping tariff ${t.Id}: LicenseType mismatch (need employment, got ${tariffLicenseType})`)
        continue
      }
      if (isActivityLicense && !tariffIsActivity) {
        console.log(`⏭️ Skipping tariff ${t.Id}: LicenseType mismatch (need activity, got ${tariffLicenseType})`)
        continue
      }
      
      // Match capacity range
      const from = parseNumberLike(t.FromTon ?? t.fromTon)
      const to = parseNumberLike(t.ToTon ?? t.toTon)
      const fromOk = (from == null) ? true : cap >= from
      const toOk = (to == null) ? true : cap <= to
      
      console.log(`🔍 Checking tariff ${t.Id}: capacity ${cap} in range [${from}, ${to}]? fromOk=${fromOk}, toOk=${toOk}`)
      
      if (fromOk && toOk) { 
        match = t
        console.log('✅ Matching tariff found:', match)
        break 
      }
    }
    
    if (match) {
      const amount = Number(match.Amount ?? match.amount ?? 0)
      // Use request details for license type and operation type names (not from tariff)
      const licenseTypeName = requestDetails.LicenseTypeName || licenseTypeName || 'پروانه'
      const operationTypeName = requestDetails.OperationTypeName || 'صدور'
      const title = `${operationTypeName} ${licenseTypeName} از ${(match.FromTon ?? match.fromTon) || ''} تا ${(match.ToTon ?? match.toTon) || ''} تن`
      const vat = Math.round(amount * 0.10)
      
      // Update selectedTariff state if not already set or if it has changed
      const newTariff = {
        id: match.Id || match.id,
        title,
        price: amount + vat, // Include VAT in the total price
        originalAmount: amount,
        vatAmount: vat
      }
      
      setSelectedTariff(prev => {
        // Only update if the tariff has changed
        if (!prev || JSON.stringify(prev) !== JSON.stringify(newTariff)) {
          return newTariff
        }
        return prev
      })
      
      return [
        { title, amount, desc: '' },
        { title: 'درصد مالیات ارزش افزوده 10', amount: vat, desc: '' }
      ]
    }
    
    // If no matching tariff found, clear the selected tariff
    if (selectedTariff) {
      setSelectedTariff(null)
    }
    
    console.warn('⚠️ No matching tariff found for:', { cap, licenseTypeName: requestDetails.LicenseTypeName, operationTypeName: requestDetails.OperationTypeName })
    return []
  }, [vehicle, tariffs, requestDetails, trainingFee])
  const total = useMemo(() => items.reduce((s, it) => s + (it.amount || 0), 0), [items])

  // Detect calculation errors and set appropriate error messages
  useEffect(() => {
    // Clear error when loading
    if (loading) {
      setCalculationError('')
      return
    }
    
    // If items are successfully calculated, clear any error
    if (items.length > 0) {
      setCalculationError('')
      console.log('✅ Payment amount successfully calculated:', { itemCount: items.length, total })
      return
    }
    
    // If we reach here, items is empty and not loading - detect why
    // Set a timeout to show error after a reasonable wait (3 seconds)
    const timeoutId = setTimeout(() => {
      console.group('❌ PAYMENT CALCULATION ERROR - Technical Debug Info')
      console.log('Current state:', {
        loading,
        hasRequestDetails: !!requestDetails,
        hasVehicle: !!vehicle,
        hasTariffs: !!tariffs,
        tariffsCount: tariffs?.length || 0,
        trackingNo,
        requestId
      })
      
      if (!requestDetails) {
        console.error('⚠️ ERROR: requestDetails is missing')
        console.log('Available data:', { trackingNo, requestId })
        console.log('Possible causes:')
        console.log('  1. Request not found by tracking number')
        console.log('  2. API call to /api/requests/{id} failed')
        console.log('  3. RequestID not extracted from vehicle or tracking data')
        console.groupEnd()
        setCalculationError('اطلاعات درخواست بارگذاری نشده است. لطفاً صفحه را مجدداً باز کنید.')
        return
      }
      
      console.log('Request Details:', {
        LicenseTypeName: requestDetails.LicenseTypeName,
        LicenseTypeId: requestDetails.LicenseTypeId,
        OperationTypeName: requestDetails.OperationTypeName,
        OperationTypeId: requestDetails.OperationTypeId,
        OriginalAmount: requestDetails.OriginalAmount,
        NationalCode: requestDetails.NationalCode
      })
      
      const isExploitationLicense = requestDetails.LicenseTypeName?.includes('بهره') || 
                                     requestDetails.LicenseTypeName?.includes('برداری') ||
                                     requestDetails.LicenseTypeId === 68
      
      console.log('License Type Detection:', { isExploitationLicense })
      
      // For exploitation licenses, check if OriginalAmount exists
      if (isExploitationLicense && !requestDetails.OriginalAmount) {
        console.error('⚠️ ERROR: Exploitation license without OriginalAmount')
        console.log('Exploitation license requires OriginalAmount field in requestDetails')
        console.log('This should be calculated during request submission')
        console.groupEnd()
        setCalculationError('مبلغ پروانه بهره‌برداری محاسبه نشده است. لطفاً با واحد مالی تماس بگیرید.')
        return
      }
      
      // For other licenses, check vehicle/company data
      if (!vehicle) {
        console.error('⚠️ ERROR: Vehicle/Company data is missing')
        console.log('Attempted to load vehicle by:')
        console.log('  1. Tracking number:', trackingNo)
        console.log('  2. National code:', requestDetails.NationalCode)
        console.log('Possible causes:')
        console.log('  1. Vehicle not found in database')
        console.log('  2. API call to /api/vehicles/by-tracking or /api/vehicles/by-national-code failed')
        console.log('  3. For legal entities: Company not found or API call to /api/companies/by-owner failed')
        console.log('  4. Vehicle/Company data incomplete in previous steps')
        console.groupEnd()
        setCalculationError('اطلاعات خودرو یا شرکت بارگذاری نشده است. لطفاً مطمئن شوید که تمام اطلاعات مورد نیاز را در مراحل قبل وارد کرده‌اید.')
        return
      }
      
      console.log('Vehicle/Company Data:', {
        Capacity: vehicle.Capacity,
        IsCompany: vehicle.IsCompany,
        VehicleID: vehicle.VehicleID,
        CompanyName: vehicle.CompanyName,
        NationalId: vehicle.NationalId
      })
      
      if (!tariffs?.length) {
        console.error('⚠️ ERROR: Tariffs list is empty')
        console.log('API call to /api/tariffs returned no data')
        console.log('Possible causes:')
        console.log('  1. No tariffs defined in database')
        console.log('  2. API endpoint failed to load tariffs')
        console.log('  3. Database connection issue')
        console.groupEnd()
        setCalculationError('لیست تعرفه‌ها بارگذاری نشده است. لطفاً صفحه را مجدداً بارگذاری کنید یا با پشتیبانی تماس بگیرید.')
        return
      }
      
      const cap = parseNumberLike(vehicle.Capacity)
      if (cap == null) {
        console.error('⚠️ ERROR: Invalid vehicle capacity')
        console.log('Raw Capacity value:', vehicle.Capacity)
        console.log('Parsed value:', cap)
        console.log('Capacity must be a numeric value (e.g., "5", "10", "۱۰")')
        console.log('Possible causes:')
        console.log('  1. Capacity field contains non-numeric text')
        console.log('  2. Capacity field is empty or null')
        console.log('  3. Capacity format not recognized by parseNumberLike()')
        console.groupEnd()
        setCalculationError(`ظرفیت خودرو نامعتبر است (${vehicle.Capacity}). لطفاً ظرفیت صحیح را در مشخصات خودرو وارد کنید.`)
        return
      }
      
      // If we reach here, no matching tariff was found
      console.error('⚠️ ERROR: No matching tariff found')
      console.log('Search criteria:', {
        capacity: cap,
        licenseTypeName: requestDetails.LicenseTypeName,
        licenseTypeId: requestDetails.LicenseTypeId,
        operationTypeName: requestDetails.OperationTypeName,
        operationTypeId: requestDetails.OperationTypeId
      })
      console.log('Available tariffs:', tariffs.map(t => ({
        Id: t.Id,
        LicenseType: t.LicenseType,
        DocTypeId: t.DocTypeId,
        FromTon: t.FromTon,
        ToTon: t.ToTon,
        Amount: t.Amount
      })))
      console.log('Matching criteria:')
      console.log('  1. DocTypeId must match OperationTypeId')
      console.log('  2. LicenseType string must match LicenseTypeName')
      console.log('  3. Vehicle capacity must be within FromTon and ToTon range')
      console.log('Possible solutions:')
      console.log('  1. Add a tariff with matching DocTypeId:', requestDetails.OperationTypeId)
      console.log('  2. Ensure tariff LicenseType matches:', requestDetails.LicenseTypeName)
      console.log('  3. Add tariff covering capacity:', cap, 'tons')
      console.groupEnd()
      
      const licenseTypeName = requestDetails.LicenseTypeName || 'نامشخص'
      const operationTypeName = requestDetails.OperationTypeName || 'نامشخص'
      setCalculationError(
        `هیچ تعرفه‌ای برای ${operationTypeName} ${licenseTypeName} با ظرفیت ${cap} تن پیدا نشد. لطفاً با واحد مالی تماس بگیرید یا مشخصات خودرو را بررسی کنید.`
      )
    }, 3000) // Wait 3 seconds before showing error
    
    return () => clearTimeout(timeoutId)
  }, [loading, items, requestDetails, vehicle, tariffs, total])

  const toFarsiNumber = (num) => {
    if (num === null || num === undefined) return ''
    return String(num).replace(/[0-9]/g, d => '۰۱۲۳۴۵۶۷۸۹'[d])
  }

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

  const plateDisplay = formatPlate(vehicle)
  const invoiceTrackingNo = trackingNo || requestDetails?.TrackingNo || ''
  const invoiceQrUrl = invoiceTrackingNo
    ? `${window.location.origin}/verify-license/${encodeURIComponent(invoiceTrackingNo)}`
    : ''

  // Use firstName + lastName for buyer name display
  const buyerFirstName = buyer?.firstName || buyer?.FirstName || ''
  const buyerLastName = buyer?.lastName || buyer?.LastName || ''
  const buyerName = buyerFirstName && buyerLastName ? `${buyerFirstName} ${buyerLastName}` : (buyer?.fullName || buyer?.FullName || '')
  const buyerNationalCode = buyer?.nationalCode || buyer?.NationalCode || '';
  
  // Check if this is exploitation or legal entity license
  const isExploitationOrLegalEntity = requestDetails?.CompanyNationalId || 
                                       requestDetails?.LicenseTypeName?.includes('بهره') || 
                                       requestDetails?.LicenseTypeName?.includes('برداری') ||
                                       requestDetails?.LicenseTypeId === 68;
  
  // For exploitation/legal entity licenses, use company info
  const companyName = company?.CompanyName || company?.companyName || '';
  const companyNationalId = company?.NationalId || company?.nationalId || '';

  const invoiceNationalId = isExploitationOrLegalEntity
    ? (companyNationalId || requestDetails?.CompanyNationalId || '')
    : (buyerNationalCode || requestDetails?.NationalCode || '')

  const invoiceSecurityCode = useMemo(() => {
    if (!invoiceTrackingNo || !total || !invoiceNationalId) return ''
    return computeInvoiceSecurityCode({
      trackingNo: invoiceTrackingNo,
      totalAmount: total,
      nationalId: invoiceNationalId,
      vehicle
    })
  }, [invoiceTrackingNo, total, invoiceNationalId, vehicle])

  const invoiceSecurityCodeFarsi = invoiceSecurityCode
    ? invoiceSecurityCode.replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[Number(d)])
    : ''

  // Helper function to safely encode Unicode strings to base64
  const encodeUnicodeToBase64 = (str) => {
    // First, we use encodeURIComponent to get percent-encoded UTF-8,
    // then we convert the percent encodings into raw bytes which can be fed into btoa.
    return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, 
      function toSolidBytes(match, p1) {
        return String.fromCharCode('0x' + p1);
    }));
  };

  // Payment and offline UI state (declare BEFORE any useEffect that references them)
  const [paymentMethod, setPaymentMethod] = useState('online');
  const [isPaying, setIsPaying] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Offline payments state
  const [offlineForm, setOfflineForm] = useState({
    amount: '',
    receiptNo: '',
    payDate: '',
    description: '',
    bankName: '',
    branchName: '',
    imageBase64: '',
    imageFileName: '',
    imageContentType: ''
  });
  const [offlineErrors, setOfflineErrors] = useState({});
  const [offlinePayments, setOfflinePayments] = useState([]);
  const [offlineLoading, setOfflineLoading] = useState(false);

  // -------- Offline payments helpers -------- //
  const loadOfflinePayments = async () => {
    // For exploitation licenses without vehicle, we can still load offline payments by requestId
    if (!trackingNo && !requestId) return;
    try {
      setOfflineLoading(true);
      const params = {};
      
      // Prefer requestId if available (works for all license types)
      if (requestId) {
        params.requestId = requestId;
      } else {
        // Fallback to trackingNo and vehicleId for backward compatibility
        params.trackingNo = trackingNo;
        if (vehicle?.VehicleID) {
          params.vehicleId = vehicle.VehicleID;
        }
      }
      
      const { data } = await api.get('/api/payments/offline', {
        params,
      });
      setOfflinePayments(data || []);
    } catch (error) {
      console.error('Error loading offline payments:', error);
      toast.error('خطا در دریافت لیست پرداخت‌های آفلاین');
    } finally {
      setOfflineLoading(false);
    }
  };

  // Load offline payments on mount
  useEffect(() => {
    // Load when both vehicle and tracking number are ready
    if (trackingNo && vehicle?.VehicleID) {
      loadOfflinePayments();
    }
  }, [trackingNo, vehicle]);

  const onChangeOffline = (field) => (e) => {
    const value = e?.target?.value ?? e;
    setOfflineForm(prev => ({
      ...prev,
      [field]: value
    }));
    
    // Clear error when user types
    if (offlineErrors[field]) {
      setOfflineErrors(prev => ({
        ...prev,
        [field]: ''
      }));
    }
  };

  const validateOfflineForm = () => {
    const errs = {};
    const amt = parseNumberLike(offlineForm.amount);
    if (amt == null || amt <= 0) errs.amount = 'مبلغ نباید خالی باشد';
    if (!offlineForm.receiptNo?.trim()) errs.receiptNo = 'شماره رسید نباید خالی باشد';
    if (!offlineForm.payDate) errs.payDate = 'تاریخ پرداخت را انتخاب کنید';
    if (!offlineForm.imageBase64) errs.image = 'بارگذاری تصویر فیش الزامی است';
    setOfflineErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Check if it's an image
    if (!file.type.startsWith('image/')) {
      const errorMsg = `❌ فایل انتخاب شده مناسب نیست!\n\nفایل انتخابی: ${file.name}\nنوع فایل: ${file.type || 'نامشخص'}\n\nلطفاً فقط فایل‌های تصویری (JPG, PNG, GIF) را انتخاب کنید.`;
      alert(errorMsg);
      toast.error('❌ فایل انتخاب شده مناسب نیست! لطفاً فقط فایل‌های تصویری (JPG, PNG, GIF) را انتخاب کنید.', {
        autoClose: 5000
      });
      setOfflineErrors(prev => ({ ...prev, image: 'فقط فایل‌های تصویری مجاز هستند' }));
      e.target.value = '';
      return;
    }

    // Check file size (2MB max)
    if (file.size > 2 * 1024 * 1024) {
      const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2);
      const errorMsg = `❌ حجم فایل بیش از حد مجاز است!\n\nفایل انتخابی: ${file.name}\nحجم: ${fileSizeMB} مگابایت\nحد مجاز: 2 مگابایت\n\nلطفاً فایلی کمتر از 2 مگابایت انتخاب کنید.`;
      alert(errorMsg);
      toast.error(`❌ حجم فایل (${fileSizeMB} مگابایت) بیش از حد مجاز است! لطفاً فایلی کمتر از 2 مگابایت انتخاب کنید.`, {
        autoClose: 5000
      });
      setOfflineErrors(prev => ({ ...prev, image: `حجم فایل ${fileSizeMB} مگابایت - حداکثر 2 مگابایت` }));
      e.target.value = '';
      return;
    }

    // Check for valid image by trying to load it
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      
      // Check if image is too small (might indicate corrupted file)
      if (img.width < 50 || img.height < 50) {
        const errorMsg = `❌ تصویر انتخاب شده معتبر نیست!\n\nفایل: ${file.name}\nابعاد: ${img.width}x${img.height} پیکسل\n\nتصویر خیلی کوچک یا خراب است.\nلطفاً یک تصویر واضح و کامل از فیش پرداخت انتخاب کنید.`;
        alert(errorMsg);
        toast.error('❌ فایل انتخاب شده معتبر نیست یا خیلی کوچک است. لطفاً یک تصویر واضح از فیش پرداخت انتخاب کنید.', {
          autoClose: 5000
        });
        setOfflineErrors(prev => ({ ...prev, image: 'تصویر خیلی کوچک یا معتبر نیست' }));
        e.target.value = '';
        return;
      }
      
      // File is valid, proceed with upload
      try {
        const reader = new FileReader();
        reader.onload = () => {
          const base64String = reader.result;
          setOfflineForm(prev => ({
            ...prev,
            imageBase64: base64String,
            imageFileName: file.name,
            imageContentType: file.type
          }));
          toast.success(`✅ تصویر فیش با موفقیت انتخاب شد (${file.name})`, {
            autoClose: 3000
          });
        };
        reader.onerror = () => {
          toast.error('❌ خطا در خواندن فایل. لطفاً فایل دیگری انتخاب کنید.', {
            autoClose: 5000
          });
          e.target.value = '';
        };
        reader.readAsDataURL(file);
      } catch (error) {
        console.error('File read error:', error);
        toast.error('❌ خطا در پردازش فایل. لطفاً دوباره تلاش کنید.', {
          autoClose: 5000
        });
        e.target.value = '';
      }
    };
    
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      const errorMsg = `❌ فایل انتخاب شده خراب یا معتبر نیست!\n\nفایل: ${file.name}\nنوع: ${file.type}\n\nاین فایل قابل خواندن نیست یا خراب شده است.\nلطفاً یک تصویر معتبر دیگر انتخاب کنید.`;
      alert(errorMsg);
      toast.error('❌ فایل انتخاب شده خراب یا معتبر نیست. لطفاً تصویر دیگری انتخاب کنید.', {
        autoClose: 5000
      });
      setOfflineErrors(prev => ({ ...prev, image: 'فایل خراب یا غیرقابل خواندن' }));
      e.target.value = '';
    };
    
    img.src = objectUrl;
  };

  const submitOfflinePayment = async () => {
    if (!validateOfflineForm()) return;
    
    try {
      setOfflineLoading(true);
      
      // Convert Persian (Jalali) date string to Gregorian ISO format for backend (Joi.date)
      const payDateIso = offlineForm.payDateIso || (() => {
        try {
          const normalized = normalizeDigits(offlineForm.payDate);
          if (!normalized) return '';
          const d = new DateObject({ date: normalized, format: 'YYYY/MM/DD', calendar: persian });
          return d.convert('gregorian').format('YYYY-MM-DD');
        } catch (_) {
          return '';
        }
      })();

      if (!payDateIso) {
        setOfflineErrors((prev) => ({ ...prev, payDate: 'تاریخ پرداخت نامعتبر است' }));
        toast.error('تاریخ پرداخت نامعتبر است');
        return;
      }

      const payload = {
        vehicleId: vehicle?.VehicleID ? Number(vehicle.VehicleID) : null, // Handle null vehicle for exploitation licenses
        trackingNo,
        amount: Math.trunc(Number(parseNumberLike(offlineForm.amount) ?? 0)),
        calculatedAmount: total || null, // مبلغ محاسبه شده در صفحه پرداخت
        payDate: payDateIso, // Converted to Gregorian ISO format
        receiptNo: (offlineForm.receiptNo || '').trim(),
        description: offlineForm.description || null,
        bankName: offlineForm.bankName || null,
        branchName: offlineForm.branchName || null,
        attachmentBase64: offlineForm.imageBase64 || null,
        attachmentFileName: offlineForm.imageFileName || null,
        attachmentContentType: offlineForm.imageContentType || null
      };

      console.log('Submitting offline payment:', payload);
      
      const response = await api.post('/api/payments/offline', payload);
    console.log('Offline payment response:', response.data);
    
    // Show success toast
    toast.success('✅ پرداخت آفلاین با موفقیت ثبت شد! فیش پرداخت شما جهت بررسی و تایید به کارشناس مربوطه ارجاع شد.', {
      autoClose: 6000,
      position: 'top-center',
      style: { fontSize: '14px', textAlign: 'right' }
    });
    
    // Show on-page success message with link
    setError('');
    // Create a temporary success state that we'll use to show the message
    const successMessage = document.createElement('div');
    successMessage.innerHTML = `
      <div style="
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: white;
        padding: 40px;
        border-radius: 16px;
        box-shadow: 0 10px 40px rgba(0,0,0,0.2);
        z-index: 10000;
        max-width: 500px;
        width: 90%;
        text-align: center;
        direction: rtl;
        font-family: Vazirmatn, Tahoma, sans-serif;
      ">
        <div style="font-size: 60px; margin-bottom: 20px;">✅</div>
        <h2 style="color: #10b981; margin-bottom: 20px; font-size: 24px;">پرداخت آفلاین با موفقیت ثبت شد!</h2>
        <p style="color: #6b7280; margin-bottom: 30px; font-size: 16px; line-height: 1.8;">
          فیش پرداخت شما ثبت گردید و جهت بررسی و تایید به کارشناس مربوطه ارجاع شد.<br/>
          <strong>برای ادامه کار و پیگیری درخواست خود، به کارتابل من مراجعه کنید.</strong>
        </p>
        <a href="/workflow/inbox" style="
          display: inline-block;
          padding: 14px 40px;
          background: #3b82f6;
          color: white;
          text-decoration: none;
          border-radius: 10px;
          font-size: 16px;
          font-weight: bold;
          transition: all 0.3s;
          box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
        "
        onmouseover="this.style.background='#2563eb'; this.style.transform='translateY(-2px)'"
        onmouseout="this.style.background='#3b82f6'; this.style.transform='translateY(0)'"
        >
          📝 رفتن به کارتابل من
        </a>
        <button onclick="this.parentElement.parentElement.remove()" style="
          display: block;
          margin: 20px auto 0;
          padding: 8px 24px;
          background: #e5e7eb;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          font-size: 14px;
          color: #374151;
        ">
          بستن
        </button>
      </div>
      <div style="
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0,0,0,0.5);
        z-index: 9999;
      " onclick="this.parentElement.remove()"></div>
    `;
    document.body.appendChild(successMessage);
    
    // Reset form
    setOfflineForm({
      amount: '',
      receiptNo: '',
      payDate: '',
      description: '',
      bankName: '',
      branchName: '',
      imageBase64: '',
      imageFileName: '',
      imageContentType: ''
    });
    
    // Refresh the list
    await loadOfflinePayments();
      
    } catch (error) {
      console.error('Error submitting offline payment:', error);
      if (error.response) {
        console.error('Server response data:', error.response.data);
      }
      const serverMessage = error.response?.data?.message;
      const errorMessage = serverMessage || error.message || 'خطا در ثبت پرداخت آفلاین';
      toast.error(errorMessage, { autoClose: 8000 });
    } finally {
      setOfflineLoading(false);
    }
  };

  // Delete offline payment
  const deleteOfflinePayment = async (paymentId) => {
    if (!window.confirm('آیا از حذف این فیش بانکی اطمینان دارید؟')) {
      return;
    }
    
    try {
      setLoading(true);
      await api.delete(`/api/payments/offline/${paymentId}`);
      toast.success('فیش بانکی با موفقیت حذف شد');
      
      // Reload payment history
      if (requestId) {
        await loadPaymentHistory(requestId);
      }
    } catch (error) {
      console.error('Error deleting offline payment:', error);
      toast.error('خطا در حذف فیش بانکی: ' + (error.response?.data?.message || error.message));
    } finally {
      setLoading(false);
    }
  };

  // Edit offline payment - redirect to edit page or show modal
  const editOfflinePayment = (payment) => {
    // For now, show payment details and inform user to contact support or use a different method
    // In a full implementation, this would open a modal or redirect to an edit form
    const details = `
شماره رسید: ${payment.ReceiptNo || '—'}
مبلغ: ${(payment.Amount || 0).toLocaleString('fa-IR')} ریال
تاریخ: ${payment.PayDate || '—'}
بانک: ${payment.BankName || '—'}
شعبه: ${payment.BranchName || '—'}
توضیحات: ${payment.Description || '—'}
    `.trim();
    
    alert(`اطلاعات فیش بانکی:\n\n${details}\n\nبرای ویرایش، لطفاً فیش فعلی را حذف کرده و فیش جدید را ثبت نمایید.`);
  };

  const payDisabledReason = useMemo(() => {
    if (!vehicle) return 'اطلاعات خودرو در دسترس نیست'
    if (!items.length) return 'تعرفه مطابق ظرفیت یافت نشد'
    return ''
  }, [vehicle, items])

  const handlePayment = async () => {
    if (!selectedTariff) return;
    
    // Validate that we have either vehicle or requestId
    if (!vehicle && !requestId) {
      toast.error('اطلاعات پرونده یافت نشد. لطفاً صفحه را مجدداً بارگذاری کنید.', {
        position: 'top-center',
        autoClose: 5000,
      });
      return;
    }
    
    setIsPaying(true);
    setIsProcessing(true);
    
    try {
      console.log('Creating payment with vehicle:', vehicle);
      console.log('Creating payment with requestId:', requestId);
      console.log('Selected tariff:', selectedTariff);
      console.log('Discount info:', discountInfo);
      
      // Determine the amount to pay: use finalAmount if discount is approved/rejected, otherwise use tariff price
      const paymentAmount = discountInfo?.finalAmount || selectedTariff.price;
      console.log('💰 Payment amount:', paymentAmount, '(discount applied:', discountInfo?.status === 'Approved', ')');
      
      // Generate orderId before creating payment record so we can store it
      const orderId = `PAY-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
      console.log('📋 Generated orderId:', orderId);
      
      // First create a payment record in our database with the orderId
      // For exploitation licenses or requests without vehicle, use requestId instead
      const payment = await api.post('/api/payments', {
        vehicleId: vehicle?.VehicleID || null, // Use optional chaining to handle null vehicle
        requestId: requestId, // Always include requestId for tracking
        trackingNo: trackingNo, // Using the trackingNo from the URL state
        amount: paymentAmount,
        calculatedAmount: total || null, // مبلغ محاسبه شده در صفحه پرداخت
        description: `پرداخت هزینه پروانه فعالیت - ${selectedTariff.title}`,
        orderId: orderId // Store orderId so we can match it later
      });
      
      console.log('Payment created:', payment.data);
      
      if (paymentMethod === 'online') {
        // Prepare payment data for redirect
        const paymentData = {
          paymentId: payment.data.Id, // Using the ID from the server response
          orderId: orderId, // Use the same orderId we generated and stored
          amount: paymentAmount,
          trackingNo: trackingNo, // Using the trackingNo from URL state
          requestId: requestId, // Include requestId for exploitation licenses
          vehicleId: vehicle?.VehicleID || null, // Include vehicleId if available
          description: `پرداخت هزینه پروانه فعالیت - ${selectedTariff.title}`,
          callbackUrl: `${window.location.origin}/payment-callback`
        };
        
        // Encode payment data for URL using our safe encoder
        const jsonString = JSON.stringify(paymentData);
        const encodedData = encodeUnicodeToBase64(jsonString);
        
        // Redirect to payment processing page
        navigate(`/redirect-to-bank?data=${encodeURIComponent(encodedData)}`);
      } else {
        // Handle offline payment
        toast.success('درخواست پرداخت شما ثبت شد. لطفا مبلغ را به شماره کارت اعلام شده واریز نمایید.', {
          position: 'top-center',
          autoClose: 10000,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
          theme: 'light',
        });
        
        // Update payment status to pending for offline payments
        await api.put(`/api/payments/${payment.data.id}`, {
          status: 'pending',
          paymentMethod: 'offline'
        });
        
        // Optionally redirect to a confirmation page
        navigate('/payment/confirmation', { 
          state: { 
            paymentId: payment.data.id,
            amount: selectedTariff.price,
            trackingNo: trackingNo || requestDetails?.TrackingNo,
            paymentMethod: 'offline'
          } 
        });
      }
    } catch (error) {
      console.error('Payment error details:', {
        error,
        response: error.response?.data,
        status: error.response?.status,
        headers: error.response?.headers,
        request: error.request
      });
      
      // Extract error message from response if available
      let errorMessage = 'خطا در ایجاد پرداخت. لطفاً مجدداً تلاش نمایید.';
      if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      toast.error(errorMessage, {
        position: 'top-center',
        autoClose: 10000, // Show for 10 seconds to allow reading the full message
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
        theme: 'light',
      });
    } finally {
      setIsPaying(false);
      setIsProcessing(false);
    }
  };

  return (
    <div className="container" dir="rtl">
      <div className="payment-wrapper" ref={printRef}>
        {/* Top line similar to screenshot (buyer brief header) */}
        <div className="payment-header">
          {isExploitationOrLegalEntity ? (
            <>
              {companyName && <span>{companyName}</span>}
              {companyNationalId && <span>شناسه ملی: {companyNationalId}</span>}
            </>
          ) : (
            <>
              {buyerName && <span>{buyerName}</span>}
              {buyerNationalCode && <span>کد ملی: {buyerNationalCode}</span>}
            </>
          )}
          {trackingNo && <span>شماره پیگیری: {trackingNo}</span>}
          {plateDisplay !== '-' && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              پلاک خودرو: {plateDisplay}
            </span>
          )}
        </div>

        {/* Access Control: Show message if payment page is not accessible yet */}
        {!loading && !canAccessPayment && (trackingNo?.startsWith('100-') || requestDetails?.LicenseTypeId === 68) && (
          <div style={{
            padding: '40px',
            background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
            border: '3px solid #f59e0b',
            borderRadius: '12px',
            marginTop: '30px',
            textAlign: 'center',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)'
          }}>
            <div style={{
              fontSize: '48px',
              marginBottom: '20px'
            }}>
              ⏳
            </div>
            <h2 style={{
              color: '#92400e',
              marginBottom: '16px',
              fontSize: '24px',
              fontWeight: 'bold'
            }}>
              دسترسی به صفحه پرداخت محدود است
            </h2>
            <p style={{
              color: '#78350f',
              fontSize: '16px',
              lineHeight: '1.8',
              marginBottom: '20px'
            }}>
              صفحه پرداخت فقط پس از تایید درخواست توسط <strong>کارشناس تایید محل</strong> قابل نمایش می‌باشد.
              <br />
              درخواست شما در حال بررسی است. لطفاً منتظر بمانید تا مراحل تایید کامل شود.
            </p>
            <div style={{
              background: 'white',
              padding: '20px',
              borderRadius: '8px',
              marginTop: '24px',
              border: '1px solid #fbbf24'
            }}>
              <h3 style={{ color: '#92400e', marginTop: 0, fontSize: '18px' }}>مراحل تایید:</h3>
              <div style={{ textAlign: 'right', marginTop: '16px' }}>
                {workflowSteps.map((step, index) => {
                  const isApproved = step.Status === 'Approved'
                  const isPending = step.Status === 'Pending'
                  const isNotStarted = step.Status === 'NotStarted'
                  
                  return (
                    <div key={index} style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '12px',
                      marginBottom: '8px',
                      background: isApproved ? '#d1fae5' : isPending ? '#fef3c7' : '#f3f4f6',
                      borderRadius: '6px',
                      border: `2px solid ${isApproved ? '#10b981' : isPending ? '#f59e0b' : '#d1d5db'}`
                    }}>
                      <div style={{ fontSize: '24px' }}>
                        {isApproved ? '✅' : isPending ? '⏳' : '⚪'}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 'bold', color: '#1f2937' }}>
                          مرحله {step.StepOrder}: {step.RoleName}
                        </div>
                        <div style={{ fontSize: '14px', color: '#6b7280' }}>
                          {isApproved ? 'تایید شده' : isPending ? 'در حال بررسی' : 'در انتظار'}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
            <div style={{ marginTop: '24px' }}>
              <Link
                to="/workflow/inbox"
                style={{
                  display: 'inline-block',
                  padding: '12px 32px',
                  background: '#3b82f6',
                  color: 'white',
                  borderRadius: '8px',
                  textDecoration: 'none',
                  fontWeight: 'bold',
                  fontSize: '16px',
                  boxShadow: '0 2px 8px rgba(59, 130, 246, 0.3)',
                  transition: 'all 0.3s ease'
                }}
                onMouseEnter={(e) => {
                  e.target.style.background = '#2563eb'
                  e.target.style.transform = 'translateY(-2px)'
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = '#3b82f6'
                  e.target.style.transform = 'translateY(0)'
                }}
              >
                📋 مراجعه به کارتابل من
              </Link>
            </div>
          </div>
        )}

        {/* Only show payment content if access is granted or still loading */}
        {(loading || canAccessPayment) && (
          <>
        {/* Seller/Buyer information table */}
        <table className="payment-info">
          <tbody>
            <tr>
              <td className="title" colSpan={5}>مشخصات فروشنده / تامین کننده :</td>
              <td className="logo" rowSpan={6}>
                {org.logoUrl ? <img src={org.logoUrl} alt="logo" /> : <div className="logo-ph" />}
              </td>
            </tr>
            <tr>
              <td>نام:</td>
              <td className="value" colSpan={4}>{org.name}</td>
            </tr>
            <tr>
              <td>استان:</td>
              <td className="value">{org.province}</td>
              <td>شهر:</td>
              <td className="value" colSpan={2}>{org.city}</td>
            </tr>
            <tr>
              <td>کد پستی:</td>
              <td className="value">{org.postalCode}</td>
              <td>تلفن:</td>
              <td className="value" colSpan={2}>{org.phone}</td>
            </tr>
            <tr>
              <td>نشانی:</td>
              <td className="value" colSpan={4}>{org.address}</td>
            </tr>
            <tr>
              <td>کد اقتصادی:</td>
              <td className="value">{org.economicCode}</td>
              <td>شناسه ملی:</td>
              <td className="value" colSpan={2}>{org.nationalId}</td>
            </tr>

            <tr>
              <td className="title" colSpan={6}>مشخصات خریدار:</td>
            </tr>
            {isExploitationOrLegalEntity ? (
              <tr>
                <td>نام شرکت:</td>
                <td className="value" colSpan={3}>{companyName || (loading ? '...' : '—')}</td>
                <td>شناسه ملی:</td>
                <td className="value">{companyNationalId || (loading ? '...' : '—')}</td>
              </tr>
            ) : (
              <tr>
                <td>نام:</td>
                <td className="value">{buyerFirstName || (loading ? '...' : '—')}</td>
                <td>نام خانوادگی:</td>
                <td className="value">{buyerLastName || (loading ? '...' : '—')}</td>
                <td>کد ملی:</td>
                <td className="value">{buyerNationalCode || (loading ? '...' : '—')}</td>
              </tr>
            )}
            {plateDisplay !== '-' && (
              <tr>
                <td>پلاک خودرو:</td>
                <td className="value" colSpan={5}>{plateDisplay}</td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Invoice items */}
        {loading || items.length === 0 ? (
          <div style={{
            padding: '40px',
            background: calculationError ? 'linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)' : 'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)',
            border: calculationError ? '3px solid #ef4444' : '3px solid #3b82f6',
            borderRadius: '12px',
            marginTop: '20px',
            marginBottom: '20px',
            textAlign: 'center',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)'
          }}>
            <div style={{
              fontSize: '48px',
              marginBottom: '20px',
              animation: calculationError ? 'none' : 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite'
            }}>
              {calculationError ? '❌' : '⏳'}
            </div>
            <h3 style={{
              color: calculationError ? '#991b1b' : '#1e40af',
              marginBottom: '12px',
              fontSize: '20px',
              fontWeight: 'bold'
            }}>
              {calculationError ? 'خطا در محاسبه مبلغ پرداخت' : 'در حال محاسبه مبلغ پرداخت...'}
            </h3>
            <p style={{
              color: calculationError ? '#7f1d1d' : '#1e3a8a',
              fontSize: '14px',
              lineHeight: '1.6',
              marginBottom: calculationError ? '20px' : 0
            }}>
              {calculationError || 'لطفاً چند لحظه صبر کنید تا مبلغ قابل پرداخت محاسبه و نمایش داده شود.'}
            </p>
            {calculationError && (
              <div style={{
                marginTop: '20px',
                display: 'flex',
                gap: '12px',
                justifyContent: 'center',
                flexWrap: 'wrap'
              }}>
                <button
                  onClick={() => window.location.reload()}
                  style={{
                    padding: '10px 24px',
                    background: '#3b82f6',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: 'bold'
                  }}
                >
                  🔄 بارگذاری مجدد
                </button>
                <button
                  onClick={() => navigate('/workflow/inbox')}
                  style={{
                    padding: '10px 24px',
                    background: '#10b981',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: 'bold'
                  }}
                >
                  📋 بازگشت به کارتابل
                </button>
              </div>
            )}
          </div>
        ) : (
          <table className="payment-items">
            <thead>
              <tr>
                <th>عنوان</th>
                <th>توضیحات</th>
                <th>مبلغ (ریال)</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it, idx) => (
                <tr key={idx}>
                  <td>{it.title}</td>
                  <td>{it.desc || ''}</td>
                  <td className="amount">{it.amount.toLocaleString('fa-IR')}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={2} className="total-label">مجموع</td>
                <td className="total-amount">({total.toLocaleString('fa-IR')})</td>
              </tr>
            </tfoot>
          </table>
        )}

        {invoiceQrUrl && items.length > 0 && invoiceSecurityCode && (
          <div className="payment-qr-section">
            <div className="payment-qr-security-row">
              
              {/* <div className="payment-security-code-box">
                <div className="payment-security-code-label">کد امنیتی فاکتور</div>
                <div className="payment-security-code-value" dir="ltr">{invoiceSecurityCodeFarsi}</div>
                <div className="payment-security-code-hint">
                  در صورت تغییر شماره پیگیری، مبلغ، کد/شناسه ملی یا پلاک، این کد دیگر معتبر نیست.
                </div>
                <details className="payment-security-formula no-print-hint">
                  <summary>راهنمای تأیید برای ادمین</summary>
                  <ol style={{ margin: '8px 0 0', paddingRight: '20px', fontSize: '12px', lineHeight: 1.7 }}>
                    {INVOICE_SECURITY_FORMULA_STEPS.map((step, i) => (
                      <li key={i}>{step}</li>
                    ))}
                  </ol>
                </details>
              </div> */}
              
              
              
              <div className="payment-qr-box">
                <QRCodeSVG
                  value={invoiceQrUrl}
                  size={80}
                  level="M"
                  includeMargin={false}
                />
              </div>
            </div>
          </div>
        )}

        {/* Payment method section */}
        <div className="payment-method mb-4">
          <div className="mb-3">
            <div className="mb-2 fw-bold">روش پرداخت را انتخاب کنید</div>
            {discountInfo && discountInfo.status === 'Pending' && (
              <div style={{ padding: '20px', background: '#fef3c7', border: '2px solid #f59e0b', borderRadius: '8px', marginBottom: '20px', textAlign: 'center' }}>
                <h3 style={{ color: '#92400e', marginTop: 0 }}>⏳ در انتظار بررسی تخفیف</h3>
                <p style={{ color: '#78350f', marginBottom: 0 }}>
                  درخواست تخفیف شما در حال بررسی توسط کارشناس صدور پروانه می‌باشد.
                  <br />
                  پس از تایید یا رد تخفیف، امکان پرداخت فراهم خواهد شد.
                  <br />
                  جهت ادامه کار به صفحه <Link to="/workflow/inbox" style={{ color: '#0066cc', textDecoration: 'underline', fontWeight: 'bold' }}>کارتابل من</Link> مراجعه نمایید
                </p>
              </div>
            )}

            {discountInfo && discountInfo.status === 'Approved' && (
              <div style={{ padding: '20px', background: '#d1fae5', border: '2px solid #10b981', borderRadius: '8px', marginBottom: '20px' }}>
                <h3 style={{ color: '#065f46', marginTop: 0 }}>✅ تخفیف تایید شد</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', textAlign: 'center' }}>
                  <div>
                    <div style={{ fontSize: '14px', color: '#047857' }}>مبلغ اصلی:</div>
                    <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#065f46' }}>
                      {discountInfo.originalAmount?.toLocaleString('fa-IR')} ریال
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '14px', color: '#047857' }}>تخفیف:</div>
                    <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#dc2626' }}>
                      {discountInfo.discountAmount?.toLocaleString('fa-IR')} ریال
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '14px', color: '#047857' }}>مبلغ قابل پرداخت:</div>
                    <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#065f46' }}>
                      {discountInfo.finalAmount?.toLocaleString('fa-IR')} ریال
                    </div>
                  </div>
                </div>
              </div>
            )}

            {discountInfo && discountInfo.status === 'Rejected' && (
              <div style={{ padding: '20px', background: '#fee2e2', border: '2px solid #ef4444', borderRadius: '8px', marginBottom: '20px' }}>
                <h3 style={{ color: '#991b1b', marginTop: 0 }}>❌ تخفیف رد شد</h3>
                <p style={{ color: '#7f1d1d', marginBottom: 0 }}>
                  درخواست تخفیف شما توسط کارشناس رد شد.
                  {discountInfo.notes && <><br />دلیل: {discountInfo.notes}</>}
                  <br />
                  مبلغ قابل پرداخت: <strong>{discountInfo.finalAmount?.toLocaleString('fa-IR')} ریال</strong>
                </p>
              </div>
            )}

            {(!discountInfo || discountInfo.status !== 'Pending') && (
              <div className="d-flex gap-2 mb-3">
                <button
                  type="button"
                  className="btn btn-primary w-100"
                  disabled={!selectedTariff || isPaying || isProcessing}
                  onClick={handlePayment}
                  style={{ backgroundColor: '#0d6efd', color: '#fff', fontWeight: 'bold', border: 'none' }}
                >
                  {isPaying || isProcessing ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                      در حال انتقال به درگاه پرداخت...
                    </>
                  ) : (
                    <>
                      💳 پرداخت آنلاین
                    </>
                  )}
                </button>
                <button 
                  type="button"
                  className={`btn ${paymentMethod === 'offline' ? 'btn-primary' : 'btn-outline-secondary'}`}
                  onClick={() => setPaymentMethod('offline')}
                  style={{ color: paymentMethod === 'offline' ? '#fff' : '#000', fontWeight: '500' }}
                >
                  🏦 پرداخت آفلاین (فیش واریزی)
                </button>
              </div>
            )}
          </div>

          {paymentMethod === 'offline' && selectedTariff && (
            <div className="mt-3 p-3 bg-light rounded" style={{border:'1px dashed #ccc'}}>
              <h6 className="mb-3">ثبت پرداخت آفلاین</h6>

              {/* Offline form */}
              <div className="row g-3 mb-3">
                <div className="col-sm-3">
                  <label className="form-label">مبلغ</label>
                  <input type="text" className={`form-control ${offlineErrors.amount ? 'is-invalid':''}`}
                         value={offlineForm.amount} onChange={onChangeOffline('amount')} placeholder="مثال: 8,450,000" />
                  {offlineErrors.amount && <div className="invalid-feedback">{offlineErrors.amount}</div>}
                </div>
                <div className="col-sm-3">
                  <label className="form-label">شماره رسید</label>
                  <input type="text" className={`form-control ${offlineErrors.receiptNo ? 'is-invalid':''}`}
                         value={offlineForm.receiptNo} onChange={onChangeOffline('receiptNo')} />
                  {offlineErrors.receiptNo && <div className="invalid-feedback">{offlineErrors.receiptNo}</div>}
                </div>
                <div className="col-md-3">
                  <label className="form-label">تاریخ پرداخت <small className="text-muted">(شمسی)</small></label>
                  <div className={offlineErrors.payDate ? 'is-invalid' : ''}>
                    <DatePicker
                      inputClass={`form-control text-center ${offlineErrors.payDate ? 'is-invalid' : ''}`}
                      calendar={persian}
                      locale={persian_fa}
                      calendarPosition="bottom-right"
                      value={offlineForm.payDate}
                      onChange={(date) => {
                        const dateStr = date ? date.format('YYYY/MM/DD') : '';
                        const iso = date ? date.convert('gregorian').format('YYYY-MM-DD') : '';
                        setOfflineForm(prev => ({
                          ...prev,
                          payDate: dateStr,
                          payDateIso: iso,
                        }));
                        if (offlineErrors.payDate) {
                          setOfflineErrors(prev => ({ ...prev, payDate: '' }));
                        }
                      }}
                      render={(
                        <input 
                          className="form-control text-center" 
                          placeholder="۱۴۰۳/۰۷/۰۸" 
                          style={{ direction: 'ltr' }}
                        />
                      )}
                      containerStyle={{
                        width: '100%'
                      }}
                    />
                  </div>
                  {offlineErrors.payDate && (
                    <div className="invalid-feedback d-block text-end">
                      <i className="bi bi-exclamation-circle me-1"></i>
                      {offlineErrors.payDate}
                    </div>
                  )}
                </div>
                <div className="col-sm-3">
                  <label className="form-label">نام بانک</label>
                  <input type="text" className="form-control" value={offlineForm.bankName} onChange={onChangeOffline('bankName')} />
                </div>
                <div className="col-sm-3">
                  <label className="form-label">نام شعبه</label>
                  <input type="text" className="form-control" value={offlineForm.branchName} onChange={onChangeOffline('branchName')} />
                </div>
                <div className="col-sm-6">
                  <label className="form-label">توضیحات</label>
                  <textarea className="form-control" rows={2} value={offlineForm.description} onChange={onChangeOffline('description')} />
                </div>
                <div className="col-md-6">
                  <label className="form-label">بارگذاری تصویر فیش <span className="text-danger">*</span> <small className="text-muted">(حداکثر ۲ مگابایت)</small></label>
                  <div className="input-group">
                    <input 
                      type="file" 
                      id="receiptUpload" 
                      className="form-control" 
                      accept="image/*" 
                      onChange={handleFileUpload}
                      style={{ display: 'none' }}
                    />
                    <label 
                      htmlFor="receiptUpload" 
                      className="btn btn-outline-secondary d-flex align-items-center justify-content-between"
                      style={{ cursor: 'pointer' }}
                    >
                      <span className="text-truncate">
                        {offlineForm.imageBase64 ? offlineForm.imageFileName || 'فایل انتخاب شد' : 'انتخاب فایل'}
                      </span>
                      <i className="bi bi-upload ms-2"></i>
                    </label>
                    {offlineForm.imageBase64 && (
                      <a 
                        href={offlineForm.imageBase64} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="btn btn-outline-primary"
                      >
                        <i className="bi bi-eye"></i>
                      </a>
                    )}
                  </div>
                  {offlineForm.imageBase64 && (
                    <div className="form-text text-success mt-1">
                      <i className="bi bi-check-circle-fill me-1"></i>
                      فایل با موفقیت انتخاب شد
                    </div>
                  )}
                  {offlineErrors.image && (
                    <div className="invalid-feedback d-block text-end">
                      <i className="bi bi-exclamation-circle me-1"></i>
                      {offlineErrors.image}
                    </div>
                  )}
                </div>
              </div>

              <div className="d-flex flex-wrap gap-3 mb-3 align-items-center">
                <div className="d-flex gap-2">
                  <button 
                    type="button"
                    className="btn btn-success px-4" 
                    disabled={offlineLoading} 
                    onClick={submitOfflinePayment}
                    style={{ backgroundColor: '#198754', color: '#fff', fontWeight: 'bold', border: 'none' }}
                  >
                    {offlineLoading ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                        در حال ثبت...
                      </>
                    ) : (
                      '✓ ثبت پرداخت آفلاین'
                    )}
                  </button>
                  <button 
                    type="button"
                    className="btn btn-outline-danger px-4" 
                    disabled={offlineLoading}
                    onClick={() => { 
                      setOfflineForm({ 
                        amount: '', 
                        receiptNo: '', 
                        payDate: '', 
                        description: '', 
                        bankName: '', 
                        branchName: '', 
                        imageBase64: '',
                        imageFileName: '',
                        imageContentType: ''
                      }); 
                      setOfflineErrors({}); 
                    }}
                    style={{ color: '#dc3545', fontWeight: 'bold', borderColor: '#dc3545' }}
                  >
                    ✕ انصراف
                  </button>
                </div>
                <div className="bg-light p-2 rounded-2 flex-grow-1 text-center">
                  <span className="text-muted">شماره حساب سازمان: </span>
                  <span className="fw-bold text-primary">0101234567001</span>
                  <span className="text-muted me-2"> - بانک ملی</span>
                </div>
              </div>

              {/* Existing offline payments table */}
              <div className="table-responsive">
                <table className="table table-sm table-bordered align-middle">
                  <thead>
                    <tr>
                      <th>تاریخ پرداخت</th>
                      <th>شماره رسید</th>
                      <th>مبلغ</th>
                      <th>بانک/شعبه</th>
                      <th>توضیحات</th>
                      <th>فیش</th>
                      {showPaymentManageActions && <th>عملیات</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {offlineLoading && (
                      <tr><td colSpan={showPaymentManageActions ? 7 : 6} className="text-center">در حال بارگذاری...</td></tr>
                    )}
                    {!offlineLoading && offlinePayments?.length === 0 && (
                      <tr><td colSpan={showPaymentManageActions ? 7 : 6} className="text-center text-muted">رکوردی ثبت نشده است</td></tr>
                    )}
                    {!offlineLoading && offlinePayments?.map((p) => (
                      <tr key={p.Id}>
                        <td>{p.PayDate ? (() => {
                          try {
                            // PayDate is stored as Persian date string in DB (e.g., "۱۴۰۴-۰۷-۱۴")
                            const dateStr = String(p.PayDate).trim();
                            if (!dateStr || dateStr === 'null' || dateStr === 'undefined') {
                              return '—';
                            }
                            
                            // Normalize Persian/Arabic digits to English
                            const normalized = normalizeDigits(dateStr);
                            
                            // If it contains slashes, it's already formatted
                            if (normalized.includes('/')) {
                              return normalized;
                            }
                            
                            // If it contains dashes, convert to slash format
                            if (normalized.includes('-')) {
                              return normalized.replace(/-/g, '/');
                            }
                            
                            return normalized;
                          } catch (err) {
                            console.error('Date parsing error:', err, p.PayDate);
                            return String(p.PayDate);
                          }
                        })() : '—'}</td>
                        <td>{p.ReceiptNo || '—'}</td>
                        <td>{(p.Amount||0).toLocaleString('fa-IR')}</td>
                        <td>{[p.BankName, p.BranchName].filter(Boolean).join(' / ') || '—'}</td>
                        <td style={{maxWidth:240}}>{p.Description || '—'}</td>
                        <td>{p.AttachmentFileName ? (
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
                                
                                // Create modal
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
                                alert('خطا در بارگذاری تصویر');
                              }
                            }}
                            className="btn btn-sm btn-outline-primary"
                            style={{ cursor: 'pointer' }}
                          >
                            👁️ مشاهده
                          </button>
                        ) : '—'}</td>
                        {showPaymentManageActions && (
                          <td>
                            <button 
                              onClick={async () => {
                                if (!window.confirm('آیا از حذف این پرداخت اطمینان دارید؟')) return;
                                try {
                                  await api.delete(`/api/payments/offline/${p.Id}`);
                                  toast.success('پرداخت با موفقیت حذف شد');
                                  await loadOfflinePayments();
                                } catch (err) {
                                  console.error('Error deleting payment:', err);
                                  toast.error('خطا در حذف پرداخت');
                                }
                              }}
                              className="btn btn-sm btn-outline-danger"
                              style={{ cursor: 'pointer' }}
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

        {/* Withdrawal consent red box */}
        <div className="withdraw-box">
          <label>
            <input type="checkbox" />
            <span>آیا تمایل به انصراف دارید؟ (در صورت انصراف، پرداخت شما عودت نمی‌شود)</span>
          </label>
        </div>

        {/* Actions row */}
        <div className="payment-actions no-print">
          <button className="btn-print" onClick={handlePrintInvoice}>چاپ</button>
        </div>

        {/* Payment History Section */}
        {(paymentHistory.online.length > 0 || paymentHistory.offline.length > 0) && (
          <div style={{ marginTop: '30px', padding: '20px', background: '#f9fafb', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
            <h3 style={{ marginBottom: '20px', color: '#111827', fontSize: '18px', fontWeight: 'bold' }}>
              📊 سابقه پرداخت‌های این درخواست
            </h3>

            {/* Online Payments History */}
            {paymentHistory.online.length > 0 && (
              <div style={{ marginBottom: '20px' }}>
                <h4 style={{ marginBottom: '12px', color: '#374151', fontSize: '16px' }}>پرداخت‌های آنلاین</h4>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', background: 'white' }}>
                    <thead>
                      <tr style={{ background: '#f3f4f6' }}>
                        <th style={{ border: '1px solid #d1d5db', padding: '10px', textAlign: 'center' }}>ردیف</th>
                        <th style={{ border: '1px solid #d1d5db', padding: '10px', textAlign: 'center' }}>مبلغ (ریال)</th>
                        <th style={{ border: '1px solid #d1d5db', padding: '10px', textAlign: 'center' }}>وضعیت</th>
                        <th style={{ border: '1px solid #d1d5db', padding: '10px', textAlign: 'center' }}>کد پیگیری درگاه</th>
                        <th style={{ border: '1px solid #d1d5db', padding: '10px', textAlign: 'center' }}>تاریخ ایجاد</th>
                        <th style={{ border: '1px solid #d1d5db', padding: '10px', textAlign: 'center' }}>تاریخ پرداخت</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paymentHistory.online.map((p, idx) => (
                        <tr key={p.Id}>
                          <td style={{ border: '1px solid #d1d5db', padding: '10px', textAlign: 'center' }}>{idx + 1}</td>
                          <td style={{ border: '1px solid #d1d5db', padding: '10px', textAlign: 'center' }}>
                            {(p.Amount || 0).toLocaleString('fa-IR')}
                          </td>
                          <td style={{ border: '1px solid #d1d5db', padding: '10px', textAlign: 'center' }}>
                            <span style={{
                              padding: '4px 12px',
                              borderRadius: '12px',
                              fontSize: '12px',
                              fontWeight: 'bold',
                              background: p.Status === 'Completed' ? '#10b98120' : p.Status === 'Failed' ? '#ef444420' : '#f59e0b20',
                              color: p.Status === 'Completed' ? '#10b981' : p.Status === 'Failed' ? '#ef4444' : '#f59e0b'
                            }}>
                              {p.Status === 'Completed' ? 'تکمیل شده' : p.Status === 'Failed' ? 'ناموفق' : p.Status}
                            </span>
                          </td>
                          <td style={{ border: '1px solid #d1d5db', padding: '10px', textAlign: 'center' }}>
                            {p.GatewayRef || '—'}
                          </td>
                          <td style={{ border: '1px solid #d1d5db', padding: '10px', textAlign: 'center', fontSize: '13px' }}>
                            {p.CreatedAt ? new Date(p.CreatedAt).toLocaleDateString('fa-IR') : '—'}
                          </td>
                          <td style={{ border: '1px solid #d1d5db', padding: '10px', textAlign: 'center', fontSize: '13px' }}>
                            {p.PaidAt ? new Date(p.PaidAt).toLocaleDateString('fa-IR') : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Offline Payments History */}
            {paymentHistory.offline.length > 0 && (
              <div>
                <h4 style={{ marginBottom: '12px', color: '#374151', fontSize: '16px' }}>پرداخت‌های آفلاین (کارتخوان/فیش)</h4>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', background: 'white' }}>
                    <thead>
                      <tr style={{ background: '#f3f4f6' }}>
                        <th style={{ border: '1px solid #d1d5db', padding: '10px', textAlign: 'center' }}>ردیف</th>
                        <th style={{ border: '1px solid #d1d5db', padding: '10px', textAlign: 'center' }}>مبلغ (ریال)</th>
                        <th style={{ border: '1px solid #d1d5db', padding: '10px', textAlign: 'center' }}>شماره رسید</th>
                        <th style={{ border: '1px solid #d1d5db', padding: '10px', textAlign: 'center' }}>تاریخ پرداخت</th>
                        <th style={{ border: '1px solid #d1d5db', padding: '10px', textAlign: 'center' }}>بانک/شعبه</th>
                        <th style={{ border: '1px solid #d1d5db', padding: '10px', textAlign: 'center' }}>توضیحات</th>
                        <th style={{ border: '1px solid #d1d5db', padding: '10px', textAlign: 'center' }}>فیش</th>
                        {showPaymentManageActions && (
                          <th style={{ border: '1px solid #d1d5db', padding: '10px', textAlign: 'center' }}>عملیات</th>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {paymentHistory.offline.map((p, idx) => (
                        <tr key={p.Id}>
                          <td style={{ border: '1px solid #d1d5db', padding: '10px', textAlign: 'center' }}>{idx + 1}</td>
                          <td style={{ border: '1px solid #d1d5db', padding: '10px', textAlign: 'center' }}>
                            {(p.Amount || 0).toLocaleString('fa-IR')}
                          </td>
                          <td style={{ border: '1px solid #d1d5db', padding: '10px', textAlign: 'center' }}>
                            {p.ReceiptNo || '—'}
                          </td>
                          <td style={{ border: '1px solid #d1d5db', padding: '10px', textAlign: 'center' }}>
                            {p.PayDate || '—'}
                          </td>
                          <td style={{ border: '1px solid #d1d5db', padding: '10px', textAlign: 'center', fontSize: '13px' }}>
                            {[p.BankName, p.BranchName].filter(Boolean).join(' / ') || '—'}
                          </td>
                          <td style={{ border: '1px solid #d1d5db', padding: '10px', textAlign: 'center', fontSize: '13px' }}>
                            {p.Description || '—'}
                          </td>
                          <td style={{ border: '1px solid #d1d5db', padding: '10px', textAlign: 'center' }}>
                            {p.AttachmentFileName ? (
                              <button
                                onClick={async () => {
                                  try {
                                    const token = localStorage.getItem('token');
                                    const response = await fetch(`${normalizedApiBaseUrl}/api/payments/offline/${p.Id}/attachment`, {
                                      headers: { 'Authorization': `Bearer ${token}` }
                                    });
                                    if (!response.ok) throw new Error('Failed to load image');
                                    const blob = await response.blob();
                                    const imageUrl = URL.createObjectURL(blob);
                                    
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
                                👁️ مشاهده
                              </button>
                            ) : '—'}
                          </td>
                          {showPaymentManageActions && (
                          <td style={{ border: '1px solid #d1d5db', padding: '10px', textAlign: 'center' }}>
                            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', flexWrap: 'wrap' }}>
                              <button
                                onClick={() => editOfflinePayment(p)}
                                style={{
                                  padding: '4px 12px',
                                  background: '#f59e0b',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '4px',
                                  cursor: 'pointer',
                                  fontSize: '12px',
                                  fontWeight: 'bold'
                                }}
                                title="ویرایش فیش"
                              >
                                ✏️ ویرایش
                              </button>
                              <button
                                onClick={() => deleteOfflinePayment(p.Id)}
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
                                title="حذف فیش"
                              >
                                🗑️ حذف
                              </button>
                            </div>
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
        )}

        {error && <div className="error-bar">{error}</div>}

        {/* Submit Corrections Button - Only show if request has deficiency */}
        {hasDeficiency && requestId && (
          <div style={{ 
            marginTop: '30px', 
            padding: '20px', 
            background: '#fef3c7', 
            border: '2px solid #f59e0b',
            borderRadius: '8px',
            textAlign: 'center'
          }}>
            <div style={{ 
              fontSize: '16px', 
              fontWeight: 'bold', 
              color: '#92400e', 
              marginBottom: '12px' 
            }}>
              ⚠️ این پرونده نیاز به رفع نقص دارد
            </div>
            <div style={{ 
              fontSize: '14px', 
              color: '#78350f', 
              marginBottom: '16px' 
            }}>
              پس از انجام ویرایش‌های لازم و بارگذاری مدارک، روی دکمه زیر کلیک کنید تا پرونده جهت بررسی مجدد ارسال شود.
            </div>
            <button
              onClick={handleSubmitCorrections}
              disabled={submittingCorrections}
              style={{
                padding: '12px 32px',
                background: submittingCorrections ? '#9ca3af' : '#10b981',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: submittingCorrections ? 'not-allowed' : 'pointer',
                fontSize: '16px',
                fontWeight: 'bold',
                boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
                transition: 'all 0.3s ease'
              }}
              onMouseEnter={(e) => {
                if (!submittingCorrections) {
                  e.target.style.background = '#059669'
                  e.target.style.transform = 'translateY(-2px)'
                  e.target.style.boxShadow = '0 6px 8px rgba(0, 0, 0, 0.15)'
                }
              }}
              onMouseLeave={(e) => {
                if (!submittingCorrections) {
                  e.target.style.background = '#10b981'
                  e.target.style.transform = 'translateY(0)'
                  e.target.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.1)'
                }
              }}
            >
              {submittingCorrections ? '⏳ در حال ارسال...' : '✅ ویرایش انجام شد - جهت بررسی ارسال شود'}
            </button>
          </div>
        )}
          </>
        )}
      </div>
    </div>
  )
}
