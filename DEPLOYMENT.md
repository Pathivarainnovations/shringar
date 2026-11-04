# Deployment Guide

## Frontend (Vercel)

The frontend is a **Next.js 16** application located in the `frontend/` folder.

### Vercel Configuration

- **Root Directory**: `frontend`
- **Framework Preset**: Next.js
- **Build Command**: `npm run build`
- **Output Directory**: `.next`
- **Install Command**: `npm install`
- **Node.js Version**: 20.x

### Environment Variables (Vercel Dashboard)

| Variable | Description | Example |
|----------|-------------|---------|
| `NEXT_PUBLIC_API_URL` | Backend API base URL (no trailing slash, no /api) | `https://shringar-api.onrender.com` |
| `NEXT_PUBLIC_WS_URL` | WebSocket URL for live tracking (optional) | `wss://shringar-api.onrender.com/ws` |

### Deployment Steps

1. Push code to GitHub (Astonsangam/shringar)
2. Go to Vercel → New Project → Import repository
3. Set **Root Directory** to `frontend`
4. Add environment variables above
5. Deploy

---

## Backend (NOT Vercel - Use Render/Railway/Fly.io)

The backend is an **Express.js** server with:
- WebSocket server (`ws` library) for live tracking
- SQLite database (`better-sqlite3`) - file-based
- Background intervals (session cleanup every hour)
- Custom middleware (CORS, rate limiting, auth)

### Why NOT Vercel?

- ❌ **WebSockets**: Vercel doesn't support persistent WebSocket connections
- ❌ **SQLite**: Vercel's filesystem is ephemeral (read-only in production)
- ❌ **Background jobs**: `setInterval` doesn't work in serverless
- ❌ **Long-running processes**: Serverless functions have max 60-300s timeout

### Recommended Platforms

| Platform | Why |
|----------|-----|
| **Render** | Free tier, WebSocket support, persistent disk for SQLite |
| **Railway** | Easy setup, WebSocket support, persistent volumes |
| **Fly.io** | Global deployment, WebSocket support, volumes |
| **DigitalOcean App Platform** | Managed, WebSocket support |

### Backend Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `PORT` | Server port (default 4000) | `4000` |
| `FRONTEND_ORIGIN` | Frontend URL for CORS (comma-separated) | `https://shringar.vercel.app` |
| `TRUST_PROXY` | Trust proxy headers (set to 1 behind reverse proxy) | `1` |
| `DATABASE_PATH` | SQLite database file path | `./data/shringar.db` |
| `SESSION_SECRET` | Secret for session signing | `generate-with-openssl-rand-base64-32` |
| `NODEMAILER_*` | Email configuration (see .env.example) | - |

### Deployment Steps (Render Example)

1. Create new **Web Service** on Render
2. Connect GitHub repo (Astonsangam/shringar)
3. Set **Root Directory**: `backend`
4. Build Command: `npm install`
5. Start Command: `npm start`
6. Add environment variables above
7. Add **Persistent Disk** for SQLite database:
   - Mount path: `/var/data`
   - Set `DATABASE_PATH=/var/data/shringar.db`
8. Deploy

### WebSocket Support

For live tracking to work, the platform must support WebSockets:
- Render: ✅ (enable in settings)
- Railway: ✅
- Fly.io: ✅
- Vercel: ❌

---

## Connecting Frontend to Backend

After deploying both:

1. Get backend URL (e.g., `https://shringar-api.onrender.com`)
2. In Vercel dashboard → Project → Settings → Environment Variables:
   - Add `NEXT_PUBLIC_API_URL=https://shringar-api.onrender.com`
   - Add `NEXT_PUBLIC_WS_URL=wss://shringar-api.onrender.com/ws` (optional)
3. Redeploy frontend on Vercel
4. In backend dashboard → Environment Variables:
   - Set `FRONTEND_ORIGIN=https://shringar.vercel.app`
5. Redeploy backend

---

## Local Development

```bash
# Install all dependencies
npm run setup

# Start both frontend and backend
npm run dev

# Frontend: http://localhost:3000
# Backend:  http://localhost:4000
```

Frontend `.env.local`:
```env
NEXT_PUBLIC_API_URL=http://localhost:4000
NEXT_PUBLIC_WS_URL=ws://localhost:4000/ws
```