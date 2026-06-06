# Backend

## Overview

The Browso desktop process is the backend. All privileged operations
are implemented there and reached through validated IPC.

## IPC Contract

`EventManager` owns channel registration. Request schemas live in
`ipcSchemas.ts`; unvalidated renderer input must not be passed to services.

### Context

| Channel                   | Result                                                          |
| ------------------------- | --------------------------------------------------------------- |
| `browser-context-current` | Current title, URL, selection, readable text, tab ID, timestamp |
| `browser-context-tabs`    | Readable context for every accessible open tab                  |

Current-page text is capped at 50,000 characters. Multi-tab text is capped at
12,000 characters per tab at the service boundary and reduced again when added
to prompts.

### Modes

| Channel              | Result                                           |
| -------------------- | ------------------------------------------------ |
| `agent-modes-list`   | Public mode definitions                          |
| `ai-settings-update` | Persists `activeAgentMode` and other AI settings |

The mode registry is authoritative. Renderers should not hard-code mode
instructions or tool permissions.

### Knowledge

| Channel                  | Input                    | Result                     |
| ------------------------ | ------------------------ | -------------------------- |
| `knowledge-list`         | none                     | Saved pages, newest first  |
| `knowledge-save-current` | optional note            | Saved or updated page      |
| `knowledge-search`       | query and optional limit | Ranked pages with excerpts |
| `knowledge-delete`       | page ID                  | Updated page list          |

Saved pages are stored in `knowledge-store.json` under Browso application data.
Saving the same URL updates the existing record instead of duplicating it.

### Chat And Automation

| Channel                  | Purpose                                             |
| ------------------------ | --------------------------------------------------- |
| `sidebar-chat-message`   | Start a chat, local command, or routed browser task |
| `computer-use-start`     | Start a constrained browser automation session      |
| `computer-use-get-state` | Read current and recent session state               |

## Context Construction

The model prompt is assembled from independent sources:

1. active mode policy
2. current page title, URL, selection, and text
3. open-tab context when research mode or a tab comparison is requested
4. locally retrieved saved pages
5. enabled user memory
6. compacted conversation history

Webpage content is explicitly labeled untrusted. A page cannot grant itself
tools or replace system instructions.

## Persistence

All local data is written atomically at the service level as JSON under Browso's
application data directory.

| File                   | Data                                           |
| ---------------------- | ---------------------------------------------- |
| `ai-settings.json`     | provider, model, browser defaults, active mode |
| `memory-store.json`    | user preferences and instructions              |
| `knowledge-store.json` | explicitly saved pages and notes               |

The current implementation is intentionally local and single-user. SQLite is a
reasonable next storage backend when migrations, larger datasets, or concurrent
writers are required.

## Retrieval

Knowledge search is deterministic local ranking:

- title matches: weight 8
- note matches: weight 6
- URL matches: weight 3
- body matches: weight 1, capped per term

This works without a model or network connection. It is not semantic vector
search. An embedding implementation should preserve the same result shape and
retain a lexical fallback.

## Error Handling

- IPC input errors are rejected by Zod.
- Page extraction failures return no context and are logged without page text.
- Model errors are mapped to user-facing authentication, rate-limit, network,
  timeout, or generic failures.
- Sensitive IPC channels do not write message or page content to logs.

## Backend Rules

1. Privileged logic belongs in the main process, not a renderer.
2. Every renderer input is validated.
3. Services return serializable data.
4. Page content is untrusted and size-limited.
5. Secrets are read only in the main process.
6. Persistent stores remain separate by purpose.
7. Consequential automation passes through safety policy before execution.
