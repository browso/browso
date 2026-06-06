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
