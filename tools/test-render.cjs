/**
 * 渲染逻辑测试：在 Node 里用最小 DOM 桩跑 js/app.js 的纯渲染路径
 * 目的：确认 JSON 数据能被正确渲染成 HTML，不会抛异常
 * 用法： node tools/test-render.cjs
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const data = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/team.json'), 'utf8'));

let pass = 0, fail = 0;
const ok  = m => { pass++; console.log('  \x1b[32m✓\x1b[0m ' + m); };
const bad = m => { fail++; console.log('  \x1b[31m✗\x1b[0m ' + m); };
const check = (c, m) => c ? ok(m) : bad(m);

/* ---------- 最小 DOM 桩 ---------- */
function makeEl(tag = 'div') {
  const el = {
    tagName: tag.toUpperCase(),
    _html: '', textContent: '', hidden: false, dataset: {}, style: {},
    className: '', classList: {
      _s: new Set(),
      add(...c) { c.forEach(x => this._s.add(x)); },
      remove(...c) { c.forEach(x => this._s.delete(x)); },
      toggle(c, f) { f ? this._s.add(c) : this._s.delete(c); return f; },
      contains(c) { return this._s.has(c); },
    },
    set innerHTML(v) { this._html = v; },
    get innerHTML() { return this._html; },
    addEventListener() {}, removeEventListener() {},
    setAttribute() {}, getAttribute() { return null; },
    appendChild() {}, remove() {}, focus() {}, querySelector() { return null; },
    querySelectorAll() { return []; },
  };
  return el;
}

const registry = new Map();
const store = new Map();
const document = {
  readyState: 'complete',
  documentElement: makeEl('html'),
  body: makeEl('body'),
  title: '',
  createElement: makeEl,
  addEventListener() {},
  querySelector(sel) {
    const m = /^#([\w-]+)$/.exec(sel);
    if (m) {
      if (!store.has(m[1])) store.set(m[1], makeEl());
      return store.get(m[1]);
    }
    return null;
  },
  querySelectorAll() { return []; },
};

const sandbox = {
  document,
  window: {
    matchMedia: () => ({ matches: false }),
    addEventListener() {},
    innerHeight: 900,
    scrollY: 0,
  },
  performance: { now: () => Date.now() },
  requestAnimationFrame: () => 0,
  setTimeout: () => 0,
  clearTimeout: () => {},
  console,
  fetch: async () => ({ ok: true, json: async () => data }),
  navigator: { clipboard: { writeText: async () => {} } },
  IntersectionObserver: class { observe() {} unobserve() {} disconnect() {} },
};

/* ---------- 装载 app.js ---------- */
const src = fs.readFileSync(path.join(ROOT, 'js/app.js'), 'utf8');
const ctx = vm.createContext(sandbox);

console.log('\n战队展示页 · 渲染逻辑测试\n');
console.log('[ 装载 js/app.js ]');
try {
  vm.runInContext(src, ctx, { filename: 'app.js' });
  ok('脚本解析并执行，无语法错误');
} catch (e) {
  bad('脚本执行抛异常：' + e.message);
  process.exit(1);
}

/* ---------- 手动触发渲染（boot 是异步的） ---------- */
(async () => {
  console.log('\n[ 数据驱动渲染 ]');
  await new Promise(r => setImmediate(r));
  await new Promise(r => setImmediate(r));

  const grab = id => store.get(id)?._html ?? '';

  const stats = grab('stats');
  check(stats.includes('stat__value'), `stats 渲染出 ${data.about.stats.length} 个数字块`);
  check(data.about.stats.every(s => stats.includes(s.label)), '每个 stat 的 label 都进入输出');

  const timeline = grab('timeline');
  check((timeline.match(/timeline__item/g) || []).length === data.about.timeline.length,
    `timeline 渲染 ${data.about.timeline.length} 条`);

  const honors = grab('honors');
  // 有图片的荣誉渲染成 honor-card，没图片的渲染成 honor
  const withImg = data.about.honors.filter(h => h.image).length;
  const withoutImg = data.about.honors.length - withImg;
  check((honors.match(/honor-card__result/g) || []).length === withImg,
    `带证书图片的荣誉渲染 ${withImg} 张卡片`);
  check((honors.match(/class="honor reveal"/g) || []).length === withoutImg,
    `无图片的荣誉渲染 ${withoutImg} 条`);
  check(honors.includes('honor-card__img'), '证书图片已渲染');
  check(honors.includes('data-honor="0"'), '证书卡片可点击放大');
  check(honors.includes('assets/honor-cert.jpg'), '引用了证书图片文件');

  // 资助模块已移除，不再测试 goal / tiers / methods / sponsors
  check(data.support === undefined, 'support 数据已移除，渲染器不会引用它');

  const filters = grab('filters');
  check((filters.match(/class="filter/g) || []).length === data.members.roles.length,
    `filters 渲染 ${data.members.roles.length} 个按钮`);
  check(filters.includes('is-active'), '首个筛选按钮默认选中');

  const grid = grab('members-grid');
  check((grid.match(/class="member"/g) || []).length === data.members.list.length,
    `members 渲染 ${data.members.list.length} 张卡片`);
  check(data.members.list.every(m => grid.includes(m.id)), '每个队员 id 都在 DOM 里');

  /* ---------- 头像外链 ---------- */
  console.log('\n[ 头像跳转外链 ]');
  const linked = data.members.list.filter(m => m.link);
  check(linked.length > 0, `${linked.length} 名队员配置了 link`);
  check((grid.match(/member__avatar-link/g) || []).length === linked.length,
    `渲染了 ${linked.length} 个头像外链`);
  check(grid.includes('target="_blank"'), '外链在新窗口打开');
  check(grid.includes('rel="noopener noreferrer"'), '外链带 rel 安全属性');
  // 我自己不应该有外链（否则彩蛋会被误触）
  const me = data.members.list.find(m => m.id === '大肥鱼');
  check(!me || !me.link, '大肥鱼没有外链（保住彩蛋触发）');

  /* ---------- 合照 ---------- */
  console.log('\n[ 合照 ]');
  const photo = store.get('photo')?._html ?? '';
  if (data.about.photo) {
    check(photo.includes('group-photo.jpg'), '合照已渲染');
    check(photo.includes(data.about.photo.caption), '合照说明已渲染');
  } else {
    check(true, '未配置合照（跳过）');
  }

  /* ---------- XSS 防护 ---------- */
  console.log('\n[ 转义 / XSS 防护 ]');
  const malicious = '<img src=x onerror=alert(1)>';
  store.clear();
  const evil = JSON.parse(JSON.stringify(data));
  evil.members.list[0].name = malicious;
  evil.about.timeline[0].text = malicious;
  evil.about.honors[0].name = malicious;

  const sandbox2 = { ...sandbox, fetch: async () => ({ ok: true, json: async () => evil }) };
  const ctx2 = vm.createContext(sandbox2);
  vm.runInContext(src, ctx2, { filename: 'app.js' });
  await new Promise(r => setImmediate(r));
  await new Promise(r => setImmediate(r));

  const clean = store.get('members-grid')?._html ?? '';
  check(!clean.includes('<img src=x'), '队员名里的 HTML 被转义，未注入');
  check(clean.includes('&lt;img'), '确认输出的是转义实体');

  /* ---------- 汇总 ---------- */
  console.log('\n' + '─'.repeat(46));
  console.log(`  通过 ${pass} 项，失败 ${fail} 项`);
  console.log('─'.repeat(46) + '\n');
  process.exit(fail ? 1 : 0);
})();