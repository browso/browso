# Safety And Privacy

## Trust Model

Browso handles three classes of data:

- untrusted web content
- user-authored prompts, preferences, and notes
- provider credentials and application configuration

These classes are not interchangeable. Web content is context, never policy.

## Automation Decisions

`SafetyPolicy` returns one of three outcomes:

- `allow`: read-only or reversible browsing can proceed
- `confirm`: the agent stops and hands control to the user
- `block`: the requested automation is prohibited

Confirmation-required examples:

- submitting forms or messages
- purchases and checkout
- login and authentication
- downloads, bookings, and applications
- deletion or account changes

Blocked examples:

- CAPTCHA bypass
- phishing or credential harvesting
- spam
- offensive exploitation

The current UI does not implement a one-click approval token. A confirmation
decision therefore stops automation and asks the user to perform or explicitly
control the sensitive step.

## Credentials

- API keys are loaded in the main process from `.env`.
- Passwords and payment details must not be sent to a model.
- Browser pages and renderers do not receive provider keys.
- `.env`, certificates, and private keys are excluded by `.gitignore`.

## Local Data

User memory and saved knowledge are stored in Browso's local application data.
They are separate:

- memory contains distilled preferences and instructions
- knowledge contains pages the user explicitly saves

Browsing history is not automatically indexed.

## Model Data Flow

For an ordinary page question, the configured provider can receive:

- the user prompt
- a screenshot of the active page
- selected text
- a bounded excerpt of current page text
- relevant saved knowledge
- enabled user memory

With Ollama, inference is sent to the configured local Ollama endpoint. With
OpenAI or Anthropic, that context leaves the device and is subject to the
provider's policies.

There is not yet a hard “never send page content to cloud” switch. Until that is
implemented, use Ollama for private pages.

## Logging

Chat messages, page text, current URLs, and saved knowledge are treated as
sensitive channels and are not logged as IPC payloads. Operational failures may
include module names, channel names, tab IDs, and error messages.
