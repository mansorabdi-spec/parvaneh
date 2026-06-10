import React, { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { api } from '../lib/api.js'

export default function Register({ onLoggedIn }) {
  const [form, setForm] = useState({ 
    nationalCode: '', 
    password: '', 
    confirmPassword: '',
    firstName: '', 
    lastName: '', 
    mobile: '', 
    email: '',
    profilePicture: null 
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [errors, setErrors] = useState({})
  const [previewUrl, setPreviewUrl] = useState(null)
  const navigate = useNavigate()

  // Debug: Log form validity state
  useEffect(() => {
    console.log('Form state:', form);
    console.log('Errors state:', errors);
    console.log('Is form valid:', isFormValid());
  }, [form, errors]);

  const handleImageChange = (e) => {
    const file = e.target.files?.[0]
    if (file) {
      // Validate file size (max 2MB)
      if (file.size > 2 * 1024 * 1024) {
        setError('حجم تصویر نباید بیشتر از 2 مگابایت باشد')
        return
      }
      
      // Validate file type
      if (!file.type.startsWith('image/')) {
        setError('فقط فایل‌های تصویری مجاز هستند')
        return
      }

      const reader = new FileReader()
      reader.onloadend = () => {
        setForm({ ...form, profilePicture: reader.result })
        setPreviewUrl(reader.result)
      }
      reader.readAsDataURL(file)
    }
  }

  const validateField = (name, value) => {
    switch (name) {
      case 'nationalCode':
        return value ? '' : 'کد ملی الزامی است';
      case 'password':
        return value ? '' : 'رمز عبور الزامی است';
      case 'confirmPassword':
        if (!value) return 'تکرار رمز عبور الزامی است';
        if (form.password && value !== form.password) return 'رمز عبور و تکرار آن باید یکسان باشند';
        return '';
      case 'firstName':
        return value ? '' : 'نام الزامی است';
      case 'lastName':
        return value ? '' : 'نام خانوادگی الزامی است';
      case 'mobile':
        if (!value) return 'شماره موبایل الزامی است';
        if (!/^09\d{9}$/.test(value)) return 'شماره موبایل معتبر وارد کنید (مثال: 09123456789)';
        return '';
      default:
        return '';
    }
  };

  const validateForm = () => {
    const requiredFields = ['nationalCode', 'password', 'confirmPassword', 'firstName', 'lastName', 'mobile'];
    const newErrors = {};
    
    requiredFields.forEach(field => {
      const error = validateField(field, form[field]);
      if (error) {
        newErrors[field] = error;
      }
    });
    
    // Special case for password match
    if (form.password && form.confirmPassword && form.password !== form.confirmPassword) {
      newErrors.confirmPassword = 'رمز عبور و تکرار آن باید یکسان باشند';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  const isFormValid = () => {
    // Check all required fields are filled
    if (!form.nationalCode || form.nationalCode.length !== 10) return false;
    if (!form.password) return false;
    if (!form.confirmPassword) return false;
    if (!form.firstName) return false;
    if (!form.lastName) return false;
    if (!form.mobile) return false;
    
    // Check mobile format
    if (!/^09\d{9}$/.test(form.mobile)) return false;
    
    // Check passwords match
    if (form.password !== form.confirmPassword) return false;
    
    // Check if there are any actual error messages (not empty strings)
    const hasErrors = Object.values(errors).some(error => error && error.length > 0);
    if (hasErrors) return false;
    
    return true;
  };

  const submit = async (e) => {
    e.preventDefault()
    
    // Validate all fields on submit and show errors
    const isValid = validateForm()
    
    if (!isValid) {
      // Show a general error message
      setError('لطفاً تمام فیلدهای الزامی را به درستی پر کنید');
      
      // Scroll to the first error field after a short delay to allow state update
      setTimeout(() => {
        const firstErrorField = document.querySelector('input[style*="rgb(239, 68, 68)"]');
        if (firstErrorField) {
          firstErrorField.scrollIntoView({ behavior: 'smooth', block: 'center' });
          firstErrorField.focus();
        }
      }, 100);
      return
    }
    
    setLoading(true)
    setError('')
    try {
      const payload = { 
        nationalCode: form.nationalCode,
        password: form.password,
        firstName: form.firstName,
        lastName: form.lastName,
        mobile: form.mobile || null,
        email: form.email || null,
        profilePicture: form.profilePicture || null,
        role: 'User' 
      }
      const { data } = await api.post('/api/auth/register', payload)
      onLoggedIn?.(data)
      navigate('/')
    } catch (err) {
      setError(err?.response?.data?.message || 'خطا در ثبت‌نام')
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
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          padding: '24px',
          textAlign: 'center'
        }}>
          <h2 style={{ 
            color: '#fff', 
            fontSize: '2em', 
            margin: 0,
            fontWeight: 'bold'
          }}>ثبت‌نام</h2>
        </div>

        {/* Form Content */}
        <div style={{ padding: '32px' }}>
          <form onSubmit={submit}>
            {/* National Code Field */}
            <div style={{ marginBottom: '24px' }}>
              <label style={{ 
                display: 'block', 
                fontSize: '1.3em', 
                fontWeight: '600',
                color: '#374151',
                marginBottom: '8px'
              }}>کد ملی *</label>
              <input
                type="tel"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength="10"
                value={form.nationalCode}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, '');
                  if (value.length <= 10) {
                    setForm({ ...form, nationalCode: value });
                  }
                }}
                placeholder="کد ملی ۱۰ رقمی"
                style={{
                  width: '100%',
                  padding: '14px 16px',
                  fontSize: '1.3em',
                  border: '2px solid #e5e7eb',
                  borderRadius: '10px',
                  transition: 'all 0.3s',
                  outline: 'none'
                }}
                onFocus={(e) => e.target.style.borderColor = '#667eea'}
                onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
              />
            </div>

            {/* First Name Field */}
            <div style={{ marginBottom: '24px' }}>
              <label style={{ 
                display: 'block', 
                fontSize: '1.3em', 
                fontWeight: '600',
                color: '#374151',
                marginBottom: '8px'
              }}>نام *</label>
              <input 
                value={form.firstName} 
                onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                placeholder="نام خود را وارد کنید"
                style={{
                  width: '100%',
                  padding: '14px 16px',
                  fontSize: '1.3em',
                  border: '2px solid #e5e7eb',
                  borderRadius: '10px',
                  transition: 'all 0.3s',
                  outline: 'none'
                }}
                onFocus={(e) => e.target.style.borderColor = '#667eea'}
                onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
              />
            </div>

            {/* Last Name Field */}
            <div style={{ marginBottom: '24px' }}>
              <label style={{ 
                display: 'block', 
                fontSize: '1.3em', 
                fontWeight: '600',
                color: '#374151',
                marginBottom: '8px'
              }}>نام خانوادگی *</label>
              <input 
                value={form.lastName} 
                onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                placeholder="نام خانوادگی خود را وارد کنید"
                style={{
                  width: '100%',
                  padding: '14px 16px',
                  fontSize: '1.3em',
                  border: '2px solid #e5e7eb',
                  borderRadius: '10px',
                  transition: 'all 0.3s',
                  outline: 'none'
                }}
                onFocus={(e) => e.target.style.borderColor = '#667eea'}
                onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
              />
            </div>

            {/* Mobile Field */}
            <div style={{ marginBottom: '24px' }}>
              <label style={{ 
                display: 'block', 
                fontSize: '1.3em', 
                fontWeight: '600',
                color: '#374151',
                marginBottom: '8px'
              }}>شماره موبایل *</label>
              <input
                type="tel"
                value={form.mobile} 
                onChange={(e) => {
                  const value = e.target.value;
                  // Only allow numbers and limit to 11 digits
                  if (value === '' || /^\d{0,11}$/.test(value)) {
                    setForm(prev => ({ ...prev, mobile: value }));
                    
                    // Clear error when user starts typing
                    if (errors.mobile) {
                      setErrors(prev => ({ ...prev, mobile: '' }));
                    }
                    
                    // Validate in real-time when we have 11 digits
                    if (value.length === 11) {
                      if (!/^09\d{9}$/.test(value)) {
                        setErrors(prev => ({ ...prev, mobile: 'شماره موبایل معتبر نیست (مثال: 09123456789)' }));
                      }
                    }
                  }
                }}
                placeholder="09123456789"
                style={{
                  width: '100%',
                  padding: '14px 16px',
                  fontSize: '1.3em',
                  border: `2px solid ${errors.mobile ? '#ef4444' : '#e5e7eb'}`,
                  borderRadius: '10px',
                  transition: 'all 0.3s',
                  outline: 'none',
                  direction: 'ltr',
                  textAlign: 'left'
                }}
                onFocus={(e) => e.target.style.borderColor = errors.mobile ? '#ef4444' : '#667eea'}
                onBlur={(e) => {
                  e.target.style.borderColor = errors.mobile ? '#ef4444' : '#e5e7eb';
                  // Validate on blur if field isn't empty
                  if (form.mobile) {
                    if (!/^09\d{9}$/.test(form.mobile)) {
                      setErrors(prev => ({ ...prev, mobile: 'شماره موبایل معتبر نیست (مثال: 09123456789)' }));
                    }
                  }
                }}
              />
              {errors.mobile && (
                <p style={{ color: '#ef4444', fontSize: '0.9em', marginTop: '4px' }}>{errors.mobile}</p>
              )}
            </div>

            {/* Email Field (Optional) */}
            <div style={{ marginBottom: '24px' }}>
              <label style={{ 
                display: 'block', 
                fontSize: '1.3em', 
                fontWeight: '600',
                color: '#374151',
                marginBottom: '8px'
              }}>ایمیل <span style={{ color: '#9ca3af', fontSize: '0.9em' }}>(اختیاری)</span></label>
              <input 
                type="email" 
                value={form.email} 
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="example@email.com"
                style={{
                  width: '100%',
                  padding: '14px 16px',
                  fontSize: '1.3em',
                  border: '2px solid #e5e7eb',
                  borderRadius: '10px',
                  transition: 'all 0.3s',
                  outline: 'none'
                }}
                onFocus={(e) => e.target.style.borderColor = '#667eea'}
                onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
              />
            </div>

            {/* Password Field */}
            <div style={{ marginBottom: '24px' }}>
              <label style={{ 
                display: 'block', 
                fontSize: '1.3em', 
                fontWeight: '600',
                color: '#374151',
                marginBottom: '8px'
              }}>رمز عبور *</label>
              <input 
                type="password"
                autoComplete="new-password"
                value={form.password} 
                onChange={(e) => {
                  const newValue = e.target.value;
                  setForm(prev => ({ ...prev, password: newValue }));
                  
                  // Clear password error
                  setErrors(prev => ({ ...prev, password: '' }));
                  
                  // If there's a confirm password value, validate it against the new password
                  if (form.confirmPassword) {
                    const confirmError = newValue !== form.confirmPassword 
                      ? 'رمز عبور و تکرار آن باید یکسان باشند' 
                      : '';
                    setErrors(prev => ({ ...prev, confirmPassword: confirmError }));
                  }
                }}
                placeholder="رمز عبور خود را وارد کنید"
                style={{
                  width: '100%',
                  padding: '14px 16px',
                  fontSize: '1.3em',
                  border: `2px solid ${errors.password ? '#ef4444' : '#e5e7eb'}`,
                  borderRadius: '10px',
                  transition: 'all 0.3s',
                  outline: 'none'
                }}
                onFocus={(e) => e.target.style.borderColor = errors.password ? '#ef4444' : '#667eea'}
                onBlur={(e) => e.target.style.borderColor = errors.password ? '#ef4444' : '#e5e7eb'}
              />
              {errors.password && (
                <p style={{ color: '#ef4444', fontSize: '0.9em', marginTop: '4px' }}>{errors.password}</p>
              )}
            </div>

            {/* Confirm Password Field */}
            <div style={{ marginBottom: '32px' }}>
              <label style={{ 
                display: 'block', 
                fontSize: '1.3em', 
                fontWeight: '600',
                color: '#374151',
                marginBottom: '8px'
              }}>تکرار رمز عبور *</label>
              <input 
                type="password"
                autoComplete="new-password"
                value={form.confirmPassword} 
                onChange={(e) => {
                  const newValue = e.target.value;
                  setForm(prev => ({ ...prev, confirmPassword: newValue }));
                  
                  // Validate password match
                  if (form.password) {
                    const error = newValue !== form.password 
                      ? 'رمز عبور و تکرار آن باید یکسان باشند' 
                      : '';
                    setErrors(prev => ({ ...prev, confirmPassword: error }));
                  } else {
                    // Clear error if password field is empty
                    setErrors(prev => ({ ...prev, confirmPassword: '' }));
                  }
                }}
                placeholder="رمز عبور خود را مجدداً وارد کنید"
                style={{
                  width: '100%',
                  padding: '14px 16px',
                  fontSize: '1.3em',
                  border: `2px solid ${errors.confirmPassword ? '#ef4444' : '#e5e7eb'}`,
                  borderRadius: '10px',
                  transition: 'all 0.3s',
                  outline: 'none'
                }}
                onFocus={(e) => e.target.style.borderColor = errors.confirmPassword ? '#ef4444' : '#667eea'}
                onBlur={(e) => e.target.style.borderColor = errors.confirmPassword ? '#ef4444' : '#e5e7eb'}
              />
              {errors.confirmPassword && (
                <p style={{ color: '#ef4444', fontSize: '0.9em', marginTop: '4px' }}>{errors.confirmPassword}</p>
              )}
            </div>

            {/* Profile Picture Field (Optional) */}
            <div style={{ marginBottom: '24px' }}>
              <label style={{ 
                display: 'block', 
                fontSize: '1.3em', 
                fontWeight: '600',
                color: '#374151',
                marginBottom: '8px'
              }}>عکس پرسنلی <span style={{ color: '#9ca3af', fontSize: '0.9em' }}>(اختیاری)</span></label>
              
              <input 
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                style={{ display: 'none' }}
                id="profilePictureInput"
              />
              
              <label 
                htmlFor="profilePictureInput"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '100%',
                  padding: '14px 16px',
                  fontSize: '1.2em',
                  border: '2px dashed #e5e7eb',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  transition: 'all 0.3s',
                  background: '#f9fafb',
                  color: '#6b7280'
                }}
                onMouseEnter={(e) => {
                  e.target.style.borderColor = '#667eea';
                  e.target.style.background = '#f3f4f6';
                }}
                onMouseLeave={(e) => {
                  e.target.style.borderColor = '#e5e7eb';
                  e.target.style.background = '#f9fafb';
                }}
              >
                {previewUrl ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <img 
                      src={previewUrl} 
                      alt="Preview" 
                      style={{ 
                        width: '60px', 
                        height: '60px', 
                        borderRadius: '50%', 
                        objectFit: 'cover',
                        border: '2px solid #667eea'
                      }} 
                    />
                    <span style={{ color: '#667eea', fontWeight: '600' }}>تغییر عکس</span>
                  </div>
                ) : (
                  <span>📷 انتخاب عکس (حداکثر 2 مگابایت)</span>
                )}
              </label>
            </div>

            {/* Submit Button */}
            <button 
              type="submit" 
              disabled={loading || !isFormValid()}
              style={{
                width: '100%',
                padding: '16px',
                fontSize: '1.4em',
                fontWeight: 'bold',
                color: '#fff',
                background: loading || !isFormValid()
                  ? '#9ca3af' 
                  : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                border: 'none',
                borderRadius: '10px',
                cursor: loading || !isFormValid() ? 'not-allowed' : 'pointer',
                transition: 'all 0.3s',
                boxShadow: '0 4px 6px rgba(102, 126, 234, 0.3)',
                marginTop: '16px'
              }}
              onMouseEnter={(e) => {
                if (!loading && isFormValid()) {
                  e.target.style.transform = 'translateY(-2px)';
                  e.target.style.boxShadow = '0 6px 12px rgba(102, 126, 234, 0.4)';
                }
              }}
              onMouseLeave={(e) => {
                e.target.style.transform = 'translateY(0)';
                e.target.style.boxShadow = '0 4px 6px rgba(102, 126, 234, 0.3)';
              }}
            >
              {loading ? 'در حال ثبت‌نام...' : 'ثبت‌نام'}
            </button>

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

          {/* Login Link */}
          <p style={{ 
            marginTop: '24px', 
            textAlign: 'center',
            fontSize: '1.2em',
            color: '#6b7280'
          }}>
            حساب دارید؟{' '}
            <Link 
              to="/login"
              style={{
                color: '#667eea',
                fontWeight: 'bold',
                textDecoration: 'none'
              }}
              onMouseEnter={(e) => e.target.style.textDecoration = 'underline'}
              onMouseLeave={(e) => e.target.style.textDecoration = 'none'}
            >
              ورود
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
