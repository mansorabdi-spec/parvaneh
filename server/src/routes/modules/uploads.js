import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { authRequired } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/permission.js';

const router = Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsDir = path.resolve(__dirname, '../../uploads');
try { fs.mkdirSync(uploadsDir, { recursive: true }); } catch {}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname || '').toLowerCase();
    const base = path.basename(file.originalname || 'receipt', ext).replace(/[^a-zA-Z0-9-_]/g, '');
    cb(null, `${base || 'receipt'}-${Date.now()}${ext || '.jpg'}`);
  }
});

function fileFilter(req, file, cb) {
  const ok = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.mimetype);
  if (!ok) return cb(new Error('تنها فرمت‌های تصویری مجاز است'));
  cb(null, true);
}

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 2 * 1024 * 1024 // 2MB
  }
});

// POST /api/uploads/receipt
// Requires authentication and permission to upload payment documents
router.post('/receipt', 
  authRequired,
  requirePermission('view_payment_documents', 'edit'),
  upload.single('file'), 
  (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'فایلی ارسال نشده است' });
  const filename = req.file.filename;
  const url = `/uploads/${filename}`;
  return res.status(201).json({ url, filename });
});

// Global error handler for Multer errors specific to this router
router.use((err, req, res, next) => {
  if (err) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ message: 'حجم فایل نباید بیش از ۲ مگابایت باشد' });
    }
    return res.status(400).json({ message: err.message || 'خطای بارگذاری فایل' });
  }
  next();
});

export default router;
