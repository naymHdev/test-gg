import "dotenv/config";
import Redis from "ioredis";
import config from "../app/config";

const redis = new Redis(config.redis.url as string);

redis.on("error", (err) => {
  console.error("Redis connection error:", err);
});

export { redis };
