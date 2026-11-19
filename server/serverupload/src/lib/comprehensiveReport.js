import { sql } from './db.js';
import { shamsiToGregorian } from '../utils/shamsiDateUtils.js';

const STATUS_LABELS = {
  Approved: 'تایید شده',
  Rejected: 'رد شده',
  Pending: 'در انتظار',
  InProgress: 'در جریان',
  AwaitingPayment: 'در انتظار پرداخت',
  FixDeficiency: 'رفع نقص',
  Cancelled: 'ابطال شده',
  Revoked: 'لغو شده',
  NotStarted: 'شروع نشده'
};

const HISTORY_STATUS_SQL = `CASE lh.HistoryStatus
  WHEN N'Active' THEN N'فعال'
  WHEN N'Expired' THEN N'منقضی'
  WHEN N'Revoked' THEN N'لغو شده'
  WHEN N'Cancelled' THEN N'ابطال شده'
  ELSE lh.HistoryStatus
END`;

const REQUEST_STATUS_SQL = `CASE vr.Status
  WHEN N'Approved' THEN N'تایید شده'
  WHEN N'Rejected' THEN N'رد شده'
  WHEN N'Pending' THEN N'در انتظار'
  WHEN N'InProgress' THEN N'در جریان'
  WHEN N'AwaitingPayment' THEN N'در انتظار پرداخت'
  WHEN N'FixDeficiency' THEN N'رفع نقص'
  WHEN N'Cancelled' THEN N'ابطال شده'
  WHEN N'Revoked' THEN N'لغو شده'
  ELSE vr.Status
END`;

export const FIELD_GROUPS = [
  { key: 'request', label: 'درخواست و پروانه' },
  { key: 'person', label: 'متقاضی' },
  { key: 'personExtra', label: 'اطلاعات تکمیلی متقاضی' },
  { key: 'contact', label: 'نشانی و تماس' },
  { key: 'vehicle', label: 'وسیله نقلیه' },
  { key: 'company', label: 'شرکت' },
  { key: 'payment', label: 'مبلغ و پرداخت' },
  { key: 'lifecycle', label: 'اعتبار، تمدید و چاپ' }
];

export const REPORT_FIELDS = [
  { key: 'trackingNo', label: 'شماره پروانه', group: 'request', sql: 'vr.TrackingNo', defaultSelected: true },
  { key: 'requestId', label: 'شناسه درخواست', group: 'request', sql: 'vr.RequestID' },
  { key: 'licenseType', label: 'نوع پروانه', group: 'request', sql: 'lt.Name', defaultSelected: true },
  { key: 'operationType', label: 'نوع عملیات', group: 'request', sql: 'ot.Name', defaultSelected: true },
  { key: 'status', label: 'وضعیت', group: 'request', sql: REQUEST_STATUS_SQL, defaultSelected: true },
  { key: 'createdAt', label: 'تاریخ ثبت', group: 'request', sql: 'vr.CreatedAt', type: 'date', defaultSelected: true },
  { key: 'completedAt', label: 'تاریخ تکمیل', group: 'request', sql: 'vr.CompletedAt', type: 'date' },
  { key: 'currentStep', label: 'مرحله جاری', group: 'request', sql: 'vr.CurrentStepOrder' },
  { key: 'submittedBy', label: 'ثبت‌کننده', group: 'request', sql: 'u.FullName' },
  { key: 'registrarCompany', label: 'شرکت ثبت‌کننده (کارگزار)', group: 'request', sql: 'broker.CompanyName' },
  { key: 'description', label: 'توضیحات', group: 'request', sql: 'vr.FinalDescription' },
  { key: 'tonnageFrom', label: 'تناژ از', group: 'request', sql: 'vr.TonnageFromTon' },
  { key: 'tonnageTo', label: 'تناژ تا', group: 'request', sql: 'vr.TonnageToTon' },
  { key: 'hasDeficiency', label: 'دارای نقص', group: 'request', sql: `CASE WHEN vr.HasDeficiency = 1 THEN N'بله' ELSE N'خیر' END` },

  { key: 'firstName', label: 'نام', group: 'person', sql: 'p.FirstName', defaultSelected: true },
  { key: 'lastName', label: 'نام خانوادگی', group: 'person', sql: 'p.LastName', defaultSelected: true },
  { key: 'fatherName', label: 'نام پدر', group: 'person', sql: 'p.FatherName' },
  { key: 'nationalCode', label: 'کد ملی', group: 'person', sql: 'COALESCE(vr.NationalCode, v.RegistrarNationalCode)', defaultSelected: true },
  { key: 'idSerial', label: 'شماره شناسنامه', group: 'person', sql: 'p.IdSerial' },
  { key: 'gender', label: 'جنسیت', group: 'person', sql: 'p.Gender' },
  { key: 'maritalStatus', label: 'وضعیت تأهل', group: 'person', sql: 'p.MaritalStatus' },
  { key: 'birthDate', label: 'تاریخ تولد', group: 'person', sql: 'p.BirthDateJalali' },
  { key: 'birthProvince', label: 'استان تولد', group: 'person', sql: 'bp.Name' },
  { key: 'birthCity', label: 'شهر تولد', group: 'person', sql: 'bc.Name' },

  { key: 'certificateType', label: 'نوع گواهینامه', group: 'personExtra', sql: 'poi.CertificateType' },
  { key: 'drivingLicenseNo', label: 'شماره گواهینامه', group: 'personExtra', sql: 'poi.DrivingLicenseNo' },
  { key: 'drivingLicenseIssue', label: 'تاریخ صدور گواهینامه', group: 'personExtra', sql: 'poi.DrivingLicenseIssueDate' },
  { key: 'drivingLicenseExpiry', label: 'تاریخ اعتبار گواهینامه', group: 'personExtra', sql: 'poi.DrivingLicenseExpiryDate' },
  { key: 'healthCardNo', label: 'شماره کارت سلامت', group: 'personExtra', sql: 'poi.HealthCardNo' },
  { key: 'healthCardExpiry', label: 'تاریخ اعتبار کارت سلامت', group: 'personExtra', sql: 'poi.HealthCardExpiryDate' },
  { key: 'educationLevel', label: 'تحصیلات', group: 'personExtra', sql: 'poi.EducationLevel' },
  { key: 'militaryStatus', label: 'وضعیت نظام وظیفه', group: 'personExtra', sql: 'poi.MilitaryStatus' },
  { key: 'jobStatus', label: 'وضعیت شغلی', group: 'personExtra', sql: 'poi.JobStatus' },
  { key: 'insuranceType', label: 'نوع بیمه شخص', group: 'personExtra', sql: 'poi.InsuranceType' },

  { key: 'mobile', label: 'موبایل', group: 'contact', sql: 'mob.Value' },
  { key: 'phone', label: 'تلفن', group: 'contact', sql: 'tel.Value' },
  { key: 'email', label: 'ایمیل', group: 'contact', sql: 'eml.Value' },
  { key: 'residenceProvince', label: 'استان سکونت', group: 'contact', sql: 'res.ProvinceName' },
  { key: 'residenceCity', label: 'شهر سکونت', group: 'contact', sql: 'res.CityName' },
  { key: 'address', label: 'آدرس', group: 'contact', sql: 'res.Address' },
  { key: 'postalCode', label: 'کد پستی', group: 'contact', sql: 'res.PostalCode' },

  { key: 'plate', label: 'پلاک', group: 'vehicle', sql: `CASE
      WHEN v.PlateThreeDigits IS NOT NULL AND v.PlateLetter IS NOT NULL
           AND v.PlateRegion2 IS NOT NULL AND v.PlateSerial2 IS NOT NULL
      THEN RTRIM(v.PlateRegion2) + N' ' + RTRIM(v.PlateThreeDigits) + N' ' + RTRIM(v.PlateLetter) + N' ' + RTRIM(v.PlateSerial2)
      ELSE NULL
    END`, defaultSelected: true },
  { key: 'vin', label: 'VIN', group: 'vehicle', sql: 'v.VIN' },
  { key: 'chassisNo', label: 'شماره شاسی', group: 'vehicle', sql: 'v.ChassisNo' },
  { key: 'engineNo', label: 'شماره موتور', group: 'vehicle', sql: 'v.EngineNo' },
  { key: 'vehicleKind', label: 'نوع وسیله', group: 'vehicle', sql: 'vt.VehicleTypeName' },
  { key: 'vehicleSystem', label: 'سیستم', group: 'vehicle', sql: 'st.systemname' },
  { key: 'vehicleTip', label: 'تیپ', group: 'vehicle', sql: 'tt.tipname' },
  { key: 'yearManufacture', label: 'سال ساخت', group: 'vehicle', sql: 'v.YearManufacture' },
  { key: 'capacity', label: 'ظرفیت (تناژ)', group: 'vehicle', sql: 'v.Capacity' },
  { key: 'fuelType', label: 'نوع سوخت', group: 'vehicle', sql: 'ft.Name' },
  { key: 'trackerType', label: 'نوع ردیاب', group: 'vehicle', sql: 'trt.Name' },
  { key: 'cylinders', label: 'تعداد سیلندر', group: 'vehicle', sql: 'v.Cylinders' },
  { key: 'axles', label: 'تعداد محور', group: 'vehicle', sql: 'v.Axles' },
  { key: 'wheels', label: 'تعداد چرخ', group: 'vehicle', sql: 'v.Wheels' },
  { key: 'bodyColor', label: 'رنگ بدنه', group: 'vehicle', sql: 'v.BodyColor' },
  { key: 'activityCategory', label: 'رسته فعالیت', group: 'vehicle', sql: 'ac.Name' },
  { key: 'plateType', label: 'نوع پلاک', group: 'vehicle', sql: 'pt.Name' },
  { key: 'isContainer', label: 'کانتینردار', group: 'vehicle', sql: `CASE WHEN v.IsContainer = 1 THEN N'بله' WHEN v.VehicleID IS NULL THEN NULL ELSE N'خیر' END` },
  { key: 'insuranceCompany', label: 'شرکت بیمه خودرو', group: 'vehicle', sql: 'ic.Name' },
  { key: 'insurancePolicyNo', label: 'شماره بیمه‌نامه', group: 'vehicle', sql: 'v.InsurancePolicyNo' },
  { key: 'insuranceValid', label: 'اعتبار بیمه خودرو', group: 'vehicle', sql: 'v.InsuranceValidDateJalali' },
  { key: 'techInspectSerial', label: 'سریال معاینه فنی', group: 'vehicle', sql: 'v.TechInspectSerial' },
  { key: 'techInspectValid', label: 'اعتبار معاینه فنی', group: 'vehicle', sql: 'v.TechInspectValidDateJalali' },

  { key: 'companyName', label: 'نام شرکت', group: 'company', sql: 'ci.CompanyName', defaultSelected: true },
  { key: 'companyNationalId', label: 'شناسه ملی شرکت', group: 'company', sql: 'vr.CompanyNationalId' },
  { key: 'registrationNo', label: 'شماره ثبت', group: 'company', sql: 'ci.RegistrationNo' },
  { key: 'economicCode', label: 'کد اقتصادی', group: 'company', sql: 'ci.EconomicCode' },
  { key: 'workshopName', label: 'کد کارگاه بیمه', group: 'company', sql: 'ci.WorkshopName' },
  { key: 'mainActivity', label: 'فعالیت اصلی شرکت', group: 'company', sql: 'ci.MainActivity' },
  { key: 'companyType', label: 'نوع شرکت', group: 'company', sql: 'ct.Name' },
  { key: 'businessLicenseNo', label: 'شماره جواز کسب', group: 'company', sql: 'ci.BusinessLicenseNo' },
  { key: 'managerNationalCode', label: 'کد ملی مدیر شرکت', group: 'company', sql: 'ci.ManagerNationalCode' },
  { key: 'companyMobile', label: 'موبایل شرکت', group: 'company', sql: 'ccm.Value' },
  { key: 'companyPhone', label: 'تلفن شرکت', group: 'company', sql: 'ccp.Value' },

  { key: 'originalAmount', label: 'مبلغ اولیه', group: 'payment', sql: 'vr.OriginalAmount', type: 'money' },
  { key: 'discountAmount', label: 'مبلغ تخفیف', group: 'payment', sql: 'vr.DiscountAmount', type: 'money' },
  { key: 'finalAmount', label: 'مبلغ نهایی', group: 'payment', sql: 'vr.FinalAmount', type: 'money' },
  { key: 'discountStatus', label: 'وضعیت تخفیف', group: 'payment', sql: 'vr.DiscountStatus' },
  { key: 'paymentStatus', label: 'وضعیت پرداخت', group: 'payment', sql: `CASE
      WHEN payOnline.Amount IS NOT NULL OR payOffline.Amount IS NOT NULL THEN N'پرداخت شده'
      ELSE N'پرداخت نشده'
    END` },
  { key: 'paidAmount', label: 'مبلغ پرداخت‌شده', group: 'payment', sql: 'COALESCE(payOnline.Amount, payOffline.Amount)', type: 'money' },

  { key: 'issueDate', label: 'تاریخ صدور', group: 'lifecycle', sql: 'lh.IssueDate' },
  { key: 'expiryDate', label: 'تاریخ انقضا', group: 'lifecycle', sql: 'lh.ExpiryDate' },
  { key: 'historyStatus', label: 'وضعیت اعتبار', group: 'lifecycle', sql: HISTORY_STATUS_SQL },
  { key: 'renewalDate', label: 'تاریخ تمدید', group: 'lifecycle', sql: 'lrh.RenewalDate' },
  { key: 'isPrinted', label: 'چاپ شده', group: 'lifecycle', sql: `CASE WHEN prn.PrintCount > 0 THEN N'بله' ELSE N'خیر' END` },
  { key: 'printCount', label: 'تعداد چاپ', group: 'lifecycle', sql: 'ISNULL(prn.PrintCount, 0)' },
  { key: 'lastPrintedAt', label: 'آخرین چاپ', group: 'lifecycle', sql: 'prn.LastPrintedAt', type: 'date' }
];

const FIELD_BY_KEY = new Map(REPORT_FIELDS.map((field) => [field.key, field]));

const FROM_SQL = `
  FROM VehicleRequests vr
  LEFT JOIN Vehicles v ON vr.VehicleID = v.VehicleID
  LEFT JOIN Persons p ON p.NationalCode = COALESCE(vr.NationalCode, v.RegistrarNationalCode)
  LEFT JOIN PersonOtherInfo poi ON poi.NationalCode = p.NationalCode
  LEFT JOIN CompanyInfo ci ON ci.NationalId = vr.CompanyNationalId
  LEFT JOIN Users u ON vr.SubmittedByUserId = u.Id
  LEFT JOIN LookupValue lt ON vr.LicenseTypeId = lt.Id
  LEFT JOIN LookupValue ot ON vr.OperationTypeId = ot.Id
  LEFT JOIN VehicleType vt ON v.VehicleKindId = vt.ID
  LEFT JOIN Systemtype st ON v.SystemId = st.ID
  LEFT JOIN Tiptype tt ON v.SystemTipId = tt.ID
  LEFT JOIN LookupValue ft ON v.FuelTypeId = ft.Id
  LEFT JOIN LookupValue ac ON v.ActivityCategoryId = ac.Id
  LEFT JOIN LookupValue ic ON v.InsuranceCompanyId = ic.Id
  LEFT JOIN LookupValue pt ON v.PlateTypeId = pt.Id
  LEFT JOIN LookupValue trt ON v.TrackerTypeId = trt.Id
  LEFT JOIN LookupValue ct ON ci.CompanyTypeId = ct.Id
  LEFT JOIN Provinces bp ON p.BirthProvinceId = bp.Id
  LEFT JOIN Cities bc ON p.BirthCityId = bc.Id AND bc.ProvinceId = p.BirthProvinceId
  OUTER APPLY (
    SELECT TOP 1 ci2.CompanyName
    FROM CompanyInfo ci2
    WHERE LTRIM(RTRIM(ci2.ManagerNationalCode)) = LTRIM(RTRIM(u.NationalCode))
      AND u.NationalCode IS NOT NULL
    ORDER BY ci2.CreatedAt DESC
  ) broker
  OUTER APPLY (
    SELECT TOP 1 pc.Value
    FROM PersonContacts pc
    WHERE pc.NationalCode = p.NationalCode AND pc.Type = N'mobile'
    ORDER BY pc.IsActive DESC, pc.ContactID DESC
  ) mob
  OUTER APPLY (
    SELECT TOP 1 pc.Value
    FROM PersonContacts pc
    WHERE pc.NationalCode = p.NationalCode AND pc.Type = N'phone'
    ORDER BY pc.IsActive DESC, pc.ContactID DESC
  ) tel
  OUTER APPLY (
    SELECT TOP 1 pc.Value
    FROM PersonContacts pc
    WHERE pc.NationalCode = p.NationalCode AND pc.Type = N'email'
    ORDER BY pc.IsActive DESC, pc.ContactID DESC
  ) eml
  OUTER APPLY (
    SELECT TOP 1
      pr.Address,
      pr.PostalCode,
      prov.Name AS ProvinceName,
      c.Name AS CityName
    FROM PersonResidences pr
    LEFT JOIN Provinces prov ON pr.ProvinceId = prov.Id
    LEFT JOIN Cities c ON pr.CityId = c.Id
    WHERE pr.NationalCode = p.NationalCode
    ORDER BY pr.ResidenceID DESC
  ) res
  OUTER APPLY (
    SELECT TOP 1 cc.Value
    FROM CompanyContacts cc
    WHERE cc.NationalId = ci.NationalId AND cc.Type = N'mobile'
    ORDER BY cc.IsActive DESC, cc.ContactID DESC
  ) ccm
  OUTER APPLY (
    SELECT TOP 1 cc.Value
    FROM CompanyContacts cc
    WHERE cc.NationalId = ci.NationalId AND cc.Type = N'phone'
    ORDER BY cc.IsActive DESC, cc.ContactID DESC
  ) ccp
  OUTER APPLY (
    SELECT TOP 1 op.Amount
    FROM OnlinePayment op
    WHERE op.RequestID = vr.RequestID
      AND (op.PayedBit = 1 OR op.Status = N'Successful')
    ORDER BY op.Id DESC
  ) payOnline
  OUTER APPLY (
    SELECT TOP 1 ofp.Amount
    FROM OfflinePayment ofp
    WHERE ofp.RequestID = vr.RequestID
    ORDER BY ofp.Id DESC
  ) payOffline
  LEFT JOIN (
    SELECT RequestID, COUNT(*) AS PrintCount, MAX(PrintedAt) AS LastPrintedAt
    FROM LicensePrintLog
    GROUP BY RequestID
  ) prn ON prn.RequestID = vr.RequestID
  LEFT JOIN (
    SELECT lh1.TrackingNo, lh1.IssueDate, lh1.ExpiryDate, lh1.Status AS HistoryStatus
    FROM LicenseHistory lh1
    INNER JOIN (
      SELECT TrackingNo, MAX(HistoryID) AS MaxId
      FROM LicenseHistory
      GROUP BY TrackingNo
    ) lh2 ON lh1.HistoryID = lh2.MaxId
  ) lh ON lh.TrackingNo = vr.TrackingNo
  LEFT JOIN (
    SELECT RequestID, MAX(RenewalDate) AS RenewalDate
    FROM LicenseRenewalHistory
    GROUP BY RequestID
  ) lrh ON lrh.RequestID = vr.RequestID
`;

export async function ensureComprehensiveReportPage(pool) {
  await pool.request().query(`
    IF NOT EXISTS (SELECT 1 FROM Pages WHERE PageKey = 'admin_reports_comprehensive')
    BEGIN
      INSERT INTO Pages (PageKey, PagePath, PageTitle, Description, IsActive)
      VALUES (
        'admin_reports_comprehensive',
        '/admin/reports/comprehensive',
        N'گزارش جامع',
        N'گزارش‌ساز با انتخاب فیلد و خروجی اکسل',
        1
      );
    END
  `);

  await pool.request().query(`
    DECLARE @PageId INT = (SELECT Id FROM Pages WHERE PageKey = 'admin_reports_comprehensive');

    IF @PageId IS NOT NULL
    BEGIN
      INSERT INTO RolePagePermissions (RoleId, PageId, CanAccess)
      SELECT rpp.RoleId, @PageId, 1
      FROM RolePagePermissions rpp
      INNER JOIN Pages p ON p.Id = rpp.PageId
      WHERE p.PageKey = 'admin_reports_activity_licenses'
        AND rpp.CanAccess = 1
        AND NOT EXISTS (
          SELECT 1 FROM RolePagePermissions existing
          WHERE existing.RoleId = rpp.RoleId AND existing.PageId = @PageId
        );

      INSERT INTO RolePagePermissions (RoleId, PageId, CanAccess)
      SELECT r.Id, @PageId, 1
      FROM Roles r
      WHERE r.Name IN (N'Admin', N'superadmin')
        AND NOT EXISTS (
          SELECT 1 FROM RolePagePermissions existing
          WHERE existing.RoleId = r.Id AND existing.PageId = @PageId
        );
    END
  `);
}

export function getFieldCatalog() {
  return {
    groups: FIELD_GROUPS,
    fields: REPORT_FIELDS.map(({ key, label, group, type, defaultSelected }) => ({
      key,
      label,
      group,
      type: type || 'text',
      defaultSelected: !!defaultSelected
    }))
  };
}

export function resolveFields(keys) {
  if (!Array.isArray(keys) || keys.length === 0) {
    const error = new Error('حداقل یک فیلد را برای گزارش انتخاب کنید');
    error.statusCode = 400;
    throw error;
  }
  const unique = [...new Set(keys.map((key) => String(key)))];
  const fields = [];
  for (const key of unique) {
    const field = FIELD_BY_KEY.get(key);
    if (!field) {
      const error = new Error('یکی از فیلدهای انتخاب‌شده معتبر نیست');
      error.statusCode = 400;
      throw error;
    }
    fields.push(field);
  }
  if (fields.length > 80) {
    const error = new Error('تعداد فیلدهای انتخاب‌شده بیش از حد مجاز است');
    error.statusCode = 400;
    throw error;
  }
  return fields;
}

function bindFilters(request, filters = {}) {
  const where = [];
  const licenseTypeId = Number(filters.licenseTypeId);
  const operationTypeId = Number(filters.operationTypeId);
  const status = String(filters.status || '').trim().slice(0, 50);
  const search = String(filters.search || '').trim().slice(0, 100).replace(/[%_[\]]/g, '');

  if (licenseTypeId) {
    request.input('LicenseTypeId', sql.Int, licenseTypeId);
    where.push('vr.LicenseTypeId = @LicenseTypeId');
  }
  if (operationTypeId) {
    request.input('OperationTypeId', sql.Int, operationTypeId);
    where.push('vr.OperationTypeId = @OperationTypeId');
  }
  if (status) {
    request.input('Status', sql.NVarChar(50), status);
    where.push('vr.Status = @Status');
  }
  if (search) {
    request.input('Search', sql.NVarChar(120), `%${search}%`);
    where.push(`(
      vr.TrackingNo LIKE @Search
      OR p.FirstName LIKE @Search
      OR p.LastName LIKE @Search
      OR p.FatherName LIKE @Search
      OR p.NationalCode LIKE @Search
      OR vr.NationalCode LIKE @Search
      OR vr.CompanyNationalId LIKE @Search
      OR ci.CompanyName LIKE @Search
      OR v.VIN LIKE @Search
      OR v.ChassisNo LIKE @Search
      OR v.EngineNo LIKE @Search
      OR v.PlateThreeDigits LIKE @Search
      OR v.PlateLetter LIKE @Search
      OR v.PlateRegion2 LIKE @Search
      OR v.PlateSerial2 LIKE @Search
      OR u.FullName LIKE @Search
    )`);
  }

  const dateFrom = String(filters.dateFrom || '').trim();
  const dateTo = String(filters.dateTo || '').trim();
  if (dateFrom) {
    try {
      const from = shamsiToGregorian(dateFrom);
      from.setHours(0, 0, 0, 0);
      request.input('DateFrom', sql.DateTime, from);
      where.push('vr.CreatedAt >= @DateFrom');
    } catch {
      const error = new Error('تاریخ شروع معتبر نیست. قالب درست: 1404/01/01');
      error.statusCode = 400;
      throw error;
    }
  }
  if (dateTo) {
    try {
      const to = shamsiToGregorian(dateTo);
      to.setHours(23, 59, 59, 999);
      request.input('DateTo', sql.DateTime, to);
      where.push('vr.CreatedAt <= @DateTo');
    } catch {
      const error = new Error('تاریخ پایان معتبر نیست. قالب درست: 1404/01/01');
      error.statusCode = 400;
      throw error;
    }
  }

  return where.length ? `WHERE ${where.join(' AND ')}` : '';
}

export async function queryComprehensiveReport(pool, { fieldKeys, filters, page = 1, pageSize = 25, forExport = false }) {
  const fields = resolveFields(fieldKeys);
  const safePage = Math.max(1, Number(page) || 1);
  const safePageSize = Math.min(100, Math.max(10, Number(pageSize) || 25));
  const exportLimit = 10000;

  const countRequest = pool.request();
  const whereSql = bindFilters(countRequest, filters);
  const countResult = await countRequest.query(`
    SELECT COUNT(*) AS Total
    ${FROM_SQL}
    ${whereSql}
  `);
  const total = countResult.recordset[0]?.Total || 0;

  const selectList = fields.map((field) => `(${field.sql}) AS [${field.key}]`).join(',\n');
  const dataRequest = pool.request();
  const dataWhere = bindFilters(dataRequest, filters);

  let dataSql;
  if (forExport) {
    dataRequest.input('ExportLimit', sql.Int, exportLimit);
    dataSql = `
      SELECT TOP (@ExportLimit)
        ${selectList}
      ${FROM_SQL}
      ${dataWhere}
      ORDER BY vr.CreatedAt DESC, vr.RequestID DESC
    `;
  } else {
    dataRequest.input('Offset', sql.Int, (safePage - 1) * safePageSize);
    dataRequest.input('PageSize', sql.Int, safePageSize);
    dataSql = `
      SELECT
        ${selectList}
      ${FROM_SQL}
      ${dataWhere}
      ORDER BY vr.CreatedAt DESC, vr.RequestID DESC
      OFFSET @Offset ROWS FETCH NEXT @PageSize ROWS ONLY
    `;
  }

  const dataResult = await dataRequest.query(dataSql);
  return {
    fields,
    rows: dataResult.recordset || [],
    total,
    page: forExport ? 1 : safePage,
    pageSize: forExport ? exportLimit : safePageSize,
    truncated: forExport && total > exportLimit
  };
}

export function statusLabel(value) {
  return STATUS_LABELS[value] || value;
}

export function buildExcelXml(fields, rows) {
  const header = fields.map((field) =>
    `<Cell><Data ss:Type="String">${xmlEscape(field.label)}</Data></Cell>`
  ).join('');

  const body = rows.map((row) => {
    const cells = fields.map((field) => cellXml(field, row[field.key])).join('');
    return `<Row>${cells}</Row>`;
  }).join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
<Worksheet ss:Name="گزارش جامع">
<Table>
<Row>${header}</Row>
${body}
</Table>
</Worksheet>
</Workbook>`;
}

function cellXml(field, value) {
  if (value == null || value === '') {
    return '<Cell><Data ss:Type="String"></Data></Cell>';
  }
  if (field.type === 'date') {
    const date = new Date(value);
    const text = Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString('fa-IR');
    return `<Cell><Data ss:Type="String">${xmlEscape(text)}</Data></Cell>`;
  }
  if (field.type === 'money' && value !== '' && !Number.isNaN(Number(value))) {
    return `<Cell><Data ss:Type="Number">${Number(value)}</Data></Cell>`;
  }
  return `<Cell><Data ss:Type="String">${xmlEscape(value)}</Data></Cell>`;
}

function xmlEscape(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
