import { readFileSync } from "node:fs";
import type { SearchEngine } from "./AISettings";
import { APP_ICON_PATH } from "./appIcon.ts";

export const BROWSO_WELCOME_URL = "browso://welcome";
export const LEGACY_BLUEBERRY_WELCOME_URL = "blueberry://welcome";
export const BROWSO_AI_HASH_PREFIX = "#browso-ai=";
const BROWSO_LOGO_DATA_URL = `data:image/png;base64,${readFileSync(APP_ICON_PATH).toString("base64")}`;

export const isWelcomeUrl = (url: string): boolean =>
  url === BROWSO_WELCOME_URL || url === LEGACY_BLUEBERRY_WELCOME_URL;

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
        <form id="search-form" action="${searchAction(searchEngine)}" method="get">
          <input id="search-input" class="query" name="q" type="search" placeholder="Search the web" autocomplete="off" autofocus aria-label="Search the web" />
          <label class="ai-toggle" for="ai-mode">
            <input id="ai-mode" type="checkbox" role="switch" aria-label="Use AI chat" />
            <span class="switch" aria-hidden="true"></span>
            <span>AI</span>
          </label>
          <button id="submit-button" class="search" type="submit">Search</button>
        </form>
      </section>
    </main>
    <script>
      const input = document.getElementById("search-input");
      const form = document.getElementById("search-form");
      const aiMode = document.getElementById("ai-mode");
      const submitButton = document.getElementById("submit-button");
      const focusSearch = () => {
        input.focus();
        input.setSelectionRange(input.value.length, input.value.length);
      };
      const updateMode = () => {
        const enabled = aiMode.checked;
        input.placeholder = enabled ? "Ask Browso AI" : "Search the web";
        input.setAttribute("aria-label", input.placeholder);
        submitButton.textContent = enabled ? "Ask AI" : "Search";
        focusSearch();
      };
      aiMode.addEventListener("change", updateMode);
      form.addEventListener("submit", (event) => {
        if (!aiMode.checked) return;
        event.preventDefault();
        const message = input.value.trim();
        if (!message) {
          focusSearch();
          return;
        }
        location.hash = "${BROWSO_AI_HASH_PREFIX}" + encodeURIComponent(message);
      });
      window.addEventListener("load", focusSearch);
      updateMode();
      focusSearch();
    </script>
  </body>
</html>`;
