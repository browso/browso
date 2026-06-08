# Browso

[![Build, Test, Release](https://github.com/browso/browso/actions/workflows/ci-release.yml/badge.svg)](https://github.com/browso/actions/workflows/ci-release.yml)
[![Latest Release](https://img.shields.io/github/v/release/Browso/browso)](https://github.com/Browso/browso/releases)

Browso is a desktop AI browser that combines a page-aware copilot, constrained
browser automation, multi-tab research, and local knowledge in one application.

The project is designed as a layered browser-agent platform. Research,
shopping, scraping, developer assistance, and defensive security analysis are
modes over the same browser, reasoning, tool, memory, and safety layers.

## What Browso Does

### AI Browser Copilot

- summarizes and explains the current page
- prioritizes selected text when present
- answers with bounded page text, URL, title, and screenshot context
- distinguishes page evidence from general model knowledge

### Autonomous Web Tasks

- searches, navigates, reads, clicks, types, waits, and scrolls
- reports active steps and recent progress in the sidebar
- provides higher-level shopping and page-inspection tools
- stops before sensitive or consequential actions

### Personal Knowledge Browser

- saves the current page explicitly
- stores page title, URL, readable text, selection, and an optional note
- retrieves relevant saved pages locally for future questions
- keeps saved knowledge separate from user preferences and debug logs

### Agent Modes

| Mode      | Purpose                                                  |
| --------- | -------------------------------------------------------- |
| Copilot   | Current-page questions, summaries, and explanations      |
| Research  | Multi-tab comparison and source synthesis                |
| Shopping  | Product, price, seller, review, and returns comparison   |
| Scraper   | Structured extraction with missing-value handling        |
| Developer | Technical documentation and implementation analysis      |
| Security  | Defensive analysis of visible risks and phishing signals |

## Architecture

```text
React renderers
      |
      | contextBridge + validated IPC
      v
Browso desktop backend
      |
      +-- BrowserContextService  page, selection, and open-tab context
      +-- LLMClient              routing, retrieval, prompts, streaming
      +-- ComputerUseManager     constrained browser automation
      +-- AgentModeRegistry      mode capabilities and policy
      +-- KnowledgeStore         explicitly saved pages
      +-- MemoryStore            user preferences and instructions
      +-- SafetyPolicy           allow, handoff, or block decisions
```

The Browso desktop backend is the trusted application boundary. Remote pages
cannot access application services or provider keys.

See [Architecture](https://browso.org/docs/architecture.html) and
[Backend](https://browso.org/docs/backend.html) for the
full runtime and data-flow design.

## Model Providers

Browso supports:

- Ollama for local inference
- OpenAI
- Anthropic

The default configuration uses Ollama at `http://127.0.0.1:11434` with `gemma4:e2b`.

Cloud provider keys are read from `.env`:

```dotenv
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
```

## Local Development

Requirements:

- Node.js 22 or later
- npm
- macOS, Linux, or Windows for development
- Ollama or a configured cloud provider for AI responses

Install and start:

```bash
npm install
npm run dev
```

Install the default local model:

```bash
ollama pull gemma4:e2b
```

## Commands

| Command        | Action                          |
| -------------- | ------------------------------- |
| `/help`        | Show local commands             |
| `/save [note]` | Save or update the current page |
| `/notes`       | List recently saved pages       |
| `@text`        | Save a user-memory instruction  |

`Enter` sends a message. `Shift+Enter` inserts a newline.

Agent modes are selected automatically by the backend for each request. Users
cannot manually set Copilot, Research, Shopping, Scraper, Developer, or Security
mode.

## Profiles

Profiles are created, switched, and configured in **Settings > Profiles**.
Personal, Work, Study, and custom profiles can use different symbols and colors.
Each profile keeps separate tabs, cookies, site storage, AI conversations,
memory, and saved knowledge.

## Verification

```bash
npm run typecheck
npm run test:smoke
npm run build
```

The automated suite contains 673 named unit and contract tests covering routing
helpers, conversation compaction, mode definitions, safety decisions, local
retrieval, IPC contracts, update state, and browser-window handling. See the
[Testing Guide](https://browso.org/docs/testing.html) for the coverage inventory and integration
boundaries.

## CI And Releases

The [Build, Test, Release workflow](.github/workflows/ci-release.yml) runs:

1. **Code Quality** checks linting and formatting.
2. **Bootstrap & Build** installs from `package-lock.json` and builds the app.
3. **Testing** runs type checks, tests, coverage, and uploads Cobertura results.
4. **Release Planning** defaults every push to `main` to a minor release and
   lets `[release: major]` override it for substantial or breaking changes.
5. **Release Build** packages macOS, Windows, and Linux downloads when requested.
6. **Publish Release** creates an immutable stable GitHub release and updates
   the website release catalog.
7. **Benchmarks** publishes the latest performance result to the website.

Pull requests validate the project without creating a release. Every commit
merged or pushed to `main` publishes the next stable minor version, such as
`v1.1.0`, `v1.2.0`, and `v1.3.0`. Add `[release: major]` to the commit message
for a major version such as `v2.0.0`. The phrases `minor update` and
`major update` are also recognized. A manual workflow run can select `none`,
`minor`, or `major`.

Windows releases require a persistent code-signing certificate in two GitHub
Actions repository secrets:

- `WINDOWS_PFX_BASE64`: the base64-encoded contents of the `.pfx` file
- `WINDOWS_PFX_PASSWORD`: the password used when exporting the `.pfx`

Encode the PFX without line breaks on macOS or Linux:

```bash
base64 < codesign.pfx | tr -d '\n'
```

Or encode it from PowerShell on Windows:

```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("codesign.pfx"))
```

The release job validates the certificate, requires Electron Builder to sign
the Windows application and NSIS installer, and verifies both outputs before
publishing. A self-signed certificate proves that releases use a stable key but
does not remove Windows SmartScreen or unknown-publisher warnings for users. A
trusted code-signing certificate, including one issued through an eligible
open-source signing program, is required for normal Windows publisher trust.

See [Build And Release](https://browso.org/docs/build-and-release.html) for runner labels, release
behavior, and signing limitations.

## Safety And Privacy

- webpage content is treated as untrusted model context
- API keys stay in the Browso desktop backend
- browsing history is not silently indexed
- saved knowledge requires an explicit save action
- purchases, login, submission, downloads, bookings, and deletion require user
  control
- CAPTCHA bypass, phishing, spam, and offensive exploitation are blocked

When OpenAI or Anthropic is selected, page context can leave the device. Use
Ollama for private or local-only browsing workflows.

Read [Safety And Privacy](https://browso.org/docs/safety-and-privacy.html) for the complete data-flow
and automation boundaries.

## Documentation

- [Documentation Index](https://browso.org/docs/)
- [Architecture](https://browso.org/docs/architecture.html)
- [Backend](https://browso.org/docs/backend.html)
- [Agent Modes And Automation](https://browso.org/docs/agent.html)
- [Settings, Memory, And Knowledge](https://browso.org/docs/settings-and-memory.html)
- [Safety And Privacy](https://browso.org/docs/safety-and-privacy.html)
- [Commands](https://browso.org/docs/commands.html)
- [Testing](https://browso.org/docs/testing.html)
- [Build And Release](https://browso.org/docs/build-and-release.html)

## Current Boundaries

- browser automation currently runs in Browso's live tabs, not Playwright
- saved-page retrieval is lexical and local, not vector-based
- stable releases publish macOS, Windows, and Linux packages
- cloud synchronization is not implemented

These are explicit extension points rather than undocumented promises.
