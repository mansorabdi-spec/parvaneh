import React, { useEffect, useMemo, useState } from 'react'
import { api } from '../lib/api.js'

const emptyFilters = {
  licenseTypeId: '',
  operationTypeId: '',
  status: '',
  dateFrom: '',
  dateTo: '',
  search: ''
}

function formatCell(value, type) {
  if (value == null || value === '') return '—'
  if (type === 'date') {
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return String(value)
    return date.toLocaleDateString('fa-IR')
  }
  if (type === 'money' && !Number.isNaN(Number(value))) {
    return Number(value).toLocaleString('fa-IR')
  }
  return String(value)
}

export default function AdminComprehensiveReport() {
  const [meta, setMeta] = useState(null)
  const [selected, setSelected] = useState([])
  const [filters, setFilters] = useState(emptyFilters)
  const [page, setPage] = useState(1)
  const [result, setResult] = useState(null)
  const [loadingMeta, setLoadingMeta] = useState(true)
  const [loadingReport, setLoadingReport] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    loadMeta()
  }, [])

  const loadMeta = async () => {
    try {
      setLoadingMeta(true)
      const { data } = await api.get('/api/reports/comprehensive/meta')
      setMeta(data)
      setSelected((data.fields || []).filter((field) => field.defaultSelected).map((field) => field.key))
      setError('')
    } catch (e) {
      setError(e?.response?.data?.message || 'خطا در بارگذاری گزارش‌ساز')
    } finally {
      setLoadingMeta(false)
    }
  }

  const fieldsByGroup = useMemo(() => {
    const map = {}
    for (const field of meta?.fields || []) {
      if (!map[field.group]) map[field.group] = []
      map[field.group].push(field)
    }
    return map
  }, [meta])

  const toggleField = (key) => {
    setSelected((prev) => prev.includes(key) ? prev.filter((item) => item !== key) : [...prev, key])
  }

  const toggleGroup = (groupKey) => {
    const keys = (fieldsByGroup[groupKey] || []).map((field) => field.key)
    const allOn = keys.every((key) => selected.includes(key))
    setSelected((prev) => {
      if (allOn) return prev.filter((key) => !keys.includes(key))
      return [...new Set([...prev, ...keys])]
    })
  }

  const payload = (pageNumber = page) => ({
    fields: selected,
    filters,
    page: pageNumber,
    pageSize: 25
  })

  const runReport = async (pageNumber = 1) => {
    if (selected.length === 0) {
      setError('حداقل یک فیلد را انتخاب کنید')
      return
    }
    try {
      setLoadingReport(true)
      setError('')
      const { data } = await api.post('/api/reports/comprehensive', payload(pageNumber))
      setResult(data)
      setPage(data.page || pageNumber)
    } catch (e) {
      setError(e?.response?.data?.message || 'خطا در تهیه گزارش')
    } finally {
      setLoadingReport(false)
    }
  }

  const exportExcel = async () => {
    if (selected.length === 0) {
      setError('حداقل یک فیلد را انتخاب کنید')
      return
    }
    try {
      setExporting(true)
      setError('')
      const response = await api.post('/api/reports/comprehensive/export', payload(1), { responseType: 'blob' })
      const blob = new Blob([response.data], { type: 'application/vnd.ms-excel' })
      const link = document.createElement('a')
      link.href = URL.createObjectURL(blob)
      link.download = `گزارش_جامع_${new Date().toISOString().slice(0, 10)}.xls`
      link.click()
      URL.revokeObjectURL(link.href)
    } catch (e) {
      let message = 'خطا در خروجی اکسل'
      const data = e?.response?.data
      if (data instanceof Blob) {
        try {
          const text = await data.text()
          message = JSON.parse(text).message || message
        } catch {
          message = 'خطا در خروجی اکسل'
        }
      } else if (e?.response?.data?.message) {
        message = e.response.data.message
      }
      setError(message)
    } finally {
      setExporting(false)
    }
  }

  const totalPages = result ? Math.max(1, Math.ceil(result.total / result.pageSize)) : 1

  if (loadingMeta) return <div className="box">در حال بارگذاری...</div>
  if (!meta) return <div className="box error-text">{error || 'گزارش‌ساز در دسترس نیست'}</div>

  return (
    <div className="box" style={{ padding: '24px' }}>
      <div className="box-title" style={{ background: '#3b82f6', color: 'white', padding: '12px 16px', borderRadius: '8px 8px 0 0', marginBottom: '20px' }}>
        گزارش جامع
      </div>

      <p style={{ margin: '0 0 16px', color: '#4b5563', fontSize: '14px' }}>
        فیلدهای مورد نظر را انتخاب کنید، در صورت نیاز محدوده را مشخص کنید، سپس گزارش را ببینید یا خروجی اکسل بگیرید.
      </p>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
        <button type="button" onClick={() => setSelected(meta.fields.map((field) => field.key))} style={minorButton}>انتخاب همه فیلدها</button>
        <button type="button" onClick={() => setSelected([])} style={minorButton}>حذف انتخاب</button>
        <button type="button" onClick={() => setSelected(meta.fields.filter((field) => field.defaultSelected).map((field) => field.key))} style={minorButton}>فیلدهای پیش‌فرض</button>
        <span style={{ alignSelf: 'center', fontSize: '13px', color: '#6b7280' }}>{selected.length} فیلد انتخاب شده</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '12px', marginBottom: '20px' }}>
        {(meta.groups || []).map((group) => {
          const groupFields = fieldsByGroup[group.key] || []
          const selectedCount = groupFields.filter((field) => selected.includes(field.key)).length
          return (
            <div key={group.key} style={{ border: '1px solid #e5e7eb', borderRadius: '8px', padding: '12px', background: '#fafafa' }}>
              <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: 'bold', marginBottom: '8px', cursor: 'pointer' }}>
                <span>
                  <input
                    type="checkbox"
                    checked={selectedCount === groupFields.length && groupFields.length > 0}
                    onChange={() => toggleGroup(group.key)}
                    style={{ marginLeft: '8px' }}
                  />
                  {group.label}
                </span>
                <span style={{ fontWeight: 'normal', color: '#6b7280', fontSize: '12px' }}>{selectedCount}/{groupFields.length}</span>
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '220px', overflowY: 'auto' }}>
                {groupFields.map((field) => (
                  <label key={field.key} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
                    <input type="checkbox" checked={selected.includes(field.key)} onChange={() => toggleField(field.key)} />
                    {field.label}
                  </label>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: '16px' }}>
        <select value={filters.licenseTypeId} onChange={(e) => setFilters({ ...filters, licenseTypeId: e.target.value })} style={inputStyle}>
          <option value="">همه انواع پروانه</option>
          {(meta.licenseTypes || []).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
        <select value={filters.operationTypeId} onChange={(e) => setFilters({ ...filters, operationTypeId: e.target.value })} style={inputStyle}>
          <option value="">همه عملیات‌ها</option>
          {(meta.operationTypes || []).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
        <select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })} style={inputStyle}>
          <option value="">همه وضعیت‌ها</option>
          {(meta.statuses || []).map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
        </select>
        <input value={filters.dateFrom} onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })} placeholder="از تاریخ (1404/01/01)" style={inputStyle} />
        <input value={filters.dateTo} onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })} placeholder="تا تاریخ (1404/12/29)" style={inputStyle} />
        <input value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })} placeholder="جستجو: نام، کد ملی، پلاک، VIN، شرکت" style={inputStyle} />
      </div>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <button type="button" onClick={() => runReport(1)} disabled={loadingReport} style={{ ...actionButton, background: '#3b82f6' }}>
          {loadingReport ? 'در حال تهیه...' : 'تهیه گزارش'}
        </button>
        <button type="button" onClick={exportExcel} disabled={exporting} style={{ ...actionButton, background: '#10b981' }}>
          {exporting ? 'در حال ساخت فایل...' : 'خروجی اکسل'}
        </button>
        <button type="button" onClick={() => setFilters(emptyFilters)} style={minorButton}>پاک کردن فیلترها</button>
      </div>

      {error && <div className="error-text" style={{ marginBottom: '12px' }}>{error}</div>}

      {result && (
        <>
          <div style={{ marginBottom: '8px', fontSize: '13px', color: '#374151' }}>
            {result.total.toLocaleString('fa-IR')} رکورد
            {result.total > 10000 ? ' — خروجی اکسل حداکثر ۱۰٬۰۰۰ ردیف اول را شامل می‌شود' : ''}
          </div>
          <div style={{ overflowX: 'auto', border: '1px solid #d1d5db', borderRadius: '8px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: '#f3f4f6' }}>
                  {(result.columns || []).map((column) => (
                    <th key={column.key} style={thStyle}>{column.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.rows.length === 0 ? (
                  <tr>
                    <td colSpan={Math.max(1, result.columns.length)} style={{ ...tdStyle, color: '#6b7280' }}>نتیجه‌ای یافت نشد</td>
                  </tr>
                ) : result.rows.map((row, index) => (
                  <tr key={index} style={{ background: index % 2 === 0 ? 'white' : '#f9fafb' }}>
                    {result.columns.map((column) => (
                      <td key={column.key} style={tdStyle}>{formatCell(row[column.key], column.type)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', marginTop: '16px' }}>
              <button type="button" onClick={() => runReport(page - 1)} disabled={page <= 1 || loadingReport} style={minorButton}>قبلی</button>
              <span style={{ fontSize: '14px' }}>صفحه {page.toLocaleString('fa-IR')} از {totalPages.toLocaleString('fa-IR')}</span>
              <button type="button" onClick={() => runReport(page + 1)} disabled={page >= totalPages || loadingReport} style={minorButton}>بعدی</button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

const inputStyle = { padding: '10px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px', background: 'white' }
const minorButton = { padding: '8px 14px', border: '1px solid #d1d5db', borderRadius: '6px', background: 'white', cursor: 'pointer', fontSize: '13px' }
const actionButton = { padding: '10px 18px', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '14px', fontWeight: 'bold' }
const thStyle = { border: '1px solid #d1d5db', padding: '12px 8px', textAlign: 'center', fontWeight: 'bold', whiteSpace: 'nowrap' }
const tdStyle = { border: '1px solid #d1d5db', padding: '10px 8px', textAlign: 'center', whiteSpace: 'nowrap' }
