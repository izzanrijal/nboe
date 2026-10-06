import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

const openai = read("supabase/functions/_shared/openai.ts");
const modelAnswer = read("supabase/functions/generate-model-answer/index.ts");
const evaluateExam = read("supabase/functions/evaluate-exam/index.ts");
const examChat = read("supabase/functions/exam-chat/index.ts");

describe("OpenAI provider", () => {
  it("uses the OpenAI API base URL", () => {
    expect(openai).toContain("https://api.openai.com/v1");
  });

  it("defaults to the gpt-5.6-luna model", () => {
    expect(openai).toContain('OPENAI_DEFAULT_MODEL = "gpt-5.6-luna"');
  });

  it("authenticates with a Bearer token from OPENAI_API_KEY", () => {
    expect(openai).toContain('Deno.env.get("OPENAI_API_KEY")');
    expect(openai).toMatch(/Authorization: `Bearer \$\{config\.apiKey\}`/);
  });

  it("allows the model and base URL to be overridden by secrets", () => {
    expect(openai).toContain('Deno.env.get("OPENAI_MODEL")');
    expect(openai).toContain('Deno.env.get("OPENAI_BASE_URL")');
  });

  it("calls chat/completions and requests a JSON object for grading", () => {
    expect(openai).toContain("/chat/completions");
    expect(openai).toContain('response_format: { type: "json_object" }');
  });

  it("budgets output tokens for reasoning models", () => {
    expect(openai).toContain("max_completion_tokens");
    expect(openai).not.toMatch(/temperature:/);
  });

  it("retries only transient failures", () => {
    expect(openai).toMatch(/status === 429 \|\| status >= 500/);
    expect(openai).toContain("MESSAGE_MAX_ATTEMPTS");
  });

  it("retries once when the model replies with prose instead of JSON", () => {
    expect(openai).toContain("openAIJson");
    expect(openai).toMatch(/Balas ULANG HANYA dengan objek JSON/);
  });

  it("scans for a balanced JSON object embedded in prose", () => {
    expect(openai).toMatch(/depth \+= 1/);
    expect(openai).toMatch(/inString/);
  });
});

describe("exam AI features use OpenAI, not GripHub or the Lovable gateway", () => {
  for (const [name, source] of [["generate-model-answer", modelAnswer], ["evaluate-exam", evaluateExam], ["exam-chat", examChat]] as const) {
    it(`${name} has no GripHub or Lovable dependency`, () => {
      expect(source).not.toContain("griphub");
      expect(source).not.toContain("GRIPHUB");
      expect(source).not.toContain("ai.gateway.lovable.dev");
      expect(source).not.toContain("LOVABLE_API_KEY");
      expect(source).not.toContain("createResponsesCall");
    });

    it(`${name} requires the OpenAI config`, () => {
      expect(source).toContain("getOpenAIConfig()");
    });
  }

  it("evaluate-exam parses the model reply defensively", () => {
    expect(evaluateExam).toContain("openAIJson");
    expect(evaluateExam).not.toContain("call.result.output");
  });

  it("generate-model-answer still streams and persists the model answer", () => {
    expect(modelAnswer).toContain("examStream");
    expect(modelAnswer).toContain("modelAnswer");
  });

  it("exam-chat falls back to asset replies on provider failure", () => {
    expect(examChat).toContain("assetMatch");
    expect(examChat).toMatch(/catch \(error\)/);
  });
});
