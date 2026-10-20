# 开发与发版

面向维护者。用户文档在 [README](../README.md)。

## 本地调试（profile link）

```sh
# 1) 把仓库放进 profile 的 local/
mkdir -p "$DSH_HOME/profiles/web/local"
ln -sfn "$PWD" "$DSH_HOME/profiles/web/local/dsh-video2text"

# 2) profile 的 package.json 里加依赖（指向 local 副本）
#    "dsh-video2text": "link:.../profiles/web/local/dsh-video2text"
# 3) 把 dsh-video2text 加进 "dsh".profile.bundles
# 4) 重启 dsh web
```

改完后：

- **client half**（`lib/client.js`）：刷新浏览器即可，不用重启（bundle 按文件内容实时生成）。
- **node half**（`lib/index.mjs`）：必须重启 `dsh web`。

隔离环境调试（不影响日常 GUI）：

```sh
DSH_HOME=/tmp/dsh-v2t-dev dsh web --port 3098 --no-open
```

## 内置 skill 是拷贝

`skills/video2text` 是 skill 源仓库的拷贝（源在 `../video2text`）。改完 skill 要同步：

```sh
rsync -a --delete --exclude .git ../video2text/ skills/video2text/
```

## 发版

```sh
# 1) 同步 skill、跑语法检查
rsync -a --delete --exclude .git ../video2text/ skills/video2text/
node --check lib/index.mjs && node --check lib/client.js

# 2) 改版本号后提交
git commit -am "release: vX.Y.Z"
git tag vX.Y.Z && git push origin main --tags

# 3) 建 release（演示素材挂在这里，仓库里只留内联 GIF）
gh release create vX.Y.Z --title "vX.Y.Z" --notes "…"
gh release upload vX.Y.Z docs/demo.gif --clobber
```

## 验证清单

| 检查 | 方法 |
|---|---|
| 语法 | `node --check lib/index.mjs lib/client.js` |
| 干净安装 | `DSH_HOME=/tmp/t dsh plugin --profile web add github:vlln/dsh-video2text` → 启动 → 面板出现 |
| 负控 | 临时改名 `lib/index.mjs` → 启动应报 `failed to import` + `1 entry did not activate` |
| 真实任务 | 贴一条短视频链接，确认 播放 / 逐字稿 / 导出 三步 |
| 素材 | `curl -sI raw.githubusercontent.com/vlln/dsh-video2text/main/docs/demo.gif` 应 200 |

## 已知的坑

- **client 崩溃会白屏**：任何 `ReferenceError` 都会让整个槽位消失。现在有 `PanelBoundary` 兜底，但仍然要在真实浏览器里点一遍各状态（done / running / auth / failed）。
- **窗口级 pointerdown 会抢先关菜单**：菜单项必须带 `data-v2t-menu`，监听器跳过它，否则 `click` 到不了按钮。
- **轮询要覆盖后处理**：对齐中的任务是 `done` 状态，只按 `running` 轮询会导致界面不刷新。
- **登录态与任务必须同一份缓存**：都走 `~/.cache/video2text`，否则「扫码后又要登录」。
- **导入的任务不能删磁盘**：`imported` 要进持久化白名单，删除与媒体清理都要跳过。
