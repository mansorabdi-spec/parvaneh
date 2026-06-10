import React, { useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api } from '../lib/api.js'

export default function AdminRequestStatusUpdate() {
  const { requestId } = useParams()
  const navigate = useNavigate()

  const [requestDetail, setRequestDetail] = useState(null)
  const [steps, setSteps] = useState([])
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [targetStatus, setTargetStatus] = useState('')
  const [targetStepOrder, setTargetStepOrder] = useState('')
  const [assignedUserId, setAssignedUserId] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Users list for assignment
  const [users, setUsers] = useState([])
  const [usersLoading, setUsersLoading] = useState(false)
  const [usersError, setUsersError] = useState('')
  const [userFilter, setUserFilter] = useState('')

  useEffect(() => {
    loadData()
  }, [requestId])

  useEffect(() => {
    loadUsers()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      const [detailRes, stepsRes, historyRes] = await Promise.all([
        api.get(`/api/workflow/requests/${requestId}`),
        api.get(`/api/workflow/requests/${requestId}/steps`),
        api.get(`/api/workflow/requests/${requestId}/history`)
      ])

      setRequestDetail(detailRes.data)
      setSteps(stepsRes.data || [])
      setHistory(historyRes.data || [])
      setError('')

      const currentStatus = detailRes.data?.request?.status || detailRes.data?.request?.Status || ''
      const currentStep = detailRes.data?.request?.currentStepOrder || detailRes.data?.request?.CurrentStepOrder || ''
      if (currentStatus) setTargetStatus(currentStatus)
      if (currentStep !== null && currentStep !== undefined && currentStep !== '') {
        setTargetStepOrder(String(currentStep))
      }
    } catch (e) {
      setError(e?.response?.data?.message || 'Error loading request data')
    } finally {
      setLoading(false)
    }
  }

  const loadUsers = async () => {
    try {
      setUsersLoading(true)
      setUsersError('')
      const { data } = await api.get('/api/users')
      setUsers(data || [])
    } catch (e) {
      setUsersError(e?.response?.data?.message || 'Error loading users list')
    } finally {
      setUsersLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!targetStatus || targetStepOrder === '') {
      alert('Status and StepOrder are required')
      return
    }

    const confirmMsg = [
      `Are you sure you want to change this request?`,
      '',
      `New Status: ${targetStatus}`,
      `New StepOrder: ${targetStepOrder}`,
      assignedUserId ? `AssignedUserId: ${assignedUserId}` : '',
      '',
      'This is a powerful admin operation. Make sure you know what you are doing.'
    ].filter(Boolean).join('\n')

    if (!window.confirm(confirmMsg)) return

    try {
      setSubmitting(true)
      await api.post(`/api/workflow/requests/${requestId}/admin-fix-status`, {
        targetStatus,
        targetStepOrder: Number(targetStepOrder),
        assignedUserId: assignedUserId ? Number(assignedUserId) : null,
        notes: notes || null
      })
      alert('Workflow status/step updated successfully')
      await loadData()
    } catch (e) {
      alert(e?.response?.data?.message || 'Error updating workflow status')
    } finally {
      setSubmitting(false)
    }
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return '-'
    return new Date(dateStr).toLocaleString('fa-IR')
  }

  const filteredUsers = useMemo(() => {
    if (!userFilter) return users
    const f = userFilter.toLowerCase()
    return users.filter(u => {
      const idStr = String(u.Id || '')
      const username = (u.Username || u.NationalCode || '').toLowerCase()
      const fullName = (u.FullName || '').toLowerCase()
      const role = (u.PrimaryRole || '').toLowerCase()
      return (
        idStr.includes(f) ||
        username.includes(f) ||
        fullName.includes(f) ||
        role.includes(f)
      )
    })
  }, [users, userFilter])

  if (loading) return <div className="box">در حال بارگذاری...</div>
  if (error) return <div className="box" style={{ color: '#ef4444' }}>{error}</div>
  if (!requestDetail) return <div className="box">Request not found</div>

  const req = requestDetail.request || {}

  return (
    <div style={{ padding: '20px' }}>
      <button
        onClick={() => navigate('/admin/workflow/requests')}
        style={{
          marginBottom: '20px',
          padding: '8px 16px',
          background: '#6b7280',
          color: 'white',
          border: 'none',
          borderRadius: '6px',
          cursor: 'pointer',
          fontSize: '14px'
        }}
      >
        ← Back to Admin Requests
      </button>

      <h1 style={{ marginBottom: '16px', fontSize: '22px', fontWeight: 'bold' }}>
        Admin Workflow Fix Tool
      </h1>

      <div style={{
        padding: '16px',
        borderRadius: '8px',
        background: '#fef3c7',
        border: '1px solid #fbbf24',
        marginBottom: '20px',
        fontSize: '14px',
        lineHeight: 1.6
      }}>
        <strong>Warning:</strong> This tool is for administrators only.
        <br />
        You can manually change the request status and current step. Use it only to fix broken workflows.
      </div>

      {/* Request summary */}
      <div style={{
        marginBottom: '20px',
        padding: '16px',
        borderRadius: '8px',
        border: '1px solid #d1d5db',
        background: 'white'
      }}>
        <h2 style={{ marginTop: 0, marginBottom: '12px', fontSize: '18px' }}>Request Info</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px', fontSize: '14px' }}>
          <div><strong>RequestID:</strong> {req.requestId || req.RequestID}</div>
          <div><strong>TrackingNo:</strong> {req.trackingNo || req.TrackingNo}</div>
          <div><strong>Current Status:</strong> {req.status || req.Status}</div>
          <div><strong>Current StepOrder:</strong> {req.currentStepOrder ?? req.CurrentStepOrder ?? '-'}</div>
          <div><strong>Created At:</strong> {formatDate(req.createdAt || req.CreatedAt)}</div>
          <div><strong>Completed At:</strong> {formatDate(req.completedAt || req.CompletedAt)}</div>
        </div>
      </div>

      {/* Admin fix form */}
      <form onSubmit={handleSubmit} style={{
        marginBottom: '24px',
        padding: '16px',
        borderRadius: '8px',
        border: '2px solid #3b82f6',
        background: '#eff6ff'
      }}>
        <h2 style={{ marginTop: 0, marginBottom: '12px', fontSize: '18px' }}>Change Status / Step</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px', marginBottom: '12px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px' }}>Target Status</label>
            <select
              value={targetStatus}
              onChange={e => setTargetStatus(e.target.value)}
              style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #9ca3af', fontSize: '14px', background: 'white' }}
            >
              <option value="">-- Select --</option>
              <option value="NotStarted">NotStarted</option>
              <option value="Pending">Pending</option>
              <option value="InProgress">InProgress</option>
              <option value="AwaitingPayment">AwaitingPayment</option>
              <option value="Approved">Approved</option>
              <option value="Rejected">Rejected</option>
              <option value="Completed">Completed</option>
              <option value="Cancelled">Cancelled</option>
              <option value="Suspended">Suspended</option>
            </select>
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px' }}>Target StepOrder</label>
            <input
              type="number"
              value={targetStepOrder}
              onChange={e => setTargetStepOrder(e.target.value)}
              style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #9ca3af', fontSize: '14px' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px' }}>Assigned User (optional)</label>
            <div style={{ marginBottom: '6px' }}>
              <input
                type="text"
                value={userFilter}
                onChange={e => setUserFilter(e.target.value)}
                placeholder="Filter by id / username / name / role..."
                style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', border: '1px solid #9ca3af', fontSize: '13px' }}
              />
            </div>
            <select
              value={assignedUserId}
              onChange={e => setAssignedUserId(e.target.value)}
              style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #9ca3af', fontSize: '14px', background: 'white' }}
            >
              <option value="">-- No specific user (role-based) --</option>
              {usersLoading && <option>Loading users...</option>}
              {!usersLoading && filteredUsers.map(u => (
                <option key={u.Id} value={u.Id}>
                  {u.Id} - {(u.FullName || u.Username || u.NationalCode || '')} ({u.PrimaryRole || 'User'})
                </option>
              ))}
            </select>
            {usersError && (
              <div style={{ marginTop: '4px', fontSize: '12px', color: '#b91c1c' }}>
                {usersError}
              </div>
            )}
          </div>
        </div>
        <div style={{ marginBottom: '12px' }}>
          <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px' }}>Notes (optional)</label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={3}
            style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #9ca3af', fontSize: '14px' }}
          />
        </div>
        <button
          type="submit"
          disabled={submitting}
          style={{
            padding: '10px 20px',
            background: '#ef4444',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: submitting ? 'not-allowed' : 'pointer',
            fontSize: '14px',
            fontWeight: 'bold'
          }}
        >
          {submitting ? 'Applying change...' : 'Apply Admin Change'}
        </button>
      </form>

      {/* Steps list */}
      <div style={{
        marginBottom: '24px',
        padding: '16px',
        borderRadius: '8px',
        border: '1px solid #d1d5db',
        background: 'white'
      }}>
        <h2 style={{ marginTop: 0, marginBottom: '12px', fontSize: '18px' }}>Workflow Steps</h2>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead>
            <tr style={{ background: '#f3f4f6' }}>
              <th style={{ padding: '8px', borderBottom: '1px solid #e5e7eb' }}>StepOrder</th>
              <th style={{ padding: '8px', borderBottom: '1px solid #e5e7eb' }}>Role</th>
              <th style={{ padding: '8px', borderBottom: '1px solid #e5e7eb' }}>Status</th>
              <th style={{ padding: '8px', borderBottom: '1px solid #e5e7eb' }}>AssignedUserId</th>
              <th style={{ padding: '8px', borderBottom: '1px solid #e5e7eb' }}>DecidedBy</th>
            </tr>
          </thead>
          <tbody>
            {steps.map((s) => (
              <tr key={s.Id} style={{ background: s.StepOrder === req.currentStepOrder ? '#eff6ff' : 'transparent' }}>
                <td style={{ padding: '6px', borderBottom: '1px solid #e5e7eb' }}>{s.StepOrder}</td>
                <td style={{ padding: '6px', borderBottom: '1px solid #e5e7eb' }}>{s.RoleName}</td>
                <td style={{ padding: '6px', borderBottom: '1px solid #e5e7eb' }}>{s.Status}</td>
                <td style={{ padding: '6px', borderBottom: '1px solid #e5e7eb' }}>{s.AssignedUserId ?? '-'}</td>
                <td style={{ padding: '6px', borderBottom: '1px solid #e5e7eb' }}>{s.DecidedByUserName || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* History list */}
      <div style={{
        marginBottom: '24px',
        padding: '16px',
        borderRadius: '8px',
        border: '1px solid #d1d5db',
        background: 'white'
      }}>
        <h2 style={{ marginTop: 0, marginBottom: '12px', fontSize: '18px' }}>Process History</h2>
        {history.length === 0 ? (
          <div style={{ fontSize: '13px', color: '#6b7280' }}>No history records.</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ background: '#f3f4f6' }}>
                <th style={{ padding: '8px', borderBottom: '1px solid #e5e7eb' }}>Id</th>
                <th style={{ padding: '8px', borderBottom: '1px solid #e5e7eb' }}>ActionType</th>
                <th style={{ padding: '8px', borderBottom: '1px solid #e5e7eb' }}>StepOrder</th>
                <th style={{ padding: '8px', borderBottom: '1px solid #e5e7eb' }}>From → To</th>
                <th style={{ padding: '8px', borderBottom: '1px solid #e5e7eb' }}>User</th>
                <th style={{ padding: '8px', borderBottom: '1px solid #e5e7eb' }}>CreatedAt</th>
              </tr>
            </thead>
            <tbody>
              {history.map((h) => (
                <tr key={h.Id}>
                  <td style={{ padding: '6px', borderBottom: '1px solid #e5e7eb' }}>{h.Id}</td>
                  <td style={{ padding: '6px', borderBottom: '1px solid #e5e7eb' }}>{h.ActionType}</td>
                  <td style={{ padding: '6px', borderBottom: '1px solid #e5e7eb' }}>{h.StepOrder ?? '-'}</td>
                  <td style={{ padding: '6px', borderBottom: '1px solid #e5e7eb' }}>{(h.FromStatus || '-') + ' → ' + (h.ToStatus || '-')}</td>
                  <td style={{ padding: '6px', borderBottom: '1px solid #e5e7eb' }}>{h.ActionByUserFullName || '-'}</td>
                  <td style={{ padding: '6px', borderBottom: '1px solid #e5e7eb' }}>{formatDate(h.CreatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
