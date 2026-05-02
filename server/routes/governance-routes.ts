import { Router } from 'express';
import { db } from '../db';
import { demands, documentSnapshots, approvalComments, documentLifecycleEvents } from '@shared/schema';
import { eq, and, desc } from 'drizzle-orm';
import { DocumentSnapshotService } from '../services/document-snapshot-service';
import { DocumentStateMachine } from '../services/document-state-machine';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

/**
 * Submit document for approval
 * Creates immutable review snapshot and transitions to APPROVAL_REQUIRED
 */
router.post('/demands/:id/submit-for-approval', async (req, res) => {
  const demandId = parseInt(req.params.id);
  const approvalSessionId = uuidv4();

  try {
    // Get current demand
    const demand = await db.query.demands.findFirst({
      where: eq(demands.id, demandId)
    });

    if (!demand) {
      return res.status(404).json({ error: 'Demand not found' });
    }

    // Validate transition
    const validation = DocumentStateMachine.validateTransition(
      demand.documentState || 'DRAFT',
      'submit_for_approval',
      demand.requiresApproval || false
    );

    if (!validation.valid) {
      return res.status(409).json({
        error: validation.error,
        currentState: demand.documentState,
        allowedActions: validation.allowedActions
      });
    }

    // Create immutable review snapshot
    const snapshot = DocumentSnapshotService.createSnapshot(demand, 'REVIEW');

    // Persist snapshot
    await db.insert(documentSnapshots).values({
      snapshotId: snapshot.snapshotId,
      demandId: snapshot.demandId,
      snapshotType: snapshot.snapshotType,
      payloadJson: snapshot.payloadJson,
      snapshotHash: snapshot.snapshotHash,
      createdAt: snapshot.createdAt,
    });

    // Update demand state
    await db.update(demands)
      .set({
        documentState: 'APPROVAL_REQUIRED',
        reviewSnapshotId: snapshot.snapshotId,
        approvalSessionId,
        updatedAt: new Date(),
      })
      .where(eq(demands.id, demandId));

    // Record lifecycle event
    await db.insert(documentLifecycleEvents).values({
      demandId,
      requiresApproval: demand.requiresApproval || false,
      approvalSessionId,
      eventType: 'DRAFT_TO_APPROVAL_REQUIRED',
      reviewSnapshotId: snapshot.snapshotId,
      resultCode: 'SUCCESS',
      createdAt: new Date(),
    });

    res.json({
      success: true,
      documentState: 'APPROVAL_REQUIRED',
      reviewSnapshotId: snapshot.snapshotId,
      snapshotHash: snapshot.snapshotHash,
      approvalSessionId,
    });
  } catch (error) {
    console.error('Error submitting for approval:', error);

    // Record failed attempt
    await db.insert(documentLifecycleEvents).values({
      demandId,
      requiresApproval: true,
      eventType: 'APPROVE_ATTEMPT',
      resultCode: 'ERROR',
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
      createdAt: new Date(),
    });

    res.status(500).json({ error: 'Failed to submit for approval' });
  }
});

/**
 * Approve document
 * Validates snapshot and creates approved snapshot
 */
router.post('/demands/:id/approve', async (req, res) => {
  const demandId = parseInt(req.params.id);
  const { reviewSnapshotId, comments } = req.body;

  if (!reviewSnapshotId) {
    return res.status(400).json({ error: 'reviewSnapshotId is required' });
  }

  try {
    // Get current demand
    const demand = await db.query.demands.findFirst({
      where: eq(demands.id, demandId)
    });

    if (!demand) {
      return res.status(404).json({ error: 'Demand not found' });
    }

    // Validate approve action
    const validation = DocumentStateMachine.validateApprove(
      demand.documentState || 'DRAFT',
      reviewSnapshotId,
      demand.reviewSnapshotId || null
    );

    if (!validation.valid) {
      // Record failed attempt
      await db.insert(documentLifecycleEvents).values({
        demandId,
        requiresApproval: true,
        approvalSessionId: demand.approvalSessionId || undefined,
        eventType: validation.error?.includes('SNAPSHOT_OUTDATED')
          ? 'SNAPSHOT_OUTDATED'
          : 'APPROVE_ATTEMPT',
        reviewSnapshotId,
        resultCode: 'REJECTED',
        errorMessage: validation.error,
        createdAt: new Date(),
      });

      return res.status(409).json({
        error: validation.error,
        currentState: demand.documentState,
        currentReviewSnapshotId: demand.reviewSnapshotId,
      });
    }

    // Get review snapshot
    const reviewSnapshot = await db.query.documentSnapshots.findFirst({
      where: and(
        eq(documentSnapshots.snapshotId, reviewSnapshotId),
        eq(documentSnapshots.demandId, demandId)
      )
    });

    if (!reviewSnapshot) {
      return res.status(404).json({ error: 'Review snapshot not found' });
    }

    // Verify snapshot integrity
    if (!DocumentSnapshotService.verifySnapshot(reviewSnapshot)) {
      return res.status(500).json({ error: 'Snapshot integrity check failed' });
    }

    // Idempotency is based on content hash. approvedSnapshotId is the generated
    // APPROVED snapshot id, not the REVIEW snapshot id sent by the client.
    if (demand.approvedSnapshotHash === reviewSnapshot.snapshotHash) {
      return res.json({
        success: true,
        documentState: demand.documentState,
        approvedSnapshotId: demand.approvedSnapshotId,
        approvedSnapshotHash: demand.approvedSnapshotHash,
        message: 'Already approved (idempotent)',
      });
    }

    // Create approved snapshot (same content, different type)
    const approvedSnapshot = {
      ...reviewSnapshot,
      snapshotId: uuidv4(),
      snapshotType: 'APPROVED' as const,
      createdAt: new Date(),
    };

    // Persist approved snapshot
    await db.insert(documentSnapshots).values(approvedSnapshot);

    // Update demand with approved snapshot
    await db.update(demands)
      .set({
        approvedSnapshotId: approvedSnapshot.snapshotId,
        approvedSnapshotHash: approvedSnapshot.snapshotHash,
        updatedAt: new Date(),
      })
      .where(eq(demands.id, demandId));

    // Save comments if provided
    if (comments) {
      await db.insert(approvalComments).values({
        demandId,
        reviewSnapshotId,
        approvedSnapshotId: approvedSnapshot.snapshotId,
        author: 'Reviewer', // TODO: Get from auth context
        content: comments,
        createdAt: new Date(),
      });
    }

    // Record lifecycle event
    await db.insert(documentLifecycleEvents).values({
      demandId,
      requiresApproval: true,
      approvalSessionId: demand.approvalSessionId || undefined,
      eventType: 'APPROVAL_REQUIRED_TO_APPROVED',
      reviewSnapshotId,
      approvedSnapshotId: approvedSnapshot.snapshotId,
      resultCode: 'SUCCESS',
      createdAt: new Date(),
    });

    res.json({
      success: true,
      documentState: 'APPROVAL_REQUIRED',
      approvedSnapshotId: approvedSnapshot.snapshotId,
      approvedSnapshotHash: approvedSnapshot.snapshotHash,
    });
  } catch (error) {
    console.error('Error approving document:', error);

    // Record failed attempt
    await db.insert(documentLifecycleEvents).values({
      demandId,
      requiresApproval: true,
      eventType: 'APPROVE_ATTEMPT',
      reviewSnapshotId,
      resultCode: 'ERROR',
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
      createdAt: new Date(),
    });

    res.status(500).json({ error: 'Failed to approve document' });
  }
});

/**
 * Finalize document
 * Derives final content exclusively from approved snapshot
 * GUARDRAIL: Rejects any content payload from client
 */
router.post('/demands/:id/finalize', async (req, res) => {
  const demandId = parseInt(req.params.id);

  // GUARDRAIL: Reject if client sends content fields
  const contentFields = ['prdContent', 'tasksContent', 'description', 'title'];
  const hasContentFields = contentFields.some(field => req.body[field] !== undefined);

  if (hasContentFields) {
    // Record rejected attempt
    await db.insert(documentLifecycleEvents).values({
      demandId,
      requiresApproval: true,
      eventType: 'FINALIZE_PAYLOAD_REJECTED',
      resultCode: 'REJECTED',
      errorMessage: 'Client sent content fields in finalize request',
      createdAt: new Date(),
    });

    return res.status(400).json({
      error: 'Invalid request: finalize must not contain content fields',
      rejectedFields: contentFields.filter(f => req.body[f] !== undefined),
    });
  }

  try {
    // Get current demand
    const demand = await db.query.demands.findFirst({
      where: eq(demands.id, demandId)
    });

    if (!demand) {
      return res.status(404).json({ error: 'Demand not found' });
    }

    // Validate finalize action
    const validation = DocumentStateMachine.validateFinalize(
      demand.documentState || 'DRAFT',
      demand.requiresApproval || false,
      !!demand.approvedSnapshotId
    );

    if (!validation.valid) {
      // Record failed attempt
      await db.insert(documentLifecycleEvents).values({
        demandId,
        requiresApproval: demand.requiresApproval || false,
        approvalSessionId: demand.approvalSessionId || undefined,
        eventType: 'FINALIZE_ATTEMPT',
        resultCode: 'REJECTED',
        errorMessage: validation.error,
        createdAt: new Date(),
      });

      return res.status(409).json({
        error: validation.error,
        currentState: demand.documentState,
        requiresApproval: demand.requiresApproval,
        allowedActions: validation.allowedActions,
      });
    }

    let finalSnapshotId: string | undefined;
    let finalizedFromHash: string | undefined;

    // If requires approval, derive from approved snapshot
    if (demand.requiresApproval && demand.approvedSnapshotId) {
      const approvedSnapshot = await db.query.documentSnapshots.findFirst({
        where: eq(documentSnapshots.snapshotId, demand.approvedSnapshotId)
      });

      if (!approvedSnapshot) {
        return res.status(500).json({ error: 'Approved snapshot not found' });
      }

      // Verify snapshot integrity
      if (!DocumentSnapshotService.verifySnapshot(approvedSnapshot)) {
        return res.status(500).json({ error: 'Approved snapshot integrity check failed' });
      }

      finalSnapshotId = approvedSnapshot.snapshotId;
      finalizedFromHash = approvedSnapshot.snapshotHash;

      // INVARIANT CHECK: Ensure finalized hash matches approved hash
      if (finalizedFromHash !== demand.approvedSnapshotHash) {
        console.error('INVARIANT VIOLATION: Finalized hash does not match approved hash');

        await db.insert(documentLifecycleEvents).values({
          demandId,
          requiresApproval: true,
          approvalSessionId: demand.approvalSessionId || undefined,
          eventType: 'FINALIZE_ATTEMPT',
          approvedSnapshotId: demand.approvedSnapshotId,
          finalizedFromHash,
          resultCode: 'ERROR',
          errorMessage: 'Hash mismatch: finalized !== approved',
          createdAt: new Date(),
        });

        return res.status(500).json({
          error: 'Integrity check failed: finalized content does not match approved content'
        });
      }
    }

    // Update demand to FINAL state
    await db.update(demands)
      .set({
        documentState: 'FINAL',
        status: 'completed',
        finalSnapshotId,
        finalizedFromHash,
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(demands.id, demandId));

    // Record lifecycle event
    await db.insert(documentLifecycleEvents).values({
      demandId,
      requiresApproval: demand.requiresApproval || false,
      approvalSessionId: demand.approvalSessionId || undefined,
      eventType: 'APPROVED_TO_FINAL',
      approvedSnapshotId: demand.approvedSnapshotId || undefined,
      finalSnapshotId,
      finalizedFromHash,
      resultCode: 'SUCCESS',
      createdAt: new Date(),
    });

    res.json({
      success: true,
      documentState: 'FINAL',
      finalSnapshotId,
      finalizedFromHash,
    });
  } catch (error) {
    console.error('Error finalizing document:', error);

    // Record failed attempt
    await db.insert(documentLifecycleEvents).values({
      demandId,
      requiresApproval: true,
      eventType: 'FINALIZE_ATTEMPT',
      resultCode: 'ERROR',
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
      createdAt: new Date(),
    });

    res.status(500).json({ error: 'Failed to finalize document' });
  }
});

/**
 * Get review snapshot for display
 * Returns immutable content for review UI
 */
router.get('/demands/:id/review-snapshot', async (req, res) => {
  const demandId = parseInt(req.params.id);

  try {
    const demand = await db.query.demands.findFirst({
      where: eq(demands.id, demandId)
    });

    if (!demand) {
      return res.status(404).json({ error: 'Demand not found' });
    }

    if (demand.documentState !== 'APPROVAL_REQUIRED') {
      return res.status(400).json({
        error: 'Document is not in review state',
        currentState: demand.documentState,
      });
    }

    if (!demand.reviewSnapshotId) {
      return res.status(404).json({ error: 'Review snapshot not found' });
    }

    const snapshot = await db.query.documentSnapshots.findFirst({
      where: eq(documentSnapshots.snapshotId, demand.reviewSnapshotId)
    });

    if (!snapshot) {
      return res.status(404).json({ error: 'Snapshot not found' });
    }

    // Verify integrity
    if (!DocumentSnapshotService.verifySnapshot(snapshot)) {
      return res.status(500).json({ error: 'Snapshot integrity check failed' });
    }

    const payload = DocumentSnapshotService.parsePayload(snapshot);

    res.json({
      snapshot: {
        snapshotId: snapshot.snapshotId,
        snapshotHash: snapshot.snapshotHash,
        createdAt: snapshot.createdAt,
      },
      payload,
      demandInfo: {
        id: demand.id,
        title: demand.title,
        documentState: demand.documentState,
        approvalSessionId: demand.approvalSessionId,
      },
    });
  } catch (error) {
    console.error('Error fetching review snapshot:', error);
    res.status(500).json({ error: 'Failed to fetch review snapshot' });
  }
});

/**
 * Get approval comments for a demand
 */
router.get('/demands/:id/approval-comments', async (req, res) => {
  const demandId = parseInt(req.params.id);

  try {
    const comments = await db.query.approvalComments.findMany({
      where: eq(approvalComments.demandId, demandId),
      orderBy: [desc(approvalComments.createdAt)]
    });

    res.json(comments);
  } catch (error) {
    console.error('Error fetching approval comments:', error);
    res.status(500).json({ error: 'Failed to fetch approval comments' });
  }
});

/**
 * Get lifecycle events for metrics/debugging
 */
router.get('/demands/:id/lifecycle-events', async (req, res) => {
  const demandId = parseInt(req.params.id);

  try {
    const events = await db.query.documentLifecycleEvents.findMany({
      where: eq(documentLifecycleEvents.demandId, demandId),
      orderBy: [desc(documentLifecycleEvents.createdAt)]
    });

    res.json(events);
  } catch (error) {
    console.error('Error fetching lifecycle events:', error);
    res.status(500).json({ error: 'Failed to fetch lifecycle events' });
  }
});

/**
 * Get governance metrics
 */
router.get('/metrics', async (req, res) => {
  try {
    // This would contain SQL queries for metrics
    // For now, return placeholder
    res.json({
      adoptionRate: 0,
      avgTimeToApproval: 0,
      reworkRate: 0,
      avgComments: 0,
      conflictRate: 0,
      message: 'Metrics calculation not yet implemented',
    });
  } catch (error) {
    console.error('Error fetching governance metrics:', error);
    res.status(500).json({ error: 'Failed to fetch governance metrics' });
  }
});

export default router;
