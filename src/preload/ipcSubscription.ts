type IpcRendererLike = {
  on: (channel: string, listener: (...args: unknown[]) => void) => void;
  removeListener: (
    channel: string,
    listener: (...args: unknown[]) => void,
  ) => void;
};

export function subscribeToIpcChannel<T>(
  ipcRenderer: IpcRendererLike,
  channel: string,
  callback: (payload: T) => void,
): () => void {
  const listener = (...args: unknown[]) => {
    callback(args[1] as T);
  };

  ipcRenderer.on(channel, listener);

  return () => {
    ipcRenderer.removeListener(channel, listener);
  };
}
