# YouTube 的 bot 校验怎么解

YouTube 从 2025 起对无登录态请求返回 `Sign in to confirm you're not a bot`。社区（[PO Token Guide](https://github.com/yt-dlp/yt-dlp/wiki/PO-Token-Guide) 与 [bgutil-ytdlp-pot-provider](https://github.com/Brainicism/bgutil-ytdlp-pot-provider)）的解法是 **PO token**，由「provider 造 token」+「yt-dlp 插件交 token」两部分组成。

### 装法（本机实测通过）

```sh
# 1) provider（Docker，端口 4416，只绑回环）
docker run --name bgutil-provider -d --init \
  -p 127.0.0.1:4416:4416 brainicism/bgutil-ytdlp-pot-provider

# 2) yt-dlp 插件（放用户插件目录；对本机 uvx 装的 yt-dlp 生效）
mkdir -p ~/.config/yt-dlp/plugins
curl -sL -o /tmp/pot.zip \
  https://github.com/Brainicism/bgutil-ytdlp-pot-provider/releases/latest/download/bgutil-ytdlp-pot-provider.zip
unzip -oq /tmp/pot.zip -d ~/.config/yt-dlp/plugins/bgutil-ytdlp-pot-provider
```

> 注意：`~/Library/Application Support/yt-dlp/plugins` 在 `uvx` 装的 yt-dlp 上**不会被发现**（实测 `Plugin directories: none`），要放 `~/.config/yt-dlp/plugins`。插件放别处时，用配置项 `yt_plugin_dirs` 指定目录（引擎会传 `--plugin-dirs`）。

把 provider 地址填进「设置 → YouTube PO token」（默认就是 `http://127.0.0.1:4416`），引擎会传：

```
--extractor-args "youtubepot-bgutilhttp:base_url=http://127.0.0.1:4416"
```

### 怎么确认插件真的在工作

```sh
yt-dlp -v --simulate --extractor-args "youtubepot-bgutilhttp:base_url=http://127.0.0.1:4416" <url>
```

输出要有这两行（第一行说明插件加载了，第二行说明 token 真的被请求了）：

```
[youtube] [pot] PO Token Providers: bgutil:http-2.0.2 (external), …
[youtube] [pot:bgutil:http] Generating a gvs PO Token for web client via bgutil HTTP server
```

### 它救不了什么

provider 的 README 写得很明确：**PO token 不绕过 IP 级的登录限制**。如果只有第一行、没有第二行（token 流程根本没触发），说明请求在更早的 `LOGIN_REQUIRED` 就被拒了，通常是出口 IP 被判定为机房。

本机（机房出口）实测：插件 + provider 都装好、provider `/ping` 返回 200、`PO Token Providers: bgutil:http-2.0.2` 正常列出，但**七种 player_client 全部在 token 之前被拦**；同时这台机器没有 Chrome 配置（`--cookies-from-browser chrome` 报找不到 cookie 库），所以 Cookie 这条路也不可用。

结论按网络环境选：

| 网络 | 该用什么 |
|---|---|
| 家宽 / 普通出口 | PO token（上面两步），多半就通了 |
| 机房 IP / 代理出口 | 必须 Cookie；token 只能缓解，不能绕过 |
| 临时看一条 | `--cookies-from-browser chrome` 最快 |

---

返回 [README](../README.md)
