import { useRef, useState, useCallback } from "react";

interface UseMediaRecorderReturn {
  isRecording: boolean;
  chunkCount: number;
  recordedBytes: number;
  error: string | null;
  start: (stream: MediaStream) => void;
  stop: () => Promise<Blob | null>;
}

const useMediaRecorder = (): UseMediaRecorderReturn => {
  const [isRecording, setIsRecording] = useState(false);
  const [chunkCount, setChunkCount] = useState(0);
  const [recordedBytes, setRecordedBytes] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const start = useCallback((stream: MediaStream) => {
    if (recorderRef.current && recorderRef.current.state !== "inactive") return;
    chunksRef.current = [];
    setChunkCount(0);
    setRecordedBytes(0);
    setError(null);

    try {
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : MediaRecorder.isTypeSupported("audio/mp4")
        ? "audio/mp4"
        : "";

      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
          setChunkCount((c) => c + 1);
          setRecordedBytes((b) => b + e.data.size);
        }
      };

      recorder.onerror = () => {
        setError("Perekaman audio bermasalah.");
      };

      recorder.start(3000); // 3s chunks
      recorderRef.current = recorder;
      setIsRecording(true);
    } catch (err) {
      console.error("MediaRecorder start failed:", err);
      setError("Perangkat tidak dapat merekam audio.");
      setIsRecording(false);
    }
  }, []);

  const stop = useCallback((): Promise<Blob | null> => {
    return new Promise((resolve) => {
      const recorder = recorderRef.current;
      const buildBlob = () =>
        chunksRef.current.length > 0
          ? new Blob(chunksRef.current, { type: chunksRef.current[0].type || "audio/webm" })
          : null;

      if (!recorder || recorder.state === "inactive") {
        setIsRecording(false);
        resolve(buildBlob());
        return;
      }

      recorder.onstop = () => {
        setIsRecording(false);
        recorderRef.current = null;
        resolve(buildBlob());
      };

      try {
        recorder.stop();
      } catch {
        setIsRecording(false);
        resolve(buildBlob());
      }
    });
  }, []);

  return { isRecording, chunkCount, recordedBytes, error, start, stop };
};

export default useMediaRecorder;
