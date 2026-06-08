import { app, BrowserWindow } from "electron";
import { electronApp as browsoApp } from "@electron-toolkit/utils";
import { Window } from "./Window";
import { AppMenu } from "./Menu";
import { EventManager } from "./EventManager";
import { logger } from "./Logger";
import { UpdateManager } from "./UpdateManager";
import { APP_ICON_PATH } from "./appIcon";

const STARTUP_SMOKE_TEST = process.argv.includes("--smoke-test");
const STARTUP_SMOKE_TIMEOUT_MS = 20_000;

let mainWindow: Window | null = null;
let eventManager: EventManager | null = null;
let menu: AppMenu | null = null;
const updateManager = UpdateManager.getInstance();

const createWindow = (options: { show?: boolean } = {}): Window => {
  const window = new Window(options);
  menu = new AppMenu(window);
  logger.info("Created main window");
  return window;
};

const waitForSidebarLoad = async (window: Window): Promise<void> => {
  let timeout: NodeJS.Timeout | undefined;
  const timeoutPromise = new Promise<never>((_resolve, reject) => {
    timeout = setTimeout(() => {
      reject(new Error("Sidebar renderer did not load before the timeout."));
    }, STARTUP_SMOKE_TIMEOUT_MS);
  });

  try {
    await Promise.race([window.sidebar.waitUntilLoaded(), timeoutPromise]);
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
};

const runStartupSmokeTest = async (window: Window): Promise<void> => {
  await waitForSidebarLoad(window);

  const result = await window.sidebar.view.webContents.executeJavaScript(`
    (async () => {
      const waitFor = async (predicate, timeoutMs = ${STARTUP_SMOKE_TIMEOUT_MS}) => {
        const startedAt = Date.now();
        while (Date.now() - startedAt < timeoutMs) {
          const value = predicate();
          if (value) return value;
          await new Promise((resolve) => setTimeout(resolve, 50));
        }
        throw new Error("Timed out waiting for the first-run chat response.");
      };

      const textarea = await waitFor(() =>
        document.querySelector('textarea[aria-label="Ask Browso"]')
      );
      const valueSetter = Object.getOwnPropertyDescriptor(
        HTMLTextAreaElement.prototype,
        "value"
      )?.set;
      valueSetter?.call(textarea, "/help");
      textarea.dispatchEvent(new Event("input", { bubbles: true }));

      const sendButton = await waitFor(() =>
        document.querySelector('button[aria-label="Send question"]:not([disabled])')
      );
      sendButton.click();

      await waitFor(() =>
        Array.from(document.querySelectorAll("p")).some((element) =>
          element.textContent?.includes("Available local commands:")
        )
      );

      return {
        question: "/help",
        hasUserMessage: Array.from(document.querySelectorAll("p")).some(
          (element) => element.textContent === "/help"
        ),
        hasAssistantResponse: Array.from(document.querySelectorAll("p")).some(
          (element) => element.textContent?.includes("Available local commands:")
        ),
      };
    })()
  `);

  if (
    result?.question !== "/help" ||
    result?.hasUserMessage !== true ||
    result?.hasAssistantResponse !== true
  ) {
    throw new Error(
      `First-run chat acceptance failed: ${JSON.stringify(result)}`,
    );
  }

  logger.info("Packaged startup smoke test passed", result);
  console.log("Packaged startup smoke test passed", result);
};

const registerProcessLogging = (): void => {
  process.on("uncaughtException", (error) => {
    logger.error("Uncaught exception", error);
  });

  process.on("unhandledRejection", (reason) => {
    logger.error("Unhandled promise rejection", reason);
  });
};

registerProcessLogging();

app.whenReady().then(() => {
  browsoApp.setAppUserModelId("com.browso.browser");
  if (process.platform === "darwin" && app.dock) {
    app.dock.setIcon(APP_ICON_PATH);
  }
  logger.info("App ready");
  eventManager = new EventManager(() => mainWindow);

  // A WebContentsView in a hidden BaseWindow can remain suspended on macOS.
  mainWindow = createWindow({ show: true });

  if (STARTUP_SMOKE_TEST) {
    void runStartupSmokeTest(mainWindow)
      .then(() => app.exit(0))
      .catch((error) => {
        logger.error("Packaged startup smoke test failed", error);
        console.error("Packaged startup smoke test failed", error);
        app.exit(1);
      });
    return;
  }

  void updateManager.checkForUpdates({ mainWindow, promptUser: true });

  app.on("activate", () => {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) {
      logger.info("App activated with no open windows");
      mainWindow = createWindow();
      void updateManager.checkForUpdates({ mainWindow, promptUser: true });
    }
  });
});

app.on("window-all-closed", () => {
  logger.info("All windows closed");
  // Clean up references
  if (mainWindow) {
    mainWindow = null;
  }
  if (menu) {
    menu = null;
  }

  if (process.platform !== "darwin") {
    if (eventManager) {
      eventManager.cleanup();
      eventManager = null;
    }
    logger.info("Quitting app on non-macOS platform");
    app.quit();
  }
});
