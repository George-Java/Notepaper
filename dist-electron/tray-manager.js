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
exports.createTray = createTray;
exports.refreshTrayMenu = refreshTrayMenu;
exports.destroyTray = destroyTray;
const electron_1 = require("electron");
const path = __importStar(require("node:path"));
const notes_store_1 = require("./notes-store");
const locales_1 = require("./locales");
const window_manager_1 = require("./window-manager");
let tray = null;
function getLocale() {
  try {
    return (0, locales_1.resolveLocale)(notes_store_1.NoteStore.defaultStore().loadConfig().locale);
  } catch {
    return (0, locales_1.resolveLocale)("zh-CN");
  }
}
function getConfig() {
  return notes_store_1.NoteStore.defaultStore().loadConfig();
}
function setConfig(config) {
  notes_store_1.NoteStore.defaultStore().saveConfigRaw(config);
}
function getIconPath() {
  return path.join(__dirname, "..", "build", "icon.png");
}
function buildTrayMenu() {
  const locale = getLocale();
  const config = getConfig();
  return electron_1.Menu.buildFromTemplate([
    {
      label: (0, locales_1.trayShowMainLabel)(locale),
      click: () => {
        const mainWin = electron_1.BrowserWindow.getAllWindows().find((w) => w.label === "main");
        if (mainWin) (0, window_manager_1.showMainWindow)(mainWin);
      },
    },
    {
      label: (0, locales_1.trayQuickNoteLabel)(locale),
      click: () => {
        (0, window_manager_1.openNotepadWindow)();
      },
    },
    { type: "separator" },
    {
      label: (0, locales_1.trayToggleCloseToTrayLabel)(locale),
      type: "checkbox",
      checked: config.closeToTray,
      click: (item) => {
        const c = getConfig();
        c.closeToTray = item.checked;
        setConfig(c);
        refreshTray();
        const mainWin = electron_1.BrowserWindow.getAllWindows().find((w) => w.label === "main");
        if (mainWin) mainWin.webContents.send("config-changed", c);
      },
    },
    { type: "separator" },
    {
      label: (0, locales_1.trayQuitLabel)(locale),
      click: () => {
        global.__appExiting = true;
        electron_1.app.quit();
      },
    },
  ]);
}
function refreshTray() {
  if (!tray) return;
  const locale = getLocale();
  tray.setToolTip((0, locales_1.trayTooltip)(locale));
  tray.setContextMenu(buildTrayMenu());
}
function createTray() {
  const iconPath = getIconPath();
  const icon = electron_1.nativeImage.createFromPath(iconPath);
  tray = new electron_1.Tray(icon.resize({ width: 16, height: 16 }));
  const locale = getLocale();
  tray.setToolTip((0, locales_1.trayTooltip)(locale));
  tray.setContextMenu(buildTrayMenu());
  tray.on("click", () => {
    const mainWin = electron_1.BrowserWindow.getAllWindows().find((w) => w.label === "main");
    if (mainWin) (0, window_manager_1.showMainWindow)(mainWin);
  });
  return tray;
}
function refreshTrayMenu() {
  refreshTray();
}
function destroyTray() {
  if (tray) {
    tray.destroy();
    tray = null;
  }
}
//# sourceMappingURL=tray-manager.js.map
