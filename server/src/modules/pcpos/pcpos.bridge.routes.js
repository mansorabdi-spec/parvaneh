import { Router } from 'express';
import { applyDeviceStatus } from './pcpos.service.js';
import { bridgeKeyOk, claimJob, completeJob, recordHeartbeat } from './pcpos.bridge.js';
import { finalizeBridgePurchase } from '../../controllers/kiosk.controller.js';

const router = Router();

function requireBridge(req, res, next) {
  const header = req.get('X-Pos-Bridge-Key');
  if (!bridgeKeyOk(header)) {
    return res.status(401).json({ message: 'کلید اتصال رایانه کارتخوان پذیرفته نشد' });
  }
  return next();
}

router.post('/heartbeat', requireBridge, async (req, res) => {
  try {
    await recordHeartbeat({
      host: req.body?.host,
      port: req.body?.port,
      paired: req.body?.paired,
    });
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ message: error.message || 'ثبت وضعیت رایانه کارتخوان ناموفق بود' });
  }
});

router.post('/claim', requireBridge, async (req, res) => {
  try {
    const job = await claimJob();
    res.json({ job });
  } catch (error) {
    res.status(500).json({ message: error.message || 'گرفتن درخواست ناموفق بود' });
  }
});

router.post('/jobs/:id/result', requireBridge, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ message: 'شناسه درخواست نامعتبر است' });
  }
  const kind = String(req.body?.kind || '');
  const payload = req.body?.payload || {};
  const raw = req.body?.result || {};
  try {
    let stored = raw;
    if (kind === 'purchase') stored = await finalizeBridgePurchase(payload, raw);
    if (kind === 'inquiry') stored = await applyDeviceStatus({ transactionId: payload.transactionId }, raw.status || raw);
    await completeJob(id, stored);
    res.json({ ok: true });
  } catch (error) {
    await completeJob(id, {
      ok: false,
      outcome: 'failed',
      shouldRetry: true,
      shouldInquiry: false,
      message: error.message || 'ثبت نتیجه ناموفق بود',
    }).catch(() => {});
    res.status(error.status || 500).json({ message: error.message || 'ثبت نتیجه ناموفق بود' });
  }
});

export default router;
