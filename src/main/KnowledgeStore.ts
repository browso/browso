import { app } from "electron";
import { mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import type { BrowserPageContext } from "./BrowserContextService";
import { rankKnowledgePages } from "./knowledgeRanking";
import { ProfileContextStore } from "./ProfileContextStore";

export interface KnowledgePage {
  id: string;
  url: string;
  title: string;
  text: string;
  selection: string;
  note: string;
  createdAt: number;
  updatedAt: number;
}

interface KnowledgeFile {
  version: 2;
  contexts: Record<string, KnowledgePage[]>;
}

export interface KnowledgeSearchResult extends KnowledgePage {
  score: number;
  excerpt: string;
}

export class KnowledgeStore {
  private static instance: KnowledgeStore | null = null;
  private readonly filePath: string;
  private readonly profileContextStore: ProfileContextStore;
  private contexts: Record<string, KnowledgePage[]>;

  private constructor() {
    this.filePath = join(app.getPath("userData"), "knowledge-store.json");
    this.profileContextStore = ProfileContextStore.getInstance();
    this.contexts = this.load();
  }

  static getInstance(): KnowledgeStore {
    if (!KnowledgeStore.instance) {
      KnowledgeStore.instance = new KnowledgeStore();
    }
    return KnowledgeStore.instance;
  }

  list(): KnowledgePage[] {
    return [...this.getActivePages()]
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .map((page) => ({ ...page }));
  }

  savePage(context: BrowserPageContext, note = ""): KnowledgePage {
    const now = Date.now();
    const pages = this.getActivePages();
    const existing = pages.find((page) => page.url === context.url);

    if (existing) {
      existing.title = context.title;
      existing.text = context.text;
      existing.selection = context.selection;
      existing.note = note.trim() || existing.note;
      existing.updatedAt = now;
      this.persist();
      return { ...existing };
    }

    const page: KnowledgePage = {
      id: `page-${now}-${Math.random().toString(16).slice(2, 8)}`,
      url: context.url,
      title: context.title || context.url,
      text: context.text,
      selection: context.selection,
      note: note.trim(),
      createdAt: now,
      updatedAt: now,
    };

    this.contexts[this.getActiveContextId()] = [page, ...pages].slice(0, 500);
    this.persist();
    return { ...page };
  }

  delete(id: string): KnowledgePage[] {
    const contextId = this.getActiveContextId();
    this.contexts[contextId] = this.getActivePages().filter(
      (page) => page.id !== id,
    );
    this.persist();
    return this.list();
  }

  clear(): KnowledgePage[] {
    this.contexts[this.getActiveContextId()] = [];
    this.persist();
    return [];
  }

  deleteContext(contextId: string): void {
    delete this.contexts[contextId];
    this.persist();
  }

  search(query: string, limit = 8): KnowledgeSearchResult[] {
    return rankKnowledgePages(this.getActivePages(), query).slice(0, limit);
  }

  private load(): Record<string, KnowledgePage[]> {
    try {
      const parsed = JSON.parse(readFileSync(this.filePath, "utf8")) as
        | KnowledgeFile
        | KnowledgePage[]
        | { version: 1; pages: KnowledgePage[] };
      if (Array.isArray(parsed)) {
        return { [this.getActiveContextId()]: parsed };
      }
      if (parsed.version === 1 && Array.isArray(parsed.pages)) {
        return { [this.getActiveContextId()]: parsed.pages };
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
    const data: KnowledgeFile = { version: 2, contexts: this.contexts };
    mkdirSync(dirname(this.filePath), { recursive: true });
    writeFileSync(this.filePath, JSON.stringify(data, null, 2), "utf8");
  }

  private getActiveContextId(): string {
    return this.profileContextStore.getActiveContextId();
  }

  private getActivePages(): KnowledgePage[] {
    return this.contexts[this.getActiveContextId()] ?? [];
  }
}
