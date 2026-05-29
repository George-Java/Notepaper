"use strict";
var __createBinding =
  (this && this.__createBinding) ||
  (Object.create
    ? function (o, m, k, k2) {
        if (k2 === undefined) k2 = k;
        var desc = Object.getOwnPropertyDescriptor(m, k);
        if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
          desc = {
            enumerable: true,
            get: function () {
              return m[k];
            },
          };
        }
        Object.defineProperty(o, k2, desc);
      }
    : function (o, m, k, k2) {
        if (k2 === undefined) k2 = k;
        o[k2] = m[k];
      });
var __setModuleDefault =
  (this && this.__setModuleDefault) ||
  (Object.create
    ? function (o, v) {
        Object.defineProperty(o, "default", { enumerable: true, value: v });
      }
    : function (o, v) {
        o["default"] = v;
      });
var __importStar =
  (this && this.__importStar) ||
  (function () {
    var ownKeys = function (o) {
      ownKeys =
        Object.getOwnPropertyNames ||
        function (o) {
          var ar = [];
          for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
          return ar;
        };
      return ownKeys(o);
    };
    return function (mod) {
      if (mod && mod.__esModule) return mod;
      var result = {};
      if (mod != null)
        for (var k = ownKeys(mod), i = 0; i < k.length; i++)
          if (k[i] !== "default") __createBinding(result, mod, k[i]);
      __setModuleDefault(result, mod);
      return result;
    };
  })();
Object.defineProperty(exports, "__esModule", { value: true });
exports.setStartFile = setStartFile;
exports.takeStartFile = takeStartFile;
exports.markExiting = markExiting;
exports.isAppExiting = isAppExiting;
exports.getDefaultWindowSize = getDefaultWindowSize;
exports.getSavedSurfaceSpecs = getSavedSurfaceSpecs;
exports.recycleNotepadWindow = recycleNotepadWindow;
exports.showMainWindow = showMainWindow;
exports.hideWindowsWithLabel = hideWindowsWithLabel;
exports.toggleAppVisibility = toggleAppVisibility;
exports.closeHiddenWindows = closeHiddenWindows;
exports.openNotepadWindow = openNotepadWindow;
exports.getMainWindow = getMainWindow;
exports.prewarmPool = prewarmPool;
exports.getCursorCenteredBounds = getCursorCenteredBounds;
exports.refreshWindowTitles = refreshWindowTitles;
const electron_1 = require("electron");
const path = __importStar(require("node:path"));
const node_crypto_1 = require("node:crypto");
const notes_store_1 = require("./notes-store");
const locales_1 = require("./locales");
const MAIN_WINDOW_KEY = "main";
const NOTEPAD_POOL_CAPACITY = 2;
let hiddenWindowLabels = [];
let isExiting = false;
let notepadPool = [];
let startFile = null;
function setStartFile(filePath) {
  startFile = filePath;
}
function takeStartFile() {
  const file = startFile;
  startFile = null;
  return file;
}
function markExiting() {
  isExiting = true;
}
function isAppExiting() {
  return isExiting;
}
function getCurrentLocale() {
  try {
    return (0, locales_1.resolveLocale)(notes_store_1.NoteStore.defaultStore().loadConfig().locale);
  } catch {
    return (0, locales_1.resolveLocale)("zh-CN");
  }
}
function getIconPath() {
  const iconMap = {
    win32: path.join(__dirname, "..", "build", "icon.ico"),
    darwin: path.join(__dirname, "..", "build", "icon.icns"),
    linux: path.join(__dirname, "..", "build", "icon.png"),
  };
  return iconMap[process.platform] ?? iconMap.linux;
}
function getPageUrl(view, noteId) {
  const params = new URLSearchParams();
  if (view) params.set("view", view);
  if (noteId) params.set("noteId", noteId);
  const query = params.toString();
  if (process.env.ELECTRON_DEV) {
    return `http://localhost:1420/${query ? `?${query}` : ""}`;
  }
  return query ? `app://index.html?${query}` : `app://index.html`;
}
function sanitizeLabelPart(value) {
  return value.replace(/[^a-zA-Z0-9\-_]/g, "-").replace(/^-+|-+$/g, "");
}
function notepadWindowLabel(noteId) {
  return noteId
    ? `notepad-${sanitizeLabelPart(noteId)}`
    : `notepad-${(0, node_crypto_1.randomUUID)()}`;
}
function getDefaultWindowSize() {
  return { width: 260, height: 260, minWidth: 220, minHeight: 220 };
}
function getSavedSurfaceSpecs() {
  const defaults = getDefaultWindowSize();
  try {
    const config = notes_store_1.NoteStore.defaultStore().loadConfig();
    if (!config.rememberSurfaceSize) return defaults;
    const visible = getVisibleSurfaceSize();
    if (visible) {
      return {
        width: Math.max(visible.width, defaults.minWidth),
        height: Math.max(visible.height, defaults.minHeight),
        minWidth: defaults.minWidth,
        minHeight: defaults.minHeight,
      };
    }
    if (config.surfaceWidth && config.surfaceHeight) {
      return {
        width: Math.max(config.surfaceWidth, defaults.minWidth),
        height: Math.max(config.surfaceHeight, defaults.minHeight),
        minWidth: defaults.minWidth,
        minHeight: defaults.minHeight,
      };
    }
  } catch {
    /* ignore */
  }
  return defaults;
}
function getVisibleSurfaceSize() {
  let fallback = null;
  for (const win of electron_1.BrowserWindow.getAllWindows()) {
    const label = win;
    if (!label.label?.startsWith("notepad-") && !label.label?.startsWith("tile-")) continue;
    if (!win.isVisible()) continue;
    const bounds = win.getContentBounds();
    if (bounds.width <= 0 || bounds.height <= 0) continue;
    if (win.isFocused()) return { width: bounds.width, height: bounds.height };
    if (!fallback) fallback = { width: bounds.width, height: bounds.height };
  }
  return fallback;
}
function recycleNotepadWindow(label) {
  const win = findWindowByLabel(label);
  if (!win) return;
  saveSurfaceSize(win);
  if (notepadPool.length < NOTEPAD_POOL_CAPACITY) {
    win.hide();
    notepadPool.push(label);
  } else {
    win.close();
  }
}
function activatePooledNotepad(bounds) {
  if (notepadPool.length === 0) return undefined;
  const label = notepadPool.pop();
  const win = findWindowByLabel(label);
  if (!win) {
    prewarmNotepadPool();
    return undefined;
  }
  const locale = getCurrentLocale();
  const specs = getSavedSurfaceSpecs();
  win.setTitle((0, locales_1.notepadWindowTitle)(locale));
  win.setContentSize(specs.width, specs.height);
  if (bounds) {
    win.setBounds(bounds);
  }
  win.show();
  win.focus();
  win.webContents.send("notepad:activate", label);
  schedulePrewarm(100);
  return label;
}
function schedulePrewarm(delay) {
  setTimeout(() => {
    if (notepadPool.length < NOTEPAD_POOL_CAPACITY) {
      prewarmNotepadPool();
    }
    if (notepadPool.length < NOTEPAD_POOL_CAPACITY) {
      schedulePrewarm(400);
    }
  }, delay);
}
function prewarmNotepadPool() {
  while (notepadPool.length < NOTEPAD_POOL_CAPACITY) {
    const label = notepadWindowLabel();
    const specs = getDefaultWindowSize();
    const locale = getCurrentLocale();
    const win = new electron_1.BrowserWindow({
      title: (0, locales_1.notepadWindowTitle)(locale),
      width: specs.width,
      height: specs.height,
      minWidth: specs.minWidth,
      minHeight: specs.minHeight,
      resizable: true,
      frame: false,
      backgroundColor: "#f6f3ec",
      alwaysOnTop: true,
      skipTaskbar: true,
      show: false,
      focusable: false,
      webPreferences: {
        preload: path.join(__dirname, "preload.js"),
        contextIsolation: true,
        nodeIntegration: false,
      },
    });
    win.label = label;
    win.loadURL(getPageUrl("notepad", undefined) + "&standby=1");
    win.on("closed", () => {
      notepadPool = notepadPool.filter((l) => l !== label);
    });
    notepadPool.push(label);
  }
}
function saveSurfaceSize(win) {
  try {
    const store = notes_store_1.NoteStore.defaultStore();
    const config = store.loadConfig();
    if (!config.rememberSurfaceSize) return;
    const size = win.getContentSize();
    const w = size[0];
    const h = size[1];
    if (w === 0 || h === 0) return;
    if (config.surfaceWidth === w && config.surfaceHeight === h) return;
    config.surfaceWidth = w;
    config.surfaceHeight = h;
    store.saveConfigRaw(config);
  } catch {
    /* ignore */
  }
}
function findWindowByLabel(label) {
  for (const win of electron_1.BrowserWindow.getAllWindows()) {
    const w = win;
    if (w.label === label) return w;
  }
  return null;
}
function showMainWindow(mainWindow) {
  hiddenWindowLabels = hiddenWindowLabels.filter((l) => l !== MAIN_WINDOW_KEY);
  if (mainWindow.isMinimized()) mainWindow.restore();
  if (!mainWindow.isVisible()) mainWindow.show();
  mainWindow.focus();
}
function hideWindowsWithLabel() {
  const labels = [];
  for (const win of electron_1.BrowserWindow.getAllWindows()) {
    const w = win;
    if (typeof w.label === "string" && win.isVisible()) {
      labels.push(w.label);
      win.hide();
    }
  }
  hiddenWindowLabels = labels;
}
function toggleAppVisibility(mainWindow) {
  if (hiddenWindowLabels.length > 0) {
    const labels = [...hiddenWindowLabels];
    hiddenWindowLabels = [];
    for (const label of labels) {
      const win = findWindowByLabel(label);
      if (win) {
        if (win.isMinimized()) win.restore();
        win.show();
        if (label === MAIN_WINDOW_KEY) win.focus();
      }
    }
  } else {
    const labels = [];
    for (const win of electron_1.BrowserWindow.getAllWindows()) {
      const w = win;
      if (typeof w.label === "string" && win.isVisible()) {
        labels.push(w.label);
        win.hide();
      }
    }
    hiddenWindowLabels = labels;
  }
}
function closeHiddenWindows() {
  for (const label of hiddenWindowLabels) {
    if (label.startsWith("notepad-") || label.startsWith("tile-")) {
      const win = findWindowByLabel(label);
      if (win) win.close();
    }
  }
  hiddenWindowLabels = [];
}
function openNotepadWindow(noteId, bounds) {
  if (!noteId) {
    const pooled = activatePooledNotepad(bounds);
    if (pooled) return pooled;
  }
  const locale = getCurrentLocale();
  const label = notepadWindowLabel(noteId);
  const specs = getSavedSurfaceSpecs();
  const existing = findWindowByLabel(label);
  if (existing) {
    existing.setTitle((0, locales_1.notepadWindowTitle)(locale));
    if (bounds) existing.setBounds(bounds);
    if (existing.isMinimized()) existing.restore();
    existing.show();
    existing.focus();
    return label;
  }
  const win = new electron_1.BrowserWindow({
    title: (0, locales_1.notepadWindowTitle)(locale),
    width: specs.width,
    height: specs.height,
    minWidth: specs.minWidth,
    minHeight: specs.minHeight,
    resizable: true,
    frame: false,
    backgroundColor: "#f6f3ec",
    alwaysOnTop: true,
    skipTaskbar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  win.label = label;
  const url = noteId ? getPageUrl("notepad", noteId) : getPageUrl("notepad");
  win.loadURL(url);
  if (bounds) win.setBounds(bounds);
  win.once("ready-to-show", () => {
    win.show();
    win.focus();
  });
  win.on("closed", () => {
    removeFromPool(label);
  });
  return label;
}
function removeFromPool(label) {
  notepadPool = notepadPool.filter((l) => l !== label);
}
function getMainWindow() {
  for (const win of electron_1.BrowserWindow.getAllWindows()) {
    const w = win;
    if (w.label === MAIN_WINDOW_KEY) return win;
  }
  return null;
}
function prewarmPool() {
  schedulePrewarm(800);
  schedulePrewarm(1200);
}
function getCursorCenteredBounds(width, height) {
  const point = electron_1.screen.getCursorScreenPoint();
  const display = electron_1.screen.getDisplayNearestPoint(point);
  const x = Math.round(point.x - width / 2);
  const y = Math.round(point.y - height / 2);
  const workArea = display.workArea;
  return {
    x: Math.max(workArea.x, Math.min(workArea.x + workArea.width - width, x)),
    y: Math.max(workArea.y, Math.min(workArea.y + workArea.height - height, y)),
    width,
    height,
  };
}
function refreshWindowTitles() {
  try {
    const locale = getCurrentLocale();
    for (const win of electron_1.BrowserWindow.getAllWindows()) {
      const w = win;
      const label = typeof w.label === "string" ? w.label : "";
      if (label === MAIN_WINDOW_KEY) {
        win.setTitle((0, locales_1.mainWindowTitle)(locale));
      } else if (label.startsWith("notepad-")) {
        win.setTitle((0, locales_1.notepadWindowTitle)(locale));
      }
    }
  } catch {
    /* ignore */
  }
}
//# sourceMappingURL=window-manager.js.map
