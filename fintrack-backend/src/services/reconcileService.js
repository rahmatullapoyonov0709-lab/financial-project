const db = require('../config/db');

const toNumberMap = (rows, keyField, valueField) => {
  const map = new Map();
  rows.forEach((row) => {
    map.set(row[keyField], Number.parseFloat(row[valueField] || 0));
  });
  return map;
};

const reconcileBalances = async (userId, { fix = false } = {}) => {
  return db.transaction(async (client) => {
    const accountsR = await client.query(
      'SELECT id, name, currency, balance, initial_balance FROM accounts WHERE user_id = $1 ORDER BY created_at',
      [userId]
    );

    if (!accountsR.rows.length) {
      return { checked: 0, mismatches: [], fixed: 0 };
    }

    const txR = await client.query(
      `SELECT account_id, COALESCE(SUM(CASE WHEN type = 'INCOME' THEN amount ELSE -amount END), 0) AS net
       FROM transactions
       WHERE user_id = $1
       GROUP BY account_id`,
      [userId]
    );

    const outgoingR = await client.query(
      `SELECT from_account_id AS account_id, COALESCE(SUM(from_amount), 0) AS total
       FROM transfers
       WHERE user_id = $1
       GROUP BY from_account_id`,
      [userId]
    );

    const incomingR = await client.query(
      `SELECT to_account_id AS account_id, COALESCE(SUM(to_amount), 0) AS total
       FROM transfers
       WHERE user_id = $1
       GROUP BY to_account_id`,
      [userId]
    );

    const txNet = toNumberMap(txR.rows, 'account_id', 'net');
    const outgoing = toNumberMap(outgoingR.rows, 'account_id', 'total');
    const incoming = toNumberMap(incomingR.rows, 'account_id', 'total');

    const mismatches = [];
    let fixed = 0;

    for (const account of accountsR.rows) {
      const expected =
        Number.parseFloat(account.initial_balance || 0) +
        (txNet.get(account.id) || 0) -
        (outgoing.get(account.id) || 0) +
        (incoming.get(account.id) || 0);

      const current = Number.parseFloat(account.balance || 0);
      const diff = current - expected;
      const diffRounded = Math.round(diff * 100) / 100;

      if (Math.abs(diffRounded) >= 0.01) {
        mismatches.push({
          accountId: account.id,
          accountName: account.name,
          currency: account.currency,
          currentBalance: current,
          expectedBalance: expected,
          difference: diffRounded,
        });

        if (fix) {
          await client.query(
            'UPDATE accounts SET balance = $1 WHERE id = $2 AND user_id = $3',
            [expected, account.id, userId]
          );
          fixed += 1;
        }
      }
    }

    return {
      checked: accountsR.rows.length,
      mismatches,
      fixed,
    };
  });
};

module.exports = { reconcileBalances };
