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

    if (!openaiKey) {
      return new Response(JSON.stringify({ error: "OPENAI_API_KEY not configured" }), {
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

    // 3. Transcribe audio via Whisper
    let transcript = result.transcript;

    if (!transcript && result.audio_file_url) {
      // Download audio from storage
      const audioPath = result.audio_file_url.includes("/object/")
        ? result.audio_file_url.split("/object/sign/exam-audio/").pop()?.split("?")[0] ||
          result.audio_file_url.split("/object/public/exam-audio/").pop() || ""
        : result.audio_file_url;

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

    // 4. Evaluate with GPT-4o
    const rubric = clinicalCase?.checklist_rubric || [];
    const systemPrompt = `You are a medical board exam evaluator. You will receive a candidate's transcript from an oral board / OSCE exam and a checklist rubric.

For each item in the rubric, determine if the candidate adequately addressed it. Return a JSON array of objects with these fields:
- "item": the checklist item text
- "passed": boolean
- "comment": brief explanation

Only return valid JSON array, no other text.`;

    const gptRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o",
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

    if (!gptRes.ok) {
      const err = await gptRes.text();
      console.error("GPT error:", err);
      return new Response(JSON.stringify({ error: "GPT evaluation failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const gptData = await gptRes.json();
    let scoreReport;
    try {
      const content = gptData.choices[0].message.content;
      scoreReport = JSON.parse(content.replace(/```json\n?/g, "").replace(/```/g, "").trim());
    } catch {
      scoreReport = [{ item: "Parse error", passed: false, comment: gptData.choices[0].message.content }];
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
