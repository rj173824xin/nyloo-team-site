/**
 * 静态自检：不依赖浏览器，验证数据契约与页面引用是否自洽
 * 用法： node tools/check.cjs
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const exists = p => fs.existsSync(path.join(ROOT, p));

let pass = 0, fail = 0;
const ok   = (m) => { pass++; console.log('  \x1b[32m✓\x1b[0m ' + m); };
const bad  = (m) => { fail++; console.log('  \x1b[31m✗\x1b[0m ' + m); };
const check = (cond, m) => cond ? ok(m) : bad(m);

console.log('\n战队展示页 · 静态自检\n');

/* ---------- 1. 数据契约 ---------- */
const data = JSON.parse(read('data/team.json'));
console.log('[ 数据 data/team.json ]');

check(!!data.site && typeof data.site.nameCn === 'string', 'site.nameCn 存在');
check(!!data.site.slogan, 'site.slogan 存在');
check(Array.isArray(data.about?.stats) && data.about.stats.length > 0, `about.stats（${data.about?.stats?.length} 条）`);
// statsNote 可选：有值时页面会显示在数字条下方
if (data.about?.statsNote !== undefined) {
  check(typeof data.about.statsNote === 'string', 'about.statsNote 是字符串');
}
// 胜率若存在，应为 0-100
const wr = (data.about?.stats || []).find(s => s.label === '胜率');
if (wr) check(wr.value >= 0 && wr.value <= 100, `胜率 ${wr.value}% 在合理范围`);
check(Array.isArray(data.about?.timeline) && data.about.timeline.length > 0, `about.timeline（${data.about?.timeline?.length} 条）`);
check(Array.isArray(data.about?.honors), `about.honors（${data.about?.honors?.length} 条）`);
// 资助模块（support）已按需求移除；若日后加回，把下面这段恢复即可
check(data.support === undefined, 'support 模块已移除（如需要请重新加回）');
check(Array.isArray(data.members?.list) && data.members.list.length > 0, `members.list（${data.members?.list?.length} 人）`);

/* ---------- 2. 队员字段完整性 ---------- */
console.log('\n[ 队员字段 ]');
const REQ = ['id', 'name', 'role', 'avatar', 'bio'];
let memberIssues = 0;
for (const m of data.members.list) {
  for (const k of REQ) {
    if (m[k] === undefined || m[k] === null || m[k] === '') {
      bad(`队员 ${m.id || '?'} 缺字段：${k}`);
      memberIssues++;
    }
  }
  // main（擅长）允许为空：阵容未填满时不强求
  if (m.main !== undefined && !Array.isArray(m.main)) {
    bad(`队员 ${m.id} 的 main 不是数组`);
    memberIssues++;
  }
}
if (!memberIssues) ok(`全部 ${data.members.list.length} 名队员必填字段齐全`);

const ids = data.members.list.map(m => m.id);
check(new Set(ids).size === ids.length, '队员 id 无重复');

// 队员 role 必须在筛选表里
const roles = data.members.roles || [];
const unlisted = [...new Set(data.members.list.map(m => m.role))].filter(r => !roles.includes(r));
check(unlisted.length === 0, `所有 role 都在筛选表内${unlisted.length ? '（遗漏：' + unlisted.join('、') + '）' : ''}`);

// 筛选表里有、但暂时没有人的位置：只提示，不算失败（阵容未填满时正常）
const empty = roles.slice(1).filter(r => !data.members.list.some(m => m.role === r));
if (empty.length) console.log(`  \x1b[33m!\x1b[0m 提示：这些位置暂时没人 → ${empty.join('、')}`);

/* ---------- 3. 资源引用 ---------- */
console.log('\n[ 资源引用 ]');
const refs = new Set();
const collect = (v) => {
  if (typeof v === 'string' && /\.(svg|png|jpe?g|webp|gif|ico)$/i.test(v)) refs.add(v);
  else if (Array.isArray(v)) v.forEach(collect);
  else if (v && typeof v === 'object') Object.values(v).forEach(collect);
};
collect(data);

let missing = 0;
for (const r of refs) {
  if (exists(r)) ok(`存在 ${r}`);
  else { bad(`缺失 ${r}`); missing++; }
}

/* ---------- 4. HTML ↔ CSS/JS 选择器对齐 ---------- */
console.log('\n[ 页面装配 ]');
const html = read('index.html');
const css  = read('css/styles.css');
const js   = read('js/app.js');

// JS 里 $('#id') 引用的 id。
// 注意：renderGoal 等函数是先写 innerHTML 再取 id，属于运行期生成，不算缺失。
const RUNTIME_IDS = new Set(['goalFill']);
const jsIds = [...js.matchAll(/\$\('#([\w-]+)'\)/g)]
  .map(m => m[1])
  .filter(id => !RUNTIME_IDS.has(id));
const htmlIds = [...html.matchAll(/\sid="([\w-]+)"/g)].map(m => m[1]);
const missingIds = [...new Set(jsIds)].filter(id => !htmlIds.includes(id));
check(missingIds.length === 0,
  `JS 引用的 ${new Set(jsIds).size} 个静态 id 在 HTML 中都有${missingIds.length ? '（缺失：' + missingIds.join(', ') + '）' : ''}`);

// JS 生成的 class，CSS 里应有定义。
// 同一行可能同时存在三元表达式里的多个 class，需要连带扫描条件分支。
const jsClasses = [...js.matchAll(/class="([^"]+)"/g)]
  .flatMap(m => m[1].split(/\s+/))
  // 剔除模板插值、三元分支（'a' : 'b'）、以及纯符号/数字残留
  .filter(c => c && !c.includes('${') && !/^['":]/.test(c) && !/^[0-9]+$/.test(c)
               && /^[a-z][\w-]*$/i.test(c))
  .filter(c => c !== 'reveal');
const cssHas = c => new RegExp('\\.' + c.replace(/-/g, '\\-') + '[\\s,{:.]').test(css);
const unstyled = [...new Set(jsClasses)].filter(c => !cssHas(c));
check(unstyled.length === 0,
  `JS 生成的 ${new Set(jsClasses).size} 个 class 在 CSS 中都有样式${unstyled.length ? '（未定义：' + unstyled.join(', ') + '）' : ''}`);

// HTML 引用的 css/js 文件确实存在
const linkHref = [...html.matchAll(/<link[^>]+href="([^"]+)"/g)].map(m => m[1]).filter(h => !h.startsWith('http'));
const scriptSrc = [...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map(m => m[1]);
for (const f of [...linkHref, ...scriptSrc]) {
  check(exists(f), `引用文件存在 ${f}`);
}

/* ---------- 5. 无外链（保证离线/内网可用） ---------- */
console.log('\n[ 离线可用性 ]');
// 只看真正的资源引用（src/href），不看正文里作为说明文字出现的 URL
const refUrls = [...(html + css + js).matchAll(/(?:src|href)\s*=\s*["']([^"']+)["']/g)]
  .map(m => m[1]);
const cssUrls = [...css.matchAll(/url\(([^)]+)\)/g)].map(m => m[1].replace(/["']/g, '').trim());
const external = [...refUrls, ...cssUrls]
  .filter(u => /^https?:\/\//i.test(u))
  .filter(u => !u.includes('www.w3.org'));
check(external.length === 0,
  `无外部 CDN 依赖${external.length ? '（发现：' + [...new Set(external)].join(', ') + '）' : ''}`);

/* ---------- 汇总 ---------- */
console.log('\n' + '─'.repeat(46));
console.log(`  通过 ${pass} 项，失败 ${fail} 项`);
console.log('─'.repeat(46) + '\n');
process.exit(fail ? 1 : 0);