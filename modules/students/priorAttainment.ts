import { z } from "zod";

const scaledScore = z.union([
  z.literal("").transform(() => null),
  z.string().trim().regex(/^\d+$/, "Enter a whole number between 80 and 120.")
    .transform(Number).pipe(z.number().int().min(80).max(120)),
]);

export const priorAttainmentSchema = z.object({
  ks2ReadingScaledScore: scaledScore,
  ks2MathsScaledScore: scaledScore,
});
