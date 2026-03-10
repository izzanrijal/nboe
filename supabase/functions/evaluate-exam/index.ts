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

    // 2. Fetch session → case (including answer_key_text)
    const { data: session } = await supabase
      .from("exam_sessions").select("case_id").eq("id", result.session_id).single();
    const { data: clinicalCase } = await supabase
      .from("clinical_cases").select("checklist_rubric, title, questions_text, answer_key_text").eq("id", session!.case_id).single();

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

    // 4. Parse rubric
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

    const answerKey = clinicalCase?.answer_key_text || "";
    const questions = clinicalCase?.questions_text || "";

    // 5. Build system prompt with answer key grading
    const systemPrompt = buildSystemPrompt(rubricData, answerKey, questions);
    const userContent = buildUserContent(clinicalCase, rubricData, answerKey, questions, transcript);

    // 6. Call Lovable AI Gateway
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
      scoreReport = { items: [], totalScore: 0, totalPossible: 0, score: 0, passStatus: "TIDAK LULUS", hasCriticalFail: false, reasoning: "Failed to parse AI response", tips: "" };
    }

    // 7. Update exam_results
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

function buildSystemPrompt(rubricData: RubricData, answerKey: string, questions: string): string {
  const hasRubric = rubricData.enabled && rubricData.items.length > 0;
  const hasAnswerKey = answerKey.trim().length > 0;

  let prompt = `You are an objective medical examiner evaluating a candidate's oral exam transcript.

SCORING RULES:
- Score range: 0-100
- Score >= 68 = "LULUS" (pass), Score < 68 = "TIDAK LULUS" (fail)
- Score 100 ONLY if ALL critical points from the answer key are correctly and thoroughly explained
- If any rubric item marked as "isCritical" is failed, the candidate automatically gets "TIDAK LULUS" regardless of score
`;

  if (hasAnswerKey) {
    prompt += `
You will receive the QUESTIONS and the ANSWER KEY (correct answers). Compare the candidate's transcript against the answer key to determine accuracy and completeness.
`;
  }

  if (hasRubric) {
    prompt += `
You will also receive a weighted checklist rubric. Each rubric item has:
- "text": the expected action/phrase
- "points": the weight/score for this item
- "isCritical": if true, failing this item means automatic TIDAK LULUS

Evaluate each rubric item against the transcript.
`;
  }

  prompt += `
IMPORTANT: You must provide DETAILED per-topic/per-question analysis. Break down your evaluation into logical clinical topics (e.g. Anamnesis, Pemeriksaan Fisik, Diagnosis, Tatalaksana, Edukasi Pasien, etc.) based on the questions and answer key provided.

For EACH topic, you must:
1. Summarize what the candidate actually said
2. Compare it against the expected answer
3. Identify specific gaps (points missed or incomplete)
4. Identify misconceptions (incorrect understanding or wrong statements)
5. Give a per-topic score (0-100)
6. Write detailed feedback text explaining the evaluation

Return a JSON object with these fields:
{
  "items": [
    { "item": "checklist/evaluation point", "passed": boolean, "comment": "brief explanation", "points": number, "isCritical": boolean }
  ],
  "totalScore": number,
  "totalPossible": number,
  "score": number,
  "passStatus": "LULUS" | "TIDAK LULUS",
  "hasCriticalFail": boolean,
  "reasoning": "Ringkasan keseluruhan penilaian dalam Bahasa Indonesia. Jelaskan mengapa nilai ini diberikan dengan merujuk bagian spesifik dari jawaban kandidat dibandingkan kunci jawaban.",
  "detailedFeedback": [
    {
      "topic": "Nama topik klinis (e.g. 'Anamnesis', 'Diagnosis Banding', 'Tatalaksana')",
      "questionRef": "Referensi pertanyaan terkait jika ada (e.g. 'Pertanyaan 1')",
      "candidateAnswer": "Ringkasan singkat apa yang dijawab peserta untuk topik ini",
      "expectedAnswer": "Ringkasan singkat jawaban yang benar dari kunci jawaban untuk topik ini",
      "gaps": ["Poin spesifik yang terlewat atau tidak lengkap"],
      "misconceptions": ["Kesalahan pemahaman konsep yang terdeteksi, jika ada"],
      "score": number (0-100 per topik),
      "feedbackText": "Penjelasan detail evaluasi per topik dalam Bahasa Indonesia. Jelaskan apa yang benar, apa yang salah, dan bagaimana seharusnya."
    }
  ],
  "overallStrengths": ["Kekuatan utama kandidat yang sudah baik (dalam Bahasa Indonesia)"],
  "overallWeaknesses": ["Kelemahan utama kandidat secara keseluruhan (dalam Bahasa Indonesia)"],
  "prioritizedImprovements": ["Saran perbaikan diurutkan dari yang paling kritis dan mendesak (dalam Bahasa Indonesia)"],
  "tips": "Ringkasan saran perbaikan umum dalam Bahasa Indonesia"
}

RULES:
- "score" is a 0-100 percentage reflecting overall answer quality
- "passStatus" must be "LULUS" if score >= 68 and no critical fails, otherwise "TIDAK LULUS"
- ALL text fields (reasoning, tips, feedbackText, gaps, misconceptions, strengths, weaknesses, improvements) MUST be in Bahasa Indonesia
- "detailedFeedback" must have at least one entry per major clinical topic covered in the questions/answer key
- Be specific and concrete — avoid vague statements like "kurang lengkap". Instead say exactly WHAT was missing.
- "gaps" should list the SPECIFIC points from the answer key that the candidate missed
- "misconceptions" should only include things the candidate said that are factually WRONG, not just incomplete

Only return valid JSON, no other text.`;

  return prompt;
}

function buildUserContent(
  clinicalCase: any,
  rubricData: RubricData,
  answerKey: string,
  questions: string,
  transcript: string | null
): string {
  let content = `Case: ${clinicalCase?.title}\n\n`;

  if (questions.trim()) {
    content += `PERTANYAAN (Questions):\n${questions}\n\n`;
  }

  if (answerKey.trim()) {
    content += `KUNCI JAWABAN (Answer Key / Correct Answers):\n${answerKey}\n\n`;
  }

  if (rubricData.enabled && rubricData.items.length > 0) {
    content += `Weighted Checklist Rubric:\n${JSON.stringify(rubricData.items, null, 2)}\n\n`;
  }

  content += `Candidate Transcript:\n${transcript || "(no transcript available)"}`;

  return content;
}
