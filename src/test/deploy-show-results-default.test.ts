import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sessionManager = readFileSync(
  resolve(process.cwd(), "src/components/admin/SessionManager.tsx"),
  "utf8",
);

describe("deploy session result visibility default", () => {
  it("starts the show-results override state as true", () => {
    expect(sessionManager).toMatch(
      /const \[showResultsToCandidateOverride, setShowResultsToCandidateOverride\] = useState\(true\)/,
    );
  });

  it("resets the override back to true after a successful deploy", () => {
    expect(
      sessionManager.match(/setShowResultsToCandidateOverride\(true\)/g)?.length,
    ).toBe(1);
    expect(sessionManager).not.toMatch(
      /setShowResultsToCandidateOverride\(false\)/,
    );
  });
});
