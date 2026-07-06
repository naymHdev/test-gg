import "dotenv/config";
import Redis from "ioredis";
import config from "../app/config";

const redis = new Redis(config.redis.url as string, {
  maxRetriesPerRequest: 3,
  retryStrategy(times) {
    const delay = Math.min(times * 200, 2000);
    return delay;
  },
  reconnectOnError(err) {
    console.error("Redis reconnectOnError:", err.message);
    return true;
  },
});

redis.on("connect", () => {
  console.log("✅ Redis: connecting...");
});

redis.on("ready", () => {
  console.log("✅ Redis: connection ready");
});

redis.on("error", (err) => {
  console.error("❌ Redis connection error:", err.message);
});

redis.on("close", () => {
  console.warn("⚠️ Redis connection closed");
});

redis.on("reconnecting", () => {
  console.log("🔄 Redis: reconnecting...");
});

export { redis };

/* 
import { redis } from "../../shared/redis";
import config from "../../app/config";

// OTP set করা
await redis.set(`otp:${phone}`, otp, "EX", config.redis.otpTtl);

// OTP verify করা
const storedOtp = await redis.get(`otp:${phone}`);

// Presence tracking
await redis.set(`presence:${userId}`, "online", "EX", config.redis.presenceTtl);
*/
