import electron from "electron";
import { mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { ProfileContextStore } from "./ProfileContextStore.ts";

export interface HistoryEntry {
  id: string;
  url: string;
  title: string;
  favicon?: string;
  visitedAt: number;
}

interface HistoryFile {
  version: 1;
  contexts: Record<string, HistoryEntry[]>;
}

export class HistoryStore {
  private static instance: HistoryStore | null = null;
  private readonly filePath: string;
  private readonly profileContextStore: ProfileContextStore;
  private contexts: Record<string, HistoryEntry[]>;
  private readonly MAX_ENTRIES_PER_CONTEXT = 2000;

  private static readonly app = electron.app;

  private constructor() {
    this.filePath = join(
      HistoryStore.app.getPath("userData"),
      "history-store.json",
    );
    this.profileContextStore = ProfileContextStore.getInstance();
    this.contexts = this.load();
  }

  static getInstance(): HistoryStore {
    if (!HistoryStore.instance) {
      HistoryStore.instance = new HistoryStore();
    }
    return HistoryStore.instance;
  }

  list(limit = 100): HistoryEntry[] {
    return [...this.getActiveHistory()]
      .sort((a, b) => b.visitedAt - a.visitedAt)
      .slice(0, limit);
  }

  addEntry(url: string, title: string, favicon?: string): void {
    if (!url || url.startsWith("browso://")) return;

    const now = Date.now();
    const contextId = this.getActiveContextId();
    const history = this.getActiveHistory();

    // Prevent duplicate entries for the same URL if visited within the last 30 seconds
    const lastEntry = history[0];
    if (
      lastEntry &&
      lastEntry.url === url &&
      now - lastEntry.visitedAt < 30000
    ) {
      lastEntry.title = title || lastEntry.title;
      lastEntry.visitedAt = now;
      this.persist();
      return;
    }

    const entry: HistoryEntry = {
      id: `hist-${now}-${Math.random().toString(16).slice(2, 8)}`,
      url,
      title: title || url,
      favicon,
      visitedAt: now,
    };

    this.contexts[contextId] = [entry, ...history].slice(
      0,
      this.MAX_ENTRIES_PER_CONTEXT,
    );
    this.persist();
  }

  delete(id: string): void {
    const contextId = this.getActiveContextId();
    this.contexts[contextId] = this.getActiveHistory().filter(
      (entry) => entry.id !== id,
    );
    this.persist();
  }

  clear(): void {
    this.contexts[this.getActiveContextId()] = [];
    this.persist();
  }

  search(query: string, limit = 20): HistoryEntry[] {
    const lowerQuery = query.toLowerCase();
    return this.getActiveHistory()
      .filter(
        (entry) =>
          entry.title.toLowerCase().includes(lowerQuery) ||
          entry.url.toLowerCase().includes(lowerQuery),
      )
      .sort((a, b) => b.visitedAt - a.visitedAt)
      .slice(0, limit);
  }

  private load(): Record<string, HistoryEntry[]> {
    try {
      const parsed = JSON.parse(
        readFileSync(this.filePath, "utf8"),
      ) as HistoryFile;
      return parsed.version === 1 && parsed.contexts ? parsed.contexts : {};
    } catch {
      return {};
    }
  }

  private persist(): void {
    const data: HistoryFile = { version: 1, contexts: this.contexts };
    try {
      mkdirSync(dirname(this.filePath), { recursive: true });
      writeFileSync(this.filePath, JSON.stringify(data, null, 2), "utf8");
    } catch (error) {
      console.error("Failed to persist history", error);
    }
  }

  private getActiveContextId(): string {
    return this.profileContextStore.getActiveContextId();
  }

  private getActiveHistory(): HistoryEntry[] {
    return this.contexts[this.getActiveContextId()] ?? [];
  }
}
