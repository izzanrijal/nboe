export interface CompletedCaseHistory {
  candidateId: string;
  caseId: string;
  examMode: string;
}

interface DeploymentValidationInput {
  participantIds: string[];
  caseIds: string[];
  pcCount: number;
  excludedCaseIds?: ReadonlySet<string>;
}

/**
 * ANY-selected semantics: a case is excluded as soon as one selected
 * participant has an exam_result for that case in the active exam mode.
 * Keeping this rule here makes a future ALL-selected rule a local change.
 */
export const getExcludedCaseIds = (
  completedHistory: CompletedCaseHistory[],
  participantIds: string[],
  examMode: string,
): Set<string> => {
  if (participantIds.length === 0) return new Set();

  const selectedParticipantIds = new Set(participantIds);

  return new Set(
    completedHistory
      .filter(
        (entry) =>
          selectedParticipantIds.has(entry.candidateId) &&
          entry.examMode === examMode,
      )
      .map((entry) => entry.caseId),
  );
};

export const getDeploymentValidationError = ({
  caseIds,
  pcCount,
  excludedCaseIds = new Set(),
}: DeploymentValidationInput): string | null => {
  if (caseIds.length === 0) return "Pilih minimal satu case";
  if (pcCount < 1 || pcCount > 50) return "Jumlah PC harus 1-50";
  if (caseIds.some((caseId) => excludedCaseIds.has(caseId))) {
    return "Pilihan case berubah karena riwayat peserta. Pilih case yang masih tersedia";
  }

  return null;
};
