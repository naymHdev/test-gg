import { z } from "zod";
import { PostType, Region } from "../../../../generated/prisma/client";

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
