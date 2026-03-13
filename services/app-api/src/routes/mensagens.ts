import { Router } from "express";

import { pool } from "../db/pool";
import { sendToUser } from "../lib/notifications";
import { requireAppAuth, requireModule, requireTenantActive } from "../middleware/auth";
import type { AppRequest } from "../types/auth";

const router = Router();

router.use(requireAppAuth, requireTenantActive, requireModule("mensagens"));

async function listMensagensEntreParticipantes(tenantId: number, currentUserId: number, contatoId: number) {
  return pool.query(
    `SELECT *
     FROM app.mensagens
     WHERE tenant_id = $1
       AND (
         (remetente_id = $2 AND destinatario_id = $3)
         OR
         (remetente_id = $3 AND destinatario_id = $2)
       )
     ORDER BY criado_em ASC`,
    [tenantId, currentUserId, contatoId]
  );
}

router.get("/conversas", async (req, res) => {
  const appReq = req as unknown as AppRequest;

  try {
    const result = await pool.query(
      `WITH ranked_messages AS (
        SELECT
          m.*,
          CASE
            WHEN m.remetente_id = $2 THEN m.destinatario_id
            ELSE m.remetente_id
          END AS contato_id,
          ROW_NUMBER() OVER (
            PARTITION BY
              CASE
                WHEN m.remetente_id = $2 THEN m.destinatario_id
                ELSE m.remetente_id
              END
            ORDER BY m.criado_em DESC
          ) AS rn
        FROM app.mensagens m
        WHERE m.tenant_id = $1
          AND (m.remetente_id = $2 OR m.destinatario_id = $2)
      )
      SELECT
        rm.*,
        p.nome AS contato_nome
      FROM ranked_messages rm
      JOIN app.pessoas p ON p.id = rm.contato_id
      WHERE rm.rn = 1
      ORDER BY rm.criado_em DESC`,
      [appReq.tenantId, appReq.user.sub]
    );

    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro interno" });
  }
});

router.get("/:contatoId", async (req, res) => {
  const appReq = req as unknown as AppRequest;
  const contatoId = Number(req.params.contatoId);

  try {
    const result = await listMensagensEntreParticipantes(appReq.tenantId, appReq.user.sub, contatoId);

    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro interno" });
  }
});

router.get("/conversa/:contatoTipo/:contatoId", async (req, res) => {
  const appReq = req as unknown as AppRequest;
  const contatoId = Number(req.params.contatoId);

  try {
    const result = await listMensagensEntreParticipantes(appReq.tenantId, appReq.user.sub, contatoId);
    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro interno" });
  }
});

router.post("/", async (req, res) => {
  const appReq = req as unknown as AppRequest;
  const { destinatario_id, destinatario_tipo, conteudo } = req.body as Record<string, unknown>;

  if (!destinatario_id || !destinatario_tipo || !conteudo) {
    return res.status(400).json({ error: "destinatario_id, destinatario_tipo e conteudo sao obrigatorios" });
  }

  try {
    const result = await pool.query(
      `INSERT INTO app.mensagens
        (
          tenant_id,
          remetente_id,
          remetente_tipo,
          destinatario_id,
          destinatario_tipo,
          conteudo
        )
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        appReq.tenantId,
        appReq.user.sub,
        appReq.user.role,
        destinatario_id,
        destinatario_tipo,
        conteudo
      ]
    );

    await sendToUser(Number(destinatario_id), {
      title: `Mensagem de ${appReq.user.nome}`,
      body: String(conteudo).slice(0, 100),
      data: {
        type: "chat.message",
        remetente_id: String(appReq.user.sub)
      }
    }).catch((error) => {
      console.error("Falha ao enviar push de mensagem", error);
    });

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro interno" });
  }
});

router.post("/read", async (req, res) => {
  const appReq = req as unknown as AppRequest;
  const { contato_id } = req.body as Record<string, unknown>;

  if (!contato_id) {
    return res.status(400).json({ error: "contato_id e obrigatorio" });
  }

  try {
    const result = await pool.query(
      `UPDATE app.mensagens
       SET lido = true
       WHERE tenant_id = $1
         AND remetente_id = $2
         AND destinatario_id = $3
         AND lido = false
       RETURNING id`,
      [appReq.tenantId, contato_id, appReq.user.sub]
    );

    res.json({ updated: result.rowCount ?? 0 });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro interno" });
  }
});

export default router;
