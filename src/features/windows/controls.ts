import { invoke, windowAPI } from "../../electron-adapter";
import type { WindowBounds } from "./api";

export type ResizeDirection = "NorthWest" | "NorthEast" | "SouthWest" | "SouthEast";

export async function showCurrentWindow(): Promise<void> {
  await windowAPI.show();
}

export function hideCurrentWindow(): Promise<void> {
  return windowAPI.hide();
}

export function closeCurrentWindow(): Promise<void> {
  return windowAPI.close();
}

export async function recycleCurrentNotepad(): Promise<void> {
  const label = await windowAPI.getCurrentLabel();
  return invoke("window:recycle-notepad", {
    label: label ?? "notepad-current",
  });
}

export function minimizeCurrentWindow(): Promise<void> {
  return windowAPI.minimize();
}

export function toggleMaximizeCurrentWindow(): Promise<void> {
  return windowAPI.toggleMaximize();
}

export function isCurrentWindowMaximized(): Promise<boolean> {
  return windowAPI.isMaximized();
}

export function setCurrentWindowAlwaysOnTop(enabled: boolean): Promise<void> {
  return windowAPI.setAlwaysOnTop(enabled);
}

export function startCurrentWindowDrag(): Promise<void> {
  return windowAPI.startDrag();
}

export function startCurrentWindowResize(direction: ResizeDirection = "SouthEast"): Promise<void> {
  return windowAPI.startResize(direction);
}

export async function getCurrentWindowBounds(): Promise<WindowBounds> {
  return (await windowAPI.getBounds()) ?? { x: 0, y: 0, width: 300, height: 300 };
}

export async function setCurrentWindowBounds(bounds: WindowBounds): Promise<void> {
  await windowAPI.setBounds(bounds);
}

export async function animateCurrentWindowBounds(
  target: WindowBounds,
  durationMs = 180,
): Promise<void> {
  const start = await getCurrentWindowBounds();
  const raf = globalThis.requestAnimationFrame;

  if (!raf || durationMs <= 0) {
    await setCurrentWindowBounds(target);
    return;
  }

  await new Promise<void>((resolve, reject) => {
    const startedAt = globalThis.performance?.now() ?? Date.now();

    const step = (timestamp: number) => {
      const elapsed = timestamp - startedAt;
      const progress = Math.min(1, elapsed / durationMs);
      const eased = 1 - Math.pow(1 - progress, 3);

      const next: WindowBounds = {
        x: interpolate(start.x, target.x, eased),
        y: interpolate(start.y, target.y, eased),
        width: interpolate(start.width, target.width, eased),
        height: interpolate(start.height, target.height, eased),
      };

      void setCurrentWindowBounds(next)
        .then(() => {
          if (progress < 1) {
            raf(step);
          } else {
            resolve();
          }
        })
        .catch(reject);
    };

    raf(step);
  });
}

function interpolate(start: number, end: number, progress: number): number {
  return Math.round(start + (end - start) * progress);
}
