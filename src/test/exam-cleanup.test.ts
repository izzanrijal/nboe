import { describe, expect, it, vi } from "vitest";
import { stopExamAudioStream } from "@/lib/examCleanup";

describe("exam runtime cleanup", () => {
  it("stops every live audio track and ignores tracks that already ended", () => {
    const liveTrack = { readyState: "live", stop: vi.fn() };
    const endedTrack = { readyState: "ended", stop: vi.fn() };
    const stream = {
      getTracks: () => [liveTrack, endedTrack],
    } as unknown as Pick<MediaStream, "getTracks">;

    stopExamAudioStream(stream);

    expect(liveTrack.stop).toHaveBeenCalledTimes(1);
    expect(endedTrack.stop).not.toHaveBeenCalled();
  });
});
