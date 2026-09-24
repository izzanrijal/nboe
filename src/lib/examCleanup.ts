type ExamAudioStream = Pick<MediaStream, "getTracks">;

/** Stop every live track held by an exam audio stream. Safe to call repeatedly. */
export function stopExamAudioStream(stream: ExamAudioStream | null | undefined): void {
  stream?.getTracks().forEach((track) => {
    if (track.readyState === "ended") return;

    try {
      track.stop();
    } catch (error) {
      console.warn("Unable to stop an exam audio track:", error);
    }
  });
}
