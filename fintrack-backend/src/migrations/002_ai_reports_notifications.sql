CREATE TABLE IF NOT EXISTS user_ai_settings (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  report_period VARCHAR(10) NOT NULL DEFAULT 'daily' CHECK (report_period IN ('daily', 'weekly', 'monthly', 'yearly')),
  delivery_time VARCHAR(5) NOT NULL DEFAULT '21:00',
  timezone VARCHAR(64) NOT NULL DEFAULT 'Asia/Tashkent',
  language VARCHAR(5) NOT NULL DEFAULT 'uz' CHECK (language IN ('uz', 'en', 'ru')),
  model VARCHAR(120) NOT NULL DEFAULT 'openai/gpt-4o-mini',
  last_sent_period_key VARCHAR(32),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(32) NOT NULL DEFAULT 'AI_REPORT',
  title VARCHAR(200) NOT NULL,
  message TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  period_key VARCHAR(32),
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  read_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_user_notifications_user_id_created_at
  ON user_notifications(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_notifications_user_id_is_read
  ON user_notifications(user_id, is_read);

CREATE UNIQUE INDEX IF NOT EXISTS ux_user_notifications_period
  ON user_notifications(user_id, type, period_key)
  WHERE period_key IS NOT NULL;
