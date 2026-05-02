import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import type { Demand } from '@shared/schema';

export interface DocumentSnapshot {
  snapshotId: string;
  demandId: number;
  snapshotType: 'REVIEW' | 'APPROVED';
  payloadJson: string;
  snapshotHash: string;
  createdAt: Date;
}

export interface SnapshotPayload {
  demandId: number;
  title: string;
  description: string;
  type: string;
  priority: string;
  prdContent: string;
  tasksContent: string;
  chatMessages: any[];
  metadata: {
    refinementType: string | null;
    typeAdherence: any;
    classification: any;
    orchestration: any;
  };
}

/**
 * Document Snapshot Service
 *
 * Manages immutable snapshots for document review and approval.
 * Ensures deterministic content for governance workflow.
 */
export class DocumentSnapshotService {
  /**
   * Creates an immutable snapshot from a demand
   *
   * @param demand - The demand to snapshot
   * @param snapshotType - Type of snapshot (REVIEW or APPROVED)
   * @returns DocumentSnapshot with unique ID and hash
   */
  static createSnapshot(
    demand: Demand,
    snapshotType: 'REVIEW' | 'APPROVED'
  ): DocumentSnapshot {
    const snapshotId = uuidv4();

    // Create payload with rendered/derived content
    const payload: SnapshotPayload = {
      demandId: demand.id,
      title: demand.title,
      description: demand.description,
      type: demand.type,
      priority: demand.priority,
      prdContent: demand.prdUrl || '', // Use actual content if available
      tasksContent: demand.tasksUrl || '',
      chatMessages: demand.chatMessages || [],
      metadata: {
        refinementType: demand.refinementType,
        typeAdherence: demand.typeAdherence,
        classification: demand.classification,
        orchestration: demand.orchestration,
      },
    };

    const payloadJson = JSON.stringify(payload, null, 0); // No whitespace for consistency
    const snapshotHash = this.generateHash(payloadJson);

    return {
      snapshotId,
      demandId: demand.id,
      snapshotType,
      payloadJson,
      snapshotHash,
      createdAt: new Date(),
    };
  }

  /**
   * Generates deterministic SHA-256 hash of content
   *
   * @param content - Content to hash
   * @returns Hex string hash
   */
  static generateHash(content: string): string {
    return crypto
      .createHash('sha256')
      .update(content, 'utf8')
      .digest('hex');
  }

  /**
   * Verifies snapshot integrity by comparing hash
   *
   * @param snapshot - Snapshot to verify
   * @returns true if hash matches content
   */
  static verifySnapshot(snapshot: DocumentSnapshot): boolean {
    const calculatedHash = this.generateHash(snapshot.payloadJson);
    return snapshot.snapshotHash === calculatedHash;
  }

  /**
   * Compares two snapshots by hash
   *
   * @param snapshot1 - First snapshot
   * @param snapshot2 - Second snapshot
   * @returns true if snapshots are identical
   */
  static compareSnapshots(
    snapshot1: DocumentSnapshot,
    snapshot2: DocumentSnapshot
  ): boolean {
    return snapshot1.snapshotHash === snapshot2.snapshotHash;
  }

  /**
   * Parses snapshot payload JSON
   *
   * @param snapshot - Snapshot to parse
   * @returns Parsed payload object
   */
  static parsePayload(snapshot: DocumentSnapshot): SnapshotPayload {
    return JSON.parse(snapshot.payloadJson);
  }

  /**
   * Validates that finalized content matches approved snapshot
   *
   * @param finalizedHash - Hash of finalized content
   * @param approvedHash - Hash of approved snapshot
   * @returns true if hashes match
   */
  static validateFinalization(
    finalizedHash: string,
    approvedHash: string
  ): boolean {
    return finalizedHash === approvedHash;
  }
}
