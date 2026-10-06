import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

const griphub = read("supabase/functions/_shared/griphub.ts");
const modelAnswer = read("supabase/functions/generate-model-answer/index.ts");
const evaluateExam = read("supabase/functions/evaluate-exam/index.ts");
const examChat = read("supabase/functions/exam-chat/index.ts");

describe("GripHub provider", () => {
  it("points at the GripHub OpenAI-compatible base URL", () => {
    expect(griphub).toContain("https://griphubrouter.web.id/v1");
  });

  it("authenticates with a Bearer token from GRIPHUB_API_KEY", () => {
    expect(griphub).toContain('Deno.env.get("GRIPHUB_API_KEY")');
    expect(griphub).toMatch(/Authorization: `Bearer \$\{config\.apiKey\}`/);
  });

  it("allows the model and base URL to be overridden by secrets", () => {
    expect(griphub).toContain('Deno.env.get("GRIPHUB_MODEL")');
    expect(griphub).toContain('Deno.env.get("GRIPHUB_BASE_URL")');
  });

  it("calls the chat/completions path and requests a JSON object for grading", () => {
    expect(griphub).toContain("/chat/completions");
    expect(griphub).toContain('response_format: { type: "json_object" }');
  });

  it("retries only transient failures", () => {
    expect(griphub).toMatch(/status === 429 \|\| status >= 500/);
    expect(griphub).toContain("MESSAGE_MAX_ATTEMPTS");
  });
});

describe("exam AI features use GripHub instead of the Lovable gateway", () => {
  for (const [name, source] of [["generate-model-answer", modelAnswer], ["evaluate-exam", evaluateExam], ["exam-chat", examChat]] as const) {
    it(`${name} has no remaining Lovable gateway dependency`, () => {
      expect(source).not.toContain("ai.gateway.lovable.dev");
      expect(source).not.toContain("LOVABLE_API_KEY");
      expect(source).not.toContain("createResponsesCall");
    });

    it(`${name} requires the GripHub config`, () => {
      expect(source).toContain("getGripHubConfig()");
    });
  }

  it("evaluate-exam parses the model reply defensively", () => {
    expect(evaluateExam).toContain("parseJsonReply");
    expect(evaluateExam).not.toContain("call.result.output");
  });

  it("generate-model-answer still streams and persists the model answer", () => {
    expect(modelAnswer).toContain("examStream");
    expect(modelAnswer).toContain("modelAnswer");
  });
});
