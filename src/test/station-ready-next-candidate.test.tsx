import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import StationReadyNextCandidate from "@/components/station/StationReadyNextCandidate";
import {
  createStationResetGuard,
  startStationResetCountdown,
  STATION_RESET_COUNTDOWN_SECONDS,
} from "@/lib/stationReset";

describe("station ready for next candidate", () => {
  it("shows the completion notice, countdown, and immediate reset CTA", () => {
    const onReset = vi.fn();
    render(
      <StationReadyNextCandidate
        countdown={STATION_RESET_COUNTDOWN_SECONDS}
        isResetting={false}
        error={null}
        onReset={onReset}
      />,
    );

    expect(screen.getByRole("heading")).toHaveTextContent(
      "Ujian Selesai — Station Siap untuk Peserta Berikutnya",
    );
    expect(screen.getByText(
      `Kembali ke layar Scan QR dalam ${STATION_RESET_COUNTDOWN_SECONDS} detik...`,
    )).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Siapkan QR Peserta Baru Sekarang" }));
    expect(onReset).toHaveBeenCalledTimes(1);
  });

  it("disables the CTA while reset is running", () => {
    render(
      <StationReadyNextCandidate
        countdown={0}
        isResetting
        error={null}
        onReset={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "Menyiapkan QR Baru..." })).toBeDisabled();
  });

  it("guards a countdown/click race and permits an explicit retry", () => {
    const guard = createStationResetGuard();

    expect(guard.tryStart()).toBe(true);
    expect(guard.tryStart()).toBe(false);
    guard.release();
    expect(guard.tryStart()).toBe(true);
  });

  it("counts down, fires once, and cancels stale timers during cleanup", () => {
    vi.useFakeTimers();
    const onTick = vi.fn();
    const onElapsed = vi.fn();
    const cleanup = startStationResetCountdown(onTick, onElapsed, 3);

    expect(onTick).toHaveBeenLastCalledWith(3);
    vi.advanceTimersByTime(1000);
    expect(onTick).toHaveBeenLastCalledWith(2);
    vi.advanceTimersByTime(2000);
    expect(onTick).toHaveBeenLastCalledWith(0);
    expect(onElapsed).toHaveBeenCalledTimes(1);

    cleanup();
    cleanup();
    vi.advanceTimersByTime(5000);
    expect(onElapsed).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it("prevents elapsed work after early cleanup", () => {
    vi.useFakeTimers();
    const onElapsed = vi.fn();
    const cleanup = startStationResetCountdown(vi.fn(), onElapsed, 3);

    cleanup();
    vi.advanceTimersByTime(3000);
    expect(onElapsed).not.toHaveBeenCalled();
    vi.useRealTimers();
  });
});
