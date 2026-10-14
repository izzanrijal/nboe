import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.23.8";
import { getRubricQualityError } from "../case-admin/rubric-validation.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-agent-api-key, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const RubricItem = z.object({
  text: z.string().min(10).max(500),
  points: z.number().int().min(1).max(5),
  isCritical: z.boolean(),
});

const MediaNote = z.object({
  description: z.string().min(3).max(300),
  category: z.enum(["case_media", "examination", "additional_info"]).default("examination"),
  trigger_keywords: z.array(z.string().min(2)).default([]),
});

const BodySchema = z.object({
  title: z.string().min(15).max(200),
  exam_mode: z.enum(["oral_board", "osce", "panel_exam"]).default("oral_board"),
  reading_time_minutes: z.number().min(0.25).max(15).optional(),
  time_limit_minutes: z.number().min(0.5).max(30).optional(),
  reading_time_seconds: z.number().int().min(5).max(900).optional(),
  time_limit_seconds: z.number().int().min(30).max(1800).optional(),
  show_results_to_candidate: z.boolean().default(false),
  initial_prompt: z.string().min(1),
  questions_text: z.string().min(1),
  answer_key_text: z.string().min(800),
  // Oral Board: butir objektif kecil, max 2; kosong menonaktifkan daftar tilik.
  checklist_rubric: z
    .object({ items: z.array(RubricItem).min(0).max(100) })
    .optional(),
  media_notes: z.array(MediaNote).default([]),
  created_by_email: z.string().email().optional(),
});

const SCHEMA_DOC = {
  endpoint: "POST /functions/v1/ingest-case",
  auth_header: "X-Agent-Api-Key: <CASE_INGEST_API_KEY>",
  fields: {
    title: "string 15-200 chars, unique. Format: '<TOPIK> — <Skenario> (<Inisial>, <umur> th)'",
    exam_mode: "'oral_board' | 'osce' | 'panel_exam' (default oral_board)",
    reading_time_minutes: "number 0.25-15 (or reading_time_seconds 5-900)",
    time_limit_minutes: "number 0.5-30 (or time_limit_seconds 30-1800)",
    show_results_to_candidate: "boolean, default false",
    initial_prompt: "Oral Board: skenario singkat berisi fakta klinis penting. Mode lain: >=400 chars, >=3 penanda bagian",
    questions_text: "Oral Board: >=1 pertanyaan bernomor, singkat, tanpa jawaban. Mode lain: >=300 chars, >=5 tugas",
    answer_key_text: "string >=800 chars; expected candidate verbalisation, numbers, thresholds",
    checklist_rubric: "OPSIONAL { items: [{ text, points, isCritical }] }: Oral Board 1-100 butir objektif unik, points=2 (lengkap 2 / sebagian 1 / tidak disebut 0), padanan makna diterima; critical hanya inti/keselamatan. Mode lain: 5-7 butir, >=2 critical, total >=10. Kosong -> rubric_mode=none",
    media_notes: "[{ description, category: case_media|examination|additional_info, trigger_keywords: [] }] — informational only, media uploaded manually",
    created_by_email: "optional admin email to own the case",
  },
  quality_gates: [
    "Oral Board: skenario dan pertanyaan sesingkat mungkin tanpa kehilangan fakta penting; >=1 tugas bernomor",
    "Mode lain: initial_prompt >=400 chars, >=3 penanda; questions_text >=300 chars, >=5 tugas",
    "answer_key_text >= 800 chars",
    "checklist_rubric OPTIONAL: Oral Board memakai butir objektif max 2; kosong -> rubric_mode=none",
    "title must be unique (409 otherwise)",
    "inserted as status=draft (menunggu review admin); source=agent_api",
  ],
  responses: { 200: "created", 400: "validation", 401: "bad token", 409: "duplicate title", 500: "server error" },
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const expected = Deno.env.get("CASE_INGEST_API_KEY");
  if (!expected) return json(500, { error: "Server missing CASE_INGEST_API_KEY" });
  const provided = req.headers.get("x-agent-api-key");
  if (!provided || provided !== expected) {
    return json(401, { error: "Invalid or missing X-Agent-Api-Key" });
  }

  if (req.method === "GET") return json(200, SCHEMA_DOC);
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return json(400, { error: "Invalid JSON body" });
  }

  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) {
    return json(400, { error: "Validation failed", details: parsed.error.flatten(), schema: SCHEMA_DOC });
  }
  const data = parsed.data;

  const readingSeconds = data.reading_time_seconds ??
    (data.reading_time_minutes ? Math.round(data.reading_time_minutes * 60) : 180);
  const limitSeconds = data.time_limit_seconds ??
    (data.time_limit_minutes ? Math.round(data.time_limit_minutes * 60) : 600);

  // Quality gates
  const promptUpper = data.initial_prompt.toUpperCase();
  const markers = ["RIWAYAT", "PEMERIKSAAN", "TUGAS", "EKG", "LAB"];
  const hits = markers.filter((m) => promptUpper.includes(m)).length;
  if (data.exam_mode !== "oral_board" && (hits < 3 || data.initial_prompt.length < 400)) {
    return json(400, {
      error: "initial_prompt must include at least 3 of: RIWAYAT, PEMERIKSAAN, TUGAS, EKG, Lab",
    });
  }

  const numberedTasks = (data.questions_text.match(/(^|\n)\s*\d+\./g) || []).length;
  if (data.exam_mode === "oral_board" ? numberedTasks < 1 : numberedTasks < 5 || data.questions_text.length < 300) {
    return json(400, { error: data.exam_mode === "oral_board" ? "At least one numbered task is required" : "questions_text requires >=300 chars and >=5 numbered tasks" });
  }

  const items = data.checklist_rubric?.items ?? [];
  const rubricMode = items.length > 0 ? "checklist" : "none";
  const criticalCount = items.filter((i) => i.isCritical).length;
  const totalPoints = items.reduce((s, i) => s + i.points, 0);

  // Reject a rubric that repeats the same line. Padding to reach a minimum item
  // count by duplicating points penalises the same answer twice and distorts the
  // score, so the duplicate is treated as a generation error.
  const normalizedTexts = items.map((i) => (i.text ?? "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim());
  const duplicates = normalizedTexts.filter((t, idx) => t && normalizedTexts.indexOf(t) !== idx);
  if (duplicates.length > 0) {
    return json(400, {
      error: `Rubrik mengandung ${duplicates.length} butir duplikat (contoh: "${duplicates[0].slice(0, 60)}"). Setiap butir harus unik.`,
    });
  }

  const rubricError = getRubricQualityError(items, data.exam_mode);
  if (rubricError) return json(400, { error: rubricError });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  // Uniqueness check
  const { data: existing, error: exErr } = await supabase
    .from("clinical_cases")
    .select("id")
    .eq("title", data.title)
    .maybeSingle();
  if (exErr) return json(500, { error: "DB check failed", detail: exErr.message });
  if (existing) return json(409, { error: "Case with this title already exists", id: existing.id });

  // Owner resolution
  let createdBy: string | null = null;
  const ownerEmail = (data.created_by_email ?? "izzan.rijal@gmail.com").toLowerCase();
  const { data: owner } = await supabase
    .from("profiles")
    .select("id")
    .ilike("email", ownerEmail)
    .maybeSingle();
  if (owner) createdBy = owner.id;

  const rubric = { enabled: items.length > 0, items };

  const { data: inserted, error: insErr } = await supabase
    .from("clinical_cases")
    .insert({
      title: data.title,
      exam_mode: data.exam_mode,
      reading_time_seconds: readingSeconds,
      time_limit_seconds: limitSeconds,
      show_results_to_candidate: data.show_results_to_candidate,
      initial_prompt: data.initial_prompt,
      questions_text: data.questions_text,
      answer_key_text: data.answer_key_text,
      checklist_rubric: rubric,
      created_by: createdBy,
      // Workflow: kiriman agent selalu DRAFT sampai di-review admin
      status: "draft",
      source: "agent_api",
      rubric_mode: rubricMode,
    })
    .select("id, title")
    .single();

  if (insErr) return json(500, { error: "Insert failed", detail: insErr.message });

  // Sync answer key + rubric to grading table
  const { error: akErr } = await supabase.from("case_answer_keys").insert({
    case_id: inserted.id,
    answer_key_text: data.answer_key_text,
    checklist_rubric: rubric,
  });
  if (akErr) console.error(`[ingest-case] answer key sync failed: ${akErr.message}`);

  console.log(
    `[ingest-case] Inserted "${inserted.title}" id=${inserted.id} items=${items.length} points=${totalPoints}`,
  );

  return json(200, {
    id: inserted.id,
    title: inserted.title,
    exam_mode: data.exam_mode,
    reading_time_seconds: readingSeconds,
    time_limit_seconds: limitSeconds,
    status: "draft", // menunggu review admin di halaman admin
    source: "agent_api",
    rubric_mode: rubricMode,
    rubric_items: items.length,
    critical_items: criticalCount,
    total_points: totalPoints,
    answer_key_synced: !akErr,
    media_to_upload_manually: data.media_notes,
  });
});
