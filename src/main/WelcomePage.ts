import { readFileSync } from "node:fs";
import type { SearchEngine } from "./AISettings.ts";
import { APP_ICON_PATH } from "./appIcon.ts";

export const BROWSO_WELCOME_URL = "browso://welcome";
export const LEGACY_BLUEBERRY_WELCOME_URL = "blueberry://welcome";
export const BROWSO_AI_HASH_PREFIX = "#browso-ai=";
export const BROWSO_AI_REQUEST_URL = "browso://ai-request";
const BROWSO_LOGO_DATA_URL = `data:image/png;base64,${readFileSync(APP_ICON_PATH).toString("base64")}`;

export const isWelcomeUrl = (url: string): boolean =>
  url === BROWSO_WELCOME_URL || url === LEGACY_BLUEBERRY_WELCOME_URL;

export const parseWelcomeAIRequest = (url: string): string | null => {
  try {
    const requestUrl = new URL(url);
    if (
      requestUrl.protocol !== "browso:" ||
      requestUrl.hostname !== "ai-request"
    ) {
      return null;
    }

    return requestUrl.searchParams.get("prompt")?.trim() || null;
  } catch {
    return null;
  }
};

const searchAction = (searchEngine: SearchEngine): string => {
  switch (searchEngine) {
    case "bing":
      return "https://www.bing.com/search";
    case "google":
      return "https://www.google.com/search";
    case "duckduckgo":
    default:
      return "https://duckduckgo.com/";
  }
};

export const buildWelcomePageHtml = (
  searchEngine: SearchEngine,
): string => `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; script-src 'unsafe-inline'; form-action https:;" />
    <title>Browso</title>
    <style>
      :root {
        color-scheme: light dark;
        --background: #ffffff;
        --surface: #ffffff;
        --foreground: #141414;
        --muted: #737373;
        --secondary: #f5f5f5;
        --border: #e5e5e5;
        --primary: #1e1e1e;
        --primary-foreground: #fafafa;
        --shadow: 0 10px 30px rgba(20, 20, 20, 0.08);
      }
      @media (prefers-color-scheme: dark) {
        :root {
          --background: #141414;
          --surface: #141414;
          --foreground: #fafafa;
          --muted: #a1a1a1;
          --secondary: #282828;
          --border: #282828;
          --primary: #fafafa;
          --primary-foreground: #1e1e1e;
          --shadow: 0 10px 30px rgba(0, 0, 0, 0.28);
        }
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        min-height: 100vh;
        overflow: hidden;
        background: var(--background);
        color: var(--foreground);
        font-family:
          -apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", "Oxygen",
          "Ubuntu", "Cantarell", "Fira Sans", "Droid Sans", "Helvetica Neue",
          sans-serif;
        -webkit-font-smoothing: antialiased;
        -moz-osx-font-smoothing: grayscale;
      }
      main {
        min-height: 100vh;
        display: grid;
        place-items: center;
        padding: 24px;
      }
      .home {
        width: min(660px, 100%);
        transform: translateY(-5vh);
        text-align: center;
      }
      .brand {
        display: inline-flex;
        align-items: center;
        gap: 14px;
        margin-bottom: 34px;
      }
      .logo {
        width: 58px;
        height: 58px;
        display: block;
        border-radius: 13px;
      }
      h1 {
        margin: 0;
        font-size: 42px;
        font-weight: 700;
        letter-spacing: -0.04em;
      }
      .search-shell {
        position: relative;
        text-align: left;
      }
      form {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px;
        border: 1px solid var(--border);
        border-radius: 16px;
        background: var(--surface);
        box-shadow: var(--shadow);
      }
      .suggestions {
        display: none;
        position: absolute;
        z-index: 10;
        top: calc(100% + 8px);
        right: 0;
        left: 0;
        margin: 0;
        padding: 6px;
        list-style: none;
        border: 1px solid var(--border);
        border-radius: 16px;
        background: var(--surface);
        box-shadow: var(--shadow);
      }
      .suggestions.visible { display: block; }
      .suggestion {
        width: 100%;
        height: auto;
        min-height: 48px;
        display: flex;
        align-items: center;
        gap: 12px;
        border-radius: 11px;
        padding: 9px 12px;
        background: transparent;
        color: var(--foreground);
        text-align: left;
      }
      .suggestion:hover,
      .suggestion.selected { background: var(--secondary); }
      .suggestion-icon {
        width: 30px;
        height: 30px;
        flex: 0 0 30px;
        display: grid;
        place-items: center;
        border-radius: 9px;
        background: var(--secondary);
        color: var(--foreground);
        font-size: 14px;
        font-weight: 700;
      }
      .suggestion-copy {
        min-width: 0;
        display: grid;
        gap: 2px;
      }
      .suggestion-title {
        overflow: hidden;
        font-size: 15px;
        font-weight: 600;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .suggestion-detail {
        color: var(--muted);
        font-size: 12px;
        font-weight: 500;
      }
      .suggestion.ai-action .suggestion-icon {
        background: var(--foreground);
        color: var(--background);
      }
      .query {
        min-width: 0;
        flex: 1;
        border: 0;
        outline: 0;
        background: transparent;
        color: var(--foreground);
        padding: 12px 14px;
        font: inherit;
        font-size: 17px;
      }
      .query::placeholder { color: var(--muted); }
      button {
        height: 44px;
        border: 0;
        border-radius: 10px;
        padding: 0 17px;
        cursor: pointer;
        font: inherit;
        font-size: 14px;
        font-weight: 650;
      }
      .ai-toggle {
        height: 44px;
        display: inline-flex;
        align-items: center;
        gap: 8px;
        border-radius: 10px;
        padding: 0 12px;
        color: var(--muted);
        cursor: pointer;
        font-size: 14px;
        font-weight: 650;
        user-select: none;
      }
      .ai-toggle:hover { background: var(--secondary); }
      .ai-toggle:focus-within {
        outline: 2px solid var(--foreground);
        outline-offset: 2px;
      }
      .ai-toggle input {
        position: absolute;
        width: 1px;
        height: 1px;
        overflow: hidden;
        opacity: 0;
        pointer-events: none;
      }
      .switch {
        width: 30px;
        height: 18px;
        display: block;
        position: relative;
        border-radius: 999px;
        background: var(--border);
        transition: background 160ms ease;
      }
      .switch::after {
        content: "";
        width: 14px;
        height: 14px;
        position: absolute;
        top: 2px;
        left: 2px;
        border-radius: 50%;
        background: var(--surface);
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.25);
        transition: transform 160ms ease;
      }
      .ai-toggle:has(input:checked) {
        background: var(--secondary);
        color: var(--foreground);
      }
      .ai-toggle input:checked + .switch {
        background: var(--foreground);
      }
      .ai-toggle input:checked + .switch::after {
        transform: translateX(12px);
      }
      .search {
        background: var(--primary);
        color: var(--primary-foreground);
      }
      .search:hover { opacity: 0.88; }
      .sent-card {
        display: none;
        position: fixed;
        z-index: 20;
        right: 24px;
        bottom: 24px;
        width: min(420px, calc(100vw - 48px));
        gap: 12px;
        align-items: flex-start;
        border: 1px solid var(--border);
        border-radius: 16px;
        padding: 16px;
        background: var(--surface);
        box-shadow: var(--shadow);
        text-align: left;
      }
      .sent-card.visible { display: flex; }
      .sent-status {
        width: 34px;
        height: 34px;
        flex: 0 0 34px;
        display: grid;
        place-items: center;
        border-radius: 10px;
        background: var(--foreground);
        color: var(--background);
        font-size: 13px;
        font-weight: 750;
      }
      .sent-copy { min-width: 0; }
      .sent-label {
        margin: 0 0 4px;
        font-size: 13px;
        font-weight: 700;
      }
      .sent-prompt {
        margin: 0;
        overflow: hidden;
        color: var(--muted);
        font-size: 13px;
        line-height: 1.45;
        text-overflow: ellipsis;
      }
      .search-shell.submitted {
        opacity: 0.65;
        pointer-events: none;
      }
      @media (max-width: 560px) {
        .brand { margin-bottom: 24px; }
        .logo { width: 52px; height: 52px; }
        h1 { font-size: 34px; }
        form { flex-wrap: wrap; }
        .query { flex-basis: 100%; }
        .ai-toggle, button { flex: 1; justify-content: center; }
      }
    </style>
  </head>
  <body>
    <main>
      <section class="home">
        <div class="brand" aria-label="Browso">
          <img class="logo" src="${BROWSO_LOGO_DATA_URL}" alt="Browso logo" />
          <h1>Browso</h1>
        </div>
        <div class="search-shell">
          <form id="search-form" action="${searchAction(searchEngine)}" method="get">
            <input id="search-input" class="query" name="q" type="search" placeholder="Search the web" autocomplete="off" autofocus aria-label="Search the web" aria-autocomplete="list" aria-controls="suggestions" aria-expanded="false" />
            <label class="ai-toggle" for="ai-mode">
              <input id="ai-mode" type="checkbox" role="switch" aria-label="Use AI chat" />
              <span class="switch" aria-hidden="true"></span>
              <span>AI</span>
            </label>
            <button id="submit-button" class="search" type="submit">Search</button>
          </form>
          <ul id="suggestions" class="suggestions" role="listbox" aria-label="Search suggestions"></ul>
        </div>
      </section>
    </main>
    <aside id="sent-card" class="sent-card" role="status" aria-live="assertive">
      <span class="sent-status" aria-hidden="true">AI</span>
      <div class="sent-copy">
        <p id="sent-label" class="sent-label">Prompt sent to Browso AI</p>
        <p id="sent-prompt" class="sent-prompt"></p>
      </div>
    </aside>
    <script>
      const input = document.getElementById("search-input");
      const form = document.getElementById("search-form");
      const searchShell = document.querySelector(".search-shell");
      const aiMode = document.getElementById("ai-mode");
      const submitButton = document.getElementById("submit-button");
      const suggestions = document.getElementById("suggestions");
      const sentCard = document.getElementById("sent-card");
      const sentLabel = document.getElementById("sent-label");
      const sentPrompt = document.getElementById("sent-prompt");
      let selectedSuggestion = -1;
      let suggestionItems = [];
      let submitted = false;
      const focusSearch = () => {
        input.focus();
        input.setSelectionRange(input.value.length, input.value.length);
      };
      const openAI = (action, query, message) => {
        if (submitted) return;
        submitted = true;
        closeSuggestions();
        input.disabled = true;
        aiMode.disabled = true;
        submitButton.disabled = true;
        searchShell.classList.add("submitted");
        sentLabel.textContent = action + " sent to Browso AI";
        sentPrompt.textContent = message;
        sentCard.classList.add("visible");
        document.body.setAttribute("aria-busy", "true");
        const requestUrl =
          "${BROWSO_AI_REQUEST_URL}?action=" +
          encodeURIComponent(action) +
          "&query=" +
          encodeURIComponent(query) +
          "&prompt=" +
          encodeURIComponent(message);
        window.setTimeout(() => {
          location.href = requestUrl;
        }, 0);
      };
      const closeSuggestions = () => {
        suggestions.classList.remove("visible");
        input.setAttribute("aria-expanded", "false");
        input.removeAttribute("aria-activedescendant");
        selectedSuggestion = -1;
      };
      const chooseSuggestion = (index) => {
        const item = suggestionItems[index];
        if (!item) return;
        closeSuggestions();
        if (item.type === "ai") {
          openAI(item.action, item.query, item.prompt);
          return;
        }
        input.value = item.query;
        aiMode.checked = false;
        updateMode();
        form.requestSubmit();
      };
      const updateSelection = (index) => {
        const buttons = suggestions.querySelectorAll(".suggestion");
        if (!buttons.length) return;
        selectedSuggestion = (index + buttons.length) % buttons.length;
        buttons.forEach((button, buttonIndex) => {
          const selected = buttonIndex === selectedSuggestion;
          button.classList.toggle("selected", selected);
          button.setAttribute("aria-selected", String(selected));
        });
        const active = buttons[selectedSuggestion];
        input.setAttribute("aria-activedescendant", active.id);
      };
      const renderSuggestions = () => {
        if (submitted) return;
        const query = input.value.trim();
        suggestions.replaceChildren();
        suggestionItems = [];
        selectedSuggestion = -1;
        if (!query) {
          closeSuggestions();
          return;
        }
        suggestionItems = [
          {
            type: "ai",
            action: "Summarize",
            detail: "Concise overview and key points",
            query,
            prompt:
              'Summarize the topic "' +
              query +
              '". Give a concise overview, the key points, and the most important takeaway. Verify factual claims when current information is needed.',
          },
          {
            type: "ai",
            action: "Explain",
            detail: "Clear explanation with useful context",
            query,
            prompt:
              'Explain "' +
              query +
              '" clearly and accurately. Start with a simple explanation, then add essential context, examples, and important caveats.',
          },
          {
            type: "ai",
            action: "Research",
            detail: "Detailed answer using current sources",
            query,
            prompt:
              'Research "' +
              query +
              '". Use current reliable web sources, synthesize the findings, distinguish facts from uncertainty, and cite the most useful sources.',
          },
          {
            type: "ai",
            action: "Compare",
            detail: "Options, differences, and recommendation",
            query,
            prompt:
              'Analyze and compare the main options, viewpoints, or alternatives related to "' +
              query +
              '". Show the important differences, tradeoffs, and a practical recommendation.',
          },
          {
            type: "ai",
            action: "Ask AI",
            detail: "Direct answer from Browso AI",
            query,
            prompt:
              'Answer this request clearly, directly, and accurately: "' +
              query +
              '"',
          },
          { type: "search", query },
        ];
        suggestionItems.forEach((item, index) => {
          const entry = document.createElement("li");
          const button = document.createElement("button");
          const icon = document.createElement("span");
          const copy = document.createElement("span");
          const title = document.createElement("span");
          const detail = document.createElement("span");
          button.id = "suggestion-" + index;
          button.type = "button";
          button.className =
            "suggestion" + (item.type === "ai" ? " ai-action" : "");
          button.setAttribute("role", "option");
          button.setAttribute("aria-selected", "false");
          icon.className = "suggestion-icon";
          icon.textContent = item.type === "ai" ? "AI" : ">";
          copy.className = "suggestion-copy";
          title.className = "suggestion-title";
          detail.className = "suggestion-detail";
          title.textContent =
            item.type === "ai"
              ? item.action + ' "' + item.query + '"'
              : item.query;
          detail.textContent =
            item.type === "ai" ? item.detail : "Search the web";
          copy.append(title, detail);
          button.append(icon, copy);
          button.addEventListener("mouseenter", () => {
            updateSelection(index);
          });
          button.addEventListener("click", () => {
            chooseSuggestion(index);
          });
          entry.append(button);
          suggestions.append(entry);
        });
        suggestions.classList.add("visible");
        input.setAttribute("aria-expanded", "true");
        updateSelection(0);
      };
      const updateMode = () => {
        if (submitted) return;
        const enabled = aiMode.checked;
        input.placeholder = enabled ? "Ask Browso AI" : "Search the web";
        input.setAttribute("aria-label", input.placeholder);
        submitButton.textContent = enabled ? "Ask AI" : "Search";
        focusSearch();
      };
      input.addEventListener("input", renderSuggestions);
      input.addEventListener("keydown", (event) => {
        if (event.isComposing) return;
        if (!suggestions.classList.contains("visible")) return;
        if (event.key === "ArrowDown") {
          event.preventDefault();
          updateSelection(selectedSuggestion + 1);
        } else if (event.key === "ArrowUp") {
          event.preventDefault();
          updateSelection(selectedSuggestion - 1);
        } else if (event.key === "Enter" && selectedSuggestion >= 0) {
          event.preventDefault();
          chooseSuggestion(selectedSuggestion);
        } else if (event.key === "Escape") {
          closeSuggestions();
        }
      });
      input.addEventListener("focus", renderSuggestions);
      input.addEventListener("blur", () => setTimeout(closeSuggestions, 100));
      aiMode.addEventListener("change", updateMode);
      form.addEventListener("submit", (event) => {
        if (submitted) {
          event.preventDefault();
          return;
        }
        if (
          suggestions.classList.contains("visible") &&
          selectedSuggestion >= 0
        ) {
          event.preventDefault();
          chooseSuggestion(selectedSuggestion);
          return;
        }
        if (!aiMode.checked) return;
        event.preventDefault();
        const message = input.value.trim();
        if (!message) {
          focusSearch();
          return;
        }
        closeSuggestions();
        openAI("Ask AI", message, message);
      });
      window.addEventListener("load", focusSearch);
      updateMode();
      focusSearch();
    </script>
  </body>
</html>`;
