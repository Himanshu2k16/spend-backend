import { createApp } from "./app";
import { env } from "./config/env";
import { prisma } from "./lib/prisma";

const app = createApp();

app.listen(env.PORT, () => {
  console.log(`[spend-backend] listening on http://localhost:${env.PORT} (${env.NODE_ENV})`);
});

async function shutdown() {
  await prisma.$disconnect();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
