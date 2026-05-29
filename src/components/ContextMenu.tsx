import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

interface MenuState {
  x: number;
  y: number;
  hasSelection: boolean;
}

export function ContextMenuProvider({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  const [menu, setMenu] = useState<MenuState | null>(null);
  const [menuClosing, setMenuClosing] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleContextMenu(event: MouseEvent) {
      const target = event.target as HTMLElement;
      const isEditable =
        target.tagName === "TEXTAREA" || target.tagName === "INPUT" || target.isContentEditable;

      if (!isEditable) {
        event.preventDefault();
        return;
      }

      event.preventDefault();

      const selection = window.getSelection()?.toString() || "";

      let x = event.clientX;
      let y = event.clientY;
      const menuWidth = 160;
      const menuHeight = 170;
      if (x + menuWidth > window.innerWidth) x = window.innerWidth - menuWidth - 4;
      if (y + menuHeight > window.innerHeight) y = window.innerHeight - menuHeight - 4;

      setMenuClosing(false);
      setMenu({ x, y, hasSelection: selection.length > 0 });
    }

    function handleClick() {
      setMenuClosing(true);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setMenuClosing(true);
    }

    document.addEventListener("contextmenu", handleContextMenu);
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("contextmenu", handleContextMenu);
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  useEffect(() => {
    if (!menuClosing || !menu) return;
    const timer = window.setTimeout(() => {
      setMenu(null);
      setMenuClosing(false);
    }, 150);
    return () => window.clearTimeout(timer);
  }, [menuClosing, menu]);

  const dismissMenu = useCallback(() => {
    setMenuClosing(true);
  }, []);

  const runCommand = (command: string) => {
    document.execCommand(command);
    dismissMenu();
  };

  if (!menu) return <>{children}</>;

  return (
    <>
      {children}
      <div
        ref={menuRef}
        className={`fixed z-[9999] min-w-[152px] py-1.5 bg-cloud/95 backdrop-blur-sm border border-paper-deep/50 rounded-lg overflow-hidden select-none ${menuClosing ? "animate-menu-exit" : "animate-menu-enter"}`}
        style={{
          left: menu.x,
          top: menu.y,
        }}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button
          onClick={() => runCommand("cut")}
          disabled={!menu.hasSelection}
          className="w-full flex items-center justify-between px-3 py-1.5 text-[12px] font-body transition-colors cursor-pointer disabled:text-ink-ghost/40 disabled:cursor-default disabled:hover:bg-transparent text-ink-soft hover:bg-bamboo-mist/60 hover:text-bamboo"
        >
          <span>{t("contextMenu.edit.cut", { defaultValue: "剪切" })}</span>
          <span className="text-[10px] text-ink-ghost/60 font-mono ml-6">Ctrl+X</span>
        </button>
        <button
          onClick={() => runCommand("copy")}
          disabled={!menu.hasSelection}
          className="w-full flex items-center justify-between px-3 py-1.5 text-[12px] font-body transition-colors cursor-pointer disabled:text-ink-ghost/40 disabled:cursor-default disabled:hover:bg-transparent text-ink-soft hover:bg-bamboo-mist/60 hover:text-bamboo"
        >
          <span>{t("contextMenu.edit.copy", { defaultValue: "复制" })}</span>
          <span className="text-[10px] text-ink-ghost/60 font-mono ml-6">Ctrl+C</span>
        </button>
        <button
          onClick={() => runCommand("paste")}
          className="w-full flex items-center justify-between px-3 py-1.5 text-[12px] font-body transition-colors cursor-pointer text-ink-soft hover:bg-bamboo-mist/60 hover:text-bamboo"
        >
          <span>{t("contextMenu.edit.paste", { defaultValue: "粘贴" })}</span>
          <span className="text-[10px] text-ink-ghost/60 font-mono ml-6">Ctrl+V</span>
        </button>
        <div className="mx-2 my-1 h-px bg-paper-deep/40" />
        <button
          onClick={() => runCommand("selectAll")}
          className="w-full flex items-center justify-between px-3 py-1.5 text-[12px] font-body transition-colors cursor-pointer text-ink-soft hover:bg-bamboo-mist/60 hover:text-bamboo"
        >
          <span>{t("contextMenu.edit.selectAll", { defaultValue: "全选" })}</span>
          <span className="text-[10px] text-ink-ghost/60 font-mono ml-6">Ctrl+A</span>
        </button>
      </div>
    </>
  );
}
