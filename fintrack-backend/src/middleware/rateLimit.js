const buckets = new Map();

const cleanupExpired = (now) => {
  for (const [key, value] of buckets.entries()) {
    if (value.resetAt <= now) {
      buckets.delete(key);
    }
  }
};

const createRateLimiter = ({
  windowMs,
  max,
  keyPrefix,
  message = 'Juda kop urinish qilindi. Keyinroq qayta urinib koring.',
}) => {
  if (!windowMs || !max || !keyPrefix) {
    throw new Error('Rate limiter uchun windowMs, max va keyPrefix majburiy');
  }

  return (req, res, next) => {
    const now = Date.now();
    if (buckets.size > 5000) {
      cleanupExpired(now);
    }

    const ip = req.ip || req.socket?.remoteAddress || 'unknown';
    const key = `${keyPrefix}:${ip}`;
    const current = buckets.get(key);

    if (!current || current.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    current.count += 1;
    if (current.count > max) {
      const retryAfterSec = Math.ceil((current.resetAt - now) / 1000);
      res.setHeader('Retry-After', String(Math.max(retryAfterSec, 1)));
      return res.status(429).json({
        success: false,
        error: message,
      });
    }

    return next();
  };
};

module.exports = { createRateLimiter };
