import type { SearchEngine } from "./AISettings";

export const BROWSO_WELCOME_URL = "browso://welcome";
export const LEGACY_BLUEBERRY_WELCOME_URL = "blueberry://welcome";
export const BROWSO_AI_HASH_PREFIX = "#browso-ai=";

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
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; form-action https:;" />
    <title>Browso</title>
    <style>
      :root {
        color-scheme: light dark;
        --background: #f8fafc;
        --surface: #ffffff;
        --text: #101828;
        --muted: #667085;
        --border: #dfe3e8;
        --accent: #155eef;
        --accent-hover: #004eeb;
        --shadow: 0 16px 40px rgba(16, 24, 40, 0.10);
      }
      @media (prefers-color-scheme: dark) {
        :root {
          --background: #0b0f15;
          --surface: #151a22;
          --text: #f5f7fa;
          --muted: #98a2b3;
          --border: #2a303b;
          --accent: #2e6cff;
          --accent-hover: #477dff;
          --shadow: 0 16px 44px rgba(0, 0, 0, 0.36);
        }
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        min-height: 100vh;
        overflow: hidden;
        background: var(--background);
        color: var(--text);
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
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
      .logo { width: 64px; height: 64px; display: block; }
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
        border-radius: 22px;
        background: var(--surface);
        box-shadow: var(--shadow);
      }
      input {
        min-width: 0;
        flex: 1;
        border: 0;
        outline: 0;
        background: transparent;
        color: var(--text);
        padding: 12px 14px;
        font: inherit;
        font-size: 17px;
      }
      input::placeholder { color: var(--muted); }
      button {
        height: 44px;
        border: 0;
        border-radius: 15px;
        padding: 0 17px;
        cursor: pointer;
        font: inherit;
        font-size: 14px;
        font-weight: 650;
      }
      .ai { background: transparent; color: var(--accent); }
      .ai:hover { background: color-mix(in srgb, var(--accent) 10%, transparent); }
      .search { background: var(--accent); color: white; }
      .search:hover { background: var(--accent-hover); }
      @media (max-width: 560px) {
        .brand { margin-bottom: 24px; }
        .logo { width: 52px; height: 52px; }
        h1 { font-size: 34px; }
        form { flex-wrap: wrap; }
        input { flex-basis: 100%; }
        button { flex: 1; }
      }
    </style>
  </head>
  <body>
    <main>
      <section class="home">
        <div class="brand" aria-label="Browso">
          <svg class="logo" viewBox="0 0 100 100" role="img" aria-label="Browso logo">
            <rect width="100" height="100" rx="24" fill="#05070a"/>
            <path d="M22 29c0-7 5-12 12-12h32c7 0 12 5 12 12v42c0 7-5 12-12 12h-8m-16 0h-8c-7 0-12-5-12-12V29Z" fill="none" stroke="white" stroke-width="6" stroke-linecap="round"/>
            <path d="M23 35h54" stroke="white" stroke-width="6"/>
            <circle cx="34" cy="26" r="3" fill="white"/>
            <circle cx="44" cy="26" r="3" fill="white"/>
            <circle cx="54" cy="26" r="3" fill="white"/>
            <circle cx="50" cy="59" r="9" fill="#155eef"/>
            <path d="M40 69a20 20 0 0 1 2-23m18 0a20 20 0 0 1 1 24" fill="none" stroke="white" stroke-width="5" stroke-linecap="round"/>
          </svg>
          <h1>Browso</h1>
        </div>
        <form action="${searchAction(searchEngine)}" method="get">
          <input id="search-input" name="q" type="search" placeholder="Search the web" autocomplete="off" autofocus aria-label="Search the web" />
          <button id="ai-button" class="ai" type="button">Ask AI</button>
          <button class="search" type="submit">Search</button>
        </form>
      </section>
    </main>
    <script>
      const input = document.getElementById("search-input");
      const focusSearch = () => {
        input.focus();
        input.setSelectionRange(input.value.length, input.value.length);
      };
      document.getElementById("ai-button").addEventListener("click", () => {
        location.hash = "${BROWSO_AI_HASH_PREFIX}" + encodeURIComponent(input.value.trim());
      });
      window.addEventListener("load", focusSearch);
      focusSearch();
    </script>
  </body>
</html>`;
