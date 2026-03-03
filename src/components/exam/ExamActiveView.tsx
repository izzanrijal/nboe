import { useEffect, useCallback, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import CountdownTimer from "@/components/station/CountdownTimer";
import ChatInput from "@/components/exam/ChatInput";
import useMediaRecorder from "@/hooks/useMediaRecorder";
import useAntiCheat from "@/hooks/useAntiCheat";
import { toast } from "sonner";
import { Mic } from "lucide-react";

interface ExamActiveViewProps {
  sessionId: string;
  sessionStartTime: string;
  timeLimitSeconds: number;
  candidateId: string;
  audioStream: MediaStream;
  onForceClose: () => void;
  onComplete: () => void;
}

const ExamActiveView = ({
  sessionId,
  sessionStartTime,
  timeLimitSeconds,
  candidateId,
  audioStream,
  onForceClose,
  onComplete,
}: ExamActiveViewProps) => {
  const { isRecording, start, stop } = useMediaRecorder();
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const [messages, setMessages] = useState<string[]>([]);
  const completingRef = useRef(false);

  // Start recording on mount
  useEffect(() => {
    start(audioStream);

    // Join broadcast channel
    const channel = supabase.channel(`session:${sessionId}`);
    channelRef.current = channel;
    channel.subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionId, audioStream, start]);

  // Anti-cheat
  const handleCheat = useCallback(async () => {
    await supabase
      .from("exam_sessions")
      .update({ status: "force_closed" })
      .eq("id", sessionId);
    onForceClose();
  }, [sessionId, onForceClose]);

  useAntiCheat(true, handleCheat);

  // Send chat message
  const handleSendMessage = useCallback(
    (message: string) => {
      setMessages((prev) => [...prev, message]);
      channelRef.current?.send({
        type: "broadcast",
        event: "chat",
        payload: { message },
      });
    },
    []
  );

  // Timer complete — upload audio
  const handleTimerComplete = useCallback(async () => {
    if (completingRef.current) return;
    completingRef.current = true;

    try {
      const blob = await stop();

      if (blob && blob.size > 0) {
        const fileName = `${sessionId}_${candidateId}_${Date.now()}.webm`;
        const { error: uploadError } = await supabase.storage
          .from("exam-audio")
          .upload(fileName, blob, { contentType: "audio/webm" });

        if (uploadError) {
          console.error("Upload error:", uploadError);
          toast.error("Failed to upload audio recording");
        }

        const audioUrl = fileName;

        await supabase.from("exam_results").insert({
          session_id: sessionId,
          candidate_id: candidateId,
          audio_file_url: audioUrl,
        });
      }

      await supabase
        .from("exam_sessions")
        .update({ status: "completed" })
        .eq("id", sessionId);

      onComplete();
    } catch (err) {
      console.error("Completion error:", err);
      onComplete();
    }
  }, [sessionId, candidateId, stop, onComplete]);

  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Timer */}
      <div className="flex items-center justify-center py-4 border-b border-border bg-card">
        <CountdownTimer
          sessionStartTime={sessionStartTime}
          timeLimitSeconds={timeLimitSeconds}
          onComplete={handleTimerComplete}
          className="text-foreground"
        />
      </div>

      {/* Recording indicator */}
      <div className="flex items-center justify-center gap-2 py-2 bg-destructive/10">
        <Mic className="h-4 w-4 text-destructive animate-pulse" />
        <span className="text-xs text-destructive font-medium">
          {isRecording ? "Recording in progress" : "Starting..."}
        </span>
      </div>

      {/* Chat messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {messages.map((msg, i) => (
          <div
            key={i}
            className="bg-primary text-primary-foreground px-4 py-2 rounded-2xl rounded-br-md ml-auto max-w-[80%] w-fit text-sm"
          >
            {msg}
          </div>
        ))}
        {messages.length === 0 && (
          <p className="text-muted-foreground text-center text-sm mt-8">
            Type a message to request clinical assets from the examiner display.
          </p>
        )}
      </div>

      {/* Chat input */}
      <div className="p-4 border-t border-border bg-card">
        <ChatInput onSend={handleSendMessage} />
      </div>
    </div>
  );
};

export default ExamActiveView;
