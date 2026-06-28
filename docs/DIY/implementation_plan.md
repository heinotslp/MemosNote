# Memos 桌面化及音乐播放器功能改善方案

本方案旨在为 Memos 笔记项目添加全局悬浮式音乐播放器，并利用 Tauri 框架将其打包为独立的桌面客户端软件。

## User Review Required

> [!IMPORTANT]
> **关于构建环境的要求**
> 本地打包为桌面程序（Tauri）需要在您的开发机上安装有 **Rust** 编译环境（含有 Cargo）以及 **Go** 和 **Node.js**。如果您没有安装这些工具，我们仍可以在网页版中为您实现音乐播放器，或为您提供预编译桌面包的打包思路。目前该方案仅定义文件结构与配置，在您同意后才会开始写入并指导您如何本地编译。

> [!TIP]
> **音乐播放器的运作方式**
> 播放器将支持两种音频来源：
> 1. 自动扫描用户上传到笔记（Memos）中的音频附件（通过 gRPC/HTTP API 提取 MIME 类型为 `audio/*` 的附件）。
> 2. 用户手动在界面上输入外部音频 URL (如公网 MP3、流媒体电台)，方便边写笔记边听音乐。

---

## Open Questions

> [!NOTE]
> **请确认以下偏好：**
> 1. **默认存储位置**：作为桌面软件时，您希望默认把笔记数据库（SQLite）保存在系统的哪个目录？（例如用户目录 `.memos/memos.db`，还是跟随软件所在的当前目录？）
> 2. **音乐播放器样式**：是否需要支持网易云、QQ 音乐等外部歌单解析，或者目前仅支持 **音频附件扫描 + 外部音频直链播放** 就已足够？

---

## Proposed Changes

### Component 1: 前端全局浮动音乐播放器 (Floating Music Player)

在前端最高级组件中插入全局悬浮播放器，保证路由切换时音乐流畅不中断。

#### [NEW] [FloatingMusicPlayer.tsx](file:///c:/Projects/MemosNotes/memos/web/src/components/FloatingMusicPlayer/FloatingMusicPlayer.tsx)
创建全局播放器核心组件，其功能逻辑包括：
*   使用原生 HTML5 `<audio>` 播放核心。
*   **状态控制**：播放/暂停、上一首/下一首、音量滑动、静音、播放速度调节 (1x, 1.5x, 2x)。
*   **播放模式**：顺序播放、单曲循环、随机播放。
*   **数据源**：
    *   通过 `memoServiceClient.listMemos` 接口获取所有包含音频附件的 Memo，提取出音频 URL、文件名、创建时间等构建本地播放列表。
    *   提供输入框，支持用户直接添加网络音频直链（如 `http://.../*.mp3`）。
*   **Aesthetics (视觉特效)**：
    *   采用玻璃拟态（Glassmorphism）半透明悬浮面板设计，使用 `bg-background/80 backdrop-blur-md` 属性。
    *   左侧配备黑胶唱片（Vinyl）式旋转封面图动画，播放时匀速旋转，暂停时平滑停止。
    *   一键折叠（Minimize）功能，收起为一个可拖拽定位的圆形音乐律动图标。
*   **持久化**：使用 `localStorage` 保存当前的播放进度、音量大小、播放速度、列表顺序及播放面板在屏幕中的停靠位置。

#### [NEW] [index.ts](file:///c:/Projects/MemosNotes/memos/web/src/components/FloatingMusicPlayer/index.ts)
导出组件的入口文件。

#### [MODIFY] [RootLayout.tsx](file:///c:/Projects/MemosNotes/memos/web/src/layouts/RootLayout.tsx)
在页面主容器 `<main>` 底部挂载 `<FloatingMusicPlayer />` 组件，使其在整个应用运行生命周期中常驻。

---

### Component 2: Tauri 桌面端封装配置 (Desktop Shell)

在根目录下创建 `src-tauri` 文件夹，配置边车（Sidecar）拉起机制，将 Go 后端打包进桌面程序。

#### [NEW] [tauri.conf.json](file:///c:/Projects/MemosNotes/memos/src-tauri/tauri.conf.json)
配置桌面壳应用：
*   **Bundle 标识符**：`com.usememos.desktop`
*   **窗口配置**：主窗口默认尺寸 1200x800，支持拖拽、原生标题栏或自定义无边框。
*   **边车配置 (Sidecar)**：在 `bundle > externalBin` 中声明边车进程 `memos-backend`。
*   **权限设定**：开启网络请求及子进程拉起（shell）权限。

#### [NEW] [Cargo.toml](file:///c:/Projects/MemosNotes/memos/src-tauri/Cargo.toml)
声明 Tauri 运行所需的 Rust 依赖，包括 `tauri`、`tokio`（用于异步运行 Go 服务端口探测）等。

#### [NEW] [main.rs](file:///c:/Projects/MemosNotes/memos/src-tauri/src/main.rs)
编写桌面主进程逻辑：
1.  **自动端口探测**：查找本地可用随机端口，避免固定 `5230` 端口冲突导致启动失败。
2.  **边车拉起**：运行 `memos-backend` (Go 二进制文件)，并通过命令行参数传入自定端口与数据存储目录参数（例如 `--port [RANDOM_PORT] --data [USER_DIR]/.memos`）。
3.  **载入 WebView**：启动完毕后，控制 Tauri 主窗口 WebView 跳转至 `http://localhost:[RANDOM_PORT]`。
4.  **进程守卫与清理**：监听窗口销毁事件，在退出桌面客户端时，向 Go 边车进程发送终止信号（如 SIGINT / kill），确保后台无残留的僵尸进程。
5.  **系统托盘**：添加系统托盘菜单，支持“最小化到托盘”和“开机自启”设置。

#### [NEW] [build.rs](file:///c:/Projects/MemosNotes/memos/src-tauri/build.rs)
Tauri 的编译入口脚本。

---

## Verification Plan

### Automated Tests
*   **前端静态代码检查**：
    ```bash
    cd web
    pnpm lint
    pnpm test
    ```
*   **Go 后端构建测试**：
    ```bash
    go build -o test-memos.exe ./cmd/memos/main.go
    ```

### Manual Verification
1.  **网页端功能验证**：
    *   在网页端运行并登录，点击“扫描附件”按钮，检查是否能提取出笔记中的音频附件并生成播放列表。
    *   测试歌曲切换、音量调节、播放速度是否正常。
    *   刷新页面，测试播放器是否能恢复上一次的曲目、进度和音量。
2.  **桌面端运行验证**：
    *   在开发环境下运行 `cargo tauri dev`（或 `pnpm tauri dev`）。
    *   确认 Memos 界面在 Tauri 窗口中正确呈现。
    *   关闭软件，在任务管理器中核实 `memos-backend.exe` 是否彻底退出。
