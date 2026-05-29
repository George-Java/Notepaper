import { useState, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import rehypeRaw from "rehype-raw";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import type { Pluggable } from "unified";
import { openUrl } from "../../electron-adapter";
import type { Components } from "react-markdown";
import hljs from "highlight.js/lib/core";
import javascript from "highlight.js/lib/languages/javascript";
import typescript from "highlight.js/lib/languages/typescript";
import python from "highlight.js/lib/languages/python";
import bash from "highlight.js/lib/languages/bash";
import css from "highlight.js/lib/languages/css";
import xml from "highlight.js/lib/languages/xml";
import json from "highlight.js/lib/languages/json";
import yaml from "highlight.js/lib/languages/yaml";
import markdown from "highlight.js/lib/languages/markdown";
import rust from "highlight.js/lib/languages/rust";
import go from "highlight.js/lib/languages/go";
import java from "highlight.js/lib/languages/java";
import php from "highlight.js/lib/languages/php";
import ruby from "highlight.js/lib/languages/ruby";
import sql from "highlight.js/lib/languages/sql";
import c from "highlight.js/lib/languages/c";
import cpp from "highlight.js/lib/languages/cpp";
import csharp from "highlight.js/lib/languages/csharp";
import swift from "highlight.js/lib/languages/swift";
import kotlin from "highlight.js/lib/languages/kotlin";
import shell from "highlight.js/lib/languages/shell";
import diff from "highlight.js/lib/languages/diff";
import plaintext from "highlight.js/lib/languages/plaintext";
import "katex/dist/katex.min.css";

hljs.registerLanguage("javascript", javascript);
hljs.registerLanguage("typescript", typescript);
hljs.registerLanguage("python", python);
hljs.registerLanguage("bash", bash);
hljs.registerLanguage("css", css);
hljs.registerLanguage("html", xml);
hljs.registerLanguage("json", json);
hljs.registerLanguage("xml", xml);
hljs.registerLanguage("yaml", yaml);
hljs.registerLanguage("markdown", markdown);
hljs.registerLanguage("rust", rust);
hljs.registerLanguage("go", go);
hljs.registerLanguage("java", java);
hljs.registerLanguage("php", php);
hljs.registerLanguage("ruby", ruby);
hljs.registerLanguage("sql", sql);
hljs.registerLanguage("c", c);
hljs.registerLanguage("cpp", cpp);
hljs.registerLanguage("csharp", csharp);
hljs.registerLanguage("swift", swift);
hljs.registerLanguage("kotlin", kotlin);
hljs.registerLanguage("shell", shell);
hljs.registerLanguage("diff", diff);
hljs.registerLanguage("plaintext", plaintext);

const LANGUAGES = [
  { value: "plaintext", label: "Plain Text" },
  { value: "javascript", label: "JavaScript" },
  { value: "typescript", label: "TypeScript" },
  { value: "python", label: "Python" },
  { value: "java", label: "Java" },
  { value: "cpp", label: "C++" },
  { value: "c", label: "C" },
  { value: "csharp", label: "C#" },
  { value: "go", label: "Go" },
  { value: "rust", label: "Rust" },
  { value: "swift", label: "Swift" },
  { value: "kotlin", label: "Kotlin" },
  { value: "ruby", label: "Ruby" },
  { value: "php", label: "PHP" },
  { value: "bash", label: "Bash" },
  { value: "shell", label: "Shell" },
  { value: "sql", label: "SQL" },
  { value: "html", label: "HTML" },
  { value: "xml", label: "XML" },
  { value: "css", label: "CSS" },
  { value: "json", label: "JSON" },
  { value: "yaml", label: "YAML" },
  { value: "markdown", label: "Markdown" },
  { value: "diff", label: "Diff" },
];

const LANGUAGE_MAP = new Map(LANGUAGES.map((l) => [l.value, l.label]));

const LANGUAGE_ALIASES: Record<string, string> = {
  js: "javascript",
  ts: "typescript",
  py: "python",
  rb: "ruby",
  sh: "bash",
  zsh: "bash",
  yml: "yaml",
  md: "markdown",
  cs: "csharp",
  cpp: "cpp",
  cxx: "cpp",
  h: "c",
  rs: "rust",
  kt: "kotlin",
};

function normalizeLanguage(lang: string | null): string {
  if (!lang) return "plaintext";
  const lower = lang.toLowerCase();
  if (LANGUAGE_ALIASES[lower]) return LANGUAGE_ALIASES[lower];
  if (LANGUAGE_MAP.has(lower)) return lower;
  return "plaintext";
}

interface CodeBlockState {
  language: string;
  code: string;
}

function extractCodeBlockInfo(children: React.ReactNode): CodeBlockState | null {
  if (!children) return null;
  const child = Array.isArray(children) ? children[0] : children;
  if (!child || typeof child !== "object" || !("props" in child)) return null;
  const elem = child as React.ReactElement<{ className?: string; children?: React.ReactNode }>;
  const className = elem.props?.className ?? "";
  const langMatch = /language-(\S+)/.exec(className);
  const language = normalizeLanguage(langMatch?.[1] ?? null);
  const raw = elem.props?.children;
  const code = typeof raw === "string" ? raw : Array.isArray(raw) ? raw.join("") : "";
  return { language, code };
}

function extractText(node: React.ReactNode): string {
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (node == null || typeof node === "boolean") return "";
  if (Array.isArray(node)) return node.map(extractText).join("");
  if (typeof node === "object" && "props" in node) {
    return extractText((node as React.ReactElement<{ children?: React.ReactNode }>).props.children);
  }
  return "";
}

function CodeBlock({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const [showLangMenu, setShowLangMenu] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState<string | null>(null);
  const info = useMemo(() => extractCodeBlockInfo(children), [children]);
  const effectiveLang = selectedLanguage ?? info?.language ?? "plaintext";
  const showLangLabel =
    Boolean(selectedLanguage) || (info?.language && info.language !== "plaintext");

  const highlighted = useMemo(() => {
    if (!info) return "";
    const lang = effectiveLang === "plaintext" ? undefined : effectiveLang;
    try {
      if (lang && hljs.getLanguage(lang)) {
        return hljs.highlight(info.code, { language: lang }).value;
      }
      return hljs.highlightAuto(info.code).value;
    } catch {
      return escapeHtml(info.code);
    }
  }, [info, effectiveLang]);

  const handleCopy = useCallback(() => {
    const text = extractText(children);
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [children]);

  const handleSelectLanguage = (lang: string) => {
    setSelectedLanguage(lang);
    setShowLangMenu(false);
  };

  return (
    <div className="my-3 rounded-lg border border-paper-deep/40 overflow-hidden">
      <div className="flex items-center justify-between px-3 py-1.5 bg-paper-warm/60 border-b border-paper-deep/20">
        <div className="flex items-center gap-2">
          {showLangLabel && (
            <span className="text-[10px] font-mono text-ink-faint/60 bg-paper-deep/25 px-1.5 py-0.5 rounded">
              {LANGUAGE_MAP.get(effectiveLang) ?? effectiveLang}
            </span>
          )}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowLangMenu(!showLangMenu)}
              className="text-[10px] font-mono text-ink-ghost hover:text-ink-faint px-1 py-0.5 rounded hover:bg-paper-deep/20 transition-colors cursor-pointer"
              title={t("markdown.selectLanguage", { defaultValue: "选择编程语言" })}
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="inline-block mr-0.5"
              >
                <path d="M4 4h16v14H7l-3 3V4z" />
                <path d="M8 9h4M8 13h2" />
              </svg>
              {showLangLabel
                ? t("markdown.changeLanguage", { defaultValue: "切换" })
                : t("markdown.chooseLanguage", { defaultValue: "选择语言" })}
            </button>
            {showLangMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowLangMenu(false)} />
                <div className="absolute left-0 top-full mt-1 z-50 bg-paper border border-paper-deep/40 rounded-lg shadow-lg max-h-56 overflow-y-auto min-w-[140px] py-1">
                  {LANGUAGES.map((lang) => (
                    <button
                      key={lang.value}
                      type="button"
                      onClick={() => handleSelectLanguage(lang.value)}
                      className={`w-full text-left px-3 py-1.5 text-[11px] font-mono hover:bg-bamboo-mist/30 transition-colors cursor-pointer ${
                        effectiveLang === lang.value
                          ? "text-bamboo font-medium bg-bamboo-mist/20"
                          : "text-ink-soft"
                      }`}
                    >
                      {lang.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={handleCopy}
          className="px-1.5 py-0.5 rounded text-[10px] font-mono text-ink-ghost hover:bg-paper-deep/30 hover:text-ink-soft transition-all cursor-pointer"
        >
          {copied
            ? t("markdown.copied", { defaultValue: "已复制" })
            : t("markdown.copy", { defaultValue: "复制" })}
        </button>
      </div>
      <pre className="px-4 py-3 overflow-x-auto bg-paper-warm/40 text-[0.82em] font-mono leading-relaxed hljs-wrapper">
        <code
          className={`hljs${effectiveLang !== "plaintext" ? ` language-${effectiveLang}` : ""}`}
          dangerouslySetInnerHTML={{ __html: highlighted }}
        />
      </pre>
    </div>
  );
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

interface MarkdownPreviewProps {
  content: string;
  fontSize?: number;
  renderHtml?: boolean;
}

const remarkPlugins = [remarkGfm, remarkMath];
const sanitizeSchema = {
  ...defaultSchema,
  tagNames: [...(defaultSchema.tagNames ?? []), "mark", "center", "font", "u", "abbr", "span"],
  attributes: {
    ...defaultSchema.attributes,
    "*": [...(defaultSchema.attributes?.["*"] ?? []), "style", "className", "class"],
    font: ["color", "size", "face"],
    abbr: ["title"],
    span: ["className", "class"],
    code: ["className", "class"],
  },
};
const rehypePluginsDefault = [rehypeKatex];
const rehypePluginsWithHtml: Pluggable[] = [
  rehypeRaw,
  [rehypeSanitize, sanitizeSchema],
  rehypeKatex,
];

const components: Components = {
  h1: ({ children }) => (
    <h1 className="text-[1.57em] font-display font-bold text-ink mt-6 mb-4 tracking-wide">
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 className="text-[1.21em] font-display font-bold text-ink mt-7 mb-3 tracking-wide">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-[1.07em] font-display font-bold text-ink mt-5 mb-2 tracking-wide">
      {children}
    </h3>
  ),
  h4: ({ children }) => (
    <h4 className="text-[1em] font-display font-semibold text-ink mt-4 mb-2 tracking-wide">
      {children}
    </h4>
  ),
  p: ({ children }) => <p className="text-ink-soft leading-[1.9]">{children}</p>,
  strong: ({ children }) => <strong className="font-semibold text-ink">{children}</strong>,
  em: ({ children }) => <em className="italic text-bamboo-light">{children}</em>,
  blockquote: ({ children }) => (
    <blockquote className="border-l-2 border-bamboo/40 pl-4 my-3 text-ink-soft/80 italic leading-[1.9]">
      {children}
    </blockquote>
  ),
  ul: ({ children }) => (
    <ul className="ml-4 text-ink-soft leading-[1.9] list-disc list-outside marker:text-bamboo/40">
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className="ml-4 text-ink-soft leading-[1.9] list-decimal list-outside marker:text-bamboo/50 marker:font-mono marker:text-[0.85em]">
      {children}
    </ol>
  ),
  li: ({ children }) => <li className="text-ink-soft leading-[1.9]">{children}</li>,
  hr: () => (
    <hr className="my-6 border-none h-px bg-gradient-to-r from-transparent via-paper-deep to-transparent" />
  ),
  code: ({ className, children }) => {
    const isBlock = className?.startsWith("language-") || String(children).includes("\n");
    if (isBlock) {
      return <code className={className}>{children}</code>;
    }
    return (
      <code className="px-1.5 py-0.5 text-[0.85em] font-mono bg-paper-warm rounded text-bamboo">
        {children}
      </code>
    );
  },
  pre: ({ children }) => <CodeBlock>{children}</CodeBlock>,
  a: ({ href, children }) => (
    <a
      href={href}
      onClick={(e) => {
        e.preventDefault();
        if (href && /^https?:\/\//i.test(href)) openUrl(href);
      }}
      className="text-bamboo hover:text-bamboo-light underline underline-offset-2 cursor-pointer"
    >
      {children}
    </a>
  ),
  table: ({ children }) => (
    <div className="my-3 overflow-x-auto">
      <table className="w-full text-[0.93em] border-collapse border border-paper-deep/50">
        {children}
      </table>
    </div>
  ),
  th: ({ children }) => (
    <th className="text-left px-3 py-1.5 border border-paper-deep/40 font-semibold text-ink text-[0.85em] bg-paper-warm/50">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="px-3 py-1.5 border border-paper-deep/35 text-ink-soft">{children}</td>
  ),
  input: ({ checked, ...props }) => (
    <input {...props} checked={checked} disabled className="mr-1.5 accent-bamboo" />
  ),
};

export function MarkdownPreview({
  content,
  fontSize = 14,
  renderHtml = false,
}: MarkdownPreviewProps) {
  const { t } = useTranslation();
  return (
    <div className="font-body" style={{ fontSize: `${fontSize}px` }}>
      {content.trim() ? (
        <Markdown
          remarkPlugins={remarkPlugins}
          rehypePlugins={renderHtml ? rehypePluginsWithHtml : rehypePluginsDefault}
          components={components}
        >
          {content}
        </Markdown>
      ) : (
        <p className="text-ink-ghost leading-[1.9]">
          {t("markdown.emptyHint", { defaultValue: "预览区会显示当前笔记内容" })}
        </p>
      )}
    </div>
  );
}
