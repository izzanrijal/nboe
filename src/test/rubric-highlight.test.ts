import { describe, expect, it } from "vitest";
import { findRubricMatches, buildHighlightSegments, findUnmentionedItems } from "@/lib/rubricHighlight";

const ANSWER = `Pertanyaan 1:

Statin menghambat HMG-CoA reduktase sehingga menurunkan sintesis kolesterol.
Statin juga menurunkan CRP dan IL-6 sebagai penanda inflamasi.
Statin menstabilkan plak dan bersifat antitrombotik.
Efek pleiotropik statin meliputi perbaikan fungsi endotel.`;

const ITEMS = [
  { item: "menghambat HMG-CoA reduktase", coverage: "full" as const },
  { item: "menurunkan CRP dan IL-6", coverage: "none" as const },
  { item: "menstabilkan plak", coverage: "partial" as const },
  { item: "bersifat antitrombotik", coverage: "none" as const },
  { item: "efek pleiotropik", coverage: "none" as const },
];

describe("rubricHighlight", () => {
  it("takes coverage from the grading report, never from presence in the answer text", () => {
    const matches = findRubricMatches(ANSWER, ITEMS);
    // "menurunkan CRP dan IL-6" IS in the AI answer, but the candidate never said
    // it — coverage must win, otherwise the panel invents a mention.
    const crp = matches.find((m) => m.item.item.includes("CRP"))!;
    expect(crp.matched).toBe(true);
    expect(crp.coveredByCandidate).toBe(false);
    expect(crp.passed).toBe(false);

    const hmg = matches.find((m) => m.item.item.includes("HMG-CoA"))!;
    expect(hmg.coveredByCandidate).toBe(true);
  });

  it("highlights ONLY the lines the participant actually said", () => {
    const matches = findRubricMatches(ANSWER, ITEMS);
    const segments = buildHighlightSegments(ANSWER, matches);

    const highlighted = segments.filter((s) => s.highlighted).map((s) => s.text.toLowerCase());
    const emphasised = segments.filter((s) => s.emphasised).map((s) => s.text.toLowerCase());

    // Said → highlighted: HMG-CoA reduktase, and "menstabilkan plak" (partial).
    expect(highlighted.some((t) => t.includes("hmg-coa reduktase"))).toBe(true);
    expect(highlighted.some((t) => t.includes("menstabilkan plak"))).toBe(true);

    // NOT said → never highlighted, only emphasised.
    expect(highlighted.some((t) => t.includes("crp"))).toBe(false);
    expect(highlighted.some((t) => t.includes("il-6"))).toBe(false);
    expect(highlighted.some((t) => t.includes("antitrombotik"))).toBe(false);
    expect(highlighted.some((t) => t.includes("pleiotropik"))).toBe(false);

    // Not-said lines are emphasised inline (bold+italic), in the answer text.
    expect(emphasised.some((t) => t.includes("crp dan il-6"))).toBe(true);
    expect(emphasised.some((t) => t.includes("antitrombotik"))).toBe(true);
  });

  it("lists nothing separately when every missed line is rendered inline", () => {
    const matches = findRubricMatches(ANSWER, ITEMS);
    // All missed lines are locatable in the answer, so the inline bold+italic
    // carries them — no separate section is needed.
    expect(findUnmentionedItems(ANSWER, matches)).toHaveLength(0);
  });

  it("still lists missed lines that the answer text does not contain", () => {
    const matches = findRubricMatches(ANSWER, [
      { item: "menjelaskan skor risiko TIMI", coverage: "none" as const },
    ]);
    const unmentioned = findUnmentionedItems(ANSWER, matches);
    expect(unmentioned).toHaveLength(1);
    expect(unmentioned[0].item.item).toContain("TIMI");
  });
});
