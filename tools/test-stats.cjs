/**
 * 数字条终值测试：验证「页面上最终显示的文字」是真实值，不是 0
 * 用法： node tools/test-stats.cjs
 *
 * 为什么单独写这个：
 *   之前只测了渲染出的 HTML 属性（data-target="18"），
 *   但页面显示的文字是 JS 动画算出来的 —— 动画没跑完就停在 0。
 *   引擎测过了，仪表盘没测。这个脚本专门测仪表盘。
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const src = fs.readFileSync(path.join(ROOT, 'js/app.js'), 'utf8');
const data = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/team.json'), 'utf8'));

let pass = 0, fail = 0;
const ok = m => { pass++; console.log('  \x1b[32m✓\x1b[0m ' + m); };
const bad = m => { fail++; console.log('  \x1b[31m✗\x1b[0m ' + m); };
const check = (c, m) => c ? ok(m) : bad(m);

/* ---------- DOM 桩：支持 querySelectorAll ---------- */
function mkEl(cls = '') {
  const el = {
    tagName: 'DIV', _h: '', textContent: '', hidden: false,
    dataset: {}, style: {}, className: cls, children: [],
    _classes: new Set(cls ? cls.split(' ') : []),
    classList: {
      add(...c) { c.forEach(x => el._classes.add(x)); },
      remove(...c) { c.forEach(x => el._classes.delete(x)); },
      contains(c) { return el._classes.has(c); },
      toggle(c) { el._classes.has(c) ? el._classes.delete(c) : el._classes.add(c); return el._classes.has(c); },
    },
    set innerHTML(v) {
      this._h = v;
      // 粗解析：把 stat__value 元素建出来
      this.children = [];
      for (const m of v.matchAll(/<div class="stat__value"[^>]*data-target="(\d+)"[^>]*data-suffix="([^"]*)"[^>]*>([^<]*)</g)) {
        const child = mkEl('stat__value');
        child.dataset.target = m[1];
        child.dataset.suffix = m[2];
        child.textContent = m[3];
        this.children.push(child);
      }
    },
    get innerHTML() { return this._h; },
    addEventListener() {}, setAttribute() {}, getAttribute() { return null; },
    appendChild(c) { this.children.push(c); return c; }, remove() {}, focus() {},
    querySelector(sel) {
      if (sel === '.stat__value') return this.children.find(c => c._classes.has('stat__value')) || null;
      return null;
    },
    querySelectorAll(sel) {
      if (sel === '.stat__value') return this.children.filter(c => c._classes.has('stat__value'));
      return [];
    },
    getBoundingClientRect() { return { top: 100, bottom: 200, left: 0, right: 100, width: 100, height: 100 }; },
  };
  return el;
}

const store = new Map();
const allStats = [];

const document = {
  readyState: 'complete',
  documentElement: mkEl(), body: mkEl(), title: '',
  createElement: mkEl,
  addEventListener() {},
  querySelector(sel) {
    const m = /^#([\w-]+)$/.exec(sel);
    if (m) {
      if (!store.has(m[1])) {
        const el = mkEl();
        // 劫持 stats 容器的 innerHTML，收集 stat__value 元素
        Object.defineProperty(el, 'innerHTML', {
          set(v) {
            el._h = v;
            el.children = [];
            for (const mm of v.matchAll(/<div class="stat__value"[^>]*data-target="(\d+)"[^>]*data-suffix="([^"]*)"[^>]*>([^<]*)</g)) {
              const child = mkEl('stat__value');
              child.dataset.target = mm[1];
              child.dataset.suffix = mm[2];
              child.textContent = mm[3];
              el.children.push(child);
              allStats.push(child);
            }
          },
          get() { return el._h; },
        });
        store.set(m[1], el);
      }
      return store.get(m[1]);
    }
    return null;
  },
  querySelectorAll(sel) {
    if (sel === '.stat__value') return allStats;
    return [];
  },
};

/* ---------- 时钟控制：手动推进动画帧 ---------- */
let now = 0;
let rafQueue = [];
let timers = [];

const sandbox = {
  document,
  window: {
    matchMedia: () => ({ matches: false }),   // 允许动画
    addEventListener() {}, innerHeight: 900, scrollY: 0,
  },
  performance: { now: () => now },
  requestAnimationFrame: (fn) => { rafQueue.push(fn); return rafQueue.length; },
  setTimeout: (fn, ms) => { timers.push({ fn, at: now + (ms || 0) }); return timers.length; },
  clearTimeout: () => {},
  console,
  fetch: async () => ({ ok: true, json: async () => data }),
  navigator: { clipboard: { writeText: async () => {} } },
  IntersectionObserver: class {
    constructor(cb) { this.cb = cb; }
    observe() { /* 故意不触发：模拟「元素在视口但观察器没回调」的故障 */ }
    unobserve() {} disconnect() {}
  },
};

console.log('\n数字条终值测试\n');

vm.createContext(sandbox);
vm.runInContext(src, sandbox, { filename: 'app.js' });

(async () => {
  await new Promise(r => setImmediate(r));
  await new Promise(r => setImmediate(r));

  console.log('[ 渲染初始值 ]');
  const expected = (data.about.stats || []).map(s => (Number(s.value) || 0) + (s.suffix || ''));
  check(allStats.length === expected.length, `渲染出 ${allStats.length} 个数字`);
  expected.forEach((v, i) => {
    const actual = allStats[i]?.textContent;
    check(actual === v, `第 ${i + 1} 个初始值 = "${actual}"（期望 "${v}"）`);
  });

  const zeros = allStats.filter(n => /^0/.test(n.textContent || ''));
  check(zeros.length === 0, `初始值里没有 0 开头的（发现 ${zeros.length} 个）`);

  /* ---------- 模拟：IntersectionObserver 一直不触发 ---------- */
  console.log('\n[ 故障场景：动画从未被触发 ]');
  console.log('  （模拟用户直接跳锚点、观察器失灵）');
  // 推进 4 秒，让保底 setTimeout 到期
  now += 4000;
  const due = timers.filter(t => t.at <= now);
  due.forEach(t => t.fn());

  console.log('\n  页面最终显示：');
  allStats.forEach((n, i) => {
    const label = (data.about.stats || [])[i]?.label || '?';
    console.log(`    ▸ ${n.textContent.padEnd(8)} ${label}`);
  });

  expected.forEach((v, i) => {
    check(allStats[i]?.textContent === v, `第 ${i + 1} 个最终值 = "${allStats[i]?.textContent}"（期望 "${v}"）`);
  });

  const stillZero = allStats.filter(n => n.textContent === '0' || n.textContent === '0%' || n.textContent === '0人' || n.textContent === '0项');
  check(stillZero.length === 0, `没有任何数字停在 0（发现 ${stillZero.length} 个）`);

  /* ---------- 具体断言 ---------- */
  console.log('\n[ 具体数值 ]');
  const vals = allStats.map(n => n.textContent);
  check(vals.includes('18人'), '含「18人」');
  check(vals.includes('78%'), '含「78%」');
  check(vals.includes('2025'), '含「2025」');

  console.log('\n' + '─'.repeat(46));
  console.log(`  通过 ${pass} 项，失败 ${fail} 项`);
  console.log('─'.repeat(46) + '\n');
  process.exit(fail ? 1 : 0);
})();