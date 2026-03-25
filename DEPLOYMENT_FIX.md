# FinTrack - Deploy Xaterini To'g'rlash

## 🔴 Asosiy Muammolar va Tuzatishlar

### 1. **Backend Environment Variables (.env) - KRITIK**

**Muammo:** DATABASE_URL localhost ga ishlatilyapti (production uchun ishlash mumkin emas)

**Tuzatish:**

```env
# Production deployment uchun .env faylini shunday sozla:

PORT=5000
NODE_ENV=production

# 🔴 JUDA MUHIM: localhost o'rniga remote database URL ishlatish kerak
# Render, Supabase, yoki boshqa cloud database xizmati ishlatish kerak
DATABASE_URL=postgresql://username:password@db-host.example.com:5432/fintrack_db

JWT_SECRET=8daf7886064b2665f9d1f2ef6cde4a0499eac10f84b53ea50d6805d2761d6c23a36f11028758abe78084455be0f8c511
JWT_EXPIRES_IN=7d

# CORS: Faqat production frontend URLlarini qo'sh
CORS_ORIGIN=https://your-frontend-domain.com

APP_BASE_URL=https://your-frontend-domain.com
JSON_BODY_LIMIT=1mb
TRUST_PROXY=1

# Email settings - o'zingizning real emailni ishlatish kerak
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password  # Gmail uchun: App Password ishlatish kerak
SMTP_FROM="FinTrack <your_email@gmail.com>"

# AI Settings
OPENROUTER_API_KEY=your_api_key_here
GOOGLE_CLIENT_ID=your_google_client_id_here
```

**Qanday qilish kerak:**
1. **Database Setup**: 
   - Render, Supabase, yoki AWS RDS dan PostgreSQL database yarating
   - DATABASE_URL ni olgan holatda .env ga qo'ying
   
2. **Gmail SMTP**:
   - Gmail Account Security > App Passwords > "Mail" va "Windows Computer" tanlang
   - Generated password ni SMTP_PASS ga paste qiling

### 2. **Frontend Environment Variables**

**Fayl:** `fintrack/.env`

**Joriy qiymati:**
```
VITE_API_URL=https://financial-project-1.onrender.com/api
VITE_GOOGLE_CLIENT_ID=572452048706-1pbqiriljb4svp32m0havvtr6254nmer.apps.googleusercontent.com
```

⚠️ **Tekshirish:** Agar backend URL o'zgarsa, buni update qiling!

### 3. **CORS Issues**

**Tuzatildi:** Backend CORS_ORIGIN da faqat production frontend domeni kiritildi

**Tekshirish:**
- Frontend domain va Backend domain tugri kiritilganligini tekshirish
- http (development) - localhost uchun olinib tashlandi
- https (production) - production uchun qo'shildi

---

## 📋 Production Deploy Checklist

### Backend (Node.js/Express)

- [ ] `.env` faylida DATABASE_URL to'g'ri o'rnatilgan
- [ ] `.env` faylida CORS_ORIGIN to'g'ri o'rnatilgan  
- [ ] `.env` faylida JWT_SECRET xavfsiz
- [ ] SMTP credentials o'rnatilgan (agar email kerak bo'lsa)
- [ ] Database migrations avtomatik run qilinadi: `npm start` vaqtida
- [ ] PORT environment variable o'rnatilgan (Render/Heroku auto sozlaydi)
- [ ] Health check ishlamog'ini tekshiring: `GET /api/health`
- [ ] Ready check ishlamog'ini tekshirish: `GET /api/ready`

### Frontend (Vite/React)

- [ ] `.env` faylida VITE_API_URL to'g'ri backend URLga ishora qiladi
- [ ] `npm build` bilan build qilamiz: `npm run build`
- [ ] `dist/` papka deployment platformasiga yuklandi
- [ ] Frontend serve HTTP headers to'g'ri (cache control, etc)

---

## 🚀 Step-by-Step Deploy (Render.com misoli)

### Backend Deploy (Render.com)

1. GitHub repositoriyning `fintrack-backend` directory ni deploy qiling
2. Environment variables qo'shish:
   ```
   DATABASE_URL = postgresql://...
   JWT_SECRET = ...
   CORS_ORIGIN = https://your-frontend.com
   SMTP_USER = your_email@gmail.com
   SMTP_PASS = your_app_password
   NODE_ENV = production
   ```
3. Build command: `npm install`
4. Start command: `npm start`

### Frontend Deploy (Vercel/Netlify)

1. GitHub repositoriyning `fintrack` directory ni deploy qiling
2. Environment variables:
   ```
   VITE_API_URL = https://your-backend.onrender.com/api
   VITE_GOOGLE_CLIENT_ID = ...
   ```
3. Build command: `npm run build`
4. Output directory: `dist`

---

## 🔍 Deployment Xatolarini Tekshirish

### Backend Health Checks

```bash
# Liveness check
curl https://your-backend.com/api/health

# Readiness check (database + JWT)
curl https://your-backend.com/api/ready
```

### Frontend Test

- Frontend URL ochib, `/` route load bo'lishi kerak
- Network tab da API calls `/api/` ga ju­na­shishi kerak
- CORS xatolar console da ko'rinmasa, sozlama to'g'ri

### Database Connection

```bash
# SSH orqali server ga ulaning
# psql bilan database test:
SELECT 1;
```

---

## 🛡️ Security Tips

1. **Credentials**: Hech qachon .env faylining credentials GitHub ga push qilmang
2. **JWT_SECRET**: Minimum 32 character, random secret ishlatish kerak
3. **SMTP_PASS**: Gmail uchun App Password ishlatish kerak (regular password emas)
4. **CORS**: Production da faqat o'z domeni qo'shish kerak
5. **Database SSL**: Production PostgreSQL SSL=require qo'shish kerak

---

## 📞 Common Issues va Tuzatishlar

| Muammo | Sebab | Tuzatish |
|--------|--------|----------|
| `DATABASE_URL topilmadi` | .env faylida DATABASE_URL yo'q | .env ga DATABASE_URL qo'shish |
| `CORS origin ruxsat etilmagan` | Frontend domain CORS_ORIGIN da yo'q | CORS_ORIGIN ga frontend URL qo'shish |
| `Database connection failed` | localhost connection string | Remote database URL ishlatish |
| `Port already in use` | PORT environment variable xato | PORT ni o'zgartirish yoki process stop qilish |
| `API calls 404 return` | Frontend API URL xato | VITE_API_URL tekshirish |

---

## 📝 .gitignore Check

Quyidagilar .gitignore da bo'lishi kerak:
```
.env
.env.local
.env.*.local
node_modules/
dist/
*.log
```

✅ **Shuni tekshirib, hamma to'g'rilanglandan keyin redeploy qiling!**
