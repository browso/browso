# Agent Modes And Automation

## Modes Are Policy, Not Separate Apps

Every mode uses the same browser context, model router, memory, knowledge, and
automation runtime. A mode changes:

- the task framing supplied to the model
- the named capabilities the model should rely on
- mode-specific safety and evidence requirements

Definitions live in `src/main/AgentModes.ts`.

## Available Modes

### Copilot

For current-page questions, summaries, explanations, and selected text.

Context priority:

1. selected text
2. current readable page
3. relevant saved knowledge
4. general model knowledge

The response should state when the page does not contain the answer.

### Research

For comparing sources and synthesizing open tabs.

Research mode automatically includes bounded context from open tabs. Responses
should name source titles and URLs, identify contradictions, and separate
evidence from inference.

### Shopping

For product comparison and commerce-page analysis.

It can inspect products, prices, review signals, return information, and cart
summaries. It must stop before authentication, payment, checkout submission, or
placing an order.

### Scraper

For structured extraction from the current page.

The model is instructed to preserve a consistent schema, mark missing values,
and never invent absent fields. CSV scheduling and recurring jobs are not yet
implemented.

### Developer

For technical documentation, API extraction, examples, and sandbox-assisted
work. It should prefer exact API names and identify deprecated or inferred
behavior.

### Security

For defensive analysis of visible page signals, phishing indicators, and
security posture. Offensive exploitation, credential theft, evasion, and
persistence are outside the mode boundary.

## Request Routing

`LLMClient.sendChatMessage` routes in this order:

1. local commands
2. screenshot and context capture
3. conversation and user-memory update
4. explicit comparison fast path
5. direct search fast path
6. browser automation
7. contextual model response

Mode selection affects model context. Automation routing still depends on the
requested action, because a research question should not click simply because
research mode is active.

## Autonomous Browser Runtime

Browso currently automates its own live tabs. It does not launch a separate
Playwright browser.

Two execution paths exist:

- planned computer-use sessions for narrower action sequences
- autonomous agent sessions for broader multi-step tasks

Session state includes:

- goal and summary
- status
- current URL
- screenshot
- step list
- operational logs

The sidebar displays the active step and recent progress.

## Tool Boundary

High-level tools are defined in `AgentTools.ts`. Examples include:

- navigation and web search
- page observation and extraction
- element click and text entry
- scrolling and waiting
- commerce-page scanning
- product and search-result selection
- blocker detection
- cart summary extraction
- user handoff

The model does not receive an unrestricted Node.js or shell tool. The code
sandbox is a separate, scoped subsystem.

## Safety Preflight

Before browser automation begins, `SafetyPolicy` classifies the goal.

- Allowed goals continue.
- Consequential goals stop for user control.
- Prohibited goals are rejected.

This preflight complements checks inside the automation tools. It is not a
replacement for tool-level validation.

## Known Limits

- selectors and page heuristics can break when sites change
- authentication and anti-bot pages require user control
- screenshots and DOM text can disagree
- there is no durable resume token for a paused sensitive action
- automation runs in the user's live browser, not an isolated profile

## Planned Runtime Upgrade

A future Playwright adapter can provide isolated controlled sessions. It should
implement the existing conceptual tool contract rather than replace modes,
knowledge, safety, or the sidebar.
