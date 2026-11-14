import React, { useEffect, useState } from 'react'

export default function SitePopup() {
  const [visible, setVisible] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    // Fetch popup settings from server (public endpoint, no auth needed)
    fetch('/api/site-settings/popup')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data && data.enabled && data.message) {
          setMessage(data.message)
          setVisible(true)
        }
      })
      .catch(() => {})
  }, [])

  if (!visible) return null

  return (
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
      onClick={() => setVisible(false)}
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
        {/* Close X button */}
        <button
          onClick={() => setVisible(false)}
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
        <div style={{ fontSize: '36px', marginBottom: '12px', textAlign: 'center' }}>📢</div>

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
          {message}
        </p>

        {/* OK button */}
        <div style={{ textAlign: 'center' }}>
          <button
            onClick={() => setVisible(false)}
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
  )
}
