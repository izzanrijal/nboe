export interface RubricHighlightItem {
  item: string;
  passed: boolean;
}

export interface RubricMatch {
  item: RubricHighlightItem;
  itemIndex: number;
  matched: boolean;
  matchedText: string;
  start: number;
  end: number;
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

const ignoredSingleTokens = new Set([
  "dan", "atau", "yang", "dengan", "untuk", "pada", "dari", "dalam", "secara",
  "menyebutkan", "menjelaskan", "melakukan", "menanyakan", "memberikan", "mengidentifikasi",
]);

export const normalize = (text: string): string =>
  text
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("id-ID")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");

const tokenize = (text: string): Token[] => {
  const tokens: Token[] = [];
  for (const match of text.matchAll(/[\p{L}\p{N}]+/gu)) {
    const raw = match[0];
    tokens.push({ value: normalize(raw), start: match.index!, end: match.index! + raw.length });
  }
  return tokens;
};

const isUsefulPhrase = (tokens: Token[]): boolean => {
  if (tokens.length > 1) return tokens.some((token) => !ignoredSingleTokens.has(token.value));
  return tokens.length === 1 && tokens[0].value.length >= 3 && !ignoredSingleTokens.has(tokens[0].value);
};

export const findRubricMatches = (
  transcript: string,
  rubricItems: RubricHighlightItem[],
): RubricMatch[] => {
  const transcriptTokens = tokenize(transcript);

  return rubricItems.map((item, itemIndex) => {
    const rubricTokens = tokenize(item.item);
    let located: { start: number; end: number } | undefined;

    if (item.passed) {
      outer: for (let length = rubricTokens.length; length >= 1; length -= 1) {
        for (let rubricStart = 0; rubricStart + length <= rubricTokens.length; rubricStart += 1) {
          const phrase = rubricTokens.slice(rubricStart, rubricStart + length);
          if (!isUsefulPhrase(phrase)) continue;
          for (let transcriptStart = 0; transcriptStart + length <= transcriptTokens.length; transcriptStart += 1) {
            const matches = phrase.every((token, offset) => token.value === transcriptTokens[transcriptStart + offset].value);
            if (matches) {
              located = {
                start: transcriptTokens[transcriptStart].start,
                end: transcriptTokens[transcriptStart + length - 1].end,
              };
              break outer;
            }
          }
        }
      }
    }

    return {
      item,
      itemIndex,
      matched: Boolean(located),
      matchedText: located ? transcript.slice(located.start, located.end) : "",
      start: located?.start ?? -1,
      end: located?.end ?? -1,
    };
  });
};

export const buildHighlightSegments = (
  transcript: string,
  matches: RubricMatch[],
): HighlightSegment[] => {
  const boundaries = new Set([0, transcript.length]);
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
      text: transcript.slice(start, end),
      highlighted: matchedItems.length > 0,
      matchedItems,
    };
  }).filter((segment) => segment.text.length > 0);
};
