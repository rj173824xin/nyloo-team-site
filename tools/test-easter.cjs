/**
 * 彩蛋测试：验证触发逻辑
 * 用法： node tools/test-easter.cjs
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const src = fs.readFileSync(path.join(ROOT, 'js/easter-egg.js'), 'utf8');
const css = fs.readFileSync(path.join(ROOT, 'css/styles.css'), 'utf8');

let pass = 0, fail = 0;
const ok = m => { pass++; console.log('  \x1b[32m✓\x1b[0m ' + m); };
const bad = m => { fail++; console.log('  \x1b[31m✗\x1b[0m ' + m); };
const check = (c, m) => c ? ok(m) : bad(m);

/* ---------- DOM 桩 ---------- */
const added = [];
function mkEl(tag = 'div') {
  const el = {
    tagName: tag.toUpperCase(), className: '', textContent: '', innerHTML: '',
    style: {}, dataset: {}, children: [],
    classList: {
      _s: new Set(),
      add(...c) { c.forEach(x => this._s.add(x)); },
      remove(...c) { c.forEach(x => this._s.delete(x)); },
      contains(c) { return this._s.has(c); },
    },
    closest() { return null; },
    remove() {
      const i = added.indexOf(this);
      if (i >= 0) added.splice(i, 1);
    },
    appendChild(c) { this.children.push(c); added.push(c); return c; },
    addEventListener() {}, setAttribute() {},
    isContentEditable: false,
  };
  return el;
}

const listeners = {};
const document = {
  body: mkEl('body'),
  createElement: mkEl,
  getElementById: () => null,
  addEventListener(type, fn) { (listeners[type] = listeners[type] || []).push(fn); },
};

const sandbox = {
  document,
  window: {},
  setTimeout: (fn, ms) => { return 0; },  // 不真跑延时，避免测试挂住
  clearTimeout: () => {},
  console,
};

console.log('\n战队展示页 · 彩蛋测试\n');

const ctx = vm.createContext(sandbox);
try {
  vm.runInContext(src, ctx, { filename: 'easter-egg.js' });
  ok('脚本解析并执行，无语法错误');
} catch (e) {
  bad('脚本执行抛异常：' + e.message);
  process.exit(1);
}

/* ---------- 接口 ---------- */
console.log('\n[ 对外接口 ]');
const api = sandbox.window.__fishEgg;
check(!!api, '暴露 window.__fishEgg');
check(typeof api.play === 'function', 'play() 可用');
check(Array.isArray(api.lines) && api.lines.length > 0, `台词 ${api.lines?.length} 条`);
check(JSON.stringify(api.konami) === JSON.stringify(
  ['ArrowUp','ArrowUp','ArrowDown','ArrowDown','ArrowLeft','ArrowRight','ArrowLeft','ArrowRight']),
  '科乐美秘技序列正确');

check(!api.isUnlocked(), '初始未解锁');

/* ---------- 手动播放 ---------- */
console.log('\n[ 播放 ]');
api.play();
check(api.isUnlocked(), '播放后标记为已解锁');
check(added.length > 0, `创建了 ${added.length} 个动画元素`);
check(added.some(e => e.className === 'easter-fish'), '创建了鱼元素');
check(added.some(e => e.className === 'easter-tip'), '创建了台词气泡');
check(added.filter(e => e.className === 'easter-splash').length === 10, '创建了 10 个水花');

const fishEl = added.find(e => e.className === 'easter-fish');
check(fishEl.innerHTML.includes('fish__bubble'), '鱼含气泡');

// 鱼身由 assets/egg-fish.svg 提供
const svgPath = path.join(ROOT, 'assets/egg-fish.svg');
check(fs.existsSync(svgPath), 'assets/egg-fish.svg 存在');
const svg = fs.existsSync(svgPath) ? fs.readFileSync(svgPath, 'utf8') : '';
check(svg.includes('<ellipse'), 'SVG 含鱼身椭圆');
check(svg.includes('<circle') && svg.includes('#fff'), 'SVG 含眼睛');
check(svg.includes('#e6e9f0'), 'SVG 含耳机梁');
check(svg.includes('url(#fcup)'), 'SVG 含耳罩渐变');
check(svg.includes('#f87171'), 'SVG 含腮红');
check(svg.includes('#00e5ff'), 'SVG 含气泡描边');
check(svg.includes('viewBox="0 0 140 90"'), 'SVG 尺寸与 CSS 一致（140x90）');

/* ---------- 防重复 ---------- */
console.log('\n[ 防重复播放 ]');
const countBefore = added.filter(e => e.className === 'easter-fish').length;
api.play();
api.play();
const countAfter = added.filter(e => e.className === 'easter-fish').length;
check(countAfter === countBefore, '播放中再次触发不会叠加（同时只有一条鱼）');

/* ---------- 科乐美秘技 ---------- */
console.log('\n[ 科乐美秘技 ]');
// 上一轮还处于 playing 状态，先造一个新的沙箱
function freshSandbox() {
  const sb = {
    document: {
      body: mkEl('body'), createElement: mkEl, getElementById: () => null,
      addEventListener(type, fn) { (sb._l = sb._l || {})[type] = (sb._l[type] || []).concat(fn); },
    },
    window: {},
    setTimeout: () => 0, clearTimeout: () => {}, console,
  };
  vm.createContext(sb);
  vm.runInContext(src, sb, { filename: 'easter-egg.js' });
  return sb;
}

const sb2 = freshSandbox();
const fire = (key, target = { tagName: 'BODY' }) => {
  (sb2._l.keydown || []).forEach(fn => fn({ key, target }));
};

// 错误序列不应触发
['ArrowUp','ArrowUp','ArrowUp','ArrowUp'].forEach(k => fire(k));
check(!sb2.window.__fishEgg.isUnlocked(), '错误序列不触发');

// 正确序列
['ArrowUp','ArrowUp','ArrowDown','ArrowDown','ArrowLeft','ArrowRight','ArrowLeft','ArrowRight']
  .forEach(k => fire(k));
check(sb2.window.__fishEgg.isUnlocked(), '↑↑↓↓←→←→ 触发彩蛋');

// 输入框里打字不触发
const sb3 = freshSandbox();
const fire3 = (key, target) => (sb3._l.keydown || []).forEach(fn => fn({ key, target }));
['ArrowUp','ArrowUp','ArrowDown','ArrowDown','ArrowLeft','ArrowRight','ArrowLeft','ArrowRight']
  .forEach(k => fire3(k, { tagName: 'INPUT' }));
check(!sb3.window.__fishEgg.isUnlocked(), '在输入框里敲不触发');

/* ---------- 连点触发 ---------- */
console.log('\n[ 连点大肥鱼卡片 ]');
const sb4 = freshSandbox();
const click4 = (id) => {
  const card = { dataset: { id }, closest: (sel) => sel === '.member' ? card : null };
  (sb4._l.click || []).forEach(fn => fn({ target: card }));
};

for (let i = 0; i < 4; i++) click4('大肥鱼');
check(!sb4.window.__fishEgg.isUnlocked(), '点 4 次不触发');

click4('大肥鱼');
check(sb4.window.__fishEgg.isUnlocked(), '点第 5 次触发');

// 点别人不算
const sb5 = freshSandbox();
const click5 = (id) => {
  const card = { dataset: { id }, closest: (sel) => sel === '.member' ? card : null };
  (sb5._l.click || []).forEach(fn => fn({ target: card }));
};
for (let i = 0; i < 8; i++) click5('qianyan');
check(!sb5.window.__fishEgg.isUnlocked(), '点别人的卡片不触发');

/* ---------- CSS 完整性 ---------- */
console.log('\n[ 样式完整性 ]');
const need = ['.easter-fish', '.fish__bubble', '.easter-tip', '.easter-splash'];
for (const sel of need) {
  check(css.includes(sel), `样式含 ${sel}`);
}
check(css.includes('@keyframes fishSwim'), '含游动动画');
check(css.includes('egg-fish.svg'), 'CSS 引用鱼 SVG');
check(css.includes('prefers-reduced-motion'), '尊重「减少动态效果」设置');

console.log('\n' + '─'.repeat(46));
console.log(`  通过 ${pass} 项，失败 ${fail} 项`);
console.log('─'.repeat(46) + '\n');
process.exit(fail ? 1 : 0);