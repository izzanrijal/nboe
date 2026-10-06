import { describe, it, expect } from "vitest";
import { quoteSupportedByTranscript } from "../../supabase/functions/_shared/transcript-match";

// The real, badly-transcribed participant answer for result 9208b8e7.
const REAL_TRANSCRIPT = `ARNI adalah kepanjangan dari angiotensin, renin, neprilisin, inhibitor lalu kenapa tidak dikombinasikan dengan S-inhibitor karena 2 jalur, retubuh memiliki 2 jalur blocker dari angiotensin jadi ketika lewat angiotensin dan juga S-inhibitor yang diblocker jalur S yang diblocker maka itu bisa akan men`;

describe("quote validation on real Whisper output", () => {
  it("accepts a doctor-style quote that is not byte-identical", () => {
    // Realistic model quote: proper spelling + punctuation, not in the raw text.
    const quote = "ARNI adalah kepanjangan dari Angiotensin Receptor-Neprilysin Inhibitor.";
    console.log("byte-exact includes()?", REAL_TRANSCRIPT.includes(quote));
    console.log("tolerant matcher?", quoteSupportedByTranscript(REAL_TRANSCRIPT, quote));
    expect(REAL_TRANSCRIPT.includes(quote)).toBe(false); // proves old check failed it
    expect(quoteSupportedByTranscript(REAL_TRANSCRIPT, quote)).toBe(true);
  });

  it("accepts a quote about the combination when the model quotes the garbled text", () => {
    // The prompt tells the model to copy the transcript verbatim, so this is the
    // realistic shape of a quote for this messy recording.
    const quote = "tidak dikombinasikan dengan S-inhibitor karena 2 jalur";
    console.log("tolerant matcher?", quoteSupportedByTranscript(REAL_TRANSCRIPT, quote));
    expect(quoteSupportedByTranscript(REAL_TRANSCRIPT, quote)).toBe(true);
  });

  it("accepts the same quote with cleaned-up spelling and punctuation", () => {
    const quote = "tidak dikombinasikan dengan ACE-inhibitor karena dua jalur.";
    console.log("cleaned quote?", quoteSupportedByTranscript(REAL_TRANSCRIPT, quote));
    expect(quoteSupportedByTranscript(REAL_TRANSCRIPT, quote)).toBe(true);
  });

  it("still rejects a fabricated quote", () => {
    const quote = "harus ada washout period 36 jam sebelum beralih";
    expect(quoteSupportedByTranscript(REAL_TRANSCRIPT, quote)).toBe(false);
  });

  it("keeps a clean exact match fast-path", () => {
    expect(quoteSupportedByTranscript("pasien diberi aspirin", "aspirin")).toBe(true);
  });

  it("does not pass on one shared general word", () => {
    expect(quoteSupportedByTranscript("pasien saya beri aspirin", "diberikan digoxin dan furosemide")).toBe(false);
  });
});
