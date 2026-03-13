CREATE SCHEMA IF NOT EXISTS management;

CREATE TABLE IF NOT EXISTS management.tenants (
  id SERIAL PRIMARY KEY,
  nome TEXT NOT NULL,
  cidade TEXT NOT NULL,
  estado TEXT NOT NULL,
  cnpj TEXT,
  email_contato TEXT,
  ativo BOOLEAN DEFAULT true,
  criado_em TIMESTAMPTZ DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS management.licenses (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES management.tenants(id) ON DELETE CASCADE,
  max_veiculos INTEGER NOT NULL DEFAULT 10,
  max_motoristas INTEGER NOT NULL DEFAULT 10,
  max_gestores INTEGER NOT NULL DEFAULT 3,
  data_inicio DATE NOT NULL,
  data_fim DATE,
  ativo BOOLEAN DEFAULT true,
  criado_em TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS management.modules (
  id SERIAL PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  nome TEXT NOT NULL,
  descricao TEXT,
  tipo TEXT NOT NULL DEFAULT 'cadastro',
  ativo BOOLEAN DEFAULT true,
  criado_em TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS management.module_dependencies (
  id SERIAL PRIMARY KEY,
  module_id INTEGER NOT NULL REFERENCES management.modules(id) ON DELETE CASCADE,
  depends_on_module_id INTEGER NOT NULL REFERENCES management.modules(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL DEFAULT 'required',
  grupo TEXT,
  UNIQUE(module_id, depends_on_module_id)
);

CREATE TABLE IF NOT EXISTS management.tenant_modules (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES management.tenants(id) ON DELETE CASCADE,
  module_id INTEGER NOT NULL REFERENCES management.modules(id) ON DELETE CASCADE,
  habilitado BOOLEAN DEFAULT true,
  habilitado_em TIMESTAMPTZ DEFAULT NOW(),
  desabilitado_em TIMESTAMPTZ,
  UNIQUE(tenant_id, module_id)
);

CREATE TABLE IF NOT EXISTS management.gestor_invites (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES management.tenants(id) ON DELETE CASCADE,
  token TEXT UNIQUE NOT NULL,
  email TEXT,
  usado BOOLEAN DEFAULT false,
  expira_em TIMESTAMPTZ,
  criado_em TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS management.audit_logs (
  id BIGSERIAL PRIMARY KEY,
  tenant_id INTEGER REFERENCES management.tenants(id) ON DELETE SET NULL,
  user_firebase_uid TEXT,
  user_role TEXT,
  action TEXT NOT NULL,
  endpoint TEXT,
  method TEXT,
  status_code INTEGER,
  ip TEXT,
  device_id TEXT,
  user_agent TEXT,
  criado_em TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS management.tenant_metrics (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES management.tenants(id) ON DELETE CASCADE,
  data DATE NOT NULL,
  total_logins INTEGER DEFAULT 0,
  unique_devices INTEGER DEFAULT 0,
  total_requests INTEGER DEFAULT 0,
  veiculos_ativos INTEGER DEFAULT 0,
  motoristas_ativos INTEGER DEFAULT 0,
  execucoes_iniciadas INTEGER DEFAULT 0,
  execucoes_concluidas INTEGER DEFAULT 0,
  criado_em TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, data)
);

CREATE TABLE IF NOT EXISTS management.anomaly_alerts (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES management.tenants(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL,
  descricao TEXT NOT NULL,
  severidade TEXT NOT NULL CHECK(severidade IN ('info', 'warning', 'critical')),
  dados JSONB,
  resolvido BOOLEAN DEFAULT false,
  resolvido_em TIMESTAMPTZ,
  nota_resolucao TEXT,
  criado_em TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS anomaly_alerts_open_unique
  ON management.anomaly_alerts (tenant_id, tipo)
  WHERE resolvido = false;

CREATE TABLE IF NOT EXISTS management.outbox_events (
  id BIGSERIAL PRIMARY KEY,
  event_id TEXT UNIQUE NOT NULL,
  event_type TEXT NOT NULL,
  event_version INTEGER NOT NULL DEFAULT 1,
  aggregate_type TEXT NOT NULL,
  aggregate_id TEXT NOT NULL,
  tenant_id INTEGER,
  payload JSONB NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  published_at TIMESTAMPTZ,
  publish_attempts INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS management.inbox_events (
  event_id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'received'
);

CREATE INDEX IF NOT EXISTS idx_management_licenses_tenant
  ON management.licenses(tenant_id);

CREATE INDEX IF NOT EXISTS idx_management_tenant_modules_tenant
  ON management.tenant_modules(tenant_id);

CREATE INDEX IF NOT EXISTS idx_management_audit_tenant_time
  ON management.audit_logs(tenant_id, criado_em);

CREATE INDEX IF NOT EXISTS idx_management_audit_device
  ON management.audit_logs(device_id);

CREATE INDEX IF NOT EXISTS idx_management_audit_action_time
  ON management.audit_logs(tenant_id, action, criado_em);

CREATE INDEX IF NOT EXISTS idx_management_anomaly_tenant_open
  ON management.anomaly_alerts(tenant_id, resolvido);

INSERT INTO management.modules (slug, nome, descricao, tipo) VALUES
  ('motoristas', 'Motoristas', 'Cadastro e gestao de motoristas', 'cadastro'),
  ('alunos', 'Alunos', 'Cadastro e gestao de alunos', 'cadastro'),
  ('escolas', 'Escolas', 'Cadastro e gestao de escolas', 'cadastro'),
  ('veiculos', 'Veiculos', 'Cadastro e gestao de frota', 'cadastro'),
  ('rotas', 'Rotas', 'Criacao e gestao de rotas', 'operacional'),
  ('execucao', 'Execucao', 'Iniciar, finalizar e registrar execucoes de rota', 'operacional'),
  ('rastreamento', 'Rastreamento', 'Tracking em tempo real de motoristas', 'operacional'),
  ('mensagens', 'Mensagens', 'Chat entre gestor e motorista', 'suporte'),
  ('financeiro', 'Financeiro', 'Cobrancas e controle financeiro', 'suporte'),
  ('historico', 'Historico', 'Relatorios e snapshots de execucao', 'suporte')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO management.module_dependencies (module_id, depends_on_module_id, tipo)
SELECT m1.id, m2.id, 'required'
FROM management.modules m1, management.modules m2
WHERE m1.slug = 'rotas' AND m2.slug = 'motoristas'
ON CONFLICT (module_id, depends_on_module_id) DO NOTHING;

INSERT INTO management.module_dependencies (module_id, depends_on_module_id, tipo)
SELECT m1.id, m2.id, 'required'
FROM management.modules m1, management.modules m2
WHERE m1.slug = 'rotas' AND m2.slug = 'veiculos'
ON CONFLICT (module_id, depends_on_module_id) DO NOTHING;

INSERT INTO management.module_dependencies (module_id, depends_on_module_id, tipo, grupo)
SELECT m1.id, m2.id, 'one_of_group', 'passageiro'
FROM management.modules m1, management.modules m2
WHERE m1.slug = 'rotas' AND m2.slug = 'alunos'
ON CONFLICT (module_id, depends_on_module_id) DO NOTHING;

INSERT INTO management.module_dependencies (module_id, depends_on_module_id, tipo)
SELECT m1.id, m2.id, 'required'
FROM management.modules m1, management.modules m2
WHERE m1.slug = 'alunos' AND m2.slug = 'escolas'
ON CONFLICT (module_id, depends_on_module_id) DO NOTHING;

INSERT INTO management.module_dependencies (module_id, depends_on_module_id, tipo)
SELECT m1.id, m2.id, 'required'
FROM management.modules m1, management.modules m2
WHERE m1.slug = 'execucao' AND m2.slug = 'rotas'
ON CONFLICT (module_id, depends_on_module_id) DO NOTHING;

INSERT INTO management.module_dependencies (module_id, depends_on_module_id, tipo)
SELECT m1.id, m2.id, 'required'
FROM management.modules m1, management.modules m2
WHERE m1.slug = 'rastreamento' AND m2.slug = 'motoristas'
ON CONFLICT (module_id, depends_on_module_id) DO NOTHING;

INSERT INTO management.module_dependencies (module_id, depends_on_module_id, tipo)
SELECT m1.id, m2.id, 'required'
FROM management.modules m1, management.modules m2
WHERE m1.slug = 'rastreamento' AND m2.slug = 'veiculos'
ON CONFLICT (module_id, depends_on_module_id) DO NOTHING;

INSERT INTO management.module_dependencies (module_id, depends_on_module_id, tipo)
SELECT m1.id, m2.id, 'required'
FROM management.modules m1, management.modules m2
WHERE m1.slug = 'mensagens' AND m2.slug = 'motoristas'
ON CONFLICT (module_id, depends_on_module_id) DO NOTHING;

INSERT INTO management.module_dependencies (module_id, depends_on_module_id, tipo)
SELECT m1.id, m2.id, 'required'
FROM management.modules m1, management.modules m2
WHERE m1.slug = 'historico' AND m2.slug = 'execucao'
ON CONFLICT (module_id, depends_on_module_id) DO NOTHING;
