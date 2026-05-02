import { demands, files, users, type User, type InsertUser, type Demand, type InsertDemand, type File, type InsertFile, type ChatMessage } from "@shared/schema";

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  createDemand(demand: InsertDemand): Promise<Demand>;
  getDemand(id: number): Promise<Demand | undefined>;
  getAllDemands(): Promise<Demand[]>;
  updateDemand(id: number, updates: Partial<Demand>): Promise<Demand | undefined>;
  updateDemandChat(id: number, messages: ChatMessage[]): Promise<void>;

  createFile(file: InsertFile): Promise<File>;
  getFilesByDemandId(demandId: number): Promise<File[]>;
  getFile(id: number): Promise<File | undefined>;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private demands: Map<number, Demand>;
  private files: Map<number, File>;
  private currentUserId: number;
  private currentDemandId: number;
  private currentFileId: number;

  constructor() {
    this.users = new Map();
    this.demands = new Map();
    this.files = new Map();
    this.currentUserId = 1;
    this.currentDemandId = 1;
    this.currentFileId = 1;
  }

  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.currentUserId++;
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  async createDemand(insertDemand: InsertDemand): Promise<Demand> {
    console.log("Creating demand with title:", insertDemand.title); // Log the full title
    const id = this.currentDemandId++;
    const now = new Date();
    const demand: Demand = {
      ...insertDemand,
      id,
      status: 'processing',
      progress: 0,
      chatMessages: [],
      prdUrl: null,
      tasksUrl: null,
      domain: insertDemand.domain ?? 'padrao',
      executionId: null,
      executionConfig: null,
      qualityPassed: null,
      missingSections: null,
      fallbackUsed: false,
      fallbackReason: null,
      refinementType: insertDemand.refinementType ?? null,
      classification: null,
      orchestration: null,
      currentAgent: null,
      errorMessage: null,
      validationNotes: null,
      typeAdherence: null,
      completedAt: null,

      // Governance fields
      requiresApproval: insertDemand.requiresApproval ?? false,
      documentState: "DRAFT",
      reviewSnapshotId: null,
      approvedSnapshotId: null,
      approvedSnapshotHash: null,
      finalSnapshotId: null,
      finalizedFromHash: null,
      approvalSessionId: null,

      createdAt: now,
      updatedAt: now,
    };
    this.demands.set(id, demand);
    return demand;
  }

  async getDemand(id: number): Promise<Demand | undefined> {
    return this.demands.get(id);
  }

  async getAllDemands(): Promise<Demand[]> {
    return Array.from(this.demands.values()).sort((a, b) =>
      new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime()
    );
  }

  async updateDemand(id: number, updates: Partial<Demand>): Promise<Demand | undefined> {
    const demand = this.demands.get(id);
    if (!demand) return undefined;

    const updated = { ...demand, ...updates, updatedAt: new Date() };
    this.demands.set(id, updated);
    return updated;
  }

  async updateDemandChat(id: number, messages: ChatMessage[]): Promise<void> {
    const demand = this.demands.get(id);
    if (demand) {
      demand.chatMessages = messages;
      demand.updatedAt = new Date();
    }
  }

  async createFile(insertFile: InsertFile): Promise<File> {
    const id = this.currentFileId++;
    const file: File = {
      ...insertFile,
      id,
      size: insertFile.size || 0,
      demandId: insertFile.demandId || 0,
      createdAt: new Date(),
    };
    this.files.set(id, file);
    return file;
  }

  async getFilesByDemandId(demandId: number): Promise<File[]> {
    return Array.from(this.files.values()).filter(file => file.demandId === demandId);
  }

  async getFile(id: number): Promise<File | undefined> {
    return this.files.get(id);
  }
}

export const storage = new MemStorage();
