import { describe, it, expect, beforeEach } from 'vitest';
import { DocumentSnapshotService } from '../server/services/document-snapshot-service';
import { DocumentStateMachine } from '../server/services/document-state-machine';
import type { Demand } from '@shared/schema';

describe('DocumentSnapshotService', () => {
  const mockDemand: Demand = {
    id: 1,
    title: 'Test Demand',
    description: 'Test Description',
    type: 'nova_funcionalidade',
    priority: 'alta',
    refinementType: null,
    status: 'processing',
    progress: 0,
    chatMessages: [],
    prdUrl: 'test-prd-content',
    tasksUrl: 'test-tasks-content',
    classification: null,
    orchestration: null,
    currentAgent: null,
    errorMessage: null,
    validationNotes: null,
    typeAdherence: null,
    completedAt: null,
    requiresApproval: true,
    documentState: 'DRAFT',
    reviewSnapshotId: null,
    approvedSnapshotId: null,
    approvedSnapshotHash: null,
    finalSnapshotId: null,
    finalizedFromHash: null,
    approvalSessionId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  describe('createSnapshot', () => {
    it('should create a valid review snapshot', () => {
      const snapshot = DocumentSnapshotService.createSnapshot(mockDemand, 'REVIEW');

      expect(snapshot.snapshotId).toBeDefined();
      expect(snapshot.demandId).toBe(1);
      expect(snapshot.snapshotType).toBe('REVIEW');
      expect(snapshot.payloadJson).toBeDefined();
      expect(snapshot.snapshotHash).toBeDefined();
      expect(snapshot.snapshotHash).toHaveLength(64); // SHA-256 hex length
    });

    it('should create deterministic hash for same content', () => {
      const snapshot1 = DocumentSnapshotService.createSnapshot(mockDemand, 'REVIEW');
      const snapshot2 = DocumentSnapshotService.createSnapshot(mockDemand, 'REVIEW');

      // Different snapshot IDs
      expect(snapshot1.snapshotId).not.toBe(snapshot2.snapshotId);

      // But same hash for same content
      expect(snapshot1.snapshotHash).toBe(snapshot2.snapshotHash);
    });

    it('should create different hash for different content', () => {
      const snapshot1 = DocumentSnapshotService.createSnapshot(mockDemand, 'REVIEW');

      const modifiedDemand = { ...mockDemand, title: 'Modified Title' };
      const snapshot2 = DocumentSnapshotService.createSnapshot(modifiedDemand, 'REVIEW');

      expect(snapshot1.snapshotHash).not.toBe(snapshot2.snapshotHash);
    });
  });

  describe('verifySnapshot', () => {
    it('should verify valid snapshot', () => {
      const snapshot = DocumentSnapshotService.createSnapshot(mockDemand, 'REVIEW');
      expect(DocumentSnapshotService.verifySnapshot(snapshot)).toBe(true);
    });

    it('should reject tampered snapshot', () => {
      const snapshot = DocumentSnapshotService.createSnapshot(mockDemand, 'REVIEW');

      // Tamper with payload
      const tamperedSnapshot = {
        ...snapshot,
        payloadJson: JSON.stringify({ ...JSON.parse(snapshot.payloadJson), title: 'Hacked' })
      };

      expect(DocumentSnapshotService.verifySnapshot(tamperedSnapshot)).toBe(false);
    });
  });

  describe('compareSnapshots', () => {
    it('should return true for identical content', () => {
      const snapshot1 = DocumentSnapshotService.createSnapshot(mockDemand, 'REVIEW');
      const snapshot2 = DocumentSnapshotService.createSnapshot(mockDemand, 'APPROVED');

      expect(DocumentSnapshotService.compareSnapshots(snapshot1, snapshot2)).toBe(true);
    });

    it('should return false for different content', () => {
      const snapshot1 = DocumentSnapshotService.createSnapshot(mockDemand, 'REVIEW');

      const modifiedDemand = { ...mockDemand, description: 'Modified' };
      const snapshot2 = DocumentSnapshotService.createSnapshot(modifiedDemand, 'REVIEW');

      expect(DocumentSnapshotService.compareSnapshots(snapshot1, snapshot2)).toBe(false);
    });
  });

  describe('validateFinalization', () => {
    it('should validate matching hashes', () => {
      const snapshot = DocumentSnapshotService.createSnapshot(mockDemand, 'APPROVED');

      expect(DocumentSnapshotService.validateFinalization(
        snapshot.snapshotHash,
        snapshot.snapshotHash
      )).toBe(true);
    });

    it('should reject mismatched hashes', () => {
      expect(DocumentSnapshotService.validateFinalization(
        'hash1',
        'hash2'
      )).toBe(false);
    });
  });
});

describe('DocumentStateMachine', () => {
  describe('canTransition', () => {
    it('should allow DRAFT to FINAL without approval', () => {
      expect(DocumentStateMachine.canTransition('DRAFT', 'FINAL', false)).toBe(true);
    });

    it('should allow DRAFT to APPROVAL_REQUIRED with approval', () => {
      expect(DocumentStateMachine.canTransition('DRAFT', 'APPROVAL_REQUIRED', true)).toBe(true);
    });

    it('should allow APPROVAL_REQUIRED to FINAL with approval', () => {
      expect(DocumentStateMachine.canTransition('APPROVAL_REQUIRED', 'FINAL', true)).toBe(true);
    });

    it('should reject DRAFT to APPROVAL_REQUIRED without approval requirement', () => {
      expect(DocumentStateMachine.canTransition('DRAFT', 'APPROVAL_REQUIRED', false)).toBe(false);
    });

    it('should reject invalid transitions', () => {
      expect(DocumentStateMachine.canTransition('FINAL', 'APPROVAL_REQUIRED', true)).toBe(false);
    });
  });

  describe('getNextActions', () => {
    it('should return finalize for DRAFT without approval', () => {
      const actions = DocumentStateMachine.getNextActions('DRAFT', false);
      expect(actions).toContain('finalize');
      expect(actions).not.toContain('submit_for_approval');
    });

    it('should return submit_for_approval for DRAFT with approval', () => {
      const actions = DocumentStateMachine.getNextActions('DRAFT', true);
      expect(actions).toContain('submit_for_approval');
      expect(actions).not.toContain('finalize');
    });

    it('should return approve_and_finalize for APPROVAL_REQUIRED', () => {
      const actions = DocumentStateMachine.getNextActions('APPROVAL_REQUIRED', true);
      expect(actions).toContain('approve_and_finalize');
    });
  });

  describe('validateTransition', () => {
    it('should validate allowed transition', () => {
      const result = DocumentStateMachine.validateTransition('DRAFT', 'finalize', false);

      expect(result.valid).toBe(true);
      expect(result.targetState).toBe('FINAL');
      expect(result.error).toBeUndefined();
    });

    it('should reject invalid transition with error', () => {
      const result = DocumentStateMachine.validateTransition('FINAL', 'finalize', false);

      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.allowedActions).toBeDefined();
    });
  });

  describe('validateFinalize', () => {
    it('should allow finalize without approval requirement', () => {
      const result = DocumentStateMachine.validateFinalize('DRAFT', false, false);
      expect(result.valid).toBe(true);
    });

    it('should reject finalize with approval but no approved snapshot', () => {
      const result = DocumentStateMachine.validateFinalize('APPROVAL_REQUIRED', true, false);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('no approved snapshot exists');
    });

    it('should reject finalize in wrong state', () => {
      const result = DocumentStateMachine.validateFinalize('DRAFT', true, true);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('but is in state');
    });

    it('should allow finalize with approval and approved snapshot', () => {
      const result = DocumentStateMachine.validateFinalize('APPROVAL_REQUIRED', true, true);
      expect(result.valid).toBe(true);
    });
  });

  describe('validateApprove', () => {
    it('should validate approve in APPROVAL_REQUIRED state', () => {
      const snapshotId = 'test-snapshot-id';
      const result = DocumentStateMachine.validateApprove(
        'APPROVAL_REQUIRED',
        snapshotId,
        snapshotId
      );

      expect(result.valid).toBe(true);
    });

    it('should reject approve in wrong state', () => {
      const result = DocumentStateMachine.validateApprove('DRAFT', 'snapshot-id', 'snapshot-id');

      expect(result.valid).toBe(false);
      expect(result.error).toContain('expected \'APPROVAL_REQUIRED\'');
    });

    it('should reject approve with outdated snapshot', () => {
      const result = DocumentStateMachine.validateApprove(
        'APPROVAL_REQUIRED',
        'old-snapshot',
        'new-snapshot'
      );

      expect(result.valid).toBe(false);
      expect(result.error).toContain('SNAPSHOT_OUTDATED');
    });
  });

  describe('getStateDescription', () => {
    it('should return description for each state', () => {
      expect(DocumentStateMachine.getStateDescription('DRAFT')).toContain('draft');
      expect(DocumentStateMachine.getStateDescription('APPROVAL_REQUIRED')).toContain('review');
      expect(DocumentStateMachine.getStateDescription('FINAL')).toContain('finalized');
    });
  });

  describe('getActionDescription', () => {
    it('should return description for each action', () => {
      expect(DocumentStateMachine.getActionDescription('finalize')).toContain('Finalize');
      expect(DocumentStateMachine.getActionDescription('submit_for_approval')).toContain('Submit');
      expect(DocumentStateMachine.getActionDescription('approve_and_finalize')).toContain('Approve');
    });
  });
});

describe('Governance Integration Tests', () => {
  describe('Complete Approval Workflow', () => {
    it('should follow complete workflow from DRAFT to FINAL', () => {
      const mockDemand: Demand = {
        id: 1,
        title: 'Test',
        description: 'Test',
        type: 'nova_funcionalidade',
        priority: 'alta',
        refinementType: null,
        status: 'processing',
        progress: 0,
        chatMessages: [],
        prdUrl: 'content',
        tasksUrl: 'content',
        classification: null,
        orchestration: null,
        currentAgent: null,
        errorMessage: null,
        validationNotes: null,
        typeAdherence: null,
        completedAt: null,
        requiresApproval: true,
        documentState: 'DRAFT',
        reviewSnapshotId: null,
        approvedSnapshotId: null,
        approvedSnapshotHash: null,
        finalSnapshotId: null,
        finalizedFromHash: null,
        approvalSessionId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Step 1: Create review snapshot
      const reviewSnapshot = DocumentSnapshotService.createSnapshot(mockDemand, 'REVIEW');
      expect(reviewSnapshot.snapshotType).toBe('REVIEW');

      // Step 2: Validate transition to APPROVAL_REQUIRED
      const submitValidation = DocumentStateMachine.validateTransition(
        'DRAFT',
        'submit_for_approval',
        true
      );
      expect(submitValidation.valid).toBe(true);

      // Step 3: Validate approve
      const approveValidation = DocumentStateMachine.validateApprove(
        'APPROVAL_REQUIRED',
        reviewSnapshot.snapshotId,
        reviewSnapshot.snapshotId
      );
      expect(approveValidation.valid).toBe(true);

      // Step 4: Create approved snapshot
      const approvedSnapshot = DocumentSnapshotService.createSnapshot(mockDemand, 'APPROVED');
      expect(approvedSnapshot.snapshotType).toBe('APPROVED');

      // Step 5: Validate finalize
      const finalizeValidation = DocumentStateMachine.validateFinalize(
        'APPROVAL_REQUIRED',
        true,
        true
      );
      expect(finalizeValidation.valid).toBe(true);

      // Step 6: Validate hash consistency
      expect(DocumentSnapshotService.validateFinalization(
        approvedSnapshot.snapshotHash,
        approvedSnapshot.snapshotHash
      )).toBe(true);
    });
  });

  describe('Guardrails', () => {
    it('should prevent finalization without approval when required', () => {
      const validation = DocumentStateMachine.validateFinalize(
        'APPROVAL_REQUIRED',
        true,
        false // No approved snapshot
      );

      expect(validation.valid).toBe(false);
      expect(validation.error).toContain('no approved snapshot exists');
    });

    it('should detect snapshot tampering', () => {
      const mockDemand: Demand = {
        id: 1,
        title: 'Original',
        description: 'Original',
        type: 'nova_funcionalidade',
        priority: 'alta',
        refinementType: null,
        status: 'processing',
        progress: 0,
        chatMessages: [],
        prdUrl: 'content',
        tasksUrl: 'content',
        classification: null,
        orchestration: null,
        currentAgent: null,
        errorMessage: null,
        validationNotes: null,
        typeAdherence: null,
        completedAt: null,
        requiresApproval: true,
        documentState: 'DRAFT',
        reviewSnapshotId: null,
        approvedSnapshotId: null,
        approvedSnapshotHash: null,
        finalSnapshotId: null,
        finalizedFromHash: null,
        approvalSessionId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const originalSnapshot = DocumentSnapshotService.createSnapshot(mockDemand, 'APPROVED');

      // Simulate tampering
      const tamperedPayload = JSON.parse(originalSnapshot.payloadJson);
      tamperedPayload.title = 'Tampered';
      const tamperedSnapshot = {
        ...originalSnapshot,
        payloadJson: JSON.stringify(tamperedPayload)
      };

      expect(DocumentSnapshotService.verifySnapshot(tamperedSnapshot)).toBe(false);
    });
  });
});
