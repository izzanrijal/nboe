export interface RubricHighlightItem {
  item: string;
  passed?: boolean;
  evidenceQuote?: string;
}

export interface RubricMatch {
  item: RubricHighlightItem;
  itemIndex: number;
  matched: boolean;
  matchedText: string;
  start: number;
  end: number;
  /** Highlight-driven verdict: a rubric line counts only when its phrase occurs. */
  passed: boolean;
}

export interface HighlightSegment {
  text: string;
  highlighted: boolean;
  matchedItems: number[];
}

interface Token {
  value: string;
  start: number;
  end: number;
}

type StemToken = Token & { stem: string };

const ignoredSingleTokens = new Set([
  "dan", "atau", "yang", "dengan", "untuk", "pada", "dari", "dalam", "secara",
  "menyebutkan", "menjelaskan", "melakukan", "menanyakan", "memberikan", "mengidentifikasi",
]);

/**
 * Normalize text for comparison. Speaks Indonesian and, importantly, tolerates
 * Whisper-style spelling drift: accent folding, punctuation stripping, and
 * light suffix trimming so "neprilysin"/"neprilisin" style variants still line up.
 */
export const normalize = (text: string): string =>
  text
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("id-ID")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");

/**
 * Reduce a word to a loose stem so near-misses from speech-to-text still match:
 * Indonesian/English suffixes (-nya, -kan, -an, -in, -s, -es) and a trailing
 * silent "h" are dropped. Conservative on purpose — never shortens below 4 chars.
 */
const stem = (word: string): string => {
  let w = word;
  const suffixes = ["nya", "kan", "lah", "pun", "an", "in", "es", "s", "h"];
  for (const suffix of suffixes) {
    if (w.length - suffix.length >= 4 && w.endsWith(suffix)) {
      w = w.slice(0, -suffix.length);
      break;
    }
  }
  return w;
};

const tokenize = (text: string): StemToken[] => {
  const tokens: StemToken[] = [];
  for (const match of text.matchAll(/[\p{L}\p{N}]+/gu)) {
    const raw = match[0];
    const start = match.index;
    if (start === undefined) continue;
    const value = normalize(raw);
    if (!value) continue;
    tokens.push({ value, stem: stem(value), start, end: start + raw.length });
  }
  return tokens;
};

const isUsefulPhrase = (tokens: StemToken[]): boolean => {
  if (tokens.length > 1) return tokens.some((token) => !ignoredSingleTokens.has(token.value));
  return tokens.length === 1 && tokens[0].value.length >= 3 && !ignoredSingleTokens.has(tokens[0].value);
};

/**
 * Two tokens are considered equal when their stems agree, so speech-to-text
 * spelling slips ("neprilisin" vs "neprilysin") do not break the match.
 */
const tokenMatches = (a: StemToken, b: StemToken): boolean => {
  if (a.value === b.value) return true;
  if (a.stem === b.stem && a.stem.length >= 4) return true;
  // Tolerate a single-character slip for longer words (vowel swaps in transcription).
  if (a.stem.length >= 6 && b.stem.length >= 6) {
    const [shorter, longer] = a.stem.length <= b.stem.length ? [a.stem, b.stem] : [b.stem, a.stem];
    if (longer.length - shorter.length <= 1) {
      let diff = 0;
      for (let i = 0, j = 0; i < shorter.length && j < longer.length; j += 1) {
        if (shorter[i] === longer[j]) i += 1;
        else diff += 1;
        if (diff > 1) break;
      }
      if (diff <= 1) return true;
    }
  }
  return false;
};

/**
 * Locate a rubric line inside the given text. Detection is independent of any
 * AI verdict: we always try to find the phrase so the highlight is the source
 * of truth. An exact `evidenceQuote` is preferred when it truly occurs.
 */
const locateRubricItem = (
  text: string,
  textTokens: StemToken[],
  item: RubricHighlightItem,
): { start: number; end: number } | undefined => {
  if (item.evidenceQuote) {
    const quote = item.evidenceQuote.trim();
    if (quote) {
      const start = text.indexOf(quote);
      if (start >= 0) return { start, end: start + quote.length };
    }
  }

  const rubricTokens = tokenize(item.item) as StemToken[];
  if (!rubricTokens.length) return undefined;

  const usefulTotal = rubricTokens.filter((token) => !ignoredSingleTokens.has(token.value)).length;

  for (let length = rubricTokens.length; length >= 1; length -= 1) {
    for (let rubricStart = 0; rubricStart + length <= rubricTokens.length; rubricStart += 1) {
      const phrase = rubricTokens.slice(rubricStart, rubricStart + length);
      if (!isUsefulPhrase(phrase)) continue;
      const usefulCount = phrase.filter((token) => !ignoredSingleTokens.has(token.value)).length;
      const requiredCount = Math.min(2, usefulTotal);
      if (usefulCount < requiredCount) continue;
      for (let textStart = 0; textStart + length <= textTokens.length; textStart += 1) {
        const ok = phrase.every((token, offset) => tokenMatches(token, textTokens[textStart + offset]));
        if (ok) {
          return {
            start: textTokens[textStart].start,
            end: textTokens[textStart + length - 1].end,
          };
        }
      }
    }
  }
  return undefined;
};

/**
 * Match rubric items against a body of text (the AI model answer, or a
 * transcript). Returns where each item was found so the caller can highlight
 * the mentioned phrases and emphasize the missing ones.
 */
export const findRubricMatches = (
  text: string,
  rubricItems: RubricHighlightItem[],
): RubricMatch[] => {
  const textTokens = tokenize(text) as StemToken[];

  return rubricItems.map((item, itemIndex) => {
    const located = locateRubricItem(text, textTokens, item);

    return {
      item,
      itemIndex,
      matched: Boolean(located),
      // Highlight drives the verdict: mentioned => passed, missing => not passed.
      passed: Boolean(located),
      matchedText: located ? text.slice(located.start, located.end) : "",
      start: located?.start ?? -1,
      end: located?.end ?? -1,
    };
  });
};

export const buildHighlightSegments = (
  text: string,
  matches: RubricMatch[],
): HighlightSegment[] => {
  const boundaries = new Set([0, text.length]);
  matches.filter((match) => match.matched).forEach((match) => {
    boundaries.add(match.start);
    boundaries.add(match.end);
  });
  const sorted = [...boundaries].sort((a, b) => a - b);

  return sorted.slice(0, -1).map((start, index) => {
    const end = sorted[index + 1];
    const matchedItems = matches
      .filter((match) => match.matched && match.start < end && match.end > start)
      .map((match) => match.itemIndex);
    return {
      text: text.slice(start, end),
      highlighted: matchedItems.length > 0,
      matchedItems,
    };
  }).filter((segment) => segment.text.length > 0);
};

/**
 * Rubric lines the answer does NOT mention. The UI renders these in bold+italic
 * so the participant sees what they were expected to say.
 */
export const findUnmentionedItems = (
  matches: RubricMatch[],
): RubricMatch[] => matches.filter((match) => !match.matched);
