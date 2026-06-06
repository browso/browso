import test from "node:test";
import assert from "node:assert/strict";
import { subscribeToIpcChannel } from "../src/preload/ipcSubscription.ts";

test("subscribeToIpcChannel unsubscribes only its own listener", () => {
  const listeners = new Map<string, Set<(...args: unknown[]) => void>>();

  const ipcRenderer = {
    on(channel: string, listener: (...args: unknown[]) => void) {
      const channelListeners = listeners.get(channel) ?? new Set();
      channelListeners.add(listener);
      listeners.set(channel, channelListeners);
    },
    removeListener(channel: string, listener: (...args: unknown[]) => void) {
      listeners.get(channel)?.delete(listener);
    },
  };

  const received: string[] = [];
  const unsubscribeA = subscribeToIpcChannel<string>(
    ipcRenderer,
    "app-settings-updated",
    (payload) => received.push(`a:${payload}`),
  );
  subscribeToIpcChannel<string>(
    ipcRenderer,
    "app-settings-updated",
    (payload) => received.push(`b:${payload}`),
  );

  for (const listener of listeners.get("app-settings-updated") ?? []) {
    listener({}, "first");
  }
  unsubscribeA();
  for (const listener of listeners.get("app-settings-updated") ?? []) {
    listener({}, "second");
  }

  assert.deepEqual(received, ["a:first", "b:first", "b:second"]);
});
