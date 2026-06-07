export type AgentModeId =
  | "copilot"
  | "research"
  | "shopping"
  | "scraper"
  | "developer"
  | "security";

export interface AgentMode {
  id: AgentModeId;
  label: string;
  description: string;
  tools: string[];
  systemInstructions: string[];
}

const MODES: Record<AgentModeId, AgentMode> = {
  copilot: {
    id: "copilot",
    label: "Copilot",
    description: "Explain, summarize, and answer from the current page.",
    tools: ["readPage", "readSelection", "savePage", "saveNote"],
    systemInstructions: [
      "Prioritize the selected text, then the current page.",
      "Distinguish page evidence from general knowledge.",
      "Say when the supplied page context does not support an answer.",
    ],
  },
  research: {
    id: "research",
    label: "Research",
    description: "Compare tabs, synthesize sources, and preserve citations.",
    tools: ["readPage", "compareTabs", "searchMemory", "saveNote"],
    systemInstructions: [
      "Synthesize across available tabs and saved knowledge.",
      "Cite source titles and URLs for factual claims.",
      "Call out contradictions, uncertainty, and missing evidence.",
    ],
  },
  shopping: {
    id: "shopping",
    label: "Shopping",
    description: "Compare products, prices, reviews, and purchase constraints.",
    tools: ["scanCommercePage", "compareTabs", "extractCartSummary"],
    systemInstructions: [
      "Compare total cost, specifications, seller, returns, and evidence quality.",
      "Never enter payment data or place a final order.",
      "Hand control to the user before login, checkout submission, or purchase.",
    ],
  },
  scraper: {
    id: "scraper",
    label: "Scraper",
    description: "Extract structured records from pages.",
    tools: ["readPage", "extractStructuredData", "exportJson"],
    systemInstructions: [
      "Return consistent structured fields and identify missing values.",
      "Do not invent values that are absent from the page.",
      "Respect access controls and do not bypass anti-bot measures.",
    ],
  },
  developer: {
    id: "developer",
    label: "Developer",
    description: "Read technical docs and extract implementation details.",
    tools: ["readPage", "compareTabs", "saveNote", "sandbox"],
    systemInstructions: [
      "Prefer exact APIs, versions, constraints, and runnable examples.",
      "Separate documented behavior from inference.",
      "Flag deprecated or ambiguous guidance.",
    ],
  },
  security: {
    id: "security",
    label: "Security",
    description: "Analyze visible security and phishing signals defensively.",
    tools: ["readPage", "inspectVisibleSignals", "saveNote"],
    systemInstructions: [
      "Operate only as a defensive analyzer of user-visible information.",
      "Do not provide credential theft, exploitation, evasion, or persistence steps.",
      "Explain evidence, severity, uncertainty, and remediation.",
    ],
  },
};

const MODE_INTENT_PATTERNS: Array<{
  id: Exclude<AgentModeId, "copilot">;
  pattern: RegExp;
}> = [
  {
    id: "security",
    pattern:
      /\b(phishing|scam|malware|suspicious|security|privacy risk|certificate|credential theft|is (?:this|the) (?:site|page|link) safe)\b/i,
  },
  {
    id: "shopping",
    pattern:
      /\b(buy|purchase|order|shopping|shop for|add to cart|checkout|prices?|deals?|discount|products?|sellers?|return polic(?:y|ies)|shipping)\b/i,
  },
  {
    id: "scraper",
    pattern:
      /\b(scrape|extract|export|dataset|structured data|json|csv|table|all (?:items|rows|records|links|products)|collect (?:the )?(?:fields|records|entries))\b/i,
  },
  {
    id: "developer",
    pattern:
      /\b(api|sdk|code|coding|programming|developer|documentation|technical docs?|implementation|typescript|javascript|python|rust|java|sql|framework|library|debug)\b/i,
  },
  {
    id: "research",
    pattern:
      /\b(research|compare|investigate|sources?|citations?|evidence|synthesize|across (?:tabs|pages|sites)|literature|pros and cons|alternatives)\b/i,
  },
];

export function routeAgentMode(message: string): AgentModeId {
  const normalized = message.trim();
  if (!normalized) {
    return "copilot";
  }

  return (
    MODE_INTENT_PATTERNS.find(({ pattern }) => pattern.test(normalized))?.id ??
    "copilot"
  );
}

export class AgentModeRegistry {
  static list(): AgentMode[] {
    return Object.values(MODES).map((mode) => ({
      ...mode,
      tools: [...mode.tools],
      systemInstructions: [...mode.systemInstructions],
    }));
  }

  static get(id: AgentModeId): AgentMode {
    return MODES[id];
  }

  static isModeId(value: unknown): value is AgentModeId {
    return typeof value === "string" && value in MODES;
  }
}
