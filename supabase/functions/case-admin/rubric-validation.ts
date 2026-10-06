export interface RubricQualityItem {
  text?: string;
  points: number;
  isCritical: boolean;
}

export function getRubricQualityError(items: RubricQualityItem[]): string | null {
  // An empty checklist explicitly disables rubric-based grading.
  if (items.length === 0) return null;

  // Duplicated lines penalise the same point twice, so they are a generation bug.
  const normalized = items.map((i) => (i.text ?? "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim());
  const dupe = normalized.find((t, idx) => t && normalized.indexOf(t) !== idx);
  if (dupe) {
    return `Rubric contains a duplicate item ("${dupe.slice(0, 60)}"). Every item must be unique.`;
  }

  // Keep rubrics broad and realistic: an oral-exam candidate cannot verbalise
  // 15+ granular points inside the time limit, and an over-long rubric makes
  // most items fail even when the answer was reasonable.
  if (items.length < 5 || items.length > 7) {
    return `Active rubric must contain 5-7 broad items (got ${items.length}). Merge granular points into the main ones.`;
  }

  const criticalCount = items.filter((item) => item.isCritical).length;
  if (criticalCount < 2) {
    return "At least 2 rubric items must be isCritical:true";
  }

  const totalPoints = items.reduce((sum, item) => sum + item.points, 0);
  if (totalPoints < 10) {
    return `Rubric total points must be >= 10 (got ${totalPoints})`;
  }

  return null;
}
