import dotenv from "dotenv";

import { pool } from "./pool";

dotenv.config();

async function runSeed() {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const tenantResult = await client.query(
      `SELECT id
       FROM management.tenants
       WHERE nome = 'Rotavans Demo'
       ORDER BY id
       LIMIT 1`
    );

    const tenantId = tenantResult.rows[0]?.id as number | undefined;

    if (!tenantId) {
      throw new Error("Tenant demo nao encontrado. Rode o seed do management-api primeiro.");
    }

    const escolaResult = await client.query(
      `SELECT id
       FROM app.pontos_servico
       WHERE tenant_id = $1 AND tipo = 'escola' AND nome = 'Escola Modelo'
       LIMIT 1`,
      [tenantId]
    );

    let escolaId = escolaResult.rows[0]?.id as number | undefined;

    if (!escolaId) {
      const escolaBase = await client.query(
        `INSERT INTO app.pontos_servico (tenant_id, tipo, nome, endereco, lat, lng)
         VALUES ($1, 'escola', 'Escola Modelo', 'Quadra 101, Brasilia - DF', -15.7801, -47.9292)
         RETURNING id`,
        [tenantId]
      );
      escolaId = escolaBase.rows[0]?.id;
    }

    if (!escolaId) {
      throw new Error("Escola demo nao encontrada");
    }

    await client.query(
      `INSERT INTO app.escola_profiles
        (ponto_servico_id, turno_manha, turno_tarde, turno_noite)
       VALUES ($1, true, true, false)
       ON CONFLICT (ponto_servico_id) DO NOTHING`,
      [escolaId]
    );

    await client.query(
      `INSERT INTO app.escola_contatos (escola_id, cargo, nome, telefone, email)
       SELECT $1, 'Diretor', 'Maria Diretora', '(61) 99999-0001', 'direcao@escolamodelo.local'
       WHERE NOT EXISTS (
         SELECT 1 FROM app.escola_contatos WHERE escola_id = $1 AND nome = 'Maria Diretora'
       )`,
      [escolaId]
    );

    const gestorResult = await client.query(
      `INSERT INTO app.pessoas
        (tenant_id, firebase_uid, tipo, nome, email, telefone, endereco, lat, lng, ativo)
       VALUES (
        $1,
        'dev-gestor',
        'gestor',
        'Gestor Demo',
        'gestor.demo@rotavans.local',
        '(61) 99999-1000',
        'Sede Rotavans Demo',
        -15.7797,
        -47.9285,
        true
       )
       ON CONFLICT (firebase_uid) DO UPDATE
       SET nome = EXCLUDED.nome,
           email = EXCLUDED.email,
           telefone = EXCLUDED.telefone,
           ativo = true
       RETURNING id`,
      [tenantId]
    );

    const gestorId = gestorResult.rows[0].id as number;

    const motoristaPessoa = await client.query(
      `INSERT INTO app.pessoas
        (tenant_id, firebase_uid, tipo, nome, email, telefone, endereco, lat, lng, ativo)
       VALUES (
        $1,
        'dev-motorista',
        'motorista',
        'Motorista Demo',
        'motorista.demo@rotavans.local',
        '(61) 99999-2000',
        'Garagem Demo',
        -15.7815,
        -47.9305,
        true
       )
       ON CONFLICT (firebase_uid) DO UPDATE
       SET nome = EXCLUDED.nome,
           email = EXCLUDED.email,
           telefone = EXCLUDED.telefone,
           ativo = true
       RETURNING id`,
      [tenantId]
    );

    const motoristaId = motoristaPessoa.rows[0].id as number;

    await client.query(
      `INSERT INTO app.motorista_profiles
        (pessoa_id, cnh, categoria_cnh, validade_cnh, cadastro_completo)
       VALUES ($1, '00000000000', 'D', CURRENT_DATE + INTERVAL '3 years', true)
       ON CONFLICT (pessoa_id)
       DO UPDATE SET cadastro_completo = true, cnh = EXCLUDED.cnh, categoria_cnh = EXCLUDED.categoria_cnh`,
      [motoristaId]
    );

    const alunoPessoa = await client.query(
      `INSERT INTO app.pessoas
        (tenant_id, firebase_uid, tipo, nome, email, telefone, endereco, lat, lng, ativo)
       VALUES (
        $1,
        'dev-aluno',
        'aluno',
        'Aluno Demo',
        'aluno.demo@rotavans.local',
        '(61) 99999-3000',
        'SQN 201, Bloco A, Brasilia - DF',
        -15.775,
        -47.924,
        true
       )
       ON CONFLICT (firebase_uid) DO UPDATE
       SET nome = EXCLUDED.nome,
           email = EXCLUDED.email,
           telefone = EXCLUDED.telefone,
           ativo = true
       RETURNING id`,
      [tenantId]
    );

    const alunoId = alunoPessoa.rows[0].id as number;

    await client.query(
      `INSERT INTO app.aluno_profiles
        (pessoa_id, escola_id, turno, cpf_responsavel, telefone_responsavel, serie, necessidades_especiais)
       VALUES ($1, $2, 'manha', '00000000000', '(61) 99999-4000', '5 ano', NULL)
       ON CONFLICT (pessoa_id)
       DO UPDATE SET escola_id = EXCLUDED.escola_id, turno = EXCLUDED.turno, telefone_responsavel = EXCLUDED.telefone_responsavel`,
      [alunoId, escolaId]
    );

    const veiculoResult = await client.query(
      `INSERT INTO app.veiculos (tenant_id, placa, modelo, fabricante, ano, capacidade, ativo)
       VALUES ($1, 'ABC1D23', 'Sprinter', 'Mercedes', 2022, 18, true)
       ON CONFLICT (tenant_id, placa)
       DO UPDATE SET modelo = EXCLUDED.modelo, fabricante = EXCLUDED.fabricante, ano = EXCLUDED.ano, capacidade = EXCLUDED.capacidade
       RETURNING id`,
      [tenantId]
    );

    const veiculoId = veiculoResult.rows[0].id as number;

    await client.query(
      `INSERT INTO app.veiculo_motorista (veiculo_id, motorista_id)
       VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [veiculoId, motoristaId]
    );

    const rotaExisting = await client.query(
      `SELECT id
       FROM app.rotas
       WHERE tenant_id = $1
         AND nome = 'Rota Demo Manha'
       ORDER BY id
       LIMIT 1`,
      [tenantId]
    );

    let rotaId = rotaExisting.rows[0]?.id as number | undefined;

    if (!rotaId) {
      const rotaResult = await client.query(
        `INSERT INTO app.rotas (tenant_id, motorista_id, veiculo_id, nome, turno, ativo)
         VALUES ($1, $2, $3, 'Rota Demo Manha', 'manha', true)
         RETURNING id`,
        [tenantId, motoristaId, veiculoId]
      );
      rotaId = rotaResult.rows[0].id as number;
    }

    await client.query(
      `INSERT INTO app.rota_paradas (rota_id, pessoa_id, ordem, lat, lng)
       SELECT $1, $2, 1, -15.775, -47.924
       WHERE NOT EXISTS (
         SELECT 1 FROM app.rota_paradas WHERE rota_id = $1 AND pessoa_id = $2
       )`,
      [rotaId, alunoId]
    );

    await client.query(
      `INSERT INTO app.cobrancas (tenant_id, pessoa_id, mes_referencia, valor, status)
       SELECT $1, $2, date_trunc('month', CURRENT_DATE)::date, 450.00, 'pendente'
       WHERE NOT EXISTS (
         SELECT 1
         FROM app.cobrancas
         WHERE tenant_id = $1
           AND pessoa_id = $2
           AND mes_referencia = date_trunc('month', CURRENT_DATE)::date
       )`,
      [tenantId, alunoId]
    );

    await client.query(
      `INSERT INTO app.mensagens
        (tenant_id, remetente_id, remetente_tipo, destinatario_id, destinatario_tipo, conteudo, lido)
       SELECT $1, $2, 'gestor', $3, 'motorista', 'Bem-vindo ao ambiente demo.', false
       WHERE NOT EXISTS (
         SELECT 1
         FROM app.mensagens
         WHERE tenant_id = $1
           AND remetente_id = $2
           AND destinatario_id = $3
           AND conteudo = 'Bem-vindo ao ambiente demo.'
       )`,
      [tenantId, gestorId, motoristaId]
    );

    await client.query("COMMIT");

    console.log(
      JSON.stringify(
        {
          tenant_id: tenantId,
          gestor: {
            email: "gestor.demo@rotavans.local",
            firebase_uid: "dev-gestor"
          },
          motorista: {
            email: "motorista.demo@rotavans.local",
            firebase_uid: "dev-motorista"
          },
          escola_id: escolaId,
          aluno_id: alunoId,
          motorista_id: motoristaId,
          veiculo_id: veiculoId,
          rota_id: rotaId
        },
        null,
        2
      )
    );
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

if (require.main === module) {
  runSeed()
    .then(async () => {
      await pool.end();
      process.exit(0);
    })
    .catch(async (error) => {
      console.error(error);
      await pool.end();
      process.exit(1);
    });
}
