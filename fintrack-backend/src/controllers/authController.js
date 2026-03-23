const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/db');
const {
  issueAuthTokens,
  rotateRefreshToken,
  revokeRefreshToken,
  revokeAllUserSessions,
} = require('../services/sessionService');
const { logAudit } = require('../services/auditService');
const { ensureUserHousehold } = require('../services/householdService');
const { sendPasswordResetEmail, isSmtpConfigured } = require('../services/mailerService');

const APP_BASE_URL = process.env.APP_BASE_URL || 'http://localhost:5173';

const createDefaultCashAccount = async (client, userId) => {
  await client.query(
    'INSERT INTO accounts (user_id, name, type, currency, balance, initial_balance) VALUES ($1, $2, $3, $4, $5, $6)',
    [userId, 'Naqd pul', 'CASH', 'UZS', 0, 0]
  );
};

const getPasswordResetSecret = () => process.env.PASSWORD_RESET_SECRET || process.env.JWT_SECRET;

const buildPasswordResetToken = ({ userId, passwordHash }) => {
  const secret = getPasswordResetSecret();
  const fingerprint = crypto.createHash('sha256').update(String(passwordHash)).digest('hex').slice(0, 16);
  return jwt.sign(
    { purpose: 'password-reset', userId, fingerprint },
    secret,
    { expiresIn: process.env.PASSWORD_RESET_EXPIRES_IN || '30m', algorithm: 'HS256' }
  );
};

const verifyPasswordResetToken = (token) => jwt.verify(token, getPasswordResetSecret(), { algorithms: ['HS256'] });

const register = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    const existing = await db.query(
      'SELECT id FROM users WHERE email = $1',
      [email.toLowerCase().trim()]
    );

    if (existing.rows.length > 0) {
      return res.status(409).json({
        success: false,
        error: 'Bu email allaqachon royxatdan otgan'
      });
    }

    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(password, salt);

    const result = await db.transaction(async (client) => {
      const userResult = await client.query(
        'INSERT INTO users (email, password_hash, name) VALUES ($1, $2, $3) RETURNING id, email, name, created_at',
        [email.toLowerCase().trim(), passwordHash, name.trim()]
      );
      const user = userResult.rows[0];

      await createDefaultCashAccount(client, user.id);

      return user;
    });
    await ensureUserHousehold(result.id);

    const { accessToken, refreshToken } = await issueAuthTokens({
      userId: result.id,
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip,
    });

    await logAudit({
      req,
      userId: result.id,
      action: 'AUTH_REGISTER',
      entity: 'user',
      entityId: result.id,
      metadata: { email: result.email },
    });

    res.status(201).json({
      success: true,
      data: {
        accessToken,
        refreshToken,
        user: {
          id: result.id,
          email: result.email,
          name: result.name,
          createdAt: result.created_at
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const { rows } = await db.query(
      'SELECT id, email, password_hash, name, created_at FROM users WHERE email = $1',
      [email.toLowerCase().trim()]
    );

    if (rows.length === 0) {
      return res.status(401).json({
        success: false,
        error: 'Email yoki parol notogri'
      });
    }

    const user = rows[0];
    const isValid = await bcrypt.compare(password, user.password_hash);

    if (!isValid) {
      return res.status(401).json({
        success: false,
        error: 'Email yoki parol notogri'
      });
    }

    await ensureUserHousehold(user.id);

    const { accessToken, refreshToken } = await issueAuthTokens({
      userId: user.id,
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip,
    });

    await logAudit({
      req,
      userId: user.id,
      action: 'AUTH_LOGIN',
      entity: 'user',
      entityId: user.id,
    });

    res.json({
      success: true,
      data: {
        accessToken,
        refreshToken,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          createdAt: user.created_at
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

const getMe = async (req, res, next) => {
  try {
    await ensureUserHousehold(req.user.id);

    const { rows } = await db.query(
      'SELECT id, email, name, created_at FROM users WHERE id = $1',
      [req.user.id]
    );
    if (!rows.length) {
      return res.status(404).json({ success: false, error: 'Foydalanuvchi topilmadi' });
    }
    res.json({ success: true, data: rows[0] });
  } catch (error) {
    next(error);
  }
};

const refresh = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    const tokens = await rotateRefreshToken({
      refreshToken,
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip,
    });

    res.json({
      success: true,
      data: tokens,
    });
  } catch (error) {
    next(error);
  }
};

const logout = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    const count = await revokeRefreshToken(refreshToken);
    // Bug fix: logAudit awaited BEFORE sending response so errors can be caught
    if (count > 0) {
      await logAudit({
        req,
        userId: req.user?.id || null,
        action: 'AUTH_LOGOUT',
        entity: 'session',
      });
    }
    res.json({ success: true, message: 'Session yopildi' });
  } catch (error) {
    next(error);
  }
};

const logoutAll = async (req, res, next) => {
  try {
    const count = await revokeAllUserSessions(req.user.id);
    await logAudit({
      req,
      userId: req.user.id,
      action: 'AUTH_LOGOUT_ALL',
      entity: 'session',
      metadata: { count },
    });
    res.json({ success: true, message: 'Barcha sessionlar yopildi', count });
  } catch (error) {
    next(error);
  }
};

const updateMe = async (req, res, next) => {
  try {
    const nextName = typeof req.body.name === 'string' ? req.body.name.trim() : undefined;
    const nextEmailRaw = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : undefined;
    const nextEmail = nextEmailRaw && nextEmailRaw.length > 0 ? nextEmailRaw : undefined;

    if (nextName === undefined && nextEmail === undefined) {
      return res.status(400).json({ success: false, error: 'Kamida bitta maydonni ozgartiring' });
    }

    if (nextEmail) {
      const { rows: duplicateRows } = await db.query(
        'SELECT id FROM users WHERE email = $1 AND id <> $2 LIMIT 1',
        [nextEmail, req.user.id]
      );
      if (duplicateRows.length > 0) {
        return res.status(409).json({ success: false, error: 'Bu email band' });
      }
    }

    const { rows } = await db.query(
      'UPDATE users SET name = COALESCE($1, name), email = COALESCE($2, email) WHERE id = $3 RETURNING id, email, name, created_at',
      [nextName, nextEmail, req.user.id]
    );

    if (!rows.length) {
      return res.status(404).json({ success: false, error: 'Foydalanuvchi topilmadi' });
    }

    await logAudit({
      req,
      userId: req.user.id,
      action: 'AUTH_PROFILE_UPDATE',
      entity: 'user',
      entityId: req.user.id,
      metadata: {
        changedFields: {
          ...(nextName !== undefined ? { name: true } : {}),
          ...(nextEmail !== undefined ? { email: true } : {}),
        },
      },
    });

    res.json({ success: true, data: rows[0] });
  } catch (error) {
    next(error);
  }
};

const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (currentPassword === newPassword) {
      return res.status(400).json({ success: false, error: 'Yangi parol joriy paroldan farq qilishi kerak' });
    }

    const { rows } = await db.query(
      'SELECT password_hash FROM users WHERE id = $1',
      [req.user.id]
    );
    if (!rows.length) {
      return res.status(404).json({ success: false, error: 'Foydalanuvchi topilmadi' });
    }

    const isValid = await bcrypt.compare(currentPassword, rows[0].password_hash);
    if (!isValid) {
      return res.status(401).json({ success: false, error: 'Joriy parol notogri' });
    }

    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(newPassword, salt);

    await db.query(
      'UPDATE users SET password_hash = $1 WHERE id = $2',
      [passwordHash, req.user.id]
    );

    const revokedCount = await revokeAllUserSessions(req.user.id);

    await logAudit({
      req,
      userId: req.user.id,
      action: 'AUTH_PASSWORD_UPDATE',
      entity: 'user',
      entityId: req.user.id,
      metadata: { revokedSessions: revokedCount },
    });

    res.json({ success: true, message: 'Parol yangilandi', revokedSessions: revokedCount });
  } catch (error) {
    next(error);
  }
};

const forgotPassword = async (req, res, next) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    if (!email) {
      return res.status(400).json({ success: false, error: 'Email kerak' });
    }

    const { rows } = await db.query(
      'SELECT id, email, name, password_hash FROM users WHERE email = $1 LIMIT 1',
      [email]
    );

    if (!rows.length) {
      return res.json({ success: true, message: 'Agar email mavjud bo‘lsa, tiklash havolasi yuborildi' });
    }

    if (!isSmtpConfigured()) {
      return res.status(400).json({
        success: false,
        error: 'Email yuborish sozlanmagan. SMTP_USER va SMTP_PASS ni backend .env fayliga kiriting',
      });
    }

    const user = rows[0];
    const resetToken = buildPasswordResetToken({
      userId: user.id,
      passwordHash: user.password_hash,
    });
    const resetLink = `${APP_BASE_URL}/?resetToken=${encodeURIComponent(resetToken)}`;

    await sendPasswordResetEmail({
      toEmail: user.email,
      userName: user.name,
      resetLink,
    });

    res.json({ success: true, message: 'Tiklash havolasi yuborildi' });
  } catch (error) {
    next(error);
  }
};

const resetPassword = async (req, res, next) => {
  try {
    const token = String(req.body.token || '').trim();
    const newPassword = String(req.body.newPassword || '');

    if (!token || !newPassword) {
      return res.status(400).json({ success: false, error: 'Token va yangi parol kerak' });
    }

    const decoded = verifyPasswordResetToken(token);
    if (decoded?.purpose !== 'password-reset' || !decoded?.userId) {
      return res.status(400).json({ success: false, error: 'Tiklash tokeni yaroqsiz' });
    }

    const { rows } = await db.query(
      'SELECT password_hash FROM users WHERE id = $1 LIMIT 1',
      [decoded.userId]
    );
    if (!rows.length) {
      return res.status(404).json({ success: false, error: 'Foydalanuvchi topilmadi' });
    }

    const currentFingerprint = crypto.createHash('sha256').update(String(rows[0].password_hash)).digest('hex').slice(0, 16);
    if (currentFingerprint !== decoded.fingerprint) {
      return res.status(400).json({ success: false, error: 'Tiklash linki eskirgan yoki ishlatilgan' });
    }

    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(newPassword, salt);
    await db.query(
      'UPDATE users SET password_hash = $1 WHERE id = $2',
      [passwordHash, decoded.userId]
    );

    await revokeAllUserSessions(decoded.userId);

    res.json({ success: true, message: 'Parol yangilandi' });
  } catch (error) {
    if (error?.name === 'TokenExpiredError' || error?.name === 'JsonWebTokenError') {
      return res.status(400).json({ success: false, error: 'Tiklash linki yaroqsiz yoki muddati tugagan' });
    }
    next(error);
  }
};

const loginWithGoogle = async (req, res, next) => {
  try {
    const credential = String(req.body.credential || '').trim();
    const googleClientId = process.env.GOOGLE_CLIENT_ID;

    if (!googleClientId) {
      return res.status(503).json({ success: false, error: 'Google login sozlanmagan' });
    }
    if (!credential) {
      return res.status(400).json({ success: false, error: 'Google credential kerak' });
    }

    const response = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`);
    if (!response.ok) {
      return res.status(401).json({ success: false, error: 'Google tokenini tekshirib bo‘lmadi' });
    }

    const googleData = await response.json();
    if (googleData.aud !== googleClientId) {
      return res.status(401).json({ success: false, error: 'Google client ID mos emas' });
    }
    // Bug fix: Google API returns email_verified as string 'true' OR boolean true
    if (googleData.email_verified !== 'true' && googleData.email_verified !== true) {
      return res.status(401).json({ success: false, error: 'Google email tasdiqlanmagan' });
    }

    const email = String(googleData.email || '').trim().toLowerCase();
    const name = String(googleData.name || googleData.given_name || 'Google user').trim();
    if (!email) {
      return res.status(400).json({ success: false, error: 'Google email topilmadi' });
    }

    let user = null;
    const existing = await db.query(
      'SELECT id, email, name, created_at FROM users WHERE email = $1 LIMIT 1',
      [email]
    );

    if (existing.rows.length > 0) {
      user = existing.rows[0];
    } else {
      const salt = await bcrypt.genSalt(12);
      const randomPassword = crypto.randomBytes(24).toString('hex');
      const passwordHash = await bcrypt.hash(randomPassword, salt);

      const created = await db.transaction(async (client) => {
        const userResult = await client.query(
          'INSERT INTO users (email, password_hash, name) VALUES ($1, $2, $3) RETURNING id, email, name, created_at',
          [email, passwordHash, name]
        );
        await createDefaultCashAccount(client, userResult.rows[0].id);
        return userResult.rows[0];
      });
      user = created;
    }

    await ensureUserHousehold(user.id);

    const { accessToken, refreshToken } = await issueAuthTokens({
      userId: user.id,
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip,
    });

    res.json({
      success: true,
      data: {
        accessToken,
        refreshToken,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          createdAt: user.created_at,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  register,
  login,
  loginWithGoogle,
  getMe,
  updateMe,
  changePassword,
  forgotPassword,
  resetPassword,
  refresh,
  logout,
  logoutAll,
};
