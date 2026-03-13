import cors from "cors";
import express from "express";

import anomaliesRouter from "./routes/anomalies";
import authRouter from "./routes/auth";
import dashboardRouter from "./routes/dashboard";
import licensesRouter from "./routes/licenses";
import modulesRouter from "./routes/modules";
import tenantsRouter from "./routes/tenants";
import organizationsRouter from "./routes/organizations";
import contractsRouter from "./routes/contracts";
import invoicesRouter from "./routes/invoices";

export function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json());

  app.get("/health", (_req, res) => {
    res.json({
      status: "ok",
      service: "management-api",
      ts: new Date().toISOString()
    });
  });

  app.use("/auth", authRouter);
  app.use("/dashboard", dashboardRouter);
  app.use("/modules", modulesRouter);
  app.use("/", licensesRouter);
  app.use("/tenants", tenantsRouter);
  app.use("/organizations", organizationsRouter);
  app.use("/", contractsRouter);
  app.use("/anomalies", anomaliesRouter);
  app.use("/invoices", invoicesRouter);

  return app;
}
