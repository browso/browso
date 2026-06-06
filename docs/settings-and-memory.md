# Settings, Memory, And Knowledge

## Settings

Settings are persisted by `AISettingsStore` in `ai-settings.json`.

| Setting              | Purpose                             | Default                  |
| -------------------- | ----------------------------------- | ------------------------ |
| `provider`           | Ollama, OpenAI, or Anthropic        | `ollama`                 |
| `model`              | Provider model identifier           | `gemma4:e2b`             |
| `ollamaBaseUrl`      | Local Ollama endpoint               | `http://127.0.0.1:11434` |
| `homepage`           | New-tab target                      | internal welcome page    |
| `searchEngine`       | Direct-search provider              | `duckduckgo`             |
| `autoRouteToSandbox` | Route suitable code work to sandbox | enabled                  |
| `sidebarWidth`       | Persistent side-panel width         | `400`                    |
| `memoryEnabled`      | Include user memory in prompts      | enabled                  |
| `activeAgentMode`    | Active mode policy                  | `copilot`                |

Provider credentials are not stored in this file.

## Profiles And Contexts

Profiles group multiple named contexts. The application always keeps at least
one profile and one context per profile.

Each context isolates:

- the live AI conversation
- saved user memories
- pages saved for local AI knowledge

Switching context immediately swaps those three data sources. The context name,
profile name, and optional purpose are included in the AI system prompt.
Existing flat memory and knowledge files migrate into the default
`Personal / General` context.

Browser tabs, website cookies, cache, provider credentials, and general
application preferences remain global. Profiles do not currently create
separate Electron website sessions.

The Data tab provides explicit local-data controls:

- clear the current AI conversation
- review, delete, or clear pages saved for AI knowledge
- clear the browser cache without removing sign-ins
- clear cookies and site storage, which signs users out of websites

The application does not persist a general browsing-history database.

## User Memory

Memory stores durable facts about how the assistant should work with the user.
It is implemented by `MemoryStore`.

Categories:

- `preference`
- `profile`
- `workflow`
- `instruction`

Memory can be added explicitly with `@...` or distilled from phrases such as
“remember that”, “I prefer”, and “always”.

Memory is bounded to 100 entries. Duplicate normalized content updates the
existing entry.

## Saved Knowledge

Knowledge stores pages the user explicitly chooses to preserve. It is
implemented by `KnowledgeStore`.

Each page contains:

- ID
- title and URL
- normalized readable text
- selected text captured at save time
- optional note
- creation and update timestamps

Save a page with the bookmark button or `/save`. Saving the same URL updates the
existing record.

## Retrieval

Each chat request searches saved knowledge locally using the user message as the
query. Up to five relevant excerpts can be added to the model context.

Research mode also includes bounded open-tab context. Saved knowledge and open
tabs remain separate sources and are labeled separately in the prompt.

## Memory Is Not Knowledge

| Memory                            | Knowledge                          |
| --------------------------------- | ---------------------------------- |
| User preferences and instructions | Saved web pages and notes          |
| Small distilled statements        | Larger page records                |
| Can be automatically inferred     | Explicit save action only          |
| Controls assistant behavior       | Supplies factual retrieval context |

Neither store is a raw debug log.

## Storage Limits And Migration

The JSON implementation is appropriate for the current local, single-process
application. Move to SQLite when the product needs:

- schema migrations
- thousands of large pages
- transactional writes
- indexing beyond in-memory ranking
- synchronization metadata

Add vector retrieval behind the search contract; do not remove lexical fallback
or require cloud embeddings for local use.
