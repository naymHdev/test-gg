import cors from "cors";
import cookieParser from "cookie-parser";
import express, { Express, Request, Response } from "express";
import dotenv from "dotenv";
import helmet from "helmet";
import router from "./app/routes";
import notFound from "./app/middleware/notfound";
import globalErrorHandler from "./app/middleware/globalErrorhandler";
import { rateLimiter } from "./app/middleware/rateLimiter";
import { handleSubscriptionWebhook } from "./app/modules/subscription/subscription.webhook";

dotenv.config();

const app: Express = express();

// Required behind nginx/any reverse proxy (Hetzner setup) — without this,
// req.ip / x-forwarded-for based rate limiting sees nginx's IP, not the client's.
app.set("trust proxy", 1);

app.use(helmet.crossOriginResourcePolicy({ policy: "cross-origin" }));
app.use(
  cors({
    origin: (origin, callback) => callback(null, origin || true),
    credentials: true,
  }),
);

// Stripe needs the raw request body to verify the webhook signature, so this
// must be registered before express.json() below.
app.post(
  "/api/webhooks/stripe/subscription",
  express.raw({ type: "application/json" }),
  async (req: Request, res: Response) => {
    try {
      await handleSubscriptionWebhook(
        req.body,
        req.headers["stripe-signature"] as string,
      );
      res.json({ received: true });
    } catch (error: any) {
      res
        .status(error?.statusCode || 400)
        .json({ received: false, message: error?.message });
    }
  },
);

app.use(express.json({ limit: "500mb" }));
app.use(express.urlencoded({ limit: "500mb", extended: true }));
app.use(cookieParser());
app.use(express.static("public"));

// Baseline abuse protection on every route. Route-specific stricter limits
// (login, createPost, createReport, ...) are layered on top inside each
// module's routes.ts via rateLimiter.<preset> — see middleware/rateLimiter.ts
app.use(rateLimiter.global);

app.get("/", (req: Request, res: Response) => {
  res.status(200).json({
    status: "OK",
    success: true,
    version: "1.0.0",
    author: "SparkTech Agency",
    developer: "SparkTech Agency",
    timestamp: new Date().toISOString(),
    message: "FinderQ Server is running...",
  });
});

app.use("/api", router);
app.use(notFound);
app.use(globalErrorHandler);

export default app;
