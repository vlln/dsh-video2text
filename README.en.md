<h1 align="center">dsh-video2text</h1>

<p align="center">Paste a video link, get the publishing copy and a full spoken transcript. The plugin ships its own skill; the UI is one sidebar workbench.</p>

![Panel](docs/preview.png)

Chinese-first, works for Douyin, Xiaohongshu, WeChat Channels, Bilibili and YouTube. Transcription runs in the cloud by default (faster, better Chinese punctuation) and can be switched entirely to local. The media is written to disk before transcription finishes, so you can watch while it runs.

> 中文说明见 [README.md](README.md)。

## Why

Getting copy out of a video usually means: open the page → copy the description → transcribe by hand → reformat. Do that ten times and you have ten rounds of busywork, plus a timeline you forgot to build.

This plugin moves the whole loop into the dsh sidebar: paste, press Enter, and parsing / download / transcription / alignment / layout all happen locally. Everything lands in one directory you can open, export, or hand to an agent.

## Install

```sh
dsh plugin --profile web add "github:vlln/dsh-video2text"
```

Restart `dsh web` afterwards (the Node half registers at boot). A "Video to Text" entry then appears in the sidebar.

Requirements: macOS, Python 3.9+, `ffmpeg`, `node`; `playwright` + Chrome for WeChat Channels; `mlx-whisper` (Apple Silicon) or `whisper.cpp` for local transcription.

## What you get

| Capability | Notes |
|---|---|
| Platforms | Douyin / Xiaohongshu / WeChat Channels / Bilibili / YouTube / local files |
| Cloud ASR | Qwen3-Omni via Bailian — noticeably better on names and punctuation |
| Local ASR | mlx-whisper / whisper.cpp, offline and free |
| Sentence alignment | One-shot action; refines boundaries with local word timestamps |
| Player | Custom controls, synced transcript, subtitles, PiP, fullscreen |
| Export | Publish draft / SRT / ZIP |
| Accounts | Douyin & Xiaohongshu QR sign-in; WeChat Channels sign-in + session check |
| Jobs | Search, day groups, retry-in-place, delete, import from other folders |
| Agent handoff | "Ask AI" opens a session in the task workspace with context pre-filled |

## Where data lives

| Item | Path |
|---|---|
| Jobs and artifacts | `$DSH_HOME/data/dsh-video2text/out/<job-id>/` |
| Job index | `$DSH_HOME/data/dsh-video2text/jobs.json` |
| Model cache | `~/.cache/video2text/hf` (shared across instances) |
| Engine config (with keys) | `~/.config/video2text/config.json` (mode 600) |
| Browser profiles | `~/.cache/video2text/chrome-profile` etc. |

Keys stay in the local config file and are hidden in the UI by default. Cloud transcription uploads audio chunks to the configured ASR endpoint; local mode never leaves the machine. No telemetry. Media is pruned after 14 days / 5 GB (only media — copy and subtitles are kept).

## Skills

The plugin bundles `skills/video2text` and symlinks it into `$DSH_HOME/skills/video2text`, so the agent discovers it through the normal skill path — no extra tool is registered. The skill also works standalone: `python3 scripts/video2text <url> --out ./out`.

## Compatibility

| dsh version | Status |
|---|---|
| `0.2.1-rc.1` | ✅ verified (2026-10-20) |
| others | ⚠️ unverified — check the boot log for `plugin tree failed to load` if the panel is missing |

## Known limits

- WeChat Channels depends on a Tencent Yuanbao session; when it expires the task asks you to sign in again.
- Douyin needs DouK-Downloader plus a local cookie; Xiaohongshu uses a local XHS-Downloader service (falls back to yt-dlp, with less coverage).
- YouTube returns a bot check without a signed-in session: set a browser cookie, or run bgutil (`docker run -d -p 4416:4416 brainicism/bgutil-ytdlp-pot-provider`) and put its URL into "YouTube PO token".
- Long cloud transcriptions are dominated by server-side queueing (a 16-minute video took ~4 minutes); chunk size barely matters.
- One session per platform; no multi-account support yet.

## Plugin management

Install / remove / toggle with the official CLI: `dsh plugin --profile web add|remove <pkg>`. Installed plugins are listed and configured on the sidebar **Plugins** page.

## License

MIT. Upstream tools are invoked over HTTP/CLI, never linked: yt-dlp (Unlicense), DouK-Downloader and XHS-Downloader (GPL-3.0), bgutil-ytdlp-pot-provider (MIT).
