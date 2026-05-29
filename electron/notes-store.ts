import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { randomUUID } from "node:crypto";

export interface AppConfig {
  locale: string;
  notesDir: string;
  closeToTray: boolean;
  autostart: boolean;
  defaultViewMode: string;
  noteAutoSave: boolean;
  noteSurfaceAutoSave: boolean;
  theme: string;
  fontSize: number;
  tabIndentSize: number;
  externalFileAutoSave: boolean;
  backgroundImagePath: string;
  backgroundFit: string;
  backgroundDim: number;
  backgroundBlur: number;
  backgroundScale: number;
  backgroundPositionX: number;
  backgroundPositionY: number;
  rememberSurfaceSize: boolean;
  renderHtmlMarkdown: boolean;
  surfaceWidth?: number;
  surfaceHeight?: number;
}

export interface SaveNoteRequest {
  title: string;
  content: string;
  category: string;
}

export interface NoteMetadata {
  id: string;
  title: string;
  fileName: string;
  category: string;
  createdAt: string;
  updatedAt: string;
  wordCount: number;
  preview: string;
}

export interface Note {
  id: string;
  title: string;
  fileName: string;
  category: string;
  createdAt: string;
  updatedAt: string;
  wordCount: number;
  content: string;
}

export class AppError extends Error {
  code: string;
  details: Record<string, string>;

  constructor(code: string, message: string, details: Record<string, string> = {}) {
    super(message);
    this.code = code;
    this.details = details;
    this.name = "AppError";
  }

  static noteNotFound(id: string): AppError {
    return new AppError("noteNotFound", `Note ${id} was not found`, { noteId: id });
  }

  static unsupportedFile(): AppError {
    return new AppError("unsupportedFile", "只支持导入 .md 文件");
  }

  static categoryNameEmpty(): AppError {
    return new AppError("categoryNameEmpty", "分类名不能为空");
  }

  static categoryNameInvalidChars(): AppError {
    return new AppError("categoryNameInvalidChars", "分类名不能包含特殊字符");
  }

  static categoryNotFound(name: string): AppError {
    return new AppError("categoryNotFound", `分类「${name}」不存在`, { category: name });
  }

  static categoryAlreadyExists(name: string): AppError {
    return new AppError("categoryAlreadyExists", `分类「${name}」已存在`, { category: name });
  }
}

interface MetadataFile {
  notes: NoteMetadata[];
}

const NOTEPAD_POOL_CAPACITY = 2;

export class NoteStore {
  baseDir: string;

  constructor(baseDir: string) {
    this.baseDir = baseDir;
  }

  static defaultBaseDir(): string {
    if (process.env.FLORAL_NOTEPAPER_DATA_DIR?.trim()) {
      return process.env.FLORAL_NOTEPAPER_DATA_DIR.trim();
    }

    if (process.platform === "darwin") {
      const home = os.homedir();
      return path.join(home, "Library", "Application Support", "花笺");
    }

    const userProfile = process.env.USERPROFILE ?? os.homedir();
    return path.join(userProfile, "Documents", "花笺");
  }

  static defaultStore(): NoteStore {
    return new NoteStore(NoteStore.defaultBaseDir());
  }

  get metadataPath(): string {
    return path.join(this.baseDir, "metadata.json");
  }

  get configPath(): string {
    return path.join(this.baseDir, "config.json");
  }

  private ensureBaseDir(): void {
    fs.mkdirSync(this.baseDir, { recursive: true });
  }

  private static isFileSystemRoot(p: string): boolean {
    const parsed = path.parse(p);
    return parsed.root === p;
  }

  private static ensureNotesSuffix(dir: string): string {
    const basename = path.basename(dir);
    if (basename === "notes") return dir;
    return path.join(dir, "notes");
  }

  private static isSafeNotesDir(p: string): boolean {
    if (NoteStore.isFileSystemRoot(p)) {
      throw new AppError("unsafePath", "不能将磁盘根目录设为笔记目录，请选择一个子文件夹");
    }

    const normalized = p.toLowerCase();
    const blocked = [
      "\\windows",
      "\\program files",
      "\\program files (x86)",
      "\\system32",
      "\\syswow64",
    ];
    for (const suffix of blocked) {
      if (normalized.endsWith(suffix)) {
        throw new AppError("unsafePath", `不能将系统目录「${p}」设为笔记目录`);
      }
    }

    const parts = p.split(path.sep).filter(Boolean);
    if (parts.length < 2) {
      throw new AppError("unsafePath", "笔记目录路径不合法，请选择一个具体的文件夹");
    }

    return true;
  }

  loadConfig(): AppConfig {
    this.ensureBaseDir();
    if (!fs.existsSync(this.configPath)) {
      const config = this.defaultConfig();
      this.saveConfigRaw(config);
      return config;
    }

    const raw = fs.readFileSync(this.configPath, "utf-8");
    const config: AppConfig = JSON.parse(raw);
    try {
      NoteStore.isSafeNotesDir(config.notesDir);
    } catch {
      config.notesDir = this.defaultConfig().notesDir;
      NoteStore.writeJsonAtomic(this.configPath, config);
    }
    fs.mkdirSync(config.notesDir, { recursive: true });
    return config;
  }

  saveConfigRaw(config: AppConfig): AppConfig {
    this.ensureBaseDir();
    config.notesDir = NoteStore.ensureNotesSuffix(config.notesDir);
    config.tabIndentSize = Math.max(1, Math.min(8, config.tabIndentSize));
    NoteStore.isSafeNotesDir(config.notesDir);
    fs.mkdirSync(config.notesDir, { recursive: true });
    NoteStore.writeJsonAtomic(this.configPath, config);
    return config;
  }

  private static writeJsonAtomic(filePath: string, value: unknown): void {
    const dir = path.dirname(filePath);
    fs.mkdirSync(dir, { recursive: true });
    const tempPath = filePath + ".tmp";
    fs.writeFileSync(tempPath, JSON.stringify(value, null, 2), "utf-8");
    fs.renameSync(tempPath, filePath);
  }

  private defaultConfig(): AppConfig {
    return {
      locale: "zh-CN",
      notesDir: path.join(this.baseDir, "notes"),
      closeToTray: true,
      autostart: false,
      defaultViewMode: "split",
      noteAutoSave: true,
      noteSurfaceAutoSave: true,
      theme: "system",
      fontSize: 14,
      tabIndentSize: 2,
      externalFileAutoSave: true,
      backgroundImagePath: "",
      backgroundFit: "cover",
      backgroundDim: 0.25,
      backgroundBlur: 0,
      backgroundScale: 1,
      backgroundPositionX: 50,
      backgroundPositionY: 50,
      rememberSurfaceSize: true,
      renderHtmlMarkdown: false,
      surfaceWidth: undefined,
      surfaceHeight: undefined,
    };
  }

  private ensureStorage(): void {
    this.ensureBaseDir();
    const config = this.loadConfig();
    fs.mkdirSync(config.notesDir, { recursive: true });
    if (!fs.existsSync(this.metadataPath)) {
      this.saveMetadata({ notes: [] });
    }
  }

  private get notesDir(): string {
    return this.loadConfig().notesDir;
  }

  private notePathInCategory(fileName: string, category: string): string {
    const dir = category ? path.join(this.notesDir, category) : this.notesDir;
    return path.join(dir, fileName);
  }

  private findMetadata(id: string): NoteMetadata {
    const metadata = this.loadMetadata();
    const note = metadata.notes.find((n) => n.id === id);
    if (!note) throw AppError.noteNotFound(id);
    return note;
  }

  private fileNameFor(id: string, title: string): string {
    const safeTitle = safeFileStem(title);
    return safeTitle ? `${id}_${safeTitle}.md` : `${id}.md`;
  }

  private loadMetadata(): MetadataFile {
    this.ensureBaseDir();
    if (!fs.existsSync(this.metadataPath)) {
      const rebuilt = this.rebuildMetadata();
      this.saveMetadata(rebuilt);
      return rebuilt;
    }

    try {
      const raw = fs.readFileSync(this.metadataPath, "utf-8");
      return JSON.parse(raw);
    } catch {
      const corruptName = `metadata.corrupt-${new Date().toISOString().replace(/[:.]/g, "")}.json`;
      fs.renameSync(this.metadataPath, path.join(this.baseDir, corruptName));
      const rebuilt = this.rebuildMetadata();
      this.saveMetadata(rebuilt);
      return rebuilt;
    }
  }

  private saveMetadata(metadata: MetadataFile): void {
    this.ensureBaseDir();
    NoteStore.writeJsonAtomic(this.metadataPath, metadata);
  }

  private rebuildMetadata(): MetadataFile {
    const notes: NoteMetadata[] = [];
    const notesDir = this.notesDir;
    fs.mkdirSync(notesDir, { recursive: true });

    this.scanDirForNotes(notesDir, "", notes);

    for (const entry of fs.readdirSync(notesDir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        this.scanDirForNotes(path.join(notesDir, entry.name), entry.name, notes);
      }
    }

    return { notes };
  }

  private scanDirForNotes(dir: string, category: string, notes: NoteMetadata[]): void {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isFile()) continue;
      if (path.extname(entry.name) !== ".md") continue;

      const filePath = path.join(dir, entry.name);
      const id = idFromFileName(entry.name);
      if (!id) continue;

      const content = (() => {
        try {
          return fs.readFileSync(filePath, "utf-8");
        } catch {
          return "";
        }
      })();
      const title = inferTitle(entry.name, content);
      const stat = (() => {
        try {
          return fs.statSync(filePath);
        } catch {
          return null;
        }
      })();
      const modified = stat ? stat.mtime.toISOString() : new Date().toISOString();

      notes.push({
        id,
        title,
        fileName: entry.name,
        category,
        createdAt: modified,
        updatedAt: modified,
        wordCount: countWords(content),
        preview: preview(content),
      });
    }
  }

  listNotes(): NoteMetadata[] {
    this.ensureStorage();
    const metadata = this.loadMetadata();
    const notes = metadata.notes.filter((note) => {
      try {
        fs.accessSync(this.notePathInCategory(note.fileName, note.category));
        return true;
      } catch {
        return false;
      }
    });
    notes.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    return notes;
  }

  readNote(id: string): Note {
    this.ensureStorage();
    const metadata = this.findMetadata(id);
    const content = fs.readFileSync(
      this.notePathInCategory(metadata.fileName, metadata.category),
      "utf-8",
    );
    return {
      id: metadata.id,
      title: metadata.title,
      fileName: metadata.fileName,
      category: metadata.category,
      createdAt: metadata.createdAt,
      updatedAt: metadata.updatedAt,
      wordCount: metadata.wordCount,
      content,
    };
  }

  createNote(request: SaveNoteRequest): Note {
    this.ensureStorage();
    const id = randomUUID();
    const now = new Date().toISOString();
    const fileName = this.fileNameFor(id, request.title);
    const wordCount = countWords(request.content);
    const category = request.category ?? "";

    const notePath = this.notePathInCategory(fileName, category);
    fs.mkdirSync(path.dirname(notePath), { recursive: true });
    fs.writeFileSync(notePath, request.content, "utf-8");

    const metadata: NoteMetadata = {
      id,
      title: request.title,
      fileName,
      category,
      createdAt: now,
      updatedAt: now,
      wordCount,
      preview: preview(request.content),
    };

    const metadataFile = this.loadMetadata();
    metadataFile.notes.push(metadata);
    this.saveMetadata(metadataFile);

    return { ...metadata, content: request.content };
  }

  updateNote(id: string, request: SaveNoteRequest): Note {
    this.ensureStorage();
    const metadataFile = this.loadMetadata();
    const note = metadataFile.notes.find((n) => n.id === id);
    if (!note) throw AppError.noteNotFound(id);

    const oldFileName = note.fileName;
    const oldCategory = note.category;
    const newFileName = this.fileNameFor(id, request.title);
    const newCategory = request.category ?? "";
    const now = new Date().toISOString();
    const wordCount = countWords(request.content);

    const newPath = this.notePathInCategory(newFileName, newCategory);
    fs.mkdirSync(path.dirname(newPath), { recursive: true });
    fs.writeFileSync(newPath, request.content, "utf-8");

    if (oldFileName !== newFileName || oldCategory !== newCategory) {
      const oldPath = this.notePathInCategory(oldFileName, oldCategory);
      if (fs.existsSync(oldPath) && oldPath !== newPath) {
        noteStoreSendToTrash(oldPath);
      }
    }

    note.title = request.title;
    note.fileName = newFileName;
    note.category = newCategory;
    note.updatedAt = now;
    note.wordCount = wordCount;
    note.preview = preview(request.content);

    this.saveMetadata(metadataFile);

    return { ...note, content: request.content };
  }

  deleteNote(id: string): void {
    this.ensureStorage();
    const metadataFile = this.loadMetadata();
    const index = metadataFile.notes.findIndex((n) => n.id === id);
    if (index === -1) throw AppError.noteNotFound(id);

    const metadata = metadataFile.notes.splice(index, 1)[0];
    const filePath = this.notePathInCategory(metadata.fileName, metadata.category);
    if (fs.existsSync(filePath)) {
      noteStoreSendToTrash(filePath);
    }
    this.saveMetadata(metadataFile);
  }

  importMarkdownFile(filePath: string, category: string): Note {
    if (path.extname(filePath).toLowerCase() !== ".md") {
      throw AppError.unsupportedFile();
    }

    const content = fs.readFileSync(filePath, "utf-8");
    const title = importedMarkdownTitle(filePath, content);
    return this.createNote({ title, content, category });
  }

  exportMarkdownFile(id: string, exportPath: string): void {
    const note = this.readNote(id);
    fs.mkdirSync(path.dirname(exportPath), { recursive: true });
    fs.writeFileSync(exportPath, note.content, "utf-8");
  }

  listCategories(): string[] {
    const notesDir = this.notesDir;
    fs.mkdirSync(notesDir, { recursive: true });
    const categories: string[] = [];
    for (const entry of fs.readdirSync(notesDir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        categories.push(entry.name);
      }
    }
    categories.sort();
    return categories;
  }

  createCategory(name: string): void {
    name = name.trim();
    if (!name) throw AppError.categoryNameEmpty();
    if (name.includes("/") || name.includes("\\") || name.includes(":") || name.includes("..")) {
      throw AppError.categoryNameInvalidChars();
    }
    fs.mkdirSync(path.join(this.notesDir, name), { recursive: true });
  }

  renameCategory(oldName: string, newName: string): void {
    newName = newName.trim();
    if (!newName) throw AppError.categoryNameEmpty();
    if (
      newName.includes("/") ||
      newName.includes("\\") ||
      newName.includes(":") ||
      newName.includes("..")
    ) {
      throw AppError.categoryNameInvalidChars();
    }

    const notesDir = this.notesDir;
    const oldPath = path.join(notesDir, oldName);
    const newPath = path.join(notesDir, newName);

    if (!fs.existsSync(oldPath)) throw AppError.categoryNotFound(oldName);
    if (fs.existsSync(newPath)) throw AppError.categoryAlreadyExists(newName);

    fs.renameSync(oldPath, newPath);

    const metadataFile = this.loadMetadata();
    for (const note of metadataFile.notes) {
      if (note.category === oldName) {
        note.category = newName;
      }
    }
    this.saveMetadata(metadataFile);
  }

  deleteCategory(name: string): void {
    const notesDir = this.notesDir;
    const categoryPath = path.join(notesDir, name);

    if (fs.existsSync(categoryPath)) {
      const canonNotes = fs.realpathSync(notesDir);
      const canonCat = fs.realpathSync(categoryPath);
      if (!canonCat.startsWith(canonNotes) || canonCat === canonNotes) {
        throw new AppError("unsafePath", `拒绝删除「${categoryPath}」：路径不在笔记目录内`);
      }

      const metadataFile = this.loadMetadata();
      for (const note of metadataFile.notes) {
        if (note.category === name) {
          const oldPath = path.join(categoryPath, note.fileName);
          const newPath = path.join(notesDir, note.fileName);
          if (fs.existsSync(oldPath)) {
            fs.renameSync(oldPath, newPath);
          }
          note.category = "";
        }
      }
      this.saveMetadata(metadataFile);
      noteStoreSendToTrash(categoryPath);
    } else {
      const metadataFile = this.loadMetadata();
      let changed = false;
      for (const note of metadataFile.notes) {
        if (note.category === name) {
          note.category = "";
          changed = true;
        }
      }
      if (changed) this.saveMetadata(metadataFile);
    }
  }

  moveNoteToCategory(id: string, newCategory: string): NoteMetadata {
    this.ensureStorage();
    const metadataFile = this.loadMetadata();
    const note = metadataFile.notes.find((n) => n.id === id);
    if (!note) throw AppError.noteNotFound(id);

    const oldCategory = note.category;
    if (oldCategory === newCategory) return { ...note };

    const oldPath = this.notePathInCategory(note.fileName, oldCategory);
    const newPath = this.notePathInCategory(note.fileName, newCategory);
    fs.mkdirSync(path.dirname(newPath), { recursive: true });
    if (fs.existsSync(oldPath)) {
      fs.renameSync(oldPath, newPath);
    }

    note.category = newCategory;
    this.saveMetadata(metadataFile);
    return { ...note };
  }

  copyBackgroundImage(sourcePath: string): string {
    const source = sourcePath.trim();
    if (!fs.existsSync(source) || !fs.statSync(source).isFile()) {
      throw new AppError("invalidSource", "background image source not found");
    }

    const dir = path.join(this.baseDir, "backgrounds");
    fs.mkdirSync(dir, { recursive: true });

    const oldConfig = this.loadConfig();
    if (oldConfig.backgroundImagePath) {
      const oldPath = oldConfig.backgroundImagePath;
      if (oldPath.startsWith(dir) && fs.existsSync(oldPath)) {
        try {
          fs.unlinkSync(oldPath);
        } catch {
          /* ignore */
        }
      }
    }

    const ext = path.extname(source) || ".png";
    const dest = path.join(dir, `bg-${randomUUID()}${ext}`);
    fs.copyFileSync(source, dest);
    return dest;
  }
}

function noteStoreSendToTrash(filePath: string): void {
  try {
    const { shell } = require("electron");
    shell.trashItem(filePath).catch(() => {
      try {
        fs.unlinkSync(filePath);
      } catch {
        /* ignore */
      }
    });
  } catch {
    try {
      fs.unlinkSync(filePath);
    } catch {
      /* ignore */
    }
  }
}

function safeFileStem(title: string): string {
  let stem = "";
  let lastWasSeparator = false;

  for (const ch of title.trim()) {
    const shouldSeparate = /\s/.test(ch) || '<>:"/\\|?*'.includes(ch) || ch.charCodeAt(0) < 0x20;

    if (shouldSeparate) {
      if (stem && !lastWasSeparator) {
        stem += "_";
        lastWasSeparator = true;
      }
      continue;
    }

    stem += ch;
    lastWasSeparator = false;
    if (stem.length >= 48) break;
  }

  return stem.replace(/^_+|_+$/g, "");
}

function countWords(content: string): number {
  return [...content].filter((ch) => !/\s/.test(ch)).length;
}

function preview(content: string): string {
  return content.split(/\s+/).join(" ").slice(0, 80);
}

function idFromFileName(fileName: string): string | null {
  const stem = fileName.replace(/\.md$/, "");
  if (stem === fileName) return null;
  const underscoreIndex = stem.indexOf("_");
  return underscoreIndex > 0 ? stem.slice(0, underscoreIndex) : stem;
}

function inferTitle(fileName: string, content: string): string {
  const lines = content.split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("# ")) {
      const title = trimmed.slice(2).trim();
      if (title) return title;
    }
  }

  const stem = fileName.replace(/\.md$/, "");
  const underscoreIndex = stem.indexOf("_");
  if (underscoreIndex > 0) {
    return stem.slice(underscoreIndex + 1).replace(/_/g, " ");
  }
  return "";
}

function importedMarkdownTitle(filePath: string, content: string): string {
  const firstLine =
    content
      .split("\n")[0]
      ?.replace(/^\uFEFF/, "")
      .trimStart() ?? "";

  const headingMatch = /^#\s+(.+)/.exec(firstLine);
  if (headingMatch?.[1]?.trim()) {
    return headingMatch[1].trim();
  }

  const stem = path.basename(filePath, path.extname(filePath)).trim();
  return stem || "导入笔记";
}
