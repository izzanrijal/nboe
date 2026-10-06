import { describe, expect, it } from "vitest";
import { findRubricMatches, buildHighlightSegments, findUnmentionedItems } from "@/lib/rubricHighlight";

const ANSWER = `Pertanyaan 1:

ARNI adalah Angiotensin Receptor-Neprilysin Inhibitor. ARNI tidak dikombinasi dengan ACE-inhibitor karena keduanya meningkatkan bradikinin. Efek anti-inflamasi statin menurunkan CRP dan IL-6.`;

describe("highlight is driven by the candidate's grading, not the AI answer text", () => {
  it("marks a line the candidate missed, even though the ideal answer contains it", () => {
    const matches = findRubricMatches(ANSWER, [
      { item: "Menyebutkan: efek anti-inflamasi statin menurunkan CRP dan IL-6.", coverage: "none" },
    ]);
    const segments = buildHighlightSegments(ANSWER, matches);
    // The phrase IS in the model answer (so it can be located)...
    expect(matches[0].matched).toBe(true);
    // ...but the candidate never said it, so it is a gap and gets highlighted.
    expect(matches[0].coveredByCandidate).toBe(false);
    expect(segments.some((s) => s.highlighted)).toBe(true);
    expect(findUnmentionedItems(matches)).toHaveLength(1);
  });

  it("does not highlight a line the candidate already covered", () => {
    const matches = findRubricMatches(ANSWER, [
      { item: "Menyebutkan: ARNI = Angiotensin Receptor-Neprilysin Inhibitor.", coverage: "full" },
    ]);
    expect(matches[0].matched).toBe(true);
    expect(matches[0].coveredByCandidate).toBe(true);
    // Nothing to learn here, so nothing is highlighted and nothing is listed.
    expect(buildHighlightSegments(ANSWER, matches).some((s) => s.highlighted)).toBe(false);
    expect(findUnmentionedItems(matches)).toHaveLength(0);
  });

  it("trusts the candidate verdict instead of inferring it from the answer text", () => {
    // The regression that caused the hallucination report: the model answer
    // contains IL-6/CRP, so text matching alone claimed the candidate said them.
    const matches = findRubricMatches(ANSWER, [
      { item: "Menyebutkan: penurunan CRP dan IL-6.", coverage: "none" },
      { item: "Menyebutkan: dosis sacubitril valsartan 97/103 mg.", coverage: "full", passed: true },
    ]);
    expect(matches[0].coveredByCandidate).toBe(false);
    expect(findUnmentionedItems(matches).map((m) => m.item.item)).toEqual([
      "Menyebutkan: penurunan CRP dan IL-6.",
    ]);
    expect(matches[1].coveredByCandidate).toBe(true);
  });

  it("treats a partial mention as covered, so it is not shown as a gap", () => {
    const matches = findRubricMatches(ANSWER, [
      { item: "Menyebutkan: efek anti-inflamasi statin menurunkan CRP dan IL-6.", coverage: "partial" },
    ]);
    expect(matches[0].coveredByCandidate).toBe(true);
    expect(findUnmentionedItems(matches)).toHaveLength(0);
  });

  it("falls back to the report's passed flag when coverage is absent", () => {
    const missed = findRubricMatches(ANSWER, [{ item: "Menyebutkan: bradikinin.", passed: false }]);
    expect(missed[0].coveredByCandidate).toBe(false);
    const covered = findRubricMatches(ANSWER, [{ item: "Menyebutkan: bradikinin.", passed: true }]);
    expect(covered[0].coveredByCandidate).toBe(true);
  });
});

describe("tolerance for Whisper speech-to-text artefacts", () => {
  it("matches despite the common neprilysin/neprilisin spelling slip", () => {
    const matches = findRubricMatches(
      "ARNI yaitu sacubitril menghambat neprilisin yang juga mendegradasi bradikinin",
      [{ item: "Menyebutkan: ARNI (Sacubitril) menghambat neprilysin." }],
    );
    expect(matches[0].matched).toBe(true);
  });

  it("matches when punctuation and capitalisation are missing", () => {
    const matches = findRubricMatches(
      "arni angiotensin receptor neprilysin inhibitor",
      [{ item: "Menyebutkan: ARNI = Angiotensin Receptor-Neprilysin Inhibitor." }],
    );
    expect(matches[0].matched).toBe(true);
  });

  it("matches across filler words inserted by transcription", () => {
    const matches = findRubricMatches(
      "jadi gini ya dok washout period itu tiga puluh enam jam",
      [{ item: "harus ada washout period 36 jam" }],
    );
    expect(matches[0].matched).toBe(true);
  });

  it("does not match a genuinely absent concept", () => {
    const matches = findRubricMatches(
      "pasien saya beri aspirin lalu saya rujuk",
      [{ item: "Menyebutkan: washout period 36 jam sebelum beralih ke ARNI." }],
    );
    expect(matches[0].matched).toBe(false);
  });

  it("accepts a true evidence quote and ignores a fabricated one", () => {
    const transcript = "pasien saya beri aspirin";
    const real = findRubricMatches(transcript, [{ item: "x", evidenceQuote: "aspirin" }]);
    expect(real[0].matched).toBe(true);

    const fake = findRubricMatches(transcript, [
      { item: "Menyebutkan: bradikinin meningkat", evidenceQuote: "kalimat yang tidak ada" },
    ]);
    expect(fake[0].matched).toBe(false);
  });
});
