import { z } from "zod";
import {
  PostType,
  ReactionType,
  Region,
} from "../../../../generated/prisma/client";

const tagSchema = z.object({
  text: z.string(),
  bg: z.string().optional(),
  color: z.string().optional(),
});

export const createPostValidation = z.object({
  region: z.nativeEnum(Region, {
    message: "Region is required",
  }),
  content: z.string().min(1).max(500),

  tags: z.array(tagSchema).max(6).optional(),
  types: z.array(z.nativeEnum(PostType)).optional(),
  ranks: z.array(z.string()).optional(),
  roles: z.array(z.string()).optional(),
});

export const updatePostValidation = z.object({
  content: z.string().min(1).max(500).optional(),

  tags: z.array(tagSchema).max(6).optional(),
  types: z.array(z.nativeEnum(PostType)).optional(),
  ranks: z.array(z.string()).optional(),
  roles: z.array(z.string()).optional(),
});

export type CreatePostPayload = z.infer<typeof createPostValidation>;

export type CreatePostInput = CreatePostPayload & {
  images: string[];
};

export type UpdatePostInput = z.infer<typeof updatePostValidation>;
export type UpdatePostPayload = UpdatePostInput & {
  images: string[];
};

export const reactToPostValidation = z.object({
  type: z.nativeEnum(ReactionType, {
    message: "Reaction type is required",
  }),
});
export type ReactToPostInput = z.infer<typeof reactToPostValidation>;

export const createPostCommentValidation = z.object({
  content: z.string().min(1).max(300),
  parentId: z.string().optional(),
});

export const updatePostCommentValidation = z.object({
  content: z.string().min(1).max(300),
});

export type CreatePostCommentInput = z.infer<
  typeof createPostCommentValidation
>;
export type UpdatePostCommentInput = z.infer<
  typeof updatePostCommentValidation
>;
