import React, { useEffect, useState } from 'react';
import { api } from '../lib/api.js';

export default function UserLicenses() {
  const [licenses, setLicenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [licenseTypes, setLicenseTypes] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 50, total: 0, totalPages: 0 });
  
  const [filters, setFilters] = useState({
    trackingNo: '',
    licenseTypeId: '',
    fromold: ''
  });

  useEffect(() => {
    loadLicenseTypes();
    loadLicenses();
  }, []);

  const loadLicenseTypes = async () => {
    try {
      const response = await api.get('/api/lookups/values?categoryKey=LicenseType');
      setLicenseTypes(response.data || []);
    } catch (err) {
      console.error('Error loading license types:', err);
    }
  };

  const loadLicenses = async (page = 1) => {
    try {
      setLoading(true);
      setError('');
      
      const params = new URLSearchParams();
      params.append('page', page);
      params.append('limit', pagination.limit);
      
      if (filters.trackingNo) params.append('trackingNo', filters.trackingNo);
      if (filters.licenseTypeId) params.append('licenseTypeId', filters.licenseTypeId);
      if (filters.fromold !== '') params.append('fromold', filters.fromold);
      
      const response = await api.get(`/api/license-history/my?${params.toString()}`);
      setLicenses(response.data.data || []);
      setPagination(response.data.pagination || { page: 1, limit: 50, total: 0, totalPages: 0 });
    } catch (err) {
      setError(err?.response?.data?.message || 'خطا در بارگذاری پروانه‌ها');
      console.error('Error loading licenses:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (field, value) => {
    setFilters(prev => ({ ...prev, [field]: value }));
  };

  const handleApplyFilters = () => {
    loadLicenses(1);
  };

  const handleClearFilters = () => {
    setFilters({
      trackingNo: '',
      licenseTypeId: '',
      fromold: ''
    });
    setTimeout(() => loadLicenses(1), 0);
  };

  const getFromoldBadge = (fromold) => {
    const isOld = fromold === 1 || fromold === true;
    return (
      <span style={{
        padding: '4px 12px',
        borderRadius: '12px',
        backgroundColor: isOld ? '#f59e0b' : '#10b981',
        color: 'white',
        fontSize: '0.85em',
        fontWeight: '500'
      }}>
        {isOld ? 'سامانه قبلی' : 'این سامانه'}
      </span>
    );
  };

  // Convert Shamsi date string to Date object
  // Expected format: "YYYY/MM/DD" in Shamsi calendar
  const shamsiToGregorian = (shamsiDateStr) => {
    if (!shamsiDateStr) return null;
    
    try {
      const parts = shamsiDateStr.split('/');
      if (parts.length !== 3) return null;
      
      const year = parseInt(parts[0]);
      const month = parseInt(parts[1]);
      const day = parseInt(parts[2]);
      
      if (isNaN(year) || isNaN(month) || isNaN(day)) return null;
      
      // Jalali to Gregorian conversion
      let gregorianYear = year;
      let gregorianMonth = month - 1; // JS months are 0-indexed
      let gregorianDay = day;
      
      if (month <= 6) {
        // Months 1-6: 31 days each
        gregorianYear += Math.floor((6921 - gregorianYear) / 33) * 4;
        const leap = ((gregorianYear % 33) % 4 === 0) ? 1 : 0;
        gregorianYear -= Math.floor((6921 - gregorianYear) / 33) * 4;
      }
      
      // More accurate Jalali to Gregorian conversion
      const jdn = jalaliToJdn(year, month, day);
      const greg = jdnToGregorian(jdn);
      
      return new Date(gregorianYear, gregorianMonth - greg.month, greg.day);
    } catch (e) {
      console.error('Shamsi to Gregorian conversion error:', e);
      return null;
    }
  };
  
  // Jalali Day Number calculation
  const jalaliToJdn = (rYear, rMonth, rDay) => {
    let gYear = rYear + 621;
    let jdn;
    
    // Calculate if it's a leap year in Jalali calendar
    const leapYears = [1, 5, 9, 13, 17, 22, 26, 30];
    const mod = gYear % 33;
    const isLeap = leapYears.includes(mod);
    
    // Days in each month
    let daysInMonth;
    if (rMonth <= 6) {
      daysInMonth = 31;
    } else if (rMonth <= 11) {
      daysInMonth = 30;
    } else {
      daysInMonth = isLeap ? 30 : 29;
    }
    
    // Total days from year
    jdn = (gYear - 1) * 365 + Math.floor((gYear - 1) / 4) - Math.floor((gYear - 1) / 100) + Math.floor((gYear - 1) / 400);
    
    // Add days for completed months
    for (let i = 1; i < rMonth; i++) {
      if (i <= 6) jdn += 31;
      else jdn += 30;
    }
    
    // Add days
    jdn += rDay;
    
    // Adjust for Jalali epoch (March 22, 622 AD)
    jdn += 199;
    
    return jdn;
  };
  
  const jdnToGregorian = (jdn) => {
    let n = jdn - 2451545;
    let j = n + 68569;
    let k = Math.floor(j / 146097);
    let m = Math.floor((j - Math.floor((146097 * k + 3) / 4)) / 36524);
    let i = j - Math.floor((146097 * k + 3) / 4) - Math.floor(36524 * m) + 1461;
    let year = Math.floor((4000 * (i + 1)) / 1461001);
    i = i - Math.floor(1461 * year / 4) + 31;
    let month = Math.floor((80 * i) / 2447);
    let day = i - Math.floor((2447 * month) / 80);
    i = Math.floor(month / 11);
    month = month + 2 - 12 * i;
    year = 100 * (k - 49) + year + i;
    
    return { year, month, day };
  };
  
  // Convert Persian numerals to English numerals
  const persianToEnglishDigits = (str) => {
    if (!str) return '';
    const persianDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
    let result = str;
    persianDigits.forEach((persian, index) => {
      result = result.replace(new RegExp(persian, 'g'), index.toString());
    });
    return result;
  };
  
  const getStatusBadge = (expiryDate, status) => {
    if (!expiryDate || expiryDate === '-') {
      return (
        <span style={{
          padding: '4px 12px',
          borderRadius: '12px',
          backgroundColor: '#6b7280',
          color: 'white',
          fontSize: '0.85em',
          fontWeight: '500'
        }}>
          -
        </span>
      );
    }
    
    // Get today's date in Shamsi format (with Persian numerals)
    const today = new Date();
    const todayShamsi = today.toLocaleDateString('fa-IR'); // Returns "۱۴۰۵/۰۴/۰۵"
    
    // Convert both to English digits for comparison
    const expiryDateEnglish = persianToEnglishDigits(expiryDate); // "1405/04/05"
    const todayEnglish = persianToEnglishDigits(todayShamsi); // "1405/04/05"
    
    // Compare as strings (YYYY/MM/DD format allows direct string comparison)
    if (expiryDateEnglish > todayEnglish) {
      return (
        <span style={{
          padding: '4px 12px',
          borderRadius: '12px',
          backgroundColor: '#10b981',
          color: 'white',
          fontSize: '0.85em',
          fontWeight: '500'
        }}>
          فعال
        </span>
      );
    } else {
      return (
        <span style={{
          padding: '4px 12px',
          borderRadius: '12px',
          backgroundColor: '#ef4444',
          color: 'white',
          fontSize: '0.85em',
          fontWeight: '500'
        }}>
          منقضی شده
        </span>
      );
    }
  };


  if (loading) {
    return (
      <div className="card">
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <p>در حال بارگذاری...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card">
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <p style={{ color: '#ef4444', marginBottom: '20px' }}>{error}</p>
          <button onClick={loadLicenses} className="btn btn-primary">
            تلاش مجدد
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0 }}>پروانه‌های من</h2>
        <button onClick={() => loadLicenses(pagination.page)} className="btn btn-secondary" style={{ fontSize: '0.9em' }}>
          🔄 بروزرسانی
        </button>
      </div>

      {/* Filters Section */}
      <div style={{ 
        marginBottom: '20px', 
        padding: '20px', 
        backgroundColor: '#f9fafb', 
        borderRadius: '8px',
        border: '1px solid #e5e7eb'
      }}>
        <h3 style={{ margin: '0 0 15px 0', fontSize: '1em', fontWeight: '600' }}>فیلترها</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.9em', fontWeight: '500' }}>
              شماره پیگیری
            </label>
            <input
              type="text"
              value={filters.trackingNo}
              onChange={(e) => handleFilterChange('trackingNo', e.target.value)}
              placeholder="جستجو..."
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '0.9em'
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.9em', fontWeight: '500' }}>
              نوع پروانه
            </label>
            <select
              value={filters.licenseTypeId}
              onChange={(e) => handleFilterChange('licenseTypeId', e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '0.9em'
              }}
            >
              <option value="">همه</option>
              {licenseTypes.map(type => (
                <option key={type.Id} value={type.Id}>{type.Name}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.9em', fontWeight: '500' }}>
              منبع داده
            </label>
            <select
              value={filters.fromold}
              onChange={(e) => handleFilterChange('fromold', e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '0.9em'
              }}
            >
              <option value="">همه</option>
              <option value="0">این سامانه</option>
              <option value="1">سامانه قبلی</option>
            </select>
          </div>

        </div>

        <div style={{ marginTop: '15px', display: 'flex', gap: '10px' }}>
          <button 
            onClick={handleApplyFilters} 
            className="btn btn-primary"
            style={{ fontSize: '0.9em' }}
          >
            🔍 اعمال فیلتر
          </button>
          <button 
            onClick={handleClearFilters} 
            className="btn btn-secondary"
            style={{ fontSize: '0.9em' }}
          >
            ✖️ پاک کردن فیلترها
          </button>
        </div>
      </div>

      {licenses.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>
          <p>هیچ پروانه‌ای یافت نشد</p>
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: '#f3f4f6', borderBottom: '2px solid #e5e7eb' }}>
                <th style={{ padding: '12px', textAlign: 'right', fontWeight: '600' }}>ردیف</th>
                <th style={{ padding: '12px', textAlign: 'right', fontWeight: '600' }}>شماره پیگیری</th>
                <th style={{ padding: '12px', textAlign: 'right', fontWeight: '600' }}>کد ملی</th>
                <th style={{ padding: '12px', textAlign: 'right', fontWeight: '600' }}>نوع پروانه</th>
                <th style={{ padding: '12px', textAlign: 'right', fontWeight: '600' }}>نوع عملیات</th>
                <th style={{ padding: '12px', textAlign: 'right', fontWeight: '600' }}>تاریخ ثبت</th>
                <th style={{ padding: '12px', textAlign: 'right', fontWeight: '600' }}>تاریخ صدور</th>
                <th style={{ padding: '12px', textAlign: 'right', fontWeight: '600' }}>تاریخ انقضا</th>
                <th style={{ padding: '12px', textAlign: 'center', fontWeight: '600' }}>وضعیت پروانه</th>
                <th style={{ padding: '12px', textAlign: 'center', fontWeight: '600' }}>منبع </th>
              </tr>
            </thead>
            <tbody>
              {licenses.map((license, index) => (
                <tr 
                  key={license.RequestID}
                  style={{ 
                    borderBottom: '1px solid #e5e7eb',
                    transition: 'background-color 0.2s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f9fafb'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  <td style={{ padding: '12px', textAlign: 'right' }}>{(pagination.page - 1) * pagination.limit + index + 1}</td>
                  <td style={{ padding: '12px', textAlign: 'right', fontFamily: 'monospace', fontWeight: '500' }}>
                    {license.TrackingNo}
                  </td>
                  <td style={{ padding: '12px', textAlign: 'right', fontFamily: 'monospace' }}>
                    {license.NationalCode || '-'}
                  </td>
                  <td style={{ padding: '12px', textAlign: 'right' }}>
                    {license.LicenseTypeName || '-'}
                  </td>
                  <td style={{ padding: '12px', textAlign: 'right' }}>
                    {license.OperationTypeName || '-'}
                  </td>
                  <td style={{ padding: '12px', direction: 'ltr', textAlign: 'left', fontSize: '0.85em' }}>
                    {license.CreatedAt ? new Date(license.CreatedAt).toLocaleDateString('fa-IR') : '-'}
                  </td>
                  <td style={{ padding: '12px', direction: 'ltr', textAlign: 'left' }}>
                    {license.IssueDate || '-'}
                  </td>
                  <td style={{ padding: '12px', direction: 'ltr', textAlign: 'left' }}>
                    {license.ExpiryDate || '-'}
                  </td>
                  <td style={{ padding: '12px', textAlign: 'center' }}>
                    {getStatusBadge(license.ExpiryDate, license.Status)}
                  </td>
                  <td style={{ padding: '12px', textAlign: 'center' }}>
                    {getFromoldBadge(license.Fromold)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {licenses.length > 0 && (
        <>
          <div style={{ marginTop: '20px', padding: '12px', backgroundColor: '#f9fafb', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <p style={{ margin: 0, fontSize: '0.9em', color: '#6b7280' }}>
              تعداد کل: <strong>{pagination.total}</strong> | 
              صفحه <strong>{pagination.page}</strong> از <strong>{pagination.totalPages}</strong>
            </p>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={() => loadLicenses(pagination.page - 1)}
                disabled={pagination.page === 1}
                className="btn btn-secondary"
                style={{ fontSize: '0.85em', padding: '6px 12px' }}
              >
                ← قبلی
              </button>
              <button
                onClick={() => loadLicenses(pagination.page + 1)}
                disabled={pagination.page >= pagination.totalPages}
                className="btn btn-secondary"
                style={{ fontSize: '0.85em', padding: '6px 12px' }}
              >
                بعدی →
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
