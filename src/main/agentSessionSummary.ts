type SessionStepLike = {
  label: string;
  result?: string;
  status?: "pending" | "running" | "completed" | "failed";
};

function cleanText(value: string, limit: number): string {
  return value.replace(/\s+/g, " ").trim().slice(0, limit);
}

function summarizeStepResult(result?: string): string | null {
  if (!result) {
    return null;
  }

  const cleaned = cleanText(result, 220);
  if (!cleaned) {
    return null;
  }

  if (cleaned.startsWith("{") || cleaned.startsWith("[")) {
    return null;
  }

  return cleaned;
}

export function buildProgressSummary(
  goal: string,
  steps: SessionStepLike[],
  currentUrl: string | null,
): string {
  const completed = steps.filter((step) => step.status === "completed");
  const lastCompleted = completed.at(-1);
  const completedCount = completed.length;

  if (!completedCount) {
    return `Working on: ${cleanText(goal, 120)}`;
  }

  const resultSummary = summarizeStepResult(lastCompleted?.result);
  const locationPart = currentUrl ? ` on ${cleanText(currentUrl, 80)}` : "";

  return resultSummary
    ? `Completed ${completedCount} steps${locationPart}. Latest result: ${resultSummary}`
    : `Completed ${completedCount} steps${locationPart}. Latest action: ${lastCompleted?.label ?? "in progress"}`;
}

export function buildFallbackAgentReport(
  goal: string,
  currentUrl: string | null,
  steps: SessionStepLike[],
): string {
  const completed = steps.filter((step) => step.status === "completed");
  const recent = completed.slice(-3).map((step) => {
    const resultSummary = summarizeStepResult(step.result);
    return resultSummary ? `${step.label}: ${resultSummary}` : step.label;
  });

  const lines = [
    `Goal: ${cleanText(goal, 180)}`,
    currentUrl
      ? `Current page: ${cleanText(currentUrl, 180)}`
      : "Current page: unavailable",
  ];

  if (recent.length > 0) {
    lines.push(`What I accomplished: ${recent.join(" | ")}`);
  } else {
    lines.push(
      "What I accomplished: I started the task but do not have enough confirmed progress to summarize confidently.",
    );
  }

  return lines.join("\n");
}
