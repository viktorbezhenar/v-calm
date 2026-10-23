#!/usr/bin/env node
/**
 * Zero-dependency dev server for app/. Applies the same headers as
 * production (parsed from app/_headers), so CSP problems show up locally.
 *
 *   npm run dev            → http://localhost:5173
 *   PORT=8080 npm run dev
 */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const ROOT = new URL('../app/', import.meta.url).pathname;
const PORT = Number(process.env.PORT || 5173);

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webmanifest': 'application/manifest+json',
  '.txt': 'text/plain; charset=utf-8',
};

async function loadHeaders() {
  const text = await readFile(join(ROOT, '_headers'), 'utf8');
  const headers = {};
  let inGlobal = false;
  for (const line of text.split('\n')) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    if (!line.startsWith(' ')) {
      inGlobal = line.trim() === '/*';
      continue;
    }
    if (inGlobal) {
      const i = line.indexOf(':');
      const name = line.slice(0, i).trim();
      // HSTS and upgrade-insecure-requests make no sense on http://localhost.
      if (name === 'Strict-Transport-Security') continue;
      headers[name] = line
        .slice(i + 1)
        .trim()
        .replace('; upgrade-insecure-requests', '');
    }
  }
  return headers;
}

const headers = await loadHeaders();

createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  let path = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, '');
  if (path.endsWith('/')) path += 'index.html';
  const file = join(ROOT, path);
  try {
    if (!file.startsWith(ROOT) || path.includes('_headers')) throw new Error('forbidden');
    const info = await stat(file);
    if (!info.isFile()) throw new Error('not a file');
    res.writeHead(200, { ...headers, 'Content-Type': TYPES[extname(file)] || 'application/octet-stream' });
    res.end(await readFile(file));
  } catch {
    res.writeHead(404, { ...headers, 'Content-Type': 'text/plain' });
    res.end('Not found');
  }
}).listen(PORT, () => console.log(`V-Calm dev server → http://localhost:${PORT}`));
