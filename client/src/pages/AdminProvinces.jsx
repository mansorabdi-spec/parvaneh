import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api.js';

export default function AdminProvinces() {
  const [provinces, setProvinces] = useState([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState('');

  const [showCitiesFor, setShowCitiesFor] = useState(null); // { id, name }
  const [cities, setCities] = useState([]);
  const [citiesLoading, setCitiesLoading] = useState(false);
  const [cityQ, setCityQ] = useState('');

  const [provFormOpen, setProvFormOpen] = useState(false);
  const [provFormName, setProvFormName] = useState('');

  const [cityFormOpen, setCityFormOpen] = useState(false);
  const [cityFormName, setCityFormName] = useState('');

  const filteredProvinces = useMemo(() => {
    const t = q.trim();
    if (!t) return provinces;
    return provinces.filter(p => (p.name || '').includes(t));
  }, [q, provinces]);

  const filteredCities = useMemo(() => {
    const t = cityQ.trim();
    if (!t) return cities;
    return cities.filter(c => (c.name || '').includes(t));
  }, [cityQ, cities]);

  const loadProvinces = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/api/provinces');
      setProvinces(data);
    } finally { setLoading(false); }
  };

  const openCities = async (id, name) => {
    setShowCitiesFor({ id, name });
    setCitiesLoading(true);
    try {
      const { data } = await api.get(`/api/provinces/${id}/cities`);
      setCities(data);
    } finally { setCitiesLoading(false); }
  };

  const closeCities = () => {
    setShowCitiesFor(null);
    setCities([]);
    setCityQ('');
  };

  useEffect(() => { loadProvinces(); }, []);

  const addProvince = () => {
    setProvFormName('');
    setProvFormOpen(true);
  };

  const renameProvince = async (id, current) => {
    const name = prompt('نام جدید استان', current || '');
    if (!name || !name.trim()) return;
    await api.put(`/api/provinces/${id}`, { name: name.trim() });
    await loadProvinces();
  };

  const deleteProvince = async (id) => {
    if (!confirm('این استان و همه شهرهای آن حذف شوند؟')) return;
    await api.delete(`/api/provinces/${id}`);
    if (showCitiesFor?.id === id) closeCities();
    await loadProvinces();
  };

  const addCity = async () => {
    if (!showCitiesFor?.id) return;
    setCityFormName('');
    setCityFormOpen(true);
  };

  const renameCity = async (cityId, current) => {
    const name = prompt('نام جدید شهر', current || '');
    if (!name || !name.trim()) return;
    await api.put(`/api/provinces/cities/${cityId}`, { name: name.trim() });
    await openCities(showCitiesFor.id, showCitiesFor.name);
  };

  const deleteCity = async (cityId) => {
    if (!confirm('این شهر حذف شود؟')) return;
    await api.delete(`/api/provinces/cities/${cityId}`);
    await openCities(showCitiesFor.id, showCitiesFor.name);
  };

  return (
    <div className="card">
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <h2>مدیریت استان‌ها</h2>
        <div style={{ display:'flex', gap: 8, alignItems:'center' }}>
          <input placeholder="جستجو..." value={q} onChange={e => setQ(e.target.value)} />
          <button className="btn btn-green" onClick={addProvince}>افزودن استان جدید</button>
        </div>
      </div>

      <table className="table" width="100%" style={{ marginTop: 12 }}>
        <thead>
          <tr>
            <th>#</th>
            <th>نام استان</th>
            <th>شهرها</th>
            <th>عملیات</th>
          </tr>
        </thead>
        <tbody>
          {filteredProvinces.map(p => (
            <tr key={p.ID || p.Id || p.id}>
              <td>{p.ID || p.Id || p.id}</td>
              <td>{p.name}</td>
              <td>
                <button className="btn btn-blue" onClick={() => openCities(p.ID || p.Id || p.id, p.name)}>نمایش شهرها</button>
              </td>
              <td>
                <button className="btn btn-yellow" onClick={() => renameProvince(p.ID || p.Id || p.id, p.name)}>ویرایش</button>
                <button className="btn btn-red" onClick={() => deleteProvince(p.ID || p.Id || p.id)} style={{ marginInlineStart: 8 }}>حذف</button>
              </td>
            </tr>
          ))}
          {filteredProvinces.length === 0 && (
            <tr><td colSpan={4} style={{ color:'#666' }}>{loading ? 'در حال بارگذاری...' : 'استانی یافت نشد'}</td></tr>
          )}
        </tbody>
      </table>

      {showCitiesFor && (
        <div className="modal-overlay" onClick={closeCities}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <h3>شهرهای استان: {showCitiesFor.name}</h3>
              <button onClick={closeCities}>×</button>
            </div>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop: 8 }}>
              <div style={{ display:'flex', gap: 8, alignItems:'center' }}>
                <input placeholder="جستجوی شهر..." value={cityQ} onChange={e => setCityQ(e.target.value)} />
              </div>
              <button className="btn btn-green" onClick={addCity} disabled={citiesLoading}>افزودن شهر</button>
            </div>
            <table className="table" width="100%" style={{ marginTop: 12 }}>
              <thead>
                <tr><th>#</th><th>نام شهر</th><th></th></tr>
              </thead>
              <tbody>
                {filteredCities.map(c => (
                  <tr key={c.ID || c.Id || c.id}>
                    <td>{c.ID || c.Id || c.id}</td>
                    <td>{c.name}</td>
                    <td style={{ textAlign:'left' }}>
                      <button className="btn btn-yellow" onClick={() => renameCity(c.ID || c.Id || c.id, c.name)}>ویرایش</button>
                      <button className="btn btn-red" onClick={() => deleteCity(c.ID || c.Id || c.id)} style={{ marginInlineStart: 8 }}>حذف</button>
                    </td>
                  </tr>
                ))}
                {filteredCities.length === 0 && (
                  <tr><td colSpan={3} style={{ color:'#666' }}>{citiesLoading ? 'در حال بارگذاری...' : 'شهری یافت نشد'}</td></tr>
                )}
              </tbody>
            </table>
            <div style={{ marginTop: 12, display:'flex', justifyContent:'flex-start' }}>
              <button className="btn btn-gray" onClick={closeCities}>بستن</button>
            </div>
          </div>
        </div>
      )}

      {provFormOpen && (
        <div className="modal-overlay" onClick={() => setProvFormOpen(false)}>
          <div className="mini-modal" onClick={e => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>افزودن استان جدید</h3>
            <label>نام استان
              <input value={provFormName} onChange={e => setProvFormName(e.target.value)} />
            </label>
            <div style={{ display:'flex', justifyContent:'flex-end', gap: 8, marginTop: 12 }}>
              <button className="btn btn-gray" onClick={() => setProvFormOpen(false)}>انصراف</button>
              <button
                className="btn btn-green"
                onClick={async () => {
                  const name = provFormName.trim();
                  if (!name) return;
                  await api.post('/api/provinces', { name });
                  setProvFormOpen(false);
                  setProvFormName('');
                  await loadProvinces();
                }}
              >ذخیره</button>
            </div>
          </div>
        </div>
      )}

      {cityFormOpen && (
        <div className="modal-overlay" onClick={() => setCityFormOpen(false)}>
          <div className="mini-modal" onClick={e => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>افزودن شهر جدید</h3>
            <label>نام شهر
              <input value={cityFormName} onChange={e => setCityFormName(e.target.value)} />
            </label>
            <div style={{ display:'flex', justifyContent:'flex-end', gap: 8, marginTop: 12 }}>
              <button className="btn btn-gray" onClick={() => setCityFormOpen(false)}>انصراف</button>
              <button
                className="btn btn-green"
                onClick={async () => {
                  const name = cityFormName.trim();
                  if (!name || !showCitiesFor?.id) return;
                  await api.post(`/api/provinces/${showCitiesFor.id}/cities`, { name });
                  setCityFormOpen(false);
                  setCityFormName('');
                  await openCities(showCitiesFor.id, showCitiesFor.name);
                }}
              >ذخیره</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
