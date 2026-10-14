import { z } from "zod";
import { ScoringSchema, AppearanceSchema } from "@kukui/schemas/shared";

const versionRe = /^\d+\.\d+(\.\d+)?$/;

const ScoreBand = z.object({
  from: z.number(),
  to: z.number(),
  message: z.string(),
});

export const EvidenceWeighingConfigSchema = z
  .object({
    _comment: z.string().optional(),
    version: z.string().regex(versionRe),
    title: z.string().min(1),
    author: z.string().optional(),
    claim: z.string().min(1),
    ratings: z
      .array(
        z
          .object({
              id: z.string().min(1),
              label: z.string().min(1),
          })
          .strict(),
      )
      .min(2),
    evidence: z
      .array(
        z
          .object({
            text: z.string().min(1),
            expectedRating: z.string().min(1),
            feedback: z.string().optional(),
          })
          .strict(),
      )
      .min(1),
    behaviour: z
      .object({
        enableRetry: z.boolean().optional(),
        enableSolutionsButton: z.boolean().optional(),
      })
      .strict()
      .optional(),
    ui: z
      .object({
        checkAnswerButton: z.string().optional(),
        showSolutionButton: z.string().optional(),
        tryAgainButton: z.string().optional(),
      })
      .strict()
      .optional(),
    overallFeedback: z.array(ScoreBand).optional(),
    scoring: ScoringSchema.optional(),
    appearance: AppearanceSchema.default({ theme: "auto" }),
  })
  .strict()
  .superRefine((data, ctx) => {
    const validRatings = new Set(data.ratings.map((rating) => rating.id));

    data.evidence.forEach((item, index) => {
      if (!validRatings.has(item.expectedRating)) {
        ctx.addIssue({
          code: "custom",
          path: ["evidence", index, "expectedRating"],
          message: "Expected rating must match a defined rating",
        });
      }
    });
  });

export type EvidenceWeighingConfig = z.infer<typeof EvidenceWeighingConfigSchema>;
