# ⚡ QUICK FIX - Deployment Error Tuzatish (5 Minutes)

## 🚨 Asosiy Muammolar

Senning deploy xatolarining sababi:

```
ERROR: DATABASE connect ECONNREFUSED 127.0.0.1:5432
ERROR: CORS origin not allowed
ERROR: API URL undefined
```

---

## ✅ Tezkor Tuzatish (Copy-Paste)

### 1️⃣ Backend .env Update

**Fayl:** `fintrack-backend/.env`

```env
PORT=5000
NODE_ENV=production
DATABASE_URL=postgresql://username:password@db-host:5432/fintrack_db
JWT_SECRET=8daf7886064b2665f9d1f2ef6cde4a0499eac10f84b53ea50d6805d2761d6c23a36f11028758abe78084455be0f8c511
JWT_EXPIRES_IN=7d
CORS_ORIGIN=https://your-frontend-url.vercel.app
APP_BASE_URL=https://your-frontend-url.vercel.app
JSON_BODY_LIMIT=1mb
TRUST_PROXY=1
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM="FinTrack <your-email@gmail.com>"
OPENROUTER_API_KEY=sk-or-v1-your-key
GOOGLE_CLIENT_ID=your-client-id
```

**O'zgartirilishi kerak bo'lgan qismlar:**
- `postgresql://username:password@db-host:5432/fintrack_db` ← Cloud DB URL
- `https://your-frontend-url.vercel.app` ← Frontend deployment URL
- `your-email@gmail.com` ← Real Gmail
- `your-app-password` ← Gmail App Password

### 2️⃣ Frontend .env Update

**Fayl:** `fintrack/.env`

```env
VITE_API_URL=https://your-backend-url.onrender.com/api
VITE_GOOGLE_CLIENT_ID=572452048706-1pbqiriljb4svp32m0havvtr6254nmer.apps.googleusercontent.com
```

**O'zgartirilishi kerak bo'lgan qismlar:**
- `https://your-backend-url.onrender.com/api` ← Backend deployment URL

### 3️⃣ Deployment Update

```bash
# 1. Qo'shish
git add -A

# 2. Save qilish
git commit -m "Fix: Production deployment configuration"

# 3. Push qilish (GitHub)
git push origin main
```

### 4️⃣ Render.com / Vercel Settings

**Backend (Render):**
- Settings → Environment Variables → Update

**Frontend (Vercel):**
- Settings → Environment Variables → Update

---

## ✨ Done! Redeploy qilinadi avtomatik!

Wait 2-3 minutes...

**Test:**
- Open: https://your-frontend-url.vercel.app
- Test Login
- Check Network tab: API calls `/api/` da bo'lish kerak

---

## 🆘 Agar hali xato bo'lsa:

1. **CORS error?** → CORS_ORIGIN frontend URLi o'zga boladikim?
2. **API 404?** → VITE_API_URL backend URLi to'g'rimi?
3. **Database error?** → DATABASE_URL localhost yo'qmi?

**Check:**
```
GET https://backend-url.onrender.com/api/health
```

Agar response `{ success: true }` → Backend OK!
Agar error → Render logs check qiling

