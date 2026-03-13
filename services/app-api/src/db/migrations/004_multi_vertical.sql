ALTER TABLE app.pessoas DROP CONSTRAINT IF EXISTS pessoas_tipo_check;

ALTER TABLE app.pessoas
  ADD CONSTRAINT pessoas_tipo_check CHECK (
    tipo IN (
      'aluno',
      'motorista',
      'responsavel',
      'operador',
      'gestor',
      'cliente_entrega',
      'passageiro_corp'
    )
  );

INSERT INTO management.modules (slug, nome, descricao, tipo, ativo) VALUES
  ('entregas', 'Entregas', 'Gerenciamento de clientes e entregas', 'cadastro', true),
  ('passageiros_corporativos', 'Passageiros Corporativos', 'Gerenciamento de passageiros corporativos', 'cadastro', true)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO management.module_dependencies (module_id, depends_on_module_id, tipo, grupo)
SELECT rotas.id, vertical.id, 'one_of_group', 'passageiro'
FROM management.modules rotas
JOIN management.modules vertical ON vertical.slug IN ('entregas', 'passageiros_corporativos')
WHERE rotas.slug = 'rotas'
ON CONFLICT (module_id, depends_on_module_id) DO NOTHING;

CREATE TABLE IF NOT EXISTS app.entrega_profiles (
  id SERIAL PRIMARY KEY,
  pessoa_id INTEGER NOT NULL REFERENCES app.pessoas(id) ON DELETE CASCADE,
  empresa TEXT,
  tipo_carga TEXT,
  peso_max_kg NUMERIC(10, 2),
  instrucoes TEXT,
  contato_recebedor TEXT,
  criado_em TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_entrega_profiles_pessoa
  ON app.entrega_profiles (pessoa_id);

CREATE TABLE IF NOT EXISTS app.passageiro_corp_profiles (
  id SERIAL PRIMARY KEY,
  pessoa_id INTEGER NOT NULL REFERENCES app.pessoas(id) ON DELETE CASCADE,
  empresa TEXT,
  cargo TEXT,
  centro_custo TEXT,
  horario_entrada TEXT,
  horario_saida TEXT,
  criado_em TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_passageiro_corp_profiles_pessoa
  ON app.passageiro_corp_profiles (pessoa_id);
