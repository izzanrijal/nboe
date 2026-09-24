/** @vitest-environment jsdom */

import { useEffect } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import ExamCompleted, {
  EXAM_RETURN_CONFIRMATION,
} from "@/pages/ExamCompleted";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {},
}));

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const renderCompleted = (
  onBeforeReturnToMenu: () => void | Promise<void>,
  onMenuMounted?: () => void
) => {
  const ExamMenu = () => {
    useEffect(() => {
      onMenuMounted?.();
    }, []);

    return <div>Menu ujian</div>;
  };

  return render(
    <MemoryRouter initialEntries={["/completed"]}>
      <Routes>
        <Route
          path="/completed"
          element={
            <ExamCompleted
              onBeforeReturnToMenu={onBeforeReturnToMenu}
              returnCountdownSeconds={30}
            />
          }
        />
        <Route path="/exam" element={<ExamMenu />} />
      </Routes>
    </MemoryRouter>
  );
};

describe("ExamCompleted return-to-menu flow", () => {
  it("shows the exact confirmation and waits for reset before manual navigation", async () => {
    const events: string[] = [];
    let finishReset: (() => void) | undefined;
    const reset = vi.fn(
      () => new Promise<void>((resolve) => {
        events.push("reset");
        finishReset = resolve;
      })
    );

    renderCompleted(reset, () => events.push("navigate"));

    expect(screen.getByText("Kembali otomatis ke menu utama dalam 30 detik.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Kembali ke Menu Utama (/exam)" }));
    expect(screen.getByText(EXAM_RETURN_CONFIRMATION)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Batal" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ya, Kembali" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Batal" }));
    expect(screen.queryByText(EXAM_RETURN_CONFIRMATION)).not.toBeInTheDocument();
    expect(reset).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Kembali ke Menu Utama (/exam)" }));
    fireEvent.click(screen.getByRole("button", { name: "Ya, Kembali" }));

    expect(reset).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("Menu ujian")).not.toBeInTheDocument();

    await act(async () => {
      finishReset?.();
      await Promise.resolve();
    });

    expect(await screen.findByText("Menu ujian")).toBeInTheDocument();
    expect(events).toEqual(["reset", "navigate"]);
  });

  it("automatically resets and redirects when the countdown reaches zero", async () => {
    vi.useFakeTimers();
    const reset = vi.fn();

    renderCompleted(reset);

    await act(async () => {
      vi.advanceTimersByTime(30_000);
      await Promise.resolve();
    });

    expect(reset).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Menu ujian")).toBeInTheDocument();
  });
});
