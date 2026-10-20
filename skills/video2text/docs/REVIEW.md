# 项目复盘

## 一、目标

从抖音、小红书、微信视频号、B站/YouTube 等视频链接提取「文案」——既包括发布用的标题/简介/话题，也包括视频里的口播逐字稿。要求本地处理优先，能批量、可复用。

## 二、结论

| 能力 | 结果 |
|---|---|
| 视频号 | ✅ 扫码登录 → 元宝解析 → 官方预览接口 → 明文 MP4 → 转写（16 分钟视频实测） |
| 抖音 | ✅ 扫码登录 + DouK 签名 → `aweme/detail` → 下载 → 转写（47 秒实测） |
| 小红书 | ✅ 短链解析 → XHS-Downloader → 下载 → 转写（无需 Cookie） |
| B站 / YouTube | ✅ yt-dlp |
| 无口播视频 | ✅ 自动识别，输出发布文案并标注 |
| 中文准确率 | ✅ 本地 Whisper 可用；云端 Qwen3-Omni 明显更准（标点、人名、书名） |

## 三、验证记录

| 平台 | 样本 | 时长 | 耗时 | 产出 |
|---|---|---|---|---|
| 视频号 | `sph/AfVb6LFz5m` | 6s | ~10s | [examples/wechat-channels.md](../examples/wechat-channels.md) |
| 视频号 | `sph/Ab3JuQvRzq` | 16:03 | ~90s（本地） | [examples/wechat-long-remotion.md](../examples/wechat-long-remotion.md) |
| 抖音 | `v.douyin.com/nok6Qv8PS7M` | 47s | ~25s | [examples/douyin-artifacts.md](../examples/douyin-artifacts.md) |
| 小红书 | `xhslink.cn/o/5d3tDDTi77g` | 5s | ~15s | [examples/xiaohongshu-remote.md](../examples/xiaohongshu-remote.md) |
| B站 | `BV1Vbnn6iEfG` | 39:28 | 40s 试跑 | [examples/bilibili-40s.md](../examples/bilibili-40s.md) |

ASR 对比（60 秒中文旁白）：本地 turbo 平均 6.5s，云端 Omni 约 10s；云端在五个专有名词上全对，本地全错。

切片粒度会明显影响云端耗时：4 分钟音频按 120s 切（2 片）约 41s；按 45s 在静音处切（4 片）约 3m50s。时间是中转站排队，不是本地开销——要快就调大 `--chunk-seconds`，要细时间轴就调小。

## 四、关键技术决策

| 问题 | 选择 | 依据 |
|---|---|---|
| 视频号没有下载接口 | 元宝 `get_parse_result` 拿 `token/eid`，再调官方 `finder-preview/api/feed/get_feed_info` | [wx_channels_download](https://github.com/ltaoo/wx_channels_download) 的 sph worker 实现 |
| 视频号视频是否加密 | 预览流是明文；客户端抓包才是 ISAAC-64 | 实测 `ftyp` 文件头 + [解密项目](https://github.com/Evil0ctal/WeChat-Channels-Video-File-Decryption) |
| 抖音 yt-dlp 失败 | 换 DouK-Downloader 做签名与身份 | 源码中 `a_bogus` 仍是 TODO |
| 小红书下载 | XHS-Downloader 本地 API，Cookie 可选 | 官方 README 的 `/xhs/detail` |
| 中文识别不准 | 云端 Qwen3-Omni 为主，本地 Whisper 兜底 | 同段音频 A/B |
| 术语纠错 | `--fix` 确定性替换 + agent 改稿，不用 initial_prompt | 实测 initial_prompt 会吞掉开头 |

## 五、踩坑清单

1. **yt-dlp 的 `Fresh cookies` 是误导**：真因是缺 `a_bogus` 签名，补 Cookie 无效。
2. **Whisper 的 `initial_prompt` 会跳段**：塞热词后开头 11 秒整段消失，改用 `--fix`。
3. **视频号预览接口不带媒体的原因**：`shortUri` 只返回描述；必须用元宝给出的 `exportId + generalToken`。
4. **Cookie replay 必 401**：元宝把设备指纹（`x-hy92/93`、`x-device-id`）与会话绑定，解析必须在登录态页面里发。
5. **登录态是 session cookie**：浏览器被中断关闭就丢；脚本要保证在登录成功并解析后才关窗。
6. **登录二维码不自动出现**：抖音要先点「登录」，否则用户面对的是没有二维码的首页。
7. **本地服务被代理劫持**：`urllib` 会把 `127.0.0.1:5556` 也送进 HTTP 代理，返回 502；本地请求必须绕过代理。
8. **XHS 服务的 `check_record`**：默认命中下载记录后返回空，调用时要传 `false`。
9. **小红书短链要 App UA**：桌面 UA 会被重定向到登录页，导致 404/空数据。
10. **无口播的视频**：ASR 只会输出拟声词，必须回退到发布文案并明确标注。
11. **抖音只带签名仍 403**：`Uifid Not Found`，身份 Cookie 是前提。
12. **多行文案当标题**：微信分享描述含换行，标题要取首行。

## 六、指标

- 代码：`scripts/video2text` 约 1100 行，纯标准库。
- 依赖：ffmpeg 必需；node 仅视频号解密；yt-dlp 可选。
- 本地转写速度：约 16–18× 实时（M 系列 + turbo-q4）。
- 云端转写速度：约 6× 实时（Omni，含切片）。
- 首次登录成本：视频号、抖音各一次扫码。

## 七、待办

已完成：

- [x] 抖音 Cookie 过期检测：解析 `sid_guard` 的签发时间 + TTL，`--status` 直接显示「登录有效至 …」；失效时提示重扫。
- [x] 云端 ASR 的时间戳：改为**静音处切片**（`--chunk-seconds`），分片边界落在句子之间，时间轴不再是固定 120s。
- [x] 批量清单：`--batch urls.txt`，逐条执行、失败不中断、末尾汇总 JSON。
- [x] 前置自检：`--status` 检查配置、登录态、DouK 路径、XHS 服务、云端 ASR 配置。

本轮新增：

- [x] 小红书图文 OCR：`qwen-vl-ocr`（base64 直传），实测能完整还原中文排版。
- [x] 批量并发：`--jobs N`，两条链接 2 并发 65s（串行 89s）。
- [x] 视频号失败区分：401/403 → 登录失效；200 但无 exportId → 链接过期；超时 → 未捕获登录态。
- [x] 云端 ASR 重试：单分片 3 次、指数退避（2/4/8s），失败信息带分片序号。

再新增：

- [x] 批量断点续跑：`.batch-state.json` 记录每条结果，`--resume` 只补跑失败的（实测 skipped=1）。
- [x] OCR 成本控制：`--ocr-limit` / `ocr_max_images`，0 关闭。
- [x] 视频号主动预检：无窗口 headless 试解析，有效则直接跑（约 10s），失效才弹窗。

再新增：

- [x] 发布稿导出（`--export`）：对已转写目录再生成 publish / script / chapters / srt / bundle，不重跑转写；章节按停顿与长度切（35–100 秒），小标题取段首一句。
- [x] `--status` 结构化：抖音登录态带 `code`/`until`，视频号带 Cookie 来源与扫码会话可用性，供 UI 本地化。

仍待办：

- [ ] 批量结果的可视化汇总（HTML/Markdown 报表）。
- [ ] 视频号预检失败时区分「登录过期」与「链接过期」并给不同提示。

## 八、方法论

1. **先分层再选型**：元数据 / 媒体 / 转写三层解耦，任何一层失败都还能交付部分结果。
2. **优先找上游的「官方内部接口」**：视频号的突破口不是逆向视频加密，而是元宝的分享解析。
3. **报错信息经常骗人**：`Fresh cookies` 实际是签名问题；要以源码和抓包为准。
4. **本地优先，云端补强**：离线能跑通是底线，云端用于质量升级，随时可切回。
5. **把踩坑写进 SKILL.md**：下次 agent 触发时不必重新试错。
