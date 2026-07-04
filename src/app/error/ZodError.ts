import { ZodError, ZodIssue } from "zod";
import type { TGenericErrorResponse } from "../interface/error.js";

const handleZodError = (err: ZodError): TGenericErrorResponse => {
  const errorSources = err.issues.map((issue: ZodIssue) => ({
    path: issue.path.join("."),
    message: issue.message,
  }));

  return {
    statusCode: 400,
    message: "Validation Error",
    errorSources,
  };
};

export default handleZodError;
