export type Locale = "zh-CN" | "en-US" | "zh-HK";

export function resolveLocale(tag?: string): Locale {
  const value = (tag ?? "").trim().toLowerCase();
  if (value === "en-us" || value === "en") return "en-US";
  if (value === "zh-hk" || value === "zh-tw" || value === "zh-hant") return "zh-HK";
  return "zh-CN";
}

export function appName(locale: Locale): string {
  switch (locale) {
    case "zh-CN":
      return "花笺";
    case "en-US":
      return "Floral Notepaper";
    case "zh-HK":
      return "花箋";
  }
}

export function mainWindowTitle(locale: Locale): string {
  return appName(locale);
}

export function notepadWindowTitle(locale: Locale): string {
  switch (locale) {
    case "zh-CN":
      return "花笺便签";
    case "en-US":
      return "Floral Notepaper Quick Note";
    case "zh-HK":
      return "花箋便箋";
  }
}

export function tileWindowTitle(locale: Locale): string {
  switch (locale) {
    case "zh-CN":
      return "花笺磁贴";
    case "en-US":
      return "Floral Notepaper Pin Mode";
    case "zh-HK":
      return "花箋磁貼";
  }
}

export function trayTooltip(locale: Locale): string {
  return appName(locale);
}

export function trayShowMainLabel(locale: Locale): string {
  switch (locale) {
    case "zh-CN":
      return "打开主窗口";
    case "en-US":
      return "Open Main Window";
    case "zh-HK":
      return "打開主視窗";
  }
}

export function trayQuickNoteLabel(locale: Locale): string {
  switch (locale) {
    case "zh-CN":
      return "快速记录";
    case "en-US":
      return "Quick Note";
    case "zh-HK":
      return "快速便箋";
  }
}

export function trayToggleCloseToTrayLabel(locale: Locale): string {
  switch (locale) {
    case "zh-CN":
      return "关闭到托盘";
    case "en-US":
      return "Close to Tray";
    case "zh-HK":
      return "關閉到系統匣";
  }
}

export function trayToggleAutostartLabel(locale: Locale): string {
  switch (locale) {
    case "zh-CN":
      return "开机自启动";
    case "en-US":
      return "Launch on Startup";
    case "zh-HK":
      return "開機自啟";
  }
}

export function trayQuitLabel(locale: Locale): string {
  switch (locale) {
    case "zh-CN":
      return "退出";
    case "en-US":
      return "Quit";
    case "zh-HK":
      return "退出";
  }
}
