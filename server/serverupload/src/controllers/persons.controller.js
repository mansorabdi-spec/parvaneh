import { getPool, sql } from '../lib/db.js';

/**
 * Get person by national code
 * Used for Employment License to check if person already exists
 */
export async function getPersonByNationalCode(req, res, next) {
  try {
    const nationalCode = String(req.params.nationalCode || '').trim();
    
    if (!nationalCode || nationalCode.length !== 10) {
      return res.status(400).json({ message: 'کد ملی 10 رقمی الزامی است' });
    }

    const pool = await getPool();
    
    // Get person basic info
    const personResult = await pool.request()
      .input('NationalCode', sql.NVarChar(20), nationalCode)
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
          MaritalStatus,
          OtherBloodGroup,
          OtherEducationLevel,
          OtherPhysicalStatus,
          OtherMilitaryStatus,
          OtherEnglishLevel,
          OtherVeteranStatus,
          CreatedAt,
          ModifiedAt
        FROM Persons
        WHERE NationalCode = @NationalCode
      `);

    if (!personResult.recordset || personResult.recordset.length === 0) {
      return res.status(404).json({ 
        message: 'شخصی با این کد ملی یافت نشد',
        person: null 
      });
    }

    const person = personResult.recordset[0];

    // Get person residences
    const residencesResult = await pool.request()
      .input('NationalCode', sql.NVarChar(20), person.NationalCode)
      .query(`
        SELECT 
          ResidenceID,
          ProvinceId,
          CityId,
          MainStreet,
          SideStreet,
          District,
          PostalCode,
          Plaque,
          Unit,
          Address
        FROM PersonResidences
        WHERE NationalCode = @NationalCode
        ORDER BY ResidenceID
      `);

    // Get person contacts
    const contactsResult = await pool.request()
      .input('NationalCode', sql.NVarChar(20), person.NationalCode)
      .query(`
        SELECT 
          ContactID,
          Type,
          Value,
          IsActive
        FROM PersonContacts
        WHERE NationalCode = @NationalCode
        ORDER BY ContactID
      `);

    // Get person vehicles
    const vehiclesResult = await pool.request()
      .input('NationalCode', sql.NVarChar(20), person.NationalCode)
      .query(`
        SELECT 
          VehicleID,
          PlateTypeId,
          PlateSerial2,
          PlateThreeDigits,
          PlateLetter,
          PlateRegion2,
          VIN,
          ChassisNo,
          YearManufacture,
          Capacity
        FROM Vehicles
        WHERE RegistrarNationalCode = @NationalCode
        ORDER BY VehicleID
      `);

    // Get person other info from PersonOtherInfo table
    const otherInfoResult = await pool.request()
      .input('NationalCode', sql.NVarChar(20), person.NationalCode)
      .query(`
        SELECT 
          OtherInfoID,
          NationalCode,
          PhysicalStatus,
          JobStatus,
          MilitaryStatus,
          EducationLevel,
          SelfSacrificeStatus,
          FluencyEnglish,
          CertificateType,
          ValidityPeriod,
          HealthCardNo,
          HealthCardIssueDate,
          HealthCardExpiryDate,
          DrivingLicenseNo,
          DrivingLicenseIssueDate,
          DrivingLicenseExpiryDate,
          InsuranceType,
          InsuranceStartDate,
          InsuranceExpiryDate,
          NoCriminalRecordNo,
          CreatedAt,
          ModifiedAt
        FROM PersonOtherInfo
        WHERE NationalCode = @NationalCode
      `);

    // Get person documents from PersonDocuments table
    const documentsResult = await pool.request()
      .input('NationalCode', sql.NVarChar(20), person.NationalCode)
      .query(`
        SELECT 
          DocID,
          NationalCode,
          LookupDocTypeId,
          MimeType,
          SizeBytes,
          CreatedAt
        FROM PersonDocuments
        WHERE NationalCode = @NationalCode
        ORDER BY CreatedAt DESC
      `);

    return res.json({
      person: person,
      residences: residencesResult.recordset || [],
      contacts: contactsResult.recordset || [],
      vehicles: vehiclesResult.recordset || [],
      otherInfo: otherInfoResult.recordset && otherInfoResult.recordset.length > 0 
        ? otherInfoResult.recordset[0] 
        : null,
      documents: documentsResult.recordset || []
    });

  } catch (error) {
    console.error('Error fetching person by national code:', error);
    next(error);
  }
}

/**
 * Create or update person information
 * Used when submitting employment license
 */
export async function upsertPerson(req, res, next) {
  try {
    const {
      firstName,
      lastName,
      fatherName,
      nationalCode,
      idSerial,
      birthProvinceId,
      birthCityId,
      birthDateJalali,
      birthDate, // Alternative field name
      gender,
      maritalStatus,
      residences,
      contacts,
      vehicles,
      otherInfo,
      documents
    } = req.body;

    if (!nationalCode || nationalCode.length !== 10) {
      return res.status(400).json({ message: 'کد ملی 10 رقمی الزامی است' });
    }

    // If only documents are being updated, skip person validation
    const isDocumentsOnly = documents && Array.isArray(documents) && !firstName && !lastName;
    
    // Support both birthDate and birthDateJalali field names
    const birthDateValue = birthDateJalali || birthDate;
    
    if (!isDocumentsOnly) {
      if (!firstName || !lastName || !fatherName) {
        return res.status(400).json({ message: 'نام، نام خانوادگی و نام پدر الزامی است' });
      }

      if (!birthDateValue || !gender || !maritalStatus) {
        return res.status(400).json({ message: 'تاریخ تولد، جنسیت و وضعیت تأهل الزامی است' });
      }
    }

    const pool = await getPool();
    const userId = req.user?.userId || null;
    // Normalize gender to Persian values for consistency across the project
    const normalizedGender = (gender === 'male') ? 'مرد' : (gender === 'female') ? 'زن' : gender;
    // Normalize marital status to Persian values for consistency
    const normalizedMaritalStatus = (maritalStatus === 'single') ? 'مجرد' : (maritalStatus === 'married') ? 'متأهل' : maritalStatus;

    // If only documents are being updated, skip person upsert
    if (!isDocumentsOnly) {
      // Check if person exists
      const existingPerson = await pool.request()
        .input('NationalCode', sql.NVarChar(20), nationalCode)
        .query('SELECT NationalCode FROM Persons WHERE NationalCode = @NationalCode');

      if (existingPerson.recordset.length > 0) {
        // Update existing person
      await pool.request()
        .input('NationalCode', sql.NVarChar(20), nationalCode)
        .input('FirstName', sql.NVarChar(100), firstName)
        .input('LastName', sql.NVarChar(100), lastName)
        .input('FatherName', sql.NVarChar(100), fatherName)
        .input('IdSerial', sql.NVarChar(50), idSerial || null)
        .input('BirthProvinceId', sql.Int, birthProvinceId || null)
        .input('BirthCityId', sql.Int, birthCityId || null)
        .input('BirthDateJalali', sql.NVarChar(10), birthDateValue)
        .input('Gender', sql.NVarChar(10), normalizedGender)
        .input('MaritalStatus', sql.NVarChar(20), normalizedMaritalStatus)
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
            MaritalStatus = @MaritalStatus,
            ModifiedAt = SYSUTCDATETIME()
          WHERE NationalCode = @NationalCode
        `);
    } else {
      // Create new person
      await pool.request()
        .input('NationalCode', sql.NVarChar(20), nationalCode)
        .input('FirstName', sql.NVarChar(100), firstName)
        .input('LastName', sql.NVarChar(100), lastName)
        .input('FatherName', sql.NVarChar(100), fatherName)
        .input('IdSerial', sql.NVarChar(50), idSerial || null)
        .input('BirthProvinceId', sql.Int, birthProvinceId || null)
        .input('BirthCityId', sql.Int, birthCityId || null)
        .input('BirthDateJalali', sql.NVarChar(10), birthDateValue)
        .input('Gender', sql.NVarChar(10), normalizedGender)
        .input('MaritalStatus', sql.NVarChar(20), normalizedMaritalStatus)
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

      // Upsert Other Information
      if (otherInfo) {
      const existingOtherInfo = await pool.request()
        .input('NationalCode', sql.NVarChar(20), nationalCode)
        .query('SELECT OtherInfoID FROM PersonOtherInfo WHERE NationalCode = @NationalCode');

      if (existingOtherInfo.recordset.length > 0) {
        // Update existing other info
        await pool.request()
          .input('NationalCode', sql.NVarChar(20), nationalCode)
          .input('PhysicalStatus', sql.NVarChar(100), otherInfo.physicalStatus || null)
          .input('JobStatus', sql.NVarChar(100), otherInfo.jobStatus || null)
          .input('MilitaryStatus', sql.NVarChar(100), otherInfo.militaryStatus || null)
          .input('EducationLevel', sql.NVarChar(100), otherInfo.educationLevel || null)
          .input('SelfSacrificeStatus', sql.NVarChar(100), otherInfo.selfSacrificeStatus || null)
          .input('FluencyEnglish', sql.NVarChar(100), otherInfo.fluencyEnglish || null)
          .input('CertificateType', sql.NVarChar(100), otherInfo.certificateType || null)
          .input('ValidityPeriod', sql.NVarChar(50), otherInfo.validityPeriod || null)
          .input('HealthCardNo', sql.NVarChar(50), otherInfo.healthCardNo || null)
          .input('HealthCardIssueDate', sql.NVarChar(10), otherInfo.healthCardIssueDate || null)
          .input('HealthCardExpiryDate', sql.NVarChar(10), otherInfo.healthCardExpiryDate || null)
          .input('DrivingLicenseNo', sql.NVarChar(50), otherInfo.drivingLicenseNo || null)
          .input('DrivingLicenseIssueDate', sql.NVarChar(10), otherInfo.drivingLicenseIssueDate || null)
          .input('DrivingLicenseExpiryDate', sql.NVarChar(10), otherInfo.drivingLicenseExpiryDate || null)
          .input('InsuranceType', sql.NVarChar(100), otherInfo.insuranceType || null)
          .input('InsuranceStartDate', sql.NVarChar(10), otherInfo.insuranceStartDate || null)
          .input('InsuranceExpiryDate', sql.NVarChar(10), otherInfo.insuranceExpiryDate || null)
          .input('NoCriminalRecordNo', sql.NVarChar(50), otherInfo.noCriminalRecordNo || null)
          .input('ModifiedByUserId', sql.BigInt, userId)
          .query(`
            UPDATE PersonOtherInfo
            SET 
              PhysicalStatus = @PhysicalStatus,
              JobStatus = @JobStatus,
              MilitaryStatus = @MilitaryStatus,
              EducationLevel = @EducationLevel,
              SelfSacrificeStatus = @SelfSacrificeStatus,
              FluencyEnglish = @FluencyEnglish,
              CertificateType = @CertificateType,
              ValidityPeriod = @ValidityPeriod,
              HealthCardNo = @HealthCardNo,
              HealthCardIssueDate = @HealthCardIssueDate,
              HealthCardExpiryDate = @HealthCardExpiryDate,
              DrivingLicenseNo = @DrivingLicenseNo,
              DrivingLicenseIssueDate = @DrivingLicenseIssueDate,
              DrivingLicenseExpiryDate = @DrivingLicenseExpiryDate,
              InsuranceType = @InsuranceType,
              InsuranceStartDate = @InsuranceStartDate,
              InsuranceExpiryDate = @InsuranceExpiryDate,
              NoCriminalRecordNo = @NoCriminalRecordNo,
              ModifiedAt = SYSUTCDATETIME(),
              ModifiedByUserId = @ModifiedByUserId
            WHERE NationalCode = @NationalCode
          `);
      } else {
        // Insert new other info
        await pool.request()
          .input('NationalCode', sql.NVarChar(20), nationalCode)
          .input('PhysicalStatus', sql.NVarChar(100), otherInfo.physicalStatus || null)
          .input('JobStatus', sql.NVarChar(100), otherInfo.jobStatus || null)
          .input('MilitaryStatus', sql.NVarChar(100), otherInfo.militaryStatus || null)
          .input('EducationLevel', sql.NVarChar(100), otherInfo.educationLevel || null)
          .input('SelfSacrificeStatus', sql.NVarChar(100), otherInfo.selfSacrificeStatus || null)
          .input('FluencyEnglish', sql.NVarChar(100), otherInfo.fluencyEnglish || null)
          .input('CertificateType', sql.NVarChar(100), otherInfo.certificateType || null)
          .input('ValidityPeriod', sql.NVarChar(50), otherInfo.validityPeriod || null)
          .input('HealthCardNo', sql.NVarChar(50), otherInfo.healthCardNo || null)
          .input('HealthCardIssueDate', sql.NVarChar(10), otherInfo.healthCardIssueDate || null)
          .input('HealthCardExpiryDate', sql.NVarChar(10), otherInfo.healthCardExpiryDate || null)
          .input('DrivingLicenseNo', sql.NVarChar(50), otherInfo.drivingLicenseNo || null)
          .input('DrivingLicenseIssueDate', sql.NVarChar(10), otherInfo.drivingLicenseIssueDate || null)
          .input('DrivingLicenseExpiryDate', sql.NVarChar(10), otherInfo.drivingLicenseExpiryDate || null)
          .input('InsuranceType', sql.NVarChar(100), otherInfo.insuranceType || null)
          .input('InsuranceStartDate', sql.NVarChar(10), otherInfo.insuranceStartDate || null)
          .input('InsuranceExpiryDate', sql.NVarChar(10), otherInfo.insuranceExpiryDate || null)
          .input('NoCriminalRecordNo', sql.NVarChar(50), otherInfo.noCriminalRecordNo || null)
          .input('CreatedByUserId', sql.BigInt, userId)
          .query(`
            INSERT INTO PersonOtherInfo (
              NationalCode, PhysicalStatus, JobStatus, MilitaryStatus, EducationLevel,
              SelfSacrificeStatus, FluencyEnglish, CertificateType, ValidityPeriod,
              HealthCardNo, HealthCardIssueDate, HealthCardExpiryDate,
              DrivingLicenseNo, DrivingLicenseIssueDate, DrivingLicenseExpiryDate,
              InsuranceType, InsuranceStartDate, InsuranceExpiryDate,
              NoCriminalRecordNo, CreatedByUserId
            )
            VALUES (
              @NationalCode, @PhysicalStatus, @JobStatus, @MilitaryStatus, @EducationLevel,
              @SelfSacrificeStatus, @FluencyEnglish, @CertificateType, @ValidityPeriod,
              @HealthCardNo, @HealthCardIssueDate, @HealthCardExpiryDate,
              @DrivingLicenseNo, @DrivingLicenseIssueDate, @DrivingLicenseExpiryDate,
              @InsuranceType, @InsuranceStartDate, @InsuranceExpiryDate,
              @NoCriminalRecordNo, @CreatedByUserId
            )
          `);
      }
    }

    // Update Residences - Delete existing and insert new
    if (residences && Array.isArray(residences)) {
      // Delete existing residences
      await pool.request()
        .input('NationalCode', sql.NVarChar(20), nationalCode)
        .query('DELETE FROM PersonResidences WHERE NationalCode = @NationalCode');

      // Insert new residences
      for (const residence of residences) {
        await pool.request()
          .input('NationalCode', sql.NVarChar(20), nationalCode)
          .input('ProvinceId', sql.Int, residence.provinceId || residence.ProvinceId || null)
          .input('CityId', sql.Int, residence.cityId || residence.CityId || null)
          .input('MainStreet', sql.NVarChar(200), residence.mainStreet || residence.MainStreet || null)
          .input('SideStreet', sql.NVarChar(200), residence.sideStreet || residence.SideStreet || null)
          .input('District', sql.NVarChar(100), residence.district || residence.District || null)
          .input('PostalCode', sql.NVarChar(20), residence.postalCode || residence.PostalCode || null)
          .input('Plaque', sql.NVarChar(20), residence.plaque || residence.Plaque || null)
          .input('Unit', sql.NVarChar(20), residence.unit || residence.Unit || null)
          .input('Address', sql.NVarChar(500), residence.address || residence.Address || null)
          .query(`
            INSERT INTO PersonResidences (
              NationalCode, ProvinceId, CityId, MainStreet, SideStreet,
              District, PostalCode, Plaque, Unit, Address
            )
            VALUES (
              @NationalCode, @ProvinceId, @CityId, @MainStreet, @SideStreet,
              @District, @PostalCode, @Plaque, @Unit, @Address
            )
          `);
      }
    }

    // Update Contacts - Delete existing and insert new
    if (contacts && Array.isArray(contacts)) {
      // Delete existing contacts
      await pool.request()
        .input('NationalCode', sql.NVarChar(20), nationalCode)
        .query('DELETE FROM PersonContacts WHERE NationalCode = @NationalCode');

      // Insert new contacts
      for (const contact of contacts) {
        await pool.request()
          .input('NationalCode', sql.NVarChar(20), nationalCode)
          .input('Type', sql.NVarChar(50), contact.type || contact.Type || null)
          .input('Value', sql.NVarChar(200), contact.value || contact.Value || null)
          .input('IsActive', sql.Bit, contact.isActive || contact.IsActive ? 1 : 0)
          .query(`
            INSERT INTO PersonContacts (NationalCode, Type, Value, IsActive)
            VALUES (@NationalCode, @Type, @Value, @IsActive)
          `);
      }
    }
    } // End of if (!isDocumentsOnly)

    // Update Documents - Delete existing documents of the same type and insert new
    if (documents && Array.isArray(documents)) {
      // First, collect all valid docTypeIds from the incoming documents
      const docTypeIds = documents
        .map(doc => parseInt(doc.docTypeId, 10))
        .filter(id => !isNaN(id));

      // Delete only documents with the same LookupDocTypeId as the ones being uploaded
      if (docTypeIds.length > 0) {
        const docTypeIdsList = docTypeIds.join(',');
        await pool.request()
          .input('NationalCode', sql.NVarChar(20), nationalCode)
          .query(`
            DELETE FROM PersonDocuments 
            WHERE NationalCode = @NationalCode 
            AND LookupDocTypeId IN (${docTypeIdsList})
          `);
        console.log(`Deleted existing documents with types: ${docTypeIdsList} for nationalCode: ${nationalCode}`);
      }

      // Insert new documents
      for (const doc of documents) {
        // Validate docTypeId first
        if (!doc.docTypeId) {
          console.error('Document missing docTypeId:', doc);
          continue; // Skip this document
        }

        // Convert docTypeId to integer
        const docTypeId = parseInt(doc.docTypeId, 10);
        if (isNaN(docTypeId)) {
          console.error('Invalid docTypeId (not a number):', doc.docTypeId, 'for document:', doc);
          continue; // Skip this document
        }

        // Convert base64 to binary
        let fileBuffer = null;
        let mimeType = 'application/octet-stream';
        
        if (doc.fileData) {
          // Extract mime type and base64 data
          const matches = doc.fileData.match(/^data:([^;]+);base64,(.+)$/);
          if (matches) {
            mimeType = matches[1];
            const base64Data = matches[2];
            fileBuffer = Buffer.from(base64Data, 'base64');
          } else {
            // If no data URI prefix, assume it's raw base64
            fileBuffer = Buffer.from(doc.fileData, 'base64');
          }
        }

        if (fileBuffer) {
          console.log('Inserting document with docTypeId:', docTypeId, 'for nationalCode:', nationalCode);
          
          await pool.request()
            .input('NationalCode', sql.NVarChar(20), nationalCode)
            .input('LookupDocTypeId', sql.Int, docTypeId)
            .input('FileContent', sql.VarBinary(sql.MAX), fileBuffer)
            .input('MimeType', sql.NVarChar(100), mimeType)
            .input('SizeBytes', sql.Int, doc.fileSize || fileBuffer.length)
            .query(`
              INSERT INTO PersonDocuments (
                NationalCode, LookupDocTypeId, FileContent, MimeType, SizeBytes
              )
              VALUES (
                @NationalCode, @LookupDocTypeId, @FileContent, @MimeType, @SizeBytes
              )
            `);
        } else {
          console.error('No file buffer for document:', doc);
        }
      }
    }

    return res.json({
      success: true,
      nationalCode: nationalCode,
      message: 'اطلاعات شخص با موفقیت ذخیره شد'
    });

  } catch (error) {
    console.error('Error upserting person:', error);
    next(error);
  }
}
