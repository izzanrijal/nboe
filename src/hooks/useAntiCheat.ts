import { useEffect, useRef } from "react";

const useAntiCheat = (enabled: boolean, onCheatDetected: () => void) => {
  const callbackRef = useRef(onCheatDetected);
  callbackRef.current = onCheatDetected;

  useEffect(() => {
    if (!enabled) return;

    const handler = () => {
      if (document.visibilityState === "hidden") {
        callbackRef.current();
      }
    };

    document.addEventListener("visibilitychange", handler);
    return () => document.removeEventListener("visibilitychange", handler);
  }, [enabled]);
};

export default useAntiCheat;
