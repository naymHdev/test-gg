import rateLimit from "express-rate-limit";

/**
 * Factory — call this per-route with the limit that route needs (SRS §20 table).
 * Keeps a single source of truth for "how do we build a limiter" (message shape,
 * standardHeaders, IP resolution) without repeating rateLimit({...}) everywhere.
 */
const createRateLimiter = (windowMs: number, limit: number, message?: string) =>
  rateLimit({
    windowMs,
    limit,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      success: false,
      message: message || "Too many requests, please try again later.",
    },
  });

// Named presets matching the SRS §20 rate-limit table exactly — import the one
// you need instead of writing rateLimit({...}) inline in every routes.ts file.
export const rateLimiter = {
  login: createRateLimiter(
    60 * 1000,
    5,
    "Too many login attempts, try again in a minute.",
  ),
  otpAttempts: createRateLimiter(
    15 * 60 * 1000,
    5,
    "Too many OTP attempts, try again in 15 minutes.",
  ),
  createPost: createRateLimiter(
    60 * 60 * 1000,
    3,
    "You can only create 3 posts per hour.",
  ),
  createReport: createRateLimiter(
    60 * 60 * 1000,
    5,
    "You can only submit 5 reports per hour.",
  ),
  sendMessage: createRateLimiter(
    60 * 1000,
    30,
    "You're sending messages too fast.",
  ),
  uploadPresign: createRateLimiter(
    60 * 60 * 1000,
    10,
    "Upload limit reached, try again later.",
  ),

  // baseline, applied globally in app.ts — generous, just to blunt abuse/bots
  global: createRateLimiter(60 * 1000, 100),
};

export default createRateLimiter;
