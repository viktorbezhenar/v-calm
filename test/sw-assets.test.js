import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const APP = new URL('../app/', import.meta.url).pathname;
// Served but deliberately not precached.
const NOT_PRECACHED = new Set(['/index.html', '/sw.js', '/_headers', '/robots.txt']);

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

const sw = readFileSync(join(APP, 'sw.js'), 'utf8');
const assets = JSON.parse(
  sw
    .match(/const ASSETS = (\[[\s\S]*?\]);/)[1]
    .replace(/'/g, '"')
    .replace(/,\s*\]/, ']'),
);

test('service worker precaches every app file (offline must be complete)', () => {
  const files = walk(APP)
    .map((p) => '/' + relative(APP, p).split(sep).join('/'))
    .filter((p) => !NOT_PRECACHED.has(p));
  const missing = files.filter((f) => !assets.includes(f));
  assert.deepEqual(missing, [], `Add to ASSETS in app/sw.js: ${missing.join(', ')}`);
});

test('service worker does not reference files that do not exist', () => {
  const files = new Set(walk(APP).map((p) => '/' + relative(APP, p).split(sep).join('/')));
  const ghosts = assets.filter((a) => a !== '/' && !files.has(a));
  assert.deepEqual(ghosts, []);
});

test('versions agree: sw.js, main.js and package.json', () => {
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  const swVersion = sw.match(/const VERSION = '([^']+)'/)[1];
  const mainVersion = readFileSync(join(APP, 'js/main.js'), 'utf8').match(/export const VERSION = '([^']+)'/)[1];
  assert.equal(swVersion, pkg.version);
  assert.equal(mainVersion, pkg.version);
});
