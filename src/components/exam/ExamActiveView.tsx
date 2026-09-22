import { useEffect, useCallback, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import CountdownTimer from "@/components/station/CountdownTimer";
import ChatInput from "@/components/exam/ChatInput";
import useMediaRecorder from "@/hooks/useMediaRecorder";
import useAudioLevel from "@/hooks/useAudioLevel";

import { toast } from "sonner";
import { Mic, MicOff, Monitor, AlertCircle, CheckCircle2, LogOut, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface ExamActiveViewProps {
  sessionId: string;
  sessionStartTime: string;
  timeLimitSeconds: number;
  candidateId: string;
  audioStream: MediaStream;
  caseTitle?: string;
  casePrompt?: string;
  questionsText?: string;
  onForceClose: () => void;
  onComplete: () => void;
}

interface ChatMessage {
  type: "user" | "system";
  text: string;
  available?: boolean;
  loading?: boolean;
}

const ExamActiveView = ({
  sessionId,
  sessionStartTime,
  timeLimitSeconds,
  candidateId,
  audioStream,
  caseTitle,
  casePrompt,
  questionsText,
  onForceClose,
  onComplete,
}: ExamActiveViewProps) => {
  const { isRecording, chunkCount, recordedBytes, error: recorderError, start, stop } = useMediaRecorder();
  const { level, hasRecentSound } = useAudioLevel(audioStream);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const completingRef = useRef(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [showCase, setShowCase] = useState(true);
  const [isLastCase, setIsLastCase] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState("");

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Mark session active so the display screen follows along
  useEffect(() => {
    supabase
      .from("exam_sessions")
      .update({ status: "active" })
      .eq("id", sessionId)
      .then(({ error }) => {
        if (error) console.warn("Failed to mark session active:", error);
      });
  }, [sessionId]);

  // Determine if this is the last case of a sequence (label on the end button)
  useEffect(() => {
    const checkSequence = async () => {
      const { data: session } = await supabase
        .from("exam_sessions")
        .select("station_token")
        .eq("id", sessionId)
        .maybeSingle();
      if (!session?.station_token) return;

      const { data: items } = await supabase
        .from("exam_sequence_items")
        .select("sequence_order, session_id")
        .eq("station_token", session.station_token)
        .order("sequence_order", { ascending: true });

      if (!items || items.length <= 1) return;
      const current = items.find((i) => i.session_id === sessionId);
      if (!current) return;
      setIsLastCase(!items.some((i) => i.sequence_order > current.sequence_order));
    };
    checkSequence();
  }, [sessionId]);

  // Start recording + join channel
  useEffect(() => {
    start(audioStream);

    const channel = supabase.channel(`session:${sessionId}`);
    channelRef.current = channel;

    channel
      .on("broadcast", { event: "asset_response" }, (payload) => {
        const data = payload.payload as { available: boolean; message: string };
        setMessages((prev) => {
          const filtered = prev.filter((m) => !m.loading);
          return [...filtered, { type: "system", text: data.message, available: data.available }];
        });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionId, audioStream, start]);

  // Live speech-to-text preview (browser) — confirms the voice is being captured.
  // The authoritative transcript is produced server-side from the recording.
  useEffect(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    let stopped = false;
    let recognition: any;
    try {
      recognition = new SR();
      recognition.lang = "id-ID";
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.onresult = (event: any) => {
        let text = "";
        for (let i = 0; i < event.results.length; i++) {
          text += event.results[i][0].transcript + " ";
        }
        setLiveTranscript(text.trim().slice(-600));
      };
      recognition.onend = () => {
        if (!stopped) {
          try {
            recognition.start();
          } catch {
            /* ignore restart race */
          }
        }
      };
      recognition.start();
    } catch (err) {
      console.warn("Live speech-to-text unavailable:", err);
    }
    return () => {
      stopped = true;
      try {
        recognition?.stop();
      } catch {
        /* ignore */
      }
    };
  }, []);



  // Save chat message to database (fire-and-forget)
  const persistChat = useCallback(
    (sender: "user" | "system", message: string) => {
      supabase
        .from("chat_messages")
        .insert({ session_id: sessionId, sender, message })
        .then(({ error }) => {
          if (error) console.warn("Failed to persist chat:", error);
        });
    },
    [sessionId]
  );

  // Send chat message — call AI edge function
  const handleSendMessage = useCallback(
    async (message: string) => {
      setMessages((prev) => [...prev, { type: "user", text: message }]);
      persistChat("user", message);

      // Add loading indicator
      setMessages((prev) => [...prev, { type: "system", text: "Memproses...", loading: true }]);

      try {
        const { data, error } = await supabase.functions.invoke("exam-chat", {
          body: { session_id: sessionId, message },
        });

        if (error) throw error;

        const reply = data?.reply || "Maaf, tidak dapat memproses permintaan Anda.";
        const assetMatch = data?.asset_match;

        // Remove loading, add AI reply
        setMessages((prev) => {
          const filtered = prev.filter((m) => !m.loading);
          return [
            ...filtered,
            {
              type: "system" as const,
              text: reply,
              available: assetMatch?.available ?? false,
            },
          ];
        });

        persistChat("system", reply);

        // If asset matched, broadcast to station display
        if (assetMatch?.available && channelRef.current) {
          channelRef.current.send({
            type: "broadcast",
            event: "chat",
            payload: { message },
          });
        }
      } catch (err) {
        console.error("AI chat error:", err);
        // Fallback: broadcast to station for keyword matching
        channelRef.current?.send({
          type: "broadcast",
          event: "chat",
          payload: { message },
        });
      }
    },
    [sessionId, persistChat]
  );

  // Complete exam — shared logic (Fix #4: require audio)
  const completeExam = useCallback(async () => {
    if (completingRef.current) return;
    completingRef.current = true;
    setSubmitting(true);

    const submitResult = async (fileName: string | null) => {
      const { data, error } = await supabase
        .from("exam_results")
        .insert({
          session_id: sessionId,
          candidate_id: candidateId,
          audio_file_url: fileName,
        })
        .select("id")
        .maybeSingle();

      if (error) {
        console.error("Result insert error:", error);
        return;
      }

      // Kick off transcription + AI grading (voice-to-text) without blocking the candidate
      if (data?.id && fileName) {
        supabase.functions
          .invoke("evaluate-exam", { body: { result_id: data.id } })
          .then(({ error: evalError }) => {
            if (evalError) console.warn("Auto evaluation failed:", evalError);
          });
      }
    };

    try {
      let fileName: string | null = null;
      const blob = await stop();

      if (blob && blob.size > 0) {
        const extension = blob.type.includes("mp4") ? "mp4" : "webm";
        fileName = `${sessionId}_${candidateId}_${Date.now()}.${extension}`;
        const { error: uploadError } = await supabase.storage
          .from("exam-audio")
          .upload(fileName, blob, { contentType: blob.type || "audio/webm" });
        if (uploadError) {
          console.error("Upload error:", uploadError);
          toast.error("Gagal mengunggah rekaman audio. Mencoba ulang...");
          // Retry once
          const { error: retryError } = await supabase.storage
            .from("exam-audio")
            .upload(fileName, blob, { contentType: blob.type || "audio/webm", upsert: true });
          if (retryError) {
            console.error("Retry upload error:", retryError);
            fileName = null;
          }
        }
      }

      if (!fileName) {
        console.warn("No audio recorded — submitting without audio");
        toast.error("Peringatan: Rekaman audio tidak tersedia.");
      }

      await submitResult(fileName);
      await supabase.from("exam_sessions").update({ status: "completed" }).eq("id", sessionId);
      onComplete();
    } catch (err) {
      console.error("Completion error:", err);
      // Still try to mark complete even on error
      try {
        await submitResult(null);
        await supabase.from("exam_sessions").update({ status: "completed" }).eq("id", sessionId);
      } catch (innerErr) {
        console.error("Fallback completion error:", innerErr);
      }
      onComplete();
    }
  }, [sessionId, candidateId, stop, onComplete]);

  const endLabel = isLastCase ? "Akhiri Ujian" : "Akhiri Soal";

  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Header with timer + end button */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card">
        <CountdownTimer
          sessionStartTime={sessionStartTime}
          timeLimitSeconds={timeLimitSeconds}
          onComplete={completeExam}
          className="text-foreground text-3xl"
        />
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" size="sm" disabled={submitting}>
              {submitting ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <LogOut className="h-4 w-4 mr-1" />
              )}
              {endLabel}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{endLabel}?</AlertDialogTitle>
              <AlertDialogDescription>
                {isLastCase
                  ? "Apakah Anda yakin ingin mengakhiri ujian? Jawaban dan rekaman audio Anda akan disubmit untuk dinilai."
                  : "Jawaban dan rekaman soal ini akan disubmit. Setelah itu Anda dapat melanjutkan ke soal berikutnya."}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Kembali</AlertDialogCancel>
              <AlertDialogAction onClick={completeExam}>Ya, {endLabel}</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {/* Recording indicator with live microphone level */}
      <div
        className={`flex flex-col gap-1 px-4 py-2 ${
          isRecording && hasRecentSound ? "bg-destructive/10" : "bg-muted"
        }`}
      >
        <div className="flex items-center gap-2">
          {isRecording ? (
            <Mic className="h-3.5 w-3.5 text-destructive animate-pulse" />
          ) : (
            <MicOff className="h-3.5 w-3.5 text-muted-foreground" />
          )}
          <span
            className={`text-xs font-medium ${
              isRecording ? "text-destructive" : "text-muted-foreground"
            }`}
          >
            {recorderError
              ? recorderError
              : isRecording
              ? hasRecentSound
                ? "Merekam — suara terdeteksi"
                : "Merekam — suara tidak terdeteksi, bicara lebih dekat ke mikrofon"
              : "Menyiapkan rekaman..."}
          </span>
          <span className="ml-auto text-[10px] text-muted-foreground tabular-nums">
            {chunkCount > 0 ? `${Math.round(recordedBytes / 1024)} KB tersimpan` : "0 KB"}
          </span>
        </div>
        {/* Live input level meter */}
        <div className="h-1.5 w-full rounded-full bg-border overflow-hidden">
          <div
            className="h-full bg-destructive transition-all duration-100"
            style={{ width: `${Math.max(2, level)}%` }}
          />
        </div>
        {liveTranscript && (
          <p className="text-[10px] text-muted-foreground line-clamp-2">
            Terdengar: {liveTranscript}
          </p>
        )}
      </div>


      {/* Monitor focus banner */}
      <div className="flex items-center justify-center gap-2 py-2 px-4 bg-primary/10 border-b border-primary/20">
        <Monitor className="h-3.5 w-3.5 text-primary" />
        <span className="text-xs text-primary font-medium">
          Perhatikan layar monitor — hasil pemeriksaan akan ditampilkan di sana
        </span>
      </div>

      {/* Case + Questions (collapsible) */}
      {(casePrompt || questionsText) && (
        <div className="border-b border-border bg-muted/30">
          <button
            onClick={() => setShowCase(!showCase)}
            className="w-full px-4 py-2 text-left text-sm font-semibold text-foreground flex items-center justify-between"
          >
            <span>{caseTitle || "Kasus & Soal"}</span>
            <span className="text-xs text-muted-foreground">{showCase ? "Sembunyikan" : "Tampilkan"}</span>
          </button>
          {showCase && (
            <div className="px-4 pb-3 space-y-3 max-h-60 overflow-y-auto">
              {casePrompt && (
                <div className="text-sm text-foreground whitespace-pre-wrap">{casePrompt}</div>
              )}
              {questionsText && (
                <>
                  <div className="border-t border-border pt-2">
                    <p className="text-xs font-semibold text-primary mb-1">Soal / Pertanyaan:</p>
                    <div className="text-sm text-foreground whitespace-pre-wrap">{questionsText}</div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* Chat messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {messages.map((msg, i) =>
          msg.loading ? (
            <div key={i} className="flex items-center gap-2 max-w-[80%] w-fit text-sm px-4 py-2 rounded-2xl rounded-bl-md bg-muted text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>{msg.text}</span>
            </div>
          ) : msg.type === "user" ? (
            <div
              key={i}
              className="bg-primary text-primary-foreground px-4 py-2 rounded-2xl rounded-br-md ml-auto max-w-[80%] w-fit text-sm"
            >
              {msg.text}
            </div>
          ) : (
            <div
              key={i}
              className={`flex items-start gap-2 max-w-[80%] w-fit text-sm px-4 py-2 rounded-2xl rounded-bl-md ${
                msg.available
                  ? "bg-accent text-accent-foreground"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {msg.available ? (
                <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
              ) : (
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0 text-destructive" />
              )}
              <span className="whitespace-pre-wrap">{msg.text}</span>
            </div>
          )
        )}
        {messages.length === 0 && (
          <div className="text-center mt-8 space-y-3 max-w-xs mx-auto">
            <p className="text-muted-foreground text-sm font-medium">
              Anda dapat meminta pemeriksaan atau media melalui chat ini.
            </p>
            <div className="text-muted-foreground/70 text-xs space-y-1">
              <p>Contoh: <span className="italic">"Rontgen thorax"</span>, <span className="italic">"Lab darah lengkap"</span></p>
              <p>Hasil akan ditampilkan di <span className="font-semibold text-primary">layar monitor</span>.</p>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Chat input */}
      <div className="p-4 border-t border-border bg-card">
        <ChatInput onSend={handleSendMessage} />
      </div>
    </div>
  );
};

export default ExamActiveView;
