import { contextBridge, ipcRenderer } from "electron";

const electronAPI = {
  invoke: (command: string, args?: Record<string, unknown>) => ipcRenderer.invoke(command, args),

  listen: (event: string, callback: (...args: unknown[]) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, ...args: unknown[]) => callback(...args);
    ipcRenderer.on(event, handler);
    return () => {
      ipcRenderer.removeListener(event, handler);
    };
  },

  window: {
    getCurrentLabel: () => ipcRenderer.invoke("window:get-current-label"),

    show: () => ipcRenderer.invoke("window:show"),
    hide: () => ipcRenderer.invoke("window:hide"),
    close: () => ipcRenderer.invoke("window:close"),
    minimize: () => ipcRenderer.invoke("window:minimize"),
    toggleMaximize: () => ipcRenderer.invoke("window:toggle-maximize"),
    isMaximized: () => ipcRenderer.invoke("window:is-maximized"),
    setAlwaysOnTop: (enabled: boolean) =>
      ipcRenderer.invoke("window:set-always-on-top", { enabled }),
    startDrag: () => ipcRenderer.invoke("window:start-drag"),
    startResize: (direction: string) => ipcRenderer.invoke("window:start-resize", { direction }),
    getBounds: () => ipcRenderer.invoke("window:get-bounds"),
    setBounds: (bounds: { x: number; y: number; width: number; height: number }) =>
      ipcRenderer.invoke("window:set-bounds", bounds),
  },

  dialog: {
    open: (options: Record<string, unknown>) => ipcRenderer.invoke("dialog:open", options),
    save: (options: Record<string, unknown>) => ipcRenderer.invoke("dialog:save", options),
  },

  shell: {
    openExternal: (url: string) => ipcRenderer.invoke("shell:open-external", { url }),
  },
};

contextBridge.exposeInMainWorld("electronAPI", electronAPI);
