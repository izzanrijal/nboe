import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface RubricItem {
  text: string;
  points: number;
  isCritical: boolean;
}

interface RubricData {
  enabled: boolean;
  items: RubricItem[];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { result_id } = await req.json();
    if (!result_id) {
      return new Response(JSON.stringify({ error: "result_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");

    if (!openaiKey) {
      return new Response(JSON.stringify({ error: "OPENAI_API_KEY not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!lovableApiKey) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // 1. Fetch exam result
    const { data: result, error: resultErr } = await supabase
      .from("exam_results").select("*").eq("id", result_id).single();
    if (resultErr || !result) {
      return new Response(JSON.stringify({ error: "Result not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Fetch session → case
    const { data: session } = await supabase
      .from("exam_sessions").select("case_id").eq("id", result.session_id).single();
    const { data: clinicalCase } = await supabase
      .from("clinical_cases").select("checklist_rubric, title").eq("id", session!.case_id).single();

    // 3. Transcribe audio via OpenAI Whisper
    let transcript = result.transcript;
    if (!transcript && result.audio_file_url) {
      const { data: audioData, error: audioErr } = await supabase.storage
        .from("exam-audio").download(result.audio_file_url);
      if (audioErr) {
        console.error("Audio download error:", audioErr);
        return new Response(JSON.stringify({ error: "Failed to download audio" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const formData = new FormData();
      formData.append("file", audioData, "audio.webm");
      formData.append("model", "whisper-1");
      const whisperRes = await fetch("https://api.openai.com/v1/audio/transcriptions", {
        method: "POST",
        headers: { Authorization: `Bearer ${openaiKey}` },
        body: formData,
      });
      if (!whisperRes.ok) {
        const err = await whisperRes.text();
        console.error("Whisper error:", err);
        return new Response(JSON.stringify({ error: "Whisper transcription failed" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const whisperData = await whisperRes.json();
      transcript = whisperData.text;
    }

    // 4. Parse rubric — support new and legacy format
    const rawRubric = clinicalCase?.checklist_rubric;
    let rubricData: RubricData;

    if (rawRubric && typeof rawRubric === "object" && !Array.isArray(rawRubric) && "enabled" in rawRubric) {
      rubricData = rawRubric as RubricData;
    } else if (Array.isArray(rawRubric)) {
      rubricData = {
        enabled: rawRubric.length > 0,
        items: rawRubric.map((text: string) => ({ text, points: 10, isCritical: false })),
      };
    } else {
      rubricData = { enabled: false, items: [] };
    }

    // 5. Evaluate with Lovable AI Gateway
    let systemPrompt: string;

    if (rubricData.enabled && rubricData.items.length > 0) {
      systemPrompt = `You are an objective medical examiner. Compare the provided transcript against the weighted checklist rubric.

Each rubric item has:
- "text": the expected action/phrase
- "points": the weight/score for this item
- "isCritical": if true, failing this item means the candidate automatically fails

Return a JSON object with these fields:
{
  "items": [
    { "item": "checklist text", "passed": boolean, "comment": "brief explanation", "points": number, "isCritical": boolean }
  ],
  "totalScore": number (sum of passed items' points),
  "totalPossible": number (sum of all items' points),
  "hasCriticalFail": boolean (true if any critical item is not passed)
}

Only return valid JSON, no other text.`;
    } else {
      systemPrompt = `You are an objective medical examiner. Evaluate the candidate's transcript for the given case.
Return a JSON object:
{
  "items": [
    { "item": "aspect evaluated", "passed": boolean, "comment": "brief explanation" }
  ],
  "totalScore": 0,
  "totalPossible": 0,
  "hasCriticalFail": false
}
Only return valid JSON, no other text.`;
    }

    const userContent = rubricData.enabled && rubricData.items.length > 0
      ? `Case: ${clinicalCase?.title}\n\nWeighted Checklist Rubric:\n${JSON.stringify(rubricData.items, null, 2)}\n\nCandidate Transcript:\n${transcript || "(no transcript available)"}`
      : `Case: ${clinicalCase?.title}\n\nCandidate Transcript:\n${transcript || "(no transcript available)"}`;

    const gatewayRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent },
        ],
        temperature: 0.2,
      }),
    });

    if (!gatewayRes.ok) {
      if (gatewayRes.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limits exceeded, please try again later." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (gatewayRes.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const err = await gatewayRes.text();
      console.error("AI Gateway error:", gatewayRes.status, err);
      return new Response(JSON.stringify({ error: "AI evaluation failed" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await gatewayRes.json();
    let scoreReport;
    try {
      const content = aiData.choices[0].message.content;
      scoreReport = JSON.parse(content.replace(/```json\n?/g, "").replace(/```/g, "").trim());
    } catch {
      scoreReport = { items: [{ item: "Parse error", passed: false, comment: aiData.choices[0].message.content }], totalScore: 0, totalPossible: 0, hasCriticalFail: false };
    }

    // 6. Update exam_results
    const { error: updateErr } = await supabase
      .from("exam_results")
      .update({ transcript: transcript || null, ai_score_report: scoreReport })
      .eq("id", result_id);

    if (updateErr) {
      console.error("Update error:", updateErr);
      return new Response(JSON.stringify({ error: "Failed to save results" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, score_report: scoreReport }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
