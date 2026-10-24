/**
 * 打包脚本：把站点整理成可直接丢到服务器的形式
 * 用法： node tools/package.cjs
 * 产出： dist/NYLOO-site/ 及其 zip
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const OUT = path.join(DIST, 'NYLOO-site');

// 要打进包的内容（白名单，避免把临时文件带进去）
const INCLUDE_FILES = [
  'index.html',
  'README.md',
  'DEPLOY.md',
  'serve.ps1',
  'serve.sh',
];
const INCLUDE_DIRS = ['css', 'js', 'data', 'assets', 'tools'];

// 明确排除
const EXCLUDE = [
  '.shots', '.edge-profile', 'dist', 'node_modules',
  'DESIGN.md',
];
const EXCLUDE_EXT = ['.pyc'];

function copyFile(src, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

function copyDir(src, dest, rel = '') {
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    const relPath = path.join(rel, entry.name);

    if (EXCLUDE.some(x => relPath.startsWith(x) || entry.name === x)) continue;
    if (EXCLUDE_EXT.includes(path.extname(entry.name))) continue;

    if (entry.isDirectory()) copyDir(s, d, relPath);
    else copyFile(s, d);
  }
}

/* ---------- 清理并重建 ---------- */
if (fs.existsSync(OUT)) fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

console.log('\n打包 NYLOO 战队展示页\n');

let count = 0;
for (const f of INCLUDE_FILES) {
  const src = path.join(ROOT, f);
  if (fs.existsSync(src)) {
    copyFile(src, path.join(OUT, f));
    console.log('  +', f);
    count++;
  }
}
for (const dir of INCLUDE_DIRS) {
  const src = path.join(ROOT, dir);
  if (!fs.existsSync(src)) continue;
  copyDir(src, path.join(OUT, dir));
  console.log('  +', dir + '/');
  count++;
}

/* ---------- 统计 ---------- */
function walk(dir) {
  let n = 0, bytes = 0;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { const r = walk(p); n += r.n; bytes += r.bytes; }
    else { n++; bytes += fs.statSync(p).size; }
  }
  return { n, bytes };
}

const stat = walk(OUT);
console.log(`\n  文件数 ${stat.n}，总大小 ${(stat.bytes / 1024).toFixed(1)} KB`);
console.log(`  输出目录 ${OUT}\n`);