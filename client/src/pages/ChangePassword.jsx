import React, { useState } from 'react'
import { api } from '../lib/api.js'

export default function ChangePassword() {
  const [form, setForm] = useState({ currentPassword: '', newPassword: '' })
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const submit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')
    setError('')
    try {
      await api.post('/api/auth/change-password', form)
      setMessage('رمز عبور با موفقیت تغییر کرد')
      setForm({ currentPassword: '', newPassword: '' })
    } catch (err) {
      setError(err?.response?.data?.message || 'خطا در تغییر رمز عبور')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ maxWidth: '520px', margin: '40px auto', padding: '0 20px' }}>
      <div style={{ 
        background: '#fff', 
        borderRadius: '16px', 
        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
        overflow: 'hidden'
      }}>
        {/* Title Header */}
        <div style={{ 
          background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
          padding: '24px',
          textAlign: 'center'
        }}>
          <h2 style={{ 
            color: '#fff', 
            fontSize: '2em', 
            margin: 0,
            fontWeight: 'bold'
          }}>تغییر رمز عبور</h2>
        </div>

        {/* Form Content */}
        <div style={{ padding: '32px' }}>
          <form onSubmit={submit}>
            {/* Current Password Field */}
            <div style={{ marginBottom: '24px' }}>
              <label style={{ 
                display: 'block', 
                fontSize: '1.3em', 
                fontWeight: '600',
                color: '#374151',
                marginBottom: '8px'
              }}>رمز عبور فعلی</label>
              <input 
                type="password" 
                value={form.currentPassword} 
                onChange={(e) => setForm({ ...form, currentPassword: e.target.value })}
                placeholder="رمز عبور فعلی خود را وارد کنید"
                style={{
                  width: '100%',
                  padding: '14px 16px',
                  fontSize: '1.3em',
                  border: '2px solid #e5e7eb',
                  borderRadius: '10px',
                  transition: 'all 0.3s',
                  outline: 'none'
                }}
                onFocus={(e) => e.target.style.borderColor = '#f093fb'}
                onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
              />
            </div>

            {/* New Password Field */}
            <div style={{ marginBottom: '32px' }}>
              <label style={{ 
                display: 'block', 
                fontSize: '1.3em', 
                fontWeight: '600',
                color: '#374151',
                marginBottom: '8px'
              }}>رمز عبور جدید</label>
              <input 
                type="password" 
                value={form.newPassword} 
                onChange={(e) => setForm({ ...form, newPassword: e.target.value })}
                placeholder="رمز عبور جدید خود را وارد کنید"
                style={{
                  width: '100%',
                  padding: '14px 16px',
                  fontSize: '1.3em',
                  border: '2px solid #e5e7eb',
                  borderRadius: '10px',
                  transition: 'all 0.3s',
                  outline: 'none'
                }}
                onFocus={(e) => e.target.style.borderColor = '#f093fb'}
                onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
              />
            </div>

            {/* Submit Button */}
            <button 
              type="submit" 
              disabled={loading || !form.currentPassword || !form.newPassword}
              style={{
                width: '100%',
                padding: '16px',
                fontSize: '1.4em',
                fontWeight: 'bold',
                color: '#fff',
                background: loading || !form.currentPassword || !form.newPassword 
                  ? '#9ca3af' 
                  : 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
                border: 'none',
                borderRadius: '10px',
                cursor: loading || !form.currentPassword || !form.newPassword ? 'not-allowed' : 'pointer',
                transition: 'all 0.3s',
                boxShadow: '0 4px 6px rgba(240, 147, 251, 0.3)',
                marginTop: 0
              }}
              onMouseEnter={(e) => {
                if (!loading && form.currentPassword && form.newPassword) {
                  e.target.style.transform = 'translateY(-2px)';
                  e.target.style.boxShadow = '0 6px 12px rgba(240, 147, 251, 0.4)';
                }
              }}
              onMouseLeave={(e) => {
                e.target.style.transform = 'translateY(0)';
                e.target.style.boxShadow = '0 4px 6px rgba(240, 147, 251, 0.3)';
              }}
            >
              {loading ? 'در حال تغییر...' : 'تغییر رمز'}
            </button>

            {/* Success Message */}
            {message && (
              <div style={{ 
                marginTop: '16px',
                padding: '12px',
                background: '#d1fae5',
                border: '1px solid #a7f3d0',
                borderRadius: '8px',
                color: '#065f46',
                fontSize: '1.2em',
                textAlign: 'center'
              }}>
                {message}
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div style={{ 
                marginTop: '16px',
                padding: '12px',
                background: '#fee2e2',
                border: '1px solid #fecaca',
                borderRadius: '8px',
                color: '#dc2626',
                fontSize: '1.2em',
                textAlign: 'center'
              }}>
                {error}
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  )
}
