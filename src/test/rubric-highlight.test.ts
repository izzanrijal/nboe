import { describe, expect, it } from "vitest";
import { findRubricMatches, buildHighlightSegments, findUnmentionedItems } from "@/lib/rubricHighlight";

const ANSWER = `Pertanyaan 1:

ARNI adalah Angiotensin Receptor-Neprilysin Inhibitor. ARNI tidak dikombinasi dengan ACE-inhibitor karena keduanya meningkatkan bradikinin.`;

describe("highlight targets the AI model answer", () => {
  it("highlights a rubric phrase the answer contains", () => {
    const matches = findRubricMatches(ANSWER, [
      { item: "Menyebutkan: ARNI = Angiotensin Receptor-Neprilysin Inhibitor." },
    ]);
    const segments = buildHighlightSegments(ANSWER, matches);
    expect(matches[0].matched).toBe(true);
    expect(matches[0].matchedText.toLowerCase()).toContain("angiotensin");
    expect(segments.some((s) => s.highlighted)).toBe(true);
  });

  it("reports rubric lines the answer does not mention", () => {
    const matches = findRubricMatches(ANSWER, [
      { item: "Menyebutkan: ARNI = Angiotensin Receptor-Neprilysin Inhibitor." },
      { item: "Menyebutkan: washout period 36 jam sebelum beralih ke ARNI." },
    ]);
    const missing = findUnmentionedItems(matches);
    expect(missing).toHaveLength(1);
    expect(missing[0].item.item).toContain("washout");
  });

  it("derives passed from presence in the answer, not a supplied verdict", () => {
    const matches = findRubricMatches(ANSWER, [
      // Claim passed=true but the phrase is absent -> must stay unmentioned.
      { item: "Menyebutkan: dosis sacubitril valsartan 97/103 mg dua kali sehari.", passed: true },
    ]);
    expect(matches[0].passed).toBe(false);
    expect(matches[0].matched).toBe(false);
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
