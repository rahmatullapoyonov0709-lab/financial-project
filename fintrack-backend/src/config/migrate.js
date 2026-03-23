const fs = require('fs/promises');
const path = require('path');
const { pool } = require('./db');
const { logger } = require('../utils/logger');

const migrationsDir = path.join(__dirname, '..', 'migrations');

const ensureMigrationsTable = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id BIGSERIAL PRIMARY KEY,
      filename VARCHAR(255) NOT NULL UNIQUE,
      applied_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);
};

const getAppliedMigrations = async () => {
  const { rows } = await pool.query('SELECT filename FROM schema_migrations');
  return new Set(rows.map((row) => row.filename));
};

const runMigrations = async () => {
  await ensureMigrationsTable();

  let files = [];
  try {
    files = await fs.readdir(migrationsDir);
  } catch (error) {
    if (error.code === 'ENOENT') {
      logger.info('migrations.skip', { reason: 'directory_not_found' });
      return;
    }
    throw error;
  }

  const sqlFiles = files
    .filter((file) => file.toLowerCase().endsWith('.sql'))
    .sort((a, b) => a.localeCompare(b));

  if (!sqlFiles.length) {
    logger.info('migrations.skip', { reason: 'no_migration_files' });
    return;
  }

  const applied = await getAppliedMigrations();

  for (const filename of sqlFiles) {
    if (applied.has(filename)) {
      continue;
    }

    const fullPath = path.join(migrationsDir, filename);
    const sql = await fs.readFile(fullPath, 'utf8');

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [filename]);
      await client.query('COMMIT');
      logger.info('migrations.applied', { filename });
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('migrations.failed', { filename, error: error.message });
      throw error;
    } finally {
      client.release();
    }
  }
};

module.exports = { runMigrations };
