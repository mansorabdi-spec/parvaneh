import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import {
  DEFAULT_RENEWAL_WINDOW_DAYS,
  RENEWAL_WINDOW_CATEGORY_KEY,
  readRenewalWindowDays,
  toEnglishDigits
} from '../lib/renewalWindow.js';

export default function AdminLookups() {
  const navigate = useNavigate();
  const [categories, setCategories] = useState([]);
  const [selectedKey, setSelectedKey] = useState('');
  const [values, setValues] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [valFormOpen, setValFormOpen] = useState(false);
  const [valName, setValName] = useState('');
  const [valCode, setValCode] = useState('');
  const [valSort, setValSort] = useState(0);
  const [editValOpen, setEditValOpen] = useState(false);
  const [editVal, setEditVal] = useState(null); // {Id, Code, Name, SortOrder, IsActive}
  const [renewalDays, setRenewalDays] = useState(String(DEFAULT_RENEWAL_WINDOW_DAYS));
  const [renewalValueId, setRenewalValueId] = useState(null);
  const [renewalSaving, setRenewalSaving] = useState(false);
  const [renewalMessage, setRenewalMessage] = useState('');
  const [renewalError, setRenewalError] = useState('');

  const visibleCategories = useMemo(
    () => categories.filter(c => c.Key !== RENEWAL_WINDOW_CATEGORY_KEY),
    [categories]
  );

  const selectedCategory = useMemo(() => categories.find(c => c.Key === selectedKey), [categories, selectedKey]);

  async function loadCategories() {
    const { data } = await api.get('/api/lookups/categories');
    setCategories(data);
    const firstVisible = (data || []).find(c => c.Key !== RENEWAL_WINDOW_CATEGORY_KEY);
    if (!selectedKey && firstVisible) setSelectedKey(firstVisible.Key);
  }
  async function loadValues() {
    if (!selectedKey) return;
    setLoading(true);
    try {
      const { data } = await api.get('/api/lookups/values', { params: { categoryKey: selectedKey, search } });
      setValues(data);
    } finally {
      setLoading(false);
    }
  }

  async function loadRenewalWindow() {
    setRenewalError('');
    try {
      let { data } = await api.get('/api/lookups/values', { params: { categoryKey: RENEWAL_WINDOW_CATEGORY_KEY } });
      if (!data?.length) {
        const created = await api.post('/api/lookups/values', {
          categoryKey: RENEWAL_WINDOW_CATEGORY_KEY,
          code: String(DEFAULT_RENEWAL_WINDOW_DAYS),
          name: 'تعداد روز',
          nameEn: 'Renewal window days',
          description: 'مقدار پیش‌فرض ۱۰ روز',
          sortOrder: 1,
          isActive: true
        });
        data = [created.data];
      }
      const row = data.find(v => v.IsActive === true || v.IsActive === 1) || data[0];
      setRenewalValueId(row.Id);
      setRenewalDays(String(readRenewalWindowDays(data)));
    } catch (e) {
      if (e?.response?.status !== 404) {
        setRenewalError(e?.response?.data?.message || 'خواندن مهلت تمدید ناموفق بود');
        return;
      }
      try {
        await api.post('/api/lookups/categories', {
          key: RENEWAL_WINDOW_CATEGORY_KEY,
          name: 'مهلت تمدید پروانه',
          description: 'تعداد روز مانده تا انقضای پروانه که دکمه تمدید فعال می‌شود',
          sortOrder: 200
        });
        const created = await api.post('/api/lookups/values', {
          categoryKey: RENEWAL_WINDOW_CATEGORY_KEY,
          code: String(DEFAULT_RENEWAL_WINDOW_DAYS),
          name: 'تعداد روز',
          nameEn: 'Renewal window days',
          description: 'مقدار پیش‌فرض ۱۰ روز',
          sortOrder: 1,
          isActive: true
        });
        setRenewalValueId(created.data.Id);
        setRenewalDays(String(DEFAULT_RENEWAL_WINDOW_DAYS));
      } catch (createError) {
        setRenewalError(createError?.response?.data?.message || 'ایجاد مهلت تمدید ناموفق بود');
      }
    }
  }

  async function saveRenewalWindow() {
    setRenewalMessage('');
    setRenewalError('');
    const parsed = parseInt(toEnglishDigits(renewalDays).trim(), 10);
    if (!Number.isInteger(parsed) || parsed < 0 || parsed > 3650) {
      setRenewalError('عدد روز باید یک عدد صحیح بین ۰ و ۳۶۵۰ باشد');
      return;
    }
    setRenewalSaving(true);
    try {
      let valueId = renewalValueId;
      if (!valueId) {
        let rows = [];
        try {
          const response = await api.get('/api/lookups/values', { params: { categoryKey: RENEWAL_WINDOW_CATEGORY_KEY } });
          rows = response.data || [];
        } catch (readError) {
          if (readError?.response?.status !== 404) throw readError;
          await api.post('/api/lookups/categories', {
            key: RENEWAL_WINDOW_CATEGORY_KEY,
            name: 'مهلت تمدید پروانه',
            description: 'تعداد روز مانده تا انقضای پروانه که دکمه تمدید فعال می‌شود',
            sortOrder: 200
          });
        }
        if (!rows.length) {
          const created = await api.post('/api/lookups/values', {
            categoryKey: RENEWAL_WINDOW_CATEGORY_KEY,
            code: String(parsed),
            name: 'تعداد روز',
            nameEn: 'Renewal window days',
            sortOrder: 1,
            isActive: true
          });
          valueId = created.data.Id;
        } else {
          const row = rows.find(v => v.IsActive === true || v.IsActive === 1) || rows[0];
          valueId = row.Id;
        }
        setRenewalValueId(valueId);
      }
      if (valueId) {
        await api.put(`/api/lookups/values/${valueId}`, {
          code: String(parsed),
          name: 'تعداد روز',
          isActive: true
        });
      }
      setRenewalDays(String(parsed));
      setRenewalMessage('مهلت تمدید ذخیره شد');
    } catch (e) {
      setRenewalError(e?.response?.data?.message || 'ذخیره مهلت تمدید ناموفق بود');
    } finally {
      setRenewalSaving(false);
    }
  }

  useEffect(() => { loadCategories(); loadRenewalWindow(); }, []);
  useEffect(() => { loadValues(); }, [selectedKey, search]);

  // Category CRUD
  const [catForm, setCatForm] = useState({ key: '', name: '' });
  const [catError, setCatError] = useState('');
  const [catFormOpen, setCatFormOpen] = useState(false);
  const [catEditOpen, setCatEditOpen] = useState(false);
  const [catEditName, setCatEditName] = useState('');
  const keyOk = /^[A-Za-z][A-Za-z0-9_]*$/.test((catForm.key || '').trim());
  const createCategory = async () => {
    setCatError('');
    const payload = { key: (catForm.key || '').trim(), name: (catForm.name || '').trim() };
    if (!payload.key || !payload.name) { setCatError('Please enter both key and name'); return; }
    if (!keyOk) { setCatError('Key must start with a letter and contain only English letters, numbers, or underscore'); return; }
    try {
      await api.post('/api/lookups/categories', payload);
      setCatForm({ key: '', name: '' });
      setCatFormOpen(false);
      loadCategories();
    } catch (e) {
      setCatError(e?.response?.data?.message || 'Failed to create category');
    }
  };
  const updateCategory = async (id, patch) => {
    await api.put(`/api/lookups/categories/${id}`, patch);
    loadCategories();
  };
  const deleteCategory = async (id) => {
    if (!window.confirm('حذف این دسته؟ مقادیر داخل آن نیز حذف خواهند شد.')) return;
    await api.delete(`/api/lookups/categories/${id}`);
    if (selectedCategory?.Id === id) setSelectedKey('');
    loadCategories();
    setValues([]);
  };

  // Value CRUD
  const [valForm, setValForm] = useState({ code: '', name: '', sortOrder: 0 });
  const createValue = async () => {
    if (!selectedKey) return;
    const payload = { categoryKey: selectedKey, name: valName.trim(), code: valCode.trim() || undefined, sortOrder: Number(valSort) || 0 };
    if (!payload.name) return;
    await api.post('/api/lookups/values', payload);
    setValName(''); setValCode(''); setValSort(0); setValFormOpen(false);
    loadValues();
  };
  const updateValue = async (id, patch) => {
    await api.put(`/api/lookups/values/${id}`, patch);
    loadValues();
  };
  const deleteValue = async (id) => {
    if (!window.confirm('حذف این مورد؟')) return;
    await api.delete(`/api/lookups/values/${id}`);
    loadValues();
  };

  return (<>
    <div className="card" style={{ marginBottom: 16 }}>
      <h3 style={{ marginTop: 0 }}>مهلت تمدید پروانه</h3>
      <p style={{ color: '#555', marginTop: 0 }}>
        تعداد روز مانده تا تاریخ انقضای پروانه که دکمه تمدید فعال می‌شود. این عدد در پایگاه داده ذخیره می‌شود و در کارتابل و فهرست درخواست‌ها خوانده می‌شود.
      </p>
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <label>
          تعداد روز
          <input
            type="number"
            min="0"
            max="3650"
            value={renewalDays}
            onChange={e => { setRenewalDays(e.target.value); setRenewalMessage(''); setRenewalError(''); }}
          />
        </label>
        <button className="btn btn-green" onClick={saveRenewalWindow} disabled={renewalSaving}>
          {renewalSaving ? 'در حال ذخیره...' : 'ذخیره'}
        </button>
      </div>
      {renewalError && <div style={{ color: '#c62828', marginTop: 8 }}>{renewalError}</div>}
      {renewalMessage && <div style={{ color: '#2e7d32', marginTop: 8 }}>{renewalMessage}</div>}
    </div>
    <div className="card" style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 16 }}>
      <div>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <h3>دسته‌ها</h3>
          <button className="btn btn-green" onClick={() => { setCatForm({ key:'', name:'' }); setCatFormOpen(true); }}>افزودن دسته جدید</button>
        </div>
        <table className="table" width="100%" style={{ marginTop: 12 }}>
          <thead>
            <tr><th>شناسه</th><th>کلید</th><th>عنوان</th><th></th></tr>
          </thead>
          <tbody>
            {visibleCategories.map(c => (
              <tr key={c.Id}>
                <td>{c.Id}</td>
                <td>{c.Key}</td>
                <td>{c.Name}</td>
                <td>
                  <button className="btn btn-blue" onClick={() => navigate(`/admin/lookups/${encodeURIComponent(c.Key)}`)}>نمایش مقادیر</button>
                  <button className="btn btn-yellow" onClick={() => { setCatEditName(c.Name); setCatEditOpen({ id: c.Id }); }} style={{ marginInlineStart: 8 }}>ویرایش</button>
                  <button className="btn btn-red" onClick={() => deleteCategory(c.Id)} style={{ marginInlineStart: 8 }}>حذف</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
    {catFormOpen && (
      <div className="modal-overlay" onClick={() => setCatFormOpen(false)}>
        <div className="mini-modal" onClick={e => e.stopPropagation()}>
          <h3 style={{ marginTop: 0 }}>افزودن دسته جدید</h3>
          {catError && <div style={{ color:'#c62828', marginBottom: 8 }}>{catError}</div>}
          <label>کلید (به انگلیسی)
            <input value={catForm.key} onChange={e => setCatForm(f => ({ ...f, key: e.target.value }))} placeholder="مثال: LicenseType" />
          </label>
          <label>عنوان
            <input value={catForm.name} onChange={e => setCatForm(f => ({ ...f, name: e.target.value }))} placeholder="مثال: نوع پروانه" />
          </label>
          <div style={{ display:'flex', justifyContent:'flex-end', gap: 8, marginTop: 12 }}>
            <button className="btn btn-gray" onClick={() => setCatFormOpen(false)}>انصراف</button>
            <button className="btn btn-green" onClick={createCategory}>ذخیره</button>
          </div>
        </div>
      </div>
    )}
    {valFormOpen && (
      <div className="modal-overlay" onClick={() => setValFormOpen(false)}>
        <div className="mini-modal" onClick={e => e.stopPropagation()}>
          <h3 style={{ marginTop: 0 }}>افزودن مقدار جدید</h3>
          <label>نام
            <input value={valName} onChange={e => setValName(e.target.value)} />
          </label>
          <label>کد
            <input value={valCode} onChange={e => setValCode(e.target.value)} />
          </label>
          <label>ترتیب
            <input type="number" value={valSort} onChange={e => setValSort(e.target.value)} />
          </label>
          <div style={{ display:'flex', justifyContent:'flex-end', gap: 8, marginTop: 12 }}>
            <button className="btn btn-gray" onClick={() => setValFormOpen(false)}>انصراف</button>
            <button className="btn btn-green" onClick={createValue}>ذخیره</button>
          </div>
        </div>
      </div>
    )}

    {editValOpen && editVal && (
      <div className="modal-overlay" onClick={() => setEditValOpen(false)}>
        <div className="mini-modal" onClick={e => e.stopPropagation()}>
          <h3 style={{ marginTop: 0 }}>ویرایش مقدار</h3>
          <label>نام
            <input value={editVal.Name} onChange={e => setEditVal(ev => ({ ...ev, Name: e.target.value }))} />
          </label>
          <label>کد
            <input value={editVal.Code || ''} onChange={e => setEditVal(ev => ({ ...ev, Code: e.target.value }))} />
          </label>
          <label>ترتیب
            <input type="number" value={editVal.SortOrder ?? 0} onChange={e => setEditVal(ev => ({ ...ev, SortOrder: Number(e.target.value) }))} />
          </label>
          <label style={{ display:'flex', alignItems:'center', gap: 8 }}>
            <input type="checkbox" checked={!!editVal.IsActive} onChange={e => setEditVal(ev => ({ ...ev, IsActive: e.target.checked }))} /> فعال
          </label>
          <div style={{ display:'flex', justifyContent:'flex-end', gap: 8, marginTop: 12 }}>
            <button className="btn btn-gray" onClick={() => setEditValOpen(false)}>انصراف</button>
            <button className="btn btn-green" onClick={async () => {
              const patch = {
                name: (editVal.Name || '').trim(),
                code: (editVal.Code || '').trim() || null,
                sortOrder: Number(editVal.SortOrder) || 0,
                isActive: !!editVal.IsActive
              };
              if (!patch.name) return;
              await updateValue(editVal.Id, patch);
              setEditValOpen(false);
            }}>ذخیره</button>
          </div>
        </div>
      </div>
    )}

    {catEditOpen && (
      <div className="modal-overlay" onClick={() => setCatEditOpen(false)}>
        <div className="mini-modal" onClick={e => e.stopPropagation()}>
          <h3 style={{ marginTop: 0 }}>ویرایش دسته</h3>
          <label>عنوان
            <input value={catEditName} onChange={e => setCatEditName(e.target.value)} />
          </label>
          <div style={{ display:'flex', justifyContent:'flex-end', gap: 8, marginTop: 12 }}>
            <button className="btn btn-gray" onClick={() => setCatEditOpen(false)}>انصراف</button>
            <button className="btn btn-green" onClick={async () => {
              const name = (catEditName || '').trim();
              if (!name) return;
              await updateCategory(catEditOpen.id, { name });
              setCatEditOpen(false);
            }}>ذخیره</button>
          </div>
        </div>
      </div>
    )}
  </>);
}
