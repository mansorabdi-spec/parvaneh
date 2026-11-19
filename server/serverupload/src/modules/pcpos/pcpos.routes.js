import { Router } from 'express';
import { authRequired } from '../../middleware/auth.js';
import {
  billPayment,
  getPayment,
  inquiryPayment,
  listPayments,
  purchasePayment,
} from './pcpos.controller.js';

const router = Router();

router.post('/pcpos/purchase', authRequired, purchasePayment);
router.post('/pcpos/bill', authRequired, billPayment);
router.post('/pcpos/inquiry', authRequired, inquiryPayment);
router.get('/pcpos/transactions', authRequired, listPayments);
router.get('/pcpos/transactions/:id', authRequired, getPayment);

export default router;
