require('dotenv').config();

const { runMigrations } = require('../config/migrate');
const { testConnection } = require('../config/db');

const main = async () => {
  const connected = await testConnection();
  if (!connected) {
    process.exit(1);
  }

  await runMigrations();
  process.exit(0);
};

main().catch((error) => {
  console.error('Migration xatosi:', error.message);
  process.exit(1);
});
