/**
 * 端到端验证：从真实服务拉数据 → 跑真实渲染逻辑 → 检查数字条 HTML
 * 用法： node tools/test-e2e.cjs
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const PORT = process.env.PORT || 8080;

let pass = 0, fail = 0;
const ok = m => { pass++; console.log('  \x1b[32m✓\x1b[0m ' + m); };
const bad = m => { fail++; console.log('  \x1b[31m✗\x1b[0m ' + m); };
const check = (c, m) => c ? ok(m) : bad(m);

function fetch(port, urlPath) {
  return new Promise((resolve, reject) => {
    http.get(`http://127.0.0.1:${port}${urlPath}`, res => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }));
    }).on('error', reject);
  });
}

/* DOM 桩 */
const store = new Map();
function mkEl() {
  return {
    tagName: 'DIV', _h: '', textContent: '', hidden: false, dataset: {}, style: {}, className: '',
    classList: { add() {}, remove() {}, toggle() { return false; }, contains() { return false; } },
    set innerHTML(v) { this._h = v; }, get innerHTML() { return this._h; },
    addEventListener() {}, setAttribute() {}, getAttribute() { return null; },
    appendChild() {}, remove() {}, focus() {},
    querySelector() { return null; }, querySelectorAll() { return []; },
  };
}

(async () => {
  console.log(`\n端到端验证（服务端口 ${PORT}）\n`);

  /* ---------- 1. 服务是否活着，缓存头对不对 ---------- */
  console.log('[ 服务与缓存头 ]');
  let page, dataRes;
  try {
    page = await fetch(PORT, '/');
    dataRes = await fetch(PORT, '/data/team.json');
  } catch (e) {
    bad('连不上服务：' + e.message);
    console.log('\n  请先启动服务： node serve.cjs\n');
    process.exit(1);
  }

  check(page.status === 200, `首页 HTTP ${page.status}`);
  check(dataRes.status === 200, `data/team.json HTTP ${dataRes.status}`);

  const cc = (dataRes.headers['cache-control'] || '').toLowerCase();
  check(/no-store|no-cache/.test(cc), `数据文件响应头防缓存：${cc || '(无)'}`);

  const ccHtml = (page.headers['cache-control'] || '').toLowerCase();
  check(/no-store|no-cache/.test(ccHtml), `HTML 响应头防缓存：${ccHtml || '(无)'}`);

  /* ---------- 2. 服务返回的数据 ---------- */
  console.log('\n[ 服务返回的数据 ]');
  const data = JSON.parse(dataRes.body);
  const stats = data.about.stats || [];
  const find = label => stats.find(s => s.label === label);

  check(stats.length >= 4, `数字条 ${stats.length} 项`);
  check(find('现役队员')?.value === 18, `现役队员 = ${find('现役队员')?.value}`);
  check(find('胜率')?.value === 78, `胜率 = ${find('胜率')?.value}%`);
  check(find('成立年份')?.value === 2025, `成立年份 = ${find('成立年份')?.value}`);
  check(!!data.about.statsNote, '有数字条说明文字');

  /* ---------- 3. 跑真实渲染逻辑 ---------- */
  console.log('\n[ 渲染结果 ]');
  const src = fs.readFileSync(path.join(ROOT, 'js/app.js'), 'utf8');
  const sandbox = {
    document: {
      readyState: 'complete', documentElement: mkEl(), body: mkEl(), title: '',
      createElement: mkEl, addEventListener() {},
      querySelector(sel) {
        const m = /^#([\w-]+)$/.exec(sel);
        if (m) { if (!store.has(m[1])) store.set(m[1], mkEl()); return store.get(m[1]); }
        return null;
      },
      querySelectorAll() { return []; },
    },
    window: { matchMedia: () => ({ matches: false }), addEventListener() {}, innerHeight: 900, scrollY: 0 },
    performance: { now: () => Date.now() },
    requestAnimationFrame: () => 0,
    setTimeout: () => 0,
    clearTimeout() {},
    console,
    fetch: async () => ({ ok: true, json: async () => data }),
    navigator: { clipboard: { writeText: async () => {} } },
    IntersectionObserver: class { observe() {} unobserve() {} disconnect() {} },
  };

  vm.createContext(sandbox);
  vm.runInContext(src, sandbox, { filename: 'app.js' });

  await new Promise(r => setImmediate(r));
  await new Promise(r => setImmediate(r));

  const html = store.get('stats')?._h || '';
  check(html.length > 0, '数字条已渲染');

  // 提取渲染出来的每个值
  const values = [...html.matchAll(/data-target="(\d+)" data-suffix="([^"]*)"/g)]
    .map(m => m[1] + m[2]);
  console.log('\n  页面上会显示这些数字：');
  values.forEach(v => console.log(`    ▸ ${v}`));

  check(values.includes('18人'), '渲染出「18人」');
  check(values.includes('78%'), '渲染出「78%」');
  check(values.includes('2025'), '渲染出「2025」');
  check(!values.includes('4人'), '没有残留旧的「4人」');
  check(!values.includes('0%'), '没有残留旧的「0%」');

  // 标签也要对
  const labels = [...html.matchAll(/stat__label">([^<]+)</g)].map(m => m[1]);
  check(labels.includes('胜率'), '有「胜率」标签');
  check(labels.includes('现役队员'), '有「现役队员」标签');

  /* ---------- 4. 汇总 ---------- */
  console.log('\n' + '─'.repeat(46));
  console.log(`  通过 ${pass} 项，失败 ${fail} 项`);
  console.log('─'.repeat(46) + '\n');
  process.exit(fail ? 1 : 0);
})();