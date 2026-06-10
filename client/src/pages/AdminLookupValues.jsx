import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api.js';

export default function AdminLookupValues() {
  const navigate = useNavigate();
  const { key } = useParams();

  const [categories, setCategories] = useState([]);
  const [values, setValues] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  const [valFormOpen, setValFormOpen] = useState(false);
  const [valName, setValName] = useState('');
  const [valCode, setValCode] = useState('');
  const [valSort, setValSort] = useState(0);
  const [valDiscountPercentage, setValDiscountPercentage] = useState('');
  const [valIsRequired, setValIsRequired] = useState(false);

  const [editValOpen, setEditValOpen] = useState(false);
  const [editVal, setEditVal] = useState(null);

  const selectedCategory = useMemo(() => categories.find(c => c.Key === key), [categories, key]);

  async function loadCategories() {
    const { data } = await api.get('/api/lookups/categories');
    setCategories(data);
  }
  async function loadValues() {
    if (!key) return;
    setLoading(true);
    try {
      const { data } = await api.get('/api/lookups/values', { params: { categoryKey: key, search } });
      setValues(data);
    } finally { setLoading(false); }
  }

  useEffect(() => { loadCategories(); }, []);
  useEffect(() => { loadValues(); }, [key, search]);

  const createValue = async () => {
    if (!key) return;
    const payload = { 
      categoryKey: key, 
      name: valName.trim(), 
      code: valCode.trim() || undefined, 
      sortOrder: Number(valSort) || 0,
      discountPercentage: key === 'DiscountDocuments' && valDiscountPercentage ? Number(valDiscountPercentage) : undefined,
      isRequired: (key === 'VehicleDocuments' || key === 'PersonalDocuments' || key === 'CompanyDocuments' || key === 'EmploymentPermitDocuments') ? valIsRequired : undefined
    };
    if (!payload.name) return;
    await api.post('/api/lookups/values', payload);
    setValName(''); setValCode(''); setValSort(0); setValDiscountPercentage(''); setValIsRequired(false); setValFormOpen(false);
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

  return (
    <>
      <div className="card">
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div>
            <h2 style={{ margin: 0 }}>مقادیر {selectedCategory ? `(${selectedCategory.Name})` : ''}</h2>
            <div style={{ color:'#666', marginTop: 4 }}>کلید دسته: {key}</div>
          </div>
          <div>
            <button className="btn btn-gray" onClick={() => navigate('/admin/lookups')} style={{ marginInlineEnd: 8 }}>بازگشت</button>
            <button className="btn btn-green" onClick={() => setValFormOpen(true)}>افزودن مقدار</button>
          </div>
        </div>
        <div style={{ display:'flex', gap: 8, marginTop: 8 }}>
          <input placeholder="جستجو" value={search} onChange={e => setSearch(e.target.value)} />
          <button onClick={loadValues} disabled={loading}>بارگذاری</button>
        </div>

        <table className="table" width="100%" style={{ marginTop: 12 }}>
          <thead>
            <tr>
              <th>#</th>
              <th>کد</th>
              <th>نام</th>
              {key === 'DiscountDocuments' && <th>درصد تخفیف</th>}
              {(key === 'VehicleDocuments' || key === 'PersonalDocuments' || key === 'CompanyDocuments' || key === 'EmploymentPermitDocuments') && <th>ضروری</th>}
              <th>وضعیت</th>
              <th>ترتیب</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {values.map(v => (
              <tr key={v.Id}>
                <td>{v.Id}</td>
                <td>{v.Code || '-'}</td>
                <td>{v.Name}</td>
                {key === 'DiscountDocuments' && (
                  <td style={{ fontWeight: 'bold', color: '#10b981' }}>
                    {v.DiscountPercentage ? `${v.DiscountPercentage}%` : '-'}
                  </td>
                )}
                {(key === 'VehicleDocuments' || key === 'PersonalDocuments' || key === 'CompanyDocuments' || key === 'EmploymentPermitDocuments') && (
                  <td style={{ fontWeight: 'bold', color: v.IsRequired ? '#ef4444' : '#6b7280' }}>
                    {v.IsRequired ? 'ضروری' : 'غیرضروری'}
                  </td>
                )}
                <td>{v.IsActive ? 'فعال' : 'غیرفعال'}</td>
                <td>{v.SortOrder}</td>
                <td style={{ textAlign:'left' }}>
                  <button className="btn btn-yellow" onClick={() => { setEditVal({ ...v }); setEditValOpen(true); }}>ویرایش</button>
                  <button className="btn btn-blue" onClick={() => updateValue(v.Id, { isActive: !v.IsActive })} style={{ marginInlineStart: 8 }}>
                    {v.IsActive ? 'غیرفعال' : 'فعال'}
                  </button>
                  <button className="btn btn-red" onClick={() => deleteValue(v.Id)} style={{ marginInlineStart: 8 }}>حذف</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

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
            {key === 'DiscountDocuments' && (
              <label>درصد تخفیف (0-100)
                <input 
                  type="number" 
                  min="0" 
                  max="100" 
                  step="0.01"
                  value={valDiscountPercentage} 
                  onChange={e => setValDiscountPercentage(e.target.value)} 
                  placeholder="مثال: 10.5"
                />
              </label>
            )}
            {(key === 'VehicleDocuments' || key === 'PersonalDocuments' || key === 'CompanyDocuments' || key === 'EmploymentPermitDocuments') && (
              <label style={{ display:'flex', alignItems:'center', gap: 8 }}>
                <input type="checkbox" checked={valIsRequired} onChange={e => setValIsRequired(e.target.checked)} />
                ضروری است
              </label>
            )}
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
            {key === 'DiscountDocuments' && (
              <label>درصد تخفیف (0-100)
                <input 
                  type="number" 
                  min="0" 
                  max="100" 
                  step="0.01"
                  value={editVal.DiscountPercentage ?? ''} 
                  onChange={e => setEditVal(ev => ({ ...ev, DiscountPercentage: e.target.value ? Number(e.target.value) : null }))} 
                  placeholder="مثال: 10.5"
                />
              </label>
            )}
            {(key === 'VehicleDocuments' || key === 'PersonalDocuments' || key === 'CompanyDocuments' || key === 'EmploymentPermitDocuments') && (
              <div className="form-group">
                <label>
                  <input
                    type="checkbox"
                    checked={!!editVal.IsRequired}
                    onChange={e => setEditVal(v => ({ ...v, IsRequired: e.target.checked }))}
                  />
                  {' '}ضروری است
                </label>
              </div>
            )}
            <label style={{ display:'flex', alignItems:'center', gap: 8 }}>
              <input type="checkbox" checked={!!editVal.IsActive} onChange={e => setEditVal(ev => ({ ...ev, IsActive: e.target.checked }))} /> فعال
            </label>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setEditVal(null)}>لغو</button>
              <button onClick={async () => {
                const patch = {
                  name: editVal.Name,
                  code: editVal.Code,
                  sortOrder: Number(editVal.SortOrder) || 0,
                  discountPercentage: key === 'DiscountDocuments' && editVal.DiscountPercentage ? Number(editVal.DiscountPercentage) : undefined,
                  isActive: editVal.IsActive,
                  isRequired: (key === 'VehicleDocuments' || key === 'PersonalDocuments' || key === 'CompanyDocuments' || key === 'EmploymentPermitDocuments') ? !!editVal.IsRequired : undefined
                };
                if (!patch.name) return;
                await updateValue(editVal.Id, patch);
                setEditValOpen(false);
              }}>ذخیره</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
