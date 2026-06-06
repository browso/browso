# Commands

Commands are parsed locally before model invocation.

## `/help`

Lists supported local commands.

## `@text`

Stores a user-memory instruction without sending it to a model first.

```text
@Prefer concise answers with source links
```

Memory must be enabled.

## `/save [note]`

Saves or updates the current page in local knowledge.

```text
/save Compare this source with the vendor documentation
```

The optional text becomes the page note. The bookmark button in the sidebar
performs the same save without a note.

## `/notes`

Lists the ten most recently updated saved pages with URLs and notes.

## `/mode`

Shows the current mode and all available modes.

## `/mode <id>`

Changes the persisted active mode.

```text
/mode research
/mode shopping
/mode scraper
```

Valid IDs:

- `copilot`
- `research`
- `shopping`
- `scraper`
- `developer`
- `security`

The sidebar selector is the preferred visual control; the command is useful for
keyboard-driven workflows.

## Message Routing

If input is not a local command, the backend checks direct search, comparison,
and browser-action intent before using contextual chat.

`Enter` sends. `Shift+Enter` inserts a newline.
