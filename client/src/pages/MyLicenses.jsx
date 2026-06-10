import React, { useEffect, useState } from 'react'
import { api } from '../lib/api.js'

export default function MyLicenses() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    setLoading(true)
    setError('')
    api.get('/api/licenses/my')
      .then(res => setItems(res.data))
      .catch(err => setError(err?.response?.data?.message || 'Failed to load licenses'))
      .finally(() => setLoading(false))
  }, [])

  const printPdf = async (id) => {
    try {
      const res = await api.get(`/api/licenses/${id}/pdf`, { responseType: 'blob' })
      const blob = new Blob([res.data], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      window.open(url, '_blank')
      setTimeout(() => URL.revokeObjectURL(url), 60 * 1000)
    } catch (e) {
      alert(e?.response?.data?.message || 'Failed to open PDF')
    }
  }

  if (loading) return <div className="card"><p>Loading...</p></div>
  if (error) return <div className="card"><p style={{ color: '#e00' }}>{error}</p></div>

  return (
    <div className="card">
      <h2>My Licenses</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th align="right">#</th>
            <th align="right">Applicant</th>
            <th align="right">Activity</th>
            <th align="right">Valid</th>
            <th align="right">Status</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {items.map(l => (
            <tr key={l.Id}>
              <td>{l.Id}</td>
              <td>{l.FirstName} {l.LastName} ({l.NationalId})</td>
              <td>{l.ActivityType}</td>
              <td>{new Date(l.ValidFrom).toISOString().slice(0,10)} - {new Date(l.ValidTo).toISOString().slice(0,10)}</td>
              <td>{l.Status}</td>
              <td>
                {l.Status === 'Approved' ? (
                  <button onClick={() => printPdf(l.Id)}>Print PDF</button>
                ) : (
                  <span>Awaiting approvals</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
