import { app, BrowserWindow, ipcMain, dialog, shell, protocol } from "electron";
import * as path from "node:path";
import * as fs from "node:fs";
import { NoteStore } from "./notes-store";
import { resolveLocale, appName, mainWindowTitle } from "./locales";
import { createTray, refreshTrayMenu, destroyTray } from "./tray-manager";
import {
  openNotepadWindow,
  recycleNotepadWindow,
  showMainWindow as showMainWin,
  getMainWindow,
  setStartFile,
  takeStartFile,
  prewarmPool,
  refreshWindowTitles,
} from "./window-manager";

const DIST_DIR = path.join(__dirname, "..", "dist");
let mainWindow: BrowserWindow | null = null;

function createMainWindow(): BrowserWindow {
  const loc = resolveLocale(NoteStore.defaultStore().loadConfig().locale);
  const win = new BrowserWindow({
    title: mainWindowTitle(loc),
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
  (win as unknown as Record<string, unknown>).label = "main";

  if (process.env.ELECTRON_DEV) win.loadURL("http://localhost:1420");
  else win.loadURL("app://index.html");

  win.on("ready-to-show", () => {
    win.show();
    win.focus();
    prewarmPool();
  });
  win.webContents.on("did-fail-load", (_e, code, desc, url) => {
    console.error("LOAD FAIL:", code, desc, url);
    win.show();
  });
  win.on("close", (e) => {
    if ((global as Record<string, unknown>).__appExiting) return;
    try {
      if (NoteStore.defaultStore().loadConfig().closeToTray) {
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

function registerIpcHandlers(): void {
  const h = new Map<string, (...args: unknown[]) => unknown>();

  h.set("app_name", () => {
    try {
      return appName(resolveLocale(NoteStore.defaultStore().loadConfig().locale));
    } catch {
      return "花笺";
    }
  });

  h.set("config_get", () => NoteStore.defaultStore().loadConfig());

  h.set("config_save", (e, a) => {
    const raw = (a as Record<string, unknown>).config;
    const store = NoteStore.defaultStore();
    const saved = store.saveConfigRaw(raw as ReturnType<typeof store.loadConfig>);
    refreshTrayMenu();
    refreshWindowTitles();
    const mw = getMainWindow();
    if (mw) mw.webContents.send("config-changed", saved);
    return saved;
  });

  h.set("copy_background_image", (_e, a) =>
    NoteStore.defaultStore().copyBackgroundImage((a as Record<string, string>).sourcePath),
  );
  h.set("notes_list", () => NoteStore.defaultStore().listNotes());
  h.set("notes_get", (_e, a) =>
    NoteStore.defaultStore().readNote((a as Record<string, string>).id),
  );
  h.set("notes_create", (_e, a) => {
    const note = NoteStore.defaultStore().createNote(
      (a as Record<string, unknown>).request as Parameters<NoteStore["createNote"]>[0],
    );
    const mw = getMainWindow();
    if (mw) mw.webContents.send("notes-changed", {});
    return note;
  });
  h.set("notes_update", (_e, a) => {
    const body = a as Record<string, unknown>;
    const note = NoteStore.defaultStore().updateNote(
      body.id as string,
      body.request as Parameters<NoteStore["updateNote"]>[1],
    );
    const mw = getMainWindow();
    if (mw) mw.webContents.send("notes-changed", {});
    return note;
  });
  h.set("notes_delete", (_e, a) => {
    NoteStore.defaultStore().deleteNote((a as Record<string, string>).id);
    const mw = getMainWindow();
    if (mw) mw.webContents.send("notes-changed", {});
  });
  h.set("notes_import_markdown", (_e, a) => {
    const body = a as Record<string, string>;
    const note = NoteStore.defaultStore().importMarkdownFile(body.path, body.category ?? "");
    const mw = getMainWindow();
    if (mw) mw.webContents.send("notes-changed", {});
    return note;
  });
  h.set("notes_export_markdown", (_e, a) => {
    const body = a as Record<string, string>;
    NoteStore.defaultStore().exportMarkdownFile(body.id, body.path);
  });
  h.set("notes_move_category", (_e, a) => {
    const body = a as Record<string, string>;
    const result = NoteStore.defaultStore().moveNoteToCategory(body.id, body.category);
    const mw = getMainWindow();
    if (mw) mw.webContents.send("notes-changed", {});
    return result;
  });

  h.set("read_external_file", (_e, a) =>
    fs.readFileSync((a as Record<string, string>).path, "utf-8"),
  );
  h.set(
    "get_file_modified_time",
    (_e, a) => fs.statSync((a as Record<string, string>).path).mtimeMs,
  );
  h.set("save_external_file", (_e, a) => {
    const b = a as Record<string, string>;
    fs.mkdirSync(path.dirname(b.path), { recursive: true });
    fs.writeFileSync(b.path, b.content, "utf-8");
  });

  h.set("categories_list", () => NoteStore.defaultStore().listCategories());
  h.set("categories_create", (_e, a) => {
    NoteStore.defaultStore().createCategory((a as Record<string, string>).name);
    const mw = getMainWindow();
    if (mw) mw.webContents.send("notes-changed", {});
  });
  h.set("categories_rename", (_e, a) => {
    const b = a as Record<string, string>;
    NoteStore.defaultStore().renameCategory(b.oldName, b.newName);
    const mw = getMainWindow();
    if (mw) mw.webContents.send("notes-changed", {});
  });
  h.set("categories_delete", (_e, a) => {
    NoteStore.defaultStore().deleteCategory((a as Record<string, string>).name);
    const mw = getMainWindow();
    if (mw) mw.webContents.send("notes-changed", {});
  });

  h.set("open_notepad_window", (_e, a) => {
    const b = a as Record<string, unknown>;
    return openNotepadWindow(
      (b.noteId as string) ?? undefined,
      b.bounds as Parameters<typeof openNotepadWindow>[1],
    );
  });
  h.set("recycle_notepad_window", (_e, a) => {
    recycleNotepadWindow((a as Record<string, string>).label);
  });
  h.set("window:recycle-notepad", (_e, a) => {
    recycleNotepadWindow((a as Record<string, string>).label);
  });
  h.set("open_note_in_editor", (_e, a) => {
    const mw = getMainWindow();
    if (mw) {
      showMainWin(mw);
      mw.webContents.send("open-note", (a as Record<string, string>).noteId);
    }
  });
  h.set("take_startup_file", () => takeStartFile());

  // Preload window/dialog/shell handlers (colon names, direct args from preload)
  h.set("window:get-current-label", (e) => {
    const win = BrowserWindow.fromWebContents((e as Electron.IpcMainInvokeEvent).sender);
    return win ? (win as unknown as Record<string, unknown>).label : null;
  });
  h.set("window:show", (e) => {
    const w = BrowserWindow.fromWebContents((e as Electron.IpcMainInvokeEvent).sender);
    if (w) {
      w.show();
      w.focus();
    }
  });
  h.set("window:hide", (e) => {
    BrowserWindow.fromWebContents((e as Electron.IpcMainInvokeEvent).sender)?.hide();
  });
  h.set("window:close", (e) => {
    BrowserWindow.fromWebContents((e as Electron.IpcMainInvokeEvent).sender)?.close();
  });
  h.set("window:minimize", (e) => {
    BrowserWindow.fromWebContents((e as Electron.IpcMainInvokeEvent).sender)?.minimize();
  });
  h.set("window:toggle-maximize", (e) => {
    const w = BrowserWindow.fromWebContents((e as Electron.IpcMainInvokeEvent).sender);
    if (w) w.isMaximized() ? w.unmaximize() : w.maximize();
  });
  h.set(
    "window:is-maximized",
    (e) =>
      BrowserWindow.fromWebContents((e as Electron.IpcMainInvokeEvent).sender)?.isMaximized() ??
      false,
  );
  h.set("window:set-always-on-top", (e, v) => {
    BrowserWindow.fromWebContents((e as Electron.IpcMainInvokeEvent).sender)?.setAlwaysOnTop(!!v);
  });
  h.set("window:get-bounds", (e) => {
    const w = BrowserWindow.fromWebContents((e as Electron.IpcMainInvokeEvent).sender);
    if (w) {
      const rb = w.getBounds();
      const cs = w.getContentSize();
      return { x: rb.x, y: rb.y, width: cs[0], height: cs[1] };
    }
    return null;
  });
  h.set("window:set-bounds", (e, b) => {
    BrowserWindow.fromWebContents((e as Electron.IpcMainInvokeEvent).sender)?.setBounds(
      b as Electron.Rectangle,
    );
  });
  h.set("window:start-drag", () => {});
  h.set("window:start-resize", () => {});
  h.set("dialog:open", async (_e, o) => {
    const opts = o as Record<string, unknown>;
    const r = await dialog.showOpenDialog(mainWindow!, {
      properties: opts.directory ? ["openDirectory"] : ["openFile"],
      filters: opts.filters as Electron.FileFilter[],
    });
    if (r.canceled) return null;
    return opts.directory ? r.filePaths[0] : (r.filePaths[0] ?? null);
  });
  h.set("dialog:save", async (_e, o) => {
    const opts = o as Record<string, unknown>;
    const r = await dialog.showSaveDialog(mainWindow!, {
      defaultPath: opts.defaultPath as string,
      filters: opts.filters as Electron.FileFilter[],
    });
    return r.canceled ? null : r.filePath;
  });
  h.set("shell:open-external", (_e, url) => {
    shell.openExternal(url as string);
  });
  h.set("__emit", (_e, a) => {
    const body = a as Record<string, unknown> | undefined;
    if (body && typeof body.event === "string") {
      for (const win of BrowserWindow.getAllWindows())
        try {
          win.webContents.send(body.event, body.payload);
        } catch {
          /* */
        }
    }
  });

  for (const [ch, handler] of h) ipcMain.handle(ch, handler);
}

app.commandLine.appendSwitch("enable-transparent-visuals");

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", (_e, cl) => {
    const fa = cl.find(
      (a) =>
        a.toLowerCase().endsWith(".md") ||
        a.toLowerCase().endsWith(".markdown") ||
        a.toLowerCase().endsWith(".txt"),
    );
    if (fa) setStartFile(fa);
    const mw = getMainWindow();
    if (mw) showMainWin(mw);
  });

  app.on("ready", () => {
    protocol.handle("app", (request) => {
      const urlPath = new URL(request.url).pathname;
      const filePath =
        urlPath === "/" || urlPath === ""
          ? path.join(DIST_DIR, "index.html")
          : path.join(DIST_DIR, urlPath.replace(/^\//, ""));
      const ext = path.extname(filePath).toLowerCase();
      const mimeMap: Record<string, string> = {
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

    app.setLoginItemSettings({ openAtLogin: false });

    registerIpcHandlers();
    mainWindow = createMainWindow();
    createTray();
    process.on("uncaughtException", (e) => console.error("FATAL:", e));
  });
}

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
app.on("activate", () => {
  if (!mainWindow) mainWindow = createMainWindow();
});
app.on("before-quit", () => {
  (global as Record<string, unknown>).__appExiting = true;
});
app.on("will-quit", () => {
  destroyTray();
});
