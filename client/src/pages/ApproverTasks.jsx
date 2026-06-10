import React, { useEffect, useState } from 'react'
import { api } from '../lib/api.js'

export default function ApproverTasks() {
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notes, setNotes] = useState({})
  const [busyId, setBusyId] = useState(null)

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const { data } = await api.get('/api/approvals/my-tasks')
      setTasks(data)
    } catch (e) {
      setError(e?.response?.data?.message || 'Failed to load approval tasks')
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const decide = async (id, decision) => {
    setBusyId(id)
    try {
      await api.post(`/api/approvals/${id}/decision`, { decision, notes: notes[id] || '' })
      await load()
    } catch (e) {
      alert(e?.response?.data?.message || 'Failed to submit decision')
    } finally {
      setBusyId(null)
    }
  }

  if (loading) return <div className="card"><p>Loading...</p></div>
  if (error) return <div className="card"><p style={{ color: '#e00' }}>{error}</p></div>

  return (
    <div className="card">
      <h2>Approval Tasks</h2>
      {tasks.length === 0 && <p>No tasks at the moment.</p>}
      {tasks.length > 0 && (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th align="right">#Approval</th>
              <th align="right">License</th>
              <th align="right">Step</th>
              <th align="right">Role</th>
              <th align="right">Notes</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {tasks.map(t => (
              <tr key={t.Id}>
                <td>{t.Id}</td>
                <td>{t.LicenseId}</td>
                <td>{t.StepOrder}</td>
                <td>{t.ApproverRole}</td>
                <td>
                  <input
                    value={notes[t.Id] || ''}
                    onChange={(e) => setNotes({ ...notes, [t.Id]: e.target.value })}
                    placeholder="Optional notes"
                  />
                </td>
                <td>
                  <button onClick={() => decide(t.Id, 'Approved')} disabled={busyId === t.Id}>Approve</button>
                  {' '}
                  <button onClick={() => decide(t.Id, 'Rejected')} disabled={busyId === t.Id} style={{ background: '#d33' }}>Reject</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
