const string = { type: "string" };
const number = { type: "number" };
const boolean = { type: "boolean" };
const strings = { type: "array", items: string };
const object = (properties: Record<string, unknown>) => ({ type: "object", properties, required: Object.keys(properties), additionalProperties: false });
export const scoreSchema = object({
  items: {
    type: "array",
    items: object({
      item: string,
      passed: boolean,
      // "full" = the rubric point is properly covered; "partial" = mentioned but
      // incomplete/vague; "none" = not mentioned. Scoring: full=2, partial=1, none=0.
      coverage: { type: "string", enum: ["full", "partial", "none"] },
      comment: string,
      points: number,
      isCritical: boolean,
      evidenceQuote: string,
    }),
  },
  totalScore: number, totalPossible: number, score: number,
  passStatus: { type: "string", enum: ["LULUS", "TIDAK LULUS"] },
  hasCriticalFail: boolean, reasoning: string, tips: string,
  detailedFeedback: { type: "array", items: object({ topic: string, questionRef: string, candidateAnswer: string, expectedAnswer: string, gaps: strings, misconceptions: strings, score: number, feedbackText: string }) },
  overallStrengths: strings, overallWeaknesses: strings, prioritizedImprovements: strings,
});