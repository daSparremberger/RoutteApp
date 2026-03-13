CREATE SCHEMA IF NOT EXISTS app;

CREATE TABLE IF NOT EXISTS app.pessoas (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL,
  firebase_uid TEXT UNIQUE,
  tipo TEXT NOT NULL CHECK(tipo IN ('aluno', 'motorista', 'responsavel', 'operador', 'gestor')),
  nome TEXT NOT NULL,
  email TEXT,
  telefone TEXT,
  documento TEXT,
  endereco TEXT,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  foto_url TEXT,
  ativo BOOLEAN DEFAULT true,
  criado_em TIMESTAMPTZ DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_app_pessoas_tenant
  ON app.pessoas(tenant_id);

CREATE INDEX IF NOT EXISTS idx_app_pessoas_tipo
  ON app.pessoas(tenant_id, tipo);

CREATE INDEX IF NOT EXISTS idx_app_pessoas_firebase
  ON app.pessoas(firebase_uid);

CREATE TABLE IF NOT EXISTS app.pontos_servico (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL,
  tipo TEXT NOT NULL CHECK(tipo IN ('escola', 'deposito', 'cliente', 'ponto_coleta')),
  nome TEXT NOT NULL,
  endereco TEXT NOT NULL,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  criado_em TIMESTAMPTZ DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_app_pontos_servico_tenant
  ON app.pontos_servico(tenant_id);

CREATE INDEX IF NOT EXISTS idx_app_pontos_servico_tipo
  ON app.pontos_servico(tenant_id, tipo);

CREATE TABLE IF NOT EXISTS app.aluno_profiles (
  id SERIAL PRIMARY KEY,
  pessoa_id INTEGER UNIQUE NOT NULL REFERENCES app.pessoas(id) ON DELETE CASCADE,
  escola_id INTEGER REFERENCES app.pontos_servico(id) ON DELETE SET NULL,
  turno TEXT CHECK(turno IN ('manha', 'tarde', 'noite')),
  cpf_responsavel TEXT,
  telefone_responsavel TEXT,
  responsavel_id INTEGER REFERENCES app.pessoas(id) ON DELETE SET NULL,
  serie TEXT,
  necessidades_especiais TEXT,
  criado_em TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_app_aluno_profiles_pessoa
  ON app.aluno_profiles(pessoa_id);

CREATE INDEX IF NOT EXISTS idx_app_aluno_profiles_escola
  ON app.aluno_profiles(escola_id);

CREATE TABLE IF NOT EXISTS app.motorista_profiles (
  id SERIAL PRIMARY KEY,
  pessoa_id INTEGER UNIQUE NOT NULL REFERENCES app.pessoas(id) ON DELETE CASCADE,
  cnh TEXT,
  categoria_cnh TEXT,
  validade_cnh DATE,
  pin_hash TEXT,
  documento_url TEXT,
  convite_token TEXT UNIQUE,
  convite_expira_em TIMESTAMPTZ,
  cadastro_completo BOOLEAN DEFAULT false,
  criado_em TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_app_motorista_profiles_pessoa
  ON app.motorista_profiles(pessoa_id);

CREATE INDEX IF NOT EXISTS idx_app_motorista_profiles_convite
  ON app.motorista_profiles(convite_token);

CREATE TABLE IF NOT EXISTS app.escola_profiles (
  id SERIAL PRIMARY KEY,
  ponto_servico_id INTEGER UNIQUE NOT NULL REFERENCES app.pontos_servico(id) ON DELETE CASCADE,
  turno_manha BOOLEAN DEFAULT false,
  turno_tarde BOOLEAN DEFAULT false,
  turno_noite BOOLEAN DEFAULT false,
  horario_entrada_manha TEXT,
  horario_saida_manha TEXT,
  horario_entrada_tarde TEXT,
  horario_saida_tarde TEXT,
  horario_entrada_noite TEXT,
  horario_saida_noite TEXT,
  criado_em TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_app_escola_profiles_ponto
  ON app.escola_profiles(ponto_servico_id);

CREATE TABLE IF NOT EXISTS app.veiculos (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL,
  placa TEXT NOT NULL,
  modelo TEXT,
  fabricante TEXT,
  ano INTEGER,
  capacidade INTEGER,
  ativo BOOLEAN DEFAULT true,
  criado_em TIMESTAMPTZ DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, placa)
);

CREATE INDEX IF NOT EXISTS idx_app_veiculos_tenant
  ON app.veiculos(tenant_id);

CREATE TABLE IF NOT EXISTS app.rotas (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL,
  motorista_id INTEGER REFERENCES app.pessoas(id) ON DELETE SET NULL,
  veiculo_id INTEGER REFERENCES app.veiculos(id) ON DELETE SET NULL,
  nome TEXT NOT NULL,
  turno TEXT CHECK(turno IN ('manha', 'tarde', 'noite')),
  rota_geojson JSONB,
  ativo BOOLEAN DEFAULT true,
  criado_em TIMESTAMPTZ DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_app_rotas_tenant
  ON app.rotas(tenant_id);

CREATE INDEX IF NOT EXISTS idx_app_rotas_motorista
  ON app.rotas(motorista_id);

CREATE INDEX IF NOT EXISTS idx_app_rotas_veiculo
  ON app.rotas(veiculo_id);

CREATE TABLE IF NOT EXISTS app.rota_paradas (
  id SERIAL PRIMARY KEY,
  rota_id INTEGER NOT NULL REFERENCES app.rotas(id) ON DELETE CASCADE,
  pessoa_id INTEGER NOT NULL REFERENCES app.pessoas(id) ON DELETE CASCADE,
  ordem INTEGER NOT NULL,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  UNIQUE(rota_id, ordem)
);

CREATE INDEX IF NOT EXISTS idx_app_rota_paradas_rota
  ON app.rota_paradas(rota_id);

CREATE TABLE IF NOT EXISTS app.tablet_vinculos (
  id SERIAL PRIMARY KEY,
  veiculo_id INTEGER NOT NULL REFERENCES app.veiculos(id) ON DELETE CASCADE,
  motorista_id INTEGER NOT NULL REFERENCES app.pessoas(id) ON DELETE CASCADE,
  device_id TEXT NOT NULL,
  vinculado_em TIMESTAMPTZ DEFAULT NOW(),
  desvinculado_em TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_app_tablet_vinculos_device
  ON app.tablet_vinculos(device_id);

CREATE INDEX IF NOT EXISTS idx_app_tablet_vinculos_veiculo_ativo
  ON app.tablet_vinculos(veiculo_id, desvinculado_em);

CREATE TABLE IF NOT EXISTS app.veiculo_motorista (
  id SERIAL PRIMARY KEY,
  veiculo_id INTEGER NOT NULL REFERENCES app.veiculos(id) ON DELETE CASCADE,
  motorista_id INTEGER NOT NULL REFERENCES app.pessoas(id) ON DELETE CASCADE,
  vinculado_em TIMESTAMPTZ DEFAULT NOW(),
  desvinculado_em TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS veiculo_motorista_active_unique
  ON app.veiculo_motorista (veiculo_id, motorista_id)
  WHERE desvinculado_em IS NULL;

CREATE TABLE IF NOT EXISTS app.execucoes (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL,
  rota_id INTEGER REFERENCES app.rotas(id) ON DELETE SET NULL,
  motorista_id INTEGER REFERENCES app.pessoas(id) ON DELETE SET NULL,
  veiculo_id INTEGER REFERENCES app.veiculos(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'em_andamento' CHECK(status IN ('em_andamento', 'concluida', 'cancelada')),
  iniciada_em TIMESTAMPTZ DEFAULT NOW(),
  concluida_em TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_app_execucoes_tenant_status
  ON app.execucoes(tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_app_execucoes_motorista
  ON app.execucoes(motorista_id);

CREATE TABLE IF NOT EXISTS app.execucao_paradas (
  id SERIAL PRIMARY KEY,
  execucao_id INTEGER NOT NULL REFERENCES app.execucoes(id) ON DELETE CASCADE,
  pessoa_id INTEGER REFERENCES app.pessoas(id) ON DELETE SET NULL,
  status TEXT CHECK(status IN ('embarcou', 'pulou')),
  horario TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_app_execucao_paradas_execucao
  ON app.execucao_paradas(execucao_id);

CREATE TABLE IF NOT EXISTS app.historico (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL,
  execucao_id INTEGER REFERENCES app.execucoes(id) ON DELETE SET NULL,
  rota_id INTEGER,
  rota_nome TEXT,
  motorista_id INTEGER,
  motorista_nome TEXT,
  veiculo_id INTEGER,
  veiculo_placa TEXT,
  km_total DOUBLE PRECISION,
  alunos_embarcados INTEGER DEFAULT 0,
  alunos_pulados INTEGER DEFAULT 0,
  data_execucao DATE NOT NULL,
  iniciada_em TIMESTAMPTZ,
  concluida_em TIMESTAMPTZ,
  criado_em TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_app_historico_tenant_data
  ON app.historico(tenant_id, data_execucao);

CREATE INDEX IF NOT EXISTS idx_app_historico_motorista
  ON app.historico(motorista_id);

CREATE INDEX IF NOT EXISTS idx_app_historico_rota
  ON app.historico(rota_id);

CREATE TABLE IF NOT EXISTS app.mensagens (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL,
  remetente_id INTEGER NOT NULL REFERENCES app.pessoas(id),
  remetente_tipo TEXT NOT NULL CHECK(remetente_tipo IN ('gestor', 'motorista')),
  destinatario_id INTEGER NOT NULL REFERENCES app.pessoas(id),
  destinatario_tipo TEXT NOT NULL CHECK(destinatario_tipo IN ('gestor', 'motorista')),
  conteudo TEXT NOT NULL,
  lido BOOLEAN DEFAULT false,
  criado_em TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_app_mensagens_destinatario
  ON app.mensagens(tenant_id, destinatario_id, lido);

CREATE TABLE IF NOT EXISTS app.cobrancas (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL,
  pessoa_id INTEGER REFERENCES app.pessoas(id) ON DELETE SET NULL,
  mes_referencia DATE NOT NULL,
  valor NUMERIC(10, 2) NOT NULL,
  status TEXT DEFAULT 'pendente' CHECK(status IN ('pendente', 'pago', 'cancelado')),
  criado_em TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS app.outbox_events (
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

CREATE TABLE IF NOT EXISTS app.inbox_events (
  event_id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'received'
);
