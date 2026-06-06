# Browso

[![Build, Test, Release](https://github.com/browso/browso/actions/workflows/ci-release.yml/badge.svg)](https://github.com/browso/actions/workflows/ci-release.yml)
[![Latest Release](https://img.shields.io/github/v/release/browso/browso?display_name=release&label=latest)](https://github.com/browso/releases/tag/latest)

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

See [Architecture](docs/architecture.md) and [Backend](docs/backend.md) for the
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

| Command          | Action                              |
| ---------------- | ----------------------------------- |
| `/help`          | Show local commands                 |
| `/save [note]`   | Save or update the current page     |
| `/notes`         | List recently saved pages           |
| `/mode`          | Show the active and available modes |
| `/mode research` | Change the active mode              |
| `@text`          | Save a user-memory instruction      |

`Enter` sends a message. `Shift+Enter` inserts a newline.

## Verification

```bash
npm run typecheck
npm run test:smoke
npm run build
```

The automated suite contains 673 named unit and contract tests covering routing
helpers, conversation compaction, mode definitions, safety decisions, local
retrieval, IPC contracts, update state, and browser-window handling. See the
[Testing Guide](docs/testing.md) for the coverage inventory and integration
boundaries.

## CI And Releases

The [Build, Test, Release workflow](.github/workflows/ci-release.yml) exposes
four ordered jobs:

1. **Bootstrap & Build** installs from `package-lock.json` and builds the app.
2. **Testing** runs TypeScript checks and the automated test suite.
3. **Release Build** packages native DMGs on Apple Silicon and Intel runners.
4. **Publish Latest Release** replaces the rolling `latest` GitHub release.

Pull requests run build and tests only. Pushes to `main`, plus manual workflow
runs from `main`, package and publish both macOS architectures.

See [Build And Release](docs/build-and-release.md) for runner labels, release
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

Read [Safety And Privacy](docs/safety-and-privacy.md) for the complete data-flow
and automation boundaries.

## Documentation

- [Documentation Index](docs/README.md)
- [Architecture](docs/architecture.md)
- [Backend](docs/backend.md)
- [Agent Modes And Automation](docs/agent.md)
- [Settings, Memory, And Knowledge](docs/settings-and-memory.md)
- [Safety And Privacy](docs/safety-and-privacy.md)
- [Commands](docs/commands.md)
- [Testing](docs/testing.md)
- [Build And Release](docs/build-and-release.md)

## Current Boundaries

- browser automation currently runs in Browso's live tabs, not Playwright
- saved-page retrieval is lexical and local, not vector-based
- Windows and Linux packages are not published yet
- cloud synchronization is not implemented

These are explicit extension points rather than undocumented promises.
