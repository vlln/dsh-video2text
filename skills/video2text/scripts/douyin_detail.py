#!/usr/bin/env python3
"""Fetch one Douyin work via DouK-Downloader (https://github.com/JoeanAmier/TikTokDownloader).

Run inside the DouK project environment:
    uv run --project <DOUK_PATH> python douyin_detail.py <aweme_id> <DOUK_PATH> <cookie>

Prints the aweme_detail JSON on success. The signature (a_bogus) and identity
(uifid/msToken) are handled by DouK; we only orchestrate.
"""
from __future__ import annotations

import asyncio
import json
import sys


def main() -> int:
    if len(sys.argv) < 4:
        print("usage: douyin_detail.py <aweme_id> <douk_path> <cookie>", file=sys.stderr)
        return 2
    aweme_id, douk_path, cookie = sys.argv[1], sys.argv[2], sys.argv[3]
    sys.path.insert(0, douk_path)

    from src.interface.detail import Detail
    from src.testers import Params

    ck = {}
    for part in cookie.split("; "):
        if "=" in part:
            k, v = part.split("=", 1)
            ck[k] = v

    async def run() -> dict | None:
        params = Params()
        detail = Detail(params, cookie=cookie, detail_id=aweme_id)
        detail.params = {
            **Detail.params,
            "uifid": ck.get("UIFID") or ck.get("UIFID_TEMP", ""),
            "msToken": ck.get("msToken", ""),
        }
        data = await detail.run()
        if not data:
            return None
        return data[0] if isinstance(data, list) else data

    item = asyncio.run(run())
    if not item:
        print("no data", file=sys.stderr)
        return 1
    json.dump(item, sys.stdout, ensure_ascii=False)
    return 0


if __name__ == "__main__":
    sys.exit(main())
