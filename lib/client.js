/**
 * dsh-video2text — client half.
 *
 * 视频工作台：左栏任务、右侧自绘播放器 + 同步逐字稿。
 * 视觉只使用官方 token；状态色带 fallback。所有控件自绘。
 */
window.__ModuleLoader__.load({
  id: 'dsh-video2text',
  factory: (require) => {
    const React = require('react')
    const { useState, useEffect, useCallback, useRef, useMemo } = React
    const h = React.createElement

    const API = '/plugins/dsh-video2text/jobs'
    const MEDIA = '/plugins/dsh-video2text/media'
    const PANEL_ID = 'dsh-video2text'
    const POLL_MS = 1500

    const DICT = {
      zh: {
        'panel.title': '视频转文案',
        'panel.subtitle': '抖音 / 小红书 / 视频号 / B站 / YouTube',
        'form.placeholder': '粘贴视频链接',
        'form.run': '开始',
        'form.invalid': '看起来不是链接或文件路径',
        'setting.backend': '转写方式',
        'setting.cloudHint': '更准，需要网络与密钥',
        'setting.localHint': '离线，首次要下模型',
        'form.retry': '重试',
        'backend.cloud': '云端',
        'backend.local': '本地',
        'tasks': '任务',
        'empty.title': '还没有任务',
        'empty.hint': '粘贴分享链接，或从下面的示例开始。',
        'empty.example1': '试试小红书短链',
        'empty.example2': '试试 B站链接',
        'tab.transcript': '逐字稿',
        'tab.copy': '发布文案',
        'tab.info': '信息',
        'state.running': '转写中',
        'state.failed': '失败',
        'step.resolve': '解析链接',
        'step.download': '下载媒体',
        'step.asr': '转写',
        'step.align': '句级对齐',
        'player.play': '播放',
        'player.pause': '暂停',
        'player.speed': '倍速',
        'player.subtitles': '字幕',
        'player.pip': '画中画',
        'player.fullscreen': '全屏',
        'player.follow': '跟随高亮',
        'processing.cancel': '取消',
        'processing.elapsed': '已用时',
        'tasks.search': '搜索任务',
        'onboard.title': '粘贴一条链接开始',
        'onboard.example1': '小红书示例',
        'onboard.example2': 'B站示例',
        'open.source': '打开原链接',
        'player.mute': '静音',
        'noMedia': '只有文案，没有可播放的媒体',
        'copy': '复制',
        'copy.empty': '没有发布文案（本地文件或平台未提供）。口播内容见「逐字稿」。',
        'error.engine': '未找到 video2text 引擎（设置 VIDEO2TEXT_ROOT）',
        'failed.hint': '可以重试；换另一种转写方式有时能绕过。',
        'failed.cloudRetry': '换云端重试',
        'auth.title': '需要登录',
        'auth.desc': '这条链接要先登录对应平台，才能取到媒体与口播稿。',
        'auth.login': '扫码登录',
        'auth.waiting': '请在弹出的浏览器里完成扫码…',
        'auth.done': '登录完成，可以重试了',
        'auth.retry': '重新转写',
        'auth.service': '本地服务没就绪',
        'auth.serviceDesc': '这个链接依赖本机的下载服务，先在「设置」里确认地址并启动它。',
        'auth.failed': '登录没走完',
        'auth.elapsed': '已等',
        'auth.auto': '登录成功，正在自动重新转写…',
        'proc.window': '已打开 Chrome 窗口，请在窗口里完成扫码/确认（最多 90 秒，超时会提示重试）',
        'failed.localRetry': '换本地重试',
        'info.id': '任务',
        'info.platform': '平台',
        'info.author': '作者',
        'info.published': '发布',
        'info.duration': '时长',
        'info.backend': '转写',
        'info.segments': '句数',
        'info.media': '媒体',
        'info.url': '链接',
        'info.dir': '输出目录',
        'askAi': '问 AI',
        'askAi.title': '在新会话里带着这条视频的上下文继续做',
        'askAi.done': '已新建会话（工作区已切到任务目录）并填好上下文，回车发送',
        'askAi.fail': '打开会话失败',
        'askAi.noWorkspace': '任务目录还没有注册成工作区（侧栏 Add workspace… 指一次即可）',
        'askAi.noButton': '找不到「新建会话」入口',
        'askAi.noComposer': '找不到输入框',
        'askAi.insert': '无法写入输入框',
        'media.saved': '本地留存',
        'media.none': '无',
        'media.purged': '已按保留策略清理',
        'accounts.open': '设置',
        'star.label': '喜欢这个插件🌟',
        'star.hint': '如果这个插件省了你的时间，去 GitHub 点个 star',
        'api.expired': '登录态已过期，刷新页面后重试',
        'api.missingRoute': '服务端还没有这个接口，重启 dsh web 后生效',
        'api.tooLarge': '文件太大',
        'api.serverError': '服务端执行失败，稍后重试',
        'p.douyin': '抖音', 'p.xhs': '小红书', 'p.bili': 'B站', 'p.wechat': '微信视频号',
        'p.youtube': 'YouTube', 'p.weibo': '微博',
        'player.ready': '视频已就绪，可以先看',
        'toast.copyFailed': '复制失败',
        'toast.exportFailed': '导出失败：',
        'confirm.delete': '删除这个任务的本地文件？',
        'stat.segments': '{n} 句',
        'stat.chars': '{n} 字',
        'stat.pace': '{n} 字/分',
        'day.today': '今天',
        'day.yesterday': '昨天',
        'settings.pending': '{n} 项待保存',
        'settings.tip.model': '本地模型只给「本地转写」和「对齐」用。选「本地」后端时完全不需要 API —— 转写与对齐都在本机跑；选「云端」时它只用于对齐。',
        'settings.tip.chunk': '云端转写的分片长度。分片越大请求越少，但分片内的时间点更粗（对齐会修）。',
        'settings.tip.cookies': 'YouTube 等站点要登录态：读哪个浏览器的 Cookie。留空则不读。',
        'settings.tip.pot': 'bgutil PO token 服务的地址（默认 http://127.0.0.1:4416）。需要先给 yt-dlp 装插件；能缓解 token 校验，但不能绕过机房 IP 的登录要求。',
        'settings.tip.xhs': '本地 XHS-Downloader 的 HTTP 地址。没起服务时小红书会回退到 yt-dlp，能拿到的内容会变少。',
        'settings.tip.douk': 'DouK-Downloader 的目录。抖音的签名与作品详情靠它，没有它会 403。',
        'settings.tip.key': '云端转写的密钥（百炼）。默认隐藏，点右侧眼睛查看。',
        'ask.fallbackIntro': '我刚在「视频转文案」面板里处理了这条视频，需要你接着做更复杂的事。',
        'ask.fallbackTitle': '- 标题：',
        'ask.unknown': '（未知）',
        'ask.fallbackSource': '- 来源：',
        'ask.fallbackDuration': '- 时长：',
        'ask.fallbackTranscript': '- 逐字稿：',
        'ask.fallbackNote': '（当前宿主还没重启，取不到本地输出目录；需要原始产物，可以让我用 video2text skill 重新处理上面的链接。）',
        'ask.fallbackTail': '先读能读到的文件，然后帮我：（在这里写你要做的事）',

        'accounts.title': '设置',
        'settings.login': '登录态',
        'settings.service': '服务与密钥',
        'settings.save': '保存',
        'settings.saved': '已保存到配置文件',
        'settings.nothing': '没有改动',
        'settings.failed': '保存失败',
        'settings.asrProvider': '云端转写',
        'settings.asrModel': '模型',
        'settings.asrBase': '接口地址',
        'settings.asrKey': '密钥',
        'settings.xhsApi': '小红书服务',
        'settings.douk': 'DouK 路径',
        'settings.model': '本地模型',
        'settings.chunk': '分片长度',
        'settings.cookies': '浏览器 Cookie',
        'settings.pot': 'YouTube PO token',
        'settings.cookiesHint': 'YouTube 等站点要登录态：填 chrome / safari / edge，留空则不读',
        'settings.potHint': '可选：bgutil PO token 服务地址，需要先装 yt-dlp 插件（见 README）；不能绕过 IP 级风控',
        'settings.alignField': '句级对齐',
        'settings.modelCache': '模型缓存',
        'settings.modelReady': '已缓存',
        'settings.modelMissing': '未下载',
        'settings.download': '预下载',
        'settings.downloaded': '已下载',
        'settings.show': '显示密钥',
        'settings.modelCustom': '自定义…',
        'settings.getKey': '申请 / 管理密钥',
        'settings.installAI': '让 AI 装依赖',
        'settings.installFailed': '打开安装会话失败',
        'settings.xhsHint': '本地 XHS-Downloader 服务，解析小红书链接用',
        'settings.doukHint': 'DouK-Downloader 目录，抖音签名与作品详情靠它',
        'settings.hide': '隐藏密钥',
        'settings.downloading': '下载中…',
        'settings.alignHint': '云端转写后用本地模型精修时间轴；关掉就不需要下载模型',
        'settings.chunkHint': '分片越大越快（60–180），时间轴由对齐精修',
        'settings.hint': '留空即保持原值；写入 ~/.config/video2text/config.json',
        'accounts.refresh': '刷新',
        'accounts.login': '扫码登录',
        'accounts.relogin': '重新登录',
        'accounts.verify': '验证会话',
        'accounts.verifying': '验证中…',
        'accounts.verified': '会话有效',
        'accounts.verifyFailed': '会话失效',
        'accounts.loginDone': '已登录',
        'accounts.checking': '检测中…',
        'accounts.waiting': '等待扫码…',
        'accounts.done': '已完成',
        'accounts.failed': '失败',
        'accounts.close': '关闭',
        'accounts.douyin': '抖音',
        'accounts.xhs': '小红书',
        'accounts.wechat': '微信视频号',
        'accounts.douk': 'DouK 路径',
        'accounts.loginNeeded': '未登录',
        'accounts.validUntil': '有效至',
        'accounts.signedIn': '已登录',
        'accounts.expired': '登录已过期',
        'accounts.invalid': 'Cookie 无效',
        'accounts.apiUp': '本地服务可用',
        'accounts.apiDown': '本地服务不可用',
        'accounts.sessionReady': '有可复用的扫码会话',
        'accounts.sessionNone': '无浏览器会话',
        'accounts.localFile': '本地文件',
        'export.title': '导出',
        'export.publish': '发布稿（带章节）',
        'export.script': '口播稿 · 无时间戳',
        'export.chapters': '章节与时间轴',
        'export.srt': '字幕 SRT',
        'export.sheet': '画面速览（JPG）',
        'range.selected': '已选区间',
        'range.sheet': '导出速览',
        'range.clear': '清除',
        'range.handleStart': '起点',
        'range.handleEnd': '终点',
        'range.previewHint': '速览预览（点开大图）；拖动两端调整，双击端点输入精确时间',
        'export.bundle': '全部（ZIP）',
        'export.notAligned': '时间轴未对齐（点的「对齐」可精修）',
        'task.manage': '任务管理',
        'task.copyLink': '复制链接',
        'task.delete': '删除任务（含文件）',
        'task.imported': '已导入',
        'export.busy': '导出中…',
        'export.done': '已下载',
        'transcript.copyAll': '复制全文',
        'transcript.pending': '视频已就绪，逐字稿转写完成后出现在这里',
        'stats.chars': '字数',
        'stats.rate': '语速',
        'search.none': '没有匹配的任务',
        'search.clear': '清空搜索',
        'toast.copied': '已复制',
        'toast.exported': '已导出',
        'toast.deleted': '已删除',
        'error.dismiss': '关闭',
        'align.action': '对齐',
        'align.running': '对齐中…',
        'align.done': '已对齐',
        'align.actionHint': '用本地词级时间精修每句起止；是一次性操作，不影响已有文案',
        'align.started': '开始对齐，完成后时间轴会更新',
        'align.failed': '对齐失败',
        'align.already': '这条任务已经对齐过了',
        'align.doneToast': '对齐完成，时间轴已更新',
        'timeline.estimated': '时间轴 · 估算',
        'timeline.aligned': '时间轴 · 精确',
      },
      en: {
        'panel.title': 'Video to Text',
        'panel.subtitle': 'Douyin / Xiaohongshu / WeChat Channels / Bilibili / YouTube',
        'form.placeholder': 'Paste a video link',
        'form.run': 'Start',
        'form.invalid': 'Not a link or a file path',
        'setting.backend': 'Backend',
        'setting.cloudHint': 'More accurate, needs network + key',
        'setting.localHint': 'Offline, downloads a model first',
        'form.retry': 'Retry',
        'backend.cloud': 'Cloud',
        'backend.local': 'Local',
        'tasks': 'Jobs',
        'empty.title': 'No jobs yet',
        'empty.hint': 'Paste a link, or start from an example.',
        'empty.example1': 'Try a Xiaohongshu link',
        'empty.example2': 'Try a Bilibili link',
        'tab.transcript': 'Transcript',
        'tab.copy': 'Copy',
        'tab.info': 'Info',
        'state.running': 'running',
        'state.failed': 'failed',
        'step.resolve': 'Resolve',
        'step.download': 'Download',
        'step.asr': 'Transcribe',
        'step.align': 'Align',
        'player.play': 'Play',
        'player.pause': 'Pause',
        'player.speed': 'Speed',
        'player.subtitles': 'Subtitles',
        'player.pip': 'Picture in picture',
        'player.fullscreen': 'Fullscreen',
        'player.follow': 'Follow',
        'processing.cancel': 'Cancel',
        'processing.elapsed': 'elapsed',
        'tasks.search': 'Search jobs',
        'onboard.title': 'Paste a link to begin',
        'onboard.example1': 'Xiaohongshu example',
        'onboard.example2': 'Bilibili example',
        'open.source': 'Open source',
        'player.mute': 'Mute',
        'noMedia': 'Copy only — no playable media',
        'copy': 'Copy',
        'copy.empty': 'No caption for this source. See Transcript for the spoken content.',
        'error.engine': 'video2text engine not found (set VIDEO2TEXT_ROOT)',
        'failed.hint': 'Retry, or switch the backend — it sometimes gets past.',
        'failed.cloudRetry': 'Retry on cloud',
        'auth.title': 'Sign-in required',
        'auth.desc': 'This link needs a signed-in session before the media and transcript can be fetched.',
        'auth.login': 'Sign in',
        'auth.waiting': 'Finish the scan in the browser window…',
        'auth.done': 'Signed in — retry when ready',
        'auth.retry': 'Transcribe again',
        'auth.service': 'Local service not ready',
        'auth.serviceDesc': 'This link depends on a local downloader; check the address in Settings and start it first.',
        'auth.failed': 'Sign-in did not finish',
        'auth.elapsed': 'waited',
        'auth.auto': 'Signed in — retrying automatically…',
        'proc.window': 'Chrome window opened — finish the scan there (90s max, then it will ask again)',
        'failed.localRetry': 'Retry locally',
        'info.id': 'Job',
        'info.platform': 'Platform',
        'info.author': 'Author',
        'info.published': 'Published',
        'info.duration': 'Duration',
        'info.backend': 'Backend',
        'info.segments': 'Sentences',
        'info.media': 'Media',
        'info.url': 'URL',
        'info.dir': 'Output dir',
        'askAi': 'Ask AI',
        'askAi.title': 'Open a new session seeded with this video context',
        'askAi.done': 'New session opened in the task workspace with context — press Enter to send',
        'askAi.fail': 'Could not open a session',
        'askAi.noWorkspace': 'Task folder is not a workspace yet — add it once from the sidebar',
        'askAi.noButton': '"New session" control not found',
        'askAi.noComposer': 'Composer not found',
        'askAi.insert': 'Could not write into the composer',
        'media.saved': 'kept',
        'media.none': 'none',
        'media.purged': 'purged by retention',
        'accounts.open': 'Settings',
        'star.label': 'Star on GitHub',
        'star.hint': 'If this plugin saves you time, star it on GitHub',
        'api.expired': 'Session expired — reload the page and retry',
        'api.missingRoute': 'This endpoint is not available yet — restart dsh web',
        'api.tooLarge': 'File too large',
        'api.serverError': 'Server-side failure — try again later',
        'p.douyin': 'Douyin', 'p.xhs': 'Xiaohongshu', 'p.bili': 'Bilibili', 'p.wechat': 'WeChat Channels',
        'p.youtube': 'YouTube', 'p.weibo': 'Weibo',
        'player.ready': 'Media ready — you can watch while transcription runs',
        'toast.copyFailed': 'Copy failed',
        'toast.exportFailed': 'Export failed: ',
        'confirm.delete': 'Delete this task and its local files?',
        'stat.segments': '{n} sentences',
        'stat.chars': '{n} chars',
        'stat.pace': '{n} chars/min',
        'day.today': 'Today',
        'day.yesterday': 'Yesterday',
        'settings.pending': '{n} pending',
        'settings.tip.model': 'The local model is used for local transcription and for alignment. With the Local backend no API is needed at all; with Cloud it is only used for alignment.',
        'settings.tip.chunk': 'Chunk size for cloud transcription. Bigger chunks mean fewer requests but coarser timing inside a chunk (alignment refines it).',
        'settings.tip.cookies': 'Sites like YouTube need a signed-in session: which browser to read cookies from. Leave blank to skip.',
        'settings.tip.pot': 'bgutil PO token server (default http://127.0.0.1:4416). Requires the yt-dlp plugin; it eases token checks but does not bypass IP-level login requirements.',
        'settings.tip.xhs': 'Local XHS-Downloader HTTP endpoint. Without it Xiaohongshu falls back to yt-dlp and returns less.',
        'settings.tip.douk': 'DouK-Downloader directory. Douyin signing and post details depend on it; without it requests 403.',
        'settings.tip.key': 'Cloud transcription key (Bailian). Hidden by default — use the eye to reveal it.',
        'ask.fallbackIntro': 'I just processed this video in the Video to Text panel and need you to take it further.',
        'ask.fallbackTitle': '- Title: ',
        'ask.unknown': '(unknown)',
        'ask.fallbackSource': '- Source: ',
        'ask.fallbackDuration': '- Duration: ',
        'ask.fallbackTranscript': '- Transcript: ',
        'ask.fallbackNote': '(This host has not been restarted yet, so the local output directory is unavailable; if you need the raw artifacts, I can re-run the link with the video2text skill.)',
        'ask.fallbackTail': 'Read what you can, then help me with: (describe the task here)',

        'accounts.title': 'Settings',
        'settings.login': 'Sign-in',
        'settings.service': 'Service & keys',
        'settings.save': 'Save',
        'settings.saved': 'Saved to config file',
        'settings.nothing': 'No changes',
        'settings.failed': 'Save failed',
        'settings.asrProvider': 'Cloud ASR',
        'settings.asrModel': 'Model',
        'settings.asrBase': 'Base URL',
        'settings.asrKey': 'API key',
        'settings.xhsApi': 'Xiaohongshu service',
        'settings.douk': 'DouK path',
        'settings.model': 'Local model',
        'settings.chunk': 'Chunk size',
        'settings.cookies': 'Browser cookies',
        'settings.pot': 'YouTube PO token',
        'settings.cookiesHint': 'YouTube needs a signed-in session: chrome / safari / edge; leave blank to skip',
        'settings.potHint': 'optional: bgutil PO token server; needs the yt-dlp plugin (see README); does not bypass IP-level blocks',
        'settings.alignField': 'Sentence align',
        'settings.modelCache': 'Model cache',
        'settings.modelReady': 'cached',
        'settings.modelMissing': 'not downloaded',
        'settings.download': 'Pre-download',
        'settings.downloaded': 'Downloaded',
        'settings.show': 'Show key',
        'settings.modelCustom': 'Custom…',
        'settings.getKey': 'Get / manage key',
        'settings.installAI': 'Let AI install deps',
        'settings.installFailed': 'Could not open the install session',
        'settings.xhsHint': 'local XHS-Downloader service used to resolve Xiaohongshu links',
        'settings.doukHint': 'DouK-Downloader checkout; provides Douyin signing + post details',
        'settings.hide': 'Hide key',
        'settings.downloading': 'Downloading…',
        'settings.alignHint': 'Refines timestamps with a local model after cloud ASR; turn it off to skip the download',
        'settings.chunkHint': 'Bigger chunks are faster (60–180); alignment refines the timeline',
        'settings.hint': 'Leave blank to keep the current value; writes ~/.config/video2text/config.json',
        'accounts.refresh': 'Refresh',
        'accounts.login': 'Sign in',
        'accounts.relogin': 'Sign in again',
        'accounts.verify': 'Verify session',
        'accounts.verifying': 'Verifying…',
        'accounts.verified': 'Session valid',
        'accounts.verifyFailed': 'Session expired',
        'accounts.loginDone': 'Signed in',
        'accounts.checking': 'Checking…',
        'accounts.waiting': 'Waiting for scan…',
        'accounts.done': 'done',
        'accounts.failed': 'failed',
        'accounts.close': 'Close',
        'accounts.douyin': 'Douyin',
        'accounts.xhs': 'Xiaohongshu',
        'accounts.wechat': 'WeChat Channels',
        'accounts.douk': 'DouK path',
        'accounts.loginNeeded': 'not signed in',
        'accounts.validUntil': 'valid until',
        'accounts.signedIn': 'signed in',
        'accounts.expired': 'session expired',
        'accounts.invalid': 'cookie invalid',
        'accounts.apiUp': 'local service up',
        'accounts.apiDown': 'local service down',
        'accounts.sessionReady': 'reusable browser session',
        'accounts.sessionNone': 'no browser session',
        'accounts.localFile': 'Local file',
        'export.title': 'Export',
        'export.publish': 'Publish draft (chapters)',
        'export.script': 'Spoken script · plain',
        'export.chapters': 'Chapters & timeline',
        'export.srt': 'Subtitles SRT',
        'export.sheet': 'Contact sheet (JPG)',
        'range.selected': 'Selection',
        'range.sheet': 'Export sheet',
        'range.clear': 'Clear',
        'range.handleStart': 'Start',
        'range.handleEnd': 'End',
        'range.previewHint': 'Sheet preview (click to open); drag the handles to adjust, double-click to type a time',
        'export.bundle': 'Everything (ZIP)',
        'export.notAligned': 'timeline not aligned yet — press Align to refine',
        'task.manage': 'Task actions',
        'task.copyLink': 'Copy link',
        'task.delete': 'Delete task (with files)',
        'task.imported': 'imported',
        'export.busy': 'Exporting…',
        'export.done': 'downloaded',
        'transcript.copyAll': 'Copy all',
        'transcript.pending': 'Video is ready — the transcript shows up here when done',
        'stats.chars': 'Characters',
        'stats.rate': 'Pace',
        'search.none': 'No matching jobs',
        'search.clear': 'Clear search',
        'toast.copied': 'Copied',
        'toast.exported': 'Exported',
        'toast.deleted': 'Deleted',
        'error.dismiss': 'Dismiss',
        'align.action': 'Align',
        'align.running': 'Aligning…',
        'align.done': 'Aligned',
        'align.actionHint': 'Refine each sentence boundary with a local word-level pass; one-shot, copy is untouched',
        'align.started': 'Alignment started — timestamps update when it finishes',
        'align.failed': 'Align failed',
        'align.already': 'This task is already aligned',
        'align.doneToast': 'Alignment finished — timeline updated',
        'timeline.estimated': 'timeline · estimated',
        'timeline.aligned': 'timeline · precise',
      },
    }

    const C = {
      bg: 'var(--dsw-alias-bg-base)',
      layer: 'var(--dsw-alias-bg-layer-1)',
      layer2: 'var(--dsw-alias-bg-layer-2, rgba(127,127,127,0.10))',
      text: 'var(--dsw-alias-label-primary)',
      muted: 'var(--dsw-alias-label-secondary)',
      faint: 'var(--dsw-alias-label-tertiary, var(--dsw-alias-label-secondary))',
      border: 'var(--dsw-alias-border-l2)',
      primary: 'var(--dsw-alias-state-business-primary)',
      primaryHex: 'var(--dsw-static-deepseek-500, #4176e6)',
      soft: 'var(--v2t-soft)',
      ring: '0 0 0 3px rgba(65,118,230,0.12)',
      danger: 'var(--dsw-alias-state-danger-primary, #d64545)',
      success: 'var(--dsw-alias-state-success-primary, #2fa36b)',
      r: 'var(--dsw-radius-md, 12px)',
      rl: 'var(--dsw-radius-xl, 20px)',
      shadow: 'var(--dsw-alias-shadow-card, 0 1px 2px rgba(0,0,0,0.04))',
    }

    const platformLabel = (name, t) => {
      const key = String(name || '').toLowerCase()
      if (key === 'file') return t('accounts.localFile')
      const keys = { douyin: 'p.douyin', xiaohongshu: 'p.xhs', bilibili: 'p.bili',
                     wechat: 'p.wechat', youtube: 'p.youtube', weibo: 'p.weibo' }
      return keys[key] ? t(keys[key]) : (name || '')
    }

    const bytes = (n) => {
      if (!n || n <= 0) return '0 B'
      const units = ['B', 'KB', 'MB', 'GB', 'TB']
      let i = 0
      let v = n
      while (v >= 1024 && i < units.length - 1) { v /= 1024; i += 1 }
      return `${v.toFixed(v >= 10 || i === 0 ? 0 : 1)} ${units[i]}`
    }

    const clock = (ts) => {
      if (!ts) return ''
      const d = new Date(ts)
      return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
    }

    const parseClock = (text) => {
      const m = String(text || '').trim().match(/^(?:(\d+):)?(\d+)(?:\.(\d+))?$/)
      if (!m) return null
      const [, a, b, frac] = m
      const mins = a ? Number(a) : 0
      return mins * 60 + Number(b) + (frac ? Number(`0.${frac}`) : 0)
    }

    const fmt = (t) => {
      if (!Number.isFinite(t) || t < 0) t = 0
      const total = Math.floor(t)
      const h = Math.floor(total / 3600)
      const m = Math.floor((total % 3600) / 60)
      const s = total % 60
      if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
      return `${m}:${String(s).padStart(2, '0')}`
    }

    const charCount = (segments) => (segments || []).reduce((sum, seg) => sum + String(seg.text || '').length, 0)
    const pace = (segments, duration, t) => {
      const chars = charCount(segments)
      if (!chars || !duration) return ''
      return t('stat.pace', { n: Math.round(chars / Math.max(duration / 60, 0.01)) })
    }

    const hoverBg = (on) => (on ? C.layer2 : 'transparent')

    async function openSessionWith({ t, prompt, jobId, notify }) {
      const newBtn = document.querySelector(
        '[aria-label="New session"], [aria-label="新建会话"], [aria-label="新建对话"]',
      )
      if (!newBtn) throw new Error(t('askAi.noButton'))
      newBtn.click()

      // 只选择「所有任务所在目录」对应的工作区；没注册就保持当前工作区
      let workspaceTitle = ''
      try {
        const wsRes = await fetch('/plugins/dsh-video2text/workspace', {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify(jobId ? { id: jobId } : {}),
        })
        const ws = await wsRes.json()
        if (ws?.ok) workspaceTitle = ws.title || ''
        else if (ws?.reason === 'not-registered' && notify) {
          notify(t('askAi.noWorkspace'))
        }
      } catch {}
      if (workspaceTitle) {
        for (let i = 0; i < 20; i += 1) {
          await new Promise((resolve) => setTimeout(resolve, 150))
          const chip = document.querySelector('[aria-label="Choose workspace"]')
          if (!chip) continue
          chip.click()
          await new Promise((resolve) => setTimeout(resolve, 250))
          const items = [...document.querySelectorAll('[role="menuitem"]')]
          const hit = items.find((el) => (el.textContent || '').trim() === workspaceTitle)
          if (hit) { hit.click(); break }
          document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
        }
        await new Promise((resolve) => setTimeout(resolve, 300))
      }

      let composer = null
      for (let i = 0; i < 30; i += 1) {
        await new Promise((resolve) => setTimeout(resolve, 120))
        composer = document.querySelector('[contenteditable="true"][placeholder]')
          || document.querySelector('[contenteditable="true"]')
        if (composer) break
      }
      if (!composer) throw new Error(t('askAi.noComposer'))
      composer.focus()
      const probe = String(prompt || '').slice(0, 16)
      const filled = () => String(composer.innerText || '').includes(probe)
      try {
        const transfer = new DataTransfer()
        transfer.setData('text/plain', prompt)
        composer.dispatchEvent(new ClipboardEvent('paste', {
          clipboardData: transfer, bubbles: true, cancelable: true,
        }))
      } catch {}
      await new Promise((resolve) => setTimeout(resolve, 220))
      if (!filled()) {
        document.execCommand('insertText', false, prompt)
        await new Promise((resolve) => setTimeout(resolve, 150))
      }
      if (!filled()) throw new Error(t('askAi.insert'))
      return true
    }

    const pillStyle = {
      display: 'inline-flex', alignItems: 'center', height: 20, padding: '0 8px',
      borderRadius: 999, fontSize: 10.5, color: 'var(--dsw-alias-label-secondary)',
      background: 'var(--v2t-soft)', whiteSpace: 'nowrap',
    }

    const menuItemStyle = {
      display: 'block', width: '100%', padding: '7px 9px', borderRadius: 7, border: 0,
      background: 'transparent', color: 'var(--dsw-alias-label-primary)', font: 'inherit',
      fontSize: 12, textAlign: 'left', cursor: 'pointer',
    }

    function Tip({ text, children }) {
      const ref = useRef(null)
      const [pos, setPos] = useState(null)
      const show = () => {
        const rect = ref.current?.getBoundingClientRect?.()
        if (!rect) return
        const width = 268
        const left = Math.min(Math.max(8, rect.left - 8), window.innerWidth - width - 8)
        setPos({ left, top: rect.bottom + 8, width })
      }
      const hide = () => setPos(null)
      return h('span', { ref, onMouseEnter: show, onMouseLeave: hide, style: { display: 'inline-flex' } },
        children,
        pos ? h('span', {
          style: {
            position: 'fixed', left: pos.left, top: pos.top, width: pos.width, zIndex: 120,
            padding: '8px 10px', borderRadius: 10, border: `0.5px solid ${C.border}`,
            background: C.layer, color: C.text, boxShadow: '0 12px 32px rgba(0,0,0,0.18)',
            fontSize: 11.5, lineHeight: 1.65, fontWeight: 400, textAlign: 'left',
            pointerEvents: 'none', whiteSpace: 'normal',
          },
        }, text) : null)
    }

    function Icon({ name, size = 16 }) {
      const paths = {
        play: 'M7 4.5l12 7.5-12 7.5z',
        pause: 'M7 4h3.5v16H7zM13.5 4H17v16h-3.5z',
        pip: 'M3.5 5.5h17v13h-17zM12.5 12.5h6v4.5h-6z',
        full: 'M4 9.5V4.5h5M20 9.5V4.5h-5M4 14.5v5h5M20 14.5v5h-5',
        cc: 'M3.5 5.5h17v13h-17zM10 10.2a2.8 2.8 0 100 3.6M17.2 10.2a2.8 2.8 0 100 3.6',
        speed: 'M12 6.5a8.5 8.5 0 11-8 5.2M12 12l3.5-2.5',
        follow: 'M6.5 4.5v15M12 4.5v15M17.5 8v11.5',
        volume: 'M4 9.5h3l4-3v11l-4-3H4zM15 9a4 4 0 010 6',
        check: 'M5 12.5l4 4 10-10',
        alert: 'M12 4l9 16H3zM12 10v4M12 17h.01',
        spark: 'M12 3l2 6 6 2-6 2-2 6-2-6-6-2 6-2z',
        copy: 'M8 8h11v11H8zM5 5h11',
        download: 'M12 4v10M8 10.5l4 4 4-4M5 19h14',
        user: 'M12 12a3.6 3.6 0 100-7.2 3.6 3.6 0 000 7.2zM5 20c0-3.2 3.1-5.2 7-5.2s7 2 7 5.2',
        gear: 'M12 15.2a3.2 3.2 0 100-6.4 3.2 3.2 0 000 6.4zM19.4 13.6l1.5 1.2-1.7 3-1.9-.7a6.4 6.4 0 01-1.6.9l-.3 2h-3.4l-.3-2a6.4 6.4 0 01-1.6-.9l-1.9.7-1.7-3 1.5-1.2a6.6 6.6 0 010-1.8L4.1 10l1.7-3 1.9.7a6.4 6.4 0 011.6-.9l.3-2h3.4l.3 2a6.4 6.4 0 011.6.9l1.9-.7 1.7 3-1.5 1.2a6.6 6.6 0 010 1.8z',
        star: 'M12 4.5l2.4 4.9 5.4.8-3.9 3.8.9 5.4-4.8-2.5-4.8 2.5.9-5.4L4.2 10.2l5.4-.8z',
        refresh: 'M19.5 12a7.5 7.5 0 11-2.2-5.3M19.5 4.5v4.2h-4.2',
        close: 'M6 6l12 12M18 6L6 18',
        chevron: 'M7 10l5 5 5-5',
        search: 'M10.5 17a6.5 6.5 0 100-13 6.5 6.5 0 000 13zM15.5 15.5L20 20',
        film: 'M4 5.5h16v13H4zM8 5.5v13M16 5.5v13M4 12h16',
        crosshair: 'M12 4v4M12 16v4M4 12h4M16 12h4M12 15.2a3.2 3.2 0 100-6.4 3.2 3.2 0 000 6.4z',
        more: 'M6 12h.01M12 12h.01M18 12h.01',
        external: 'M14 5h5v5M19 5l-7 7M11 5H6.5A1.5 1.5 0 005 6.5v11A1.5 1.5 0 006.5 19h11a1.5 1.5 0 001.5-1.5V13',
        eye: 'M2.5 12s3.6-6.5 9.5-6.5S21.5 12 21.5 12s-3.6 6.5-9.5 6.5S2.5 12 2.5 12zM12 15a3 3 0 100-6 3 3 0 000 6z',
        eyeOff: 'M4 4l16 16M9.9 5.7A9.7 9.7 0 0112 5.5c5.9 0 9.5 6.5 9.5 6.5a17 17 0 01-2.7 3.3M6.3 8.1A16.6 16.6 0 002.5 12s3.6 6.5 9.5 6.5c1.2 0 2.3-.2 3.3-.6',
      }
      if (name === 'more') {
        return h('svg', {
          width: size, height: size, viewBox: '0 0 24 24', 'aria-hidden': true, style: { flex: 'none' },
        }, [4.5, 12, 19.5].map((cx) => h('circle', {
          key: cx, cx, cy: 12, r: 2, fill: 'currentColor',
        })))
      }
      const filled = name === 'play' || name === 'pause' || name === 'spark'
      return h('svg', {
        width: size, height: size, viewBox: '0 0 24 24', fill: 'none',
        stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round',
        strokeLinejoin: 'round', 'aria-hidden': true, style: { flex: 'none' },
      }, filled
        ? h('path', { d: paths[name], fill: 'currentColor', stroke: 'none' })
        : h('path', { d: paths[name] }))
    }

    const iconBtn = {
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4,
      background: 'transparent', border: 0, color: 'inherit', padding: 5,
      borderRadius: 7, cursor: 'pointer', lineHeight: 1, transition: 'background 120ms',
    }

    function Chip({ children, tone }) {
      return h('span', {
        style: {
          display: 'inline-flex', alignItems: 'center', height: 22, padding: '0 8px',
          borderRadius: 999, fontSize: 11, lineHeight: 1,
          border: '0.5px solid transparent',
          color: tone === 'accent' ? C.primary : C.muted,
          background: tone === 'accent' ? 'var(--v2t-accent)' : C.soft,
          whiteSpace: 'nowrap',
        },
      }, children)
    }

    function StatusDot({ status }) {
      const color = status === 'done' ? C.success
        : status === 'failed' ? C.danger
          : status === 'auth' ? '#d99a2b' : C.primary
      return h('span', {
        style: {
          width: 6, height: 6, borderRadius: 6, background: color, flex: 'none',
          boxShadow: 'none',
        },
      })
    }

    const apiFailure = (status, t) => {
      if (status === 401 || status === 403) return t('api.expired')
      if (status === 404 || status === 405) return t('api.missingRoute')
      if (status === 413) return t('api.tooLarge')
      if (status >= 500) return t('api.serverError')
      return `HTTP ${status}`
    }

    const readJson = async (res, t) => {
      const text = await res.text()
      try {
        return JSON.parse(text)
      } catch {
        throw new Error(apiFailure(res.status, t))
      }
    }

    function Player({ job, t, segments, activeIndex, seekRef, onTime, follow, setFollow, range, setRange }) {
      const videoRef = useRef(null)
      const wrapRef = useRef(null)
      const barRef = useRef(null)
      const [playing, setPlaying] = useState(false)
      const [time, setTime] = useState(0)
      const [duration, setDuration] = useState(job?.duration || 0)
      const [speed, setSpeed] = useState(1)
      const [muted, setMuted] = useState(false)
      const [subtitles, setSubtitles] = useState(true)
      const [dragging, setDragging] = useState(false)
      const [selAnchor, setSelAnchor] = useState(null)
      const [edgeDrag, setEdgeDrag] = useState(null)
      const [editingEdge, setEditingEdge] = useState(null)
      const [edgeValue, setEdgeValue] = useState('')
      const [fullscreen, setFullscreen] = useState(false)
      const [hoverBar, setHoverBar] = useState(false)
      const [hoverBtn, setHoverBtn] = useState('')
      const src = job?.hasMedia ? `${MEDIA}?id=${encodeURIComponent(job.id)}` : ''
      const poster = job?.meta?.cover || job?.cover || ''

      useEffect(() => {
        setTime(0)
        setPlaying(false)
        setDuration(job?.duration || 0)
      }, [job?.id])

      useEffect(() => {
        const onChange = () => setFullscreen(document.fullscreenElement === wrapRef.current)
        document.addEventListener('fullscreenchange', onChange)
        return () => document.removeEventListener('fullscreenchange', onChange)
      }, [])
      useEffect(() => { if (videoRef.current) videoRef.current.playbackRate = speed }, [speed, job?.id])
      useEffect(() => { if (videoRef.current) videoRef.current.muted = muted }, [muted, job?.id])

      const toggle = () => {
        const v = videoRef.current
        if (!v) return
        if (v.paused) { v.play(); setPlaying(true) } else { v.pause(); setPlaying(false) }
      }
      const seekTo = (seconds) => {
        const v = videoRef.current
        if (!v) return
        v.currentTime = Math.max(0, Math.min(seconds, v.duration || duration))
        setTime(v.currentTime)
        onTime?.(v.currentTime)
      }
      const seekToRef = useRef(seekTo)
      seekToRef.current = seekTo
      useEffect(() => {
        if (!seekRef) return undefined
        seekRef.current = (seconds) => {
          seekToRef.current(seconds)
          const v = videoRef.current
          if (v) { v.play?.(); setPlaying(true) }
        }
        return () => { seekRef.current = null }
      }, [seekRef])
      const ratioAt = (clientX) => {
        const r = barRef.current?.getBoundingClientRect()
        if (!r || r.width === 0) return 0
        return Math.max(0, Math.min(1, (clientX - r.left) / r.width))
      }
      useEffect(() => {
        if (!dragging) return
        const move = (e) => seekTo(ratioAt(e.clientX) * (duration || 0))
        const up = () => setDragging(false)
        window.addEventListener('pointermove', move)
        window.addEventListener('pointerup', up)
        return () => {
          window.removeEventListener('pointermove', move)
          window.removeEventListener('pointerup', up)
        }
      }, [dragging, duration])

      useEffect(() => {
        const onKey = (e) => {
          const el = document.activeElement
          const typing = el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA'
            || el.tagName === 'SELECT' || el.isContentEditable)
          if (typing) return
          const v = videoRef.current
          if (!v) return
          if (e.code === 'Space') {
            e.preventDefault()
            toggle()
          } else if (e.code === 'ArrowRight') { e.preventDefault(); seekTo(v.currentTime + 5) }
          else if (e.code === 'ArrowLeft') { e.preventDefault(); seekTo(v.currentTime - 5) }
          else if (e.code === 'KeyM') { setMuted((m) => !m) }
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
      }, [duration])

      const sub = subtitles ? segments[activeIndex] : null
      const progress = duration > 0 ? Math.min(100, (time / duration) * 100) : 0
      const marks = segments.length > 1 && segments.length <= 120
        ? segments.map((seg) => (duration > 0 ? (seg.start / duration) * 100 : 0))
        : []
      const tip = (key, label) => ({
        title: label,
        onMouseEnter: () => setHoverBtn(key),
        onMouseLeave: () => setHoverBtn(''),
        style: { ...iconBtn, background: hoverBtn === key ? 'rgba(255,255,255,0.14)' : 'transparent' },
      })

      return h('div', {
        ref: wrapRef, tabIndex: 0,
        style: {
          position: 'relative', borderRadius: fullscreen ? 0 : 16, overflow: 'hidden',
          height: fullscreen ? '100%' : 'auto', display: fullscreen ? 'flex' : 'block',
          alignItems: 'center', justifyContent: 'center',
          background: '#000', outline: 'none', userSelect: 'none',
          boxShadow: '0 8px 24px rgba(0,0,0,0.14)',
        },
        'data-v2t-player': '',
      }, [
        src
          ? h('video', {
            key: 'v', ref: videoRef, src, poster, preload: 'metadata',
            style: fullscreen
              ? { display: 'block', width: '100%', height: '100%', maxHeight: 'none', objectFit: 'contain', background: '#000' }
              : { display: 'block', width: '100%', maxHeight: '38vh', background: '#000' },
            onTimeUpdate: (e) => { setTime(e.currentTarget.currentTime); onTime?.(e.currentTarget.currentTime) },
            onLoadedMetadata: (e) => setDuration(e.currentTarget.duration || job?.duration || 0),
            onEnded: () => setPlaying(false),
            onPlay: () => setPlaying(true),
            onPause: () => setPlaying(false),
            onClick: toggle,
          })
          : h('div', {
            key: 'nomedia',
            style: {
              padding: '64px 16px', textAlign: 'center', color: 'rgba(255,255,255,0.72)',
              fontSize: 13, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
            },
          }, [h(Icon, { key: 'i', name: 'alert', size: 22 }), h('span', { key: 't' }, t('noMedia'))]),
        src && !playing && time === 0 ? h('button', {
          key: 'bigplay',
          onClick: toggle,
          'aria-label': t('player.play'),
          style: {
            position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)',
            width: 58, height: 58, borderRadius: 58, border: 0, cursor: 'pointer',
            background: 'rgba(255,255,255,0.92)', color: '#111',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 6px 18px rgba(0,0,0,0.28)',
          },
        }, h(Icon, { name: 'play', size: 24 })) : null,
        sub ? h('div', {
          key: 'sub',
          style: {
            position: 'absolute', left: '50%', transform: 'translateX(-50%)', bottom: 66,
            maxWidth: '82%', padding: '5px 11px', borderRadius: 6,
            background: 'rgba(0,0,0,0.7)', color: '#fff', fontSize: 15, lineHeight: 1.5,
            textAlign: 'center', pointerEvents: 'none', textShadow: '0 1px 2px rgba(0,0,0,0.4)',
          },
        }, sub.text) : null,
        src ? h('div', {
          key: 'bar',
          onMouseEnter: () => setHoverBar(true),
          onMouseLeave: () => setHoverBar(false),
          style: {
            position: 'absolute', left: 0, right: 0, bottom: 0, padding: '18px 12px 8px',
            background: 'linear-gradient(transparent, rgba(0,0,0,0.72))',
          },
        }, [
          range && duration > 0 ? ['start', 'end'].map((which) => {
            const at = which === 'start' ? range.start : range.end
            const left = Math.max(0, Math.min(100, (at / duration) * 100))
            return h('div', {
              key: `h-${which}`,
              onPointerDown: (e) => {
                e.stopPropagation()
                e.currentTarget.setPointerCapture?.(e.pointerId)
                setEdgeDrag(which)
              },
              onPointerMove: (e) => {
                if (edgeDrag !== which) return
                const at2 = ratioAt(e.clientX) * (duration || 0)
                setRange((prev) => {
                  if (!prev) return prev
                  if (which === 'start') return { ...prev, start: Math.min(at2, prev.end - 1) }
                  return { ...prev, end: Math.max(at2, prev.start + 1) }
                })
              },
              onPointerUp: () => setEdgeDrag(null),
              onPointerCancel: () => setEdgeDrag(null),
              onDoubleClick: (e) => {
                e.stopPropagation()
                setEditingEdge(which)
                setEdgeValue(fmt(at))
              },
              title: t(which === 'start' ? 'range.handleStart' : 'range.handleEnd'),
              style: {
                position: 'absolute', top: '50%', left: `${left}%`, transform: 'translate(-50%,-50%)',
                width: 12, height: 12, borderRadius: 4, background: '#fff',
                border: `2px solid ${C.primary}`, cursor: 'ew-resize', touchAction: 'none', zIndex: 4,
              },
            })
          }) : null,
          h('div', {
            key: 'track', ref: barRef,
            onPointerDown: (e) => {
              e.currentTarget.setPointerCapture?.(e.pointerId)
              const at = ratioAt(e.clientX) * (duration || 0)
              setSelAnchor({ from: at, moved: false, x: e.clientX })
              setDragging(true)
              if (!e.shiftKey) seekTo(at)
            },
            onPointerMove: (e) => {
              if (!selAnchor) return
              const at = ratioAt(e.clientX) * (duration || 0)
              const moved = selAnchor.moved || Math.abs(e.clientX - selAnchor.x) > 4
              if (!moved) return
              if (!selAnchor.moved) setSelAnchor({ ...selAnchor, moved: true })
              const a = Math.min(selAnchor.from, at)
              const b = Math.max(selAnchor.from, at)
              setRange({ start: a, end: b })
            },
            onPointerUp: () => {
              setDragging(false)
              setSelAnchor(null)
            },
            onPointerCancel: () => { setDragging(false); setSelAnchor(null) },
            style: { height: 18, display: 'flex', alignItems: 'center', cursor: 'pointer', touchAction: 'none' },
          }, [
            h('div', {
              key: 'rail',
              style: {
                position: 'relative', width: '100%', borderRadius: 3,
                height: hoverBar || dragging ? 5 : 3, background: 'rgba(255,255,255,0.26)',
                transition: 'height 120ms',
              },
            }, [
              h('div', { key: 'fill', style: { position: 'absolute', left: 0, top: 0, height: '100%', width: `${progress}%`, background: '#fff', borderRadius: 3 } }),
              range && duration > 0 ? h('div', {
                key: 'sel',
                style: {
                  position: 'absolute', top: -3, height: 'calc(100% + 6px)',
                  left: `${Math.max(0, (range.start / duration) * 100)}%`,
                  width: `${Math.max(0.4, ((range.end - range.start) / duration) * 100)}%`,
                  borderRadius: 4, background: 'rgba(65,118,230,0.55)',
                  border: '1px solid rgba(255,255,255,0.85)', pointerEvents: 'none',
                },
              }) : null,
              ...marks.slice(1).map((left, i) => h('span', {
                key: `m${i}`,
                style: {
                  position: 'absolute', left: `${left}%`, top: '50%', transform: 'translate(-50%,-50%)',
                  width: 2, height: 2, borderRadius: 2, background: 'rgba(255,255,255,0.55)', pointerEvents: 'none',
                },
              })),
              h('div', {
                key: 'dot',
                style: {
                  position: 'absolute', left: `${progress}%`, top: '50%', transform: 'translate(-50%,-50%)',
                  width: hoverBar || dragging ? 13 : 10, height: hoverBar || dragging ? 13 : 10,
                  borderRadius: 13, background: '#fff', transition: 'width 120ms, height 120ms',
                },
              }),
            ]),
          ]),
          editingEdge ? h('div', {
            key: 'edge-edit',
            style: {
              position: 'absolute', bottom: 78, left: '50%', transform: 'translateX(-50%)',
              display: 'flex', gap: 6, padding: '6px 8px', borderRadius: 10,
              background: 'rgba(0,0,0,0.82)', border: '1px solid rgba(255,255,255,0.18)',
            },
          }, [
            h('span', { key: 'l', style: { color: '#fff', fontSize: 11, alignSelf: 'center' } },
              editingEdge === 'start' ? t('range.handleStart') : t('range.handleEnd')),
            h('input', {
              key: 'i', value: edgeValue, autoFocus: true,
              onFocus: (e) => e.currentTarget.select(),
              onChange: (e) => setEdgeValue(e.target.value),
              onKeyDown: (e) => {
                if (e.key === 'Enter') {
                  const sec = parseClock(edgeValue)
                  if (sec !== null) {
                    setRange((prev) => {
                      if (!prev) return prev
                      if (editingEdge === 'start') return { ...prev, start: Math.max(0, Math.min(sec, prev.end - 1)) }
                      return { ...prev, end: Math.min(duration || sec, Math.max(sec, prev.start + 1)) }
                    })
                  }
                  setEditingEdge(null)
                } else if (e.key === 'Escape') setEditingEdge(null)
              },
              style: {
                width: 62, padding: '3px 6px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.25)',
                background: 'rgba(255,255,255,0.1)', color: '#fff', fontSize: 11.5, fontVariantNumeric: 'tabular-nums',
              },
            }),
          ]) : null,
          h('div', { key: 'ctl', style: { display: 'flex', alignItems: 'center', gap: 4, color: '#fff', marginTop: 2 } }, [
            h('button', {
              key: 'p', ...tip('play', playing ? t('player.pause') : t('player.play')),
              onClick: toggle,
            }, h(Icon, { name: playing ? 'pause' : 'play', size: 17 })),
            h('button', {
              key: 'm', ...tip('mute', t('player.mute')),
              onClick: () => setMuted(!muted),
              style: { ...tip('mute', t('player.mute')).style, opacity: muted ? 0.45 : 1 },
            }, h(Icon, { name: 'volume', size: 17 })),
            h('span', { key: 't', style: { fontSize: 11.5, fontVariantNumeric: 'tabular-nums', opacity: 0.92, marginLeft: 2, letterSpacing: 0.2 } },
              `${fmt(time)} / ${fmt(duration)}`),
            h('div', { key: 'spacer', style: { flex: 1 } }),
            h('button', {
              key: 's', ...tip('speed', t('player.speed')),
              onClick: () => setSpeed(speed === 1 ? 1.25 : speed === 1.25 ? 1.5 : speed === 1.5 ? 2 : 1),
            }, h('span', { style: { fontSize: 11.5, fontWeight: 500 } }, `${speed}×`)),
            h('button', {
              key: 'cc', ...tip('cc', t('player.subtitles')),
              onClick: () => setSubtitles(!subtitles),
              style: { ...tip('cc', t('player.subtitles')).style, opacity: subtitles ? 1 : 0.45 },
            }, h(Icon, { name: 'cc', size: 17 })),
            h('button', {
              key: 'f', ...tip('follow', t('player.follow')),
              onClick: () => setFollow(!follow),
              style: { ...tip('follow', t('player.follow')).style, opacity: follow ? 1 : 0.45 },
            }, h(Icon, { name: 'follow', size: 16 })),
            h('button', { key: 'pi', ...tip('pip', t('player.pip')), onClick: () => videoRef.current?.requestPictureInPicture?.() },
              h(Icon, { name: 'pip', size: 17 })),
            h('button', { key: 'fs', ...tip('fs', t('player.fullscreen')), onClick: () => wrapRef.current?.requestFullscreen?.() },
              h(Icon, { name: 'full', size: 17 })),
          ]),
        ]) : null,
      ])
    }

    function Transcript({ segments, activeIndex, onSeek, listRef }) {
      if (!segments.length) {
        return h('div', { style: { padding: 24, textAlign: 'center', color: C.muted, fontSize: 13 } }, '—')
      }
      return h('div', {
        ref: listRef,
        style: { overflow: 'auto', maxHeight: 440, paddingRight: 2, marginTop: 2 },
      }, segments.map((seg, i) => h('div', {
        key: i, onClick: (e) => onSeek(seg.start, i, e.shiftKey), 'data-v2t-seg': i,
        onMouseEnter: (e) => { e.currentTarget.style.background = C.soft },
        onMouseLeave: (e) => {
          e.currentTarget.style.background = i === activeIndex ? C.soft : 'transparent'
        },
        style: {
          display: 'flex', gap: 12, padding: '7px 10px', borderRadius: 8,
          cursor: 'pointer', transition: 'background 120ms',
          background: i === activeIndex ? C.soft : 'transparent',
          borderLeft: `2px solid ${i === activeIndex ? C.primary : 'transparent'}`,
          paddingLeft: 12,
        },
      }, [
        h('span', {
          key: 't',
          style: {
            flex: 'none', width: 42, fontSize: 11, lineHeight: '23px',
            fontVariantNumeric: 'tabular-nums',
            color: i === activeIndex ? C.primary : C.faint,
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
          },
        }, fmt(seg.start)),
        h('span', {
          key: 'x',
          style: {
            fontSize: 14, lineHeight: 1.78,
            color: C.text, opacity: i === activeIndex ? 1 : 0.82,
          },
        }, seg.text),
      ])))
    }

    function Thumb({ job, t, width = 44, height = 28 }) {
      const cover = job?.cover || ''
      const pending = job?.status === 'running' || job?.status === 'auth'
      return h('span', {
        style: {
          width, height, flex: 'none', borderRadius: 6, overflow: 'hidden',
          background: C.layer2, display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: C.faint,
          animation: !cover && pending ? 'v2t-pulse 1.3s ease-in-out infinite' : 'none',
        },
      }, cover
        ? h('img', {
          src: `/plugins/dsh-video2text/cover?url=${encodeURIComponent(cover)}`,
          alt: '',
          onError: (e) => { e.currentTarget.style.visibility = 'hidden' },
          style: { width: '100%', height: '100%', objectFit: 'cover', display: 'block' },
        })
        : h(Icon, { name: 'film', size: Math.max(12, Math.min(width, height) - 12) }))
    }

    function Processing({ job, t, onCancel }) {
      const [now, setNow] = useState(Date.now())
      useEffect(() => {
        const id = setInterval(() => setNow(Date.now()), 1000)
        return () => clearInterval(id)
      }, [])
      const elapsed = Math.max(0, Math.floor((now - (job?.startedAt || now)) / 1000))
      const log = (job?.log || []).join('\n')
      let step = 0
      if (/下载|dub|Downloading/i.test(log)) step = 1
      if (/转写|transcrib/i.test(log)) step = 2
      if (/对齐|align/i.test(log)) step = 3
      const steps = [t('step.resolve'), t('step.download'), t('step.asr'), t('step.align')]
      const inWindow = /打开窗口扫码|扫码登录|扫码/.test(log)
      return h('div', {
        style: {
          borderRadius: 14, border: `0.5px solid ${C.border}`, background: C.layer,
          padding: 28, display: 'flex', flexDirection: 'column', gap: 18,
        },
      }, [
        inWindow ? h('div', {
          key: 'win',
          style: {
            display: 'flex', alignItems: 'center', gap: 8, padding: '8px 11px', borderRadius: 10,
            background: 'var(--v2t-accent)', color: C.primary, fontSize: 12, lineHeight: 1.6,
          },
        }, [h(Icon, { key: 'i', name: 'user', size: 14 }), h('span', { key: 't' }, t('proc.window'))]) : null,
        h('div', { key: 'h', style: { display: 'flex', alignItems: 'center', gap: 10 } }, [
          h('span', {
            key: 'spin',
            style: {
              width: 16, height: 16, borderRadius: 16,
              border: `2px solid ${C.border}`, borderTopColor: C.primary,
              animation: 'v2t-spin 900ms linear infinite',
            },
          }),
          h('span', { key: 't', style: { fontSize: 14, color: C.text } }, `${t('state.running')}…`),
          h('span', { key: 'e', style: { fontSize: 11.5, color: C.faint, fontVariantNumeric: 'tabular-nums' } }, `${t('processing.elapsed')} ${fmt(elapsed)}`),
          h('span', { key: 'u', style: { fontSize: 12, color: C.muted, marginLeft: 'auto', maxWidth: '40%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, job?.url || job?.fromFile),
          h('button', {
            key: 'cancel', onClick: onCancel,
            style: { ...iconBtn, color: C.muted, fontSize: 12, border: `0.5px solid ${C.border}`, padding: '3px 10px' },
          }, t('processing.cancel')),
        ]),
        (job?.cover || job?.title || job?.url || job?.fromFile) ? h('div', {
          key: 'src',
          style: {
            display: 'flex', alignItems: 'center', gap: 10, paddingBottom: 12,
            borderBottom: `0.5px solid ${C.border}`,
          },
        }, [
          h(Thumb, { key: 'th', job, t, width: 76, height: 46 }),
          h('div', { key: 'x', style: { minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 } }, [
            h('div', {
              key: 't',
              style: { fontSize: 13.5, fontWeight: 550, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
            }, job?.title || job?.url || job?.fromFile || job?.id),
            h('div', { key: 'c', style: { fontSize: 11, color: C.faint } },
              [platformLabel(job?.meta?.platform, t), job?.meta?.author,
                job?.duration ? fmt(job.duration) : ''].filter(Boolean).join(' · ')
              || (job?.status === 'running' ? t('state.running') : '')),
          ]),
        ]) : null,
        h('div', { key: 'steps', style: { display: 'flex', gap: 8, flexWrap: 'wrap' } },
          steps.map((label, i) => h('div', {
            key: i,
            style: {
              display: 'flex', alignItems: 'center', gap: 6, fontSize: 12,
              color: i <= step ? C.text : C.faint,
            },
          }, [
            h('span', {
              key: 'd',
              style: {
                width: 18, height: 18, borderRadius: 18, display: 'inline-flex',
                alignItems: 'center', justifyContent: 'center', fontSize: 10,
                background: i < step ? C.success : i === step ? C.primary : C.layer2,
                color: i <= step ? '#fff' : C.faint,
              },
            }, i < step ? h(Icon, { name: 'check', size: 11 }) : i + 1),
            label,
          ]))),
        h('pre', {
          key: 'log',
          style: {
            margin: 0, padding: 10, maxHeight: 160, overflow: 'auto',
            borderRadius: 8, background: C.bg, border: `0.5px solid ${C.border}`,
            font: '11.5px/1.7 ui-monospace, SFMono-Regular, Menlo, monospace',
            color: C.muted, whiteSpace: 'pre-wrap',
          },
        }, (job?.log || []).slice(-12).join('\n') || '…'),
      ])
    }

    function Failed({ job, t, onRetry, notify }) {
      const target = job?.authTarget || ''
      const serviceIssue = job?.authKind === 'service'
      const [run, setRun] = useState(null)
      const [now, setNow] = useState(Date.now())
      const autoRetried = useRef(false)
      useEffect(() => { autoRetried.current = false; setRun(null) }, [job?.id])
      useEffect(() => {
        if (!run || run.status !== 'running') return undefined
        const id = setInterval(() => setNow(Date.now()), 1000)
        return () => clearInterval(id)
      }, [run])
      const label = target === 'wechat' ? t('accounts.wechat')
        : target === 'douyin' ? t('accounts.douyin')
          : target === 'xhs' ? t('accounts.xhs') : target

      useEffect(() => {
        if (!run || run.status !== 'running') return undefined
        const id = setInterval(async () => {
          try {
            const res = await fetch('/plugins/dsh-video2text/accounts', { headers: { accept: 'application/json' } })
            const data = await res.json()
            const mine = (data.logins || []).find((row) => row.target === target)
            if (mine) setRun(mine)
          } catch {}
        }, POLL_MS)
        return () => clearInterval(id)
      }, [run, target])

      const startLogin = async () => {
        setRun({ status: 'running', log: [] })
        try {
          const res = await fetch('/plugins/dsh-video2text/accounts', {
            method: 'POST', headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ target }),
          })
          const data = await res.json()
          if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
          setRun(data)
        } catch (err) {
          setRun({ status: 'failed', error: String(err?.message || err), log: [] })
          notify?.(`${t('auth.failed')}：${String(err?.message || err)}`)
        }
      }

      const signedIn = run && run.status === 'done'
      const waited = run && run.status === 'running'
        ? Math.max(0, Math.floor((now - (run.startedAt || now)) / 1000))
        : 0

      // 登录一完成就自动接着转写，不用再点一次
      useEffect(() => {
        if (!signedIn || autoRetried.current) return
        autoRetried.current = true
        notify?.(t('auth.auto'))
        onRetry()
      }, [signedIn])
      return h('div', {
        style: {
          borderRadius: 14, border: `0.5px solid ${C.border}`, background: C.layer, padding: 22,
          display: 'flex', flexDirection: 'column', gap: 10,
        },
      }, [
        h('div', {
          key: 'h',
          style: { display: 'flex', alignItems: 'center', gap: 8, color: target ? (signedIn ? C.success : '#b8801f') : C.danger },
        }, [
          h(Icon, { key: 'i', name: target && !signedIn ? 'user' : 'alert', size: 18 }),
          h('span', { key: 't', style: { fontSize: 14, fontWeight: 600 } },
            target
              ? (signedIn ? t('auth.done') : `${t(serviceIssue ? 'auth.service' : 'auth.title')}${label ? ` · ${label}` : ''}`)
              : t('state.failed')),
        ]),
        target && !signedIn
          ? h('div', { key: 'd', style: { fontSize: 12.5, color: C.muted, lineHeight: 1.7 } },
            t(serviceIssue ? 'auth.serviceDesc' : 'auth.desc'))
          : null,
        job?.error
          ? h('div', { key: 'e', style: { fontSize: 12.5, color: C.text, lineHeight: 1.7, wordBreak: 'break-word' } }, job.error)
          : null,
        !target ? h('div', { key: 'hint', style: { fontSize: 12, color: C.muted } }, t('failed.hint')) : null,
        run && run.status === 'running'
          ? h('div', {
            key: 'run',
            style: {
              padding: '7px 10px', borderRadius: 8, background: C.bg, border: `0.5px solid ${C.border}`,
              fontSize: 10.5, color: C.muted, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
              whiteSpace: 'pre-wrap', maxHeight: 60, overflow: 'auto',
            },
          }, [
            h('div', { key: 's', style: { color: C.text, marginBottom: 2 } },
              `${t('auth.waiting')} · ${t('auth.elapsed')} ${waited}s`),
            (run.log || []).slice(-2).join('\n') || '…',
          ])
          : null,
        h('div', { key: 'a', style: { display: 'flex', gap: 8, flexWrap: 'wrap' } }, [
          target && !signedIn ? h('button', {
            key: 'login', onClick: startLogin, disabled: run?.status === 'running',
            style: {
              height: 30, padding: '0 14px', borderRadius: 8, border: 0, font: 'inherit',
              background: C.primary, color: '#fff',
              cursor: run?.status === 'running' ? 'default' : 'pointer',
              opacity: run?.status === 'running' ? 0.6 : 1,
            },
          }, t('auth.login')) : null,
          h('button', {
            key: 'r', onClick: () => onRetry(),
            style: {
              height: 30, padding: '0 14px', borderRadius: 8, font: 'inherit', cursor: 'pointer',
              border: target && !signedIn ? `0.5px solid ${C.border}` : 0,
              background: target && !signedIn ? 'transparent' : C.primary,
              color: target && !signedIn ? C.muted : '#fff',
            },
          }, target ? t('auth.retry') : t('form.retry')),
          target ? null : h('button', {
            key: 'o',
            onClick: () => onRetry(job?.backend === 'api' ? 'auto' : 'api'),
            style: {
              height: 30, padding: '0 14px', borderRadius: 8, font: 'inherit', cursor: 'pointer',
              border: `0.5px solid ${C.border}`, background: 'transparent', color: C.muted,
            },
          }, job?.backend === 'api' ? t('failed.localRetry') : t('failed.cloudRetry')),
        ].filter(Boolean)),
      ])
    }

    // 只留三种：发布稿、字幕、打包。纯口播稿/章节页都能从这两者得到，CLI 仍然支持
    const EXPORTS = [
      ['publish', 'export.publish'],
      ['srt', 'export.srt'],
      ['sheet', 'export.sheet'],
      ['bundle', 'export.bundle'],
    ]

    function ExportMenu({ t, busy, onPick, aligned }) {
      const [open, setOpen] = useState(false)
      const wrap = useRef(null)
      useEffect(() => {
        if (!open) return undefined
        const off = (e) => { if (!wrap.current?.contains?.(e.target)) setOpen(false) }
        const esc = (e) => { if (e.key === 'Escape') setOpen(false) }
        window.addEventListener('pointerdown', off)
        window.addEventListener('keydown', esc)
        return () => {
          window.removeEventListener('pointerdown', off)
          window.removeEventListener('keydown', esc)
        }
      }, [open])
      return h('div', { ref: wrap, style: { position: 'relative' } }, [
        h('button', {
          key: 'b',
          onClick: () => setOpen((v) => !v),
          'aria-expanded': open,
          style: {
            ...iconBtn, fontSize: 12, padding: '4px 10px', borderRadius: 8,
            border: `0.5px solid ${open ? C.primary : C.border}`,
            color: open ? C.primary : C.muted,
            background: open ? 'var(--v2t-accent)' : 'transparent',
            gap: 5,
          },
        }, h(Icon, { name: 'download', size: 13 }), t('export.title'),
          h('span', { style: { display: 'flex', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 140ms' } },
            h(Icon, { name: 'chevron', size: 12 }))),
        open ? h('div', {
          key: 'm',
          style: {
            position: 'absolute', right: 0, top: 'calc(100% + 6px)', zIndex: 30, width: 210,
            padding: 5, borderRadius: 12, border: `0.5px solid ${C.border}`,
            background: C.layer, boxShadow: '0 14px 34px rgba(0,0,0,0.16)',
          },
        }, EXPORTS.flatMap(([kind, key]) => {
          const items = [h('button', {
            key,
            onClick: () => { setOpen(false); onPick(kind) },
            disabled: Boolean(busy),
            style: {
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
              width: '100%', padding: '7px 10px', borderRadius: 8, border: 0,
              background: 'transparent', color: C.text, font: 'inherit', fontSize: 12.5,
              cursor: busy ? 'default' : 'pointer', textAlign: 'left',
              opacity: busy && busy !== kind ? 0.5 : 1,
            },
            onMouseEnter: (e) => { e.currentTarget.style.background = C.soft },
            onMouseLeave: (e) => { e.currentTarget.style.background = 'transparent' },
          }, [
            h('span', { key: 'l' }, t(key)),
            busy === kind ? h('span', { key: 's', style: { fontSize: 11, color: C.faint } }, t('export.busy')) : null,
          ])]
          if (!aligned && (kind === 'srt' || kind === 'bundle')) {
            items.push(h('div', {
              key: `${kind}-note`,
              style: { padding: '0 10px 6px', fontSize: 10, color: C.faint, lineHeight: 1.5 },
            }, t('export.notAligned')))
          }
          return items
        }))
        : null,
      ])
    }

    function AlignStrip({ job, t }) {
      const [now, setNow] = useState(Date.now())
      useEffect(() => {
        const id = setInterval(() => setNow(Date.now()), 1000)
        return () => clearInterval(id)
      }, [])
      const elapsed = Math.max(0, Math.floor((now - (job?.aligningSince || now)) / 1000))
      const last = (job?.log || []).slice(-1)[0] || t('align.running')
      return h('div', {
        style: {
          display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px',
          borderRadius: 12, border: `0.5px solid ${C.border}`, background: C.layer, fontSize: 12,
        },
      }, [
        h('span', {
          key: 's',
          style: {
            width: 13, height: 13, borderRadius: 13, border: `2px solid ${C.border}`,
            borderTopColor: C.primary, animation: 'v2t-spin 900ms linear infinite', flex: 'none',
          },
        }),
        h('span', { key: 'l', style: { color: C.text } }, t('align.running')),
        h('span', { key: 'e', style: { fontSize: 11.5, color: C.faint, fontVariantNumeric: 'tabular-nums' } },
          `${t('auth.elapsed')} ${elapsed}s`),
        h('span', {
          key: 'log',
          style: {
            marginLeft: 'auto', fontSize: 10.5, color: C.faint, maxWidth: '55%',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          },
        }, last),
      ])
    }

    function RunningStrip({ job, t, onCancel }) {
      const [now, setNow] = useState(Date.now())
      useEffect(() => {
        const id = setInterval(() => setNow(Date.now()), 1000)
        return () => clearInterval(id)
      }, [])
      const elapsed = Math.max(0, Math.floor((now - (job?.startedAt || now)) / 1000))
      const log = (job?.log || []).join('\n')
      let step = 0
      if (/下载|dub|Downloading/i.test(log)) step = 1
      if (/转写|transcrib/i.test(log)) step = 2
      if (/对齐|align/i.test(log)) step = 3
      const steps = [t('step.resolve'), t('step.download'), t('step.asr'), t('step.align')]
      return h('div', {
        style: {
          display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px',
          borderRadius: 12, border: `0.5px solid ${C.border}`, background: C.layer,
          fontSize: 12, color: C.muted,
        },
      }, [
        h('span', {
          key: 's',
          style: {
            width: 13, height: 13, borderRadius: 13, border: `2px solid ${C.border}`,
            borderTopColor: C.primary, animation: 'v2t-spin 900ms linear infinite', flex: 'none',
          },
        }),
        h('span', { key: 'l', style: { color: C.text } }, `${t('state.running')}… ${steps[step]}`),
        h('span', { key: 'e', style: { fontVariantNumeric: 'tabular-nums', fontSize: 11.5, color: C.faint } }, fmt(elapsed)),
        h('div', { key: 'sp', style: { flex: 1 } }),
        h('span', { key: 'v', style: { fontSize: 11, color: C.faint } }, t('player.ready')),
        h('button', {
          key: 'c', onClick: onCancel,
          style: { ...iconBtn, fontSize: 11.5, color: C.muted, border: `0.5px solid ${C.border}`, padding: '2px 9px' },
        }, t('processing.cancel')),
      ])
    }

    function Viewer({ job, t, segments, activeIndex, onSeek, follow, setFollow, listRef, onRetry, onDeleted, seekRef, onTime, notify, onAlignStarted }) {
      const [tab, setTab] = useState('transcript')
      const [exportBusy, setExportBusy] = useState('')
      const [asking, setAsking] = useState(false)
      const [range, setRange] = useState(null)
      const wasAligning = useRef(false)
      const [ctxInfo, setCtxInfo] = useState(null)
      const ready = job.status === 'done'
      useEffect(() => {
        setTab('transcript'); setExportBusy('')
        setCtxInfo(null); setAsking(false)
      }, [job?.id])
      const tabs = [['transcript', t('tab.transcript')], ['copy', t('tab.copy')], ['info', t('tab.info')]]
      const seek = (s) => onSeek(s)
      const onSeg = (seconds) => { seek(seconds) }
      const cancelJob = () => {
        fetch('/plugins/dsh-video2text/cancel', {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ id: job.id }),
        })
      }
      const copy = async (text, label) => {
        try {
          await navigator.clipboard?.writeText(text || '')
          notify(label || t('toast.copied'))
        } catch {
          notify(t('toast.copyFailed'))
        }
      }
      const withTime = (list) => list.map((x) => `[${fmt(x.start)}] ${x.text}`).join('\n')
      const copyAll = () => copy(withTime(segments), `${t('toast.copied')} · ${t('stat.segments', { n: segments.length })}`)
      const loadContext = async () => {
        if (ctxInfo) return ctxInfo
        const res = await fetch(`/plugins/dsh-video2text/context?id=${encodeURIComponent(job.id)}`)
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
        setCtxInfo(data)
        return data
      }
      useEffect(() => {
        if (tab !== 'info' || ctxInfo || !ready) return
        loadContext().catch(() => {})
      }, [tab, ctxInfo, ready])

      // 在新会话里把这条视频的上下文填进输入框，用户只需回车
      const askAI = async () => {
        setAsking(true)
        try {
          // 旧宿主没有 /context 时退化成「用链接重跑」，不至于点了没反应
          let data = null
          try {
            data = await loadContext()
          } catch {
            const lines = [
              t('ask.fallbackIntro'), '',
              `${t('ask.fallbackTitle')}${job.title || t('ask.unknown')}`,
              `${t('ask.fallbackSource')}${job.url || job.fromFile || job.id}`,
            ]
            if (job.duration) lines.push(`${t('ask.fallbackDuration')}${Math.round(job.duration)}s`)
            if (segments.length) {
              lines.push(`${t('ask.fallbackTranscript')}${t('stat.segments', { n: segments.length })} / ${t('stat.chars', { n: charCount(segments) })}`)
            }
            lines.push('', t('ask.fallbackNote'), '', t('ask.fallbackTail'))
            data = { dir: '', files: {}, prompt: lines.join('\n') }
          }
          await openSessionWith({ t, prompt: data.prompt, jobId: job.id, notify })
          notify(t('askAi.done'))
        } catch (err) {
          notify(`${t('askAi.fail')}：${String(err?.message || err)}`)
        } finally {
          setAsking(false)
        }
      }

      useEffect(() => {
        if (wasAligning.current && !job.aligning) {
          notify(job.aligned ? t('align.doneToast') : t('align.failed'))
        }
        wasAligning.current = Boolean(job.aligning)
      }, [job.aligning, job.aligned])

      const doAlign = async () => {
        if (job.aligned) {
          notify(t('align.already'))
          return
        }
        try {
          const res = await fetch('/plugins/dsh-video2text/align', {
            method: 'POST', headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ id: job.id }),
          })
          const data = await res.json()
          if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
          notify(t('align.started'))
          onAlignStarted?.()
        } catch (err) {
          notify(`${t('align.failed')}：${String(err?.message || err)}`)
        }
      }

      const [preview, setPreview] = useState(null)
      const [previewBusy, setPreviewBusy] = useState(false)
      const previewKey = range && range.end - range.start >= 1
        ? `${Math.round(range.start)}-${Math.round(range.end)}`
        : ''
      useEffect(() => {
        if (!previewKey) { setPreview(null); return undefined }
        let dead = false
        setPreviewBusy(true)
        const timer = setTimeout(async () => {
          try {
            const res = await fetch('/plugins/dsh-video2text/sheet', {
              method: 'POST', headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ id: job.id, start: range.start, end: range.end, preview: true }),
            })
            const data = await readJson(res, t)
            if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
            if (!dead) setPreview(data.url)
          } catch {
            if (!dead) setPreview(null)
          } finally {
            if (!dead) setPreviewBusy(false)
          }
        }, 400)
        return () => { dead = true; clearTimeout(timer) }
      }, [previewKey, job.id])

      const doSheet = async () => {
        setExportBusy('sheet')
        try {
          const res = await fetch('/plugins/dsh-video2text/sheet', {
            method: 'POST', headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              id: job.id,
              start: range ? range.start : 0,
              end: range ? range.end : null,
            }),
          })
          const data = await readJson(res, t)
          if (!res.ok) throw new Error(data.error || apiFailure(res.status, t))
          const a = document.createElement('a')
          a.href = data.url
          a.download = data.name
          document.body.appendChild(a)
          a.click()
          a.remove()
          notify(`${t('toast.exported')} · ${data.name}`)
        } catch (err) {
          notify(`${t('toast.exportFailed')}${String(err?.message || err)}`)
        } finally {
          setExportBusy('')
        }
      }

      const doExport = async (kind) => {
        if (kind === 'sheet') { await doSheet(); return }
        setExportBusy(kind)
        try {
          const res = await fetch('/plugins/dsh-video2text/export', {
            method: 'POST', headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ id: job.id, kind }),
          })
          const data = await readJson(res, t)
          if (!res.ok) throw new Error(data.error || apiFailure(res.status, t))
          const a = document.createElement('a')
          a.href = data.url
          a.download = data.name
          document.body.appendChild(a)
          a.click()
          a.remove()
          notify(`${t('toast.exported')} · ${data.name}`)
        } catch (err) {
          notify(`${t('toast.exportFailed')}${String(err?.message || err)}`)
        } finally {
          setExportBusy('')
        }
      }
      const removeJob = async () => {
        if (!window.confirm(t('confirm.delete'))) return
        await fetch(`/plugins/dsh-video2text/jobs?id=${encodeURIComponent(job.id)}`, { method: 'DELETE' })
        notify(t('toast.deleted'))
        onDeleted?.()
      }
      const meta = job?.meta || {}
      const chars = charCount(segments)
      const chips = [platformLabel(meta.platform, t), meta.author,
        meta.published, job?.duration ? fmt(job.duration) : ''].filter(Boolean)
      const stat = [segments.length ? t('stat.segments', { n: segments.length }) : '',
                    chars ? t('stat.chars', { n: chars }) : '', pace(segments, job?.duration, t)]
        .filter(Boolean).join(' · ')

      return h('div', { style: { display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 } }, [
        job.status === 'running'
          ? (job.hasMedia
            ? h(Player, { key: 'p', job, t, segments, activeIndex, seekRef, onTime, follow, setFollow, range, setRange })
            : h(Processing, { key: 'proc', job, t, onCancel: cancelJob }))
          : (job.status === 'failed' || job.status === 'auth')
            ? h(Failed, { key: 'fail', job, t, onRetry, notify })
            : h(Player, { key: 'p', job, t, segments, activeIndex, seekRef, onTime, follow, setFollow, range, setRange }),
        job.status === 'running' && job.hasMedia
          ? h(RunningStrip, { key: 'strip', job, t, onCancel: cancelJob })
          : null,
        job.aligning ? h(AlignStrip, { key: 'aligning', job, t }) : null,
        job.status === 'running' && !job.hasMedia ? null : h('div', { key: 'title', style: { display: 'flex', flexDirection: 'column', gap: 6 } }, [
          h('div', { key: 't', style: { fontSize: 16.5, fontWeight: 600, letterSpacing: 0.1, color: C.text, lineHeight: 1.35, wordBreak: 'break-word' } },
            job?.title || job?.url || job?.fromFile || job?.id),
          h('div', { key: 'chips', style: { display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' } }, [
            ...chips.map((x, i) => h(Chip, { key: i, tone: i === 0 ? 'accent' : undefined }, x)),
            segments.length ? h(Chip, {
              key: 'timeline',
              tone: job.aligned ? 'accent' : undefined,
            }, job.aligned ? t('timeline.aligned') : t('timeline.estimated')) : null,
            stat ? h('span', { key: 'stat', style: { fontSize: 11, color: C.faint, fontVariantNumeric: 'tabular-nums', marginLeft: 2 } }, stat) : null,
          ].filter(Boolean)),
        ]),
        range && (range.end - range.start) >= 1 ? h('div', {
          key: 'selbar',
          style: {
            display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', marginTop: 2,
            borderRadius: 10, border: `0.5px solid ${C.primary}`, background: 'var(--v2t-accent)',
            fontSize: 11.5, color: C.primary,
          },
        }, [
          preview ? h('img', {
            key: 'pv', src: preview, alt: '', title: t('range.previewHint'),
            onClick: () => window.open(preview, '_blank'),
            style: { height: 44, borderRadius: 6, border: `0.5px solid ${C.border}`, cursor: 'zoom-in' },
          }) : previewBusy ? h('span', {
            key: 'pvb',
            style: { width: 44, height: 33, borderRadius: 6, border: `0.5px solid ${C.border}`,
              display: 'grid', placeItems: 'center', fontSize: 9, color: C.faint },
          }, '…') : null,
          h(Icon, { key: 'i', name: 'crosshair', size: 12 }),
          h('span', { key: 'l', style: { fontVariantNumeric: 'tabular-nums' } },
            `${t('range.selected')} ${fmt(range.start)} – ${fmt(range.end)} · ${Math.round(range.end - range.start)}s`),
          h('div', { key: 'sp', style: { flex: 1 } }),
          h('button', {
            key: 'go', onClick: doSheet, disabled: exportBusy === 'sheet',
            style: { ...iconBtn, fontSize: 11.5, padding: '3px 9px', borderRadius: 7, border: `0.5px solid ${C.primary}`, color: C.primary },
          }, exportBusy === 'sheet' ? t('export.busy') : t('range.sheet')),
          h('button', {
            key: 'clear', onClick: () => setRange(null),
            style: { ...iconBtn, fontSize: 11.5, padding: '3px 8px', borderRadius: 7, border: `0.5px solid ${C.border}`, color: C.muted },
          }, t('range.clear')),
        ]) : null,
        ready ? h('div', { key: 'tools', style: { display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 } }, [
          h('div', { key: 'sp', style: { flex: 1 } }),
          h('button', {
            key: 'ai',
            onClick: askAI, disabled: asking, title: t('askAi.title'),
            style: {
              ...iconBtn, fontSize: 12, padding: '4px 10px', borderRadius: 8, gap: 5,
              border: `0.5px solid ${C.border}`, color: C.muted, opacity: asking ? 0.6 : 1,
            },
          }, h(Icon, { name: 'spark', size: 13 }), asking ? '…' : t('askAi')),
          ready && segments.length ? h('button', {
            key: 'align',
            onClick: doAlign,
            disabled: job.aligning,
            title: t('align.actionHint'),
            style: {
              ...iconBtn, fontSize: 12, padding: '4px 10px', borderRadius: 8, gap: 5,
              border: `0.5px solid ${job.aligned ? C.border : C.primary}`,
              color: job.aligned ? C.faint : C.primary,
              background: job.aligned ? 'transparent' : 'var(--v2t-accent)',
              opacity: job.aligning ? 0.6 : 1,
            },
          }, h(Icon, { name: 'crosshair', size: 13 }),
          job.aligning ? t('align.running') : job.aligned ? t('align.done') : t('align.action')) : null,
          ready && segments.length ? h(ExportMenu, { key: 'ex', t, busy: exportBusy, onPick: doExport, aligned: job.aligned }) : null,
          job?.url ? h('a', {
            key: 'open', href: job.url, target: '_blank', rel: 'noreferrer',
            style: {
              ...iconBtn, fontSize: 12, padding: '4px 10px', borderRadius: 8, gap: 5,
              border: `0.5px solid ${C.border}`, color: C.muted, textDecoration: 'none',
            },
          }, h(Icon, { name: 'external', size: 13 }), t('open.source')) : null,
        ]) : null,
        ready ? h('div', { key: 'tabarea', style: { display: 'flex', flexDirection: 'column', gap: 10 } }, [
        h('div', { key: 'tabs', style: { display: 'flex', alignItems: 'center', gap: 20, borderBottom: `0.5px solid ${C.border}` } }, [
          ...tabs.map(([key, label]) => h('button', {
            key, onClick: () => setTab(key),
            style: {
              background: 'transparent', border: 0, padding: '7px 0 9px', cursor: 'pointer',
              fontSize: 13, color: tab === key ? C.text : C.muted,
              fontWeight: tab === key ? 600 : 400,
              borderBottom: tab === key ? `2px solid ${C.primary}` : '2px solid transparent',
              marginBottom: -1, transition: 'color 120ms',
            },
          }, label)),
          h('div', { key: 'sp', style: { flex: 1 } }),
          tab === 'transcript' && segments.length ? h('button', {
            key: 'cp', onClick: copyAll,
            style: { ...iconBtn, color: C.muted, fontSize: 11.5, gap: 5, padding: '3px 8px', borderRadius: 7 },
          }, h(Icon, { name: 'copy', size: 12 }), t('transcript.copyAll')) : null,
          tab === 'copy' && meta.description ? h('button', {
            key: 'cp2', onClick: () => copy(meta.description || ''),
            style: { ...iconBtn, color: C.muted, fontSize: 11.5, gap: 5, padding: '3px 8px', borderRadius: 7 },
          }, h(Icon, { name: 'copy', size: 12 }), t('copy')) : null,
        ]),
        tab === 'transcript'
          ? h(Transcript, { key: 'tr', segments, activeIndex, onSeek: onSeg, listRef })
          : tab === 'copy'
            ? h('div', { key: 'copy', style: { display: 'flex', flexDirection: 'column', gap: 10 } }, [
              h('div', {
                key: 'body',
                style: {
                  padding: 16, borderRadius: C.r, border: `0.5px solid ${C.border}`,
                  background: C.layer, fontSize: 14, lineHeight: 1.85, color: C.text,
                  whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                },
              }, meta.description || t('copy.empty')),
            ])
            : h('div', { key: 'info', style: { display: 'grid', gridTemplateColumns: '96px minmax(0,1fr)', rowGap: 10, columnGap: 12, fontSize: 12.5 } },
              [
                [t('info.id'), job?.id],
                [t('info.platform'), platformLabel(meta.platform, t)],
                [t('info.author'), meta.author],
                [t('info.published'), meta.published],
                [t('info.duration'), job?.duration ? fmt(job.duration) : '—'],
                [t('info.backend'), meta.backend || job?.backend],
                [t('info.segments'), String(segments.length)],
                [t('stats.chars'), chars ? String(chars) : '—'],
                [t('stats.rate'), pace(segments, job?.duration, t) || '—'],
                [t('info.media'), job?.hasMedia ? t('media.saved') : (job?.mediaPurged ? t('media.purged') : t('media.none'))],
                [t('info.url'), job?.url || job?.fromFile],
                [t('info.dir'), ctxInfo?.dir || '…'],
              ].flatMap(([k, v], i) => [
                h('div', { key: `k${i}`, style: { color: C.muted } }, k),
                h('div', {
                  key: `v${i}`,
                  style: { color: C.text, wordBreak: 'break-all', display: 'flex', alignItems: 'center', gap: 6 },
                }, [
                  h('span', { key: 'x', style: { minWidth: 0 } }, v || '—'),
                  v && (k === t('info.url') || k === t('info.dir')) ? h('button', {
                    key: 'c', title: t('toast.copied'), onClick: () => copy(v),
                    style: { ...iconBtn, color: C.faint, padding: 2, flex: 'none' },
                  }, h(Icon, { name: 'copy', size: 12 })) : null,
                ].filter(Boolean)),
              ])),
        ]) : null,
        !ready && job.status === 'running' && job.hasMedia ? h('div', {
          key: 'pending',
          style: {
            display: 'flex', alignItems: 'center', gap: 8, padding: '16px 14px',
            borderRadius: 12, border: `0.5px dashed ${C.border}`, color: C.muted, fontSize: 12.5,
          },
        }, [h(Icon, { key: 'i', name: 'spark', size: 15 }), h('span', { key: 't' }, t('transcript.pending'))]) : null,
      ])
    }


    function Toast({ message }) {
      if (!message) return null
      return h('div', {
        'data-v2t-toast': '',
        style: {
          position: 'fixed', left: '50%', bottom: 30, transform: 'translateX(-50%)',
          display: 'flex', alignItems: 'center', gap: 8, zIndex: 80,
          padding: '9px 15px', borderRadius: 999, background: 'rgba(24,24,27,0.92)',
          color: '#fff', fontSize: 12.5, boxShadow: '0 10px 28px rgba(0,0,0,0.24)',
          animation: 'v2t-pop 160ms ease-out', pointerEvents: 'none', maxWidth: '80vw',
        },
      }, [h(Icon, { key: 'i', name: 'check', size: 13 }), h('span', { key: 't' }, message)])
    }

    const SETTINGS_FIELDS = [
      ['asr_provider', 'settings.asrProvider', 'omni'],
      ['asr_model', 'settings.asrModel', 'qwen3-omni-flash'],
      ['asr_base_url', 'settings.asrBase', 'https://openapi.example.com/v1'],
      ['asr_api_key', 'settings.asrKey', ''],
      ['xhs_api', 'settings.xhsApi', 'http://127.0.0.1:5556'],
      ['douk_path', 'settings.douk', '/path/to/DouK'],
      ['model', 'settings.model', 'mlx-community/whisper-large-v3-turbo'],
      ['chunk_seconds', 'settings.chunk', '120'],
      ['cookies_from_browser', 'settings.cookies', 'chrome'],
      ['yt_pot_baseurl', 'settings.pot', 'http://127.0.0.1:4416'],
    ]

    const isSecretField = (key) => key === 'asr_api_key'
    const FIELD_DEFAULTS = { chunk_seconds: '120' }
    const FIELD_TIPS = {
      model: 'settings.tip.model',
      chunk_seconds: 'settings.tip.chunk',
      cookies_from_browser: 'settings.tip.cookies',
      yt_pot_baseurl: 'settings.tip.pot',
      xhs_api: 'settings.tip.xhs',
      douk_path: 'settings.tip.douk',
      asr_api_key: 'settings.tip.key',
    }

    function SettingsSheet({ t, onClose }) {
      const [data, setData] = useState(null)
      const [conf, setConf] = useState(null)
      const [form, setForm] = useState({})
      const [busy, setBusy] = useState(false)
      const [saving, setSaving] = useState(false)
      const [error, setError] = useState('')
      const [flash, setFlash] = useState('')
      const [showKey, setShowKey] = useState(false)
      const [cache, setCache] = useState(null)
      const [modelRun, setModelRun] = useState(null)
      const [customModel, setCustomModel] = useState(false)

      const load = useCallback(async (force) => {
        setBusy(true)
        try {
          const [accounts, settings] = await Promise.all([
            fetch(`/plugins/dsh-video2text/accounts${force ? '?refresh=1' : ''}`, { headers: { accept: 'application/json' } })
              .then((res) => res.json()).catch((err) => ({ error: String(err) })),
            fetch('/plugins/dsh-video2text/settings?reveal=1', { headers: { accept: 'application/json' } })
              .then((res) => res.json()).catch((err) => ({ error: String(err) })),
          ])
          setData(accounts)
          if (settings && settings.model_cache) setCache(settings.model_cache)
          if (settings && settings.config) {
            setConf(settings.config)
            setForm((prev) => {
              if (prev.__loaded) return prev
              const next = { __loaded: true }
              for (const [key] of SETTINGS_FIELDS) next[key] = settings.config[key] ?? ''
              return next
            })
          }
          setError(accounts?.error || settings?.error || '')
        } catch (err) {
          setError(String(err?.message || err))
        } finally {
          setBusy(false)
        }
      }, [])
      useEffect(() => { load(false) }, [load])

      const logins = data?.logins || []
      const running = logins.some((run) => run.status === 'running')
      const wasRunning = useRef(false)
      useEffect(() => {
        if (wasRunning.current && !running) load(true)
        wasRunning.current = running
      }, [running, load])
      useEffect(() => {
        if (!running) return undefined
        const id = setInterval(() => load(false), 1500)
        return () => clearInterval(id)
      }, [running, load])
      useEffect(() => {
        const esc = (e) => { if (e.key === 'Escape') onClose() }
        window.addEventListener('keydown', esc)
        return () => window.removeEventListener('keydown', esc)
      }, [onClose])

      const status = data?.status || {}
      const login = async (target) => {
        setError('')
        try {
          const res = await fetch('/plugins/dsh-video2text/accounts', {
            method: 'POST', headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ target }),
          })
          const payload = await res.json()
          if (!res.ok) throw new Error(payload.error || `HTTP ${res.status}`)
          await load(false)
        } catch (err) {
          setError(String(err?.message || err))
        }
      }
      const runOf = (target) => logins.find((run) => run.target === target)

      // 密钥框留空 = 保持原值，只有真的敲了内容才算改动
      const configValue = (key) => String(conf?.[key] ?? FIELD_DEFAULTS[key] ?? '')
      const fieldDirty = (key) => {
        if (!conf) return false
        return String(form[key] ?? '') !== configValue(key)
      }
      const startModel = async () => {
        setError('')
        try {
          const res = await fetch('/plugins/dsh-video2text/model', {
            method: 'POST', headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ model: String(form.model || '') }),
          })
          const out = await res.json()
          if (!res.ok) throw new Error(out.error || `HTTP ${res.status}`)
          setModelRun(out)
        } catch (err) {
          setError(String(err?.message || err))
        }
      }
      useEffect(() => {
        if (!modelRun || modelRun.status !== 'running') return undefined
        const id = setInterval(async () => {
          try {
            const res = await fetch('/plugins/dsh-video2text/model', { headers: { accept: 'application/json' } })
            const out = await res.json()
            if (out.run) setModelRun(out.run)
            if (out.run && out.run.status !== 'running') {
              if (out.model_cache) setCache(out.model_cache)
              if (out.run.status === 'failed') setError(out.run.error || t('settings.failed'))
            }
          } catch {}
        }, 1500)
        return () => clearInterval(id)
      }, [modelRun])

      const installWithAI = async () => {
        setError('')
        try {
          const res = await fetch('/plugins/dsh-video2text/setup-prompt', {
            method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}',
          })
          const data = await res.json()
          if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
          onClose()
          await openSessionWith({ t, prompt: data.prompt, notify: () => {} })
        } catch (err) {
          setError(`${t('settings.installFailed')}：${String(err?.message || err)}`)
        }
      }

      const changedKeys = SETTINGS_FIELDS.map(([key]) => key).filter(fieldDirty)
      const save = async () => {
        if (!changedKeys.length) {
          setFlash(t('settings.nothing'))
          setTimeout(() => setFlash(''), 1600)
          return
        }
        setSaving(true)
        setError('')
        try {
          const payload = { config: Object.fromEntries(changedKeys.map((key) => [key, String(form[key] ?? '')])) }
          const res = await fetch('/plugins/dsh-video2text/settings', {
            method: 'POST', headers: { 'content-type': 'application/json' },
            body: JSON.stringify(payload),
          })
          const out = await res.json()
          if (!res.ok) throw new Error(out.error || `HTTP ${res.status}`)
          const nextConf = out.config || {}
          setConf(nextConf)
          setForm(() => {
            const next = { __loaded: true }
            for (const [key] of SETTINGS_FIELDS) next[key] = nextConf[key] ?? ''
            return next
          })
          setFlash(t('settings.saved'))
          setTimeout(() => setFlash(''), 2400)
        } catch (err) {
          setError(`${t('settings.failed')}：${String(err?.message || err)}`)
        } finally {
          setSaving(false)
        }
      }

      const dj = status.douyin_login || {}
      const xa = status.xhs_api || {}
      const xl = status.xhs_login || {}
      const wx = status.wechat_login || {}
      const ws = status.wechat_session || {}
      const checking = t('accounts.checking')
      const douyinDetail = !data ? checking
        : dj.ok ? (dj.until ? `${t('accounts.validUntil')} ${dj.until}` : t('accounts.signedIn'))
          : dj.code === 'expired' ? `${t('accounts.expired')}${dj.until ? ` · ${dj.until}` : ''}`
            : dj.code === 'invalid' ? t('accounts.invalid') : t('accounts.loginNeeded')
      const rows = [
        {
          id: 'douyin', label: t('accounts.douyin'),
          ok: Boolean(dj.ok), tone: dj.ok ? 'ok' : 'bad',
          detail: douyinDetail,
          extra: status.douk_path?.path ? `${t('accounts.douk')} · ${status.douk_path.path}` : '',
          actions: [['douyin', t('accounts.relogin')]],
        },
        {
          id: 'xhs', label: t('accounts.xhs'),
          ok: Boolean(xa.ok), tone: xa.ok ? 'ok' : 'bad',
          detail: !data ? checking : (xa.ok ? `${t('accounts.apiUp')} · ${xa.url}` : `${t('accounts.apiDown')} · ${xa.error || ''}`),
          extra: xl.ok ? t('accounts.signedIn') : '',
          actions: [['xhs', t('accounts.login')]],
        },
        {
          id: 'wechat', label: t('accounts.wechat'),
          ok: Boolean(wx.ok || ws.exists), tone: wx.ok ? 'ok' : (ws.exists ? 'warn' : 'bad'),
          detail: !data ? checking : (wx.ok ? t('accounts.signedIn') : t('accounts.loginNeeded')),
          extra: '',
          actions: [['wechat', t('accounts.login')], ['wechat-verify', t('accounts.verify')]],
        },
      ]

      const section = (key, title) => h('div', {
        key,
        style: { fontSize: 10.5, color: C.faint, letterSpacing: 0.4, padding: '14px 2px 2px' },
      }, title)

      return h('div', {
        style: {
          position: 'fixed', inset: 0, zIndex: 70, display: 'flex',
          alignItems: 'center', justifyContent: 'center', padding: 20,
          background: 'rgba(0,0,0,0.28)', animation: 'v2t-fade 140ms ease-out',
        },
        onClick: onClose,
      }, h('div', {
        onClick: (e) => e.stopPropagation(),
        'data-v2t-settings': '',
        style: {
          width: 560, maxWidth: '94vw', maxHeight: '84vh', overflow: 'auto',
          borderRadius: 20, border: `0.5px solid ${C.border}`, background: C.layer,
          boxShadow: '0 24px 64px rgba(0,0,0,0.26)', padding: '18px 20px 16px',
        },
      }, [
        h('div', { key: 'h', style: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 } }, [
          h('span', { key: 't', style: { fontSize: 14.5, fontWeight: 600, color: C.text } }, t('accounts.title')),
          h('div', { key: 'sp', style: { flex: 1 } }),
          h('button', {
            key: 'r', onClick: () => load(true), disabled: busy,
            title: t('accounts.refresh'),
            style: { ...iconBtn, color: busy ? C.faint : C.muted, padding: 5 },
          }, h(Icon, { name: 'refresh', size: 15 })),
          h('button', {
            key: 'x', onClick: onClose, title: t('accounts.close'),
            style: { ...iconBtn, color: C.muted, padding: 5 },
          }, h(Icon, { name: 'close', size: 15 })),
        ]),
        error ? h('div', { key: 'err', style: { fontSize: 11.5, color: C.danger, margin: '6px 0' } }, error) : null,

        section('sl', t('settings.login')),
        h('div', { key: 'rows', style: { display: 'flex', flexDirection: 'column' } },
          rows.map((row, index) => {
            const run = runOf(row.id)
            return h('div', {
              key: row.id,
              style: {
                display: 'flex', flexDirection: 'column', gap: 6, padding: '10px 2px',
                borderTop: index === 0 ? 'none' : `0.5px solid ${C.border}`,
              },
            }, [
              h('div', { key: 'main', style: { display: 'flex', alignItems: 'flex-start', gap: 10 } }, [
                h('span', {
                  key: 'd',
                  style: {
                    width: 7, height: 7, borderRadius: 7, marginTop: 6, flex: 'none',
                    background: row.tone === 'warn' ? '#d99a2b' : (row.ok ? C.success : C.danger),
                  },
                }),
                h('div', { key: 'x', style: { minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column', gap: 2 } }, [
                  h('span', { key: 'l', style: { fontSize: 13, color: C.text, fontWeight: 500 } }, row.label),
                  h('span', { key: 'dt', style: { fontSize: 11.5, color: C.muted, wordBreak: 'break-all' } }, row.detail || '—'),
                  row.extra ? h('span', { key: 'ex', style: { fontSize: 10.5, color: C.faint, wordBreak: 'break-all' } }, row.extra) : null,
                ]),
                h('div', { key: 'a', style: { display: 'flex', gap: 6, flex: 'none' } },
                  row.actions.map(([target, label]) => {
                    const mine = runOf(target)
                    const running2 = mine && mine.status === 'running'
                    const text = running2
                      ? (target === 'wechat-verify' ? t('accounts.verifying') : t('accounts.waiting'))
                      : mine && mine.status === 'done'
                        ? (target === 'wechat-verify' ? t('accounts.verified') : t('accounts.loginDone'))
                        : mine && mine.status === 'failed' && target === 'wechat-verify'
                          ? t('accounts.verifyFailed')
                          : label
                    const tone2 = running2 ? { color: C.primary, border: C.primary }
                      : mine && mine.status === 'done' ? { color: C.success, border: C.success }
                        : mine && mine.status === 'failed' && target === 'wechat-verify' ? { color: C.danger, border: C.danger }
                          : { color: C.muted, border: C.border }
                    return h('button', {
                      key: target, onClick: () => login(target), disabled: running2,
                      style: {
                        ...iconBtn, fontSize: 11.5, padding: '4px 9px', borderRadius: 7,
                        border: `0.5px solid ${tone2.border}`, color: tone2.color,
                        opacity: running2 ? 0.75 : 1,
                      },
                    }, text)
                  })),
              ]),
              run ? h('div', {
                key: 'run',
                style: {
                  marginLeft: 17, padding: '6px 9px', borderRadius: 8, background: C.bg,
                  border: `0.5px solid ${C.border}`, fontSize: 10.5, color: C.muted,
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', whiteSpace: 'pre-wrap',
                  maxHeight: 62, overflow: 'auto',
                },
              }, [
                h('div', { key: 's', style: { color: run.status === 'failed' ? C.danger : C.text, marginBottom: 2 } },
                  run.status === 'running' ? t('accounts.waiting')
                    : run.status === 'done' ? `${t('accounts.done')}` : `${t('accounts.failed')} · ${run.error || ''}`),
                (run.log || []).slice(-2).join('\n') || '…',
              ]) : null,
            ])
          })),

        h('div', { key: 'ss', style: { display: 'flex', alignItems: 'baseline', gap: 8, padding: '14px 2px 2px' } }, [
          h('span', { key: 't', style: { fontSize: 10.5, color: C.faint, letterSpacing: 0.4 } }, t('settings.service')),
          h('div', { key: 'sp', style: { flex: 1 } }),
          h('button', {
            key: 'setup', onClick: installWithAI,
            style: {
              ...iconBtn, fontSize: 10.5, padding: '2px 8px', borderRadius: 6, gap: 4,
              border: `0.5px solid ${C.border}`, color: C.muted,
            },
          }, h(Icon, { name: 'spark', size: 11 }), t('settings.installAI')),
          h('a', {
            key: 'link',
            href: 'https://bailian.console.aliyun.com/?apiKey=1#/api-key',
            target: '_blank', rel: 'noreferrer',
            style: { fontSize: 10.5, color: C.primary, textDecoration: 'none' },
          }, `${t('settings.getKey')} ↗`),
        ]),
        h('div', { key: 'form', style: { display: 'flex', flexDirection: 'column', gap: 7, paddingTop: 4 } },
          SETTINGS_FIELDS.map(([key, labelKey, placeholder]) => {
            const secret = isSecretField(key)
            const current = secret ? '' : (conf?.[key] ?? '')
            const dirty = fieldDirty(key)
            if (key === 'model') {
              const MODELS = [
                'mlx-community/whisper-large-v3-turbo',
                'mlx-community/whisper-large-v3-turbo-q4',
                'mlx-community/whisper-large-v3',
              ]
              const value = String(form.model ?? '')
              const custom = customModel || (Boolean(value) && !MODELS.includes(value))
              const cached = (name) => Boolean((cache?.models || []).some((m) => m === name))
              const selectedCached = cached(value)
              return h('div', {
                key,
                style: { display: 'flex', flexDirection: 'column', gap: 5 },
              }, [
                h('div', { key: 'row', style: { display: 'flex', alignItems: 'center', gap: 10, fontSize: 12 } }, [
                h('span', { key: 'l', style: { width: 104, flex: 'none', color: C.muted, display: 'flex', alignItems: 'center', gap: 4 } }, [
                  t(labelKey),
                  FIELD_TIPS[key] ? h(Tip, { key: 'tip', text: t(FIELD_TIPS[key]) },
                    h('span', {
                      'aria-label': t(FIELD_TIPS[key]),
                      style: {
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        width: 13, height: 13, borderRadius: 13, border: `0.5px solid ${C.border}`,
                        fontSize: 9, color: C.faint, cursor: 'help', flex: 'none',
                      },
                    }, '?')) : null,
                ]),
                h('select', {
                  key: 'sel',
                  value: custom && !value ? '__custom' : (custom ? '__custom' : value),
                  onChange: (e) => {
                    const next = e.target.value
                    if (next === '__custom') {
                      setCustomModel(true)
                      setForm((prev) => ({ ...prev, model: '' }))
                    } else {
                      setCustomModel(false)
                      setForm((prev) => ({ ...prev, model: next }))
                    }
                  },
                  style: {
                    flex: 1, minWidth: 0, height: 28, padding: '0 8px', borderRadius: 8,
                    border: `0.5px solid ${dirty ? C.primary : C.border}`, background: C.bg,
                    color: C.text, font: 'inherit', fontSize: 12, outline: 'none',
                  },
                }, [
                  ...MODELS.map((m) => h('option', { key: m, value: m },
                    m.replace('mlx-community/whisper-', ''))),
                  h('option', { key: '__custom', value: '__custom' }, t('settings.modelCustom')),
                ]),
                custom ? h('input', {
                  key: 'i', value,
                  onChange: (e) => setForm((prev) => ({ ...prev, model: e.target.value })),
                  placeholder: 'mlx-community/…',
                  style: {
                    flex: 1, minWidth: 0, height: 28, padding: '0 9px', borderRadius: 8,
                    border: `0.5px solid ${C.border}`, background: C.bg, color: C.text,
                    font: 'inherit', fontSize: 12, outline: 'none',
                  },
                }) : null,
                ].filter(Boolean)),
                h('div', { key: 'cache', style: { display: 'flex', alignItems: 'center', gap: 8, paddingLeft: 114, fontSize: 10.5, color: C.faint } }, [
                  h('span', { key: 't', style: { minWidth: 0, flex: 1, wordBreak: 'break-all' } },
                    cache ? `${cache.path} · ${bytes(cache.bytes)}` : t('accounts.checking')),
                  modelRun && modelRun.status === 'running'
                    ? h('span', { key: 'r', style: { color: C.primary, flex: 'none' } },
                      `${t('settings.downloading')} ${(modelRun.log || []).slice(-1)[0] || ''}`.slice(0, 48))
                    : h('button', {
                      key: 'd', onClick: startModel, disabled: !form.model || selectedCached,
                      title: selectedCached ? t('settings.downloaded') : t('settings.download'),
                      style: {
                        ...iconBtn, fontSize: 10.5, padding: '2px 8px', borderRadius: 6,
                        border: `0.5px solid ${C.border}`,
                        color: selectedCached ? C.faint : C.muted,
                        cursor: selectedCached ? 'default' : 'pointer', flex: 'none',
                      },
                    }, selectedCached ? t('settings.downloaded') : t('settings.download')),
                ]),
              ])
            }
            return h('label', {
              key,
              style: { display: 'flex', alignItems: 'center', gap: 10, fontSize: 12 },
            }, [
              h('span', { key: 'l', style: { width: 104, flex: 'none', color: C.muted, lineHeight: 1.35, display: 'flex', alignItems: 'center', gap: 4 } }, [
                t(labelKey),
                FIELD_TIPS[key] ? h(Tip, { key: 'tip', text: t(FIELD_TIPS[key]) },
                  h('span', {
                    'aria-label': t(FIELD_TIPS[key]),
                    style: {
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      width: 13, height: 13, borderRadius: 13, border: `0.5px solid ${C.border}`,
                      fontSize: 9, color: C.faint, cursor: 'help', flex: 'none',
                    },
                  }, '?')) : null,
              ]),
              h('input', {
                key: 'i',
                type: secret && !showKey ? 'password' : 'text',
                value: form[key] ?? '',
                placeholder: current || placeholder,
                onChange: (e) => setForm((prev) => ({ ...prev, [key]: e.target.value })),
                spellCheck: false,
                style: {
                  flex: 1, minWidth: 0, height: 28, padding: '0 9px', borderRadius: 8,
                  border: `0.5px solid ${dirty ? C.primary : C.border}`, background: C.bg,
                  color: C.text, font: 'inherit', fontSize: 12, outline: 'none',
                },
              }),
              secret ? h('button', {
                key: 'eye', onClick: () => setShowKey((v) => !v),
                title: showKey ? t('settings.hide') : t('settings.show'),
                style: { ...iconBtn, color: C.faint, padding: 4, flex: 'none' },
              }, h(Icon, { name: showKey ? 'eyeOff' : 'eye', size: 15 })) : null,
              key === 'chunk_seconds'
                ? h('span', { key: 'h', style: { fontSize: 10, color: C.faint, flex: 'none' } }, t('settings.chunkHint'))
                : null,
              key === 'cookies_from_browser'
                ? h('span', { key: 'h3', style: { fontSize: 10, color: C.faint, flex: 'none' } }, t('settings.cookiesHint'))
                : null,
              key === 'yt_pot_baseurl'
                ? h('span', { key: 'h4', style: { fontSize: 10, color: C.faint, flex: 'none' } }, t('settings.potHint'))
                : null,
              key === 'xhs_api' || key === 'douk_path'
                ? h('span', { key: 'h2', style: { fontSize: 10, color: C.faint, flex: 'none' } },
                  key === 'xhs_api' ? t('settings.xhsHint') : t('settings.doukHint'))
                : null,
            ].filter(Boolean))
          })),

        h('div', { key: 'foot', style: { display: 'flex', alignItems: 'center', gap: 10, marginTop: 12 } }, [
          h('span', { key: 'h', style: { fontSize: 10.5, color: C.faint, flex: 1 } },
            changedKeys.length ? t('settings.pending', { n: changedKeys.length }) : t('settings.hint')),
          flash ? h('span', { key: 'f', style: { fontSize: 11, color: C.success } }, flash) : null,
          h('button', {
            key: 's', onClick: save, disabled: saving || !changedKeys.length,
            style: {
              height: 30, padding: '0 16px', borderRadius: 8, border: 0, font: 'inherit',
              cursor: changedKeys.length && !saving ? 'pointer' : 'default',
              background: changedKeys.length ? C.primary : C.layer2,
              color: changedKeys.length ? '#fff' : C.faint,
            },
          }, saving ? '…' : t('settings.save')),
        ]),
        data?.status?.config
          ? h('div', { key: 'path', style: { fontSize: 10, color: C.faint, marginTop: 8, wordBreak: 'break-all' } },
            data.status.config)
          : null,
      ]))
    }
    function Panel({ t }) {
      const [url, setUrl] = useState('')
      const [backend, setBackend] = useState(() => {
        try { return localStorage.getItem('v2t:backend') || 'api' } catch { return 'api' }
      })
      const [backendMenu, setBackendMenu] = useState(false)
      const [jobs, setJobs] = useState([])
      const [currentId, setCurrentId] = useState('')
      const [engineRoot, setEngineRoot] = useState('')
      const [error, setError] = useState('')
      const [follow, setFollow] = useState(true)
      const [time, setTime] = useState(0)
      const [focus, setFocus] = useState(false)
      const [query, setQuery] = useState('')
      const [storage, setStorage] = useState(null)
      const [hoverId, setHoverId] = useState('')
      const [menuId, setMenuId] = useState('')
      const [boost, setBoost] = useState(false)
      const [loaded, setLoaded] = useState(false)
      const [accountsOpen, setAccountsOpen] = useState(false)
      const [toast, setToast] = useState('')
      const timer = useRef(null)
      const toastTimer = useRef(null)
      const scrollRef = useRef(null)
      const seekRef = useRef(null)
      const inputRef = useRef(null)

      const notify = useCallback((message) => {
        setToast(String(message || ''))
        if (toastTimer.current) clearTimeout(toastTimer.current)
        toastTimer.current = setTimeout(() => setToast(''), 2000)
      }, [])

      const load = useCallback(async () => {
        try {
          const res = await fetch(API, { headers: { accept: 'application/json' } })
          const data = await res.json()
          setJobs(Array.isArray(data.jobs) ? data.jobs : [])
          setEngineRoot(data.engineRoot || '')
          setStorage(data.storage || null)
          setCurrentId((prev) => prev || (data.jobs?.[0]?.id || ''))
        } catch (err) {
          setError(String(err?.message || err))
        } finally {
          setLoaded(true)
        }
      }, [])

      useEffect(() => { load() }, [load])
      useEffect(() => {
        const running = boost || jobs.some((job) => job.status === 'running' || job.aligning)
        if (!running) { if (timer.current) { clearInterval(timer.current); timer.current = null } return }
        if (!timer.current) timer.current = setInterval(load, POLL_MS)
        return () => { if (timer.current) { clearInterval(timer.current); timer.current = null } }
      }, [jobs, load, boost])

      const submit = async (payload) => {
        setError('')
        try {
          const res = await fetch(API, {
            method: 'POST', headers: { 'content-type': 'application/json' },
            body: JSON.stringify(payload),
          })
          const job = await res.json()
          if (!res.ok) throw new Error(job.error || `HTTP ${res.status}`)
          setCurrentId(job.id)
          setTime(0)
          await load()
          return job
        } catch (err) {
          setError(String(err?.message || err))
          return null
        }
      }

      // 回车即入列：先落任务（乐观卡片），再补封面/标题
      const enqueue = async (raw) => {
        const value = String(raw ?? url).trim()
        if (!value) return
        const isPath = value.startsWith('/') || value.startsWith('~')
        let payload
        if (isPath) payload = { fromFile: value }
        else if (/^https?:\/\//i.test(value)) payload = { url: value }
        else if (/^[\w.-]+\.[a-z]{2,}(\/|$)/i.test(value) && !/\s/.test(value)) payload = { url: `https://${value}` }
        else {
          setError(t('form.invalid'))
          return
        }
        payload.backend = backend
        payload.align = false
        setUrl('')
        const job = await submit(payload)
        if (!job) { setUrl(value); return }
        inputRef.current?.focus()
      }

      const retry = async (job, asBackend) => {
        // 复用同一条任务卡：不新增条目，原地回到 running
        await submit({
          url: job.url, fromFile: job.fromFile,
          backend: asBackend || job.backend, reuse: job.id,
          align: job.align === true,
        })
        setCurrentId(job.id)
      }

      const removeJob = async (id) => {
        await fetch(`${API}?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
        if (id === currentId) setCurrentId('')
        notify(t('toast.deleted'))
        await load()
      }
      const filtered = query
        ? jobs.filter((job) => `${job.title || ''} ${job.url || ''} ${job.fromFile || ''}`.toLowerCase().includes(query.toLowerCase()))
        : jobs
      const dayLabel = (ts) => {
        const d = new Date(ts || Date.now())
        const today = new Date()
        const same = (a, b) => a.toDateString() === b.toDateString()
        if (same(d, today)) return t('day.today')
        const y = new Date(today.getTime() - 86400000)
        if (same(d, y)) return t('day.yesterday')
        return `${d.getMonth() + 1}/${d.getDate()}`
      }
      const groups = useMemo(() => {
        const map = new Map()
        for (const job of filtered) {
          const key = dayLabel(job.startedAt)
          if (!map.has(key)) map.set(key, [])
          map.get(key).push(job)
        }
        return [...map.entries()]
      }, [filtered])
      const current = jobs.find((job) => job.id === currentId) || jobs[0] || null
      const segments = current?.segments || []
      const activeIndex = useMemo(() => {
        if (!segments.length) return -1
        let lo = 0, hi = segments.length - 1, ans = -1
        while (lo <= hi) {
          const mid = (lo + hi) >> 1
          if (segments[mid].start <= time) { ans = mid; lo = mid + 1 } else hi = mid - 1
        }
        return ans
      }, [segments, time])

      useEffect(() => { setTime(0) }, [currentId])

      useEffect(() => {
        if (!follow || activeIndex < 0) return
        const container = scrollRef.current
        const node = container?.querySelector?.(`[data-v2t-seg="${activeIndex}"]`)
        if (!container || !node) return
        const top = node.offsetTop - container.offsetTop
        const bottom = top + node.offsetHeight
        if (top < container.scrollTop) container.scrollTo({ top: top - 8, behavior: 'smooth' })
        else if (bottom > container.scrollTop + container.clientHeight) {
          container.scrollTo({ top: bottom - container.clientHeight + 8, behavior: 'smooth' })
        }
      }, [activeIndex, follow])

      const seek = useCallback((seconds) => { seekRef.current?.(seconds) }, [])

      useEffect(() => {
        if (!menuId) return undefined
        const off = (e) => {
          if (e.target && e.target.closest && e.target.closest('[data-v2t-menu]')) return
          setMenuId('')
        }
        window.addEventListener('pointerdown', off)
        return () => window.removeEventListener('pointerdown', off)
      }, [menuId])

      useEffect(() => {
        const onKey = (e) => {
          if ((e.metaKey || e.ctrlKey) && String(e.key).toLowerCase() === 'k') {
            e.preventDefault()
            inputRef.current?.focus()
            return
          }
          const el = document.activeElement
          const typing = el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)
          if (e.key === 'Escape') {
            setAccountsOpen(false)
            if (typing) el.blur()
            return
          }
          if (typing || e.metaKey || e.ctrlKey || e.altKey) return
          if (e.key === '/') {
            e.preventDefault()
            inputRef.current?.focus()
            return
          }
          if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            if (filtered.length < 2) return
            e.preventDefault()
            const index = filtered.findIndex((job) => job.id === current?.id)
            const next = e.key === 'ArrowDown'
              ? Math.min(filtered.length - 1, index + 1)
              : Math.max(0, (index < 0 ? 0 : index) - 1)
            const target = filtered[next]
            if (target) { setCurrentId(target.id); setTime(0) }
          }
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
      }, [filtered, current])

      const onPaste = (e) => {
        const text = e.clipboardData?.getData('text') || ''
        const first = text.trim().split(/\s+/)[0] || ''
        if (!/^(https?:\/\/|\/|~)/i.test(first)) return
        e.preventDefault()
        setError('')
        setUrl(first)
      }

      const counts = {
        running: jobs.filter((job) => job.status === 'running').length,
        done: jobs.filter((job) => job.status === 'done').length,
      }

      return h('div', { style: rootStyle, 'data-video2text-view': '' }, [
        h('style', { key: 'kf' }, [
          '@keyframes v2t-spin{to{transform:rotate(360deg)}}',
          '@keyframes v2t-pulse{0%,100%{opacity:.45}50%{opacity:.9}}',
          '@keyframes v2t-fade{from{opacity:0}to{opacity:1}}',
          '@keyframes v2t-pop{from{opacity:0;transform:translate(-50%,6px)}to{opacity:1;transform:translate(-50%,0)}}',
          '@keyframes v2t-slide{0%{transform:translateX(-100%)}100%{transform:translateX(320%)}}',
          '[data-video2text-view]{--v2t-soft:rgba(0,0,0,0.035);--v2t-sel:rgba(65,118,230,0.10);--v2t-accent:rgba(65,118,230,0.10);--v2t-danger:rgba(214,69,69,0.08)}',
          '@media (prefers-color-scheme: dark){[data-video2text-view]{--v2t-soft:rgba(255,255,255,0.06);--v2t-sel:rgba(122,170,255,0.18);--v2t-accent:rgba(122,170,255,0.16);--v2t-danger:rgba(214,69,69,0.16)}}',
          '[data-video2text-view] button:focus-visible,[data-video2text-view] input:focus-visible,[data-video2text-view] a:focus-visible{outline:2px solid var(--dsw-static-deepseek-500,#4176e6);outline-offset:2px}',
          '[data-video2text-view] [role="button"]:focus-visible{outline:2px solid var(--dsw-static-deepseek-500,#4176e6);outline-offset:-2px}',
        ].join('\n')),
        h(Toast, { key: 'toast', message: toast }),
        accountsOpen ? h(SettingsSheet, { key: 'set', t, onClose: () => setAccountsOpen(false) }) : null,
        h('div', { key: 'wrap', style: { maxWidth: 1120, margin: '0 auto' } }, [
          h('div', { key: 'head', style: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 } }, [
            h('h1', { key: 't', style: { margin: 0, fontSize: 19, fontWeight: 650, letterSpacing: 0.2, color: C.text } }, t('panel.title')),
            h('span', { key: 's', style: { fontSize: 12, color: C.muted } }, t('panel.subtitle')),
            h('div', { key: 'sp', style: { flex: 1 } }),
            h('a', {
              key: 'star',
              href: 'https://github.com/vlln/dsh-video2text',
              target: '_blank', rel: 'noreferrer',
              title: t('star.hint'),
              style: {
                display: 'inline-flex', alignItems: 'center', gap: 6, height: 28,
                padding: '0 12px', borderRadius: 8, marginLeft: 4,
                border: `0.5px solid ${C.primary}`,
                background: 'var(--v2t-accent)', color: C.primary,
                fontSize: 12, fontWeight: 550, textDecoration: 'none', whiteSpace: 'nowrap',
              },
            }, h(Icon, { name: 'star', size: 14 }), t('star.label')),
            h('button', {
              key: 'acc',
              onClick: () => setAccountsOpen(true),
              title: t('accounts.title'),
              style: {
                ...iconBtn, gap: 5, fontSize: 12, padding: '5px 10px', borderRadius: 8,
                border: `0.5px solid ${C.border}`, color: C.muted, marginLeft: 4,
              },
            }, h(Icon, { name: 'gear', size: 14 }), t('accounts.open')),
          ]),
          h('div', {
            key: 'composer',
            style: {
              display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8,
              padding: '10px 12px 10px 14px', borderRadius: 20,
              border: `0.5px solid ${focus ? C.primary : 'var(--dsw-alias-settings-card-stroke, ' + C.border + ')'}`,
              background: C.soft, transition: 'border-color 140ms, box-shadow 140ms',
              boxShadow: focus ? C.ring : 'none',
            },
          }, [
            h('span', { key: 'ic', style: { color: C.muted, display: 'flex' } }, h(Icon, { name: 'spark', size: 17 })),
            h('input', {
              key: 'u', value: url, placeholder: t('form.placeholder'),
              ref: inputRef,
              onChange: (e) => setUrl(e.target.value),
              onPaste,
              onFocus: () => setFocus(true), onBlur: () => setFocus(false),
              onKeyDown: (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enqueue() } },
              style: {
                flex: 1, height: 30, border: 0, outline: 'none', background: 'transparent',
                color: C.text, font: 'inherit', minWidth: 0,
              },
            }),
            url.trim() ? h('button', {
              key: 'go', onClick: () => enqueue(), onMouseDown: (e) => e.preventDefault(),
              style: {
                height: 28, padding: '0 12px', borderRadius: 8, border: 0,
                background: C.primary, color: '#fff', font: 'inherit', fontSize: 12,
                fontWeight: 500, cursor: 'pointer', flex: 'none',
              },
            }, t('form.run')) : h('span', {
              key: 'en',
              style: {
                flex: 'none', color: C.faint, fontSize: 11.5, padding: '3px 7px',
                borderRadius: 6, border: `0.5px solid ${C.border}`,
              },
            }, '↵'),
          ]),
          h('div', { key: 'hint', style: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18, marginLeft: 4 } }, [
            h('div', { key: 'sp', style: { flex: 1 } }),
            h('div', { key: 'pref', style: { position: 'relative' } }, [
              h('button', {
                key: 'b',
                onClick: () => setBackendMenu((v) => !v),
                'aria-expanded': backendMenu,
                style: {
                  ...iconBtn, fontSize: 11.5, padding: '3px 8px', borderRadius: 7,
                  color: C.muted, gap: 4, border: `0.5px solid ${C.border}`,
                },
              }, `${t('setting.backend')} · ${backend === 'api' ? t('backend.cloud') : t('backend.local')}`,
                h('span', { style: { display: 'flex', transform: backendMenu ? 'rotate(180deg)' : 'none', transition: 'transform 140ms' } },
                  h(Icon, { name: 'chevron', size: 11 }))),
              backendMenu ? h('div', {
                key: 'm',
                style: {
                  position: 'absolute', right: 0, top: 'calc(100% + 6px)', zIndex: 40, width: 208,
                  padding: 5, borderRadius: 12, border: `0.5px solid ${C.border}`,
                  background: C.layer, boxShadow: '0 14px 34px rgba(0,0,0,0.16)',
                },
              }, [
                ...[['api', t('backend.cloud'), t('setting.cloudHint')], ['auto', t('backend.local'), t('setting.localHint')]]
                  .map(([key, label, hint]) => h('button', {
                    key,
                    onClick: () => {
                      setBackend(key)
                      try { localStorage.setItem('v2t:backend', key) } catch {}
                      setBackendMenu(false)
                    },
                    style: {
                      display: 'flex', flexDirection: 'column', gap: 1, alignItems: 'flex-start',
                      width: '100%', padding: '7px 9px', borderRadius: 8, border: 0,
                      background: 'transparent', color: C.text, font: 'inherit', fontSize: 12.5,
                      cursor: 'pointer', textAlign: 'left',
                    },
                    onMouseEnter: (e) => { e.currentTarget.style.background = C.soft },
                    onMouseLeave: (e) => { e.currentTarget.style.background = 'transparent' },
                  }, [
                    h('span', { key: 'l', style: { display: 'flex', alignItems: 'center', gap: 6, fontWeight: backend === key ? 600 : 400 } }, [
                      label,
                      backend === key ? h(Icon, { key: 'c', name: 'check', size: 12 }) : null,
                    ].filter(Boolean)),
                    h('span', { key: 'h', style: { fontSize: 10.5, color: C.faint } }, hint),
                  ])),
              ]) : null,
            ]),
          ]),
          engineRoot ? null : h('div', {
            key: 'e',
            style: {
              display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, padding: '8px 12px',
              borderRadius: 10, background: 'var(--v2t-danger)', border: `0.5px solid ${C.border}`,
              fontSize: 12, color: C.danger,
            },
          }, [h(Icon, { key: 'i', name: 'alert', size: 14 }), h('span', { key: 't' }, t('error.engine'))]),
          error ? h('div', {
            key: 'err',
            style: {
              display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, padding: '8px 12px',
              borderRadius: 10, background: 'var(--v2t-danger)', border: `0.5px solid ${C.border}`,
              fontSize: 12, color: C.danger,
            },
          }, [
            h(Icon, { key: 'i', name: 'alert', size: 14 }),
            h('span', { key: 't', style: { flex: 1, wordBreak: 'break-word' } }, error),
            h('button', {
              key: 'x', onClick: () => setError(''), title: t('error.dismiss'),
              style: { ...iconBtn, color: C.danger, padding: 3 },
            }, h(Icon, { name: 'close', size: 13 })),
          ]) : null,
          h('div', { key: 'body', style: { display: 'grid', gridTemplateColumns: '272px minmax(0, 1fr)', gap: 20, alignItems: 'start' } }, [
            h('div', {
              key: 'side',
              style: {
                display: 'flex', flexDirection: 'column', gap: 6,
                position: 'sticky', top: 12, maxHeight: 'calc(100vh - 240px)',
              },
            }, [
              h('div', { key: 'h', style: { display: 'flex', alignItems: 'center', gap: 6, padding: '2px 4px 2px' } }, [
                h('span', { key: 'l', style: pillStyle }, `${jobs.length} ${t('tasks')}`),
                counts.running
                  ? h('span', { key: 'r', style: { ...pillStyle, color: C.primary, background: 'var(--v2t-accent)' } },
                    `${counts.running} ${t('state.running')}`)
                  : null,
                h('div', { key: 'sp', style: { flex: 1 } }),
                storage && storage.mediaBytes > 0
                  ? h('span', { key: 'st', style: { ...pillStyle, fontVariantNumeric: 'tabular-nums' } }, bytes(storage.mediaBytes))
                  : null,
              ]),
              jobs.length > 3 ? h('div', {
                key: 'q',
                style: {
                  display: 'flex', alignItems: 'center', gap: 4, height: 28, margin: '0 2px 4px',
                  padding: '0 8px', borderRadius: 8, border: `0.5px solid ${C.border}`, background: C.soft,
                },
              }, [
                h('span', { key: 'i', style: { color: C.faint, display: 'flex' } }, h(Icon, { name: 'search', size: 12 })),
                h('input', {
                  key: 'in', value: query, placeholder: t('tasks.search'),
                  onChange: (e) => setQuery(e.target.value),
                  style: {
                    flex: 1, minWidth: 0, height: 26, border: 0, outline: 'none',
                    background: 'transparent', color: C.text, font: 'inherit', fontSize: 12,
                  },
                }),
                query ? h('button', {
                  key: 'x', onClick: () => setQuery(''), title: t('search.clear'),
                  style: { ...iconBtn, color: C.faint, padding: 1 },
                }, h(Icon, { name: 'close', size: 11 })) : null,
              ]) : null,
              h('div', { key: 'list', style: { overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2, paddingRight: 2 } },
                !loaded
                  ? [0, 1, 2].map((i) => h('div', {
                    key: `sk${i}`,
                    style: {
                      height: 46, margin: '2px 0', borderRadius: 12, background: C.soft,
                      animation: 'v2t-pulse 1.3s ease-in-out infinite', animationDelay: `${i * 120}ms`,
                    },
                  }))
                  : groups.length === 0
                    ? h('div', { key: 'none', style: { fontSize: 12, color: C.faint, padding: '10px 8px' } },
                      query ? t('search.none') : t('empty.title'))
                    : groups.map(([label, items]) => h('div', { key: label, style: { display: 'flex', flexDirection: 'column', gap: 2 } }, [
                      h('div', {
                        key: 'g',
                        style: {
                          position: 'sticky', top: 0, zIndex: 2, padding: '8px 8px 3px',
                          fontSize: 10.5, color: C.faint, letterSpacing: 0.4, background: C.bg,
                        },
                      }, label),
                      ...items.map((job) => {
                        const active = job.id === current?.id
                        return h('div', {
                          key: job.id, role: 'button', tabIndex: 0,
                          onClick: () => { setCurrentId(job.id); setTime(0) },
                          onKeyDown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setCurrentId(job.id); setTime(0) } },
                          onMouseEnter: (e) => { setHoverId(job.id); if (!active) e.currentTarget.style.background = C.soft },
                          onMouseLeave: (e) => { setHoverId(''); if (!active) e.currentTarget.style.background = 'transparent' },
                          style: {
                            position: 'relative', display: 'flex', flexDirection: 'column', gap: 3,
                            padding: '8px 30px 8px 11px', borderRadius: 12, cursor: 'pointer',
                            background: active ? C.soft : 'transparent',
                            boxShadow: active ? `inset 2px 0 0 ${C.primary}` : 'none',
                            color: C.text, transition: 'background 120ms', outline: 'none',
                          },
                        }, [
                          job.status === 'running' ? h('span', {
                            key: 'bar',
                            style: {
                              position: 'absolute', left: 11, right: 12, top: 3, height: 2,
                              borderRadius: 2, overflow: 'hidden', background: C.layer2,
                            },
                          }, h('span', {
                            style: {
                              position: 'absolute', top: 0, bottom: 0, width: '34%',
                              background: C.primary, animation: 'v2t-slide 1.3s ease-in-out infinite',
                            },
                          })) : null,
                          h('span', { key: 'row', style: { display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 } }, [
                            h(Thumb, { key: 'th', job, t, width: 44, height: 28 }),
                            h('span', { key: 'col', style: { display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0, flex: 1 } }, [
                              h('span', { key: 't', style: { display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, fontWeight: active ? 550 : 400, minWidth: 0 } }, [
                                h(StatusDot, { key: 'd', status: job.status }),
                                h('span', { key: 'x', style: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } },
                                  job.title || job.url || job.fromFile || job.id),
                              ]),
                              job.imported ? h('span', {
                              key: 'imp',
                              style: {
                                display: 'inline-flex', alignItems: 'center', height: 15, padding: '0 5px',
                                borderRadius: 999, fontSize: 9, color: C.faint, background: C.layer2,
                                marginLeft: 13, alignSelf: 'flex-start',
                              },
                            }, t('task.imported')) : null,
                            h('span', { key: 's', style: { fontSize: 11, color: C.muted, paddingLeft: job.imported ? 0 : 13, fontVariantNumeric: 'tabular-nums', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } },
                                `${clock(job.startedAt)}${job.duration ? ` · ${fmt(job.duration)}` : ''}${job.status === 'running' ? ` · ${t('state.running')}` : ''}`),
                            ]),
                          ]),
                          h('button', {
                            key: 'more',
                            title: t('task.manage'),
                            onClick: (e) => { e.stopPropagation(); setMenuId((prev) => (prev === job.id ? '' : job.id)) },
                            style: {
                              position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)',
                              width: 26, height: 26, borderRadius: 7, border: `0.5px solid ${menuId === job.id ? C.border : 'transparent'}`,
                              cursor: 'pointer',
                              background: menuId === job.id ? C.layer : (hoverId === job.id ? C.layer2 : 'transparent'),
                              color: menuId === job.id ? C.text : C.muted,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                            },
                            onMouseEnter: (e) => { e.currentTarget.style.color = C.text },
                            onMouseLeave: (e) => { e.currentTarget.style.color = menuId === job.id ? C.text : C.muted },
                          }, h(Icon, { name: 'more', size: 15 })),
                          menuId === job.id ? h('div', {
                            key: 'menu',
                            'data-v2t-menu': '',
                            onClick: (e) => e.stopPropagation(),
                            style: {
                              position: 'absolute', right: 4, top: 'calc(100% - 4px)', zIndex: 40, width: 168,
                              padding: 4, borderRadius: 10, border: `0.5px solid ${C.border}`,
                              background: C.layer, boxShadow: '0 14px 34px rgba(0,0,0,0.18)',
                            },
                          }, [
                            job.url ? h('button', {
                              key: 'copy',
                              onClick: () => { setMenuId(''); copy(job.url) },
                              style: menuItemStyle,
                            }, t('task.copyLink')) : null,
                            h('button', {
                              key: 'del',
                              onClick: () => { setMenuId(''); removeJob(job.id) },
                              style: { ...menuItemStyle, color: C.danger },
                            }, t('task.delete')),
                          ].filter(Boolean)) : null,
                        ])
                      }),
                    ])),
              ),
            ]),
            current
              ? h(Viewer, {
                key: 'v', job: current, t, segments, activeIndex, onSeek: seek, follow, setFollow,
                listRef: scrollRef, onRetry: (asBackend) => retry(current, asBackend),
                seekRef, onTime: setTime, notify,
                onAlignStarted: () => {
                  setBoost(true)
                  setTimeout(() => setBoost(false), 60000)
                },
                onDeleted: () => { setCurrentId(''); load() },
              })
              : h('div', {
                key: 'none',
                style: {
                  minHeight: 360, display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center', gap: 12,
                  borderRadius: 20, background: C.soft,
                },
              }, [
                h('div', {
                  key: 'i',
                  style: { width: 48, height: 48, borderRadius: 48, background: C.layer, color: C.primary, display: 'flex', alignItems: 'center', justifyContent: 'center' },
                }, h(Icon, { name: 'spark', size: 24 })),
                h('div', { key: 't', style: { fontSize: 14, fontWeight: 550, color: C.text } }, t('onboard.title')),
                h('div', { key: 'h', style: { fontSize: 12, color: C.muted, maxWidth: 360, textAlign: 'center', lineHeight: 1.7 } }, t('empty.hint')),
                h('div', { key: 'ex', style: { display: 'flex', gap: 8, marginTop: 4 } }, [
                  h('button', {
                    key: 'x1',
                    onClick: () => enqueue('https://xhslink.cn/o/5d3tDDTi77g'),
                    style: { ...iconBtn, fontSize: 12, padding: '5px 12px', border: `0.5px solid ${C.border}`, color: C.muted },
                  }, t('onboard.example1')),
                  h('button', {
                    key: 'x2',
                    onClick: () => enqueue('https://www.bilibili.com/video/BV1Vbnn6iEfG'),
                    style: { ...iconBtn, fontSize: 12, padding: '5px 12px', border: `0.5px solid ${C.border}`, color: C.muted },
                  }, t('onboard.example2')),
                ]),
              ]),
          ]),
        ]),
      ])
    }


    class PanelBoundary extends React.Component {
      constructor(props) {
        super(props)
        this.state = { error: null }
      }

      static getDerivedStateFromError(error) {
        return { error }
      }

      render() {
        if (!this.state.error) return this.props.children
        return h('div', {
          style: {
            padding: 'calc(var(--dsh-frame-top-clearance, 48px) + 24px) 32px 40px',
            font: '13px/1.7 var(--dsw-font-family, system-ui)',
            color: 'var(--dsw-alias-label-primary)',
          },
        }, [
          h('div', { key: 't', style: { fontSize: 15, fontWeight: 600, marginBottom: 8 } }, 'Panel error'),
          h('pre', {
            key: 'e',
            style: {
              whiteSpace: 'pre-wrap', wordBreak: 'break-word', padding: 12, borderRadius: 10,
              background: 'var(--v2t-soft, rgba(127,127,127,0.08))',
              color: 'var(--dsw-alias-state-danger-primary, #d64545)', fontSize: 11.5,
              font: '11.5px/1.7 ui-monospace, SFMono-Regular, Menlo, monospace',
            },
          }, String((this.state.error && (this.state.error.stack || this.state.error.message)) || this.state.error)),
          h('button', {
            key: 'r',
            onClick: () => this.setState({ error: null }),
            style: {
              marginTop: 12, height: 30, padding: '0 14px', borderRadius: 8, border: 0,
              background: 'var(--dsw-static-deepseek-500, #4176e6)', color: '#fff',
              font: 'inherit', cursor: 'pointer',
            },
          }, 'Re-render'),
        ])
      }
    }

    const rootStyle = {
      height: '100%', overflow: 'auto', boxSizing: 'border-box',
      padding: 'calc(var(--dsh-frame-top-clearance, 48px) + 24px) 32px 48px 32px',
      background: C.bg, color: C.text,
      font: '13px/1.6 var(--dsw-font-family, system-ui)',
    }

    function PanelIcon({ size = 16 }) {
      return h('svg', { width: size, height: size, viewBox: '0 0 36 36', fill: 'none', 'aria-hidden': true }, [
        h('rect', { key: 'r', x: 5, y: 7, width: 26, height: 20, rx: 5, stroke: 'currentColor', strokeWidth: 2.4 }),
        h('path', { key: 'p', d: 'M15.5 13.5L22 17L15.5 20.5V13.5Z', fill: 'currentColor' }),
        h('path', { key: 'l', d: 'M9 31H21', stroke: 'currentColor', strokeWidth: 2.4, strokeLinecap: 'round' }),
      ])
    }

    return {
      name: 'dsh-video2text',
      inject: ['locale', 'slots'],
      apply(ctx) {
        ctx.effect(() => ctx.locale.register('dsh-video2text', DICT), 'dsh-video2text: dictionaries')
        const t = ctx.locale.bind('dsh-video2text')
        ctx.effect(() => ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
          name: 'sidebar.panellist', id: PANEL_ID, order: 30,
          label: () => t('panel.title'), locale: 'dsh-video2text',
        }, (props) => h(PanelIcon, { size: typeof props.size === 'number' ? props.size : 16 }))), 'dsh-video2text: sidebar')
        ctx.effect(() => ctx.slots.inject('main', () => ctx.slots.register({
          name: 'main', key: PANEL_ID, locale: 'dsh-video2text',
        }, () => h(PanelBoundary, null, h(Panel, { t })))), 'dsh-video2text: panel')
      },
    }
  },
})
