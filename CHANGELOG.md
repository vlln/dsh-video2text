## 0.2.2 — 2026-11-02

**新增**

- 新增 `dsh-video2text/inspect` 插件行（与面板互相独立，可单独 disabled）：给 agent 的 `video_text` / `video_frames` 工具。
  - 传媒体路径或 `vid_<8hex>` 句柄；同一素材只跑一次（重复/并发请求复用同一个后台任务）。
  - 25 秒软超时自动转 `v2t-video` 后台任务（走 `ctx.jobs`，完成有会话内通知），再用同一 vid 取结果；命中缓存直接返回；无 `jobs` 服务时降级为同步执行。
  - `video_frames` 返回拼图 + 每格时间点；`detail`/`at` 返回高清单帧；图片作为 attachments 附件交给模型。
  - 宿主重启留下的未完成任务会被标记为「上次准备被中断」并自动重跑。
- 引擎新增 `--inspect`：ffprobe 探测 + 按画面变化取帧（dHash）+ 帧→时间映射 + 缓存 + `[video:xxx]` 可读报错。
- 面板行为不变：`render_sheet()` 重构后与旧版逐像素一致（同一参数下 JPG md5 相同，已对比验证）。

**修复**

- `lib/inspect.mjs` 未 unwrap cordis 的 Config ref，`spawn(python)` 拿到对象并抛 `path argument must be of type string`（真实 agent 调用时暴露）。

**文档**

- README 中英各加「给 Agent 用」一节；SKILL 增加 `--inspect` 用法与 `shots` 的取舍说明。

**面板**

- 任务菜单（三个点）新增「在文件夹打开」：走新路由 `/reveal`，按平台调用 `open` / `explorer` / `xdg-open` 打开该任务的产物目录，只接受已存在的任务 id。
- 修了同一菜单里「复制链接」的 `copy is not defined`：它误用了 Viewer 作用域里的 copy，现在 Panel 有自己的 `copyText`。
- 修任务菜单被列表容器裁剪：菜单原本是 `position: absolute`，而任务列表是 `overflow: auto`，结果只露出第一项、还撑出横向滚动条。改成按按钮坐标 `position: fixed` 渲染（上下空间不够会自动翻到上方），滚动/缩放时自动关闭。
- 「未找到 video2text 引擎」横幅会一直挂着：面板只在有任务运行时轮询，宿主重启/文件交换期间的瞬时失败不会自愈。现在空闲时也每 8s 刷新一次，横幅里另有「重试」按钮。

**设置**

- 插件配置新增 `showEntry`（默认开）：在 DSH 的 Plugins 页关掉它只隐藏侧栏入口，agent 工具（`dsh-video2text/inspect` 行）不受影响；要彻底停用面板则禁用整行。
- 设置页迁到 **DSH Settings → 视频转文案**（与面板共用同一个 `SettingsBody`）；面板右上角的「设置」入口与弹层已删除。
- 插件自带字段改为非 volatile，只有 `showEntry` 保留：Plugins 页的自动表单就只剩这一个开关。
- 设置页「保存」按钮改用与主输入区一致的规格（高 28 / 字号 12 / 字重 500 / 圆角 8）。
- 设置页顶部改用插件自己的图标（侧栏同一枚「屏幕 + 播放」图形）+ 副标题，不再只有宿主给的齿轮。
- README 补上 agent 能力：顶部简介、能力表、以及「给 Agent 用」的 30 秒上手示例。
- 设置字段说明缩短为一行（原来每条两三句），插件描述改为「侧栏工作台 + 给 agent 的视频理解工具」。
- 面板自带设置弹层去掉可见滚动条（仍可滚动）。
- 设置页按用途分组：**云端转写**（provider / model / base / key / 分片）、**本地转写**（模型 + 缓存下载）、**平台接入**（DouK / 小红书服务）、**登录与风控**（Cookie / PO token）；每组一行说明，字段提示全部走 ⓘ 气泡，输入框统一全宽。

## 0.2.1 — 2026-10-31

**修复**

- 抖音短链（如 `v.douyin.com/...`）直接失败并抛 `ModuleNotFoundError: No module named 'src'`：根因是 DouK 检出放在 `/tmp/DouK`，被系统清理后只剩一个 `.venv`，而 `--status` 只看目录是否存在，仍报正常。
- 新增 `--setup-douyin`（幂等安装/修复 DouK：克隆 + `uv sync` + 回写 `douk_path`），检出默认落在 `~/.local/share/video2text/DouK`，不再放 `/tmp`。
- `--status` 的 `douk_path` 增加 `ready`（校验 `src/interface/detail.py`），`exists` 不再被当作可用。
- 抖音分支不再因为配置里缺 `douk_path` 就静默退回 yt-dlp（那条路必然 403 并给出误导性的 cookie 报错），改为直接报可操作的 `[service:douyin]` / `[auth:douyin]`。
- 错误信息取 stderr 最后一行（`tail_error`），不再盲切 300 字符把路径截成半截。
- 本地转写在 `all_proxy=socks5://…` 的环境里静默失败（`mlx_whisper produced no srt`）：mlx-whisper 的 httpx 缺 socksio 会打印 `Skipping …` 但返回 0。现在检测到这类输出会去掉 `all_proxy` 自动重试一次，仍失败才报错并附原因。
- npm 安装包里 `skills/video2text/skills/video2text/scripts` 这条软链不会被打进 tarball，装出来 SKILL.md 指不到脚本（0.2.0 就有）：插件加载时按需补一条指向引擎 `scripts/` 的链（只读安装下静默跳过）。

## 0.2.0 — 2026-10-24

**新增**

- **画面速览（contact sheet）**：在进度条上拖出区间 → 自动抽帧拼成一张 JPG，每帧带时间角标，页眉写区间/帧数/间隔。帧数按区间长度自动定（约 48 帧，0.5–30s 一帧），始终单张图片。
- 选区两端可拖拽微调，**双击端点输入精确时间**；选区变化后自动刷新 4×3 预览缩略图。
- B 站稿件走 **API 兜底**：yt-dlp 报 `Unable to extract initial state` 时改用 `view` + `playurl` 取元数据与 DASH 流（B 站对 Python 的 TLS 指纹回 412，统一用 `curl`）。
- 引擎支持 `--sheet`（`--sheet-start/--sheet-end/--sheet-count/--sheet-cols/--sheet-width/--sheet-title`），可脱离插件批量出图。

**修复**

- 英文口播被切成 1 句/分片（11 分钟只有 6 句）：切句现在识别英文句号，并跳过 `Mr.`/`e.g.`/单字母缩写；无标点长段按词兜底切。
- 对齐时给 whisper 写死 `--language zh`，英文音频被转成中文字、句子压到 0.1 秒：改为按文本语种选 `en`/`zh`，并加「异常短句回退插值」。
- 插件安装后 skill 没被 harness 发现：软链改为指向含 `SKILL.md` 的目录（harness 只认 `<skillsRoot>/<name>/SKILL.md`），并补 `scripts` 转发。
- 导出接口返回非 JSON 时提示「Unexpected token」：改为按状态码给可操作提示（登录态过期 / 需重启 `dsh web`）。
- 任务菜单点击「删除」无反应（窗口级 `pointerdown` 提前关闭菜单）。

## 0.1.0 — 2026-10-20

首个版本：侧栏工作台（播放器 + 逐字稿 + 对齐 + 导出）、任务列表与跨目录导入、登录态引导、「问 AI」交给 agent、设置面板。
