import { BrowserWindow, screen } from "electron";
import * as path from "node:path";
import { randomUUID } from "node:crypto";
import { NoteStore } from "./notes-store";
import { Locale, resolveLocale, mainWindowTitle, notepadWindowTitle } from "./locales";

const MAIN_WINDOW_KEY = "main";
const NOTEPAD_POOL_CAPACITY = 2;

let hiddenWindowLabels: string[] = [];
let isExiting = false;
let notepadPool: string[] = [];
let startFile: string | null = null;

export function setStartFile(filePath: string): void {
  startFile = filePath;
}

export function takeStartFile(): string | null {
  const file = startFile;
  startFile = null;
  return file;
}

export function markExiting(): void {
  isExiting = true;
}

export function isAppExiting(): boolean {
  return isExiting;
}

function getCurrentLocale(): Locale {
  try {
    return resolveLocale(NoteStore.defaultStore().loadConfig().locale);
  } catch {
    return resolveLocale("zh-CN");
  }
}

function getIconPath(): string {
  const iconMap: Record<string, string> = {
    win32: path.join(__dirname, "..", "src-tauri", "icons", "icon.ico"),
    darwin: path.join(__dirname, "..", "src-tauri", "icons", "icon.icns"),
    linux: path.join(__dirname, "..", "src-tauri", "icons", "icon.png"),
  };
  return iconMap[process.platform] ?? iconMap.linux;
}

function getPageUrl(view: string, noteId?: string): string {
  const params = new URLSearchParams();
  if (view) params.set("view", view);
  if (noteId) params.set("noteId", noteId);
  const query = params.toString();
  if (process.env.ELECTRON_DEV) {
    return `http://localhost:1420/${query ? `?${query}` : ""}`;
  }
  return query ? `app://index.html?${query}` : `app://index.html`;
}

function sanitizeLabelPart(value: string): string {
  return value.replace(/[^a-zA-Z0-9\-_]/g, "-").replace(/^-+|-+$/g, "");
}

function notepadWindowLabel(noteId?: string): string {
  return noteId ? `notepad-${sanitizeLabelPart(noteId)}` : `notepad-${randomUUID()}`;
}

export function getDefaultWindowSize(): {
  width: number;
  height: number;
  minWidth: number;
  minHeight: number;
} {
  return { width: 260, height: 260, minWidth: 220, minHeight: 220 };
}

export function getSavedSurfaceSpecs(): {
  width: number;
  height: number;
  minWidth: number;
  minHeight: number;
} {
  const defaults = getDefaultWindowSize();
  try {
    const config = NoteStore.defaultStore().loadConfig();
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

function getVisibleSurfaceSize(): { width: number; height: number } | null {
  let fallback: { width: number; height: number } | null = null;
  for (const win of BrowserWindow.getAllWindows()) {
    const label = win as BrowserWindow & { label?: string };
    if (!label.label?.startsWith("notepad-") && !label.label?.startsWith("tile-")) continue;
    if (!win.isVisible()) continue;
    const bounds = win.getContentBounds();
    if (bounds.width <= 0 || bounds.height <= 0) continue;
    if (win.isFocused()) return { width: bounds.width, height: bounds.height };
    if (!fallback) fallback = { width: bounds.width, height: bounds.height };
  }
  return fallback;
}

export function recycleNotepadWindow(label: string): void {
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

function activatePooledNotepad(bounds?: {
  x: number;
  y: number;
  width: number;
  height: number;
}): string | undefined {
  if (notepadPool.length === 0) return undefined;
  const label = notepadPool.pop()!;
  const win = findWindowByLabel(label);
  if (!win) {
    prewarmNotepadPool();
    return undefined;
  }

  const locale = getCurrentLocale();
  const specs = getSavedSurfaceSpecs();
  win.setTitle(notepadWindowTitle(locale));
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

function schedulePrewarm(delay: number): void {
  setTimeout(() => {
    if (notepadPool.length < NOTEPAD_POOL_CAPACITY) {
      prewarmNotepadPool();
    }
    if (notepadPool.length < NOTEPAD_POOL_CAPACITY) {
      schedulePrewarm(400);
    }
  }, delay);
}

function prewarmNotepadPool(): void {
  while (notepadPool.length < NOTEPAD_POOL_CAPACITY) {
    const label = notepadWindowLabel();
    const specs = getDefaultWindowSize();
    const locale = getCurrentLocale();
    const win = new BrowserWindow({
      title: notepadWindowTitle(locale),
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
    (win as unknown as Record<string, unknown>).label = label;
    win.loadURL(getPageUrl("notepad", undefined) + "&standby=1");
    win.on("closed", () => {
      notepadPool = notepadPool.filter((l) => l !== label);
    });
    notepadPool.push(label);
  }
}

function saveSurfaceSize(win: BrowserWindow): void {
  try {
    const store = NoteStore.defaultStore();
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

function findWindowByLabel(label: string): (BrowserWindow & { label?: string }) | null {
  for (const win of BrowserWindow.getAllWindows()) {
    const w = win as unknown as BrowserWindow & Record<string, unknown>;
    if (w.label === label) return w as BrowserWindow & { label?: string };
  }
  return null;
}

export function showMainWindow(mainWindow: BrowserWindow): void {
  hiddenWindowLabels = hiddenWindowLabels.filter((l) => l !== MAIN_WINDOW_KEY);

  if (mainWindow.isMinimized()) mainWindow.restore();
  if (!mainWindow.isVisible()) mainWindow.show();
  mainWindow.focus();
}

export function hideWindowsWithLabel(): void {
  const labels: string[] = [];
  for (const win of BrowserWindow.getAllWindows()) {
    const w = win as unknown as BrowserWindow & Record<string, unknown>;
    if (typeof w.label === "string" && win.isVisible()) {
      labels.push(w.label as string);
      win.hide();
    }
  }
  hiddenWindowLabels = labels;
}

export function toggleAppVisibility(mainWindow: BrowserWindow): void {
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
    const labels: string[] = [];
    for (const win of BrowserWindow.getAllWindows()) {
      const w = win as unknown as BrowserWindow & Record<string, unknown>;
      if (typeof w.label === "string" && win.isVisible()) {
        labels.push(w.label as string);
        win.hide();
      }
    }
    hiddenWindowLabels = labels;
  }
}

export function closeHiddenWindows(): void {
  for (const label of hiddenWindowLabels) {
    if (label.startsWith("notepad-") || label.startsWith("tile-")) {
      const win = findWindowByLabel(label);
      if (win) win.close();
    }
  }
  hiddenWindowLabels = [];
}

export function openNotepadWindow(
  noteId?: string,
  bounds?: { x: number; y: number; width: number; height: number },
): string {
  if (!noteId) {
    const pooled = activatePooledNotepad(bounds);
    if (pooled) return pooled;
  }

  const locale = getCurrentLocale();
  const label = notepadWindowLabel(noteId);
  const specs = getSavedSurfaceSpecs();

  const existing = findWindowByLabel(label);
  if (existing) {
    existing.setTitle(notepadWindowTitle(locale));
    if (bounds) existing.setBounds(bounds);
    if (existing.isMinimized()) existing.restore();
    existing.show();
    existing.focus();
    return label;
  }

  const win = new BrowserWindow({
    title: notepadWindowTitle(locale),
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
  (win as unknown as Record<string, unknown>).label = label;

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

function removeFromPool(label: string): void {
  notepadPool = notepadPool.filter((l) => l !== label);
}

export function getMainWindow(): BrowserWindow | null {
  for (const win of BrowserWindow.getAllWindows()) {
    const w = win as unknown as BrowserWindow & Record<string, unknown>;
    if (w.label === MAIN_WINDOW_KEY) return win;
  }
  return null;
}

export function prewarmPool(): void {
  schedulePrewarm(800);
  schedulePrewarm(1200);
}

export function getCursorCenteredBounds(
  width: number,
  height: number,
): { x: number; y: number; width: number; height: number } | undefined {
  const point = screen.getCursorScreenPoint();
  const display = screen.getDisplayNearestPoint(point);
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

export function refreshWindowTitles(): void {
  try {
    const locale = getCurrentLocale();

    for (const win of BrowserWindow.getAllWindows()) {
      const w = win as unknown as BrowserWindow & Record<string, unknown>;
      const label = typeof w.label === "string" ? w.label : "";

      if (label === MAIN_WINDOW_KEY) {
        win.setTitle(mainWindowTitle(locale));
      } else if (label.startsWith("notepad-")) {
        win.setTitle(notepadWindowTitle(locale));
      }
    }
  } catch {
    /* ignore */
  }
}
