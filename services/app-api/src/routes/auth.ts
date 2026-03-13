import { Router } from "express";

import { getFirebaseAdmin } from "../lib/firebase";
import { signAppToken } from "../lib/jwt";
import { appendOutboxEvent } from "../lib/outbox";
import { pool } from "../db/pool";
import { requireAppAuth, requireTenantActive } from "../middleware/auth";
import type { AppRequest } from "../types/auth";

const router = Router();

router.post("/login", async (req, res) => {
  const { firebase_id_token } = req.body as { firebase_id_token?: string };

  if (!firebase_id_token) {
    return res.status(400).json({ error: "firebase_id_token is required" });
  }

  try {
    const decoded = await getFirebaseAdmin().auth().verifyIdToken(firebase_id_token);
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const result = await client.query(
      `SELECT id, tenant_id, firebase_uid, tipo, nome, email
       FROM app.pessoas
       WHERE firebase_uid = $1
         AND tipo IN ('gestor', 'motorista')
         AND ativo = true
       LIMIT 1`,
      [decoded.uid]
      );

      if (!result.rowCount) {
        await client.query("ROLLBACK");
        return res.status(404).json({ error: "Usuario nao encontrado" });
      }

      const user = result.rows[0];
      const role = user.tipo === "gestor" ? "gestor" : "motorista";
      const token = signAppToken({
        sub: user.id,
        tenant_id: user.tenant_id,
        role,
        firebase_uid: user.firebase_uid,
        nome: user.nome,
        email: user.email ?? undefined
      });

      await appendOutboxEvent(client, {
        eventType: "user.logged_in",
        aggregateType: "user",
        aggregateId: user.id,
        tenantId: user.tenant_id,
        payload: {
          tenant_id: user.tenant_id,
          user_id: user.id,
          user_type: role,
          firebase_uid: user.firebase_uid,
          ip: req.ip,
          user_agent: req.headers["user-agent"]
        }
      });

      await client.query("COMMIT");

      return res.json({
        token,
        role,
        user: {
          id: user.id,
          tenant_id: user.tenant_id,
          firebase_uid: user.firebase_uid,
          nome: user.nome,
          email: user.email
        }
      });
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  } catch {
    return res.status(401).json({ error: "Token Firebase invalido" });
  }
});

router.post("/dev-login", async (req, res) => {
  if (process.env.DEV_AUTH_ENABLED !== "true") {
    return res.status(404).json({ error: "Rota indisponivel" });
  }

  const { email, firebase_uid, role } = req.body as {
    email?: string;
    firebase_uid?: string;
    role?: "gestor" | "motorista";
  };

  try {
    const result = await pool.query(
      `SELECT id, tenant_id, firebase_uid, tipo, nome, email
       FROM app.pessoas
       WHERE ativo = true
         AND tipo IN ('gestor', 'motorista')
         AND ($1::text IS NULL OR email = $1)
         AND ($2::text IS NULL OR firebase_uid = $2)
         AND ($3::text IS NULL OR tipo = $3)
       ORDER BY
         CASE WHEN tipo = 'gestor' THEN 0 ELSE 1 END,
         id
       LIMIT 1`,
      [email ?? null, firebase_uid ?? null, role ?? null]
    );

    if (!result.rowCount) {
      return res.status(404).json({ error: "Usuario dev nao encontrado" });
    }

    const user = result.rows[0];
    const appRole = user.tipo === "gestor" ? "gestor" : "motorista";
    const token = signAppToken({
      sub: user.id,
      tenant_id: user.tenant_id,
      role: appRole,
      firebase_uid: user.firebase_uid ?? `dev-${user.id}`,
      nome: user.nome,
      email: user.email ?? undefined
    });

    return res.json({
      token,
      role: appRole,
      user: {
        id: user.id,
        tenant_id: user.tenant_id,
        firebase_uid: user.firebase_uid,
        nome: user.nome,
        email: user.email
      }
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Erro interno" });
  }
});

router.get("/profile", requireAppAuth, requireTenantActive, async (req, res) => {
  const appReq = req as unknown as AppRequest;

  try {
    const [userResult, modulesResult] = await Promise.all([
      pool.query(
        `SELECT id, tenant_id, firebase_uid, tipo, nome, email
         FROM app.pessoas
         WHERE id = $1 AND tenant_id = $2
         LIMIT 1`,
        [appReq.user.sub, appReq.tenantId]
      ),
      pool.query(
        `SELECT m.slug
         FROM management.tenant_modules tm
         JOIN management.modules m ON m.id = tm.module_id
         WHERE tm.tenant_id = $1 AND tm.habilitado = true
         ORDER BY m.slug`,
        [appReq.tenantId]
      )
    ]);

    if (!userResult.rowCount) {
      return res.status(404).json({ error: "Usuario nao encontrado" });
    }

    res.json({
      user: userResult.rows[0],
      role: appReq.user.role,
      modules: modulesResult.rows.map((row) => row.slug)
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro interno" });
  }
});

export default router;
