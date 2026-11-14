import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { isAdminRoleName, viewerIsSuperAdminOnly } from '../lib/roleVisibility.js';
import DateObject from 'react-date-object';
import persian from 'react-date-object/calendars/persian';

const toJalali = (dateStr) => {
  if (!dateStr) return '-';
  try {
    const d = new DateObject(new Date(dateStr));
    d.convert(persian);
    return d.format('YYYY/MM/DD');
  } catch {
    return '-';
  }
};

const normalizeNumberLike = (value) => {
  if (value === null || value === undefined || value === '') return null;

  const digits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  const normalized = String(value)
    .replace(/,/g, '')
    .replace(/[۰-۹]/g, char => digits.indexOf(char))
    .replace(/[٠-٩]/g, char => '٠١٢٣٤٥٦٧٨٩'.indexOf(char));

  const number = Number(normalized);
  return Number.isNaN(number) ? null : number;
};

const formatAmount = (value) => {
  const number = normalizeNumberLike(value);
  return number === null ? '-' : number.toLocaleString('fa-IR');
};

function getIsAdmin() {
  try {
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    if (!token) return false;
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return (payload.role || payload.Role) === 'Admin';
  } catch {
    return false;
  }
}

function AdminLicenseHistory() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [editModal, setEditModal] = useState(null);
  const [editAmount, setEditAmount] = useState('');
  const [editSaving, setEditSaving] = useState(false);
  const isAdmin = getIsAdmin();
  const [history, setHistory] = useState([]);
  const [statistics, setStatistics] = useState(null);
  const [dbError, setDbError] = useState(false);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0
  });

  const [filters, setFilters] = useState({
    eventType: '',
    status: '',
    licenseTypeId: '',
    fromold: '',
    fuelTypeId: '',
    tonnageRateId: '',
    fromDate: '',
    toDate: ''
  });

  const [licenseTypes, setLicenseTypes] = useState([]);
  const [fuelTypes, setFuelTypes] = useState([]);
  const [tonnageRates, setTonnageRates] = useState([]);

  useEffect(() => {
    loadLicenseTypes();
    loadFuelTypes();
    loadTonnageRates();
    loadStatistics();
  }, []);

  useEffect(() => {
    loadHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagination.page, filters.eventType, filters.status, filters.licenseTypeId, filters.fromold, filters.fuelTypeId, filters.tonnageRateId, filters.fromDate, filters.toDate]);

  const loadLicenseTypes = async () => {
    try {
      const response = await api.get('/api/lookups/values?categoryKey=LicenseType');
      setLicenseTypes(response.data || []);
    } catch (error) {
      console.error('Error loading license types:', error);
      setLicenseTypes([]);
    }
  };

  const loadFuelTypes = async () => {
    try {
      const response = await api.get('/api/lookups/values?categoryKey=FuelType');
      setFuelTypes(response.data || []);
    } catch (error) {
      console.error('Error loading fuel types:', error);
      setFuelTypes([]);
    }
  };

  const loadTonnageRates = async () => {
    try {
      const response = await api.get('/api/lookups/values?categoryKey=TonnageRate');
      setTonnageRates(response.data || []);
    } catch (error) {
      console.error('Error loading tonnage rates:', error);
      setTonnageRates([]);
    }
  };

  const loadStatistics = async () => {
    try {
      const response = await api.get('/api/license-history/statistics');
      if (response.data.success) {
        setStatistics(response.data);
        setDbError(false);
      }
    } catch (error) {
      console.error('Error loading statistics:', error);
      // Check if it's a database error
      if (error.response?.status === 500 || error.response?.data?.message?.includes('Invalid object name')) {
        setDbError(true);
      }
      // Set empty statistics to prevent page from breaking
      setStatistics({
        statistics: {
          TotalRecords: 0,
          TotalIssued: 0,
          TotalRenewed: 0,
          TotalActive: 0
        },
        byLicenseType: []
      });
    }
  };

  const loadHistory = async () => {
    try {
      setLoading(true);
      const params = {
        page: pagination.page,
        limit: pagination.limit,
        ...filters
      };

      Object.keys(params).forEach(key => {
        if (params[key] === '' || params[key] === null) {
          delete params[key];
        }
      });

      const response = await api.get('/api/license-history/all', { params });
      
      if (response.data.success) {
        setHistory(response.data.data);
        setPagination(prev => ({
          ...prev,
          total: response.data.pagination.total,
          totalPages: response.data.pagination.totalPages
        }));
      }
    } catch (error) {
      console.error('Error loading license history:', error);
      // Don't show alert on initial load, just set empty data
      setHistory([]);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({
      ...prev,
      [name]: value
    }));
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const handleClearFilters = () => {
    setFilters({
      eventType: '',
      status: '',
      licenseTypeId: '',
      fromold: '',
      fuelTypeId: '',
      tonnageRateId: '',
      fromDate: '',
      toDate: ''
    });
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const handlePageChange = (newPage) => {
    setPagination(prev => ({ ...prev, page: newPage }));
  };

  const getEventTypeBadge = (eventType) => {
    const badges = {
      'Issued': { text: 'صادر شده', color: 'bg-green-100 text-green-800' },
      'Renewed': { text: 'تمدید شده', color: 'bg-blue-100 text-blue-800' },
      'Revoked': { text: 'ابطال شده', color: 'bg-red-100 text-red-800' },
      'Cancelled': { text: 'لغو شده', color: 'bg-gray-100 text-gray-800' }
    };
    const badge = badges[eventType] || { text: eventType, color: 'bg-gray-100 text-gray-800' };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${badge.color}`}>
        {badge.text}
      </span>
    );
  };

  const getStatusBadge = (status) => {
    const badges = {
      'Active': { text: 'فعال', color: 'bg-green-100 text-green-800' },
      'Expired': { text: 'منقضی شده', color: 'bg-orange-100 text-orange-800' },
      'Revoked': { text: 'ابطال شده', color: 'bg-red-100 text-red-800' },
      'Cancelled': { text: 'لغو شده', color: 'bg-gray-100 text-gray-800' }
    };
    const badge = badges[status] || { text: status, color: 'bg-gray-100 text-gray-800' };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${badge.color}`}>
        {badge.text}
      </span>
    );
  };

  const fetchAllFilteredHistory = async () => {
    const params = {
      page: 1,
      limit: 1000,
      ...filters
    };

    Object.keys(params).forEach(key => {
      if (params[key] === '' || params[key] === null) {
        delete params[key];
      }
    });

    const first = await api.get('/api/license-history/all', { params });
    if (!first.data?.success) {
      return [];
    }

    const allRows = Array.isArray(first.data.data) ? [...first.data.data] : [];
    const totalPages = first.data.pagination?.totalPages || 1;

    for (let p = 2; p <= totalPages; p++) {
      const next = await api.get('/api/license-history/all', { params: { ...params, page: p } });
      if (next.data?.success && Array.isArray(next.data.data)) {
        allRows.push(...next.data.data);
      }
    }

    return allRows;
  };

  const handleEditSave = async () => {
    if (!editModal) return;
    setEditSaving(true);
    try {
      await api.put(`/api/license-history/${editModal.HistoryID}/paid-amount`, { paidAmount: editAmount });
      setHistory(prev => prev.map(row =>
        row.HistoryID === editModal.HistoryID ? { ...row, PaidAmount: editAmount } : row
      ));
      setEditModal(null);
    } catch (error) {
      alert(error.response?.data?.message || 'خطا در ذخیره');
    } finally {
      setEditSaving(false);
    }
  };

  const handleExportToExcel = async () => {
    try {
      setExportLoading(true);
      const rows = await fetchAllFilteredHistory();
      if (!rows || rows.length === 0) {
        return;
      }
      const csvContent = [
      ['شماره پیگیری', 'نوع پروانه', 'نوع سیستم', 'نوع تیپ', 'نرخ تناژ', 'نوع عملیات', 'نوع رویداد', 'تاریخ صدور', 'تاریخ انقضا', 'وضعیت', 'مبلغ پرداختی', 'مبلغ محاسبه شده', 'نوع پرداخت', 'شماره فیش', 'تاریخ پرداخت', 'صادرکننده'],
      ...rows.map(item => [
        item.TrackingNo || '-',
        item.LicenseTypeName || item.LicenseTypeDisplayName || '-',
        item.SystemTypeName || (item.SystemId ?? '-'),
        item.SystemTipName || (item.SystemTipId ?? '-'),
        item.VehicleCapacity || '-',
        item.OperationTypeName || item.OperationTypeDisplayName || '-',
        item.EventType || '-',
        item.IssueDate || '-',
        item.ExpiryDate || '-',
        item.Status || '-',
        item.PaidAmount !== null && item.PaidAmount !== undefined && item.PaidAmount !== '' ? String(item.PaidAmount) : '-',
        formatAmount(item.CalculatedAmount),
        item.PaymentType === 'Online' ? 'آنلاین' : item.PaymentType === 'Offline' ? 'آفلاین' : '-',
        item.PaymentReceiptNo || '-',
        toJalali(item.PaymentDate),
        item.IssuedByUsername || '-'
      ])
    ].map(row => row.join(',')).join('\n');

      const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `تاریخچه_پروانه‌ها_${new Date().toISOString().split('T')[0]}.csv`;
      link.click();
    } catch (error) {
      console.error('Error exporting license history:', error);
    } finally {
      setExportLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8" dir="rtl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">تاریخچه پروانه‌ها</h1>
        <p className="text-gray-600">مشاهده و مدیریت تاریخچه صدور، تمدید و ابطال پروانه‌ها</p>
      </div>

      {dbError && (
        <div className="bg-yellow-50 border-r-4 border-yellow-400 p-6 mb-6">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <svg className="h-6 w-6 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div className="mr-3">
              <h3 className="text-lg font-medium text-yellow-800 mb-2">جدول LicenseHistory هنوز ایجاد نشده است</h3>
              <div className="text-sm text-yellow-700">
                <p className="mb-2">برای استفاده از این قابلیت، لطفاً migration های زیر را در دیتابیس اجرا کنید:</p>
                <ol className="list-decimal mr-5 space-y-1">
                  <li><code className="bg-yellow-100 px-2 py-1 rounded">server/migrations/create_license_history_table.sql</code></li>
                  <li><code className="bg-yellow-100 px-2 py-1 rounded">server/migrations/add_license_history_page.sql</code></li>
                </ol>
                <p className="mt-3 text-xs">پس از اجرای migration ها، صفحه را رفرش کنید.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {statistics && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm text-gray-600 mb-1">کل رکوردها</div>
            <div className="text-3xl font-bold text-gray-800">{statistics.statistics.TotalRecords}</div>
          </div>
          <div className="bg-green-50 rounded-lg shadow p-6">
            <div className="text-sm text-green-600 mb-1">صادر شده</div>
            <div className="text-3xl font-bold text-green-800">{statistics.statistics.TotalIssued}</div>
          </div>
          <div className="bg-blue-50 rounded-lg shadow p-6">
            <div className="text-sm text-blue-600 mb-1">تمدید شده</div>
            <div className="text-3xl font-bold text-blue-800">{statistics.statistics.TotalRenewed}</div>
          </div>
          <div className="bg-orange-50 rounded-lg shadow p-6">
            <div className="text-sm text-orange-600 mb-1">فعال</div>
            <div className="text-3xl font-bold text-orange-800">{statistics.statistics.TotalActive}</div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow mb-6">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">فیلترها</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-8 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">نوع رویداد</label>
              <select
                name="eventType"
                value={filters.eventType}
                onChange={handleFilterChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">همه</option>
                <option value="Issued">صادر شده</option>
                <option value="Renewed">تمدید شده</option>
                <option value="Revoked">ابطال شده</option>
                <option value="Cancelled">لغو شده</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">منبع داده ها</label>
              <select
                name="fromold"
                value={filters.fromold}
                onChange={handleFilterChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">کل رکوردها</option>
                <option value="1">رکوردهای سامانه قدیم</option>
                <option value="0">رکوردهای سامانه جدید</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">وضعیت</label>
              <select
                name="status"
                value={filters.status}
                onChange={handleFilterChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">همه</option>
                <option value="Active">فعال</option>
                <option value="Expired">منقضی شده</option>
                <option value="Revoked">ابطال شده</option>
                <option value="Cancelled">لغو شده</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">نوع پروانه</label>
              <select
                name="licenseTypeId"
                value={filters.licenseTypeId}
                onChange={handleFilterChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">همه</option>
                {licenseTypes.map(lt => (
                  <option key={lt.Id} value={lt.Id}>{lt.Name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">نوع سوخت</label>
              <select
                name="fuelTypeId"
                value={filters.fuelTypeId}
                onChange={handleFilterChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">همه</option>
                {fuelTypes.map(ft => (
                  <option key={ft.Id} value={ft.Id}>{ft.Name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">نرخ تناژ</label>
              <select
                name="tonnageRateId"
                value={filters.tonnageRateId}
                onChange={handleFilterChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">همه</option>
                {tonnageRates.map(tr => (
                  <option key={tr.Id} value={tr.Id}>{tr.Name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">از تاریخ</label>
              <input
                type="text"
                name="fromDate"
                value={filters.fromDate}
                onChange={handleFilterChange}
                placeholder="1403/01/01"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">تا تاریخ</label>
              <input
                type="text"
                name="toDate"
                value={filters.toDate}
                onChange={handleFilterChange}
                placeholder="1403/12/29"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="mt-4 flex gap-2">
            <button
              onClick={loadHistory}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              اعمال فیلتر
            </button>
            <button
              onClick={handleExportToExcel}
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
              disabled={loading || exportLoading}
            >
              {exportLoading ? 'در حال تهیه خروجی...' : '📊 خروجی اکسل'}
            </button>
            <button
              onClick={handleClearFilters}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors"
            >
              پاک کردن فیلترها
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  ردیف
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  شماره پیگیری
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  نوع پروانه
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  نوع عملیات
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  نوع رویداد
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  تاریخ صدور
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  تاریخ انقضا
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  وضعیت
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  مبلغ پرداختی
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  مبلغ محاسبه شده
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  نوع پرداخت
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  شماره فیش
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  صادرکننده
                </th>
                {isAdmin && (
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    ویرایش
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan="13" className="px-6 py-4 text-center text-gray-500">
                    در حال بارگذاری...
                  </td>
                </tr>
              ) : history.length === 0 ? (
                <tr>
                  <td colSpan="13" className="px-6 py-4 text-center text-gray-500">
                    رکوردی یافت نشد
                  </td>
                </tr>
              ) : (
                history.map((item, index) => (
                  <tr key={item.HistoryID} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {(pagination.page - 1) * pagination.limit + index + 1}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600">
                      {item.TrackingNo}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {item.LicenseTypeName}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {item.OperationTypeName}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {getEventTypeBadge(item.EventType)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {item.IssueDate}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {item.ExpiryDate}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {getStatusBadge(item.Status)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900" style={{ direction: 'ltr', textAlign: 'right', fontFamily: 'monospace' }}>
                      {formatAmount(item.PaidAmount)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900" style={{ direction: 'ltr', textAlign: 'right', fontFamily: 'monospace' }}>
                      {formatAmount(item.CalculatedAmount)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {item.PaymentType === 'Online' ? 'آنلاین' : item.PaymentType === 'Offline' ? 'آفلاین' : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900" style={{ direction: 'ltr', textAlign: 'right', fontFamily: 'monospace' }}>
                      {item.PaymentReceiptNo || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {item.IssuedByUsername && !(viewerIsSuperAdminOnly() && isAdminRoleName(item.IssuedByRole)) ? item.IssuedByUsername : '-'}
                      {item.IssuedByRole && !isAdminRoleName(item.IssuedByRole) && (
                        <div className="text-xs text-gray-500">{item.IssuedByRole}</div>
                      )}
                    </td>
                    {isAdmin && (
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <button
                          onClick={() => { setEditModal(item); setEditAmount(item.PaidAmount ?? ''); }}
                          className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-xs"
                        >
                          ویرایش
                        </button>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="bg-gray-50 border-t border-gray-200 px-6 py-3 text-sm text-gray-700 font-medium">
          جمع رکوردها: {pagination.total.toLocaleString('fa-IR')}
        </div>

        {pagination.totalPages > 1 && (
          <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
            <div className="flex-1 flex justify-between sm:hidden">
              <button
                onClick={() => handlePageChange(pagination.page - 1)}
                disabled={pagination.page === 1}
                className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                قبلی
              </button>
              <button
                onClick={() => handlePageChange(pagination.page + 1)}
                disabled={pagination.page === pagination.totalPages}
                className="mr-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                بعدی
              </button>
            </div>
            <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-gray-700">
                  نمایش{' '}
                  <span className="font-medium">{(pagination.page - 1) * pagination.limit + 1}</span>
                  {' '}تا{' '}
                  <span className="font-medium">
                    {Math.min(pagination.page * pagination.limit, pagination.total)}
                  </span>
                  {' '}از{' '}
                  <span className="font-medium">{pagination.total}</span>
                  {' '}نتیجه
                </p>
              </div>
              <div>
                <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                  <button
                    onClick={() => handlePageChange(pagination.page - 1)}
                    disabled={pagination.page === 1}
                    className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    قبلی
                  </button>
                  {[...Array(pagination.totalPages)].map((_, i) => {
                    const pageNum = i + 1;
                    if (
                      pageNum === 1 ||
                      pageNum === pagination.totalPages ||
                      (pageNum >= pagination.page - 2 && pageNum <= pagination.page + 2)
                    ) {
                      return (
                        <button
                          key={pageNum}
                          onClick={() => handlePageChange(pageNum)}
                          className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                            pageNum === pagination.page
                              ? 'z-10 bg-blue-50 border-blue-500 text-blue-600'
                              : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                          }`}
                        >
                          {pageNum}
                        </button>
                      );
                    } else if (pageNum === pagination.page - 3 || pageNum === pagination.page + 3) {
                      return <span key={pageNum} className="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700">...</span>;
                    }
                    return null;
                  })}
                  <button
                    onClick={() => handlePageChange(pagination.page + 1)}
                    disabled={pagination.page === pagination.totalPages}
                    className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    بعدی
                  </button>
                </nav>
              </div>
            </div>
          </div>
        )}
      </div>

      {statistics && statistics.byLicenseType && statistics.byLicenseType.length > 0 && (
        <div className="mt-6 bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">آمار بر اساس نوع پروانه</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    نوع پروانه
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    کل
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    صادر شده
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    تمدید شده
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    فعال
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {statistics.byLicenseType.map((item, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {item.LicenseTypeName}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {item.Count}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {item.IssuedCount}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {item.RenewedCount}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {item.ActiveCount}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {editModal && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50" dir="rtl">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-sm">
            <h3 className="text-lg font-bold text-gray-800 mb-4">ویرایش مبلغ پرداختی</h3>
            <p className="text-sm text-gray-600 mb-1">شماره پیگیری: <span className="font-medium">{editModal.TrackingNo}</span></p>
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">مبلغ پرداختی (ریال)</label>
              <input
                type="number"
                value={editAmount}
                onChange={e => setEditAmount(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                dir="ltr"
                min="0"
              />
            </div>
            <div className="flex gap-3 mt-5 justify-end">
              <button
                onClick={() => setEditModal(null)}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 text-sm"
                disabled={editSaving}
              >
                انصراف
              </button>
              <button
                onClick={handleEditSave}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm disabled:opacity-50"
                disabled={editSaving}
              >
                {editSaving ? 'در حال ذخیره...' : 'ذخیره'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminLicenseHistory;
