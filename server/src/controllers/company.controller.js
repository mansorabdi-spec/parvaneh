import { getPool, sql } from '../lib/db.js';

/**
 * Get company by owner's NationalCode
 * Returns company info with addresses and contacts based on owner's national code
 */
export async function getCompanyByOwnerNationalCode(req, res, next) {
  try {
    const nationalCode = String(req.params.nationalCode || '').trim();
    
    console.log('🔍 Searching for company with NationalCode:', nationalCode);
    
    if (!nationalCode) {
      return res.status(400).json({ message: 'کد ملی الزامی است' });
    }

    const pool = await getPool();
    
    // Get company basic info by NationalCode (owner's national code)
    // Also fetch the TonnageRate lookup value which contains the capacity
    const companyResult = await pool.request()
      .input('NationalCode', sql.NVarChar(50), nationalCode)
      .query(`
        SELECT 
          ci.NationalId,
          ci.NationalCode,
          ci.RegistrationNo,
          ci.CompanyTypeId,
          ci.CompanyName,
          ci.WorkshopName,
          ci.BusinessLicenseNo,
          ci.EconomicCode,
          ci.MainActivity,
          ci.ActivityFieldId,
          ci.TonnageRateId,
          ci.RegistrationDate,
          ci.BusinessLicenseValidFrom,
          ci.BusinessLicenseValidTo,
          ci.ParentCompanyId,
          ci.ManagerNationalCode,
          ci.CreatedAt,
          ci.UpdatedAt,
          lv.Name AS TonnageRateName,
          lv.Code AS Capacity
        FROM CompanyInfo ci
        LEFT JOIN LookupValue lv ON ci.TonnageRateId = lv.Id
        WHERE ci.NationalCode = @NationalCode
      `);

    console.log('📊 Query result count:', companyResult.recordset?.length || 0);
    if (companyResult.recordset?.length > 0) {
      console.log('✅ Company found:', companyResult.recordset[0].CompanyName, '- NationalId:', companyResult.recordset[0].NationalId);
    }

    if (!companyResult.recordset || companyResult.recordset.length === 0) {
      console.log('❌ No company found for NationalCode:', nationalCode);
      return res.status(404).json({ 
        message: 'شرکتی برای این کد ملی یافت نشد',
        company: null 
      });
    }

    const company = companyResult.recordset[0];

    // Get company addresses
    const addressesResult = await pool.request()
      .input('NationalId', sql.NVarChar(100), company.NationalId)
      .query(`
        SELECT 
          AddressID,
          NationalId,
          ProvinceId,
          CityId,
          MainStreet,
          SideStreet,
          District,
          PostalCode,
          Plaque,
          Unit,
          Address,
          CreatedAt
        FROM CompanyAddresses
        WHERE NationalId = @NationalId
        ORDER BY AddressID
      `);

    // Get company contacts
    const contactsResult = await pool.request()
      .input('NationalId', sql.NVarChar(100), company.NationalId)
      .query(`
        SELECT 
          ContactID,
          NationalId,
          Type,
          Value,
          IsActive,
          CreatedAt
        FROM CompanyContacts
        WHERE NationalId = @NationalId
        ORDER BY ContactID
      `);

    // Get company representative
    const representativeResult = await pool.request()
      .input('NationalId', sql.NVarChar(100), company.NationalId)
      .query(`
        SELECT 
          Id,
          NationalId,
          RepresentativeNationalCode,
          BirthDate,
          PowerOfAttorneyNo,
          CreatedAt,
          UpdatedAt
        FROM CompanyRepresentatives
        WHERE NationalId = @NationalId
      `);

    // Get manager (CEO) personal information if ManagerNationalCode exists
    let manager = null;
    if (company.ManagerNationalCode) {
      const managerResult = await pool.request()
        .input('NationalCode', sql.NVarChar(20), company.ManagerNationalCode)
        .query(`
          SELECT 
            NationalCode,
            FirstName,
            LastName,
            FatherName,
            IdSerial,
            BirthProvinceId,
            BirthCityId,
            BirthDateJalali,
            Gender,
            MaritalStatus
          FROM Persons
          WHERE NationalCode = @NationalCode
        `);
      
      if (managerResult.recordset && managerResult.recordset.length > 0) {
        manager = managerResult.recordset[0];
        console.log('✅ Manager info loaded for company:', company.CompanyName, '- Manager:', manager.FirstName, manager.LastName);
      }
    }

    return res.json({
      success: true,
      company: company,
      addresses: addressesResult.recordset || [],
      contacts: contactsResult.recordset || [],
      representative: representativeResult.recordset?.[0] || null,
      manager: manager
    });

  } catch (error) {
    console.error('Error getting company by owner national code:', error);
    next(error);
  }
}

/**
 * Get company by NationalId
 * Returns company info with addresses and contacts
 */
export async function getCompanyByNationalId(req, res, next) {
  try {
    const nationalId = String(req.params.nationalId || '').trim();
    
    if (!nationalId) {
      return res.status(400).json({ message: 'شناسه ملی الزامی است' });
    }

    const pool = await getPool();
    
    // Get company basic info
    const companyResult = await pool.request()
      .input('NationalId', sql.NVarChar(100), nationalId)
      .query(`
        SELECT 
          NationalId,
          NationalCode,
          RegistrationNo,
          CompanyTypeId,
          CompanyName,
          WorkshopName,
          BusinessLicenseNo,
          EconomicCode,
          MainActivity,
          ActivityFieldId,
          TonnageRateId,
          RegistrationDate,
          BusinessLicenseValidFrom,
          BusinessLicenseValidTo,
          ParentCompanyId,
          CreatedAt,
          UpdatedAt
        FROM CompanyInfo
        WHERE NationalId = @NationalId
      `);

    if (!companyResult.recordset || companyResult.recordset.length === 0) {
      return res.status(404).json({ 
        message: 'شرکتی با این شناسه ملی یافت نشد',
        company: null 
      });
    }

    const company = companyResult.recordset[0];

    // Get company addresses
    const addressesResult = await pool.request()
      .input('NationalId', sql.NVarChar(100), nationalId)
      .query(`
        SELECT 
          AddressID,
          NationalId,
          ProvinceId,
          CityId,
          MainStreet,
          SideStreet,
          District,
          PostalCode,
          Plaque,
          Unit,
          Address,
          CreatedAt
        FROM CompanyAddresses
        WHERE NationalId = @NationalId
        ORDER BY AddressID
      `);

    // Get company contacts
    const contactsResult = await pool.request()
      .input('NationalId', sql.NVarChar(100), nationalId)
      .query(`
        SELECT 
          ContactID,
          NationalId,
          Type,
          Value,
          IsActive,
          CreatedAt
        FROM CompanyContacts
        WHERE NationalId = @NationalId
        ORDER BY ContactID
      `);

    return res.json({
      success: true,
      company: company,
      addresses: addressesResult.recordset || [],
      contacts: contactsResult.recordset || []
    });

  } catch (error) {
    console.error('Error getting company:', error);
    next(error);
  }
}

/**
 * Upsert company information (create or update)
 * Includes company info, addresses, and contacts
 */
export async function upsertCompany(req, res, next) {
  try {
    const {
      nationalId,
      nationalCode,
      registrationNo,
      companyTypeId,
      companyName,
      workshopName,
      businessLicenseNo,
      economicCode,
      mainActivity,
      activityFieldId,
      tonnageRateId,
      registrationDate,
      businessLicenseValidFrom,
      businessLicenseValidTo,
      parentCompanyId,
      addresses,
      contacts
    } = req.body;

    // Validate required fields
    if (!nationalId || !nationalId.trim()) {
      return res.status(400).json({ message: 'شناسه ملی الزامی است' });
    }

    if (!nationalCode || !nationalCode.trim()) {
      return res.status(400).json({ message: 'کد ملی صاحب شرکت الزامی است' });
    }

    if (!registrationNo || !registrationNo.trim()) {
      return res.status(400).json({ message: 'شماره ثبت الزامی است' });
    }

    if (!companyName || !companyName.trim()) {
      return res.status(400).json({ message: 'نام شرکت الزامی است' });
    }

    const pool = await getPool();

    // Check if user already has a company registered with their NationalCode
    const userCompanyCheck = await pool.request()
      .input('NationalCode', sql.NVarChar(50), nationalCode.trim())
      .query('SELECT NationalId FROM CompanyInfo WHERE NationalCode = @NationalCode');

    // If user has a company but is trying to register a different one, reject
    if (userCompanyCheck.recordset && userCompanyCheck.recordset.length > 0) {
      const existingNationalId = userCompanyCheck.recordset[0].NationalId;
      if (existingNationalId !== nationalId.trim()) {
        return res.status(400).json({ 
          message: 'شما قبلاً یک شرکت ثبت کرده‌اید. هر کاربر فقط مجاز به ثبت یک شرکت است.',
          existingNationalId: existingNationalId
        });
      }
    }

    // Check if company exists by NationalId
    const existingCompany = await pool.request()
      .input('NationalId', sql.NVarChar(100), nationalId.trim())
      .query('SELECT NationalId FROM CompanyInfo WHERE NationalId = @NationalId');

    if (existingCompany.recordset && existingCompany.recordset.length > 0) {
      // Update existing company
      await pool.request()
        .input('NationalId', sql.NVarChar(100), nationalId.trim())
        .input('NationalCode', sql.NVarChar(50), nationalCode.trim())
        .input('RegistrationNo', sql.NVarChar(100), registrationNo.trim())
        .input('CompanyTypeId', sql.Int, companyTypeId || null)
        .input('CompanyName', sql.NVarChar(500), companyName.trim())
        .input('WorkshopName', sql.NVarChar(500), workshopName || null)
        .input('BusinessLicenseNo', sql.NVarChar(100), businessLicenseNo || null)
        .input('EconomicCode', sql.NVarChar(100), economicCode || null)
        .input('MainActivity', sql.NVarChar(500), mainActivity || null)
        .input('ActivityFieldId', sql.Int, activityFieldId || null)
        .input('TonnageRateId', sql.Int, tonnageRateId || null)
        .input('RegistrationDate', sql.NVarChar(50), registrationDate || null)
        .input('BusinessLicenseValidFrom', sql.NVarChar(50), businessLicenseValidFrom || null)
        .input('BusinessLicenseValidTo', sql.NVarChar(50), businessLicenseValidTo || null)
        .input('ParentCompanyId', sql.Int, parentCompanyId || null)
        .query(`
          UPDATE CompanyInfo
          SET 
            NationalCode = @NationalCode,
            RegistrationNo = @RegistrationNo,
            CompanyTypeId = @CompanyTypeId,
            CompanyName = @CompanyName,
            WorkshopName = @WorkshopName,
            BusinessLicenseNo = @BusinessLicenseNo,
            EconomicCode = @EconomicCode,
            MainActivity = @MainActivity,
            ActivityFieldId = @ActivityFieldId,
            TonnageRateId = @TonnageRateId,
            RegistrationDate = @RegistrationDate,
            BusinessLicenseValidFrom = @BusinessLicenseValidFrom,
            BusinessLicenseValidTo = @BusinessLicenseValidTo,
            ParentCompanyId = @ParentCompanyId,
            UpdatedAt = SYSUTCDATETIME()
          WHERE NationalId = @NationalId
        `);
    } else {
      // Insert new company
      await pool.request()
        .input('NationalId', sql.NVarChar(100), nationalId.trim())
        .input('NationalCode', sql.NVarChar(50), nationalCode.trim())
        .input('RegistrationNo', sql.NVarChar(100), registrationNo.trim())
        .input('CompanyTypeId', sql.Int, companyTypeId || null)
        .input('CompanyName', sql.NVarChar(500), companyName.trim())
        .input('WorkshopName', sql.NVarChar(500), workshopName || null)
        .input('BusinessLicenseNo', sql.NVarChar(100), businessLicenseNo || null)
        .input('EconomicCode', sql.NVarChar(100), economicCode || null)
        .input('MainActivity', sql.NVarChar(500), mainActivity || null)
        .input('ActivityFieldId', sql.Int, activityFieldId || null)
        .input('TonnageRateId', sql.Int, tonnageRateId || null)
        .input('RegistrationDate', sql.NVarChar(50), registrationDate || null)
        .input('BusinessLicenseValidFrom', sql.NVarChar(50), businessLicenseValidFrom || null)
        .input('BusinessLicenseValidTo', sql.NVarChar(50), businessLicenseValidTo || null)
        .input('ParentCompanyId', sql.Int, parentCompanyId || null)
        .query(`
          INSERT INTO CompanyInfo (
            NationalId, NationalCode, RegistrationNo, CompanyTypeId, CompanyName,
            WorkshopName, BusinessLicenseNo, EconomicCode, MainActivity,
            ActivityFieldId, TonnageRateId, RegistrationDate, BusinessLicenseValidFrom,
            BusinessLicenseValidTo, ParentCompanyId
          )
          VALUES (
            @NationalId, @NationalCode, @RegistrationNo, @CompanyTypeId, @CompanyName,
            @WorkshopName, @BusinessLicenseNo, @EconomicCode, @MainActivity,
            @ActivityFieldId, @TonnageRateId, @RegistrationDate, @BusinessLicenseValidFrom,
            @BusinessLicenseValidTo, @ParentCompanyId
          )
        `);
    }

    // Update addresses - delete existing and insert new
    if (addresses && Array.isArray(addresses)) {
      await pool.request()
        .input('NationalId', sql.NVarChar(100), nationalId.trim())
        .query('DELETE FROM CompanyAddresses WHERE NationalId = @NationalId');

      for (const address of addresses) {
        await pool.request()
          .input('NationalId', sql.NVarChar(100), nationalId.trim())
          .input('ProvinceId', sql.Int, address.provinceId || address.ProvinceId || null)
          .input('CityId', sql.Int, address.cityId || address.CityId || null)
          .input('MainStreet', sql.NVarChar(200), address.mainStreet || address.MainStreet || null)
          .input('SideStreet', sql.NVarChar(200), address.sideStreet || address.SideStreet || null)
          .input('District', sql.NVarChar(100), address.district || address.District || null)
          .input('PostalCode', sql.NVarChar(20), address.postalCode || address.PostalCode || null)
          .input('Plaque', sql.NVarChar(50), address.plaque || address.Plaque || null)
          .input('Unit', sql.NVarChar(50), address.unit || address.Unit || null)
          .input('Address', sql.NVarChar(500), address.address || address.Address || null)
          .query(`
            INSERT INTO CompanyAddresses (
              NationalId, ProvinceId, CityId, MainStreet, SideStreet,
              District, PostalCode, Plaque, Unit, Address
            )
            VALUES (
              @NationalId, @ProvinceId, @CityId, @MainStreet, @SideStreet,
              @District, @PostalCode, @Plaque, @Unit, @Address
            )
          `);
      }
    }

    // Update contacts - delete existing and insert new
    if (contacts && Array.isArray(contacts)) {
      await pool.request()
        .input('NationalId', sql.NVarChar(100), nationalId.trim())
        .query('DELETE FROM CompanyContacts WHERE NationalId = @NationalId');

      for (const contact of contacts) {
        await pool.request()
          .input('NationalId', sql.NVarChar(100), nationalId.trim())
          .input('Type', sql.NVarChar(20), contact.type || contact.Type || null)
          .input('Value', sql.NVarChar(255), contact.value || contact.Value || null)
          .input('IsActive', sql.Bit, contact.isActive || contact.IsActive ? 1 : 0)
          .query(`
            INSERT INTO CompanyContacts (NationalId, Type, Value, IsActive)
            VALUES (@NationalId, @Type, @Value, @IsActive)
          `);
      }
    }

    return res.json({
      success: true,
      nationalId: nationalId.trim(),
      message: 'اطلاعات شرکت با موفقیت ذخیره شد'
    });

  } catch (error) {
    console.error('Error upserting company:', error);
    next(error);
  }
}

/**
 * Get all companies
 * Returns list of all companies with basic info
 */
export async function getAllCompanies(req, res, next) {
  try {
    const pool = await getPool();
    
    const result = await pool.request()
      .query(`
        SELECT 
          NationalId,
          CompanyName,
          ManagerNationalCode,
          NationalCode,
          RegistrationNo,
          EconomicCode,
          CreatedAt
        FROM CompanyInfo
        ORDER BY CompanyName
      `);

    return res.json({
      success: true,
      companies: result.recordset || []
    });

  } catch (error) {
    console.error('Error getting all companies:', error);
    next(error);
  }
}

/**
 * Get company name by manager's national code
 * Returns company name for users with کارگزار (بهره بردار) role
 */
export async function getCompanyNameByManagerNationalCode(req, res, next) {
  try {
    const managerNationalCode = String(req.params.managerNationalCode || '').trim();
    
    if (!managerNationalCode) {
      return res.status(400).json({ message: 'کد ملی مدیر الزامی است' });
    }

    const pool = await getPool();
    
    const result = await pool.request()
      .input('ManagerNationalCode', sql.NVarChar(20), managerNationalCode)
      .query(`
        SELECT CompanyName
        FROM CompanyInfo
        WHERE ManagerNationalCode = @ManagerNationalCode
      `);

    if (!result.recordset || result.recordset.length === 0) {
      return res.json({
        success: true,
        companyName: null
      });
    }

    return res.json({
      success: true,
      companyName: result.recordset[0].CompanyName
    });

  } catch (error) {
    console.error('Error getting company name by manager national code:', error);
    next(error);
  }
}

/**
 * Delete company by NationalId
 */
export async function deleteCompany(req, res, next) {
  try {
    const nationalId = String(req.params.nationalId || '').trim();
    
    if (!nationalId) {
      return res.status(400).json({ message: 'شناسه ملی الزامی است' });
    }

    const pool = await getPool();
    
    // Delete company (CASCADE will delete addresses and contacts)
    const result = await pool.request()
      .input('NationalId', sql.NVarChar(100), nationalId)
      .query('DELETE FROM CompanyInfo WHERE NationalId = @NationalId');

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ message: 'شرکتی با این شناسه ملی یافت نشد' });
    }

    return res.json({
      success: true,
      message: 'شرکت با موفقیت حذف شد'
    });

  } catch (error) {
    console.error('Error deleting company:', error);
    next(error);
  }
}

/**
 * Get all companies with their manager (CEO) information
 * Returns list of companies from CompanyInfo with manager details from Persons
 */
export async function getAllCompaniesWithManagers(req, res, next) {
  try {
    const pool = await getPool();
    
    const result = await pool.request()
      .query(`
        SELECT 
          ci.NationalId,
          ci.CompanyName,
          ci.ManagerNationalCode,
          ci.NationalCode,
          ci.RegistrationNo,
          ci.EconomicCode,
          ci.CreatedAt,
          p.FirstName AS ManagerFirstName,
          p.LastName AS ManagerLastName,
          p.FatherName AS ManagerFatherName,
          p.IdSerial AS ManagerIdSerial,
          p.BirthProvinceId AS ManagerBirthProvinceId,
          p.BirthCityId AS ManagerBirthCityId,
          p.BirthDateJalali AS ManagerBirthDateJalali,
          p.Gender AS ManagerGender,
          p.MaritalStatus AS ManagerMaritalStatus
        FROM CompanyInfo ci
        LEFT JOIN Persons p ON ci.ManagerNationalCode = p.NationalCode
        ORDER BY ci.CompanyName
      `);

    return res.json({
      success: true,
      companies: result.recordset || []
    });

  } catch (error) {
    console.error('Error getting all companies with managers:', error);
    next(error);
  }
}

/**
 * Upsert company manager (CEO) information
 * Adds or updates manager info in Persons table and links to CompanyInfo
 */
export async function upsertCompanyManager(req, res, next) {
  try {
    const {
      nationalId,
      managerNationalCode,
      firstName,
      lastName,
      fatherName,
      idSerial,
      birthProvinceId,
      birthCityId,
      birthDateJalali,
      gender,
      maritalStatus
    } = req.body;

    // Validate required fields
    if (!nationalId || !nationalId.trim()) {
      return res.status(400).json({ message: 'شناسه ملی شرکت الزامی است' });
    }

    if (!managerNationalCode || !managerNationalCode.trim()) {
      return res.status(400).json({ message: 'کد ملی مدیرعامل الزامی است' });
    }

    if (!firstName || !firstName.trim()) {
      return res.status(400).json({ message: 'نام مدیرعامل الزامی است' });
    }

    if (!lastName || !lastName.trim()) {
      return res.status(400).json({ message: 'نام خانوادگی مدیرعامل الزامی است' });
    }

    const pool = await getPool();

    // Check if company exists
    const companyCheck = await pool.request()
      .input('NationalId', sql.NVarChar(100), nationalId.trim())
      .query('SELECT NationalId FROM CompanyInfo WHERE NationalId = @NationalId');

    if (!companyCheck.recordset || companyCheck.recordset.length === 0) {
      return res.status(404).json({ message: 'شرکتی با این شناسه ملی یافت نشد' });
    }

    // Check if manager already exists in Persons table
    const existingManager = await pool.request()
      .input('NationalCode', sql.NVarChar(20), managerNationalCode.trim())
      .query('SELECT NationalCode FROM Persons WHERE NationalCode = @NationalCode');

    if (existingManager.recordset && existingManager.recordset.length > 0) {
      // Update existing manager
      await pool.request()
        .input('NationalCode', sql.NVarChar(20), managerNationalCode.trim())
        .input('FirstName', sql.NVarChar(100), firstName.trim())
        .input('LastName', sql.NVarChar(100), lastName.trim())
        .input('FatherName', sql.NVarChar(100), fatherName || null)
        .input('IdSerial', sql.NVarChar(50), idSerial || null)
        .input('BirthProvinceId', sql.Int, birthProvinceId || null)
        .input('BirthCityId', sql.Int, birthCityId || null)
        .input('BirthDateJalali', sql.NVarChar(50), birthDateJalali || null)
        .input('Gender', sql.NVarChar(10), gender || null)
        .input('MaritalStatus', sql.NVarChar(20), maritalStatus || null)
        .query(`
          UPDATE Persons
          SET 
            FirstName = @FirstName,
            LastName = @LastName,
            FatherName = @FatherName,
            IdSerial = @IdSerial,
            BirthProvinceId = @BirthProvinceId,
            BirthCityId = @BirthCityId,
            BirthDateJalali = @BirthDateJalali,
            Gender = @Gender,
            MaritalStatus = @MaritalStatus
          WHERE NationalCode = @NationalCode
        `);
    } else {
      // Insert new manager
      await pool.request()
        .input('NationalCode', sql.NVarChar(20), managerNationalCode.trim())
        .input('FirstName', sql.NVarChar(100), firstName.trim())
        .input('LastName', sql.NVarChar(100), lastName.trim())
        .input('FatherName', sql.NVarChar(100), fatherName || null)
        .input('IdSerial', sql.NVarChar(50), idSerial || null)
        .input('BirthProvinceId', sql.Int, birthProvinceId || null)
        .input('BirthCityId', sql.Int, birthCityId || null)
        .input('BirthDateJalali', sql.NVarChar(50), birthDateJalali || null)
        .input('Gender', sql.NVarChar(10), gender || null)
        .input('MaritalStatus', sql.NVarChar(20), maritalStatus || null)
        .query(`
          INSERT INTO Persons (
            NationalCode, FirstName, LastName, FatherName, IdSerial,
            BirthProvinceId, BirthCityId, BirthDateJalali, Gender, MaritalStatus
          )
          VALUES (
            @NationalCode, @FirstName, @LastName, @FatherName, @IdSerial,
            @BirthProvinceId, @BirthCityId, @BirthDateJalali, @Gender, @MaritalStatus
          )
        `);
    }

    // Update CompanyInfo to link the manager
    await pool.request()
      .input('NationalId', sql.NVarChar(100), nationalId.trim())
      .input('ManagerNationalCode', sql.NVarChar(20), managerNationalCode.trim())
      .query(`
        UPDATE CompanyInfo
        SET ManagerNationalCode = @ManagerNationalCode,
            UpdatedAt = SYSUTCDATETIME()
        WHERE NationalId = @NationalId
      `);

    return res.json({
      success: true,
      message: 'اطلاعات مدیرعامل با موفقیت ذخیره شد'
    });

  } catch (error) {
    console.error('Error upserting company manager:', error);
    next(error);
  }
}
