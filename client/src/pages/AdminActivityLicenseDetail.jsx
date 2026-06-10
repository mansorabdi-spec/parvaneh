import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api } from '../lib/api.js'

export default function AdminActivityLicenseDetail() {
  const { vehicleId } = useParams()
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState('address')
  const [imageModal, setImageModal] = useState(null)

  useEffect(() => {
    loadDetail()
  }, [vehicleId])

  const loadDetail = async () => {
    try {
      setLoading(true)
      const { data: result } = await api.get(`/api/reports/activity-licenses/${vehicleId}`)
      setData(result)
      setError('')
    } catch (e) {
      setError(e?.response?.data?.message || 'خطا در بارگذاری جزئیات')
    } finally {
      setLoading(false)
    }
  }

  const translateGender = (gender) => {
    const map = { 'male': 'مرد', 'female': 'زن' }
    return map[gender] || gender
  }

  const translateMaritalStatus = (status) => {
    const map = { 'single': 'مجرد', 'married': 'متاهل' }
    return map[status] || status
  }

  if (loading) return <div className="box">در حال بارگذاری...</div>
  if (error) return <div className="box error-text">{error}</div>
  if (!data) return <div className="box">اطلاعاتی یافت نشد</div>

  const { vehicle, person, residences, contacts, personDocuments, vehicleDocuments, discountDocuments, payments } = data

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '20px' }}>
      <button 
        onClick={() => navigate('/admin/reports/activity-licenses')} 
        style={{ alignSelf: 'flex-start', padding: '10px 20px', background: '#6b7280', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '14px' }}
      >
        ← بازگشت به لیست گزارشات
      </button>

      {/* Image Modal */}
      {imageModal && (
        <div 
          onClick={() => setImageModal(null)}
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, cursor: 'pointer' }}
        >
          <img src={imageModal} alt="Document" style={{ maxWidth: '90%', maxHeight: '90%', borderRadius: '8px' }} />
        </div>
      )}

      {/* Section 1: Personal Information */}
      <div style={{ border: '1px solid #d1d5db', borderRadius: '8px', overflow: 'hidden' }}>
        <div style={{ background: '#3b82f6', color: 'white', padding: '12px 20px', fontSize: '16px', fontWeight: 'bold' }}>
          مشخصات فردی
        </div>
        {person ? (
          <div style={{ padding: '20px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '20px' }}>
              <div style={{ padding: '12px', background: '#f9fafb', borderRadius: '6px', border: '1px solid #e5e7eb' }}>
                <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>نام</div>
                <div style={{ fontWeight: 'bold' }}>{person.FirstName}</div>
              </div>
              <div style={{ padding: '12px', background: '#f9fafb', borderRadius: '6px', border: '1px solid #e5e7eb' }}>
                <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>نام خانوادگی</div>
                <div style={{ fontWeight: 'bold' }}>{person.LastName}</div>
              </div>
              <div style={{ padding: '12px', background: '#f9fafb', borderRadius: '6px', border: '1px solid #e5e7eb' }}>
                <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>نام پدر</div>
                <div style={{ fontWeight: 'bold' }}>{person.FatherName}</div>
              </div>
              <div style={{ padding: '12px', background: '#f9fafb', borderRadius: '6px', border: '1px solid #e5e7eb' }}>
                <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>کد ملی</div>
                <div style={{ fontWeight: 'bold' }}>{person.NationalCode}</div>
              </div>
              <div style={{ padding: '12px', background: '#f9fafb', borderRadius: '6px', border: '1px solid #e5e7eb' }}>
                <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>شماره شناسنامه</div>
                <div style={{ fontWeight: 'bold' }}>{person.IdSerial || '-'}</div>
              </div>
              <div style={{ padding: '12px', background: '#f9fafb', borderRadius: '6px', border: '1px solid #e5e7eb' }}>
                <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>تاریخ تولد</div>
                <div style={{ fontWeight: 'bold' }}>{person.BirthDateJalali}</div>
              </div>
              <div style={{ padding: '12px', background: '#f9fafb', borderRadius: '6px', border: '1px solid #e5e7eb' }}>
                <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>جنسیت</div>
                <div style={{ fontWeight: 'bold' }}>{translateGender(person.Gender)}</div>
              </div>
              <div style={{ padding: '12px', background: '#f9fafb', borderRadius: '6px', border: '1px solid #e5e7eb' }}>
                <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>وضعیت تأهل</div>
                <div style={{ fontWeight: 'bold' }}>{translateMaritalStatus(person.MaritalStatus)}</div>
              </div>
            </div>

            {/* Tabs */}
            <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: '16px' }}>
              <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
                {['address', 'contacts', 'documents'].map(tab => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    style={{
                      padding: '10px 20px',
                      background: activeTab === tab ? '#3b82f6' : '#f3f4f6',
                      color: activeTab === tab ? 'white' : '#374151',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontWeight: activeTab === tab ? 'bold' : 'normal'
                    }}
                  >
                    {tab === 'address' ? 'نشانی' : tab === 'contacts' ? 'شماره تماس‌ها' : 'مستندات فردی'}
                  </button>
                ))}
              </div>

              {activeTab === 'address' && (
                <div>
                  {residences.length === 0 ? (
                    <p style={{ color: '#6b7280' }}>نشانی ثبت نشده است</p>
                  ) : (
                    residences.map((r, idx) => (
                      <div key={r.ResidenceID} style={{ marginBottom: '12px', padding: '16px', background: '#f9fafb', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
                        <div style={{ fontWeight: 'bold', marginBottom: '8px', color: '#3b82f6' }}>نشانی {idx + 1}</div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px', fontSize: '14px' }}>
                          <div><strong>استان:</strong> {r.ProvinceId || '-'}</div>
                          <div><strong>شهر:</strong> {r.CityId || '-'}</div>
                          <div><strong>خیابان اصلی:</strong> {r.MainStreet || '-'}</div>
                          <div><strong>خیابان فرعی:</strong> {r.SideStreet || '-'}</div>
                          <div><strong>محله:</strong> {r.District || '-'}</div>
                          <div><strong>کد پستی:</strong> {r.PostalCode || '-'}</div>
                          <div><strong>پلاک:</strong> {r.Plaque || '-'}</div>
                          <div><strong>واحد:</strong> {r.Unit || '-'}</div>
                          <div style={{ gridColumn: '1 / -1' }}><strong>آدرس کامل:</strong> {r.Address || '-'}</div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {activeTab === 'contacts' && (
                <div style={{ border: '1px solid #d1d5db', borderRadius: '8px', overflow: 'hidden' }}>
                  {contacts.length === 0 ? (
                    <p style={{ padding: '20px', color: '#6b7280', textAlign: 'center' }}>شماره تماسی ثبت نشده است</p>
                  ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ background: '#f3f4f6' }}>
                          <th style={{ border: '1px solid #d1d5db', padding: '12px', textAlign: 'center' }}>نوع</th>
                          <th style={{ border: '1px solid #d1d5db', padding: '12px', textAlign: 'center' }}>مقدار</th>
                          <th style={{ border: '1px solid #d1d5db', padding: '12px', textAlign: 'center' }}>فعال</th>
                          <th style={{ border: '1px solid #d1d5db', padding: '12px', textAlign: 'center' }}>تاریخ ایجاد</th>
                        </tr>
                      </thead>
                      <tbody>
                        {contacts.map((c) => (
                          <tr key={c.ContactID}>
                            <td style={{ border: '1px solid #d1d5db', padding: '10px', textAlign: 'center' }}>{c.Type}</td>
                            <td style={{ border: '1px solid #d1d5db', padding: '10px', textAlign: 'center' }}>{c.Value}</td>
                            <td style={{ border: '1px solid #d1d5db', padding: '10px', textAlign: 'center' }}>{c.IsActive ? 'بله' : 'خیر'}</td>
                            <td style={{ border: '1px solid #d1d5db', padding: '10px', textAlign: 'center' }}>{new Date(c.CreatedAt).toLocaleDateString('fa-IR')}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}

              {activeTab === 'documents' && (
                <div>
                  {personDocuments.length === 0 ? (
                    <p style={{ color: '#6b7280' }}>مستندی ثبت نشده است</p>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
                      {personDocuments.map((d) => (
                        <div 
                          key={d.DocID} 
                          onClick={() => setImageModal(`/api/issue/personal/${person.NationalCode}/documents/${d.DocID}/content`)}
                          style={{ cursor: 'pointer', border: '1px solid #d1d5db', borderRadius: '8px', overflow: 'hidden', transition: 'transform 0.2s' }}
                          onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
                          onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                        >
                          <img 
                            src={`/api/issue/personal/${person.NationalCode}/documents/${d.DocID}/content`} 
                            alt={d.DocTypeName}
                            style={{ width: '100%', height: '150px', objectFit: 'cover' }}
                          />
                          <div style={{ padding: '8px', background: '#f9fafb' }}>
                            <div style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '4px' }}>{d.DocTypeName || d.LookupDocTypeId}</div>
                            <div style={{ fontSize: '11px', color: '#6b7280' }}>{new Date(d.CreatedAt).toLocaleDateString('fa-IR')}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ) : (
          <p style={{ padding: '20px', color: '#6b7280' }}>اطلاعات فردی یافت نشد</p>
        )}
      </div>

      {/* Section 2: Vehicle Information */}
      <div style={{ border: '1px solid #d1d5db', borderRadius: '8px', overflow: 'hidden' }}>
        <div style={{ background: '#10b981', color: 'white', padding: '12px 20px', fontSize: '16px', fontWeight: 'bold' }}>
          مشخصات خودرو
        </div>
        {vehicle ? (
          <div style={{ padding: '20px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '20px' }}>
              {[
                { label: 'شناسه خودرو', value: vehicle.VehicleID },
                { label: 'VIN', value: vehicle.VIN },
                { label: 'شماره شاسی', value: vehicle.ChassisNo },
                { label: 'شماره موتور', value: vehicle.EngineNo },
                { label: 'رنگ بدنه', value: vehicle.BodyColor },
                { label: 'سال ساخت', value: vehicle.YearManufacture },
                { label: 'ظرفیت', value: vehicle.Capacity },
                { label: 'تعداد سیلندر', value: vehicle.Cylinders },
                { label: 'تعداد محور', value: vehicle.Axles },
                { label: 'کانتینر دار', value: vehicle.IsContainer ? 'بله' : 'خیر' },
                { label: 'پلاک', value: `${vehicle.PlateSerial2}-${vehicle.PlateThreeDigits} ${vehicle.PlateLetter} ${vehicle.PlateRegion2}` },
                { label: 'تاریخ بازدید', value: vehicle.InspectionDateJalali },
                { label: 'تاریخ برگ سبز', value: vehicle.GreenCardDateJalali },
                { label: 'شماره بیمه‌نامه', value: vehicle.InsurancePolicyNo },
                { label: 'تاریخ صدور بیمه', value: vehicle.InsuranceIssueDateJalali },
                { label: 'تاریخ اعتبار بیمه', value: vehicle.InsuranceValidDateJalali },
                { label: 'سریال معاینه فنی', value: vehicle.TechInspectSerial },
                { label: 'تاریخ صدور معاینه فنی', value: vehicle.TechInspectIssueDateJalali },
                { label: 'تاریخ اعتبار معاینه فنی', value: vehicle.TechInspectValidDateJalali }
              ].map((field, idx) => (
                <div key={idx} style={{ padding: '12px', background: '#f9fafb', borderRadius: '6px', border: '1px solid #e5e7eb' }}>
                  <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>{field.label}</div>
                  <div style={{ fontWeight: 'bold' }}>{field.value}</div>
                </div>
              ))}
            </div>

            {/* Vehicle Documents */}
            {vehicleDocuments.length > 0 && (
              <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: '16px', marginTop: '16px' }}>
                <h4 style={{ marginBottom: '12px', color: '#374151' }}>مستندات خودرو</h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
                  {vehicleDocuments.map((d) => (
                    <div 
                      key={d.DocID} 
                      onClick={() => setImageModal(`/api/issue/vehicle/${vehicle.VehicleID}/documents/${d.DocID}/content`)}
                      style={{ cursor: 'pointer', border: '1px solid #d1d5db', borderRadius: '8px', overflow: 'hidden', transition: 'transform 0.2s' }}
                      onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
                      onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                    >
                      <img 
                        src={`/api/issue/vehicle/${vehicle.VehicleID}/documents/${d.DocID}/content`} 
                        alt={d.DocTypeName}
                        style={{ width: '100%', height: '150px', objectFit: 'cover' }}
                      />
                      <div style={{ padding: '8px', background: '#f9fafb' }}>
                        <div style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '4px' }}>{d.DocTypeName || d.LookupDocTypeId}</div>
                        <div style={{ fontSize: '11px', color: '#6b7280' }}>{new Date(d.CreatedAt).toLocaleDateString('fa-IR')}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Discount Documents */}
            {discountDocuments.length > 0 && (
              <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: '16px', marginTop: '16px' }}>
                <h4 style={{ marginBottom: '12px', color: '#374151' }}>مستندات تخفیف</h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
                  {discountDocuments.map((d) => (
                    <div 
                      key={d.DocID} 
                      onClick={() => setImageModal(`/api/issue/vehicle/${vehicle.VehicleID}/discount-documents/${d.DocID}/content`)}
                      style={{ cursor: 'pointer', border: '1px solid #d1d5db', borderRadius: '8px', overflow: 'hidden', transition: 'transform 0.2s' }}
                      onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
                      onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                    >
                      <img 
                        src={`/api/issue/vehicle/${vehicle.VehicleID}/discount-documents/${d.DocID}/content`} 
                        alt={d.DocTypeName}
                        style={{ width: '100%', height: '150px', objectFit: 'cover' }}
                      />
                      <div style={{ padding: '8px', background: '#f9fafb' }}>
                        <div style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '4px' }}>{d.DocTypeName || d.LookupDocTypeId}</div>
                        {d.Description && <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '2px' }}>{d.Description}</div>}
                        <div style={{ fontSize: '11px', color: '#6b7280' }}>{new Date(d.CreatedAt).toLocaleDateString('fa-IR')}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <p style={{ padding: '20px', color: '#6b7280' }}>اطلاعات خودرو یافت نشد</p>
        )}
      </div>

      {/* Section 3: Payment Information */}
      <div style={{ border: '1px solid #d1d5db', borderRadius: '8px', overflow: 'hidden' }}>
        <div style={{ background: '#8b5cf6', color: 'white', padding: '12px 20px', fontSize: '16px', fontWeight: 'bold' }}>
          اطلاعات پرداخت
        </div>
        <div style={{ padding: '20px' }}>
          {payments.length === 0 ? (
            <p style={{ color: '#6b7280' }}>پرداختی ثبت نشده است</p>
          ) : (
            <div style={{ border: '1px solid #d1d5db', borderRadius: '8px', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f3f4f6' }}>
                    <th style={{ border: '1px solid #d1d5db', padding: '12px', textAlign: 'center' }}>شناسه پرداخت</th>
                    <th style={{ border: '1px solid #d1d5db', padding: '12px', textAlign: 'center' }}>مبلغ</th>
                    <th style={{ border: '1px solid #d1d5db', padding: '12px', textAlign: 'center' }}>وضعیت</th>
                    <th style={{ border: '1px solid #d1d5db', padding: '12px', textAlign: 'center' }}>شماره پیگیری</th>
                    <th style={{ border: '1px solid #d1d5db', padding: '12px', textAlign: 'center' }}>کد مرجع</th>
                    <th style={{ border: '1px solid #d1d5db', padding: '12px', textAlign: 'center' }}>تاریخ ایجاد</th>
                    <th style={{ border: '1px solid #d1d5db', padding: '12px', textAlign: 'center' }}>تاریخ پرداخت</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p) => (
                    <tr key={p.PaymentID}>
                      <td style={{ border: '1px solid #d1d5db', padding: '10px', textAlign: 'center' }}>{p.PaymentID}</td>
                      <td style={{ border: '1px solid #d1d5db', padding: '10px', textAlign: 'center' }}>{p.Amount?.toLocaleString('fa-IR')} ریال</td>
                      <td style={{ border: '1px solid #d1d5db', padding: '10px', textAlign: 'center' }}>{p.Status}</td>
                      <td style={{ border: '1px solid #d1d5db', padding: '10px', textAlign: 'center' }}>{p.TrackingCode || '-'}</td>
                      <td style={{ border: '1px solid #d1d5db', padding: '10px', textAlign: 'center' }}>{p.ReferenceNumber || '-'}</td>
                      <td style={{ border: '1px solid #d1d5db', padding: '10px', textAlign: 'center' }}>{new Date(p.CreatedAt).toLocaleDateString('fa-IR')}</td>
                      <td style={{ border: '1px solid #d1d5db', padding: '10px', textAlign: 'center' }}>{p.PaidAt ? new Date(p.PaidAt).toLocaleDateString('fa-IR') : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
