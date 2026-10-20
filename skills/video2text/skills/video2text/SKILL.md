---
name: video2text
description: Use this skill when the user wants the 文案/口播稿/逐字稿/字幕 of a video from 抖音、小红书、微信视频号、B站、YouTube, or wants a local screen recording / audio file transcribed. Resolves the link to media, then transcribes locally (mlx-whisper / whisper.cpp) or via cloud ASR (Qwen3-Omni), writing Markdown + SRT.
license: MIT
metadata:
  author: vlln
  version: "0.2.0"
---

# video2text

> `$_S` — this skill's root directory. Set `_S` to the absolute path before running commands.

把「视频链接」变成「发布文案 + 口播正文 + SRT」。转写默认在本机完成，也可切云端 ASR；取媒体/元数据走网络。

> 项目总览与验证记录见 [README.md](../README.md)，复盘与踩坑见 [docs/REVIEW.md](../docs/REVIEW.md)。

## 先搞清楚要哪种「文案」

| 目标 | 来源 | 是否需要 ASR |
|---|---|---|
| 标题、简介、话题标签 | 平台元数据 | 否 |
| 口播逐字稿 / 字幕 | 音轨 | 是 |

两个都会产出，元数据永远先拿。

## 依赖

```bash
brew install ffmpeg node           # 必需（node 仅视频号解密用）
uv tool install mlx-whisper        # Apple Silicon 推荐
brew install yt-dlp                # 可选：缺失时自动退到 `uvx yt-dlp`
# 或：brew install whisper-cpp     # 跨平台，需自备 ggml 模型
```

Python 3.9+，仅标准库。

## 用法

```bash
# 链接
python3 $_S/scripts/video2text "https://www.bilibili.com/video/BVxxxx" --out ./out

# 本地录屏 / 音频（无浏览器环境时的兜底）
python3 $_S/scripts/video2text --from-file ~/Desktop/wechat.mov --out ./out

# 常用开关
--wechat-session                # 视频号：弹窗扫码 → 登录态内解析 → 自动跑完
--login douyin|xhs              # 扫码登录并写入固定配置（推荐）
--cookies-from-browser chrome   # 备用：直接读浏览器 Cookie
--max-seconds 60                # 只跑前 60 秒，先看质量
--model mlx-community/whisper-large-v3-turbo   # 下载慢可用 -q4 量化版
--fix "飘航=飘扬,日曼=日耳曼"                    # 确定性替换，比 initial prompt 可靠
--polish --glossary "Codex,Claude,Remotion"     # 生成纠错 prompt，交给 agent 执行
--backend api                                   # 云端 ASR（Qwen3-Omni / Qwen3-ASR，见 docs/asr.md）
--backend auto|mlx|whispercpp
--batch urls.txt                # 清单批量跑，每行一个链接
--jobs 2                        # 批量并发数（默认 1）
--resume                        # 断点续跑：跳过 .batch-state.json 中已成功的条目
--ocr-limit 8                   # 图文 OCR 最多几张（0 关闭，默认取配置 12）
--status                        # 检查配置/登录态/本地服务是否就绪
--export ./out --format publish # 已转写的结果再导出发布稿，不重跑转写
--config-show                   # 打印配置（密钥打码）
--config-merge                  # stdin 读 JSON 合并写回配置
--chunk-seconds 60              # 云端 ASR 分片长度（静音处切）
--json                          # 给下游程序用
--keep-audio                    # 保留 16k wav
```

输出：`<标题>.md`（元数据 + 分段正文 + 时间轴）和 `<标题>.srt`。

### 发布稿导出

转写只做一次，导出可以反复做。对着**已完成的输出目录**跑，不下载、不重转：

```bash
python3 $_S/scripts/video2text --export ./out --format publish
```

| `--format` | 产物 | 用途 |
|---|---|---|
| `publish` | `<标题>.publish.md` | 标题 / 发布文案 / **自动章节**（小标题 + 时间戳）/ 正文 / 字数与语速 |
| `script` | `<标题>.script.txt` | 纯口播稿，无时间戳 |
| `chapters` | `<标题>.chapters.md` | 章节清单 + 逐句时间轴，可贴视频简介 |
| `srt` | `<标题>.srt` | 对齐后的字幕 |
| `bundle` | `<标题>.bundle.zip` | 上面四份 + sidecar JSON |

章节按停顿和长度切（约 35–100 秒一段），小标题取该段开头一句，目的是「一眼能改」。

`examples/` 里有真实产出样例；`prompts/polish.md` 是逐字稿润色提示词。

## Agent 执行流程（重要）

拿到链接先判平台，再按下面的方式跑。**不要**自己拼 curl 去重放 Cookie。

### 微信视频号（`weixin.qq.com/sph/...`）

1. 先告诉用户：「会弹出一个 Chrome 窗口，请用微信扫码，并在手机上点确认登录」，然后执行：

   ```bash
   python3 $_S/scripts/video2text "<链接>" --wechat-session --out ./out
   ```

2. 脚本会打开一个独立 Chrome（不影响用户自己的浏览器），在页面里轮询登录态。用户扫码 + 手机确认后，脚本自动完成解析、下载、抽音轨、转写。
3. 登录态保存在这个独立 profile 里，**后续调用不用再扫**；直到过期（表现为一直 401 到超时），重跑一次让用户再扫即可。
4. 这条命令会阻塞到登录完成。**agent 应该放到后台执行**，同时立刻告诉用户去扫码；不要同步等待到超时。
5. 脚本会先做一次**无窗口预检**：登录态有效就直接解析（约 10 秒），失效才弹窗。
6. 首次调用要留足时间：`--login-timeout 600`（默认 900 已经够）。
7. 如果环境没有图形界面（远程/容器），直接改用 `--from-file`，请用户录屏。

登录态失效的判定：脚本超时退出、日志停在「打开浏览器扫码」。这时**不要**反复重开窗口，先问用户是否完成了手机确认。

### B站 / YouTube / 抖音 / 小红书

直接跑，不需要弹窗：

```bash
python3 $_S/scripts/video2text "<链接>" --out ./out
```

抖音/小红书报 `403` / `login required` / `Fresh cookies` 时，按顺序试：

1. `--cookies-from-browser chrome`（读用户 Chrome 登录态）
2. `--cookies-file cookies.txt`（用户从浏览器导出的 Netscape 格式）
3. 仍失败 → 换手机分享短链，或改用 [Douyin_TikTok_Download_API](https://github.com/Evil0ctal/Douyin_TikTok_Download_API) 自建解析服务

**抖音的坑**：`Fresh cookies (not necessarily logged in) are needed` 这个报错有误导性。真实原因是 `/aweme/v1/web/aweme/detail/` 需要 `a_bogus` 签名参数，detail 返回空后 extractor 会归因到 cookie。只补 cookie 通常无效——yt-dlp 目前没有实现该签名（源码里是 TODO）。无头浏览器直接抓页面也常被风控拦成空壳页。

## 平台现实

> 下载层选型、上游项目与许可证见 [`docs/backends.md`](../docs/backends.md)。

| 平台 | 元数据 | 媒体文件 | 说明 |
|---|---|---|---|
| B站 | ✅ | ✅ yt-dlp | CC 字幕覆盖率低，基本都走 ASR |
| YouTube | ✅ | ✅ yt-dlp | 可直接 `--write-auto-subs`，更省事 |
| 抖音 | ✅ | ⚠️ 需本地服务 | yt-dlp 缺 a_bogus 签名；用 DouK-Downloader API |
| 小红书 | ✅ | ⚠️ 需本地服务 | 用 XHS-Downloader API；cookie 可选 |
| **微信视频号** | ✅ | ✅ 需登录 | 扫码登录元宝后全自动；未登录只给描述 |

### 视频号怎么办

`weixin.qq.com/sph/<id>` 的真实链路（已实测跑通）：

```
元宝 /api/weixin/get_parse_result   （需要登录态）
  → playable_url 里的 token + eid
  → finder-preview/api/feed/get_feed_info(exportId + generalToken)
  → feedInfo.h264VideoInfo.videoUrl   ← 预览流是明文 MP4，不用解密
```

首次使用扫码登录一次（登录态写在独立 Chrome profile 里，可复用）：

```bash
python3 $_S/scripts/video2text --wechat-session "https://weixin.qq.com/sph/xxx"
```

脚本会开一个 Chrome 窗口，微信扫码（手机上还要点「确认登录」）。之后浏览器保持打开，登录态内直接解析，再自动下载、转写。登录态失效后重跑即可，不用改代码。

> 关键：解析请求必须**在登录态页面里发**。把 Cookie 抠出来用 curl 重放会 401——元宝把设备指纹（`x-hy92/x-hy93/x-device-id`）和会话绑在一起。

抓包得到的媒体是加密的（前 128KB，ISAAC-64 + `decode_key`），预览流不是。脚本两条都支持：有 `decode_key` 就解密，没有就当明文处理。

### 批量与自检

```bash
python3 $_S/scripts/video2text --status
python3 $_S/scripts/video2text --batch urls.txt --out ./out
```

退出码：`0` 正常、`2` 出错、`3` 没有可转写内容、`4` 需要登录（只拿到发布文案）。需要登录时 stderr 会带 `[auth:<平台>]` 标记；本地服务不通带 `[service:xhs]`。
`--status` 会报告：配置文件是否存在、抖音登录有效期、DouK 路径、XHS 服务连通性、视频号登录态与扫码会话、云端 ASR 配置。
配置读写用 `--config-show`（密钥打码）与 `--config-merge`（stdin JSON，权限 600），避免把密钥留在 shell 历史里。
`--media-dir` 会在转写开始前先写 `media.json`（标题/封面/时长/媒体），所以转写未完成时媒体已经可播。
小红书图文笔记会自动走 `qwen-vl-ocr`（配置项 `ocr_model`，默认继承 ASR 的 base/key），把图片里的文字提取到「图文正文（OCR）」一节。
`--batch` 逐条执行并在末尾输出 `{"total":n,"ok":n,"fail":n}`，失败不中断。

## 外部依赖与配置

需要账号/密钥的能力，一律走**固定配置文件**，不要写进命令行历史：

```
~/.config/video2text/config.json     # 可用 VIDEO2TEXT_CONFIG 覆盖
```

```json
{
  "asr_provider": "omni",
  "asr_api_key": "sk-...",
  "asr_base_url": "https://openapi.flowhub.com.cn/v1",
  "asr_model": "qwen3-omni-flash",
  "ocr_model": "qwen-vl-ocr",
  "ocr_max_images": 12,
  "douyin_cookie": "...",
  "xhs_cookie": "...",
  "xhs_api": "http://127.0.0.1:5556",
  "douk_path": "/path/to/TikTokDownloader",
  "douyin_api": "http://127.0.0.1:5555"
}
```

环境变量同名大写优先（`ASR_API_KEY`、`XHS_API`…）。

> **LLM 纠错不需要配 API**：agent 自己就能做。`--polish` 默认只生成 `<标题>.prompt.md`，把 prompt 交给当前 agent 处理即可。

**Agent 的正确做法**：缺什么就给出申请地址 + 明确告诉用户写到哪个文件的哪个字段，然后让用户回一句「好了」，再重跑。不要向用户索要密钥明文贴在对话里。

| 需要什么 | 申请/获取地址 | 写入字段 |
|---|---|---|
| 云端 ASR（可选，中文更准） | <https://bailian.console.aliyun.com/>（Qwen3-ASR-Flash） | `asr_provider` / `asr_api_key` / `asr_base_url` / `asr_model` |
| 小红书登录态（可选，提高画质） | 浏览器打开 xiaohongshu.com 扫码 | `xhs_cookie`（可用 `--login xhs` 自动写） |
| 抖音登录态 | 浏览器打开 douyin.com 扫码 | `douyin_cookie`（可用 `--login douyin` 自动写） |
| 抖音签名/接口 | <https://github.com/JoeanAmier/TikTokDownloader> | `douk_path`（克隆后的目录） |

扫码登录（会弹 Chrome，用户扫完自动落盘）：

```bash
python3 $_S/scripts/video2text --login xhs      # 或 --login douyin
```

### 小红书服务

小红书走本地的 XHS-Downloader（见 [docs/backends.md](../docs/backends.md)），先用 `uv run main.py api` 起在 `:5556`，再跑本 skill。服务没起时会自动回退 yt-dlp。

## 模型怎么选

> 中文准确率的横向对比与后处理策略见 [`docs/asr.md`](../docs/asr.md)。

- 要准确率：`large-v3`（非 turbo），或 FunASR / FireRedASR；
- 要速度：`large-v3-turbo`（默认）；
- 术语靠 `--glossary` + `--polish`，不要靠 Whisper 的 `initial_prompt`。


| 场景 | 建议 |
|---|---|
| 普通话口播、干净音轨 | `mlx-community/whisper-large-v3-turbo`（默认） |
| 中英混说、口音重、BGM 大 | 同上，或 large-v3 |
| 纯中文、要快 | SenseVoice-Small / Paraformer（FunASR），自带标点 |
| 网络慢、只想试 | `mlx-community/whisper-large-v3-turbo-q4`（约 460MB，质量接近 fp16） |
| 老机器 / 无 Metal | whisper.cpp + `ggml-base`/`small` |

whisper 在长静音段会「幻觉」出重复句，脚本默认带 `--hallucination-silence-threshold 2`。

**不要用 `--initial-prompt` 塞热词**：实测会让模型直接跳过开头十几秒。专有名词用 `--fix` 做转写后替换，或换 FunASR（原生支持热词）。

## 把逐字稿变成可用文案

转写结果没有标点、带口水词，用这段提示词过一遍：

> 你是口播稿编辑。下面是视频语音转写，可能有同音错字、无标点、口头禅。请：① 修正专有名词（不确定的保留并标 `[?]`）；② 删掉「嗯/那个/就是说」等口头禅与重复；③ 补标点、按语义分段，每段加小标题；④ 保持原意和说话人语气，不扩写、不编造；⑤ 输出：一句话摘要 + 分段正文 + 3–5 条要点。

## 排错

- `yt-dlp` 报 403 / 需要登录 → 加 `--cookies-from-browser chrome`
- 抖音短链 `v.douyin.com` → 先用浏览器打开一次拿最终 URL
- 模型下载慢 → `export HF_ENDPOINT=https://hf-mirror.com`
- 转写空白 → 确认音频不是纯静音；`--keep-audio` 后用播放器听一下
- 视频号 `permission verification failed` → 缺少 `Origin` 头或链接已过期，重跑即可

## 合规

仅用于个人学习、研究或已授权内容；不要批量搬运、二次发布。
