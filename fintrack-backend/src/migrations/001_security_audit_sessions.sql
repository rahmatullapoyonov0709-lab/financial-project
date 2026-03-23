ALTER TABLE accounts
  ADD COLUMN IF NOT EXISTS initial_balance DECIMAL(18,2);

UPDATE accounts
SET initial_balance = balance
WHERE initial_balance IS NULL;

ALTER TABLE accounts
  ALTER COLUMN initial_balance SET DEFAULT 0,
  ALTER COLUMN initial_balance SET NOT NULL;

ALTER TABLE accounts
  DROP CONSTRAINT IF EXISTS accounts_initial_balance_check;

ALTER TABLE accounts
  ADD CONSTRAINT accounts_initial_balance_check CHECK (initial_balance >= 0);

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

CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires_at ON user_sessions(expires_at);

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

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_created_at ON audit_logs(entity, created_at DESC);

