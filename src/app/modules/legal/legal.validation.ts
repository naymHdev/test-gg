import { z } from "zod";

export const getLegalDocumentValidation = z.object({
  version: z.string().min(1).optional().default("latest"),
});

export type GetLegalDocumentQuery = z.infer<typeof getLegalDocumentValidation>;

// ─── Admin dashboard: create/update a legal document version ───────────────

export const upsertLegalDocumentValidation = z.object({
  type: z.enum(["privacy_policy", "terms"]),
  version: z.string().min(1, "version is required").max(20),
  content: z.string().min(1, "content is required"),
  isLatest: z.boolean().optional().default(true),
});

export type UpsertLegalDocumentInput = z.infer<
  typeof upsertLegalDocumentValidation
>;
