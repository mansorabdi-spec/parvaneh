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

  // POS device settings. Address and pairing token are files on the server, not SiteSettings rows.
  const [posHost, setPosHost] = useState('');
  const [posPort, setPosPort] = useState('80');
  const [posPaired, setPosPaired] = useState(false);
  const [posBridge, setPosBridge] = useState(false);
  const [posOnline, setPosOnline] = useState(true);
  const [posSeen, setPosSeen] = useState(null);
  const [pairCode, setPairCode] = useState('');
  const [posBusy, setPosBusy] = useState(false);
  const [posNote, setPosNote] = useState('');
  const [bridgeKeyReady, setBridgeKeyReady] = useState(false);
  const [kioskSite, setKioskSite] = useState(() => (typeof window === 'undefined' ? '' : window.location.origin));
  const [packageBusy, setPackageBusy] = useState(false);
  const [packageNote, setPackageNote] = useState('');

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
    }
    try {
      const { data: pos } = await api.get('/api/site-settings/pos');
      setPosHost(pos.host || '');
      setPosPort(pos.port ? String(pos.port) : '');
      setPosPaired(Boolean(pos.paired));
      setPosBridge(Boolean(pos.bridge));
      setPosOnline(pos.online !== false);
      setPosSeen(pos.lastSeen || null);
      setBridgeKeyReady(Boolean(pos.bridgeKeyReady));
    } catch (e) {
      setPosNote(e?.response?.data?.message || 'خواندن تنظیم دستگاه پوز انجام نشد');
    } finally {
      setLoading(false);
    }
  }

  async function savePosDevice() {
    setPosBusy(true);
    setPosNote('');
    try {
      const { data } = await api.put('/api/site-settings/pos', {
        host: posHost.trim(),
        port: Number(posPort),
      });
      setPosHost(data.host || posHost);
      setPosPort(String(data.port || posPort));
      setPosPaired(Boolean(data.paired));
      setPosNote(data.message || 'آدرس کارتخوان ذخیره شد');
    } catch (e) {
      setPosNote(e?.response?.data?.message || 'ذخیرهٔ آدرس کارتخوان انجام نشد');
    } finally {
      setPosBusy(false);
    }
  }

  async function requestPairCode() {
    setPosBusy(true);
    setPosNote('');
    try {
      const { data } = await api.post('/api/site-settings/pos/pair', {});
      setPosNote(data.message || 'کد روی کارتخوان را وارد کنید');
    } catch (e) {
      setPosNote(e?.response?.data?.message || 'ارتباط با کارتخوان برای گرفتن کد برقرار نشد');
    } finally {
      setPosBusy(false);
    }
  }

  async function downloadKioskPackage() {
    setPackageBusy(true);
    setPackageNote('');
    try {
      const response = await api.get('/api/site-settings/pos/kiosk-package', {
        params: { site: kioskSite.trim() },
        responseType: 'blob',
      });
      const blob = new Blob([response.data], { type: 'application/zip' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'kiosk-bridge.zip';
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setPackageNote('فایل‌ها دانلود شد. پوشه را به رایانه کیوسک ببرید و گام‌های زیر را همان‌جا انجام دهید.');
    } catch (e) {
      let message = 'دانلود فایل‌های کیوسک انجام نشد';
      const data = e?.response?.data;
      if (data instanceof Blob) {
        try {
          const parsed = JSON.parse(await data.text());
          if (parsed.message) message = parsed.message;
        } catch {
          // The error body was not JSON.
        }
      } else if (data?.message) {
        message = data.message;
      }
      setPackageNote(message);
    } finally {
      setPackageBusy(false);
    }
  }

  async function confirmPairCode() {
    setPosBusy(true);
    setPosNote('');
    try {
      const { data } = await api.post('/api/site-settings/pos/pair/confirm', { code: pairCode });
      if (data.ok) {
        setPosPaired(true);
        setPairCode('');
      }
      setPosNote(data.message || 'جفت‌سازی انجام نشد');
    } catch (e) {
      setPosNote(e?.response?.data?.message || 'تأیید کد جفت‌سازی انجام نشد');
    } finally {
      setPosBusy(false);
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
        <>
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

        <div
          className="card"
          style={{
            marginTop: 24,
            padding: '24px 28px',
            borderRadius: 10,
            boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
            background: '#fff',
          }}
        >
          <h3
            style={{
              marginTop: 0,
              marginBottom: 12,
              fontSize: '1.1rem',
              fontWeight: 600,
              color: '#1e3a5f',
              borderBottom: '2px solid #e5e7eb',
              paddingBottom: 12,
            }}
          >
            دستگاه پوز
            <span style={{ marginRight: 10, fontSize: '0.9rem', color: posPaired ? '#15803d' : '#c2410c' }}>
              {posPaired ? 'جفت شده' : 'جفت نشده'}
            </span>
          </h3>
          <p style={{ marginTop: 0, color: '#475569', lineHeight: 1.8, fontSize: '0.92rem' }}>
            {posBridge
              ? 'رایانه کیوسک بین سامانه و کارتخوان قرار دارد. آدرس و رمز جفت‌سازی روی همان رایانه می‌ماند. آن رایانه باید روشن باشد و با کارتخوان در یک شبکه باشد.'
              : 'سامانه مستقیم به کارتخوان وصل می‌شود. آدرس و رمز جفت‌سازی روی سرور سامانه می‌ماند.'}
          </p>
          <p style={{ marginTop: 0, color: posBridge && !posOnline ? '#c2410c' : '#166534', lineHeight: 1.8, fontSize: '0.92rem' }}>
            {posBridge
              ? (posOnline ? 'اتصال رایانه کیوسک برقرار است.' : 'اتصال رایانه کیوسک قطع است.')
              : 'ارسال مبلغ از خود سرور انجام می‌شود.'}
          </p>
          {posBridge && posSeen && (
            <p style={{ marginTop: 0, color: '#475569', fontSize: '0.9rem' }}>
              {`آخرین ارتباط: ${new Date(posSeen).toLocaleString('fa-IR')}`}
            </p>
          )}
          <p dir="ltr" style={{ marginTop: 0, textAlign: 'left', color: '#64748b', fontSize: '0.85rem' }}>
            Asanpardakht CSV
          </p>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <input
              type="text"
              value={posHost}
              onChange={(e) => setPosHost(e.target.value.trim())}
              placeholder="آی‌پی کارتخوان"
              style={{ flex: 1, padding: '10px 12px', borderRadius: 8, border: '1px solid #d1d5db' }}
            />
            <input
              type="text"
              inputMode="numeric"
              value={posPort}
              onChange={(e) => setPosPort(e.target.value.replace(/\D/g, '').slice(0, 5))}
              placeholder="پورت"
              style={{ width: 96, padding: '10px 12px', borderRadius: 8, border: '1px solid #d1d5db', textAlign: 'center' }}
            />
          </div>
          <button
            type="button"
            disabled={posBusy}
            onClick={savePosDevice}
            className="btn btn-green"
            style={{ width: '100%', marginBottom: 8, padding: '10px', fontWeight: 700 }}
          >
            ذخیرهٔ آدرس
          </button>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              disabled={posBusy}
              onClick={requestPairCode}
              style={{ flex: 1, padding: '10px', border: 'none', borderRadius: 8, background: '#0f766e', color: '#fff', fontWeight: 700, cursor: 'pointer' }}
            >
              نمایش کد روی دستگاه
            </button>
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={pairCode}
              onChange={(e) => setPairCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="کد ۶ رقمی"
              style={{ width: 120, padding: '10px 12px', borderRadius: 8, border: '1px solid #d1d5db', textAlign: 'center' }}
            />
            <button
              type="button"
              disabled={posBusy || pairCode.length !== 6}
              onClick={confirmPairCode}
              style={{
                padding: '10px 12px',
                border: 'none',
                borderRadius: 8,
                background: pairCode.length === 6 ? '#047857' : '#9ca3af',
                color: '#fff',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              تأیید
            </button>
          </div>
          {posNote && (
            <div style={{ marginTop: 10, color: '#1e293b', lineHeight: 1.7 }}>{posNote}</div>
          )}

          <div style={{ marginTop: 22, paddingTop: 18, borderTop: '1px solid #e5e7eb' }}>
            <h4 style={{ margin: '0 0 8px', color: '#1e3a5f', fontSize: '1rem' }}>فایل‌های رایانه کیوسک</h4>
            <p style={{ marginTop: 0, color: '#475569', lineHeight: 1.9, fontSize: '0.92rem' }}>
              برنامه اتصال کارتخوان روی رایانه کنار دستگاه پوز اجرا می‌شود. این رایانه مبلغ را از سامانه می‌گیرد و به کارتخوان همان شبکه می‌فرستد. فایل‌های لازم را از اینجا دانلود کنید و روی آن رایانه کپی کنید.
            </p>
            {!posBridge && (
              <p style={{ marginTop: 0, color: '#c2410c', lineHeight: 1.9, fontSize: '0.92rem' }}>
                روی سرور مقدار <bdi>PCPOS_USE_BRIDGE</bdi> باید ۱ باشد تا سامانه کار پرداخت را به رایانه کیوسک بسپارد.
              </p>
            )}
            {!bridgeKeyReady && (
              <p style={{ marginTop: 0, color: '#c2410c', lineHeight: 1.9, fontSize: '0.92rem' }}>
                کلید مشترک روی سرور تنظیم نشده است. در تنظیم سرور مقدار <bdi>PCPOS_BRIDGE_KEY</bdi> را یک عبارت حداقل ۸ نویسه‌ای بگذارید و سرور را دوباره راه بیندازید. همان کلید داخل فایل دانلود قرار می‌گیرد و در این صفحه نشان داده نمی‌شود.
              </p>
            )}
            <label style={{ display: 'block', marginBottom: 6, color: '#334155', fontSize: '0.9rem' }}>
              آدرس عمومی سایت که داخل فایل تنظیم کیوسک نوشته می‌شود
            </label>
            <input
              type="url"
              dir="ltr"
              value={kioskSite}
              onChange={(e) => setKioskSite(e.target.value.trim())}
              placeholder="https://example.com"
              style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #d1d5db', marginBottom: 8, boxSizing: 'border-box' }}
            />
            {/localhost|127\.0\.0\.1|:4000\b|:4001\b|:5173\b/i.test(kioskSite) && (
              <p style={{ marginTop: 0, color: '#c2410c', lineHeight: 1.8, fontSize: '0.88rem' }}>
                این آدرس مخصوص رایانه فعلی یا درگاه داخلی سرور است. پیش از دانلود، آدرس عمومی سایت را بنویسید و شماره درگاه ۴۰۰۰ یا ۴۰۰۱ را در آن نگذارید.
              </p>
            )}
            <button
              type="button"
              disabled={packageBusy}
              onClick={downloadKioskPackage}
              style={{
                width: '100%',
                marginBottom: 14,
                padding: '10px',
                border: 'none',
                borderRadius: 8,
                background: packageBusy ? '#9ca3af' : '#1d4ed8',
                color: '#fff',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              {packageBusy ? 'در حال ساخت فایل...' : 'دانلود فایل‌های رایانه کیوسک'}
            </button>
            {packageNote && (
              <div style={{ marginBottom: 12, color: '#1e293b', lineHeight: 1.7 }}>{packageNote}</div>
            )}
            <p style={{ margin: '0 0 8px', color: '#1e3a5f', fontWeight: 700, fontSize: '0.95rem' }}>
              کارهایی که روی رایانه کیوسک انجام می‌شود
            </p>
            <ol style={{ margin: 0, paddingRight: 20, color: '#334155', lineHeight: 1.95, fontSize: '0.92rem' }}>
              <li>
                برنامه <bdi>Node.js</bdi> نسخه ۱۸ یا جدیدتر را نصب کنید و هنگام نصب، افزودن آن به <bdi>PATH</bdi> را انتخاب کنید.
              </li>
              <li>
                فایل دانلودشده را به رایانه کیوسک ببرید و در یک پوشه ثابت، مانند <bdi>C:\kiosk-bridge</bdi>، از حالت فشرده خارج کنید.
              </li>
              <li>
                فایل <bdi>.env</bdi> را باز کنید. مقدار <bdi>PCPOS_SERVER_URL</bdi> باید همان آدرس عمومی سایت باشد. مقدار <bdi>PCPOS_BRIDGE_KEY</bdi> را تغییر ندهید.
              </li>
              <li>رایانه کیوسک و دستگاه پوز را به یک شبکه مشترک وصل کنید.</li>
              <li>
                فایل <bdi>start.bat</bdi> را اجرا کنید و پنجره را نبندید. پیام «سامانه پاسخ داد» یعنی اتصال با سامانه برقرار شده است.
              </li>
              <li>
                برای بالا آمدن همراه با روشن شدن رایانه، میانبر <bdi>start.bat</bdi> را در پوشه <bdi>Startup</bdi> ویندوز بگذارید.
              </li>
              <li>
                به همین صفحه برگردید. پس از جمله «اتصال رایانه کیوسک برقرار است»، آی‌پی و پورت کارتخوان را ذخیره کنید. پورت سرویس پوز آسان‌پرداخت معمولاً ۱۷۰۰۰ است.
              </li>
              <li>دکمه «نمایش کد روی دستگاه» را بزنید، کد شش‌رقمی روی کارتخوان را وارد کنید و تأیید را بزنید.</li>
              <li>در مرورگر همان رایانه، صفحه کیوسک سایت را باز کنید و یک پرداخت آزمایشی انجام دهید.</li>
            </ol>
          </div>
        </div>
        </>
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
