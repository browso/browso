import { WebContents } from "electron";
import {
  generateText,
  stepCountIs,
  streamText,
  type LanguageModel,
  type CoreMessage,
} from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { anthropic } from "@ai-sdk/anthropic";
import { createOllama } from "ai-sdk-ollama";
import * as dotenv from "dotenv";
import { join } from "path";
import type { Tab } from "./Tab";
import { AISettingsStore } from "./AISettings";
import { buildShoppingTools, SHOPPING_AGENT_PROMPT } from "./AgentTools";
import {
  buildFallbackAgentReport,
  buildProgressSummary,
} from "./agentSessionSummary";
import { logger } from "./Logger";

dotenv.config({ path: join(__dirname, "../../.env") });

type StepStatus = "pending" | "running" | "completed" | "failed";
type SessionStatus = "planning" | "running" | "completed" | "failed";
type ActionType =
  | "navigate"
  | "click"
  | "type"
  | "press"
  | "extract_text"
  | "wait"
  | "run_script";

interface ComputerUseRequest {
  goal: string;
  messages?: CoreMessage[];
}

interface ScriptGenerationRequest {
  goal: string;
}

interface PlannedStep {
  action: ActionType;
  label: string;
  url?: string;
  selector?: string;
  text?: string;
  script?: string;
  ms?: number;
}

interface ComputerUseStep extends PlannedStep {
  id: string;
  status: StepStatus;
  result?: string;
  startedAt?: number;
  completedAt?: number;
}

interface GeneratedScript {
  goal: string;
  code: string;
  createdAt: number;
}

interface ComputerUseSession {
  id: string;
  goal: string;
  summary: string;
  status: SessionStatus;
  createdAt: number;
  currentUrl: string | null;
  screenshot: string | null;
  logs: string[];
  steps: ComputerUseStep[];
  generatedScript: GeneratedScript | null;
  finalReport: string | null;
}

interface ComputerUseState {
  sessions: ComputerUseSession[];
  activeSessionId: string | null;
  isRunning: boolean;
}

const COMPUTER_USE_PROMPT = `You are Browso's computer-use planner.
Return strict JSON only with this shape:
{
  "summary": "short summary",
  "steps": [
    {
      "action": "navigate|click|type|press|extract_text|wait|run_script",
      "label": "what the step does",
      "url": "https://...",
      "selector": "css selector",
      "text": "text to type",
      "script": "javascript for run_script",
      "ms": 500
    }
  ]
}

Rules:
- Use at most 6 steps.
- Only include fields relevant to the chosen action.
- Prefer stable CSS selectors.
- Use "press" for keyboard actions like Enter, Tab, Escape, or ArrowDown.
- If the task is unclear, gather context first with extract_text.
- Prefer moving the browser toward the user's goal rather than just reading the page.
- Verify that the page changed in the expected direction after navigation or major actions.
- If the user gave a target site, bias toward that site instead of general search.
- Use run_script only when it is meaningfully better than click/type.
- Browso also has a local runner for code, file, spreadsheet, and data tasks.
- Available local runner tools are: notifyUser, currentPage, listScopedFiles, readScopedFile, writeScopedFile, useMcp.
- If the user request is mainly code/file/data work, make that explicit in the summary and keep browser steps minimal.
- Never wrap the JSON in markdown fences.`;

const SCRIPT_PROMPT = `You are generating a browser automation snippet for Browso.
Return only JavaScript. No markdown fences.
The code will run inside the current webpage with access to the DOM.
Use async patterns when needed and add concise comments only where they help.
Favor robust selectors and readable structure.`;

const AGENT_REPORT_PROMPT = `You are writing the final answer for Browso's browser agent.
Use the browsing evidence already collected.

Rules:
- If the task was informational, answer directly first and support it with the strongest evidence.
- If the task was navigational, explain what page or section was reached and what remains.
- If the task was transactional, summarize current state, blockers, and the user's next action.
- If evidence is incomplete, say so explicitly.
- Do not mention tool names.
- Keep the answer concise, concrete, and useful.`;

export class ComputerUseManager {
  private readonly webContents: WebContents;
  private readonly getActiveTab: () => Tab | null;
  private readonly settingsStore: AISettingsStore;
  private readonly state: ComputerUseState = {
    sessions: [],
    activeSessionId: null,
    isRunning: false,
  };
  private sessionCounter = 0;

  constructor(webContents: WebContents, getActiveTab: () => Tab | null) {
    this.webContents = webContents;
    this.getActiveTab = getActiveTab;
    this.settingsStore = AISettingsStore.getInstance();
  }

  getState(): ComputerUseState {
    return this.state;
  }

  async startSession(request: ComputerUseRequest): Promise<ComputerUseState> {
    logger.info("Computer use session started");
    const session: ComputerUseSession = {
      id: `session-${++this.sessionCounter}`,
      goal: request.goal.trim(),
      summary: "Planning automation run",
      status: "planning",
      createdAt: Date.now(),
      currentUrl: this.getActiveTab()?.url ?? null,
      screenshot: await this.captureActiveTabScreenshot(),
      logs: ["Inspecting the active page and drafting a plan."],
      steps: [],
      generatedScript: null,
      finalReport: null,
    };

    this.state.sessions = [session, ...this.state.sessions].slice(0, 6);
    this.state.activeSessionId = session.id;
    this.state.isRunning = true;
    this.emitState();

    try {
      const plan = await this.buildPlan(request.goal);
      session.summary = plan.summary;
      session.steps = plan.steps.map((step, index) => ({
        ...step,
        id: `${session.id}-step-${index + 1}`,
        status: "pending",
      }));
      session.status = "running";
      session.logs.push(`Plan ready: ${session.steps.length} steps.`);
      this.emitState();

      for (const step of session.steps) {
        step.status = "running";
        step.startedAt = Date.now();
        session.logs.push(`Running: ${step.label}`);
        this.emitState();

        try {
          const result = await this.executeStep(step);
          step.status = "completed";
          step.result = result;
          step.completedAt = Date.now();
          session.currentUrl = this.getActiveTab()?.url ?? null;
          session.screenshot = await this.captureActiveTabScreenshot();
          session.logs.push(result);
          this.emitState();
        } catch (error) {
          logger.error("Computer use step failed", error, { step: step.label });
          step.status = "failed";
          step.result = this.getErrorMessage(error);
          step.completedAt = Date.now();
          session.status = "failed";
          session.logs.push(`Failed: ${step.result}`);
          this.state.isRunning = false;
          this.emitState();
          return this.state;
        }
      }

      session.status = "completed";
      session.logs.push("Automation run completed.");
      this.state.isRunning = false;
      this.emitState();
      return this.state;
    } catch (error) {
      logger.error("Computer use planning failed", error);
      session.status = "failed";
      session.logs.push(`Planning failed: ${this.getErrorMessage(error)}`);
      this.state.isRunning = false;
      this.emitState();
      return this.state;
    }
  }

  async startAgentSession(
    request: ComputerUseRequest,
  ): Promise<ComputerUseState> {
    logger.info("Autonomous agent session started");
    const session: ComputerUseSession = {
      id: `session-${++this.sessionCounter}`,
      goal: request.goal.trim(),
      summary: "Starting autonomous agent",
      status: "running",
      createdAt: Date.now(),
      currentUrl: this.getActiveTab()?.url ?? null,
      screenshot: await this.captureActiveTabScreenshot(),
      logs: ["Agent is analyzing the task and taking action."],
      steps: [],
      generatedScript: null,
      finalReport: null,
    };

    this.state.sessions = [session, ...this.state.sessions].slice(0, 6);
    this.state.activeSessionId = session.id;
    this.state.isRunning = true;
    this.emitState();

    try {
      await this.runAgentLoop(session, request.goal);
      return this.state;
    } catch (error) {
      logger.error("Autonomous agent session failed", error);
      session.status = "failed";
      session.logs.push(`Agent failed: ${this.getErrorMessage(error)}`);
      this.state.isRunning = false;
      this.emitState();
      return this.state;
    }
  }

  private async runAgentLoop(
    session: ComputerUseSession,
    goal: string,
  ): Promise<void> {
    let model: LanguageModel;
    try {
      model = this.initializeModel();
    } catch (error) {
      throw new Error(`LLM not configured: ${this.getErrorMessage(error)}`);
    }

    const tools = buildShoppingTools(
      this.getActiveTab,
      this.webContents,
      this.settingsStore,
    );
    const snapshot = await this.getPageSnapshot();
    const prompt = [
      `User goal: ${goal}`,
      `Current URL: ${snapshot.url ?? "unknown"}`,
      `Current title: ${snapshot.title ?? "unknown"}`,
      `Current page text preview:\n${snapshot.textPreview || "No page text available."}`,
      "Think step by step. Prefer high-level tools first. Re-check the page after major changes. If the task becomes blocked by login, captcha, verification, or payment, hand off clearly to the user.",
      "Solve the task instead of narrating it. If one approach fails, recover with a different page inspection, link selection, search strategy, or field match before giving up.",
    ].join("\n\n");

    let stepCounter = 0;
    let totalSteps = 0;
    const MAX_STEPS = 35;

    try {
      const result = await streamText({
        model,
        system: SHOPPING_AGENT_PROMPT,
        prompt,
        tools,
        stopWhen: stepCountIs(MAX_STEPS),
        temperature: 0.2,
        onStepFinish: async (event): Promise<void> => {
          stepCounter++;
          const { toolCalls, toolResults, text } = event;
          totalSteps += toolCalls.length;

          // Stop if we've exceeded max steps
          if (totalSteps >= MAX_STEPS) {
            logger.warn("Agent reached maximum step limit");
            session.logs.push("Reached maximum step limit");
            session.status = "completed";
            this.state.isRunning = false;
            return;
          }

          // Add steps for each tool call
          for (let i = 0; i < toolCalls.length; i++) {
            const toolCall = toolCalls[i];
            const toolResult = toolResults[i];

            const step: ComputerUseStep = {
              id: `${session.id}-step-${stepCounter}-${i}`,
              action: "run_script",
              label: this.describeToolCall(toolCall.toolName, toolCall.input),
              status: "completed",
              result: JSON.stringify(toolResult).slice(0, 500),
              startedAt: Date.now(),
              completedAt: Date.now(),
            };

            session.steps.push(step);
            session.logs.push(`Tool: ${toolCall.toolName}`);
            session.summary = buildProgressSummary(
              session.goal,
              session.steps,
              this.getActiveTab()?.url ?? null,
            );

            // Check for handoff
            if (toolCall.toolName === "handOffToUser") {
              session.status = "completed";
              session.finalReport = buildFallbackAgentReport(
                session.goal,
                this.getActiveTab()?.url ?? null,
                session.steps,
              );
              session.summary = session.finalReport;
              this.state.isRunning = false;
            }
          }

          if (text) {
            session.logs.push(`Agent: ${text.slice(0, 200)}`);
          }

          session.currentUrl = this.getActiveTab()?.url ?? null;
          session.screenshot = await this.captureActiveTabScreenshot();
          this.emitState();

          // Send step update to UI
          this.webContents.send("agent-step", {
            toolCalls,
            toolResults,
            text,
          });
        },
      });

      await result.consumeStream();

      if (session.status !== "completed") {
        session.status = "completed";
        session.logs.push("Agent completed the task.");
      }
      session.finalReport = await this.buildAgentReport(session);
      session.summary = session.finalReport;
      this.state.isRunning = false;
      this.emitState();
    } catch (error) {
      logger.error("Agent loop failed", error);
      session.status = "failed";
      session.logs.push(`Error: ${this.getErrorMessage(error)}`);
      session.finalReport = buildFallbackAgentReport(
        session.goal,
        this.getActiveTab()?.url ?? null,
        session.steps,
      );
      session.summary = buildProgressSummary(
        session.goal,
        session.steps,
        this.getActiveTab()?.url ?? null,
      );
      this.state.isRunning = false;
      this.emitState();
      throw error;
    }
  }

  async generateScript(
    request: ScriptGenerationRequest,
  ): Promise<ComputerUseState> {
    const activeSession = this.getActiveSession();

    if (!activeSession) {
      await this.startSession({ goal: request.goal });
    }

    const session = this.getActiveSession();
    if (!session) {
      return this.state;
    }

    session.logs.push(
      "Generating a browser-side snippet for the current site.",
    );
    logger.info("Browser-side snippet generation started");
    this.emitState();

    try {
      const code = await this.buildScript(request.goal);
      session.generatedScript = {
        goal: request.goal,
        code,
        createdAt: Date.now(),
      };
      session.logs.push("Snippet ready.");
    } catch (error) {
      logger.error("Snippet generation failed", error);
      session.logs.push(
        `Snippet generation failed: ${this.getErrorMessage(error)}`,
      );
    }

    this.emitState();
    return this.state;
  }

  private getActiveSession(): ComputerUseSession | null {
    if (!this.state.activeSessionId) {
      return null;
    }

    return (
      this.state.sessions.find(
        (session) => session.id === this.state.activeSessionId,
      ) ?? null
    );
  }

  private initializeModel(): LanguageModel {
    const settings = this.settingsStore.getSettings();

    switch (settings.provider) {
      case "anthropic":
        if (!process.env.ANTHROPIC_API_KEY) {
          throw new Error("ANTHROPIC_API_KEY not configured");
        }
        return anthropic(settings.model);
      case "openai":
        if (!process.env.OPENAI_API_KEY) {
          throw new Error("OPENAI_API_KEY not configured");
        }
        return createOpenAI({
          apiKey: process.env.OPENAI_API_KEY,
        })(settings.model);
      case "ollama":
        return createOllama({
          baseURL: settings.ollamaBaseUrl,
        })(settings.model);
      default:
        throw new Error("No LLM provider configured");
    }
  }

  private async buildPlan(goal: string): Promise<{
    summary: string;
    steps: PlannedStep[];
  }> {
    const snapshot = await this.getPageSnapshot();
    const heuristicPlan = this.buildHeuristicPlan(goal, snapshot);
    if (heuristicPlan) {
      return heuristicPlan;
    }

    let model: LanguageModel;
    try {
      model = this.initializeModel();
    } catch {
      return this.buildFallbackPlan(goal, snapshot.url);
    }

    const prompt = [
      COMPUTER_USE_PROMPT,
      `Goal: ${goal}`,
      `Current URL: ${snapshot.url ?? "unknown"}`,
      `Current Title: ${snapshot.title ?? "unknown"}`,
      `Page text preview:\n${snapshot.textPreview || "No text extracted."}`,
    ].join("\n\n");

    const result = await generateText({
      model,
      system:
        "Produce valid JSON only. Do not include explanations before or after the JSON.",
      prompt,
      temperature: 0.2,
      maxRetries: 2,
    });

    const parsed = this.parseJson<{ summary?: string; steps?: PlannedStep[] }>(
      result.text,
    );

    if (!parsed.steps?.length) {
      return this.buildFallbackPlan(goal, snapshot.url);
    }

    return {
      summary: parsed.summary || "Live automation plan",
      steps: parsed.steps.slice(0, 6).map((step) => this.normalizeStep(step)),
    };
  }

  private async buildScript(goal: string): Promise<string> {
    const snapshot = await this.getPageSnapshot();

    let model: LanguageModel;
    try {
      model = this.initializeModel();
    } catch {
      return `// No LLM configured. Start with this scaffold.
async function runBrowsoTask() {
  const root = document.body;
  console.log("Current page:", location.href);
  console.log("Body text preview:", root?.innerText?.slice(0, 500));
}

runBrowsoTask();`;
    }

    const result = await generateText({
      model,
      system: SCRIPT_PROMPT,
      prompt: [
        `User goal: ${goal}`,
        `Current URL: ${snapshot.url ?? "unknown"}`,
        `Current Title: ${snapshot.title ?? "unknown"}`,
        `Page text preview:\n${snapshot.textPreview || "No text extracted."}`,
      ].join("\n\n"),
      temperature: 0.2,
      maxRetries: 2,
    });

    return result.text.trim();
  }

  private async buildAgentReport(session: ComputerUseSession): Promise<string> {
    const snapshot = await this.getPageSnapshot();
    const fallback = buildFallbackAgentReport(
      session.goal,
      snapshot.url,
      session.steps,
    );

    let model: LanguageModel;
    try {
      model = this.initializeModel();
    } catch {
      return fallback;
    }

    const recentSteps = session.steps.slice(-8).map((step) => ({
      label: step.label,
      status: step.status,
      result: step.result?.slice(0, 500) ?? null,
    }));
    const recentLogs = session.logs.slice(-10);

    try {
      const result = await generateText({
        model,
        system: AGENT_REPORT_PROMPT,
        prompt: [
          `User goal: ${session.goal}`,
          `Current URL: ${snapshot.url ?? "unknown"}`,
          `Current title: ${snapshot.title ?? "unknown"}`,
          `Current page text preview:\n${snapshot.textPreview || "No page text available."}`,
          `Recent completed steps:\n${JSON.stringify(recentSteps, null, 2)}`,
          `Recent logs:\n${recentLogs.join("\n")}`,
          `Fallback report:\n${fallback}`,
        ].join("\n\n"),
        temperature: 0.2,
        maxRetries: 2,
      });

      return result.text.trim() || fallback;
    } catch {
      return fallback;
    }
  }

  private buildFallbackPlan(
    goal: string,
    url: string | null,
  ): {
    summary: string;
    steps: PlannedStep[];
  } {
    const detectedUrl = goal.match(/https?:\/\/\S+/)?.[0];
    const steps: PlannedStep[] = [];

    if (detectedUrl && detectedUrl !== url) {
      steps.push({
        action: "navigate",
        label: `Open ${detectedUrl}`,
        url: detectedUrl,
      });
    }

    steps.push({
      action: "extract_text",
      label: "Capture current page text",
    });

    return {
      summary:
        "Fallback run: collect page context and keep the operator informed.",
      steps,
    };
  }

  private buildHeuristicPlan(
    goal: string,
    snapshot: { url: string | null; title: string | null; textPreview: string },
  ): { summary: string; steps: PlannedStep[] } | null {
    const normalizedGoal = goal.trim().toLowerCase();
    const currentUrl = snapshot.url ?? "";
    const onGoogle = /https?:\/\/(www\.)?google\./i.test(currentUrl);
    const searchMatch = goal.match(/\bsearch for\b\s+(.+)$/i);
    const findMatch = goal.match(/\bfind\b\s+(.+)$/i);
    const query = (searchMatch?.[1] || findMatch?.[1] || goal)
      .replace(/\b(on|in)\s+google\b/gi, "")
      .trim();

    const looksLikeShoppingTask =
      /\b(shoe|shoes|sneaker|sneakers|boot|boots|shirt|bag|watch|jacket|running)\b/i.test(
        normalizedGoal,
      );

    if (onGoogle && /\b(search|find)\b/i.test(normalizedGoal) && query) {
      const steps: PlannedStep[] = [
        {
          action: "type",
          label: `Type search query`,
          selector: 'textarea[name="q"], input[name="q"]',
          text: query,
        },
        {
          action: "press",
          label: "Submit search",
          selector: 'textarea[name="q"], input[name="q"]',
          text: "Enter",
        },
        {
          action: "wait",
          label: "Wait for search results",
          ms: 3000,
        },
        {
          action: "run_script",
          label: "Open the first search result",
          script: this.buildClickFirstGoogleResultScript(),
        },
        {
          action: "wait",
          label: "Wait for the result page to load",
          ms: 1400,
        },
      ];

      if (looksLikeShoppingTask) {
        steps.push({
          action: "run_script",
          label: "Open the first product item on the page",
          script: this.buildClickFirstProductScript(),
        });
      } else {
        steps.push({
          action: "extract_text",
          label: "Read the result page",
        });
      }

      return {
        summary: looksLikeShoppingTask
          ? `Search Google for "${query}", open the first result, then open the first likely product item.`
          : `Search Google for "${query}" and open the first result page.`,
        steps,
      };
    }

    if (
      looksLikeShoppingTask &&
      !onGoogle &&
      /\b(first item|first product|open first|click first)\b/i.test(
        normalizedGoal,
      )
    ) {
      return {
        summary:
          "Open the first likely product item on the current shopping page.",
        steps: [
          {
            action: "run_script",
            label: "Open the first product item on the page",
            script: this.buildClickFirstProductScript(),
          },
          {
            action: "wait",
            label: "Wait for the product page to load",
            ms: 1400,
          },
          {
            action: "extract_text",
            label: "Read the product page",
          },
        ],
      };
    }

    return null;
  }

  private normalizeStep(step: PlannedStep): PlannedStep {
    return {
      action: step.action,
      label: step.label || `Run ${step.action}`,
      url: step.url,
      selector: step.selector,
      text: step.text,
      script: step.script,
      ms: step.ms,
    };
  }

  private async executeStep(step: PlannedStep): Promise<string> {
    const tab = this.getActiveTab();
    if (!tab) {
      throw new Error("No active tab available.");
    }

    switch (step.action) {
      case "navigate":
        if (!step.url) {
          throw new Error("Navigate step is missing a URL.");
        }
        await tab.loadURL(step.url);
        return `Opened ${step.url}`;
      case "click":
        if (!step.selector) {
          throw new Error("Click step is missing a selector.");
        }
        await this.runTabScript(tab, this.buildClickScript(step.selector));
        return `Clicked ${step.selector}`;
      case "type":
        if (!step.selector) {
          throw new Error("Type step is missing a selector.");
        }
        await this.runTabScript(
          tab,
          this.buildTypeScript(step.selector, step.text ?? ""),
        );
        return `Typed into ${step.selector}`;
      case "press":
        await this.runTabScript(
          tab,
          this.buildPressScript(step.text ?? "Enter", step.selector),
        );
        return `Pressed ${step.text ?? "Enter"}`;
      case "extract_text": {
        const text = await tab.getTabText();
        return `Extracted page text preview:\n${text.slice(0, 700)}`;
      }
      case "wait":
        await new Promise((resolve) => setTimeout(resolve, step.ms ?? 1000));
        return `Waited ${step.ms ?? 1000}ms`;
      case "run_script":
        if (!step.script) {
          throw new Error("Script step is missing code.");
        }
        try {
          return this.stringifyExecutionResult(await tab.runJs(step.script));
        } catch (error) {
          throw new Error(
            `Script failed to execute, this normally means an error was thrown. ${this.getErrorMessage(error)}`,
          );
        }
      default:
        throw new Error(`Unsupported action: ${String(step.action)}`);
    }
  }

  private async getPageSnapshot(): Promise<{
    url: string | null;
    title: string | null;
    textPreview: string;
  }> {
    const tab = this.getActiveTab();
    if (!tab) {
      return { url: null, title: null, textPreview: "" };
    }

    try {
      const text = await tab.getTabText();
      return {
        url: tab.url,
        title: tab.title,
        textPreview: text.slice(0, 2500),
      };
    } catch {
      return {
        url: tab.url,
        title: tab.title,
        textPreview: "",
      };
    }
  }

  private async captureActiveTabScreenshot(): Promise<string | null> {
    const tab = this.getActiveTab();
    if (!tab) {
      return null;
    }

    try {
      return (await tab.screenshot()).toDataURL();
    } catch {
      return null;
    }
  }

  private async runTabScript(tab: Tab, code: string): Promise<unknown> {
    return tab.runJs(code);
  }

  private describeToolCall(toolName: string, input: unknown): string {
    if (!input || typeof input !== "object") {
      return toolName;
    }

    const data = input as Record<string, unknown>;
    if (typeof data.query === "string") {
      return `${toolName}: ${data.query}`;
    }
    if (typeof data.url === "string") {
      return `${toolName}: ${data.url}`;
    }
    if (typeof data.intent === "string") {
      return `${toolName}: ${data.intent}`;
    }
    if (typeof data.targetText === "string") {
      return `${toolName}: ${data.targetText}`;
    }
    if (typeof data.reason === "string") {
      return `${toolName}: ${data.reason}`;
    }
    if (typeof data.text === "string") {
      return `${toolName}: ${String(data.text).slice(0, 40)}`;
    }

    return toolName;
  }

  private buildClickScript(selector: string): string {
    return `(() => {
      ${this.buildCursorHelpers()}
      const element = document.querySelector(${JSON.stringify(selector)});
      if (!element) {
        throw new Error("Element not found for selector: ${selector}");
      }
      element.scrollIntoView({ block: "center", behavior: "instant" });
      window.__browsoMoveCursorToElement(element);
      if (element instanceof HTMLElement) {
        element.click();
      } else {
        element.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      }
      return true;
    })()`;
  }

  private buildTypeScript(selector: string, text: string): string {
    return `(() => {
      ${this.buildCursorHelpers()}
      const element = document.querySelector(${JSON.stringify(selector)});
      if (!element) {
        throw new Error("Element not found for selector: ${selector}");
      }
      const value = ${JSON.stringify(text)};
      element.scrollIntoView({ block: "center", behavior: "instant" });
      window.__browsoMoveCursorToElement(element);
      if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
        element.focus();
        element.value = value;
        element.dispatchEvent(new Event("input", { bubbles: true }));
        element.dispatchEvent(new Event("change", { bubbles: true }));
        return true;
      }
      if (element instanceof HTMLElement && element.isContentEditable) {
        element.focus();
        element.innerText = value;
        element.dispatchEvent(new Event("input", { bubbles: true }));
        return true;
      }
      throw new Error("Element is not an input, textarea, or contenteditable node.");
    })()`;
  }

  private buildPressScript(key: string, selector?: string): string {
    return `(() => {
      ${this.buildCursorHelpers()}
      const keyValue = ${JSON.stringify(key)};
      const target = ${
        selector
          ? `document.querySelector(${JSON.stringify(selector)}) || document.activeElement || document.body`
          : `document.activeElement || document.body`
      };
      if (!target) {
        throw new Error("No target available for key press.");
      }
      if (target instanceof Element) {
        target.scrollIntoView({ block: "center", behavior: "instant" });
        window.__browsoMoveCursorToElement(target);
      }
      if (target instanceof HTMLElement) {
        target.focus();
      }
      const code = keyValue.length === 1 ? "Key" + keyValue.toUpperCase() : keyValue;
      const keyCodeMap = { Enter: 13, Tab: 9, Escape: 27, ArrowDown: 40, ArrowUp: 38, ArrowLeft: 37, ArrowRight: 39 };
      const keyCode = keyCodeMap[keyValue] ?? (keyValue.length === 1 ? keyValue.toUpperCase().charCodeAt(0) : 0);
      const eventInit = {
        key: keyValue,
        code,
        keyCode,
        which: keyCode,
        bubbles: true,
        cancelable: true
      };
      target.dispatchEvent(new KeyboardEvent("keydown", eventInit));
      target.dispatchEvent(new KeyboardEvent("keypress", eventInit));
      if (
        keyValue === "Enter" &&
        target instanceof HTMLInputElement &&
        target.form
      ) {
        if (typeof target.form.requestSubmit === "function") {
          target.form.requestSubmit();
        } else {
          target.form.submit();
        }
      }
      target.dispatchEvent(new KeyboardEvent("keyup", eventInit));
      return true;
    })()`;
  }

  private buildClickFirstGoogleResultScript(): string {
    return `(() => {
      ${this.buildCursorHelpers()}
      
      // Try to find the first real search result link
      // Strategy 1: Look for links with h3 headings (typical result structure)
      let link = document.querySelector('#search a[href]:has(h3)');
      
      // Strategy 2: Look for any link with h3 inside
      if (!link) {
        link = document.querySelector('a[href]:has(h3)');
      }
      
      // Strategy 3: Look in the main results container
      if (!link) {
        const rso = document.querySelector('#rso');
        if (rso) {
          const links = Array.from(rso.querySelectorAll('a[href]'));
          link = links.find(a => {
            const href = a.getAttribute('href');
            return href && 
                   href.startsWith('http') && 
                   !href.includes('google.com/search') &&
                   !href.includes('google.com/url?') &&
                   a.querySelector('h3');
          });
        }
      }
      
      // Strategy 4: Find any link that looks like a result
      if (!link) {
        const allLinks = Array.from(document.querySelectorAll('a[href]'));
        link = allLinks.find(a => {
          const href = a.getAttribute('href');
          const text = a.textContent || '';
          return href && 
                 href.startsWith('http') && 
                 !href.includes('google.com') &&
                 !href.includes('youtube.com/results') &&
                 text.length > 10 &&
                 a.querySelector('h3');
        });
      }
      
      if (!link || !(link instanceof HTMLAnchorElement)) {
        // Debug info
        const debugInfo = {
          hasSearch: !!document.querySelector('#search'),
          hasRso: !!document.querySelector('#rso'),
          h3Count: document.querySelectorAll('h3').length,
          linkCount: document.querySelectorAll('a[href]').length,
          url: window.location.href
        };
        throw new Error("No Google search result link found. Debug: " + JSON.stringify(debugInfo));
      }
      
      link.scrollIntoView({ block: "center", behavior: "instant" });
      window.__browsoMoveCursorToElement(link);
      link.click();
      return link.href;
    })()`;
  }

  private buildClickFirstProductScript(): string {
    return `(() => {
      ${this.buildCursorHelpers()}
      const candidates = Array.from(document.querySelectorAll('a[href]')).filter((link) => {
        if (!(link instanceof HTMLAnchorElement)) {
          return false;
        }
        const text = (link.textContent || "").trim().toLowerCase();
        if (!text || text.length < 2) {
          return false;
        }
        if (/sign in|log in|login|register|wishlist|privacy|terms|support|help|cart/.test(text)) {
          return false;
        }
        const rect = link.getBoundingClientRect();
        if (rect.width < 24 || rect.height < 16) {
          return false;
        }
        return /(shoe|sneaker|running|men|women|kids|white|black|product|shop|buy|size)/.test(text);
      });
      const target = candidates[0];
      if (!(target instanceof HTMLAnchorElement)) {
        throw new Error("No likely product link found on the page.");
      }
      target.scrollIntoView({ block: "center", behavior: "instant" });
      window.__browsoMoveCursorToElement(target);
      target.click();
      return target.href;
    })()`;
  }

  private buildCursorHelpers(): string {
    return `
      if (!window.__browsoEnsureCursor) {
        window.__browsoEnsureCursor = () => {
          let cursor = document.getElementById("__browso-agent-cursor");
          if (!cursor) {
            cursor = document.createElement("div");
            cursor.id = "__browso-agent-cursor";
            cursor.style.position = "fixed";
            cursor.style.left = "0px";
            cursor.style.top = "0px";
            cursor.style.width = "18px";
            cursor.style.height = "18px";
            cursor.style.borderRadius = "999px";
            cursor.style.background = "rgba(37, 99, 235, 0.92)";
            cursor.style.border = "2px solid white";
            cursor.style.boxShadow = "0 8px 24px rgba(37, 99, 235, 0.35)";
            cursor.style.zIndex = "2147483647";
            cursor.style.pointerEvents = "none";
            cursor.style.transform = "translate(-50%, -50%)";
            cursor.style.transition = "left 180ms ease, top 180ms ease, transform 120ms ease";
            document.body.appendChild(cursor);
          }
          return cursor;
        };
        window.__browsoMoveCursorToElement = (element) => {
          const cursor = window.__browsoEnsureCursor();
          const rect = element.getBoundingClientRect();
          const x = rect.left + rect.width / 2;
          const y = rect.top + rect.height / 2;
          cursor.style.left = x + "px";
          cursor.style.top = y + "px";
          cursor.style.transform = "translate(-50%, -50%) scale(1.08)";
          window.setTimeout(() => {
            cursor.style.transform = "translate(-50%, -50%) scale(1)";
          }, 140);
          return cursor;
        };
      }
    `;
  }

  private stringifyExecutionResult(result: unknown): string {
    if (typeof result === "string") {
      return result;
    }

    if (result === undefined) {
      return "Script executed.";
    }

    return JSON.stringify(result, null, 2);
  }

  private parseJson<T>(value: string): T {
    const cleaned = value
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/```$/, "")
      .trim();

    return JSON.parse(cleaned) as T;
  }

  private getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    return "Unknown error";
  }

  private emitState(): void {
    this.webContents.send("computer-use-state", this.state);
  }
}
