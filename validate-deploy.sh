#!/bin/bash
# Deploy Validation Script
# Bu script deployment uchun hamma sozlamalari tekshiradi

echo "🔍 FinTrack Deployment Validation..."
echo ""

# Backend checks
echo "📦 Backend (.env) tekshirilmoqda..."
if [ ! -f "fintrack-backend/.env" ]; then
    echo "❌ fintrack-backend/.env topilmadi"
    exit 1
fi

if ! grep -q "^DATABASE_URL=" fintrack-backend/.env; then
    echo "❌ DATABASE_URL topilmadi"
    exit 1
fi

DB_URL=$(grep "^DATABASE_URL=" fintrack-backend/.env | cut -d'=' -f2)
if [[ "$DB_URL" == *"localhost"* ]] || [[ "$DB_URL" == *"127.0.0.1"* ]]; then
    echo "⚠️  OQITILADIBU: DATABASE_URL hali ham localhost ishora qiladi!"
    echo "    Production uchun remote database URL ishlatish kerak"
else
    echo "✅ DATABASE_URL production ga sozlangan"
fi

if ! grep -q "NODE_ENV=production" fintrack-backend/.env; then
    echo "⚠️  NODE_ENV=production sochi topilmadi"
fi

if grep -q "localhost" fintrack-backend/.env; then
    echo "⚠️  CORS_ORIGIN hali localhost o'z ichiga oladi"
fi

echo ""
echo "📱 Frontend (.env) tekshirilmoqda..."
if [ ! -f "fintrack/.env" ]; then
    echo "❌ fintrack/.env topilmadi"
    exit 1
fi

FRONTEND_API=$(grep "VITE_API_URL=" fintrack/.env | cut -d'=' -f2)
echo "✅ Frontend API URL: $FRONTEND_API"

echo ""
echo "✅ Hamma tekshiruv tugadi!"
echo ""
echo "📝 Final Steps:"
echo "1. fintrack-backend/.env da DATABASE_URL o'rnatish"
echo "2. fintrack-backend/.env da CORS_ORIGIN o'rnatish"  
echo "3. fintrack-backend/.env da SMTP credentials o'rnatish"
echo "4. Backend: 'npm install && npm start'"
echo "5. Frontend: 'npm run build' va deploy qilish"
