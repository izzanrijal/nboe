interface CanEditCaseParams {
  isMasterAdmin: boolean;
  createdBy?: string | null;
  userId?: string | null;
}

interface IsRubricEditableParams {
  canEdit: boolean;
  isEditing: boolean;
}

export const canEditCase = ({ isMasterAdmin, createdBy, userId }: CanEditCaseParams) =>
  isMasterAdmin || (!!createdBy && createdBy === userId);

export const isRubricEditable = ({ canEdit, isEditing }: IsRubricEditableParams) =>
  canEdit && isEditing;
