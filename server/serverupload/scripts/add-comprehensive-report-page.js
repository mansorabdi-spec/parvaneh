/**
 * Register the comprehensive report page and grant access.
 * Run with: node server/scripts/add-comprehensive-report-page.js
 */

import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const envPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '.env');
dotenv.config({ path: envPath });

const { getPool } = await import('../src/lib/db.js');
const { ensureComprehensiveReportPage } = await import('../src/lib/comprehensiveReport.js');

try {
  const pool = await getPool();
  await ensureComprehensiveReportPage(pool);
  console.log('Comprehensive report page is registered.');
  process.exit(0);
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
