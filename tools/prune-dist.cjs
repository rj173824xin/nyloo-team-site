const fs = require('fs');
const path = require('path');

const DIR = path.resolve(__dirname, '..', 'dist', 'NYLOO-site');

/* ---------- 先算出「真正被引用」的资源 ---------- */
const htmlSrc = fs.readFileSync(path.join(DIR, 'index.html'), 'utf8');
const cssSrc = fs.readFileSync(path.join(DIR, 'css/styles.css'), 'utf8');
const jsFiles = fs.readdirSync(path.join(DIR, 'js')).filter(f => f.endsWith('.js'));
const jsSrc = jsFiles.map(f => fs.readFileSync(path.join(DIR, 'js', f), 'utf8')).join('\n');
const dataSrc = fs.readFileSync(path.join(DIR, 'data/team.json'), 'utf8');

const keep = new Set();

/** 从一段文本里收集 assets/ 下的引用 */
function collectAssets(text) {
  for (const m of text.matchAll(/assets\/[\w.\-]+\.(svg|png|jpe?g|webp|gif|ico)/gi)) {
    keep.add(m[0]);
  }
  // CSS 里的 ../assets/x.svg
  for (const m of text.matchAll(/\.\.\/assets\/([\w.\-]+\.(svg|png|jpe?g|webp|gif|ico))/gi)) {
    keep.add('assets/' + m[1]);
  }
}

collectAssets(htmlSrc);
collectAssets(cssSrc);
collectAssets(jsSrc);
collectAssets(dataSrc);

/* ---------- 删除未被任何地方引用的文件 ---------- */
let removed = 0;
for (const entry of fs.readdirSync(path.join(DIR, 'assets'))) {
  const rel = 'assets/' + entry;
  if (!keep.has(rel)) {
    fs.unlinkSync(path.join(DIR, 'assets', entry));
    console.log('  - 删除未引用', rel);
    removed++;
  }
}
console.log(`\n清理 ${removed} 个未引用文件`);

// 校验：页面实际引用的资源是否都在包里
const html = fs.readFileSync(path.join(DIR, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(DIR, 'css/styles.css'), 'utf8');
const data = JSON.parse(fs.readFileSync(path.join(DIR, 'data/team.json'), 'utf8'));

const refs = new Set();
for (const m of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
  if (!/^https?:|^#|^mailto:/.test(m[1])) refs.add(m[1]);
}
for (const m of css.matchAll(/url\(([^)]+)\)/g)) {
  const u = m[1].replace(/["']/g, '').trim();
  if (/^https?:|^data:/.test(u)) continue;
  // CSS 里的相对路径是相对 css/ 目录的，如 ../assets/x.svg
  refs.add(u.startsWith('../') ? u.slice(3) : 'css/' + u.replace(/^\.\//, ''));
}
const collect = v => {
  if (typeof v === 'string' && /\.(svg|png|jpe?g|webp|gif|ico)$/i.test(v)) refs.add(v);
  else if (Array.isArray(v)) v.forEach(collect);
  else if (v && typeof v === 'object') Object.values(v).forEach(collect);
};
collect(data);

let missing = 0;
console.log('\n引用完整性检查：');
for (const r of [...refs].sort()) {
  const p = path.join(DIR, r);
  if (fs.existsSync(p)) console.log('  ✓', r);
  else { console.log('  ✗ 缺失', r); missing++; }
}
console.log(`\n${missing ? '有 ' + missing + ' 个缺失' : '全部引用完好，包可直接部署'}`);