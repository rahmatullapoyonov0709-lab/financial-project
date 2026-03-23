-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(100) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Accounts
CREATE TABLE IF NOT EXISTS accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  type VARCHAR(20) NOT NULL CHECK (type IN ('CASH', 'BANK_CARD', 'SAVINGS')),
  currency VARCHAR(10) DEFAULT 'UZS',
  balance DECIMAL(18,2) DEFAULT 0,
  initial_balance DECIMAL(18,2) NOT NULL DEFAULT 0 CHECK (initial_balance >= 0),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Categories
CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  type VARCHAR(10) NOT NULL CHECK (type IN ('INCOME', 'EXPENSE')),
  icon VARCHAR(10) DEFAULT '📌',
  color VARCHAR(20) DEFAULT '#607D8B',
  is_system BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Transactions
CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES categories(id),
  type VARCHAR(10) NOT NULL CHECK (type IN ('INCOME', 'EXPENSE')),
  amount DECIMAL(18,2) NOT NULL CHECK (amount > 0),
  description TEXT,
  date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Transfers
CREATE TABLE IF NOT EXISTS transfers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  from_account_id UUID NOT NULL REFERENCES accounts(id),
  to_account_id UUID NOT NULL REFERENCES accounts(id),
  from_amount DECIMAL(18,2) NOT NULL CHECK (from_amount > 0),
  to_amount DECIMAL(18,2) NOT NULL CHECK (to_amount > 0),
  exchange_rate DECIMAL(18,6) DEFAULT 1 CHECK (exchange_rate > 0),
  date DATE DEFAULT CURRENT_DATE,
  note TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Debts
CREATE TABLE IF NOT EXISTS debts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  person_name VARCHAR(100) NOT NULL,
  type VARCHAR(10) NOT NULL CHECK (type IN ('LENT', 'BORROWED')),
  amount DECIMAL(18,2) NOT NULL CHECK (amount > 0),
  currency VARCHAR(10) DEFAULT 'UZS',
  description TEXT,
  due_date DATE,
  status VARCHAR(10) DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'CLOSED')),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Budgets
CREATE TABLE IF NOT EXISTS budgets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES categories(id),
  month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
  year INTEGER NOT NULL,
  limit_amount DECIMAL(18,2) NOT NULL CHECK (limit_amount > 0),
  type VARCHAR(10) DEFAULT 'EXPENSE' CHECK (type IN ('INCOME', 'EXPENSE')),
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, category_id, month, year)
);

-- Refresh sessions
CREATE TABLE IF NOT EXISTS user_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  refresh_token_hash VARCHAR(128) NOT NULL UNIQUE,
  user_agent VARCHAR(255),
  ip_address VARCHAR(64),
  expires_at TIMESTAMP NOT NULL,
  revoked_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMP
);

-- Audit logs
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(64) NOT NULL,
  entity VARCHAR(64) NOT NULL,
  entity_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  ip_address VARCHAR(64),
  user_agent VARCHAR(255),
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'transfers_accounts_not_same'
  ) THEN
    ALTER TABLE transfers
      ADD CONSTRAINT transfers_accounts_not_same
      CHECK (from_account_id <> to_account_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_accounts_user_id ON accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_categories_user_type ON categories(user_id, type);
CREATE INDEX IF NOT EXISTS idx_transactions_user_date ON transactions(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_user_account ON transactions(user_id, account_id);
CREATE INDEX IF NOT EXISTS idx_transfers_user_date ON transfers(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_debts_user_status_due ON debts(user_id, status, due_date);
CREATE INDEX IF NOT EXISTS idx_budgets_user_period ON budgets(user_id, year, month);
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires_at ON user_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_created_at ON audit_logs(entity, created_at DESC);

-- Default system categories
INSERT INTO categories (name, type, icon, color, is_system) VALUES
  ('Oziq-ovqat', 'EXPENSE', '🛒', '#FF6B35', TRUE),
  ('Transport', 'EXPENSE', '🚕', '#004E89', TRUE),
  ('Kommunal', 'EXPENSE', '⚡', '#FB5607', TRUE),
  ('Soglik', 'EXPENSE', '💊', '#06D6A0', TRUE),
  ('Kiyim', 'EXPENSE', '👗', '#E91E63', TRUE),
  ('Restoran', 'EXPENSE', '🍔', '#FF5722', TRUE),
  ('Kengil ochar', 'EXPENSE', '🎬', '#9C27B0', TRUE),
  ('Talim', 'EXPENSE', '📚', '#118AB2', TRUE),
  ('Aloqa', 'EXPENSE', '📱', '#607D8B', TRUE),
  ('Sayohat', 'EXPENSE', '✈', '#00BCD4', TRUE),
  ('Boshqa', 'EXPENSE', '📦', '#9E9E9E', TRUE),
  ('Ish haqi', 'INCOME', '💼', '#4CAF50', TRUE),
  ('Frilanserlik', 'INCOME', '💻', '#2196F3', TRUE),
  ('Investitsiya', 'INCOME', '📈', '#00C853', TRUE),
  ('Boshqa daromad', 'INCOME', '💵', '#78909C', TRUE)
ON CONFLICT DO NOTHING;
