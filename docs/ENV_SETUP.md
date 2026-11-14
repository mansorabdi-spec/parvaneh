# Environment Configuration Guide

## Overview

This project uses environment variables to manage configuration for different deployment environments (local development and production).

## File Structure

```
parvaneh/
├── server/
│   ├── .env                    # Active config (git-ignored)
│   ├── .env.local              # Local development template
│   ├── .env.production         # Production template
│   └── .env.example            # Example configuration
├── client/
│   ├── .env                    # Active config for dev (git-ignored)
│   ├── .env.local              # Local development template
│   └── .env.production         # Production config (used during build)
└── setup-env.ps1               # Automated setup script
```

## Quick Setup

### Automated Setup (Recommended)

**For Local Development:**
```powershell
.\setup-env.ps1 -Environment local
```

**For Production:**
```powershell
.\setup-env.ps1 -Environment production
```

### Manual Setup

**For Local Development:**
```bash
# Server
cd server
copy .env.local .env
# Edit .env with your local database credentials

# Client
cd client
copy .env.local .env
```

**For Production:**
```bash
# Server
cd server
copy .env.production .env
# Edit .env with production database credentials and strong JWT secret

# Client - .env.production is used automatically during build
cd client
# Edit .env.production with your production API URL
npm run build
```

## Environment Variables

### Server (Backend)

| Variable | Description | Local Example | Production Example |
|----------|-------------|---------------|-------------------|
| `PORT` | Server port | `4000` | `4000` |
| `NODE_ENV` | Environment | `development` | `production` |
| `DB_SERVER` | Database server | `localhost\SQL2022` | `prod-db.example.com` |
| `DB_DATABASE` | Database name | `parvaneh` | `parvaneh` |
| `DB_USER` | Database user | `parvanehuser` | `prod_user` |
| `DB_PASSWORD` | Database password | `localpass` | `strong_prod_pass` |
| `DB_PORT` | Database port | `1433` | `1433` |
| `DB_ENCRYPT` | Enable encryption | `false` | `true` |
| `DB_TRUST_CERT` | Trust certificate | `true` | `false` |
| `JWT_SECRET` | JWT signing key | `dev_secret` | `generated_strong_secret` |
| `JWT_EXPIRES_IN` | Token expiration | `7d` | `7d` |
| `CORS_ORIGIN` | Allowed origin | `http://localhost:5173` | `https://yourdomain.com` |
| `UPLOAD_DIR` | Upload directory | `./uploads` | `./uploads` |

### Client (Frontend)

| Variable | Description | Local Example | Production Example |
|----------|-------------|---------------|-------------------|
| `VITE_API_BASE_URL` | Backend API URL | `http://localhost:4000` | `https://api.yourdomain.com` |
| `VITE_PAYMENT_GATEWAY_URL` | Payment gateway | `https://pay.tabriz.ir` | `https://pay.tabriz.ir` |

## Important Notes

### Security

1. **Never commit `.env` files to git** - They contain sensitive credentials
2. **Generate strong JWT secrets** for production:
   ```bash
   node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
   ```
3. **Use different passwords** for local and production databases
4. **Enable encryption** (`DB_ENCRYPT=true`) in production

### Git

The following files are git-ignored:
- `.env`
- `.env.local`
- `.env.production` (server only)

Template files (`.env.example`, `.env.local`, `.env.production` for client) are tracked in git.

### Development Workflow

1. Clone repository
2. Run `.\setup-env.ps1 -Environment local`
3. Edit `server\.env` with your local database credentials
4. Install dependencies and run:
   ```bash
   # Terminal 1 - Backend
   cd server
   npm install
   npm run dev

   # Terminal 2 - Frontend
   cd client
   npm install
   npm run dev
   ```

### Production Deployment

1. Run `.\setup-env.ps1 -Environment production`
2. Edit `server\.env` with production credentials
3. Edit `client\.env.production` with production API URL
4. Build frontend:
   ```bash
   cd client
   npm run build
   ```
5. Deploy:
   - Upload `server/` folder to your backend server
   - Upload `client/dist/` contents to your web server
   - Create `.env` file on backend server (don't upload it!)

## Troubleshooting

### Client can't connect to API

**Problem:** API calls fail with CORS or connection errors

**Solution:**
1. Check `VITE_API_BASE_URL` in client environment file
2. Verify backend is running
3. Check `CORS_ORIGIN` in server `.env` matches your frontend URL

### Database connection fails

**Problem:** Server can't connect to database

**Solution:**
1. Verify database credentials in `server\.env`
2. Check SQL Server is running and accessible
3. Verify firewall rules allow connection
4. For named instances, ensure correct format: `SERVER\INSTANCE`

### Environment variables not working

**Problem:** Changes to `.env` not reflected

**Solution:**
1. Restart the development server
2. For Vite (client), environment variables must start with `VITE_`
3. Check file is named exactly `.env` (not `.env.txt`)

## Additional Resources

- [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) - Complete deployment instructions
- [QUICK_START.md](./QUICK_START.md) - Quick start guide
- [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) - Common issues and solutions
