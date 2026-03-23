ALTER TABLE households
  ADD COLUMN IF NOT EXISTS join_code VARCHAR(80);

UPDATE households
SET join_code = 'FT-' || REPLACE(id::text, '-', '') || SUBSTRING(MD5(id::text || created_at::text), 1, 8)
WHERE join_code IS NULL;

ALTER TABLE households
  ALTER COLUMN join_code SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_households_join_code
  ON households(join_code);
