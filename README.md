<!-- markdownlint-disable -->

<div align="center">

<img src="./build/icon.png" width="120" alt="花笺图标">

# 花笺 Floral Notepaper

轻量、优雅、现代化的本地便签工具<br>
基于 Electron + React 构建

原项目仓库：[Achilng/floral-notepaper](https://github.com/Achilng/floral-notepaper)

</div>

<!-- markdownlint-restore -->

---

## 为什么选择花笺

市面上现有的笔记或便签软件，要么功能繁重、上手门槛高，要么界面陈旧、久未更新。花笺因此而生，其特点是轻便、随呼随用，同时提供现代化的界面与舒适的编辑体验。

## 功能特点

- **Markdown 编辑与预览** — 支持 GitHub Flavored Markdown 语法，实时切换编辑和预览模式

  ![主窗口截图](docs/images/主窗口截图.png)

- **快捷便签** — 通过托盘随时唤出便签窗口，支持多开

  ![小窗多开示例](docs/images/小窗多开示例.gif)

- **导入导出** — 支持 `.md` 文件的导入和导出

## 应用场景

- 当作随时可见的剪贴板，快速暂存和复制文本
- 游戏、看视频时随手记点东西
- 临时记录思路或灵感
- 桌面待办清单

## 下载安装

前往 [GitHub Releases](https://github.com/Achilng/floral-notepaper/releases) 下载最新版本。

## 从源码构建

### 环境要求

- [Node.js](https://nodejs.org/) 18+

### 步骤

```bash
git clone https://github.com/Achilng/floral-notepaper.git
cd floral-notepaper

npm install

# 开发模式
npm run dev:electron

# 构建 Windows 版本
npm run build:win

# 构建 macOS 版本
npm run build:mac

# 构建 Linux 版本
npm run build:linux
```

构建产物输出到 `release/`。

### 项目结构

```
Notepaper/
├── electron/            # Electron 主进程
│   ├── main.ts          # 应用入口
│   ├── preload.ts       # 预加载脚本
│   ├── window-manager.ts # 窗口管理
│   ├── notes-store.ts   # 笔记存储
│   ├── tray-manager.ts  # 托盘管理
│   └── locales.ts       # 多语言（主进程）
├── src/                 # React 渲染进程
│   ├── components/      # UI 组件
│   ├── features/        # 功能模块
│   │   ├── importExport/ # 导入导出
│   │   ├── markdown/     # Markdown 渲染
│   │   ├── notes/        # 笔记管理
│   │   ├── settings/     # 设置
│   │   └── windows/      # 窗口操作
│   ├── locales/         # 多语言（渲染进程）
│   ├── types/           # TypeScript 类型声明
│   ├── assets/          # 静态资源（字体等）
│   ├── App.tsx          # React 根组件
│   ├── main.tsx         # React 入口
│   └── electron-adapter.ts # Electron API 封装
├── build/               # 构建资源（图标等）
├── docs/                # 文档截图
├── electron-builder.yml # Electron Builder 配置
├── vite.config.ts       # Vite 构建配置
└── package.json
```

## 关于本项目

本项目基于 [Achilng/floral-notepaper](https://github.com/Achilng/floral-notepaper) 进行二次开发。原项目使用 Tauri 2 + Rust 构建，本版本将其移植到 Electron 平台。感谢原作者的出色设计和开源精神。

## 贡献

欢迎提交 Issue 和 Pull Request。

## 许可证

[MIT](LICENSE)
