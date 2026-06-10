import React, { useEffect, useState } from 'react'
import { api } from '../lib/api.js'

export default function AdminRoles() {
  const [roles, setRoles] = useState([])
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const load = async () => {
    try {
      const { data } = await api.get('/api/users/roles')
      setRoles(data)
    } catch (e) {
      setError(e?.response?.data?.message || 'خطا در دریافت نقش‌ها')
    }
  }

  useEffect(() => { load() }, [])

  const addRole = async (e) => {
    e.preventDefault()
    if (!name.trim()) return
    setLoading(true)
    setError('')
    try {
      await api.post('/api/users/roles', { name })
      setName('')
      await load()
    } catch (e) {
      setError(e?.response?.data?.message || 'خطا در ایجاد نقش')
    } finally {
      setLoading(false)
    }
  }

  const updateRole = async (id, newName) => {
    try {
      await api.put(`/api/users/roles/${id}`, { name: newName })
      await load()
    } catch (e) {
      alert(e?.response?.data?.message || 'خطا در ویرایش نقش')
    }
  }

  const deleteRole = async (id) => {
    if (!confirm('این نقش حذف شود؟')) return
    try {
      await api.delete(`/api/users/roles/${id}`)
      await load()
    } catch (e) {
      alert(e?.response?.data?.message || 'خطا در حذف نقش')
    }
  }

  return (
    <div className="card">
      <h2>مدیریت نقش‌ها</h2>

      <form onSubmit={addRole} style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <input placeholder="نام نقش جدید" value={name} onChange={(e) => setName(e.target.value)} />
        <button className="btn btn-green" type="submit" disabled={loading || !name.trim()}>{loading ? 'در حال افزودن...' : 'افزودن نقش'}</button>
      </form>
      {error && <p className="message" style={{ color: '#e00' }}>{error}</p>}

      <table className="table table-bordered" style={{ width: '100%' }}>
        <thead>
          <tr>
            <th align="right">#</th>
            <th align="right">نام نقش</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {roles.map(r => (
            <RoleRow key={r.Id} role={r} onUpdate={updateRole} onDelete={deleteRole} />
          ))}
        </tbody>
      </table>
    </div>
  )
}

function RoleRow({ role, onUpdate, onDelete }) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(role.Name)

  const save = () => {
    if (!value.trim() || value.trim() === role.Name) { setEditing(false); return }
    onUpdate(role.Id, value.trim())
    setEditing(false)
  }

  return (
    <tr>
      <td>{role.Id}</td>
      <td>
        {editing ? (
          <input value={value} onChange={(e) => setValue(e.target.value)} />
        ) : (
          role.Name
        )}
      </td>
      <td>
        {!editing && <button className="btn btn-yellow" onClick={() => setEditing(true)}>ویرایش</button>}
        {editing && <button className="btn btn-green" onClick={save}>ذخیره</button>}
        {' '}
        <button className="btn btn-red" onClick={() => onDelete(role.Id)}>حذف</button>
      </td>
    </tr>
  )
}
