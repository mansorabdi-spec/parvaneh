# License Issuance Backend (Node + Express + SQL Server)

## Prerequisites
- Node.js 18+
- SQL Server (Developer/Express)

## Setup
1. Copy `.env.example` to `.env` and update values.
2. Create a database named `LicenseDB` (or adjust `.env`).
3. Run the SQL script in `database/init.sql` on your database to create tables.
4. Install dependencies:
   ```bash
   npm install
   ```
5. Start in dev mode:
   ```bash
   npm run dev
   ```

## API
- `GET /health`
- Applicants
  - `GET /api/applicants`
  - `GET /api/applicants/:id`
  - `POST /api/applicants`
  - `PUT /api/applicants/:id`
  - `DELETE /api/applicants/:id`
- Licenses
  - `GET /api/licenses`
  - `POST /api/licenses/issue`
