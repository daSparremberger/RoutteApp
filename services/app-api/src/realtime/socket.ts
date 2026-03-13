import type { Server as HttpServer } from "http";

import { createAdapter } from "@socket.io/redis-adapter";
import type { AppTokenPayload } from "@rotavans/shared";
import { Server } from "socket.io";

import { pool } from "../db/pool";
import { verifyAppToken } from "../lib/jwt";
import { getRedis } from "../redis/client";

export function createSocketServer(httpServer: HttpServer) {
  const io = new Server(httpServer, {
    cors: { origin: "*" }
  });

  const redis = getRedis();
  if (redis) {
    const pubClient = redis.duplicate();
    const subClient = redis.duplicate();
    io.adapter(createAdapter(pubClient, subClient));
  } else {
    console.warn("[app-api] REDIS_URL not configured, socket redis adapter disabled");
  }

  io.use((socket, next) => {
    const token =
      (socket.handshake.auth?.token as string | undefined) ??
      socket.handshake.headers.authorization?.replace(/^Bearer\s+/i, "");

    if (!token) {
      next(new Error("unauthorized"));
      return;
    }

    const payload = verifyAppToken(token);

    if (!payload) {
      next(new Error("unauthorized"));
      return;
    }

    socket.data.user = payload as AppTokenPayload;
    next();
  });

  io.on("connection", (socket) => {
    const user = socket.data.user as AppTokenPayload;
    const room = `tenant:${user.tenant_id}`;
    socket.join(room);

    socket.on("get_locations", async () => {
      if (user.role !== "gestor") {
        return;
      }

      const redis = getRedis();
      if (!redis) {
        socket.emit("all_locations", []);
        return;
      }

      const keys = await redis.keys(`location:${user.tenant_id}:*`);
      const values = keys.length ? await redis.mget(keys) : [];
      socket.emit(
        "all_locations",
        values.filter(Boolean).map((value) => JSON.parse(value!))
      );
    });

    socket.on("location_update", async (payload) => {
      if (user.role !== "motorista") {
        return;
      }

      const redis = getRedis();
      if (!redis) {
        return;
      }

      const location = {
        motorista_id: user.sub,
        tenant_id: user.tenant_id,
        nome: user.nome,
        lat: payload.lat,
        lng: payload.lng,
        speed: payload.speed,
        heading: payload.heading,
        rota_id: payload.rota_id ?? null,
        timestamp: Date.now()
      };

      await redis.set(
        `location:${user.tenant_id}:${user.sub}`,
        JSON.stringify(location),
        "EX",
        300
      );

      io.to(room).emit("location_update", location);
    });

    socket.on("chat:message", async (payload) => {
      const result = await pool.query(
        `INSERT INTO app.mensagens
          (tenant_id, remetente_id, remetente_tipo, destinatario_id, destinatario_tipo, conteudo)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [user.tenant_id, user.sub, user.role, payload.destinatario_id, payload.destinatario_tipo, payload.conteudo]
      );

      io.to(room).emit("chat:message", result.rows[0]);
    });

    socket.on("chat:read", async (payload) => {
      await pool.query(
        `UPDATE app.mensagens
         SET lido = true
         WHERE tenant_id = $1
           AND remetente_id = $2
           AND destinatario_id = $3`,
        [user.tenant_id, payload.remetente_id, user.sub]
      );

      io.to(room).emit("chat:read", {
        reader_id: user.sub,
        reader_tipo: user.role
      });
    });

    socket.on("disconnect", () => {
      io.to(room).emit("motorista_offline", { motorista_id: user.sub });
    });
  });

  return io;
}
