import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (p: string) => readFileSync(resolve(process.cwd(), p), "utf8");
const results = read("src/components/exam/CandidateResultsList.tsx");
const modelAnswer = read("src/components/exam/ModelAnswerPanel.tsx");

describe("unmentioned rubric lines are bold+italic", () => {
  it("emphasises the rubric text, not just the row", () => {
    // The emphasis must be on the item text itself.
    expect(results).toMatch(/font-bold italic/);
  });

  it("never combines font-normal and font-bold as literal sibling classes", () => {
    // Tailwind emits font-normal after font-bold, so pairing them silently
    // removes the bold and the rubric looks unemphasised. A ternary that picks
    // exactly one of them is the correct shape.
    for (const [name, source] of [["CandidateResultsList", results], ["ModelAnswerPanel", modelAnswer]] as const) {
      const offenders = source
        .split("\n")
        .filter((line) => /className=/.test(line))
        .filter((line) => {
          const literals = line.replace(/\$\{[^}]*\}/g, " ");
          return /font-normal/.test(literals) && /font-bold/.test(literals);
        });
      expect(offenders, `${name} has conflicting font weights:\n${offenders.join("\n")}`).toHaveLength(0);
    }
  });

  it("keeps the weight classes mutually exclusive via a ternary", () => {
    // Either font-normal or font-bold italic is applied, never both.
    expect(results).toMatch(/mentioned \? "font-normal" : "font-bold italic"/);
  });

  it("ModelAnswerPanel lists the unmentioned rubric lines in bold italic", () => {
    expect(modelAnswer).toMatch(/font-bold italic/);
    expect(modelAnswer).toContain("findUnmentionedItems");
  });
});
