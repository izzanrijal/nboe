import { describe, expect, it } from "vitest";
import { itemCoverageShare } from "../../supabase/functions/_shared/transcript-match.ts";

/**
 * Real data from the ICD primary-prevention question. The candidate said
 * "ejeksi fraksi kurang dari 35 ... pengobatan optimal selama minimal 3 bulan"
 * — two of the four criteria in rubric line 1 — and was scored 0/2 because the
 * long multi-part line was judged all-or-nothing.
 */
const TRANSCRIPT =
  "Pemasangan ICD pada primary prevention itu pada pasien heart failure disyaratkan " +
  "dengan ejeksi fraksi kurang dari 35 yang sudah menjalani pengobatan optimal selama " +
  "minimal 3 bulan Terima kasih";

const ICD_RUBRIC = [
  "Menyebutkan kriteria inti pencegahan primer: HFrEF dengan LVEF ≤35%, umumnya NYHA II–III, telah mendapat GDMT optimal sekurang-kurangnya 3 bulan, serta memiliki harapan hidup lebih dari 1 tahun dengan status fungsional yang baik.",
  "Menyebutkan bahwa pada kardiomiopati iskemik, ICD tidak dipasang dalam 40 hari pertama setelah infark miokard atau sebelum 3 bulan setelah revaskularisasi (PCI/CABG); setelah periode tersebut dan optimalisasi GDMT, LVEF harus dievaluasi ulang karena dapat membaik.",
  "Menyebutkan pertimbangan khusus etiologi dan kelas fungsional: pada penyakit iskemik dengan NYHA I, ICD dapat dipertimbangkan terutama bila LVEF ≤30% (atau sesuai pedoman/setempat hingga 35%); pada kardiomiopati non-iskemik, respons terhadap GDMT dan LVEF dievaluasi ulang sebelum implantasi.",
  "Menyebutkan bahwa ICD tidak direkomendasikan bila terdapat penyebab reversibel yang belum dikoreksi, pasien belum mendapat GDMT optimal, atau pemasangan dilakukan terlalu dini sehingga peluang pemulihan LVEF masih besar.",
  "Menyebutkan bahwa ICD tidak direkomendasikan bila harapan hidup kurang dari 1 tahun atau status fungsional buruk akibat komorbiditas berat, termasuk penyakit ginjal terminal, malignansi lanjut, frailty berat, atau gangguan psikososial/psikiatri yang menghambat perawatan perangkat.",
  "Menyebutkan bahwa keputusan akhir harus diindividualisasi melalui shared decision-making dengan mempertimbangkan etiologi, komorbiditas, risiko-manfaat, kemampuan mengikuti perawatan device, serta preferensi pasien.",
];

describe("itemCoverageShare", () => {
  it("credits the criteria the candidate actually said (rubric line 1)", () => {
    // LVEF <=35% and GDMT >=3 months were both said; NYHA class and life
    // expectancy were not. That is a partial answer, so share must be > 0.
    expect(itemCoverageShare(TRANSCRIPT, ICD_RUBRIC[0])).toBeGreaterThan(0);
  });

  it("attributes no credit to a line the candidate never touched", () => {
    // Line 5 (life expectancy / comorbidity exclusions) is absent entirely.
    expect(itemCoverageShare(TRANSCRIPT, ICD_RUBRIC[4])).toBe(0);
  });

  it("returns 0 for an empty transcript so it can never invent credit", () => {
    expect(itemCoverageShare("", ICD_RUBRIC[0])).toBe(0);
    expect(itemCoverageShare("   ", ICD_RUBRIC[0])).toBe(0);
  });

  it("keeps a short single-requirement line as a plain containment check", () => {
    const line = "Menyebutkan penggunaan beta-blocker";
    expect(itemCoverageShare("pasien sudah dapat beta blocker sejak awal", line)).toBeGreaterThan(0);
    expect(itemCoverageShare("pasien hanya minum statin", line)).toBe(0);
  });

  it("scales with how many sub-requirements are covered", () => {
    const line =
      "HFrEF dengan LVEF ≤35%, NYHA II–III, GDMT optimal sekurang-kurangnya 3 bulan, harapan hidup lebih dari 1 tahun";
    const twoOfFour = itemCoverageShare(
      "pada pasien HFrEF dengan ejeksi fraksi 35 persen yang sudah mendapat pengobatan optimal minimal 3 bulan",
      line,
    );
    const fourOfFour = itemCoverageShare(
      "HFrEF ejeksi fraksi 35 persen NYHA 2 sampai 3 sudah pengobatan optimal 3 bulan dan harapan hidup lebih dari 1 tahun",
      line,
    );
    expect(twoOfFour).toBeGreaterThan(0);
    expect(fourOfFour).toBeGreaterThanOrEqual(twoOfFour);
  });
});
