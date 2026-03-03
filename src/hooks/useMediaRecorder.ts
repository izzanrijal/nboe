import { useRef, useState, useCallback } from "react";

interface UseMediaRecorderReturn {
  isRecording: boolean;
  start: (stream: MediaStream) => void;
  stop: () => Promise<Blob | null>;
}

const useMediaRecorder = (): UseMediaRecorderReturn => {
  const [isRecording, setIsRecording] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const start = useCallback((stream: MediaStream) => {
    chunksRef.current = [];
    const recorder = new MediaRecorder(stream, {
      mimeType: MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm",
    });

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        chunksRef.current.push(e.data);
      }
    };

    recorder.start(5000); // 5s chunks
    recorderRef.current = recorder;
    setIsRecording(true);
  }, []);

  const stop = useCallback((): Promise<Blob | null> => {
    return new Promise((resolve) => {
      const recorder = recorderRef.current;
      if (!recorder || recorder.state === "inactive") {
        resolve(chunksRef.current.length > 0 ? new Blob(chunksRef.current, { type: "audio/webm" }) : null);
        return;
      }

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        setIsRecording(false);
        recorderRef.current = null;
        resolve(blob);
      };

      recorder.stop();
    });
  }, []);

  return { isRecording, start, stop };
};

export default useMediaRecorder;
