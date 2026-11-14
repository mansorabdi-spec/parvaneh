import React, { useEffect, useState } from 'react'

function isValidNationalCode(code) {
  if (!/^\d{10}$/.test(code)) return false
  const check = +code[9]
  let sum = 0
  for (let i = 0; i < 9; i++) {
    sum += +code[i] * (10 - i)
  }
  sum %= 11
  const checkDigit = sum < 2 ? sum : 11 - sum
  return check === checkDigit
}

function toFarsiDigits(value) {
  if (value === null || value === undefined) return ''
  const farsi = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹']
  return String(value).replace(/\d/g, (d) => farsi[Number(d)])
}

function formatAmount(amount) {
  const n = Number(amount) || 0
  return toFarsiDigits(n.toLocaleString('en-US'))
}

async function postPos(path, body) {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(210000)
  })
  const data = await res.json().catch(() => ({}))
  return { ok: res.ok, status: res.status, data }
}

export default function Kiosk() {
  const [nationalCode, setNationalCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [busyId, setBusyId] = useState(null)
  const [posStatus, setPosStatus] = useState(null)
  const [banner, setBanner] = useState(null)
  const [device, setDevice] = useState({ host: '', port: '17000', paired: false })
  const [pairCode, setPairCode] = useState('')
  const [deviceNote, setDeviceNote] = useState('')
  const [deviceBusy, setDeviceBusy] = useState(false)

  useEffect(() => {
    fetch('/api/kiosk/pos/settings')
      .then((res) => res.json())
      .then((data) => {
        if (data?.host == null && data?.port == null) return
        setDevice({
          host: data.host || '',
          port: String(data.port || 17000),
          paired: Boolean(data.paired)
        })
      })
      .catch(() => {})
  }, [])

  const loadUnpaid = async (code) => {
    const res = await fetch(`/api/kiosk/unpaid/${code}`)
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      setError(data.message || 'خطا در دریافت اطلاعات')
      return null
    }
    setResult(data)
    return data
  }

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setResult(null)
    setBanner(null)
    setPosStatus(null)

    if (!nationalCode) {
      setError('کد ملی الزامی است')
      return
    }
    if (nationalCode.length !== 10) {
      setError('کد ملی باید ۱۰ رقم باشد')
      return
    }
    if (!isValidNationalCode(nationalCode)) {
      setError('کد ملی معتبر نمی‌باشد')
      return
    }

    setLoading(true)
    try {
      await loadUnpaid(nationalCode)
    } catch {
      setError('خطا در برقراری ارتباط با سرور')
    } finally {
      setLoading(false)
    }
  }

  const saveDevice = async () => {
    setDeviceNote('')
    setDeviceBusy(true)
    try {
      const { ok, data } = await postPos('/api/kiosk/pos/settings', {
        host: device.host.trim(),
        port: Number(device.port)
      })
      setDevice((prev) => ({
        ...prev,
        host: data.host || prev.host,
        port: String(data.port || prev.port),
        paired: Boolean(data.paired)
      }))
      setDeviceNote(data.message || (ok ? 'آدرس ذخیره شد' : 'آدرس ذخیره نشد'))
    } catch {
      setDeviceNote('ذخیرهٔ آدرس کارتخوان انجام نشد')
    } finally {
      setDeviceBusy(false)
    }
  }

  const requestPairCode = async () => {
    setDeviceNote('')
    setDeviceBusy(true)
    try {
      const { data } = await postPos('/api/kiosk/pos/pair', {})
      setDeviceNote(data.message || 'کد روی کارتخوان را وارد کنید')
    } catch {
      setDeviceNote('ارتباط با کارتخوان برای گرفتن کد برقرار نشد')
    } finally {
      setDeviceBusy(false)
    }
  }

  const confirmPairCode = async () => {
    setDeviceNote('')
    setDeviceBusy(true)
    try {
      const { ok, data } = await postPos('/api/kiosk/pos/pair/confirm', { code: pairCode })
      if (ok && data.ok) {
        setDevice((prev) => ({ ...prev, paired: true }))
        setPairCode('')
      }
      setDeviceNote(data.message || 'جفت‌سازی انجام نشد')
    } catch {
      setDeviceNote('تأیید کد جفت‌سازی انجام نشد')
    } finally {
      setDeviceBusy(false)
    }
  }

  const applyPosResult = async (item, data) => {
    if (data.needsPairing) {
      setDevice((prev) => ({ ...prev, paired: false }))
    }
    if (data.outcome === 'success' || data.paid) {
      const reference = data.rrn ? ` شماره مرجع: ${toFarsiDigits(data.rrn)}` : ''
      setBanner({
        tone: 'success',
        text: `${data.printFailed ? 'پرداخت انجام شد اما رسید چاپ نشد.' : 'پرداخت با موفقیت انجام شد.'}${reference}`
      })
      setPosStatus(null)
      try {
        await loadUnpaid(nationalCode)
      } catch {
        setError('پرداخت ثبت شد، اما فهرست پرونده‌ها تازه نشد')
      }
      return
    }
    setPosStatus({
      requestId: item.requestId,
      tone: data.outcome === 'unknown' || data.shouldInquiry ? 'warn' : 'error',
      text: data.message || 'پرداخت انجام نشد',
      transactionId: data.transactionId || null,
      shouldInquiry: Boolean(data.shouldInquiry),
      shouldRetry: data.shouldRetry !== false && data.outcome !== 'unknown'
    })
  }

  const payWithPos = async (item) => {
    setError('')
    setBanner(null)
    setBusyId(item.requestId)
    setPosStatus({
      requestId: item.requestId,
      tone: 'wait',
      text: `در حال فرستادن مبلغ ${formatAmount(item.payableAmount)} ریال. اگر مبلغ روی کارتخوان آمد، کارت را بکشید و رمز را وارد کنید.`,
      shouldInquiry: false,
      shouldRetry: false
    })
    try {
      const { data } = await postPos('/api/kiosk/pos/purchase', {
        nationalCode,
        requestId: item.requestId
      })
      await applyPosResult(item, data)
    } catch {
      setPosStatus({
        requestId: item.requestId,
        tone: 'warn',
        text: 'پاسخ سرور نرسید. اگر مبلغ روی کارتخوان نیامده، پرداخت را دوباره بزنید. اگر آمده، خرید را تکرار نکنید و استعلام بگیرید.',
        shouldInquiry: false,
        shouldRetry: false
      })
    } finally {
      setBusyId(null)
    }
  }

  const inquirePos = async (item) => {
    if (!posStatus?.transactionId) return
    setBusyId(item.requestId)
    setPosStatus((prev) => ({
      ...prev,
      tone: 'wait',
      text: 'در حال استعلام آخرین وضعیت دستگاه...'
    }))
    try {
      const { data } = await postPos('/api/kiosk/pos/inquiry', {
        nationalCode,
        transactionId: posStatus.transactionId
      })
      await applyPosResult(item, data)
    } catch {
      setPosStatus({
        requestId: item.requestId,
        tone: 'warn',
        text: 'استعلام انجام نشد. پرداخت را تکرار نکنید و کمی بعد دوباره استعلام بگیرید.',
        transactionId: posStatus.transactionId,
        shouldInquiry: true,
        shouldRetry: false
      })
    } finally {
      setBusyId(null)
    }
  }

  const reset = () => {
    setNationalCode('')
    setError('')
    setResult(null)
    setBanner(null)
    setPosStatus(null)
    setBusyId(null)
  }

  const hasUnpaid = result?.items?.length > 0

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        background: 'linear-gradient(160deg, #e8f4fd 0%, #f0f7ff 45%, #ffffff 100%)',
        direction: 'rtl'
      }}
    >
      <div style={{ width: '100%', maxWidth: hasUnpaid ? '560px' : '480px' }}>
        <div style={{ textAlign: 'center', marginBottom: '28px', background: '#000', borderRadius: '16px', padding: '20px' }}>
          <img
            src="/logo/Logo.png"
            alt="Logo"
            style={{ height: '110px', marginBottom: '12px' }}
          />
          <h1 style={{ margin: 0, fontSize: '2em', color: '#fff', fontWeight: 'bold' }}>
            سامانه صدور پروانه
          </h1>
    
        </div>

        <div
          style={{
            background: '#fff',
            borderRadius: '16px',
            boxShadow: '0 8px 24px rgba(15, 23, 42, 0.08)',
            overflow: 'hidden'
          }}
        >
          <div
            style={{
              background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
              padding: '22px',
              textAlign: 'center'
            }}
          >
            <h2 style={{ color: '#fff', fontSize: '1.5em', margin: 0, fontWeight: 'bold' }}>
              {result ? 'وضعیت پرداخت' : 'شناسایی کاربر'}
            </h2>
          </div>

          <div style={{ padding: '28px 32px 32px' }}>
            <div
              style={{
                marginBottom: '22px',
                padding: '14px 16px',
                border: '1px solid #dbeafe',
                borderRadius: '12px',
                background: '#f8fbff'
              }}
            >
              <div style={{ fontWeight: 700, color: '#1e3a8a', marginBottom: '8px' }}>
                دستگاه پوز
                <span style={{ fontWeight: 600, color: device.paired ? '#047857' : '#c2410c', marginRight: '8px' }}>
                  {device.paired ? 'جفت شده' : 'جفت نشده'}
                </span>
              </div>
              <div style={{ color: '#475569', fontSize: '0.92em', marginBottom: '10px', lineHeight: 1.7 }}>
                حالت دستگاه باید HTTP و پروتکل Asanpardakht CSV باشد. پورت را از تنظیمات PC-POS خود کارتخوان بردارید. در راهنمای شرکت نمونهٔ آن ۱۷۰۰۰ است، نه ۸۰.
              </div>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                <input
                  type="text"
                  value={device.host}
                  onChange={(e) => setDevice((prev) => ({ ...prev, host: e.target.value.trim() }))}
                  placeholder="آی‌پی کارتخوان"
                  style={{ flex: 1, padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                />
                <input
                  type="text"
                  inputMode="numeric"
                  value={device.port}
                  onChange={(e) => setDevice((prev) => ({ ...prev, port: e.target.value.replace(/\D/g, '').slice(0, 5) }))}
                  placeholder="پورت"
                  style={{ width: '96px', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', textAlign: 'center' }}
                />
              </div>
              <button
                type="button"
                disabled={deviceBusy}
                onClick={saveDevice}
                style={{ width: '100%', marginBottom: '8px', padding: '10px', border: 'none', borderRadius: '8px', background: '#1d4ed8', color: '#fff', fontWeight: 700, cursor: 'pointer' }}
              >
                ذخیرهٔ آدرس
              </button>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  disabled={deviceBusy}
                  onClick={requestPairCode}
                  style={{ flex: 1, padding: '10px', border: 'none', borderRadius: '8px', background: '#0f766e', color: '#fff', fontWeight: 700, cursor: 'pointer' }}
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
                  style={{ width: '120px', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', textAlign: 'center' }}
                />
                <button
                  type="button"
                  disabled={deviceBusy || pairCode.length !== 6}
                  onClick={confirmPairCode}
                  style={{ padding: '10px 12px', border: 'none', borderRadius: '8px', background: pairCode.length === 6 ? '#047857' : '#9ca3af', color: '#fff', fontWeight: 700, cursor: 'pointer' }}
                >
                  تأیید
                </button>
              </div>
              {deviceNote && (
                <div style={{ marginTop: '10px', color: '#1e293b', fontSize: '0.95em', lineHeight: 1.6 }}>
                  {deviceNote}
                </div>
              )}
            </div>
            {!result && (
              <form onSubmit={submit}>
                <div style={{ marginBottom: '20px' }}>
                  <label
                    style={{
                      fontSize: '1.2em',
                      fontWeight: 600,
                      marginBottom: '8px',
                      display: 'block',
                      color: '#334155'
                    }}
                  >
                    کد ملی
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    autoFocus
                    maxLength={10}
                    value={nationalCode}
                    onChange={(e) => {
                      setNationalCode(e.target.value.replace(/\D/g, ''))
                      setError('')
                    }}
                    placeholder="کد ملی ۱۰ رقمی"
                    style={{
                      width: '100%',
                      padding: '16px 18px',
                      fontSize: '1.4em',
                      letterSpacing: '0.08em',
                      textAlign: 'center',
                      border: `2px solid ${error ? '#f87171' : '#e5e7eb'}`,
                      borderRadius: '12px',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>

                {error && (
                  <div
                    style={{
                      marginBottom: '16px',
                      padding: '12px 14px',
                      background: '#fef2f2',
                      color: '#b91c1c',
                      borderRadius: '10px',
                      fontSize: '1.05em',
                      textAlign: 'center'
                    }}
                  >
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    width: '100%',
                    padding: '16px',
                    fontSize: '1.35em',
                    fontWeight: 'bold',
                    color: '#fff',
                    background: loading
                      ? '#9ca3af'
                      : 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
                    borderRadius: '12px',
                    border: 'none',
                    cursor: loading ? 'not-allowed' : 'pointer'
                  }}
                >
                  {loading ? 'در حال بررسی...' : 'ادامه'}
                </button>
              </form>
            )}

            {result && (
              <div>
                {result.fullName && (
                  <div style={{ textAlign: 'center', marginBottom: '18px', color: '#334155', fontSize: '1.15em' }}>
                    {result.fullName}
                    <div style={{ color: '#64748b', fontSize: '0.95em', marginTop: '4px' }}>
                      کد ملی: {toFarsiDigits(result.nationalCode)}
                    </div>
                  </div>
                )}

                {!hasUnpaid && (
                  <div
                    style={{
                      padding: '16px',
                      background: '#ecfdf5',
                      color: '#047857',
                      borderRadius: '12px',
                      textAlign: 'center',
                      fontSize: '1.1em',
                      marginBottom: '20px'
                    }}
                  >
                    {result.message || 'پرونده پرداخت‌نشده‌ای وجود ندارد'}
                  </div>
                )}

                {banner && (
                  <div
                    style={{
                      padding: '14px 16px',
                      background: banner.tone === 'success' ? '#ecfdf5' : '#fff7ed',
                      color: banner.tone === 'success' ? '#047857' : '#c2410c',
                      borderRadius: '12px',
                      textAlign: 'center',
                      fontSize: '1.05em',
                      marginBottom: '16px',
                      fontWeight: 700
                    }}
                  >
                    {banner.text}
                  </div>
                )}

                {hasUnpaid && (
                  <>
                    <div
                      style={{
                        padding: '14px 16px',
                        background: '#fff7ed',
                        color: '#c2410c',
                        borderRadius: '12px',
                        textAlign: 'center',
                        fontSize: '1.05em',
                        marginBottom: '16px',
                        fontWeight: 600
                      }}
                    >
                      {toFarsiDigits(result.items.length)} پرونده پرداخت‌نشده
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '18px' }}>
                      {result.items.map((item) => (
                        <div
                          key={item.requestId}
                          style={{
                            border: '1px solid #e2e8f0',
                            borderRadius: '12px',
                            padding: '14px 16px',
                            background: '#f8fafc'
                          }}
                        >
                          <div style={{ fontWeight: 700, color: '#1e293b', marginBottom: '6px' }}>
                            {item.licenseTypeName}
                            {item.operationTypeName ? ` — ${item.operationTypeName}` : ''}
                          </div>
                          <div style={{ color: '#64748b', fontSize: '0.95em', marginBottom: '10px' }}>
                            شماره پیگیری: {toFarsiDigits(item.trackingNo)}
                          </div>
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              gap: '12px'
                            }}
                          >
                            <span style={{ color: '#475569' }}>مبلغ قابل پرداخت</span>
                            <span style={{ fontWeight: 800, fontSize: '1.25em', color: '#0f766e' }}>
                              {formatAmount(item.payableAmount)} ریال
                            </span>
                          </div>
                          <div style={{ marginTop: '12px' }}>
                            {posStatus?.requestId === item.requestId && (
                              <div
                                style={{
                                  marginBottom: '10px',
                                  padding: '12px',
                                  borderRadius: '10px',
                                  textAlign: 'center',
                                  fontWeight: 600,
                                  background: posStatus.tone === 'wait' ? '#eff6ff' : posStatus.tone === 'warn' ? '#fff7ed' : '#fef2f2',
                                  color: posStatus.tone === 'wait' ? '#1d4ed8' : posStatus.tone === 'warn' ? '#c2410c' : '#b91c1c'
                                }}
                              >
                                {posStatus.text}
                              </div>
                            )}
                            {posStatus?.requestId === item.requestId && posStatus.shouldInquiry ? (
                              <button
                                type="button"
                                disabled={busyId != null}
                                onClick={() => inquirePos(item)}
                                style={{
                                  width: '100%',
                                  padding: '12px',
                                  fontSize: '1.1em',
                                  fontWeight: '600',
                                  color: '#fff',
                                  background: busyId != null ? '#9ca3af' : 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                                  borderRadius: '10px',
                                  border: 'none',
                                  cursor: busyId != null ? 'not-allowed' : 'pointer'
                                }}
                              >
                                {busyId === item.requestId ? 'در حال استعلام...' : 'استعلام وضعیت پرداخت'}
                              </button>
                            ) : (
                              <button
                                type="button"
                                disabled={busyId != null}
                                onClick={() => payWithPos(item)}
                                style={{
                                  width: '100%',
                                  padding: '12px',
                                  fontSize: '1.1em',
                                  fontWeight: '600',
                                  color: '#fff',
                                  background: busyId != null
                                    ? '#9ca3af'
                                    : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                                  borderRadius: '10px',
                                  border: 'none',
                                  cursor: busyId != null ? 'not-allowed' : 'pointer'
                                }}
                              >
                                {busyId === item.requestId ? 'در حال ارتباط با دستگاه...' : 'پرداخت با دستگاه پوز'}
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    <div
                      style={{
                        padding: '16px 18px',
                        background: 'linear-gradient(135deg, #0ea5e9 0%, #06b6d4 100%)',
                        borderRadius: '12px',
                        color: '#fff',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: '20px'
                      }}
                    >
                      <span style={{ fontSize: '1.1em', fontWeight: 600 }}>جمع کل</span>
                      <span style={{ fontSize: '1.45em', fontWeight: 800 }}>
                        {formatAmount(result.totalPayable)} ریال
                      </span>
                    </div>
                  </>
                )}

                <button
                  type="button"
                  onClick={reset}
                  style={{
                    width: '100%',
                    padding: '14px',
                    fontSize: '1.15em',
                    fontWeight: 600,
                    color: '#0369a1',
                    background: '#e0f2fe',
                    borderRadius: '12px',
                    border: 'none',
                    cursor: 'pointer'
                  }}
                >
                خروج
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
