import { app, BrowserWindow } from "electron";
import { electronApp as browsoApp } from "@electron-toolkit/utils";
import { Window } from "./Window";
import { AppMenu } from "./Menu";
import { EventManager } from "./EventManager";
import { logger } from "./Logger";
import { UpdateManager } from "./UpdateManager";

let mainWindow: Window | null = null;
let eventManager: EventManager | null = null;
let menu: AppMenu | null = null;
const updateManager = UpdateManager.getInstance();

const createWindow = (): Window => {
  const window = new Window();
  menu = new AppMenu(window);
  logger.info("Created main window");
  return window;
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
  logger.info("App ready");
  eventManager = new EventManager(() => mainWindow);

  mainWindow = createWindow();
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
