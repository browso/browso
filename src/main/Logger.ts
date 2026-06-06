import { app } from "electron";
import { appendFileSync, mkdirSync } from "fs";
import { join } from "path";

type LogLevel = "INFO" | "WARN" | "ERROR";

type LogMetadata = Record<string, unknown>;

class Logger {
  private logFilePath: string | null = null;

  info(message: string, metadata?: LogMetadata): void {
    this.write("INFO", message, metadata);
  }

  warn(message: string, metadata?: LogMetadata): void {
    this.write("WARN", message, metadata);
  }

  error(message: string, error?: unknown, metadata?: LogMetadata): void {
    this.write("ERROR", message, {
      ...metadata,
      ...(error ? { error: this.serializeError(error) } : {}),
    });
  }

  private write(
    level: LogLevel,
    message: string,
    metadata?: LogMetadata,
  ): void {
    try {
      const line = this.formatLine(level, message, metadata);
      appendFileSync(this.getLogFilePath(), line, "utf8");
    } catch (error) {
      console.error("Failed to write log file:", error);
    }
  }

  private formatLine(
    level: LogLevel,
    message: string,
    metadata?: LogMetadata,
  ): string {
    const timestamp = new Date().toISOString();
    const details =
      metadata && Object.keys(metadata).length > 0
        ? ` ${JSON.stringify(metadata)}`
        : "";

    return `[${timestamp}] [${level}] ${message}${details}\n`;
  }

  private getLogFilePath(): string {
    if (this.logFilePath) {
      return this.logFilePath;
    }

    const logsDir = join(app.getPath("userData"), "logs");
    mkdirSync(logsDir, { recursive: true });
    this.logFilePath = join(logsDir, "browso.log");
    return this.logFilePath;
  }

  private serializeError(error: unknown): Record<string, unknown> {
    if (error instanceof Error) {
      return {
        name: error.name,
        message: error.message,
        stack: error.stack,
      };
    }

    return {
      value: String(error),
    };
  }
}

export const logger = new Logger();
