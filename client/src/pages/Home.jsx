import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { usePageAccess } from '../lib/usePageAccess';

// ✅ متغیر کنترل فعال/غیرفعال بودن پیام
const ENABLE_NOTICE = false;   // false = پیام غیرفعال، true = فعال

export default function Home() {
  const { hasAccess } = usePageAccess();
  const token = localStorage.getItem('token');

  // پیام اجباری (مقدار اولیه از متغیر بالایی)
  const [showNotice, setShowNotice] = useState(ENABLE_NOTICE);

  return (
    <div
      style={{
        padding: '40px 20px',
        maxWidth: '1200px',
        margin: '0 auto',
        position: 'relative'
      }}
    >
      {/* 🔔 پیام اطلاع‌رسانی */}
      {showNotice && (
        <div
          style={{
            position: 'absolute',
            top: '-10px',
            left: 0,
            right: 0,
            zIndex: 9999,
            background: '#fff3cd',
            color: '#856404',
            padding: '14px 20px',
            border: '1px solid #ffeeba',
            borderRadius: '10px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '1.1em'
          }}
        >
          <span>
            ⚠️ سامانه روز چهارشنبه از ساعت 14 لغایت ساعت 8.30 روز پنج شنبه به دلیل انتقال به سرور جدید موقتاً قطع خواهد بود.
          </span>

          <button
            onClick={() => setShowNotice(false)}
            style={{
              background: 'transparent',
              border: 'none',
              fontSize: '1.4em',
              cursor: 'pointer',
              color: '#856404',
              marginRight: '12px'
            }}
          >
            ×
          </button>
        </div>
      )}

      {/* لایه غیر فعال‌کننده صفحه وقتی پیام باز است */}
      {showNotice && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(255,255,255,0.7)',
            backdropFilter: 'blur(2px)',
            zIndex: 200,
            pointerEvents: 'auto'
          }}
        />
      )}

      {/* محتوای اصلی صفحه */}
      <div
        style={{
          textAlign: 'center',
          marginBottom: '60px',
          position: 'relative',
          zIndex: 1,
          pointerEvents: showNotice ? 'none' : 'auto'
        }}
      >
        <h1 style={{ fontSize: '36px', marginBottom: '16px', color: '#1f2937' }}>
          سامانه صدور پروانه
        </h1>
        <p style={{ fontSize: '18px', color: '#6b7280' }}>
          سیستم جامع مدیریت و صدور پروانه‌های فعالیت، اشتغال و بهره‌برداری
        </p>
      </div>

      {/* کارت‌ها و سایر بخش‌ها */}
      <>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: '24px',
            marginBottom: '40px',
            position: 'relative',
            zIndex: 1,
            pointerEvents: showNotice ? 'none' : 'auto'
          }}
        >
          <Link to="/licenses/activity/issue" style={{ textDecoration: 'none' }}>
            <div
              style={{
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                padding: '32px',
                borderRadius: '12px',
                color: 'white',
                boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                transition: 'transform 0.2s',
                cursor: 'pointer'
              }}
              onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateY(-4px)')}
              onMouseLeave={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
            >
              <h2 style={{ fontSize: '24px', marginBottom: '12px' }}>پروانه فعالیت</h2>
              <p style={{ fontSize: '16px', opacity: 0.9 }}>
                صدور، تمدید و ابطال پروانه فعالیت
              </p>
            </div>
          </Link>

          <Link to="/licenses/employment/issue" style={{ textDecoration: 'none' }}>
            <div
              style={{
                background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
                padding: '32px',
                borderRadius: '12px',
                color: 'white',
                boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                transition: 'transform 0.2s',
                cursor: 'pointer'
              }}
              onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateY(-4px)')}
              onMouseLeave={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
            >
              <h2 style={{ fontSize: '24px', marginBottom: '12px' }}>پروانه اشتغال</h2>
              <p style={{ fontSize: '16px', opacity: 0.9 }}>صدور و مدیریت پروانه اشتغال</p>
            </div>
          </Link>

          <Link to="/licenses/exploitation/issue" style={{ textDecoration: 'none' }}>
            <div
              style={{
                background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
                padding: '32px',
                borderRadius: '12px',
                color: 'white',
                boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                transition: 'transform 0.2s',
                cursor: 'pointer'
              }}
              onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateY(-4px)')}
              onMouseLeave={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
            >
              <h2 style={{ fontSize: '24px', marginBottom: '12px' }}>پروانه بهره‌برداری</h2>
              <p style={{ fontSize: '16px', opacity: 0.9 }}>
                صدور و مدیریت پروانه بهره‌برداری
              </p>
            </div>
          </Link>
        </div>

        <div
          style={{
            background: '#f9fafb',
            padding: '32px',
            borderRadius: '12px',
            marginBottom: '40px',
            position: 'relative',
            zIndex: 1,
            pointerEvents: showNotice ? 'none' : 'auto'
          }}
        >
          <h2 style={{ fontSize: '24px', marginBottom: '24px', color: '#1f2937' }}>
            دسترسی سریع
          </h2>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '16px'
            }}
          >
            <Link
              to="/licenses"
              style={{
                display: 'block',
                padding: '16px',
                background: 'white',
                borderRadius: '8px',
                textDecoration: 'none',
                color: '#1f2937',
                border: '1px solid #e5e7eb',
                transition: 'all 0.2s'
              }}
            >
              <div style={{ fontSize: '18px', fontWeight: 'bold' }}>پروانه‌های من</div>
              <div style={{ fontSize: '14px', color: '#6b7280', marginTop: '4px' }}>
                مشاهده پروانه‌های صادر شده
              </div>
            </Link>

            <Link
              to="/workflow/inbox"
              style={{
                display: 'block',
                padding: '16px',
                background: 'white',
                borderRadius: '8px',
                textDecoration: 'none',
                color: '#1f2937',
                border: '1px solid #e5e7eb',
                transition: 'all 0.2s'
              }}
            >
              <div style={{ fontSize: '18px', fontWeight: 'bold' }}>کارتابل من</div>
              <div style={{ fontSize: '14px', color: '#6b7280', marginTop: '4px' }}>
                مشاهده درخواست‌ها و وظایف
              </div>
            </Link>

            <Link
              to="/payment"
              style={{
                display: 'block',
                padding: '16px',
                background: 'white',
                borderRadius: '8px',
                textDecoration: 'none',
                color: '#1f2937',
                border: '1px solid #e5e7eb',
                transition: 'all 0.2s'
              }}
            >
              <div style={{ fontSize: '18px', fontWeight: 'bold' }}>پرداخت</div>
              <div style={{ fontSize: '14px', color: '#6b7280', marginTop: '4px' }}>
                پرداخت هزینه‌ها
              </div>
            </Link>

            <Link
              to="/change-password"
              style={{
                display: 'block',
                padding: '16px',
                background: 'white',
                borderRadius: '8px',
                textDecoration: 'none',
                color: '#1f2937',
                border: '1px solid #e5e7eb',
                transition: 'all 0.2s'
              }}
            >
              <div style={{ fontSize: '18px', fontWeight: 'bold' }}>تغییر رمز عبور</div>
              <div style={{ fontSize: '14px', color: '#6b7280', marginTop: '4px' }}>
                تغییر رمز عبور کاربری
              </div>
            </Link>
          </div>
        </div>

        <div
          style={{
            textAlign: 'center',
            color: '#6b7280',
            position: 'relative',
            zIndex: 1,
            pointerEvents: showNotice ? 'none' : 'auto'
          }}
        >
          <p style={{ fontSize: '14px' }}>
            برای دریافت راهنمایی و پشتیبانی با واحد مربوطه تماس بگیرید
          </p>
        </div>
      </>
    </div>
  );
}
