# video2text

把视频链接变成「发布文案 + 口播正文 + SRT」。取媒体按平台适配，转写默认在本机完成，也可切云端 ASR。

```bash
python3 scripts/video2text "https://www.bilibili.com/video/BVxxxx" --out ./out
python3 scripts/video2text "https://weixin.qq.com/sph/xxxx" --wechat-session --out ./out
python3 scripts/video2text --from-file ~/Desktop/screen.mov --out ./out

# 批量 + 自检
python3 scripts/video2text --batch urls.txt --out ./out --jobs 2 --resume
python3 scripts/video2text --status

# 配置读写（密钥不落命令行）
python3 scripts/video2text --config-show                      # 打印配置，密钥打码
echo '{"asr_model":"qwen3-omni-flash"}' | python3 scripts/video2text --config-merge

# 已转写的结果再导出成发布稿（不重跑转写）
python3 scripts/video2text --export ./out --format publish    # 章节化发布稿
python3 scripts/video2text --export ./out --format bundle     # publish+script+chapters+srt+json 打包
```

输出：`<标题>.md`（元数据 + 分段正文 + 时间轴）+ `<标题>.srt`。

## 发布导出

`--export` 对着已完成的目录跑，不重新下载、不重新转写：

| `--format` | 产物 | 用途 |
|---|---|---|
| `publish` | `<标题>.publish.md` | 标题、发布文案、**自动章节**（小标题 + 时间戳）、正文、字数与语速 |
| `script` | `<标题>.script.txt` | 纯口播稿，无时间戳，直接交给编辑 |
| `chapters` | `<标题>.chapters.md` | 章节清单 + 逐句时间轴，可贴进视频简介 |
| `srt` | `<标题>.srt` | 对齐后的字幕 |
| `bundle` | `<标题>.bundle.zip` | 上面四份 + sidecar JSON |

章节切分依据停顿与长度（约 35–100 秒一段），小标题取该段开头的一句，做到「一眼能改」。

## 平台支持（均已实测）

| 平台 | 元数据 | 媒体 | 方式 |
|---|---|---|---|
| B站 / YouTube | ✅ | ✅ | yt-dlp |
| 抖音 | ✅ | ✅ | `--login douyin` + [DouK-Downloader](https://github.com/JoeanAmier/TikTokDownloader) |
| 小红书 | ✅ | ✅ | [XHS-Downloader](https://github.com/JoeanAmier/XHS-Downloader) 本地 API；图文笔记走 OCR |
| 微信视频号 | ✅ | ✅ | 元宝解析 + 官方 `finder-preview` 接口（扫码登录） |

需要登录但没登录时：视频号仍能取到发布文案与封面，然后以 **退出码 4** + `[auth:wechat]` 标记结束；抖音 401/403 以 `[auth:douyin]` 标记失败；本地 XHS 服务不通是 `[service:xhs]`。调用方据此提示登录，而不是把「只有文案」当成成功。
| 本地录屏 / 音频 | — | ✅ | `--from-file` |

下载层选型、上游项目与许可证：[docs/backends.md](docs/backends.md)。

## 转写

| 方式 | 命令 | 说明 |
|---|---|---|
| 本地 mlx-whisper | 默认 | 离线、免费；`large-v3` 比 `turbo` 准 |
| 云端 ASR | `--backend api` | Qwen3-Omni / Qwen3-ASR，中文标点更完整 |
| 句级对齐（可选） | `--align` / `--no-align` | 默认**不做**：按标点切句、时间在分片内插值。`--align` 用本地词级时间精修边界，需要本地模型 |
| 本地 whisper.cpp | `--backend whispercpp` | 无 Metal 环境 |

同一段 60 秒中文旁白，云端 Omni 把「飘航/生死历劫/日曼民族/东中央的牧手」全部纠正为「飘扬/声嘶力竭/日耳曼民族/东正教的牧首」。对比与接入方式：[docs/asr.md](docs/asr.md)。

## 配置

需要账号或密钥的能力统一走固定配置文件，不写命令行：

```
~/.config/video2text/config.json      # VIDEO2TEXT_CONFIG 可覆盖
```

```json
{
  "asr_provider": "omni",
  "asr_api_key": "sk-...",
  "asr_base_url": "https://openapi.flowhub.com.cn/v1",
  "asr_model": "qwen3-omni-flash",
  "xhs_api": "http://127.0.0.1:5556",
  "douk_path": "/path/to/TikTokDownloader",
  "douyin_cookie": "...",
  "xhs_cookie": "..."
}
```

环境变量同名大写优先。登录态用 `--login douyin|xhs` 扫码写入；`--wechat-session` 用独立 Chrome profile 保存腾讯元宝登录态。

配置也可以用 `--config-show` 读出（`api_key` / `cookie` / `token` 这类字段自动打码）、用 `--config-merge` 从 stdin 合并写回（密钥不出现在命令行与历史里，文件权限 600）。

## 依赖

```bash
brew install ffmpeg node          # node 仅视频号解密用
uv tool install mlx-whisper       # Apple Silicon
brew install yt-dlp               # 可选，缺失时自动 uvx yt-dlp
```

Python 3.9+，脚本本身零第三方依赖。

## 设计

```
resolve(URL) → metadata → media → ffmpeg 16k mono → ASR → Markdown/SRT
```

- **元数据永远先取**：媒体拿不到时仍能交付「发布文案」。
- **媒体与转写解耦**：各家下载器只负责吐文件，转写统一在本地/云端完成。
- **媒体先落盘**：`--media-dir` 下先写 `media.json`（标题/封面/时长/媒体路径），转写还在跑也能播放，下游不必等整条链路结束。
- **没有口播也能交付**：转写字符数远小于时长时，明确提示「文案以发布文案为准」。

## 目录

```
skills/video2text/SKILL.md     Agent 使用说明（含执行流程与排错）
scripts/video2text             主程序
scripts/wx_session.py          视频号扫码 + 登录态内解析
scripts/douyin_detail.py       抖音取作品（调用 DouK）
scripts/keystream.js           视频号解密 keystream（官方 wasm）
docs/backends.md               下载层选型与许可证
docs/asr.md                    ASR 选型与实测
docs/REVIEW.md                 项目复盘：决策、踩坑、待办
examples/                      各平台真实产出
prompts/polish.md              逐字稿润色提示词
```

## 已知限制

- 抖音依赖登录态与 DouK 的签名实现，Cookie 过期需重扫。
- 视频号分享链接会过期（`expiredTime`），过期后重新解析。
- 小红书短链要先按 App UA 解析，直接给服务可能返回空数据。
- 长视频建议先 `--max-seconds 60` 试跑。

## 许可与致谢

本项目通过 HTTP/CLI 调用上游工具，不链接其代码：yt-dlp（Unlicense）、[DouK-Downloader](https://github.com/JoeanAmier/TikTokDownloader) 与 [XHS-Downloader](https://github.com/JoeanAmier/XHS-Downloader)（GPL-3.0）、[wx_channels_download](https://github.com/ltaoo/wx_channels_download)（MIT + Commons Clause，仅参考流程）、[WeChat-Channels-Video-File-Decryption](https://github.com/Evil0ctal/WeChat-Channels-Video-File-Decryption)（MIT，解密验证）。
