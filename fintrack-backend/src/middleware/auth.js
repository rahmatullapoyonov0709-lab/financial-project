const jwt = require('jsonwebtoken');
const db = require('../config/db');

const getJwtSecret = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    return null;
  }
  if (secret.length < 32) {
    console.warn('JWT_SECRET qisqa. 32+ belgi ishlatish tavsiya etiladi.');
  }
  return secret;
};

const authenticate = async (req, res, next) => {
  try {
    const jwtSecret = getJwtSecret();
    if (!jwtSecret) {
      return res.status(500).json({ success: false, error: 'Server sozlamasi notogri' });
    }

    const authHeader = req.headers.authorization;
    if (!authHeader || !/^Bearer\s+/i.test(authHeader)) {
      return res.status(401).json({ success: false, error: 'Token topilmadi' });
    }

    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (!token) {
      return res.status(401).json({ success: false, error: 'Token topilmadi' });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, jwtSecret, {
        algorithms: ['HS256'],
        ...(process.env.JWT_ISSUER ? { issuer: process.env.JWT_ISSUER } : {}),
        ...(process.env.JWT_AUDIENCE ? { audience: process.env.JWT_AUDIENCE } : {}),
      });
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({ success: false, error: 'Token muddati tugagan' });
      }
      return res.status(401).json({ success: false, error: 'Token yaroqsiz' });
    }

    const { rows } = await db.query(
      'SELECT id, email, name FROM users WHERE id = $1',
      [decoded.userId]
    );

    if (rows.length === 0) {
      return res.status(401).json({ success: false, error: 'Foydalanuvchi topilmadi' });
    }

    req.user = rows[0];
    next();
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Server xatosi' });
  }
};

const generateToken = (userId) => {
  const jwtSecret = getJwtSecret();
  if (!jwtSecret) {
    throw Object.assign(new Error('JWT_SECRET topilmadi'), { statusCode: 500 });
  }

  return jwt.sign(
    { userId },
    jwtSecret,
    {
      expiresIn: process.env.JWT_EXPIRES_IN || '7d',
      algorithm: 'HS256',
      ...(process.env.JWT_ISSUER ? { issuer: process.env.JWT_ISSUER } : {}),
      ...(process.env.JWT_AUDIENCE ? { audience: process.env.JWT_AUDIENCE } : {}),
    }
  );
};

module.exports = { authenticate, generateToken };
