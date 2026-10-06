import { describe, expect, it } from "vitest";
import { itemCoverageShare } from "../../supabase/functions/_shared/transcript-match.ts";

/**
 * Regression guard for the ICD primary-prevention complaint: the candidate said
 * "ejeksi fraksi kurang dari 35 ... pengobatan optimal minimal 3 bulan" and was
 * scored 0 because the model's note ("...tetapi tidak menyebut NYHA") was read
 * as "the whole line is absent", which force-zeroed an earned half point.
 */
const TRANSCRIPT =
  "Pemasangan ICD pada primary prevention itu pada pasien heart failure disyaratkan " +
  "dengan ejeksi fraksi kurang dari 35 yang sudah menjalani pengobatan optimal selama " +
  "minimal 3 bulan Terima kasih";

const ICD_LINE_1 =
  "Menyebutkan kriteria inti pencegahan primer: HFrEF dengan LVEF ≤35%, umumnya NYHA II–III, " +
  "telah mendapat GDMT optimal sekurang-kurangnya 3 bulan, serta memiliki harapan hidup " +
  "lebih dari 1 tahun dengan status fungsional yang baik.";

/** Mirrors the grader's coverage decision so the regression is locked in a test. */
const decideCoverage = (note: string, rawCoverage: string, share: number): string => {
  const notesPartialCredit =
    /\b(tetapi|tapi|namun|hanya|sedangkan|walaupun|walau|meski|meskipun|belum lengkap|kurang lengkap)\b/i.test(note);
  const saysAbsent =
    !notesPartialCredit &&
    rawCoverage === "none" &&
    /tidak (disebut|menyebut|ada|ditemukan)|belum (disebut|ada)|tidak dijelaskan|tidak menyebutkan/i.test(note);
  let coverage = saysAbsent || rawCoverage === "none" ? "none" : rawCoverage;
  if (coverage === "none" && !saysAbsent && share > 0) coverage = "partial";
  return coverage;
};

describe("partial credit is not erased by an 'absent' note", () => {
  it("grants the half point when the note names a partial mention", () => {
    const note =
      "Menyebutkan fraksi ejeksi kurang dari 35% dan terapi optimal minimal 3 bulan, tetapi tidak menyebut NYHA II–II";
    const share = itemCoverageShare(TRANSCRIPT, ICD_LINE_1);
    expect(share).toBeGreaterThan(0);
    expect(decideCoverage(note, "none", share)).toBe("partial");
  });

  it("still awards nothing when the line really is untouched", () => {
    const note = "Tidak menyebutkan shared decision-making maupun individualisasi.";
    const share = itemCoverageShare(TRANSCRIPT, "Menyebutkan shared decision-making dengan pasien dan preferensinya.");
    expect(share).toBe(0);
    expect(decideCoverage(note, "none", share)).toBe("none");
  });

  it("keeps a genuine full answer at full", () => {
    expect(decideCoverage("Disebut lengkap.", "full", 1)).toBe("full");
  });
});
