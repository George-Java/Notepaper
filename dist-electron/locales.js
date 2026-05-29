"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveLocale = resolveLocale;
exports.appName = appName;
exports.mainWindowTitle = mainWindowTitle;
exports.notepadWindowTitle = notepadWindowTitle;
exports.tileWindowTitle = tileWindowTitle;
exports.trayTooltip = trayTooltip;
exports.trayShowMainLabel = trayShowMainLabel;
exports.trayQuickNoteLabel = trayQuickNoteLabel;
exports.trayToggleCloseToTrayLabel = trayToggleCloseToTrayLabel;
exports.trayToggleAutostartLabel = trayToggleAutostartLabel;
exports.trayQuitLabel = trayQuitLabel;
function resolveLocale(tag) {
  const value = (tag ?? "").trim().toLowerCase();
  if (value === "en-us" || value === "en") return "en-US";
  if (value === "zh-hk" || value === "zh-tw" || value === "zh-hant") return "zh-HK";
  return "zh-CN";
}
function appName(locale) {
  switch (locale) {
    case "zh-CN":
      return "花笺";
    case "en-US":
      return "Floral Notepaper";
    case "zh-HK":
      return "花箋";
  }
}
function mainWindowTitle(locale) {
  return appName(locale);
}
function notepadWindowTitle(locale) {
  switch (locale) {
    case "zh-CN":
      return "花笺便签";
    case "en-US":
      return "Floral Notepaper Quick Note";
    case "zh-HK":
      return "花箋便箋";
  }
}
function tileWindowTitle(locale) {
  switch (locale) {
    case "zh-CN":
      return "花笺磁贴";
    case "en-US":
      return "Floral Notepaper Pin Mode";
    case "zh-HK":
      return "花箋磁貼";
  }
}
function trayTooltip(locale) {
  return appName(locale);
}
function trayShowMainLabel(locale) {
  switch (locale) {
    case "zh-CN":
      return "打开主窗口";
    case "en-US":
      return "Open Main Window";
    case "zh-HK":
      return "打開主視窗";
  }
}
function trayQuickNoteLabel(locale) {
  switch (locale) {
    case "zh-CN":
      return "快速记录";
    case "en-US":
      return "Quick Note";
    case "zh-HK":
      return "快速便箋";
  }
}
function trayToggleCloseToTrayLabel(locale) {
  switch (locale) {
    case "zh-CN":
      return "关闭到托盘";
    case "en-US":
      return "Close to Tray";
    case "zh-HK":
      return "關閉到系統匣";
  }
}
function trayToggleAutostartLabel(locale) {
  switch (locale) {
    case "zh-CN":
      return "开机自启动";
    case "en-US":
      return "Launch on Startup";
    case "zh-HK":
      return "開機自啟";
  }
}
function trayQuitLabel(locale) {
  switch (locale) {
    case "zh-CN":
      return "退出";
    case "en-US":
      return "Quit";
    case "zh-HK":
      return "退出";
  }
}
//# sourceMappingURL=locales.js.map
