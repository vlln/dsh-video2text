#!/usr/bin/env node
// Generate WeChat Channels keystream with Tencent's official WASM decoder.
// usage: node keystream.js <decode_key> <asset_dir> <out.bin>
const fs = require('fs');
const path = require('path');

const [, , dkey, assetDir, outPath] = process.argv;
if (!dkey || !assetDir || !outPath) {
  console.error('usage: keystream.js <decode_key> <asset_dir> <out.bin>');
  process.exit(2);
}

const jsPath = path.join(assetDir, 'wasm_video_decode.js');
const wasmPath = path.join(assetDir, 'wasm_video_decode.wasm');
if (!fs.existsSync(jsPath) || !fs.existsSync(wasmPath)) {
  console.error('missing wasm assets in ' + assetDir);
  process.exit(3);
}

globalThis.self = globalThis;
globalThis.location = { href: 'file://' + jsPath };
globalThis.importScripts = () => {};
globalThis.VTS_WASM_URL = 'file://' + wasmPath;
globalThis.fetch = async (u) =>
  new Response(fs.readFileSync(String(u).replace('file://', '')), {
    headers: { 'Content-Type': 'application/wasm' },
  });

globalThis.wasm_isaac_generate = (ptr, size) => {
  const stream = new Uint8Array(Module.HEAPU8.buffer, ptr, size).slice();
  stream.reverse(); // WeChat reverses the ISAAC-64 keystream
  globalThis.__keystream = stream;
};

var Module = { locateFile: (f) => path.join(assetDir, f) };
Module.onRuntimeInitialized = async () => {
  try {
    const dec = new Module.WxIsaac64(String(dkey));
    await dec.generate(131072);
    if (!globalThis.__keystream) throw new Error('wasm produced no keystream');
    fs.writeFileSync(outPath, Buffer.from(globalThis.__keystream));
    dec.delete();
    process.exit(0);
  } catch (e) {
    console.error(String(e && e.message ? e.message : e));
    process.exit(1);
  }
};

eval(fs.readFileSync(jsPath, 'utf8'));
