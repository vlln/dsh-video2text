# 下载层技术选型

本 skill 只做两件事：**取到媒体**、**本地转写**。「取媒体」按平台拆成独立后端，能自己实现的自己实现，做不了的接成熟开源项目，并在下面写清来源与许可证。

## 总览

| 平台 | 选用方案 | 上游项目 | 许可证 | 状态 |
|---|---|---|---|---|
| 视频号 | 元宝解析 + `finder-preview` 官方接口 | 逻辑参考 [wx_channels_download](https://github.com/ltaoo/wx_channels_download) | MIT + Commons Clause | ✅ 已跑通 |
| B站 / YouTube | yt-dlp | [yt-dlp](https://github.com/yt-dlp/yt-dlp) | Unlicense | ✅ |
| 抖音 | DouK-Downloader Web API | [JoeanAmier/TikTokDownloader](https://github.com/JoeanAmier/TikTokDownloader) | GPL-3.0 | 设计完成，待接 |
| 小红书 | XHS-Downloader Web API | [JoeanAmier/XHS-Downloader](https://github.com/JoeanAmier/XHS-Downloader) | GPL-3.0 | 设计完成，待接 |
| 抖音（备选） | DTK v5（Docker） | [Evil0ctal/Douyin_TikTok_Download_API](https://github.com/Evil0ctal/Douyin_TikTok_Download_API) | Apache-2.0 | 备选 |
| 视频号解密 | 腾讯官方 WASM | [WeChat-Channels-Video-File-Decryption](https://github.com/Evil0ctal/WeChat-Channels-Video-File-Decryption) | MIT | ✅ 已验证 |

## 为什么不能只靠 yt-dlp

抖音走的是 `/aweme/v1/web/aweme/detail/`，需要 `a_bogus` 签名。yt-dlp 的 extractor 里这一步还是 TODO：

```python
detail = traverse_obj(self._download_json('https://www.douyin.com/aweme/v1/web/aweme/detail/', ...))
if not detail:
    # TODO: Run verification challenge code to generate signature cookies
    raise ExtractorError('Fresh cookies (not necessarily logged in) are needed', ...)
```

所以 `Fresh cookies` 这个报错是误导：补 cookie 通常无效，缺的是签名。小红书同理，登录态和 `xsec_token` 都影响成功率。

结论：**这两家交给专门实现签名的项目，我们只对接它们的本地 HTTP API**。

## 抖音：DouK-Downloader

- 仓库：<https://github.com/JoeanAmier/TikTokDownloader>
- 许可证：GPL-3.0，Star ~17k，2026-09 仍在更新
- 签名实现：`src/encrypt/websign.py`（a_bogus / X-Bogus 等）
- 启动 API 模式后监听 `http://127.0.0.1:5555`，自带 `/docs`

```bash
git clone https://github.com/JoeanAmier/TikTokDownloader
cd TikTokDownloader && uv sync
uv run main.py          # 选择「Web API」模式
```

调用（`src/application/main_server.py` 的 `/douyin/detail`）：

```bash
curl -X POST http://127.0.0.1:5555/douyin/detail \
  -H 'token: ' -H 'Content-Type: application/json' \
  -d '{"detail_id": "7210708697356520737", "cookie": "", "proxy": ""}'
```

返回作品数据（含播放地址）。下载文件由本 skill 侧完成，便于统一走 16k 抽轨 + ASR。

实测（2026-10）：`--login douyin` 扫码后，把 `UIFID` 注入请求参数、带上完整登录 Cookie，`/aweme/detail` 返回 200，`play_addr.url_list` 可直接下载。skill 通过 `scripts/douyin_detail.py` 调用 DouK 的 `Detail` 接口，配置项：

```json
{ "douk_path": "/path/to/TikTokDownloader", "douyin_cookie": "..." }
```

只带 `a_bogus`、没有 `uifid`/`msToken` 仍会 `403 Uifid Not Found`——签名只是必要条件，身份 Cookie 才是前提。

## 小红书：XHS-Downloader

- 仓库：<https://github.com/JoeanAmier/XHS-Downloader>
- 许可证：GPL-3.0，Star ~13k，2026-10 仍在更新
- 关键点：**Cookie 非必需**；不配 Cookie 只能下低分辨率视频，配了（无需登录）可拿高画质
- 支持 `xhslink.com` 短链、图文笔记、livePhoto

```bash
git clone https://github.com/JoeanAmier/XHS-Downloader
cd XHS-Downloader && uv sync --no-dev
uv run main.py api      # 监听 http://127.0.0.1:5556
```

调用（README 的 `/xhs/detail`）：

```bash
curl -X POST http://127.0.0.1:5556/xhs/detail \
  -H 'Content-Type: application/json' \
  -d '{"url": "https://www.xiaohongshu.com/explore/xxx?xsec_token=xxx", "download": true}'
```

图文笔记不需要 ASR：`作品描述` 直接作为文案，图片再走 `qwen-vl-ocr`（`ocr_model`，默认继承 ASR 的 base/key）逐张提取文字，输出到「图文正文（OCR）」一节。

实测（2026-10，`xhslink.cn/o/5d3tDDTi77g`）：无 Cookie 也能拿到元数据与低清视频地址；短链要先按小红书 App 的 UA 解一次，再交给服务。注意服务默认 `check_record=true`，重复请求会命中记录，skill 调用时传 `check_record=false`。

## 备选：DTK v5

<https://github.com/Evil0ctal/Douyin_TikTok_Download_API>（Apache-2.0，Star ~20k）

- 优点：纯 Python 实现 a_bogus / X-Bogus / X-Gnarly / X-Dynosaur，带 identity pool、API key、Docker Compose；
- 代价：整套服务较重（DB + 控制台 + 身份池），对「一次转一条视频」来说过度。
- 如果 DouK 在你的网络下频繁失败，再切这个。

## 视频号

两段式，均已实测：

1. **解析**：`yuanbao.tencent.com/api/weixin/get_parse_result` → `playable_url`（含 `token`/`eid`）→ `channels.weixin.qq.com/finder-preview/api/feed/get_feed_info` → `feedInfo.h264VideoInfo.videoUrl`。请求必须在登录态页面内发出（设备指纹与会话绑定）。
2. **解密**（仅客户端抓包得到的文件需要）：前 128KB，ISAAC-64 keystream（`decode_key` 为种子）`reverse()` 后 XOR。keystream 用腾讯官方 `wasm_video_decode.wasm`，从 CDN 按需拉取。

预览接口返回的 `videoUrl` 是明文 MP4，不需要解密。

## 许可证与署名

- **GPL-3.0**（DouK / XHS-Downloader）：本 skill 通过 HTTP 调用独立进程，不链接其代码；文档与 README 中保留项目名、链接与许可证说明。若将来直接内嵌代码，整个 skill 需改为 GPL-3.0。
- **MIT + Commons Clause**（wx_channels_download）：只参考了请求流程，未复制代码；转载其逻辑说明时注明出处。
- **MIT**（WeChat-Channels-Video-File-Decryption）：只用于验证解密算法（示例文件 + `decode_key` 比对），未分发其代码。
- **Unlicense**（yt-dlp）：通过 CLI 调用。

## 参考

- yt-dlp：<https://github.com/yt-dlp/yt-dlp>
- wx_channels_download：<https://github.com/ltaoo/wx_channels_download>
- DouK-Downloader：<https://github.com/JoeanAmier/TikTokDownloader>
- XHS-Downloader：<https://github.com/JoeanAmier/XHS-Downloader>
- DTK v5：<https://github.com/Evil0ctal/Douyin_TikTok_Download_API>
- 视频号解密：<https://github.com/Evil0ctal/WeChat-Channels-Video-File-Decryption>
