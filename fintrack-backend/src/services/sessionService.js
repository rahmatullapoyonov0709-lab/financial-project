const crypto = require('crypto');
const db = require('../config/db');
const { generateToken } = require('../middleware/auth');

const REFRESH_DAYS = Number.parseInt(process.env.REFRESH_TOKEN_EXPIRES_DAYS || '30', 10);

const hashToken = (token) => crypto.createHash('sha256').update(String(token)).digest('hex');

const createRefreshToken = () => crypto.randomBytes(48).toString('base64url');

const getExpiryDate = () => {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + (Number.isFinite(REFRESH_DAYS) ? REFRESH_DAYS : 30));
  return expiresAt;
};

const createSession = async (client, { userId, refreshToken, userAgent, ipAddress }) => {
  const refreshTokenHash = hashToken(refreshToken);
  const expiresAt = getExpiryDate();

  await client.query(
    `INSERT INTO user_sessions (user_id, refresh_token_hash, user_agent, ip_address, expires_at, last_used_at)
     VALUES ($1, $2, $3, $4, $5, NOW())`,
    [userId, refreshTokenHash, userAgent || null, ipAddress || null, expiresAt]
  );
};

const issueAuthTokens = async ({ userId, userAgent, ipAddress }) => {
  const accessToken = generateToken(userId);
  const refreshToken = createRefreshToken();

  await db.transaction(async (client) => {
    await createSession(client, { userId, refreshToken, userAgent, ipAddress });
  });

  return { accessToken, refreshToken };
};

const rotateRefreshToken = async ({ refreshToken, userAgent, ipAddress }) => {
  const oldHash = hashToken(refreshToken);
  const newRefreshToken = createRefreshToken();
  const newHash = hashToken(newRefreshToken);
  const expiresAt = getExpiryDate();

  const result = await db.transaction(async (client) => {
    const sessionR = await client.query(
      `SELECT id, user_id
       FROM user_sessions
       WHERE refresh_token_hash = $1
         AND revoked_at IS NULL
         AND expires_at > NOW()
       FOR UPDATE`,
      [oldHash]
    );

    if (!sessionR.rows.length) {
      throw Object.assign(new Error('Refresh token yaroqsiz yoki muddati tugagan'), { statusCode: 401 });
    }

    const session = sessionR.rows[0];

    await client.query(
      'UPDATE user_sessions SET revoked_at = NOW(), last_used_at = NOW() WHERE id = $1',
      [session.id]
    );

    await client.query(
      `INSERT INTO user_sessions (user_id, refresh_token_hash, user_agent, ip_address, expires_at, last_used_at)
       VALUES ($1, $2, $3, $4, $5, NOW())`,
      [session.user_id, newHash, userAgent || null, ipAddress || null, expiresAt]
    );

    const accessToken = generateToken(session.user_id);
    return { accessToken, refreshToken: newRefreshToken };
  });

  return result;
};

const revokeRefreshToken = async (refreshToken) => {
  const refreshTokenHash = hashToken(refreshToken);
  const { rowCount } = await db.query(
    'UPDATE user_sessions SET revoked_at = NOW(), last_used_at = NOW() WHERE refresh_token_hash = $1 AND revoked_at IS NULL',
    [refreshTokenHash]
  );
  return rowCount;
};

const revokeAllUserSessions = async (userId) => {
  const { rowCount } = await db.query(
    'UPDATE user_sessions SET revoked_at = NOW(), last_used_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL',
    [userId]
  );
  return rowCount;
};

const cleanupExpiredSessions = async () => {
  await db.query(
    'DELETE FROM user_sessions WHERE expires_at <= NOW() OR revoked_at <= NOW() - INTERVAL \'30 days\''
  );
};

module.exports = {
  issueAuthTokens,
  rotateRefreshToken,
  revokeRefreshToken,
  revokeAllUserSessions,
  cleanupExpiredSessions,
};
