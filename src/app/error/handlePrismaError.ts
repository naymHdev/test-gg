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
  // Case 1: missing required field — `+   phone: String`
  const missingFieldRegex = /\+\s+(\w+):\s+(\w+)/g;
  const missingMatches = [...message.matchAll(missingFieldRegex)];

  if (missingMatches.length > 0) {
    return missingMatches.map((match) => ({
      path: match[1],
      message: `Argument \`${match[1]}\` is missing (expected: ${match[2]})`,
    }));
  }

  // Case 2: unknown/invalid argument — `Unknown argument \`contains\`countains`
  const unknownArgRegex = /Unknown argument `(\w+)`/;
  const unknownMatch = message.match(unknownArgRegex);

  if (unknownMatch) {
    return [
      {
        path: unknownMatch[1],
        message: `Invalid argument \`${unknownMatch[1]}\` used in query — check field type (e.g. enum fields don't support string operators like \`contains\`)`,
      },
    ];
  }

  // Case 3: invalid value / type mismatch — `Invalid value for argument \`region\``
  const invalidValueRegex = /Invalid value for argument `(\w+)`/;
  const invalidValueMatch = message.match(invalidValueRegex);

  if (invalidValueMatch) {
    return [
      {
        path: invalidValueMatch[1],
        message: `Invalid value provided for \`${invalidValueMatch[1]}\``,
      },
    ];
  }

  // Fallback: log raw message so it's never silently swallowed again
  console.error("Unhandled Prisma validation message:", message);

  return [
    {
      path: "",
      message: "Invalid Prisma query — check required fields",
    },
  ];
};

export default handlePrismaError;
