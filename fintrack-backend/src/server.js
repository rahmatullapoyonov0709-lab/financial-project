require('dotenv').config();

const app = require('./app');
const { testConnection } = require('./config/db');
const { runMigrations } = require('./config/migrate');
const { logger } = require('./utils/logger');
const { cleanupExpiredSessions } = require('./services/sessionService');
const { startAiReportScheduler } = require('./services/aiReportService');

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  logger.info('server.starting');

  const dbOk = await testConnection();

  if (!dbOk) {
    logger.error('server.db_connection_failed');
    process.exit(1);
  }

  await runMigrations();
  await cleanupExpiredSessions();
  logger.info('ai.scheduler_bootstrap', {
    enabled: String(process.env.AI_REPORT_SCHEDULER || 'true').toLowerCase() !== 'false',
    mode: String(process.env.AI_REPORT_SCHEDULER_MODE || 'cron').toLowerCase(),
    nodeEnv: process.env.NODE_ENV || 'development',
  });
  const stopAiScheduler = startAiReportScheduler();

  const server = app.listen(PORT, () => {
    logger.info('server.started', {
      port: PORT,
      health: `http://localhost:${PORT}/api/health`,
      ready: `http://localhost:${PORT}/api/ready`,
    });
  });

  setInterval(() => {
    cleanupExpiredSessions().catch((error) => {
      logger.warn('sessions.cleanup_failed', { error: error.message });
    });
  }, 6 * 60 * 60 * 1000).unref();

  // Bug fix: Graceful shutdown — wait for active connections to drain before exit
  process.on('SIGTERM', () => {
    logger.info('server.shutdown_signal');
    stopAiScheduler();
    server.close(() => {
      logger.info('server.shutdown_complete');
      process.exit(0);
    });
    // Force exit if connections don't close within 10 seconds
    setTimeout(() => {
      logger.warn('server.shutdown_forced');
      process.exit(1);
    }, 10000).unref();
  });
};

process.on('unhandledRejection', (err) => {
  logger.error('server.unhandled_rejection', { error: err?.message || String(err) });
  if (process.env.NODE_ENV !== 'production' && err?.stack) {
    logger.error('server.unhandled_rejection_stack', { stack: err.stack });
  }
  process.exit(1);
});

process.on('uncaughtException', (err) => {
  logger.error('server.uncaught_exception', { error: err?.message || String(err) });
  if (process.env.NODE_ENV !== 'production' && err?.stack) {
    logger.error('server.uncaught_exception_stack', { stack: err.stack });
  }
  process.exit(1);
});

startServer();
