import { describe, expect, test, vi } from "vitest";
import { invoke } from "../../electron-adapter";
import { openNotepadWindow, type WindowBounds } from "./api";

vi.mock("../../electron-adapter");

describe("window api", () => {
  test("passes optional bounds when opening notepad windows", async () => {
    const bounds: WindowBounds = { x: 12, y: 34, width: 320, height: 240 };
    vi.mocked(invoke).mockResolvedValue("ok");

    await openNotepadWindow("note-1", bounds);

    expect(invoke).toHaveBeenCalledWith("open_notepad_window", {
      noteId: "note-1",
      bounds,
    });
  });
});
