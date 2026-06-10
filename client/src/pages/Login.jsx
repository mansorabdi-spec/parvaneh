import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { api } from '../lib/api.js'

// ✅ متغیر کنترل فعال/غیرفعال بودن پیام
const ENABLE_NOTICE = false   // false = پیام غیرفعال، true = فعال

export default function Login({ onLoggedIn }) {
  const [form, setForm] = useState({ nationalCode: '', password: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showNotice, setShowNotice] = useState(ENABLE_NOTICE)
  const navigate = useNavigate()

  const submit = async (e) => {
    e.preventDefault()
    if (showNotice) return

    setLoading(true)
    setError('')
    try {
      const { data } = await api.post('/api/auth/login', form)
      onLoggedIn?.(data)
      navigate('/')
    } catch (err) {
      setError(err?.response?.data?.message || 'خطا در ورود')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ maxWidth: '520px', margin: '40px auto', padding: '0 20px', position: 'relative' }}>

      {/* 🔔 پیام هشدار */}
      {showNotice && (
        <div style={{
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
          fontSize: '1.1em',
        }}>
          <span>⚠️ سامانه روز چهارشنبه از ساعت 14 لغایت ساعت 8.30 روز پنج شنبه به دلیل انتقال به سرور جدید موقتاً قطع خواهد بود.</span>
        
          <button
            onClick={() => setShowNotice(false)}
            style={{
              background: 'transparent',
              border: 'none',
              fontSize: '1.4em',
              cursor: 'pointer',
              color: '#856404'
            }}
          >
            ×
          </button>
        </div>
      )}

      {/* کارت فرم */}
      <div style={{
        background: '#fff',
        borderRadius: '16px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
        overflow: 'hidden',
        position: 'relative'
      }}>

        {/* لایه غیر فعال کننده فرم */}
        {showNotice && (
          <div style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(255,255,255,0.7)',
            backdropFilter: 'blur(2px)',
            zIndex: 200
          }}></div>
        )}

        {/* عنوان */}
        <div style={{
          background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
          padding: '24px',
          textAlign: 'center'
        }}>
          <h2 style={{
            color: '#fff',
            fontSize: '2em',
            margin: 0,
            fontWeight: 'bold'
          }}>ورود به سامانه</h2>
        </div>

        <div style={{ padding: '32px', position: 'relative', zIndex: 1 }}>
          <form onSubmit={submit}>

            <div style={{ marginBottom: '24px' }}>
              <label style={{ fontSize: '1.3em', fontWeight: '600', marginBottom: '8px', display: 'block' }}>کد ملی</label>
              <input
                disabled={showNotice}
                type="text"
                maxLength="10"
                value={form.nationalCode}
                onChange={(e) => setForm({ ...form, nationalCode: e.target.value.replace(/\D/g, '') })}
                placeholder="کد ملی ۱۰ رقمی"
                style={{
                  width: '100%',
                  padding: '14px 16px',
                  fontSize: '1.3em',
                  border: '2px solid #e5e7eb',
                  borderRadius: '10px',
                  background: showNotice ? '#f3f4f6' : 'white'
                }}
              />
            </div>

            <div style={{ marginBottom: '32px' }}>
              <label style={{ fontSize: '1.3em', fontWeight: '600', marginBottom: '8px', display: 'block' }}>رمز عبور</label>
              <input
                disabled={showNotice}
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="رمز عبور"
                style={{
                  width: '100%',
                  padding: '14px 16px',
                  fontSize: '1.3em',
                  border: '2px solid #e5e7eb',
                  borderRadius: '10px',
                  background: showNotice ? '#f3f4f6' : 'white'
                }}
              />
            </div>

            <button
              type="submit"
              disabled={showNotice || loading}
              style={{
                width: '100%',
                padding: '16px',
                fontSize: '1.4em',
                fontWeight: 'bold',
                color: '#fff',
                background: showNotice ? '#9ca3af' : 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
                borderRadius: '10px',
                border: 'none',
                cursor: showNotice ? 'not-allowed' : 'pointer'
              }}
            >
              ورود
            </button>

          </form>
        </div>
      </div>
    </div>
  )
}
