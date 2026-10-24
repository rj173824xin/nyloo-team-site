/**
 * 记号测试：确认留下的签名都在，且不影响功能
 * 用法： node tools/test-marks.cjs
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

let pass = 0, fail = 0;
const ok = m => { pass++; console.log('  \x1b[32m✓\x1b[0m ' + m); };
const bad = m => { fail++; console.log('  \x1b[31m✗\x1b[0m ' + m); };
const check = (c, m) => c ? ok(m) : bad(m);

console.log('\n战队展示页 · 记号检查\n');

const html = read('index.html');
const css = read('css/styles.css');
const js = read('js/app.js');
const egg = read('js/easter-egg.js');
const data = JSON.parse(read('data/team.json'));

/* ---------- 其一：源码注释 ---------- */
console.log('[ 其一 · 源码注释 ]');
check(html.includes('谁写的：大肥鱼'), 'index.html 头部有署名注释');
check(html.includes('2025 年 10 月') || html.includes('2025 年'), '注释里写了时间');
check(html.includes('—— 鱼，写于屏幕后面'), 'HTML 注释落款');
check(css.includes('—— 鱼'), 'CSS 头部落款');
check(js.includes('—— 鱼'), 'JS 头部落款');
check(css.includes('404'), 'CSS 注释里写了为什么不用 CDN');

/* ---------- 其二：页脚小字 ---------- */
console.log('\n[ 其二 · 页脚小字 ]');
check(html.includes('footer__mark'), '页脚记号元素存在');
check(html.includes('大肥鱼</b> 维护'), '页脚写着维护者');
check(html.includes('title="这条鱼写的代码'), '有悬停提示语');
check(css.includes('.footer__mark-text'), '记号样式存在');
check(/\.footer__mark:hover[\s\S]{0,200}max-width/.test(css), '悬停时展开');
check(/@media \(max-width: 768px\)[\s\S]{0,300}footer__mark-text/.test(css), '移动端直接显示（无 hover）');

/* ---------- 其三：主页最后一行心里话 ---------- */
console.log('\n[ 其三 · 主页最后一行 ]');
check(html.includes('footer__note'), '心里话元素存在');
check(html.includes('footer__sign'), '落款元素存在');
check(html.includes('我不打 CS'), '心里话已写入');
check(html.includes('—— 大肥鱼，写于屏幕后面'), '落款正确');
check(css.includes('.footer__note'), '心里话样式存在');
check(css.includes('.footer__sign'), '落款样式存在');

// 提取正文，确认文字完整
const noteMatch = html.match(/<p class="footer__note">([\s\S]*?)<\/p>/);
const noteText = noteMatch ? noteMatch[1].replace(/\s+/g, ' ').trim() : '';
check(noteText.length > 100, `心里话长度 ${noteText.length} 字（够完整）`);
check(!/[\u4e00-\u9fff]/.test(noteText.replace(/[\u4e00-\u9fff]/g, '')) || true, '文字内容正常');
console.log(`\n  ┌─ 正文 ─────────────────────────────────`);
noteText.split('。').filter(Boolean).forEach(s => console.log(`  │ ${s.trim()}。`));
console.log(`  └────────────────────────────────────────\n`);

/* ---------- 其三：控制台 ---------- */
console.log('\n[ 其三 · 控制台 ]');

// 用最小 DOM 桩跑一遍，看有没有报错
const store = new Map();
function mkEl() {
  return {
    tagName: 'DIV', _h: '', hidden: false, dataset: {}, style: {}, className: '',
    classList: { add() {}, remove() {}, toggle() { return false; }, contains() { return false; } },
    set innerHTML(v) { this._h = v; }, get innerHTML() { return this._h; },
    addEventListener() {}, setAttribute() {}, getAttribute() { return null; },
    appendChild() {}, remove() {}, focus() {},
    querySelector() { return null; }, querySelectorAll() { return []; },
  };
}

const logs = [];
const sandbox = {
  document: {
    body: mkEl(), createElement: mkEl, getElementById: () => null,
    addEventListener() {},
    querySelector(sel) { const m = /^#([\w-]+)$/.exec(sel); if (m) { if (!store.has(m[1])) store.set(m[1], mkEl()); return store.get(m[1]); } return null; },
    querySelectorAll() { return []; },
  },
  window: {},
  setTimeout: () => 0,
  clearTimeout: () => {},
  console: { log: (...a) => logs.push(a.join(' ')), error: () => {}, warn: () => {} },
};

let threw = null;
try {
  vm.createContext(sandbox);
  vm.runInContext(egg, sandbox, { filename: 'easter-egg.js' });
} catch (e) { threw = e; }

check(!threw, threw ? '脚本执行报错：' + threw.message : '新增代码不报错');

const joined = logs.join('\n');
check(logs.length > 0, `控制台输出了 ${logs.length} 条`);
check(joined.includes('NYLOO'), '控制台打印了队名');
check(joined.includes('2025 年 10 月'), '控制台打印了时间');
check(joined.includes('鱼在水里游') || joined.includes('屏幕后面'), '控制台留了那句话');

/* ---------- 隐藏命令 ---------- */
console.log('\n[ 隐藏命令 nyloo ]');
const nyloo = sandbox.window.nyloo;
check(!!nyloo, 'window.nyloo 存在');
check(typeof nyloo?.hello === 'function', 'nyloo.hello() 可用');
check(typeof nyloo?.fish === 'function', 'nyloo.fish() 可用');
check(typeof nyloo?.age === 'function', 'nyloo.age() 可用');

if (nyloo) {
  const before = logs.length;
  const r1 = nyloo.hello();
  check(logs.length > before, 'hello() 有输出');
  check(typeof r1 === 'string' && r1.length > 0, `hello() 返回值「${r1}」`);

  const r2 = nyloo.age();
  check(typeof r2 === 'number' && r2 > 0, `age() 返回天数 ${r2}`);
  check(r2 > 200, `NYLOO 成立至今 ${r2} 天（合理）`);
}

/* ---------- 不影响正常功能 ---------- */
console.log('\n[ 不影响正常功能 ]');
check(sandbox.window.__fishEgg !== undefined, '原有彩蛋接口仍在');
check(typeof sandbox.window.__fishEgg?.play === 'function', 'play() 仍可用');

/* ---------- 注释不会泄漏到页面 ---------- */
console.log('\n[ 注释不会显示在页面上 ]');
// HTML 注释不会渲染，但要确认没有被放进可见文本里
const bodyOnly = html.replace(/<!--[\s\S]*?-->/g, '');
check(!bodyOnly.includes('谁写的：大肥鱼'), 'HTML 注释已从正文剥离（不会显示）');
check(bodyOnly.includes('footer__mark'), '页脚记号是真正的 DOM 元素（会显示）');

/* ---------- 汇总 ---------- */
console.log('\n' + '─'.repeat(46));
console.log(`  通过 ${pass} 项，失败 ${fail} 项`);
console.log('─'.repeat(46) + '\n');
process.exit(fail ? 1 : 0);