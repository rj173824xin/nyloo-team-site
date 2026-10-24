/**
 * 从桌面「战队信息」导入头像和资料
 * 用法： node tools/import-members.cjs
 *
 * - 复制每个队员的头像到 assets/，自动裁剪成正方形并压缩
 * - 生成 assets/avatar-<id>.jpg
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const SRC = 'C:\\Users\\Admin1\\Desktop\\战队信息';
const ASSETS = path.join(ROOT, 'assets');

const PY = 'D:\\DSH插件\\dsh-home\\dsh-runtimes\\dsh-primary-runtime\\dependencies\\python\\python.exe';

// 文件夹 → 输出文件名
const MAP = [
  { dir: 'N1na',        out: 'avatar-n1na' },
  { dir: 'Nyloo_肘可',  out: 'avatar-zhouke' },
  { dir: 'X1aofeng',    out: 'avatar-x1aofeng' },
  { dir: '廾匸',        out: 'avatar-gongxi' },
];

console.log('\n导入队员头像\n');

for (const { dir, out } of MAP) {
  const d = path.join(SRC, dir);
  if (!fs.existsSync(d)) { console.log(`  跳过（不存在）：${dir}`); continue; }

  const img = fs.readdirSync(d).find(f => /\.(png|jpe?g|webp)$/i.test(f));
  if (!img) { console.log(`  跳过（无图片）：${dir}`); continue; }

  const srcPath = path.join(d, img);
  const sizeMB = (fs.statSync(srcPath).size / 1024 / 1024).toFixed(2);
  const destPath = path.join(ASSETS, out + '.jpg');

  // 用 Python 裁剪成正方形 + 压缩
  const script = `
import sys
sys.stdout.reconfigure(encoding='utf-8', errors='replace')
from PIL import Image, ImageOps
im = Image.open(r"${srcPath}")
im = ImageOps.exif_transpose(im)          # 修正手机照片方向
im = im.convert("RGB")
w, h = im.size
side = min(w, h)
# 居中裁剪成正方形
left = (w - side) // 2
top = (h - side) // 2
im = im.crop((left, top, left + side, top + side))
im = im.resize((400, 400), Image.LANCZOS)
im.save(r"${destPath}", "JPEG", quality=88, optimize=True)
print(f"  {w}x{h} -> 400x400  {im.size}")
`;
  try {
    execFileSync(PY, ['-c', script], { stdio: 'inherit' });
    const outKB = (fs.statSync(destPath).size / 1024).toFixed(1);
    console.log(`  ✓ ${dir}  (${sizeMB} MB) -> ${out}.jpg  ${outKB} KB\n`);
  } catch (e) {
    console.log(`  ✗ ${dir} 处理失败: ${e.message}\n`);
  }
}

// 合照
const groupSrc = path.join(SRC, '合照', '284D3D39DEAD42B0708479FD67C6AF67.jpg');
if (fs.existsSync(groupSrc)) {
  const groupDest = path.join(ASSETS, 'group-photo.jpg');
  const script = `
import sys
sys.stdout.reconfigure(encoding='utf-8', errors='replace')
from PIL import Image, ImageOps
im = Image.open(r"${groupSrc}")
im = ImageOps.exif_transpose(im).convert("RGB")
w, h = im.size
# 保持宽高比，长边压到 1600
scale = 1600 / max(w, h)
if scale < 1:
    im = im.resize((int(w * scale), int(h * scale)), Image.LANCZOS)
im.save(r"${groupDest}", "JPEG", quality=86, optimize=True)
print(f"  合照 {w}x{h} -> {im.size}")
`;
  try {
    execFileSync(PY, ['-c', script], { stdio: 'inherit' });
    console.log(`  ✓ 合照 -> group-photo.jpg  ${(fs.statSync(groupDest).size / 1024).toFixed(1)} KB\n`);
  } catch (e) { console.log('  ✗ 合照处理失败:', e.message); }
}

// 荣誉证书
const honorSrc = path.join(SRC, '荣誉', 'DE450F0DBFD18B3406BC31068037F010.jpg');
if (fs.existsSync(honorSrc)) {
  const honorDest = path.join(ASSETS, 'honor-cert.jpg');
  const script = `
import sys
sys.stdout.reconfigure(encoding='utf-8', errors='replace')
from PIL import Image, ImageOps
im = Image.open(r"${honorSrc}")
im = ImageOps.exif_transpose(im).convert("RGB")
w, h = im.size
scale = 1400 / max(w, h)
if scale < 1:
    im = im.resize((int(w * scale), int(h * scale)), Image.LANCZOS)
im.save(r"${honorDest}", "JPEG", quality=86, optimize=True)
print(f"  荣誉证书 {w}x{h} -> {im.size}")
`;
  try {
    execFileSync(PY, ['-c', script], { stdio: 'inherit' });
    console.log(`  ✓ 荣誉证书 -> honor-cert.jpg  ${(fs.statSync(honorDest).size / 1024).toFixed(1)} KB\n`);
  } catch (e) { console.log('  ✗ 荣誉证书处理失败:', e.message); }
}

console.log('导入完成\n');