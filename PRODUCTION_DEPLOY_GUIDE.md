# FinTrack Production Deploy Guide - Detailed Instructions

## 🎯 Muammoning Sababi

Senning Financial projectda xatolar quyidagi sabablarga ko'ra:

1. **❌ Database Connection Error**: Backend `localhost:5432` ga ulanmoqda (production da bu yoki'qa)
2. **❌ CORS Errors**: Frontend va Backend o'rtasida XHR (AJAX) xatolar
3. **❌ API Connectivity**: Frontend backend API ni topa olmaydi yoki bittadan noto'g'ri URL ishlatishda

---

## ✅ To'g'rash Jarayoni (Qadam Bo'yicha)

### **QADAM 1: Database Setup (Eng Muhim!)**

Production database yaratish uchun:

#### **Variant A: Render.com (Tavsiya etilgan)**
1. Render.com saytiga kirish va login
2. "PostgreSQL" database yaratish
3. Connection string olish (DATABASE_URL)
4. .env faylga kiritish

#### **Variant B: Supabase (Bepul 500MB)**
1. supabase.com saytiga kirish
2. Yangi project yaratish
3. SQL su connection string olish
4. .env faylga kiritish

#### **Variant C: AWS RDS**
1. AWS console da PostgreSQL database yaratish
2. Security group sozlash (public access: true)
3. Connection string olish
4. .env faylga kiritish

**Ko'rinishi:** (misol)
```
postgresql://user:password@db.xxxx.com:5432/fintrack_db
```

---

### **QADAM 2: Backend Environment Variables (.env)**

Fayl: `fintrack-backend/.env`

```env
# ============== KRITIK ==============
PORT=5000
NODE_ENV=production

# Step 1 dan olgan database URL
DATABASE_URL=postgresql://user:pass@db-host.com:5432/fintrack_db

# Frontend URL (CORS uchun)
CORS_ORIGIN=https://your-frontend-domain.vercel.app

APP_BASE_URL=https://your-frontend-domain.vercel.app

# ============== JWT ==============
JWT_SECRET=8daf7886064b2665f9d1f2ef6cde4a0499eac10f84b53ea50d6805d2761d6c23a36f11028758abe78084455be0f8c511
JWT_EXPIRES_IN=7d

# ============== SMTP (Email) ==============
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-real-email@gmail.com
SMTP_PASS=xxxx-xxxx-xxxx-xxxx  # Gmail App Password
SMTP_FROM="FinTrack <your-real-email@gmail.com>"

# ============== API Keys ==============
OPENROUTER_API_KEY=sk-or-v1-your-key
GOOGLE_CLIENT_ID=your-google-id.apps.googleusercontent.com

# ============== Other ==============
JSON_BODY_LIMIT=1mb
TRUST_PROXY=1
PGSSLMODE=require
PG_POOL_MAX=10
```

**Foydalanuvchi qismlarini o'zgartiripla:**
- `your-real-email@gmail.com` - sizning Gmail
- `your-real-password` - Gmail App Password
- `your-frontend-domain.vercel.app` - frontend deployment URL
- DATABASE_URL - Render/Supabase dan
- API Keys - agar ishlatishchisiz

---

### **QADAM 3: Frontend Environment Variables (.env)**

Fayl: `fintrack/.env`

```env
VITE_API_URL=https://your-backend-domain.onrender.com/api
VITE_GOOGLE_CLIENT_ID=572452048706-1pbqiriljb4svp32m0havvtr6254nmer.apps.googleusercontent.com
```

⚠️ **Foydalanuvchining sosyal media (Google, Facebook) bilan login uchun ularning Client ID kerak**

---

### **QADAM 4: Gmail App Password Setup (Agar SMTP kk'rak bo'lsa)**

1. Google Account saytiga kirish: https://myaccount.google.com
2. Security → 2-Step Verification (agar yo'q bo'lsa, qo'shish)
3. Security → App Passwords
4. "Mail" va "Windows Computer" (yoki "Linux") tanlash
5. Generated Password olish va SMTP_PASS ga kiritish

**Ko'rinishi:** `xxxx xxxx xxxx xxxx` (16 character + spaces)

---

### **QADAM 5: Git .gitignore Tekshirish**

Faylni ko'rish: `fintrack/.gitignore` va `fintrack-backend/.gitignore`

Bu fayllar bo'lishi KERAK (aks holda credentials GitHub ga push qilinadi):
```
.env
.env.local
.env.production.local
node_modules/
dist/
```

⚠️ **Qo'shimcha:** Agar `.env` faylni accidental push qilsangiz, quyidagi buyruq bilan olib tashlang:
```bash
git rm --cached fintrack-backend/.env
git commit --amend -m "Remove .env"
```

---

### **QADAM 6: Local Testing (Deployment oldidan)**

Backend ichida (PowerShell/CMD):
```bash
cd fintrack-backend

# Dependencies o'rnatish
npm install

# Database migrations test
npm run migrate

# Server start
npm run dev
```

Frontend ichida (yangi CMD):
```bash
cd fintrack

# Dependencies
npm install

# Build
npm run build

# Preview
npm run preview
```

Test:
- http://localhost:5000/api/health → `{ success: true }` bo'lsa OK
- http://localhost:5173 → Bosh sahifa load bo'lsa OK

---

### **QADAM 7: Production Deployment**

#### **Backend Deploy (Render.com)**

1. GitHub repositoriyga push:
```bash
git add fintrack-backend/
git commit -m "Production deployment config"
git push origin main
```

2. Render.com da:
   - "New Web Service" → GitHub tanlash
   - Repository tanlash, `fintrack-backend` directory specify
   - Environment variables qo'shish (QADAM 2 dan)
   - Build command: `npm install`
   - Start command: `npm start`

#### **Frontend Deploy (Vercel/Netlify/Render)**

**Vercel (tavsiya):**

1. GitHub repositoriyga push (QADAM 7.1 dan)
2. Vercel.com da:
   - GitHub connect → Repository tanlash
   - Framework: Vite
   - Root directory: `fintrack`
   - Build command: `npm run build`
   - Output directory: `dist`
   - Environment variables qo'shish (QADAM 3 dan)
   - Deploy

**Netlify:**

1. GitHub connect
2. Build command: `npm run build`
3. Publish directory: `dist`
4. Environment variables qo'shish
5. Deploy

**Render.com:**

1. "New Static Site" → GitHub tanlash
2. Build command: `npm run build`  
3. Publish directory: `dist`
4. Deploy

---

## 🔍 Deployment Tekshiruv (Go'sh Tekshirish Kerak!)

### Health Checks

```
GET https://your-backend.onrender.com/api/health
```

**Expected:** 
```json
{
  "success": true,
  "message": "FinTrack API ishlayapti!",
  "timestamp": "2026-03-25T..."
}
```

**Agar 404 yoki connection error:**
- DATABASE_URL to'g'rimi?
- Backend deployment status tekshirish (Render logs)

### CORS Tekshiruv

Frontend da browser console uchun:
```
Network → API call → Response Headers → Access-Control-Allow-Origin
```

**Agar CORS error:**
- CORS_ORIGIN .env da to'g'rimi?
- Frontend URL .env da to'g'rimi?
- Backend redeploy qilish kerak

### Login Test

1. Frontend ochish
2. Register / Login qilish
3. Network tab dan `/api/auth/register` yoki `/api/auth/login` tekshirish
4. 200 response + token olish

**Agar xato:**
- API URL tekshirish
- CORS tekshirish
- Database connection tekshirish

---

## 🆘 Common Issues va Quick Fixes

| Xato | Sabab | Tuzatish |
|------|--------|----------|
| `DATABASE_URL not found` | .env da DATABASE_URL yo'q | Render/Supabase database Setup |
| `CORS origin not allowed` | Frontend domain CORS_ORIGIN da yo'q | .env da CORS_ORIGIN update |
| `Connection refused (localhost)` | localhost database | Cloud database URL o'rnatish |
| `API 404 errors` | Frontend API URL xato | VITE_API_URL tekshirish |
| `Mail send failed` | SMTP credentials xato | Gmail App Password Check |
| `Cannot GET /` | Frontend build xato | npm run build check |

---

## 📋 Final Checklist

- [ ] Database URL Render/Supabase dan olishdim
- [ ] Backend .env DATABASE_URL o'rnatildim
- [ ] Backend .env CORS_ORIGIN o'rnatildim
- [ ] Frontend .env VITE_API_URL o'rnatildim
- [ ] .gitignore .env ni sakrab qolib saqlaydi (GitHub ga push qilmaydi)
- [ ] Local test: `npm run dev` va build qilindi
- [ ] Backend Render/Herku ga deploy qilindi
- [ ] Frontend Vercel/Netlify ga deploy qilindi
- [ ] Health check: `/api/health` test qilindi
- [ ] Frontend login test qilindi
- [ ] Database migration successful bo'ldi

---

## 🎉 Deploy Tugadi!

Hamma qadam tugagandan keyin, production uchun ready bo'ladi!

**Test:** https://your-frontend.vercel.app

Agar hali xato bo'lsa:
1. Render logs → Backend errors check
2. Browser console → Frontend errors check
3. Network tab → API requests analyze

