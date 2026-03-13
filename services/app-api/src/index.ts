import dotenv from "dotenv";
import http from "http";

import { createApp } from "./app";
import { pool } from "./db/pool";
import { startOutboxDispatcher } from "./events/dispatcher";
import { startAppSubscriber } from "./events/subscriber";
import { createSocketServer } from "./realtime/socket";

dotenv.config();

const app = createApp();
const httpServer = http.createServer(app);
const port = Number(process.env.APP_PORT || 3001);

createSocketServer(httpServer);

httpServer.listen(port, () => {
  console.log(`[app-api] listening on http://localhost:${port}`);
});

startOutboxDispatcher();
startAppSubscriber();

async function shutdown() {
  await pool.end();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
