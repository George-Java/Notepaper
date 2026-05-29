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
const electron_1 = require("electron");
const path = __importStar(require("node:path"));
const fs = __importStar(require("node:fs"));
const notes_store_1 = require("./notes-store");
const locales_1 = require("./locales");
const tray_manager_1 = require("./tray-manager");
const window_manager_1 = require("./window-manager");
const DIST_DIR = path.join(__dirname, "..", "dist");
let mainWindow = null;
function createMainWindow() {
  const loc = (0, locales_1.resolveLocale)(
    notes_store_1.NoteStore.defaultStore().loadConfig().locale,
  );
  const win = new electron_1.BrowserWindow({
    title: (0, locales_1.mainWindowTitle)(loc),
    width: 1180,
    height: 760,
    minWidth: 900,
    minHeight: 620,
    frame: false,
    backgroundColor: "#f6f3ec",
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });
  win.label = "main";
  if (process.env.ELECTRON_DEV) win.loadURL("http://localhost:1420");
  else win.loadURL("app://index.html");
  win.on("ready-to-show", () => {
    win.show();
    win.focus();
    (0, window_manager_1.prewarmPool)();
  });
  win.webContents.on("did-fail-load", (_e, code, desc, url) => {
    console.error("LOAD FAIL:", code, desc, url);
    win.show();
  });
  win.on("close", (e) => {
    if (global.__appExiting) return;
    try {
      if (notes_store_1.NoteStore.defaultStore().loadConfig().closeToTray) {
        e.preventDefault();
        win.hide();
      }
    } catch {
      /* */
    }
  });
  win.on("closed", () => {
    mainWindow = null;
  });
  return win;
}
function registerIpcHandlers() {
  const h = new Map();
  h.set("app_name", () => {
    try {
      return (0, locales_1.appName)(
        (0, locales_1.resolveLocale)(notes_store_1.NoteStore.defaultStore().loadConfig().locale),
      );
    } catch {
      return "花笺";
    }
  });
  h.set("config_get", () => notes_store_1.NoteStore.defaultStore().loadConfig());
  h.set("config_save", (e, a) => {
    const raw = a.config;
    const store = notes_store_1.NoteStore.defaultStore();
    const saved = store.saveConfigRaw(raw);
    (0, tray_manager_1.refreshTrayMenu)();
    (0, window_manager_1.refreshWindowTitles)();
    const mw = (0, window_manager_1.getMainWindow)();
    if (mw) mw.webContents.send("config-changed", saved);
    return saved;
  });
  h.set("copy_background_image", (_e, a) =>
    notes_store_1.NoteStore.defaultStore().copyBackgroundImage(a.sourcePath),
  );
  h.set("notes_list", () => notes_store_1.NoteStore.defaultStore().listNotes());
  h.set("notes_get", (_e, a) => notes_store_1.NoteStore.defaultStore().readNote(a.id));
  h.set("notes_create", (_e, a) => {
    const note = notes_store_1.NoteStore.defaultStore().createNote(a.request);
    const mw = (0, window_manager_1.getMainWindow)();
    if (mw) mw.webContents.send("notes-changed", {});
    return note;
  });
  h.set("notes_update", (_e, a) => {
    const body = a;
    const note = notes_store_1.NoteStore.defaultStore().updateNote(body.id, body.request);
    const mw = (0, window_manager_1.getMainWindow)();
    if (mw) mw.webContents.send("notes-changed", {});
    return note;
  });
  h.set("notes_delete", (_e, a) => {
    notes_store_1.NoteStore.defaultStore().deleteNote(a.id);
    const mw = (0, window_manager_1.getMainWindow)();
    if (mw) mw.webContents.send("notes-changed", {});
  });
  h.set("notes_import_markdown", (_e, a) => {
    const body = a;
    const note = notes_store_1.NoteStore.defaultStore().importMarkdownFile(
      body.path,
      body.category ?? "",
    );
    const mw = (0, window_manager_1.getMainWindow)();
    if (mw) mw.webContents.send("notes-changed", {});
    return note;
  });
  h.set("notes_export_markdown", (_e, a) => {
    const body = a;
    notes_store_1.NoteStore.defaultStore().exportMarkdownFile(body.id, body.path);
  });
  h.set("notes_move_category", (_e, a) => {
    const body = a;
    const result = notes_store_1.NoteStore.defaultStore().moveNoteToCategory(
      body.id,
      body.category,
    );
    const mw = (0, window_manager_1.getMainWindow)();
    if (mw) mw.webContents.send("notes-changed", {});
    return result;
  });
  h.set("read_external_file", (_e, a) => fs.readFileSync(a.path, "utf-8"));
  h.set("get_file_modified_time", (_e, a) => fs.statSync(a.path).mtimeMs);
  h.set("save_external_file", (_e, a) => {
    const b = a;
    fs.mkdirSync(path.dirname(b.path), { recursive: true });
    fs.writeFileSync(b.path, b.content, "utf-8");
  });
  h.set("categories_list", () => notes_store_1.NoteStore.defaultStore().listCategories());
  h.set("categories_create", (_e, a) => {
    notes_store_1.NoteStore.defaultStore().createCategory(a.name);
    const mw = (0, window_manager_1.getMainWindow)();
    if (mw) mw.webContents.send("notes-changed", {});
  });
  h.set("categories_rename", (_e, a) => {
    const b = a;
    notes_store_1.NoteStore.defaultStore().renameCategory(b.oldName, b.newName);
    const mw = (0, window_manager_1.getMainWindow)();
    if (mw) mw.webContents.send("notes-changed", {});
  });
  h.set("categories_delete", (_e, a) => {
    notes_store_1.NoteStore.defaultStore().deleteCategory(a.name);
    const mw = (0, window_manager_1.getMainWindow)();
    if (mw) mw.webContents.send("notes-changed", {});
  });
  h.set("open_notepad_window", (_e, a) => {
    const b = a;
    return (0, window_manager_1.openNotepadWindow)(b.noteId ?? undefined, b.bounds);
  });
  h.set("recycle_notepad_window", (_e, a) => {
    (0, window_manager_1.recycleNotepadWindow)(a.label);
  });
  h.set("window:recycle-notepad", (_e, a) => {
    (0, window_manager_1.recycleNotepadWindow)(a.label);
  });
  h.set("open_note_in_editor", (_e, a) => {
    const mw = (0, window_manager_1.getMainWindow)();
    if (mw) {
      (0, window_manager_1.showMainWindow)(mw);
      mw.webContents.send("open-note", a.noteId);
    }
  });
  h.set("take_startup_file", () => (0, window_manager_1.takeStartFile)());
  // Preload window/dialog/shell handlers (colon names, direct args from preload)
  h.set("window:get-current-label", (e) => {
    const win = electron_1.BrowserWindow.fromWebContents(e.sender);
    return win ? win.label : null;
  });
  h.set("window:show", (e) => {
    const w = electron_1.BrowserWindow.fromWebContents(e.sender);
    if (w) {
      w.show();
      w.focus();
    }
  });
  h.set("window:hide", (e) => {
    electron_1.BrowserWindow.fromWebContents(e.sender)?.hide();
  });
  h.set("window:close", (e) => {
    electron_1.BrowserWindow.fromWebContents(e.sender)?.close();
  });
  h.set("window:minimize", (e) => {
    electron_1.BrowserWindow.fromWebContents(e.sender)?.minimize();
  });
  h.set("window:toggle-maximize", (e) => {
    const w = electron_1.BrowserWindow.fromWebContents(e.sender);
    if (w) w.isMaximized() ? w.unmaximize() : w.maximize();
  });
  h.set(
    "window:is-maximized",
    (e) => electron_1.BrowserWindow.fromWebContents(e.sender)?.isMaximized() ?? false,
  );
  h.set("window:set-always-on-top", (e, v) => {
    electron_1.BrowserWindow.fromWebContents(e.sender)?.setAlwaysOnTop(!!v);
  });
  h.set("window:get-bounds", (e) => {
    const w = electron_1.BrowserWindow.fromWebContents(e.sender);
    if (w) {
      const rb = w.getBounds();
      const cs = w.getContentSize();
      return { x: rb.x, y: rb.y, width: cs[0], height: cs[1] };
    }
    return null;
  });
  h.set("window:set-bounds", (e, b) => {
    electron_1.BrowserWindow.fromWebContents(e.sender)?.setBounds(b);
  });
  h.set("window:start-drag", () => {});
  h.set("window:start-resize", () => {});
  h.set("dialog:open", async (_e, o) => {
    const opts = o;
    const r = await electron_1.dialog.showOpenDialog(mainWindow, {
      properties: opts.directory ? ["openDirectory"] : ["openFile"],
      filters: opts.filters,
    });
    if (r.canceled) return null;
    return opts.directory ? r.filePaths[0] : (r.filePaths[0] ?? null);
  });
  h.set("dialog:save", async (_e, o) => {
    const opts = o;
    const r = await electron_1.dialog.showSaveDialog(mainWindow, {
      defaultPath: opts.defaultPath,
      filters: opts.filters,
    });
    return r.canceled ? null : r.filePath;
  });
  h.set("shell:open-external", (_e, url) => {
    electron_1.shell.openExternal(url);
  });
  h.set("__emit", (_e, a) => {
    const body = a;
    if (body && typeof body.event === "string") {
      for (const win of electron_1.BrowserWindow.getAllWindows())
        try {
          win.webContents.send(body.event, body.payload);
        } catch {
          /* */
        }
    }
  });
  for (const [ch, handler] of h) electron_1.ipcMain.handle(ch, handler);
}
electron_1.app.commandLine.appendSwitch("enable-transparent-visuals");
const gotLock = electron_1.app.requestSingleInstanceLock();
if (!gotLock) {
  electron_1.app.quit();
} else {
  electron_1.app.on("second-instance", (_e, cl) => {
    const fa = cl.find(
      (a) =>
        a.toLowerCase().endsWith(".md") ||
        a.toLowerCase().endsWith(".markdown") ||
        a.toLowerCase().endsWith(".txt"),
    );
    if (fa) (0, window_manager_1.setStartFile)(fa);
    const mw = (0, window_manager_1.getMainWindow)();
    if (mw) (0, window_manager_1.showMainWindow)(mw);
  });
  electron_1.app.on("ready", () => {
    electron_1.protocol.handle("app", (request) => {
      const urlPath = new URL(request.url).pathname;
      const filePath =
        urlPath === "/" || urlPath === ""
          ? path.join(DIST_DIR, "index.html")
          : path.join(DIST_DIR, urlPath.replace(/^\//, ""));
      const ext = path.extname(filePath).toLowerCase();
      const mimeMap = {
        ".html": "text/html",
        ".js": "application/javascript",
        ".css": "text/css",
        ".json": "application/json",
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".gif": "image/gif",
        ".svg": "image/svg+xml",
        ".ico": "image/x-icon",
        ".woff": "font/woff",
        ".woff2": "font/woff2",
        ".ttf": "font/ttf",
      };
      try {
        return new Response(fs.readFileSync(filePath), {
          headers: { "content-type": mimeMap[ext] ?? "application/octet-stream" },
        });
      } catch {
        return new Response("Not found", { status: 404 });
      }
    });
    electron_1.app.setLoginItemSettings({ openAtLogin: false });
    registerIpcHandlers();
    mainWindow = createMainWindow();
    (0, tray_manager_1.createTray)();
    process.on("uncaughtException", (e) => console.error("FATAL:", e));
  });
}
electron_1.app.on("window-all-closed", () => {
  if (process.platform !== "darwin") electron_1.app.quit();
});
electron_1.app.on("activate", () => {
  if (!mainWindow) mainWindow = createMainWindow();
});
electron_1.app.on("before-quit", () => {
  global.__appExiting = true;
});
electron_1.app.on("will-quit", () => {
  (0, tray_manager_1.destroyTray)();
});
//# sourceMappingURL=main.js.map
