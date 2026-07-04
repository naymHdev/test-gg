/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable no-unused-vars */
import { ErrorRequestHandler } from "express";
import { ZodError } from "zod";
import config from "../config";
import { TErrorSource } from "../interface/error";
import handleZodError from "../error/ZodError";
import AppError from "../error/AppError";
import { MulterError } from "multer";
import handelMulterError from "../error/MulterError";
import { Prisma } from "../../../generated/prisma/client";
import handlePrismaError from "../error/handlePrismaError";

const globalErrorHandler: ErrorRequestHandler = (err, req, res, next) => {
  let statusCode = 500;
  let message = "Something went wrong!";
  let errorSources: TErrorSource = [
    {
      path: "",
      message: "Something went wrong",
    },
  ];

  if (err instanceof Prisma.PrismaClientValidationError) {
    const simplified = handlePrismaError(err);
    statusCode = simplified.statusCode;
    message = simplified.message;
    errorSources = simplified.errorSources;
  } else if (err instanceof Prisma.PrismaClientKnownRequestError) {
    // P2002 → unique constraint, P2025 → record not found, etc.
    statusCode = err.code === "P2025" ? 404 : 400;
    message = "Database Request Error";
    errorSources = [
      { path: (err.meta?.target as string) ?? "", message: err.message },
    ];
  } else if (err instanceof ZodError) {
    const simplified = handleZodError(err);
    statusCode = simplified.statusCode;
    message = simplified.message;
    errorSources = simplified.errorSources;
  } else if (err instanceof AppError) {
    statusCode = err.statusCode;
    message = err.message;
    errorSources = [{ path: "", message: err.message }];
  } else if (err instanceof MulterError) {
    const simplified = handelMulterError(err);
    statusCode = simplified.statusCode;
    message = simplified.message;
    errorSources = simplified.errorSources;
  } else if (err instanceof Error) {
    message = err.message;
    errorSources = [{ path: "", message: err.message }];
  }

  res.status(statusCode).json({
    success: false,
    message,
    errorSources,
    stack: config.node_env === "development" ? err?.stack : null,
  });
};

export default globalErrorHandler;
