/**
 * 生成字母占位头像（当队员还没提供真实照片时用）
 * 用法： node tools/gen-letter-avatar.cjs RJ "RJ-夕寸舟"
 */
const fs = require('fs');
const path = require('path');

const ASSETS = path.resolve(__dirname, '..', 'assets');

const id = process.argv[2] || 'RJ';
const label = process.argv[3] || id;

// 从名字取 1-2 个字符做标识
const initials = /^[A-Za-z]/.test(label)
  ? label.replace(/[^A-Za-z]/g, '').slice(0, 2).toUpperCase()
  : label.slice(0, 1);

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" width="96" height="96">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#00e5ff"/>
      <stop offset="100%" stop-color="#a855f7"/>
    </linearGradient>
    <clipPath id="c"><circle cx="48" cy="48" r="48"/></clipPath>
  </defs>
  <g clip-path="url(#c)">
    <rect width="96" height="96" fill="#12151f"/>
    <rect y="26" width="96" height="1.2" fill="#ffffff" opacity=".06"/>
    <rect y="46" width="96" height="1.2" fill="#ffffff" opacity=".08"/>
    <rect y="66" width="96" height="1.2" fill="#ffffff" opacity=".06"/>
    <circle cx="48" cy="48" r="46" fill="none" stroke="url(#g)" stroke-width="4"/>
    <text x="48" y="62" text-anchor="middle"
          font-family="Segoe UI, Arial, sans-serif" font-size="34" font-weight="700"
          fill="url(#g)">${initials}</text>
  </g>
</svg>
`;

const out = path.join(ASSETS, `avatar-${id.toLowerCase()}.svg`);
fs.writeFileSync(out, svg, 'utf8');
console.log(`已生成 ${out}  (标识: ${initials})`);