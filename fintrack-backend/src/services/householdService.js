const crypto = require('crypto');
const db = require('../config/db');

const JOIN_CODE_ATTEMPTS = 10;

const generateJoinCode = () => `FT-${crypto.randomBytes(24).toString('hex').toUpperCase()}`;

const getMembership = async (userId, client = db) => {
  const { rows } = await client.query(
    `SELECT h.id AS household_id, h.name AS household_name, h.owner_user_id, h.join_code, m.role
     FROM household_members m
     JOIN households h ON h.id = m.household_id
     WHERE m.user_id = $1
     LIMIT 1`,
    [userId]
  );
  return rows[0] || null;
};

const ensureUserHousehold = async (userId, client = db) => {
  const existing = await getMembership(userId, client);
  if (existing) return existing;

  const { rows: userRows } = await client.query(
    'SELECT name FROM users WHERE id = $1 LIMIT 1',
    [userId]
  );
  if (!userRows.length) {
    throw Object.assign(new Error('Foydalanuvchi topilmadi'), { statusCode: 404 });
  }

  const defaultName = `${userRows[0].name || 'User'} family`;

  let household;
  for (let i = 0; i < JOIN_CODE_ATTEMPTS; i += 1) {
    const joinCode = generateJoinCode();
    try {
      const { rows } = await client.query(
        `INSERT INTO households (name, owner_user_id, join_code)
         VALUES ($1, $2, $3)
         RETURNING id, name, owner_user_id, join_code`,
        [defaultName, userId, joinCode]
      );
      household = rows[0];
      break;
    } catch (error) {
      if (error.code === '23505') {
        continue;
      }
      throw error;
    }
  }

  if (!household) {
    throw Object.assign(new Error('Yagona qoshilish kodi yaratilmadi'), { statusCode: 500 });
  }

  await client.query(
    'INSERT INTO household_members (household_id, user_id, role) VALUES ($1, $2, $3)',
    [household.id, userId, 'OWNER']
  );

  return {
    household_id: household.id,
    household_name: household.name,
    owner_user_id: household.owner_user_id,
    join_code: household.join_code,
    role: 'OWNER',
  };
};

const ensureHouseholdJoinCode = async (householdId, client = db) => {
  const { rows: existingRows } = await client.query(
    'SELECT join_code FROM households WHERE id = $1 LIMIT 1',
    [householdId]
  );

  if (!existingRows.length) {
    throw Object.assign(new Error('Guruh topilmadi'), { statusCode: 404 });
  }

  if (existingRows[0].join_code) {
    return existingRows[0].join_code;
  }

  for (let i = 0; i < JOIN_CODE_ATTEMPTS; i += 1) {
    const joinCode = generateJoinCode();
    try {
      const { rows } = await client.query(
        `UPDATE households
         SET join_code = $1
         WHERE id = $2
           AND join_code IS NULL
         RETURNING join_code`,
        [joinCode, householdId]
      );

      if (rows.length) return rows[0].join_code;

      const { rows: retryRows } = await client.query(
        'SELECT join_code FROM households WHERE id = $1 LIMIT 1',
        [householdId]
      );
      if (retryRows[0]?.join_code) {
        return retryRows[0].join_code;
      }
    } catch (error) {
      if (error.code === '23505') {
        continue;
      }
      throw error;
    }
  }

  throw Object.assign(new Error('Yagona qoshilish kodi yaratilmadi'), { statusCode: 500 });
};

const rotateHouseholdJoinCode = async (householdId, client = db) => {
  for (let i = 0; i < JOIN_CODE_ATTEMPTS; i += 1) {
    const joinCode = generateJoinCode();
    try {
      const { rows } = await client.query(
        `UPDATE households
         SET join_code = $1
         WHERE id = $2
         RETURNING join_code`,
        [joinCode, householdId]
      );
      if (!rows.length) {
        throw Object.assign(new Error('Guruh topilmadi'), { statusCode: 404 });
      }
      return rows[0].join_code;
    } catch (error) {
      if (error.code === '23505') {
        continue;
      }
      throw error;
    }
  }

  throw Object.assign(new Error('Yangi qoshilish kodi yaratilmadi'), { statusCode: 500 });
};

module.exports = {
  getMembership,
  ensureUserHousehold,
  ensureHouseholdJoinCode,
  rotateHouseholdJoinCode,
};
