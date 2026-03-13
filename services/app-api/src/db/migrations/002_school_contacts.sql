CREATE TABLE IF NOT EXISTS app.escola_contatos (
  id SERIAL PRIMARY KEY,
  escola_id INTEGER NOT NULL REFERENCES app.pontos_servico(id) ON DELETE CASCADE,
  cargo TEXT,
  nome TEXT NOT NULL,
  telefone TEXT,
  email TEXT,
  criado_em TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_app_escola_contatos_escola
  ON app.escola_contatos(escola_id);
