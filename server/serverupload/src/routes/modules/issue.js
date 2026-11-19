import { Router } from 'express';
import multer from 'multer';
import { upsertVehicle, upsertPersonal, listPersonalDocuments, savePersonalDocument, deletePersonalDocument, getPersonalDocumentContent, getPersonByNationalCode, listVehicleDocuments, saveVehicleDocument, deleteVehicleDocument, getVehicleDocumentContent, getVehicleByChassis, listVehicleDiscountDocuments, saveVehicleDiscountDocument, deleteVehicleDiscountDocument, getVehicleDiscountDocumentContent, createVehicleRequest, getVehicleByVin, checkPendingRequestByVin, checkVinRegistration, listEmploymentDiscountDocuments, saveEmploymentDiscountDocument, deleteEmploymentDiscountDocument, getEmploymentDiscountDocumentContent, createEmploymentRequest, createExploitationRequest, renewVehicleRequest, renewExploitationRequest } from '../../controllers/issue.controller.js';
import { upsertCompany, getCompanyByNationalId, getCompanyByOwnerNationalCode, uploadCompanyDocument, getCompanyDocuments, getCompanyDocumentContent, deleteCompanyDocument } from '../../controllers/issue.company.js';
import { authRequired } from '../../middleware/auth.js';

const router = Router();

// Upsert vehicle (insert or update on change)
router.post('/vehicle', upsertVehicle);
// Upsert personal (insert/update Persons + residences + contacts)
router.post('/personal', upsertPersonal);
// Upsert company (insert/update Companies + addresses + contacts + representative)
router.post('/company', upsertCompany);
// Get company by owner's national code (finds company where NationalCode = owner's code)
router.get('/company/by-owner/:nationalCode', getCompanyByOwnerNationalCode);
// Get company by national ID (for recovery)
router.get('/company/:nationalId', getCompanyByNationalId);
// Get personal by national code (for recovery)
router.get('/personal/:nationalCode', getPersonByNationalCode);
// Get vehicle by chassis (for recovery)
router.get('/vehicle/by-chassis/:chassis', getVehicleByChassis);
// Get vehicle by VIN (scoped to logged-in user's national code)
router.get('/vehicle/by-vin/:vin', authRequired, getVehicleByVin);
// Check for pending requests by VIN
router.get('/check-pending/:vin', authRequired, checkPendingRequestByVin);
// Check if VIN is registered with a different national code
router.get('/check-vin-registration/:vin', authRequired, checkVinRegistration);

// Use memory storage — we store binary in DB
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg','image/png','image/gif','image/webp'];
    if (!allowed.includes(file.mimetype)) return cb(new Error('Only image files are allowed'));
    cb(null, true);
  }
});

// List personal documents
router.get('/personal/:nationalCode/documents', listPersonalDocuments);
// Upload personal document (field name: 'file', body must include docTypeId)
router.post('/personal/:nationalCode/documents', upload.single('file'), savePersonalDocument);
// Delete a document by DocID
router.delete('/personal/:nationalCode/documents/:docId', deletePersonalDocument);
// Stream document content
router.get('/personal/:nationalCode/documents/:docId/content', getPersonalDocumentContent);

// Company documents
router.get('/company/:nationalId/documents', getCompanyDocuments);
router.post('/company/:nationalId/documents', upload.single('file'), uploadCompanyDocument);
router.delete('/company/:nationalId/documents/:docId', deleteCompanyDocument);
router.get('/company/:nationalId/documents/:docId/content', getCompanyDocumentContent);

// Renewal - Create new VehicleRequests record with existing tracking number
// IMPORTANT: This route must be BEFORE /vehicle/:vehicleId/documents to avoid conflicts
router.post('/vehicle/:vehicleId/renew', authRequired, renewVehicleRequest);

// Vehicle documents (must be AFTER /vehicle/:vehicleId/renew)
router.get('/vehicle/:vehicleId/documents', listVehicleDocuments);
router.post('/vehicle/:vehicleId/documents', upload.single('file'), saveVehicleDocument);
router.delete('/vehicle/:vehicleId/documents/:docId', deleteVehicleDocument);
router.get('/vehicle/:vehicleId/documents/:docId/content', getVehicleDocumentContent);

// Vehicle discount documents (must be AFTER /vehicle/:vehicleId/renew)
router.get('/vehicle/:vehicleId/discount-documents', listVehicleDiscountDocuments);
router.post('/vehicle/:vehicleId/discount-documents', upload.single('file'), saveVehicleDiscountDocument);
router.delete('/vehicle/:vehicleId/discount-documents/:docId', deleteVehicleDiscountDocument);
router.get('/vehicle/:vehicleId/discount-documents/:docId/content', getVehicleDiscountDocumentContent);

// Employment discount documents
router.get('/employment/:nationalCode/discount-documents', listEmploymentDiscountDocuments);
router.post('/employment/:nationalCode/discount-documents', upload.single('file'), saveEmploymentDiscountDocument);
router.delete('/employment/:nationalCode/discount-documents/:docId', deleteEmploymentDiscountDocument);
router.get('/employment/:nationalCode/discount-documents/:docId/content', getEmploymentDiscountDocumentContent);

// Finalize vehicle request
router.post('/vehicle/:vehicleId/finalize', authRequired, createVehicleRequest);
// Finalize employment request
router.post('/employment/finalize', authRequired, createEmploymentRequest);
// Finalize exploitation request
router.post('/exploitation/finalize', authRequired, createExploitationRequest);

// Renew exploitation request - Create new record with existing license number
router.post('/exploitation/renew', authRequired, renewExploitationRequest);

export default router;
