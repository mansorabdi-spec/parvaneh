import express from 'express';
import multer from 'multer';
import {
  searchVehicleByVIN,
  submitCancellationRequest,
  getMyCancellationRequests,
  getCancellationRequestById
} from '../controllers/cancellation.controller.js';
import { authRequired } from '../middleware/auth.js';

const router = express.Router();

// Configure multer for file upload (store in memory)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 2 * 1024 * 1024 // 2MB max file size
  },
  fileFilter: (req, file, cb) => {
    // Accept common document and image formats
    const allowedMimes = [
      'application/pdf',
      'image/jpeg',
      'image/jpg',
      'image/png',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];
    
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('فرمت فایل مجاز نیست. فقط PDF، Word و تصاویر مجاز هستند.'));
    }
  }
});

// Search vehicle by VIN
router.get('/search/:vin', authRequired, searchVehicleByVIN);

// Submit cancellation request
router.post('/submit', authRequired, upload.single('attachment'), submitCancellationRequest);

// Get all cancellation requests for logged-in user
router.get('/my-requests', authRequired, getMyCancellationRequests);

// Get cancellation request by ID
router.get('/:id', authRequired, getCancellationRequestById);

export default router;
