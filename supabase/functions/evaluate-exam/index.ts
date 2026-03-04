import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { result_id } = await req.json();
    if (!result_id) {
      return new Response(JSON.stringify({ error: "result_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");

    if (!openaiKey) {
      return new Response(JSON.stringify({ error: "OPENAI_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!lovableApiKey) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // 1. Fetch exam result
    const { data: result, error: resultErr } = await supabase
      .from("exam_results")
      .select("*")
      .eq("id", result_id)
      .single();
    if (resultErr || !result) {
      return new Response(JSON.stringify({ error: "Result not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Fetch session → case
    const { data: session } = await supabase
      .from("exam_sessions")
      .select("case_id")
      .eq("id", result.session_id)
      .single();

    const { data: clinicalCase } = await supabase
      .from("clinical_cases")
      .select("checklist_rubric, title")
      .eq("id", session!.case_id)
      .single();

    // 3. Transcribe audio via OpenAI Whisper (not available in Lovable AI Gateway)
    let transcript = result.transcript;

    if (!transcript && result.audio_file_url) {
      const audioPath = result.audio_file_url;

      const { data: audioData, error: audioErr } = await supabase.storage
        .from("exam-audio")
        .download(audioPath);

      if (audioErr) {
        console.error("Audio download error:", audioErr);
        return new Response(JSON.stringify({ error: "Failed to download audio" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Send to Whisper
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
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const whisperData = await whisperRes.json();
      transcript = whisperData.text;
    }

    // 4. Evaluate with Lovable AI Gateway (google/gemini-3-flash-preview)
    const rubric = clinicalCase?.checklist_rubric || [];
    const systemPrompt = `You are an objective medical examiner. Compare the provided transcript against the checklist. Return a JSON array of objects with these fields:
- "item": the checklist item text
- "passed": boolean indicating if the candidate verbally addressed it (use clinical synonym matching)
- "comment": brief explanation

Only return valid JSON array, no other text.`;

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
          {
            role: "user",
            content: `Case: ${clinicalCase?.title}\n\nChecklist Rubric:\n${JSON.stringify(rubric, null, 2)}\n\nCandidate Transcript:\n${transcript || "(no transcript available)"}`,
          },
        ],
        temperature: 0.2,
      }),
    });

    if (!gatewayRes.ok) {
      if (gatewayRes.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limits exceeded, please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (gatewayRes.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required, please add funds to your Lovable AI workspace." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const err = await gatewayRes.text();
      console.error("AI Gateway error:", gatewayRes.status, err);
      return new Response(JSON.stringify({ error: "AI evaluation failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await gatewayRes.json();
    let scoreReport;
    try {
      const content = aiData.choices[0].message.content;
      scoreReport = JSON.parse(content.replace(/```json\n?/g, "").replace(/```/g, "").trim());
    } catch {
      scoreReport = [{ item: "Parse error", passed: false, comment: aiData.choices[0].message.content }];
    }

    // 5. Update exam_results
    const { error: updateErr } = await supabase
      .from("exam_results")
      .update({
        transcript: transcript || null,
        ai_score_report: scoreReport,
      })
      .eq("id", result_id);

    if (updateErr) {
      console.error("Update error:", updateErr);
      return new Response(JSON.stringify({ error: "Failed to save results" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, score_report: scoreReport }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
