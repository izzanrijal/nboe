import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { canCandidateViewResultDetails } from "@/lib/resultVisibility";

describe("candidate result detail visibility", () => {
  it("hides details when both the case setting and deployment override are false", () => {
    expect(canCandidateViewResultDetails(false, false)).toBe(false);
  });

  it("shows details when the deployment override is true and the case setting is false", () => {
    expect(canCandidateViewResultDetails(true, false)).toBe(true);
  });

  it("shows details when the case setting is true and the deployment override is false", () => {
    expect(canCandidateViewResultDetails(false, true)).toBe(true);
  });

  it("treats a missing override on old sessions as disabled", () => {
    expect(canCandidateViewResultDetails(undefined, false)).toBe(false);
  });
});

describe("sequence advancement override propagation", () => {
  const migration = readFileSync(
    resolve(
      process.cwd(),
      "supabase/migrations/20260924120000_deploy_show_results_override.sql"
    ),
    "utf8"
  );

  it("inherits the deployment override into sessions created for later questions", () => {
    expect(migration).toMatch(
      /bool_or\(es\.show_results_to_candidate_override\)/
    );
    expect(migration).toMatch(
      /INSERT INTO public\.exam_sessions[\s\S]*show_results_to_candidate_override[\s\S]*_deployment_override/
    );
  });
});
