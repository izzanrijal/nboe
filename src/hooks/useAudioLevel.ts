import { useEffect, useRef, useState } from "react";

/**
 * Monitors the microphone input level of a MediaStream.
 * Returns a 0-100 level and whether any sound has been detected recently.
 */
const useAudioLevel = (stream: MediaStream | null) => {
  const [level, setLevel] = useState(0);
  const [hasRecentSound, setHasRecentSound] = useState(true);
  const lastSoundRef = useRef<number>(Date.now());

  useEffect(() => {
    if (!stream) return;
    let ctx: AudioContext | null = null;
    let raf = 0;

    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      ctx = new AudioCtx();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);

      const loop = () => {
        analyser.getByteTimeDomainData(data);
        let peak = 0;
        for (let i = 0; i < data.length; i++) {
          peak = Math.max(peak, Math.abs(data[i] - 128));
        }
        const normalized = Math.min(100, Math.round((peak / 64) * 100));
        setLevel(normalized);
        if (normalized > 6) lastSoundRef.current = Date.now();
        setHasRecentSound(Date.now() - lastSoundRef.current < 8000);
        raf = requestAnimationFrame(loop);
      };
      loop();
    } catch (err) {
      console.warn("Audio level monitor unavailable:", err);
    }

    return () => {
      cancelAnimationFrame(raf);
      ctx?.close().catch(() => {});
    };
  }, [stream]);

  return { level, hasRecentSound };
};

export default useAudioLevel;
