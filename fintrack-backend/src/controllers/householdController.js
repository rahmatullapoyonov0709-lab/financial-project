const crypto = require('crypto');
const db = require('../config/db');
const {
  ensureUserHousehold,
  ensureHouseholdJoinCode,
  rotateHouseholdJoinCode,
} = require('../services/householdService');
const { sendHouseholdInviteEmail, isSmtpConfigured } = require('../services/mailerService');

const INVITE_TTL_DAYS = 7;
const APP_BASE_URL = process.env.APP_BASE_URL || 'http://localhost:5173';

const normalizeEmail = (value) => String(value || '').trim().toLowerCase();
const normalizeJoinCode = (value) => String(value || '').trim().toUpperCase().replace(/\s+/g, '');

const hashToken = (token) => crypto.createHash('sha256').update(String(token)).digest('hex');
const generateInviteToken = () => crypto.randomBytes(32).toString('base64url');

const expireOldInvites = async (householdId, client = db) => {
  await client.query(
    `UPDATE household_invites
     SET status = 'EXPIRED'
     WHERE household_id = $1
       AND status = 'PENDING'
       AND expires_at < NOW()`,
    [householdId]
  );
};

const moveUserToHousehold = async (targetHouseholdId, userId, client) => {
  const currentMembershipR = await client.query(
    'SELECT household_id, role FROM household_members WHERE user_id = $1 LIMIT 1',
    [userId]
  );

  const currentMembership = currentMembershipR.rows[0] || null;
  if (currentMembership && currentMembership.household_id === targetHouseholdId) {
    return;
  }

  if (currentMembership && currentMembership.household_id !== targetHouseholdId) {
    const { rows: countRows } = await client.query(
      'SELECT COUNT(*)::int AS count FROM household_members WHERE household_id = $1',
      [currentMembership.household_id]
    );
    const memberCount = countRows[0]?.count || 0;

    if (currentMembership.role === 'OWNER' && memberCount > 1) {
      throw Object.assign(new Error('Avval joriy guruh owner huquqini topshiring yoki azolarni chiqaring'), { statusCode: 400 });
    }

    await client.query(
      'DELETE FROM household_members WHERE household_id = $1 AND user_id = $2',
      [currentMembership.household_id, userId]
    );

    if (currentMembership.role === 'OWNER') {
      await client.query(
        'DELETE FROM households WHERE id = $1 AND owner_user_id = $2',
        [currentMembership.household_id, userId]
      );
    }
  }

  await client.query(
    `INSERT INTO household_members (household_id, user_id, role)
     VALUES ($1, $2, 'MEMBER')
     ON CONFLICT (household_id, user_id) DO UPDATE SET role = EXCLUDED.role`,
    [targetHouseholdId, userId]
  );
};

const getMyHousehold = async (req, res, next) => {
  try {
    const membership = await ensureUserHousehold(req.user.id);
    await expireOldInvites(membership.household_id);

    const [{ rows: householdRows }, { rows: memberRows }] = await Promise.all([
      db.query(
        `SELECT h.id, h.name, h.owner_user_id, h.join_code, h.created_at
         FROM households h
         WHERE h.id = $1
         LIMIT 1`,
        [membership.household_id]
      ),
      db.query(
        `SELECT m.user_id, u.name, u.email, m.role, m.joined_at
         FROM household_members m
         JOIN users u ON u.id = m.user_id
         WHERE m.household_id = $1
         ORDER BY CASE WHEN m.role = 'OWNER' THEN 0 ELSE 1 END, m.joined_at ASC`,
        [membership.household_id]
      ),
    ]);

    const household = householdRows[0];
    const isOwner = membership.role === 'OWNER';
    const joinCode = await ensureHouseholdJoinCode(membership.household_id);

    let invites = [];
    if (isOwner) {
      const { rows } = await db.query(
        `SELECT id, invited_email, status, expires_at, created_at
         FROM household_invites
         WHERE household_id = $1
           AND status = 'PENDING'
         ORDER BY created_at DESC
         LIMIT 30`,
        [membership.household_id]
      );
      invites = rows;
    }

    res.json({
      success: true,
      data: {
        household: {
          id: household.id,
          name: household.name,
          ownerUserId: household.owner_user_id,
          joinCode: isOwner ? joinCode : null,
          createdAt: household.created_at,
        },
        myRole: membership.role,
        isOwner,
        members: memberRows.map((row) => ({
          userId: row.user_id,
          name: row.name,
          email: row.email,
          role: row.role,
          joinedAt: row.joined_at,
        })),
        invites: invites.map((row) => ({
          id: row.id,
          email: row.invited_email,
          status: row.status,
          expiresAt: row.expires_at,
          createdAt: row.created_at,
        })),
      },
    });
  } catch (error) {
    next(error);
  }
};

const inviteByEmail = async (req, res, next) => {
  try {
    const targetEmail = normalizeEmail(req.body.email);
    if (!targetEmail || !targetEmail.includes('@')) {
      return res.status(400).json({ success: false, error: 'Email notogri' });
    }

    if (!isSmtpConfigured()) {
      return res.status(400).json({
        success: false,
        error: 'Email yuborish sozlanmagan. SMTP_USER va SMTP_PASS ni backend .env fayliga kiriting',
      });
    }

    const membership = await ensureUserHousehold(req.user.id);
    if (membership.role !== 'OWNER') {
      return res.status(403).json({ success: false, error: 'Faqat owner taklif yubora oladi' });
    }

    const [{ rows: memberRows }, { rows: householdRows }] = await Promise.all([
      db.query(
        `SELECT 1
         FROM household_members hm
         JOIN users u ON u.id = hm.user_id
         WHERE hm.household_id = $1
           AND LOWER(u.email) = $2
         LIMIT 1`,
        [membership.household_id, targetEmail]
      ),
      db.query(
        'SELECT id, name FROM households WHERE id = $1 LIMIT 1',
        [membership.household_id]
      ),
    ]);

    if (!householdRows.length) {
      return res.status(404).json({ success: false, error: 'Guruh topilmadi' });
    }

    if (memberRows.length > 0) {
      return res.status(409).json({ success: false, error: 'Bu email allaqachon guruhda bor' });
    }

    const token = generateInviteToken();
    const tokenHash = hashToken(token);
    const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000);

    await db.transaction(async (client) => {
      await client.query(
        `UPDATE household_invites
         SET status = 'REVOKED'
         WHERE household_id = $1
           AND invited_email = $2
           AND status = 'PENDING'`,
        [membership.household_id, targetEmail]
      );

      await client.query(
        `INSERT INTO household_invites (household_id, invited_email, invited_by_user_id, token_hash, status, expires_at)
         VALUES ($1, $2, $3, $4, 'PENDING', $5)`,
        [membership.household_id, targetEmail, req.user.id, tokenHash, expiresAt]
      );
    });

    const inviteLink = `${APP_BASE_URL}/?inviteToken=${encodeURIComponent(token)}`;

    try {
      await sendHouseholdInviteEmail({
        toEmail: targetEmail,
        inviterName: req.user.name || 'Owner',
        householdName: householdRows[0].name,
        inviteLink,
      });
    } catch (mailError) {
      const authCode = Number(mailError?.responseCode || 0);
      const isAuthError = mailError?.code === 'EAUTH' || authCode === 535 || authCode === 534 || authCode === 530;
      if (isAuthError) {
        return res.status(502).json({
          success: false,
          error: 'Gmail oddiy parolni qabul qilmaydi. Gmail App Password yarating va SMTP_PASS ga qoying',
        });
      }

      return res.status(502).json({
        success: false,
        error: 'Taklif emailga yuborilmadi. SMTP sozlamalarini tekshiring',
      });
    }

    res.status(201).json({
      success: true,
      data: {
        email: targetEmail,
        expiresAt,
      },
    });
  } catch (error) {
    next(error);
  }
};

const acceptInvite = async (req, res, next) => {
  try {
    const token = String(req.body.token || '').trim();
    if (!token) {
      return res.status(400).json({ success: false, error: 'Taklif tokeni kerak' });
    }

    const tokenHash = hashToken(token);
    const myEmail = normalizeEmail(req.user.email);

    const inviteResult = await db.query(
      `SELECT hi.id, hi.household_id, hi.invited_email, hi.status, hi.expires_at, h.name AS household_name
       FROM household_invites hi
       JOIN households h ON h.id = hi.household_id
       WHERE hi.token_hash = $1
       LIMIT 1`,
      [tokenHash]
    );

    if (!inviteResult.rows.length) {
      return res.status(404).json({ success: false, error: 'Taklif topilmadi yoki muddati tugagan' });
    }

    const invite = inviteResult.rows[0];
    if (invite.status !== 'PENDING' || new Date(invite.expires_at).getTime() < Date.now()) {
      return res.status(400).json({ success: false, error: 'Taklif muddati tugagan yoki bekor qilingan' });
    }

    if (normalizeEmail(invite.invited_email) !== myEmail) {
      return res.status(403).json({ success: false, error: 'Bu taklif boshqa email uchun yuborilgan' });
    }

    await db.transaction(async (client) => {
      await moveUserToHousehold(invite.household_id, req.user.id, client);

      await client.query(
        `UPDATE household_invites
         SET status = 'ACCEPTED', accepted_by_user_id = $1, accepted_at = NOW()
         WHERE id = $2`,
        [req.user.id, invite.id]
      );
    });

    res.json({
      success: true,
      data: {
        householdName: invite.household_name,
      },
    });
  } catch (error) {
    next(error);
  }
};

const joinByCode = async (req, res, next) => {
  try {
    const code = normalizeJoinCode(req.body.code);
    if (!code || code.length < 20) {
      return res.status(400).json({ success: false, error: 'Qoshilish kodi notogri' });
    }

    const householdResult = await db.query(
      `SELECT id, name
       FROM households
       WHERE UPPER(join_code) = $1
       LIMIT 1`,
      [code]
    );

    if (!householdResult.rows.length) {
      return res.status(404).json({ success: false, error: 'Qoshilish kodi topilmadi' });
    }

    const targetHousehold = householdResult.rows[0];

    await db.transaction(async (client) => {
      await moveUserToHousehold(targetHousehold.id, req.user.id, client);
    });

    res.json({
      success: true,
      data: {
        householdName: targetHousehold.name,
      },
    });
  } catch (error) {
    next(error);
  }
};

const regenerateJoinCode = async (req, res, next) => {
  try {
    const membership = await ensureUserHousehold(req.user.id);
    if (membership.role !== 'OWNER') {
      return res.status(403).json({ success: false, error: 'Faqat owner kodni yangilay oladi' });
    }

    const joinCode = await rotateHouseholdJoinCode(membership.household_id);

    res.json({
      success: true,
      data: { joinCode },
    });
  } catch (error) {
    next(error);
  }
};

const removeMember = async (req, res, next) => {
  try {
    const targetUserId = req.params.userId;
    if (!targetUserId) {
      return res.status(400).json({ success: false, error: 'Azo ID kerak' });
    }

    const membership = await ensureUserHousehold(req.user.id);
    if (membership.role !== 'OWNER') {
      return res.status(403).json({ success: false, error: 'Faqat owner azoni chiqarishi mumkin' });
    }

    if (targetUserId === req.user.id) {
      return res.status(400).json({ success: false, error: 'Owner ozini chiqara olmaydi' });
    }

    await db.transaction(async (client) => {
      const { rows } = await client.query(
        `SELECT hm.role
         FROM household_members hm
         WHERE hm.household_id = $1 AND hm.user_id = $2
         LIMIT 1`,
        [membership.household_id, targetUserId]
      );

      if (!rows.length) {
        throw Object.assign(new Error('Azo topilmadi'), { statusCode: 404 });
      }

      if (rows[0].role === 'OWNER') {
        throw Object.assign(new Error('Ownerni chiqarib bolmaydi'), { statusCode: 400 });
      }

      await client.query(
        'DELETE FROM household_members WHERE household_id = $1 AND user_id = $2',
        [membership.household_id, targetUserId]
      );

      await ensureUserHousehold(targetUserId, client);
    });

    res.json({ success: true, message: 'Azo guruhdan chiqarildi' });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getMyHousehold,
  inviteByEmail,
  acceptInvite,
  joinByCode,
  regenerateJoinCode,
  removeMember,
};
