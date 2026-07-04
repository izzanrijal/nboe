import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-agent-api-key, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const RubricItem = z.object({
  text: z.string().min(10).max(500),
  points: z.number().int().min(1).max(5),
  isCritical: z.boolean(),
});

const BodySchema = z.object({
  title: z.string().min(15).max(200),
  exam_mode: z.enum(["oral_board", "osce"]).default("oral_board"),
  reading_time_seconds: z.number().int().min(30).max(900).default(180),
  time_limit_seconds: z.number().int().min(120).max(1800).default(600),
  show_results_to_candidate: z.boolean().default(false),
  initial_prompt: z.string().min(400),
  questions_text: z.string().min(300),
  answer_key_text: z.string().min(800),
  checklist_rubric: z.object({ items: z.array(RubricItem).min(15) }),
});

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  const expected = Deno.env.get("CASE_INGEST_API_KEY");
  if (!expected) return json(500, { error: "Server missing CASE_INGEST_API_KEY" });
  const provided = req.headers.get("x-agent-api-key");
  if (!provided || provided !== expected) return json(401, { error: "Invalid or missing X-Agent-Api-Key" });

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return json(400, { error: "Invalid JSON body" });
  }

  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) {
    return json(400, { error: "Validation failed", details: parsed.error.flatten() });
  }
  const data = parsed.data;

  // Quality gates
  const promptUpper = data.initial_prompt.toUpperCase();
  const markers = ["RIWAYAT", "PEMERIKSAAN", "TUGAS", "EKG", "LAB"];
  const hits = markers.filter((m) => promptUpper.includes(m)).length;
  if (hits < 3) {
    return json(400, {
      error: "initial_prompt must include at least 3 of: RIWAYAT, PEMERIKSAAN, TUGAS, EKG, Lab",
    });
  }

  const numberedTasks = (data.questions_text.match(/(^|\n)\s*\d+\./g) || []).length;
  if (numberedTasks < 5) {
    return json(400, { error: "questions_text must contain at least 5 numbered tasks (1., 2., ...)" });
  }

  const items = data.checklist_rubric.items;
  const criticalCount = items.filter((i) => i.isCritical).length;
  const totalPoints = items.reduce((s, i) => s + i.points, 0);
  if (criticalCount < 8) return json(400, { error: `At least 8 rubric items must be isCritical:true (got ${criticalCount})` });
  if (totalPoints < 40) return json(400, { error: `Rubric total points must be >= 40 (got ${totalPoints})` });

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

  const { data: inserted, error: insErr } = await supabase
    .from("clinical_cases")
    .insert({
      title: data.title,
      exam_mode: data.exam_mode,
      reading_time_seconds: data.reading_time_seconds,
      time_limit_seconds: data.time_limit_seconds,
      show_results_to_candidate: data.show_results_to_candidate,
      initial_prompt: data.initial_prompt,
      questions_text: data.questions_text,
      answer_key_text: data.answer_key_text,
      checklist_rubric: data.checklist_rubric,
    })
    .select("id, title")
    .single();

  if (insErr) return json(500, { error: "Insert failed", detail: insErr.message });

  console.log(`[ingest-case] Inserted "${inserted.title}" id=${inserted.id} items=${items.length} points=${totalPoints}`);

  return json(200, {
    id: inserted.id,
    title: inserted.title,
    rubric_items: items.length,
    critical_items: criticalCount,
    total_points: totalPoints,
  });
});
