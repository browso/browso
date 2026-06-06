import { WebContents } from "electron";
import { promises as fs } from "fs";
import { tmpdir } from "os";
import { join, basename, extname } from "path";
import { spawn, type ChildProcess } from "child_process";
import type { Tab } from "./Tab";

type SandboxRunStatus = "idle" | "running" | "completed" | "failed";

interface SandboxFile {
  id: string;
  name: string;
  content: string;
  isScoped: boolean;
  createdAt: number;
}

interface SandboxRunLine {
  id: string;
  stream: "stdout" | "stderr" | "system" | "event";
  text: string;
}

interface SandboxNotification {
  id: string;
  message: string;
  createdAt: number;
}

interface SandboxRun {
  id: string;
  entryFileId: string | null;
  scopedFileIds: string[];
  status: SandboxRunStatus;
  startedAt: number;
  finishedAt: number | null;
  lines: SandboxRunLine[];
  notifications: SandboxNotification[];
}

interface SandboxState {
  files: SandboxFile[];
  activeFileId: string | null;
  entryFileId: string | null;
  runs: SandboxRun[];
  isRunning: boolean;
}

interface SandboxFileInput {
  name: string;
  content?: string;
}

interface SandboxRunRequest {
  entryFileId?: string | null;
}

const RUNTIME_EVENT_PREFIX = "__BROWSO_EVENT__";

const DEFAULT_SANDBOX_FILE = `import { notifyUser, currentPage, listScopedFiles } from "browso";

const page = await currentPage();
notifyUser(\`Running inside Browso on \${page.url ?? "unknown page"}\`);

console.log("Scoped files:", await listScopedFiles());
console.log("Page title:", page.title);
console.log("Page text preview:", page.text.slice(0, 200));
`;

const BROWSO_PACKAGE = `import { promises as fs } from "fs";
import { join, basename } from "path";

const eventPrefix = ${JSON.stringify(RUNTIME_EVENT_PREFIX)};
const scopedFiles = JSON.parse(process.env.BROWSO_SCOPED_FILES || "[]");
const pageState = JSON.parse(process.env.BROWSO_PAGE_STATE || "{}");
const workspace = process.cwd();

function emit(type, payload) {
  process.stdout.write(\`\${eventPrefix}\${JSON.stringify({ type, payload })}\\n\`);
}

function ensureScoped(name) {
  const fileName = basename(name);
  if (!scopedFiles.includes(fileName)) {
    throw new Error(\`File \${fileName} is outside the current runner scope.\`);
  }
  return fileName;
}

export async function notifyUser(message) {
  emit("notify_user", { message: String(message) });
}

export async function useMcp(name, input = {}) {
  emit("use_mcp", {
    name,
    input,
    status: "unavailable",
    message: "No MCP bridge is configured inside the local runner yet."
  });
  return {
    ok: false,
    name,
    input,
    message: "No MCP bridge is configured inside the local runner yet."
  };
}

export async function listScopedFiles() {
  return scopedFiles;
}

export async function readScopedFile(name) {
  const fileName = ensureScoped(name);
  return fs.readFile(join(workspace, fileName), "utf8");
}

export async function writeScopedFile(name, content) {
  const fileName = ensureScoped(name);
  await fs.writeFile(join(workspace, fileName), String(content), "utf8");
  emit("write_file", { name: fileName });
}

export async function currentPage() {
  return pageState;
}`;

export class SandboxManager {
  private readonly webContents: WebContents;
  private readonly getActiveTab: () => Tab | null;
  private readonly state: SandboxState;
  private fileCounter = 0;
  private runCounter = 0;
  private activeProcess: ChildProcess | null = null;

  constructor(webContents: WebContents, getActiveTab: () => Tab | null) {
    this.webContents = webContents;
    this.getActiveTab = getActiveTab;

    const firstFile = this.createInitialFile();
    this.state = {
      files: [firstFile],
      activeFileId: firstFile.id,
      entryFileId: firstFile.id,
      runs: [],
      isRunning: false,
    };
  }

  getState(): SandboxState {
    return this.state;
  }

  createFile(input: SandboxFileInput): SandboxState {
    const file = this.createFileRecord(input.name, input.content ?? "");
    this.assertUniqueFileName(file.name);
    this.state.files.unshift(file);
    this.state.activeFileId = file.id;
    if (!this.state.entryFileId) {
      this.state.entryFileId = file.id;
    }
    this.emitState();
    return this.state;
  }

  updateFile(
    fileId: string,
    patch: Partial<Pick<SandboxFile, "name" | "content" | "isScoped">>,
  ): SandboxState {
    const file = this.state.files.find((candidate) => candidate.id === fileId);
    if (!file) {
      return this.state;
    }

    if (patch.name !== undefined) {
      const nextName = this.sanitizeFileName(patch.name);
      this.assertUniqueFileName(nextName, file.id);
      file.name = nextName;
    }
    if (patch.content !== undefined) {
      file.content = patch.content;
    }
    if (patch.isScoped !== undefined) {
      file.isScoped = patch.isScoped;
    }

    if (
      this.state.entryFileId === file.id &&
      !this.state.files.find((candidate) => candidate.id === file.id)?.isScoped
    ) {
      this.state.entryFileId = this.getFirstScopedFileId();
    }

    this.emitState();
    return this.state;
  }

  deleteFile(fileId: string): SandboxState {
    this.state.files = this.state.files.filter((file) => file.id !== fileId);

    if (this.state.activeFileId === fileId) {
      this.state.activeFileId = this.state.files[0]?.id ?? null;
    }
    if (this.state.entryFileId === fileId) {
      this.state.entryFileId = this.getFirstScopedFileId();
    }

    this.emitState();
    return this.state;
  }

  setActiveFile(fileId: string): SandboxState {
    this.state.activeFileId = fileId;
    this.emitState();
    return this.state;
  }

  setEntryFile(fileId: string): SandboxState {
    const file = this.state.files.find((candidate) => candidate.id === fileId);
    if (file && file.isScoped) {
      this.state.entryFileId = fileId;
      this.emitState();
    }
    return this.state;
  }

  async run(request: SandboxRunRequest = {}): Promise<SandboxState> {
    if (this.state.isRunning) {
      return this.state;
    }

    const scopedFiles = this.state.files.filter((file) => file.isScoped);
    const entryFileId =
      request.entryFileId ??
      this.state.entryFileId ??
      scopedFiles[0]?.id ??
      null;

    const entryFile = scopedFiles.find((file) => file.id === entryFileId);
    if (!entryFile) {
      const run = this.createRun(
        entryFileId,
        scopedFiles.map((file) => file.id),
      );
      run.status = "failed";
      run.finishedAt = Date.now();
      run.lines.push(
        this.makeLine("system", "Pick a scoped entry file before running."),
      );
      this.state.runs.unshift(run);
      this.emitState();
      return this.state;
    }

    const run = this.createRun(
      entryFile.id,
      scopedFiles.map((file) => file.id),
    );
    this.state.runs.unshift(run);
    this.state.isRunning = true;
    this.emitState();

    const workspaceDir = join(
      tmpdir(),
      `browso-sandbox-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    );

    try {
      await this.materializeWorkspace(workspaceDir, scopedFiles);
      await this.executeWorkspace(
        run,
        workspaceDir,
        entryFile.name,
        scopedFiles,
      );
    } catch (error) {
      run.status = "failed";
      run.finishedAt = Date.now();
      run.lines.push(this.makeLine("stderr", this.toErrorMessage(error)));
    } finally {
      this.state.isRunning = false;
      this.activeProcess = null;
      this.emitState();
      await fs.rm(workspaceDir, { recursive: true, force: true });
    }

    return this.state;
  }

  private createInitialFile(): SandboxFile {
    return this.createFileRecord("analysis.mjs", DEFAULT_SANDBOX_FILE);
  }

  private createFileRecord(name: string, content: string): SandboxFile {
    return {
      id: `sandbox-file-${++this.fileCounter}`,
      name: this.sanitizeFileName(name || `snippet-${this.fileCounter}.mjs`),
      content,
      isScoped: true,
      createdAt: Date.now(),
    };
  }

  private createRun(
    entryFileId: string | null,
    scopedFileIds: string[],
  ): SandboxRun {
    return {
      id: `sandbox-run-${++this.runCounter}`,
      entryFileId,
      scopedFileIds,
      status: "running",
      startedAt: Date.now(),
      finishedAt: null,
      lines: [this.makeLine("system", "Preparing local runner workspace...")],
      notifications: [],
    };
  }

  private makeLine(
    stream: SandboxRunLine["stream"],
    text: string,
  ): SandboxRunLine {
    return {
      id: `${stream}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      stream,
      text,
    };
  }

  private sanitizeFileName(name: string): string {
    const trimmed = basename(name.trim() || "analysis.mjs");
    const extension = extname(trimmed);
    if (extension) {
      return trimmed;
    }
    return `${trimmed}.mjs`;
  }

  private getFirstScopedFileId(): string | null {
    return this.state.files.find((file) => file.isScoped)?.id ?? null;
  }

  private assertUniqueFileName(name: string, exceptId?: string): void {
    if (
      this.state.files.some(
        (file) => file.id !== exceptId && file.name === name,
      )
    ) {
      throw new Error(`A local runner file named ${name} already exists.`);
    }
  }

  private async materializeWorkspace(
    workspaceDir: string,
    files: SandboxFile[],
  ): Promise<void> {
    await fs.mkdir(workspaceDir, { recursive: true });
    await fs.mkdir(join(workspaceDir, "node_modules", "browso"), {
      recursive: true,
    });
    await fs.writeFile(
      join(workspaceDir, "node_modules", "browso", "package.json"),
      JSON.stringify(
        {
          name: "browso",
          type: "module",
          exports: "./index.mjs",
        },
        null,
        2,
      ),
      "utf8",
    );
    await fs.writeFile(
      join(workspaceDir, "node_modules", "browso", "index.mjs"),
      BROWSO_PACKAGE,
      "utf8",
    );

    await Promise.all(
      files.map((file) =>
        fs.writeFile(join(workspaceDir, file.name), file.content, "utf8"),
      ),
    );
  }

  private async executeWorkspace(
    run: SandboxRun,
    workspaceDir: string,
    entryFileName: string,
    scopedFiles: SandboxFile[],
  ): Promise<void> {
    const pageState = await this.getCurrentPageState();
    run.lines.push(this.makeLine("system", `Running ${entryFileName}`));
    this.emitState();

    const child = spawn(process.execPath, [join(workspaceDir, entryFileName)], {
      cwd: workspaceDir,
      env: {
        ELECTRON_RUN_AS_NODE: "1",
        BROWSO_SCOPED_FILES: JSON.stringify(
          scopedFiles.map((file) => file.name),
        ),
        BROWSO_PAGE_STATE: JSON.stringify(pageState),
      },
      stdio: ["ignore", "pipe", "pipe"],
    });

    this.activeProcess = child;

    let stdoutBuffer = "";
    let stderrBuffer = "";

    child.stdout.on("data", (chunk) => {
      stdoutBuffer += chunk.toString();
      stdoutBuffer = this.consumeBufferedLines(stdoutBuffer, run, "stdout");
    });

    child.stderr.on("data", (chunk) => {
      stderrBuffer += chunk.toString();
      stderrBuffer = this.consumeBufferedLines(stderrBuffer, run, "stderr");
    });

    const timeout = setTimeout(() => {
      if (this.activeProcess === child) {
        run.lines.push(
          this.makeLine("stderr", "Execution timed out after 20 seconds."),
        );
        child.kill("SIGKILL");
      }
    }, 20_000);

    await new Promise<void>((resolve) => {
      child.on("close", (code) => {
        clearTimeout(timeout);
        if (stdoutBuffer.trim()) {
          this.handleOutputLine(run, "stdout", stdoutBuffer.trim());
        }
        if (stderrBuffer.trim()) {
          this.handleOutputLine(run, "stderr", stderrBuffer.trim());
        }

        run.finishedAt = Date.now();
        run.status = code === 0 ? "completed" : "failed";
        run.lines.push(
          this.makeLine(
            "system",
            code === 0
              ? "Execution completed."
              : `Process exited with code ${code}.`,
          ),
        );
        this.emitState();
        resolve();
      });
    });
  }

  private consumeBufferedLines(
    buffer: string,
    run: SandboxRun,
    stream: "stdout" | "stderr",
  ): string {
    const lines = buffer.split(/\r?\n/);
    const remainder = lines.pop() ?? "";

    for (const line of lines) {
      this.handleOutputLine(run, stream, line);
    }

    return remainder;
  }

  private handleOutputLine(
    run: SandboxRun,
    stream: "stdout" | "stderr",
    line: string,
  ): void {
    if (!line) {
      return;
    }

    if (line.startsWith(RUNTIME_EVENT_PREFIX)) {
      const payload = line.slice(RUNTIME_EVENT_PREFIX.length);
      try {
        const parsed = JSON.parse(payload) as {
          type: string;
          payload?: Record<string, unknown>;
        };
        const message =
          parsed.type === "notify_user"
            ? String(parsed.payload?.message ?? "Notification")
            : `${parsed.type}: ${JSON.stringify(parsed.payload ?? {})}`;
        run.notifications.unshift({
          id: `notification-${Date.now()}-${Math.random().toString(16).slice(2)}`,
          message,
          createdAt: Date.now(),
        });
        run.lines.push(this.makeLine("event", message));
      } catch {
        run.lines.push(this.makeLine(stream, line));
      }
    } else {
      run.lines.push(this.makeLine(stream, line));
    }

    this.emitState();
  }

  private async getCurrentPageState(): Promise<{
    url: string | null;
    title: string | null;
    text: string;
  }> {
    const tab = this.getActiveTab();
    if (!tab) {
      return {
        url: null,
        title: null,
        text: "",
      };
    }

    try {
      return {
        url: tab.url,
        title: tab.title,
        text: (await tab.getTabText()).slice(0, 4000),
      };
    } catch {
      return {
        url: tab.url,
        title: tab.title,
        text: "",
      };
    }
  }

  private toErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    return "Unknown local runner error";
  }

  private emitState(): void {
    this.webContents.send("sandbox-state", this.state);
  }
}
