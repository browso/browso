export type SafetyDecision =
  | { outcome: "allow"; reason: null }
  | { outcome: "confirm"; reason: string }
  | { outcome: "block"; reason: string };

const BLOCKED_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  {
    pattern: /\b(bypass|solve)\s+(?:(?:a|the)\s+)?captcha\b/i,
    reason: "CAPTCHA bypass is not allowed.",
  },
  {
    pattern:
      /\b(phish|steal|harvest)\b.{0,40}\b(passwords?|credentials?|tokens?)\b/i,
    reason: "Credential theft and phishing automation are not allowed.",
  },
  {
    pattern: /\b(spam|mass message|mass email)\b/i,
    reason: "Spam and bulk unsolicited messaging are not allowed.",
  },
  {
    pattern: /\b(exploit|compromise|hack into)\b/i,
    reason: "Offensive exploitation is outside the browser agent boundary.",
  },
];

const CONFIRM_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  {
    pattern:
      /\bsubmit\b|\bsend\b.{0,30}\b(form|email|message|application)\b/i,
    reason: "Submitting information requires user confirmation.",
  },
  {
    pattern: /\b(buy|purchase|place (the )?order|pay|checkout)\b/i,
    reason: "Purchases and checkout actions require user handoff.",
  },
  {
    pattern: /\b(log ?in|sign ?in|password|two-factor|2fa)\b/i,
    reason: "Authentication requires user control.",
  },
  {
    pattern: /\b(delete|remove)\b.{0,30}\b(account|file|data|message)\b/i,
    reason: "Destructive actions require user confirmation.",
  },
  {
    pattern:
      /\bdownload\s+(?!(?:checksums?|options?|instructions?|information)\b)|\b(book|reserve|apply for)\b/i,
    reason: "This external side effect requires user confirmation.",
  },
];

const READ_ONLY_REQUEST_PATTERN =
  /^\s*(summari[sz]e|explain|review|inspect|read|list|analy[sz]e|describe|compare|find)\b/i;

export function assessAutomationGoal(goal: string): SafetyDecision {
  for (const rule of BLOCKED_PATTERNS) {
    if (rule.pattern.test(goal)) {
      return { outcome: "block", reason: rule.reason };
    }
  }

  for (const rule of CONFIRM_PATTERNS) {
    if (rule.pattern.test(goal)) {
      return { outcome: "confirm", reason: rule.reason };
    }
  }

  if (READ_ONLY_REQUEST_PATTERN.test(goal)) {
    return { outcome: "allow", reason: null };
  }

  return { outcome: "allow", reason: null };
}
