import React, { useEffect, useState, useCallback } from 'react';
import { api } from '../lib/api.js';
import { format, parseISO } from 'date-fns';
import { faCar, faPlus, faTrash, faEdit, faArrowRight, faTimes, faSpinner, faSearch } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// Helper function to format dates
const formatDate = (dateString) => {
  if (!dateString) return 'N/A';
  try {
    return format(parseISO(dateString), 'yyyy/MM/dd - HH:mm');
  } catch (e) {
    return dateString;
  }
};

export default function AdminSystemTypes() {
  const [systems, setSystems] = useState([]);
  const [filteredSystems, setFilteredSystems] = useState([]);
  const [vehicleTypes, setVehicleTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingVehicleTypes, setLoadingVehicleTypes] = useState(true);
  const [tipsLoading, setTipsLoading] = useState(false);
  const [showTipsFor, setShowTipsFor] = useState(null); // { id, name, vehicleTypeName, VehicleTypeID }
  const [tips, setTips] = useState([]);
  const [tipFormOpen, setTipFormOpen] = useState(false);
  const [tipFormName, setTipFormName] = useState('');
  const [tipFormError, setTipFormError] = useState('');
  const [sysFormOpen, setSysFormOpen] = useState(false);
  const [sysFormError, setSysFormError] = useState('');
  const [sysFormData, setSysFormData] = useState({
    id: null,
    systemname: '',
    VehicleTypeID: '',
    isEditing: false
  });
  // Vehicle Type form state
  const [vtFormOpen, setVtFormOpen] = useState(false);
  const [vtFormError, setVtFormError] = useState('');
  const [vtFormData, setVtFormData] = useState({
    id: null,
    vehicleTypeName: '',
    isEditing: false
  });
  const [selectedVehicleType, setSelectedVehicleType] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  const loadVehicleTypes = useCallback(async () => {
    try {
      setLoadingVehicleTypes(true);
      const { data } = await api.get('/api/vehicletypes');
      setVehicleTypes(data || []);
      
      // If no vehicle types exist, show a message
      if (!data || data.length === 0) {
        toast.info('هیچ نوع وسیله نقلیه‌ای یافت نشد. لطفاً ابتدا یک نوع وسیله نقلیه اضافه کنید.');
      }
    } catch (error) {
      console.error('Error loading vehicle types:', error);
      const errorMessage = error.response?.data?.message || 'خطا در بارگذاری انواع وسیله نقلیه';
      toast.error(errorMessage);
    } finally {
      setLoadingVehicleTypes(false);
    }
  }, []);

  const loadSystems = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await api.get('/api/vehicletypes/systems/all');
      setSystems(data || []);
      setFilteredSystems(data || []);
    } catch (error) {
      console.error('Error loading systems:', error);
      const errorMessage = error.response?.data?.message || 'خطا در بارگذاری سیستم‌ها';
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, []);

  // Vehicle Type Handlers
  const handleAddVehicleType = () => {
    setVtFormData({ id: null, vehicleTypeName: '', isEditing: false });
    setVtFormError('');
    setVtFormOpen(true);
  };

  const handleEditVehicleType = (vt) => {
    setVtFormData({ id: vt.ID, vehicleTypeName: vt.VehicleTypeName || '', isEditing: true });
    setVtFormError('');
    setVtFormOpen(true);
  };

  const handleSubmitVehicleType = async (e) => {
    e.preventDefault();
    setVtFormError('');
    const name = (vtFormData.vehicleTypeName || '').trim();
    if (!name) {
      setVtFormError('نام نوع وسیله نقلیه الزامی است');
      return;
    }
    try {
      if (vtFormData.isEditing && vtFormData.id) {
        const { data } = await api.put(`/api/vehicletypes/${vtFormData.id}`, { vehicleTypeName: name });
        toast.success(`نوع وسیله نقلیه به‌روزرسانی شد`);
      } else {
        const { data } = await api.post('/api/vehicletypes', { vehicleTypeName: name });
        toast.success('نوع وسیله نقلیه جدید ثبت شد');
      }
      setVtFormOpen(false);
      // reload lists
      await Promise.all([loadVehicleTypes(), loadSystems()]);
    } catch (error) {
      console.error('Error saving vehicle type:', error);
      const errorMessage = error.response?.data?.message || 'خطا در ذخیره نوع وسیله نقلیه';
      setVtFormError(errorMessage);
      toast.error(errorMessage);
    }
  };

  const handleDeleteVehicleType = async (vt) => {
    if (!vt?.ID) return;
    const confirmed = window.confirm(`حذف نوع وسیله نقلیه «${vt.VehicleTypeName}»؟ این عمل قابل بازگشت نیست.`);
    if (!confirmed) return;
    try {
      await api.delete(`/api/vehicletypes/${vt.ID}`);
      toast.success('نوع وسیله نقلیه حذف شد');
      await Promise.all([loadVehicleTypes(), loadSystems()]);
      if (selectedVehicleType !== 'all' && parseInt(selectedVehicleType) === vt.ID) {
        setSelectedVehicleType('all');
      }
    } catch (error) {
      console.error('Error deleting vehicle type:', error);
      const errorMessage = error.response?.data?.message || 'خطا در حذف نوع وسیله نقلیه';
      toast.error(errorMessage);
    }
  };

  // Filter systems based on search term and selected vehicle type
  useEffect(() => {
    let result = [...systems];
    
    // Filter by vehicle type
    if (selectedVehicleType !== 'all') {
      result = result.filter(system => system.VehicleTypeID === parseInt(selectedVehicleType));
    }
    
    // Filter by search term
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(system => 
        system.systemname.toLowerCase().includes(term) ||
        (system.VehicleTypeName && system.VehicleTypeName.toLowerCase().includes(term))
      );
    }
    
    setFilteredSystems(result);
  }, [systems, selectedVehicleType, searchTerm]);

  const loadTips = async (systemId) => {
    if (!systemId) return;
    
    try {
      setTipsLoading(true);
      const { data } = await api.get(`/api/systemtypes/${systemId}/tips`);
      // Backend returns an array (recordset). Fallback to data.tips if shaped that way.
      setTips(Array.isArray(data) ? data : (data?.tips || []));
    } catch (error) {
      console.error('Error loading tips:', error);
      const errorMessage = error.response?.data?.message || 'خطا در بارگذاری تیپ‌ها';
      toast.error(errorMessage);
      setTips([]);
    } finally {
      setTipsLoading(false);
    }
  };

  const closeTips = () => { 
    setShowTipsFor(null); 
    setTips([]); 
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        await Promise.all([loadVehicleTypes(), loadSystems()]);
      } catch (error) {
        console.error('Error loading initial data:', error);
      }
    };
    
    fetchData();
  }, [loadVehicleTypes, loadSystems]);
  
  useEffect(() => {
    if (showTipsFor?.id) {
      loadTips(showTipsFor.id);
    } else {
      setTips([]);
    }
  }, [showTipsFor]);

  const addSystem = async () => {
    setSysFormData({ systemname: '', vehicleTypeId: '' });
    setSysFormOpen(true);
  };

  const handleSysFormChange = (e) => {
    const { name, value } = e.target;
    setSysFormData(prev => ({
      ...prev,
      [name]: name === 'vehicleTypeId' ? parseInt(value) : value
    }));
  };

  const handleSubmitSystem = async (e) => {
    e.preventDefault();
    setSysFormError('');
    
    // Validate form
    if (sysFormData.systemname.trim() === '') {
      setSysFormError('نام سیستم الزامی است');
      return;
    }
    
    if (!sysFormData.VehicleTypeID) {
      setSysFormError('انتخاب نوع وسیله نقلیه الزامی است');
      return;
    }
    
    try {
      const systemData = {
        systemname: sysFormData.systemname.trim(),
        VehicleTypeID: parseInt(sysFormData.VehicleTypeID)
      };
      
      if (sysFormData.isEditing && sysFormData.id) {
        // Update existing system
        await api.put(`/api/systemtypes/${sysFormData.id}`, systemData);
        toast.success('سیستم با موفقیت به‌روزرسانی شد');
      } else {
        // Create new system
        await api.post('/api/systemtypes', systemData);
        toast.success('سیستم جدید با موفقیت ایجاد شد');
      }
      
      // Reset form and refresh data
      setSysFormOpen(false);
      setSysFormData({ id: null, systemname: '', VehicleTypeID: '', isEditing: false });
      loadSystems();
    } catch (error) {
      console.error('Error saving system:', error);
      const errorMessage = error.response?.data?.message || 'خطا در ذخیره سیستم';
      setSysFormError(errorMessage);
      toast.error(errorMessage);
    }
  };
  
  const handleEditSystem = (system) => {
    setSysFormData({
      id: system.ID,
      systemname: system.systemname,
      VehicleTypeID: system.VehicleTypeID,
      isEditing: true
    });
    setSysFormOpen(true);
  };
  
  const handleAddSystem = () => {
    if (vehicleTypes.length === 0) {
      toast.warning('لطفاً ابتدا حداقل یک نوع وسیله نقلیه اضافه کنید');
      return;
    }
    
    setSysFormData({
      id: null,
      systemname: '',
      VehicleTypeID: vehicleTypes[0]?.ID || '',
      isEditing: false
    });
    setSysFormOpen(true);
  };

  const handleDeleteSystem = async (id, systemName) => {
    if (!window.confirm(`آیا از حذف سیستم "${systemName}" اطمینان دارید؟ این عمل برگشت‌پذیر نیست.`)) {
      return;
    }
    
    try {
      await api.delete(`/api/systemtypes/${id}`);
      toast.success(`سیستم "${systemName}" با موفقیت حذف شد`);
      loadSystems();
      
      // If we're viewing tips for this system, close the tips view
      if (showTipsFor?.id === id) {
        setShowTipsFor(null);
      }
    } catch (error) {
      console.error('Error deleting system:', error);
      const errorMessage = error.response?.data?.message || 'خطا در حذف سیستم';
      toast.error(errorMessage);
    }
  };

  const addTip = async () => {
    if (!showTipsFor?.id) return;
    setTipFormName('');
    setTipFormOpen(true);
  };

  const handleSubmitTip = async (e) => {
    e.preventDefault();
    setTipFormError('');
    
    if (!showTipsFor) return;
    
    // Validate form
    if (tipFormName.trim() === '') {
      setTipFormError('نام تیپ الزامی است');
      return;
    }
    
    try {
      await api.post(`/api/systemtypes/${showTipsFor.id}/tips`, {
        tipname: tipFormName.trim()
      });
      
      setTipFormName('');
      setTipFormOpen(false);
      toast.success('تیپ جدید با موفقیت اضافه شد');
      loadTips(showTipsFor.id);
    } catch (error) {
      console.error('Error saving tip:', error);
      const errorMessage = error.response?.data?.message || 'خطا در ذخیره تیپ';
      setTipFormError(errorMessage);
      toast.error(errorMessage);
    }
  };

  const renameTip = async (id, current) => {
    const name = prompt('نام جدید تیپ', current || '');
    if (!name || !name.trim()) return;
    
    try {
      await api.put(`/api/systemtypes/tips/${id}`, { 
        tipname: name.trim()
      });
      loadTips(showTipsFor.id);
    } catch (error) {
      console.error('Error updating tip:', error);
      const errorMessage = error.response?.data?.message || 'خطا در به‌روزرسانی تیپ';
      toast.error(errorMessage);
    }
  };

  const deleteTip = async (id) => {
    if (!confirm('حذف شود؟')) return;
    
    try {
      await api.delete(`/api/systemtypes/tips/${id}`);
      setTips(tips.filter(tip => tip.ID !== id));
      toast.success('تیپ با موفقیت حذف شد');
    } catch (error) {
      console.error('Error deleting tip:', error);
      const errorMessage = error.response?.data?.message || 'خطا در حذف تیپ';
      toast.error(errorMessage);
    }
  };

  // System Form Modal
  const SystemFormModal = () => (
    <div className={`fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 transition-opacity ${sysFormOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
      <div className={`bg-white rounded-lg w-full max-w-md transform transition-transform ${sysFormOpen ? 'scale-100' : 'scale-95'}`}>
        <div className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">
              {sysFormData.isEditing ? 'ویرایش سیستم' : 'افزودن سیستم جدید'}
            </h3>
            <button 
              onClick={() => setSysFormOpen(false)}
              className="text-gray-500 hover:text-gray-700"
            >
              <FontAwesomeIcon icon={faTimes} />
            </button>
          </div>
          
          {sysFormError && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
              {sysFormError}
            </div>
          )}
          
          <form onSubmit={handleSubmitSystem}>
            <div className="mb-4">
              <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="systemname">
                نام سیستم <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="systemname"
                name="systemname"
                value={sysFormData.systemname}
                onChange={handleSysFormChange}
                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                placeholder="نام سیستم را وارد کنید"
                required
              />
            </div>
            
            <div className="mb-4">
              <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="VehicleTypeID">
                نوع وسیله نقلیه <span className="text-red-500">*</span>
              </label>
              <select
                id="VehicleTypeID"
                name="VehicleTypeID"
                value={sysFormData.VehicleTypeID || ''}
                onChange={handleSysFormChange}
                className="shadow border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                required
                disabled={sysFormData.isEditing}
              >
                <option value="">انتخاب کنید</option>
                {vehicleTypes.map((type) => (
                  <option key={type.ID} value={type.ID}>
                    {type.VehicleTypeName}
                  </option>
                ))}
              </select>
            </div>
            
            <div className="flex justify-end space-x-2 pt-4">
              <button
                type="button"
                onClick={() => setSysFormOpen(false)}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
              >
                انصراف
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <FontAwesomeIcon icon={faSpinner} spin className="ml-2" />
                    در حال ذخیره...
                  </>
                ) : sysFormData.isEditing ? 'بروزرسانی' : 'ذخیره'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );

  // Tip Form Modal
  const TipFormModal = () => (
    <div className={`fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 transition-opacity ${tipFormOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
      <div className={`bg-white rounded-lg w-full max-w-md transform transition-transform ${tipFormOpen ? 'scale-100' : 'scale-95'}`}>
        <div className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">
              {tipFormData?.isEditing ? 'ویرایش تیپ' : 'افزودن تیپ جدید'}
            </h3>
            <button 
              onClick={() => setTipFormOpen(false)}
              className="text-gray-500 hover:text-gray-700"
            >
              <FontAwesomeIcon icon={faTimes} />
            </button>
          </div>
          
          {tipFormError && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
              {tipFormError}
            </div>
          )}
          
          <form onSubmit={handleSubmitTip}>
            <div className="mb-4">
              <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="tiptypename">
                نام تیپ <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="tiptypename"
                name="tiptypename"
                value={tipFormData?.tiptypename || ''}
                onChange={(e) => setTipFormData({...tipFormData, tiptypename: e.target.value})}
                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                placeholder="نام تیپ را وارد کنید"
                required
              />
            </div>
            
            <div className="flex justify-end space-x-2 pt-4">
              <button
                type="button"
                onClick={() => setTipFormOpen(false)}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
              >
                انصراف
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <FontAwesomeIcon icon={faSpinner} spin className="ml-2" />
                    در حال ذخیره...
                  </>
                ) : (tipFormData?.isEditing ? 'بروزرسانی' : 'ذخیره')}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );

  return (
    <div className="p-4 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">مدیریت سیستم‌ها و تیپ‌های ناوگان</h1>
          <p className="text-gray-600 text-sm mt-1">
            مدیریت انواع سیستم‌ها و تیپ‌های وسیله نقلیه
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="relative">
            <select
              value={selectedVehicleType}
              onChange={(e) => setSelectedVehicleType(e.target.value)}
              className="border rounded p-2 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={loadingVehicleTypes}
            >
              <option value="all">همه انواع وسایل نقلیه</option>
              {vehicleTypes.map((type) => (
                <option key={type.ID} value={type.ID}>
                  {type.VehicleTypeName} ({type.SystemCount || 0})
                </option>
              ))}
            </select>
            {loadingVehicleTypes && (
              <FontAwesomeIcon 
                icon={faSpinner} 
                spin 
                className="absolute left-3 top-3 text-gray-400"
              />
            )}
          </div>
          
          <div className="relative flex-1 min-w-[200px]">
            <input
              type="text"
              placeholder="جستجوی سیستم..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full border rounded p-2 pr-10 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {searchTerm ? (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute left-2 top-2.5 text-gray-400 hover:text-gray-600"
              >
                <FontAwesomeIcon icon={faTimes} />
              </button>
            ) : (
              <div className="absolute left-3 top-3 text-gray-400">
                <FontAwesomeIcon icon={faSearch} />
              </div>
            )}
          </div>
          
          <button
            onClick={handleAddSystem}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 flex items-center whitespace-nowrap"
            disabled={loadingVehicleTypes || vehicleTypes.length === 0}
          >
            {loadingVehicleTypes ? (
              <>
                <FontAwesomeIcon icon={faSpinner} spin className="ml-2" />
                در حال بارگذاری...
              </>
            ) : (
              <>
                <FontAwesomeIcon icon={faPlus} className="ml-2" />
                افزودن سیستم جدید
              </>
            )}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Vehicle Types */}
        <div className="bg-white rounded-lg shadow p-4">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <FontAwesomeIcon icon={faCar} />
            انواع وسایل نقلیه
          </h2>
          <div className="flex justify-end mb-3">
            <button
              onClick={handleAddVehicleType}
              className="bg-blue-100 text-blue-700 px-3 py-1 rounded hover:bg-blue-200 text-sm flex items-center gap-1"
              disabled={loadingVehicleTypes}
            >
              <FontAwesomeIcon icon={faPlus} size="sm" />
              افزودن نوع جدید
            </button>
          </div>
          {loadingVehicleTypes ? (
            <div className="text-center py-4">در حال بارگذاری...</div>
          ) : vehicleTypes.length === 0 ? (
            <div className="text-gray-500 text-center py-4">هیچ نوع وسیله نقلیه‌ای یافت نشد</div>
          ) : (
            <div className="space-y-2">
              {vehicleTypes.map((vt) => (
                <div 
                  key={vt.ID}
                  className="p-3 rounded bg-gray-50 border border-gray-200 hover:bg-gray-100"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <button
                        className="font-medium text-right hover:text-blue-600"
                        onClick={() => setSelectedVehicleType(String(vt.ID))}
                        title="نمایش سیستم‌های این نوع"
                      >
                        {vt.VehicleTypeName}
                      </button>
                      <div className="text-sm text-gray-500">ID: {vt.ID} • سیستم‌ها: {vt.SystemCount || 0}</div>
                    </div>
                    <div className="flex items-center gap-2 mr-2">
                      <button
                        onClick={() => handleEditVehicleType(vt)}
                        className="text-yellow-600 hover:text-yellow-800 p-1"
                        title="ویرایش نوع"
                      >
                        <FontAwesomeIcon icon={faEdit} />
                      </button>
                      <button
                        onClick={() => handleDeleteVehicleType(vt)}
                        className="text-red-600 hover:text-red-800 p-1"
                        title="حذف نوع"
                      >
                        <FontAwesomeIcon icon={faTrash} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Systems List */}
        <div className="bg-white rounded-lg shadow p-4">
          <h2 className="text-xl font-semibold mb-4">لیست سیستم‌ها</h2>
          {loading ? (
            <div className="text-center py-4">در حال بارگذاری...</div>
          ) : systems.length === 0 ? (
            <div className="text-gray-500 text-center py-4">هیچ سیستمی یافت نشد</div>
          ) : (
            <div className="space-y-2 max-h-[600px] overflow-y-auto pr-2">
              {filteredSystems.map(system => (
                <div 
                  key={system.ID} 
                  className={`flex flex-col p-3 rounded border ${showTipsFor?.id === system.ID ? 'border-blue-300 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'}`}
                >
                  <div className="flex justify-between items-center">
                    <button 
                      onClick={() => setShowTipsFor({
                        id: system.ID,
                        name: system.systemname,
                        VehicleTypeID: system.VehicleTypeID,
                        VehicleTypeName: system.VehicleTypeName
                      })}
                      className="flex-1 text-right hover:text-blue-600 font-medium"
                    >
                      {system.systemname}
                    </button>
                    <div className="flex space-x-2 mr-2">
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleEditSystem(system); }}
                        className="text-yellow-600 hover:text-yellow-800 p-1"
                        title="ویرایش"
                      >
                        <FontAwesomeIcon icon={faEdit} />
                      </button>
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleDeleteSystem(system.ID, system.systemname); }}
                        className="text-red-600 hover:text-red-800 p-1"
                        title="حذف"
                      >
                        <FontAwesomeIcon icon={faTrash} />
                      </button>
                    </div>
                  </div>
                  <div className="mt-1 text-sm text-gray-500 flex justify-between items-center">
                    <span>نوع: {system.VehicleTypeName || 'نامشخص'}</span>
                    <span className="text-xs">
                      {system.UpdatedAt 
                        ? `آخرین تغییر: ${format(new Date(system.UpdatedAt), 'yyyy/MM/dd HH:mm')}` 
                        : system.CreatedAt 
                          ? `ایجاد شده در: ${format(new Date(system.CreatedAt), 'yyyy/MM/dd')}`
                          : ''}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Tips List */}
        <div className="bg-white rounded-lg shadow p-4">
          {!showTipsFor ? (
            <div className="text-gray-500 text-center py-8">
              <FontAwesomeIcon icon={faArrowRight} className="text-2xl mb-2 text-gray-300" />
              <p>یک سیستم را برای مشاهده تیپ‌های آن انتخاب کنید</p>
            </div>
          ) : (
            <>
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h2 className="text-xl font-semibold">
                    تیپ‌های سیستم: {showTipsFor.name}
                  </h2>
                  {showTipsFor.vehicleTypeName && (
                    <p className="text-sm text-gray-500">نوع وسیله: {showTipsFor.vehicleTypeName}</p>
                  )}
                </div>
                <div className="flex space-x-2">
                  <button 
                    onClick={addTip}
                    className="bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded text-sm flex items-center gap-1"
                  >
                    <FontAwesomeIcon icon={faPlus} size="xs" />
                    افزودن تیپ
                  </button>
                  <button 
                    onClick={closeTips}
                    className="bg-gray-200 hover:bg-gray-300 px-3 py-1 rounded text-sm flex items-center gap-1"
                  >
                    <FontAwesomeIcon icon={faTimes} size="xs" />
                    بستن
                  </button>
                </div>
              </div>
              
              {tipsLoading ? (
                <div className="text-center py-4">در حال بارگذاری تیپ‌ها...</div>
              ) : tips.length === 0 ? (
                <div className="text-gray-500 text-center py-4">هیچ تیپی یافت نشد</div>
              ) : (
                <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2">
                  {tips.map(tip => (
                    <div key={tip.ID} className="flex flex-col p-3 rounded border border-gray-200 hover:bg-gray-50">
                      <div className="flex justify-between items-center">
                        <span className="font-medium">{tip.tipname}</span>
                        <div className="flex space-x-2">
                          <button 
                            onClick={() => renameTip(tip.ID, tip.tipname)}
                            className="text-yellow-600 hover:text-yellow-800 p-1"
                            title="ویرایش"
                          >
                            <FontAwesomeIcon icon={faEdit} size="sm" />
                          </button>
                          <button 
                            onClick={() => deleteTip(tip.ID)}
                            className="text-red-600 hover:text-red-800 p-1"
                            title="حذف"
                          >
                            <FontAwesomeIcon icon={faTrash} size="sm" />
                          </button>
                        </div>
                      </div>
                      {tip.UpdatedAt && (
                        <div className="mt-1 text-xs text-gray-500 text-left">
                          آخرین تغییر: {format(new Date(tip.UpdatedAt), 'yyyy/MM/dd HH:mm')}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
            
      {/* System Form Modal */}
      {sysFormOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">
                {sysFormData.isEditing ? 'ویرایش سیستم' : 'افزودن سیستم جدید'}
              </h3>
              <button 
                onClick={() => setSysFormOpen(false)}
                className="text-gray-500 hover:text-gray-700"
                disabled={loading}
              >
                <FontAwesomeIcon icon={faTimes} />
              </button>
            </div>
            
            <form onSubmit={handleSubmitSystem}>
              <div className="mb-4">
                <label className="block text-gray-700 mb-2">
                  نام سیستم <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={sysFormData.systemname}
                  onChange={(e) => setSysFormData({ ...sysFormData, systemname: e.target.value })}
                  className="w-full border rounded p-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="مثال: سمند"
                  disabled={loading}
                  required
                />
              </div>
              
              <div className="mb-4">
                <label className="block text-gray-700 mb-2">
                  نوع وسیله نقلیه <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <select
                    value={sysFormData.VehicleTypeID}
                    onChange={(e) => setSysFormData({ ...sysFormData, VehicleTypeID: e.target.value })}
                    className="w-full border rounded p-2 pr-3 appearance-none bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    disabled={loading || loadingVehicleTypes}
                    required
                  >
                    <option value="">انتخاب کنید</option>
                    {vehicleTypes.map(type => (
                      <option key={type.ID} value={type.ID}>
                        {type.VehicleTypeName}
                      </option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center px-2 text-gray-700">
                    <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                      <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/>
                    </svg>
                  </div>
                </div>
                {loadingVehicleTypes && (
                  <p className="text-sm text-gray-500 mt-1">
                    <FontAwesomeIcon icon={faSpinner} spin className="ml-1" />
                    در حال بارگذاری انواع وسیله نقلیه...
                  </p>
                )}
              </div>
              
              {sysFormError && (
                <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
                  {sysFormError}
                </div>
              )}
              
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSysFormOpen(false)}
                  className="px-4 py-2 border border-gray-300 rounded text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  disabled={loading}
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 border border-transparent rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                  disabled={loading || loadingVehicleTypes}
                >
                  {loading ? (
                    <>
                      <FontAwesomeIcon icon={faSpinner} spin className="ml-1" />
                      در حال ذخیره...
                    </>
                  ) : sysFormData.isEditing ? (
                    'به‌روزرسانی سیستم'
                  ) : (
                    'ذخیره سیستم جدید'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Tip Modal */}
      {tipFormOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">افزودن تیپ جدید</h3>
            <form onSubmit={handleSubmitTip}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  نام تیپ <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={tipFormName}
                  onChange={(e) => setTipFormName(e.target.value)}
                  placeholder="نام تیپ"
                  className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  autoFocus
                  required
                />
              </div>
              
              <div className="flex justify-end space-x-2">
                <button 
                  type="button"
                  onClick={() => setTipFormOpen(false)}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
                  disabled={loading}
                >
                  انصراف
                </button>
                <button 
                  type="submit"
                  className="px-4 py-2 border border-transparent rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
                  disabled={!tipFormName.trim() || loading}
                >
                  {loading ? (
                    <>
                      <FontAwesomeIcon icon={faSpinner} spin className="ml-1" />
                      در حال ذخیره...
                    </>
                  ) : (
                    'ذخیره تیپ جدید'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Vehicle Type Form Modal */}
      {vtFormOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">
                {vtFormData.isEditing ? 'ویرایش نوع وسیله نقلیه' : 'افزودن نوع وسیله نقلیه'}
              </h3>
              <button 
                onClick={() => setVtFormOpen(false)}
                className="text-gray-500 hover:text-gray-700"
                disabled={loadingVehicleTypes}
              >
                <FontAwesomeIcon icon={faTimes} />
              </button>
            </div>
            <form onSubmit={handleSubmitVehicleType}>
              <div className="mb-4">
                <label className="block text-gray-700 mb-2">
                  نام نوع وسیله نقلیه <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={vtFormData.vehicleTypeName}
                  onChange={(e) => setVtFormData({ ...vtFormData, vehicleTypeName: e.target.value })}
                  className="w-full border rounded p-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="مثال: سواری، کامیون، موتورسیکلت"
                  disabled={loadingVehicleTypes}
                  required
                />
              </div>
              {vtFormError && (
                <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
                  {vtFormError}
                </div>
              )}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setVtFormOpen(false)}
                  className="px-4 py-2 border border-gray-300 rounded text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  disabled={loadingVehicleTypes}
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 border border-transparent rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                  disabled={loadingVehicleTypes}
                >
                  {loadingVehicleTypes ? (
                    <>
                      <FontAwesomeIcon icon={faSpinner} spin className="ml-1" />
                      در حال ذخیره...
                    </>
                  ) : vtFormData.isEditing ? (
                    'به‌روزرسانی نوع'
                  ) : (
                    'ذخیره نوع جدید'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
