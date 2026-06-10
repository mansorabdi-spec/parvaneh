import express from 'express'
import { 
  logPrint, 
  getPrintLogsByRequest, 
  getAllPrintLogs, 
  getPrintStatistics,
  checkIfPrinted 
} from '../controllers/printlog.controller.js'
import { authRequired } from '../middleware/auth.js'

const router = express.Router()

// All routes require authentication
router.use(authRequired)

// Log a print event
router.post('/log', logPrint)

// Get print logs for a specific request
router.get('/request/:requestId', getPrintLogsByRequest)

// Check if a request has been printed
router.get('/check/:requestId', checkIfPrinted)

// Get all print logs (with filters and pagination)
router.get('/all', getAllPrintLogs)

// Get print statistics
router.get('/statistics', getPrintStatistics)

export default router
