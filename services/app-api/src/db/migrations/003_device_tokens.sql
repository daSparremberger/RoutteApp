CREATE TABLE IF NOT EXISTS app.device_tokens (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL,
  pessoa_id INTEGER NOT NULL REFERENCES app.pessoas(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  platform TEXT NOT NULL DEFAULT 'web' CHECK (platform IN ('web', 'android', 'ios')),
  criado_em TIMESTAMPTZ DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_device_tokens_unique
  ON app.device_tokens (pessoa_id, token);

CREATE INDEX IF NOT EXISTS idx_device_tokens_tenant
  ON app.device_tokens (tenant_id);
