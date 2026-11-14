import Joi from 'joi';
import { getPcPosConfig } from './pcpos.config.js';
import { PcPosError } from './pcpos.protocol.js';
import { getStoredTransaction, inquiry, payBill, purchase } from './pcpos.service.js';
import { listTransactions, mapTransaction } from './pcpos.store.js';

const amountSchema = Joi.alternatives().try(
  Joi.number().integer().positive().max(999999999999),
  Joi.string().pattern(/^[1-9]\d{0,11}$/)
);

const purchaseSchema = Joi.object({
  amount: amountSchema.required(),
  invoiceNumber: Joi.string().pattern(/^[A-Za-z0-9_-]{1,30}$/).required(),
  messageId: Joi.string().pattern(/^\d{1,5}$/),
  applicationId: Joi.string().pattern(/^[A-Za-z0-9]{1,16}$/).allow(null, ''),
  requestId: Joi.number().integer().positive().allow(null),
  splits: Joi.array().items(Joi.object({
    sheba: Joi.string().pattern(/^IR\d{24}$/i).required(),
    ibanId: Joi.string().pattern(/^[A-Za-z0-9_-]{1,30}$/).allow(null, ''),
    amount: amountSchema.required(),
  })).max(10).default([]),
});

const billSchema = Joi.object({
  billId: Joi.string().pattern(/^\d{6,13}$/),
  paymentId: Joi.string().pattern(/^\d{6,13}$/),
  fields: Joi.array().items(
    Joi.string().pattern(/^\d{1,13}$/)
  ).length(4),
  messageId: Joi.string().pattern(/^\d{1,5}$/),
  requestId: Joi.number().integer().positive().allow(null),
}).or('billId', 'fields');

const inquirySchema = Joi.object({
  messageId: Joi.string().pattern(/^\d{1,5}$/),
  transactionId: Joi.number().integer().positive(),
});

const listSchema = Joi.object({
  outcome: Joi.string().valid('pending', 'success', 'failed', 'unknown', 'cancelled'),
  kind: Joi.string().valid('purchase', 'bill', 'inquiry'),
  limit: Joi.number().integer().min(1).max(200).default(50),
});

function sendError(res, error) {
  const status = error.status || error.statusCode || 500;
  if (status >= 500) console.error('[pcpos]', error);
  res.status(status).json({ message: error.message || 'خطای داخلی PC-POS' });
}

function holdOpen(req, res) {
  const timeout = getPcPosConfig().timeoutMs + 20000;
  req.setTimeout(timeout);
  res.setTimeout(timeout);
}

export async function purchasePayment(req, res) {
  try {
    holdOpen(req, res);
    const { error, value } = purchaseSchema.validate(req.body, { abortEarly: false, stripUnknown: true });
    if (error) return res.status(400).json({ message: 'اطلاعات خرید نامعتبر است', details: error.details.map((item) => item.message) });
    res.json(await purchase(value));
  } catch (error) {
    sendError(res, error);
  }
}

export async function billPayment(req, res) {
  try {
    holdOpen(req, res);
    const { error, value } = billSchema.validate(req.body, { abortEarly: false, stripUnknown: true });
    if (error) return res.status(400).json({ message: 'اطلاعات پرداخت قبض نامعتبر است', details: error.details.map((item) => item.message) });
    res.json(await payBill(value));
  } catch (error) {
    sendError(res, error);
  }
}

export async function inquiryPayment(req, res) {
  try {
    holdOpen(req, res);
    const { error, value } = inquirySchema.validate(req.body || {}, { abortEarly: false, stripUnknown: true });
    if (error) return res.status(400).json({ message: 'اطلاعات استعلام نامعتبر است', details: error.details.map((item) => item.message) });
    res.json(await inquiry(value));
  } catch (error) {
    sendError(res, error);
  }
}

export async function getPayment(req, res) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) throw new PcPosError('شناسه تراکنش نامعتبر است');
    const row = await getStoredTransaction(id);
    if (!row) return res.status(404).json({ message: 'تراکنش پیدا نشد' });
    res.json(row);
  } catch (error) {
    sendError(res, error);
  }
}

export async function listPayments(req, res) {
  try {
    const { error, value } = listSchema.validate(req.query, { abortEarly: false, stripUnknown: true });
    if (error) return res.status(400).json({ message: 'فیلتر فهرست نامعتبر است' });
    const rows = await listTransactions(value);
    res.json({ items: rows.map(mapTransaction) });
  } catch (error) {
    sendError(res, error);
  }
}
