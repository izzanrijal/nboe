/**
 * Normalize text: lowercase, trim, remove punctuation.
 */
const normalize = (text: string): string =>
  text.toLowerCase().trim().replace(/[^\w\s]/g, "");

/**
 * Check if any of the trigger keywords match within the given text.
 * Uses substring matching on normalized strings.
 */
export const matchesKeywords = (text: string, keywords: string[]): boolean => {
  const normalizedText = normalize(text);
  return keywords.some((keyword) => {
    const normalizedKeyword = normalize(keyword);
    return normalizedKeyword.length > 0 && normalizedText.includes(normalizedKeyword);
  });
};
