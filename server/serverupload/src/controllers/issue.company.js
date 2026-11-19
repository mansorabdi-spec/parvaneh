import { getPool, sql } from '../lib/db.js';

// ---------------- Get Company Information by Owner's National Code -----------------
// This finds a company where the owner's national code matches (NationalCode field in CompanyInfo)
export async function getCompanyByOwnerNationalCode(req, res, next) {
  try {
    const { nationalCode } = req.params;
    
    if (!nationalCode) {
      return res.status(400).json({ message: 'National code is required' });
    }
    
    const pool = await getPool();
    
    // Get company info by owner's national code (NationalCode field)
    const companyResult = await pool.request()
      .input('NationalCode', sql.NVarChar(50), nationalCode)
      .query('SELECT * FROM CompanyInfo WHERE NationalCode = @NationalCode');
    
    if (!companyResult.recordset || companyResult.recordset.length === 0) {
      return res.status(404).json({ message: 'Company not found for this owner' });
    }
    
    const company = companyResult.recordset[0];
    const companyNationalId = company.NationalId;
    
    // Get company addresses
    const addressesResult = await pool.request()
      .input('NationalId', sql.NVarChar(100), companyNationalId)
      .query('SELECT * FROM CompanyAddresses WHERE NationalId = @NationalId');
    
    // Get company contacts
    const contactsResult = await pool.request()
      .input('NationalId', sql.NVarChar(100), companyNationalId)
      .query('SELECT * FROM CompanyContacts WHERE NationalId = @NationalId');
    
    // Get company representative
    const representativeResult = await pool.request()
      .input('NationalId', sql.NVarChar(100), companyNationalId)
      .query('SELECT * FROM CompanyRepresentatives WHERE NationalId = @NationalId');
    
    return res.status(200).json({
      company,
      addresses: addressesResult.recordset || [],
      contacts: contactsResult.recordset || [],
      representative: representativeResult.recordset && representativeResult.recordset.length > 0 
        ? representativeResult.recordset[0] 
        : null
    });
    
  } catch (e) {
    console.error('Error getting company by owner national code:', e);
    next(e);
  }
}

// ---------------- Get Company Information by NationalId -----------------
export async function getCompanyByNationalId(req, res, next) {
  try {
    const { nationalId } = req.params;
    
    if (!nationalId) {
      return res.status(400).json({ message: 'National ID is required' });
    }
    
    const pool = await getPool();
    
    // Get company info
    const companyResult = await pool.request()
      .input('NationalId', sql.NVarChar(100), nationalId)
      .query('SELECT * FROM CompanyInfo WHERE NationalId = @NationalId');
    
    if (!companyResult.recordset || companyResult.recordset.length === 0) {
      return res.status(404).json({ message: 'Company not found' });
    }
    
    const company = companyResult.recordset[0];
    
    // Get company addresses
    const addressesResult = await pool.request()
      .input('NationalId', sql.NVarChar(100), nationalId)
      .query('SELECT * FROM CompanyAddresses WHERE NationalId = @NationalId');
    
    // Get company contacts
    const contactsResult = await pool.request()
      .input('NationalId', sql.NVarChar(100), nationalId)
      .query('SELECT * FROM CompanyContacts WHERE NationalId = @NationalId');
    
    // Get company representative
    const representativeResult = await pool.request()
      .input('NationalId', sql.NVarChar(100), nationalId)
      .query('SELECT * FROM CompanyRepresentatives WHERE NationalId = @NationalId');
    
    return res.status(200).json({
      company,
      addresses: addressesResult.recordset || [],
      contacts: contactsResult.recordset || [],
      representative: representativeResult.recordset && representativeResult.recordset.length > 0 
        ? representativeResult.recordset[0] 
        : null
    });
    
  } catch (e) {
    console.error('Error getting company:', e);
    next(e);
  }
}

// ---------------- Upsert Company Information (for Legal Entities) -----------------
export async function upsertCompany(req, res, next) {
  try {
    const { companyInfo, companyRepresentative, managerInfo } = req.body;
    
    if (!companyInfo || !companyInfo.companyName) {
      return res.status(400).json({ message: 'Company name is required' });
    }
    
    if (!companyInfo.nationalId) {
      return res.status(400).json({ message: 'Company National ID is required' });
    }
    
    if (!companyInfo.nationalCode) {
      return res.status(400).json({ message: 'Company National Code is required' });
    }
    
    // Use NationalId as RegistrationNo if not provided (since RegistrationNo is NOT NULL in DB)
    if (!companyInfo.registrationNo) {
      companyInfo.registrationNo = companyInfo.nationalId;
    }
    
    const pool = await getPool();
    
    // Check if company already exists by NationalId (Primary Key)
    let companyExists = false;
    if (companyInfo.nationalId) {
      const existingCompany = await pool.request()
        .input('NationalId', sql.NVarChar(100), companyInfo.nationalId)
        .query('SELECT NationalId FROM CompanyInfo WHERE NationalId = @NationalId');
      
      if (existingCompany.recordset && existingCompany.recordset.length > 0) {
        companyExists = true;
      }
    }
    
    // Insert or update company
    if (companyExists) {
      // Update existing company
      await pool.request()
        .input('NationalId', sql.NVarChar(100), companyInfo.nationalId)
        .input('CompanyName', sql.NVarChar(500), companyInfo.companyName)
        .input('NationalCode', sql.NVarChar(50), companyInfo.nationalCode)
        .input('RegistrationNo', sql.NVarChar(100), companyInfo.registrationNo)
        .input('EconomicCode', sql.NVarChar(100), companyInfo.economicCode || null)
        .input('WorkshopName', sql.NVarChar(500), companyInfo.workshopName || null)
        .input('MainActivity', sql.NVarChar(500), companyInfo.mainActivity || null)
        .input('ActivityFieldId', sql.Int, companyInfo.activityFieldId || null)
        .input('CompanyTypeId', sql.Int, companyInfo.companyTypeId || null)
        .input('TonnageRateId', sql.Int, companyInfo.tonnageRateId || null)
        .input('RegistrationCityId', sql.Int, companyInfo.registrationCityId || null)
        .input('RegistrationDate', sql.NVarChar(50), companyInfo.registrationDate || null)
        .input('BusinessLicenseNo', sql.NVarChar(100), companyInfo.businessLicenseNo || null)
        .input('BusinessLicenseValidFrom', sql.NVarChar(50), companyInfo.businessLicenseValidFrom || null)
        .input('BusinessLicenseValidTo', sql.NVarChar(50), companyInfo.businessLicenseValidTo || null)
        .input('ManagerNationalCode', sql.NVarChar(20), managerInfo?.nationalCode || null)
        .input('UpdatedAt', sql.DateTime2, new Date())
        .input('UpdatedBy', sql.NVarChar(100), req.user?.username || null)
        .query(`
          UPDATE CompanyInfo SET
            CompanyName = @CompanyName,
            NationalCode = @NationalCode,
            RegistrationNo = @RegistrationNo,
            EconomicCode = @EconomicCode,
            WorkshopName = @WorkshopName,
            MainActivity = @MainActivity,
            ActivityFieldId = @ActivityFieldId,
            CompanyTypeId = @CompanyTypeId,
            TonnageRateId = @TonnageRateId,
            RegistrationCityId = @RegistrationCityId,
            RegistrationDate = @RegistrationDate,
            BusinessLicenseNo = @BusinessLicenseNo,
            BusinessLicenseValidFrom = @BusinessLicenseValidFrom,
            BusinessLicenseValidTo = @BusinessLicenseValidTo,
            ManagerNationalCode = @ManagerNationalCode,
            UpdatedAt = @UpdatedAt,
            UpdatedBy = @UpdatedBy
          WHERE NationalId = @NationalId
        `);
      
      console.log(`✅ Updated company ${companyInfo.nationalId}`);
    } else {
      // Insert new company
      await pool.request()
        .input('NationalId', sql.NVarChar(100), companyInfo.nationalId)
        .input('CompanyName', sql.NVarChar(500), companyInfo.companyName)
        .input('NationalCode', sql.NVarChar(50), companyInfo.nationalCode)
        .input('RegistrationNo', sql.NVarChar(100), companyInfo.registrationNo)
        .input('EconomicCode', sql.NVarChar(100), companyInfo.economicCode || null)
        .input('WorkshopName', sql.NVarChar(500), companyInfo.workshopName || null)
        .input('MainActivity', sql.NVarChar(500), companyInfo.mainActivity || null)
        .input('ActivityFieldId', sql.Int, companyInfo.activityFieldId || null)
        .input('CompanyTypeId', sql.Int, companyInfo.companyTypeId || null)
        .input('TonnageRateId', sql.Int, companyInfo.tonnageRateId || null)
        .input('RegistrationCityId', sql.Int, companyInfo.registrationCityId || null)
        .input('RegistrationDate', sql.NVarChar(50), companyInfo.registrationDate || null)
        .input('BusinessLicenseNo', sql.NVarChar(100), companyInfo.businessLicenseNo || null)
        .input('BusinessLicenseValidFrom', sql.NVarChar(50), companyInfo.businessLicenseValidFrom || null)
        .input('BusinessLicenseValidTo', sql.NVarChar(50), companyInfo.businessLicenseValidTo || null)
        .input('ManagerNationalCode', sql.NVarChar(20), managerInfo?.nationalCode || null)
        .input('CreatedAt', sql.DateTime2, new Date())
        .input('CreatedBy', sql.NVarChar(100), req.user?.username || null)
        .query(`
          INSERT INTO CompanyInfo (
            NationalId, NationalCode, RegistrationNo, CompanyName, 
            EconomicCode, WorkshopName, MainActivity, ActivityFieldId, 
            CompanyTypeId, TonnageRateId, RegistrationCityId, RegistrationDate, 
            BusinessLicenseNo, BusinessLicenseValidFrom, BusinessLicenseValidTo,
            ManagerNationalCode, CreatedAt, CreatedBy
          )
          VALUES (
            @NationalId, @NationalCode, @RegistrationNo, @CompanyName,
            @EconomicCode, @WorkshopName, @MainActivity, @ActivityFieldId,
            @CompanyTypeId, @TonnageRateId, @RegistrationCityId, @RegistrationDate,
            @BusinessLicenseNo, @BusinessLicenseValidFrom, @BusinessLicenseValidTo,
            @ManagerNationalCode, @CreatedAt, @CreatedBy
          )
        `);
      
      console.log(`✅ Created new company ${companyInfo.nationalId}`);
    }
    
    // Handle company addresses
    if (companyInfo.addresses && companyInfo.addresses.length > 0) {
      // Delete existing addresses
      await pool.request()
        .input('NationalId', sql.NVarChar(100), companyInfo.nationalId)
        .query('DELETE FROM CompanyAddresses WHERE NationalId = @NationalId');
      
      // Insert new addresses
      for (const addr of companyInfo.addresses) {
        await pool.request()
          .input('NationalId', sql.NVarChar(100), companyInfo.nationalId)
          .input('ProvinceId', sql.Int, addr.provinceId || null)
          .input('CityId', sql.Int, addr.cityId || null)
          .input('MainStreet', sql.NVarChar(200), addr.mainStreet || null)
          .input('SideStreet', sql.NVarChar(200), addr.sideStreet || null)
          .input('District', sql.NVarChar(100), addr.district || null)
          .input('PostalCode', sql.NVarChar(20), addr.postalCode || null)
          .input('Plaque', sql.NVarChar(50), addr.plaque || null)
          .input('Unit', sql.NVarChar(50), addr.unit || null)
          .input('Address', sql.NVarChar(500), addr.address || null)
          .input('CreatedAt', sql.DateTime2, new Date())
          .input('CreatedBy', sql.NVarChar(100), req.user?.username || null)
          .query(`
            INSERT INTO CompanyAddresses (
              NationalId, ProvinceId, CityId, MainStreet, SideStreet, 
              District, PostalCode, Plaque, Unit, Address, CreatedAt, CreatedBy
            )
            VALUES (
              @NationalId, @ProvinceId, @CityId, @MainStreet, @SideStreet, 
              @District, @PostalCode, @Plaque, @Unit, @Address, @CreatedAt, @CreatedBy
            )
          `);
      }
    }
    
    // Handle company contacts
    if (companyInfo.contacts && companyInfo.contacts.length > 0) {
      // Delete existing contacts
      await pool.request()
        .input('NationalId', sql.NVarChar(100), companyInfo.nationalId)
        .query('DELETE FROM CompanyContacts WHERE NationalId = @NationalId');
      
      // Insert new contacts
      for (const contact of companyInfo.contacts) {
        await pool.request()
          .input('NationalId', sql.NVarChar(100), companyInfo.nationalId)
          .input('Type', sql.NVarChar(20), contact.type || null)
          .input('Value', sql.NVarChar(255), contact.value || null)
          .input('IsActive', sql.Bit, contact.isActive ? 1 : 0)
          .input('CreatedAt', sql.DateTime2, new Date())
          .input('CreatedBy', sql.NVarChar(100), req.user?.username || null)
          .query(`
            INSERT INTO CompanyContacts (NationalId, Type, Value, IsActive, CreatedAt, CreatedBy)
            VALUES (@NationalId, @Type, @Value, @IsActive, @CreatedAt, @CreatedBy)
          `);
      }
    }
    
    // Handle company representative information (for fuel collection)
    if (companyRepresentative && companyRepresentative.nationalCode) {
      // Check if representative already exists
      const existingRep = await pool.request()
        .input('NationalId', sql.NVarChar(100), companyInfo.nationalId)
        .query('SELECT Id FROM CompanyRepresentatives WHERE NationalId = @NationalId');
      
      if (existingRep.recordset && existingRep.recordset.length > 0) {
        // Update existing representative
        await pool.request()
          .input('NationalId', sql.NVarChar(100), companyInfo.nationalId)
          .input('RepresentativeNationalCode', sql.NVarChar(20), companyRepresentative.nationalCode)
          .input('BirthDate', sql.NVarChar(50), companyRepresentative.birthDate || null)
          .input('PowerOfAttorneyNo', sql.NVarChar(100), companyRepresentative.powerOfAttorneyNo || null)
          .input('UpdatedAt', sql.DateTime2, new Date())
          .input('UpdatedBy', sql.NVarChar(100), req.user?.username || null)
          .query(`
            UPDATE CompanyRepresentatives SET
              RepresentativeNationalCode = @RepresentativeNationalCode,
              BirthDate = @BirthDate,
              PowerOfAttorneyNo = @PowerOfAttorneyNo,
              UpdatedAt = @UpdatedAt,
              UpdatedBy = @UpdatedBy
            WHERE NationalId = @NationalId
          `);
      } else {
        // Insert new representative
        await pool.request()
          .input('NationalId', sql.NVarChar(100), companyInfo.nationalId)
          .input('RepresentativeNationalCode', sql.NVarChar(20), companyRepresentative.nationalCode)
          .input('BirthDate', sql.NVarChar(50), companyRepresentative.birthDate || null)
          .input('PowerOfAttorneyNo', sql.NVarChar(100), companyRepresentative.powerOfAttorneyNo || null)
          .input('CreatedAt', sql.DateTime2, new Date())
          .input('CreatedBy', sql.NVarChar(100), req.user?.username || null)
          .query(`
            INSERT INTO CompanyRepresentatives (
              NationalId, RepresentativeNationalCode, BirthDate, PowerOfAttorneyNo, CreatedAt, CreatedBy
            )
            VALUES (
              @NationalId, @RepresentativeNationalCode, @BirthDate, @PowerOfAttorneyNo, @CreatedAt, @CreatedBy
            )
          `);
      }
    }
    
    // Handle manager (CEO) personal information
    if (managerInfo && managerInfo.nationalCode && managerInfo.nationalCode.length === 10) {
      // Check if person already exists in Persons table
      const existingPerson = await pool.request()
        .input('NationalCode', sql.NVarChar(20), managerInfo.nationalCode)
        .query('SELECT NationalCode FROM Persons WHERE NationalCode = @NationalCode');
      
      if (existingPerson.recordset && existingPerson.recordset.length > 0) {
        // Update existing person - only update if values are provided
        const updateFields = [];
        const request = pool.request().input('NationalCode', sql.NVarChar(20), managerInfo.nationalCode);
        
        if (managerInfo.firstName) {
          updateFields.push('FirstName = @FirstName');
          request.input('FirstName', sql.NVarChar(100), managerInfo.firstName);
        }
        if (managerInfo.lastName) {
          updateFields.push('LastName = @LastName');
          request.input('LastName', sql.NVarChar(100), managerInfo.lastName);
        }
        if (managerInfo.fatherName) {
          updateFields.push('FatherName = @FatherName');
          request.input('FatherName', sql.NVarChar(100), managerInfo.fatherName);
        }
        if (managerInfo.idSerial) {
          updateFields.push('IdSerial = @IdSerial');
          request.input('IdSerial', sql.NVarChar(50), managerInfo.idSerial);
        }
        if (managerInfo.birthProvinceId) {
          updateFields.push('BirthProvinceId = @BirthProvinceId');
          request.input('BirthProvinceId', sql.Int, parseInt(managerInfo.birthProvinceId));
        }
        if (managerInfo.birthCityId) {
          updateFields.push('BirthCityId = @BirthCityId');
          request.input('BirthCityId', sql.Int, parseInt(managerInfo.birthCityId));
        }
        if (managerInfo.birthDate) {
          updateFields.push('BirthDateJalali = @BirthDateJalali');
          request.input('BirthDateJalali', sql.NVarChar(10), managerInfo.birthDate);
        }
        if (managerInfo.gender) {
          updateFields.push('Gender = @Gender');
          request.input('Gender', sql.NVarChar(10), managerInfo.gender);
        }
        if (managerInfo.maritalStatus) {
          updateFields.push('MaritalStatus = @MaritalStatus');
          request.input('MaritalStatus', sql.NVarChar(20), managerInfo.maritalStatus);
        }
        
        if (updateFields.length > 0) {
          updateFields.push('ModifiedAt = @ModifiedAt');
          request.input('ModifiedAt', sql.DateTime2, new Date());
          
          await request.query(`
            UPDATE Persons SET
              ${updateFields.join(', ')}
            WHERE NationalCode = @NationalCode
          `);
          console.log(`✅ Updated manager info for ${managerInfo.nationalCode}`);
        }
      } else {
        // Insert new person - all required fields must be provided
        if (!managerInfo.firstName || !managerInfo.lastName || !managerInfo.fatherName || 
            !managerInfo.birthProvinceId || !managerInfo.birthDate || !managerInfo.gender || !managerInfo.maritalStatus) {
          console.log('⚠️ Missing required fields for new person, skipping insert');
        } else {
          await pool.request()
            .input('NationalCode', sql.NVarChar(20), managerInfo.nationalCode)
            .input('FirstName', sql.NVarChar(100), managerInfo.firstName)
            .input('LastName', sql.NVarChar(100), managerInfo.lastName)
            .input('FatherName', sql.NVarChar(100), managerInfo.fatherName)
            .input('IdSerial', sql.NVarChar(50), managerInfo.idSerial || '')
            .input('BirthProvinceId', sql.Int, parseInt(managerInfo.birthProvinceId))
            .input('BirthCityId', sql.Int, managerInfo.birthCityId ? parseInt(managerInfo.birthCityId) : null)
            .input('BirthDateJalali', sql.NVarChar(10), managerInfo.birthDate)
            .input('Gender', sql.NVarChar(10), managerInfo.gender)
            .input('MaritalStatus', sql.NVarChar(20), managerInfo.maritalStatus)
            .input('CreatedAt', sql.DateTime2, new Date())
            .query(`
              INSERT INTO Persons (
                NationalCode, FirstName, LastName, FatherName, IdSerial,
                BirthProvinceId, BirthCityId, BirthDateJalali, Gender, MaritalStatus, CreatedAt
              )
              VALUES (
                @NationalCode, @FirstName, @LastName, @FatherName, @IdSerial,
                @BirthProvinceId, @BirthCityId, @BirthDateJalali, @Gender, @MaritalStatus, @CreatedAt
              )
            `);
          console.log(`✅ Created new manager info for ${managerInfo.nationalCode}`);
        }
      }
      
      // Update ManagerNationalCode in CompanyInfo
      await pool.request()
        .input('NationalId', sql.NVarChar(100), companyInfo.nationalId)
        .input('ManagerNationalCode', sql.NVarChar(20), managerInfo.nationalCode)
        .query(`
          UPDATE CompanyInfo SET
            ManagerNationalCode = @ManagerNationalCode
          WHERE NationalId = @NationalId
        `);
      console.log(`✅ Updated ManagerNationalCode in CompanyInfo for ${companyInfo.nationalId}`);
    }
    
    return res.status(200).json({
      inserted: !companyExists,
      changed: companyExists,
      nationalId: companyInfo.nationalId
    });
    
  } catch (e) {
    console.error('Error upserting company:', e);
    next(e);
  }
}

// ---------------- Upload Company Document -----------------
export async function uploadCompanyDocument(req, res, next) {
  try {
    const { nationalId } = req.params;
    const { docTypeId } = req.body;
    const file = req.file;

    if (!nationalId || !docTypeId || !file) {
      return res.status(400).json({ message: 'National ID, document type, and file are required' });
    }

    const pool = await getPool();

    // Check if company exists
    const companyCheck = await pool.request()
      .input('NationalId', sql.NVarChar(100), nationalId)
      .query('SELECT NationalId FROM CompanyInfo WHERE NationalId = @NationalId');

    if (!companyCheck.recordset || companyCheck.recordset.length === 0) {
      return res.status(404).json({ message: 'Company not found' });
    }

    // Get document type name from lookup
    const lookupResult = await pool.request()
      .input('Id', sql.Int, docTypeId)
      .query('SELECT Name FROM LookupValue WHERE Id = @Id');

    const docTypeName = lookupResult.recordset && lookupResult.recordset.length > 0
      ? lookupResult.recordset[0].Name
      : 'Unknown';

    // Insert document
    const result = await pool.request()
      .input('NationalId', sql.NVarChar(100), nationalId)
      .input('LookupDocTypeId', sql.Int, docTypeId)
      .input('FileContent', sql.VarBinary, file.buffer)
      .input('MimeType', sql.NVarChar(100), file.mimetype)
      .input('SizeBytes', sql.Int, file.size)
      .query(`
        INSERT INTO CompanyDocuments (NationalId, LookupDocTypeId, FileContent, MimeType, SizeBytes)
        OUTPUT INSERTED.DocID, INSERTED.NationalId, INSERTED.LookupDocTypeId
        VALUES (@NationalId, @LookupDocTypeId, @FileContent, @MimeType, @SizeBytes)
      `);

    const inserted = result.recordset[0];

    return res.status(201).json({
      DocID: inserted.DocID,
      NationalId: inserted.NationalId,
      LookupDocTypeId: inserted.LookupDocTypeId,
      DocTypeName: docTypeName,
      MimeType: file.mimetype,
      SizeBytes: file.size
    });

  } catch (e) {
    console.error('Error uploading company document:', e);
    next(e);
  }
}

// ---------------- Get Company Documents -----------------
export async function getCompanyDocuments(req, res, next) {
  try {
    const { nationalId } = req.params;

    if (!nationalId) {
      return res.status(400).json({ message: 'National ID is required' });
    }

    const pool = await getPool();

    // Get all documents for the company
    const result = await pool.request()
      .input('NationalId', sql.NVarChar(100), nationalId)
      .query(`
        SELECT 
          cd.DocID,
          cd.NationalId,
          cd.LookupDocTypeId,
          lv.Name as DocTypeName,
          cd.MimeType,
          cd.SizeBytes,
          cd.CreatedAt
        FROM CompanyDocuments cd
        LEFT JOIN LookupValue lv ON cd.LookupDocTypeId = lv.Id
        WHERE cd.NationalId = @NationalId
        ORDER BY cd.CreatedAt DESC
      `);

    return res.status(200).json(result.recordset || []);

  } catch (e) {
    console.error('Error getting company documents:', e);
    next(e);
  }
}

// ---------------- Get Company Document Content -----------------
export async function getCompanyDocumentContent(req, res, next) {
  try {
    const { nationalId, docId } = req.params;

    if (!nationalId || !docId) {
      return res.status(400).json({ message: 'National ID and document ID are required' });
    }

    const pool = await getPool();

    const result = await pool.request()
      .input('NationalId', sql.NVarChar(100), nationalId)
      .input('DocID', sql.BigInt, docId)
      .query(`
        SELECT FileContent, MimeType
        FROM CompanyDocuments
        WHERE NationalId = @NationalId AND DocID = @DocID
      `);

    if (!result.recordset || result.recordset.length === 0) {
      return res.status(404).json({ message: 'Document not found' });
    }

    const doc = result.recordset[0];
    res.set('Content-Type', doc.MimeType);
    return res.send(doc.FileContent);

  } catch (e) {
    console.error('Error getting company document content:', e);
    next(e);
  }
}

// ---------------- Delete Company Document -----------------
export async function deleteCompanyDocument(req, res, next) {
  try {
    const { nationalId, docId } = req.params;

    if (!nationalId || !docId) {
      return res.status(400).json({ message: 'National ID and document ID are required' });
    }

    const pool = await getPool();

    const result = await pool.request()
      .input('NationalId', sql.NVarChar(100), nationalId)
      .input('DocID', sql.BigInt, docId)
      .query(`
        DELETE FROM CompanyDocuments
        WHERE NationalId = @NationalId AND DocID = @DocID
      `);

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ message: 'Document not found' });
    }

    return res.status(200).json({ message: 'Document deleted successfully' });

  } catch (e) {
    console.error('Error deleting company document:', e);
    next(e);
  }
}
