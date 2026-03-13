import dotenv from "dotenv";

import { createApp } from "./app";
import { startAnomalyCron } from "./cron/anomalyDetection";
import { pool } from "./db/pool";
import { startOutboxDispatcher } from "./events/dispatcher";
import { startManagementSubscriber } from "./events/subscriber";

dotenv.config();

const app = createApp();
const port = Number(process.env.MANAGEMENT_PORT || 3000);

app.listen(port, () => {
  console.log(`[management-api] listening on http://localhost:${port}`);
});

startAnomalyCron();
startOutboxDispatcher();
startManagementSubscriber();

async function shutdown() {
  await pool.end();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
