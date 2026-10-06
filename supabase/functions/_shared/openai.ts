/**
 * OpenAI provider for the exam AI features.
 *
 * Uses the project's existing OPENAI_API_KEY (the same key already used for
 * Whisper transcription) against the standard OpenAI API:
 *   base_url = https://api.openai.com/v1
 *   POST /chat/completions   with  Authorization: Bearer <key>
 *
 * This replaced the GripHub/DeepSeek integration, which was reverted because of
 * an unfair floor price. Keep the transport in one place so
 * `generate-model-answer` and `evaluate-exam` share it.
 */

export const OPENAI_DEFAULT_BASE_URL = "https://api.openai.com/v1";
export const OPENAI_DEFAULT_MODEL = "gpt-5.6-luna";

export interface OpenAIConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
}

/**
 * Read OpenAI settings from edge-function secrets so the operator can change
 * them without a redeploy. `OPENAI_MODEL` falls back to `gpt-5.6-luna`.
 */
export function getOpenAIConfig(): OpenAIConfig | null {
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) return null;
  const baseUrl = (Deno.env.get("OPENAI_BASE_URL") || OPENAI_DEFAULT_BASE_URL).replace(/\/+$/, "");
  const model = Deno.env.get("OPENAI_MODEL") || OPENAI_DEFAULT_MODEL;
  return { apiKey, baseUrl, model };
}

export class OpenAIError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "OpenAIError";
    this.status = status;
  }
}

const MESSAGE_MAX_ATTEMPTS = 3;

const isTransientStatus = (status: number) => status === 429 || status >= 500;

/**
 * Ask OpenAI for a completion. Retries only transient failures (network, 429,
 * 5xx) so a flaky moment does not lose an evaluation.
 *
 * Note: reasoning models (the gpt-5.x family) spend the output budget on
 * hidden reasoning first, so `max_completion_tokens` is deliberately generous
 * and `temperature` is omitted (unsupported by some reasoning models).
 */
export async function openAIChat(
  config: OpenAIConfig,
  messages: { role: "system" | "user"; content: string }[],
  options: { json?: boolean; signal?: AbortSignal; maxCompletionTokens?: number; deterministic?: boolean } = {},
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
          max_completion_tokens: options.maxCompletionTokens ?? 16000,
          // Grading must be reproducible: the same answer should not score
          // differently between runs. Only `seed` is sent — this reasoning model
          // rejects `temperature` ("Only the default (1) value is supported"),
          // which is why the deterministic flag must never add it back.
          ...(options.deterministic ? { seed: 7 } : {}),
          ...(options.json ? { response_format: { type: "json_object" } } : {}),
        }),
        signal: options.signal,
      });

      if (!response.ok) {
        const raw = await response.text().catch(() => "");
        const detail = raw.slice(0, 500);
        if (isTransientStatus(response.status) && attempt < MESSAGE_MAX_ATTEMPTS) {
          lastError = new OpenAIError(`OpenAI HTTP ${response.status}: ${detail}`, response.status);
          await new Promise((resolve) => setTimeout(resolve, 500 * 2 ** (attempt - 1)));
          continue;
        }
        throw new OpenAIError(
          response.status === 401
            ? "Kunci API OpenAI tidak valid atau belum disetel."
            : response.status === 404
              ? `Model OpenAI "${config.model}" tidak tersedia untuk kunci ini.`
              : `OpenAI gagal (HTTP ${response.status}): ${detail || "tanpa detail"}`,
          response.status,
        );
      }

      const data = await response.json();
      const choice = data?.choices?.[0];
      const content = choice?.message?.content;
      if (typeof content !== "string" || !content.trim()) {
        // Reasoning models can return an empty string when the output budget is
        // exhausted by reasoning; surface that instead of a generic failure.
        if (choice?.finish_reason === "length") {
          throw new OpenAIError("Model kehabisan token sebelum menulis jawaban. Coba lagi.", 502);
        }
        throw new OpenAIError("OpenAI tidak menghasilkan output.", 502);
      }
      return content.trim();
    } catch (error) {
      lastError = error;
      const retryable = !(error instanceof OpenAIError) || isTransientStatus(error.status);
      if (retryable && attempt < MESSAGE_MAX_ATTEMPTS) {
        await new Promise((resolve) => setTimeout(resolve, 500 * 2 ** (attempt - 1)));
        continue;
      }
      throw error;
    }
  }

  throw lastError instanceof Error ? lastError : new OpenAIError("OpenAI gagal.", 502);
}

/**
 * Parse a JSON object out of a model reply, tolerating ```json fences and
 * leading/trailing prose. Scans for the first balanced object (string- and
 * escape-aware) rather than trusting the reply to be pure JSON.
 */
export function parseJsonReply<T = unknown>(raw: string): T {
  const cleaned = raw
    .replace(/^\s*```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();

  try {
    return JSON.parse(cleaned) as T;
  } catch {
    // Fall through to brace scanning.
  }

  const start = cleaned.indexOf("{");
  if (start >= 0) {
    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let i = start; i < cleaned.length; i += 1) {
      const ch = cleaned[i];
      if (escaped) { escaped = false; continue; }
      if (ch === "\\") { escaped = true; continue; }
      if (ch === '"') { inString = !inString; continue; }
      if (inString) continue;
      if (ch === "{") depth += 1;
      else if (ch === "}") {
        depth -= 1;
        if (depth === 0) {
          const candidate = cleaned.slice(start, i + 1);
          try {
            return JSON.parse(candidate) as T;
          } catch {
            break;
          }
        }
      }
    }
  }

  throw new Error("Respons OpenAI bukan JSON yang valid.");
}

/**
 * Ask the model for a JSON object and retry once with a stricter instruction if
 * it replies with prose.
 */
export async function openAIJson<T = unknown>(
  config: OpenAIConfig,
  messages: { role: "system" | "user"; content: string }[],
  options: { signal?: AbortSignal; deterministic?: boolean } = {},
): Promise<T> {
  const first = await openAIChat(config, messages, { json: true, deterministic: options.deterministic, signal: options.signal });
  try {
    return parseJsonReply<T>(first);
  } catch {
    const retryMessages = [
      ...messages,
      { role: "assistant" as const, content: first.slice(0, 500) },
      {
        role: "user" as const,
        content:
          "Jawaban di atas tidak valid JSON. Balas ULANG HANYA dengan objek JSON valid, " +
          "tanpa penjelasan, tanpa pagar kode, tanpa teks lain sebelum atau sesudah JSON.",
      },
    ];
    const second = await openAIChat(config, retryMessages, { json: true, deterministic: options.deterministic, signal: options.signal });
    return parseJsonReply<T>(second);
  }
}
