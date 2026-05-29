import { beforeEach, describe, expect, test, vi } from "vitest";
import { invoke, openDialog } from "../../electron-adapter";
import { chooseNotesDirectory, getConfig, normalizeViewMode, saveConfig } from "./api";

vi.mock("../../electron-adapter");

describe("settings api", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("gets config", async () => {
    const config = {
      locale: "zh-CN",
      notesDir: "D:\\notes",
      closeToTray: true,
      autostart: false,
      defaultViewMode: "split",
      noteAutoSave: true,
      noteSurfaceAutoSave: true,
      theme: "light",
      fontSize: 14,
      tabIndentSize: 2,
      externalFileAutoSave: true,
      rememberSurfaceSize: true,
      renderHtmlMarkdown: false,
    };
    vi.mocked(invoke).mockResolvedValue(config);

    await expect(getConfig()).resolves.toEqual(config);

    expect(invoke).toHaveBeenCalledWith("config_get");
  });

  test("saves config", async () => {
    const config = {
      locale: "zh-CN",
      notesDir: "D:\\notes",
      closeToTray: false,
      autostart: true,
      defaultViewMode: "preview",
      noteAutoSave: false,
      noteSurfaceAutoSave: false,
      theme: "dark",
      fontSize: 16,
      tabIndentSize: 4,
      externalFileAutoSave: true,
      rememberSurfaceSize: true,
      renderHtmlMarkdown: false,
    };
    vi.mocked(invoke).mockResolvedValue(config);

    await expect(saveConfig(config)).resolves.toEqual(config);

    expect(invoke).toHaveBeenCalledWith("config_save", { config });
  });

  test("normalizes supported view modes and falls back to split", () => {
    expect(normalizeViewMode("edit")).toBe("edit");
    expect(normalizeViewMode("split")).toBe("split");
    expect(normalizeViewMode("preview")).toBe("preview");
    expect(normalizeViewMode("unknown")).toBe("split");
  });

  test("chooses a notes directory through the folder picker", async () => {
    vi.mocked(openDialog).mockResolvedValue("D:\\notes");

    await expect(chooseNotesDirectory()).resolves.toBe("D:\\notes");

    expect(openDialog).toHaveBeenCalledWith({
      directory: true,
      multiple: false,
    });
  });

  test("returns null when choosing a notes directory is cancelled", async () => {
    vi.mocked(openDialog).mockResolvedValue(null);

    await expect(chooseNotesDirectory()).resolves.toBeNull();
  });
});
