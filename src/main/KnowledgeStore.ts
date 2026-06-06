import { app } from "electron";
import { mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import type { BrowserPageContext } from "./BrowserContextService";
import { rankKnowledgePages } from "./knowledgeRanking";

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
  version: 1;
  pages: KnowledgePage[];
}

export interface KnowledgeSearchResult extends KnowledgePage {
  score: number;
  excerpt: string;
}

export class KnowledgeStore {
  private static instance: KnowledgeStore | null = null;
  private readonly filePath: string;
  private pages: KnowledgePage[];

  private constructor() {
    this.filePath = join(app.getPath("userData"), "knowledge-store.json");
    this.pages = this.load();
  }

  static getInstance(): KnowledgeStore {
    if (!KnowledgeStore.instance) {
      KnowledgeStore.instance = new KnowledgeStore();
    }
    return KnowledgeStore.instance;
  }

  list(): KnowledgePage[] {
    return [...this.pages]
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .map((page) => ({ ...page }));
  }

  savePage(context: BrowserPageContext, note = ""): KnowledgePage {
    const now = Date.now();
    const existing = this.pages.find((page) => page.url === context.url);

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

    this.pages = [page, ...this.pages].slice(0, 500);
    this.persist();
    return { ...page };
  }

  delete(id: string): KnowledgePage[] {
    this.pages = this.pages.filter((page) => page.id !== id);
    this.persist();
    return this.list();
  }

  clear(): KnowledgePage[] {
    this.pages = [];
    this.persist();
    return [];
  }

  search(query: string, limit = 8): KnowledgeSearchResult[] {
    return rankKnowledgePages(this.pages, query).slice(0, limit);
  }

  private load(): KnowledgePage[] {
    try {
      const parsed = JSON.parse(readFileSync(this.filePath, "utf8")) as
        | KnowledgeFile
        | KnowledgePage[];
      if (Array.isArray(parsed)) {
        return parsed;
      }
      return parsed.version === 1 && Array.isArray(parsed.pages)
        ? parsed.pages
        : [];
    } catch {
      return [];
    }
  }

  private persist(): void {
    const data: KnowledgeFile = { version: 1, pages: this.pages };
    mkdirSync(dirname(this.filePath), { recursive: true });
    writeFileSync(this.filePath, JSON.stringify(data, null, 2), "utf8");
  }
}
