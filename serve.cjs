/**
 * 本地开发服务：带防缓存头，改完刷新即可看到最新
 * 用法： node serve.cjs [端口]
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const PORT = Number(process.argv[2]) || 8080;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
};

let hits = 0;

const server = http.createServer((req, res) => {
  let rel = decodeURIComponent(req.url.split('?')[0]);
  if (rel === '/' || rel === '') rel = '/index.html';

  const file = path.join(ROOT, rel);

  // 防目录穿越
  if (!file.startsWith(ROOT)) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('403 Forbidden');
  }

  fs.readFile(file, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('404 Not Found: ' + rel);
    }
    hits++;
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
      // 开发用：彻底禁用缓存，改完刷新立刻生效
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
      'Pragma': 'no-cache',
      'Expires': '0',
    });
    res.end(data);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log('');
  console.log('  NYLOO 战队展示页 · 本地服务');
  console.log('  ────────────────────────────────────');
  console.log('    http://localhost:' + PORT);
  console.log('    目录  ' + ROOT);
  console.log('    缓存  已禁用（改完刷新即可）');
  console.log('  ────────────────────────────────────');
  console.log('  停止：Ctrl + C');
  console.log('');
});

// 每分钟报一次心跳，方便确认它还活着
setInterval(() => {
  console.log(`[${new Date().toLocaleTimeString('zh-CN')}] 运行中，累计响应 ${hits} 次`);
}, 60000);