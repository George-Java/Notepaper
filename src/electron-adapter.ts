export type UnlistenFn = () => void;

declare global {
  interface Window {
    electronAPI?: {
      invoke: (command: string, args?: Record<string, unknown>) => Promise<unknown>;
      listen: (event: string, handler: (...args: unknown[]) => void) => () => void;
      window: Record<string, (...args: unknown[]) => Promise<unknown>>;
      dialog: {
        open: (o: Record<string, unknown>) => Promise<string | null>;
        save: (o: Record<string, unknown>) => Promise<string | null>;
      };
      shell: {
        openExternal: (url: string) => void;
      };
    };
  }
}

const api = typeof window !== "undefined" ? window.electronAPI : undefined;

export function invoke<T = unknown>(command: string, args?: Record<string, unknown>): Promise<T> {
  if (api) {
    return api.invoke(command, args) as Promise<T>;
  }
  return Promise.reject(new Error("electronAPI not available"));
}

export function listen<T = unknown>(
  event: string,
  handler: (event: { payload: T }) => void,
): Promise<UnlistenFn> {
  if (api) {
    const unlisten = api.listen(event, (payload: unknown) => {
      handler({ payload: payload as T });
    });
    return Promise.resolve(unlisten);
  }
  return Promise.resolve(() => {});
}

export function emit(event: string, payload?: unknown): Promise<void> {
  if (api) {
    return api.invoke("__emit", { event, payload }) as Promise<void>;
  }
  return Promise.resolve();
}

export function openUrl(url: string): void {
  if (api) {
    api.shell.openExternal(url);
  } else {
    window.open(url, "_blank");
  }
}

export function convertFileSrc(filePath: string): string {
  return `file://${filePath}`;
}

export const windowAPI = {
  getCurrentLabel: () =>
    (api?.window.getCurrentLabel() ?? Promise.resolve(null)) as Promise<string | null>,

  show: () => (api?.window.show() ?? Promise.resolve()) as Promise<void>,
  hide: () => (api?.window.hide() ?? Promise.resolve()) as Promise<void>,
  close: () => (api?.window.close() ?? Promise.resolve()) as Promise<void>,
  minimize: () => (api?.window.minimize() ?? Promise.resolve()) as Promise<void>,
  toggleMaximize: () => (api?.window.toggleMaximize() ?? Promise.resolve()) as Promise<void>,
  isMaximized: () => (api?.window.isMaximized() ?? Promise.resolve(false)) as Promise<boolean>,
  setAlwaysOnTop: (enabled: boolean) =>
    (api?.window.setAlwaysOnTop(enabled) ?? Promise.resolve()) as Promise<void>,
  startDrag: () => (api?.window.startDrag() ?? Promise.resolve()) as Promise<void>,
  startResize: (direction: string) =>
    (api?.window.startResize(direction) ?? Promise.resolve()) as Promise<void>,
  getBounds: () =>
    (api?.window.getBounds() as Promise<{
      x: number;
      y: number;
      width: number;
      height: number;
    } | null>) ?? Promise.resolve(null),
  setBounds: (bounds: { x: number; y: number; width: number; height: number }) =>
    (api?.window.setBounds(bounds) ?? Promise.resolve()) as Promise<void>,
};

export function openDialog(options: {
  multiple?: boolean;
  directory?: boolean;
  filters?: { name: string; extensions: string[] }[];
  defaultPath?: string;
}): Promise<string | string[] | null> {
  if (api) {
    return api.dialog.open(options);
  }
  return Promise.resolve(null);
}

export function saveDialog(options: {
  defaultPath?: string;
  filters?: { name: string; extensions: string[] }[];
}): Promise<string | null> {
  if (api) {
    return api.dialog.save(options);
  }
  return Promise.resolve(null);
}
