/**
 * 弹层渲染验证：确认不重复显示信息
 * 用法： node tools/test-modal.cjs
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const data = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/team.json'), 'utf8'));
const src = fs.readFileSync(path.join(ROOT, 'js/app.js'), 'utf8');

let pass = 0, fail = 0;
const ok = m => { pass++; console.log('  \x1b[32m✓\x1b[0m ' + m); };
const bad = m => { fail++; console.log('  \x1b[31m✗\x1b[0m ' + m); };
const check = (c, m) => c ? ok(m) : bad(m);

function mkEl() {
  return {
    tagName: 'DIV', _h: '', hidden: false, dataset: {}, style: {},
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    set innerHTML(v) { this._h = v; },
    get innerHTML() { return this._h; },
    addEventListener() {}, setAttribute() {}, getAttribute() { return null; },
    appendChild() {}, remove() {}, focus() {},
    querySelector() { return null; }, querySelectorAll() { return []; },
  };
}

const store = new Map();
const document = {
  readyState: 'complete',
  documentElement: mkEl(), body: mkEl(), title: '',
  createElement: mkEl, addEventListener() {},
  querySelector(sel) {
    const m = /^#([\w-]+)$/.exec(sel);
    if (m) { if (!store.has(m[1])) store.set(m[1], mkEl()); return store.get(m[1]); }
    return null;
  },
  querySelectorAll() { return []; },
};

const sandbox = {
  document,
  window: { matchMedia: () => ({ matches: false }), addEventListener() {}, innerHeight: 900, scrollY: 0 },
  performance: { now: () => Date.now() },
  requestAnimationFrame: () => 0,
  setTimeout: (fn) => { try { fn(); } catch {} return 0; },
  clearTimeout() {},
  console,
  fetch: async () => ({ ok: true, json: async () => data }),
  navigator: { clipboard: { writeText: async () => {} } },
  IntersectionObserver: class { observe() {} unobserve() {} disconnect() {} },
};

console.log('\n战队展示页 · 弹层渲染验证\n');

const ctx = vm.createContext(sandbox);
vm.runInContext(src, ctx, { filename: 'app.js' });

setTimeout(() => {
  const openMember = vm.runInContext('openMember', ctx);

  for (const m of data.members.list) {
    store.delete('modalBody');
    openMember(m.id);
    const html = store.get('modalBody')?._h || '';

    console.log(`\n[ ${m.name} ]`);
    check(!!html, '弹层有内容');
    check(html.includes(m.name), '显示名字');
    check(html.includes(m.role), '显示位置');
    check(html.includes(m.bio.replace(/。$/, '')), '显示简介');
    check(!html.includes('段位'), '不再显示「段位」字样（rank 与 role 重复时）');
    // main 有没有内容，按数据决定该不该出现
    const hasMain = Array.isArray(m.main) && m.main.length > 0;
    check(html.includes('md__label">擅长') === hasMain,
      hasMain ? '有 main 时渲染「擅长」区块' : '空的 main 不渲染「擅长」区块');
    const hasStats = m.stats && Object.keys(m.stats).length > 0;
    check(html.includes('md__label">信息') === hasStats,
      hasStats ? '有 stats 时渲染「信息」区块' : '空的 stats 不渲染「信息」区块');
    // 有 link 时应出现外链按钮
    if (m.link) {
      check(html.includes('md__link') && html.includes(m.link), '有 link 时渲染跳转按钮');
    }
    check(html.includes('ID ' + m.id) || html.includes('ID ' + m.id.replace(/[<>&]/g, '')), '显示 ID');
  }

  /* ---------- 证书放大弹层 ---------- */
  console.log('\n[ 证书放大 ]');
  const openHonor = vm.runInContext('openHonor', ctx);
  const honors = (data.about && data.about.honors) || [];
  const withImg = honors.filter(h => h.image);

  for (let i = 0; i < honors.length; i++) {
    store.delete('modalBody');
    openHonor(i);
    const html = store.get('modalBody')?._h || '';
    const h = honors[i];

    if (h.image) {
      check(!!html, `荣誉 ${i} 弹层有内容`);
      check(html.includes('honor-full'), '渲染了大图元素');
      check(html.includes(h.image), '图片路径正确');
      check(html.includes(h.result), '显示称号');
      check(html.includes(h.year), '显示年份');
      if (h.note) check(html.includes(h.note.slice(0, 10)), '显示说明文字');
    }
  }
  check(withImg.length > 0, `共 ${withImg.length} 项荣誉带证书图片`);
  check(honors.length >= 1, `荣誉总数 ${honors.length} 项`);

  console.log('\n' + '─'.repeat(46));
  console.log(`  通过 ${pass} 项，失败 ${fail} 项`);
  console.log('─'.repeat(46) + '\n');
  process.exit(fail ? 1 : 0);
}, 50);