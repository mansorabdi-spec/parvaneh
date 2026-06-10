import express from 'express';
import { 
  getCompanyByNationalId,
  getCompanyByOwnerNationalCode,
  upsertCompany, 
  deleteCompany,
  getAllCompanies,
  getAllCompaniesWithManagers,
  getCompanyNameByManagerNationalCode,
  upsertCompanyManager
} from '../../controllers/company.controller.js';
import { authRequired } from '../../middleware/auth.js';

const router = express.Router();

// Test endpoint (no auth required)
router.get('/test', (req, res) => {
  res.json({ message: 'Company routes are working!' });
});

// Get all companies
router.get('/all', authRequired, getAllCompanies);

// Get all companies with their manager (CEO) information
router.get('/all-with-managers', authRequired, getAllCompaniesWithManagers);

// Get company name by manager's national code (کد ملی مدیر شرکت)
router.get('/by-manager/:managerNationalCode', authRequired, getCompanyNameByManagerNationalCode);

// Get company by owner's national code (کد ملی صاحب شرکت)
router.get('/by-owner/:nationalCode', authRequired, getCompanyByOwnerNationalCode);

// Get company by national ID (شناسه ملی شرکت)
router.get('/:nationalId', authRequired, getCompanyByNationalId);

// Create or update company
router.post('/', authRequired, upsertCompany);

// Create or update company manager (CEO)
router.post('/manager', authRequired, upsertCompanyManager);

// Delete company
router.delete('/:nationalId', authRequired, deleteCompany);

export default router;
