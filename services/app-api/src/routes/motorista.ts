import { Router } from "express";

import { pool } from "../db/pool";
import { hashPin, verifyPin } from "../lib/pin";
import { signAppToken } from "../lib/jwt";
import { appendOutboxEvent } from "../lib/outbox";
import { requireAppAuth, requireModule, requireTenantActive } from "../middleware/auth";
import type { AppRequest } from "../types/auth";

const router = Router();

function getDeviceId(req: AppRequest) {
  const header = req.headers["x-device-id"];
  return typeof header === "string" ? header : null;
}

router.get(
  "/rota-ativa",
  requireAppAuth,
  requireTenantActive,
  requireModule("rotas"),
  async (req, res) => {
    const appReq = req as unknown as AppRequest;

    try {
      const execucaoResult = await pool.query(
        `SELECT *
         FROM app.execucoes
         WHERE tenant_id = $1
           AND motorista_id = $2
           AND status = 'em_andamento'
         ORDER BY iniciada_em DESC
         LIMIT 1`,
        [appReq.tenantId, appReq.user.sub]
      );

      const execucao = execucaoResult.rows[0];

      if (!execucao) {
        return res.json(null);
      }

      const [rotaResult, paradasResult] = await Promise.all([
        pool.query(
          `SELECT * FROM app.rotas WHERE id = $1`,
          [execucao.rota_id]
        ),
        pool.query(
          `SELECT
            rp.*,
            p.nome,
            p.endereco
           FROM app.rota_paradas rp
           JOIN app.pessoas p ON p.id = rp.pessoa_id
           WHERE rp.rota_id = $1
           ORDER BY rp.ordem`,
          [execucao.rota_id]
        )
      ]);

      res.json({
        execucao,
        rota: rotaResult.rows[0] ?? null,
        paradas: paradasResult.rows
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Erro interno" });
    }
  }
);

router.post("/pin/set", requireAppAuth, requireTenantActive, async (req, res) => {
  const appReq = req as unknown as AppRequest;
  const { pin } = req.body as { pin?: string };

  if (!pin || String(pin).length < 4) {
    return res.status(400).json({ error: "PIN invalido" });
  }

  try {
    const pinHash = await hashPin(pin);
    const result = await pool.query(
      `UPDATE app.motorista_profiles
       SET pin_hash = $1
       WHERE pessoa_id = $2
       RETURNING pessoa_id`,
      [pinHash, appReq.user.sub]
    );

    if (!result.rowCount) {
      return res.status(404).json({ error: "Motorista nao encontrado" });
    }

    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro interno" });
  }
});

router.post("/pin/verify", requireAppAuth, requireTenantActive, async (req, res) => {
  const appReq = req as unknown as AppRequest;
  const { pin } = req.body as { pin?: string };

  if (!pin) {
    return res.status(400).json({ error: "PIN obrigatorio" });
  }

  try {
    const result = await pool.query(
      `SELECT mp.pin_hash
       FROM app.motorista_profiles mp
       WHERE mp.pessoa_id = $1`,
      [appReq.user.sub]
    );

    if (!result.rowCount) {
      return res.status(404).json({ error: "Motorista nao encontrado" });
    }

    const valid = await verifyPin(pin, result.rows[0].pin_hash);
    res.json({ valid });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro interno" });
  }
});

router.post("/pin/login", async (req, res) => {
  const deviceId = typeof req.headers["x-device-id"] === "string" ? req.headers["x-device-id"] : null;
  const { pin } = req.body as { pin?: string };

  if (!deviceId || !pin) {
    return res.status(400).json({ error: "X-Device-ID e pin sao obrigatorios" });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const result = await client.query(
      `SELECT
        tv.device_id,
        p.id,
        p.tenant_id,
        p.firebase_uid,
        p.nome,
        p.email,
        mp.pin_hash
       FROM app.tablet_vinculos tv
       JOIN app.pessoas p ON p.id = tv.motorista_id
       JOIN app.motorista_profiles mp ON mp.pessoa_id = p.id
       WHERE tv.device_id = $1
         AND tv.desvinculado_em IS NULL
         AND p.ativo = true
       LIMIT 1`,
      [deviceId]
    );

    if (!result.rowCount) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Tablet nao vinculado" });
    }

    const motorista = result.rows[0];
    const valid = await verifyPin(pin, motorista.pin_hash);

    if (!valid) {
      await client.query("ROLLBACK");
      return res.status(401).json({ error: "PIN invalido" });
    }

    const token = signAppToken({
      sub: motorista.id,
      tenant_id: motorista.tenant_id,
      role: "motorista",
      firebase_uid: motorista.firebase_uid ?? `motorista:${motorista.id}`,
      nome: motorista.nome,
      email: motorista.email ?? undefined
    });

    await appendOutboxEvent(client, {
      eventType: "user.logged_in",
      aggregateType: "user",
      aggregateId: motorista.id,
      tenantId: motorista.tenant_id,
      payload: {
        tenant_id: motorista.tenant_id,
        user_id: motorista.id,
        user_type: "motorista",
        firebase_uid: motorista.firebase_uid ?? undefined,
        device_id: deviceId,
        ip: req.ip,
        user_agent: req.headers["user-agent"],
        login_method: "pin"
      }
    });

    await client.query("COMMIT");

    res.json({
      token,
      role: "motorista",
      user: {
        id: motorista.id,
        tenant_id: motorista.tenant_id,
        firebase_uid: motorista.firebase_uid,
        nome: motorista.nome,
        email: motorista.email
      }
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error(error);
    res.status(500).json({ error: "Erro interno" });
  } finally {
    client.release();
  }
});

router.post(
  "/vincular-tablet",
  requireAppAuth,
  requireTenantActive,
  requireModule("veiculos"),
  async (req, res) => {
    const appReq = req as unknown as AppRequest;
    const deviceId = getDeviceId(appReq);
    const { veiculo_id, pin } = req.body as { veiculo_id?: number; pin?: string };

    if (!deviceId || !veiculo_id || !pin) {
      return res.status(400).json({ error: "X-Device-ID, veiculo_id e pin sao obrigatorios" });
    }

    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const profileResult = await client.query(
        `SELECT pin_hash
         FROM app.motorista_profiles
         WHERE pessoa_id = $1`,
        [appReq.user.sub]
      );

      if (!profileResult.rowCount) {
        await client.query("ROLLBACK");
        return res.status(404).json({ error: "Motorista nao encontrado" });
      }

      const valid = await verifyPin(pin, profileResult.rows[0].pin_hash);
      if (!valid) {
        await client.query("ROLLBACK");
        return res.status(401).json({ error: "PIN invalido" });
      }

      await client.query(
        `UPDATE app.tablet_vinculos
         SET desvinculado_em = NOW()
         WHERE device_id = $1
           AND desvinculado_em IS NULL`,
        [deviceId]
      );

      const result = await client.query(
        `INSERT INTO app.tablet_vinculos (veiculo_id, motorista_id, device_id)
         VALUES ($1, $2, $3)
         RETURNING *`,
        [veiculo_id, appReq.user.sub, deviceId]
      );

      await appendOutboxEvent(client, {
        eventType: "device.bound",
        aggregateType: "tablet_binding",
        aggregateId: result.rows[0].id,
        tenantId: appReq.tenantId,
        payload: {
          tenant_id: appReq.tenantId,
          device_id: deviceId,
          vehicle_id: veiculo_id,
          driver_id: appReq.user.sub,
          bound_at: result.rows[0].vinculado_em
        }
      });

      await client.query("COMMIT");
      res.status(201).json(result.rows[0]);
    } catch (error) {
      await client.query("ROLLBACK");
      console.error(error);
      res.status(500).json({ error: "Erro interno" });
    } finally {
      client.release();
    }
  }
);

router.delete("/desvincular-tablet", requireAppAuth, requireTenantActive, async (req, res) => {
  const appReq = req as unknown as AppRequest;
  const deviceId = getDeviceId(appReq);

  if (!deviceId) {
    return res.status(400).json({ error: "X-Device-ID obrigatorio" });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const result = await client.query(
      `UPDATE app.tablet_vinculos
       SET desvinculado_em = NOW()
       WHERE device_id = $1
         AND motorista_id = $2
         AND desvinculado_em IS NULL
       RETURNING *`,
      [deviceId, appReq.user.sub]
    );

    if (!result.rowCount) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Vinculo nao encontrado" });
    }

    await appendOutboxEvent(client, {
      eventType: "device.unbound",
      aggregateType: "tablet_binding",
      aggregateId: result.rows[0].id,
      tenantId: appReq.tenantId,
      payload: {
        tenant_id: appReq.tenantId,
        device_id: deviceId,
        vehicle_id: result.rows[0].veiculo_id,
        driver_id: appReq.user.sub,
        unbound_at: result.rows[0].desvinculado_em
      }
    });

    await client.query("COMMIT");
    res.json(result.rows[0]);
  } catch (error) {
    await client.query("ROLLBACK");
    console.error(error);
    res.status(500).json({ error: "Erro interno" });
  } finally {
    client.release();
  }
});

router.get("/tablet-status", requireAppAuth, requireTenantActive, async (req, res) => {
  const appReq = req as unknown as AppRequest;
  const deviceId = getDeviceId(appReq);

  if (!deviceId) {
    return res.status(400).json({ error: "X-Device-ID obrigatorio" });
  }

  try {
    const result = await pool.query(
      `SELECT
        tv.*,
        v.placa,
        p.nome AS motorista_nome
       FROM app.tablet_vinculos tv
       JOIN app.veiculos v ON v.id = tv.veiculo_id
       JOIN app.pessoas p ON p.id = tv.motorista_id
       WHERE tv.device_id = $1
         AND tv.desvinculado_em IS NULL
       LIMIT 1`,
      [deviceId]
    );

    res.json(result.rows[0] ?? null);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro interno" });
  }
});

export default router;
