import { NextFunction, Request, Response } from "express";
import { ZodObject, ZodRawShape } from "zod";
import catchAsync from "../utils/catchAsync.js";

const validateRequest = (schema: ZodObject<ZodRawShape>) => {
  return catchAsync(
    async (req: Request, _res: Response, next: NextFunction) => {
      req.body = await schema.parseAsync(req.body);
      next();
    },
  );
};

export default validateRequest;
