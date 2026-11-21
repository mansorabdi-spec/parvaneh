import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { crc32 } from 'zlib';

const PACKAGE_FILES = [
  'package.json',
  'start.bat',
  'start-window.ps1',
  'src/main.js',
  'src/device.js',
  'src/pcpos.config.js',
  'src/pcpos.protocol.js',
  'src/pcpos.session.js',
];

function fail(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function findBridgeRoot() {
  let dir = path.dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 8; i += 1) {
    const candidate = path.join(dir, 'kiosk-bridge');
    if (fs.existsSync(path.join(candidate, 'src', 'main.js'))) return candidate;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw fail('پوشه برنامه کیوسک روی سرور پیدا نشد', 500);
}

export function normalizeSiteUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  let url;
  try {
    url = new URL(raw);
  } catch {
    return '';
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return '';
  if (url.username || url.password || url.search || url.hash) return '';
  if (url.pathname !== '/' && url.pathname !== '') return '';
  return url.origin;
}

function dosDateTime(date) {
  const year = Math.max(1980, date.getFullYear());
  const dosTime = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
  const dosDate = ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  return { dosTime, dosDate };
}

function zipStore(entries) {
  const { dosTime, dosDate } = dosDateTime(new Date());
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const entry of entries) {
    const name = Buffer.from(entry.name.replace(/\\/g, '/'), 'utf8');
    const data = Buffer.isBuffer(entry.data) ? entry.data : Buffer.from(String(entry.data), 'utf8');
    const checksum = crc32(data) >>> 0;
    const local = Buffer.alloc(30 + name.length);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt16LE(dosTime, 10);
    local.writeUInt16LE(dosDate, 12);
    local.writeUInt32LE(checksum, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    name.copy(local, 30);
    locals.push(local, data);

    const central = Buffer.alloc(46 + name.length);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt16LE(dosTime, 12);
    central.writeUInt16LE(dosDate, 14);
    central.writeUInt32LE(checksum, 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(offset, 42);
    name.copy(central, 46);
    centrals.push(central);
    offset += local.length + data.length;
  }
  const centralDirectory = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralDirectory.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, centralDirectory, end]);
}

function readPackageFile(root, name) {
  const file = path.resolve(root, ...name.split('/'));
  const relative = path.relative(root, file);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw fail('مسیر فایل کیوسک نامعتبر است', 500);
  }
  return fs.readFileSync(file);
}

function guideText(siteUrl) {
  return [
    'راهنمای رایانه کیوسک',
    '',
    '1. برنامه Node.js نسخه 18 یا جدیدتر را نصب کنید و هنگام نصب، افزودن آن به PATH را انتخاب کنید.',
    '2. این پوشه را در یک مسیر ثابت نگه دارید.',
    `3. در فایل .env مقدار PCPOS_SERVER_URL برابر ${siteUrl} است. شماره درگاه 4000 یا 4001 نباید در آدرس باشد. مقدار PCPOS_BRIDGE_KEY را عوض نکنید.`,
    '4. رایانه کیوسک و دستگاه پوز را به یک شبکه مشترک وصل کنید.',
    '5. فایل start.bat را اجرا کنید و پنجره وضعیت را نبندید. پیام «سامانه پاسخ داد» یعنی اتصال برقرار شده است.',
    '6. برای بالا آمدن همراه با روشن شدن رایانه، میانبر start.bat را در پوشه Startup ویندوز بگذارید.',
    '7. در صفحه تنظیمات سایت، آی‌پی و پورت کارتخوان را ذخیره کنید. پورت سرویس پوز آسان‌پرداخت معمولاً 17000 است.',
    '8. کد شش‌رقمی روی کارتخوان را در همان صفحه وارد کنید.',
    '9. صفحه کیوسک سایت را در مرورگر همین رایانه باز کنید.',
    '',
  ].join('\r\n');
}

export function buildKioskPackage(siteUrl) {
  let parsed = null;
  try {
    parsed = new URL(String(siteUrl || '').trim());
  } catch {
    parsed = null;
  }
  if (parsed && (parsed.port === '4000' || parsed.port === '4001')) {
    throw fail('آدرس سایت نباید شماره درگاه داخلی ۴۰۰۰ یا ۴۰۰۱ داشته باشد. آدرس عمومی سایت را بنویسید.', 400);
  }
  const site = normalizeSiteUrl(siteUrl);
  if (!site) throw fail('آدرس عمومی سایت برای فایل تنظیم کیوسک معتبر نیست', 400);
  const key = String(process.env.PCPOS_BRIDGE_KEY || '').trim();
  if (key.length < 8) {
    throw fail('کلید مشترک روی سرور تنظیم نشده است. در تنظیم سرور مقدار PCPOS_BRIDGE_KEY را بگذارید و سپس دوباره دانلود کنید.', 400);
  }
  const root = findBridgeRoot();
  const entries = PACKAGE_FILES.map((name) => ({
    name: `kiosk-bridge/${name}`,
    data: readPackageFile(root, name),
  }));
  entries.push({
    name: 'kiosk-bridge/.env',
    data: [
      '# آدرس عمومی سایت، بدون شماره درگاه داخلی',
      `PCPOS_SERVER_URL=${site}`,
      `PCPOS_BRIDGE_KEY=${key}`,
      '',
    ].join('\n'),
  });
  entries.push({
    name: 'kiosk-bridge/rahnama.txt',
    data: guideText(site),
  });
  return zipStore(entries);
}

export function sendKioskPackage(req, res) {
  try {
    const zip = buildKioskPackage(req.query?.site);
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename="kiosk-bridge.zip"');
    res.send(zip);
  } catch (error) {
    res.status(error.status || 500).json({ message: error.message || 'ساخت فایل کیوسک انجام نشد' });
  }
}
