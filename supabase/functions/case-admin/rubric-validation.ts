export interface RubricQualityItem {
  points: number;
  isCritical: boolean;
}

export function getRubricQualityError(items: RubricQualityItem[]): string | null {
  // An empty checklist explicitly disables rubric-based grading.
  if (items.length === 0) return null;

  if (items.length < 3) {
    return `Active rubric must contain at least 3 items (got ${items.length})`;
  }

  const criticalCount = items.filter((item) => item.isCritical).length;
  if (criticalCount < 1) {
    return "At least 1 rubric item must be isCritical:true";
  }

  const totalPoints = items.reduce((sum, item) => sum + item.points, 0);
  if (totalPoints < 6) {
    return `Rubric total points must be >= 6 (got ${totalPoints})`;
  }

  return null;
}
