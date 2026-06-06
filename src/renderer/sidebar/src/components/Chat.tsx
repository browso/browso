import React, { useEffect, useMemo, useRef, useState } from "react";
import { Bookmark, Bot, LoaderCircle, Plus, Send } from "lucide-react";
import { Button } from "@common/components/Button";
import { cn } from "@common/lib/utils";

type SidebarLayout = Awaited<
  ReturnType<typeof window.sidebarAPI.getSidebarLayout>
>;
type TabInfo = Awaited<ReturnType<typeof window.sidebarAPI.getActiveTabInfo>>;
type ChatHistoryMessage = Awaited<
  ReturnType<typeof window.sidebarAPI.getMessages>
>[number];
type ComputerUseState = Awaited<
  ReturnType<typeof window.sidebarAPI.getComputerUseState>
>;
type AgentMode = Awaited<
  ReturnType<typeof window.sidebarAPI.listAgentModes>
>[number];
type AISettings = Awaited<ReturnType<typeof window.sidebarAPI.getAISettings>>;

const COMMAND_SUGGESTIONS = [
  {
    command: "/help",
    description: "Show available local commands.",
  },
  {
    command: "@remember this",
    description:
      "Save a memory directly without sending it to the model first.",
  },
  {
    command: "/save",
    description: "Save the current page to local knowledge.",
  },
  {
    command: "/notes",
    description: "List recently saved pages.",
  },
  {
    command: "/mode research",
    description: "Change the active agent mode.",
  },
] as const;

const getActiveSession = (state: ComputerUseState | null) =>
  state?.sessions.find((session) => session.id === state.activeSessionId) ??
  state?.sessions[0] ??
  null;

const getThinkingLines = (text: string): string[] =>
  text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

const extractMessageText = (message: ChatHistoryMessage): string => {
  if (typeof message.content === "string") {
    return message.content;
  }

  if (Array.isArray(message.content)) {
    return message.content
      .flatMap((part) => {
        if (typeof part === "string") {
          return part;
        }
        if (
          part &&
          typeof part === "object" &&
          "text" in part &&
          typeof part.text === "string"
        ) {
          return part.text;
        }
        return [];
      })
      .join("\n")
      .trim();
  }

  return "";
};

const hasScreenshot = (message: ChatHistoryMessage): boolean =>
  Array.isArray(message.content) &&
  message.content.some(
    (part) =>
      typeof part === "object" &&
      part !== null &&
      "type" in part &&
      part.type === "image",
  );

export const Chat: React.FC = () => {
  const [messages, setMessages] = useState<ChatHistoryMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [tabInfo, setTabInfo] = useState<TabInfo>(null);
  const [layout, setLayout] = useState<SidebarLayout | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [isComputerUseRunning, setIsComputerUseRunning] = useState(false);
  const [streamingThought, setStreamingThought] = useState("");
  const [computerUseState, setComputerUseState] =
    useState<ComputerUseState | null>(null);
  const [agentModes, setAgentModes] = useState<AgentMode[]>([]);
  const [settings, setSettings] = useState<AISettings | null>(null);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const dragState = useRef<{
    startMouseX: number;
    startWidth: number;
    minWidth: number;
    maxWidth: number;
  } | null>(null);
  const messagesRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const removeMessagesUpdatedListener = window.sidebarAPI.onMessagesUpdated(
      (history) => {
        setMessages(history as ChatHistoryMessage[]);
      },
    );
    const removeChatResponseListener = window.sidebarAPI.onChatResponse(
      (data) => {
        if (!data.isComplete) {
          setStreamingThought((previous) => previous + data.content);
          return;
        }

        setStreamingThought("");
        if (data.isComplete) {
          setIsSending(false);
        }
      },
    );
    const removeComputerUseStateListener = window.sidebarAPI.onComputerUseState(
      (state) => {
        const nextState = state as ComputerUseState | null;
        setComputerUseState(nextState);
        setIsComputerUseRunning(Boolean(nextState?.isRunning));
        if (!nextState?.isRunning) {
          setStreamingThought("");
        }
      },
    );

    const load = async () => {
      const [
        history,
        activeBrowserTab,
        sidebarLayout,
        computerUseState,
        availableModes,
        aiSettings,
      ] = await Promise.all([
        window.sidebarAPI.getMessages(),
        window.sidebarAPI.getActiveTabInfo(),
        window.sidebarAPI.getSidebarLayout(),
        window.sidebarAPI.getComputerUseState(),
        window.sidebarAPI.listAgentModes(),
        window.sidebarAPI.getAISettings(),
      ]);

      setMessages(history);
      setTabInfo(activeBrowserTab);
      setLayout(sidebarLayout);
      setComputerUseState(computerUseState);
      setIsComputerUseRunning(Boolean(computerUseState?.isRunning));
      setAgentModes(availableModes);
      setSettings(aiSettings);
    };

    void load();

    const interval = window.setInterval(() => {
      void window.sidebarAPI.getActiveTabInfo().then(setTabInfo);
    }, 2500);

    return () => {
      window.clearInterval(interval);
      removeMessagesUpdatedListener();
      removeChatResponseListener();
      removeComputerUseStateListener();
    };
  }, []);

  useEffect(() => {
    const container = messagesRef.current;
    if (!container) {
      return;
    }
    container.scrollTop = container.scrollHeight;
  }, [messages]);

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      const currentDrag = dragState.current;
      if (!currentDrag) {
        return;
      }

      const rawWidth =
        currentDrag.startWidth + (currentDrag.startMouseX - event.clientX);
      const nextWidth = Math.max(
        currentDrag.minWidth,
        Math.min(currentDrag.maxWidth, Math.round(rawWidth)),
      );

      setLayout((previous) =>
        previous ? { ...previous, width: nextWidth } : previous,
      );
      void window.sidebarAPI.setSidebarWidth(nextWidth);
    };

    const handleMouseUp = () => {
      dragState.current = null;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, []);

  const handleResizeStart = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!layout) {
      return;
    }

    dragState.current = {
      startMouseX: event.clientX,
      startWidth: layout.width,
      minWidth: layout.minWidth,
      maxWidth: layout.maxWidth,
    };
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  };

  const suggestion = useMemo(
    () =>
      tabInfo?.title
        ? `Summarize this page and tell me what matters most about "${tabInfo.title}".`
        : "Summarize the current page and explain the main points.",
    [tabInfo?.title],
  );

  const isComposerLocked = isSending || isComputerUseRunning;
  const showCommandSuggestions =
    draft.trim() === "/" || draft.trim().startsWith("/");
  const activeComputerUseSession = getActiveSession(computerUseState);
  const liveThoughtLines = useMemo(() => {
    if (streamingThought.trim()) {
      return getThinkingLines(streamingThought);
    }

    if (activeComputerUseSession?.logs.length) {
      return activeComputerUseSession.logs.slice(-4);
    }

    return [];
  }, [activeComputerUseSession?.logs, streamingThought]);
  const activeStepLabel =
    activeComputerUseSession?.steps.find((step) => step.status === "running")
      ?.label ?? null;
  const thinkingTitle = isComputerUseRunning
    ? "Agent Working"
    : isSending
      ? "Agent Thinking"
      : null;

  const sendMessage = async (message: string) => {
    const trimmedMessage = message.trim();
    if (!trimmedMessage || isComposerLocked) {
      return;
    }

    setDraft("");
    setIsSending(true);

    try {
      await window.sidebarAPI.sendChatMessage({
        message: trimmedMessage,
        messageId: crypto.randomUUID(),
      });
    } catch {
      setIsSending(false);
    }
  };

  const changeMode = async (mode: AISettings["activeAgentMode"]) => {
    const updated = await window.sidebarAPI.updateAISettings({
      activeAgentMode: mode,
    });
    setSettings(updated);
  };

  const saveCurrentPage = async () => {
    setSaveStatus("Saving...");
    try {
      const page = await window.sidebarAPI.saveCurrentPage();
      setSaveStatus(`Saved: ${page.title}`);
    } catch {
      setSaveStatus("Could not save this page.");
    }
    window.setTimeout(() => setSaveStatus(null), 3000);
  };

  return (
    <div className="relative flex h-full flex-col bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.08),_transparent_40%),linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.96))] dark:bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.12),_transparent_30%),linear-gradient(180deg,rgba(9,13,20,0.98),rgba(10,15,23,0.98))]">
      <div
        onMouseDown={handleResizeStart}
        className="absolute left-0 top-0 z-20 h-full w-2 cursor-col-resize bg-transparent"
        title="Resize AI panel"
      >
        <div className="ml-[1px] h-full w-px bg-border/70" />
      </div>

      <div className="border-b border-border/80 px-4 py-3">
        <div className="flex items-center gap-2">
          <select
            value={settings?.activeAgentMode ?? "copilot"}
            onChange={(event) =>
              void changeMode(
                event.target.value as AISettings["activeAgentMode"],
              )
            }
            className="min-w-0 flex-1 rounded-xl border border-border bg-background px-3 py-2 text-xs font-medium text-foreground outline-none"
            aria-label="Agent mode"
          >
            {agentModes.map((mode) => (
              <option key={mode.id} value={mode.id}>
                {mode.label}
              </option>
            ))}
          </select>
          <Button
            variant="outline"
            size="icon"
            onClick={() => void saveCurrentPage()}
            title="Save current page to local knowledge"
          >
            <Bookmark className="size-4" />
          </Button>
        </div>
        <p className="mt-2 truncate text-xs text-muted-foreground">
          Active tab:{" "}
          <span className="font-medium text-foreground">
            {tabInfo?.title ?? "Loading..."}
          </span>
        </p>
        {saveStatus && (
          <p className="mt-1 truncate text-xs text-muted-foreground">
            {saveStatus}
          </p>
        )}
      </div>

      <div ref={messagesRef} className="flex-1 overflow-y-auto px-4 py-4">
        {thinkingTitle && liveThoughtLines.length > 0 && (
          <div className="mb-4 rounded-[24px] border border-border bg-card p-4 shadow-sm">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              <LoaderCircle className="size-3.5 animate-spin" />
              {thinkingTitle}
            </div>
            {activeStepLabel && (
              <p className="mt-2 text-sm font-medium text-foreground">
                Current step: {activeStepLabel}
              </p>
            )}
            <div className="mt-3 space-y-2">
              {liveThoughtLines.map((line, index) => (
                <p
                  key={`${line}-${index}`}
                  className="rounded-2xl border border-border/70 bg-background px-3 py-2 text-sm leading-6 text-foreground"
                >
                  {line}
                </p>
              ))}
            </div>
          </div>
        )}

        {messages.length > 0 ? (
          <div className="space-y-3">
            {messages.map((message, index) => {
              const text = extractMessageText(message);
              const isUser = message.role === "user";

              return (
                <div
                  key={`${message.role}-${index}`}
                  className={cn(
                    "flex",
                    isUser ? "justify-end" : "justify-start",
                  )}
                >
                  <div
                    className={cn(
                      "max-w-[92%] rounded-[24px] px-4 py-3 shadow-sm",
                      isUser
                        ? "bg-foreground text-background"
                        : "border border-border bg-card text-foreground",
                    )}
                  >
                    <p
                      className={cn(
                        "text-[11px] uppercase tracking-[0.18em]",
                        isUser ? "text-background/70" : "text-muted-foreground",
                      )}
                    >
                      {isUser ? "You" : "Agent"}
                    </p>
                    {hasScreenshot(message) && (
                      <p
                        className={cn(
                          "mt-2 text-xs",
                          isUser
                            ? "text-background/80"
                            : "text-muted-foreground",
                        )}
                      >
                        Screenshot included from the current page.
                      </p>
                    )}
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-6">
                      {text || (isUser ? "Sent page context." : "Thinking...")}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="rounded-[28px] border border-dashed border-border bg-card/80 p-6 text-center">
            <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-secondary text-muted-foreground">
              <Bot className="size-5" />
            </div>
            <h3 className="mt-4 text-sm font-semibold text-foreground">
              Start a chat
            </h3>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">
              Ask a question about the current website. The agent will include
              live page context and a screenshot automatically.
            </p>
          </div>
        )}
      </div>

      {thinkingTitle && (
        <div className="pointer-events-none absolute bottom-[150px] left-1/2 z-30 -translate-x-1/2">
          <div className="animate-[floatBusy_2.6s_ease-in-out_infinite] rounded-full border border-border bg-background/95 px-4 py-2 shadow-[0_16px_40px_rgba(15,23,42,0.16)] backdrop-blur">
            <div className="flex items-center gap-2 text-xs font-medium text-foreground">
              <span className="flex size-5 items-center justify-center rounded-full border border-border bg-card">
                <LoaderCircle className="size-3 animate-spin" />
              </span>
              <span>{thinkingTitle}</span>
              {activeStepLabel ? (
                <span className="max-w-[220px] truncate text-muted-foreground">
                  {activeStepLabel}
                </span>
              ) : null}
            </div>
          </div>
        </div>
      )}

      <div className="border-t border-border/80 px-4 py-4">
        <div className="rounded-[28px] border border-border bg-card p-3 shadow-sm">
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (isComposerLocked) {
                return;
              }
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void sendMessage(draft);
              }
            }}
            rows={4}
            className="min-h-[112px] w-full resize-none bg-transparent text-sm leading-6 text-foreground outline-none placeholder:text-muted-foreground"
            placeholder={
              isComposerLocked
                ? "Agent is working. Wait until it finishes..."
                : "Ask about the current page..."
            }
            disabled={isComposerLocked}
          />
          {showCommandSuggestions && !isComposerLocked && (
            <div className="mt-3 rounded-[20px] border border-border bg-background/95 p-2 shadow-sm">
              <p className="px-2 pb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Commands
              </p>
              <div className="space-y-1">
                {COMMAND_SUGGESTIONS.map((item) => (
                  <button
                    key={item.command}
                    type="button"
                    onClick={() => setDraft(item.command)}
                    className="flex w-full items-start justify-between gap-3 rounded-[14px] px-3 py-2 text-left transition-colors hover:bg-secondary"
                  >
                    <span className="text-sm font-medium text-foreground">
                      {item.command}
                    </span>
                    <span className="max-w-[70%] text-xs leading-5 text-muted-foreground">
                      {item.description}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
          {!showCommandSuggestions && !isComposerLocked && (
            <p className="mt-3 px-1 text-xs text-muted-foreground">
              Type{" "}
              <code className="rounded bg-secondary px-1 py-0.5">/help</code> to
              see available commands.
            </p>
          )}
          <div className="mt-3 flex items-center justify-end gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setDraft(suggestion)}
              disabled={isComposerLocked}
              title="Insert page summary prompt"
            >
              <Plus className="size-4" />
            </Button>
            <Button
              size="icon"
              onClick={() => void sendMessage(draft)}
              disabled={!draft.trim() || isComposerLocked}
              title="Send"
            >
              {isComposerLocked ? (
                <LoaderCircle className="size-4 animate-spin" />
              ) : (
                <Send className="size-4" />
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
