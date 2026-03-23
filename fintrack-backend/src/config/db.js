const { Pool } = require('pg');
const { logger } = require('../utils/logger');

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL topilmadi. .env ni tekshiring.');
}

const sslMode = (
  process.env.PGSSLMODE ||
  (process.env.NODE_ENV === 'production' ? 'require' : 'disable')
).toLowerCase();

const shouldUseSSL = sslMode !== 'disable' && sslMode !== 'allow';

const poolConfig = {
  connectionString: process.env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  query_timeout: Number.parseInt(process.env.PG_QUERY_TIMEOUT_MS || '15000', 10),
  keepAlive: true,
  application_name: process.env.PG_APP_NAME || 'fintrack-api',
};

if (shouldUseSSL) {
  poolConfig.ssl = {
    rejectUnauthorized: false,
  };
}

const pool = new Pool(poolConfig);

pool.on('error', (err) => {
  logger.error('db.pool_error', { error: err.message });
});

const query = (text, params) => pool.query(text, params);

const transaction = async (callback) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

const testConnection = async () => {
  try {
    const res = await pool.query('SELECT NOW() AS current_time');
    logger.info('db.connected', { currentTime: res.rows[0].current_time });
    return true;
  } catch (error) {
    logger.error('db.connection_failed', { error: error.message });
    return false;
  }
};

module.exports = { pool, query, transaction, testConnection };