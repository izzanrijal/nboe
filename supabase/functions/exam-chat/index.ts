import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { session_id, message } = await req.json();
    if (!session_id || !message) {
      return new Response(JSON.stringify({ error: "Missing session_id or message" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Fetch session → case data
    const { data: session } = await supabase
      .from("exam_sessions")
      .select("case_id")
      .eq("id", session_id)
      .single();

    if (!session) {
      return new Response(JSON.stringify({ error: "Session not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch case + assets
    const [caseResult, assetsResult] = await Promise.all([
      supabase
        .from("clinical_cases")
        .select("title, initial_prompt, questions_text")
        .eq("id", session.case_id)
        .single(),
      supabase
        .from("case_assets")
        .select("asset_type, trigger_keywords")
        .eq("case_id", session.case_id),
    ]);

    const caseData = caseResult.data;
    const assets = assetsResult.data || [];

    if (!caseData) {
      return new Response(JSON.stringify({ reply: "Data kasus tidak ditemukan." }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build available examinations list
    const availableExams = assets
      .map((a: any) => `- ${a.trigger_keywords.join(", ")} (${a.asset_type})`)
      .join("\n");

    const systemPrompt = `Kamu adalah penguji klinis dalam ujian OSCE/OSPE. Jawab pertanyaan kandidat berdasarkan HANYA data kasus yang diberikan.

KASUS: ${caseData.title}
${caseData.initial_prompt}

${caseData.questions_text ? `SOAL:\n${caseData.questions_text}` : ""}

PEMERIKSAAN YANG TERSEDIA:
${availableExams || "Tidak ada pemeriksaan yang tersedia."}

ATURAN:
1. Jika kandidat meminta pemeriksaan fisik/penunjang yang ADA di daftar, berikan hasil/jawaban singkat dan faktual.
2. Jika pemeriksaan TIDAK ADA di daftar, katakan "Pemeriksaan tersebut tidak tersedia dalam skenario ini."
3. Jika kandidat bertanya tentang anamnesis lanjutan, berikan jawaban singkat sesuai konteks kasus.
4. Jangan memberikan diagnosis langsung atau jawaban soal. Kamu hanya menyediakan data tambahan.
5. Jawab dalam bahasa yang sama dengan kandidat. Singkat dan to the point.`;

    // Check keyword match locally
    let assetMatch = null;
    const lowerMsg = message.toLowerCase();
    for (const asset of assets) {
      const keywords = (asset as any).trigger_keywords || [];
      for (const kw of keywords) {
        if (lowerMsg.includes(kw.toLowerCase())) {
          assetMatch = { available: true, asset_type: (asset as any).asset_type, keyword: kw };
          break;
        }
      }
      if (assetMatch) break;
    }

    if (!lovableApiKey) {
      // Fallback without AI: just do keyword matching
      const reply = assetMatch
        ? `Menampilkan ${assetMatch.asset_type}: ${assetMatch.keyword}`
        : "Pemeriksaan tersebut tidak tersedia dalam skenario ini.";
      return new Response(
        JSON.stringify({ reply, asset_match: assetMatch }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Call AI
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: message },
        ],
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429 || aiResponse.status === 402) {
        const reply = assetMatch
          ? `Menampilkan ${assetMatch.asset_type}: ${assetMatch.keyword}`
          : "Pemeriksaan tersebut tidak tersedia.";
        return new Response(
          JSON.stringify({ reply, asset_match: assetMatch }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw new Error(`AI gateway error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const reply = aiData.choices?.[0]?.message?.content || "Maaf, tidak dapat memproses.";

    return new Response(
      JSON.stringify({ reply, asset_match: assetMatch }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("exam-chat error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
