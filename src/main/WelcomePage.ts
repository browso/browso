import type { SearchEngine } from "./AISettings";

export const BROWSO_WELCOME_URL = "browso://welcome";
export const LEGACY_BLUEBERRY_WELCOME_URL = "blueberry://welcome";

export const isWelcomeUrl = (url: string): boolean =>
  url === BROWSO_WELCOME_URL || url === LEGACY_BLUEBERRY_WELCOME_URL;

const searchEngineLabel = (searchEngine: SearchEngine): string => {
  switch (searchEngine) {
    case "bing":
      return "Bing";
    case "google":
      return "Google";
    case "duckduckgo":
    default:
      return "DuckDuckGo";
  }
};

export const buildWelcomePageHtml = (
  searchEngine: SearchEngine,
): string => `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Browso</title>
    <style>
      :root {
        color-scheme: light dark;
        --bg: #f5f7fa;
        --panel: rgba(255, 255, 255, 0.82);
        --panel-border: rgba(15, 23, 42, 0.08);
        --text: #111827;
        --muted: #5b6472;
        --shadow: 0 30px 80px rgba(15, 23, 42, 0.10);
      }

      @media (prefers-color-scheme: dark) {
        :root {
          --bg: #0f141b;
          --panel: rgba(19, 24, 32, 0.88);
          --panel-border: rgba(255, 255, 255, 0.08);
          --text: #f3f4f6;
          --muted: #9ca3af;
          --shadow: 0 30px 80px rgba(0, 0, 0, 0.38);
        }
      }

      * {
        box-sizing: border-box;
      }

      body {
        margin: 0;
        min-height: 100vh;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        color: var(--text);
        background:
          radial-gradient(circle at top left, rgba(148, 163, 184, 0.20), transparent 32%),
          radial-gradient(circle at bottom right, rgba(100, 116, 139, 0.14), transparent 28%),
          var(--bg);
      }

      main {
        min-height: 100vh;
        display: grid;
        place-items: center;
        padding: 32px;
      }

      .panel {
        width: min(840px, 100%);
        border: 1px solid var(--panel-border);
        background: var(--panel);
        backdrop-filter: blur(14px);
        border-radius: 28px;
        box-shadow: var(--shadow);
        padding: 40px;
      }

      .eyebrow {
        margin: 0 0 10px;
        font-size: 12px;
        letter-spacing: 0.22em;
        text-transform: uppercase;
        color: var(--muted);
        font-weight: 700;
      }

      h1 {
        margin: 0;
        font-size: clamp(36px, 7vw, 58px);
        line-height: 0.95;
      }

      .lede {
        max-width: 54ch;
        margin: 18px 0 0;
        font-size: 16px;
        line-height: 1.7;
        color: var(--muted);
      }

      .grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
        gap: 14px;
        margin-top: 28px;
      }

      .card {
        border-radius: 20px;
        border: 1px solid var(--panel-border);
        background: rgba(255, 255, 255, 0.42);
        padding: 18px;
      }

      @media (prefers-color-scheme: dark) {
        .card {
          background: rgba(255, 255, 255, 0.03);
        }
      }

      .card h2 {
        margin: 0 0 8px;
        font-size: 14px;
      }

      .card p {
        margin: 0;
        font-size: 14px;
        line-height: 1.6;
        color: var(--muted);
      }

      .footer {
        margin-top: 26px;
        font-size: 13px;
        color: var(--muted);
      }
    </style>
  </head>
  <body>
    <main>
      <section class="panel">
        <p class="eyebrow">Browso</p>
        <h1>Welcome back.</h1>
        <p class="lede">
          A focused browser workspace for browsing, automation, and local AI tools.
          Search from the address bar, open Settings to tune the model, and switch the
          search engine any time.
        </p>

        <div class="grid">
          <article class="card">
            <h2>Default Search</h2>
            <p>Your new tabs will use ${searchEngineLabel(
              searchEngine,
            )} for address-bar searches.</p>
          </article>
          <article class="card">
            <h2>Theme & Preferences</h2>
            <p>Open Settings from the top bar to change theme, homepage, search engine, and AI setup.</p>
          </article>
          <article class="card">
            <h2>Agent Workspace</h2>
            <p>The right sidebar can search, analyze pages, and automate browser steps while showing its progress.</p>
          </article>
        </div>

        <p class="footer">Tip: type a website or search query in the address bar to start.</p>
      </section>
    </main>
  </body>
</html>`;
