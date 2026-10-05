import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const WPM = 130; // normal spoken pace

function parseRubric(raw: any): { text: string; points: number; isCritical: boolean }[] {
  const items = raw && !Array.isArray(raw) && typeof raw === "object" ? (raw.enabled ? raw.items : []) : raw;
  if (!Array.isArray(items)) return [];
  return items.map((i: any) =>
    typeof i === "string"
      ? { text: i, points: 10, isCritical: false }
      : {
          text: i.text || i.item_text || "",
          points: i.points ?? i.point_value ?? 10,
          isCritical: !!(i.isCritical ?? i.is_critical ?? i.critical),
        },
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { result_id, force } = await req.json();
    if (!result_id) return json({ error: "result_id required" }, 400);

    const url = Deno.env.get("SUPABASE_URL")!;
    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) return json({ error: "LOVABLE_API_KEY not configured" }, 500);

    const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
    const { data: userData } = await admin.auth.getUser(token);
    const uid = userData?.user?.id;
    if (!uid) return json({ error: "Unauthorized" }, 401);

    const { data: result } = await admin.from("exam_results").select("*").eq("id", result_id).single();
    if (!result) return json({ error: "Result not found" }, 404);
    const { data: isAdmin } = await admin.rpc("has_role", { _user_id: uid, _role: "admin" });
    if (result.candidate_id !== uid && !isAdmin) return json({ error: "Forbidden" }, 403);

    const report = (result.ai_score_report && typeof result.ai_score_report === "object" && !Array.isArray(result.ai_score_report))
      ? result.ai_score_report : {};
    if (report.modelAnswer && !force) return json({ modelAnswer: report.modelAnswer });

    const { data: session } = await admin.from("exam_sessions").select("case_id").eq("id", result.session_id).single();
    if (!session) return json({ error: "Session not found" }, 404);
    const [{ data: cc }, { data: keys }] = await Promise.all([
      admin.from("clinical_cases").select("title, initial_prompt, questions_text, time_limit_seconds").eq("id", session.case_id).single(),
      admin.from("case_answer_keys").select("answer_key_text, checklist_rubric").eq("case_id", session.case_id).maybeSingle(),
    ]);

    const seconds = cc?.time_limit_seconds ?? 360;
    const minutes = Math.max(1, Math.round(seconds / 60));
    const wordBudget = Math.round((seconds / 60) * WPM);
    const rubric = parseRubric(keys?.checklist_rubric);
    const critical = rubric.filter((r) => r.isCritical);

    const prompt = `Anda adalah dokter peserta ujian lisan (oral board) teladan. Simulasikan jawaban LISAN ideal untuk kasus berikut, seolah diucapkan langsung kepada penguji dalam batas waktu ${minutes} menit (${seconds} detik).

ATURAN:
- Bahasa Indonesia, gaya lisan natural, terstruktur, langsung ke poin.
- Panjang maksimal ±${wordBudget} kata (kecepatan bicara normal ${WPM} kata/menit). Jangan melebihi.
${rubric.length ? `- WAJIB mencakup SETIAP butir rubrik di bawah sehingga semua butir LULUS.
- Butir KRITIS wajib disebut eksplisit dan jelas: ${critical.map((c) => `"${c.text}"`).join("; ") || "(tidak ada)"}.` : "- Cakup seluruh poin penting kunci jawaban."}
- Urutkan sesuai pertanyaan. Gunakan judul singkat per bagian (mis. "Pertanyaan 1:").
- Jangan menambahkan penjelasan meta, hanya teks jawaban yang diucapkan.

KASUS: ${cc?.title ?? ""}
${cc?.initial_prompt ? `SKENARIO:\n${cc.initial_prompt}\n` : ""}
${cc?.questions_text ? `PERTANYAAN:\n${cc.questions_text}\n` : ""}
${keys?.answer_key_text ? `KUNCI JAWABAN:\n${keys.answer_key_text}\n` : ""}
${rubric.length ? `RUBRIK:\n${rubric.map((r, i) => `${i + 1}. ${r.text} (${r.points} poin${r.isCritical ? ", KRITIS" : ""})`).join("\n")}` : ""}`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "fetch" },
      body: JSON.stringify({
        model: "openai/gpt-6-astra",
        input: prompt,
        stream: true,
        store: false,
        reasoning: { effort: "low", summary: "auto" },
        include: ["reasoning.encrypted_content"],
      }),
    });
    if (!res.ok || !res.body) {
      const err = await res.text();
      console.error("Gateway error", res.status, err);
      if (res.status === 429) return json({ error: "Terlalu banyak permintaan, coba lagi nanti." }, 429);
      if (res.status === 402) return json({ error: "Kredit AI habis." }, 402);
      return json({ error: "Gagal membuat jawaban AI" }, res.status >= 500 ? 502 : res.status);
    }

    // Consume the SSE stream server-side
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    let text = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.startsWith("data:")) continue;
        const data = line.slice(5).trim();
        if (!data || data === "[DONE]") continue;
        try {
          const ev = JSON.parse(data);
          if (ev.type === "response.output_text.delta") text += ev.delta ?? "";
        } catch { /* ignore */ }
      }
    }
    text = text.trim();
    if (!text) return json({ error: "AI tidak menghasilkan jawaban" }, 502);

    const modelAnswer = {
      text,
      wordCount: text.split(/\s+/).filter(Boolean).length,
      timeLimitSeconds: seconds,
      wpm: WPM,
      generatedAt: new Date().toISOString(),
    };
    await admin.from("exam_results").update({ ai_score_report: { ...report, modelAnswer } }).eq("id", result_id);
    return json({ modelAnswer });
  } catch (e) {
    console.error(e);
    return json({ error: String(e) }, 500);
  }
});
