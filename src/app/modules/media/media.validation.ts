import { z } from "zod";
import {
  Language,
  MediaCategory,
  ReactionType,
} from "../../../../generated/prisma/client";

export const createMediaPostValidation = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),

  category: z.nativeEnum(MediaCategory, {
    message: "Category is required",
  }),
  language: z.nativeEnum(Language, {
    message: "Language is required",
  }),

  isPremium: z.boolean().optional(),
});

export const updateMediaPostValidation = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),

  category: z.nativeEnum(MediaCategory).optional(),
  language: z.nativeEnum(Language).optional(),

  isPremium: z.boolean().optional(),
});

export const reactToMediaValidation = z.object({
  type: z.nativeEnum(ReactionType, {
    message: "Reaction type is required",
  }),
});

export type ReactToMediaInput = z.infer<typeof reactToMediaValidation>;
export type CreateMediaPostPayload = z.infer<typeof createMediaPostValidation>;
export type CreateMediaPostInput = CreateMediaPostPayload & {
  images: string[];
};

export type UpdateMediaPostInput = z.infer<typeof updateMediaPostValidation>;
export type UpdateMediaPostPayload = UpdateMediaPostInput & {
  images?: string[];
};

// ----- Comments --------------------------
export const createMediaCommentValidation = z.object({
  content: z.string().min(1).max(300),
  parentId: z.string().optional(),
});

export const updateMediaCommentValidation = z.object({
  content: z.string().min(1).max(300),
});

export type CreateMediaCommentInput = z.infer<
  typeof createMediaCommentValidation
>;
export type UpdateMediaCommentInput = z.infer<
  typeof updateMediaCommentValidation
>;