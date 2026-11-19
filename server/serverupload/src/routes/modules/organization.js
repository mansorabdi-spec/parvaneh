import { Router } from 'express'
import { getOrganizationInfo } from '../../controllers/organization.controller.js'

const router = Router()

router.get('/', getOrganizationInfo)

export default router
