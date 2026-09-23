export function canCandidateViewResultDetails(
  sessionOverride: boolean | null | undefined,
  caseSetting: boolean | null | undefined
): boolean {
  return sessionOverride === true || caseSetting === true;
}
