# 更新记录

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
