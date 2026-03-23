const db = require('../config/db');
const { logAudit } = require('../services/auditService');
const { resolveScopeUserId } = require('../services/householdScopeService');

const getCategories = async (req, res, next) => {
  try {
    const scopeUserId = await resolveScopeUserId(req.user.id);
    const { type } = req.query;
    const params = [scopeUserId];
    let tf = '';

    if (type) {
      tf = ' AND type = $2';
      params.push(type);
    }

    const { rows } = await db.query(
      'SELECT * FROM categories WHERE (user_id IS NULL OR user_id = $1)' + tf + ' ORDER BY is_system DESC, name',
      params
    );

    res.json({ success: true, data: { categories: rows, count: rows.length } });
  } catch (error) {
    next(error);
  }
};

const createCategory = async (req, res, next) => {
  try {
    const scopeUserId = await resolveScopeUserId(req.user.id);
    const { name, type, icon, color } = req.body;

    const { rows } = await db.query(
      'INSERT INTO categories (user_id, name, type, icon, color, is_system) VALUES ($1, $2, $3, $4, $5, FALSE) RETURNING *',
      [scopeUserId, name.trim(), type, icon || '??', color || '#607D8B']
    );

    await logAudit({
      req,
      userId: req.user.id,
      action: 'CATEGORY_CREATE',
      entity: 'category',
      entityId: rows[0].id,
      metadata: { type: rows[0].type, name: rows[0].name },
    });

    res.status(201).json({ success: true, data: rows[0] });
  } catch (error) {
    next(error);
  }
};

module.exports = { getCategories, createCategory };
