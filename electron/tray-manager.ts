import { Tray, Menu, nativeImage, BrowserWindow, app } from "electron";
import * as path from "node:path";
import { NoteStore } from "./notes-store";
import {
  Locale,
  resolveLocale,
  trayTooltip,
  trayShowMainLabel,
  trayQuickNoteLabel,
  trayToggleCloseToTrayLabel,
  trayQuitLabel,
} from "./locales";
import { showMainWindow, openNotepadWindow } from "./window-manager";

let tray: Tray | null = null;

function getLocale(): Locale {
  try {
    return resolveLocale(NoteStore.defaultStore().loadConfig().locale);
  } catch {
    return resolveLocale("zh-CN");
  }
}

function getConfig() {
  return NoteStore.defaultStore().loadConfig();
}

function setConfig(config: ReturnType<typeof getConfig>) {
  NoteStore.defaultStore().saveConfigRaw(config);
}

function getIconPath(): string {
  return path.join(__dirname, "..", "src-tauri", "icons", "icon.png");
}

function buildTrayMenu(): Menu {
  const locale = getLocale();
  const config = getConfig();

  return Menu.buildFromTemplate([
    {
      label: trayShowMainLabel(locale),
      click: () => {
        const mainWin = BrowserWindow.getAllWindows().find(
          (w) => (w as unknown as Record<string, unknown>).label === "main",
        );
        if (mainWin) showMainWindow(mainWin);
      },
    },
    {
      label: trayQuickNoteLabel(locale),
      click: () => {
        openNotepadWindow();
      },
    },
    { type: "separator" },
    {
      label: trayToggleCloseToTrayLabel(locale),
      type: "checkbox",
      checked: config.closeToTray,
      click: (item) => {
        const c = getConfig();
        c.closeToTray = item.checked;
        setConfig(c);
        refreshTray();
        const mainWin = BrowserWindow.getAllWindows().find(
          (w) => (w as unknown as Record<string, unknown>).label === "main",
        );
        if (mainWin) mainWin.webContents.send("config-changed", c);
      },
    },
    { type: "separator" },
    {
      label: trayQuitLabel(locale),
      click: () => {
        (global as Record<string, unknown>).__appExiting = true;
        app.quit();
      },
    },
  ]);
}

function refreshTray(): void {
  if (!tray) return;
  const locale = getLocale();
  tray.setToolTip(trayTooltip(locale));
  tray.setContextMenu(buildTrayMenu());
}

export function createTray(): Tray {
  const iconPath = getIconPath();
  const icon = nativeImage.createFromPath(iconPath);
  tray = new Tray(icon.resize({ width: 16, height: 16 }));
  const locale = getLocale();
  tray.setToolTip(trayTooltip(locale));
  tray.setContextMenu(buildTrayMenu());
  tray.on("click", () => {
    const mainWin = BrowserWindow.getAllWindows().find(
      (w) => (w as unknown as Record<string, unknown>).label === "main",
    );
    if (mainWin) showMainWindow(mainWin);
  });
  return tray;
}

export function refreshTrayMenu(): void {
  refreshTray();
}

export function destroyTray(): void {
  if (tray) {
    tray.destroy();
    tray = null;
  }
}
