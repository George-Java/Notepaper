import { useCallback, useEffect, useRef, useState } from "react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { createNote, getErrorMessage, getNote, listNotes, updateNote } from "../features/notes/api";
import type { Note, NoteMetadata } from "../features/notes/types";
import {
  countNoteChars,
  formatShortDate,
  getDisplayTitle,
  metadataFromNote,
} from "../features/notes/noteUtils";
import { listen, windowAPI } from "../electron-adapter";
import {
  recycleCurrentNotepad,
  showCurrentWindow,
  startCurrentWindowResize,
} from "../features/windows/controls";
import { openNoteInEditor } from "../features/windows/api";
import type { ResizeDirection } from "../features/windows/controls";
import { getConfig } from "../features/settings/api";

type OpenMode = "new" | "open";
type NotePadStatus = "empty" | "opened" | "saved" | "dirty" | "saveFailed";

interface NotePadProps {
  initialNoteId?: string;
  initialAutoSave?: boolean;
}

const surfaceResizeHandles: Array<{
  direction: ResizeDirection;
  className: string;
  size: string;
}> = [
  { direction: "NorthWest", size: "w-8 h-8", className: "top-0 left-0 cursor-nwse-resize" },
  { direction: "NorthEast", size: "w-5 h-5", className: "top-0 right-0 cursor-nesw-resize" },
  { direction: "SouthWest", size: "w-8 h-8", className: "bottom-0 left-0 cursor-nesw-resize" },
  { direction: "SouthEast", size: "w-5 h-5", className: "bottom-0 right-0 cursor-nwse-resize" },
];

function SurfaceResizeHandles() {
  return (
    <>
      {surfaceResizeHandles.map((handle) => (
        <div
          key={handle.direction}
          aria-hidden="true"
          data-surface-resize-handle="true"
          data-resize-direction={handle.direction}
          onMouseDown={(event) => {
            event.stopPropagation();
            void startCurrentWindowResize(handle.direction).catch(() => undefined);
          }}
          className={`absolute ${handle.size} opacity-0 ${handle.className}`}
        />
      ))}
    </>
  );
}

export function NotePad({ initialNoteId, initialAutoSave = true }: NotePadProps) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<OpenMode>("new");
  const [notes, setNotes] = useState<NoteMetadata[]>([]);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [hoveredNote, setHoveredNote] = useState<string | null>(null);
  const [status, setStatus] = useState<NotePadStatus>("empty");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [noteSurfaceAutoSave, setNoteSurfaceAutoSave] = useState(initialAutoSave);
  const [isExiting, setIsExiting] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);
  const contentRef = useRef<HTMLTextAreaElement>(null);
  const isStandby = useRef(
    typeof window !== "undefined" &&
      new URLSearchParams(window.location.search).get("standby") === "1",
  );
  const hasEnteredOnce = useRef(false);
  const statusLabel = useMemo<Record<NotePadStatus, string>>(
    () => ({
      empty: t("notepad.status.empty", { defaultValue: "空" }),
      opened: t("notepad.status.opened", { defaultValue: "已打开" }),
      saved: t("notepad.status.saved", { defaultValue: "已保存" }),
      dirty: t("notepad.status.unsaved", { defaultValue: "未保存" }),
      saveFailed: t("notepad.status.saveFailed", { defaultValue: "保存失败" }),
    }),
    [t],
  );
  const tabLabels = useMemo(
    () => ({
      new: t("notepad.tab.new", { defaultValue: "新建" }),
      edit: t("notepad.tab.edit", { defaultValue: "编辑" }),
      open: t("notepad.tab.open", { defaultValue: "打开" }),
    }),
    [t],
  );

  const refreshNotes = useCallback(async () => {
    const loadedNotes = await listNotes();
    setNotes(loadedNotes);
    return loadedNotes;
  }, []);

  const applyNote = useCallback((note: Note) => {
    setEditingNoteId(note.id);
    setTitle(note.title);
    setContent(note.content);
    setMode("new");
    setStatus("opened");
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      try {
        const [loadedConfig] = await Promise.all([getConfig(), refreshNotes()]);
        if (!cancelled) {
          setNoteSurfaceAutoSave(loadedConfig.noteSurfaceAutoSave);
        }
        if (initialNoteId) {
          const note = await getNote(initialNoteId);
          if (!cancelled) applyNote(note);
        }
      } catch (error) {
        if (!cancelled) setErrorMessage(getErrorMessage(error));
      }
    }

    void bootstrap();
    return () => {
      cancelled = true;
    };
  }, [applyNote, initialNoteId, refreshNotes]);

  useEffect(() => {
    const unlisten = listen("notes-changed", () => {
      void refreshNotes().catch(() => undefined);
    });
    return () => {
      void unlisten.then((fn) => fn());
    };
  }, [refreshNotes]);

  useEffect(() => {
    if (isStandby.current) return;
    let cancelled = false;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (!cancelled) {
          hasEnteredOnce.current = true;
          void showCurrentWindow()
            .then(() => contentRef.current?.focus())
            .catch(() => undefined);
        }
      });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let canceled = false;
    let unlistenPromise: Promise<() => void> | null = null;

    windowAPI.getCurrentLabel().then((myLabel) => {
      if (canceled) return;
      if (!myLabel) myLabel = "";

      unlistenPromise = listen<string>("notepad:activate", (event) => {
        if ((event as unknown as string) !== myLabel) return;

        isStandby.current = false;
        hasEnteredOnce.current = true;
        setEditingNoteId(null);
        setTitle("");
        setContent("");
        setMode("new");
        setStatus("empty");
        setErrorMessage(null);
        setIsExiting(false);
        void refreshNotes().catch(() => undefined);
        void showCurrentWindow()
          .then(() => contentRef.current?.focus())
          .catch(() => undefined);
      });
    });
    return () => {
      canceled = true;
      if (unlistenPromise) unlistenPromise.then((fn) => fn());
    };
  }, [refreshNotes]);

  const saveNote = useCallback(async () => {
    const existingCategory = notes.find((n) => n.id === editingNoteId)?.category ?? "";
    const request = { title, content, category: existingCategory };
    const note = editingNoteId
      ? await updateNote(editingNoteId, request)
      : await createNote(request);

    setEditingNoteId(note.id);
    setNotes((current) => {
      const metadata = metadataFromNote(note);
      const exists = current.some((item) => item.id === note.id);
      const next = exists
        ? current.map((item) => (item.id === note.id ? metadata : item))
        : [metadata, ...current];
      return [...next].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
    });
    setStatus("saved");
    return note;
  }, [content, editingNoteId, title]);

  const hasDraftContent = useCallback(
    () => Boolean(editingNoteId || title.trim() || content.trim()),
    [content, editingNoteId, title],
  );

  const handleSave = useCallback(async () => {
    setErrorMessage(null);
    try {
      await saveNote();
    } catch (error) {
      setStatus("saveFailed");
      setErrorMessage(getErrorMessage(error));
    }
  }, [saveNote]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key === "s") {
        event.preventDefault();
        void handleSave();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleSave]);

  const handleOpenNote = async (noteId: string) => {
    setErrorMessage(null);
    try {
      const note = await getNote(noteId);
      applyNote(note);
      setMode("new");
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    }
  };

  const handleClose = useCallback(() => {
    setIsExiting(true);
    void recycleCurrentNotepad().catch((error) => {
      setIsExiting(false);
      setErrorMessage(getErrorMessage(error));
    });
  }, []);

  useEffect(() => {
    if (!noteSurfaceAutoSave || mode !== "new" || status !== "dirty") {
      return undefined;
    }
    if (!hasDraftContent()) return undefined;

    const timer = window.setTimeout(() => {
      void handleSave();
    }, 900);

    return () => window.clearTimeout(timer);
  }, [handleSave, hasDraftContent, mode, noteSurfaceAutoSave, status]);

  const resetDraft = () => {
    setEditingNoteId(null);
    setTitle("");
    setContent("");
    setMode("new");
    setStatus("empty");
    setErrorMessage(null);
  };

  const enterClass = hasEnteredOnce.current ? "" : "animate-window-enter";
  const surfaceWrapperClassName = `w-full h-screen flex flex-col bg-transparent p-0 rounded-lg overflow-hidden ${isExiting ? "animate-window-exit" : enterClass}`;
  const padSurfaceClassName =
    "app-surface-frame relative noise-bg w-full h-full min-h-0 bg-cloud overflow-hidden flex flex-col flex-1 rounded-lg border border-paper-deep/70 shadow-[0_1px_10px_rgba(26,26,24,0.06)] transition-all duration-200 ease-out";

  return (
    <div className={surfaceWrapperClassName}>
      <div className={padSurfaceClassName}>
        <div className="flex items-center justify-between px-4 pt-3 pb-0 cursor-default app-drag-region">
          <div className="flex items-center gap-0.5">
            <button
              onClick={resetDraft}
              className={`relative px-3.5 py-1.5 text-[13px] rounded-t-lg transition-all duration-200 cursor-pointer ${
                mode === "new" ? "text-bamboo font-medium" : "text-ink-ghost hover:text-ink-faint"
              }`}
            >
              {editingNoteId ? tabLabels.edit : tabLabels.new}
              {mode === "new" && (
                <div className="absolute bottom-0 left-3 right-3 h-[2px] bg-bamboo rounded-full" />
              )}
            </button>
            <button
              onClick={() => setMode("open")}
              className={`relative px-3.5 py-1.5 text-[13px] rounded-t-lg transition-all duration-200 cursor-pointer ${
                mode === "open" ? "text-bamboo font-medium" : "text-ink-ghost hover:text-ink-faint"
              }`}
            >
              {tabLabels.open}
              {mode === "open" && (
                <div className="absolute bottom-0 left-3 right-3 h-[2px] bg-bamboo rounded-full" />
              )}
            </button>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => void handleClose()}
              className="group w-7 h-7 flex items-center justify-center rounded-lg text-ink-ghost hover:bg-danger-bg hover:text-red-400 transition-all duration-200 cursor-pointer"
              title={t("notepad.tooltip.close", { defaultValue: "关闭" })}
            >
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
              >
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="mx-4 mt-1 h-px bg-paper-deep/50" />

        {mode === "new" ? (
          <div data-pad-editor-body="true" className="px-4 pt-3 pb-2 flex flex-col flex-1 min-h-0">
            <input
              ref={titleRef}
              type="text"
              value={title}
              onChange={(event) => {
                setTitle(event.target.value);
                setStatus("dirty");
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === "ArrowDown") {
                  event.preventDefault();
                  contentRef.current?.focus();
                }
              }}
              placeholder={t("notepad.placeholder.title", { defaultValue: "标题（可选）" })}
              className="w-full font-display font-medium text-ink placeholder:text-ink-ghost/60 mb-2 tracking-wide shrink-0"
              style={{ fontSize: `14px` }}
            />

            <textarea
              ref={contentRef}
              data-tab-indent="true"
              value={content}
              onChange={(event) => {
                setContent(event.target.value);
                setStatus("dirty");
              }}
              onKeyDown={(event) => {
                if (event.key === "ArrowUp") {
                  const ta = contentRef.current;
                  if (ta && ta.selectionStart === ta.selectionEnd) {
                    const textBeforeCursor = content.slice(0, ta.selectionStart);
                    if (!textBeforeCursor.includes("\n")) {
                      event.preventDefault();
                      titleRef.current?.focus();
                    }
                  }
                }
              }}
              placeholder={t("notepad.placeholder.content", { defaultValue: "写点什么……" })}
              className="w-full flex-1 min-h-0 pb-2 leading-relaxed text-ink-soft font-body placeholder:text-ink-ghost/50"
              style={{ fontSize: `14px`, tabSize: `var(--tab-indent-size, 2)` }}
            />

            <div className="flex items-center justify-between mt-auto pt-2 border-t border-paper-deep/30 shrink-0">
              <span className="text-[11px] text-ink-ghost font-mono tabular-nums truncate max-w-[170px]">
                {errorMessage ??
                  `${countNoteChars(content)} ${t("common.wordCountUnit", { defaultValue: "字" })} · ${statusLabel[status]}`}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={resetDraft}
                  className="px-4 py-1.5 text-[12px] text-ink-faint hover:text-ink-soft rounded-lg hover:bg-paper-warm transition-all duration-200 cursor-pointer"
                >
                  {t("notepad.button.clear", { defaultValue: "清空" })}
                </button>
                <button
                  onClick={() => void handleSave()}
                  className="px-4 py-1.5 text-[12px] text-cloud bg-bamboo hover:bg-bamboo-light rounded-lg transition-all duration-200 font-medium cursor-pointer"
                >
                  {t("common.save", { defaultValue: "保存" })}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-2 flex-1 min-h-0 overflow-y-auto">
            <div className="space-y-0.5">
              {notes.map((note) => (
                <button
                  key={note.id}
                  onClick={() => void handleOpenNote(note.id)}
                  onMouseEnter={() => setHoveredNote(note.id)}
                  onMouseLeave={() => setHoveredNote(null)}
                  className="w-full text-left px-3.5 py-3 rounded-xl transition-all duration-200 cursor-pointer group hover:bg-paper-warm/70"
                >
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-[13px] font-display font-medium text-ink-soft group-hover:text-ink transition-colors truncate pr-2">
                      {getDisplayTitle(note)}
                    </span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          void openNoteInEditor(note.id);
                        }}
                        className="w-6 h-6 flex items-center justify-center rounded-md text-ink-ghost hover:text-bamboo hover:bg-bamboo-mist/50 transition-all duration-200 opacity-0 group-hover:opacity-100 cursor-pointer"
                        title={t("notepad.tooltip.openInEditor", {
                          defaultValue: "在编辑器中打开",
                        })}
                      >
                        <svg
                          width="13"
                          height="13"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                          <polyline points="15 3 21 3 21 9" />
                          <line x1="10" y1="14" x2="21" y2="3" />
                        </svg>
                      </button>
                      <span className="text-[11px] text-ink-ghost font-mono tabular-nums">
                        {formatShortDate(note.updatedAt)}
                      </span>
                    </div>
                  </div>
                  <p className="text-[12px] text-ink-ghost leading-relaxed line-clamp-1 group-hover:text-ink-faint transition-colors">
                    {note.preview || t("common.blankNote", { defaultValue: "空白笔记" })}
                  </p>
                  {hoveredNote === note.id && (
                    <div className="mt-1.5 h-px bg-bamboo/10 transition-all duration-300" />
                  )}
                </button>
              ))}
              {notes.length === 0 && (
                <div className="px-4 py-8 text-center text-[12px] text-ink-ghost">
                  {t("notepad.emptyState", { defaultValue: "还没有可打开的笔记" })}
                </div>
              )}
            </div>
          </div>
        )}
        <SurfaceResizeHandles />
      </div>
    </div>
  );
}
