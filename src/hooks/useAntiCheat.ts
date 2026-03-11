import { useEffect, useRef } from "react";

const useAntiCheat = (enabled: boolean, onCheatDetected: () => void) => {
  const callbackRef = useRef(onCheatDetected);
  callbackRef.current = onCheatDetected;

  useEffect(() => {
    if (!enabled) return;

    // 1. Visibility change (tab switch)
    const handleVisibility = () => {
      if (document.visibilityState === "hidden") {
        callbackRef.current();
      }
    };

    // 2. Window blur (split screen, alt-tab, DevTools undocked)
    const handleBlur = () => {
      // Small delay to avoid false positives from quick focus shifts (e.g. alert dialogs)
      setTimeout(() => {
        if (!document.hasFocus()) {
          callbackRef.current();
        }
      }, 200);
    };

    // 3. DevTools detection via debugger timing
    let devToolsInterval: ReturnType<typeof setInterval> | null = null;
    const checkDevTools = () => {
      const start = performance.now();
      // debugger statement causes a pause if DevTools is open
      // eslint-disable-next-line no-debugger
      debugger;
      const elapsed = performance.now() - start;
      if (elapsed > 100) {
        callbackRef.current();
      }
    };

    // Only run devtools check periodically to reduce performance impact
    // Note: This is imperfect but raises the bar significantly
    devToolsInterval = setInterval(checkDevTools, 3000);

    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("blur", handleBlur);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("blur", handleBlur);
      if (devToolsInterval) clearInterval(devToolsInterval);
    };
  }, [enabled]);
};

export default useAntiCheat;
