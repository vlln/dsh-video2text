/**
 * dsh-video2text — Node half.
 *
 * 把本地 video2text skill 包装成：
 *   1) agent 工具 `video2text`（模型可调）；
 *   2) 面板数据路由（client half 的「视频转文案」面板轮询这些路由）。
 *
 * 插件不实现转写，只负责调度与展示；引擎路径按 engineRoot 配置 / 环境变量 /
 * 常见 skill 发现根依次解析。skill 本身不依赖 dsh，可单独使用。
 */
import z from '@deepseek-ai/schemastery'
import { spawn, spawnSync } from 'node:child_process'
import { createReadStream, existsSync, mkdirSync, readFileSync, readdirSync, readlinkSync, renameSync, rmSync, statSync, symlinkSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import path from 'node:path'

export const name = 'dsh-video2text'

export const inject = ['webServer']

export const Config = z.object({
  engineRoot: z.string().default('').volatile().description('video2text skill 根目录（含 scripts/video2text）'),
  defaultBackend: z.string().default('auto').volatile().description('auto | mlx | whispercpp | api'),
  outDir: z.string().default('').volatile().description('输出目录，默认 $DSH_HOME/data/dsh-video2text/out'),
  python: z.string().default('python3').volatile().description('Python 解释器'),
  align: z.boolean().default(true).volatile().description('云端转写后对齐到句级时间戳'),
  model: z.string().default('').volatile().description('Whisper 模型（留空用引擎默认，可填本地路径）'),
  retentionDays: z.number().default(14).volatile().description('本地媒体保留天数'),
  maxMediaGb: z.number().default(5).volatile().description('本地媒体总容量上限（GB）'),
  importDirs: z.string().default('').volatile().description('要收编的额外产物目录（逗号分隔）'),
})

const API_BASE = '/plugins/dsh-video2text'
const MAX_JOBS = 30
const MAX_LOG_LINES = 400

function isConfigRef(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    && typeof value.get === 'function' && Object.keys(value).length === 1
}
function unwrap(value) {
  if (isConfigRef(value)) return unwrap(value.get())
  if (Array.isArray(value)) return value.map(unwrap)
  if (value === null || typeof value !== 'object') return value
  return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, unwrap(child)]))
}
function readSettings(config) {
  const next = unwrap(config ?? {})
  return {
    engineRoot: '',
    defaultBackend: 'auto',
    outDir: '',
    python: 'python3',
    align: true,
    model: '',
    retentionDays: 14,
    maxMediaGb: 5,
    importDirs: '',
    ...(next !== null && typeof next === 'object' ? next : {}),
  }
}

function engineEnv() {
  const cacheHome = path.join(homedir(), '.cache', 'video2text')
  return {
    ...process.env,
    HF_HOME: process.env.HF_HOME || path.join(cacheHome, 'hf'),
    VIDEO2TEXT_CACHE: process.env.VIDEO2TEXT_CACHE || cacheHome,
  }
}

function dshHome() {
  return process.env.DSH_HOME || path.join(homedir(), '.dsh')
}

function bundledEngine() {
  try {
    return path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'skills', 'video2text')
  } catch {
    return ''
  }
}

function resolveEngine(settings) {
  const candidates = [
    settings.engineRoot,
    bundledEngine(),
    process.env.VIDEO2TEXT_ROOT,
    path.join(dshHome(), 'skills', 'video2text'),
    path.join(homedir(), '.agents', 'skills', 'video2text'),
  ].filter((item) => typeof item === 'string' && item.length > 0)
  for (const root of candidates) {
    if (existsSync(path.join(root, 'scripts', 'video2text'))) return root
  }
  return ''
}

function makeJobId() {
  return `v2t-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
}

function json(res, status, payload) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(payload))
}

async function readBody(req) {
  let body = ''
  for await (const chunk of req) body += String(chunk)
  if (!body) return {}
  try {
    return JSON.parse(body)
  } catch {
    return {}
  }
}

function runProbe(root, python, url) {
  const script = path.join(root, 'scripts', 'video2text')
  const result = spawnSync(python || 'python3', [script, '--probe', url], {
    cwd: root,
    env: { ...process.env },
    encoding: 'utf-8',
    timeout: 60000,
  })
  if (result.status !== 0) {
    throw new Error((result.stderr || result.stdout || 'probe failed').trim().slice(-300))
  }
  const lines = (result.stdout || '').trim().split(/\r?\n/).filter((line) => line.startsWith('{'))
  if (lines.length === 0) throw new Error('probe returned no data')
  return JSON.parse(lines[lines.length - 1])
}

function probeAsync(root, python, url, onDone, onFail) {
  const script = path.join(root, 'scripts', 'video2text')
  const child = spawn(python || 'python3', [script, '--probe', url], {
    cwd: root,
    env: engineEnv(),
  })
  let out = ''
  let err = ''
  child.stdout.on('data', (chunk) => { out += String(chunk) })
  child.stderr.on('data', (chunk) => { err += String(chunk) })
  child.on('error', (e) => onFail?.(e))
  child.on('close', (code) => {
    if (code !== 0) {
      onFail?.(new Error((err || out || `probe exit ${code}`).trim().slice(-200)))
      return
    }
    const line = out.trim().split(/\r?\n/).filter((l) => l.startsWith('{')).pop()
    if (!line) {
      onFail?.(new Error('probe returned no data'))
      return
    }
    try {
      onDone?.(JSON.parse(line))
    } catch (e) {
      onFail?.(e)
    }
  })
  return child
}

function authTargetOf(text) {
  const match = /\[(auth|service):([a-z-]+)\]/i.exec(String(text || ''))
  return match ? { kind: match[1].toLowerCase(), target: match[2].toLowerCase() } : null
}

// 找到真正含 SKILL.md 的技能目录（harness 只认 <root>/<name>/SKILL.md 与 <root>/<name>.md）
function skillEntry(root) {
  if (!root) return ''
  if (existsSync(path.join(root, 'SKILL.md'))) return root
  const nested = path.join(root, 'skills', 'video2text')
  if (existsSync(path.join(nested, 'SKILL.md'))) return nested
  return ''
}

function ensureSkillLink(root) {
  root = skillEntry(root)
  if (!root) return
  const target = path.join(dshHome(), 'skills', 'video2text')
  try {
    let current = ''
    try {
      current = readlinkSync(target)
    } catch {
      // 不是软链：可能是用户自己放的真实目录，不动它
      if (existsSync(target)) return
    }
    if (current === root) return
    if (current) rmSync(target, { force: true })
    mkdirSync(path.dirname(target), { recursive: true })
    symlinkSync(root, target, 'dir')
  } catch {
    // 根不可写时静默：面板仍可用，只是 agent 看不到 skill。
  }
}

const STORE_FILE = () => path.join(dshHome(), 'data', 'dsh-video2text', 'jobs.json')
const MAX_PERSISTED_JOBS = 60
const SERIAL_KEYS = ['id', 'url', 'fromFile', 'backend', 'align', 'status', 'log', 'output', 'error',
  'startedAt', 'finishedAt', 'duration', 'title', 'cover', 'segments', 'mediaPath', 'dir', 'meta',
  'authKind', 'authTarget', 'imported']

function serializeJob(job) {
  const out = {}
  for (const key of SERIAL_KEYS) {
    if (job[key] !== undefined) out[key] = job[key]
  }
  if (Array.isArray(out.log)) out.log = out.log.slice(-80)
  return out
}

function loadStoredJobs() {
  const file = STORE_FILE()
  try {
    const raw = JSON.parse(readFileSync(file, 'utf-8'))
    if (!Array.isArray(raw)) return []
    return raw
  } catch {
    return []
  }
}

function writeStoredJobs(jobs) {
  const file = STORE_FILE()
  try {
    mkdirSync(path.dirname(file), { recursive: true })
    const rows = [...jobs.values()]
      .sort((a, b) => b.startedAt - a.startedAt)
      .slice(0, MAX_PERSISTED_JOBS)
      .map(serializeJob)
    const tmp = `${file}.tmp`
    writeFileSync(tmp, JSON.stringify(rows, null, 1), 'utf-8')
    renameSync(tmp, file)
  } catch {
    // 持久化失败不影响本次运行
  }
}

export function apply(ctx, config) {
  let settings = readSettings(config)
  const jobs = new Map()
  let saveTimer = null
  const saveJobs = () => {
    if (saveTimer) return
    saveTimer = setTimeout(() => {
      saveTimer = null
      writeStoredJobs(jobs)
    }, 300)
  }
  function dirBytes(dir) {
    try {
      let total = 0
      for (const name of readdirSync(dir)) {
        const file = path.join(dir, name)
        const st = statSync(file)
        total += st.isDirectory() ? dirBytes(file) : st.size
      }
      return total
    } catch {
      return 0
    }
  }

  function purgeMedia(job) {
    try {
      if (job.mediaPath) rmSync(path.dirname(job.mediaPath), { recursive: true, force: true })
    } catch {}
    job.mediaPath = ''
    job.mediaPurged = true
  }

  function pruneMedia() {
    const days = Number(process.env.VIDEO2TEXT_RETENTION_DAYS ?? settings.retentionDays) || 0
    const cap = (Number(process.env.VIDEO2TEXT_MAX_MEDIA_GB ?? settings.maxMediaGb) || 0) * 1e9
    const cutoff = days > 0 ? Date.now() - days * 864e5 : 0
    let changed = false
    const holders = [...jobs.values()].filter((job) => job.mediaPath && !job.imported)
    for (const job of holders) {
      if (cutoff && job.startedAt < cutoff) {
        purgeMedia(job)
        changed = true
      }
    }
    if (cap > 0) {
      const alive = [...jobs.values()].filter((job) => job.mediaPath && !job.imported)
      const sized = alive.map((job) => ({ job, bytes: dirBytes(path.dirname(job.mediaPath)) }))
      let total = sized.reduce((sum, row) => sum + row.bytes, 0)
      sized.sort((a, b) => a.job.startedAt - b.job.startedAt)
      for (const row of sized) {
        if (total <= cap) break
        purgeMedia(row.job)
        total -= row.bytes
        changed = true
      }
    }
    if (changed) saveJobs()
  }

  for (const stored of loadStoredJobs()) {
    if (!stored || !stored.id) continue
    if (stored.status === 'running') {
      stored.status = 'failed'
      stored.error = '宿主重启，任务已中断'
      stored.finishedAt = stored.finishedAt || Date.now()
    }
    jobs.set(stored.id, stored)
  }
  ensureSkillLink(resolveEngine(settings))
  pruneMedia()
  try { importExisting(true) } catch {}

  const engineRoot = () => resolveEngine(settings)

  function outDirFor(jobId) {
    const base = settings.outDir || path.join(dshHome(), 'data', 'dsh-video2text', 'out')
    const dir = path.join(base, jobId)
    mkdirSync(dir, { recursive: true })
    return dir
  }

  function pushLog(job, chunk) {
    const text = String(chunk)
    for (const line of text.split(/\r?\n/)) {
      if (!line.trim()) continue
      job.log.push(line)
    }
    if (job.log.length > MAX_LOG_LINES) job.log.splice(0, job.log.length - MAX_LOG_LINES)
  }

  function startJob(input) {
    // reuse：重试复用原任务卡，不新建一条
    const reused = input.reuse ? jobs.get(String(input.reuse)) : null
    let job
    if (reused) {
      job = reused
      try { job.child?.kill?.('SIGTERM') } catch {}
      try { if (job.dir) rmSync(job.dir, { recursive: true, force: true }) } catch {}
      job.url = input.url || job.url || ''
      job.fromFile = input.fromFile || job.fromFile || ''
      job.backend = input.backend || job.backend || settings.defaultBackend || 'auto'
      job.align = Boolean(input.align)
      job.status = 'running'
      job.log = []
      job.output = ''
      job.error = ''
      job.startedAt = Date.now()
      job.finishedAt = 0
      job.segments = []
      job.mediaPath = ''
      job.authTarget = ''
      job.authKind = ''
      delete job.partial
      delete job.mediaPurged
      saveJobs()
    } else {
      const id = makeJobId()
      job = {
        id,
        url: input.url || '',
        fromFile: input.fromFile || '',
        backend: input.backend || settings.defaultBackend || 'auto',
        align: Boolean(input.align),
        status: 'running',
        log: [],
        output: '',
        error: '',
        startedAt: Date.now(),
        finishedAt: 0,
      }
      jobs.set(id, job)
      saveJobs()
      while (jobs.size > MAX_JOBS) {
        const oldest = [...jobs.values()].sort((a, b) => a.startedAt - b.startedAt)[0]
        jobs.delete(oldest.id)
        saveJobs()
      }
    }
    const id = job.id

    const root = engineRoot()
    if (!root) {
      job.status = 'failed'
      job.error = '未找到 video2text 引擎：请在插件配置里设置 engineRoot，或设置环境变量 VIDEO2TEXT_ROOT'
      job.finishedAt = Date.now()
      return job
    }

    const script = path.join(root, 'scripts', 'video2text')
    const out = outDirFor(id)
    job.dir = out
    const args = [script]
    if (job.fromFile) {
      args.push('--from-file', job.fromFile)
    } else {
      args.push(job.url)
    }
    args.push('--out', out, '--backend', job.backend)
    args.push('--media-dir', path.join(out, 'media'))
    if (job.backend === 'api') args.push(job.align ? '--align' : '--no-align')
    if (/weixin\.qq\.com\/sph|channels\.weixin/i.test(job.url || '')) {
      args.push('--wechat-session', '--login-timeout', '90')
    }
    const model = settings.model || process.env.VIDEO2TEXT_MODEL || ''
    if (model) args.push('--model', model)
    if (input.fix) args.push('--fix', input.fix)
    if (input.glossary) args.push('--glossary', input.glossary)

    if (!job.fromFile) {
      job.title = ''
    } else {
      job.title = path.basename(job.fromFile)
    }
    if (job.url) {
      probeAsync(root, settings.python, job.url, (data) => {
        if (!jobs.has(job.id)) return
        job.title = job.title || data.title || ''
        job.cover = job.cover || data.cover || ''
        job.duration = job.duration || Number(data.duration) || 0
        job.meta = {
          ...(job.meta || {}),
          title: data.title || '', platform: data.platform || '',
          author: data.author || '', published: data.published || '',
          url: job.url, cover: data.cover || '',
        }
        saveJobs()
      }, () => {})
    }

    const cacheHome = path.join(dshHome(), 'data', 'dsh-video2text')
    const child = spawn(settings.python || 'python3', args, {
      cwd: root,
      env: engineEnv(),
    })
    job.child = child
    child.stdout.on('data', (chunk) => pushLog(job, chunk))
    child.stderr.on('data', (chunk) => pushLog(job, chunk))
    child.on('error', (err) => {
      job.status = 'failed'
      job.error = String(err?.message || err)
      job.finishedAt = Date.now()
      saveJobs()
    })
    child.on('close', (code) => {
      job.finishedAt = Date.now()
      const sideOnFail = newestSidecar(out)
      if (code === 4 || code !== 0) {
        const blob = `${job.error || ''}\n${(job.log || []).slice(-40).join('\n')}`
        const marker = authTargetOf(blob)
        if (sideOnFail) {
          // 有的平台在需要登录时仍能给出发布文案：保留下来，别让任务看起来全空
          job.title = job.title || sideOnFail.title || ''
          job.cover = job.cover || sideOnFail.cover || ''
          job.duration = job.duration || sideOnFail.duration || 0
          job.meta = { ...(job.meta || {}), ...sideOnFail }
          job.segments = Array.isArray(sideOnFail.segments) ? sideOnFail.segments : []
        }
        if (marker) {
          job.authKind = marker.kind
          job.authTarget = marker.target
          job.status = code === 4 ? 'auth' : 'failed'
          job.error = job.error || (code === 4
            ? '需要登录后才能取到口播稿'
            : (job.log.filter((line) => /error|auth/i.test(line)).slice(-2).join(' / ') || `exit ${code}`))
          saveJobs()
          return
        }
        job.status = 'failed'
        job.error = job.error || (job.log.filter((line) => /error/i.test(line)).slice(-3).join(' / ') || `exit ${code}`)
        saveJobs()
        return
      }
      job.status = 'done'
      job.output = newestMarkdown(out)
      const side = newestSidecar(out)
      if (side) {
        job.meta = side
        job.title = side.title || ''
        job.duration = side.duration || 0
        job.cover = side.cover || ''
        job.segments = Array.isArray(side.segments) ? side.segments : []
        job.mediaPath = side.media || ''
      }
      saveJobs()
      pruneMedia()
    })
    return job
  }

  function newestSidecar(dir) {
    try {
      const files = readdirSync(dir).filter((file) => file.endsWith('.json') && file !== 'media.json')
        .map((file) => path.join(dir, file))
        .filter((file) => !file.includes(`${path.sep}media${path.sep}`))
      if (files.length === 0) return null
      files.sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)
      return JSON.parse(readFileSync(files[0], 'utf-8'))
    } catch {
      return null
    }
  }

  function newestMarkdown(dir) {
    try {
      const files = readdirSync(dir)
        .filter((file) => file.endsWith('.md'))
        .map((file) => path.join(dir, file))
      if (files.length === 0) return ''
      files.sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)
      return files[0]
    } catch {
      return ''
    }
  }

  function resolveMedia(job) {
    if (job.mediaPath && existsSync(job.mediaPath)) return job.mediaPath
    if (!job.dir) return ''
    const early = path.join(job.dir, 'media.json')
    if (!existsSync(early)) return ''
    try {
      const data = JSON.parse(readFileSync(early, 'utf-8'))
      if (data.media && existsSync(data.media)) return data.media
    } catch {}
    return ''
  }

  function earlyManifest(job) {
    if (!job.dir) return null
    const file = path.join(job.dir, 'media.json')
    if (!existsSync(file)) return null
    try {
      return JSON.parse(readFileSync(file, 'utf-8'))
    } catch {
      return null
    }
  }

  let lastImportAt = 0
  function importRoots() {
    const base = settings.outDir || path.join(dshHome(), 'data', 'dsh-video2text', 'out')
    const extra = (process.env.VIDEO2TEXT_IMPORT_DIRS || '')
      .split(path.delimiter)
      .filter(Boolean)
    const configured = String(settings.importDirs || '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
    return [...new Set([base, ...configured, ...extra])]
  }

  // 把「已有产物目录」收编进任务列表（agent 直接跑 skill 时也能看到）
  function importExisting(force) {
    const now = Date.now()
    if (!force && now - lastImportAt < 5000) return false
    lastImportAt = now
    const known = new Set([...jobs.values()].map((job) => job.dir).filter(Boolean))
    let added = false
    for (const root of importRoots()) {
      let entries = []
      try {
        entries = readdirSync(root, { withFileTypes: true })
      } catch {
        continue
      }
      for (const entry of entries) {
        if (!entry.isDirectory()) continue
        const dir = path.join(root, entry.name)
        if (known.has(dir)) continue
        const side = (() => {
          try {
            const files = readdirSync(dir).filter((file) => file.endsWith('.json') && file !== 'media.json')
            files.sort((a, b) => statSync(path.join(dir, b)).mtimeMs - statSync(path.join(dir, a)).mtimeMs)
            for (const file of files) {
              const data = JSON.parse(readFileSync(path.join(dir, file), 'utf-8'))
              if (Array.isArray(data.segments)) return data
            }
          } catch {}
          return null
        })()
        if (!side) continue
        const id = `v2t-import-${entry.name.replace(/[^a-zA-Z0-9-]/g, '').slice(-12) || makeJobId().slice(4)}`
        if (jobs.has(id)) continue
        const media = side.media && existsSync(side.media)
          ? side.media
          : (existsSync(path.join(dir, 'media', 'media.mp4')) ? path.join(dir, 'media', 'media.mp4') : '')
        jobs.set(id, {
          id,
          url: side.url || '',
          fromFile: '',
          backend: side.backend || 'imported',
          status: 'done',
          log: ['[import] 从已有产出目录收编'],
          output: '',
          error: '',
          startedAt: side.mtime || statSync(dir).mtimeMs,
          finishedAt: statSync(dir).mtimeMs,
          duration: side.duration || 0,
          title: side.title || entry.name,
          cover: side.cover || '',
          segments: side.segments || [],
          mediaPath: media,
          dir,
          meta: side,
          imported: true,
        })
        known.add(dir)
        added = true
      }
    }
    if (added) saveJobs()
    return added
  }

  function jobView(job) {
    const view = { ...job }
    delete view.child
    delete view.mediaPath
    delete view.dir
    view.hasMedia = Boolean(resolveMedia(job))
    view.aligning = Boolean(job.aligning)
    view.aligningSince = job.aligningSince || 0
    view.aligned = Boolean(job.meta?.aligned)
    if (job.status === 'running') {
      const early = earlyManifest(job)
      if (early) {
        view.partial = true
        if (early.title) view.title = early.title
        if (early.cover) view.cover = early.cover
        if (early.duration) view.duration = early.duration
        view.meta = {
          ...(view.meta || {}),
          title: early.title || '', platform: early.platform || '', author: early.author || '',
          published: early.published || '', url: early.url || '', cover: early.cover || '',
        }
      }
    }
    if (view.output && existsSync(view.output)) {
      try {
        view.markdown = readFileSync(view.output, 'utf-8')
      } catch {
        view.markdown = ''
      }
    }
    return view
  }

  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: `${API_BASE}/media`,
    handler: async (req, res) => {
      const url = new URL(req.url || '/', 'http://dsh.internal')
      const job = jobs.get(url.searchParams.get('id') || '')
      const mediaFile = job ? resolveMedia(job) : ''
      if (!mediaFile) {
        json(res, 404, { error: 'media not found' })
        return
      }
      const file = mediaFile
      const size = statSync(file).size
      const ext = path.extname(file).toLowerCase()
      const type = ext === '.webm' ? 'video/webm'
        : ext === '.wav' ? 'audio/wav'
          : ext === '.m4a' ? 'audio/mp4'
            : ext === '.mov' ? 'video/quicktime'
              : 'video/mp4'
      const range = req.headers.range
      if (range) {
        const match = /bytes=(\d*)-(\d*)/.exec(range)
        const start = match && match[1] ? Number(match[1]) : 0
        const end = match && match[2] ? Math.min(Number(match[2]), size - 1) : size - 1
        if (start >= size || start > end) {
          res.writeHead(416, { 'content-range': `bytes */${size}` })
          res.end()
          return
        }
        res.writeHead(206, {
          'content-type': type,
          'accept-ranges': 'bytes',
          'content-range': `bytes ${start}-${end}/${size}`,
          'content-length': end - start + 1,
        })
        createReadStream(file, { start, end }).pipe(res)
        return
      }
      res.writeHead(200, {
        'content-type': type,
        'accept-ranges': 'bytes',
        'content-length': size,
      })
      createReadStream(file).pipe(res)
    },
  }), 'dsh-video2text: media')

  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: `${API_BASE}/cover`,
    handler: async (req, res) => {
      const url = new URL(req.url || '/', 'http://dsh.internal')
      const target = url.searchParams.get('url') || ''
      if (!/^https?:\/\//i.test(target)) {
        json(res, 400, { error: 'bad url' })
        return
      }
      try {
        const upstream = await fetch(target, {
          headers: { 'user-agent': 'Mozilla/5.0', referer: 'https://www.xiaohongshu.com/' },
        })
        const type = upstream.headers.get('content-type') || ''
        if (!type.startsWith('image/')) {
          json(res, 415, { error: 'not an image' })
          return
        }
        const buffer = Buffer.from(await upstream.arrayBuffer())
        res.writeHead(200, { 'content-type': type, 'cache-control': 'max-age=86400', 'content-length': buffer.length })
        res.end(buffer)
      } catch (err) {
        json(res, 502, { error: String(err?.message || err) })
      }
    },
  }), 'dsh-video2text: cover')

  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: `${API_BASE}/cancel`,
    handler: async (req, res) => {
      if ((req.method || 'GET').toUpperCase() !== 'POST') {
        json(res, 405, { error: 'method not allowed' })
        return
      }
      const body = await readBody(req)
      const job = jobs.get(body.id)
      if (!job) {
        json(res, 404, { error: 'job not found' })
        return
      }
      try {
        job.child?.kill?.('SIGTERM')
      } catch {}
      job.status = 'failed'
      job.error = '已取消'
      job.finishedAt = Date.now()
      saveJobs()
      json(res, 200, { ok: true, id: job.id })
    },
  }), 'dsh-video2text: cancel')

  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: `${API_BASE}/probe`,
    handler: async (req, res) => {
      if ((req.method || 'GET').toUpperCase() !== 'POST') {
        json(res, 405, { error: 'method not allowed' })
        return
      }
      const body = await readBody(req)
      if (!body.url) {
        json(res, 400, { error: '需要 url' })
        return
      }
      try {
        const root = engineRoot()
        if (!root) throw new Error('engine not found')
        json(res, 200, runProbe(root, settings.python, body.url))
      } catch (err) {
        json(res, 422, { error: String(err?.message || err) })
      }
    },
  }), 'dsh-video2text: probe')

  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: `${API_BASE}/file`,
    handler: async (req, res) => {
      const url = new URL(req.url || '/', 'http://dsh.internal')
      const job = jobs.get(url.searchParams.get('id') || '')
      const name = url.searchParams.get('name') || ''
      if (!job || !name || !job.dir) {
        json(res, 404, { error: 'not found' })
        return
      }
      const file = path.resolve(job.dir, name)
      if (!file.startsWith(path.resolve(job.dir) + path.sep) || !existsSync(file)) {
        json(res, 404, { error: 'not found' })
        return
      }
      const size = statSync(file).size
      const ext = path.extname(file).toLowerCase()
      const type = ext === '.md' ? 'text/markdown; charset=utf-8'
        : ext === '.srt' ? 'text/plain; charset=utf-8'
          : ext === '.txt' ? 'text/plain; charset=utf-8'
            : ext === '.json' ? 'application/json; charset=utf-8'
              : ext === '.zip' ? 'application/zip'
                : ext === '.png' ? 'image/png'
                  : ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg'
                    : 'video/mp4'
      const headers = { 'content-type': type, 'content-length': size }
      if (url.searchParams.get('download') === '1') {
        headers['content-disposition'] = `attachment; filename*=UTF-8''${encodeURIComponent(path.basename(file))}`
      }
      res.writeHead(200, headers)
      createReadStream(file).pipe(res)
    },
  }), 'dsh-video2text: file')

  function jobFiles(job) {
    const files = {}
    if (!job.dir) return files
    try {
      for (const name of readdirSync(job.dir)) {
        const full = path.join(job.dir, name)
        if (name === 'media' || name === 'media.json' || name.startsWith('.')) continue
        if (!statSync(full).isFile()) continue
        const ext = path.extname(name).toLowerCase()
        if (ext === '.md') {
          // 主稿是 <标题>.md；.publish/.chapters/.polished 是派生物，dot 更多
          const dots = (name.match(/\./g) || []).length
          if (!files.markdown || dots < (files.markdown.match(/\./g) || []).length) files.markdown = full
        }
        else if (ext === '.srt') files.subtitles = full
        else if (ext === '.json') files.sidecar = full
        else if (ext === '.txt') files.script = full
        else if (ext === '.zip') files.bundle = full
      }
    } catch {}
    const media = resolveMedia(job)
    if (media) files.media = media
    return files
  }

  let modelRun = null
  function startWarm(model) {
    if (modelRun && modelRun.status === 'running') return modelRun
    const root = engineRoot()
    if (!root) throw new Error('未找到 video2text 引擎')
    const run = {
      target: 'model', model: model || '', status: 'running', log: [],
      startedAt: Date.now(), finishedAt: 0, error: '',
    }
    modelRun = run
    const child = spawn(settings.python || 'python3',
      [path.join(root, 'scripts', 'video2text'), '--warm-model', model || ''],
      { cwd: root, env: engineEnv() })
    const absorb = (chunk) => {
      for (const line of String(chunk).split(/\r?\n/)) if (line.trim()) run.log.push(line)
      if (run.log.length > 80) run.log.splice(0, run.log.length - 80)
    }
    child.stdout.on('data', absorb)
    child.stderr.on('data', absorb)
    child.on('close', (code) => {
      run.finishedAt = Date.now()
      run.status = code === 0 ? 'done' : 'failed'
      if (code !== 0) run.error = run.log.slice(-2).join(' / ') || `exit ${code}`
      statusCache = { at: 0, value: null }
    })
    return run
  }

  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: `${API_BASE}/model`,
    handler: async (req, res) => {
      const method = (req.method || 'GET').toUpperCase()
      if (method === 'POST') {
        const body = await readBody(req)
        try {
          json(res, 200, startWarm(String(body.model || '')))
        } catch (err) {
          json(res, 422, { error: String(err?.message || err) })
        }
        return
      }
      let cache = null
      try {
        cache = readStatus(false).status?.model_cache || null
      } catch {}
      json(res, 200, { run: modelRun, model_cache: cache })
    },
  }), 'dsh-video2text: model')

  let workspaceRegistry = null
  try {
    ctx.inject(['workspaceRegistry'], (inner) => {
      workspaceRegistry = inner.workspaceRegistry
      return () => { workspaceRegistry = null }
    })
  } catch {
    // 宿主没有这个服务时保持为空，/workspace 会回退成"只返回路径"
  }

  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: `${API_BASE}/workspace`,
    handler: async (req, res) => {
      if ((req.method || 'GET').toUpperCase() !== 'POST') {
        json(res, 405, { error: 'method not allowed' })
        return
      }
      const body = await readBody(req)
      const job = body.id ? jobs.get(body.id) : null
      if (body.id && (!job || !job.dir)) {
        json(res, 404, { error: 'job not found' })
        return
      }
      // 工作目录 = 所有任务的上一级目录（agent 能一并管理其它任务）；只选择，不创建
      const target = job ? path.dirname(job.dir) : path.join(dshHome(), 'data', 'dsh-video2text', 'out')
      if (!workspaceRegistry) {
        json(res, 200, { ok: false, path: target, reason: 'workspaceRegistry unavailable' })
        return
      }
      try {
        const existing = await workspaceRegistry.resolveByPath(target)
        if (!existing) {
          json(res, 200, { ok: false, path: target, reason: 'not-registered' })
          return
        }
        json(res, 200, {
          ok: true,
          id: existing.id,
          title: existing.title || path.basename(target),
          path: existing.path || target,
        })
      } catch (err) {
        json(res, 500, { ok: false, path: target, error: String(err?.message || err) })
      }
    },
  }), 'dsh-video2text: workspace')

  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: `${API_BASE}/align`,
    handler: async (req, res) => {
      if ((req.method || 'GET').toUpperCase() !== 'POST') {
        json(res, 405, { error: 'method not allowed' })
        return
      }
      const body = await readBody(req)
      const job = jobs.get(body.id)
      if (!job || !job.dir) {
        json(res, 404, { error: 'job not found' })
        return
      }
      if (job.aligning) {
        json(res, 409, { error: '对齐已在进行中' })
        return
      }
      if (!Array.isArray(job.segments) || job.segments.length === 0) {
        json(res, 400, { error: '这条任务还没有逐字稿' })
        return
      }
      const root = engineRoot()
      if (!root) {
        json(res, 422, { error: '未找到 video2text 引擎' })
        return
      }
      job.aligning = true
      job.aligningSince = Date.now()
      pushLog(job, '[align] 开始句级对齐（本地词级时间）…')
      saveJobs()
      const child = spawn(settings.python || 'python3',
        [path.join(root, 'scripts', 'video2text'), '--realign', job.dir,
          ...(settings.model ? ['--model', settings.model] : [])],
        { cwd: root, env: engineEnv() })
      job.child = child
      child.stdout.on('data', (chunk) => pushLog(job, chunk))
      child.stderr.on('data', (chunk) => pushLog(job, chunk))
      child.on('close', (code) => {
        job.aligning = false
        job.aligningSince = 0
        job.child = null
        if (code === 0) {
          const side = newestSidecar(job.dir)
          if (side) {
            job.meta = { ...(job.meta || {}), ...side }
            if (Array.isArray(side.segments) && side.segments.length) job.segments = side.segments
            job.title = job.title || side.title || ''
            job.cover = job.cover || side.cover || ''
          }
          pushLog(job, '[align] 完成')
        } else {
          pushLog(job, `[align] 失败（exit ${code}）`)
        }
        saveJobs()
      })
      json(res, 200, { ok: true, id: job.id })
    },
  }), 'dsh-video2text: align')

  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: `${API_BASE}/setup-prompt`,
    handler: async (req, res) => {
      if ((req.method || 'GET').toUpperCase() !== 'POST') {
        json(res, 405, { error: 'method not allowed' })
        return
      }
      const out = path.join(dshHome(), 'data', 'dsh-video2text', 'out')
      const cache = path.join(homedir(), '.cache', 'video2text')
      const lines = [
        '帮我在这台机器上把「视频转文案」缺失的本地依赖装好，装完要能直接用于转写。',
        '',
        `- 工作目录：${out}`,
        `- 配置写到这里：${path.join(homedir(), '.config', 'video2text', 'config.json')}`,
        '',
        '需要两样东西，缺哪个装哪个（先检测，已经可用就跳过）：',
        '',
        '1) 小红书解析服务（XHS-Downloader）',
        '   - 仓库：https://github.com/JoeanAmier/XHS-Downloader',
        '   - 目标：本机 `http://127.0.0.1:5556` 能响应 `/docs`',
        '   - 配置项：`xhs_api`（写 `http://127.0.0.1:5556`）',
        '   - 优先用 Docker 跑；没有 Docker 就用独立的 Python 环境装，不要污染系统 Python',
        '',
        '1b) YouTube 反爬（可选，二选一）',
        '   - 简单：设置里「浏览器 Cookie」填 chrome，让 yt-dlp 读已登录的浏览器',
        '   - 稳定：起 bgutil provider + 装 yt-dlp 插件，再把地址填到「YouTube PO token」',
        '     provider: docker run --name bgutil-provider -d --init -p 127.0.0.1:4416:4416 brainicism/bgutil-ytdlp-pot-provider',
        '     插件: unzip 到 ~/.config/yt-dlp/plugins/bgutil-ytdlp-pot-provider（不要放 ~/Library/Application Support）',
        '     注意：PO token 不绕过 IP 级风控，机房出口仍需 Cookie',
        '',
        '2) 抖音详情/签名（DouK-Downloader / TikTokDownloader）',
        '   - 仓库：https://github.com/JoeanAmier/TikTokDownloader',
        '   - 目标：clone 到 `' + cache + '/DouK`（或你建议的合适位置）并能跑起来',
        '   - 配置项：`douk_path`（指向该目录，里面有 DouK 的入口脚本）',
        '',
        '完成后请：',
        `- 用 \`video2text --config-merge\` 把路径写进配置（避免手改 JSON 出错）`,
        '- 跑 `video2text --status` 确认 `xhs_api.ok == true`、`douk_path.exists == true`',
        '- 把实际执行的命令和最终状态回报给我',
        '',
        '（这两个都是 GPL-3.0 的第三方项目，只在本机安装使用，不要复制它们的代码进项目。）',
      ]
      json(res, 200, {
        path: out,
        prompt: lines.join('\n'),
      })
    },
  }), 'dsh-video2text: setup-prompt')

  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: `${API_BASE}/context`,
    handler: async (req, res) => {
      const url = new URL(req.url || '/', 'http://dsh.internal')
      const job = jobs.get(url.searchParams.get('id') || '')
      if (!job) {
        json(res, 404, { error: 'job not found' })
        return
      }
      const files = jobFiles(job)
      const segments = Array.isArray(job.segments) ? job.segments : []
      const chars = segments.reduce((sum, seg) => sum + String(seg.text || '').length, 0)
      const lines = [
        '我刚用「视频转文案」处理完一条视频，需要你接着做更复杂的事。',
        '',
        `- 标题：${job.title || '（未知）'}`,
        `- 来源：${job.url || job.fromFile || job.id}`,
        `- 时长：${job.duration ? `${Math.round(job.duration)}s` : '未知'} · 转写 ${segments.length} 句 / ${chars} 字`,
        `- 输出目录：${job.dir || '（无）'}`,
      ]
      if (files.markdown) lines.push(`- 文字稿：${files.markdown}`)
      if (files.subtitles) lines.push(`- 字幕：${files.subtitles}`)
      if (files.sidecar) lines.push(`- 结构化数据（含逐句时间戳）：${files.sidecar}`)
      if (files.media) lines.push(`- 媒体：${files.media}`)
      lines.push('')
      lines.push('先读上面的文件，然后帮我：（在这里写你要做的事，例如「压成 300 字口播稿」'
        + '「按章节重写标题」「导出一条 15 秒切片」「把这套流程跑成批量」）')
      json(res, 200, {
        id: job.id,
        dir: job.dir || '',
        files,
        engineRoot: engineRoot(),
        prompt: lines.join('\n'),
      })
    },
  }), 'dsh-video2text: context')

  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: `${API_BASE}/export`,
    handler: async (req, res) => {
      if ((req.method || 'GET').toUpperCase() !== 'POST') {
        json(res, 405, { error: 'method not allowed' })
        return
      }
      const body = await readBody(req)
      const job = jobs.get(body.id)
      if (!job || !job.dir) {
        json(res, 404, { error: 'job not found' })
        return
      }
      const kinds = ['publish', 'script', 'chapters', 'srt', 'bundle']
      const kind = kinds.includes(body.kind) ? body.kind : 'publish'
      const root = engineRoot()
      if (!root) {
        json(res, 422, { error: 'engine not found' })
        return
      }
      const script = path.join(root, 'scripts', 'video2text')
      const result = spawnSync(settings.python || 'python3',
        [script, '--export', job.dir, '--format', kind, '--out', job.dir],
        { cwd: root, encoding: 'utf-8', timeout: 90000, env: engineEnv() })
      if (result.status !== 0) {
        json(res, 500, { error: (result.stderr || result.stdout || 'export failed').trim().slice(-300) })
        return
      }
      const lines = (result.stdout || '').trim().split(/\r?\n/).filter(Boolean)
      const file = lines[lines.length - 1] || ''
      if (!file || !existsSync(file)) {
        json(res, 500, { error: 'export produced no file' })
        return
      }
      const name = path.basename(file)
      json(res, 200, {
        kind,
        name,
        url: `${API_BASE}/file?id=${encodeURIComponent(job.id)}&name=${encodeURIComponent(name)}&download=1`,
      })
    },
  }), 'dsh-video2text: export')

  const loginRuns = new Map()
  const LOGIN_TARGETS = {
    douyin: { label: '抖音', args: (script) => [script, '--login', 'douyin', '--login-timeout', '240'] },
    xhs: { label: '小红书', args: (script) => [script, '--login', 'xhs', '--login-timeout', '240'] },
    wechat: { label: '微信视频号', args: (script) => [script, '--login-wechat', '--login-timeout', '300'] },
    'wechat-verify': {
      label: '视频号会话预检',
      args: (script, root) => [path.join(root, 'scripts', 'wx_session.py'), '', '25'],
      env: { WX_PREFLIGHT: '1' },
    },
  }

  let statusCache = { at: 0, value: null }
  function readStatus(force) {
    if (!force && statusCache.value && Date.now() - statusCache.at < 8000) return statusCache.value
    const root = engineRoot()
    const value = { at: Date.now(), status: null, error: '' }
    if (!root) {
      value.error = 'engine not found'
    } else {
      const result = spawnSync(settings.python || 'python3',
        [path.join(root, 'scripts', 'video2text'), '--status'],
        { cwd: root, encoding: 'utf-8', timeout: 20000, env: engineEnv() })
      try {
        value.status = JSON.parse(result.stdout || '{}')
      } catch {
        value.error = (result.stderr || result.stdout || 'status failed').trim().slice(-300)
      }
    }
    statusCache = value
    return value
  }

  function loginView(run) {
    if (!run) return null
    const view = { ...run }
    delete view.child
    return view
  }

  function startLogin(target) {
    const spec = LOGIN_TARGETS[target]
    if (!spec) throw new Error(`未知登录目标：${target}`)
    const previous = loginRuns.get(target)
    if (previous && previous.status === 'running') return previous
    const root = engineRoot()
    if (!root) throw new Error('未找到 video2text 引擎')
    const run = {
      target,
      label: spec.label,
      status: 'running',
      log: [],
      startedAt: Date.now(),
      finishedAt: 0,
      error: '',
    }
    loginRuns.set(target, run)
    const script = path.join(root, 'scripts', 'video2text')
    const child = spawn(settings.python || 'python3', spec.args(script, root), {
      cwd: root,
      env: { ...engineEnv(), ...(spec.env || {}) },
    })
    run.child = child
    const absorb = (chunk) => {
      for (const line of String(chunk).split(/\r?\n/)) {
        if (line.trim()) run.log.push(line)
      }
      if (run.log.length > 60) run.log.splice(0, run.log.length - 60)
    }
    child.stdout.on('data', absorb)
    child.stderr.on('data', absorb)
    child.on('error', (err) => {
      run.status = 'failed'
      run.error = String(err?.message || err)
      run.finishedAt = Date.now()
    })
    child.on('close', (code) => {
      run.finishedAt = Date.now()
      const tail = run.log.filter((line) => line.trim()).slice(-2).join(' / ')
      if (target === 'wechat-verify') {
        run.status = code === 0 || code === 4 ? 'done' : 'failed'
        run.error = run.status === 'done' ? '' : (code === 3 ? '未登录或登录态已失效' : `预检未通过（${code}）`)
      } else {
        run.status = code === 0 ? 'done' : 'failed'
        run.error = code === 0 ? '' : (tail || `exit ${code}`)
      }
      statusCache = { at: 0, value: null }
    })
    return run
  }

  function readConfig(reveal = false) {
    const root = engineRoot()
    if (!root) throw new Error('未找到 video2text 引擎')
    const result = spawnSync(settings.python || 'python3',
      [path.join(root, 'scripts', 'video2text'), '--config-show', ...(reveal ? ['--reveal'] : [])],
      { cwd: root, encoding: 'utf-8', timeout: 15000, env: { ...process.env } })
    if (result.status !== 0) {
      throw new Error((result.stderr || result.stdout || 'config read failed').trim().slice(-300))
    }
    return JSON.parse(result.stdout || '{}')
  }

  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: `${API_BASE}/settings`,
    handler: async (req, res) => {
      const method = (req.method || 'GET').toUpperCase()
      if (method === 'POST') {
        const body = await readBody(req)
        const incoming = body && typeof body.config === 'object' && body.config ? body.config : {}
        const updates = {}
        for (const [key, value] of Object.entries(incoming)) {
          if (typeof key !== 'string' || !key || key.startsWith('_')) continue
          if (value === null || value === undefined) continue
          const text = String(value)
          // 打码值（含省略号）不写回，避免把真实密钥覆盖掉
          if (text.includes('…') || text.includes('••')) continue
          updates[key] = text
        }
        if (Object.keys(updates).length === 0) {
          json(res, 400, { error: '没有可写入的字段' })
          return
        }
        const root = engineRoot()
        if (!root) {
          json(res, 422, { error: '未找到 video2text 引擎' })
          return
        }
        const result = spawnSync(settings.python || 'python3',
          [path.join(root, 'scripts', 'video2text'), '--config-merge'],
          {
            cwd: root, encoding: 'utf-8', timeout: 15000, env: engineEnv(),
            input: JSON.stringify(updates),
          })
        if (result.status !== 0) {
          json(res, 500, { error: (result.stderr || result.stdout || 'config write failed').trim().slice(-300) })
          return
        }
        statusCache = { at: 0, value: null }
        try {
          json(res, 200, { ok: true, written: Object.keys(updates), ...readConfig() })
        } catch (err) {
          json(res, 200, { ok: true, written: Object.keys(updates), error: String(err?.message || err) })
        }
        return
      }
      try {
        const url = new URL(req.url || '/', 'http://dsh.internal')
        const payload = readConfig(url.searchParams.get('reveal') === '1')
        try {
          payload.model_cache = readStatus(false).status?.model_cache || null
        } catch {}
        json(res, 200, payload)
      } catch (err) {
        json(res, 422, { error: String(err?.message || err) })
      }
    },
  }), 'dsh-video2text: settings')

  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: `${API_BASE}/accounts`,
    handler: async (req, res) => {
      const url = new URL(req.url || '/', 'http://dsh.internal')
      const method = (req.method || 'GET').toUpperCase()
      if (method === 'POST') {
        const body = await readBody(req)
        try {
          const run = startLogin(String(body.target || ''))
          json(res, 200, loginView(run))
        } catch (err) {
          json(res, 422, { error: String(err?.message || err) })
        }
        return
      }
      const id = url.searchParams.get('id') || ''
      if (id) {
        json(res, 200, loginView(loginRuns.get(id)) || { error: 'not found' })
        return
      }
      const fresh = readStatus(url.searchParams.get('refresh') === '1')
      json(res, 200, {
        engineRoot: engineRoot(),
        checkedAt: fresh.at,
        status: fresh.status,
        error: fresh.error,
        logins: [...loginRuns.values()].map(loginView),
      })
    },
  }), 'dsh-video2text: accounts')

  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: `${API_BASE}/jobs`,
    handler: async (req, res) => {
      const method = (req.method || 'GET').toUpperCase()
      if (method === 'DELETE') {
        const url = new URL(req.url || '/', 'http://dsh.internal')
        const id = url.searchParams.get('id') || ''
        const job = jobs.get(id)
        if (!job) {
          json(res, 404, { error: 'job not found' })
          return
        }
        try {
          if (job.dir && !job.imported) rmSync(job.dir, { recursive: true, force: true })
        } catch {}
        jobs.delete(id)
        saveJobs()
        json(res, 200, { ok: true, id })
        return
      }
      if (method === 'POST') {
        const body = await readBody(req)
        if (!body.url && !body.fromFile) {
          json(res, 400, { error: '需要 url 或 fromFile' })
          return
        }
        const job = startJob(body)
        json(res, 200, { ...jobView(job), engineRoot: engineRoot() })
        return
      }
      const url = new URL(req.url || '/', 'http://dsh.internal')
      const id = url.searchParams.get('id') || ''
      if (id) {
        const job = jobs.get(id)
        if (!job) {
          json(res, 404, { error: 'job not found' })
          return
        }
        json(res, 200, jobView(job))
        return
      }
      try { importExisting(false) } catch {}
      const rows = [...jobs.values()]
        .sort((a, b) => b.startedAt - a.startedAt)
        .map(jobView)
      const mediaBytes = [...jobs.values()].reduce((sum, job) => (
        job.mediaPath ? sum + dirBytes(path.dirname(job.mediaPath)) : sum
      ), 0)
      json(res, 200, {
        engineRoot: engineRoot(),
        backend: settings.defaultBackend,
        storage: {
          mediaBytes,
          retentionDays: Number(process.env.VIDEO2TEXT_RETENTION_DAYS ?? settings.retentionDays) || 0,
          maxMediaGb: Number(process.env.VIDEO2TEXT_MAX_MEDIA_GB ?? settings.maxMediaGb) || 0,
        },
        jobs: rows,
      })
    },
  }), 'dsh-video2text: route')

}
