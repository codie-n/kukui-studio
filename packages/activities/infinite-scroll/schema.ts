import { z } from "zod";
import { ScoringSchema, AppearanceSchema } from "@kukui/schemas/shared";

const versionRe = /^\d+\.\d+(\.\d+)?$/;

export const InfiniteScrollConfigSchema = z
  .object({
    _comment: z.string().optional(),
    version: z.string().regex(versionRe),
    title: z.string().min(1),
    author: z.string().optional(),
    scoring: ScoringSchema.optional(),
    appearance: AppearanceSchema.default({ theme: "auto" }),
  })
  .strict();

export type InfiniteScrollConfig = z.infer<typeof InfiniteScrollConfigSchema>;
