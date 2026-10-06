import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
export { corsHeaders };
export const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { ...corsHeaders, "Content-Type": "application/json" },
});

export async function getExamAiContext(req: Request, resultId: unknown) {
  if (typeof resultId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(resultId)) {
    return { response: json({ error: "result_id harus berupa UUID." }, 400) };
  }
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return { response: json({ error: "Konfigurasi layanan ujian belum lengkap." }, 500) };
  const admin = createClient(url, key);
  const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return { response: json({ error: "Silakan masuk kembali." }, 401) };
  const { data: auth, error: authError } = await admin.auth.getUser(token);
  if (authError || !auth.user) return { response: json({ error: "Sesi login berakhir. Silakan masuk kembali." }, 401) };
  const uid = auth.user.id;
  const [{ data: isAdmin }, { data: isMaster }, { data: access }] = await Promise.all([
    admin.rpc("has_role", { _user_id: uid, _role: "admin" }),
    admin.rpc("is_master_admin", { _user_id: uid }),
    admin.from("exam_access").select("allowed").eq("user_id", uid).maybeSingle(),
  ]);
  const { data: result } = await admin.from("exam_results").select("*").eq("id", resultId).single();
  if (!result) return { response: json({ error: "Hasil ujian tidak ditemukan." }, 404) };
  if (result.candidate_id !== uid && !isAdmin && !isMaster) return { response: json({ error: "Anda tidak dapat mengakses hasil ini." }, 403) };
  if (!isAdmin && !isMaster && !access?.allowed) return { response: json({ error: "Akun belum diizinkan menggunakan AI ujian. Hubungi admin utama." }, 403) };
  const { data: session } = await admin.from("exam_sessions")
    .select("case_id, show_results_to_candidate_override").eq("id", result.session_id).single();
  if (!session) return { response: json({ error: "Sesi ujian tidak ditemukan." }, 404) };
  const { data: clinicalCase } = await admin.from("clinical_cases")
    .select("show_results_to_candidate").eq("id", session.case_id).single();
  return { admin, result, session, isAdmin: Boolean(isAdmin || isMaster), canReview: Boolean(isAdmin || isMaster || session.show_results_to_candidate_override || clinicalCase?.show_results_to_candidate) };
}

export async function safeUpstreamError(response: Response, prefix: string) {
  const body = await response.json().catch(() => ({}));
  return typeof body.message === "string" ? body.message
    : typeof body.error?.message === "string" ? body.error.message
    : typeof body.error === "string" ? body.error : `${prefix} (HTTP ${response.status}).`;
}

export function parseRubric(raw: any): { text: string; points: number; isCritical: boolean }[] {
  const items = raw && !Array.isArray(raw) ? (raw.enabled ? raw.items : []) : raw;
  if (!Array.isArray(items)) return [];
  return items.map((item: any) => typeof item === "string" ? { text: item, points: 10, isCritical: false } : {
    text: item.text || item.item_text || item.item || "",
    points: Number(item.points ?? item.point_value ?? 10),
    isCritical: Boolean(item.isCritical ?? item.is_critical ?? item.critical),
  }).filter((item) => item.text && Number.isFinite(item.points) && item.points >= 0);
}