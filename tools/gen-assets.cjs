const fs = require('fs');
const path = require('path');

// 本脚本位于 tools/ 下，资源要写到上一级的 assets/
const ROOT = path.resolve(__dirname, '..');
const ASSETS = path.join(ROOT, 'assets');
fs.mkdirSync(ASSETS, { recursive: true });

const write = (name, content) => {
  fs.writeFileSync(path.join(ASSETS, name), content, 'utf8');
  console.log('  ✓', name);
};

/* ---------- 队标：六边形盾 + 折线 ---------- */
write('logo.svg', `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="120" height="120">
  <defs>
    <linearGradient id="lg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#00e5ff"/>
      <stop offset="100%" stop-color="#a855f7"/>
    </linearGradient>
    <linearGradient id="lg2" x1="0" y1="1" x2="1" y2="0">
      <stop offset="0%" stop-color="#00e5ff" stop-opacity=".28"/>
      <stop offset="100%" stop-color="#a855f7" stop-opacity=".28"/>
    </linearGradient>
  </defs>
  <path d="M60 6 L108 33 V87 L60 114 L12 87 V33 Z" fill="url(#lg2)" stroke="url(#lg)" stroke-width="3"/>
  <path d="M60 20 L96 41 V79 L60 100 L24 79 V41 Z" fill="none" stroke="#00e5ff" stroke-width="1" opacity=".45"/>
  <polyline points="36,74 48,54 60,66 74,42 86,58"
            fill="none" stroke="url(#lg)" stroke-width="5"
            stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="86" cy="58" r="4.5" fill="#00e5ff"/>
</svg>
`);

/* ---------- favicon ---------- */
write('favicon.svg', `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
  <defs>
    <linearGradient id="f" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#00e5ff"/>
      <stop offset="100%" stop-color="#a855f7"/>
    </linearGradient>
  </defs>
  <rect width="64" height="64" rx="14" fill="#0a0c12"/>
  <path d="M32 8 L54 21 V43 L32 56 L10 43 V21 Z" fill="none" stroke="url(#f)" stroke-width="3"/>
  <polyline points="19,40 26,28 32,35 40,22 46,31" fill="none"
            stroke="url(#f)" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>
</svg>
`);

/* ---------- 头像：字母 + 渐变环 ---------- */
const PALETTE = [
  ['#00e5ff', '#0077ff'],
  ['#a855f7', '#ec4899'],
  ['#34d399', '#0ea5e9'],
  ['#fbbf24', '#f97316'],
  ['#f472b6', '#8b5cf6'],
  ['#38bdf8', '#6366f1'],
];

for (let i = 1; i <= 6; i++) {
  const [c1, c2] = PALETTE[(i - 1) % PALETTE.length];
  const seed = i * 8707;
  // 用伪随机但稳定的形状，保证每次生成一致
  const shapes = Array.from({ length: 5 }, (_, k) => {
    const y = 26 + ((seed * (k + 3)) % 52);
    const op = (0.05 + ((seed * (k + 2)) % 9) / 100).toFixed(2);
    return `<rect x="0" y="${y}" width="96" height="1.4" fill="#ffffff" opacity="${op}"/>`;
  }).join('');
  const letter = 'ABCDEF'[i - 1];

  write(`avatar-0${i}.svg`, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" width="96" height="96">
  <defs>
    <linearGradient id="a${i}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${c1}"/>
      <stop offset="100%" stop-color="${c2}"/>
    </linearGradient>
    <clipPath id="c${i}"><circle cx="48" cy="48" r="48"/></clipPath>
  </defs>
  <g clip-path="url(#c${i})">
    <rect width="96" height="96" fill="#12151f"/>
    ${shapes}
    <circle cx="48" cy="48" r="46" fill="none" stroke="url(#a${i})" stroke-width="4"/>
    <text x="48" y="62" text-anchor="middle"
          font-family="Segoe UI, Arial, sans-serif" font-size="38" font-weight="700"
          fill="url(#a${i})">${letter}</text>
  </g>
</svg>
`);
}

/* ---------- 收款码占位 ---------- */
function qrPlaceholder(label, hue) {
  // 生成一个"看起来像二维码"的确定性图案，中心留白写文字
  let cells = '';
  let s = 12345 + label.length * 977;
  const rnd = () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; };

  const N = 25, S = 6;
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      // 三个定位角
      const inCorner =
        (x < 7 && y < 7) || (x >= N - 7 && y < 7) || (x < 7 && y >= N - 7);
      const cornerRing =
        inCorner && (x % 6 === 0 || y % 6 === 0 || (x > 1 && x < 5 && y > 1 && y < 5));

      if (inCorner) {
        if (cornerRing) cells += `<rect x="${x * S}" y="${y * S}" width="${S}" height="${S}" fill="#0a0c12"/>`;
        continue;
      }
      // 中心留白区
      if (x > 8 && x < 16 && y > 9 && y < 15) continue;
      if (rnd() > 0.52) {
        cells += `<rect x="${x * S}" y="${y * S}" width="${S}" height="${S}" fill="#0a0c12"/>`;
      }
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 150 150" width="150" height="150">
  <rect width="150" height="150" fill="#ffffff"/>
  ${cells}
  <rect x="51" y="57" width="48" height="30" rx="5" fill="#ffffff"/>
  <text x="75" y="77" text-anchor="middle"
        font-family="Microsoft YaHei, PingFang SC, sans-serif" font-size="15" font-weight="700"
        fill="${hue}">${label}</text>
</svg>
`;
}

write('qr-wechat.svg', qrPlaceholder('微信', '#07c160'));
write('qr-alipay.svg', qrPlaceholder('支付宝', '#1677ff'));

/* ---------- 赞助商占位 ---------- */
['a', 'b', 'c'].forEach((k, i) => {
  const name = 'SPONSOR ' + k.toUpperCase();
  const hue = ['#00e5ff', '#a855f7', '#34d399'][i];
  write(`sponsor-${k}.svg`, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 70" width="200" height="70">
  <rect width="200" height="70" rx="10" fill="none" stroke="${hue}" stroke-opacity=".45" stroke-dasharray="6 5"/>
  <circle cx="40" cy="35" r="15" fill="none" stroke="${hue}" stroke-width="2.5"/>
  <path d="M33 35 h14 M40 28 v14" stroke="${hue}" stroke-width="2.5" stroke-linecap="round"/>
  <text x="68" y="41" font-family="Segoe UI, Arial, sans-serif"
        font-size="14" font-weight="600" fill="${hue}" opacity=".9">${name}</text>
</svg>
`);
});

console.log('\n资源生成完毕 →', ASSETS);