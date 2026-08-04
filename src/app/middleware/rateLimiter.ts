import rateLimit from "express-rate-limit";

const createRateLimiter = (windowMs: number, limit: number, message?: string) =>
  rateLimit({
    windowMs,
    limit,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      res.status(429).json({
        success: false,
        message: message || "Too many requests, please try again later.",
        errorSources: [
          {
            path: "",
            message: message || "Rate limit exceeded. Please try again later.",
          },
        ],
        stack: null,
      });
    },
  });

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
  global: createRateLimiter(60 * 1000, 100),
  riotVerify: createRateLimiter(
    60 * 1000,
    5,
    "Too many Riot verification attempts, try again in a minute.",
  ),
};

export default createRateLimiter;
