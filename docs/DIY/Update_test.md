# Memos 功能开发验证指南 (Update_test.md)

本文档详述了如何验证新增的**网易云侧边栏嵌入式音乐播放器**和 **Tauri 便携式桌面客户端**。

---

## 阶段一：网页端与网易云音乐播放器验证

此阶段用于验证网页端侧边栏嵌入式音乐播放器和网易云 API 后端代理的功能。

### 1. 启动本地开发服务
1. 打开 PowerShell 终端，进入项目根目录。
2. 运行局部环境激活脚本：
   ```powershell
   .\shell.ps1
   ```
3. 在弹出的 memos-env 终端中，启动后端开发服务：
   ```bash
   go run ./cmd/memos --port 8081
   ```
4. 再打开一个新的普通终端，运行 `.\shell.ps1` 进入 memos-env，然后进入前端目录并启动前端开发服务：
   ```bash
   cd web
   pnpm dev
   ```
5. 打开浏览器，访问 `http://localhost:3001`（或前端控制台打印的 dev 端口）。

### 2. 验证侧边栏嵌入式音乐播放器 UI 与基础控制
* **侧边栏展示**：左侧导航栏已自动展开为 `w-64` 的完整导航侧边栏。登录 Memos 账号后，侧边栏底部应展示精致的嵌入式音乐播放器。
* **手动播放直链**：在播放器底部点击“Play Direct URL Link...”，粘贴一个公开的音频直链（例如 `https://www.w3schools.com/html/horse.mp3`），点击 Play，测试是否能正常播放、暂停、调节音量、静音。

### 3. 验证网易云音乐与播放队列功能
* **扫码登录**：
  1. 点击播放器上的“Login NetEase account”按钮。
  2. 界面上应呈现一个自动生成的二维码。
  3. 用网易云音乐手机 App 扫码并在手机上点击确认登录。
  4. 检查扫描后播放器界面是否在 2 秒内自动感知成功、显示您的网易云头像和昵称。
* **拉取歌单与播放**：
  1. 登录成功后，点击“我的歌单”下拉框，确认能展示您的所有网易云歌单。
  2. 选择一个歌单，确认能正确显示歌单内的歌曲列表（包括封面、歌名、歌手）。
  3. 双击任一歌曲进行播放，验证音乐是否流畅、黑胶唱片旋转动画在播放时旋转、暂停时停止。
* **验证播放列表队列 (Play Queue)**：
  1. 点击播放器控制行的“ListMusic”图标，展开播放队列。
  2. 确认能看到当前歌单里的所有歌曲名字和歌手，当前播放歌曲带有主题高亮（Primary Color）。
  3. 在队列中点击任一其他歌曲，确认可以即刻切歌播放。
  4. 点击“Clear All”按钮，确认播放列表清空，播放状态停止。
* **验证登出逻辑与唱片旋转停止**：
  1. 再次双击歌曲使其处于播放旋转状态，然后点击播放器顶部的“Logout”退出按钮。
  2. 确认网易云 Cookie 清空，专辑唱片封面旋转动画**立即停止**，并且封面恢复为默认音符图标。
* **验证隐式登录失效检测与自动退登**：
  1. **模拟 Cookie 过期**：登录网易云后，在浏览器控制台中打开 Application -> Local Storage，手动将 `memos_netease_cookie` 的内容修改为损坏的假值。
  2. 切换一个歌单或者双击一首歌曲请求网络服务。
  3. 确认系统会弹出警示框提示 `"登录已失效，请重新登录网易云音乐账号"`。
  4. 点击确定，验证播放器是否立即退回了未登录状态的 Login 按钮形态，且重置了所有音频播放状态。

* **验证登录状态跨启动持久化**：
  1. 扫码登录网易云账号，拉取播放列表并正常播放。
  2. 彻底退出 Memos 桌面程序或刷新网页端（即使每次刷新动态分配随机端口）。
  3. 重新打开/刷新，确认播放器能够在 1 秒内自动完成隐式登录，拉取到您的头像、昵称及歌单，而**不需要**您重新扫码。

### 4. 验证 Everforest 系列护眼主题
1. 登录 Memos，点击左侧导航栏的 **Settings**（设置）按钮，选择 **Preferences**（偏好设置）。
2. 在 **Theme**（主题）选择下拉框中，确认存在两个带有 `Leaf`（叶子）图标的主题：**Everforest Dark** 和 **Everforest Light**。
3. 选择 **Everforest Dark**，验证页面背景切换为护眼石板绿暗色系（`#2b3339`）。
4. 选择 **Everforest Light**，验证页面整体切换为优雅温润的浅色系（背景 `#fdf6e3`，文本 `#5c6a72`），检查侧边栏播放器中的音乐图标和 Logout 按钮颜色已完美变为主题契合的蓝绿色，无任何红色残留。

---

## 阶段二：Tauri 桌面端便携性验证

此阶段用于验证 Tauri 桌面外壳的端口探测、Go 边车拉起、SQLite 随程便携化以及关闭时的进程安全清理。

> [!WARNING]
> **Windows 构建依赖项**
> 本地编译 Windows 桌面程序需要安装有 **C++ Build Tools for Visual Studio**（其中包含 MSVC 链接器 `link.exe`）。
> 如果在运行 `pnpm tauri dev` 编译时提示 `error: linker 'link.exe' not found`，请从 [微软官网](https://visualstudio.microsoft.com/visual-cpp-build-tools/) 下载并安装 "C++ 生成工具" 并重新启动 Shell 会话。

### 1. 编译 Go 边车程序
为了让 Tauri 打包 Go 后端，我们需要先编译出 Go 可执行程序并放置在 Tauri 指定的边车目录：
1. 打开 PowerShell 终端，进入项目根目录。
2. 运行以下命令：
   ```powershell
   # 1. 临时指定本地 Go 环境的 GOROOT 并创建 Tauri 外部二进制目录
   $env:GOROOT = "$PWD\.devenv\go"
   New-Item -ItemType Directory -Force .\src-tauri\bin
   
   # 2. 编译 Go 后端二进制边车，并在文件名中附加系统 Target Triple 标识
   & .\.devenv\go\bin\go.exe build -o .\src-tauri\bin\memos-backend-x86_64-pc-windows-msvc.exe ./cmd/memos
   ```

### 2. 启动桌面端开发调试
1. 激活环境：
   ```powershell
   .\shell.ps1
   ```
2. 进入 `src-tauri` 或根目录运行 Tauri 调试命令：
   ```bash
   pnpm tauri dev
   ```
3. 检查 Tauri 窗口是否成功弹出，并能直接加载 Memos 登录页面。

### 3. 便携性与数据随程移动测试
1. 在桌面端 Memos 中注册并登录，随便写几条笔记，上传一张测试图片。
2. 关闭桌面客户端软件。
3. 打开任务管理器（Task Manager），检查 `memos-backend.exe` 是否已经**彻底退出**，无后台驻留。
4. 打开桌面客户端 exe（在开发或打包生成的可执行文件目录）的**同级根目录**下，核实是否在此生成了：
   * `memos_prod.db` (SQLite 数据库文件)
   * `uploads/` 或相关的附件上传存储文件夹
5. 将包含 exe 和数据文件的整个文件夹移动到其他任意盘符或目录，双击 exe 启动，确认之前的笔记和附件依然存在且可以正常访问。
