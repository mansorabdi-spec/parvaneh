import React, { useEffect, useState } from 'react';
import { api } from '../lib/api.js';

export default function AdminSiteSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Popup settings state
  const [popupEnabled, setPopupEnabled] = useState(false);
  const [popupMessage, setPopupMessage] = useState('');

  // Preview state
  const [showPreview, setShowPreview] = useState(false);

  async function loadSettings() {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get('/api/site-settings');
      // data is array of { Key, Value, UpdatedAt, UpdatedBy }
      const map = {};
      for (const row of data) {
        map[row.Key] = row.Value;
      }
      setPopupEnabled(map['popup_enabled'] === '1');
      setPopupMessage(map['popup_message'] || '');
    } catch (e) {
      setError(e?.response?.data?.message || 'خطا در دریافت تنظیمات');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSettings();
  }, []);

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      await api.put('/api/site-settings/popup', {
        enabled: popupEnabled,
        message: popupMessage,
      });
      setSuccess('تنظیمات با موفقیت ذخیره شد.');
      setTimeout(() => setSuccess(''), 4000);
    } catch (e) {
      setError(e?.response?.data?.message || 'خطا در ذخیره تنظیمات');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ direction: 'rtl', padding: '24px 0' }}>
      <h2 style={{ marginBottom: 24, fontSize: '1.4rem', fontWeight: 700, color: '#1e3a5f' }}>
        تنظیمات سایت
      </h2>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#6b7280' }}>در حال بارگذاری...</div>
      ) : (
        <form onSubmit={handleSave}>
          {/* Popup Settings Card */}
          <div
            className="card"
            style={{
              marginBottom: 24,
              padding: '24px 28px',
              borderRadius: 10,
              boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
              background: '#fff',
            }}
          >
            <h3
              style={{
                marginTop: 0,
                marginBottom: 20,
                fontSize: '1.1rem',
                fontWeight: 600,
                color: '#1e3a5f',
                borderBottom: '2px solid #e5e7eb',
                paddingBottom: 12,
              }}
            >
              📢 پیام پاپ‌آپ سایت
            </h3>

            {/* Enable/Disable Toggle */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                marginBottom: 20,
                padding: '14px 18px',
                background: popupEnabled ? '#f0fdf4' : '#f9fafb',
                borderRadius: 8,
                border: `1px solid ${popupEnabled ? '#86efac' : '#e5e7eb'}`,
                transition: 'all 0.2s',
              }}
            >
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  cursor: 'pointer',
                  userSelect: 'none',
                  flex: 1,
                }}
              >
                {/* Toggle Switch */}
                <div
                  onClick={() => setPopupEnabled(v => !v)}
                  style={{
                    width: 48,
                    height: 26,
                    borderRadius: 13,
                    background: popupEnabled ? '#22c55e' : '#d1d5db',
                    position: 'relative',
                    cursor: 'pointer',
                    transition: 'background 0.2s',
                    flexShrink: 0,
                  }}
                >
                  <div
                    style={{
                      position: 'absolute',
                      top: 3,
                      right: popupEnabled ? 3 : 'auto',
                      left: popupEnabled ? 'auto' : 3,
                      width: 20,
                      height: 20,
                      borderRadius: '50%',
                      background: '#fff',
                      boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
                      transition: 'all 0.2s',
                    }}
                  />
                </div>
                <span style={{ fontSize: '1rem', fontWeight: 600, color: '#374151' }}>
                  نمایش پاپ‌آپ هنگام ورود به سایت
                </span>
              </label>
              <span
                style={{
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  color: popupEnabled ? '#16a34a' : '#9ca3af',
                  background: popupEnabled ? '#dcfce7' : '#f3f4f6',
                  padding: '3px 12px',
                  borderRadius: 20,
                }}
              >
                {popupEnabled ? 'فعال' : 'غیرفعال'}
              </span>
            </div>

            {/* Message Textarea */}
            <div style={{ marginBottom: 16 }}>
              <label
                style={{
                  display: 'block',
                  marginBottom: 8,
                  fontWeight: 600,
                  color: '#374151',
                  fontSize: '0.95rem',
                }}
              >
                متن پیام پاپ‌آپ
              </label>
              <textarea
                value={popupMessage}
                onChange={e => setPopupMessage(e.target.value)}
                rows={5}
                placeholder="متن پیامی که هنگام ورود کاربران نمایش داده می‌شود را وارد کنید..."
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  borderRadius: 8,
                  border: '1px solid #d1d5db',
                  fontSize: '0.97rem',
                  lineHeight: 1.8,
                  resize: 'vertical',
                  fontFamily: 'inherit',
                  color: '#1f2937',
                  background: '#fafafa',
                  outline: 'none',
                  boxSizing: 'border-box',
                  transition: 'border-color 0.2s',
                }}
                onFocus={e => (e.target.style.borderColor = '#2563eb')}
                onBlur={e => (e.target.style.borderColor = '#d1d5db')}
                disabled={!popupEnabled}
              />
              <div style={{ fontSize: '0.8rem', color: '#9ca3af', marginTop: 4 }}>
                می‌توانید از Enter برای رفتن به خط جدید استفاده کنید.
              </div>
            </div>

            {/* Preview Button */}
            <div style={{ marginBottom: 8 }}>
              <button
                type="button"
                onClick={() => setShowPreview(true)}
                disabled={!popupEnabled || !popupMessage.trim()}
                style={{
                  background: 'none',
                  border: '1px solid #2563eb',
                  color: '#2563eb',
                  borderRadius: 7,
                  padding: '7px 20px',
                  fontSize: '0.9rem',
                  cursor: popupEnabled && popupMessage.trim() ? 'pointer' : 'not-allowed',
                  opacity: popupEnabled && popupMessage.trim() ? 1 : 0.45,
                  fontFamily: 'inherit',
                  transition: 'all 0.2s',
                }}
                onMouseOver={e => {
                  if (popupEnabled && popupMessage.trim()) {
                    e.target.style.background = '#eff6ff';
                  }
                }}
                onMouseOut={e => (e.target.style.background = 'none')}
              >
                👁 پیش‌نمایش پاپ‌آپ
              </button>
            </div>
          </div>

          {/* Error / Success Messages */}
          {error && (
            <div
              style={{
                background: '#fef2f2',
                border: '1px solid #fca5a5',
                color: '#b91c1c',
                borderRadius: 8,
                padding: '12px 16px',
                marginBottom: 16,
                fontSize: '0.95rem',
              }}
            >
              ⚠️ {error}
            </div>
          )}
          {success && (
            <div
              style={{
                background: '#f0fdf4',
                border: '1px solid #86efac',
                color: '#15803d',
                borderRadius: 8,
                padding: '12px 16px',
                marginBottom: 16,
                fontSize: '0.95rem',
              }}
            >
              ✅ {success}
            </div>
          )}

          {/* Save Button */}
          <div style={{ display: 'flex', justifyContent: 'flex-start', gap: 12 }}>
            <button
              type="submit"
              disabled={saving}
              className="btn btn-green"
              style={{
                padding: '10px 36px',
                fontSize: '1rem',
                fontWeight: 600,
                borderRadius: 8,
                cursor: saving ? 'not-allowed' : 'pointer',
                opacity: saving ? 0.7 : 1,
              }}
            >
              {saving ? 'در حال ذخیره...' : '💾 ذخیره تنظیمات'}
            </button>
            <button
              type="button"
              onClick={loadSettings}
              disabled={loading || saving}
              className="btn btn-gray"
              style={{
                padding: '10px 24px',
                fontSize: '0.95rem',
                borderRadius: 8,
              }}
            >
              🔄 بازخوانی
            </button>
          </div>
        </form>
      )}

      {/* Popup Preview Modal */}
      {showPreview && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(0,0,0,0.55)',
            direction: 'rtl',
          }}
          onClick={() => setShowPreview(false)}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: '12px',
              boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
              padding: '36px 32px 28px',
              maxWidth: '480px',
              width: '90%',
              position: 'relative',
              textAlign: 'right',
              animation: 'popupFadeIn 0.25s ease',
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Preview badge */}
            <div
              style={{
                position: 'absolute',
                top: 10,
                right: 14,
                background: '#fef3c7',
                color: '#92400e',
                fontSize: '0.72rem',
                fontWeight: 700,
                padding: '2px 10px',
                borderRadius: 20,
                border: '1px solid #fcd34d',
              }}
            >
              پیش‌نمایش
            </div>

            {/* Close X button */}
            <button
              onClick={() => setShowPreview(false)}
              style={{
                position: 'absolute',
                top: '12px',
                left: '14px',
                background: 'none',
                border: 'none',
                fontSize: '22px',
                cursor: 'pointer',
                color: '#6b7280',
                lineHeight: 1,
                padding: '2px 6px',
              }}
              title="بستن"
              aria-label="بستن پیام"
            >
              ×
            </button>

            {/* Icon */}
            <div style={{ fontSize: '36px', marginBottom: '12px', textAlign: 'center', marginTop: 8 }}>📢</div>

            {/* Message */}
            <p
              style={{
                fontSize: '1.05rem',
                lineHeight: '1.8',
                color: '#1f2937',
                margin: '0 0 24px',
                whiteSpace: 'pre-wrap',
                textAlign: 'justify',
              }}
            >
              {popupMessage}
            </p>

            {/* OK button */}
            <div style={{ textAlign: 'center' }}>
              <button
                onClick={() => setShowPreview(false)}
                style={{
                  background: '#2563eb',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '10px 40px',
                  fontSize: '1rem',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  transition: 'background 0.2s',
                }}
                onMouseOver={e => (e.target.style.background = '#1d4ed8')}
                onMouseOut={e => (e.target.style.background = '#2563eb')}
              >
                متوجه شدم
              </button>
            </div>
          </div>

          <style>{`
            @keyframes popupFadeIn {
              from { opacity: 0; transform: scale(0.92); }
              to   { opacity: 1; transform: scale(1); }
            }
          `}</style>
        </div>
      )}
    </div>
  );
}
