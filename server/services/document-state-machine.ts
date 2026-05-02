/**
 * Document State Machine
 *
 * Manages document lifecycle states and validates transitions
 * according to governance requirements.
 */

export type DocumentState = "DRAFT" | "APPROVAL_REQUIRED" | "FINAL";

export interface StateTransition {
  from: DocumentState;
  to: DocumentState;
  action: string;
  requiresApproval: boolean;
}

/**
 * Allowed state transitions based on approval requirements
 */
export const ALLOWED_TRANSITIONS: StateTransition[] = [
  // Without approval requirement (direct finalization)
  {
    from: "DRAFT",
    to: "FINAL",
    action: "finalize",
    requiresApproval: false
  },

  // With approval requirement
  {
    from: "DRAFT",
    to: "APPROVAL_REQUIRED",
    action: "submit_for_approval",
    requiresApproval: true
  },
  {
    from: "APPROVAL_REQUIRED",
    to: "FINAL",
    action: "approve_and_finalize",
    requiresApproval: true
  },

  // Reopen after finalization (edge case)
  {
    from: "FINAL",
    to: "DRAFT",
    action: "reopen",
    requiresApproval: false
  },
];

export interface TransitionValidation {
  valid: boolean;
  targetState?: DocumentState;
  error?: string;
  allowedActions?: string[];
}

/**
 * Document State Machine
 *
 * Validates state transitions and provides next available actions
 */
export class DocumentStateMachine {
  /**
   * Checks if a transition is allowed
   *
   * @param currentState - Current document state
   * @param targetState - Target document state
   * @param requiresApproval - Whether document requires approval
   * @returns true if transition is allowed
   */
  static canTransition(
    currentState: DocumentState,
    targetState: DocumentState,
    requiresApproval: boolean
  ): boolean {
    return ALLOWED_TRANSITIONS.some(
      t => t.from === currentState &&
           t.to === targetState &&
           t.requiresApproval === requiresApproval
    );
  }

  /**
   * Gets available actions for current state
   *
   * @param currentState - Current document state
   * @param requiresApproval - Whether document requires approval
   * @returns Array of available action names
   */
  static getNextActions(
    currentState: DocumentState,
    requiresApproval: boolean
  ): string[] {
    return ALLOWED_TRANSITIONS
      .filter(t => t.from === currentState && t.requiresApproval === requiresApproval)
      .map(t => t.action);
  }

  /**
   * Validates a state transition attempt
   *
   * @param currentState - Current document state
   * @param action - Action being attempted
   * @param requiresApproval - Whether document requires approval
   * @returns Validation result with target state or error
   */
  static validateTransition(
    currentState: DocumentState,
    action: string,
    requiresApproval: boolean
  ): TransitionValidation {
    const transition = ALLOWED_TRANSITIONS.find(
      t => t.from === currentState &&
           t.action === action &&
           t.requiresApproval === requiresApproval
    );

    if (!transition) {
      const allowedActions = this.getNextActions(currentState, requiresApproval);

      return {
        valid: false,
        error: `Invalid transition: action '${action}' not allowed in state '${currentState}' (requiresApproval: ${requiresApproval})`,
        allowedActions,
      };
    }

    return {
      valid: true,
      targetState: transition.to
    };
  }

  /**
   * Validates finalize action with specific guardrails
   *
   * @param currentState - Current document state
   * @param requiresApproval - Whether document requires approval
   * @param hasApprovedSnapshot - Whether approved snapshot exists
   * @returns Validation result
   */
  static validateFinalize(
    currentState: DocumentState,
    requiresApproval: boolean,
    hasApprovedSnapshot: boolean
  ): TransitionValidation {
    // If requires approval, must have approved snapshot
    if (requiresApproval && !hasApprovedSnapshot) {
      return {
        valid: false,
        error: "Cannot finalize: document requires approval but no approved snapshot exists",
        allowedActions: ["submit_for_approval"],
      };
    }

    // If requires approval, must be in APPROVAL_REQUIRED state
    if (requiresApproval && currentState !== "APPROVAL_REQUIRED") {
      return {
        valid: false,
        error: `Cannot finalize: document requires approval but is in state '${currentState}'`,
        allowedActions: this.getNextActions(currentState, requiresApproval),
      };
    }

    // Validate normal transition
    const action = requiresApproval ? "approve_and_finalize" : "finalize";
    return this.validateTransition(currentState, action, requiresApproval);
  }

  /**
   * Validates approve action with snapshot checks
   *
   * @param currentState - Current document state
   * @param reviewSnapshotId - Snapshot being approved
   * @param currentReviewSnapshotId - Current review snapshot in document
   * @returns Validation result
   */
  static validateApprove(
    currentState: DocumentState,
    reviewSnapshotId: string,
    currentReviewSnapshotId: string | null
  ): TransitionValidation {
    // Must be in APPROVAL_REQUIRED state
    if (currentState !== "APPROVAL_REQUIRED") {
      return {
        valid: false,
        error: `Cannot approve: document is in state '${currentState}', expected 'APPROVAL_REQUIRED'`,
        allowedActions: this.getNextActions(currentState, true),
      };
    }

    // Snapshot must match current review snapshot
    if (reviewSnapshotId !== currentReviewSnapshotId) {
      return {
        valid: false,
        error: "SNAPSHOT_OUTDATED: The review snapshot has changed. Please reload.",
        allowedActions: ["reload"],
      };
    }

    return {
      valid: true,
      targetState: "APPROVAL_REQUIRED" // Stays in same state until finalize
    };
  }

  /**
   * Gets human-readable state description
   *
   * @param state - Document state
   * @returns Description string
   */
  static getStateDescription(state: DocumentState): string {
    const descriptions: Record<DocumentState, string> = {
      DRAFT: "Document is in draft mode and can be edited",
      APPROVAL_REQUIRED: "Document is under review and awaiting approval",
      FINAL: "Document has been finalized and is read-only",
    };
    return descriptions[state];
  }

  /**
   * Gets human-readable action description
   *
   * @param action - Action name
   * @returns Description string
   */
  static getActionDescription(action: string): string {
    const descriptions: Record<string, string> = {
      finalize: "Finalize document directly (no approval required)",
      submit_for_approval: "Submit document for review and approval",
      approve_and_finalize: "Approve reviewed content and finalize document",
      reopen: "Reopen finalized document for editing",
    };
    return descriptions[action] || action;
  }
}
