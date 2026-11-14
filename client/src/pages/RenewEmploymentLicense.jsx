import React, { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '../lib/api.js'
import ManualDateInput from '../components/ManualDateInput'

export default function RenewEmploymentLicense({ user }) {
  const navigate = useNavigate()
  const { requestId } = useParams()
  
  // In renewal mode, always use the requestId from URL params
  const editRequestId = requestId
  const isEditMode = !!editRequestId
  
  const [current, setCurrent] = useState(0)
  const [doneMessage, setDoneMessage] = useState('')
  
  // Step 1: Register Information (ثبت مشخصات)
  const [nationalCode, setNationalCode] = useState((user?.Role === 'کارگزار (بهره بردار)' || user?.role === 'کارگزار (بهره بردار)') ? '' : (user?.nationalCode || ''))
  const [checkingInfo, setCheckingInfo] = useState(false)
  const [personFound, setPersonFound] = useState(false)
  const [personId, setPersonId] = useState(null)
  const [showFullForm, setShowFullForm] = useState(false)
  const [consentAccepted, setConsentAccepted] = useState(false)
  
  const [personal, setPersonal] = useState({
    firstName: '',
    lastName: '',
    fatherName: '',
    nationalCode: (user?.Role === 'کارگزار (بهره بردار)' || user?.role === 'کارگزار (بهره بردار)') ? '' : (user?.nationalCode || ''),
    idSerial: '',
    birthProvinceId: '',
    birthCityId: '',
    birthDate: '',
    gender: '',
    maritalStatus: '',
    // Other Information fields
    physicalStatus: '',
    jobStatus: '',
    militaryStatus: '',
    educationLevel: '',
    selfSacrificeStatus: '',
    fluencyEnglish: '',
    certificateType: '',
    validityPeriod: '',
    healthCardNo: '',
    healthCardIssueDate: '',
    healthCardExpiryDate: '',
    drivingLicenseNo: '',
    drivingLicenseIssueDate: '',
    drivingLicenseExpiryDate: '',
    insuranceType: '',
    insuranceStartDate: '',
    insuranceExpiryDate: '',
    noCriminalRecordNo: '',
    residences: [],
    contacts: [],
    // Temporary fields for residence
    tmpProvinceId: '',
    tmpCityId: '',
    tmpMainStreet: '',
    tmpSideStreet: '',
    tmpDistrict: '',
    tmpPostalCode: '',
    tmpPlaque: '',
    tmpUnit: '',
    tmpAddress: '',
    // Temporary fields for contact
    tmpContactType: '',
    tmpContactValue: '',
    tmpContactActive: false
  })
  
  // Vehicle plate information (single plate)
  const [vehiclePlate, setVehiclePlate] = useState({
    plateTypeId: '',
    p1_serial2: '',
    p2_three: '',
    p3_letter: '',
    p4_two: ''
  })
  const [plateExistsInDb, setPlateExistsInDb] = useState(false)
  const [plateValidationChecked, setPlateValidationChecked] = useState(false)
  const [validatedVehicleId, setValidatedVehicleId] = useState(null)
  // UI-only list of plates for employment issue (no DB changes)
  const [plates, setPlates] = useState([])
  const [editingPlateIndex, setEditingPlateIndex] = useState(null)
  
  const [tmpResidence, setTmpResidence] = useState({
    provinceId: '',
    cityId: '',
    address: '',
    postalCode: '',
    plaque: '',
    unit: '',
    phone: ''
  })
  
  // Step 2: Upload Documents (بارگذاری مستندات)
  const [documents, setDocuments] = useState([])
  const [imagePopup, setImagePopup] = useState(null)
  const [loadingDocuments, setLoadingDocuments] = useState(false)
  
  // Step 3: Attach Discounts (پیوست تخفیفات)
  const [discountDocs, setDiscountDocs] = useState([])
  const [docSelType, setDocSelType] = useState('')
  const [discDocSelType, setDiscDocSelType] = useState('')
  const [discDescription, setDiscDescription] = useState('')
  const [lkDiscountDocs, setLkDiscountDocs] = useState([])
  const [vehicleId, setVehicleId] = useState(null)
  
  // Step 4: Finalization (تکمیل عملیات)
  const [finalDesc, setFinalDesc] = useState('')
  const [finalTrackingNo, setFinalTrackingNo] = useState('')
  const [licenseTypeId, setLicenseTypeId] = useState('')
  const [operationTypeId, setOperationTypeId] = useState('')
  const [lkLicenseTypes, setLkLicenseTypes] = useState([])
  const [lkOperationTypes, setLkOperationTypes] = useState([])
  
  // Payment receipts management
  const [paymentReceipts, setPaymentReceipts] = useState({ online: [], offline: [] })
  const [loadingReceipts, setLoadingReceipts] = useState(false)
  const [editingPayment, setEditingPayment] = useState(null)
  const [editForm, setEditForm] = useState({})
  
  // Lookup data
  const [provinces, setProvinces] = useState([])
  const [cities, setCities] = useState([])
  const [citiesByProv, setCitiesByProv] = useState({})
  const [defaultProvinceId, setDefaultProvinceId] = useState(null)
  const [defaultCityId, setDefaultCityId] = useState(null)
  const [lkPhysicalStatus, setLkPhysicalStatus] = useState([])
  const [lkJobStatus, setLkJobStatus] = useState([])
  const [lkMilitaryStatus, setLkMilitaryStatus] = useState([])
  const [lkEducationLevels, setLkEducationLevels] = useState([])
  const [lkContactTypes, setLkContactTypes] = useState([])
  const [lkPlateTypes, setLkPlateTypes] = useState([])
  const [lkSelfSacrifice, setLkSelfSacrifice] = useState([])
  const [lkFluencyEnglish, setLkFluencyEnglish] = useState([])
  const [lkCertificateType, setLkCertificateType] = useState([])
  const [docTypes, setDocTypes] = useState([])
  const [birthCities, setBirthCities] = useState([])
  
  const [step1Validated, setStep1Validated] = useState(false)
  const [secondsLeft, setSecondsLeft] = useState(5)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isNextLoading, setIsNextLoading] = useState(false)
  const [redirectTimer, setRedirectTimer] = useState(5)
  const [isRedirecting, setIsRedirecting] = useState(false)

  // Timer for auto-redirect to payment page
  useEffect(() => {
    if (finalTrackingNo && redirectTimer > 0) {
      const timer = setTimeout(() => {
        setRedirectTimer(prev => prev - 1)
      }, 1000)
      
      return () => clearTimeout(timer)
    }
    
    // Redirect when timer reaches 0
    if (finalTrackingNo && redirectTimer === 0) {
      console.log('🔄 Redirecting to payment page with tracking number:', finalTrackingNo)
      navigate(`/payment?trackingNo=${finalTrackingNo}`)
    }
  }, [finalTrackingNo, redirectTimer, navigate])

  // Set default province and city after they're loaded
  useEffect(() => {
    if (defaultProvinceId && defaultCityId) {
      setTmpResidence(prev => ({
        ...prev,
        provinceId: defaultProvinceId,
        cityId: defaultCityId
      }))
    }

  }, [defaultProvinceId, defaultCityId])

  // UI-only plate management handlers (no DB writes)
  const handleAddPlate = () => {
    const p = {
      plateTypeId: vehiclePlate.plateTypeId || '',
      p1_serial2: (vehiclePlate.p1_serial2 || '').trim(),
      p2_three: (vehiclePlate.p2_three || '').trim(),
      p3_letter: (vehiclePlate.p3_letter || '').trim(),
      p4_two: (vehiclePlate.p4_two || '').trim()
    }
    // Basic validation: require three, letter, serial, region
    if (!p.plateTypeId) {
      alert('نوع پلاک را انتخاب کنید')
      return
    }
    if (!p.p1_serial2 || !p.p2_three || !p.p3_letter || !p.p4_two) {
      alert('تمام بخش‌های پلاک را تکمیل کنید')
      return
    }
    setPlates(prev => [...prev, p])
    // reset inputs
    setVehiclePlate({ plateTypeId: '', p1_serial2: '', p2_three: '', p3_letter: '', p4_two: '' })
    setPlateValidationChecked(false)
    setPlateExistsInDb(false)
  }

  const handleStartEditPlate = (idx) => {
    const p = plates[idx]
    setVehiclePlate({
      plateTypeId: p.plateTypeId || '',
      p1_serial2: p.p1_serial2 || '',
      p2_three: p.p2_three || '',
      p3_letter: p.p3_letter || '',
      p4_two: p.p4_two || ''
    })
    setEditingPlateIndex(idx)
    setPlateValidationChecked(false)
  }

  const handleSavePlateEdit = () => {
    if (editingPlateIndex === null || editingPlateIndex === undefined) return
    const p = {
      plateTypeId: vehiclePlate.plateTypeId || '',
      p1_serial2: (vehiclePlate.p1_serial2 || '').trim(),
      p2_three: (vehiclePlate.p2_three || '').trim(),
      p3_letter: (vehiclePlate.p3_letter || '').trim(),
      p4_two: (vehiclePlate.p4_two || '').trim()
    }
    if (!p.p1_serial2 || !p.p2_three || !p.p3_letter || !p.p4_two) {
      alert('تمام بخش‌های پلاک را تکمیل کنید')
      return
    }
    setPlates(prev => prev.map((x, i) => i === editingPlateIndex ? p : x))
    setEditingPlateIndex(null)
    setVehiclePlate({ plateTypeId: '', p1_serial2: '', p2_three: '', p3_letter: '', p4_two: '' })
  }

  const handleCancelEditPlate = () => {
    setEditingPlateIndex(null)
    setVehiclePlate({ plateTypeId: '', p1_serial2: '', p2_three: '', p3_letter: '', p4_two: '' })
  }

  const handleDeletePlate = (idx) => {
    setPlates(prev => prev.filter((_, i) => i !== idx))
    if (editingPlateIndex === idx) handleCancelEditPlate()
  }

  // Load lookup data on mount
  useEffect(() => {
    loadLookupData()
    loadProvinces()
  }, [])

  // Load request data when in edit mode
  useEffect(() => {
    if (isEditMode && editRequestId) {
      console.log('✏️ Edit mode detected for employment license:', editRequestId)
      loadRequestForEdit(editRequestId)
    }
  }, [editRequestId, isEditMode])

  // Load existing documents when entering documents step
  useEffect(() => {
    if (current === 1) {
      loadExistingDocuments()
    }
  }, [current, nationalCode])

  // Load discount documents when entering discount step
  useEffect(() => {
    (async () => {
      if (current === 2 && nationalCode) {
        try {
          const { data } = await api.get(`/api/issue/employment/${encodeURIComponent(nationalCode)}/discount-documents`)
          setDiscountDocs(data || [])
        } catch (error) {
          console.error('Error loading discount documents:', error)
        }
      }
    })()
  }, [current, nationalCode])

  const loadLookupData = async () => {
    try {
      console.log('Loading lookup data...')
      const [physical, jobStatus, military, education, contact, plateTypes, selfSacrifice, fluencyEnglish, certificateType, employmentDocs, discountDocs, licenseTypes, operationTypes] = await Promise.all([
        loadLookup('PhysicalCondition'),
        loadLookup('JobStatus'),
        loadLookup('DutyStatus'),
        loadLookup('Education'),
        loadLookup('ContactType'),
        loadLookup('PlateType'),
        loadLookup('SelfSacrifice'),
        loadLookup('FluencyEnglish'),
        loadLookup('CertificateType'),
        loadLookup('EmploymentPermitDocuments'),
        loadLookup('DiscountDocuments'),
        loadLookup('LicenseType'),
        loadLookup('LicenseDocumentType')
      ])
      
      setLkPhysicalStatus(physical || [])
      setLkJobStatus(jobStatus || [])
      setLkMilitaryStatus(military || [])
      setLkEducationLevels(education || [])
      setLkContactTypes(contact || [])
      setLkPlateTypes(plateTypes || [])
      setLkSelfSacrifice(selfSacrifice || [])
      setLkFluencyEnglish(fluencyEnglish || [])
      setLkCertificateType(certificateType || [])
      setDocTypes(employmentDocs || [])
      setLkDiscountDocs(discountDocs || [])
      setLkLicenseTypes(licenseTypes || [])
      setLkOperationTypes(operationTypes || [])
      
      // Auto-select "اشتغال" (Employment) as default license type
      const employmentType = (licenseTypes || []).find(x => x.Name === 'اشتغال')
      if (employmentType && !licenseTypeId) {
        setLicenseTypeId(String(employmentType.Id || employmentType.ID))
      }
      
      // Auto-select "تمدید" (Renewal) as default operation type for renewal page
      const renewalType = (operationTypes || []).find(x => x.Name === 'تمدید')
      if (renewalType && !operationTypeId) {
        setOperationTypeId(String(renewalType.Id || renewalType.ID))
      }
      
      console.log('Employment docs loaded:', employmentDocs)
      if (employmentDocs && employmentDocs.length > 0) {
        console.log('First doc type structure:', employmentDocs[0])
        console.log('All field names:', Object.keys(employmentDocs[0]))
      }
    } catch (e) {
      console.error('Failed to load lookup data:', e)
    }
  }

  const loadLookup = async (categoryKey) => {
    try {
      console.log(`Loading lookup: ${categoryKey}`)
      const r = await api.get(`/api/lookups/values?categoryKey=${categoryKey}`)
      console.log(`Loaded ${categoryKey}:`, r.data)
      return r.data || []
    } catch (err) {
      console.error(`Failed to load lookup ${categoryKey}:`, err.response?.data || err.message)
      return []
    }
  }

  const loadProvinces = async () => {
    try {
      const r = await api.get('/api/provinces')
      setProvinces(r.data || [])
      
      // Find East Azerbaijan province
      const eastAzerbaijan = (r.data || []).find(p => (p.Name || p.name)?.includes('آذربایجان شرقی'))
      if (eastAzerbaijan) {
        setDefaultProvinceId(eastAzerbaijan.Id || eastAzerbaijan.ID)
        // Load cities for East Azerbaijan
        loadCities(eastAzerbaijan.Id || eastAzerbaijan.ID).then(cities => {
          // Find Tabriz city
          const tabriz = cities.find(c => (c.Name || c.name)?.includes('تبریز'))
          if (tabriz) {
            setDefaultCityId(tabriz.Id || tabriz.ID)
          }
        })
      }
    } catch (e) {
      console.error('Failed to load provinces:', e)
    }
  }

  const loadCities = async (provinceId) => {
    if (!provinceId) return []
    const key = String(provinceId)
    try {
      const r = await api.get(`/api/provinces/${key}/cities`)
      const cities = r.data || []
      setCitiesByProv(prev => ({ ...prev, [key]: cities }))
      return cities
    } catch {
      return []
    }
  }

  const getProvinceName = (provId) => {
    const p = provinces.find(x => String(x.Id || x.ID) === String(provId))
    return p ? (p.Name || p.name) : ''
  }

  const getCityName = (provId, cityId) => {
    const cities = citiesByProv[String(provId)] || citiesByProv[provId] || []
    const c = cities.find(x => String(x.Id || x.ID) === String(cityId))
    return c ? (c.Name || c.name) : ''
  }

  const normalizeGenderValue = (g) => {
    const v = String(g || '').trim()
    if (v === 'male' || v === 'مرد') return 'مرد'
    if (v === 'female' || v === 'زن') return 'زن'
    return v
  }

  const normalizeMaritalValue = (m) => {
    const v = String(m || '').trim()
    if (v === 'single' || v === 'مجرد') return 'مجرد'
    if (v === 'married' || v === 'متأهل' || v === 'متاهل') return 'متأهل'
    return v
  }

  const mapResidence = (r) => ({
    provinceId: (r?.ProvinceId ?? r?.provinceId) != null ? String(r.ProvinceId ?? r.provinceId) : '',
    cityId: (r?.CityId ?? r?.cityId) != null ? String(r.CityId ?? r.cityId) : '',
    mainStreet: r?.MainStreet || r?.mainStreet || '',
    sideStreet: r?.SideStreet || r?.sideStreet || '',
    district: r?.District || r?.district || '',
    postalCode: r?.PostalCode || r?.postalCode || '',
    plaque: r?.Plaque || r?.plaque || '',
    unit: r?.Unit || r?.unit || '',
    address: r?.Address || r?.address || ''
  })

  const mapContact = (c) => ({
    type: c?.Type || c?.type || '',
    value: c?.Value || c?.value || '',
    isActive: c?.IsActive === true || c?.IsActive === 1 || c?.isActive === true
  })

  const mapPlate = (v) => ({
    plateTypeId: (v?.PlateTypeId ?? v?.plateTypeId) != null ? String(v.PlateTypeId ?? v.plateTypeId) : '',
    p1_serial2: String(v?.PlateSerial2 ?? v?.p1_serial2 ?? '').trim(),
    p2_three: String(v?.PlateThreeDigits ?? v?.p2_three ?? '').trim(),
    p3_letter: String(v?.PlateLetter ?? v?.p3_letter ?? '').trim(),
    p4_two: String(v?.PlateRegion2 ?? v?.p4_two ?? '').trim()
  })

  const lookupNames = (list, current) => {
    const names = (list || []).map(x => x.Name || x.name).filter(Boolean)
    return current && !names.includes(current) ? [current, ...names] : names
  }

  // Check if vehicle plate exists in database
  const checkPlateExists = async (plate) => {
    // Only check if all fields are filled
    if (!plate.plateTypeId || !plate.p1_serial2 || !plate.p2_three || !plate.p3_letter || !plate.p4_two) {
      setPlateValidationChecked(false)
      setPlateExistsInDb(false)
      return
    }

    try {
      const response = await api.post('/api/vehicles/validate-plate', {
        plateTypeId: plate.plateTypeId,
        p1_serial2: plate.p1_serial2,
        p2_three: plate.p2_three,
        p3_letter: plate.p3_letter,
        p4_two: plate.p4_two,
        applicantNationalCode: nationalCode  // کد ملی متقاضی
      })
      
      setPlateValidationChecked(true)
      setPlateExistsInDb(response.data.exists)
      
      // Save VehicleID if plate exists
      if (response.data.exists && response.data.vehicle) {
        setValidatedVehicleId(response.data.vehicle.VehicleID)
        console.log('Plate validation: EXISTS in DB, VehicleID:', response.data.vehicle.VehicleID)
      } else {
        setValidatedVehicleId(null)
        console.log('Plate validation: NOT in DB')
      }
    } catch (error) {
      console.error('Error checking plate:', error)
      setPlateValidationChecked(false)
      setPlateExistsInDb(false)
      setValidatedVehicleId(null)
    }
  }

  const applyLoadedPerson = async (person, pack, preferredVehicle) => {
    const otherInfo = pack?.otherInfo || {}
    const residences = (pack?.residences || []).map(mapResidence)
    const contacts = (pack?.contacts || []).map(mapContact)
    const provinceIds = new Set()
    if (person?.BirthProvinceId != null) provinceIds.add(String(person.BirthProvinceId))
    residences.forEach(r => { if (r.provinceId) provinceIds.add(String(r.provinceId)) })
    const cityLists = {}
    await Promise.all([...provinceIds].map(async id => {
      cityLists[id] = await loadCities(id)
    }))
    if (person?.BirthProvinceId != null) {
      setBirthCities(cityLists[String(person.BirthProvinceId)] || [])
    }

    setPersonal({
      firstName: person.FirstName || '',
      lastName: person.LastName || '',
      fatherName: person.FatherName || '',
      nationalCode: person.NationalCode || '',
      idSerial: person.IdSerial || '',
      birthProvinceId: person.BirthProvinceId != null ? String(person.BirthProvinceId) : '',
      birthCityId: person.BirthCityId != null ? String(person.BirthCityId) : '',
      birthDate: person.BirthDateJalali || person.BirthDate || '',
      gender: normalizeGenderValue(person.Gender),
      maritalStatus: normalizeMaritalValue(person.MaritalStatus),
      physicalStatus: otherInfo.PhysicalStatus || person.OtherPhysicalStatus || '',
      jobStatus: otherInfo.JobStatus || '',
      militaryStatus: otherInfo.MilitaryStatus || person.OtherMilitaryStatus || '',
      educationLevel: otherInfo.EducationLevel || person.OtherEducationLevel || '',
      selfSacrificeStatus: otherInfo.SelfSacrificeStatus || person.OtherVeteranStatus || '',
      fluencyEnglish: otherInfo.FluencyEnglish || person.OtherEnglishLevel || '',
      certificateType: otherInfo.CertificateType || '',
      validityPeriod: otherInfo.ValidityPeriod || '',
      healthCardNo: otherInfo.HealthCardNo || '',
      healthCardIssueDate: otherInfo.HealthCardIssueDate || '',
      healthCardExpiryDate: otherInfo.HealthCardExpiryDate || '',
      drivingLicenseNo: otherInfo.DrivingLicenseNo || '',
      drivingLicenseIssueDate: otherInfo.DrivingLicenseIssueDate || '',
      drivingLicenseExpiryDate: otherInfo.DrivingLicenseExpiryDate || '',
      insuranceType: otherInfo.InsuranceType || '',
      insuranceStartDate: otherInfo.InsuranceStartDate || '',
      insuranceExpiryDate: otherInfo.InsuranceExpiryDate || '',
      noCriminalRecordNo: otherInfo.NoCriminalRecordNo || '',
      residences,
      contacts,
      tmpProvinceId: '',
      tmpCityId: '',
      tmpMainStreet: '',
      tmpSideStreet: '',
      tmpDistrict: '',
      tmpPostalCode: '',
      tmpPlaque: '',
      tmpUnit: '',
      tmpAddress: '',
      tmpContactType: '',
      tmpContactValue: '',
      tmpContactActive: false
    })
    setNationalCode(person.NationalCode || '')
    setPersonFound(true)
    setPersonId(person.PersonID || person.NationalCode || null)
    setShowFullForm(true)

    const vehicle = (preferredVehicle && (preferredVehicle.VehicleID || preferredVehicle.PlateSerial2))
      ? preferredVehicle
      : (pack?.vehicles || [])[0]
    if (vehicle && (vehicle.VehicleID || vehicle.PlateSerial2 || vehicle.PlateThreeDigits)) {
      const plate = mapPlate(vehicle)
      setVehiclePlate(plate)
      if (vehicle.VehicleID) {
        setValidatedVehicleId(vehicle.VehicleID)
        setPlateExistsInDb(true)
        setPlateValidationChecked(true)
      } else {
        await checkPlateExists(plate)
      }
    }
  }

  // Check if person exists by national code
  const handleCheckExistingInfo = async () => {
    if (!nationalCode || nationalCode.length !== 10) {
      alert('لطفاً کد ملی 10 رقمی معتبر وارد کنید')
      return
    }

    setCheckingInfo(true)
    try {
      const response = await api.get(`/api/persons/by-national-code/${nationalCode}`)
      
      if (response.data && response.data.person) {
        await applyLoadedPerson(response.data.person, response.data)
        alert('اطلاعات فرد یافت شد و در فرم بارگذاری گردید')
      } else {
        // Person not found - allow manual entry
        setPersonFound(false)
        setPersonId(null)
        setPersonal(prev => ({ ...prev, nationalCode }))
        setShowFullForm(true)
        alert('اطلاعاتی یافت نشد. لطفاً اطلاعات را به صورت دستی وارد کنید')
      }
    } catch (error) {
      console.error('Error checking person info:', error)
      setPersonFound(false)
      setPersonId(null)
      setPersonal(prev => ({ ...prev, nationalCode }))
      setShowFullForm(true)
      alert('اطلاعاتی یافت نشد. لطفاً اطلاعات را به صورت دستی وارد کنید')
    } finally {
      setCheckingInfo(false)
    }
  }

  const validateStep1 = () => {
   
    if (!personal.nationalCode || personal.nationalCode.length !== 10) {
      alert('کد ملی الزامی است و باید 10 رقم باشد')
      return false
    }
    if (!personal.firstName || !personal.lastName) {
      alert('نام و نام خانوادگی الزامی است')
      return false
    }
    return true
  }

  const next = async () => {
    setIsNextLoading(true)
    try {
    if (current === 0) {
      // Validate Step 1
      if (!validateStep1()) {
        setIsNextLoading(false)
        return
      }
      
      // Validate that vehicle plate is filled (all fields required)
      if (!vehiclePlate.plateTypeId || !vehiclePlate.p1_serial2 || !vehiclePlate.p2_three || !vehiclePlate.p3_letter || !vehiclePlate.p4_two) {
        alert('لطفاً تمام فیلدهای پلاک خودرو را کامل کنید')
        setIsNextLoading(false)
        return
      }
      
      // Validate that the plate exists in the database
      if (!plateExistsInDb) {
        alert('پلاک خودرو وارد شده در سیستم موجود نیست. لطفاً پلاک خودروی ثبت شده در سیستم را وارد کنید.')
        setIsNextLoading(false)
        return
      }
      
      // Save person data to database
      try {
        const payload = {
          firstName: personal.firstName,
          lastName: personal.lastName,
          fatherName: personal.fatherName,
          nationalCode: nationalCode,
          idSerial: personal.idSerial,
          birthProvinceId: personal.birthProvinceId,
          birthCityId: personal.birthCityId,
          birthDate: personal.birthDate,
          gender: personal.gender,
          maritalStatus: personal.maritalStatus,
          residences: personal.residences || [],
          contacts: personal.contacts || [],
          vehiclePlate: vehiclePlate,
          plateExistsInDb: plateExistsInDb,
          otherInfo: {
            physicalStatus: personal.physicalStatus,
            jobStatus: personal.jobStatus,
            militaryStatus: personal.militaryStatus,
            educationLevel: personal.educationLevel,
            selfSacrificeStatus: personal.selfSacrificeStatus,
            fluencyEnglish: personal.fluencyEnglish,
            certificateType: personal.certificateType,
            validityPeriod: personal.validityPeriod,
            healthCardNo: personal.healthCardNo,
            healthCardIssueDate: personal.healthCardIssueDate,
            healthCardExpiryDate: personal.healthCardExpiryDate,
            drivingLicenseNo: personal.drivingLicenseNo,
            drivingLicenseIssueDate: personal.drivingLicenseIssueDate,
            drivingLicenseExpiryDate: personal.drivingLicenseExpiryDate,
            insuranceType: personal.insuranceType,
            insuranceStartDate: personal.insuranceStartDate,
            insuranceExpiryDate: personal.insuranceExpiryDate,
            noCriminalRecordNo: personal.noCriminalRecordNo
          }
        }

        console.log('Saving person data:', payload)
        const response = await api.post('/api/persons/upsert', payload)
        console.log('Person data saved:', response.data)
        
        // Load existing documents when moving to Step 2
        await loadExistingDocuments()
      } catch (error) {
        console.error('Error saving person data:', error)
        alert('خطا در ذخیره اطلاعات: ' + (error.response?.data?.message || error.message))
        setIsNextLoading(false)
        return
      }
    }
    
    if (current === 1) {
      // Validate that all REQUIRED documents are uploaded
      const requiredDocTypes = (docTypes || []).filter(d => d.IsRequired === true || d.IsRequired === 1)
      const uploadedDocTypeIds = new Set(
        (documents || []).map(d => String(d.docTypeId))
      )
      const missingRequiredDocs = requiredDocTypes.filter(d => !uploadedDocTypeIds.has(String(d.Id)))
      
      if (missingRequiredDocs.length > 0) {
        const missingNames = missingRequiredDocs.map(d => d.Name).join('، ')
        alert(`لطفاً مدارک ضروری را بارگذاری کنید.\n\nمدارک ضروری باقی‌مانده: ${missingNames}`)
        setIsNextLoading(false)
        return
      }
      
      console.log('✅ All required documents are uploaded')
      
      // Step 2: Save documents to database
      try {
        // Only send newly uploaded documents (not existing ones from database)
        const newDocuments = documents.filter(doc => !doc.isExisting && doc.fileData)
        
        if (newDocuments.length === 0) {
          // No new documents to save, but required ones are already uploaded - proceed
          console.log('ℹ️ No new documents to save, proceeding...')
          setCurrent(current + 1)
          setIsNextLoading(false)
          return
        }
        
        // Validate file sizes before sending (max 2MB per file)
        const maxSize = 2 * 1024 * 1024 // 2MB in bytes
        const oversizedDocs = newDocuments.filter(doc => doc.fileSize > maxSize)
        
        if (oversizedDocs.length > 0) {
          const oversizedNames = oversizedDocs.map(doc => 
            `${doc.docTypeName} (${formatFileSize(doc.fileSize)})`
          ).join('\n')
          alert(`حجم فایل‌های زیر بیشتر از 2 مگابایت است. لطفاً آنها را حذف کرده و فایل‌های کوچکتر آپلود کنید:\n\n${oversizedNames}`)
          setIsNextLoading(false)
          return
        }
        
        const payload = {
          nationalCode: nationalCode,
          documents: newDocuments.map(doc => ({
            docTypeId: doc.docTypeId,
            fileName: doc.fileName,
            fileSize: doc.fileSize,
            fileData: doc.fileData
          }))
        }
        
        console.log('Saving documents:', payload.documents.length, 'new documents')
        console.log('Documents payload:', payload.documents.map(d => ({
          docTypeId: d.docTypeId,
          fileName: d.fileName,
          fileSize: d.fileSize,
          hasFileData: !!d.fileData
        })))
        const response = await api.post('/api/persons/upsert', payload)
        console.log('Documents saved:', response.data)
      } catch (error) {
        console.error('Error saving documents:', error)
        alert('خطا در ذخیره مستندات: ' + (error.response?.data?.message || error.message))
        setIsNextLoading(false)
        return
      }
    }
    
    if (current === 2) {
      // Validate that all REQUIRED discount documents (EmploymentPermitDocuments) are uploaded
      const requiredDiscountDocs = (lkDiscountDocs || []).filter(d => d.IsRequired === true || d.IsRequired === 1)
      const uploadedDiscountDocTypeIds = new Set(
        (discountDocs || []).map(d => String(d.LookupDocTypeId))
      )
      const missingRequiredDiscountDocs = requiredDiscountDocs.filter(d => !uploadedDiscountDocTypeIds.has(String(d.Id ?? d.ID)))
      
      if (missingRequiredDiscountDocs.length > 0) {
        const missingNames = missingRequiredDiscountDocs.map(d => d.Name).join('، ')
        alert(`لطفاً مدارک ضروری پیوست تخفیفات را بارگذاری کنید.\n\nمدارک ضروری باقی‌مانده: ${missingNames}`)
        setIsNextLoading(false)
        return
      }
      
      console.log('✅ All required discount documents are uploaded')
    }
    
    if (current < 3) setCurrent(current + 1)
    } finally {
      setIsNextLoading(false)
    }
  }

  const prev = () => {
    if (current > 0) setCurrent(current - 1)
  }

  // Load request data for edit mode
  const loadRequestForEdit = async (reqId) => {
    try {
      console.log('✏️ Edit mode - Loading request for edit:', reqId)
      
      // First, get the request to find the national code
      const { data: requestData } = await api.get(`/api/workflow/requests/${reqId}`)
      console.log('📦 Request data:', requestData)
      
      const applicantCode = String(
        requestData.person?.NationalCode
        || requestData.request?.nationalCode
        || requestData.NationalCode
        || ''
      ).trim()
      if (!applicantCode) {
        console.error('❌ No national code found in request')
        alert('خطا: کد ملی یافت نشد')
        return
      }
      
      const { data: personData } = await api.get(`/api/persons/by-national-code/${applicantCode}`)
      
      setEditModeTrackingNo(requestData.request?.trackingNo || requestData.TrackingNo || '')
      if (requestData.request?.licenseTypeId) {
        setLicenseTypeId(String(requestData.request.licenseTypeId))
      }
      if (requestData.request?.finalDescription) {
        setFinalDesc(requestData.request.finalDescription)
      }
      
      if (personData.person) {
        await applyLoadedPerson(personData.person, personData, requestData.vehicle)
      }
      
      console.log('✅ Person data loaded successfully')
    } catch (error) {
      console.error('❌ Error loading request for edit:', error)
      alert('خطا در بارگذاری اطلاعات پرونده: ' + (error?.response?.data?.message || error.message))
    }
  }

  const [editModeTrackingNo, setEditModeTrackingNo] = useState('')

  // Save changes for edit mode
  const handleSaveChanges = async () => {
    try {
      console.log('💾 Saving changes for employment request:', editRequestId)
      
      // For employment license, data is already saved through the next() function
      // in each step (personal info, documents, discounts)
      
      // Check if request has deficiency status and submit corrections if needed
      const deficiencyResponse = await api.get(`/api/workflow/requests/${editRequestId}/deficiency-status`)
      const hasDeficiency = deficiencyResponse?.data?.hasDeficiency || false
      
      console.log('📋 Deficiency status:', hasDeficiency)
      
      if (hasDeficiency) {
        console.log('✅ Submitting corrections to clear deficiency...')
        const correctionResponse = await api.post(`/api/workflow/requests/${editRequestId}/submit-corrections`)
        alert('✅ ' + (correctionResponse?.data?.message || 'رفع نقص با موفقیت انجام شد و پرونده ارجاع گردید'))
      } else {
        alert('✅ تغییرات با موفقیت ذخیره شد')
      }
      
      // Redirect back to inbox or admin requests page
      const currentUser = JSON.parse(localStorage.getItem('user') || '{}')
      if (currentUser.Role === 'Admin') {
        navigate('/admin/workflow/requests')
      } else {
        navigate('/workflow/inbox')
      }
    } catch (error) {
      console.error('❌ Error saving changes:', error)
      alert('خطا در ذخیره تغییرات: ' + (error?.response?.data?.message || error.message))
    }
  }

  const handleFinalSubmit = async () => {
    if (!nationalCode) {
      alert('کد ملی یافت نشد')
      return
    }
    if (!licenseTypeId) {
      alert('لطفاً نوع پروانه را انتخاب کنید')
      return
    }
    if (!operationTypeId) {
      alert('لطفاً نوع عملیات را انتخاب کنید')
      return
    }
    if (finalDesc.length > 2000) {
      alert('توضیحات نباید بیشتر از 2000 کاراکتر باشد')
      return
    }
    
    // Prevent multiple submissions
    if (isSubmitting) {
      return
    }
    
    setIsSubmitting(true)
    try {
      // In renewal mode, we need to:
      // 1. Get the EXISTING tracking number from the original request
      // 2. Call the renewal endpoint to create a VehicleRequests record with the existing tracking number
      let existingTrackingNo = editModeTrackingNo
      
      if (isEditMode && editRequestId) {
        // Get the existing tracking number from the original request
        console.log('📋 Getting existing tracking number for renewal...')
        const { data: requestData } = await api.get(`/api/workflow/requests/${editRequestId}`)
        existingTrackingNo = requestData?.request?.TrackingNo || requestData?.TrackingNo || editModeTrackingNo
        console.log('📋 Existing tracking number for renewal:', existingTrackingNo)
      }
      
      const { data } = await api.post('/api/issue/employment/finalize', {
        nationalCode: nationalCode,
        licenseTypeId: Number(licenseTypeId),
        operationTypeId: Number(operationTypeId),
        finalDescription: finalDesc,
        vehicleId: validatedVehicleId,
        existingTrackingNo: existingTrackingNo, // Send existing tracking number for renewal
        isRenewal: isEditMode // Flag to indicate this is a renewal
      })
      setFinalTrackingNo(data.trackingNo)
      setDoneMessage('درخواست با موفقیت ثبت شد')
      // Reset and start redirect timer
      setRedirectTimer(5)
      console.log('✅ Employment license request created:', data)
    } catch (error) {
      console.error('Error finalizing request:', error)
      alert(error?.response?.data?.message || 'خطا در ثبت نهایی درخواست. لطفاً مجدداً تلاش کنید.')
      setIsSubmitting(false) // Re-enable button on error
    }
  }

  const renderStepContent = () => {
    switch (current) {
      case 0:
        return renderStep1RegisterInfo()
      case 1:
        return renderStep2UploadDocuments()
      case 2:
        return renderStep3AttachDiscounts()
      case 3:
        return renderStep4Complete()
      default:
        return null
    }
  }

  const renderStep1RegisterInfo = () => (
    <div className="step-content">
      <h3 className="step-title">ثبت مشخصات</h3>
      
      {/* National Code Check Section */}
      <div className="national-code-check">
        <label style={{ fontWeight: 600, marginBottom: '10px', display: 'block' }}>کد ملی</label>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
          <input
            type="text"
            disabled
            value={nationalCode}
            onChange={e => setNationalCode(e.target.value.replace(/[^0-9]/g, ''))}
            maxLength={10}
            placeholder="کد ملی 10 رقمی"
            className="national-code-input"
          />
          <button
            onClick={handleCheckExistingInfo}
            disabled={checkingInfo || nationalCode.length !== 10}
            className="btn-check"
          >
            {checkingInfo ? 'در حال بررسی...' : 'بررسی وجود اطلاعات'}
          </button>
        </div>
        
        {personFound && <div className="info-message">✓ اطلاعات فرد یافت شد</div>}
      </div>

      {/* Personal Information - Only show after checking */}
      {showFullForm && (
      <>
        <div className="box">
          <div className="box-title">مشخصات فردی</div>
          <div className="form-section-content">
            <div className="form-grid">
              <label>نام *</label>
              <input value={personal.firstName} onChange={e => setPersonal(p => ({ ...p, firstName: e.target.value }))} />
              
              <label>نام خانوادگی *</label>
              <input value={personal.lastName} onChange={e => setPersonal(p => ({ ...p, lastName: e.target.value }))} />
              
              <label>نام پدر</label>
              <input value={personal.fatherName} onChange={e => setPersonal(p => ({ ...p, fatherName: e.target.value }))} />
              
              <label>شماره شناسنامه</label>
              <input value={personal.idSerial} onChange={e => setPersonal(p => ({ ...p, idSerial: e.target.value }))} />

              <label>تاریخ تولد</label>
              <div style={{ gridColumn: 'span 3' }}>
                <ManualDateInput value={personal.birthDate} onChange={val => setPersonal(p => ({ ...p, birthDate: val }))} />
              </div>
              
              <label>جنسیت *</label>
              <div style={{ display:'flex', gap:16, alignItems:'center', gridColumn:'span 3' }}>
                {console.log('Rendering gender radios - personal.gender:', personal.gender, 'Comparison:', personal.gender==='مرد', personal.gender==='زن')}
                <label style={{ display:'flex', gap:6, alignItems:'center', margin:0 }}>
                  <input type="radio" name="gender" checked={personal.gender==='مرد'} onChange={() => setPersonal(p=>({...p, gender:'مرد'}))} /> مرد
                </label>
                <label style={{ display:'flex', gap:6, alignItems:'center', margin:0 }}>
                  <input type="radio" name="gender" checked={personal.gender==='زن'} onChange={() => setPersonal(p=>({...p, gender:'زن'}))} /> زن
                </label>
              </div>
              
              <label>وضعیت تأهل *</label>
              <div style={{ display:'flex', gap:16, alignItems:'center', gridColumn:'span 3' }}>
                <label style={{ display:'flex', gap:6, alignItems:'center', margin:0 }}>
                  <input type="radio" name="maritalStatus" checked={personal.maritalStatus==='مجرد'} onChange={() => setPersonal(p=>({...p, maritalStatus:'مجرد'}))} /> مجرد
                </label>
                <label style={{ display:'flex', gap:6, alignItems:'center', margin:0 }}>
                  <input type="radio" name="maritalStatus" checked={personal.maritalStatus==='متأهل'} onChange={() => setPersonal(p=>({...p, maritalStatus:'متأهل'}))} /> متأهل
                </label>
              </div>

              <label>کد ملی</label>
              <input value={personal.nationalCode} disabled style={{ background: '#f3f4f6' }} readOnly />

              <label>استان محل تولد</label>
              <select value={String(personal.birthProvinceId || '')} onChange={async e => {
                const id = e.target.value
                const cities = await loadCities(id)
                setBirthCities(cities)
                setPersonal(p => ({ ...p, birthProvinceId: id, birthCityId: cities?.[0] ? String(cities[0].Id ?? cities[0].ID) : '' }))
              }}>
                <option value="">انتخاب کنید...</option>
                {provinces.map(p => (<option key={p.Id || p.ID} value={String(p.Id ?? p.ID)}>{p.Name || p.name}</option>))}
              </select>
              
              <label>شهر محل تولد</label>
              <select value={String(personal.birthCityId || '')} onChange={e => setPersonal(p => ({ ...p, birthCityId: e.target.value }))}>
                <option value="">انتخاب کنید...</option>
                {birthCities.map(c => (<option key={c.Id || c.ID} value={String(c.Id ?? c.ID)}>{c.Name || c.name}</option>))}
              </select>
            </div>
          </div>
        </div>

        {/* Residence Information */}
        <div className="box">
          <div className="box-title">مشخصات محل سکونت</div>
          <div className="form-section-content">
            <div className="form-grid">
              <label>استان</label>
              <select value={String(personal.tmpProvinceId || '')} onChange={async e => {
                const id = e.target.value
                const cities = await loadCities(id)
                setPersonal(p => ({ ...p, tmpProvinceId: id, tmpCityId: cities?.[0] ? String(cities[0].Id ?? cities[0].ID) : '' }))
              }}>
                <option value="">انتخاب کنید...</option>
                {provinces.map(p => (<option key={p.Id || p.ID} value={String(p.Id ?? p.ID)}>{p.Name || p.name}</option>))}
              </select>
              <label>شهر</label>
              <select value={String(personal.tmpCityId || '')} onChange={e => setPersonal(p => ({ ...p, tmpCityId: e.target.value }))}>
                <option value="">انتخاب کنید...</option>
                {(citiesByProv[String(personal.tmpProvinceId)] || citiesByProv[personal.tmpProvinceId] || []).map(c => (<option key={c.Id || c.ID} value={String(c.Id ?? c.ID)}>{c.Name || c.name}</option>))}
              </select>

              <label>خیابان اصلی</label>
              <input value={personal.tmpMainStreet || ''} onChange={e => setPersonal(p => ({ ...p, tmpMainStreet: e.target.value }))} />
              <label>خیابان فرعی</label>
              <input value={personal.tmpSideStreet || ''} onChange={e => setPersonal(p => ({ ...p, tmpSideStreet: e.target.value }))} />

              <label>منطقه/شهرداری</label>
              <input value={personal.tmpDistrict || ''} onChange={e => setPersonal(p => ({ ...p, tmpDistrict: e.target.value }))} />
              <label>کد پستی</label>
              <input value={personal.tmpPostalCode || ''} onChange={e => setPersonal(p => ({ ...p, tmpPostalCode: e.target.value.replace(/[^0-9]/g,'') }))} />

              <label>پلاک</label>
              <input value={personal.tmpPlaque || ''} onChange={e => setPersonal(p => ({ ...p, tmpPlaque: e.target.value }))} />
              <label>واحد</label>
              <input value={personal.tmpUnit || ''} onChange={e => setPersonal(p => ({ ...p, tmpUnit: e.target.value }))} />

              <label>آدرس</label>
              <input value={personal.tmpAddress || ''} onChange={e => setPersonal(p => ({ ...p, tmpAddress: e.target.value }))} />

              <label>نوع تماس</label>
              <select value={personal.tmpContactType || ''} onChange={e => setPersonal(p => ({ ...p, tmpContactType: e.target.value }))}>
                <option value="">انتخاب کنید...</option>
                {(lkContactTypes.length ? lkContactTypes : [{ Name: 'موبایل' }, { Name: 'تلفن ثابت' }, { Name: 'ایمیل' }]).map(ct => (
                  <option key={ct.Id || ct.ID || ct.Name || ct.name} value={ct.Name || ct.name}>{ct.Name || ct.name}</option>
                ))}
              </select>
              <label>شماره/ایمیل</label>
              <input value={personal.tmpContactValue || ''} onChange={e => setPersonal(p => ({ ...p, tmpContactValue: e.target.value }))} />
              <label>فعال</label>
              <input type="checkbox" checked={!!personal.tmpContactActive} onChange={e => setPersonal(p => ({ ...p, tmpContactActive: e.target.checked }))} />

              <div />
              <div style={{ display:'flex', gap:12 }}>
                <button 
                  type="button" 
                  className="btn-primary" 
                  onClick={() => setPersonal(p => ({
                    ...p,
                    residences: [...(p.residences||[]), {
                      provinceId: p.tmpProvinceId || '', cityId: p.tmpCityId || '', mainStreet: p.tmpMainStreet || '', sideStreet: p.tmpSideStreet || '',
                      district: p.tmpDistrict || '', postalCode: p.tmpPostalCode || '', plaque: p.tmpPlaque || '', unit: p.tmpUnit || '', address: p.tmpAddress || ''
                    }],
                    tmpProvinceId:'', tmpCityId:'', tmpMainStreet:'', tmpSideStreet:'', tmpDistrict:'', tmpPostalCode:'', tmpPlaque:'', tmpUnit:'', tmpAddress:''
                  }))}
                >
                  افزودن آدرس
                </button>
                <button 
                  type="button" 
                  className="btn-secondary" 
                  onClick={() => setPersonal(p => ({
                    ...p,
                    contacts: [...(p.contacts||[]), {
                      type: p.tmpContactType || '', value: p.tmpContactValue || '', isActive: p.tmpContactActive || false
                    }],
                    tmpContactType:'', tmpContactValue:'', tmpContactActive: false
                  }))}
                >
                  افزودن تماس
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Residences List */}
        {personal.residences && personal.residences.length > 0 && (
          <div className="box">
            <div className="box-title">لیست نشانی‌ها</div>
            <div className="form-section-content">
              {personal.residences.map((res, idx) => (
                <div key={idx} style={{ marginBottom: '12px', padding: '12px', border: '1px solid #e5e7eb', borderRadius: '6px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <strong>آدرس {idx + 1}:</strong>{' '}
                      {getProvinceName(res.provinceId || res.ProvinceId) || '—'} - {getCityName(res.provinceId || res.ProvinceId, res.cityId || res.CityId) || '—'}
                      {(res.mainStreet || res.MainStreet) && ` - ${res.mainStreet || res.MainStreet}`}
                      {(res.sideStreet || res.SideStreet) && ` - ${res.sideStreet || res.SideStreet}`}
                      {(res.district || res.District) && ` - ${res.district || res.District}`}
                      {(res.address || res.Address) && ` - ${res.address || res.Address}`}
                      {(res.postalCode || res.PostalCode) && ` - کد پستی: ${res.postalCode || res.PostalCode}`}
                      {(res.plaque || res.Plaque) && ` - پلاک: ${res.plaque || res.Plaque}`}
                      {(res.unit || res.Unit) && ` - واحد: ${res.unit || res.Unit}`}
                    </div>
                    <button 
                      type="button" 
                      className="btn-danger" 
                      onClick={() => setPersonal(p => ({
                        ...p,
                        residences: p.residences.filter((_, i) => i !== idx)
                      }))}
                      style={{ padding: '4px 8px', fontSize: '12px' }}
                    >
                      حذف
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Contacts List */}
        {personal.contacts && personal.contacts.length > 0 && (
          <div className="box">
            <div className="box-title">لیست تماس‌ها</div>
            <div className="form-section-content">
              {personal.contacts.map((contact, idx) => (
                <div key={idx} style={{ marginBottom: '8px', padding: '8px', border: '1px solid #e5e7eb', borderRadius: '4px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>
                      <strong>تماس {idx + 1}:</strong> {(contact.type || contact.Type) ? `${contact.type || contact.Type} - ` : ''}{contact.value || contact.Value}{(contact.isActive || contact.IsActive) ? ' (فعال)' : ''}
                    </span>
                    <button 
                      type="button" 
                      className="btn-danger" 
                      onClick={() => setPersonal(p => ({
                        ...p,
                        contacts: p.contacts.filter((_, i) => i !== idx)
                      }))}
                      style={{ padding: '4px 8px', fontSize: '12px' }}
                    >
                      حذف
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Vehicle Plate Section */}
        <div className="box">
          <div className="box-title">مشخصات پلاک خودرو</div>
          <div className="form-section-content">
            <div className="form-grid">
              <label>نوع پلاک</label>
              <select 
                value={String(vehiclePlate.plateTypeId || '')} 
                disabled={isEditMode}
                onChange={async e => {
                  if (isEditMode) return
                  const plateTypeId = e.target.value
                  setVehiclePlate(prev => ({ ...prev, plateTypeId }))
                  setPlateValidationChecked(false)
                  setPlateExistsInDb(false)
                }}
              >
                <option value="">انتخاب کنید...</option>
                {lkPlateTypes.map(pt => (
                  <option key={pt.Id || pt.ID} value={String(pt.Id ?? pt.ID)}>
                    {pt.Name || pt.name}
                  </option>
                ))}
              </select>

              <label>سه رقمه</label>
              <input 
                value={vehiclePlate.p2_three || ''} 
                readOnly={isEditMode}
                disabled={isEditMode}
                onChange={e => {
                  if (isEditMode) return
                  setVehiclePlate(prev => ({ ...prev, p2_three: e.target.value.replace(/[^0-9]/g, '').slice(0, 3) }))
                  setPlateValidationChecked(false)
                  setPlateExistsInDb(false)
                }}
                maxLength={3}
                placeholder="سه رقمه"
              />

              <label>حرف</label>
              <input 
                value={vehiclePlate.p3_letter || ''} 
                readOnly={isEditMode}
                disabled={isEditMode}
                onChange={e => {
                  if (isEditMode) return
                  setVehiclePlate(prev => ({ ...prev, p3_letter: e.target.value }))
                  setPlateValidationChecked(false)
                  setPlateExistsInDb(false)
                }}
                maxLength={3}
                placeholder="حرف"
              />

              <label>دو رقمه</label>
              <input 
                value={vehiclePlate.p4_two || ''} 
                readOnly={isEditMode}
                disabled={isEditMode}
                onChange={e => {
                  if (isEditMode) return
                  setVehiclePlate(prev => ({ ...prev, p4_two: e.target.value.replace(/[^0-9]/g, '').slice(0, 2) }))
                  setPlateValidationChecked(false)
                  setPlateExistsInDb(false)
                }}
                maxLength={2}
                placeholder="دو رقمه"
              />

              <label>شناسه پلاک</label>
              <input 
                value={vehiclePlate.p1_serial2 || ''} 
                readOnly={isEditMode}
                disabled={isEditMode}
                onChange={e => {
                  if (isEditMode) return
                  setVehiclePlate(prev => ({ ...prev, p1_serial2: e.target.value.replace(/[^0-9]/g, '').slice(0, 2) }))
                  setPlateValidationChecked(false)
                  setPlateExistsInDb(false)
                }}
                maxLength={2}
                placeholder="شناسه پلاک"
              />

              {!plateValidationChecked && (
                <div style={{ gridColumn: 'span 4', textAlign: 'center', padding: '12px', background: '#fef3c7', borderRadius: '6px' }}>
                  <p style={{ margin: 0, color: '#92400e' }}>لطفاً پلاک را وارد کنید</p>
                </div>
              )}

              {plateValidationChecked && plateExistsInDb && (
                <div style={{ gridColumn: 'span 4', textAlign: 'center', padding: '12px', background: '#d1fae5', borderRadius: '6px' }}>
                  <p style={{ margin: 0, color: '#065f46', fontWeight: 600 }}>✓ پلاک در سیستم موجود است</p>
                </div>
              )}

              {plateValidationChecked && !plateExistsInDb && (
                <div style={{ gridColumn: 'span 4', textAlign: 'center', padding: '12px', background: '#fee2e2', borderRadius: '6px' }}>
                  <p style={{ margin: 0, color: '#991b1b', fontWeight: 600 }}>✗ پلاک در سیستم موجود نیست</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Plates List */}
        {plates.length > 0 && (
          <div className="box">
            <div className="box-title">لیست پلاک‌ها</div>
            <div className="form-section-content">
              {plates.map((p, idx) => (
                <div key={idx} style={{ marginBottom: '8px', padding: '8px', border: '1px solid #e5e7eb', borderRadius: '4px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>
                      پلاک {idx + 1}: {p.p1_serial2}-{p.p2_three}-{p.p3_letter}-{p.p4_two}
                    </span>
                    {!isEditMode && (
                    <div>
                      <button 
                        type="button" 
                        className="btn-primary" 
                        onClick={() => handleStartEditPlate(idx)}
                        style={{ padding: '4px 8px', fontSize: '12px', marginLeft: '4px' }}
                      >
                        ویرایش
                      </button>
                      <button 
                        type="button" 
                        className="btn-danger" 
                        onClick={() => handleDeletePlate(idx)}
                        style={{ padding: '4px 8px', fontSize: '12px' }}
                      >
                        حذف
                      </button>
                    </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="box">
          <div className="box-title">سایر اطلاعات</div>
          <div className="form-section-content">
            <div className="form-grid">
              <label>وضعیت جسمانی</label>
              <select value={personal.physicalStatus || ''} onChange={e => setPersonal(p => ({ ...p, physicalStatus: e.target.value }))}>
                <option value="">انتخاب کنید...</option>
                {lookupNames(lkPhysicalStatus, personal.physicalStatus).map(name => <option key={name} value={name}>{name}</option>)}
              </select>

              <label>وضعیت نظام وظیفه</label>
              <select value={personal.militaryStatus || ''} onChange={e => setPersonal(p => ({ ...p, militaryStatus: e.target.value }))}>
                <option value="">انتخاب کنید...</option>
                {lookupNames(lkMilitaryStatus, personal.militaryStatus).map(name => <option key={name} value={name}>{name}</option>)}
              </select>

              <label>وضعیت شغلی</label>
              <select value={personal.jobStatus || ''} onChange={e => setPersonal(p => ({ ...p, jobStatus: e.target.value }))}>
                <option value="">انتخاب کنید...</option>
                {lookupNames(lkJobStatus, personal.jobStatus).map(name => <option key={name} value={name}>{name}</option>)}
              </select>

              <label>تحصیلات</label>
              <select value={personal.educationLevel || ''} onChange={e => setPersonal(p => ({ ...p, educationLevel: e.target.value }))}>
                <option value="">انتخاب کنید...</option>
                {lookupNames(lkEducationLevels, personal.educationLevel).map(name => <option key={name} value={name}>{name}</option>)}
              </select>

              <label>وضعیت ایثارگری</label>
              <select value={personal.selfSacrificeStatus || ''} onChange={e => setPersonal(p => ({ ...p, selfSacrificeStatus: e.target.value }))}>
                <option value="">انتخاب کنید...</option>
                {lookupNames(lkSelfSacrifice, personal.selfSacrificeStatus).map(name => <option key={name} value={name}>{name}</option>)}
              </select>

              <label>تسلط به زبان انگلیسی</label>
              <select value={personal.fluencyEnglish || ''} onChange={e => setPersonal(p => ({ ...p, fluencyEnglish: e.target.value }))}>
                <option value="">انتخاب کنید...</option>
                {lookupNames(lkFluencyEnglish, personal.fluencyEnglish).map(name => <option key={name} value={name}>{name}</option>)}
              </select>

              <label>نوع گواهینامه</label>
              <select value={personal.certificateType || ''} onChange={e => setPersonal(p => ({ ...p, certificateType: e.target.value }))}>
                <option value="">انتخاب کنید...</option>
                {lookupNames(lkCertificateType, personal.certificateType).map(name => <option key={name} value={name}>{name}</option>)}
              </select>

              <label>مدت اعتبار</label>
              <input value={personal.validityPeriod || ''} onChange={e => setPersonal(p => ({ ...p, validityPeriod: e.target.value }))} />

              <label>شماره گواهینامه</label>
              <input value={personal.drivingLicenseNo || ''} onChange={e => setPersonal(p => ({ ...p, drivingLicenseNo: e.target.value }))} />

              <label>تاریخ صدور گواهینامه</label>
              <div style={{ gridColumn: 'span 3' }}>
                <ManualDateInput value={personal.drivingLicenseIssueDate} onChange={val => setPersonal(p => ({ ...p, drivingLicenseIssueDate: val }))} />
              </div>

              <label>تاریخ اعتبار گواهینامه</label>
              <div style={{ gridColumn: 'span 3' }}>
                <ManualDateInput value={personal.drivingLicenseExpiryDate} onChange={val => setPersonal(p => ({ ...p, drivingLicenseExpiryDate: val }))} />
              </div>

              <label>شماره کارت سلامت</label>
              <input value={personal.healthCardNo || ''} onChange={e => setPersonal(p => ({ ...p, healthCardNo: e.target.value }))} />

              <label>تاریخ صدور کارت سلامت</label>
              <div style={{ gridColumn: 'span 3' }}>
                <ManualDateInput value={personal.healthCardIssueDate} onChange={val => setPersonal(p => ({ ...p, healthCardIssueDate: val }))} />
              </div>

              <label>تاریخ انقضای کارت سلامت</label>
              <div style={{ gridColumn: 'span 3' }}>
                <ManualDateInput value={personal.healthCardExpiryDate} onChange={val => setPersonal(p => ({ ...p, healthCardExpiryDate: val }))} />
              </div>

              <label>نوع بیمه</label>
              <input value={personal.insuranceType || ''} onChange={e => setPersonal(p => ({ ...p, insuranceType: e.target.value }))} />

              <label>تاریخ شروع بیمه</label>
              <div style={{ gridColumn: 'span 3' }}>
                <ManualDateInput value={personal.insuranceStartDate} onChange={val => setPersonal(p => ({ ...p, insuranceStartDate: val }))} />
              </div>

              <label>تاریخ پایان بیمه</label>
              <div style={{ gridColumn: 'span 3' }}>
                <ManualDateInput value={personal.insuranceExpiryDate} onChange={val => setPersonal(p => ({ ...p, insuranceExpiryDate: val }))} />
              </div>

              <label>شماره عدم سوءپیشینه</label>
              <input value={personal.noCriminalRecordNo || ''} onChange={e => setPersonal(p => ({ ...p, noCriminalRecordNo: e.target.value }))} />
            </div>
          </div>
        </div>
      </>
      )}
    </div>
  )

  const handleDocUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Check file size (max 2MB)
    const maxSize = 2 * 1024 * 1024 // 2MB in bytes
    if (file.size > maxSize) {
      alert('حجم فایل نباید بیشتر از 2 مگابایت باشد')
      e.target.value = '' // Reset input
      return
    }

    // Check if document type is selected
    const docTypeSelect = document.getElementById('docTypeSelectRenew')
    const docTypeId = docTypeSelect?.value
    if (!docTypeId) {
      alert('لطفاً نوع مدرک را انتخاب کنید')
      e.target.value = ''
      return
    }

    try {
      // Convert file to base64
      const reader = new FileReader()
      reader.onload = () => {
        const base64 = reader.result
        // Find docType using Id field
        const docType = docTypes.find(d => d.Id?.toString() === docTypeId)
        const docTypeName = docType?.Name || 'مدرک'
        
        // Add document to list
        const newDoc = {
          id: Date.now(),
          docTypeId: docTypeId,
          docTypeName: docTypeName,
          fileName: file.name,
          fileSize: file.size,
          fileData: base64,
          uploadDate: new Date().toISOString(),
          isExisting: false
        }
        
        setDocuments(prev => [...prev, newDoc])
        
        // Reset input and select
        e.target.value = ''
        if (docTypeSelect) docTypeSelect.value = ''
        
        alert('مدرک با موفقیت آپلود شد')
      }
      reader.onerror = () => {
        alert('خطا در خواندن فایل')
        e.target.value = ''
      }
      reader.readAsDataURL(file)
    } catch (error) {
      console.error('Error uploading document:', error)
      alert('خطا در آپلود مدرک')
      e.target.value = ''
    }
  }

  const handleRemoveDoc = (docId) => {
    if (confirm('آیا از حذف این مدرک اطمینان دارید؟')) {
      setDocuments(prev => prev.filter(d => d.id !== docId))
    }
  }

  const renderStep2UploadDocuments = () => (
    <div className="step-content">
      <h3 className="step-title">بارگذاری مستندات</h3>
      <p style={{ marginBottom: '24px', color: '#64748b' }}>آپلود مدارک مورد نیاز برای پروانه اشتغال (حداکثر حجم هر فایل: 2 مگابایت)</p>
      
      {/* Loading indicator */}
      {loadingDocuments && (
        <div style={{ padding: '20px', textAlign: 'center', color: '#3b82f6' }}>
          <div style={{ fontSize: '18px', marginBottom: '8px' }}>⏳ در حال بارگذاری مدارک موجود...</div>
        </div>
      )}
      
      {/* Upload Section */}
      <div style={{ 
        background: '#f8fafc', 
        padding: '24px', 
        borderRadius: '12px', 
        border: '2px dashed #cbd5e1',
        marginBottom: '24px'
      }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '16px', alignItems: 'end' }}>
          <div className="form-group">
            <label htmlFor="docTypeSelectRenew" style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>
              نوع مدرک <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <select 
              id="docTypeSelectRenew"
              className="form-control"
              style={{ width: '100%', padding: '12px', border: '2px solid #cbd5e1', borderRadius: '8px', fontSize: '15px' }}
            >
              <option value="">-- انتخاب کنید --</option>
              {docTypes.map(dt => {
                const valueId = dt.Id
                const isUsed = documents.some(doc => doc.docTypeId?.toString() === valueId?.toString())
                const isRequired = dt.IsRequired === true || dt.IsRequired === 1
                return (
                  <option 
                    key={valueId} 
                    value={valueId}
                    disabled={isUsed}
                    style={{ color: isUsed ? '#94a3b8' : '#1e293b' }}
                  >
                    {isRequired ? '* ' : ''}{dt.Name || 'نامشخص'} {isUsed ? '(استفاده شده)' : ''}
                  </option>
                )
              })}
            </select>
          </div>
          
          <div className="form-group">
            <label htmlFor="docFileInputRenew" style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>
              انتخاب فایل <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <input
              id="docFileInputRenew"
              type="file"
              accept="image/*,.pdf"
              onChange={handleDocUpload}
              style={{ 
                width: '100%', 
                padding: '10px', 
                border: '2px solid #cbd5e1', 
                borderRadius: '8px',
                fontSize: '14px',
                cursor: 'pointer'
              }}
            />
          </div>
          
          <button
            type="button"
            onClick={() => document.getElementById('docFileInputRenew')?.click()}
            className="btn-primary"
            style={{ padding: '12px 24px', marginBottom: '2px' }}
          >
            📤 آپلود
          </button>
        </div>
        
        <p style={{ marginTop: '12px', fontSize: '13px', color: '#64748b' }}>
          💡 فرمت‌های مجاز: تصاویر (JPG, PNG) و PDF | حداکثر حجم: 2 مگابایت
        </p>
        <p style={{ marginTop: '8px', fontSize: '13px', color: '#64748b' }}>
          <span style={{ color: '#ef4444' }}>*</span> مدارک ضروری باید حتماً بارگذاری شوند
        </p>
      </div>

      {/* Documents List */}
      {documents.length > 0 && (
        <div className="documents-list">
          <h4 style={{ marginBottom: '16px', fontSize: '18px', fontWeight: '700', color: '#1e293b' }}>
            مدارک آپلود شده ({documents.length})
          </h4>
          
          <div style={{ display: 'grid', gap: '12px' }}>
            {documents.map(doc => {
              const isImage = doc.fileData && (doc.fileData.startsWith('data:image/') || 
                         doc.fileName.toLowerCase().match(/\.(jpg|jpeg|png|gif|bmp|webp)$/))
              const isPdf = doc.fileName.toLowerCase().endsWith('.pdf')
              const isExisting = doc.isExisting // Flag for documents from database
              
              return (
              <div 
                key={doc.id} 
                className="doc-card"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '16px',
                  padding: '16px',
                  background: isExisting ? '#f0f9ff' : 'white',
                  border: isExisting ? '2px solid #3b82f6' : '1px solid #e2e8f0',
                  borderRadius: '10px',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                }}
              >
                {/* Thumbnail */}
                <div 
                  style={{ 
                    width: '64px', 
                    height: '64px', 
                    background: '#f1f5f9', 
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '32px',
                    flexShrink: 0,
                    overflow: 'hidden',
                    cursor: isImage ? 'pointer' : 'default',
                    border: '2px solid #e2e8f0',
                    transition: 'all 0.3s'
                  }}
                  onClick={() => isImage && setImagePopup(doc.fileData)}
                  onMouseOver={(e) => isImage && (e.currentTarget.style.borderColor = '#3b82f6')}
                  onMouseOut={(e) => isImage && (e.currentTarget.style.borderColor = '#e2e8f0')}
                >
                  {isImage ? (
                    <img 
                      src={doc.fileData} 
                      alt={doc.fileName}
                      style={{ 
                        width: '100%', 
                        height: '100%', 
                        objectFit: 'cover' 
                      }}
                    />
                  ) : isExisting ? '📋' : (isPdf ? '📄' : '📎')}
                </div>
                
                {/* Info */}
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: '700', fontSize: '15px', color: '#1e293b', marginBottom: '4px' }}>
                    {doc.docTypeName}
                    {isExisting && <span style={{ marginRight: '8px', fontSize: '12px', color: '#3b82f6', fontWeight: '600' }}>✓ ذخیره شده</span>}
                  </div>
                  {/* Only show file name and size for newly uploaded documents, not existing ones */}
                  {!isExisting && (
                    <>
                      <div style={{ fontSize: '13px', color: '#64748b', marginBottom: '4px' }}>
                        📎 {doc.fileName}
                      </div>
                      <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                        حجم: {formatFileSize(doc.fileSize)}
                      </div>
                    </>
                  )}
                </div>
                
                {/* Remove Button */}
                <button
                  type="button"
                  onClick={() => handleRemoveDoc(doc.id)}
                  className="btn-remove"
                  style={{ 
                    padding: '8px 16px',
                    background: '#ef4444',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontWeight: '600',
                    fontSize: '14px',
                    transition: 'all 0.3s'
                  }}
                  onMouseOver={(e) => e.target.style.background = '#dc2626'}
                  onMouseOut={(e) => e.target.style.background = '#ef4444'}
                >
                  🗑️ حذف
                </button>
              </div>
              )
            })}
          </div>
        </div>
      )}
      
      {documents.length === 0 && !loadingDocuments && (
        <div style={{ 
          textAlign: 'center', 
          padding: '40px', 
          background: '#f8fafc', 
          borderRadius: '12px',
          border: '1px dashed #cbd5e1'
        }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>📂</div>
          <p style={{ color: '#64748b', fontSize: '15px' }}>
            هنوز مدرکی آپلود نشده است
          </p>
        </div>
      )}
      
      {/* Image Popup Modal */}
      {imagePopup && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.85)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '20px',
            cursor: 'pointer'
          }}
          onClick={() => setImagePopup(null)}
        >
          <div 
            style={{
              position: 'relative',
              maxWidth: '90%',
              maxHeight: '90%',
              background: 'white',
              borderRadius: '12px',
              padding: '8px',
              boxShadow: '0 20px 60px rgba(0,0,0,0.5)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setImagePopup(null)}
              style={{
                position: 'absolute',
                top: '-12px',
                right: '-12px',
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                background: '#ef4444',
                color: 'white',
                border: 'none',
                fontSize: '20px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 'bold',
                boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                transition: 'all 0.3s'
              }}
              onMouseOver={(e) => e.target.style.background = '#dc2626'}
              onMouseOut={(e) => e.target.style.background = '#ef4444'}
            >
              ✕
            </button>
            <img 
              src={imagePopup} 
              alt="Preview"
              style={{
                maxWidth: '100%',
                maxHeight: '80vh',
                display: 'block',
                borderRadius: '8px'
              }}
            />
          </div>
        </div>
      )}
    </div>
  )

  const renderStep3AttachDiscounts = () => (
    <div className="step-content">
      <h3 className="step-title">پیوست تخفیفات</h3>
      
      {/* Discount Documents Section */}
      <div className="box">
        <div className="box-title">مدارک تخفیفات</div>
        <div className="form-section-content">
          <div className="form-grid">
            <label>نوع مدرک تخفیف</label>
            <select value={discDocSelType} onChange={e => setDiscDocSelType(e.target.value)}>
              <option value="">انتخاب کنید...</option>
              {lkDiscountDocs.map(dt => (
                <option key={dt.Id ?? dt.ID} value={dt.Id ?? dt.ID}>
                  {dt.Name || dt.name}
                </option>
              ))}
            </select>

            <label>توضیحات</label>
            <input value={discDescription} onChange={e => setDiscDescription(e.target.value)} placeholder="توضیحات تکمیلی" />

            <label>فایل مدرک</label>
            <input 
              type="file" 
              accept="image/*,.pdf" 
              onChange={e => {
                const file = e.target.files?.[0]
                if (!file) return
                const reader = new FileReader()
                reader.onload = ev => {
                  setDiscountDocs(prev => [...prev, {
                    LookupDocTypeId: discDocSelType,
                    fileName: file.name,
                    fileSize: file.size,
                    fileData: ev.target.result,
                    Description: discDescription,
                    docTypeName: (lkDiscountDocs.find(dt => (dt.Id ?? dt.ID) === discDocSelType)?.Name || dt?.name || '')
                  }])
                }
                reader.readAsDataURL(file)
              }} 
            />

            {discountDocs.length > 0 && (
              <div style={{ gridColumn: 'span 4' }}>
                <h4 style={{ margin: '0 0 8px 0' }}>مدارک تخفیف بارگذاری شده:</h4>
                {discountDocs.map((doc, idx) => (
                  <div key={idx} style={{ marginBottom: '8px', padding: '8px', border: '1px solid #e5e7eb', borderRadius: '4px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <span>{doc.docTypeName || 'مدرک تخفیف'}</span>
                        {doc.Description && <span style={{ marginLeft: '8px', color: '#6b7280' }}>({doc.Description})</span>}
                      </div>
                      <button 
                        type="button" 
                        className="btn-danger" 
                        onClick={() => setDiscountDocs(prev => prev.filter((_, i) => i !== idx))}
                        style={{ padding: '4px 8px', fontSize: '12px' }}
                      >
                        حذف
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )

  const renderStep4Complete = () => (
    <div className="step-content">
      <h3 className="step-title">تکمیل عملیات</h3>
      
      {/* Final Description */}
      <div className="box">
        <div className="box-title">توضیحات نهایی</div>
        <div className="form-section-content">
          <div className="form-grid">
            <label>توضیحات</label>
            <textarea 
              value={finalDesc} 
              onChange={e => setFinalDesc(e.target.value)} 
              rows={4}
              placeholder="توضیحات خود را وارد کنید..."
            />
          </div>
        </div>
      </div>

      {/* Submit Button */}
      <div style={{ marginTop: '20px', textAlign: 'center' }}>
        <button 
          onClick={handleFinalSubmit} 
          disabled={isSubmitting}
          className="btn-primary"
          style={{ padding: '12px 32px', fontSize: '16px' }}
        >
          {isSubmitting ? 'در حال ثبت...' : 'ثبت نهایی درخواست'}
        </button>
      </div>

      {/* Success Message */}
      {finalTrackingNo && (
        <div style={{ marginTop: '20px', padding: '16px', background: '#d1fae5', borderRadius: '8px', textAlign: 'center' }}>
          <p style={{ margin: 0, color: '#065f46', fontWeight: 600 }}>{doneMessage}</p>
          <p style={{ margin: '8px 0 0 0', color: '#065f46' }}>شماره پیگیری: {finalTrackingNo}</p>
          <p style={{ margin: '8px 0 0 0', color: '#065f46' }}>
            {redirectTimer > 0 ? `انتقال خودکار به صفحه پرداخت در ${redirectTimer} ثانیه...` : 'در حال انتقال...'}
          </p>
        </div>
      )}
    </div>
  )

  // Helper function to format file size
  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
  }

  // Helper function to get document type name
  const getDocTypeName = (docTypeId) => {
    const dt = docTypes.find(dt => (dt.Id || dt.ID) === docTypeId)
    return dt?.Name || dt?.name || 'مدرک'
  }

  // Load existing documents
  const loadExistingDocuments = async () => {
    if (!nationalCode || nationalCode.length !== 10) return
    
    setLoadingDocuments(true)
    try {
      const response = await api.get(`/api/persons/by-national-code/${encodeURIComponent(nationalCode)}`)
      const existingDocs = response.data.documents || []
      
      // Filter to only show documents that match the employment document types in combobox
      const validDocTypeIds = docTypes.map(dt => dt.Id)
      const filteredDocs = existingDocs.filter(doc => 
        validDocTypeIds.includes(doc.LookupDocTypeId)
      )
      
      // Transform to match our document state structure
      const transformedDocs = filteredDocs.map(doc => {
        const docType = docTypes.find(dt => dt.Id === doc.LookupDocTypeId)
        // Generate thumbnail URL for existing documents
        const thumbnailUrl = `/api/issue/personal/${encodeURIComponent(nationalCode)}/documents/${doc.DocID || doc.DocumentID}/content`
        return {
          id: doc.DocID || doc.DocumentID,
          docTypeId: doc.LookupDocTypeId,
          docTypeName: docType?.Name || doc.DocTypeName || 'مدرک',
          fileName: `document_${doc.DocID || doc.DocumentID}`,
          fileSize: doc.SizeBytes || 0,
          fileData: thumbnailUrl, // Use API endpoint URL for thumbnail
          uploadDate: doc.CreatedAt || doc.CreatedDate,
          isExisting: true // Flag to indicate this is from database
        }
      })
      
      setDocuments(transformedDocs)
      console.log('✅ Loaded existing documents:', transformedDocs)
    } catch (error) {
      console.error('Error loading existing documents:', error)
      // Don't show error to user, just continue with empty documents
    } finally {
      setLoadingDocuments(false)
    }
  }

  return (
    <div className="issue-employment-license-container">
      <h1>تمدید پروانه اشتغال به کار</h1>
      
      {/* Wizard Steps */}
      <div className="wizard-steps">
        <div className={`wizard-step ${current === 0 ? 'active' : ''} ${current > 0 ? 'completed' : ''}`}>
          <span className="step-number">1</span>
          <span className="step-label">ثبت مشخصات</span>
        </div>
        <div className={`wizard-step ${current === 1 ? 'active' : ''} ${current > 1 ? 'completed' : ''}`}>
          <span className="step-number">2</span>
          <span className="step-label">بارگذاری مستندات</span>
        </div>
        <div className={`wizard-step ${current === 2 ? 'active' : ''} ${current > 2 ? 'completed' : ''}`}>
          <span className="step-number">3</span>
          <span className="step-label">پیوست تخفیفات</span>
        </div>
        <div className={`wizard-step ${current === 3 ? 'active' : ''}`}>
          <span className="step-number">4</span>
          <span className="step-label">تکمیل عملیات</span>
        </div>
      </div>

      {/* Step Content */}
      {renderStepContent()}

      {/* Navigation Buttons */}
      <div className="wizard-navigation">
        {current > 0 && (
          <button onClick={prev} className="btn-prev" disabled={isNextLoading}>قبلی</button>
        )}
        {current < 3 && (
          <button onClick={next} className="btn-next" disabled={isNextLoading}>
            {isNextLoading ? '⏳ در حال پردازش...' : 'بعدی'}
          </button>
        )}
      </div>

      <style>{`
        .issue-employment-license-container {
          max-width: 1400px;
          margin: 0 auto;
          padding: 20px;
          direction: rtl;
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        }

        .issue-employment-license-container h1 {
          text-align: center;
          color: #1e293b;
          margin-bottom: 30px;
          font-size: 28px;
        }

        .wizard-steps {
          display: flex;
          justify-content: space-between;
          margin: 40px auto;
          padding: 0 50px;
          max-width: 900px;
        }

        .wizard-step {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 10px;
          flex: 1;
          position: relative;
        }

        .wizard-step::after {
          content: '';
          position: absolute;
          top: 22px;
          right: -50%;
          width: 100%;
          height: 3px;
          background: #e2e8f0;
          z-index: -1;
        }

        .wizard-step:last-child::after {
          display: none;
        }

        .wizard-step.completed::after {
          background: #10b981;
        }

        .step-number {
          width: 45px;
          height: 45px;
          border-radius: 50%;
          background: #e2e8f0;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: bold;
          font-size: 18px;
          color: #64748b;
          transition: all 0.3s ease;
        }

        .wizard-step.active .step-number {
          background: #3b82f6;
          color: white;
          box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
        }

        .wizard-step.completed .step-number {
          background: #10b981;
          color: white;
        }

        .step-label {
          font-size: 14px;
          color: #64748b;
          font-weight: 500;
        }

        .wizard-step.active .step-label {
          color: #3b82f6;
          font-weight: 700;
        }

        .wizard-step.completed .step-label {
          color: #10b981;
        }

        .step-content {
          background: white;
          padding: 40px;
          border-radius: 12px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.08);
          min-height: 500px;
          border: 1px solid #e2e8f0;
        }

        .step-title {
          font-size: 26px;
          margin-bottom: 30px;
          color: #1e293b;
          font-weight: 700;
          border-bottom: 3px solid #3b82f6;
          padding-bottom: 12px;
        }

        .national-code-check {
          margin-bottom: 30px;
          padding: 25px;
          background: #f8fafc;
          border-radius: 10px;
          border: 1px solid #e2e8f0;
        }

        .national-code-input {
          width: 33.33%;
          padding: 14px 16px;
          border: 2px solid #cbd5e1;
          border-radius: 8px;
          font-size: 16px;
          text-align: center;
          font-weight: 600;
          transition: all 0.3s ease;
        }

        .national-code-input:focus {
          outline: none;
          border-color: #3b82f6;
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
        }

        .consent-section {
          margin-top: 20px;
          padding: 15px;
          background: #fef3c7;
          border: 2px solid #fbbf24;
          border-radius: 8px;
        }

        .consent-label {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          cursor: pointer;
        }

        .consent-checkbox {
          width: 20px;
          height: 20px;
          margin-top: 3px;
          cursor: pointer;
          flex-shrink: 0;
        }

        .consent-text {
          flex: 1;
          line-height: 1.8;
          color: #92400e;
          font-size: 14px;
          font-weight: 500;
        }

        .btn-check {
          padding: 14px 28px;
          background: #3b82f6;
          color: white;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          white-space: nowrap;
          font-weight: 600;
          font-size: 15px;
          transition: all 0.3s ease;
        }

        .btn-check:hover:not(:disabled) {
          background: #2563eb;
          box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
        }

        .btn-check:disabled {
          background: #94a3b8;
          cursor: not-allowed;
          opacity: 0.6;
        }

        .info-message {
          margin-top: 15px;
          padding: 12px 16px;
          background: #d1fae5;
          color: #065f46;
          border-radius: 8px;
          font-weight: 600;
          border: 1px solid #10b981;
        }

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

        .form-section-content {
          padding: 20px;
        }

        .form-grid {
          display: grid;
          grid-template-columns: repeat(12, minmax(0, 1fr));
          column-gap: 16px;
          row-gap: 10px;
          align-items: center;
        }

        .form-grid label {
          grid-column: span 1;
          justify-self: end;
          white-space: nowrap;
          font-weight: 600;
          color: #475569;
          font-size: 14px;
        }

        .form-grid label + input,
        .form-grid label + select {
          grid-column: span 3;
        }

        .form-grid input,
        .form-grid select {
          width: 100%;
          padding: 10px 12px;
          border: 2px solid #cbd5e1;
          border-radius: 8px;
          font-size: 15px;
          transition: all 0.3s ease;
        }

        .form-grid input:focus,
        .form-grid select:focus {
          outline: none;
          border-color: #3b82f6;
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
        }

        .jdate-input {
          width: 100% !important;
          padding: 10px 12px !important;
          border: 2px solid #cbd5e1 !important;
          border-radius: 8px !important;
          font-size: 15px !important;
          transition: all 0.3s ease !important;
          box-sizing: border-box !important;
        }

        .jdate-input:focus {
          outline: none !important;
          border-color: #3b82f6 !important;
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1) !important;
        }

        .form-field label {
          display: block;
          margin-bottom: 8px;
          font-weight: 600;
          color: #475569;
          font-size: 14px;
        }

        .form-field input,
        .form-field select {
          width: 100%;
          padding: 12px 14px;
          border: 2px solid #cbd5e1;
          border-radius: 8px;
          font-size: 15px;
          transition: all 0.3s ease;
        }

        .form-field input:focus,
        .form-field select:focus {
          outline: none;
          border-color: #3b82f6;
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
        }

        /* Plate Styles */
        .plate-wrapper { margin-top: 8px; display:flex; align-items:center; }
        .plate { display:flex; align-items:stretch; background:#f5f6f7; border:2px solid #c8c9cc; border-radius:10px; overflow:hidden; box-shadow: inset 0 0 0 1px #fff; }
        .plate-left { width:52px; background:#003399; color:#fff; display:grid; place-items:center; padding:6px; font-weight:700; }
        .plate-center { display:flex; align-items:center; gap:8px; padding:8px 12px; font-weight:500; font-size:14px; color:#000; justify-content:flex-end; }
        .plate-right { width:72px; background:#fff; border-inline-start:2px solid #c8c9cc; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:6px; padding:8px 10px; }
        .plate .flag { text-align:center; line-height:1.1; font-size:12px; }
        .plate .iran { font-weight:800; font-size:16px; writing-mode: horizontal-tb; }
        .plate .region { width:43px; text-align:center; border:1px solid #ccc; border-radius:6px; padding:5px 6px; font-weight:800; font-size:22px; }
        .plate-part { border:none; border-bottom:2px dashed #bbb; background:transparent; text-align:center; font-weight:800; font-size:29px; min-width:58px; }
        .plate-part:focus, .region:focus { outline:none; box-shadow:0 0 0 2px #1976d244; }
        .plate-part.serial2 { width:58px; }
        .plate-part.three { width:77px; }
        .plate-part.letter { 
          width:67px; 
          border:1px solid #ccc; 
          border-radius:6px; 
          background:#fff; 
          font-size:20px; 
          font-weight:800;
          appearance: none;
          -webkit-appearance: none;
          -moz-appearance: none;
          padding: 4px;
          color: #000;
          direction: rtl;
          border-bottom: 1px solid #ccc;
        }
        .plate-part.letter option {
          text-align: center;
          font-size: 18px;
          color: #000;
        }

        .btn-add {
          padding: 10px 20px;
          background: #10b981;
          color: white;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          margin-bottom: 15px;
          font-weight: 600;
          font-size: 14px;
          transition: all 0.3s ease;
        }

        .btn-primary {
          background: #10b981;
          border: 1px solid #34d399;
          color: #fff;
          padding: 8px 16px;
          border-radius: 8px;
          cursor: pointer;
          font-weight: 600;
          font-size: 14px;
          transition: all 0.3s ease;
        }

        .btn-primary:hover {
          background: #059669;
        }

        .btn-secondary {
          background: #64748b;
          border: 1px solid #94a3b8;
          color: #fff;
          padding: 6px 12px;
          border-radius: 8px;
          cursor: pointer;
          font-weight: 600;
          font-size: 13px;
          transition: all 0.3s ease;
        }

        .btn-secondary:hover {
          background: #475569;
        }

        .btn-add:hover {
          background: #059669;
          box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
        }

        .btn-cancel {
          background: #e5e7eb;
          border: 1px solid #d1d5db;
          color: #111827;
          padding: 8px 16px;
          border-radius: 8px;
          cursor: pointer;
          font-weight: 600;
          font-size: 14px;
          transition: all 0.3s ease;
        }

        .btn-cancel:hover {
          background: #d1d5db;
        }

        .btn-remove {
          padding: 6px 14px;
          background: #ef4444;
          color: white;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-weight: 600;
          font-size: 13px;
          transition: all 0.3s ease;
        }

        .btn-remove:hover {
          background: #dc2626;
        }

        .wizard-navigation {
          display: flex;
          justify-content: space-between;
          margin-top: 40px;
          padding-top: 30px;
          border-top: 2px solid #e2e8f0;
        }

        .btn-prev,
        .btn-next {
          padding: 14px 40px;
          border: none;
          border-radius: 10px;
          font-size: 16px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.3s ease;
        }

        .btn-prev {
          background: #e2e8f0;
          color: #475569;
        }

        .btn-prev:hover {
          background: #cbd5e1;
        }

        .btn-next {
          background: #3b82f6;
          color: white;
        }
        
        .btn-next:disabled,
        .btn-prev:disabled {
          background: #cbd5e1;
          color: #94a3b8;
          cursor: not-allowed;
          opacity: 0.6;
        }

        .btn-next:hover {
          background: #2563eb;
          box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
        }

        .btn-submit {
          padding: 14px 40px;
          background: #10b981;
          color: white;
          border: none;
          border-radius: 10px;
          font-size: 16px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.3s ease;
        }

        .btn-submit:hover {
          background: #059669;
          box-shadow: 0 4px 12px rgba(16, 185, 129, 0.4);
        }

        .jdate-input {
          width: 100%;
          padding: 12px 14px;
          border: 2px solid #cbd5e1;
          border-radius: 8px;
          font-size: 15px;
          text-align: center;
        }

        .residence-item,
        .contact-item {
          padding: 15px;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          margin-bottom: 12px;
        }

        .done-container {
          max-width: 600px;
          margin: 100px auto;
          padding: 40px;
          text-align: center;
          background: white;
          border-radius: 12px;
          box-shadow: 0 4px 16px rgba(0,0,0,0.1);
        }

        .done-container h2 {
          color: #10b981;
          margin-bottom: 30px;
          font-size: 28px;
        }

        .done-container button {
          padding: 14px 32px;
          background: #3b82f6;
          color: white;
          border: none;
          border-radius: 8px;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s ease;
        }

        .done-container button:hover {
          background: #2563eb;
          box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
        }

        .error-text {
          color: #dc2626;
          background: #fee2e2;
          padding: 8px 12px;
          border-radius: 6px;
          font-size: 14px;
          font-weight: 600;
          border: 1px solid #fca5a5;
          margin-top: 4px;
        }

        .btn-danger {
          padding: 6px 14px;
          background: #ef4444;
          color: white;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-weight: 600;
          font-size: 13px;
          transition: all 0.3s ease;
        }

        .btn-danger:hover {
          background: #dc2626;
        }
      `}</style>
    </div>
  )
}

// Step navigation data
const steps = [
  { key: 'register', title: 'ثبت مشخصات' },
  { key: 'documents', title: 'بارگذاری مستندات' },
  { key: 'discounts', title: 'پیوست تخفیفات' },
  { key: 'complete', title: 'تکمیل عملیات' }
]
