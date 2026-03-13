-- 002_commercial_schema.sql

CREATE TABLE IF NOT EXISTS management.organizations (
  id                  SERIAL PRIMARY KEY,
  tenant_id           INTEGER UNIQUE NOT NULL REFERENCES management.tenants(id) ON DELETE RESTRICT,
  razao_social        TEXT NOT NULL,
  cnpj                TEXT,
  email_financeiro    TEXT,
  telefone_financeiro TEXT,
  endereco_cobranca   TEXT,
  ativo               BOOLEAN DEFAULT true,
  criado_em           TIMESTAMPTZ DEFAULT NOW(),
  atualizado_em       TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS management.contracts (
  id                SERIAL PRIMARY KEY,
  organization_id   INTEGER NOT NULL REFERENCES management.organizations(id) ON DELETE RESTRICT,
  valor_mensal      NUMERIC(10,2) NOT NULL,
  modulos_incluidos TEXT[] NOT NULL,
  max_veiculos      INTEGER NOT NULL,
  max_motoristas    INTEGER NOT NULL,
  max_gestores      INTEGER NOT NULL,
  data_inicio       DATE NOT NULL,
  data_fim          DATE,
  status            TEXT NOT NULL DEFAULT 'ativo' CHECK(status IN ('ativo','encerrado','suspenso')),
  observacoes       TEXT,
  criado_em         TIMESTAMPTZ DEFAULT NOW(),
  atualizado_em     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contracts_organization ON management.contracts(organization_id);
CREATE INDEX IF NOT EXISTS idx_contracts_status ON management.contracts(status);

CREATE UNIQUE INDEX IF NOT EXISTS contracts_active_unique
  ON management.contracts (organization_id)
  WHERE status = 'ativo';

CREATE TABLE IF NOT EXISTS management.invoices (
  id              SERIAL PRIMARY KEY,
  contract_id     INTEGER NOT NULL REFERENCES management.contracts(id) ON DELETE RESTRICT,
  mes_referencia  DATE NOT NULL,
  valor           NUMERIC(10,2) NOT NULL,
  status          TEXT NOT NULL DEFAULT 'pendente' CHECK(status IN ('pendente','pago','cancelado')),
  pago_em         TIMESTAMPTZ,
  observacoes     TEXT,
  criado_em       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invoices_contract ON management.invoices(contract_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON management.invoices(status);
CREATE UNIQUE INDEX IF NOT EXISTS invoices_contract_mes_unique
  ON management.invoices (contract_id, mes_referencia);
