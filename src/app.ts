import cors from "cors";
import cookieParser from "cookie-parser";
import multer from "multer";
import express, { Express, Request, Response } from "express";
import dotenv from "dotenv";
import helmet from "helmet";
import router from "./app/routes";
import notFound from "./app/middleware/notfound";
import globalErrorHandler from "./app/middleware/globalErrorhandler";

dotenv.config();

const app: Express = express();

multer();
app.use(helmet.crossOriginResourcePolicy({ policy: "cross-origin" }));
app.use(
  cors({
    origin: (origin, callback) => callback(null, origin || true),
    credentials: true,
  }),
);

app.use(express.json({ limit: "500mb" }));
app.use(express.urlencoded({ limit: "500mb", extended: true }));
app.use(cookieParser());
app.use(express.static("public"));

app.get("/", (req: Request, res: Response) => {
  res.status(200).json({
    status: "OK",
    success: true,
    version: "1.0.0",
    author: "SparkTech Agency",
    developer: "SparkTech Agency",
    timestamp: new Date().toISOString(),
    message: "Awkero Server is running...",
  });
});

app.use("/api", router);
app.use(notFound);
app.use(globalErrorHandler);

export default app;
