import { z } from "zod";

/**
 * CLA Bridge request validation.
 *
 * The estimator autosaves through a route handler, so every field is validated
 * on the server rather than trusted from the client. Limits keep a malicious
 * payload from turning the JSON columns into an unbounded blob.
 */

export const bridgeLevelSchema = z.enum(["S4", "S5", "S6"]);

export type BridgeLevelValue = z.infer<typeof bridgeLevelSchema>;

const markMapSchema = z
  .record(z.string().max(80), z.string().max(8))
  .refine((value) => Object.keys(value).length <= 60, "Too many subjects");

const cellSchema = z.object({
  got: z.string().max(8),
  total: z.string().max(8),
});

const targetTableSchema = z
  .record(z.string().max(8), z.array(cellSchema).max(7))
  .refine(
    (value) => Object.keys(value).length <= 8,
    "Too many assessment columns",
  );

const targetMapSchema = z
  .record(z.string().max(80), targetTableSchema)
  .refine((value) => Object.keys(value).length <= 60, "Too many subjects");

export const bridgeEstimatePatchSchema = z.object({
  combinationCode: z.string().trim().max(10).optional(),
  marks: markMapSchema.optional(),
  targets: targetMapSchema.optional(),
  goalTargets: markMapSchema.optional(),
  overallTarget: z.string().trim().max(8).optional(),
  usefulnessRating: z.number().int().min(1).max(5).nullable().optional(),
});

export const bridgeSaveRequestSchema = z.object({
  level: bridgeLevelSchema,
  patch: bridgeEstimatePatchSchema,
});
