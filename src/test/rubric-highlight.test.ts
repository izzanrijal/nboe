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

  it("does not match missing rubric items", () => {
    const matches = findRubricMatches("Pasien sesak napas.", [
      { item: "Nyeri dada", passed: true },
      { item: "Sesak napas", passed: false },
    ]);

    expect(matches.map((match) => match.matched)).toEqual([false, true]);
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

  it("ignores a fabricated evidence quote and falls back to phrase matching", () => {
    // A bogus quote must not create a highlight, but it must not block the
    // real phrase either: the transcript does say "Nyeri dada".
    const [match] = findRubricMatches("Nyeri dada.", [
      { item: "Nyeri dada", passed: true, evidenceQuote: "Tidak ada nyeri" },
    ]);
    expect(match.matched).toBe(true);
    expect(match.matchedText).toBe("Nyeri dada");
  });

  it("does not highlight when neither the quote nor the phrase is present", () => {
    const [match] = findRubricMatches("Pasien batuk.", [
      { item: "Nyeri dada", passed: true, evidenceQuote: "Tidak ada nyeri" },
    ]);
    expect(match.matched).toBe(false);
    expect(match.passed).toBe(false);
  });

  it("treats an empty evidence quote as absent", () => {
    const [match] = findRubricMatches("Pasien batuk.", [
      { item: "Nyeri dada", passed: true, evidenceQuote: "" },
    ]);
    expect(match.matched).toBe(false);
  });

  // The highlight is authoritative: the AI verdict must not override what the
  // transcript actually says, in either direction.
  it("marks a rubric item passed only when the transcript mentions it (AI said fail)", () => {
    const [match] = findRubricMatches("Pasien mengeluh nyeri dada.", [
      { item: "Menyebutkan nyeri dada", passed: false },
    ]);
    expect(match.matched).toBe(true);
    expect(match.passed).toBe(true);
  });

  it("marks a rubric item not passed when the transcript is silent (AI said pass)", () => {
    const [match] = findRubricMatches("Pasien datang dengan batuk.", [
      { item: "Menyebutkan nyeri dada", passed: true },
    ]);
    expect(match.matched).toBe(false);
    expect(match.passed).toBe(false);
  });

  it("derives passed from the highlight for every item", () => {
    const matches = findRubricMatches("Nyeri dada dan sesak napas.", [
      { item: "Nyeri dada", passed: true },
      { item: "Riwayat merokok", passed: true },
    ]);
    expect(matches.map((match) => match.passed)).toEqual([true, false]);
  });
});
