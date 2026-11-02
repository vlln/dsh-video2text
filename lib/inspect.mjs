/**
 * dsh-video2text/inspect — 给 Agent 的「看视频」工具，与面板（lib/index.mjs）无关。
 *
 * 两个工具：
 *   video_text(video, from?, to?, max_lines?)     文字稿（没有就转写，25s 转后台）
 *   video_frames(video, from?, to?, mode?, …)     画面（shots 拼图 / detail 单帧）
 *
 * 设计约束（与面板解耦）：
 *   - 不读面板的 jobs.json、不扫 out/，只认「媒体路径」或自己发的 vid_<8hex>；
 *   - 缓存根独立：$DSH_HOME/data/dsh-video-inspect/；
 *   - 只 inject tools / attachments / jobs，不依赖 webServer；
 *   - 没有 jobs 服务时降级为同步执行（长任务会等到结束）。
 */
import { defineTool } from '@deepseek-ai/dsh-tools'
import z from '@deepseek-ai/schemastery'
import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, realpathSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import path from 'node:path'

export const name = 'dsh-video2text-inspect'

export const Config = z.object({
  engineRoot: z.string().default('').volatile().description('video2text skill 根目录（含 scripts/video2text）'),
  python: z.string().default('python3').volatile().description('Python 解释器'),
  cacheDir: z.string().default('').volatile().description('缓存根目录，默认 $DSH_HOME/data/dsh-video-inspect'),
  backend: z.string().default('').volatile().description('转写后端（空=引擎默认 auto）'),
  timeoutMs: z.number().default(25000).volatile().description('同步等待上限，超时转后台任务'),
  width: z.number().default(480).volatile().description('概览拼图每格宽度（px）'),
  maxTiles: z.number().default(24).volatile().description('单张拼图最多几格'),
  maxLines: z.number().default(80).volatile().description('文字稿单次最多几行'),
})

function isConfigRef(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    && typeof value.get === 'function' && Object.keys(value).length === 1
}

/** cordis 传进来的 config 值可能是 Config ref，先摊平成普通值（否则 spawn(python) 会拿到对象）。 */
function unwrap(value) {
  if (isConfigRef(value)) return unwrap(value.get())
  if (Array.isArray(value)) return value.map(unwrap)
  if (value === null || typeof value !== 'object') return value
  return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, unwrap(child)]))
}

const JOB_KIND = 'v2t-video'
const VID_RE = /^vid_[0-9a-f]{8}$/

function dshHome() {
  return process.env.DSH_HOME || path.join(homedir(), '.dsh')
}

function pluginRoot() {
  return path.join(path.dirname(new URL(import.meta.url).pathname), '..')
}

function resolveEngine(settings) {
  const candidates = [
    settings.engineRoot,
    path.join(pluginRoot(), 'skills', 'video2text'),
    process.env.VIDEO2TEXT_ROOT,
    path.join(dshHome(), 'skills', 'video2text'),
    path.join(homedir(), '.agents', 'skills', 'video2text'),
  ].filter((item) => typeof item === 'string' && item.length > 0)
  for (const root of candidates) {
    if (existsSync(path.join(root, 'scripts', 'video2text'))) return root
  }
  return ''
}

function cacheRoot(settings) {
  if (settings.cacheDir) return settings.cacheDir
  return path.join(dshHome(), 'data', 'dsh-video-inspect')
}

function videoDir(settings, vid) {
  return path.join(cacheRoot(settings), vid)
}

function readJson(file) {
  try {
    return JSON.parse(readFileSync(file, 'utf-8'))
  } catch {
    return null
  }
}

function writeJson(file, value) {
  mkdirSync(path.dirname(file), { recursive: true })
  writeFileSync(file, JSON.stringify(value), 'utf-8')
}

/** 媒体指纹 → vid_<8hex>（与引擎 video_id() 同算法：realpath|mtime_ns|size）。 */
function videoId(file) {
  const real = realpathSync(file)
  const st = statSync(file, { bigint: true })
  const h = createHash('sha1').update(`${real}|${st.mtimeNs}|${st.size}`).digest('hex')
  return `vid_${h.slice(0, 8)}`
}

function mmss(t) {
  const v = Math.max(0, Number(t) || 0)
  const m = Math.floor(v / 60)
  const s = v - m * 60
  return `${m}:${s < 10 ? '0' : ''}${s.toFixed(1)}`
}

function lastErrorLine(text) {
  const lines = String(text || '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  return lines.length ? lines[lines.length - 1] : ''
}

/** 引擎的 `--json` 有单行（inspect）和多行（转写，indent=1）两种；整体解析，别取最后一行。 */
function parseJsonOutput(text) {
  const raw = String(text || '').trim()
  try {
    return JSON.parse(raw)
  } catch { /* 落到区间截取 */ }
  const i = raw.indexOf('{')
  const j = raw.lastIndexOf('}')
  if (i >= 0 && j > i) return JSON.parse(raw.slice(i, j + 1))
  throw new Error(`[video:engine] 引擎输出不是 JSON：${lastErrorLine(raw) || '(空)'}`)
}

function resolveVideo(settings, input) {
  const raw = String(input || '').trim()
  if (!raw) throw new Error('[video:not-found] 需要媒体文件路径，或之前返回的 vid_<8位hex>。')
  if (VID_RE.test(raw)) {
    const meta = readJson(path.join(videoDir(settings, raw), 'meta.json'))
    if (!meta || !meta.media) {
      throw new Error(`[video:unknown-id] 没有 ${raw} 的记录（缓存可能被清理）。重新传媒体文件路径。`)
    }
    if (!existsSync(meta.media)) {
      throw new Error(`[video:not-found] ${raw} 对应的媒体已不在：${meta.media}。重新传路径。`)
    }
    return { vid: raw, media: meta.media }
  }
  const file = path.resolve(raw.startsWith('~') ? raw.replace(/^~/, homedir()) : raw)
  if (!existsSync(file)) {
    throw new Error(`[video:not-found] 找不到 ${file}。传媒体文件路径（mp4/mov/m4v/mkv/webm/avi/flv/ts/wmv），或之前的 vid。`)
  }
  if (statSync(file).isDirectory()) {
    throw new Error(`[video:is-dir] ${file} 是目录，不是媒体文件。`)
  }
  return { vid: videoId(file), media: file }
}

function pendingFile(settings, vid) {
  return path.join(videoDir(settings, vid), 'pending.json')
}

/** 起任务前留个标记；宿主重启后它还在，下次调用据此提示「上次被打断」。 */
function markPending(settings, vid, kind, key) {
  writeJson(pendingFile(settings, vid), { kind, key, at: Date.now() })
}

function clearPending(settings, vid) {
  try { rmSync(pendingFile(settings, vid), { force: true }) } catch { /* 忽略 */ }
}

function takeInterrupted(settings, vid) {
  if (!existsSync(pendingFile(settings, vid))) return ''
  clearPending(settings, vid)
  return '上次准备被中断（宿主可能重启过），已重新开始'
}

function remember(settings, vid, media) {
  const file = path.join(videoDir(settings, vid), 'meta.json')
  const known = readJson(file) || {}
  writeJson(file, { vid, media, ...known, media })
}

/** 跑一次引擎；返回 { promise, kill }。 */
function startEngine(settings, args, { onLine, signal } = {}) {
  const root = resolveEngine(settings)
  if (!root) {
    const failure = Promise.reject(new Error('[video:engine] 找不到 video2text 引擎（scripts/video2text）。在插件配置里设 engineRoot，或安装 skill。'))
    failure.catch(() => {})
    return { promise: failure, kill: () => {} }
  }
  const child = spawn(settings.python || 'python3', [path.join(root, 'scripts', 'video2text'), ...args], {
    env: process.env,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let out = ''
  let err = ''
  const promise = new Promise((resolve, reject) => {
    child.stdout.on('data', (chunk) => { out += chunk; onLine?.(String(chunk)) })
    child.stderr.on('data', (chunk) => {
      const text = String(chunk)
      err += text
      for (const line of text.split(/\r?\n/)) if (line.trim()) onLine?.(line)
    })
    child.on('error', reject)
    child.on('close', (code) => {
      if (code === 0) resolve(out)
      else reject(new Error(lastErrorLine(err) || `engine exit ${code}`))
    })
  })
  const onAbort = () => { try { child.kill('SIGTERM') } catch {} }
  signal?.addEventListener?.('abort', onAbort, { once: true })
  promise.finally(() => signal?.removeEventListener?.('abort', onAbort)).catch(() => {})
  return { promise, kill: () => { try { child.kill('SIGTERM') } catch {} } }
}

/* ---------------------------------------------------------------- 文字稿 */

function transcriptFile(settings, vid) {
  return path.join(videoDir(settings, vid), 'transcript.json')
}

function transcriptReady(settings, vid) {
  return existsSync(transcriptFile(settings, vid))
}

function runTranscript(settings, vid, media, job) {
  const outDir = path.join(videoDir(settings, vid), 'asr')
  const args = ['--from-file', media, '--out', outDir, '--json']
  if (settings.backend) args.push('--backend', settings.backend)
  const engine = startEngine(settings, args, {
    onLine: (text) => {
      if (job) job.append(text.endsWith('\n') ? text : `${text}\n`)
      const m = /\[(\d)\/3\]\s*([^\n]*)/.exec(text)
      if (m && job) job.updateProgress(`${m[1]}/3 ${m[2].slice(0, 40)}`)
    },
  })
  return {
    kill: engine.kill,
    promise: engine.promise.then((stdout) => {
      const data = parseJsonOutput(stdout)
      const segments = Array.isArray(data.segments) ? data.segments : []
      if (!segments.length) throw new Error('[video:no-transcript] 转写没有产出句子（可能没有口播，或 ASR 配置缺失）。')
      writeJson(transcriptFile(settings, vid), { segments, meta: data.meta || {} })
      remember(settings, vid, media)
      return segments.length
    }),
  }
}

function transcriptWindow(settings, vid, media, from, to, maxLines) {
  const data = readJson(transcriptFile(settings, vid)) || {}
  const all = Array.isArray(data.segments) ? data.segments : []
  const s0 = from == null ? -Infinity : Number(from)
  const s1 = to == null ? Infinity : Number(to)
  const inside = all.filter((seg) => Number(seg.end) >= s0 && Number(seg.start) <= s1)
  const lines = Math.max(1, Math.min(Number(maxLines) || settings.maxLines, 200))
  const picked = inside.slice(0, lines)
  const head = data.meta?.title ? `${data.meta.title}\n` : ''
  const body = picked.map((seg) => `[${mmss(seg.start)}] ${String(seg.text || '').trim()}`)
  const more = inside.length > picked.length
  const footer = more
    ? `（还有 ${inside.length - picked.length} 句；用 from=${Math.round(picked[picked.length - 1].end)} 继续）`
    : '（本区间已全部给出）'
  return [
    head + `视频：${path.basename(media)} · ${all.length} 句 · ${vid}`,
    ...body,
    footer,
    `全稿：${transcriptFile(settings, vid)}`,
  ].join('\n')
}

/* ---------------------------------------------------------------- 画面 */

function framesArgs(settings, media, args, cacheDir) {
  const cli = ['--inspect', media, '--json', '--cache-dir', cacheDir,
    '--sheet-width', String(settings.width), '--sheet-cols', '4']
  if (args.at != null) cli.push('--at', String(args.at))
  if (args.from != null) cli.push('--start', String(args.from))
  if (args.to != null) cli.push('--end', String(args.to))
  if (args.mode) cli.push('--mode', String(args.mode))
  if (args.size) cli.push('--size', String(args.size))
  if (args.count != null) cli.push('--sheet-count', String(args.count))
  return cli
}

function framesText(result, vid) {
  const v = result.video || {}
  const head = `视频：${path.basename(v.path || '')} · ${mmss(v.duration)} · ${v.width}×${v.height} · ${vid}`
  if (result.mode === 'detail') {
    return [head, `单帧：${mmss(result.image.t)} · ${result.image.path}`,
      '（detail 是单帧，区间参数已忽略）'].join('\n')
  }
  const frames = result.frames || []
  return [
    head,
    `区间：${mmss(result.range.from)}–${mmss(result.range.to)} · ${result.mode} · ${frames.length} 帧 · ${result.sheet.cols} 列`,
    frames.map((f, i) => `#${i + 1} ${Number(f.t).toFixed(1)}s`).join('  '),
    `拼图：${result.sheet.path}`,
    ...(result.notes || []).map((n) => `备注：${n}`),
  ].join('\n')
}

async function imageAttachment(ctx, result) {
  const file = result.mode === 'detail' ? result.image?.path : result.sheet?.path
  if (!file || !existsSync(file)) return undefined
  const attachments = ctx.get('attachments')
  if (!attachments) return undefined
  try {
    const ref = await attachments.saveImage({
      data: readFileSync(file),
      mediaType: 'image/jpeg',
      name: path.basename(file),
    })
    return {
      attachmentId: ref.attachmentId,
      mediaType: ref.mediaType,
      bytes: ref.bytes,
      width: ref.width,
      height: ref.height,
      ...(ref.name === undefined ? {} : { name: ref.name }),
    }
  } catch {
    return undefined
  }
}

/* ---------------------------------------------------------------- 插件 */

export function apply(ctx, config) {
  const settings = { python: 'python3', timeoutMs: 25000, width: 480, maxTiles: 24, maxLines: 80, cacheDir: '', backend: '', engineRoot: '', ...unwrap(config ?? {}) }
  const pending = new Map() // `${vid}:${kind}:${key}` → 后台 job id

  /** 直接命中产物时，把它对应的已结算后台记录收掉（否则会留下一条无人认领的 job）。 */
  const dropPendingJob = (vid, kind, key, owner) => {
    const jobs = ctx.get('jobs')
    const pendingKey = `${vid}:${kind}:${key}`
    const id = pending.get(pendingKey)
    if (!id || !jobs) return
    pending.delete(pendingKey)
    clearPending(settings, vid)
    try { jobs.remove(id, owner) } catch { /* 仍在运行就留着 */ }
  }

  ctx.inject(['tools'], (toolCtx) => {
    const waitOrRun = async ({ vid, media, kind, key, label, startWork, exec, cacheFile }) => {
      const jobs = ctx.get('jobs')
      const pendingKey = `${vid}:${kind}:${key}`
      if (cacheFile && existsSync(cacheFile)) {
        // 命中缓存：如果后台任务已经在轮询中结算，把它的记录收掉（模型已见过 id，不再需要）。
        const settledId = pending.get(pendingKey)
        if (settledId && jobs) {
          pending.delete(pendingKey)
          clearPending(settings, vid)
          try { jobs.remove(settledId, exec.agent?.id) } catch { /* 仍在运行则留着 */ }
        }
        return { data: readJson(cacheFile) }
      }
      if (!jobs) {
        // 没有后台任务服务：同步跑完（长转写会一直占着这次调用）
        const work = startWork(undefined)
        await work.promise
        return { data: cacheFile ? readJson(cacheFile) : undefined }
      }
      const owner = exec.agent?.id
      let id = pending.get(pendingKey)
      let interrupted = ''
      if (!id) {
        interrupted = takeInterrupted(settings, vid)
        markPending(settings, vid, kind, key)
        id = jobs.start({
          kind: JOB_KIND,
          label,
          ...(owner === undefined ? {} : { owner }),
          ...(exec.callId === undefined ? {} : { toolCall: { callId: exec.callId, rootCallId: exec.rootCallId } }),
          run: (job) => {
            const work = startWork(job)
            return {
              cancel: (reason) => {
                job.append(`取消：${reason || '请求中止'}\n`)
                work.kill?.()
              },
              done: work.promise.then(
                (detail) => ({ status: 'completed', detail: String(detail ?? '') }),
                (error) => ({ status: 'failed', detail: String(error?.message || error) }),
              ),
            }
          },
        })
        pending.set(pendingKey, id)
      }
      const view = await jobs.wait(id, Number(settings.timeoutMs) || 25000, owner, exec.signal)
      const settled = view.status === 'completed' || view.status === 'failed' || view.status === 'killed'
      if (!settled) {
        return { running: id, jobId: id, note: interrupted }
      }
      pending.delete(pendingKey)
      clearPending(settings, vid)
      try { jobs.remove(id, owner) } catch { /* 已结算记录可能已被移除 */ }
      if (view.status !== 'completed') {
        const raw = String(view.detail || view.status)
        const tagged = /\[(video:[a-z-]+)\]\s*(.*)$/.exec(raw)
        if (tagged) throw new Error(`[${tagged[1]}] ${tagged[2]}`)
        throw new Error(`[video:failed] 处理失败：${raw}（vid=${vid}，重试会重新开始）`)
      }
      return { data: cacheFile ? readJson(cacheFile) : undefined, note: interrupted }
    }

    toolCtx.tools.register(defineTool({
      name: 'video_text',
      description: 'Read the spoken transcript of a video as timestamped lines, so you can understand what is said without watching it. Accepts a local media path or a vid_<8hex> handle returned earlier. If the video has not been transcribed yet this starts a background job and returns status "running" with the same id; call again later with that id to get the transcript. Optional from/to select a time window in seconds.',
      parameters: {
        video: {
          type: 'string',
          required: true,
          description: 'Local media file path, or a vid_<8hex> handle returned by an earlier call.',
        },
        from: { type: 'number', description: 'Start of the window in seconds (default: beginning).' },
        to: { type: 'number', description: 'End of the window in seconds (default: end of video).' },
        max_lines: { type: 'integer', description: 'Maximum transcript lines to return (default 80, max 200).' },
      },
      output: {
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            id: { type: 'string', required: true, description: 'Stable video handle (vid_<8hex>).' },
            status: { type: 'string', required: true, description: 'ready | running | failed' },
            text: { type: 'string', required: true },
          },
        },
        render: (_args, value) => [{ type: 'text', text: value.text }],
        presentationMeta: (_args, value) => ({ id: value.id, status: value.status }),
      },
      async execute(args, exec) {
        const { vid, media } = resolveVideo(settings, args.video)
        remember(settings, vid, media)
        if (transcriptReady(settings, vid)) {
          dropPendingJob(vid, 'text', 'transcript', exec.agent?.id)
          const text = transcriptWindow(settings, vid, media, args.from, args.to, args.max_lines)
          return { id: vid, status: 'ready', text }
        }
        const label = `转写 ${vid} · ${path.basename(media)}`
        const outcome = await waitOrRun({
          vid, media, kind: 'text', key: 'transcript', label, exec,
          cacheFile: transcriptFile(settings, vid),
          startWork: (job) => runTranscript(settings, vid, media, job),
        })
        if (outcome.running) {
          return {
            id: vid,
            status: 'running',
            text: [
              ...(outcome.note ? [`备注：${outcome.note}`] : []),
              `正在转写：${path.basename(media)}（vid=${vid}）`,
              `后台任务 ${outcome.jobId}，完成后会收到通知；再用 video_text 传 vid=${vid} 即可拿到文字稿。`,
              '视频较长时通常 2–5 分钟。',
            ].join('\n'),
          }
        }
        const body = transcriptWindow(settings, vid, media, args.from, args.to, args.max_lines)
        return { id: vid, status: 'ready', text: outcome.note ? `${outcome.note}\n${body}` : body }
      },
    }))

    toolCtx.tools.register(defineTool({
      name: 'video_frames',
      description: 'See a video: returns one contact sheet (a grid of frames with time codes) plus the exact timestamp of each cell, or a single high-resolution frame at one moment. Default mode "shots" keeps only frames where the picture actually changes (slides, screens, cuts); size "overview" (default) builds the grid, size "detail" (or passing at=) returns one frame. Accepts a local media path or a vid_<8hex> handle.',
      parameters: {
        video: {
          type: 'string',
          required: true,
          description: 'Local media file path, or a vid_<8hex> handle returned by an earlier call.',
        },
        from: { type: 'number', description: 'Start of the window in seconds (default: beginning).' },
        to: { type: 'number', description: 'End of the window in seconds (default: end of video).' },
        at: { type: 'number', description: 'Return one high-resolution frame at this second (implies size=detail).' },
        mode: { type: 'string', description: 'shots (default, only frames whose picture changes) | uniform (even spacing).' },
        size: { type: 'string', description: 'overview (default, one contact sheet) | detail (single frame).' },
        count: { type: 'integer', description: 'Maximum number of cells for overview (default 24).' },
      },
      output: {
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            id: { type: 'string', required: true },
            status: { type: 'string', required: true },
            text: { type: 'string', required: true },
            image: {
              type: 'object',
              additionalProperties: false,
              properties: {
                attachmentId: { type: 'string', required: true },
                mediaType: { type: 'string', required: true },
                bytes: { type: 'integer', required: true },
                width: { type: 'integer', required: true },
                height: { type: 'integer', required: true },
                name: { type: 'string' },
              },
            },
          },
        },
        render: (_args, value) => {
          const content = [{ type: 'text', text: value.text }]
          if (value.image) content.push({ type: 'image', attachment: value.image })
          return content
        },
        presentationMeta: (_args, value) => ({ id: value.id, status: value.status }),
      },
      async execute(args, exec) {
        const { vid, media } = resolveVideo(settings, args.video)
        remember(settings, vid, media)
        const dir = videoDir(settings, vid)
        const engineCache = path.join(dir, 'engine')
        const key = createHash('sha1')
          .update(JSON.stringify([vid, args.from ?? null, args.to ?? null, args.at ?? null,
            args.mode ?? 'shots', args.size ?? 'overview', args.count ?? null, settings.width]))
          .digest('hex').slice(0, 12)
        const cacheFile = path.join(dir, 'requests', `${key}.json`)
        const cli = framesArgs(settings, media, args, engineCache)
        const label = `画面 ${vid} · ${path.basename(media)}${args.at != null ? ` @${args.at}s` : ''}`
        const outcome = await waitOrRun({
          vid, media, kind: 'frames', key, label, exec, cacheFile,
          startWork: (job) => {
            const engine = startEngine(settings, cli, {
              onLine: (text) => { if (job) job.append(text.endsWith('\n') ? text : `${text}\n`) },
            })
            return {
              kill: engine.kill,
              promise: engine.promise.then((stdout) => {
                const result = parseJsonOutput(stdout)
                writeJson(cacheFile, result)
                const n = result.mode === 'detail' ? 1 : (result.frames || []).length
                if (job) job.append(`就绪：${n} 帧 · 用 video_frames 传 vid=${vid} 取图\n`)
                return `${n} 帧`
              }),
            }
          },
        })
        if (outcome.running) {
          return {
            id: vid,
            status: 'running',
            text: [
              ...(outcome.note ? [`备注：${outcome.note}`] : []),
              `正在抽帧：${path.basename(media)}（vid=${vid}）`,
              `后台任务 ${outcome.jobId}，完成后会收到通知；再用 video_frames 传 vid=${vid}。`,
            ].join('\n'),
          }
        }
        const result = outcome.data
        if (!result) throw new Error(`[video:failed] 抽帧没有产出结果（vid=${vid}）。`)
        const image = await imageAttachment(ctx, result)
        const body = framesText(result, vid)
        return { id: vid, status: 'ready', text: outcome.note ? `${outcome.note}\n${body}` : body, ...(image ? { image } : {}) }
      },
    }))
  })
}
