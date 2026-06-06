import { app } from "electron";
import { mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";

export interface MemoryEntry {
  id: string;
  content: string;
  category: "preference" | "profile" | "workflow" | "instruction";
  createdAt: number;
  updatedAt: number;
}

export class MemoryStore {
  private static instance: MemoryStore | null = null;
  private readonly filePath: string;
  private memories: MemoryEntry[];

  private constructor() {
    this.filePath = join(app.getPath("userData"), "memory-store.json");
    this.memories = this.load();
  }

  static getInstance(): MemoryStore {
    if (!MemoryStore.instance) {
      MemoryStore.instance = new MemoryStore();
    }
    return MemoryStore.instance;
  }

  getMemories(): MemoryEntry[] {
    return [...this.memories].sort((a, b) => b.updatedAt - a.updatedAt);
  }

  upsertMemory(
    content: string,
    category: MemoryEntry["category"],
  ): MemoryEntry {
    const normalized = this.normalizeContent(content);
    const now = Date.now();
    const existing = this.memories.find(
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

    this.memories = [memory, ...this.memories].slice(0, 100);
    this.persist();
    return { ...memory };
  }

  deleteMemory(id: string): MemoryEntry[] {
    this.memories = this.memories.filter((entry) => entry.id !== id);
    this.persist();
    return this.getMemories();
  }

  clear(): MemoryEntry[] {
    this.memories = [];
    this.persist();
    return [];
  }

  private load(): MemoryEntry[] {
    try {
      const raw = readFileSync(this.filePath, "utf8");
      const parsed = JSON.parse(raw) as MemoryEntry[];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  private persist(): void {
    mkdirSync(dirname(this.filePath), { recursive: true });
    writeFileSync(
      this.filePath,
      JSON.stringify(this.memories, null, 2),
      "utf8",
    );
  }

  private normalizeContent(value: string): string {
    return value.trim().replace(/\s+/g, " ").toLowerCase();
  }
}
