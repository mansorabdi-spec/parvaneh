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
import { authRequired, requireAnyRole } from '../../middleware/auth.js'

const router = express.Router()

// Public routes (require authentication)
router.get('/', authRequired, getAllVehicleTypes)
router.get('/systems/all', authRequired, getAllSystems)
router.get('/:vehicleTypeId/systems', authRequired, getSystemsByVehicleType)
router.get('/systems/:systemId/tips', authRequired, getTipsBySystem)

// Admin and superadmin routes
router.post('/', authRequired, requireAnyRole(['Admin', 'superadmin']), createVehicleType)
router.put('/:id', authRequired, requireAnyRole(['Admin', 'superadmin']), updateVehicleType)
router.delete('/:id', authRequired, requireAnyRole(['Admin', 'superadmin']), deleteVehicleType)

export default router
