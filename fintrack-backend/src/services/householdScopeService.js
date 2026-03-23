const db = require('../config/db');
const { ensureUserHousehold } = require('./householdService');

const resolveScopeUserId = async (userId, client = db) => {
  const membership = await ensureUserHousehold(userId, client);
  return membership?.owner_user_id || userId;
};

module.exports = {
  resolveScopeUserId,
};
