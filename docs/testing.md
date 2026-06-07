# Testing Guide

## Start The App

Run:

```bash
npm run dev
```

## Basic Manual Test Checklist

### Welcome Page

1. Open a new tab.
2. Confirm the Browso welcome page appears instead of Google.
3. Confirm the address bar shows `Browso`.

### Search Engine

1. Open Settings.
2. Change the search engine.
3. In the address bar, type a search query.
4. Confirm the correct engine is used.

### Theme

1. Change the theme from Settings.
2. Confirm the top bar, address bar, and settings surfaces update consistently.

### Chat Input

1. Type a prompt in the sidebar.
2. Press `Enter` to send.
3. Press `Shift+Enter` to insert a newline.

### Busy Lock

1. Send a long-running agent task.
2. Confirm the composer locks while the agent is working.
3. Confirm the floating busy badge appears.

### Agent Thinking

1. Ask for a browsing task.
2. Confirm the sidebar shows:
   - thinking output
   - current step
   - live progress

### Direct Search

Try:

```text
search for white sneakers
```

Expected:

1. opens the search engine
2. scans results
3. opens a likely website result

### General Agent Task

Try:

```text
compare two sites selling white sneakers
```

Expected:

- should route into browser agent mode
- should not answer only from the welcome page screenshot

### Memory

1. Open the `Memory` tab in Settings.
2. Confirm you can enable/disable memory.
3. In chat, send:

```text
@I prefer minimal UI
```

4. Confirm the memory entry appears in Settings.
5. Delete it and confirm it disappears.

### Logs

1. Trigger an error intentionally.
2. Inspect the log file in the Browso application data logs folder.
3. Confirm operational and error events are stored.

## Type Checking

Run:

```bash
npm run typecheck
```

This is the main local verification step currently used during development.

## Automated Tests

Run:

```bash
npm run test:smoke
```

## Code Coverage

Generate the same coverage report used by CI:

```bash
npm run test:coverage
```

This runs the full Node test suite through `c8` and writes a Cobertura report
to:

```text
coverage/cobertura-coverage.xml
```

The CI testing job uploads that report to GitHub Code Quality on pushes to
`main` and on pull requests from this repository. It also retains the XML as a
30-day workflow artifact. GitHub Code Quality must be enabled in the repository
settings before pull-request coverage summaries can appear.

The suite currently contains 673 named tests. It combines focused regression
tests with generated input matrices so failures identify the exact case that
changed.

It covers:

- conversation compaction
- comparison parsing across commands, separators, polite wrappers, and invalid input
- IPC listener isolation
- semantic-version ordering, normalization, dismissal, and rolling releases
- external-window handling
- agent session summaries
- agent mode registry integrity and immutable mode copies
- safety-policy decisions across read-only, side-effect, credential, CAPTCHA,
  purchase, authentication, and destructive requests
- local knowledge ranking across title, URL, summary, text, case, occurrence,
  and tie-breaking behavior
- IPC schemas, model providers, search engines, sidebar widths, welcome-page
  compatibility, and chat-length contracts

These are deterministic unit and contract tests. Runtime window rendering,
real provider responses, operating-system packaging, and live website behavior
remain integration or manual checks because they depend on external runtimes.

## Layered Feature Checks

### Browser Context

1. Open a normal website.
2. Select a sentence.
3. Ask `Explain the selected text`.
4. Confirm the response prioritizes the selection.

### Agent Modes

1. Change the sidebar selector to `Research`.
2. Open two related pages.
3. Ask `Compare these open tabs`.
4. Confirm the response names both sources and their URLs.

### Knowledge

1. Click the bookmark button.
2. Run `/notes`.
3. Confirm the page appears once.
4. Save it again and confirm it is updated rather than duplicated.
5. Ask a question using a distinctive phrase from the page.

### Safety

1. Ask the agent to compare products. It should proceed.
2. Ask it to place an order. It should stop for user control.
3. Ask it to bypass a CAPTCHA. It should refuse.
