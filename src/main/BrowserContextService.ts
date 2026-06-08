import type { Window } from "./Window.ts";
import type { Tab } from "./Tab.ts";
import { logger } from "./Logger.ts";

export interface BrowserPageContext {
  tabId: string;
  title: string;
  url: string;
  selection: string;
  text: string;
  capturedAt: number;
}

const DEFAULT_PAGE_TEXT_LIMIT = 50_000;
const DEFAULT_MULTI_TAB_TEXT_LIMIT = 12_000;

export class BrowserContextService {
  constructor(private readonly getWindow: () => Window | null) {}

  async getActivePageContext(
    textLimit = DEFAULT_PAGE_TEXT_LIMIT,
  ): Promise<BrowserPageContext | null> {
    const tab = this.getWindow()?.activeTab ?? null;
    return tab ? this.readTab(tab, textLimit) : null;
  }

  async getOpenTabContexts(
    textLimit = DEFAULT_MULTI_TAB_TEXT_LIMIT,
  ): Promise<BrowserPageContext[]> {
    const tabs = this.getWindow()?.allTabs ?? [];
    const contexts = await Promise.all(
      tabs.map((tab) => this.readTab(tab, textLimit)),
    );
    return contexts.filter(
      (context): context is BrowserPageContext => context !== null,
    );
  }

  private async readTab(
    tab: Tab,
    textLimit: number,
  ): Promise<BrowserPageContext | null> {
    try {
      const result = await tab.runJs(`
        (() => {
          const normalize = (value) =>
            String(value || "").replace(/\\s+/g, " ").trim();
          const selection = normalize(window.getSelection()?.toString());
          const root =
            document.querySelector("article") ||
            document.querySelector("main") ||
            document.body;

          return {
            title: document.title || "",
            url: window.location.href,
            selection,
            text: normalize(root?.innerText || root?.textContent || "")
          };
        })();
      `);

      if (!result || typeof result !== "object") {
        return null;
      }

      return {
        tabId: tab.id,
        title: this.asString(result.title) || tab.title,
        url: this.asString(result.url) || tab.url,
        selection: this.asString(result.selection).slice(0, 10_000),
        text: this.asString(result.text).slice(0, textLimit),
        capturedAt: Date.now(),
      };
    } catch (error) {
      logger.warn("Browser context capture failed", {
        tabId: tab.id,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  private asString(value: unknown): string {
    return typeof value === "string" ? value : "";
  }
}
