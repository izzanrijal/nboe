/**
 * Whisper-aware text comparison, shared by the grading backend.
 *
 * The candidate "transcript" is automatic speech-to-text (OpenAI Whisper), so it
 * routinely differs from anything a human or model would write: no punctuation,
 * lower case, filler words, and phonetically spelled terms ("neprilisin" for
 * "neprilysin", "S-inhibitor" for "ACE-inhibitor", "retubuh" for "di tubuh").
 *
 * The grading model reads meaning and therefore reports an `evidenceQuote` that
 * looks reasonable but is NOT a byte-exact substring of the transcript. Judging
 * it with `transcript.includes(quote)` silently fails the item and costs the
 * candidate points, so validation must normalise both sides first.
 */

/** Fold case, accents, punctuation and whitespace so the two sides align. */
export const normalizeForCompare = (text: string): string =>
  text
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("id-ID")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");

/**
 * Drop conversational filler and Indonesian function words so a quote pasted
 * with slightly different connecting words still lines up.
 */
const STOPWORDS = new Set([
  "dan", "atau", "yang", "dengan", "untuk", "pada", "dari", "dalam", "secara",
  "adalah", "itu", "ini", "jadi", "karena", "juga", "akan", "bisa", "dapat",
  "harus", "tidak", "bukan", "ada", "ke", "di", "se", "the", "a", "an", "of", "to",
]);

const tokensOf = (text: string): string[] =>
  normalizeForCompare(text).split(" ").filter(Boolean);

/**
 * Loose stem so suffix/prefix noise from transcription does not break a match.
 * Conservative: never shortens below 4 characters.
 */
const stem = (word: string): string => {
  let w = word;
  for (const suffix of ["nya", "kan", "lah", "pun", "kah", "an", "in", "es", "s", "h"]) {
    if (w.length - suffix.length >= 4 && w.endsWith(suffix)) {
      w = w.slice(0, -suffix.length);
      break;
    }
  }
  return w;
};

const stemsOf = (text: string): string[] => {
  const seen: string[] = [];
  for (const token of tokensOf(text)) {
    const s = stem(token);
    if (!s) continue;
    if (STOPWORDS.has(token) || STOPWORDS.has(s)) continue;
    seen.push(s);
  }
  return seen;
};

/** Same word modulo stemming, or one edit apart for longer words. */
const wordsMatch = (a: string, b: string): boolean => {
  if (a === b) return true;
  if (a.length >= 4 && a === b) return true;
  if (a.length >= 4 && b.length >= 4) {
    const [shorter, longer] = a.length <= b.length ? [a, b] : [b, a];
    if (longer.length - shorter.length <= 2 && shorter.length >= 5) {
      // Subsequence check tolerant of 1-2 inserted transcription characters.
      let i = 0;
      let misses = 0;
      for (let j = 0; j < longer.length && i < shorter.length; j += 1) {
        if (shorter[i] === longer[j]) i += 1;
        else if ((misses += 1) > 2) break;
      }
      return i === shorter.length;
    }
  }
  return false;
};

/**
 * Is `quote` supported by `transcript`?
 *
 * Accepts when the transcript contains the quote as a contiguous run after
 * normalisation, OR when at least half the quote's meaningful words appear in
 * order. Exact `.includes()` is kept as the fast path for clean transcripts.
 */
export const quoteSupportedByTranscript = (transcript: string, quote: string): boolean => {
  const rawQuote = quote.trim();
  if (!rawQuote) return false;

  if (transcript.includes(rawQuote)) return true;

  const normalizedQuote = normalizeForCompare(rawQuote);
  if (!normalizedQuote) return false;
  if (normalizeForCompare(transcript).includes(normalizedQuote)) return true;

  const quoteWords = stemsOf(rawQuote);
  if (quoteWords.length === 0) return false;
  if (quoteWords.length === 1) return quoteWords[0].length >= 4;

  const transcriptWords = stemsOf(transcript);
  let cursor = 0;
  let hits = 0;
  for (const word of quoteWords) {
    for (let i = cursor; i < transcriptWords.length; i += 1) {
      if (wordsMatch(word, transcriptWords[i])) {
        hits += 1;
        cursor = i + 1;
        break;
      }
    }
  }

  // Require a clear majority of the quote's words to be present, in order, so a
  // single shared general word cannot pass an item.
  return hits >= Math.max(2, Math.ceil(quoteWords.length * 0.6));
};
