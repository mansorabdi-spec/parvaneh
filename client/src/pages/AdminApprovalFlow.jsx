import React, { useEffect, useState } from 'react'
import { api } from '../lib/api.js'

export default function AdminApprovalFlow() {
  const [activeTab, setActiveTab] = useState('Activity') // 'Activity', 'Employment', or 'Exploitation'
  const [activitySteps, setActivitySteps] = useState([])
  const [employmentSteps, setEmploymentSteps] = useState([])
  const [exploitationSteps, setExploitationSteps] = useState([])
  const [roles, setRoles] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const [activityFlow, employmentFlow, exploitationFlow, allRoles] = await Promise.all([
        api.get('/api/approvals/flow?licenseType=Activity'),
        api.get('/api/approvals/flow?licenseType=Employment'),
        api.get('/api/approvals/flow?licenseType=Exploitation'),
        api.get('/api/users/roles')
      ])
      setActivitySteps(activityFlow.data)
      setEmploymentSteps(employmentFlow.data)
      setExploitationSteps(exploitationFlow.data)
      setRoles(allRoles.data.map(r => r.Name))
    } catch (e) {
      setError(e?.response?.data?.message || 'Failed to load approval flows')
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  // Get current steps based on active tab
  const steps = activeTab === 'Activity' ? activitySteps : activeTab === 'Employment' ? employmentSteps : exploitationSteps
  const setSteps = activeTab === 'Activity' ? setActivitySteps : activeTab === 'Employment' ? setEmploymentSteps : setExploitationSteps

  const addStep = () => {
    const maxOrder = steps.reduce((m, s) => Math.max(m, s.StepOrder), 0)
    setSteps([...steps, { StepOrder: maxOrder + 1, RoleName: roles[0] || 'Admin' }])
  }
  const removeStep = (order) => setSteps(steps.filter(s => s.StepOrder !== order))
  const changeRole = (order, role) => setSteps(steps.map(s => s.StepOrder === order ? { ...s, RoleName: role } : s))
  const moveUp = (order) => {
    const i = steps.findIndex(s => s.StepOrder === order)
    if (i <= 0) return
    const swapped = [...steps]
    const tmp = swapped[i-1].StepOrder
    swapped[i-1].StepOrder = swapped[i].StepOrder
    swapped[i].StepOrder = tmp
    setSteps(swapped.sort((a,b) => a.StepOrder - b.StepOrder))
  }
  const moveDown = (order) => {
    const i = steps.findIndex(s => s.StepOrder === order)
    if (i === -1 || i === steps.length - 1) return
    const swapped = [...steps]
    const tmp = swapped[i+1].StepOrder
    swapped[i+1].StepOrder = swapped[i].StepOrder
    swapped[i].StepOrder = tmp
    setSteps(swapped.sort((a,b) => a.StepOrder - b.StepOrder))
  }

  const save = async () => {
    try {
      const currentSteps = activeTab === 'Activity' ? activitySteps : activeTab === 'Employment' ? employmentSteps : exploitationSteps
      const payload = { 
        licenseType: activeTab,
        steps: currentSteps.map(s => ({ stepOrder: s.StepOrder, roleName: s.RoleName })) 
      }
      await api.post('/api/approvals/flow', payload)
      const licenseTypeName = activeTab === 'Activity' ? 'پروانه فعالیت' : activeTab === 'Employment' ? 'پروانه اشتغال' : 'پروانه بهره برداری'
      alert(`فرآیند تایید ${licenseTypeName} ذخیره شد`)
      await load() // Reload to ensure all flows are fresh
    } catch (e) {
      alert('خطا در ذخیره فرآیند تایید')
    }
  }

  if (loading) return <div className="card"><p>Loading...</p></div>
  if (error) return <div className="card"><p style={{ color: '#e00' }}>{error}</p></div>

  return (
    <div className="card">
      <h2>مدیریت فرآیند تایید</h2>
      
      {/* Tabs for License Types */}
      <div style={{ marginBottom: 20, borderBottom: '2px solid #e0e0e0' }}>
        <button
          onClick={() => setActiveTab('Activity')}
          style={{
            padding: '10px 20px',
            marginRight: 10,
            background: activeTab === 'Activity' ? '#3b82f6' : '#f3f4f6',
            color: activeTab === 'Activity' ? 'white' : '#374151',
            border: 'none',
            borderRadius: '8px 8px 0 0',
            cursor: 'pointer',
            fontWeight: activeTab === 'Activity' ? 'bold' : 'normal',
            fontSize: '14px'
          }}
        >
          فرآیند تایید پروانه فعالیت
        </button>
        <button
          onClick={() => setActiveTab('Employment')}
          style={{
            padding: '10px 20px',
            marginRight: 10,
            background: activeTab === 'Employment' ? '#10b981' : '#f3f4f6',
            color: activeTab === 'Employment' ? 'white' : '#374151',
            border: 'none',
            borderRadius: '8px 8px 0 0',
            cursor: 'pointer',
            fontWeight: activeTab === 'Employment' ? 'bold' : 'normal',
            fontSize: '14px'
          }}
        >
          فرآیند تایید پروانه اشتغال
        </button>
        <button
          onClick={() => setActiveTab('Exploitation')}
          style={{
            padding: '10px 20px',
            background: activeTab === 'Exploitation' ? '#f59e0b' : '#f3f4f6',
            color: activeTab === 'Exploitation' ? 'white' : '#374151',
            border: 'none',
            borderRadius: '8px 8px 0 0',
            cursor: 'pointer',
            fontWeight: activeTab === 'Exploitation' ? 'bold' : 'normal',
            fontSize: '14px'
          }}
        >
          فرآیند تایید پروانه بهره برداری
        </button>
      </div>

      <h3 style={{ marginBottom: 16, color: activeTab === 'Activity' ? '#3b82f6' : activeTab === 'Employment' ? '#10b981' : '#f59e0b' }}>
        {activeTab === 'Activity' ? 'پروانه فعالیت' : activeTab === 'Employment' ? 'پروانه اشتغال' : 'پروانه بهره برداری'}
      </h3>
      
      <button onClick={addStep} style={{ marginBottom: 12 }}>افزودن مرحله</button>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 12 }}>
        <thead>
          <tr>
            <th align="right">ترتیب</th>
            <th align="right">نقش</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {steps.sort((a,b)=>a.StepOrder-b.StepOrder).map(s => (
            <tr key={s.StepOrder}>
              <td>{s.StepOrder}</td>
              <td>
                <select value={s.RoleName} onChange={(e) => changeRole(s.StepOrder, e.target.value)}>
                  {roles.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </td>
              <td>
                <button onClick={() => moveUp(s.StepOrder)}>بالا</button>{' '}
                <button onClick={() => moveDown(s.StepOrder)}>پایین</button>{' '}
                <button onClick={() => removeStep(s.StepOrder)} style={{ background: '#ef4444', color: 'white' }}>حذف</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <button 
        onClick={save} 
        style={{ 
          marginTop: 12, 
          padding: '10px 24px',
          background: '#10b981',
          color: 'white',
          border: 'none',
          borderRadius: 8,
          fontWeight: 'bold',
          cursor: 'pointer'
        }}
      >
        ذخیره فرآیند تایید
      </button>
    </div>
  )
}
