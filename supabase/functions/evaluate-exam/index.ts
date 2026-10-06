import { getExamAiContext, json, corsHeaders, parseRubric, safeUpstreamError } from "../_shared/exam-ai-access.ts";
import { examStream } from "../_shared/exam-stream.ts";
import { getGripHubConfig, gripHubChat, gripHubJson } from "../_shared/griphub.ts";
import { scoreSchema } from "./score-schema.ts";

interface RubricItem { text: string; points: number; isCritical: boolean; }
interface RubricData { enabled: boolean; items: RubricItem[]; }

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { result_id } = await req.json();
    const context = await getExamAiContext(req, result_id);
    if (context.response) return context.response;
    const { admin: supabase, result } = context;
    const gripHub = getGripHubConfig();
    if (!gripHub) return json({ error: "Konfigurasi GripHub belum tersedia. Setel GRIPHUB_API_KEY di Supabase secrets." }, 500);
    const { data: sessionData } = await supabase.from("exam_sessions")
      .select("case_id, session_start_time").eq("id", result.session_id).single();
    if (!sessionData) return json({ error: "Sesi ujian tidak ditemukan." }, 404);
    const [caseResult, answerKeyResult] = await Promise.all([
      supabase.from("clinical_cases").select("title, questions_text, time_limit_seconds").eq("id", sessionData.case_id).single(),
      supabase.from("case_answer_keys").select("answer_key_text, checklist_rubric").eq("case_id", sessionData.case_id).maybeSingle(),
    ]);
    if (caseResult.error) return json({ error: "Soal ujian tidak ditemukan." }, 404);
    if (answerKeyResult.error) return json({ error: "Kunci jawaban gagal dimuat." }, 500);
    const clinicalCase = caseResult.data;
    const answerKeys = answerKeyResult.data;
    let transcript = result.transcript;
    if (!transcript?.trim() && result.audio_file_url) {
      const openaiKey = Deno.env.get("OPENAI_API_KEY");
      if (!openaiKey) return json({ error: "Konfigurasi transkripsi OpenAI belum tersedia." }, 500);
      const { data: audioData, error: audioErr } = await supabase.storage.from("exam-audio").download(result.audio_file_url);
      if (audioErr || !audioData) return json({ error: "Rekaman gagal diunduh." }, 500);
      if (!audioData.size) return json({ error: "Rekaman kosong. Tidak ada jawaban untuk dinilai." }, 400);
      if (audioData.size > 25 * 1024 * 1024) return json({ error: "Rekaman melebihi batas transkripsi 25 MB." }, 400);
      const formData = new FormData();
      const lowerName = String(result.audio_file_url).toLowerCase();
      const isMp4 = /\.(mp4|m4a)$/.test(lowerName) || audioData.type.includes("mp4");
      formData.append("file", audioData, isMp4 ? "audio.mp4" : "audio.webm");
      formData.append("model", "whisper-1");
      const whisperRes = await fetch("https://api.openai.com/v1/audio/transcriptions", {
        method: "POST", headers: { Authorization: `Bearer ${openaiKey}` }, body: formData, signal: req.signal,
      });
      if (!whisperRes.ok) {
        const message = await safeUpstreamError(whisperRes, "Transkripsi OpenAI gagal");
        return json({ error: `Transkripsi OpenAI: ${message}` }, whisperRes.status);
      }
      transcript = (await whisperRes.json()).text;
      if (typeof transcript === "string" && transcript.trim()) {
        const { error } = await supabase.from("exam_results").update({ transcript }).eq("id", result_id);
        if (error) return json({ error: "Transkrip gagal disimpan." }, 500);
      }
    }
    if (typeof transcript !== "string" || !transcript.trim()) return json({ error: "Tidak ada transkrip atau rekaman untuk dinilai." }, 400);
    const items = parseRubric(answerKeys?.checklist_rubric);
    const rubricData = { enabled: items.length > 0, items };
    const answerKey = answerKeys?.answer_key_text || "";
    const questions = clinicalCase?.questions_text || "";
    const systemPrompt = buildSystemPrompt(rubricData, answerKey, questions) + `
Untuk setiap item PASS, evidenceQuote WAJIB berupa kutipan persis dari transkrip, cukup lengkap untuk membuktikan kriteria terpenuhi secara klinis. Sinonim boleh diterima, tetapi bukan hanya satu kata umum. Jika tidak ada bukti, passed=false dan evidenceQuote="". Pertahankan urutan dan teks setiap butir rubrik. Jangan gunakan Markdown bold pada teks jawaban. Batasi uraian tiap topik menjadi 2-4 kalimat.

Balas HANYA dengan satu objek JSON (tanpa pagar kode, tanpa teks lain) dengan skema:
${JSON.stringify(scoreSchema)}`;
    const userContent = buildUserContent(clinicalCase, rubricData, answerKey, questions, transcript);
    return examStream(async () => {
      const scoreReport: any = await gripHubJson(
        gripHub,
        [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent },
        ],
        { signal: req.signal },
      );
      if (!scoreReport || typeof scoreReport !== "object") throw new Error("AI tidak menghasilkan laporan penilaian. Hasil lama tetap tersimpan.");
      const assessed = Array.isArray(scoreReport.items) ? scoreReport.items : [];
      scoreReport.items = (rubricData.enabled ? rubricData.items : assessed).map((item: any, index: number) => {
        const evaluated = assessed[index];
        const quote = typeof evaluated?.evidenceQuote === "string" ? evaluated.evidenceQuote.trim() : "";
        const passed = Boolean(evaluated?.passed && quote && transcript.includes(quote));
        return { item: item.text ?? item.item, points: item.points, isCritical: item.isCritical, passed,
          evidenceQuote: passed ? quote : "", comment: evaluated?.comment ?? "Tidak ditemukan bukti jawaban." };
      });
      scoreReport.totalPossible = scoreReport.items.reduce((sum: number, item: any) => sum + item.points, 0);
      scoreReport.totalScore = scoreReport.items.reduce((sum: number, item: any) => sum + (item.passed ? item.points : 0), 0);
      if (rubricData.enabled) scoreReport.score = scoreReport.totalPossible > 0 ? Math.round(scoreReport.totalScore / scoreReport.totalPossible * 100) : 0;
      scoreReport.hasCriticalFail = scoreReport.items.some((item: any) => item.isCritical && !item.passed);
      scoreReport.passStatus = scoreReport.score >= 68 && !scoreReport.hasCriticalFail ? "LULUS" : "TIDAK LULUS";
      // Re-read to preserve a model answer generated concurrently.
      const { data: latest } = await supabase.from("exam_results").select("ai_score_report").eq("id", result_id).single();
      const cached = latest?.ai_score_report?.modelAnswer;
      if (cached) scoreReport.modelAnswer = cached;
      const { error } = await supabase.from("exam_results").update({ transcript, ai_score_report: scoreReport }).eq("id", result_id);
      if (error) throw new Error("Laporan AI gagal disimpan.");
      return { success: true, score_report: scoreReport };
    });
  } catch (error) {
    if (req.signal.aborted) return new Response(null, { status: 499, headers: corsHeaders });
    return json({ error: error instanceof Error ? error.message : String(error) }, 500);
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
