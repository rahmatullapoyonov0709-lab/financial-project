# FinTrack Backend Operations

## 1) Startup safety
- Server start vaqtida `src/migrations/*.sql` avtomatik qo'llanadi.
- Tayyorlikni tekshirish uchun:
  - `GET /api/health` (liveness)
  - `GET /api/ready` (database + JWT config readiness)

## 2) Token and session security
- Login/register endi `accessToken` bilan birga `refreshToken` ham qaytaradi.
- Access token muddati tugaganda frontend `POST /api/auth/refresh` orqali tokenni yangilaydi.
- Endpointlar:
  - `POST /api/auth/refresh`
  - `POST /api/auth/logout`
  - `POST /api/auth/logout-all`

## 3) Audit logs
- Moliyaviy amallar audit jadvaliga yoziladi (`audit_logs`):
  - account/transaction/transfer/debt/budget/category create/update/delete
  - auth register/login/logout
- Foydalanuvchi o'z loglarini ko'rish:
  - `GET /api/audit?limit=50`

## 4) Balance integrity
- Hisob balanslarini tekshirish:
  - `GET /api/accounts/reconcile` (faqat tekshiradi)
  - `GET /api/accounts/reconcile?fix=true` (tafovutlarni tuzatadi)

## 5) Backup and restore
- Backup:
  - `powershell -ExecutionPolicy Bypass -File .\\scripts\\backup.ps1`
- Restore:
  - `powershell -ExecutionPolicy Bypass -File .\\scripts\\restore.ps1 -BackupFile .\\backups\\fintrack_backup_YYYYMMDD_HHMMSS.dump`

## 6) Recommended routine
1. Har deploy oldidan backup oling.
2. Deploydan keyin `/api/ready`ni tekshiring.
3. Haftasiga kamida 1 marta `accounts/reconcile` check qiling.
4. Audit loglarda g'ayrioddiy aktivlikni tekshiring.
