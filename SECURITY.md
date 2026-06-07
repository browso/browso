# Security Policy

## Supported Versions

Browso follows semantic versioning. Security updates are provided for the following versions:

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |
| < 1.0.0 | :x:                |

## Reporting a Vulnerability

**Do not create a public GitHub issue for security vulnerabilities.**

If you discover a security vulnerability in Browso, please report it responsibly by emailing:

- **browso.pro@gmail.com**

### What to Include

Please include the following information to help us understand and address the vulnerability:

1. **Type of vulnerability** (e.g., XSS, injection, privilege escalation, data leakage)
2. **Affected version(s)**
3. **Component(s) involved** (e.g., backend, preload, renderer, IPC)
4. **Description and reproduction steps**
5. **Proof of concept** (if possible)
6. **Potential impact** (severity assessment)
7. **Suggested fix** (if you have one)

## Response Timeline

- **Initial response:** Within 48 hours
- **Status updates:** At least every 7 days
- **Disclosure:** Coordinated disclosure after a fix is released (typically 30-90 days)

## Security Considerations

### For Users

- **API Keys**: Browso stores cloud provider keys (OpenAI, Anthropic) locally in `.env` and does not transmit them to remote pages
- **Browsing Privacy**: Only pages you explicitly save are stored in your local knowledge base
- **Network**: Page content sent to OpenAI or Anthropic leaves your device; use Ollama for local-only workflows
- **Automation Safety**: Browso blocks sensitive actions like CAPTCHA bypass, phishing exploitation, and unauthorized purchases

### For Developers

Browso has built-in security layers:

1. **IPC Validation**: All Electron IPC messages are validated via the contextBridge
2. **Untrusted Context**: Webpage content is treated as untrusted model input
3. **Automation Boundaries**: User-controlled approval is required for consequential actions
4. **API Key Isolation**: Provider keys are isolated in the backend and never exposed to renderers or remote pages

For details, see [Safety And Privacy](https://browso.org/docs/safety-and-privacy.html).

## Security Best Practices When Using Browso

1. **Use Ollama locally** for sensitive workflows where data should not leave your device
2. **Protect your `.env` file** — it contains your API keys
3. **Review saved pages** — only save pages you trust
4. **Run up-to-date versions** — install security updates as soon as they are released
5. **Monitor for phishing** — use the Security mode to analyze suspicious pages

## Known Limitations

- Browser automation runs in Browso's live tabs, not isolated processes
- Windows and Linux builds are not yet published (macOS currently supported)
- Cloud synchronization is not implemented
- Saved-page retrieval is lexical, not vector-based

## Security Advisories

This section will be updated with details of any published security advisories. Currently, none are known.

## Scope

This security policy covers vulnerabilities in:

- Browso desktop application (main process, renderer, preload scripts)
- IPC communication layers
- AI model integration and prompt injection risks
- Browser automation constraints
- Data handling (saved knowledge, memory, preferences)

The following are out of scope for this security policy:

- Third-party dependencies with their own security policies
- User-configured cloud provider security (OpenAI, Anthropic, Ollama)
- Operating system or Electron framework vulnerabilities
- Remote webpages accessed in the browser

## Additional Resources

- [Safety And Privacy](https://browso.org/docs/safety-and-privacy.html) — comprehensive data-flow design
- [Architecture](https://browso.org/docs/architecture.html) — system design and threat model
- [Backend](https://browso.org/docs/backend.html) — trusted application boundary details
