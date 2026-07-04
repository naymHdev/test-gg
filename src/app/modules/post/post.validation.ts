import { z } from "zod";

const tagSchema = z.object({
  text: z.string(),
  bg: z.string().optional(),
  color: z.string().optional(),
});

const createPostValidation = z.object({
  region: z.string({ message: "Region is required" }),
  content: z.string().min(1).max(500),
  imageUrl: z.string().url().optional(),
  tags: z.array(tagSchema).max(6).optional(),
  types: z.array(z.string()).optional(),
  ranks: z.array(z.string()).optional(),
  roles: z.array(z.string()).optional(),
});

// region is immutable after creation — deliberately omitted here
const updatePostValidation = z.object({
  content: z.string().min(1).max(500).optional(),
  imageUrl: z.string().url().optional(),
  tags: z.array(tagSchema).max(6).optional(),
  types: z.array(z.string()).optional(),
  ranks: z.array(z.string()).optional(),
  roles: z.array(z.string()).optional(),
});

export const postValidation = { createPostValidation, updatePostValidation };
