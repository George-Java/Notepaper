import { beforeEach, describe, expect, test, vi } from "vitest";
import { invoke, openDialog, saveDialog } from "../../electron-adapter";
import { exportMarkdownNote, importMarkdownNote } from "./api";

vi.mock("../../electron-adapter");

describe("importExport api", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("imports the selected markdown path", async () => {
    vi.mocked(openDialog).mockResolvedValue("D:\\notes\\外部笔记.md");
    vi.mocked(invoke).mockResolvedValue({
      id: "note-1",
      title: "外部笔记",
      fileName: "note-1.md",
      createdAt: "2026-04-28T00:00:00Z",
      updatedAt: "2026-04-28T00:00:00Z",
      wordCount: 4,
      content: "# 标题\n正文",
    });

    const note = await importMarkdownNote();

    expect(openDialog).toHaveBeenCalledWith({
      multiple: false,
      directory: false,
      filters: [{ name: "Markdown", extensions: ["md"] }],
    });
    expect(invoke).toHaveBeenCalledWith("notes_import_markdown", {
      path: "D:\\notes\\外部笔记.md",
      category: "",
    });
    expect(note?.id).toBe("note-1");
  });

  test("returns null when the file picker is cancelled", async () => {
    vi.mocked(openDialog).mockResolvedValue(null);

    await expect(importMarkdownNote()).resolves.toBeNull();
    expect(invoke).not.toHaveBeenCalled();
  });

  test("exports a note to the selected markdown path", async () => {
    vi.mocked(saveDialog).mockResolvedValue("D:\\exports\\读书笔记.md");
    vi.mocked(invoke).mockResolvedValue(undefined);

    await expect(exportMarkdownNote({ id: "note-1", title: "读书笔记" })).resolves.toBe(true);

    expect(saveDialog).toHaveBeenCalledWith({
      defaultPath: "读书笔记.md",
      filters: [{ name: "Markdown", extensions: ["md"] }],
    });
    expect(invoke).toHaveBeenCalledWith("notes_export_markdown", {
      id: "note-1",
      path: "D:\\exports\\读书笔记.md",
    });
  });

  test("uses a safe markdown file name for export", async () => {
    vi.mocked(saveDialog).mockResolvedValue(null);

    await exportMarkdownNote({ id: "note-1", title: "A/B:Test" });
    await exportMarkdownNote({ id: "note-2", title: "" });
    await exportMarkdownNote({ id: "note-3", title: `${"x".repeat(79)}😀` });

    expect(saveDialog).toHaveBeenNthCalledWith(1, {
      defaultPath: "A_B_Test.md",
      filters: [{ name: "Markdown", extensions: ["md"] }],
    });
    expect(saveDialog).toHaveBeenNthCalledWith(2, {
      defaultPath: "无标题笔记.md",
      filters: [{ name: "Markdown", extensions: ["md"] }],
    });
    expect(saveDialog).toHaveBeenNthCalledWith(3, {
      defaultPath: `${"x".repeat(79)}😀.md`,
      filters: [{ name: "Markdown", extensions: ["md"] }],
    });
    expect(invoke).not.toHaveBeenCalled();
  });
});
