import { app } from "electron";
import { mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { ProfileContextStore } from "./ProfileContextStore";

export interface MemoryEntry {
  id: string;
  content: string;
  category: "preference" | "profile" | "workflow" | "instruction";
  createdAt: number;
  updatedAt: number;
}

interface MemoryFile {
  version: 2;
  contexts: Record<string, MemoryEntry[]>;
}

export class MemoryStore {
  private static instance: MemoryStore | null = null;
  private readonly filePath: string;
  private readonly profileContextStore: ProfileContextStore;
  private contexts: Record<string, MemoryEntry[]>;

  private constructor() {
    this.filePath = join(app.getPath("userData"), "memory-store.json");
    this.profileContextStore = ProfileContextStore.getInstance();
    this.contexts = this.load();
  }

  static getInstance(): MemoryStore {
    if (!MemoryStore.instance) {
      MemoryStore.instance = new MemoryStore();
    }
    return MemoryStore.instance;
  }

  getMemories(): MemoryEntry[] {
    return [...this.getActiveMemories()].sort(
      (a, b) => b.updatedAt - a.updatedAt,
    );
  }

  upsertMemory(
    content: string,
    category: MemoryEntry["category"],
  ): MemoryEntry {
    const normalized = this.normalizeContent(content);
    const now = Date.now();
    const memories = this.getActiveMemories();
    const existing = memories.find(
      (entry) => this.normalizeContent(entry.content) === normalized,
    );

    if (existing) {
      existing.updatedAt = now;
      existing.category = category;
      this.persist();
      return { ...existing };
    }

    const memory: MemoryEntry = {
      id: `memory-${now}-${Math.random().toString(16).slice(2, 8)}`,
      content: content.trim(),
      category,
      createdAt: now,
      updatedAt: now,
    };

    this.contexts[this.getActiveContextId()] = [memory, ...memories].slice(
      0,
      100,
    );
    this.persist();
    return { ...memory };
  }

  deleteMemory(id: string): MemoryEntry[] {
    const contextId = this.getActiveContextId();
    this.contexts[contextId] = this.getActiveMemories().filter(
      (entry) => entry.id !== id,
    );
    this.persist();
    return this.getMemories();
  }

  clear(): MemoryEntry[] {
    this.contexts[this.getActiveContextId()] = [];
    this.persist();
    return [];
  }

  deleteContext(contextId: string): void {
    delete this.contexts[contextId];
    this.persist();
  }

  private load(): Record<string, MemoryEntry[]> {
    try {
      const raw = readFileSync(this.filePath, "utf8");
      const parsed = JSON.parse(raw) as MemoryFile | MemoryEntry[];
      if (Array.isArray(parsed)) {
        return { [this.getActiveContextId()]: parsed };
      }
      return parsed.version === 2 &&
        parsed.contexts &&
        typeof parsed.contexts === "object"
        ? parsed.contexts
        : {};
    } catch {
      return {};
    }
  }

  private persist(): void {
    const data: MemoryFile = { version: 2, contexts: this.contexts };
    mkdirSync(dirname(this.filePath), { recursive: true });
    writeFileSync(this.filePath, JSON.stringify(data, null, 2), "utf8");
  }

  private getActiveContextId(): string {
    return this.profileContextStore.getActiveContextId();
  }

  private getActiveMemories(): MemoryEntry[] {
    return this.contexts[this.getActiveContextId()] ?? [];
  }

  private normalizeContent(value: string): string {
    return value.trim().replace(/\s+/g, " ").toLowerCase();
  }
}
