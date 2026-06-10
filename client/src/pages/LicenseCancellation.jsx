import React, { useState } from 'react';
import { api } from '../lib/api.js';

export default function LicenseCancellation() {
  const [vin, setVin] = useState('');
  const [vehicleData, setVehicleData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Form fields
  const [reason, setReason] = useState('');
  const [file, setFile] = useState(null);
  const [fileError, setFileError] = useState('');

  const handleSearch = async () => {
    if (!vin.trim()) {
      setError('لطفاً VIN خودرو را وارد کنید.');
      return;
    }

    setSearching(true);
    setError('');
    setVehicleData(null);

    try {
      const { data } = await api.get(`/api/cancellation/search/${vin.trim()}`);
      setVehicleData(data);
      setError('');
    } catch (err) {
      setError(err?.response?.data?.message || 'خطا در جستجوی خودرو');
      setVehicleData(null);
    } finally {
      setSearching(false);
    }
  };

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      // Check file size (max 2MB)
      if (selectedFile.size > 2 * 1024 * 1024) {
        setFileError('حجم فایل نباید بیشتر از 2 مگابایت باشد.');
        setFile(null);
        e.target.value = '';
        return;
      }
      setFileError('');
      setFile(selectedFile);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!reason.trim()) {
      setError('لطفاً توضیحات را وارد کنید.');
      return;
    }

    if (!vehicleData) {
      setError('لطفاً ابتدا خودرو را جستجو کنید.');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const formData = new FormData();
      formData.append('requestId', vehicleData.requestId);
      formData.append('vehicleId', vehicleData.vehicleId);
      formData.append('reason', reason);
      
      if (file) {
        formData.append('attachment', file);
      }

      const { data } = await api.post('/api/cancellation/submit', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      setSuccess(data.message);
      // Reset form
      setVin('');
      setVehicleData(null);
      setReason('');
      setFile(null);
      setFileError('');
      
      // Clear file input
      const fileInput = document.getElementById('fileInput');
      if (fileInput) fileInput.value = '';
    } catch (err) {
      setError(err?.response?.data?.message || 'خطا در ثبت درخواست ابطال');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('fa-IR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  return (
    <div style={{ padding: '20px', maxWidth: '900px', margin: '0 auto' }}>
      <div style={{ marginBottom: '30px' }}>
        <h1 style={{ margin: 0, fontSize: '28px', fontWeight: 'bold', color: '#1f2937' }}>
          درخواست ابطال پروانه فعالیت
        </h1>
        <p style={{ marginTop: '8px', color: '#6b7280', fontSize: '14px' }}>
          برای ابطال پروانه فعالیت، VIN خودرو را وارد کرده و فرم زیر را تکمیل نمایید.
        </p>
      </div>

      {/* Search Section */}
      <div className="box" style={{ marginBottom: '20px' }}>
        <h2 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '16px', color: '#374151' }}>
          جستجوی خودرو
        </h2>
        
        <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500' }}>
              VIN خودرو <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <input
              type="text"
              value={vin}
              onChange={(e) => setVin(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="VIN خودرو را وارد کنید"
              style={{
                width: '100%',
                padding: '10px 16px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '14px',
                outline: 'none'
              }}
              disabled={searching}
            />
          </div>
          
          <button
            onClick={handleSearch}
            disabled={searching || !vin.trim()}
            style={{
              marginTop: '28px',
              padding: '10px 24px',
              background: searching ? '#9ca3af' : '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: searching || !vin.trim() ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              fontWeight: 'bold',
              whiteSpace: 'nowrap'
            }}
          >
            {searching ? '🔍 در حال جستجو...' : '🔍 جستجو'}
          </button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div style={{
          padding: '16px',
          background: '#fee2e2',
          border: '1px solid #fecaca',
          borderRadius: '8px',
          marginBottom: '20px',
          color: '#991b1b'
        }}>
          <strong>⚠️ خطا:</strong> {error}
        </div>
      )}

      {/* Success Message */}
      {success && (
        <div style={{
          padding: '16px',
          background: '#d1fae5',
          border: '1px solid #a7f3d0',
          borderRadius: '8px',
          marginBottom: '20px',
          color: '#065f46'
        }}>
          <strong>✅ موفق:</strong> {success}
        </div>
      )}

      {/* Vehicle Information */}
      {vehicleData && (
        <div className="box" style={{ marginBottom: '20px', background: '#f0fdf4', border: '2px solid #86efac' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '16px', color: '#166534' }}>
            ✓ اطلاعات خودرو و پروانه
          </h2>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px' }}>
            <div>
              <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>نام و نام خانوادگی مالک</div>
              <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#1f2937' }}>{vehicleData.ownerName}</div>
            </div>
            
            <div>
              <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>نام خودرو</div>
              <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#1f2937' }}>{vehicleData.vehicleName}</div>
            </div>
            
            <div>
              <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>شماره پروانه</div>
              <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#1f2937' }}>{vehicleData.licenseNumber}</div>
            </div>
            
            <div>
              <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>تاریخ صدور</div>
              <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#1f2937' }}>{formatDate(vehicleData.issueDate)}</div>
            </div>
            
            <div>
              <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>تاریخ پایان</div>
              <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#1f2937' }}>{formatDate(vehicleData.expiryDate)}</div>
            </div>
            
            <div>
              <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>VIN</div>
              <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#1f2937' }}>{vehicleData.vin}</div>
            </div>
          </div>
        </div>
      )}

      {/* Cancellation Form */}
      {vehicleData && (
        <form onSubmit={handleSubmit}>
          <div className="box" style={{ marginBottom: '20px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '16px', color: '#374151' }}>
              اطلاعات درخواست ابطال
            </h2>
            
            {/* Reason */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500' }}>
                توضیحات و دلیل ابطال <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="لطفاً دلیل درخواست ابطال پروانه را به طور کامل شرح دهید..."
                rows={5}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '14px',
                  outline: 'none',
                  resize: 'vertical',
                  fontFamily: 'inherit'
                }}
                required
              />
            </div>
            
            {/* File Upload */}
            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500' }}>
                پیوست فایل (اختیاری)
              </label>
              <input
                id="fileInput"
                type="file"
                onChange={handleFileChange}
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '14px',
                  cursor: 'pointer'
                }}
              />
              <div style={{ marginTop: '8px', fontSize: '12px', color: '#6b7280' }}>
                فرمت‌های مجاز: PDF, Word, JPG, PNG | حداکثر حجم: 2 مگابایت
              </div>
              {fileError && (
                <div style={{ marginTop: '8px', fontSize: '13px', color: '#ef4444' }}>
                  ⚠️ {fileError}
                </div>
              )}
              {file && !fileError && (
                <div style={{ marginTop: '8px', fontSize: '13px', color: '#059669' }}>
                  ✓ فایل انتخاب شده: {file.name} ({(file.size / 1024).toFixed(1)} KB)
                </div>
              )}
            </div>
          </div>

          {/* Submit Button */}
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={() => {
                setVin('');
                setVehicleData(null);
                setReason('');
                setFile(null);
                setFileError('');
                setError('');
                setSuccess('');
                const fileInput = document.getElementById('fileInput');
                if (fileInput) fileInput.value = '';
              }}
              style={{
                padding: '12px 24px',
                background: '#6b7280',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 'bold'
              }}
            >
              ✕ لغو
            </button>
            
            <button
              type="submit"
              disabled={loading || !reason.trim() || fileError}
              style={{
                padding: '12px 24px',
                background: loading || !reason.trim() || fileError ? '#9ca3af' : '#ef4444',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: loading || !reason.trim() || fileError ? 'not-allowed' : 'pointer',
                fontSize: '14px',
                fontWeight: 'bold'
              }}
            >
              {loading ? '⏳ در حال ثبت...' : '✓ ثبت درخواست ابطال'}
            </button>
          </div>
        </form>
      )}

      {/* Help Section */}
      <div style={{
        marginTop: '30px',
        padding: '16px',
        background: '#eff6ff',
        borderRadius: '8px',
        border: '1px solid #bfdbfe'
      }}>
        <div style={{ fontSize: '14px', color: '#1e40af' }}>
          <strong>💡 راهنما:</strong>
          <ul style={{ marginTop: '8px', marginBottom: 0, paddingRight: '20px' }}>
            <li>ابتدا VIN خودرو را وارد کرده و دکمه جستجو را بزنید.</li>
            <li>در صورت یافتن پروانه فعال، اطلاعات خودرو نمایش داده می‌شود.</li>
            <li>توضیحات دلیل ابطال را به طور کامل وارد کنید.</li>
            <li>در صورت نیاز، می‌توانید یک فایل پیوست (حداکثر 2 مگابایت) ضمیمه کنید.</li>
            <li>پس از ثبت درخواست، درخواست شما توسط کارشناسان بررسی خواهد شد.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
