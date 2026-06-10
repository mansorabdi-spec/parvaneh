import React, { useEffect, useMemo, useState } from 'react'
import { api } from '../lib/api.js'
import { initAuthFromStorage } from '../lib/api.js'

export default function ManageCompanies() {
  const [companies, setCompanies] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editingCompany, setEditingCompany] = useState(null)
  const [editingManager, setEditingManager] = useState(null)
  const [showAddCompany, setShowAddCompany] = useState(false)
  const [showAddManager, setShowAddManager] = useState(false)
  const [saving, setSaving] = useState(false)
  
  // Filters state
  const [filters, setFilters] = useState({
    companyName: '',
    managerName: '',
    nationalId: ''
  })
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const recordsPerPage = 30

  // Location data
  const [provinces, setProvinces] = useState([])
  const [citiesByProvince, setCitiesByProvince] = useState({})

  // Form states for new company
  const [newCompany, setNewCompany] = useState({
    nationalId: '',
    companyName: '',
    nationalCode: '',
    registrationNo: '',
    economicCode: ''
  })

  // Form states for new manager
  const [newManager, setNewManager] = useState({
    nationalId: '',
    managerNationalCode: '',
    firstName: '',
    lastName: '',
    fatherName: '',
    idSerial: '',
    birthProvinceId: '',
    birthCityId: '',
    birthDateJalali: '',
    gender: '',
    maritalStatus: ''
  })

  // Load provinces on component mount
  useEffect(() => {
    // Initialize auth from storage first
    const token = initAuthFromStorage()
    if (token) {
      loadProvinces()
    }
  }, [])

  // Load provinces from API
  const loadProvinces = async () => {
    try {
      console.log('Loading provinces...')
      const response = await api.get('/api/provinces')
      console.log('Provinces response:', response.data)
      // API returns data directly, not wrapped in success/data
      if (Array.isArray(response.data)) {
        setProvinces(response.data)
        console.log('Provinces loaded:', response.data.length)
      } else {
        console.error('Provinces API did not return an array:', response.data)
      }
    } catch (error) {
      console.error('Error loading provinces:', error)
      if (error.response?.status === 401) {
        console.error('Authentication error - token may be expired')
      }
    }
  }

  // Load cities when province changes
  const loadCities = async (provinceId) => {
    try {
      console.log('Loading cities for province:', provinceId)
      const response = await api.get(`/api/provinces/${provinceId}/cities`)
      console.log('Cities response:', response.data)
      // API returns data directly, not wrapped in success/data
      if (Array.isArray(response.data)) {
        setCitiesByProvince(prev => ({ ...prev, [provinceId]: response.data }))
        console.log('Cities loaded for province', provinceId, ':', response.data.length)
      } else {
        console.error('Cities API did not return an array:', response.data)
      }
    } catch (error) {
      console.error('Error loading cities:', error)
      if (error.response?.status === 401) {
        console.error('Authentication error - token may be expired')
      }
    }
  }

  const loadCompanies = async () => {
    setLoading(true)
    setError('')
    try {
      const response = await api.get('/api/company/all-with-managers')
      setCompanies(response.data.companies || [])
    } catch (e) {
      setError(e?.response?.data?.message || 'خطا در دریافت اطلاعات شرکت‌ها')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadCompanies() }, [])

  // Filter companies based on filter criteria
  const filteredCompanies = useMemo(() => {
    return companies.filter(company => {
      // Company name filter
      if (filters.companyName && !(company.CompanyName || '').toLowerCase().includes(filters.companyName.toLowerCase())) {
        return false
      }
      // Manager name filter
      if (filters.managerName) {
        const managerFullName = `${company.ManagerFirstName || ''} ${company.ManagerLastName || ''}`.trim()
        if (!managerFullName.toLowerCase().includes(filters.managerName.toLowerCase())) {
          return false
        }
      }
      // National ID filter
      if (filters.nationalId && !(company.NationalId || '').toLowerCase().includes(filters.nationalId.toLowerCase())) {
        return false
      }
      return true
    })
  }, [companies, filters])

  // Paginate filtered companies
  const paginatedCompanies = useMemo(() => {
    const startIndex = (currentPage - 1) * recordsPerPage
    const endIndex = startIndex + recordsPerPage
    return filteredCompanies.slice(startIndex, endIndex)
  }, [filteredCompanies, currentPage, recordsPerPage])

  // Calculate total pages
  const totalPages = Math.ceil(filteredCompanies.length / recordsPerPage)

  const handleSaveCompany = async (companyData) => {
    setSaving(true)
    try {
      await api.post('/api/company', companyData)
      await loadCompanies()
      setEditingCompany(null)
      setShowAddCompany(false)
      setNewCompany({
        nationalId: '',
        companyName: '',
        nationalCode: '',
        registrationNo: '',
        economicCode: ''
      })
    } catch (e) {
      setError(e?.response?.data?.message || 'خطا در ذخیره اطلاعات شرکت')
    } finally {
      setSaving(false)
    }
  }

  const handleSaveManager = async (managerData) => {
    setSaving(true)
    try {
      await api.post('/api/company/manager', managerData)
      await loadCompanies()
      setEditingManager(null)
      setShowAddManager(false)
      setNewManager({
        nationalId: '',
        managerNationalCode: '',
        firstName: '',
        lastName: '',
        fatherName: '',
        idSerial: '',
        birthProvinceId: null,
        birthCityId: null,
        birthDateJalali: '',
        gender: '',
        maritalStatus: ''
      })
    } catch (e) {
      setError(e?.response?.data?.message || 'خطا در ذخیره اطلاعات مدیرعامل')
    } finally {
      setSaving(false)
    }
  }

  const handleFilterChange = (field, value) => {
    setFilters(prev => ({ ...prev, [field]: value }))
    setCurrentPage(1) // Reset to first page when filtering
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-lg">در حال بارگذاری...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
        {error}
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6">مدیریت اطلاعات شرکت‌ها</h1>
      
      {/* Filters */}
      <div className="bg-white shadow rounded-lg p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              نام شرکت
            </label>
            <input
              type="text"
              value={filters.companyName}
              onChange={(e) => handleFilterChange('companyName', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="جستجو نام شرکت..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              نام مدیرعامل
            </label>
            <input
              type="text"
              value={filters.managerName}
              onChange={(e) => handleFilterChange('managerName', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="جستجو نام مدیرعامل..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              شناسه ملی
            </label>
            <input
              type="text"
              value={filters.nationalId}
              onChange={(e) => handleFilterChange('nationalId', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="جستجو شناسه ملی..."
            />
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-between items-center mb-4">
        <div className="text-sm text-gray-600">
          نمایش {paginatedCompanies.length} از {filteredCompanies.length} شرکت
        </div>
        <div className="space-x-2 space-x-reverse">
          <button
            onClick={() => setShowAddCompany(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
          >
            افزودن شرکت جدید
          </button>
        </div>
      </div>

      {/* Companies Table */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  شناسه ملی
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  نام شرکت
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  کد ملی صاحب شرکت
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  شماره ثبت
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  کد اقتصادی
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  مدیرعامل
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  کد ملی مدیرعامل
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  عملیات
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {paginatedCompanies.map((company) => (
                <tr key={company.NationalId} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {company.NationalId}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {company.CompanyName}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {company.NationalCode}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {company.RegistrationNo}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {company.EconomicCode}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {company.ManagerFirstName && company.ManagerLastName 
                      ? `${company.ManagerFirstName} ${company.ManagerLastName}`
                      : '-'
                    }
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {company.ManagerNationalCode || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex space-x-2 space-x-reverse">
                      <button
                        onClick={() => setEditingManager({
                          ...company,
                          nationalId: company.NationalId,
                          managerNationalCode: company.ManagerNationalCode || '',
                          firstName: company.ManagerFirstName || '',
                          lastName: company.ManagerLastName || '',
                          fatherName: company.ManagerFatherName || '',
                          idSerial: company.ManagerIdSerial || '',
                          birthProvinceId: company.ManagerBirthProvinceId || '',
                          birthCityId: company.ManagerBirthCityId || '',
                          birthDateJalali: company.ManagerBirthDateJalali || '',
                          gender: company.ManagerGender || '',
                          maritalStatus: company.ManagerMaritalStatus || ''
                        })}
                        className="text-green-600 hover:text-green-900"
                      >
                        {company.ManagerFirstName ? 'ویرایش مدیر' : 'افزودن مدیر'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200">
            <div className="flex-1 flex justify-between sm:hidden">
              <button
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
              >
                قبلی
              </button>
              <button
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
              >
                بعدی
              </button>
            </div>
            <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-gray-700">
                  صفحه <span className="font-medium">{currentPage}</span> از{' '}
                  <span className="font-medium">{totalPages}</span>
                </p>
              </div>
              <div>
                <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                    className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                  >
                    قبلی
                  </button>
                  {[...Array(totalPages)].map((_, i) => i + 1).map(page => (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                        currentPage === page
                          ? 'z-10 bg-blue-50 border-blue-500 text-blue-600'
                          : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                      }`}
                    >
                      {page}
                    </button>
                  ))}
                  <button
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages}
                    className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                  >
                    بعدی
                  </button>
                </nav>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Add Company Modal */}
      {showAddCompany && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <h3 className="text-lg font-bold text-gray-900 mb-4">افزودن شرکت جدید</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  شناسه ملی *
                </label>
                <input
                  type="text"
                  value={newCompany.nationalId}
                  onChange={(e) => setNewCompany(prev => ({ ...prev, nationalId: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  نام شرکت *
                </label>
                <input
                  type="text"
                  value={newCompany.companyName}
                  onChange={(e) => setNewCompany(prev => ({ ...prev, companyName: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  کد ملی صاحب شرکت *
                </label>
                <input
                  type="text"
                  value={newCompany.nationalCode}
                  onChange={(e) => setNewCompany(prev => ({ ...prev, nationalCode: e.target.value.replace(/[^0-9-]/g, '') }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  شماره ثبت *
                </label>
                <input
                  type="text"
                  value={newCompany.registrationNo}
                  onChange={(e) => setNewCompany(prev => ({ ...prev, registrationNo: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  کد اقتصادی
                </label>
                <input
                  type="text"
                  value={newCompany.economicCode}
                  onChange={(e) => setNewCompany(prev => ({ ...prev, economicCode: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end space-x-2 space-x-reverse">
              <button
                onClick={() => {
                  setShowAddCompany(false)
                  setNewCompany({
                    nationalId: '',
                    companyName: '',
                    nationalCode: '',
                    registrationNo: '',
                    economicCode: ''
                  })
                }}
                className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 transition-colors"
              >
                انصراف
              </button>
              <button
                onClick={() => handleSaveCompany(newCompany)}
                disabled={saving}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {saving ? 'در حال ذخیره...' : 'ذخیره'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Manager Modal */}
      {(editingManager || showAddManager) && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-10 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white max-h-screen overflow-y-auto">
            <h3 className="text-lg font-bold text-gray-900 mb-4">
              {editingManager ? 'ویرایش اطلاعات مدیرعامل' : 'افزودن مدیرعامل'}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  شناسه ملی شرکت
                </label>
                <input
                  type="text"
                  value={editingManager?.nationalId || newManager.nationalId}
                  disabled
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  کد ملی مدیرعامل *
                </label>
                <input
                  type="text"
                  value={editingManager?.managerNationalCode || newManager.managerNationalCode}
                  onChange={(e) => {
                    const value = e.target.value.replace(/[^0-9-]/g, '')
                    if (editingManager) {
                      setEditingManager(prev => ({ ...prev, managerNationalCode: value }))
                    } else {
                      setNewManager(prev => ({ ...prev, managerNationalCode: value }))
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="کد ملی"
                  maxLength={10}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  نام مدیرعامل *
                </label>
                <input
                  type="text"
                  value={editingManager?.firstName || newManager.firstName}
                  onChange={(e) => {
                    if (editingManager) {
                      setEditingManager(prev => ({ ...prev, firstName: e.target.value }))
                    } else {
                      setNewManager(prev => ({ ...prev, firstName: e.target.value }))
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="نام"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  نام خانوادگی مدیرعامل *
                </label>
                <input
                  type="text"
                  value={editingManager?.lastName || newManager.lastName}
                  onChange={(e) => {
                    if (editingManager) {
                      setEditingManager(prev => ({ ...prev, lastName: e.target.value }))
                    } else {
                      setNewManager(prev => ({ ...prev, lastName: e.target.value }))
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="نام خانوادگی"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  نام پدر
                </label>
                <input
                  type="text"
                  value={editingManager?.fatherName || newManager.fatherName}
                  onChange={(e) => {
                    if (editingManager) {
                      setEditingManager(prev => ({ ...prev, fatherName: e.target.value }))
                    } else {
                      setNewManager(prev => ({ ...prev, fatherName: e.target.value }))
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="نام پدر"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  شماره شناسنامه
                </label>
                <input
                  type="text"
                  value={editingManager?.idSerial || newManager.idSerial}
                  onChange={(e) => {
                    if (editingManager) {
                      setEditingManager(prev => ({ ...prev, idSerial: e.target.value }))
                    } else {
                      setNewManager(prev => ({ ...prev, idSerial: e.target.value }))
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="شماره شناسنامه"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  تاریخ تولد (شمسی)
                </label>
                <input
                  type="text"
                  value={editingManager?.birthDateJalali || newManager.birthDateJalali}
                  onChange={(e) => {
                    if (editingManager) {
                      setEditingManager(prev => ({ ...prev, birthDateJalali: e.target.value }))
                    } else {
                      setNewManager(prev => ({ ...prev, birthDateJalali: e.target.value }))
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="YYYY/MM/DD"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  استان محل تولد *
                </label>
                <select
                  value={editingManager?.birthProvinceId || newManager.birthProvinceId || ''}
                  onChange={async (e) => {
                    const value = e.target.value ? parseInt(e.target.value) : null
                    if (editingManager) {
                      setEditingManager(prev => ({ ...prev, birthProvinceId: value, birthCityId: '' }))
                    } else {
                      setNewManager(prev => ({ ...prev, birthProvinceId: value, birthCityId: '' }))
                    }
                    if (value) {
                      await loadCities(value)
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="">انتخاب کنید...</option>
                  {provinces && provinces.map(province => (
                    <option key={province.ID} value={province.ID}>
                      {province.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  شهرستان محل تولد *
                </label>
                <select
                  value={editingManager?.birthCityId || newManager.birthCityId || ''}
                  onChange={(e) => {
                    const value = e.target.value ? parseInt(e.target.value) : null
                    if (editingManager) {
                      setEditingManager(prev => ({ ...prev, birthCityId: value }))
                    } else {
                      setNewManager(prev => ({ ...prev, birthCityId: value }))
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                  disabled={!editingManager?.birthProvinceId && !newManager.birthProvinceId}
                >
                  <option value="">انتخاب کنید...</option>
                  {(citiesByProvince[editingManager?.birthProvinceId] || citiesByProvince[newManager.birthProvinceId] || []).map(city => (
                    <option key={city.ID} value={city.ID}>
                      {city.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  جنسیت *
                </label>
                <select
                  value={editingManager?.gender || newManager.gender}
                  onChange={(e) => {
                    if (editingManager) {
                      setEditingManager(prev => ({ ...prev, gender: e.target.value }))
                    } else {
                      setNewManager(prev => ({ ...prev, gender: e.target.value }))
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="">انتخاب کنید...</option>
                  <option value="مرد">مرد</option>
                  <option value="زن">زن</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  وضعیت تاهل
                </label>
                <select
                  value={editingManager?.maritalStatus || newManager.maritalStatus}
                  onChange={(e) => {
                    if (editingManager) {
                      setEditingManager(prev => ({ ...prev, maritalStatus: e.target.value }))
                    } else {
                      setNewManager(prev => ({ ...prev, maritalStatus: e.target.value }))
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">انتخاب کنید...</option>
                  <option value="مجرد">مجرد</option>
                  <option value="متاهل">متاهل</option>
                </select>
              </div>
            </div>
            <div className="mt-6 flex justify-end space-x-2 space-x-reverse">
              <button
                onClick={() => {
                  setEditingManager(null)
                  setShowAddManager(false)
                  setNewManager({
                    nationalId: '',
                    managerNationalCode: '',
                    firstName: '',
                    lastName: '',
                    fatherName: '',
                    idSerial: '',
                    birthProvinceId: null,
                    birthCityId: null,
                    birthDateJalali: '',
                    gender: '',
                    maritalStatus: ''
                  })
                }}
                className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 transition-colors"
              >
                انصراف
              </button>
              <button
                onClick={() => handleSaveManager(editingManager || newManager)}
                disabled={saving}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors disabled:opacity-50"
              >
                {saving ? 'در حال ذخیره...' : 'ذخیره'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
