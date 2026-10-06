import { describe, expect, it } from "vitest";
import { buildHighlightSegments, findRubricMatches, normalize } from "@/lib/rubricHighlight";

describe("rubricHighlight", () => {
  it("normalizes capitalization, whitespace, and punctuation", () => {
    expect(normalize("  Nyeri DADA,\n menjalar! ")).toBe("nyeri dada menjalar");
  });

  it("finds a passed rubric phrase despite capitalization and punctuation", () => {
    const transcript = "Pasien mengalami NYERI DADA, sejak pagi.";
    const [match] = findRubricMatches(transcript, [{ item: "Menyebutkan nyeri dada", passed: true }]);

    expect(match).toMatchObject({ matched: true, matchedText: "NYERI DADA" });
    expect(transcript.slice(match.start, match.end)).toBe("NYERI DADA");
  });

  it("does not match missing or failed rubric items", () => {
    const matches = findRubricMatches("Pasien sesak napas.", [
      { item: "Nyeri dada", passed: true },
      { item: "Sesak napas", passed: false },
    ]);

    expect(matches.map((match) => match.matched)).toEqual([false, false]);
  });

  it("builds ordered segments and retains multiple overlapping matches", () => {
    const transcript = "Nyeri dada menjalar ke lengan kiri.";
    const matches = findRubricMatches(transcript, [
      { item: "Nyeri dada", passed: true },
      { item: "Dada menjalar ke lengan", passed: true },
    ]);
    const segments = buildHighlightSegments(transcript, matches);

    expect(segments.map((segment) => segment.text).join("")).toBe(transcript);
    expect(segments.some((segment) => segment.highlighted && segment.matchedItems.length === 2)).toBe(true);
    expect(matches.every((match) => match.matched)).toBe(true);
  });
  it("uses exact AI evidence for clinically equivalent wording", () => {
    const [match] = findRubricMatches("Saya memberikan oksigen melalui kanul nasal.", [
      { item: "Terapi suplementasi O2", passed: true, evidenceQuote: "memberikan oksigen melalui kanul nasal" },
    ]);
    expect(match.matchedText).toBe("memberikan oksigen melalui kanul nasal");
  });
  it("does not infer PASS evidence from a single overlapping keyword", () => {
    const [match] = findRubricMatches("Nyeri perut.", [{ item: "Nyeri dada", passed: true }]);
    expect(match.matched).toBe(false);
  });
  it("does not highlight fabricated or explicitly empty evidence", () => {
    expect(findRubricMatches("Nyeri dada.", [
      { item: "Nyeri dada", passed: true, evidenceQuote: "Tidak ada nyeri" },
      { item: "Nyeri dada", passed: true, evidenceQuote: "" },
    ]).every((item) => !item.matched)).toBe(true);
  });
});
