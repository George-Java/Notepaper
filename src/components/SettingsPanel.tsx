import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { AppConfig, ThemeOption, ViewMode } from "../features/settings/types";
import { applyTheme, watchSystemTheme } from "../features/settings/theme";
import { SUPPORTED_LOCALES } from "../locales/locale-whitelist";
import { SlidingButtonGroup } from "./SlidingButtonGroup";

const HARMONY_FONT_LICENSE_URL = new URL("../assets/fonts/LICENSE_Fonts", import.meta.url).href;

interface SettingsPanelProps {
  config: AppConfig;
  onChange: (config: AppConfig) => void;
  onChooseNotesDir: () => void;
  onClose: () => void;
}

export function SettingsPanel({ config, onChange, onChooseNotesDir, onClose }: SettingsPanelProps) {
  const { t } = useTranslation();
  const setConfigValue = <Key extends keyof AppConfig>(key: Key, value: AppConfig[Key]) => {
    onChange({ ...config, [key]: value });
  };
  const themeOptions = useMemo<Array<{ value: ThemeOption; label: string }>>(
    () => [
      { value: "light", label: t("settings.theme.light", { defaultValue: "浅色" }) },
      { value: "dark", label: t("settings.theme.dark", { defaultValue: "深色" }) },
      {
        value: "system",
        label: t("settings.theme.system", { defaultValue: "跟随系统" }),
      },
    ],
    [t],
  );
  const viewModes = useMemo<Array<{ value: ViewMode; label: string }>>(
    () => [
      { value: "edit", label: t("settings.defaultView.edit", { defaultValue: "编辑" }) },
      { value: "split", label: t("settings.defaultView.split", { defaultValue: "分栏" }) },
      {
        value: "preview",
        label: t("settings.defaultView.preview", { defaultValue: "预览" }),
      },
    ],
    [t],
  );
  const localeOptions = useMemo(
    () =>
      SUPPORTED_LOCALES.map((locale) => ({
        value: locale,
        label:
          locale === "zh-CN"
            ? t("settings.locale.zhCN", { defaultValue: "简体中文" })
            : locale === "en-US"
              ? t("settings.locale.enUS", { defaultValue: "English" })
              : t("settings.locale.zhHK", { defaultValue: "繁體中文" }),
      })),
    [t],
  );

  return (
    <aside className="w-[360px] h-full shrink-0 border-l border-paper-deep/30 bg-cloud/92 backdrop-blur-sm flex flex-col">
      <div className="flex items-center justify-between h-11 px-4 border-b border-paper-deep/25">
        <h2 className="text-[13px] font-display font-medium text-ink-soft">
          {t("settings.title", { defaultValue: "应用设置" })}
        </h2>
        <button
          type="button"
          onClick={onClose}
          className="w-7 h-7 flex items-center justify-center rounded-lg text-ink-ghost hover:text-ink-soft hover:bg-paper-warm transition-colors cursor-pointer"
          title={t("settings.closeTitle", { defaultValue: "关闭设置" })}
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          >
            <path d="M2 2l8 8M10 2l-8 8" />
          </svg>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-hidden px-4 py-4 space-y-5">
        <section className="space-y-2">
          <label className="block text-[11px] font-body text-ink-faint">
            {t("settings.theme.label", { defaultValue: "主题" })}
          </label>
          <SlidingButtonGroup
            options={themeOptions}
            value={config.theme}
            onChange={(v: ThemeOption) => {
              setConfigValue("theme", v);
              applyTheme(v);
              watchSystemTheme(v);
            }}
          />
        </section>

        <section className="space-y-2">
          <label className="block text-[11px] font-body text-ink-faint">
            {t("settings.notesDir", { defaultValue: "笔记目录" })}
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={config.notesDir}
              readOnly
              className="min-w-0 flex-1 h-8 px-2.5 rounded-lg bg-paper-warm/70 border border-paper-deep/40 text-[11px] font-mono text-ink-faint truncate"
            />
            <button
              type="button"
              onClick={onChooseNotesDir}
              className="h-8 px-3 rounded-lg border border-paper-deep/45 text-[11px] text-ink-faint hover:text-bamboo hover:bg-bamboo-mist/50 transition-colors cursor-pointer"
            >
              {t("settings.selectFolder", { defaultValue: "选择文件夹" })}
            </button>
          </div>
        </section>

        <section className="space-y-2">
          <label className="block text-[11px] font-body text-ink-faint">
            {t("settings.locale.label", { defaultValue: "语言" })}
          </label>
          <SlidingButtonGroup
            options={localeOptions}
            value={config.locale}
            onChange={(value) => setConfigValue("locale", value)}
          />
        </section>

        <section className="space-y-2">
          <ToggleRow
            label={t("settings.closeToTray", { defaultValue: "关闭到托盘" })}
            checked={config.closeToTray}
            onChange={(checked) => setConfigValue("closeToTray", checked)}
          />
          <ToggleRow
            label={t("settings.autoSave.note", { defaultValue: "自动保存笔记" })}
            checked={config.noteAutoSave}
            onChange={(checked) => setConfigValue("noteAutoSave", checked)}
          />
          <ToggleRow
            label={t("settings.autoSave.surface", { defaultValue: "小窗笔记自动保存" })}
            checked={config.noteSurfaceAutoSave}
            onChange={(checked) => setConfigValue("noteSurfaceAutoSave", checked)}
          />
          <ToggleRow
            label={t("settings.autoSave.externalFile", { defaultValue: "外部文件自动保存" })}
            checked={config.externalFileAutoSave}
            onChange={(checked) => setConfigValue("externalFileAutoSave", checked)}
          />
          <ToggleRow
            label={t("settings.rememberSurfaceSize", { defaultValue: "记住小窗尺寸" })}
            checked={config.rememberSurfaceSize}
            onChange={(checked) => setConfigValue("rememberSurfaceSize", checked)}
          />
          <ToggleRow
            label={t("settings.renderHtmlMarkdown", { defaultValue: "允许 HTML 标签渲染" })}
            checked={config.renderHtmlMarkdown}
            onChange={(checked) => setConfigValue("renderHtmlMarkdown", checked)}
          />
        </section>

        <section className="space-y-2">
          <label className="block text-[11px] font-body text-ink-faint">
            {t("settings.fontSize.editor", { defaultValue: "编辑器字号" })}
          </label>
          <div className="flex items-center gap-3 h-9 rounded-lg px-2.5 bg-paper-warm/45 border border-paper-deep/25">
            <input
              type="range"
              min={8}
              max={30}
              step={1}
              value={config.fontSize ?? 14}
              onChange={(event) => setConfigValue("fontSize", Number(event.target.value))}
              className="flex-1 h-1 accent-bamboo cursor-pointer appearance-none bg-transparent [&::-webkit-slider-runnable-track]:h-[3px] [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:bg-paper-deep/50 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-bamboo [&::-webkit-slider-thumb]:-mt-[4.5px] [&::-webkit-slider-thumb]:shadow-[0_1px_3px_rgba(0,0,0,0.15)]"
            />
            <span className="text-[12px] font-mono text-ink-soft tabular-nums w-8 text-right">
              {config.fontSize ?? 14}px
            </span>
          </div>
        </section>

        <section className="space-y-2">
          <label className="block text-[11px] font-body text-ink-faint">
            {t("settings.tabIndentSize", { defaultValue: "Tab 缩进宽度" })}
          </label>
          <div className="flex items-center gap-3 h-9 rounded-lg px-2.5 bg-paper-warm/45 border border-paper-deep/25">
            <input
              type="range"
              min={1}
              max={8}
              step={1}
              value={config.tabIndentSize ?? 2}
              onChange={(event) => setConfigValue("tabIndentSize", Number(event.target.value))}
              className="flex-1 h-1 accent-bamboo cursor-pointer appearance-none bg-transparent [&::-webkit-slider-runnable-track]:h-[3px] [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:bg-paper-deep/50 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-bamboo [&::-webkit-slider-thumb]:-mt-[4.5px] [&::-webkit-slider-thumb]:shadow-[0_1px_3px_rgba(0,0,0,0.15)]"
            />
            <span className="text-[12px] font-mono text-ink-soft tabular-nums w-10 text-right">
              {config.tabIndentSize ?? 2}
            </span>
          </div>
        </section>

        <section className="space-y-2">
          <label className="block text-[11px] font-body text-ink-faint">
            {t("settings.defaultView.label", { defaultValue: "默认视图" })}
          </label>
          <SlidingButtonGroup
            options={viewModes}
            value={config.defaultViewMode}
            onChange={(v) => setConfigValue("defaultViewMode", v)}
          />
        </section>

        <section className="pt-2 border-t border-paper-deep/25">
          <p className="text-[10px] leading-relaxed text-ink-ghost/75">
            <span>
              {t("settings.fontNotice", {
                defaultValue:
                  "Uses HarmonyOS Sans SC font. Copyright 2021 Huawei Device Co., Ltd. Licensed under HarmonyOS Sans Fonts License Agreement.",
              })}
            </span>{" "}
            <a
              href={HARMONY_FONT_LICENSE_URL}
              target="_blank"
              rel="noreferrer"
              className="underline underline-offset-2 hover:text-ink-faint"
            >
              HarmonyOS Sans Fonts License Agreement
            </a>
          </p>
        </section>
      </div>
    </aside>
  );
}

interface ToggleRowProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

function ToggleRow({ label, checked, onChange }: ToggleRowProps) {
  return (
    <label className="flex items-center justify-between h-9 rounded-lg px-2.5 bg-paper-warm/45 border border-paper-deep/25 cursor-pointer">
      <span className="text-[12px] text-ink-soft">{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="sr-only"
      />
      <div
        className={`relative w-8 h-[18px] rounded-full transition-colors duration-250 ease-[cubic-bezier(0.22,1,0.36,1)] ${
          checked ? "bg-bamboo" : "bg-paper-deep/50"
        }`}
      >
        <div
          className={`absolute top-[2px] left-[2px] w-[14px] h-[14px] rounded-full bg-white shadow-[0_1px_2px_rgba(0,0,0,0.15)] transition-transform duration-250 ease-[cubic-bezier(0.22,1,0.36,1)] ${
            checked ? "translate-x-[14px]" : "translate-x-0"
          }`}
        />
      </div>
    </label>
  );
}
