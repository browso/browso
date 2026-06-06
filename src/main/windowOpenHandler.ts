import { isAllowedExternalUrl } from "./navigationPolicy.ts";

type WindowOpenHandlerResult = { action: "deny" };

type WindowOpenDetails = {
  url: string;
};

type WindowOpenCapableWebContents = {
  setWindowOpenHandler: (
    handler: (details: WindowOpenDetails) => WindowOpenHandlerResult,
  ) => void;
};

export function attachExternalWindowOpenHandler(
  webContents: WindowOpenCapableWebContents,
  openExternal: (url: string) => void | Promise<void>,
): void {
  webContents.setWindowOpenHandler((details) => {
    if (isAllowedExternalUrl(details.url)) {
      void openExternal(details.url);
    }
    return { action: "deny" };
  });
}
