import { useEffect, useState } from "react";

interface CountdownTimerProps {
  sessionStartTime: string;
  timeLimitSeconds: number;
  onComplete: () => void;
  className?: string;
}

const CountdownTimer = ({
  sessionStartTime,
  timeLimitSeconds,
  onComplete,
  className = "",
}: CountdownTimerProps) => {
  const [remaining, setRemaining] = useState(timeLimitSeconds);

  useEffect(() => {
    const endTime = new Date(sessionStartTime).getTime() + timeLimitSeconds * 1000;

    const tick = () => {
      const now = Date.now();
      const left = Math.max(0, Math.floor((endTime - now) / 1000));
      setRemaining(left);
      if (left <= 0) {
        onComplete();
      }
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [sessionStartTime, timeLimitSeconds, onComplete]);

  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;

  const isUrgent = remaining <= 30;

  return (
    <div
      className={`font-mono text-center ${
        isUrgent ? "text-destructive animate-pulse" : "text-foreground"
      } ${className}`}
    >
      <span className="text-7xl font-bold tabular-nums">
        {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
      </span>
    </div>
  );
};

export default CountdownTimer;
