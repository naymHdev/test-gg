import { Server } from "http";
import config from "./app/config";
import app from "./app";
import chalk from "chalk";
import "dotenv/config";
import seedAdmin from "./lib/seedAdmin";

let server: Server;
const port = config.port || 3000;
const ip = config.ip;

async function main() {
  try {
    await seedAdmin();
    server = app.listen(port, () => {
      console.log(
        `[awkero_server]: Server is running --> ${chalk.yellow(`http://${ip}:${port}`)}`,
      );
    });
  } catch (err) {
    console.error(err);
  }
}

main();

process.on("unhandledRejection", (err) => {
  console.log(`😈 unhandled Rejection is detected , shutting down ...::`, err);
  if (server) {
    server.close(() => {
      process.exit(1);
    });
  }
  process.exit(1);
});

process.on("uncaughtException", () => {
  console.log(`😈 uncaughtException is detected , shutting down ...::`);
  process.exit(1);
});
