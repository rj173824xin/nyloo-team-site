/**
 * 验证压缩包：解包到临时目录，起服务，逐个请求全部资源
 * 用法： node tools/verify-zip.cjs
 */
const fs = require('fs');
const path = require('path');
const http = require('http');
const os = require('os');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const ZIP = path.join(ROOT, 'dist', 'NYLOO-site.zip');
const TMP = path.join(os.tmpdir(), 'nyloo-verify-' + Date.now());

if (!fs.existsSync(ZIP)) {
  console.error('找不到压缩包:', ZIP);
  process.exit(1);
}

// 用 PowerShell 解包（Windows 内置）
console.log('解包中…');
execFileSync('powershell', [
  '-NoProfile', '-Command',
  `Expand-Archive -LiteralPath '${ZIP}' -DestinationPath '${TMP}' -Force`
], { stdio: 'inherit' });

const SITE = path.join(TMP, 'NYLOO-site');
if (!fs.existsSync(SITE)) {
  console.error('解包后找不到 NYLOO-site 目录');
  process.exit(1);
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
};

const server = http.createServer((req, res) => {
  let rel = decodeURIComponent(req.url.split('?')[0]);
  if (rel === '/' || rel === '') rel = '/index.html';
  const file = path.join(SITE, rel);
  if (!file.startsWith(SITE) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
    res.writeHead(404); return res.end('404');
  }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
  res.end(fs.readFileSync(file));
});

// 动态构造请求清单：静态入口 + 数据里引用的全部资源
const basePaths = ['/', '/index.html', '/css/styles.css', '/js/app.js',
                   '/js/easter-egg.js', '/data/team.json'];

const zipData = JSON.parse(fs.readFileSync(path.join(SITE, 'data/team.json'), 'utf8'));
const dynamic = new Set();
const collectDyn = v => {
  if (typeof v === 'string' && /\.(svg|png|jpe?g|webp|gif|ico)$/i.test(v)) dynamic.add('/' + v);
  else if (Array.isArray(v)) v.forEach(collectDyn);
  else if (v && typeof v === 'object') Object.values(v).forEach(collectDyn);
};
collectDyn(zipData);

// HTML / CSS 里引用的
const htmlDoc = fs.readFileSync(path.join(SITE, 'index.html'), 'utf8');
for (const m of htmlDoc.matchAll(/(?:src|href)="(assets\/[^"]+)"/g)) dynamic.add('/' + m[1]);
const cssDoc = fs.readFileSync(path.join(SITE, 'css/styles.css'), 'utf8');
for (const m of cssDoc.matchAll(/\.\.\/(assets\/[\w.\-]+)/g)) dynamic.add('/' + m[1]);

const PATHS = [...basePaths, ...dynamic];

let pass = 0, fail = 0;

server.listen(8123, '127.0.0.1', async () => {
  console.log(`\n模拟服务器端：解包目录起服务，逐项请求\n`);

  for (const p of PATHS) {
    await new Promise(resolve => {
      http.get(`http://127.0.0.1:8123${p}`, res => {
        let n = 0;
        res.on('data', c => n += c.length);
        res.on('end', () => {
          if (res.statusCode === 200) {
            console.log(`  \x1b[32m✓\x1b[0m ${p.padEnd(26)} ${res.statusCode}  ${n} bytes`);
            pass++;
          } else {
            console.log(`  \x1b[31m✗\x1b[0m ${p.padEnd(26)} ${res.statusCode}`);
            fail++;
          }
          resolve();
        });
      }).on('error', e => {
        console.log(`  \x1b[31m✗\x1b[0m ${p.padEnd(26)} ${e.message}`);
        fail++; resolve();
      });
    });
  }

  // 检查页面里还有没有引用已删除的文件
  const html = fs.readFileSync(path.join(SITE, 'index.html'), 'utf8');
  const css = fs.readFileSync(path.join(SITE, 'css/styles.css'), 'utf8');
  const data = JSON.parse(fs.readFileSync(path.join(SITE, 'data/team.json'), 'utf8'));
  const refs = new Set();
  for (const m of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
    if (!/^https?:|^#|^mailto:/.test(m[1])) refs.add(m[1]);
  }
  // CSS 里的 url() 相对 css/ 目录
  for (const m of css.matchAll(/url\(([^)]+)\)/g)) {
    const u = m[1].replace(/["']/g, '').trim();
    if (/^https?:|^data:/.test(u)) continue;
    refs.add(u.startsWith('../') ? u.slice(3) : 'css/' + u.replace(/^\.\//, ''));
  }
  const collect = v => {
    if (typeof v === 'string' && /\.(svg|png|jpe?g|webp|gif|ico)$/i.test(v)) refs.add(v);
    else if (Array.isArray(v)) v.forEach(collect);
    else if (v && typeof v === 'object') Object.values(v).forEach(collect);
  };
  collect(data);

  console.log('\n文件引用完整性：');
  for (const r of [...refs].sort()) {
    if (fs.existsSync(path.join(SITE, r))) { console.log(`  \x1b[32m✓\x1b[0m ${r}`); pass++; }
    else { console.log(`  \x1b[31m✗ 缺失 ${r}\x1b[0m`); fail++; }
  }

  // 页面关键内容检查
  console.log('\n内容检查：');
  const checks = [
    [html.includes('NYLOO') || data.site.nameCn === 'NYLOO', '队名为 NYLOO'],
    [!html.includes('资助'), '无「资助」残留'],
    [data.members.list.length >= 4, `队员 ${data.members.list.length} 人`],
    [data.members.list.some(m => m.name === '大肥鱼'), '大肥鱼在名单里'],
    [data.site.founded === '2025-01-17', '成立日期 2025-01-17'],
  ];
  for (const [ok, label] of checks) {
    console.log(ok ? `  \x1b[32m✓\x1b[0m ${label}` : `  \x1b[31m✗\x1b[0m ${label}`);
    ok ? pass++ : fail++;
  }

  server.close();
  fs.rmSync(TMP, { recursive: true, force: true });

  console.log('\n' + '─'.repeat(46));
  console.log(`  通过 ${pass} 项，失败 ${fail} 项`);
  console.log('─'.repeat(46) + '\n');
  process.exit(fail ? 1 : 0);
});