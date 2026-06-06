# Architecture

## Design Goal

Browso is one browser-agent platform with five layers:

```text
1. Browser context
2. AI reasoning
3. Tools and automation
4. Memory and knowledge
5. Safety
```

Agent modes configure these layers. They do not create separate applications or
duplicate browser integrations.

## Runtime Boundaries

### Browser Pages

Remote pages run in sandboxed `WebContentsView` instances:

- `nodeIntegration: false`
- `contextIsolation: true`
- `sandbox: true`
- `webSecurity: true`

Pages do not receive the sidebar preload API.

### Renderer

The top bar, side panel, and settings window are React renderers. They contain
presentation state and call explicit preload methods. They do not read files,
model keys, or application databases directly.

### Preload

Preload scripts expose narrow APIs through `contextBridge`. They translate
renderer calls to named IPC channels.

### Main Process

The Browso desktop process is the trusted backend. It owns:

- tabs and navigation
- page-context extraction
- model configuration and invocation
- automation tools
- persisted settings, memory, and knowledge
- safety decisions
- IPC validation and logging

## Backend Modules

| Module                     | Responsibility                                                            |
| -------------------------- | ------------------------------------------------------------------------- |
| `BrowserContextService.ts` | Extract normalized page text, selection, title, URL, and open-tab context |
| `LLMClient.ts`             | Route requests, construct prompts, retrieve context, stream model output  |
| `ComputerUseManager.ts`    | Execute constrained browser tasks and report progress                     |
| `AgentTools.ts`            | Higher-level browser actions used by autonomous sessions                  |
| `AgentModes.ts`            | Define mode purpose, available capability names, and system policy        |
| `SafetyPolicy.ts`          | Classify automation goals as allowed, confirmation-required, or blocked   |
| `KnowledgeStore.ts`        | Persist saved pages and perform ranked local retrieval                    |
| `MemoryStore.ts`           | Persist user preferences, profile facts, workflows, and instructions      |
| `AISettings.ts`            | Persist provider, model, browser defaults, and active mode                |
| `EventManager.ts`          | Register validated IPC endpoints and broadcast state                      |

## Request Flow

```text
User submits sidebar message
  -> preload invokes sidebar-chat-message
  -> EventManager validates payload with Zod
  -> LLMClient handles local commands
  -> LLMClient captures screenshot and browser context
  -> relevant saved knowledge is retrieved
  -> mode policy is added to the system prompt
  -> request is routed to chat or browser automation
  -> streamed state is sent back to the sidebar
```

## Why There Is No Separate HTTP Server

The desktop application already has a trusted local backend. Adding Express
only to call code in the same application would add:

- another process and port
- CORS and lifecycle complexity
- duplicated authentication and validation boundaries
- no useful isolation by itself

A remote API is appropriate only when synchronization, team accounts, hosted
models, or remote automation become product requirements. The service modules
are deliberately independent of the renderer so they can later sit behind HTTP
without rewriting the browser UI.

## Extension Points

- Replace lexical retrieval in `KnowledgeStore` with embeddings while
  preserving its search contract.
- Add a Playwright worker behind an automation adapter for isolated sessions.
- Add a cloud synchronization implementation behind knowledge and settings
  repositories.
- Add modes by extending `AgentModeId` and the registry, then granting only the
  required tools.
