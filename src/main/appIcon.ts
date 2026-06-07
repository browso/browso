import { fileURLToPath } from "node:url";

export const APP_ICON_PATH = fileURLToPath(
  new URL("../../resources/icon.png", import.meta.url),
);
