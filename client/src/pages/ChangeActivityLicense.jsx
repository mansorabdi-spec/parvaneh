import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { api } from '../lib/api.js'
import ManualDateInput from '../components/ManualDateInput'

export default function ChangeActivityLicense({ user }) {
  const navigate = useNavigate()
  const { requestId } = useParams()
  const location = useLocation()
  const changeRequestId = requestId
  const reqData = location.state?.req || location.state?.RequestData
  
  const [current, setCurrent] = useState(0)
  const [doneMessage, setDoneMessage] = useState('')
  const [isChangeMode, setIsChangeMode] = useState(!!changeRequestId)
  const [loadingChangeData, setLoadingChangeData] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isNextLoading, setIsNextLoading] = useState(false)
  
  // Personal state
  const [personal, setPersonal] = useState({
    firstName: '',
    lastName: '',
    fatherName: '',
    nationalCode: (user?.Role === 'کارگزار (بهره بردار)' || user?.role === 'کارگزار (بهره بردار)') ? '' : (user?.nationalCode || ''),
    idSerial: '',
    birthProvinceId: '',
    birthCityId: '',
    birthDate: '',
    gender: 'مرد',
    maritalStatus: 'متاهل',
    otherBloodGroup: '',
    otherEducationLevel: '',
    otherPhysicalStatus: 'سالم',
    otherMilitaryStatus: '',
    otherEnglishLevel: '',
    otherVeteranStatus: '',
    residences: [],
    contacts: []
  })
  
  // Vehicle state
  const [vehicle, setVehicle] = useState({
    vehicleKindId: '',
    systemId: '',
    systemTipId: '',
    yearManufacture: '',
    capacity: '',
    fuelTypeId: '',
    trackerTypeId: '',
    cylinders: '',
    axles: '',
    wheels: '',
    vin: '',
    chassisNo: '',
    engineNo: '',
    bodyColor: '',
    activityCategoryId: '',
    isContainer: '',
    plateTypeId: '',
    plate: { p1_serial2: '', p2_three: '', p3_letter: '', p4_two: '' },
    inspectionDate: '',
    greenCardDate: '',
    freePlate: false,
    insuranceCompanyId: '',
    insurancePolicyNo: '',
    insuranceIssueDate: '',
    insuranceValidDate: '',
    techInspectSerial: '',
    techInspectIssueDate: '',
    techInspectValidDate: ''
  })
  
  // Start step
  const [start, setStart] = useState({
    nationality: 'ایران',
    nationalCode: (user?.Role === 'کارگزار (بهره بردار)' || user?.role === 'کارگزار (بهره بردار)') ? '' : (user?.nationalCode || ''),
    vin: '',
    consent: true
  })
  
  // Ownership type
  const [ownershipType, setOwnershipType] = useState(() => {
    if (reqData) {
      if (reqData.LicenseTypeId === 137 || reqData.LicenseTypeName?.includes('حقوقی')) {
        return 'حقوقی'
      }
    }
    return 'حقیقی'
  })
  
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
  
  // Change reason and description
  const [changeReason, setChangeReason] = useState('')
  const [changeDescription, setChangeDescription] = useState('')
  
  // Payment states
  const [finalTrackingNo, setFinalTrackingNo] = useState('')
  const [secondsLeft, setSecondsLeft] = useState(5)
  const [editModeTrackingNo, setEditModeTrackingNo] = useState('')
  
  // Lookups
  const [lkVehicleTypes, setLkVehicleTypes] = useState([])
  const [lkFuelTypes, setLkFuelTypes] = useState([])
  const [lkActivityCats, setLkActivityCats] = useState([])
  const [lkPlateTypes, setLkPlateTypes] = useState([])
  const [lkTrackerTypes, setLkTrackerTypes] = useState([])
  const [lkInsuranceNames, setLkInsuranceNames] = useState([])
  const [lkPersonalDocs, setLkPersonalDocs] = useState([])
  const [lkVehicleDocs, setLkVehicleDocs] = useState([])
  const [lkDiscountDocs, setLkDiscountDocs] = useState([])
  const [lkCompanyDocs, setLkCompanyDocs] = useState([])
  const [lkLicenseTypes, setLkLicenseTypes] = useState([])
  const [lkOperationTypes, setLkOperationTypes] = useState([])
  const [lkSelfSacrifice, setLkSelfSacrifice] = useState([])
  const [vehicleTypes, setVehicleTypes] = useState([])
  const [systems, setSystems] = useState([])
  const [systemTips, setSystemTips] = useState([])
  const [lkCompanyTypes, setLkCompanyTypes] = useState([])
  const [lkTonnageRates, setLkTonnageRates] = useState([])
  const [lkActivityFields, setLkActivityFields] = useState([])
  const [lkRegisteredCompanyTypes, setLkRegisteredCompanyTypes] = useState([])
  const [lkContactTypes, setLkContactTypes] = useState([])
  const [provinces, setProvinces] = useState([])
  const [citiesByProv, setCitiesByProv] = useState({})
  const [allCities, setAllCities] = useState([])
  
  // Documents
  const [personDocs, setPersonDocs] = useState([])
  const [companyDocs, setCompanyDocs] = useState([])
  const [vehicleDocs, setVehicleDocs] = useState([])
  const [discountDocs, setDiscountDocs] = useState([])
  
  // Temporary fields
  const [tmpResidence, setTmpResidence] = useState({
    provinceId: '', cityId: '', address: '', postalCode: '', plaque: '', unit: '', phone: ''
  })
  const [tmpCompanyAddress, setTmpCompanyAddress] = useState({
    provinceId: '', cityId: '', mainStreet: '', sideStreet: '',
    district: '', postalCode: '', plaque: '', unit: '', address: ''
  })
  const [tmpCompanyContact, setTmpCompanyContact] = useState({ type: '', value: '', isActive: false })
  const [companyAddressCities, setCompanyAddressCities] = useState([])
  
  const [vehicleId, setVehicleId] = useState(null)
  const [finalDesc, setFinalDesc] = useState('')

  // Load request data when in change mode
  useEffect(() => {
    if (changeRequestId) {
      console.log('📝 Change mode detected, loading request:', changeRequestId)
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

    const loadVehicleTypes = async () => {
      try {
        const { data } = await api.get('/api/vehicletypes')
        setVehicleTypes(data || [])
      } catch (err) {
        console.error('Failed to load vehicle types:', err)
      }
    }

    // Load all data in parallel
    ;(async () => {
      const [v, f, a, p, t, i, pd, vd, dd, cd, lt, ot, ct, tr, af, rct, ss] = await Promise.all([
        loadLookup('VehicleType'),
        loadLookup('FuelType'),
        loadLookup('ActivityCategory'),
        loadLookup('PlateType'),
        loadLookup('TrackerType'),
        loadLookup('InsuranceName'),
        loadLookup('PersonalDocuments'),
        loadLookup('VehicleDocuments'),
        loadLookup('DiscountDocuments'),
        loadLookup('CompanyDocuments'),
        loadLookup('LicenseType'),
        loadLookup('LicenseDocumentType'),
        loadLookup('CompanyType'),
        loadLookup('TonnageRate'),
        loadLookup('ActivityCategory'),
        loadLookup('TypeOfRegisteredCompany'),
        loadLookup('SelfSacrifice')
      ])
      
      setLkVehicleTypes(v)
      setLkFuelTypes(f)
      setLkActivityCats(a)
      setLkPlateTypes(p)
      setLkTrackerTypes(t)
      setLkInsuranceNames(i)
      setLkPersonalDocs(pd)
      setLkVehicleDocs(vd)
      setLkDiscountDocs(dd)
      setLkCompanyDocs(cd)
      setLkLicenseTypes(lt)
      setLkOperationTypes(ot)
      setLkCompanyTypes(ct)
      setLkTonnageRates(tr)
      setLkActivityFields(af)
      setLkRegisteredCompanyTypes(rct)
      setLkSelfSacrifice(ss)
      
      setLkContactTypes([
        { Id: 1, Name: 'موبایل' },
        { Id: 2, Name: 'تلفن ثابت' },
        { Id: 3, Name: 'ایمیل' },
        { Id: 4, Name: 'فکس' }
      ])
    })()

    loadProvinces()
    loadVehicleTypes()
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

  // Load systems filtered by vehicle type
  const loadSystemsByVehicleType = async (vehicleTypeId) => {
    if (!vehicleTypeId) { setSystems([]); return }
    try {
      const { data } = await api.get(`/api/vehicletypes/${vehicleTypeId}/systems`)
      setSystems(Array.isArray(data) ? data : (data?.systems || []))
    } catch (err) {
      console.error('Failed to load systems:', err)
      setSystems([])
    }
  }
  
  // Load tips filtered by system
  const loadTips = async (systemId) => {
    if (!systemId) { setSystemTips([]); return }
    try {
      const { data } = await api.get(`/api/vehicletypes/systems/${systemId}/tips`)
      setSystemTips(Array.isArray(data) ? data : (data?.tips || []))
    } catch (err) {
      console.error('Failed to load tips:', err)
      setSystemTips([])
    }
  }

  // Load existing request data for change
  const loadRequestForChange = async (reqId) => {
    try {
      console.log('📝 Change mode - Loading request for change:', reqId)
      const { data } = await api.get(`/api/workflow/requests/${reqId}`)
      console.log('📦 Full API Response:', data)
      console.log('📋 Request info:', data.request)
      console.log('👤 Person:', data.person)
      console.log('🚗 Vehicle:', data.vehicle)
      console.log('🏢 Company:', data.company)
      
      setEditModeTrackingNo(data.request?.trackingNo || data.TrackingNo || '')
      
      // Set ownership type from request
      const ownershipTypeValue = data.request?.ownershipType || data.OwnershipType
      if (ownershipTypeValue) {
        setOwnershipType(ownershipTypeValue)
      }
      
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
          otherBloodGroup: data.person.OtherBloodGroup || '',
          otherEducationLevel: data.person.OtherEducationLevel || '',
          otherPhysicalStatus: data.person.OtherPhysicalStatus || '',
          otherMilitaryStatus: data.person.OtherMilitaryStatus || '',
          otherEnglishLevel: data.person.OtherEnglishLevel || '',
          otherVeteranStatus: data.person.OtherVeteranStatus || '',
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
        setStart(s => ({ ...s, nationalCode: data.person.NationalCode || '' }))
      }
      
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
        
        if (data.companyRepresentative) {
          setCompanyRepresentative({
            nationalCode: data.companyRepresentative.RepresentativeNationalCode || '',
            birthDate: data.companyRepresentative.BirthDate || '',
            powerOfAttorneyNo: data.companyRepresentative.PowerOfAttorneyNo || ''
          })
        }
      }
      
      // Load vehicle info
      if (data.vehicle) {
        const vehData = {
          vehicleKindId: data.vehicle.VehicleKindId?.toString() || '',
          systemId: data.vehicle.SystemId?.toString() || '',
          systemTipId: data.vehicle.SystemTipId?.toString() || '',
          yearManufacture: data.vehicle.YearManufacture?.toString() || '',
          capacity: data.vehicle.Capacity?.toString() || '',
          fuelTypeId: data.vehicle.FuelTypeId?.toString() || '',
          trackerTypeId: data.vehicle.TrackerTypeId?.toString() || '',
          cylinders: data.vehicle.Cylinders?.toString() || '',
          axles: data.vehicle.Axles?.toString() || '',
          wheels: data.vehicle.Wheels?.toString() || '',
          vin: data.vehicle.VIN || '',
          chassisNo: data.vehicle.ChassisNo || '',
          engineNo: data.vehicle.EngineNo || '',
          bodyColor: data.vehicle.BodyColor || '',
          activityCategoryId: data.vehicle.ActivityCategoryId?.toString() || '',
          isContainer: data.vehicle.IsContainer ? 'yes' : 'no',
          plateTypeId: data.vehicle.PlateTypeId?.toString() || '',
          plate: {
            p1_serial2: data.vehicle.PlateSerial2?.toString() || '',
            p2_three: data.vehicle.PlateThreeDigits?.toString() || '',
            p3_letter: data.vehicle.PlateLetter || '',
            p4_two: data.vehicle.PlateRegion2?.toString() || ''
          },
          inspectionDate: data.vehicle.InspectionDate || '',
          greenCardDate: data.vehicle.GreenCardDate || '',
          freePlate: data.vehicle.FreePlate || false,
          insuranceCompanyId: data.vehicle.InsuranceCompanyId?.toString() || '',
          insurancePolicyNo: data.vehicle.InsurancePolicyNo || '',
          insuranceIssueDate: data.vehicle.InsuranceIssueDate || '',
          insuranceValidDate: data.vehicle.InsuranceValidDate || '',
          techInspectSerial: data.vehicle.TechInspectSerial || '',
          techInspectIssueDate: data.vehicle.TechInspectIssueDate || '',
          techInspectValidDate: data.vehicle.TechInspectValidDate || ''
        }
        setVehicle(vehData)
        setStart(s => ({ ...s, vin: data.vehicle.VIN || '' }))
        setVehicleId(data.vehicle.VehicleID)
        
        if (data.vehicle.VehicleKindId) {
          await loadSystemsByVehicleType(data.vehicle.VehicleKindId)
        }
        if (data.vehicle.SystemId) {
          await loadTips(data.vehicle.SystemId)
        }
      }
      
      // Load documents
      if (data.personDocuments && data.personDocuments.length > 0) {
        setPersonDocs(data.personDocuments.map(doc => ({
          DocID: doc.DocID,
          DocName: doc.DocName || 'مدرک شخصی',
          DocTypeName: doc.DocTypeName || '',
          LookupDocTypeId: doc.LookupDocTypeId,
          isExisting: true
        })))
      }
      
      if (data.companyDocuments && data.companyDocuments.length > 0) {
        setCompanyDocs(data.companyDocuments.map(doc => ({
          DocID: doc.DocID,
          DocName: doc.DocName || 'مدرک شرکت',
          DocTypeName: doc.DocTypeName || '',
          LookupDocTypeId: doc.LookupDocTypeId,
          isExisting: true
        })))
      }
      
      if (data.vehicleDocuments && data.vehicleDocuments.length > 0) {
        setVehicleDocs(data.vehicleDocuments.map(doc => ({
          DocID: doc.DocID,
          DocName: doc.DocName || 'مدرک خودرو',
          DocTypeName: doc.DocTypeName || '',
          LookupDocTypeId: doc.LookupDocTypeId,
          isExisting: true
        })))
      }
      
      if (data.discountDocuments && data.discountDocuments.length > 0) {
        setDiscountDocs(data.discountDocuments.map(doc => ({
          DocID: doc.DocID,
          DocName: doc.DocName || 'مدرک تخفیف',
          DocTypeName: doc.DocTypeName || '',
          LookupDocTypeId: doc.LookupDocTypeId,
          Description: doc.Description || '',
          isExisting: true
        })))
      }
      
      if (data.FinalDescription) {
        setFinalDesc(data.FinalDescription)
      }
      
      console.log('✅ Request data loaded successfully for change')
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
      
      const { data } = await api.post('/api/issue/vehicle/change', {
        trackingNo: trackingNo,
        changeReason: changeReason,
        changeDescription: changeDescription,
        ownershipType: ownershipType,
        personal: ownershipType === 'حقیقی' ? personal : null,
        vehicle: vehicle,
        companyInfo: ownershipType === 'حقوقی' ? companyInfo : null
      })
      setFinalTrackingNo(data.trackingNo)
      setDoneMessage('درخواست تغییر با موفقیت ثبت شد')
      console.log('✅ Change request created:', data)
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
      <h2>📝 درخواست تغییر پروانه فعالیت</h2>
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
        {/* Personal/Company Info Section */}
        <div className="box" style={{ marginBottom: '20px' }}>
          <div className="box-title">مشخصات</div>
          
          {ownershipType === 'حقوقی' ? (
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
              </div>
            </div>
          ) : (
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
          )}
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