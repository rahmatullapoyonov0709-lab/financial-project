const format = (level, message, meta = {}) => {
  const payload = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...meta,
  };
  return JSON.stringify(payload);
};

const write = (level, message, meta) => {
  const line = format(level, message, meta);
  if (level === 'error' || level === 'warn') {
    console.error(line);
    return;
  }
  console.log(line);
};

const logger = {
  debug: (message, meta = {}) => {
    if (process.env.NODE_ENV !== 'production') {
      write('debug', message, meta);
    }
  },
  info: (message, meta = {}) => write('info', message, meta),
  warn: (message, meta = {}) => write('warn', message, meta),
  error: (message, meta = {}) => write('error', message, meta),
};

module.exports = { logger };
