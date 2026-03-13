import cors from "cors";
import express from "express";

import alunosRouter from "./routes/alunos";
import authRouter from "./routes/auth";
import deviceTokensRouter from "./routes/device-tokens";
import dashboardRouter from "./routes/dashboard";
import entregasRouter from "./routes/entregas";
import escolasRouter from "./routes/escolas";
import execucaoRouter from "./routes/execucao";
import financeiroRouter from "./routes/financeiro";
import historicoRouter from "./routes/historico";
import mensagensRouter from "./routes/mensagens";
import motoristasRouter from "./routes/motoristas";
import motoristaRouter from "./routes/motorista";
import passageirosCorporativosRouter from "./routes/passageiros-corporativos";
import rotasRouter from "./routes/rotas";
import uploadsRouter from "./routes/uploads";
import veiculosRouter from "./routes/veiculos";
import { UPLOAD_DIR } from "./lib/upload";

export function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json());
  app.use("/uploads", express.static(UPLOAD_DIR));

  app.get("/health", (_req, res) => {
    res.json({
      status: "ok",
      service: "app-api",
      ts: new Date().toISOString()
    });
  });

  app.use("/auth", authRouter);
  app.use("/device-tokens", deviceTokensRouter);
  app.use("/dashboard", dashboardRouter);
  app.use("/escolas", escolasRouter);
  app.use("/alunos", alunosRouter);
  app.use("/entregas", entregasRouter);
  app.use("/passageiros-corporativos", passageirosCorporativosRouter);
  app.use("/motoristas", motoristasRouter);
  app.use("/veiculos", veiculosRouter);
  app.use("/rotas", rotasRouter);
  app.use("/execucao", execucaoRouter);
  app.use("/historico", historicoRouter);
  app.use("/financeiro", financeiroRouter);
  app.use("/mensagens", mensagensRouter);
  app.use("/motorista", motoristaRouter);
  app.use("/uploads", uploadsRouter);

  return app;
}
