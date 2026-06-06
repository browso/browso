# Browso Documentation

These documents describe the code that is currently implemented. Planned
features are labeled as planned; they are not presented as existing behavior.

## Docs Map

- [Architecture](./architecture.md)
- [Backend](./backend.md)
- [Agent Modes And Automation](./agent.md)
- [Settings, Memory, And Knowledge](./settings-and-memory.md)
- [Safety And Privacy](./safety-and-privacy.md)
- [Commands](./commands.md)
- [Testing Guide](./testing.md)
- [Build And Release](./build-and-release.md)

## What This Project Is

Browso is a desktop browser-agent platform with:

- a multi-tab browser UI
- a sidebar AI assistant
- current-page and selected-text context
- multi-tab research context
- constrained autonomous browser automation
- local saved-page knowledge
- configurable agent modes
- a local code sandbox
- persistent settings
- optional persistent user memory

## Technology

- Browso desktop runtime
- React 19
- TypeScript
- Vite
- Tailwind CSS
- Vercel AI SDK
- Ollama, OpenAI, or Anthropic model providers

This is not a Chrome extension and does not use a separate Express server.
The Browso desktop process is the trusted backend.

## Defaults

- homepage: internal Browso welcome page
- provider: Ollama
- model: `gemma4:e2b`
- search engine: DuckDuckGo
- mode: Copilot
- user memory: enabled
