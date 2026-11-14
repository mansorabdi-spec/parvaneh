# 🚀 Quick Deployment Reference

## Local Development (محیط لوکال)

```powershell
# Setup
.\setup-env.ps1 -Environment local

# Edit server\.env with your database credentials
# Then run:

# Terminal 1 - Backend
cd server
npm install
npm run dev

# Terminal 2 - Frontend  
cd client
npm install
npm run dev
```

**URLs:**
- Frontend: http://localhost:5173
- Backend: http://localhost:4000

---

## Production Deployment (استقرار پروداکشن)

### Step 1: Prepare Environment Files

```powershell
.\setup-env.ps1 -Environment production
```

### Step 2: Configure Server

Edit `server\.env`:
```env
DB_SERVER=your-production-server
DB_DATABASE=parvaneh
DB_USER=your_user
DB_PASSWORD=your_password
JWT_SECRET=<generate-strong-secret>
CORS_ORIGIN=https://your-domain.com
```

Generate JWT Secret:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### Step 3: Configure Client

Edit `client\.env.production`:
```env
VITE_API_BASE_URL=https://your-domain.com
```

### Step 4: Build Frontend

```bash
cd client
npm install
npm run build
```

### Step 5: Deploy

**Backend:**
- Upload entire `server/` folder
- Create `.env` file on server (don't upload!)
- Run: `npm install --production`
- Start: `pm2 start src/index.js --name parvaneh-api`

**Frontend:**
- Upload contents of `client/dist/` to web root
- Configure web server for SPA routing

---

## Environment Variables Summary

### Server
- `DB_SERVER`, `DB_DATABASE`, `DB_USER`, `DB_PASSWORD` - Database
- `JWT_SECRET` - Must be strong in production!
- `CORS_ORIGIN` - Frontend URL
- `PORT` - Server port (default: 4000)

### Client
- `VITE_API_BASE_URL` - Backend API URL

---

## ⚠️ Security Checklist

- [ ] Strong JWT_SECRET generated
- [ ] Different passwords for local/production
- [ ] `.env` files NOT committed to git
- [ ] `DB_ENCRYPT=true` in production
- [ ] `CORS_ORIGIN` set to specific domain
- [ ] HTTPS enabled on production

---

## 🆘 Quick Troubleshooting

**Can't connect to API:**
→ Check `VITE_API_BASE_URL` and `CORS_ORIGIN`

**Database error:**
→ Verify credentials in `server\.env`

**404 on page refresh:**
→ Configure SPA routing on web server

---

For detailed instructions, see: [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)
