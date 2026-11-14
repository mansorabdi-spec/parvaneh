import React, { useEffect, useState } from 'react'
import { api } from '../lib/api.js'

export default function AdminApprovalFlow() {
  const [mainSection, setMainSection] = useState('issue') // 'issue' or 'renewal'
  const [activeTab, setActiveTab] = useState('Activity') // 'Activity', 'Employment', or 'Exploitation'
  const [activitySteps, setActivitySteps] = useState([])
  const [employmentSteps, setEmploymentSteps] = useState([])
  const [exploitationSteps, setExploitationSteps] = useState([])
  const [activityRenewalSteps, setActivityRenewalSteps] = useState([])
  const [employmentRenewalSteps, setEmploymentRenewalSteps] = useState([])
  const [exploitationRenewalSteps, setExploitationRenewalSteps] = useState([])
  const [roles, setRoles] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const [activityFlow, employmentFlow, exploitationFlow, activityRenewalFlow, employmentRenewalFlow, exploitationRenewalFlow, allRoles] = await Promise.all([
        api.get('/api/approvals/flow?licenseType=Activity'),
        api.get('/api/approvals/flow?licenseType=Employment'),
        api.get('/api/approvals/flow?licenseType=Exploitation'),
        api.get('/api/approvals/flow?licenseType=Activity_Renewal'),
        api.get('/api/approvals/flow?licenseType=Employment_Renewal'),
        api.get('/api/approvals/flow?licenseType=Exploitation_Renewal'),
        api.get('/api/users/roles')
      ])
      setActivitySteps(activityFlow.data)
      setEmploymentSteps(employmentFlow.data)
      setExploitationSteps(exploitationFlow.data)
      setActivityRenewalSteps(activityRenewalFlow.data)
      setEmploymentRenewalSteps(employmentRenewalFlow.data)
      setExploitationRenewalSteps(exploitationRenewalFlow.data)
      setRoles(allRoles.data.map(r => r.Name))
    } catch (e) {
      setError(e?.response?.data?.message || 'Failed to load approval flows')
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  // Get current steps based on active tab and section
  const getSteps = (tab, section) => {
    if (section === 'renewal') {
      if (tab === 'Activity') return activityRenewalSteps
      if (tab === 'Employment') return employmentRenewalSteps
      if (tab === 'Exploitation') return exploitationRenewalSteps
    }
    if (tab === 'Activity') return activitySteps
    if (tab === 'Employment') return employmentSteps
    if (tab === 'Exploitation') return exploitationSteps
  }

  const setSteps = (tab, section, value) => {
    if (section === 'renewal') {
      if (tab === 'Activity') setActivityRenewalSteps(value)
      if (tab === 'Employment') setEmploymentRenewalSteps(value)
      if (tab === 'Exploitation') setExploitationRenewalSteps(value)
    } else {
      if (tab === 'Activity') setActivitySteps(value)
      if (tab === 'Employment') setEmploymentSteps(value)
      if (tab === 'Exploitation') setExploitationSteps(value)
    }
  }

  const steps = getSteps(activeTab, mainSection)
  const setStepsCurrent = (value) => setSteps(activeTab, mainSection, value)

  const addStep = () => {
    const maxOrder = steps.reduce((m, s) => Math.max(m, s.StepOrder), 0)
    setStepsCurrent([...steps, { StepOrder: maxOrder + 1, RoleName: roles[0] || 'Admin' }])
  }
  const removeStep = (order) => setStepsCurrent(steps.filter(s => s.StepOrder !== order))
  const changeRole = (order, role) => setStepsCurrent(steps.map(s => s.StepOrder === order ? { ...s, RoleName: role } : s))
  const moveUp = (order) => {
    const i = steps.findIndex(s => s.StepOrder === order)
    if (i <= 0) return
    const swapped = [...steps]
    const tmp = swapped[i-1].StepOrder
    swapped[i-1].StepOrder = swapped[i].StepOrder
    swapped[i].StepOrder = tmp
    setStepsCurrent(swapped.sort((a,b) => a.StepOrder - b.StepOrder))
  }
  const moveDown = (order) => {
    const i = steps.findIndex(s => s.StepOrder === order)
    if (i === -1 || i === steps.length - 1) return
    const swapped = [...steps]
    const tmp = swapped[i+1].StepOrder
    swapped[i+1].StepOrder = swapped[i].StepOrder
    swapped[i].StepOrder = tmp
    setStepsCurrent(swapped.sort((a,b) => a.StepOrder - b.StepOrder))
  }

  const getLicenseType = (tab, section) => {
    if (section === 'renewal') {
      if (tab === 'Activity') return 'Activity_Renewal'
      if (tab === 'Employment') return 'Employment_Renewal'
      if (tab === 'Exploitation') return 'Exploitation_Renewal'
    }
    if (tab === 'Activity') return 'Activity'
    if (tab === 'Employment') return 'Employment'
    if (tab === 'Exploitation') return 'Exploitation'
  }

  const getLicenseTypeName = (tab, section) => {
    if (section === 'renewal') {
      if (tab === 'Activity') return 'تمدید پروانه فعالیت'
      if (tab === 'Employment') return 'تمدید پروانه اشتغال'
      if (tab === 'Exploitation') return 'تمدید پروانه بهره برداری'
    }
    if (tab === 'Activity') return 'پروانه فعالیت'
    if (tab === 'Employment') return 'پروانه اشتغال'
    if (tab === 'Exploitation') return 'پروانه بهره برداری'
  }

  const save = async () => {
    try {
      const currentSteps = getSteps(activeTab, mainSection)
      const licenseType = getLicenseType(activeTab, mainSection)
      const payload = { 
        licenseType,
        steps: currentSteps.map(s => ({ stepOrder: s.StepOrder, roleName: s.RoleName })) 
      }
      await api.post('/api/approvals/flow', payload)
      const licenseTypeName = getLicenseTypeName(activeTab, mainSection)
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
      
      {/* Main Section Tabs: Issue vs Renewal */}
      <div style={{ marginBottom: 30 }}>
        <button
          onClick={() => setMainSection('issue')}
          style={{
            padding: '12px 30px',
            marginRight: 10,
            background: mainSection === 'issue' ? '#3b82f6' : '#f3f4f6',
            color: mainSection === 'issue' ? 'white' : '#374151',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontWeight: mainSection === 'issue' ? 'bold' : 'normal',
            fontSize: '16px'
          }}
        >
          📋 فرآیند تایید صدور پروانه
        </button>
        <button
          onClick={() => setMainSection('renewal')}
          style={{
            padding: '12px 30px',
            background: mainSection === 'renewal' ? '#8b5cf6' : '#f3f4f6',
            color: mainSection === 'renewal' ? 'white' : '#374151',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontWeight: mainSection === 'renewal' ? 'bold' : 'normal',
            fontSize: '16px'
          }}
        >
          🔄 فرآیند تایید تمدید پروانه
        </button>
      </div>

      {/* Sub Tabs for License Types */}
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
          پروانه فعالیت
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
          پروانه اشتغال
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
          پروانه بهره برداری
        </button>
      </div>

      <h3 style={{ marginBottom: 16 }}>
        {mainSection === 'issue' 
          ? (activeTab === 'Activity' ? 'فرآیند تایید صدور ' : activeTab === 'Employment' ? 'فرآیند تایید صدور ' : 'فرآیند تایید صدور ') + getLicenseTypeName(activeTab, mainSection).replace('تمدید ', '')
          : getLicenseTypeName(activeTab, mainSection)
        }
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
