"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.storage = exports.MemStorage = void 0;
class MemStorage {
    users;
    demands;
    files;
    currentUserId;
    currentDemandId;
    currentFileId;
    constructor() {
        this.users = new Map();
        this.demands = new Map();
        this.files = new Map();
        this.currentUserId = 1;
        this.currentDemandId = 1;
        this.currentFileId = 1;
    }
    async getUser(id) {
        return this.users.get(id);
    }
    async getUserByUsername(username) {
        return Array.from(this.users.values()).find((user) => user.username === username);
    }
    async createUser(insertUser) {
        const id = this.currentUserId++;
        const user = { ...insertUser, id };
        this.users.set(id, user);
        return user;
    }
    async createDemand(insertDemand) {
        console.log("Creating demand with title:", insertDemand.title); // Log the full title
        const id = this.currentDemandId++;
        const now = new Date();
        const demand = {
            ...insertDemand,
            id,
            status: 'processing',
            progress: 0, // Initial progress
            chatMessages: [],
            prdUrl: null,
            tasksUrl: null,
            createdAt: now,
            updatedAt: now,
        };
        this.demands.set(id, demand);
        return demand;
    }
    async getDemand(id) {
        return this.demands.get(id);
    }
    async getAllDemands() {
        return Array.from(this.demands.values()).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }
    async updateDemand(id, updates) {
        const demand = this.demands.get(id);
        if (!demand)
            return undefined;
        const updated = { ...demand, ...updates, updatedAt: new Date() };
        this.demands.set(id, updated);
        return updated;
    }
    async updateDemandChat(id, messages) {
        const demand = this.demands.get(id);
        if (demand) {
            demand.chatMessages = messages;
            demand.updatedAt = new Date();
        }
    }
    async createFile(insertFile) {
        const id = this.currentFileId++;
        const file = {
            ...insertFile,
            id,
            size: insertFile.size || 0,
            demandId: insertFile.demandId || 0,
            createdAt: new Date(),
        };
        this.files.set(id, file);
        return file;
    }
    async getFilesByDemandId(demandId) {
        return Array.from(this.files.values()).filter(file => file.demandId === demandId);
    }
    async getFile(id) {
        return this.files.get(id);
    }
}
exports.MemStorage = MemStorage;
exports.storage = new MemStorage();
