#!/usr/bin/env python3
"""Open Tencent Yuanbao in Chrome, wait for QR login, resolve a sph link in-session.

Prints one JSON line: {"parse": {...}, "headers": {...}} on success.

The parse API is bound to the logged-in browser session and device fingerprints
(x-hy92/x-hy93/t-userid), so it is called from inside the page rather than replayed.
"""
from __future__ import annotations

import json
import os
import sys
import time
from pathlib import Path

SHARE = sys.argv[1] if len(sys.argv) > 1 else ""
TIMEOUT = int(sys.argv[2]) if len(sys.argv) > 2 else 900
PREFLIGHT = os.environ.get("WX_PREFLIGHT") == "1"
CACHE = Path(os.environ.get("VIDEO2TEXT_CACHE", Path.home() / ".cache/video2text"))
PROFILE = CACHE / "chrome-profile"

KEEP = ("x-hy92", "x-hy93", "x-device-id", "t-userid", "x-id", "x-commit-tag",
        "x-agentid", "x-instance-id", "x-webversion", "x-platform", "x-source", "x-language")

# 本机设备指纹（qimei），登录与否都成立；先垫上，页面请求抓到的会覆盖
DEFAULT_HEADERS = {
    "x-hy92": "d899e2a0c929e393038d983a0300000ab1aa14",
    "x-hy93": "1aa1317002110005c929e393038d983abc8c034e6e",
    "x-device-id": "1aa1317002110005c929e393038d983abc8c034e6e",
    "x-instance-id": "5",
    "x-commit-tag": "7a0c0e99",
    "x-webversion": "2.89.1",
    "x-platform": "mac",
    "x-source": "web",
}

JS = """
async ([url, hdrs]) => {
  const body = JSON.stringify({type: 'video_channel_url', url, scene: 1});
  const r = await fetch('/api/weixin/get_parse_result', {
    method: 'POST',
    headers: Object.assign({'content-type': 'application/json'}, hdrs),
    body
  });
  return {status: r.status, text: await r.text()};
}
"""


def find_parse(node):
    if isinstance(node, dict):
        if node.get("wx_export_id") and "playable_url" in node:
            return node
        for v in node.values():
            hit = find_parse(v)
            if hit:
                return hit
    elif isinstance(node, list):
        for v in node:
            hit = find_parse(v)
            if hit:
                return hit
    return None


def main() -> int:
    from playwright.sync_api import sync_playwright

    CACHE.mkdir(parents=True, exist_ok=True)
    proxy = os.environ.get("HTTPS_PROXY") or os.environ.get("HTTP_PROXY")
    opts = {"proxy": {"server": proxy}} if proxy else {}

    with sync_playwright() as p:
        ctx = p.chromium.launch_persistent_context(
            str(PROFILE), channel="chrome",
            headless=PREFLIGHT or os.environ.get("WX_SESSION_HEADLESS") == "1",
            chromium_sandbox=True,
            viewport={"width": 1180, "height": 860}, **opts)
        page = ctx.pages[0] if ctx.pages else ctx.new_page()
        page.goto("https://yuanbao.tencent.com/chat", wait_until="domcontentloaded", timeout=60000)

        headers: dict[str, str] = dict(DEFAULT_HEADERS)
        captured: list[str] = []

        def on_response(resp):
            try:
                if resp.request.method == "POST" and "yuanbao" in resp.url:
                    body = resp.text()
                    if "wx_export_id" in body:
                        captured.append(body)
            except Exception:
                pass

        page.on("response", on_response)

        def capture(req):
            if "x-hy92" in req.headers:
                headers.update({k: v for k, v in req.headers.items() if k in KEEP})

        page.on("request", capture)
        print("正在复用登录态解析；若未登录，请在窗口里扫码（手机上还要点确认）…",
              file=sys.stderr, flush=True)

        started = time.time()
        deadline = started + (min(TIMEOUT, 14) if PREFLIGHT else TIMEOUT)
        last: dict = {}
        attempts = 0
        ui_tried = False
        try:
          while time.time() < deadline:
            if captured:
                try:
                    data = json.loads(captured[-1])
                    # 聊天链路里 parse 结果可能嵌在 message 里，递归找 wx_export_id
                    node = find_parse(data)
                    if node:
                        print(json.dumps({"parse": node, "headers": headers}, ensure_ascii=False))
                        ctx.close()
                        return 0
                except Exception:
                    pass
            if not ui_tried and attempts >= 6:
                ui_tried = True
                try:
                    page.goto("https://yuanbao.tencent.com/", wait_until="domcontentloaded", timeout=45000)
                    page.wait_for_timeout(4000)
                    ed = page.locator('textarea, [contenteditable="true"]').first
                    ed.wait_for(state="visible", timeout=15000)
                    ed.click()
                    ed.type(SHARE, delay=20)
                    page.wait_for_timeout(500)
                    ed.press("Enter")
                except Exception:
                    pass
            attempts += 1
            if attempts % 2 == 0:
                state = last.get("status") or "?"
                note = "等待登录态" if state in ("401", "403", "?") else f"HTTP {state}"
                print(f"[session] {attempts} 次尝试 · {note} · {int(time.time() - started)}s",
                      file=sys.stderr, flush=True)
            if headers.get("x-hy92"):
                try:
                    res = page.evaluate(JS, [SHARE, headers])
                except Exception:
                    # 登录成功时页面会跳转，执行上下文被销毁 → 等它稳定后重试
                    try:
                        page.wait_for_timeout(2500)
                    except Exception:
                        raise RuntimeError("浏览器已关闭，无法继续校验")
                    continue
                last = res
                if res.get("status") == 200 and not SHARE:
                    # 只验证登录态：不带链接，200 就说明会话有效
                    print(json.dumps({"parse": {}, "headers": headers}, ensure_ascii=False))
                    ctx.close()
                    return 0
                if res.get("status") == 200:
                    try:
                        data = json.loads(res["text"])
                    except Exception:
                        data = {}
                    last["has_export"] = bool((data.get("data") or {}).get("wx_export_id"))
                    if (data.get("data") or {}).get("wx_export_id"):
                        print(json.dumps({"parse": data["data"], "headers": headers},
                                         ensure_ascii=False))
                        ctx.close()
                        return 0
            try:
                page.wait_for_timeout(2500)
            except Exception:
                raise RuntimeError("浏览器已关闭，无法继续校验")
        except RuntimeError as e:
            print(str(e), file=sys.stderr, flush=True)
            last = {"status": "closed"}
        finally:
            try:
                ctx.close()
            except Exception:
                pass

    if PREFLIGHT:
        if last.get("status") == 200:
            return 4 if not last.get("has_export") else 0
        if last.get("status") in (401, 403):
            return 3
        return 5
    if last.get("status") == 200:
        print("解析成功但响应里没有 wx_export_id：链接可能已过期，请重新分享获取新链接", file=sys.stderr)
    elif last.get("status") in (401, 403):
        print("元宝返回 401/403：未登录或登录态已失效，请重新扫码并在手机上确认", file=sys.stderr)
    else:
        print("登录/解析超时：未捕获到有效登录态（检查窗口是否被遮挡、是否完成手机确认）", file=sys.stderr)
    return 2


if __name__ == "__main__":
    sys.exit(main())
