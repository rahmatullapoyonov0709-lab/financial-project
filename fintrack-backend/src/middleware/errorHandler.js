const { logger } = require('../utils/logger');

const errorHandler = (err, req, res, next) => {
  const isProd = process.env.NODE_ENV === 'production';
  logger.error('request.error', {
    requestId: req.requestId,
    method: req.method,
    path: req.originalUrl,
    error: err.message,
    stack: !isProd ? err.stack : undefined,
  });

  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ success: false, error: 'JSON formati notogri' });
  }

  if (err.code === '23505') {
    return res.status(409).json({ success: false, error: 'Bu malumot allaqachon mavjud' });
  }
  if (err.code === '23503') {
    return res.status(400).json({ success: false, error: 'Bogliq malumot topilmadi' });
  }
  if (err.code === '23514') {
    return res.status(400).json({ success: false, error: 'Malumot cheklovlarga mos kelmadi' });
  }

  const statusCode = err.statusCode || err.status || 500;
  const safeMessage = statusCode >= 500
    ? 'Ichki server xatosi'
    : (err.message || 'Sorov bajarilmadi');

  res.status(statusCode).json({
    success: false,
    error: safeMessage,
    requestId: req.requestId,
  });
};

module.exports = { errorHandler };
