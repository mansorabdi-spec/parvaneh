import React, { useState, useRef, useEffect } from 'react'
import DatePicker from 'react-multi-date-picker'
import persian from 'react-date-object/calendars/persian'
import persian_fa from 'react-date-object/locales/persian_fa'

export default function ManualDateInput({ value, onChange, placeholder = 'مثال: 1402/11/25', style = {} }) {
  const [error, setError] = useState('')
  const [showPicker, setShowPicker] = useState(false)
  const wrapperRef = useRef(null)
  const pickerRef = useRef(null)
  
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showPicker && pickerRef.current && !pickerRef.current.contains(event.target) && 
          wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setShowPicker(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showPicker])

  const isValidShamsiDate = (year, month, day) => {
    // Year validation (1300-1500)
    if (year < 1300 || year > 1500) return false
    
    // Month validation (1-12)
    if (month < 1 || month > 12) return false
    
    // Day validation based on month
    if (day < 1) return false
    
    // Months 1-6 have 31 days
    if (month >= 1 && month <= 6) {
      if (day > 31) return false
    }
    // Months 7-11 have 30 days
    else if (month >= 7 && month <= 11) {
      if (day > 30) return false
    }
    // Month 12 (Esfand): 29 or 30 days depending on leap year
    else if (month === 12) {
      const isLeapYear = isLeapYearShamsi(year)
      if (day > (isLeapYear ? 30 : 29)) return false
    }
    
    return true
  }

  const isLeapYearShamsi = (year) => {
    // 33-year cycle: leap years are 1, 5, 9, 13, 17, 22, 26, 30
    const breaks = [1, 5, 9, 13, 17, 22, 26, 30]
    const mod = year % 33
    return breaks.includes(mod)
  }

  const handleInputChange = (e) => {
    let input = e.target.value
    
    // Remove all non-digit characters
    let numbers = input.replace(/[^0-9]/g, '')
    
    // Limit to 8 digits (YYYYMMDD)
    if (numbers.length > 8) {
      numbers = numbers.substring(0, 8)
    }
    
    // Format with slashes
    let formatted = ''
    if (numbers.length > 0) {
      formatted = numbers.substring(0, 4) // Year (4 digits)
      if (numbers.length >= 5) {
        formatted += '/' + numbers.substring(4, 6) // Month (2 digits)
      }
      if (numbers.length >= 7) {
        formatted += '/' + numbers.substring(6, 8) // Day (2 digits)
      }
    }
    
    // Validate if complete date (8 digits)
    if (numbers.length === 8) {
      const yearNum = parseInt(numbers.substring(0, 4))
      const monthNum = parseInt(numbers.substring(4, 6))
      const dayNum = parseInt(numbers.substring(6, 8))
      
      if (!isValidShamsiDate(yearNum, monthNum, dayNum)) {
        setError('تاریخ وارد شده نامعتبر است')
      } else {
        setError('')
      }
    } else {
      setError('')
    }
    
    onChange(formatted)
  }

  const handlePickerChange = (date) => {
    const formatted = date ? date.format('YYYY/MM/DD') : ''
    onChange(formatted)
    setShowPicker(false)
    setError('')
  }

  const handleBlur = () => {
    if (value && value.length > 0 && value.length < 10) {
      setError('فرمت تاریخ باید به صورت 1402/11/25 باشد')
    } else if (value && value.length === 10) {
      const parts = value.split('/')
      if (parts.length === 3) {
        const year = parseInt(parts[0])
        const month = parseInt(parts[1])
        const day = parseInt(parts[2])
        if (!isValidShamsiDate(year, month, day)) {
          setError('تاریخ وارد شده نامعتبر است')
        }
      }
    }
  }

  return (
    <div style={{ display: 'contents' }}>
      <div ref={wrapperRef} className="jdate-input" style={{ position: 'relative', direction: 'ltr', borderColor: error ? '#ef4444' : undefined, ...style }}>
        <input
          type="text"
          value={value || ''}
          onChange={handleInputChange}
          onBlur={handleBlur}
          placeholder="____/__/__"
          style={{
            width: '100%',
            height: '100%',
            border: 'none',
            outline: 'none',
            background: 'transparent',
            padding: 0,
            textAlign: 'center',
            font: 'inherit',
            color: 'inherit'
          }}
          maxLength={10}
        />
        <span
          onMouseDown={(e) => {
            e.preventDefault()
            e.stopPropagation()
            setShowPicker(true)
          }}
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
          }}
          style={{
            position: 'absolute',
            left: '6px',
            top: '50%',
            transform: 'translateY(-50%)',
            padding: '4px',
            cursor: 'pointer',
            fontSize: '16px',
            lineHeight: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: 0.6,
            transition: 'opacity 0.2s',
            zIndex: 1,
            userSelect: 'none'
          }}
          onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
          onMouseLeave={(e) => e.currentTarget.style.opacity = '0.6'}
          title="انتخاب از تقویم"
        >
          📅
        </span>
      </div>
      {showPicker && (
        <div 
          ref={pickerRef}
          style={{ 
            position: 'fixed',
            top: wrapperRef.current ? wrapperRef.current.getBoundingClientRect().bottom + 4 : 0,
            left: wrapperRef.current ? wrapperRef.current.getBoundingClientRect().left : 0,
            zIndex: 9999,
            background: 'white',
            boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
            borderRadius: '8px'
          }}
        >
          <DatePicker
            value={value || ''}
            onChange={handlePickerChange}
            calendar={persian}
            locale={persian_fa}
            format="YYYY/MM/DD"
            inline
          />
        </div>
      )}
      {error && (
        <div style={{ 
          color: '#ef4444', 
          fontSize: '12px', 
          marginTop: '4px',
          fontFamily: 'IRANSans, Tahoma, sans-serif',
          gridColumn: '1 / -1'
        }}>
          {error}
        </div>
      )}
    </div>
  )
}
