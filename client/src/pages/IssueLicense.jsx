import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../lib/api.js'
import ManualDateInput from '../components/ManualDateInput'

export default function IssueLicense({ user, editRequestId: editRequestIdProp }) {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  // Use prop if provided, otherwise read from URL params
  const editRequestId = editRequestIdProp || searchParams.get('edit')
  const [current, setCurrent] = useState(0)
  const [doneMessage, setDoneMessage] = useState('')
  const [isEditMode, setIsEditMode] = useState(false)
  const [loadingEditData, setLoadingEditData] = useState(false)
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
  const [vehTriedNext, setVehTriedNext] = useState(false)
  const [persTriedNext, setPersTriedNext] = useState(false)

  // Start step
  const [start, setStart] = useState({
    nationality: 'ایران',
    nationalCode: (user?.Role === 'کارگزار (بهره بردار)' || user?.role === 'کارگزار (بهره بردار)') ? '' : (user?.nationalCode || ''),
    vin: '',
    consent: true
  })
  
  // Ownership type
  const [ownershipType, setOwnershipType] = useState('حقیقی')
  
  // Company information for legal entities
  const [companyInfo, setCompanyInfo] = useState({
    tonnageRateId: '', companyName: '', nationalId: '', workshopName: '', businessLicenseNo: '',
    economicCode: '', mainActivity: '', activityFieldId: '', companyTypeId: '',
    registrationDate: '', businessLicenseValidFrom: '', businessLicenseValidTo: '',
    parentCompanyId: '', registrationCityId: '', addresses: [], contacts: []
  })
  
  // Company representative info
  const [companyRepresentative, setCompanyRepresentative] = useState({
    nationalCode: '',
    birthDate: '',
    powerOfAttorneyNo: ''
  })
  
  // Payment information for edit mode
  const [paymentInfo, setPaymentInfo] = useState({
    amount: '',
    paymentDate: '',
    referenceNumber: '',
    trackingCode: ''
  })
  
  // Temporary fields for adding company addresses and contacts
  const [tmpCompanyAddress, setTmpCompanyAddress] = useState({
    provinceId: '', cityId: '', mainStreet: '', sideStreet: '',
    district: '', postalCode: '', plaque: '', unit: '', address: ''
  })
  
  const [tmpCompanyContact, setTmpCompanyContact] = useState({
    type: '', value: '', isActive: false
  })
  
  const [companyAddressCities, setCompanyAddressCities] = useState([])
  const [startTriedNext, setStartTriedNext] = useState(false)
  const [startErrors, setStartErrors] = useState({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isNextLoading, setIsNextLoading] = useState(false)

  // Lookups and system types
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
  const [defaultProvinceId, setDefaultProvinceId] = useState(null)
  const [defaultCityId, setDefaultCityId] = useState(null)
  
  const getProvinceName = (provId) => {
    const p = provinces.find(pp => String(pp.Id ?? pp.ID ?? pp.ProvinceId ?? pp.provinceId) == String(provId))
    return p?.Name || p?.name || p?.ProvinceName || p?.provincename || ''
  }

  const normalizeVehicleFromServer = (v) => {
    if (!v) return v
    return {
      ...v,
      vehicleKindId: v.vehicleKindId?.toString() || '',
      systemId: v.systemId?.toString() || '',
      systemTipId: v.systemTipId?.toString() || '',
      yearManufacture: v.yearManufacture?.toString() || '',
      capacity: v.capacity?.toString() || '',
      fuelTypeId: v.fuelTypeId?.toString() || '',
      trackerTypeId: v.trackerTypeId?.toString() || '',
      cylinders: v.cylinders?.toString() || '',
      axles: v.axles?.toString() || '',
      wheels: v.wheels?.toString() || '',
      activityCategoryId: v.activityCategoryId?.toString() || '',
      plateTypeId: v.plateTypeId?.toString() || '',
      insuranceCompanyId: v.insuranceCompanyId?.toString() || '',
      insurancePolicyNo: v.insurancePolicyNo?.toString() || v.insurancePolicyNo || '',
      plate: {
        p1_serial2: v.plate?.p1_serial2?.toString() || '',
        p2_three: v.plate?.p2_three?.toString() || '',
        p3_letter: v.plate?.p3_letter || '',
        p4_two: v.plate?.p4_two?.toString() || ''
      }
    }
  }
  
  const getCityName = (provId, cityId) => {
    const list = citiesByProv[provId] || []
    const c = list.find(cc => String(cc.Id ?? cc.ID ?? cc.CityId ?? cc.cityId) == String(cityId))
    return c?.Name || c?.name || c?.CityName || c?.cityname || ''
  }
  
  const getDocTypeName = (docTypeId) => {
    const allDocTypes = [...lkPersonalDocs, ...lkCompanyDocs, ...lkVehicleDocs, ...lkDiscountDocs]
    const docType = allDocTypes.find(dt => String(dt.Id ?? dt.ID) === String(docTypeId))
    return docType?.Name || docType?.name || ''
  }
  
  const [personDocs, setPersonDocs] = useState([])
  const [docSelType, setDocSelType] = useState('')
  const [loadingPersonDocs, setLoadingPersonDocs] = useState(false)
  const [companyDocs, setCompanyDocs] = useState([])
  const [vehicleDocs, setVehicleDocs] = useState([])
  const [vehDocSelType, setVehDocSelType] = useState('')
  const [discountDocs, setDiscountDocs] = useState([])
  const [discDocSelType, setDiscDocSelType] = useState('')
  const [discDescription, setDiscDescription] = useState('')
  const [docsTriedNext, setDocsTriedNext] = useState(false)

  const [vehicleId, setVehicleId] = useState(null)
  const [finalDesc, setFinalDesc] = useState('')
  const [finalTrackingNo, setFinalTrackingNo] = useState('')
  const [licenseTypeId, setLicenseTypeId] = useState('')
  const [operationTypeId, setOperationTypeId] = useState('')
  const [secondsLeft, setSecondsLeft] = useState(5)
  const [editModeTrackingNo, setEditModeTrackingNo] = useState('')
  
  const [tmpResidence, setTmpResidence] = useState({
    provinceId: '',
    cityId: '',
    address: '',
    postalCode: '',
    plaque: '',
    unit: '',
    phone: ''
  })
  
  const [paymentDocs, setPaymentDocs] = useState([])
  const [paymentDocSelType, setPaymentDocSelType] = useState('')
  const [requestId, setRequestId] = useState(null)

  // Load request data when in edit mode
  useEffect(() => {
    if (editRequestId) {
      console.log('✏️ Edit mode detected, loading request:', editRequestId)
      setIsEditMode(true)
      setLoadingEditData(true)
      loadRequestForEdit(editRequestId)
    }
  }, [editRequestId])

  // Load existing request data for editing
  const loadRequestForEdit = async (reqId) => {
    try {
      console.log('✏️ Edit mode - Loading request for edit:', reqId)
      const { data } = await api.get(`/api/workflow/requests/${reqId}`)
      console.log('📦 Full API Response:', data)
      console.log('📋 Request info:', data.request)
      console.log('👤 Person:', data.person)
      console.log('📄 Person documents:', data.personDocuments)
      console.log('🚗 Vehicle:', data.vehicle)
      console.log('📄 Vehicle documents:', data.vehicleDocuments)
      console.log('🏢 Company:', data.company)
      console.log('📄 Company documents:', data.companyDocuments)
      
      setRequestId(reqId)
      setEditModeTrackingNo(data.request?.trackingNo || data.TrackingNo || '')

      // Ownership is stored on the request as legal license type 137,
      // a license name containing حقوقی, or a company national id.
      const licenseTypeIdValue = data.request?.licenseTypeId ?? data.LicenseTypeId
      const licenseTypeName = data.request?.licenseTypeName || data.LicenseTypeName || ''
      const companyNationalId = String(data.request?.companyNationalId || data.company?.NationalId || '').trim()
      const isLegalOwnership = Number(licenseTypeIdValue) === 137
        || String(licenseTypeName).includes('حقوقی')
        || !!companyNationalId
      setOwnershipType(isLegalOwnership ? 'حقوقی' : 'حقیقی')
      if (isLegalOwnership && companyNationalId) {
        setStart(s => ({ ...s, nationalCode: companyNationalId }))
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
        if (!isLegalOwnership) {
          setStart(s => ({ ...s, nationalCode: data.person.NationalCode || '' }))
        }
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
          activityFieldName: data.company.ActivityFieldName || '',
          companyTypeId: data.company.CompanyTypeId?.toString() || '',
          registrationDate: data.company.RegistrationDate || '',
          businessLicenseValidFrom: data.company.BusinessLicenseValidFrom || '',
          businessLicenseValidTo: data.company.BusinessLicenseValidTo || '',
          parentCompanyId: data.company.ParentCompanyId?.toString() || '',
          registrationCityId: data.company.RegistrationCityId?.toString() || '',
          addresses: data.companyAddresses?.map(addr => ({
            provinceId: addr.ProvinceId,
            cityId: addr.CityId,
            mainStreet: addr.MainStreet,
            sideStreet: addr.SideStreet,
            district: addr.District,
            postalCode: addr.PostalCode,
            plaque: addr.Plaque,
            unit: addr.Unit,
            address: addr.Address
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
      
      // Load vehicle info
      if (data.vehicle) {
        const vehData = normalizeVehicleFromServer({
          vehicleKindId: data.vehicle.VehicleKindId,
          systemId: data.vehicle.SystemId,
          systemTipId: data.vehicle.SystemTipId,
          yearManufacture: data.vehicle.YearManufacture,
          capacity: data.vehicle.Capacity,
          fuelTypeId: data.vehicle.FuelTypeId,
          trackerTypeId: data.vehicle.TrackerTypeId,
          cylinders: data.vehicle.Cylinders,
          axles: data.vehicle.Axles,
          wheels: data.vehicle.Wheels,
          vin: data.vehicle.VIN,
          chassisNo: data.vehicle.ChassisNo,
          engineNo: data.vehicle.EngineNo,
          bodyColor: data.vehicle.BodyColor,
          activityCategoryId: data.vehicle.ActivityCategoryId,
          activityCategoryName: data.vehicle.ActivityCategoryName || '',
          isContainer: data.vehicle.IsContainer,
          plateTypeId: data.vehicle.PlateTypeId,
          plate: {
            p1_serial2: data.vehicle.PlateSerial2 || '',
            p2_three: data.vehicle.PlateThreeDigits || '',
            p3_letter: data.vehicle.PlateLetter || '',
            p4_two: data.vehicle.PlateRegion2 || ''
          },
          inspectionDate: data.vehicle.InspectionDate || '',
          greenCardDate: data.vehicle.GreenCardDate || '',
          freePlate: data.vehicle.FreePlate || false,
          insuranceCompanyId: data.vehicle.InsuranceCompanyId,
          insurancePolicyNo: data.vehicle.InsurancePolicyNo,
          insuranceIssueDate: data.vehicle.InsuranceIssueDate,
          insuranceValidDate: data.vehicle.InsuranceValidDate,
          techInspectSerial: data.vehicle.TechInspectSerial,
          techInspectIssueDate: data.vehicle.TechInspectIssueDate,
          techInspectValidDate: data.vehicle.TechInspectValidDate
        })
        setVehicle(vehData)
        setStart(s => ({ ...s, vin: data.vehicle.VIN || '' }))
        setVehicleId(data.vehicle.VehicleID)
        
        // Load systems and tips for the vehicle
        if (data.vehicle.VehicleKindId) {
          await loadSystemsByVehicleType(data.vehicle.VehicleKindId)
        }
        if (data.vehicle.SystemId) {
          await loadTips(data.vehicle.SystemId)
        }
      }
      
      // Load person documents
      if (data.personDocuments && data.personDocuments.length > 0) {
        console.log('📝 Loading', data.personDocuments.length, 'personal documents')
        const docs = data.personDocuments.map(doc => ({
          DocID: doc.DocID,
          DocName: doc.DocName || 'مدرک شخصی',
          DocTypeName: doc.DocTypeName || '',
          LookupDocTypeId: doc.LookupDocTypeId,
          isExisting: true
        }))
        setPersonDocs(docs)
        console.log('✅ Person documents set to state:', docs)
      }
      
      // Load company documents
      if (data.companyDocuments && data.companyDocuments.length > 0) {
        console.log('📝 Loading', data.companyDocuments.length, 'company documents')
        const docs = data.companyDocuments.map(doc => ({
          DocID: doc.DocID,
          DocName: doc.DocName || 'مدرک شرکت',
          DocTypeName: doc.DocTypeName || '',
          LookupDocTypeId: doc.LookupDocTypeId,
          isExisting: true
        }))
        setCompanyDocs(docs)
        console.log('✅ Company documents set to state:', docs)
      }
      
      // Load vehicle documents
      if (data.vehicleDocuments && data.vehicleDocuments.length > 0) {
        console.log('📝 Loading', data.vehicleDocuments.length, 'vehicle documents')
        const docs = data.vehicleDocuments.map(doc => ({
          DocID: doc.DocID,
          DocName: doc.DocName || 'مدرک خودرو',
          DocTypeName: doc.DocTypeName || '',
          LookupDocTypeId: doc.LookupDocTypeId,
          isExisting: true
        }))
        setVehicleDocs(docs)
        console.log('✅ Vehicle documents set to state:', docs)
      }
      
      // Load discount documents
      if (data.discountDocuments && data.discountDocuments.length > 0) {
        console.log('📝 Loading', data.discountDocuments.length, 'discount documents')
        const docs = data.discountDocuments.map(doc => ({
          DocID: doc.DocID,
          DocName: doc.DocName || 'مدرک تخفیف',
          DocTypeName: doc.DocTypeName || '',
          LookupDocTypeId: doc.LookupDocTypeId,
          Description: doc.Description || '',
          isExisting: true
        }))
        setDiscountDocs(docs)
        console.log('✅ Discount documents set to state:', docs)
      }
      
      // Set license type and operation type from the request row
      const requestLicenseTypeId = data.request?.licenseTypeId ?? data.LicenseTypeId
      const requestOperationTypeId = data.request?.operationTypeId ?? data.OperationTypeId
      if (requestLicenseTypeId) {
        setLicenseTypeId(String(requestLicenseTypeId))
      }
      if (requestOperationTypeId) {
        setOperationTypeId(String(requestOperationTypeId))
      }
      
      // Set final description
      if (data.FinalDescription) {
        setFinalDesc(data.FinalDescription)
      }
      
      console.log('✅ Request data loaded successfully')
      setLoadingEditData(false)
    } catch (error) {
      console.error('❌ Error loading request for edit:', error)
      alert('خطا در بارگذاری اطلاعات پرونده')
      setLoadingEditData(false)
    }
  }

  // Set default birth province and city when provinces are loaded (only for new requests, not edit mode)
  useEffect(() => {
    if (provinces.length > 0 && !isEditMode && !loadingEditData && !personal.birthProvinceId) {
      const eastAzerbaijan = provinces.find(p => (p.Name || p.name)?.includes('آذربایجان شرقی'))
      if (eastAzerbaijan) {
        const provinceId = String(eastAzerbaijan.Id || eastAzerbaijan.ID)
        setPersonal(prev => ({ ...prev, birthProvinceId: provinceId }))
        
        // Load cities for East Azerbaijan and set Tabriz as default
        api.get(`/api/provinces/${provinceId}/cities`).then(({ data }) => {
          setCitiesByProv(prev => ({ ...prev, [provinceId]: data || [] }))
          const tabriz = (data || []).find(c => (c.Name || c.name)?.includes('تبریز'))
          if (tabriz) {
            setPersonal(prev => ({ ...prev, birthCityId: String(tabriz.Id || tabriz.ID) }))
          }
        }).catch(() => {})
      }
    }
  }, [provinces, isEditMode, loadingEditData, personal.birthProvinceId])

  // Set default residence province and city when provinces are loaded (only for new requests, not edit mode)
  useEffect(() => {
    if (provinces.length > 0 && !isEditMode && !loadingEditData && !personal.tmpProvinceId) {
      const eastAzerbaijan = provinces.find(p => (p.Name || p.name)?.includes('آذربایجان شرقی'))
      if (eastAzerbaijan) {
        const provinceId = String(eastAzerbaijan.Id || eastAzerbaijan.ID)
        setPersonal(prev => ({ ...prev, tmpProvinceId: provinceId }))
        
        // Load cities for East Azerbaijan and set Tabriz as default
        api.get(`/api/provinces/${provinceId}/cities`).then(({ data }) => {
          setCitiesByProv(prev => ({ ...prev, [provinceId]: data || [] }))
          const tabriz = (data || []).find(c => (c.Name || c.name)?.includes('تبریز'))
          if (tabriz) {
            setPersonal(prev => ({ ...prev, tmpCityId: String(tabriz.Id || tabriz.ID) }))
          }
        }).catch(() => {})
      }
    }
  }, [provinces, isEditMode, loadingEditData, personal.tmpProvinceId])

  // Set default fuel type to Gasoline when fuel types are loaded (only for new requests, not edit mode)
  useEffect(() => {
    if (lkFuelTypes.length > 0 && !isEditMode && !loadingEditData && !vehicle.fuelTypeId) {
      const gasoline = lkFuelTypes.find(f => (f.Name || f.name)?.includes('بنزین'))
      if (gasoline) {
        setVehicle(prev => ({ ...prev, fuelTypeId: String(gasoline.Id || gasoline.ID) }))
      }
    }
  }, [lkFuelTypes, isEditMode, loadingEditData, vehicle.fuelTypeId])

  // Countdown timer and automatic redirect to payment page after successful submission
  useEffect(() => {
    if (finalTrackingNo && secondsLeft > 0) {
      const timer = setTimeout(() => {
        setSecondsLeft(prev => prev - 1)
      }, 1000)
      return () => clearTimeout(timer)
    } else if (finalTrackingNo && secondsLeft === 0) {
      // Redirect to payment page
      navigate(`/payment?trackingNo=${finalTrackingNo}`)
    }
  }, [finalTrackingNo, secondsLeft, navigate])

  // Load provinces, cities, and lookups on component mount
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
        
        // Load all cities for all provinces
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
      
      // Set hardcoded contact types
      setLkContactTypes([
        { Id: 1, Name: 'موبایل' },
        { Id: 2, Name: 'تلفن ثابت' },
        { Id: 3, Name: 'ایمیل' },
        { Id: 4, Name: 'فکس' }
      ])
      
      // Auto-select license type based on ownership type (only for a new request)
      if (!editRequestId && !licenseTypeId) {
        const targetLicenseType = ownershipType === 'حقوقی' 
          ? lt.find(x => String(x.Id || x.ID) === '137') // Legal entity activity license
          : lt.find(x => x.Name === 'فعالیت') // Individual activity license
        
        if (targetLicenseType) {
          setLicenseTypeId(String(targetLicenseType.Id || targetLicenseType.ID))
        }
      }
      
      // Auto-select "صدور" (Issuance) as default operation type for a new request
      const issuanceType = ot.find(x => x.Name === 'صدور')
      if (!editRequestId && issuanceType && !operationTypeId) {
        setOperationTypeId(String(issuanceType.Id || issuanceType.ID))
      }
    })()

    loadProvinces()
    loadVehicleTypes()
  }, [])

  // Update license type when ownership type changes
  useEffect(() => {
    if (lkLicenseTypes.length > 0 && !isEditMode) {
      const targetLicenseType = ownershipType === 'حقوقی' 
        ? lkLicenseTypes.find(x => String(x.Id || x.ID) === '137') // Legal entity activity license
        : lkLicenseTypes.find(x => x.Name === 'فعالیت') // Individual activity license
      
      if (targetLicenseType) {
        setLicenseTypeId(String(targetLicenseType.Id || targetLicenseType.ID))
        console.log(`✅ License type updated for ${ownershipType}: ${targetLicenseType.Id || targetLicenseType.ID}`)
      }
    }
  }, [ownershipType, lkLicenseTypes, isEditMode])

  // Helper function to load cities for a province
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
    if (!vehicleTypeId) { 
      setSystems([])
      return 
    }
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
    if (!systemId) { 
      setSystemTips([])
      return 
    }
    try {
      const { data } = await api.get(`/api/vehicletypes/systems/${systemId}/tips`)
      setSystemTips(Array.isArray(data) ? data : (data?.tips || []))
    } catch (err) {
      console.error('Failed to load tips:', err)
      setSystemTips([])
    }
  }

  // Load personal or company documents when entering docs step
  useEffect(() => {
    (async () => {
      if (steps[current].key === 'docs') {
        if (ownershipType === 'حقوقی') {
          // Load company documents
          setCompanyDocs([])
          const nationalId = companyInfo.nationalId || start.nationalCode
          if (nationalId?.trim()) {
            try {
              const { data } = await api.get(`/api/issue/company/${encodeURIComponent(nationalId)}/documents`)
              
              // Filter to only show documents that match the company document types in combobox
              const validDocTypeIds = lkCompanyDocs.map(dt => String(dt.Id ?? dt.ID))
              const filteredDocs = (data || []).filter(doc => 
                validDocTypeIds.includes(String(doc.LookupDocTypeId))
              )
              
              // Mark existing documents with a flag
              const markedDocs = filteredDocs.map(doc => ({
                ...doc,
                isExisting: true
              }))
              
              setCompanyDocs(markedDocs)
              console.log('📋 useEffect loaded and filtered company documents:', markedDocs)
            } catch {}
          }
        } else {
          // Load personal documents
          setPersonDocs([])
          if (personal.nationalCode?.trim()) {
            try {
              const { data } = await api.get(`/api/issue/personal/${encodeURIComponent(personal.nationalCode)}/documents`)
              
              // Filter to only show documents that match the personal document types in combobox
              const validDocTypeIds = lkPersonalDocs.map(dt => String(dt.Id ?? dt.ID))
              const filteredDocs = (data || []).filter(doc => 
                validDocTypeIds.includes(String(doc.LookupDocTypeId))
              )
              
              // Mark existing documents with a flag
              const markedDocs = filteredDocs.map(doc => ({
                ...doc,
                isExisting: true
              }))
              
              setPersonDocs(markedDocs)
              console.log('📋 useEffect loaded and filtered personal documents:', markedDocs)
            } catch {}
          }
        }
      }
    })()
  }, [current, personal.nationalCode, companyInfo.nationalId, start.nationalCode, ownershipType, lkPersonalDocs, lkCompanyDocs])

  // Load vehicle documents when entering vehdocs or when vehicleId changes
  useEffect(() => {
    (async () => {
      if (steps[current].key === 'vehdocs' && vehicleId) {
        try {
          const { data } = await api.get(`/api/issue/vehicle/${encodeURIComponent(vehicleId)}/documents`)
          setVehicleDocs(data || [])
        } catch {}
      }
    })()
  }, [current, vehicleId])

  // Load discount documents when entering discounts or when vehicleId changes
  useEffect(() => {
    (async () => {
      if (steps[current].key === 'discounts' && vehicleId) {
        try {
          const { data } = await api.get(`/api/issue/vehicle/${encodeURIComponent(vehicleId)}/discount-documents`)
          setDiscountDocs(data || [])
        } catch {}
      }
    })()
  }, [current, vehicleId])

  const steps = [
    { key: 'start', title: 'مرحله اول' },
    { key: 'personal', title: 'ثبت مشخصات فردی' },
    { key: 'docs', title: 'ثبت مستندات فرد' },
    { key: 'vehicle', title: 'ثبت مشخصات خودرو' },
    { key: 'vehdocs', title: 'ثبت مستندات خودرو' },
    { key: 'discounts', title: 'پیوست تخفیفات' },
    { key: 'finish', title: 'تکمیل عملیات' }
  ]

  const canAdvanceFromStart = () => {
    const nat = String(start.nationality || '')
    const nc = String(start.nationalCode || '').trim()
    const vv = String(start.vin || '').trim()
    if (!start.consent) return false
    if (!nat) return false
    if (!nc) return false
    if (!vv) return false
    if (nat === 'ایران' && !/^\d{10}$/.test(nc)) return false
    return true
  }

  const validateStart = () => {
    const errs = {}
    const nc = String(start.nationalCode || '').trim()
    const vv = String(start.vin || '').trim()
    
    if (ownershipType === 'حقوقی') {
      if (!nc) errs.nationalCode = 'شناسه ملی شرکت را وارد کنید'
      else if (!/^\d{11}$/.test(nc)) errs.nationalCode = 'شناسه ملی شرکت باید 11 رقمی باشد'
    } else {
      if (!nc) errs.nationalCode = 'کد ملی را وارد کنید'
      else if (!/^\d{10}$/.test(nc)) errs.nationalCode = 'کد ملی باید 10 رقمی باشد'
    }
    
    if (!vv) errs.vin = 'VIN را وارد کنید'
    if (!start.consent) errs.consent = 'موارد فوق را بپذیرید'
    return errs
  }

  const personalRequired = ['firstName','lastName','nationalCode','fatherName','birthProvinceId','birthDate','gender','maritalStatus']
  const canAdvanceFromPersonal = () => {
    if (ownershipType === 'حقوقی') {
      const companyNameValid = String(companyInfo.companyName || '').trim().length > 0
      return companyNameValid
    }
    return personalRequired.every(k => String(personal[k] || '').trim().length > 0)
  }

  const vehicleRequired = [
    'vehicleKindId','systemId','systemTipId','yearManufacture','capacity','fuelTypeId','trackerTypeId',
    'cylinders','axles','wheels','vin','chassisNo','engineNo','bodyColor','activityCategoryId','plateTypeId',
    'inspectionDate','greenCardDate','isContainer',
    'insuranceCompanyId','insurancePolicyNo','insuranceIssueDate','insuranceValidDate',
    'techInspectSerial','techInspectIssueDate','techInspectValidDate',
    'plate.p1_serial2','plate.p2_three','plate.p3_letter','plate.p4_two'
  ]
  const canAdvanceFromVehicle = () => vehicleRequired.every(k => {
    if (k.startsWith('plate.')) {
      const kk = k.split('.')[1]
      return String(vehicle.plate?.[kk] || '').trim().length > 0
    }
    return String(vehicle[k] || '').trim().length > 0
  })

  // Save personal info
  const savePersonalToServer = async () => {
    // For حقوقی (legal entity), save company information instead
    if (ownershipType === 'حقوقی') {
      const payload = {
        ownershipType: 'حقوقی',
        companyInfo: {
          ...companyInfo,
          addresses: companyInfo.addresses || [],
          contacts: companyInfo.contacts || []
        },
        companyRepresentative: { ...companyRepresentative }
      }
      const { data } = await api.post('/api/issue/company', payload)
      return data // { inserted, changed, nationalId }
    }
    // For حقیقی (individual), save personal information
    const payload = { 
      ownershipType: 'حقیقی',
      ...personal, 
      residences: personal.residences||[], 
      contacts: personal.contacts||[] 
    }
    const { data } = await api.post('/api/issue/personal', payload)
    return data // { inserted, changed, nationalCode }
  }

  // Save vehicle info
  const saveVehicleToServer = async () => {
    // Determine registrar national code based on ownership type
    let registrarNationalCode = personal.nationalCode || user?.nationalCode || ''
    
    if (ownershipType === 'حقوقی') {
      // For legal entities, use company's NationalId as registrar
      registrarNationalCode = companyInfo.nationalId || start.nationalCode
    }
    
    const payload = {
      ...vehicle,
      registrarNationalCode: registrarNationalCode,
      registrarNationality: start.nationality || 'ایران'
    }
    
    const { data } = await api.post('/api/issue/vehicle', payload)
    return data // { inserted, changed, vehicleId }
  }


  const next = async () => {
    setDoneMessage('')
    setIsNextLoading(true)
    try {
    if (steps[current].key === 'start') {
      setStartTriedNext(true)
      const errs = validateStart()
      setStartErrors(errs)
      if (Object.keys(errs).length > 0) {
        setIsNextLoading(false)
        return
      }
      
      // Business rule: allow proceeding even if VIN is registered to another national code.
      // We only block if the current user has an open request or an existing license for this VIN.
      
      // Check if there's a pending request for this VIN (skip in edit mode)
      if (!isEditMode) {
        try {
          const { data } = await api.get(`/api/issue/check-pending/${encodeURIComponent(start.vin)}?licenseType=Activity`)
          if (data.hasPending) {
            alert(`برای این خودرو درخواست ${data.request.licenseType || 'پروانه فعالیت'} باز دارید!\n\nشماره پیگیری: ${data.request.trackingNo}\nنوع پروانه: ${data.request.licenseType || 'پروانه فعالیت'}\nوضعیت: ${data.request.status === 'Pending' ? 'در انتظار' : 'در حال بررسی'}\n\nلطفاً ابتدا درخواست قبلی را تکمیل کنید.`)
            setIsNextLoading(false)
            return
          }
          if (data.hasExistingLicense) {
            alert(`برای این خودرو قبلاً ${data.request.licenseType || 'پروانه فعالیت'} صادر شده است.\n\nشماره پیگیری: ${data.request.trackingNo}\nنوع پروانه: ${data.request.licenseType || 'پروانه فعالیت'}\nوضعیت: ${data.request.status}\n\nصدور مجدد مجاز نیست.`)
            setIsNextLoading(false)
            return
          }
        } catch (e) {
          console.error('Error checking pending request:', e)
          // Continue even if check fails
        }
      }
      
      // For legal entities (حقوقی), try to recover company information by logged-in user's national code
      // Skip this in edit mode - company data is already loaded from the request
      if (ownershipType === 'حقوقی' && !isEditMode) {
        try {
          // Use logged-in user's national code to find their company
          const userNationalCode = user?.nationalCode || start.nationalCode

          const companynationalCode=companyInfo?.nationalCode || start.nationalCode
         // const { data } = await api.get(`/api/issue/company/by-owner/${userNationalCode}`)
         const { data } = await api.get(`/api/issue/company/by-owner/${companynationalCode}`)
          if (data && data.company) {
            // Auto-load company information
            setCompanyInfo({
              tonnageRateId: data.company.TonnageRateId || '',
              companyName: data.company.CompanyName || '',
              nationalId: data.company.NationalId || '', // This is the company's national ID
              nationalCode: data.company.NationalCode || '',
              workshopName: data.company.WorkshopName || '',
              businessLicenseNo: data.company.BusinessLicenseNo || '',
              economicCode: data.company.EconomicCode || '',
              mainActivity: data.company.MainActivity || '',
              activityFieldId: data.company.ActivityFieldId || '',
              companyTypeId: data.company.CompanyTypeId || '',
              registrationDate: data.company.RegistrationDate || '',
              businessLicenseValidFrom: data.company.BusinessLicenseValidFrom || '',
              businessLicenseValidTo: data.company.BusinessLicenseValidTo || '',
              parentCompanyId: data.company.ParentCompanyId || '',
              addresses: (data.addresses || []).map(addr => ({
                provinceId: addr.ProvinceId,
                cityId: addr.CityId,
                mainStreet: addr.MainStreet || '',
                sideStreet: addr.SideStreet || '',
                district: addr.District || '',
                postalCode: addr.PostalCode || '',
                plaque: addr.Plaque || '',
                unit: addr.Unit || '',
                address: addr.Address || ''
              })),
              contacts: (data.contacts || []).map(contact => ({
                type: contact.Type,
                value: contact.Value,
                isActive: contact.IsActive
              }))
            })
            
            // Load representative information if exists
            if (data.representative) {
              setCompanyRepresentative({
                nationalCode: data.representative.RepresentativeNationalCode || '',
                birthDate: data.representative.BirthDate || '',
                powerOfAttorneyNo: data.representative.PowerOfAttorneyNo || ''
              })
            }
            
            // Load manager (CEO) information if exists
            if (data.manager) {
              // Load cities for birth province if available
              if (data.manager.BirthProvinceId) {
                const cities = await loadCities(data.manager.BirthProvinceId)
                setCitiesByProv(prev => ({ ...prev, [data.manager.BirthProvinceId]: cities }))
              }
              
              setPersonal(prev => ({
                ...prev,
                nationalCode: data.manager.NationalCode || '',
                firstName: data.manager.FirstName || '',
                lastName: data.manager.LastName || '',
                fatherName: data.manager.FatherName || '',
                idSerial: data.manager.IdSerial || '',
                birthProvinceId: data.manager.BirthProvinceId || '',
                birthCityId: data.manager.BirthCityId || '',
                birthDate: data.manager.BirthDateJalali || '',
                gender: data.manager.Gender || '',
                maritalStatus: data.manager.MaritalStatus || ''
              }))
              console.log('✅ Manager information loaded:', data.manager.FirstName, data.manager.LastName)
            } else {
              // No manager found, clear the nationalCode field so user can enter it manually
              setPersonal(prev => ({
                ...prev,
                nationalCode: '',
                firstName: '',
                lastName: '',
                fatherName: '',
                idSerial: '',
                birthProvinceId: '',
                birthCityId: '',
                birthDate: '',
                gender: '',
                maritalStatus: ''
              }))
              console.log('ℹ️ No manager found for this company, user can enter manager info manually')
            }
            
            console.log('✅ Company information loaded for user:', userNationalCode)
          }
        } catch (e) {
          // 404 is fine: company not found, user will enter new information
          console.log('ℹ️ No existing company found for this user, fields will be empty for manual entry')
          // Keep companyInfo empty so user can enter new company information
        }
      } else {
        // For individuals (حقیقی), try recover existing personal by national code
        try {
          const { data } = await api.get(`/api/issue/personal/${start.nationalCode}`)
          if (data && window.confirm('اطلاعات این کد ملی در سیستم موجود است، بازیابی کنم؟')) {
            setPersonal(prev => ({ ...prev, ...data }))
          }
        } catch (e) {
          // 404 is fine: not found, just continue
        }
      }

      // Try recover existing vehicle by VIN (scoped to logged-in user)
      try {
        const { data } = await api.get(`/api/issue/vehicle/by-vin/${encodeURIComponent(start.vin)}`, {
          params: { ownershipType }
        })
        if (data && window.confirm('برای این VIN اطلاعات خودرو موجود است، بازیابی کنم؟')) {
          setVehicle(prev => ({ ...prev, ...normalizeVehicleFromServer(data.vehicle), vin: start.vin }))
        } else {
          // If no existing vehicle found or user declined, still transfer VIN from start step
          setVehicle(prev => ({ ...prev, vin: start.vin }))
        }
      } catch (e) {
        // 404 is fine: not found, continue - but still transfer VIN from start step
        setVehicle(prev => ({ ...prev, vin: start.vin }))
      }
      setCurrent(prev => Math.min(prev + 1, steps.length - 1))
      setIsNextLoading(false)
      return
    }
    if (steps[current].key === 'personal') {
      setPersTriedNext(true)
      // For legal entities (حقوقی), save company information instead of personal
      if (ownershipType === 'حقوقی') {
        // Validate company information
        if (!companyInfo.companyName || !companyInfo.companyName.trim()) {
          alert('لطفاً نام شرکت را وارد کنید')
          setIsNextLoading(false)
          return
        }
        if (!companyInfo.nationalId || !companyInfo.nationalId.trim()) {
          alert('لطفاً شناسه ملی شرکت را وارد کنید')
          setIsNextLoading(false)
          return
        }
        
        try {
          // Save company information to backend
          // IMPORTANT: Do NOT overwrite NationalCode with NationalId.
          // Preserve existing companyInfo.nationalCode; if empty, fall back to start.nationalCode or logged-in user's nationalCode.
          await api.post('/api/issue/company', {
            companyInfo: {
              ...companyInfo,
              nationalCode: companyInfo.nationalCode || start.nationalCode || (user?.nationalCode ? String(user.nationalCode) : '')
            },
            companyRepresentative,
            managerInfo: {
              nationalCode: personal.nationalCode,
              firstName: personal.firstName,
              lastName: personal.lastName,
              fatherName: personal.fatherName,
              idSerial: personal.idSerial,
              birthProvinceId: personal.birthProvinceId,
              birthCityId: personal.birthCityId,
              birthDate: personal.birthDate,
              gender: personal.gender,
              maritalStatus: personal.maritalStatus
            }
          })
          console.log('✅ Company and manager information saved successfully')
        } catch (e) {
          alert(e?.response?.data?.message || 'خطا در ذخیره مشخصات شرکت')
          return
        }
        
        // NOTE: Do not block for VIN registered to other national code (allowed by business rule)
      } else {
        // For individuals (حقیقی), save personal information
        if (!canAdvanceFromPersonal()) return
        try {
          await savePersonalToServer()
          // Documents will be loaded automatically by useEffect when entering docs step
        } catch (e) {
          alert(e?.response?.data?.message || 'خطا در ذخیره مشخصات فردی')
          return
        }
      }
    }
    if (steps[current].key === 'docs') {
      setDocsTriedNext(true)
      if (ownershipType === 'حقیقی') {
        // Validate that all REQUIRED personal documents are uploaded
        const requiredPersonalDocs = (lkPersonalDocs || []).filter(x => x.IsRequired === true || x.IsRequired === 1)
        const uploadedTypeIds = new Set((personDocs || []).map(d => String(d.LookupDocTypeId)))
        const missingRequired = requiredPersonalDocs.filter(x => !uploadedTypeIds.has(String(x.Id ?? x.ID)))
        if (missingRequired.length > 0) {
          const missingNames = missingRequired.map(x => x.Name || x.name).join('، ')
          alert(`لطفاً مدارک ضروری فردی را بارگذاری کنید.\n\nمدارک ضروری باقی‌مانده: ${missingNames}`)
          return
        }
      } else {
        // حقوقی: Validate required company documents only
        const requiredCompanyDocs = (lkCompanyDocs || []).filter(x => x.IsRequired === true || x.IsRequired === 1)
        const uploadedCompanyTypeIds = new Set((companyDocs || []).map(d => String(d.LookupDocTypeId)))
        const missingCompany = requiredCompanyDocs.filter(x => !uploadedCompanyTypeIds.has(String(x.Id ?? x.ID)))
        if (missingCompany.length > 0) {
          const missingNames = missingCompany.map(x => x.Name || x.name).join('، ')
          alert(`لطفاً مدارک ضروری شرکت را بارگذاری کنید.\n\nمدارک ضروری باقی‌مانده: ${missingNames}`)
          return
        }
      }
    }
    if (steps[current].key === 'vehdocs') {
      // Validate that all REQUIRED vehicle documents are uploaded
      const requiredVehDocs = (lkVehicleDocs || []).filter(x => x.IsRequired === true || x.IsRequired === 1)
      const uploadedVehTypeIds = new Set((vehicleDocs || []).map(d => String(d.LookupDocTypeId)))
      const missingRequiredVeh = requiredVehDocs.filter(x => !uploadedVehTypeIds.has(String(x.Id ?? x.ID)))
      if (missingRequiredVeh.length > 0) {
        const missingNames = missingRequiredVeh.map(x => x.Name || x.name).join('، ')
        alert(`لطفاً مدارک ضروری خودرو را بارگذاری کنید.\n\nمدارک ضروری باقی‌مانده: ${missingNames}`)
        return
      }
    }
    if (steps[current].key === 'vehicle') {
      setVehTriedNext(true)
      if (!canAdvanceFromVehicle()) return
      try {
        const res = await saveVehicleToServer()
        if (res?.vehicleId) setVehicleId(res.vehicleId)
      } catch (e) {
        alert(e?.response?.data?.message || 'خطا در ذخیره مشخصات خودرو')
        return
      }
    }
    setCurrent(prev => Math.min(prev + 1, steps.length - 1))
    } finally {
      setIsNextLoading(false)
    }
  }
  const prev = () => {
    setDoneMessage('')
    setCurrent(prev => Math.max(prev - 1, 0))
  }
  // Final submission handler
  const handleFinalSubmit = async () => {
    if (!vehicleId) {
      alert('لطفاً ابتدا اطلاعات خودرو را ذخیره کنید')
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
      // Use the ownershipType state that was set by the user in the first step
      // No need to query the database - we already know if this is حقیقی or حقوقی
      const { data } = await api.post(`/api/issue/vehicle/${vehicleId}/finalize`, {
        licenseTypeId: Number(licenseTypeId),
        operationTypeId: Number(operationTypeId),
        finalDescription: finalDesc,
        ownershipType: ownershipType // Use the state variable directly
      })
      setFinalTrackingNo(data.trackingNo)
      setDoneMessage('درخواست با موفقیت ثبت شد')
    } catch (error) {
      console.error('Error finalizing request:', error)
      alert(error?.response?.data?.message || 'خطا در ثبت نهایی درخواست. لطفاً مجدداً تلاش کنید.')
      setIsSubmitting(false) // Re-enable button on error
    }
  }
  
  // Save changes handler for edit mode
  const handleSaveChanges = async () => {
    if (!requestId) {
      alert('شناسه درخواست یافت نشد')
      return
    }
    
    try {
      // Check if request has deficiency status first
      const deficiencyResponse = await api.get(`/api/workflow/requests/${requestId}/deficiency-status`)
      const hasDeficiency = deficiencyResponse?.data?.hasDeficiency || false
      
      console.log('📋 Deficiency status:', hasDeficiency)
      
      // Save all changes to the request
      await api.put(`/api/workflow/requests/${requestId}`, {
        finalDescription: finalDesc,
        paymentInfo: paymentInfo
      })
      
      // If request had deficiency, explicitly submit corrections to clear deficiency status
      if (hasDeficiency) {
        console.log('✅ Submitting corrections to clear deficiency...')
        const correctionResponse = await api.post(`/api/workflow/requests/${requestId}/submit-corrections`)
        alert('✅ ' + (correctionResponse?.data?.message || 'رفع نقص با موفقیت انجام شد و پرونده ارجاع گردید'))
      } else {
        alert('✅ تغییرات با موفقیت ذخیره شد')
      }
      
      navigate('/workflow/inbox')
    } catch (error) {
      console.error('Error saving changes:', error)
      alert('خطا در ذخیره تغییرات: ' + (error?.response?.data?.message || error.message))
    }
  }
  const renderHeader = () => (
    <div className="wiz-stepper">
      {steps.map((s, idx) => (
        <div key={s.key} className={`wiz-step ${idx === current ? 'active' : ''} ${idx < current ? 'done' : ''}`}>
          <div className="wiz-circle">{idx + 1}</div>
          <div className="wiz-title">{s.title}</div>
          {idx < steps.length - 1 && <div className="wiz-line" />}
        </div>
      ))}
    </div>
  )

  const renderStepContent = () => {
    switch (steps[current].key) {
      case 'start':
        return (
          <div className="person-step">
            <div className="box">
              <div className="box-title">مرحله اول</div>
              
              {/* Row 1: Operation Type (نوع عملیات) */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                <label style={{ fontWeight: 500, whiteSpace: 'nowrap' }}>نوع عملیات:</label>
                <div style={{ display:'flex', gap:16, alignItems:'center' }}>
                  <label style={{ display:'flex', gap:6, alignItems:'center', margin:0 }}>
                    <input 
                      type="radio" 
                      name="operationType" 
                      checked={operationTypeId === (lkOperationTypes.find(x => x.Name === 'صدور')?.Id || lkOperationTypes.find(x => x.Name === 'صدور')?.ID)?.toString()} 
                      onChange={() => {
                        const issuanceType = lkOperationTypes.find(x => x.Name === 'صدور')
                        if (issuanceType) setOperationTypeId(String(issuanceType.Id || issuanceType.ID))
                      }} 
                    /> صدور
                  </label>
                  <label style={{ display:'flex', gap:15, alignItems:'center', margin:0,whiteSpace: 'nowrap' }}>
                    <input 
                      type="radio" 
                      name="operationType" 
                      checked={operationTypeId === (lkOperationTypes.find(x => x.Name === 'تمدید اجباری')?.Id || lkOperationTypes.find(x => x.Name === 'تمدید اجباری')?.ID)?.toString()} 
                      onChange={() => {
                        const renewalType = lkOperationTypes.find(x => x.Name === 'تمدید اجباری')
                        if (renewalType) setOperationTypeId(String(renewalType.Id || renewalType.ID))
                      }} 
                    /> تمدید اجباری
                  </label>
                </div>
              </div>

              {/* Row 2: Ownership Type, National Code, and VIN in one row */}
              <div style={{ display: 'flex', gap: 24, alignItems: 'center', marginBottom: 20 }}>
                {/* Ownership Type */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <label style={{ fontWeight: 500, whiteSpace: 'nowrap' }}>نوع مالکیت:</label>
                  <div style={{ display:'flex', gap:16, alignItems:'center' }}>
                    <label style={{ display:'flex', gap:6, alignItems:'center', margin:0 }}>
                      <input type="radio" name="ownershipType" checked={ownershipType==='حقیقی'} onChange={() => setOwnershipType('حقیقی')} /> حقیقی
                    </label>
                    <label style={{ display:'flex', gap:6, alignItems:'center', margin:0 }}>
                      <input type="radio" name="ownershipType" checked={ownershipType==='حقوقی'} onChange={() => setOwnershipType('حقوقی')} /> حقوقی
                    </label>
                  </div>
                </div>

                {/* National Code */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <label style={{ fontWeight: 500, whiteSpace: 'nowrap' }}>
                    {ownershipType === 'حقوقی' ? 'شناسه ملی شرکت:' : 'کد ملی:'}
                  </label>
                  <input 
                    value={start.nationalCode}
                    onChange={e => setStart(s=>({...s, nationalCode: e.target.value.replace(/[^0-9]/g,'')}))}
                    placeholder={ownershipType === 'حقوقی' ? 'شناسه ملی شرکت (11 رقم)' : 'کد ملی (10 رقم)'} 
                    maxLength={ownershipType === 'حقوقی' ? 11 : 10}
                    style={{ width: '200px' }}
                  />
                </div>

                {/* VIN */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <label style={{ fontWeight: 500, whiteSpace: 'nowrap' }}>VIN:</label>
                  <input 
                    value={start.vin}
                    onChange={e => setStart(s=>({...s, vin: e.target.value}))}
                    placeholder="شماره VIN خودرو"
                    style={{ width: '200px' }}
                  />
                </div>
              </div>

              {/* Error messages below the row */}
              {startTriedNext && (startErrors.nationalCode || startErrors.vin) && (
                <div style={{ marginBottom: 20 }}>
                  {startErrors.nationalCode && (
                    <div className="error-text" style={{ marginBottom: 4 }}>{startErrors.nationalCode}</div>
                  )}
                  {startErrors.vin && (
                    <div className="error-text">{startErrors.vin}</div>
                  )}
                </div>
              )}

              <div className="form-grid">

                <div style={{ gridColumn:'1 / -1' }} />

                <label style={{ alignSelf:'start' }} htmlFor="consentChk">تاییدیه</label>
                <div style={{ gridColumn:'span 5', display:'flex', alignItems:'flex-start', gap:8 }}>
                  <input id="consentChk" type="checkbox" checked={start.consent} onChange={e => setStart(s=>({...s, consent: e.target.checked}))} />
                  <div style={{ fontSize:13, color:'#334155', lineHeight:1.8, whiteSpace:'normal', wordBreak:'break-word' }}>
                    - شماره همراه با کد ملی مطابقت دارد.
                    - اطلاعات هویتی با اسناد ارائه‌شده مطابقت داشته و مورد تایید است.
                    - اطلاعات آدرس و کدپستی با مدارک ارائه‌شده مطابقت دارد.
                    - مسئولیت مغایرت اطلاعات و تبعات آن بر عهده شرکت کارگزار است.
                    - اطلاعات وارد شده صحیح و کامل است.
                    - موارد فوق را می‌پذیرم.
                  </div>
                </div>
                {startTriedNext && startErrors.consent && (
                  <div className="error-text" style={{gridColumn:'1 / -1'}}>{startErrors.consent}</div>
                )}
              </div>
            </div>
          </div>
        )
      case 'vehdocs':
        return (
          <div className="person-step">
            <div className="box">
              <div className="box-title">مدارک خودرو</div>
              <div className="form-grid">
                {!vehicleId ? (
                  <div style={{ gridColumn:'1 / -1', color:'#b91c1c', background:'#fee2e2', border:'1px solid #fecaca', borderRadius:8, padding:8 }}>
                    ابتدا مشخصات خودرو را ذخیره کنید تا شناسه خودرو ایجاد شود.
                  </div>
                ) : (
                  <>
                    <label>مدارک</label>
                    <select value={vehDocSelType} onChange={e => setVehDocSelType(e.target.value)}>
                      <option value="">انتخاب کنید...</option>
                      {lkVehicleDocs.map(x => {
                        const used = vehicleDocs.some(d => String(d.LookupDocTypeId) === String(x.Id || x.ID))
                        const isRequired = x.IsRequired === true || x.IsRequired === 1
                        return (
                          <option key={x.Id || x.ID} value={(x.Id ?? x.ID)} disabled={used}>
                            {isRequired ? '* ' : ''}{x.Name || x.name} {used ? '(بارگذاری شده)' : ''}
                          </option>
                        )
                      })}
                    </select>

                    <label>انتخاب فایل</label>
                    <div style={{ display:'flex', gap:12, alignItems:'center' }}>
                      <input id="veh-doc-file-input" type="file" accept="image/*" style={{ display:'none' }}
                        onChange={async (e) => {
                          const file = e.target.files?.[0]
                          if (!file) return
                          if (!vehDocSelType) { alert('ابتدا نوع مدرک را انتخاب کنید'); e.target.value=''; return }
                          if (file.size > 2*1024*1024) { alert('حجم فایل نباید بیشتر از 2 مگابایت باشد'); e.target.value=''; return }
                          try {
                            const fd = new FormData()
                            fd.append('file', file)
                            fd.append('docTypeId', String(vehDocSelType))
                            const { data } = await api.post(`/api/issue/vehicle/${encodeURIComponent(vehicleId)}/documents`, fd, { headers: { 'Content-Type': 'multipart/form-data' } })
                            setVehicleDocs(prev => [data, ...prev])
                            setVehDocSelType('')
                            e.target.value=''
                          } catch (err) {
                            alert(err?.response?.data?.message || 'آپلود فایل ناموفق بود')
                            e.target.value=''
                          }
                        }} />
                      <button type="button" className="btn-upload" onClick={() => document.getElementById('veh-doc-file-input')?.click()}>انتخاب فایل</button>
                      <span className="note-line">فقط تصویر • حداکثر ۲ مگابایت</span>
                    </div>
                    <div style={{ gridColumn:'1 / -1', fontSize: '13px', color: '#6b7280', marginTop: '4px' }}>
                      <span style={{ color: '#ef4444' }}>*</span> مدارک ضروری باید حتماً بارگذاری شوند
                    </div>

                    <div style={{ gridColumn:'1 / -1', marginTop:8 }}>
                      {vehicleDocs.length === 0 ? (
                        <div style={{ color:'#6b7280' }}>مدرکی ثبت نشده است</div>
                      ) : (
                        <div style={{ display:'grid', gridTemplateColumns:'repeat(12, minmax(0,1fr))', gap:12 }}>
                          {vehicleDocs.map(doc => (
                            <div key={doc.DocID} className="doc-card">
                              <img className="doc-thumb" src={`/api/issue/vehicle/${encodeURIComponent(vehicleId)}/documents/${doc.DocID}/content`} alt={doc.DocTypeName} />
                              <div className="doc-meta">
                                <div className="doc-row">
                                  <span className="doc-label">نوع مدرک :</span>
                                  <span className="doc-value">{doc.DocTypeName || (lkVehicleDocs.find(x => String(x.Id||x.ID)===String(doc.LookupDocTypeId))?.Name || '')}</span>
                                </div>
                                <div className="doc-actions">
                                  <button type="button" className="btn-danger" onClick={async () => {
                                    try {
                                      await api.delete(`/api/issue/vehicle/${encodeURIComponent(vehicleId)}/documents/${doc.DocID}`)
                                      setVehicleDocs(prev => prev.filter(d => d.DocID !== doc.DocID))
                                    } catch (e) { alert('حذف ناموفق بود') }
                                  }}>حذف</button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Validation: All REQUIRED vehicle documents must be uploaded */}
                    {(() => {
                      const requiredVehDocs = (lkVehicleDocs || []).filter(x => x.IsRequired === true || x.IsRequired === 1)
                      const uploadedVehTypeIds = new Set((vehicleDocs || []).map(d => String(d.LookupDocTypeId)))
                      const missingRequiredVeh = requiredVehDocs.filter(x => !uploadedVehTypeIds.has(String(x.Id ?? x.ID)))
                      return (missingRequiredVeh.length > 0 ? (
                        <div style={{ gridColumn:'1 / -1', color:'#b91c1c', background:'#fee2e2', border:'1px solid #fecaca', borderRadius:8, padding:12, marginTop:12 }}>
                          <strong>⚠️ توجه:</strong> لطفا مدارک ضروری خودرو را بارگذاری کنید.<br/>
                          مدارک ضروری باقی‌مانده: {missingRequiredVeh.map(x => x.Name || x.name).join('، ')}
                        </div>
                      ) : null)
                    })()}
                  </>
                )}
              </div>
            </div>
          </div>
        )
      case 'personal':
        // For حقوقی (legal entity), show company information instead of personal details
        if (ownershipType === 'حقوقی') {
          return (
            <div className="person-step">
              {/* Box: Company Information (مشخصات شرکت) */}
              <div className="box">
                <div className="box-title">مشخصات شرکت</div>
                <div className="form-grid">
                  <label>نرخ تناژ</label>
                  <select value={companyInfo.tonnageRateId} onChange={(e) => setCompanyInfo({ ...companyInfo, tonnageRateId: e.target.value })}>
                    <option value="">انتخاب کنید</option>
                    {lkTonnageRates.map(tr => <option key={tr.Id} value={tr.Id}>{tr.Name}</option>)}
                  </select>
                  
                  <label>نام شرکت <span style={{color:'#ef4444'}}>*</span></label>
                  <input type="text" value={companyInfo.companyName} onChange={(e) => setCompanyInfo({ ...companyInfo, companyName: e.target.value })} placeholder="نام شرکت" />
                  
                  <label>نوع شرکت</label>
                  <select value={companyInfo.companyTypeId} onChange={(e) => setCompanyInfo({ ...companyInfo, companyTypeId: e.target.value })}>
                    <option value="">انتخاب کنید</option>
                    {lkRegisteredCompanyTypes.map(rct => <option key={rct.Id} value={rct.Id}>{rct.Name}</option>)}
                  </select>
                  
                  <label>محل ثبت شرکت</label>
                  <select 
                    value={String(companyInfo.registrationCityId || '')} 
                    onChange={(e) => {
                      console.log('🏛️ Registration city changed to:', e.target.value)
                      setCompanyInfo({ ...companyInfo, registrationCityId: e.target.value })
                    }}
                  >
                    <option value="">انتخاب کنید</option>
                    {allCities.sort((a, b) => (a.name || a.Name || '').localeCompare(b.name || b.Name || '', 'fa')).map(c => {
                      const cityId = String(c.ID || c.Id)
                      const cityName = c.name || c.Name
                      return (
                        <option key={cityId} value={cityId}>
                          {cityName}
                        </option>
                      )
                    })}
                  </select>
                  
                  <label>شناسه ملی</label>
                  <input type="text" value={companyInfo.nationalId} onChange={(e) => setCompanyInfo({ ...companyInfo, nationalId: e.target.value })} placeholder="شناسه ملی" />
                  
                  <label>تاریخ ثبت</label>
                  <div style={{ gridColumn: 'span 3' }}>
                    <ManualDateInput value={companyInfo.registrationDate} onChange={(date) => setCompanyInfo({ ...companyInfo, registrationDate: date })} placeholder="تاریخ ثبت" />
                  </div>
                  
                  <label>کد اقتصادی</label>
                  <input type="text" value={companyInfo.economicCode} onChange={(e) => setCompanyInfo({ ...companyInfo, economicCode: e.target.value })} placeholder="کد اقتصادی" />
                  
                  <label>کد کارگاه بیمه</label>
                  <input type="text" value={companyInfo.workshopName} onChange={(e) => setCompanyInfo({ ...companyInfo, workshopName: e.target.value })} placeholder="کد کارگاه بیمه" />
                  
                  <label>فعالیت اصلی</label>
                  <input type="text" value={companyInfo.mainActivity} onChange={(e) => setCompanyInfo({ ...companyInfo, mainActivity: e.target.value })} placeholder="فعالیت اصلی" />
                  
                  <label>رسته فعالیت</label>
                  <select value={String(companyInfo.activityFieldId || '')} onChange={(e) => setCompanyInfo({ ...companyInfo, activityFieldId: e.target.value })}>
                    <option value="">انتخاب کنید</option>
                    {companyInfo.activityFieldId && !lkActivityFields.some(af => String(af.Id ?? af.ID) === String(companyInfo.activityFieldId)) && (
                      <option value={String(companyInfo.activityFieldId)}>{companyInfo.activityFieldName || companyInfo.activityFieldId}</option>
                    )}
                    {lkActivityFields.map(af => <option key={af.Id || af.ID} value={String(af.Id ?? af.ID)}>{af.Name || af.name}</option>)}
                  </select>
                </div>
              </div>

              {/* Box: Company Representative (مشخصات نماینده شرکت جهت دریافت سوخت) */}
              <div className="box" style={{ opacity: 0.6, pointerEvents: 'none' }}>
                <div className="box-title">مشخصات نماینده شرکت جهت دریافت سوخت</div>
                <div className="form-grid">
                  <label>کد ملی نماینده</label>
                  <input type="text" value={companyRepresentative.nationalCode} onChange={(e) => setCompanyRepresentative({ ...companyRepresentative, nationalCode: e.target.value.replace(/[^0-9]/g,'') })} placeholder="کد ملی نماینده" maxLength={10} disabled />
                  
                  <label>تاریخ تولد</label>
                  <div style={{ gridColumn: 'span 3' }}>
                    <ManualDateInput value={companyRepresentative.birthDate} onChange={(date) => setCompanyRepresentative({ ...companyRepresentative, birthDate: date })} placeholder="تاریخ تولد" disabled />
                  </div>
                  
                  <label>شماره وکالت نامه</label>
                  <input type="text" value={companyRepresentative.powerOfAttorneyNo} onChange={(e) => setCompanyRepresentative({ ...companyRepresentative, powerOfAttorneyNo: e.target.value })} placeholder="شماره ثبت سند وکالت نامه" disabled />
                </div>
              </div>

              {/* Box: CEO Personal Information (مشخصات فردی مدیرعامل) */}
              <div className="box">
                <div className="box-title">مشخصات فردی مدیرعامل</div>
                <div className="form-grid">
                 
                <label>کد ملی</label>
                  <input type="text" value={personal.nationalCode} onChange={(e) => setPersonal({ ...personal, nationalCode: e.target.value.replace(/[^0-9]/g,'') })} placeholder="کد ملی" maxLength={10} />
                 
                 
                  <label>نام <span style={{color:'#ef4444'}}>*</span></label>
                  <input type="text" value={personal.firstName} onChange={(e) => setPersonal({ ...personal, firstName: e.target.value })} placeholder="نام" />
                  
                  <label>نام خانوادگی <span style={{color:'#ef4444'}}>*</span></label>
                  <input type="text" value={personal.lastName} onChange={(e) => setPersonal({ ...personal, lastName: e.target.value })} placeholder="نام خانوادگی" />
                  
                  <label>نام پدر</label>
                  <input type="text" value={personal.fatherName} onChange={(e) => setPersonal({ ...personal, fatherName: e.target.value })} placeholder="نام پدر" />
                  
                  
                  <label>شماره شناسنامه</label>
                  <input type="text" value={personal.idSerial} onChange={(e) => setPersonal({ ...personal, idSerial: e.target.value })} placeholder="شماره شناسنامه" />
                  
                  <label>تاریخ تولد</label>
                  <div style={{ gridColumn: 'span 3' }}>
                    <ManualDateInput value={personal.birthDate} onChange={(date) => setPersonal({ ...personal, birthDate: date })} placeholder="تاریخ تولد" />
                  </div>
                  
                  <label>استان محل تولد</label>
                  <select value={personal.birthProvinceId} onChange={async (e) => {
                    const provId = e.target.value
                    setPersonal({ ...personal, birthProvinceId: provId, birthCityId: '' })
                    if (provId) {
                      const cities = await loadCities(provId)
                      setCitiesByProv(prev => ({ ...prev, [provId]: cities }))
                    }
                  }}>
                    <option value="">انتخاب کنید</option>
                    {provinces.map(p => <option key={p.Id || p.ID} value={p.Id || p.ID}>{p.Name || p.name}</option>)}
                  </select>
                  
                  <label>شهر محل تولد</label>
                  <select value={personal.birthCityId} onChange={(e) => setPersonal({ ...personal, birthCityId: e.target.value })} disabled={!personal.birthProvinceId}>
                    <option value="">انتخاب کنید</option>
                    {(citiesByProv[personal.birthProvinceId] || []).map(c => <option key={c.Id || c.ID} value={c.Id || c.ID}>{c.Name || c.name}</option>)}
                  </select>
                  
                  <label>جنسیت <span style={{color:'#ef4444'}}>*</span></label>
                  <select value={personal.gender} onChange={(e) => setPersonal({ ...personal, gender: e.target.value })}>
                    <option value="">انتخاب کنید</option>
                    <option value="مرد">مرد</option>
                    <option value="زن">زن</option>
                  </select>
                  
                  <label>وضعیت تأهل</label>
                  <select value={personal.maritalStatus} onChange={(e) => setPersonal({ ...personal, maritalStatus: e.target.value })}>
                    <option value="">انتخاب کنید</option>
                    <option value="single">مجرد</option>
                    <option value="married">متأهل</option>
                  </select>
                </div>
              </div>

              {/* Box: Company Address (آدرس شرکت) */}
              <div className="box">
                <div className="box-title">آدرس شرکت</div>
                
                {/* Display existing company addresses */}
                {companyInfo.addresses && companyInfo.addresses.length > 0 && (
                  <div style={{ marginBottom: '16px' }}>
                    {companyInfo.addresses.map((addr, idx) => (
                      <div key={idx} style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '12px', marginBottom: '8px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                          <strong>آدرس {idx + 1}</strong>
                          <button type="button" className="btn-danger" onClick={() => {
                            setCompanyInfo({
                              ...companyInfo,
                              addresses: companyInfo.addresses.filter((_, i) => i !== idx)
                            })
                          }}>حذف</button>
                        </div>
                        <div style={{ fontSize: '14px', color: '#6b7280' }}>
                          <p>استان: {getProvinceName(addr.provinceId)}</p>
                          <p>شهر: {getCityName(addr.provinceId, addr.cityId)}</p>
                          <p>خیابان اصلی: {addr.mainStreet || '-'}</p>
                          <p>خیابان فرعی: {addr.sideStreet || '-'}</p>
                          <p>محله: {addr.district || '-'}</p>
                          <p>کد پستی: {addr.postalCode || '-'}</p>
                          <p>پلاک: {addr.plaque || '-'} واحد: {addr.unit || '-'}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Form to add new company address */}
                <div className="form-grid">
                  <label>استان</label>
                  <select value={tmpCompanyAddress.provinceId} onChange={async (e) => {
                    const pId = e.target.value
                    setTmpCompanyAddress({ ...tmpCompanyAddress, provinceId: pId, cityId: '' })
                    if (pId) {
                      const cities = citiesByProv[pId] || await loadCities(pId)
                      setCompanyAddressCities(cities)
                      setCitiesByProv({ ...citiesByProv, [pId]: cities })
                    } else {
                      setCompanyAddressCities([])
                    }
                  }}>
                    <option value="">انتخاب استان</option>
                    {provinces.map(p => <option key={p.Id || p.ID} value={p.Id || p.ID}>{p.Name || p.name}</option>)}
                  </select>
                  
                  <label>شهر</label>
                  <select value={tmpCompanyAddress.cityId} onChange={(e) => setTmpCompanyAddress({ ...tmpCompanyAddress, cityId: e.target.value })}>
                    <option value="">انتخاب شهر</option>
                    {companyAddressCities.map(c => <option key={c.Id || c.ID} value={c.Id || c.ID}>{c.Name || c.name}</option>)}
                  </select>
                  
                  <label>خیابان اصلی</label>
                  <input type="text" value={tmpCompanyAddress.mainStreet} onChange={(e) => setTmpCompanyAddress({ ...tmpCompanyAddress, mainStreet: e.target.value })} placeholder="خیابان اصلی" />
                  
                  <label>خیابان فرعی</label>
                  <input type="text" value={tmpCompanyAddress.sideStreet} onChange={(e) => setTmpCompanyAddress({ ...tmpCompanyAddress, sideStreet: e.target.value })} placeholder="خیابان فرعی" />
                  
                  <label>محله</label>
                  <input type="text" value={tmpCompanyAddress.district} onChange={(e) => setTmpCompanyAddress({ ...tmpCompanyAddress, district: e.target.value })} placeholder="محله" />
                  
                  <label>کد پستی</label>
                  <input type="text" value={tmpCompanyAddress.postalCode} onChange={(e) => setTmpCompanyAddress({ ...tmpCompanyAddress, postalCode: e.target.value })} placeholder="کد پستی" />
                  
                  <label>پلاک</label>
                  <input type="text" value={tmpCompanyAddress.plaque} onChange={(e) => setTmpCompanyAddress({ ...tmpCompanyAddress, plaque: e.target.value })} placeholder="پلاک" />
                  
                  <label>واحد</label>
                  <input type="text" value={tmpCompanyAddress.unit} onChange={(e) => setTmpCompanyAddress({ ...tmpCompanyAddress, unit: e.target.value })} placeholder="واحد" />
                  
                  <div />
                  <button type="button" className="btn-primary" onClick={() => {
                    if (!tmpCompanyAddress.provinceId || !tmpCompanyAddress.cityId) {
                      alert('لطفاً استان و شهر را انتخاب کنید')
                      return
                    }
                    setCompanyInfo({
                      ...companyInfo,
                      addresses: [...companyInfo.addresses, { ...tmpCompanyAddress }]
                    })
                    setTmpCompanyAddress({
                      provinceId: '', cityId: '', mainStreet: '', sideStreet: '',
                      district: '', postalCode: '', plaque: '', unit: '', address: ''
                    })
                    setCompanyAddressCities([])
                  }}>+ افزودن آدرس</button>
                </div>
              </div>

              {/* Box: Company Contact (اطلاعات تماس شرکت) */}
              <div className="box">
                <div className="box-title">اطلاعات تماس شرکت</div>
                
                {/* Display existing company contacts */}
                {companyInfo.contacts && companyInfo.contacts.length > 0 && (
                  <div style={{ marginBottom: '16px' }}>
                    {companyInfo.contacts.map((contact, idx) => (
                      <div key={idx} style={{ background: '#f0fdf4', border: '1px solid #dcfce7', borderRadius: '8px', padding: '12px', marginBottom: '8px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <strong>تماس {idx + 1}:</strong> {contact.type} - {contact.value} {contact.isActive ? '(فعال)' : ''}
                          </div>
                          <button type="button" className="btn-danger" onClick={() => {
                            setCompanyInfo({
                              ...companyInfo,
                              contacts: companyInfo.contacts.filter((_, i) => i !== idx)
                            })
                          }}>حذف</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Form to add new company contact */}
                <div className="form-grid">
                  <label>نوع تماس</label>
                  <select value={tmpCompanyContact.type} onChange={(e) => setTmpCompanyContact({ ...tmpCompanyContact, type: e.target.value })}>
                    <option value="">انتخاب کنید</option>
                    {lkContactTypes.map(ct => <option key={ct.Id} value={ct.Name}>{ct.Name}</option>)}
                  </select>
                  
                  <label>مقدار</label>
                  <input type="text" value={tmpCompanyContact.value} onChange={(e) => setTmpCompanyContact({ ...tmpCompanyContact, value: e.target.value })} placeholder="شماره یا ایمیل" />
                  
                  <label>فعال</label>
                  <input type="checkbox" checked={tmpCompanyContact.isActive} onChange={(e) => setTmpCompanyContact({ ...tmpCompanyContact, isActive: e.target.checked })} />
                  
                  <div />
                  <button type="button" className="btn-primary" onClick={() => {
                    if (!tmpCompanyContact.type || !tmpCompanyContact.value) {
                      alert('لطفاً نوع تماس و مقدار را وارد کنید')
                      return
                    }
                    setCompanyInfo({
                      ...companyInfo,
                      contacts: [...companyInfo.contacts, { ...tmpCompanyContact }]
                    })
                    setTmpCompanyContact({ type: '', value: '', isActive: false })
                  }}>+ افزودن تماس</button>
                </div>
              </div>
            </div>
          )
        }
        
        // For حقیقی (individual), show normal personal details
        return (
          <div className="person-step">
            {/* Box: Personal Details */}
            <div className="box">
              <div className="box-title">مشخصات فردی</div>
              <div className="form-grid">
                <label>نام</label>
                <input value={personal.firstName} onChange={e => setPersonal(p => ({ ...p, firstName: e.target.value }))} placeholder="" />
                <label>نام خانوادگی</label>
                <input value={personal.lastName} onChange={e => setPersonal(p => ({ ...p, lastName: e.target.value }))} placeholder="" />

                <label>نام پدر</label>
                <input value={personal.fatherName} onChange={e => setPersonal(p => ({ ...p, fatherName: e.target.value }))} placeholder="" />
                <label>کد ملی</label>
                <input value={personal.nationalCode || ((user?.Role === 'کارگزار (بهره بردار)' || user?.role === 'کارگزار (بهره بردار)') ? '' : (user?.nationalCode || ''))} onChange={e => setPersonal(p => ({ ...p, nationalCode: e.target.value.replace(/[^0-9]/g,'') }))} placeholder="" />

                <label> شماره شناسنامه</label>
                <input value={personal.idSerial} onChange={e => setPersonal(p => ({ ...p, idSerial: e.target.value }))} placeholder="" />
                <label>تاریخ تولد</label>
                <div style={{ gridColumn: 'span 3' }}>
                  <ManualDateInput value={personal.birthDate} onChange={val => setPersonal(p => ({ ...p, birthDate: val }))} />
                </div>

                <label>استان محل تولد</label>
                <select value={personal.birthProvinceId} onChange={async e => {
                  const id = e.target.value; setPersonal(p => ({ ...p, birthProvinceId: id, birthCityId: '' })); await loadCities(id)
                }}>
                  <option value="">انتخاب کنید...</option>
                  {provinces.map(p => (<option key={p.Id || p.ID} value={(p.Id ?? p.ID)}>{p.Name || p.name}</option>))}
                </select>
                <label>شهر محل تولد</label>
                <select value={personal.birthCityId} onChange={e => setPersonal(p => ({ ...p, birthCityId: e.target.value }))}>
                  <option value="">انتخاب کنید...</option>
                  {(citiesByProv[personal.birthProvinceId] || []).map(c => (<option key={c.Id || c.ID} value={(c.Id ?? c.ID)}>{c.Name || c.name}</option>))}
                </select>

                {/* force new row after place of birth pairs */}
                <div style={{ gridColumn:'1 / -1' }} />

                <label>جنسیت</label>
                <div style={{ display:'flex', gap:16, alignItems:'center', gridColumn:'span 5' }}>
                  <label style={{ display:'flex', gap:6, alignItems:'center', margin:0 }}>
                    <input type="radio" name="gender" checked={personal.gender==='مرد'} onChange={() => setPersonal(p=>({...p, gender:'مرد'}))} /> مرد
                  </label>
                  <label style={{ display:'flex', gap:6, alignItems:'center', margin:0 }}>
                    <input type="radio" name="gender" checked={personal.gender==='زن'} onChange={() => setPersonal(p=>({...p, gender:'زن'}))} /> زن
                  </label>
                </div>

                <label>وضعیت تأهل</label>
                <select value={personal.maritalStatus} onChange={e => setPersonal(p => ({ ...p, maritalStatus: e.target.value }))} style={{ gridColumn:'span 5' }}>
                  <option value="">انتخاب کنید...</option>
                  <option value="مجرد">مجرد</option>
                  <option value="متاهل">متاهل</option>
                </select>
              </div>
              {persTriedNext && !canAdvanceFromPersonal() && (
                <div className="error-text" style={{gridColumn:'1 / -1'}}>لطفا فیلدهای الزامی مشخصات فردی را کامل کنید</div>
              )}
            </div>

            {/* Box: Residence Details */}
            <div className="box">
              <div className="box-title">مشخصات محل سکونت</div>
              <div className="form-grid">
                <label>استان</label>
                <select value={personal.tmpProvinceId || ''} onChange={async e => {
                  const id = e.target.value; const cities = await loadCities(id); setPersonal(p => ({ ...p, tmpProvinceId: id, tmpCityId: cities?.[0]?.Id || '' }))
                }}>
                  <option value="">انتخاب کنید...</option>
                  {provinces.map(p => (<option key={p.Id || p.ID} value={(p.Id ?? p.ID)}>{p.Name || p.name}</option>))}
                </select>
                <label>شهر</label>
                <select value={personal.tmpCityId || ''} onChange={e => setPersonal(p => ({ ...p, tmpCityId: e.target.value }))}>
                  <option value="">انتخاب کنید...</option>
                  {(citiesByProv[personal.tmpProvinceId] || []).map(c => (<option key={c.Id || c.ID} value={(c.Id ?? c.ID)}>{c.Name || c.name}</option>))}
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
                <div />

                <div />
                <div style={{ display:'flex', gap:12 }}>
                  <button type="button" className="btn-primary" onClick={() => setPersonal(p => ({
                    ...p,
                    residences: [...(p.residences||[]), {
                      provinceId: p.tmpProvinceId || '', cityId: p.tmpCityId || '', mainStreet: p.tmpMainStreet || '', sideStreet: p.tmpSideStreet || '',
                      district: p.tmpDistrict || '', postalCode: p.tmpPostalCode || '', plaque: p.tmpPlaque || '', unit: p.tmpUnit || '', address: p.tmpAddress || ''
                    }],
                    tmpProvinceId:'', tmpCityId:'', tmpMainStreet:'', tmpSideStreet:'', tmpDistrict:'', tmpPostalCode:'', tmpPlaque:'', tmpUnit:'', tmpAddress:''
                  }))}>افزودن</button>
                  <button type="button" className="btn-cancel" onClick={() => setPersonal(p => ({
                    ...p, tmpProvinceId:'', tmpCityId:'', tmpMainStreet:'', tmpSideStreet:'', tmpDistrict:'', tmpPostalCode:'', tmpPlaque:'', tmpUnit:'', tmpAddress:''
                  }))}>لغو</button>
                </div>
                <div />
              </div>

              {personal.residences?.length > 0 && (
                <div style={{ gridColumn:'1 / -1', background:'#fff7ed', border:'1px solid #ffedd5', borderRadius:8, padding:8, marginTop:8 }}>
                  {personal.residences.map((r, idx) => (
                    <div key={idx} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:8, padding:'6px 0', borderBottom:'1px dashed #eee' }}>
                      <div>
                        استان: {getProvinceName(r.provinceId) || '—'}
                        ، شهر: {getCityName(r.provinceId, r.cityId) || '—'}
                        ، آدرس: {r.address || [r.mainStreet, r.sideStreet, r.district].filter(Boolean).join('، ') || '—'}
                      </div>
                      <div style={{ display:'flex', gap:8 }}>
                        <button type="button" className="btn-secondary" onClick={() => setPersonal(p => ({
                          ...p,
                          tmpProvinceId: r.provinceId, tmpCityId: r.cityId, tmpMainStreet: r.mainStreet, tmpSideStreet: r.sideStreet,
                          tmpDistrict: r.district, tmpPostalCode: r.postalCode, tmpPlaque: r.plaque, tmpUnit: r.unit, tmpAddress: r.address,
                          residences: p.residences.filter((_,i)=>i!==idx)
                        }))}>ویرایش</button>
                        <button type="button" className="btn-danger" onClick={() => setPersonal(p => ({ ...p, residences: p.residences.filter((_,i)=>i!==idx) }))}>حذف</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Box: Contact Information */}
            <div className="box">
              <div className="box-title">اطلاعات تماس</div>
              <div className="form-grid">
                <label>نوع تماس</label>
                <select value={personal.tmpContactType || ''} onChange={e => setPersonal(p => ({ ...p, tmpContactType: e.target.value }))}>
                  <option value="">انتخاب کنید...</option>
                  <option value="موبایل">موبایل</option>
                  <option value="تلفن ثابت">تلفن ثابت</option>
                  <option value="ایمیل">ایمیل</option>
                </select>
                <label>شماره/ایمیل</label>
                <input value={personal.tmpContactValue || ''} onChange={e => setPersonal(p => ({ ...p, tmpContactValue: e.target.value }))} />

                <label>فعال</label>
                <input type="checkbox" checked={!!personal.tmpContactActive} onChange={e => setPersonal(p => ({ ...p, tmpContactActive: e.target.checked }))} />

                <div />
                <div style={{ display:'flex', gap:12 }}>
                  <button type="button" className="btn-primary" onClick={() => setPersonal(p => ({
                    ...p,
                    contacts: [...(p.contacts||[]), { type: p.tmpContactType||'', value: p.tmpContactValue||'', isActive: !!p.tmpContactActive }],
                    tmpContactType:'', tmpContactValue:'', tmpContactActive:false
                  }))}>افزودن</button>
                  <button type="button" className="btn-cancel" onClick={() => setPersonal(p => ({ ...p, tmpContactType:'', tmpContactValue:'', tmpContactActive:false }))}>لغو</button>
                </div>
                <div />
              </div>

              {personal.contacts?.length > 0 && (
                <div style={{ gridColumn:'1 / -1', background:'#f0fdf4', border:'1px solid #dcfce7', borderRadius:8, padding:8, marginTop:8 }}>
                  {personal.contacts.map((c, idx) => (
                    <div key={idx} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:8, padding:'6px 0', borderBottom:'1px dashed #eee' }}>
                      <div>{c.type} - {c.value} {c.isActive ? '(فعال)': ''}</div>
                      <div style={{ display:'flex', gap:8 }}>
                        <button type="button" className="btn-secondary" onClick={() => setPersonal(p => ({
                          ...p,
                          tmpContactType: c.type, tmpContactValue: c.value, tmpContactActive: c.isActive,
                          contacts: p.contacts.filter((_,i)=>i!==idx)
                        }))}>ویرایش</button>
                        <button type="button" className="btn-danger" onClick={() => setPersonal(p => ({ ...p, contacts: p.contacts.filter((_,i)=>i!==idx) }))}>حذف</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Box: Other Information */}
            <div className="box">
              <div className="box-title">سایر اطلاعات</div>
              <div className="form-grid">
                <label>گروه خون</label>
                <select value={personal.otherBloodGroup} onChange={e => setPersonal(p => ({ ...p, otherBloodGroup: e.target.value }))}>
                  <option value="">انتخاب کنید...</option>
                  {['A+','A-','B+','B-','AB+','AB-','O+','O-'].map(v => <option key={v} value={v}>{v}</option>)}
                </select>

                <label>سطح تحصیلات</label>
                <select value={personal.otherEducationLevel} onChange={e => setPersonal(p => ({ ...p, otherEducationLevel: e.target.value }))}>
                  <option value="">انتخاب کنید...</option>
                  {['زیر دیپلم','دیپلم','فوق دیپلم','کارشناسی','کارشناسی ارشد','دکتری'].map(v => <option key={v} value={v}>{v}</option>)}
                </select>

                <label>وضعیت جسمانی</label>
                <select value={personal.otherPhysicalStatus} onChange={e => setPersonal(p => ({ ...p, otherPhysicalStatus: e.target.value }))}>
                  <option value="">انتخاب کنید...</option>
                  {['سالم','دارای محدودیت'].map(v => <option key={v} value={v}>{v}</option>)}
                </select>

                <label>وضعیت نظام وظیفه</label>
                <select value={personal.otherMilitaryStatus} onChange={e => setPersonal(p => ({ ...p, otherMilitaryStatus: e.target.value }))}>
                  <option value="">انتخاب کنید...</option>
                  {['مشمول','انجام شده','معاف'].map(v => <option key={v} value={v}>{v}</option>)}
                </select>

                <label>تسلط به زبان انگلیسی</label>
                <select value={personal.otherEnglishLevel} onChange={e => setPersonal(p => ({ ...p, otherEnglishLevel: e.target.value }))}>
                  <option value="">انتخاب کنید...</option>
                  {['ضعیف','متوسط','خوب','عالی'].map(v => <option key={v} value={v}>{v}</option>)}
                </select>

                <label>وضعیت ایثارگری</label>
                <select value={personal.otherVeteranStatus} onChange={e => setPersonal(p => ({ ...p, otherVeteranStatus: e.target.value }))}>
                  <option value="">انتخاب کنید...</option>
                  {lkSelfSacrifice.map(vs => (
                    <option key={vs.Id || vs.ID} value={vs.Name || vs.name}>{vs.Name || vs.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )
      case 'docs':
        // For legal entities (حقوقی), show company documents instead of personal documents
        const isLegalEntity = ownershipType === 'حقوقی'
        const docsTitle = isLegalEntity ? 'مدارک شرکت' : 'مدارک شخص'
        const docsLookup = isLegalEntity ? lkCompanyDocs : lkPersonalDocs
        const docsData = isLegalEntity ? companyDocs : personDocs
        const setDocsData = isLegalEntity ? setCompanyDocs : setPersonDocs
        const docsIdentifier = isLegalEntity ? companyInfo.nationalId : personal.nationalCode
        const docsApiPath = isLegalEntity ? 'company' : 'personal'
        
        console.log('📋 Documents tab - isLegalEntity:', isLegalEntity)
        console.log('📋 Documents tab - docsLookup (types):', docsLookup)
        console.log('📋 Documents tab - docsData (uploaded):', docsData)
        console.log('📋 Documents tab - docsIdentifier:', docsIdentifier)
        
        return (
          <div className="person-step">
            <div className="box">
              <div className="box-title">{docsTitle}</div>
              
              {/* Loading indicator */}
              {loadingPersonDocs && (
                <div style={{ padding: '20px', textAlign: 'center', color: '#3b82f6', marginBottom: '16px' }}>
                  <div style={{ fontSize: '16px' }}>⏳ در حال بارگذاری مدارک موجود...</div>
                </div>
              )}
              
              <div className="form-grid">
                <label>مدارک</label>
                <select value={docSelType} onChange={e => setDocSelType(e.target.value)}>
                  <option value="">انتخاب کنید...</option>
                  {docsLookup.map(x => {
                    const used = docsData.some(d => String(d.LookupDocTypeId) === String(x.Id || x.ID))
                    const isRequired = x.IsRequired === true || x.IsRequired === 1
                    return (
                      <option key={x.Id || x.ID} value={(x.Id ?? x.ID)} disabled={used}>
                        {isRequired ? '* ' : ''}{x.Name || x.name} {used ? '(بارگذاری شده)' : ''}
                      </option>
                    )
                  })}
                </select>

                <label>انتخاب فایل</label>
                <div style={{ display:'flex', gap:12, alignItems:'center' }}>
                  <input id="doc-file-input" type="file" accept="image/*" style={{ display:'none' }}
                    onChange={async (e) => {
                      const file = e.target.files?.[0]
                      if (!file) return
                      if (!docSelType) { alert('ابتدا نوع مدرک را انتخاب کنید'); e.target.value=''; return }
                      if (file.size > 2*1024*1024) { alert('حجم فایل نباید بیشتر از 2 مگابایت باشد'); e.target.value=''; return }
                      if (!docsIdentifier?.trim()) { 
                        alert(isLegalEntity ? 'شناسه ملی شرکت الزامی است' : 'کد ملی الزامی است'); 
                        e.target.value=''; 
                        return 
                      }
                      const fd = new FormData()
                      fd.append('file', file)
                      fd.append('docTypeId', String(docSelType))
                      try {
                        const { data } = await api.post(`/api/issue/${docsApiPath}/${encodeURIComponent(docsIdentifier)}/documents`, fd, { headers: { 'Content-Type': 'multipart/form-data' } })
                        setDocsData(prev => [data, ...prev])
                        setDocSelType('')
                        e.target.value=''
                      } catch (err) {
                        alert(err?.response?.data?.message || 'آپلود فایل ناموفق بود')
                        e.target.value=''
                      }
                    }} />
                  <button type="button" className="btn-upload" onClick={() => document.getElementById('doc-file-input')?.click()}>انتخاب فایل</button>
                  <span className="note-line">فقط تصویر • حداکثر ۲ مگابایت</span>
                </div>
                <div style={{ gridColumn:'1 / -1', fontSize: '13px', color: '#6b7280', marginTop: '4px' }}>
                  <span style={{ color: '#ef4444' }}>*</span> مدارک ضروری باید حتماً بارگذاری شوند
                </div>

                <div style={{ gridColumn:'1 / -1', marginTop:8 }}>
                  {docsData.length === 0 ? (
                    <div style={{ color:'#6b7280' }}>مدرکی ثبت نشده است</div>
                  ) : (
                    <div style={{ display:'grid', gridTemplateColumns:'repeat(12, minmax(0,1fr))', gap:12 }}>
                      {docsData.map(doc => {
                        const isExisting = doc.isExisting
                        return (
                          <div 
                            key={doc.DocID} 
                            className="doc-card"
                            style={{
                              background: isExisting ? '#f0f9ff' : '#fff',
                              border: isExisting ? '2px solid #3b82f6' : '1px solid #e5e7eb'
                            }}
                          >
                            <img className="doc-thumb" src={`/api/issue/${docsApiPath}/${encodeURIComponent(docsIdentifier)}/documents/${doc.DocID}/content`} alt={doc.DocTypeName} />
                            <div className="doc-meta">
                              <div className="doc-row">
                                <span className="doc-label">نوع مدرک :</span>
                                <span className="doc-value">
                                  {doc.DocTypeName || getDocTypeName(doc.LookupDocTypeId)}
                                  {isExisting && <span style={{ marginRight: '8px', fontSize: '12px', color: '#3b82f6', fontWeight: '600' }}>✓ ذخیره شده</span>}
                                </span>
                              </div>
                              <div className="doc-actions">
                                <button type="button" className="btn-danger" onClick={async () => {
                                  try {
                                    await api.delete(`/api/issue/${docsApiPath}/${encodeURIComponent(docsIdentifier)}/documents/${doc.DocID}`)
                                    setDocsData(prev => prev.filter(d => d.DocID !== doc.DocID))
                                  } catch (e) { alert('حذف ناموفق بود') }
                                }}>حذف</button>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>

                {/* Validation: All REQUIRED documents must be uploaded */}
                {(() => {
                  const requiredDocs = (docsLookup || []).filter(x => x.IsRequired === true || x.IsRequired === 1)
                  const uploadedTypeIds = new Set((docsData || []).map(d => String(d.LookupDocTypeId)))
                  const missingRequired = requiredDocs.filter(x => !uploadedTypeIds.has(String(x.Id ?? x.ID)))
                  return (missingRequired.length > 0 ? (
                    <div style={{ gridColumn:'1 / -1', color:'#b91c1c', background:'#fee2e2', border:'1px solid #fecaca', borderRadius:8, padding:12, marginTop:12 }}>
                      <strong>⚠️ توجه:</strong> لطفا مدارک ضروری را بارگذاری کنید.<br/>
                      مدارک ضروری باقی‌مانده: {missingRequired.map(x => x.Name || x.name).join('، ')}
                    </div>
                  ) : null)
                })()}
              </div>
            </div>
          </div>
        )
      case 'vehicle':
        return (
          <div className="vehicle-step form-grid">
            {/* مشخصات خودرو */}
            <h4 className="section-title">مشخصات خودرو</h4>

            <label>نوع وسیله نقلیه</label>
            <select 
              value={vehicle.vehicleKindId} 
              onChange={async (e) => {
                const vehicleTypeId = e.target.value
                setVehicle(v => ({ ...v, vehicleKindId: vehicleTypeId, systemId: '', systemTipId: '' }))
                // Load systems for this vehicle type
                await loadSystemsByVehicleType(vehicleTypeId)
                // Clear tips since system is cleared
                setSystemTips([])
              }}
            >
              <option value="">انتخاب کنید...</option>
              {vehicleTypes.map(vt => (<option key={vt.ID} value={vt.ID}>{vt.VehicleTypeName}</option>))}
            </select>
            {vehTriedNext && !vehicle.vehicleKindId?.toString().trim() && <div className="error-text">نوع وسیله نقلیه باید انتخاب شود</div>}

            <label>سیستم ناوگان</label>
            <select 
              value={vehicle.systemId} 
              onChange={async (e) => {
                const systemId = e.target.value
                setVehicle(v => ({ ...v, systemId, systemTipId: '' }))
                // Load tips for this system
                await loadTips(systemId)
              }}
              disabled={!vehicle.vehicleKindId}
            >
              <option value="">{!vehicle.vehicleKindId ? 'ابتدا نوع وسیله نقلیه را انتخاب کنید...' : 'انتخاب کنید...'}</option>
              {systems.map(s => (<option key={s.ID} value={s.ID}>{s.systemname}</option>))}
            </select>
            {vehTriedNext && !vehicle.systemId?.toString().trim() && <div className="error-text">سیستم ناوگان باید انتخاب شود</div>}

            <label>تیپ ناوگان</label>
            <select 
              value={vehicle.systemTipId} 
              onChange={e => setVehicle(v => ({ ...v, systemTipId: e.target.value }))} 
              disabled={!vehicle.systemId}
            >
              <option value="">{!vehicle.systemId ? 'ابتدا سیستم ناوگان را انتخاب کنید...' : 'انتخاب کنید...'}</option>
              {systemTips.map(t => (<option key={t.ID} value={t.ID}>{t.tipname}</option>))}
            </select>
            {vehTriedNext && !vehicle.systemTipId?.toString().trim() && <div className="error-text">تیپ ناوگان باید انتخاب شود</div>}

            <label>سال تولید</label>
            <input value={vehicle.yearManufacture} onChange={e => setVehicle(v => ({ ...v, yearManufacture: e.target.value.replace(/[^0-9]/g,'') }))} placeholder="مثال: 1398" />
            {vehTriedNext && !vehicle.yearManufacture?.trim() && <div className="error-text">سال تولید باید خالی نباشد</div>}

            <label>ظرفیت (تن)</label>
            <input 
              value={vehicle.capacity} 
              onChange={e => {
                const value = e.target.value;
                // Allow empty, numbers, and decimal point
                if (value === '' || /^\d*\.?\d*$/.test(value)) {
                  const numValue = parseFloat(value);
                  // Only update if empty, valid decimal, or within range 0-100
                  if (value === '' || value === '.' || (numValue >= 0 && numValue <= 100)) {
                    setVehicle(v => ({ ...v, capacity: value }));
                  }
                }
              }} 
              placeholder="مثال: 10 تُن (0 تا 100)" 
            />
            {vehTriedNext && !vehicle.capacity?.trim() && <div className="error-text">ظرفیت باید خالی نباشد (0 تا 100 تن)</div>}
            {vehicle.capacity && (parseFloat(vehicle.capacity) < 0 || parseFloat(vehicle.capacity) > 100) && <div className="error-text">ظرفیت باید بین 0 تا 100 تن باشد</div>}

            <label>نوع سوخت</label>
            <select value={vehicle.fuelTypeId} onChange={e => setVehicle(v => ({ ...v, fuelTypeId: e.target.value }))}>
              <option value="">انتخاب کنید...</option>
              {lkFuelTypes.map(x => (<option key={x.Id || x.ID} value={(x.Id ?? x.ID)}>{x.Name || x.name}</option>))}
            </select>
            {vehTriedNext && !vehicle.fuelTypeId?.toString().trim() && <div className="error-text">نوع سوخت باید انتخاب شود</div>}

            <label>نوع کشنده</label>
            <select value={vehicle.trackerTypeId} onChange={e => setVehicle(v => ({ ...v, trackerTypeId: e.target.value }))}>
              <option value="">انتخاب کنید...</option>
              {lkTrackerTypes.map(x => (<option key={x.Id || x.ID} value={(x.Id ?? x.ID)}>{x.Name || x.name}</option>))}
            </select>
            {vehTriedNext && !vehicle.trackerTypeId?.toString().trim() && <div className="error-text">نوع کشنده باید انتخاب شود</div>}

            <label>تعداد سیلندر</label>
            <input value={vehicle.cylinders} onChange={e => setVehicle(v => ({ ...v, cylinders: e.target.value }))} placeholder="مثال: 4" />
            {vehTriedNext && !vehicle.cylinders?.trim() && <div className="error-text">تعداد سیلندر باید خالی نباشد</div>}

            <label>تعداد محور</label>
            <input value={vehicle.axles} onChange={e => setVehicle(v => ({ ...v, axles: e.target.value }))} placeholder="مثال: 2" />
            {vehTriedNext && !vehicle.axles?.trim() && <div className="error-text">تعداد محور باید خالی نباشد</div>}

            <label>تعداد چرخ</label>
            <input value={vehicle.wheels} onChange={e => setVehicle(v => ({ ...v, wheels: e.target.value }))} placeholder="مثال: 4" />
            {vehTriedNext && !String(vehicle.wheels || '').trim() && <div className="error-text">تعداد چرخ باید خالی نباشد</div>}

            <label>شماره VIN</label>
            <input value={vehicle.vin} onChange={e => setVehicle(v => ({ ...v, vin: e.target.value }))} placeholder="مثال: IR-XXXXXXXX"  disabled />
            {vehTriedNext && !vehicle.vin?.trim() && <div className="error-text">شماره VIN باید خالی نباشد</div>}

            <label>شماره شاسی</label>
            <input value={vehicle.chassisNo} onChange={e => setVehicle(v => ({ ...v, chassisNo: e.target.value }))} placeholder="مثال: CH-XXXXXXXX" />
            {vehTriedNext && !vehicle.chassisNo?.trim() && <div className="error-text">شماره شاسی باید خالی نباشد</div>}

            <label>شماره موتور</label>
            <input value={vehicle.engineNo} onChange={e => setVehicle(v => ({ ...v, engineNo: e.target.value }))} placeholder="مثال: ENG-XXXX" />
            {vehTriedNext && !vehicle.engineNo?.trim() && <div className="error-text">شماره موتور باید خالی نباشد</div>}

            <label>رنگ بدنه</label>
            <input value={vehicle.bodyColor} onChange={e => setVehicle(v => ({ ...v, bodyColor: e.target.value }))} placeholder="مثال: سفید" />
            {vehTriedNext && !vehicle.bodyColor?.trim() && <div className="error-text">رنگ بدنه باید خالی نباشد</div>}

            <label>رسته فعالیت</label>
            <select value={String(vehicle.activityCategoryId || '')} onChange={e => setVehicle(v => ({ ...v, activityCategoryId: e.target.value }))}>
              <option value="">انتخاب کنید...</option>
              {vehicle.activityCategoryId && !lkActivityCats.some(x => String(x.Id ?? x.ID) === String(vehicle.activityCategoryId)) && (
                <option value={String(vehicle.activityCategoryId)}>{vehicle.activityCategoryName || vehicle.activityCategoryId}</option>
              )}
              {lkActivityCats.map(x => (<option key={x.Id || x.ID} value={String(x.Id ?? x.ID)}>{x.Name || x.name}</option>))}
            </select>
            {vehTriedNext && !vehicle.activityCategoryId?.toString().trim() && <div className="error-text">رسته فعالیت باید انتخاب شود</div>}

            {/* Plate Type and Plate on the same row */}
            <label>نوع پلاک</label>
            <select value={vehicle.plateTypeId} onChange={e => setVehicle(v => ({ ...v, plateTypeId: e.target.value }))} style={{ gridColumn: 'span 2' }}>
              <option value="">انتخاب کنید...</option>
              {lkPlateTypes.map(x => (<option key={x.Id || x.ID} value={(x.Id ?? x.ID)}>{x.Name || x.name}</option>))}
            </select>
            {vehTriedNext && !vehicle.plateTypeId?.toString().trim() && <div className="error-text">نوع پلاک باید انتخاب شود</div>}

            {/* Iranian Plate - embedded inputs inside styled plate - larger size */}
            <label>پلاک</label>
            <div className="plate-wrapper" style={{ gridColumn: 'span 5' }}>
              <div className="plate" style={{ transform: 'scale(1.3)', transformOrigin: 'right center' }}>
                
                <div className="plate-right">
                  <div className="iran">ایران</div>
                  <input className="region" maxLength={2} value={vehicle.plate.p4_two}
                    onChange={e => setVehicle(v => ({ ...v, plate: { ...v.plate, p4_two: e.target.value.replace(/[^0-9]/g,'') } }))} />
                </div>
                <div className="plate-center">
                  {/* Order visually from right to left: serial, letter, three */}
                  <input className="plate-part three" maxLength={3} value={vehicle.plate.p2_three}
                    onChange={e => setVehicle(v => ({ ...v, plate: { ...v.plate, p2_three: e.target.value.replace(/[^0-9]/g,'') } }))} />
                  <input 
                    className="plate-part letter" 
                    type="text"
                    maxLength={3}
                    value={vehicle.plate.p3_letter || ''}
                    onChange={e => {
                      const val = e.target.value;
                      // Only allow Persian letters from the list
                      const validLetters = ['الف','ب','پ','ت','ث','ج','چ','ح','خ','د','ذ','ر','ز','س','ش','ص','ض','ط','ظ','ع','غ','ف','ق','ک','گ','ل','م','ن','و','ه','ی'];
                      if (val === '' || validLetters.includes(val)) {
                        setVehicle(v => ({ ...v, plate: { ...v.plate, p3_letter: val } }));
                      }
                    }}
                    list="plate-letters"
                    placeholder="—"
                    style={{ cursor: 'pointer' }}
                  />
                  <datalist id="plate-letters">
                    {['الف','ب','پ','ت','ث','ج','چ','ح','خ','د','ذ','ر','ز','س','ش','ص','ض','ط','ظ','ع','غ','ف','ق','ک','گ','ل','م','ن','و','ه','ی'].map(l => (
                      <option key={l} value={l} />
                    ))}
                  </datalist>
                  <input className="plate-part serial2" maxLength={2} value={vehicle.plate.p1_serial2}
                    onChange={e => setVehicle(v => ({ ...v, plate: { ...v.plate, p1_serial2: e.target.value.replace(/[^0-9]/g,'') } }))} />
                </div>
                
                <div className="plate-left">
                  <div className="flag">I.R<br/>IRAN</div>
                </div>

              </div>
            </div>
            {vehTriedNext && (!vehicle.plate.p1_serial2 || !vehicle.plate.p2_three || !vehicle.plate.p3_letter || !vehicle.plate.p4_two) && (
              <div className="error-text">همه قسمت‌های پلاک الزامی است</div>
            )}

            {/* Move inspection date, green card date, and container to last row */}
            <br />
            <label>تاریخ بازدید</label>
            <div style={{ gridColumn: 'span 2' }}>
              <ManualDateInput value={vehicle.inspectionDate} onChange={val => setVehicle(v => ({ ...v, inspectionDate: val }))} />
            </div>
            <label>تاریخ برگ سبز</label>
            <div style={{ gridColumn: 'span 2' }}>
              <ManualDateInput value={vehicle.greenCardDate} onChange={val => setVehicle(v => ({ ...v, greenCardDate: val }))} />
            </div>
            <label>کانتینر دارد؟</label>
            <div style={{ display:'flex', gap:16, alignItems:'center' }}>
              <label style={{ display:'flex', gap:6, alignItems:'center', margin:0 }}>
                <input type="radio" name="isContainer" checked={vehicle.isContainer === 'yes'} onChange={() => setVehicle(v => ({ ...v, isContainer: 'yes' }))} /> بلی
              </label>
              <label style={{ display:'flex', gap:6, alignItems:'center', margin:0 }}>
                <input type="radio" name="isContainer" checked={vehicle.isContainer === 'no'} onChange={() => setVehicle(v => ({ ...v, isContainer: 'no' }))} /> خیر
              </label>
            </div>
            {vehTriedNext && (!vehicle.inspectionDate?.trim() || !vehicle.greenCardDate?.trim()) && <div className="error-text">تاریخ بازدید و تاریخ برگ سبز باید کامل باشند</div>}
            {vehTriedNext && !vehicle.isContainer?.trim() && <div className="error-text">این فیلد باید انتخاب شود</div>}

            <hr className="section-sep" />
            <h4 className="section-title">سایر اطلاعات خودرو</h4>

            <label>پلاک آزاد؟</label>
            <input type="checkbox" checked={!!vehicle.freePlate} onChange={e => setVehicle(v => ({ ...v, freePlate: e.target.checked }))} />

            <label>نام شرکت بیمه</label>
            <select value={vehicle.insuranceCompanyId} onChange={e => setVehicle(v => ({ ...v, insuranceCompanyId: e.target.value }))}>
              <option value="">انتخاب کنید...</option>
              {lkInsuranceNames.map(x => (<option key={x.Id || x.ID} value={(x.Id ?? x.ID)}>{x.Name || x.name}</option>))}
            </select>
            {vehTriedNext && !vehicle.insuranceCompanyId?.toString().trim() && <div className="error-text">نام شرکت بیمه باید انتخاب شود</div>}

            <label>شماره بیمه‌نامه</label>
            <input value={vehicle.insurancePolicyNo} onChange={e => setVehicle(v => ({ ...v, insurancePolicyNo: e.target.value }))} placeholder="مثال: 123456" />
            {vehTriedNext && !vehicle.insurancePolicyNo?.trim() && <div className="error-text">شماره بیمه‌نامه باید خالی نباشد</div>}

            <label>تاریخ صدور بیمه</label>
            <div style={{ gridColumn: 'span 2' }}>
              <ManualDateInput value={vehicle.insuranceIssueDate} onChange={val => setVehicle(v => ({ ...v, insuranceIssueDate: val }))} />
            </div>
            {vehTriedNext && !vehicle.insuranceIssueDate?.trim() && <div className="error-text">تاریخ صدور بیمه باید خالی نباشد</div>}

            <label>تاریخ اعتبار بیمه</label>
            <div style={{ gridColumn: 'span 2' }}>
              <ManualDateInput value={vehicle.insuranceValidDate} onChange={val => setVehicle(v => ({ ...v, insuranceValidDate: val }))} />
            </div>
            {vehTriedNext && !vehicle.insuranceValidDate?.trim() && <div className="error-text">تاریخ اعتبار بیمه باید خالی نباشد</div>}

            {/* سریال کارت هوشمند حذف شد */}

            <label>سریال معاینه فنی</label>
            <input value={vehicle.techInspectSerial} onChange={e => setVehicle(v => ({ ...v, techInspectSerial: e.target.value }))} placeholder="مثال: XYZ789" />
            {vehTriedNext && !vehicle.techInspectSerial?.trim() && <div className="error-text">سریال معاینه فنی باید خالی نباشد</div>}

            <label>تاریخ صدور معاینه فنی</label>
            <div style={{ gridColumn: 'span 2' }}>
              <ManualDateInput value={vehicle.techInspectIssueDate} onChange={val => setVehicle(v => ({ ...v, techInspectIssueDate: val }))} />
            </div>
            {vehTriedNext && !vehicle.techInspectIssueDate?.trim() && <div className="error-text">تاریخ صدور باید خالی نباشد</div>}

            <label>تاریخ اعتبار معاینه فنی</label>
            <div style={{ gridColumn: 'span 2' }}>
              <ManualDateInput value={vehicle.techInspectValidDate} onChange={val => setVehicle(v => ({ ...v, techInspectValidDate: val }))} />
            </div>
            {vehTriedNext && !vehicle.techInspectValidDate?.trim() && <div className="error-text">تاریخ اعتبار باید خالی نباشد</div>}
          </div>
        )
      case 'discounts':
        return (
          <div className="person-step">
            <div className="box">
              <div className="box-title">پیوست تخفیفات</div>
              <div className="form-grid">
                {!vehicleId ? (
                  <div style={{ gridColumn:'1 / -1', color:'#b91c1c', background:'#fee2e2', border:'1px solid #fecaca', borderRadius:8, padding:8 }}>
                    ابتدا مشخصات خودرو را ذخیره کنید تا شناسه خودرو ایجاد شود.
                  </div>
                ) : (
                  <>
                    <label>نوع پیوست</label>
                    <select value={discDocSelType} onChange={e => setDiscDocSelType(e.target.value)}>
                      <option value="">انتخاب کنید...</option>
                      {lkDiscountDocs.map(x => {
                        const used = discountDocs.some(d => String(d.LookupDocTypeId) === String(x.Id || x.ID))
                        return (
                          <option key={x.Id || x.ID} value={(x.Id ?? x.ID)} disabled={used}>
                            {x.Name || x.name}
                          </option>
                        )
                      })}
                    </select>

                    <label>توضیحات</label>
                    <textarea rows={4} value={discDescription} onChange={e => setDiscDescription(e.target.value)} placeholder="اختیاری" style={{ gridColumn:'span 5', resize:'vertical' }} />

                    <label>انتخاب فایل</label>
                    <div style={{ display:'flex', gap:12, alignItems:'center' }}>
                      <input id="disc-doc-file-input" type="file" accept="image/*" style={{ display:'none' }}
                        onChange={async (e) => {
                          const file = e.target.files?.[0]
                          if (!file) return
                          if (!discDocSelType) { alert('ابتدا نوع پیوست را انتخاب کنید'); e.target.value=''; return }
                          if (file.size > 2*1024*1024) { alert('حجم فایل نباید بیشتر از 2 مگابایت باشد'); e.target.value=''; return }
                          try {
                            const fd = new FormData()
                            fd.append('file', file)
                            fd.append('docTypeId', String(discDocSelType))
                            fd.append('description', discDescription || '')
                            const { data } = await api.post(`/api/issue/vehicle/${encodeURIComponent(vehicleId)}/discount-documents`, fd, { headers: { 'Content-Type': 'multipart/form-data' } })
                            setDiscountDocs(prev => [data, ...prev])
                            setDiscDocSelType('')
                            setDiscDescription('')
                            e.target.value=''
                          } catch (err) {
                            alert(err?.response?.data?.message || 'آپلود فایل ناموفق بود')
                            e.target.value=''
                          }
                        }} />
                      <button type="button" className="btn-upload" onClick={() => document.getElementById('disc-doc-file-input')?.click()}>انتخاب فایل</button>
                      <span className="note-line">فقط تصویر • حداکثر ۲ مگابایت</span>
                    </div>

                    <div style={{ gridColumn:'1 / -1', marginTop:8 }}>
                      {discountDocs.length === 0 ? (
                        <div style={{ color:'#6b7280' }}>مدرکی ثبت نشده است</div>
                      ) : (
                        <div style={{ display:'grid', gridTemplateColumns:'repeat(12, minmax(0,1fr))', gap:12 }}>
                          {discountDocs.map(doc => (
                            <div key={doc.DocID} className="doc-card">
                              <img className="doc-thumb" src={`/api/issue/vehicle/${encodeURIComponent(vehicleId)}/discount-documents/${doc.DocID}/content`} alt={doc.DocTypeName} />
                              <div className="doc-meta">
                                <div className="doc-row">
                                  <span className="doc-label">نوع پیوست :</span>
                                  <span className="doc-value">{doc.DocTypeName || (lkDiscountDocs.find(x => String(x.Id||x.ID)===String(doc.LookupDocTypeId))?.Name || '')}</span>
                                </div>
                                {doc.Description && (
                                  <div className="doc-row">
                                    <span className="doc-label">توضیحات :</span>
                                    <span className="doc-value">{doc.Description}</span>
                                  </div>
                                )}
                                <div className="doc-actions">
                                  <button type="button" className="btn-danger" onClick={async () => {
                                    try {
                                      await api.delete(`/api/issue/vehicle/${encodeURIComponent(vehicleId)}/discount-documents/${doc.DocID}`)
                                      setDiscountDocs(prev => prev.filter(d => d.DocID !== doc.DocID))
                                    } catch (e) { alert('حذف ناموفق بود') }
                                  }}>حذف</button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )
      case 'finish':
      default:
        return (
          <div className="person-step">
            <div className="box">
              <div className="box-title">تکمیل عملیات</div>
              <div className="form-grid">
                {!vehicleId ? (
                  <div style={{ gridColumn:'1 / -1', color:'#b91c1c', background:'#fee2e2', border:'1px solid #fecaca', borderRadius:8, padding:8 }}>
                    ابتدا مشخصات خودرو را ذخیره و شناسه خودرو دریافت کنید.
                  </div>
                ) : finalTrackingNo ? (
                  <div style={{ gridColumn:'1 / -1', color:'#065f46', background:'#d1fae5', border:'1px solid #a7f3d0', borderRadius:8, padding:16, textAlign:'center' }}>
                    <div style={{ fontSize:18, fontWeight:'bold', marginBottom:8 }}>درخواست با موفقیت ثبت شد</div>
                    <div>شماره پیگیری: <strong>{finalTrackingNo}</strong></div>
                    <div style={{ marginTop:16 }}>از طریق این شماره می‌توانید وضعیت درخواست خود را پیگیری نمایید.</div>
                    <div style={{ marginTop:12, fontSize:16, fontWeight:600 }}>
                      در حال هدایت به صفحه مالی هستیم...
                    </div>
                    <div style={{ marginTop:8, fontSize:24, fontWeight:800 }}>{secondsLeft}</div>
                  </div>
                ) : (
                  <>
                    <label>توضیحات نهایی</label>
                    <textarea 
                      rows={5} 
                      value={finalDesc} 
                      onChange={e => setFinalDesc(e.target.value)} 
                      placeholder="اختیاری" 
                      style={{ gridColumn:'span 8', resize:'vertical' }} 
                      dir="rtl"
                      className={finalDesc.length > 2000 ? 'error' : ''}
                    />
                    {finalDesc.length > 2000 && (
                      <div className="error-text" style={{gridColumn:'1 / -1'}}>
                        توضیحات نباید بیشتر از 2000 کاراکتر باشد
                      </div>
                    )}
                    
                    {/* Payment Information Section - Editable in Edit Mode */}
                    {isEditMode && (
                      <>
                        <div style={{ gridColumn:'1 / -1', marginTop:16 }}>
                          <h4 style={{ margin:'0 0 12px 0', padding:'8px 12px', background:'#e0f2fe', borderRadius:6, fontSize:16 }}>
                            💳 اطلاعات پرداخت
                          </h4>
                        </div>
                        
                        <label>مبلغ پرداختی</label>
                        <input 
                          value={paymentInfo.amount} 
                          onChange={e => setPaymentInfo(p => ({ ...p, amount: e.target.value.replace(/[^0-9]/g,'') }))} 
                          placeholder="مبلغ به ریال"
                          style={{ gridColumn:'span 2' }}
                        />
                        
                        <label>تاریخ پرداخت</label>
                        <div style={{ gridColumn: 'span 3' }}>
                          <ManualDateInput 
                            value={paymentInfo.paymentDate} 
                            onChange={val => setPaymentInfo(p => ({ ...p, paymentDate: val }))} 
                          />
                        </div>
                        
                        <label>شماره مرجع</label>
                        <input 
                          value={paymentInfo.referenceNumber} 
                          onChange={e => setPaymentInfo(p => ({ ...p, referenceNumber: e.target.value }))} 
                          placeholder="شماره مرجع تراکنش"
                          style={{ gridColumn:'span 2' }}
                        />
                        
                        <label>وضعیت پرداخت</label>
                        <select 
                          value={paymentInfo.status} 
                          onChange={e => setPaymentInfo(p => ({ ...p, status: e.target.value }))}
                          style={{ gridColumn:'span 2' }}
                        >
                          <option value="">انتخاب کنید...</option>
                          <option value="Pending">در انتظار</option>
                          <option value="Paid">پرداخت شده</option>
                          <option value="Failed">ناموفق</option>
                        </select>
                        
                        <label>توضیحات پرداخت</label>
                        <textarea 
                          rows={3} 
                          value={paymentInfo.description} 
                          onChange={e => setPaymentInfo(p => ({ ...p, description: e.target.value }))} 
                          placeholder="توضیحات اختیاری"
                          style={{ gridColumn:'span 8', resize:'vertical' }} 
                          dir="rtl"
                        />
                        
                        <div style={{ gridColumn:'1 / -1', marginTop:12 }}>
                          <h4 style={{ margin:'0 0 12px 0', padding:'8px 12px', background:'#fef3c7', borderRadius:6, fontSize:16 }}>
                            📎 مستندات پرداخت
                          </h4>
                        </div>
                        
                        <div style={{ gridColumn:'1 / -1', display:'grid', gridTemplateColumns:'repeat(12, minmax(0,1fr))', gap:12 }}>
                          {paymentDocs.length === 0 ? (
                            <div style={{ gridColumn:'1 / -1', color:'#6b7280', padding:12 }}>مستندی ثبت نشده است</div>
                          ) : (
                            paymentDocs.map(doc => (
                              <div key={doc.DocID} className="doc-card">
                                <img className="doc-thumb" src={`/api/workflow/requests/${requestId}/payment-documents/${doc.DocID}/content`} alt="Payment Document" />
                                <div className="doc-meta">
                                  <div className="doc-row">
                                    <span className="doc-label">مستند پرداخت</span>
                                  </div>
                                  <div className="doc-actions">
                                    <button type="button" className="btn-danger" onClick={async () => {
                                      try {
                                        await api.delete(`/api/workflow/requests/${requestId}/payment-documents/${doc.DocID}`)
                                        setPaymentDocs(prev => prev.filter(d => d.DocID !== doc.DocID))
                                      } catch (e) { alert('حذف ناموفق بود') }
                                    }}>حذف</button>
                                  </div>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </>
                    )}
                    
                    <div style={{ gridColumn:'span 8', display:'flex', justifyContent:'flex-end' }}>
                      <p style={{ color: '#666', fontSize: '0.9em' }}>
                        {isEditMode ? 'برای ذخیره تغییرات، از دکمه «ذخیره تغییرات» در پایین صفحه استفاده کنید.' : 'برای ثبت نهایی، از دکمه «ثبت نهایی» در پایین صفحه استفاده کنید.'}
                      </p>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )
    }
  }

  // Show loading state while loading edit data
  if (loadingEditData) {
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
      <h2>{isEditMode ? '✏️ ویرایش درخواست' : 'صدور پروانه - ویزارد چند مرحله‌ای'}</h2>
      {isEditMode && (
        <div style={{ 
          padding: '12px', 
          background: '#fef3c7', 
          border: '1px solid #fbbf24', 
          borderRadius: '8px', 
          marginBottom: '16px',
          fontSize: '14px'
        }}>
          <strong>⚠️ توجه:</strong> شما در حال ویرایش یک درخواست موجود هستید. تغییرات شما پس از ثبت نهایی اعمال خواهد شد.
        </div>
      )}

      <div className={`wiz-container stepper`}>
        {renderHeader()}

        <div className="wiz-content">
          {renderStepContent()}

          <div className="wiz-actions">
            <button className="btn-prev" onClick={prev} disabled={current === 0 || isNextLoading}>مرحله قبل</button>
            {current < steps.length - 1 && (
              <button className="btn-next" onClick={next} disabled={isNextLoading}>
                {isNextLoading ? '⏳ در حال پردازش...' : 'مرحله بعد'}
              </button>
            )}
            {current === steps.length - 1 && (
              isEditMode ? (
                <button 
                  className="primary" 
                  onClick={handleSaveChanges}
                  disabled={!vehicleId}
                  style={{ background: '#059669', borderColor: '#059669' }}
                >
                  💾 ذخیره تغییرات
                </button>
              ) : (
                <button 
                  className="primary" 
                  onClick={handleFinalSubmit}
                  disabled={!vehicleId || finalTrackingNo || isSubmitting}
                >
                  {finalTrackingNo ? 'ثبت شده' : isSubmitting ? 'در حال ثبت...' : 'ثبت نهایی'}
                </button>
              )
            )}
          </div>

          {doneMessage && <p className="message">{doneMessage}</p>}
        </div>
      </div>

      {/* Inline styles for demo purposes */}
      <style>{`
        .wiz-container { display: grid; gap: 16px; }

        /* Stepper (horizontal) */
        .wiz-stepper { display: flex; align-items: center; gap: 8px; overflow-x: auto; padding-bottom: 8px; }
        .wiz-step { display: flex; align-items: center; position: relative; }
        .wiz-circle { width: 32px; height: 32px; border-radius: 50%; display: grid; place-items: center; background: #e0e0e0; color: #333; font-weight: 600; }
        .wiz-step.active .wiz-circle { background: #1976d2; color: #fff; }
        .wiz-step.done .wiz-circle { background: #4caf50; color: #fff; }
        .wiz-title { margin: 0 8px; white-space: nowrap; font-size: 0.95rem; }
        .wiz-line { width: 32px; height: 2px; background: #ddd; margin: 0 8px; }

        /* Shared */
        .wiz-content { border: 1px solid #eee; border-radius: 8px; padding: 16px; background: #fff; }
        .form-grid { display: grid; gap: 6px; }
        .form-grid input { padding: 8px 10px; border: 1px solid #ddd; border-radius: 6px; }
        .error-text { color: #d32f2f; font-size: 0.85rem; }
        .wiz-actions { display: flex; justify-content: space-between; gap: 8px; margin-top: 12px; }
        .wiz-actions button { padding: 8px 12px; border-radius: 6px; border: 1px solid #ccc; background: #f5f5f5; cursor: pointer; }
        .wiz-actions .btn-prev { background:#e0e7ff; border-color:#c7d2fe; color:#1e3a8a; }
        .wiz-actions .btn-next { background:#dcfce7; border-color:#bbf7d0; color:#166534; }
        .wiz-actions .btn-cancel, .btn-cancel { background:#fee2e2; border-color:#fecaca; color:#7f1d1d; }
        .wiz-actions .primary { background: #1976d2; color: #fff; border-color: #1976d2; }
        .message { margin-top: 10px; color: #2e7d32; font-weight: 600; }

        /* Personal step grid: 3 pairs per row (label+field) */
        .person-step { display:grid; gap:12px; }
        .person-step .box { border:1px solid #e5e7eb; border-radius:8px; background:#fff; }
        .person-step .box-title { background:#78909c; color:#fff; padding:8px 12px; border-top-left-radius:8px; border-top-right-radius:8px; font-weight:600; }
        .person-step .form-grid { display:grid; grid-template-columns: repeat(12, minmax(0,1fr)); column-gap:16px; row-gap:10px; align-items:center; padding:12px; }
        .person-step .form-grid label { grid-column: span 1; justify-self:end; white-space:nowrap; font-weight:600; }
        .person-step .form-grid label + input,
        .person-step .form-grid label + select,
        .person-step .form-grid label + .rmdp-container { grid-column: span 3; }
        .person-step .jdate-input { width: 100% !important; padding: 12px 14px 12px 32px !important; border: 2px solid #cbd5e1 !important; border-radius: 6px !important; text-align:center !important; box-sizing: border-box !important; }
        .person-step .error-text { grid-column: 1 / -1; }

        /* Upload button, danger button, note line, and doc cards */
        .btn-upload { background:#0ea5e9; border:1px solid #38bdf8; color:#fff; padding:6px 10px; border-radius:6px; cursor:pointer; }
        .btn-upload:hover { background:#0284c7; }
        .btn-danger { background:#ef4444; border:1px solid #fca5a5; color:#fff; padding:6px 10px; border-radius:6px; cursor:pointer; }
        .btn-danger:hover { background:#dc2626; }
        .btn-primary { background:#10b981; border:1px solid #34d399; color:#fff; padding:6px 12px; border-radius:8px; cursor:pointer; }
        .btn-primary:hover { background:#059669; }
        .btn-secondary { background:#64748b; border:1px solid #94a3b8; color:#fff; padding:6px 12px; border-radius:8px; cursor:pointer; }
        .btn-secondary:hover { background:#475569; }
        .btn-cancel { background:#e5e7eb; border:1px solid #d1d5db; color:#111827; padding:6px 12px; border-radius:8px; cursor:pointer; }
        .btn-cancel:hover { background:#d1d5db; }
        .note-line { color:#475569; background:#f1f5f9; padding:6px 10px; border:1px dashed #cbd5e1; border-radius:6px; font-size:12px; }
        .doc-card { grid-column: span 4; border:1px solid #e5e7eb; border-radius:8px; padding:8px; display:flex; gap:10px; align-items:center; background:#fff; }
        .doc-thumb { width:56px; height:56px; object-fit:cover; border-radius:6px; border:1px solid #ddd; }
        .doc-meta { display:flex; flex-direction:column; gap:6px; flex:1; }
        .doc-row { display:flex; gap:6px; align-items:center; }
        .doc-label { color:#475569; font-size:13px; }
        .doc-value { font-weight:600; }

        /* Vehicle step grid: label + control on the same row */
        .vehicle-step { display:grid; grid-template-columns: repeat(8, minmax(0,1fr)); column-gap:16px; row-gap:10px; align-items:center; }
        .vehicle-step label { grid-column: span 2; justify-self:end; white-space:nowrap; font-weight:600; }
        .vehicle-step label + input,
        .vehicle-step label + select,
        .vehicle-step label + .rmdp-container,
        .vehicle-step label + .plate-wrapper { grid-column: span 2; }
        .vehicle-step .error-text { grid-column: 1 / -1; }
        .vehicle-step .section-title { grid-column: 1 / -1; margin: 8px 0; font-size: 1.05rem; background:#f0f4ff; border:1px solid #dbe7ff; border-radius:8px; padding:8px 12px; }
        .vehicle-step .section-sep { grid-column: 1 / -1; margin: 12px 0; opacity: .3; }
        /* Plate: keep on same row with Plate Type */
        .vehicle-step .label-plate { grid-column: span 1; }
        .vehicle-step .label-plate + .plate-wrapper { grid-column: span 3; }
        .vehicle-step .jdate-input { width: 100% !important; padding: 12px 14px 12px 32px !important; border: 2px solid #cbd5e1 !important; border-radius: 6px !important; text-align:center !important; box-sizing: border-box !important; }

        /* On large screens, allow three pairs per row */
        @media (min-width: 1200px) {
          .vehicle-step { grid-template-columns: repeat(12, minmax(0,1fr)); }
          .person-step .form-grid { grid-template-columns: repeat(12, minmax(0,1fr)); }
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
        }
        .plate-part.letter option {
          text-align: center;
          font-size: 18px;
          color: #000;
        }

        @media (max-width: 768px) {
          /* responsive tweaks if needed */
        }
      `}</style>
    </div>
  )
}
