import React, { useEffect, useMemo, useState } from 'react'
import { api, initAuthFromStorage } from '../lib/api.js'
import ManualDateInput from '../components/ManualDateInput'

// Helpers for number formatting and parsing
function normalizeDigits(str) {
  if (str == null) return ''
  const map = {
    '۰': '0','۱': '1','۲': '2','۳': '3','۴': '4','۵': '5','۶': '6','۷': '7','۸': '8','۹': '9',
    '٠': '0','١': '1','٢': '2','٣': '3','٤': '4','٥': '5','٦': '6','٧': '7','٨': '8','٩': '9'
  }
  return String(str).split('').map(ch => map[ch] ?? ch).join('')
}

function formatAmountFa(value) {
  const ascii = normalizeDigits(String(value || ''))
  const n = Number(ascii.replace(/[^0-9]/g, '')) || 0
  return n.toLocaleString('fa-IR')
}

function digitsOnly(value) {
  const ascii = normalizeDigits(value)
  return String(ascii || '').replace(/[^0-9]/g, '')
}

export default function AdminTariffs() {
  const [rows, setRows] = useState([])
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [docTypes, setDocTypes] = useState([])
  // Column filters
  const [fltLicenseType, setFltLicenseType] = useState('')
  const [fltDocTypeId, setFltDocTypeId] = useState('')
  const [fltYear, setFltYear] = useState('')
  const [fltAmountMin, setFltAmountMin] = useState('')
  const [fltAmountMax, setFltAmountMax] = useState('')
  const [form, setForm] = useState({
    licenseType: '',
    docTypeId: '',
    amount: '',
    fromDate: '',
    toDate: '',
    fromTon: '',
    toTon: '',
    year: '',
    description: ''
  })

  useEffect(() => {
    initAuthFromStorage()
    loadDocTypes()
    loadTariffs()
  }, [])

  const filtered = useMemo(() => {
    return rows.filter(r => {
      const matchesSearch = !search || Object.values(r).some(v => String(v).includes(search))
      const matchesLicense = !fltLicenseType || String(r.licenseType || '').includes(fltLicenseType)
      const matchesDocType = !fltDocTypeId || String(r.docTypeId || '') === String(fltDocTypeId)
      const matchesYear = !fltYear || String(r.year || '').includes(fltYear)
      const amt = Number(r.amount || 0)
      const minOk = !fltAmountMin || amt >= Number(digitsOnly(fltAmountMin) || 0)
      const maxOk = !fltAmountMax || amt <= Number(digitsOnly(fltAmountMax) || 0)
      return matchesSearch && matchesLicense && matchesDocType && matchesYear && minOk && maxOk
    })
  }, [rows, search, fltLicenseType, fltDocTypeId, fltYear, fltAmountMin, fltAmountMax])

  const loadDocTypes = async () => {
    try {
      const { data } = await api.get('/api/lookups/values', { params: { categoryKey: 'LicenseDocumentType', active: true } })
      setDocTypes(data)
    } catch (e) { console.error(e) }
  }

  const loadTariffs = async () => {
    try {
      const { data } = await api.get('/api/tariffs')
      // normalize to what UI expects
      const mapped = data.map(d => ({
        id: d.Id,
        code: d.Code,
        licenseType: d.LicenseType,
        docTypeId: d.DocTypeId,
        docTypeName: d.DocTypeName,
        fromDate: d.FromDate || '',
        toDate: d.ToDate || '',
        fromTon: d.FromTon || '',
        toTon: d.ToTon || '',
        amount: Number(d.Amount || 0),
        year: d.Year,
        desc: d.Description || ''
      }))
      setRows(mapped)
    } catch (e) { console.error(e) }
  }

  const openNew = () => {
    setEditingId(null)
    setForm({ licenseType:'', docTypeId:'', amount:'', fromDate:'', toDate:'', fromTon:'', toTon:'', year:'', description:'' })
    setShowModal(true)
  }

  const openEdit = (r) => {
    setEditingId(r.id)
    setForm({
      licenseType: r.licenseType || '',
      docTypeId: r.docTypeId || '',
      amount: String(r.amount || ''),
      fromDate: r.fromDate || '',
      toDate: r.toDate || '',
      fromTon: r.fromTon || '',
      toTon: r.toTon || '',
      year: r.year || '',
      description: r.desc || ''
    })
    setShowModal(true)
  }

  const remove = async (id) => {
    if (!window.confirm('حذف این ردیف؟')) return
    await api.delete(`/api/tariffs/${id}`)
    await loadTariffs()
  }

  const save = async () => {
    setSaving(true)
    try {
      // basic validation
      if (!form.licenseType) { alert('نوع پروانه الزامی است'); return; }
      if (!form.docTypeId) { alert('نوع سند پروانه الزامی است'); return; }
      if (!form.amount) { alert('مبلغ الزامی است'); return; }
      if (!form.year) { alert('سال الزامی است'); return; }
      const payload = {
        licenseType: form.licenseType,
        docTypeId: form.docTypeId ? Number(form.docTypeId) : undefined,
        amount: Number(form.amount || 0),
        fromDate: form.fromDate || null,
        toDate: form.toDate || null,
        fromTon: form.fromTon || null,
        toTon: form.toTon || null,
        year: form.year,
        description: form.description || null
      }
      if (editingId) {
        await api.put(`/api/tariffs/${editingId}`, payload)
      } else {
        await api.post('/api/tariffs', payload)
      }
      setShowModal(false)
      await loadTariffs()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="card" dir="rtl">
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', background:'#0ea5e9', padding:'12px 12px', borderRadius:8, color:'#fff' }}>
        <h2 style={{ margin:0 }}>نرخ پروانه</h2>
        <div style={{ display:'flex', gap:8 }}>
          <button className="btn" style={{ background:'#ef4444' }} onClick={openNew}>درج اطلاعات</button>
          <button className="btn" style={{ background:'#ec4899' }}>جستجو فرم</button>
          <button className="btn" style={{ background:'#1f2937' }}>🔍</button>
        </div>
      </div>

      
      <div style={{ display:'flex', gap:8, alignItems:'center', margin:'10px 0' }}>
        <button className="btn" style={{ background:'#e5e7eb', color:'#111827' }}>☰</button>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="جستجو در کل جدول" style={{ flex:1, padding:'10px 12px', border:'1px solid #d1d5db', borderRadius:8 }} />
      </div>

      <div style={{ overflowX:'auto' }}>
        <table className="table-bordered" style={{ width:'100%' }}>
          <thead>
            <tr>
              <th style={{ minWidth:80 }}>کد</th>
              <th>نوع پروانه</th>
              <th>نوع سند پروانه</th>
              <th>از تاریخ</th>
              <th>تا تاریخ</th>
              <th>از تناژ</th>
              <th>تا تناژ</th>
              <th>مبلغ</th>
              <th>سال (شمسی)</th>
              <th>توضیحات</th>
              <th></th>
            </tr>
            {/* Filter row */}
            <tr>
              <th></th>
              <th>
                <input value={fltLicenseType} onChange={e=>setFltLicenseType(e.target.value)} placeholder="فیلتر" style={{ width:'100%' }} />
              </th>
              <th>
                <select value={fltDocTypeId} onChange={e=>setFltDocTypeId(e.target.value)} style={{ width:'100%' }}>
                  <option value="">همه</option>
                  {docTypes.map(dt => <option key={dt.Id} value={dt.Id}>{dt.Name}</option>)}
                </select>
              </th>
              <th></th>
              <th></th>
              <th></th>
              <th></th>
              <th>
                <div style={{ display:'flex', gap:4 }}>
                  <input value={fltAmountMin} onChange={e=>setFltAmountMin(e.target.value)} placeholder="از" style={{ width:'100%' }} />
                  <input value={fltAmountMax} onChange={e=>setFltAmountMax(e.target.value)} placeholder="تا" style={{ width:'100%' }} />
                </div>
              </th>
              <th>
                <input value={fltYear} onChange={e=>setFltYear(e.target.value.replace(/[^0-9]/g,''))} placeholder="سال" style={{ width:'100%' }} />
              </th>
              <th></th>
              <th>
                <button className="btn btn-gray" onClick={() => { setFltLicenseType(''); setFltDocTypeId(''); setFltYear(''); setFltAmountMin(''); setFltAmountMax(''); }}>پاک</button>
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(r => (
              <tr key={r.id} style={{ background:'#f8fdff' }}>
                <td>{r.code}</td>
                <td>{r.licenseType}</td>
                <td>{r.docTypeName || '-'}</td>
                <td>{r.fromDate}</td>
                <td>{r.toDate}</td>
                <td>{r.fromTon}</td>
                <td>{r.toTon}</td>
                <td>{r.amount.toLocaleString('fa-IR')}</td>
                <td>{r.year}</td>
                <td>{r.desc}</td>
                <td style={{ whiteSpace:'nowrap' }}>
                  <button className="btn btn-yellow" onClick={() => openEdit(r)}>ویرایش</button>
                  <button className="btn btn-red" style={{ marginInlineStart: 6 }} onClick={() => remove(r.id)}>حذف</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e=>e.stopPropagation()}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
              <button className="btn-gray" onClick={()=>setShowModal(false)}>✕</button>
              <h3 style={{ margin:0 }}>{editingId ? 'ویرایش' : 'افزون داده جدید'}</h3>
              <div />
            </div>

            <div className="form-grid" style={{ gridTemplateColumns:'repeat(12, minmax(0,1fr))' }}>
              <label>نوع پروانه <span style={{ color:'#ef4444' }}>*</span></label>
              <select value={form.licenseType} onChange={e=>setForm(f=>({ ...f, licenseType:e.target.value }))} style={{ gridColumn:'span 5' }}>
                <option value="">انتخاب</option>
                <option value="پروانه فعالیت">پروانه فعالیت</option>
                <option value="پروانه اشتغال">پروانه اشتغال</option>
                <option value="پروانه بهره برداری">پروانه بهره برداری</option>
              </select>

              <label>نوع سند پروانه <span style={{ color:'#ef4444' }}>*</span></label>
              <select value={form.docTypeId} onChange={e=>setForm(f=>({ ...f, docTypeId:e.target.value }))} style={{ gridColumn:'span 5' }}>
                <option value="">انتخاب</option>
                {docTypes.map(dt => (
                  <option key={dt.Id} value={dt.Id}>{dt.Name}</option>
                ))}
              </select>

              <label>مبلغ <span style={{ color:'#ef4444' }}>*</span></label>
              <input value={formatAmountFa(form.amount)} onChange={e=>setForm(f=>({ ...f, amount: digitsOnly(e.target.value) }))} style={{ gridColumn:'span 5' }} />

              <label>از تاریخ</label>
              <div style={{ gridColumn:'span 5' }}>
                <ManualDateInput value={form.fromDate || ''} onChange={d=>setForm(f=>({ ...f, fromDate: d }))} />
              </div>

              <label>تا تاریخ</label>
              <div style={{ gridColumn:'span 5' }}>
                <ManualDateInput value={form.toDate || ''} onChange={d=>setForm(f=>({ ...f, toDate: d }))} />
              </div>

              <label>از تناژ</label>
              <input value={form.fromTon} onChange={e=>setForm(f=>({ ...f, fromTon:e.target.value }))} style={{ gridColumn:'span 5' }} />

              <label>تا تناژ</label>
              <input value={form.toTon} onChange={e=>setForm(f=>({ ...f, toTon:e.target.value }))} style={{ gridColumn:'span 5' }} />

              <label>سال (شمسی) <span style={{ color:'#ef4444' }}>*</span></label>
              <input value={form.year} onChange={e=>setForm(f=>({ ...f, year:e.target.value.replace(/[^0-9]/g,'') }))} style={{ gridColumn:'span 5' }} />

              <label>توضیحات</label>
              <textarea rows={4} value={form.description} onChange={e=>setForm(f=>({ ...f, description:e.target.value }))} style={{ gridColumn:'span 11', resize:'vertical' }} />
            </div>

            <div style={{ display:'flex', justifyContent:'flex-end', gap:8, marginTop:12 }}>
              <button className="btn" style={{ background:'#10b981' }} disabled={saving} onClick={save}>درج اطلاعات</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
