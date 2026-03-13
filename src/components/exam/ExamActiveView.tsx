import { useEffect, useCallback, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import CountdownTimer from "@/components/station/CountdownTimer";
import ChatInput from "@/components/exam/ChatInput";
import useMediaRecorder from "@/hooks/useMediaRecorder";

import { toast } from "sonner";
import { Mic, AlertCircle, CheckCircle2, LogOut, Loader2 } from "lucide-react";
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
  const { isRecording, start, stop } = useMediaRecorder();
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const completingRef = useRef(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [showCase, setShowCase] = useState(true);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

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

  // Anti-cheat
  const handleCheat = useCallback(async () => {
    await supabase.from("exam_sessions").update({ status: "force_closed" }).eq("id", sessionId);
    onForceClose();
  }, [sessionId, onForceClose]);

  useAntiCheat(true, handleCheat);

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

    try {
      let fileName: string | null = null;
      const blob = await stop();

      if (blob && blob.size > 0) {
        fileName = `${sessionId}_${candidateId}_${Date.now()}.webm`;
        const { error: uploadError } = await supabase.storage
          .from("exam-audio")
          .upload(fileName, blob, { contentType: "audio/webm" });
        if (uploadError) {
          console.error("Upload error:", uploadError);
          toast.error("Gagal mengunggah rekaman audio. Mencoba ulang...");
          // Retry once
          const { error: retryError } = await supabase.storage
            .from("exam-audio")
            .upload(fileName, blob, { contentType: "audio/webm", upsert: true });
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

      await supabase.from("exam_results").insert({
        session_id: sessionId,
        candidate_id: candidateId,
        audio_file_url: fileName,
      });
      await supabase.from("exam_sessions").update({ status: "completed" }).eq("id", sessionId);
      onComplete();
    } catch (err) {
      console.error("Completion error:", err);
      // Still try to mark complete even on error
      try {
        await supabase.from("exam_results").insert({
          session_id: sessionId,
          candidate_id: candidateId,
          audio_file_url: null,
        });
        await supabase.from("exam_sessions").update({ status: "completed" }).eq("id", sessionId);
      } catch (innerErr) {
        console.error("Fallback completion error:", innerErr);
      }
      onComplete();
    }
  }, [sessionId, candidateId, stop, onComplete]);

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
            <Button variant="destructive" size="sm">
              <LogOut className="h-4 w-4 mr-1" />
              Selesai
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Akhiri Ujian?</AlertDialogTitle>
              <AlertDialogDescription>
                Apakah Anda yakin ingin mengakhiri ujian? Jawaban dan rekaman audio Anda akan disubmit untuk dinilai.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Kembali</AlertDialogCancel>
              <AlertDialogAction onClick={completeExam}>Ya, Akhiri Ujian</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {/* Recording indicator */}
      <div className="flex items-center justify-center gap-2 py-1.5 bg-destructive/10">
        <Mic className="h-3.5 w-3.5 text-destructive animate-pulse" />
        <span className="text-xs text-destructive font-medium">
          {isRecording ? "Recording" : "Starting..."}
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
          <p className="text-muted-foreground text-center text-sm mt-8">
            Ketik pesan untuk bertanya atau meminta pemeriksaan dari penguji.
          </p>
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
