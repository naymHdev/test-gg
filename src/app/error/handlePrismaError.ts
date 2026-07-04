import { Prisma } from "../../../generated/prisma/client";
import { TErrorSource, TGenericErrorResponse } from "../interface/error";

const handlePrismaError = (
  err: Prisma.PrismaClientValidationError,
): TGenericErrorResponse => {
  const errorSources: TErrorSource = extractPrismaFields(err.message);

  return {
    statusCode: 400,
    message: "Validation Error",
    errorSources,
  };
};

/**
 * Extracts missing/invalid field info from Prisma's verbose error message.
 * Looks for lines like: `+   fieldName: Type`
 */
const extractPrismaFields = (message: string): TErrorSource => {
  // Match lines like: `+   phone: String`
  const missingFieldRegex = /\+\s+(\w+):\s+(\w+)/g;
  const matches = [...message.matchAll(missingFieldRegex)];

  if (matches.length > 0) {
    return matches.map((match) => ({
      path: match[1],
      message: `Argument \`${match[1]}\` is missing (expected: ${match[2]})`,
    }));
  }

  // Fallback: return the first meaningful line
  return [
    {
      path: "",
      message: "Invalid Prisma query — check required fields",
    },
  ];
};

export default handlePrismaError;
