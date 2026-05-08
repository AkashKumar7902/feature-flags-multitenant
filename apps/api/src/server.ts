import { env } from "./config/env.js";
import { prisma } from "./db/prisma.js";
import { createApp } from "./app.js";

const app = createApp();

await prisma.$connect();

const server = app.listen(env.API_PORT, () => {
  console.log(`API listening on http://localhost:${env.API_PORT}`);
});

async function shutdown(signal: string) {
  console.log(`${signal} received, shutting down API`);
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
