import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';

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

  const selectedCategory = useMemo(() => categories.find(c => c.Key === selectedKey), [categories, selectedKey]);

  async function loadCategories() {
    const { data } = await api.get('/api/lookups/categories');
    setCategories(data);
    if (!selectedKey && data[0]) setSelectedKey(data[0].Key);
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

  useEffect(() => { loadCategories(); }, []);
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
            {categories.map(c => (
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
