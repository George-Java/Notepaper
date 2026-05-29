"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const electronAPI = {
  invoke: (command, args) => electron_1.ipcRenderer.invoke(command, args),
  listen: (event, callback) => {
    const handler = (_event, ...args) => callback(...args);
    electron_1.ipcRenderer.on(event, handler);
    return () => {
      electron_1.ipcRenderer.removeListener(event, handler);
    };
  },
  window: {
    getCurrentLabel: () => electron_1.ipcRenderer.invoke("window:get-current-label"),
    show: () => electron_1.ipcRenderer.invoke("window:show"),
    hide: () => electron_1.ipcRenderer.invoke("window:hide"),
    close: () => electron_1.ipcRenderer.invoke("window:close"),
    minimize: () => electron_1.ipcRenderer.invoke("window:minimize"),
    toggleMaximize: () => electron_1.ipcRenderer.invoke("window:toggle-maximize"),
    isMaximized: () => electron_1.ipcRenderer.invoke("window:is-maximized"),
    setAlwaysOnTop: (enabled) =>
      electron_1.ipcRenderer.invoke("window:set-always-on-top", { enabled }),
    startDrag: () => electron_1.ipcRenderer.invoke("window:start-drag"),
    startResize: (direction) => electron_1.ipcRenderer.invoke("window:start-resize", { direction }),
    getBounds: () => electron_1.ipcRenderer.invoke("window:get-bounds"),
    setBounds: (bounds) => electron_1.ipcRenderer.invoke("window:set-bounds", bounds),
  },
  dialog: {
    open: (options) => electron_1.ipcRenderer.invoke("dialog:open", options),
    save: (options) => electron_1.ipcRenderer.invoke("dialog:save", options),
  },
  shell: {
    openExternal: (url) => electron_1.ipcRenderer.invoke("shell:open-external", { url }),
  },
};
electron_1.contextBridge.exposeInMainWorld("electronAPI", electronAPI);
//# sourceMappingURL=preload.js.map
