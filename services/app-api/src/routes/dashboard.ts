import { Router } from "express";

import { pool } from "../db/pool";
import { requireAppAuth, requireTenantActive } from "../middleware/auth";
import type { AppRequest } from "../types/auth";

const router = Router();

router.use(requireAppAuth, requireTenantActive);

router.get("/stats", async (req, res) => {
  const appReq = req as unknown as AppRequest;

  try {
    const modulesResult = await pool.query(
      `SELECT m.slug
       FROM management.tenant_modules tm
       JOIN management.modules m ON m.id = tm.module_id
       WHERE tm.tenant_id = $1 AND tm.habilitado = true`,
      [appReq.tenantId]
    );

    const modules = new Set(modulesResult.rows.map((row) => row.slug));

    const [
      pessoasResult,
      alunosResult,
      veiculosResult,
      veiculosAtivosResult,
      motoristasEmAcaoResult,
      rotasHojeResult
    ] = await Promise.all([
      pool.query(
        `SELECT COUNT(*)::int AS total
         FROM app.pessoas
         WHERE tenant_id = $1 AND ativo = true`,
        [appReq.tenantId]
      ),
      pool.query(
        `SELECT COUNT(*)::int AS total
         FROM app.pessoas
         WHERE tenant_id = $1 AND tipo = 'aluno' AND ativo = true`,
        [appReq.tenantId]
      ),
      pool.query(
        `SELECT COUNT(*)::int AS total
         FROM app.veiculos
         WHERE tenant_id = $1 AND ativo = true`,
        [appReq.tenantId]
      ),
      pool.query(
        `SELECT COUNT(DISTINCT veiculo_id)::int AS total
         FROM app.execucoes
         WHERE tenant_id = $1
           AND status = 'em_andamento'`,
        [appReq.tenantId]
      ),
      pool.query(
        `SELECT COUNT(DISTINCT motorista_id)::int AS total
         FROM app.execucoes
         WHERE tenant_id = $1
           AND status = 'em_andamento'`,
        [appReq.tenantId]
      ),
      pool.query(
        `SELECT COUNT(*)::int AS total
         FROM app.execucoes
         WHERE tenant_id = $1
           AND iniciada_em >= CURRENT_DATE`,
        [appReq.tenantId]
      )
    ]);

    res.json({
      pessoas_total: pessoasResult.rows[0]?.total ?? 0,
      ...(modules.has("alunos") ? { alunos_total: alunosResult.rows[0]?.total ?? 0 } : {}),
      ...(modules.has("veiculos")
        ? {
            veiculos_total: veiculosResult.rows[0]?.total ?? 0,
            veiculos_ativos: veiculosAtivosResult.rows[0]?.total ?? 0
          }
        : {}),
      ...(modules.has("rastreamento")
        ? { motoristas_em_acao: motoristasEmAcaoResult.rows[0]?.total ?? 0 }
        : {}),
      ...(modules.has("rotas") ? { rotas_hoje: rotasHojeResult.rows[0]?.total ?? 0 } : {})
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro interno" });
  }
});

router.get("/charts", async (req, res) => {
  const appReq = req as unknown as AppRequest;

  try {
    const modulesResult = await pool.query(
      `SELECT m.slug
       FROM management.tenant_modules tm
       JOIN management.modules m ON m.id = tm.module_id
       WHERE tm.tenant_id = $1 AND tm.habilitado = true`,
      [appReq.tenantId]
    );

    const modules = new Set(modulesResult.rows.map((row) => row.slug));

    const [rotasPorDia, alunosPorEscola, financeiroMensal, atividadePorTurno] =
      await Promise.all([
        modules.has("rotas")
          ? pool.query(
              `SELECT
                data_execucao AS data,
                COUNT(*)::int AS total
               FROM app.historico
               WHERE tenant_id = $1
                 AND data_execucao >= CURRENT_DATE - INTERVAL '7 days'
               GROUP BY data_execucao
               ORDER BY data_execucao`,
              [appReq.tenantId]
            )
          : Promise.resolve({ rows: [] }),
        modules.has("alunos")
          ? pool.query(
              `SELECT
                ps.nome AS escola,
                COUNT(*)::int AS total
               FROM app.aluno_profiles ap
               JOIN app.pessoas p ON p.id = ap.pessoa_id
               LEFT JOIN app.pontos_servico ps ON ps.id = ap.escola_id
               WHERE p.tenant_id = $1
                 AND p.tipo = 'aluno'
               GROUP BY ps.nome
               ORDER BY total DESC
               LIMIT 5`,
              [appReq.tenantId]
            )
          : Promise.resolve({ rows: [] }),
        modules.has("financeiro")
          ? pool.query(
              `SELECT
                to_char(mes_referencia, 'YYYY-MM') AS mes,
                COALESCE(SUM(valor) FILTER (WHERE status = 'pago'), 0)::float AS receitas,
                COALESCE(SUM(valor) FILTER (WHERE status = 'pendente'), 0)::float AS despesas
               FROM app.cobrancas
               WHERE tenant_id = $1
                 AND mes_referencia >= date_trunc('month', CURRENT_DATE) - INTERVAL '5 months'
               GROUP BY to_char(mes_referencia, 'YYYY-MM')
               ORDER BY mes`,
              [appReq.tenantId]
            )
          : Promise.resolve({ rows: [] }),
        modules.has("execucao")
          ? pool.query(
              `SELECT
                COALESCE(r.turno, 'indefinido') AS turno,
                COUNT(*)::int AS rotas
               FROM app.execucoes e
               LEFT JOIN app.rotas r ON r.id = e.rota_id
               WHERE e.tenant_id = $1
                 AND e.iniciada_em >= CURRENT_DATE - INTERVAL '30 days'
               GROUP BY COALESCE(r.turno, 'indefinido')
               ORDER BY turno`,
              [appReq.tenantId]
            )
          : Promise.resolve({ rows: [] })
      ]);

    res.json({
      ...(modules.has("rotas") ? { rotas_por_dia: rotasPorDia.rows } : {}),
      ...(modules.has("alunos") ? { alunos_por_escola: alunosPorEscola.rows } : {}),
      ...(modules.has("financeiro") ? { financeiro_mensal: financeiroMensal.rows } : {}),
      ...(modules.has("execucao") ? { atividade_por_turno: atividadePorTurno.rows } : {})
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro interno" });
  }
});

export default router;
