"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.shortcutFromConfig = shortcutFromConfig;
exports.applyGlobalShortcutConfig = applyGlobalShortcutConfig;
exports.checkGlobalShortcut = checkGlobalShortcut;
exports.unregisterAllShortcuts = unregisterAllShortcuts;
const electron_1 = require("electron");
const notes_store_1 = require("./notes-store");
const window_manager_1 = require("./window-manager");
function shortcutFromConfig(value) {
  const parts = value
    .split("+")
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length < 2) return null;
  const keyPart = parts[parts.length - 1];
  const modifiers = parts.slice(0, -1);
  let ctrl = false;
  let alt = false;
  let shift = false;
  let meta = false;
  for (const m of modifiers) {
    const lower = m.toLowerCase();
    if (
      lower === "ctrl" ||
      lower === "control" ||
      lower === "cmdorctrl" ||
      lower === "commandercontrol"
    )
      ctrl = true;
    else if (lower === "alt" || lower === "option") alt = true;
    else if (lower === "shift") shift = true;
    else if (lower === "meta" || lower === "cmd" || lower === "command" || lower === "super")
      meta = true;
    else return null;
  }
  if (!ctrl && !alt && !meta) return null;
  return { ctrl, alt, shift, meta, key: keyPart.toUpperCase() };
}
function toElectronAccelerator(spec) {
  const parts = [];
  if (spec.ctrl) parts.push("CommandOrControl");
  if (spec.alt) parts.push("Alt");
  if (spec.shift) parts.push("Shift");
  if (spec.meta) parts.push("Command");
  parts.push(spec.key);
  return parts.join("+");
}
let registeredShortcuts = new Map();
function applyGlobalShortcutConfig() {
  try {
    const config = notes_store_1.NoteStore.defaultStore().loadConfig();
    electron_1.globalShortcut.unregisterAll();
    registeredShortcuts.clear();
    if (config.globalShortcut) {
      const spec = shortcutFromConfig(config.globalShortcut);
      if (spec) {
        const accel = toElectronAccelerator(spec);
        try {
          electron_1.globalShortcut.register(accel, () => {
            handleShortcut("openNotepad");
          });
          registeredShortcuts.set(accel, "openNotepad");
        } catch (e) {
          const mainWin = electron_1.BrowserWindow.getAllWindows().find((w) => w.label === "main");
          if (mainWin)
            mainWin.webContents.send("shortcut-register-failed", "快捷键注册失败：" + String(e));
        }
      }
    }
    if (config.toggleVisibilityShortcut) {
      const spec = shortcutFromConfig(config.toggleVisibilityShortcut);
      if (spec) {
        const accel = toElectronAccelerator(spec);
        try {
          electron_1.globalShortcut.register(accel, () => {
            handleShortcut("toggleVisibility");
          });
          registeredShortcuts.set(accel, "toggleVisibility");
        } catch (e) {
          console.error("Failed to register toggle visibility shortcut:", e);
        }
      }
    }
  } catch {
    console.error("Failed to apply global shortcut config");
  }
}
function handleShortcut(action) {
  if (action === "openNotepad") {
    try {
      const config = notes_store_1.NoteStore.defaultStore().loadConfig();
      if (config.openAtCursor) {
        const specs = (0, window_manager_1.getSavedSurfaceSpecs)();
        const bounds = (0, window_manager_1.getCursorCenteredBounds)(specs.width, specs.height);
        (0, window_manager_1.openNotepadWindow)(undefined, bounds);
      } else {
        (0, window_manager_1.openNotepadWindow)();
      }
    } catch {
      (0, window_manager_1.openNotepadWindow)();
    }
  } else if (action === "toggleVisibility") {
    const mainWin = electron_1.BrowserWindow.getAllWindows().find((w) => w.label === "main");
    if (mainWin) (0, window_manager_1.toggleAppVisibility)(mainWin);
  }
}
function checkGlobalShortcut(shortcutStr) {
  const spec = shortcutFromConfig(shortcutStr);
  if (!spec) {
    return {
      available: false,
      conflictType: "invalid",
      message: `快捷键 ${shortcutStr} 不受支持`,
    };
  }
  if (process.platform === "darwin") {
    if (spec.meta && !spec.ctrl && !spec.alt && !spec.shift && spec.key === "SPACE") {
      return {
        available: false,
        conflictType: "system",
        message: "与 macOS 系统快捷键 Spotlight 冲突",
      };
    }
  }
  const accel = toElectronAccelerator(spec);
  if (registeredShortcuts.has(accel)) {
    return {
      available: true,
      conflictType: "current",
      message: `快捷键 ${shortcutStr} 当前正在使用`,
    };
  }
  if (electron_1.globalShortcut.isRegistered(accel)) {
    return {
      available: false,
      conflictType: "registered",
      message: `快捷键 ${shortcutStr} 注册失败，可能已被系统或其他应用占用`,
    };
  }
  const registered = electron_1.globalShortcut.register(accel, () => {});
  if (registered) {
    electron_1.globalShortcut.unregister(accel);
    return {
      available: true,
      conflictType: "none",
      message: `快捷键 ${shortcutStr} 未检测到冲突`,
    };
  }
  return {
    available: false,
    conflictType: "registered",
    message: `快捷键 ${shortcutStr} 注册失败，可能已被系统或其他应用占用`,
  };
}
function unregisterAllShortcuts() {
  electron_1.globalShortcut.unregisterAll();
  registeredShortcuts.clear();
}
//# sourceMappingURL=shortcut-manager.js.map
