/**
 * GripHub (DeepSeek) provider for the exam AI features.
 *
 * GripHub exposes an OpenAI-compatible surface:
 *   base_url = https://griphubrouter.web.id/v1
 *   POST /chat/completions   with  Authorization: Bearer <key>
 *
 * We keep a single place for the transport so `generate-model-answer` and
 * `evaluate-exam` can share it. Structured grading output is requested with
 * `response_format: json_object` (OpenAI-compatible), then validated by the
 * caller against the rubric.
 */

export const GRIPHUB_DEFAULT_BASE_URL = "https://griphubrouter.web.id/v1";
export const GRIPHUB_DEFAULT_MODEL = "deepseek-v4.1-flash";

export interface GripHubConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
}

/**
 * Read GripHub settings from edge-function secrets so the operator can change
 * them without a redeploy. `GRIPHUB_MODEL` is required in practice — the
 * default is only a fallback so the function fails loudly instead of silently
 * calling a non-existent model.
 */
export function getGripHubConfig(): GripHubConfig | null {
  const apiKey = Deno.env.get("GRIPHUB_API_KEY");
  if (!apiKey) return null;
  const baseUrl = (Deno.env.get("GRIPHUB_BASE_URL") || GRIPHUB_DEFAULT_BASE_URL).replace(/\/+$/, "");
  const model = Deno.env.get("GRIPHUB_MODEL") || GRIPHUB_DEFAULT_MODEL;
  return { apiKey, baseUrl, model };
}

export class GripHubError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "GripHubError";
    this.status = status;
  }
}

const MESSAGE_MAX_ATTEMPTS = 3;

const isTransientStatus = (status: number) => status === 429 || status >= 500;

/**
 * Ask GripHub for a completion. Retries only transient failures (network, 429,
 * 5xx) so a flaky gateway does not lose an evaluation.
 */
export async function gripHubChat(
  config: GripHubConfig,
  messages: { role: "system" | "user"; content: string }[],
  options: { json?: boolean; signal?: AbortSignal; maxTokens?: number } = {},
): Promise<string> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= MESSAGE_MAX_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(`${config.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: config.model,
          messages,
          temperature: 0.2,
          ...(options.maxTokens ? { max_tokens: options.maxTokens } : {}),
          ...(options.json ? { response_format: { type: "json_object" } } : {}),
        }),
        signal: options.signal,
      });

      if (!response.ok) {
        const body = await response.text().catch(() => "");
        const detail = body.slice(0, 500);
        if (isTransientStatus(response.status) && attempt < MESSAGE_MAX_ATTEMPTS) {
          lastError = new GripHubError(`GripHub HTTP ${response.status}: ${detail}`, response.status);
          await new Promise((resolve) => setTimeout(resolve, 500 * 2 ** (attempt - 1)));
          continue;
        }
        throw new GripHubError(
          response.status === 401
            ? "Kunci API GripHub tidak valid atau belum disetel."
            : `GripHub gagal (HTTP ${response.status}): ${detail || "tanpa detail"}`,
          response.status,
        );
      }

      const data = await response.json();
      const content = data?.choices?.[0]?.message?.content;
      if (typeof content !== "string" || !content.trim()) {
        throw new GripHubError("GripHub tidak menghasilkan output.", 502);
      }
      return content.trim();
    } catch (error) {
      lastError = error;
      const retryable = !(error instanceof GripHubError) || isTransientStatus(error.status);
      if (retryable && attempt < MESSAGE_MAX_ATTEMPTS) {
        await new Promise((resolve) => setTimeout(resolve, 500 * 2 ** (attempt - 1)));
        continue;
      }
      throw error;
    }
  }

  throw lastError instanceof Error ? lastError : new GripHubError("GripHub gagal.", 502);
}

/**
 * Parse a JSON object out of a model reply, tolerating ```json fences and
 * leading/trailing prose that some models add despite instructions.
 */
export function parseJsonReply<T = unknown>(raw: string): T {
  const cleaned = raw
    .replace(/^\s*```(?:json)?/i, "")
    .replace(/```\s*$/i, "")
    .trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(cleaned.slice(start, end + 1)) as T;
    }
    throw new Error("Respons GripHub bukan JSON yang valid.");
  }
}
