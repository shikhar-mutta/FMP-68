# FMP-68

> **Google OAuth Sign-In/Sign-Out** app with real-time online/offline user status.
> Built with **NestJS** (backend) · **React** (frontend) · **Prisma + MongoDB** (database)

---

## 📁 Project Structure

```
FMP-68/
├── backend/          ← NestJS REST API (port 4000)
│   ├── prisma/
│   │   └── schema.prisma     ← Prisma schema (users collection)
│   ├── src/
│   │   ├── auth/             ← Google OAuth + JWT
│   │   ├── users/            ← Users CRUD + online/offline
│   │   └── prisma/           ← PrismaService
│   ├── .env                  ← Your environment variables
│   └── package.json
│
├── frontend/         ← React SPA (port 3000)
│   ├── src/
│   │   ├── context/          ← AuthContext (sign-in, sign-out, auto-logout)
│   │   ├── pages/            ← Login, Dashboard, AuthCallback
│   │   └── components/       ← Navbar (green dot), UserCard
│   ├── .env
│   └── package.json
│
└── README.md
```

---

## ✅ Prerequisites

| Tool | Version | Download |
|------|---------|----------|
| **Node.js** | v18+ | https://nodejs.org |
| **MongoDB** | v6+ (local) | https://www.mongodb.com/try/download/community |
| **Google OAuth** | Credentials | https://console.cloud.google.com/apis/credentials |

---

## 🗄️ Step 1 — MongoDB Replica Set (Required for Prisma)

Prisma requires MongoDB to run as a **replica set**. Do this **once**:

### Run PowerShell as Administrator, then paste:

```powershell
Stop-Service -Name "MongoDB" -Force
$cfg = "C:\Program Files\MongoDB\Server\8.2\bin\mongod.cfg"
$content = Get-Content $cfg -Raw
$content = $content -replace "#replication:", "replication:`r`n  replSetName: `"rs0`""
Set-Content $cfg $content -Force
Start-Service -Name "MongoDB"
```

### Then in MongoDB Compass shell (`>_` button) or mongosh:

```js
rs.initiate()
// Should return: { ok: 1 }
```

---

## ⚙️ Step 2 — Backend Setup

```powershell
cd FMP-68\backend

# Install dependencies
npm install

# Generate Prisma client
npx prisma generate

# Push schema to MongoDB (creates users collection + indexes)
npx prisma db push
```

### Configure `backend\.env`

Copy from `.env.example` or create the file with:

```env
PORT=4000
DATABASE_URL=mongodb://localhost:27017/fmp68?replicaSet=rs0&directConnection=true
GOOGLE_CLIENT_ID=your_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-your_secret
GOOGLE_CALLBACK_URL=http://localhost:4000/auth/google/callback
JWT_SECRET=your_jwt_secret_key
JWT_EXPIRES_IN=7d
FRONTEND_URL=http://localhost:3000
```

### Start Backend

```powershell
cd FMP-68\backend
npm run start:dev
# ✅ Running at http://localhost:4000
```

---

## 💻 Step 3 — Frontend Setup

```powershell
cd FMP-68\frontend

# Install dependencies
npm install
```

### Configure `frontend\.env`

```env
REACT_APP_API_URL=http://localhost:4000
DANGEROUSLY_DISABLE_HOST_CHECK=true
HOST=localhost
```

### Start Frontend

```powershell
cd FMP-68\frontend

# Windows PowerShell (use inline env vars to avoid allowedHosts bug)
$env:DANGEROUSLY_DISABLE_HOST_CHECK="true"; $env:HOST="localhost"; $env:REACT_APP_API_URL="http://localhost:4000"; npx react-scripts start

# ✅ Running at http://localhost:3000
```

---

## 🔑 Google Cloud Console Setup

Go to: https://console.cloud.google.com/apis/credentials

**Authorised JavaScript Origins:**
```
http://localhost:3000
http://localhost:4000
```

**Authorised Redirect URIs:**
```
http://localhost:4000/auth/google/callback
```

---

## 📡 API Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/auth/google` | ❌ | Redirect to Google sign-in |
| `GET` | `/auth/google/callback` | ❌ | OAuth callback → issues JWT |
| `POST` | `/auth/signout` | ✅ JWT | Sign out → sets `isOnline=false` |
| `GET` | `/auth/me` | ✅ JWT | Get current user profile |
| `GET` | `/users` | ✅ JWT | All users with online/offline status |

---

## 📚 Swagger API Documentation

The backend includes **Swagger UI** for interactive API testing and documentation.

### Access Swagger UI

Once the backend is running:

```
http://localhost:4000/api
```

### Features

- 📖 **Full API Documentation** → All endpoints with request/response schemas
- 🧪 **Try It Out** → Test endpoints directly from browser
- 🔐 **Bearer Auth** → Authenticate with JWT tokens for protected endpoints
- 📝 **Request/Response Examples** → See what data to send and expect

### How to Use Swagger

1. Start backend: `npm run start:dev`
2. Open browser: `http://localhost:4000/api`
3. For protected endpoints:
   - Click **🔓 Authorize** button (top right)
   - Enter your JWT token: `Bearer <your_token_here>`
   - Click **Authorize** → Now you can test protected endpoints

### Available Endpoints in Swagger

- **Auth Endpoints**
  - `GET /auth/google` — Sign in with Google
  - `GET /auth/google/callback` — Callback from Google OAuth
  - `POST /auth/signout` — Sign out (protected)
  - `GET /auth/me` — Get current user (protected)

- **Users Endpoints**
  - `GET /users` — List all users with online/offline status (protected)

---

## 🗃️ Database — Users Collection

| Field | Type | Description |
|-------|------|-------------|
| `id` | `ObjectId` | Primary key |
| `googleId` | `String` | Google account ID (unique) |
| `email` | `String` | Gmail (unique) |
| `name` | `String` | Full name |
| `picture` | `String` | Profile photo URL |
| **`isOnline`** | **`Boolean`** | `true` = online · `false` = offline |
| `lastSeen` | `DateTime` | Last activity timestamp |
| `createdAt` | `DateTime` | Auto-set on creation |
| `updatedAt` | `DateTime` | Auto-updated |

---

## ✨ Features

| Feature | Details |
|---------|---------|
| **Google OAuth** | Sign-in via Google account |
| **JWT Auth** | 7-day token stored in localStorage |
| **Online/Offline** | `isOnline` set `true` on login, `false` on logout |
| **Dashboard** | Shows all OTHER users — not yourself |
| **Green dot** | Own avatar in navbar shows pulsing green dot |
| **Auto sign-out** | 30 minutes of inactivity → automatic sign-out |
| **Prisma ORM** | Type-safe MongoDB access via Prisma Client |

---

## 🔄 Auth Flow

```
Browser → GET /auth/google → NestJS → Redirect to Google
Google → User consents → Redirect to /auth/google/callback
NestJS → Create/Update user (isOnline=true) → Issue JWT
Redirect → React /auth/callback?token=xxx → Store in localStorage
React → GET /auth/me → Show Dashboard
Sign Out → POST /auth/signout → isOnline=false → Clear token
```

---

## 🔍 Prisma Studio (Database GUI)

```powershell
cd FMP-68\backend
npx prisma studio
# Opens at http://localhost:5555
```

---

## 🛠️ Troubleshooting

### `npm` or `npx` not recognized
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### Prisma replica set error
Follow **Step 1** (MongoDB Replica Set setup above).

### Frontend `allowedHosts` error
Use the **inline env var** start command from Step 3, not `npm start` directly.

### 500 on sign-in
Check the backend terminal for errors. Most likely MongoDB is not running as a replica set.
