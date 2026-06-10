import express from 'express'
import { 
  getAllVehicleTypes, 
  getSystemsByVehicleType, 
  getAllSystems,
  getTipsBySystem,
  createVehicleType, 
  updateVehicleType, 
  deleteVehicleType 
} from '../../controllers/vehicletypes.controller.js'
import { authRequired, requireRole } from '../../middleware/auth.js'

const router = express.Router()

// Public routes (require authentication)
router.get('/', authRequired, getAllVehicleTypes)
router.get('/systems/all', authRequired, getAllSystems)
router.get('/:vehicleTypeId/systems', authRequired, getSystemsByVehicleType)
router.get('/systems/:systemId/tips', authRequired, getTipsBySystem)

// Admin-only routes
router.post('/', authRequired, requireRole('Admin'), createVehicleType)
router.put('/:id', authRequired, requireRole('Admin'), updateVehicleType)
router.delete('/:id', authRequired, requireRole('Admin'), deleteVehicleType)

export default router
