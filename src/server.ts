import { createServer, Server } from "http";
import config from "./app/config";
import app from "./app";
import chalk from "chalk";
import "dotenv/config";
import seedAdmin from "./lib/seedAdmin";
import { redis } from "./shared/redis";
import { initSocket } from "./socket/socket";

let server: Server;
const port = config.port || 3000;
const ip = config.ip;

async function main() {
  try {
    await redis.ping();
    console.log(chalk.green("✅ Redis connected successfully"));

    await seedAdmin();

    const httpServer = createServer(app);
    initSocket(httpServer);

    server = httpServer.listen(port, () => {
      console.log(
        `✅ Server is running --> ${chalk.yellow(`http://${ip}:${port}`)}`,
      );
      console.log(chalk.green("✅ Socket.io attached and listening same port."));
    });
  } catch (err) {
    console.error("❌ Failed to start server:", err);
    process.exit(1);
  }
}

main();

process.on("unhandledRejection", (err) => {
  console.log(`😈 unhandled Rejection is detected, shutting down ...::`, err);
  if (server) {
    server.close(() => {
      process.exit(1);
    });
  }
  process.exit(1);
});

process.on("uncaughtException", (err) => {
  console.log(`😈 uncaughtException is detected, shutting down ...::`, err);
  process.exit(1);
});

// Graceful shutdown — close Redis connection properly on SIGTERM/SIGINT
process.on("SIGTERM", async () => {
  console.log("SIGTERM received, shutting down gracefully...");
  await redis.quit();
  if (server) {
    server.close(() => process.exit(0));
  }
});

process.on("SIGINT", async () => {
  console.log("SIGINT received, shutting down gracefully...");
  await redis.quit();
  if (server) {
    server.close(() => process.exit(0));
  }
});
