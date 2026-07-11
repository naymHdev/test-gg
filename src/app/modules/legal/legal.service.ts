import httpStatus from "http-status";
import AppError from "../../error/AppError";
import { prisma } from "../../../shared/prisma";
import { UpsertLegalDocumentInput } from "./legal.validation";

const LEGAL_DOCUMENT_NOT_FOUND = "Requested legal document was not found";

const getLegalDocumentFromDB = async (type: string, version: string) => {
  if (version === "latest") {
    const document = await prisma.legalDocument.findFirst({
      where: { type, isLatest: true },
    });

    if (!document) {
      throw new AppError(httpStatus.NOT_FOUND, LEGAL_DOCUMENT_NOT_FOUND);
    }

    return document;
  }

  const document = await prisma.legalDocument.findUnique({
    where: { type_version: { type, version } },
  });

  if (!document) {
    throw new AppError(httpStatus.NOT_FOUND, LEGAL_DOCUMENT_NOT_FOUND);
  }

  return document;
};

// ─── Admin dashboard: create/update a legal document version ───────────────

const upsertLegalDocumentIntoDB = async (payload: UpsertLegalDocumentInput) => {
  return prisma.$transaction(async (tx) => {
    if (payload.isLatest) {
      await tx.legalDocument.updateMany({
        where: { type: payload.type, isLatest: true },
        data: { isLatest: false },
      });
    }

    return tx.legalDocument.upsert({
      where: {
        type_version: { type: payload.type, version: payload.version },
      },
      update: {
        content: payload.content,
        isLatest: payload.isLatest,
      },
      create: {
        type: payload.type,
        version: payload.version,
        content: payload.content,
        isLatest: payload.isLatest,
      },
    });
  });
};

export const legalService = {
  getLegalDocumentFromDB,
  upsertLegalDocumentIntoDB,
};
