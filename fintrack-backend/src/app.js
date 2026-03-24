const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { errorHandler } = require('./middleware/errorHandler');
const { requestContext } = require('./middleware/requestContext');
const db = require('./config/db');

const app = express();

app.disable('x-powered-by');
app.set('query parser', 'simple');
app.set('trust proxy', Number.parseInt(process.env.TRUST_PROXY || '0', 10));

const defaultAllowedOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:4173',
  'http://127.0.0.1:4173',
  'https://financial-project-7qj3.vercel.app',
  'https://financial-project-git-6ff294-rahmatullapoyonov0709-5108s-projects.vercel.app',
  'https://financial-project-7qj3-cxazupe9i.vercel.app',
];
const configuredOrigins = (process.env.CORS_ORIGIN || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
const allowedOrigins = new Set(configuredOrigins.length ? configuredOrigins : defaultAllowedOrigins);

app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.has('*') || allowedOrigins.has(origin)) {
      return callback(null, true);
    }

    const error = Object.assign(new Error('CORS origin ruxsat etilmagan'), { statusCode: 403 });
    return callback(error);
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 600,
}));
app.use(express.json({ limit: process.env.JSON_BODY_LIMIT || '1mb', strict: true }));
app.use(express.urlencoded({ extended: false }));
app.use(requestContext);
app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});

if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
}

app.use('/api/auth', require('./routes/auth'));
app.use('/api/accounts', require('./routes/accounts'));
app.use('/api/transactions', require('./routes/transactions'));
app.use('/api/transfers', require('./routes/transfers'));
app.use('/api/debts', require('./routes/debts'));
app.use('/api/budgets', require('./routes/budgets'));
app.use('/api/analytics', require('./routes/analytics'));
app.use('/api/categories', require('./routes/categories'));
app.use('/api/ai', require('./routes/ai'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/household', require('./routes/household'));
app.use('/api/audit', require('./routes/audit'));

app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'FinTrack API ishlayapti!',
    timestamp: new Date().toISOString()
  });
});

app.get('/api/ready', async (req, res) => {
  const checks = {
    database: false,
    jwtSecret: Boolean(process.env.JWT_SECRET),
  };

  try {
    await db.query('SELECT 1');
    checks.database = true;
  } catch (error) {
    checks.database = false;
  }

  const ready = checks.database && checks.jwtSecret;
  res.status(ready ? 200 : 503).json({
    success: ready,
    checks,
    timestamp: new Date().toISOString(),
  });
});

app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: req.method + ' ' + req.originalUrl + ' topilmadi'
  });
});

app.use(errorHandler);

module.exports = app;
