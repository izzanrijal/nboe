import { getExamAiContext, json, corsHeaders, parseRubric, safeUpstreamError } from "../_shared/exam-ai-access.ts";
import { examStream } from "../_shared/exam-stream.ts";
import { getOpenAIConfig, openAIChat, openAIJson } from "../_shared/openai.ts";
import { itemCoverageShare, quoteSupportedByTranscript } from "../_shared/transcript-match.ts";
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
    const openai = getOpenAIConfig();
    if (!openai) return json({ error: "Konfigurasi OpenAI belum tersedia. Setel OPENAI_API_KEY di Supabase secrets." }, 500);
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
Untuk SETIAP butir rubrik, isi field "coverage" dengan salah satu:
- "full"    = butir BENAR-BENAR disebut sesuai rubrik (boleh beda kata, yang penting maknanya kena dan lengkap)
- "partial" = butir DISEBUT tetapi belum lengkap / hanya sebagian / masih kabur
- "none"    = butir TIDAK disebut sama sekali
Passed = true hanya bila coverage "full" atau "partial" (coverage "none" -> passed=false).
Sesuaikan "passed" dengan "coverage": full/partial => true, none => false.

PENILAIAN BUTIR (tiap butir maksimal 2 poin):
- "full"    -> disebutkan lengkap (SEMUA sub-syarat butir terpenuhi) => dapat 2 poin
- "partial" -> disebutkan namun tidak lengkap => dapat 1 poin
- "none"    -> tidak disebut => 0 poin
Isi field "points" dengan poin yang DIDAPAT (2, 1, atau 0), bukan poin maksimal. Butir yang hanya "partial" TIDAK boleh diberi 2 poin.

ATURAN PENTING — BUTIR YANG MEMUAT BEBERAPA SUB-SYARAT:
Satu butir rubrik sering memuat 3-6 syarat yang dipisahkan tanda koma, "serta", "atau",
"termasuk", atau titik dua. Butir seperti itu BUKAN all-or-nothing. Nilai berdasarkan
BERAPA BANYAK sub-syarat yang benar-benar disebut:
- Semua sub-syarat disebut                   -> "full"    (2 poin)
- SEBAGIAN sub-syarat disebut (>=1 tapi <semua) -> "partial" (1 poin)
- Tidak satu pun sub-syarat disebut          -> "none"    (0 poin)
JANGAN memberi "none" hanya karena satu sub-syarat terlewat padahal peserta sudah
menyebut sub-syarat lain yang jelas. Contoh: rubrik "HFrEF dengan LVEF <=35%, NYHA II-III,
GDMT optimal >=3 bulan, harapan hidup >1 tahun" — peserta yang menyebut "LVEF <35% dan
GDMT optimal minimal 3 bulan" WAJIB mendapat "partial" (1 poin), bukan "none", karena
2 dari 4 sub-syarat sudah disebut dengan benar.

Setiap butir rubrik WAJIB muncul di "items" dengan urutan dan teks yang persis sama seperti rubrik. Jangan menambah atau mengurangi butir.

Untuk setiap butir dengan coverage "full" atau "partial", evidenceQuote WAJIB berupa POTONGAN PERSIS dari transkrip (salin apa adanya, termasuk salah eja/tanpa tanda baca) yang membuktikan butir tersebut disebut. JANGAN memperbaiki ejaan atau menyusun ulang kalimat saat mengutip. Untuk coverage "none", evidenceQuote="".
Jangan gunakan Markdown bold pada teks jawaban. Batasi uraian tiap topik menjadi 2-4 kalimat.

Balas HANYA dengan satu objek JSON (tanpa pagar kode, tanpa teks lain) dengan skema:
${JSON.stringify(scoreSchema)}`;
    const userContent = buildUserContent(clinicalCase, rubricData, answerKey, questions, transcript);
    return examStream(async () => {
      const scoreReport: any = await openAIJson(
        openai,
        [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent },
        ],
        { deterministic: true, signal: req.signal },
      );
      if (!scoreReport || typeof scoreReport !== "object") throw new Error("AI tidak menghasilkan laporan penilaian. Hasil lama tetap tersimpan.");
      const assessed = Array.isArray(scoreReport.items) ? scoreReport.items : [];
      // Per-reviewer scoring rule: a rubric line is worth up to 2 points.
      //   2 = mentioned fully (the rubric point is really covered)
      //   1 = mentioned but incomplete
      //   0 = not mentioned (shown bold+italic so the candidate knows to say it)
      // The rubric is the source of truth: it must match the case, and we do not
      // hand out the full 2 for a vague or partial mention.
      const FULL_POINTS = 2;
      scoreReport.items = (rubricData.enabled ? rubricData.items : assessed).map((item: any, index: number) => {
        const evaluated = assessed[index];
        const quote = typeof evaluated?.evidenceQuote === "string" ? evaluated.evidenceQuote.trim() : "";
        const note = typeof evaluated?.comment === "string" ? evaluated.comment : "";
        // The transcript is raw Whisper output, so the model's quote is verified
        // with a speech-to-text tolerant comparison rather than an exact match.
        const rawCoverageInitial = String(evaluated?.coverage ?? "").toLowerCase();
        const quoteOk = quote ? quoteSupportedByTranscript(transcript, quote) : false;
        // A note like "menyebut LVEF <35%, tetapi tidak menyebut NYHA" names a
        // PARTIAL mention; treating that as whole-line absence erased the half
        // point the candidate had earned. So only accept the "absent" verdict
        // when the note does not ALSO credit something ("tetapi", "namun",
        // "hanya", "sedangkan", "walaupun"), and never when the model's own
        // coverage field says otherwise.
        const notesPartialCredit = /\b(tetapi|tapi|namun|hanya|sedangkan|walaupun|walau|meski|meskipun|belum lengkap|kurang lengkap)\b/i.test(note);
        const saysAbsent =
          !notesPartialCredit &&
          rawCoverageInitial === "none" &&
          /tidak (disebut|menyebut|ada|ditemukan)|belum (disebut|ada)|tidak dijelaskan|tidak menyebutkan/i.test(note);

        // The MODEL's "coverage" is the primary judgment: it reads the clinical
        // meaning, which is what matters. The transcript check is only a guard
        // against a fabricated quote, never a reason to erase a real mention.
        //
        // Earlier this code required quoteOk for any credit, so an unverifiable
        // quote (common with Whisper's mangled spelling) silently zeroed an item
        // the candidate had actually answered, and the same answer scored
        // differently between runs.
        const rawCoverage = String(evaluated?.coverage ?? "").toLowerCase();
        let coverage: "full" | "partial" | "none";
        if (saysAbsent || rawCoverage === "none") {
          // The model explicitly says it is missing.
          coverage = "none";
        } else if (rawCoverage === "full") {
          coverage = "full";
        } else if (rawCoverage === "partial") {
          coverage = "partial";
        } else if (evaluated?.passed) {
          // Older/looser replies without a coverage field.
          coverage = "partial";
        } else {
          coverage = "none";
        }

        // Safeguard against an all-or-nothing verdict on a many-part rubric
        // line: when the candidate demonstrably said a MEANINGFUL SHARE of the
        // line's own key phrases, a "none" is wrong — the model meant "partial".
        // This is what silently zeroed real answers (e.g. "LVEF <35% + GDMT
        // minimal 3 bulan" scored 0 on a line demanding exactly those criteria).
        if (coverage === "none" && !saysAbsent && itemCoverageShare(transcript, item.text ?? item.item) > 0) {
          coverage = "partial";
        }

        // A quote that we CAN verify but that the model called absent means the
        // candidate did say it. Never let that cost the point outright.
        if (coverage === "none" && !saysAbsent && quoteOk) coverage = "partial";

        const passed = coverage !== "none";
        const points = coverage === "full" ? FULL_POINTS : coverage === "partial" ? 1 : 0;
        return {
          item: item.text ?? item.item,
          points,
          maxPoints: FULL_POINTS,
          isCritical: item.isCritical,
          passed,
          coverage,
          evidenceQuote: coverage !== "none" && quoteOk ? quote : "",
          comment: note || (coverage === "full" ? "Disebut lengkap." : coverage === "partial" ? "Disebut namun belum lengkap." : "Tidak disebutkan."),
        };
      });
      // `points` is the earned score, `maxPoints` the ceiling, so totals are
      // straight sums. Each rubric line caps at 2.
      scoreReport.totalPossible = scoreReport.items.reduce((sum: number, item: any) => sum + (item.maxPoints ?? 2), 0);
      scoreReport.totalScore = scoreReport.items.reduce((sum: number, item: any) => sum + (item.points ?? 0), 0);
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

IMPORTANT — SOURCE OF THE TEXT:
The "Candidate Transcript" is an AUTOMATIC SPEECH-TO-TEXT TRANSCRIPT (OpenAI Whisper)
of the candidate speaking aloud, not typed text. It therefore contains:
- missing punctuation, run-on sentences and inconsistent capitalisation;
- misspelled or phonetically-spelled medical terms (e.g. "neprilisin" for "neprilysin",
  "angiotensin renin" for "angiotensin receptor", "afeblok" for "AV block");
- filler words, repetition, false starts and truncated words.
You MUST judge the CLINICAL MEANING, not the spelling. A term counts as mentioned when
it is recognisably the same term despite transcription errors, and a concept counts as
explained when the candidate's intent is clear. NEVER fail a rubric item purely because
of spelling, grammar or punctuation. Only fail it when the concept is genuinely absent,
wrong, or contradicted.

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
