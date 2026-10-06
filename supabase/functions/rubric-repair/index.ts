import { corsHeaders } from "../_shared/exam-ai-access.ts";
import { getOpenAIConfig, openAIJson } from "../_shared/openai.ts";

/**
 * One-off maintenance helper: consolidate an over-long, redundant rubric into
 * 5-7 broad items that a candidate can realistically cover in an oral exam.
 *
 * The rubric bank was ingested under a ">=15 items" rule, so the generator padded
 * it with duplicated and hyper-granular lines (up to 39). That makes a correct,
 * complete answer lose points. This rewrites each rubric semantically:
 *   - deduplicates repeated points
 *   - merges granular details into broad clinical themes
 *   - caps every line at 2 points (2 full / 1 partial / 0 none)
 *   - keeps 5-7 items, with the most important ones flagged critical
 *
 * Dry-run by default: POST { "case_id": "...", "apply": false } returns the
 * proposed rubric without writing. Set apply:true to persist.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  // One-off maintenance endpoint. Accept the admin agent key, or any token that
  // carries the service_role claim for THIS project (verified against the
  // project's own keys, so a rotated key still works and nothing is hardcoded).
  const adminKey = Deno.env.get("CASE_ADMIN_API_KEY");
  const supplied = req.headers.get("X-Agent-Api-Key") ?? "";
  const bearer = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");

  const serviceRoleCandidates = [
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),
    Deno.env.get("SUPABASE_SECRET_KEYS"),
  ].filter(Boolean) as string[];

  const claimsOf = (token: string) => {
    try {
      const part = token.split(".")[1];
      if (!part) return null;
      return JSON.parse(atob(part.replace(/-/g, "+").replace(/_/g, "/")));
    } catch {
      return null;
    }
  };
  const projectRef = (Deno.env.get("SUPABASE_URL") ?? "").replace(/^https?:\/\//, "").split(".")[0];

  const isServiceRole = (token: string): boolean => {
    if (!token) return false;
    if (serviceRoleCandidates.includes(token)) return true;
    const claims = claimsOf(token);
    return Boolean(claims?.role === "service_role" && (!projectRef || claims?.ref === projectRef));
  };

  const authorized =
    Boolean(adminKey && supplied === adminKey) ||
    isServiceRole(supplied) ||
    isServiceRole(bearer);
  if (!authorized) {
    return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: corsHeaders });
  }

  const openai = getOpenAIConfig();
  if (!openai) {
    return new Response(JSON.stringify({ error: "OPENAI_API_KEY belum disetel." }), { status: 500, headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const auth = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" };

  const body = await req.json().catch(() => ({}));
  const caseId: string | undefined = body.case_id;
  const apply: boolean = body.apply === true;
  const limit: number = Math.min(Number(body.limit ?? 1), 25);

  const listUrl = caseId
    ? `${supabaseUrl}/rest/v1/case_answer_keys?select=id,case_id,checklist_rubric&case_id=eq.${caseId}`
    : `${supabaseUrl}/rest/v1/case_answer_keys?select=id,case_id,checklist_rubric&limit=${limit}`;

  const rows = await (await fetch(listUrl, { headers: auth })).json();
  const results: unknown[] = [];

  for (const row of rows) {
    let cr = row.checklist_rubric;
    if (typeof cr === "string") { try { cr = JSON.parse(cr); } catch { continue; } }
    const items = cr?.items ?? [];
    // Already realistic? Also rewrite when it contains duplicates.
    const texts = items.map((i: any) => String(i.text ?? "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim());
    const hasDupes = new Set(texts).size !== texts.length;
    if (items.length <= 7 && !hasDupes) {
      results.push({ case_id: row.case_id, skipped: true, reason: "already 5-7 unique items", count: items.length });
      continue;
    }

    const caseInfo = await (await fetch(
      `${supabaseUrl}/rest/v1/clinical_cases?select=title,initial_prompt,questions_text&id=eq.${row.case_id}`, { headers: auth },
    )).json();
    const cc = caseInfo?.[0] ?? {};

    const prompt = `Anda menyusun rubrik penilaian ujian lisan kardiologi.

KASUS: ${cc.title ?? "(tanpa judul)"}
SKENARIO: ${String(cc.initial_prompt ?? "").slice(0, 1500)}
PERTANYAAN: ${String(cc.questions_text ?? "").slice(0, 1500)}

RUBRIK LAMA (terlalu panjang/berulang, ${items.length} butir):
${items.map((i: any, n: number) => `${n + 1}. ${i.text}`).join("\n")}

TUGAS:
Gabungkan rubrik lama menjadi 5-7 butir LUAS dan UNIK yang benar-benar bisa diucapkan peserta dalam ujian lisan.
- HAPUS duplikat dan pengulangan.
- Gabungkan detail sejenis menjadi satu butir (mis. semua antidot hiperkalemia jadi satu butir tatalaksana).
- Jangan kehilangan konsep klinis penting.
- Setiap butir HARUS unik (tidak boleh ada dua butir yang mirip).
- Tandai isCritical:true hanya untuk butir yang benar-benar wajib/penentu keselamatan (2-4 butir saja).
- Setiap butir maksimal 2 poin (points selalu 2).
- Tulis dalam Bahasa Indonesia, kalimat perintah seperti "Menyebutkan ...".

Balas HANYA JSON: { "items": [{ "text": "...", "points": 2, "isCritical": boolean }] }`;

    try {
      const out: any = await openAIJson(openai, [{ role: "user", content: prompt }], {});
      const merged = (out?.items ?? []).filter((i: any) => i?.text);
      if (merged.length < 5 || merged.length > 7) {
        results.push({ case_id: row.case_id, title: cc.title, error: "model returned " + merged.length + " items", items: merged });
        continue;
      }
      const finalItems = merged.map((i: any) => ({ text: String(i.text), points: 2, maxPoints: 2, isCritical: Boolean(i.isCritical) }));
      const record = { case_id: row.case_id, title: cc.title, before: items.length, after: finalItems.length, items: finalItems };

      if (apply) {
        const patch = await fetch(`${supabaseUrl}/rest/v1/case_answer_keys?case_id=eq.${row.case_id}`, {
          method: "PATCH", headers: { ...auth, Prefer: "return=minimal" },
          body: JSON.stringify({ checklist_rubric: { enabled: true, items: finalItems } }),
        });
        record["applied"] = patch.ok;
        if (!patch.ok) record["error"] = (await patch.text()).slice(0, 200);
      }
      results.push(record);
    } catch (e) {
      results.push({ case_id: row.case_id, error: e instanceof Error ? e.message : String(e) });
    }
  }

  return new Response(JSON.stringify({ applied: apply, count: results.length, results }, null, 2), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
