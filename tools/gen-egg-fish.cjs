/**
 * 生成彩蛋用的鱼 SVG（横向游泳版，140×90）
 * 用法： node tools/gen-egg-fish.cjs
 *
 * 构图在 140×90 内一次定死：
 *   鱼身中心 (68,52) 半径 44×27
 *   眼睛 (94,42)   耳机梁跨 x44→x112，弧顶 y=14
 *   左右耳罩贴鱼身两侧 (38,46) 和 (104,42)
 */
const fs = require('fs');
const path = require('path');

const ASSETS = path.resolve(__dirname, '..', 'assets');

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 140 90" width="140" height="90">
  <defs>
    <linearGradient id="fbody" x1="0" y1="0" x2="0.3" y2="1">
      <stop offset="0%" stop-color="#ffc061"/>
      <stop offset="55%" stop-color="#fb923c"/>
      <stop offset="100%" stop-color="#ea7308"/>
    </linearGradient>
    <radialGradient id="fshine" cx="0.35" cy="0.3" r="0.6">
      <stop offset="0%" stop-color="#ffd89b" stop-opacity=".85"/>
      <stop offset="100%" stop-color="#ffd89b" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="fcup" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#5ff0ff"/>
      <stop offset="100%" stop-color="#00c2dd"/>
    </linearGradient>
  </defs>

  <!-- 尾鳍（在身体后面） -->
  <path d="M34 52 L6 30 L14 52 L6 74 Z" fill="#ffb347" stroke="#e07a06"
        stroke-width="2" stroke-linejoin="round"/>
  <!-- 尾鳍纹路 -->
  <path d="M22 52 L12 38 M22 52 L12 66" stroke="#e07a06" stroke-width="1.4"
        opacity=".55" stroke-linecap="round"/>

  <!-- 背鳍 -->
  <path d="M52 28 Q64 10 82 22 Q70 26 64 29 Z" fill="#ffc061"
        stroke="#e07a06" stroke-width="1.6" stroke-linejoin="round"/>

  <!-- 鱼身 -->
  <ellipse cx="68" cy="52" rx="44" ry="27" fill="url(#fbody)"/>
  <!-- 高光 -->
  <ellipse cx="68" cy="52" rx="44" ry="27" fill="url(#fshine)"/>

  <!-- 胸鳍 -->
  <path d="M62 68 Q74 84 88 72 Q74 72 62 68 Z" fill="#ffc061"
        stroke="#e07a06" stroke-width="1.6" stroke-linejoin="round"/>

  <!-- 腮红 -->
  <ellipse cx="66" cy="66" rx="9" ry="5" fill="#f87171" opacity=".5"/>

  <!-- 嘴 -->
  <path d="M108 58 Q114 68 119 61" fill="none" stroke="#b45309"
        stroke-width="2.4" stroke-linecap="round"/>

  <!-- 眼睛 -->
  <circle cx="94" cy="42" r="9.5" fill="#fff"/>
  <circle cx="96.5" cy="42.5" r="5" fill="#1b1f2a"/>
  <circle cx="98.4" cy="40.3" r="1.8" fill="#fff"/>

  <!-- 耳机梁：从鱼头顶跨过去，两端落在耳罩上 -->
  <path d="M42 56 Q42 16 76 14 Q110 16 110 52" fill="none"
        stroke="#e6e9f0" stroke-width="5.5" stroke-linecap="round" opacity=".95"/>

  <!-- 左耳罩（贴鱼身左前） -->
  <rect x="33" y="44" width="17" height="26" rx="8.5" fill="url(#fcup)"/>
  <rect x="37" y="49" width="9" height="16" rx="4.5" fill="#0a0c12" opacity=".55"/>
  <!-- 右耳罩（贴鱼身右后，避开眼睛） -->
  <rect x="102" y="40" width="17" height="26" rx="8.5" fill="url(#fcup)"/>
  <rect x="106" y="45" width="9" height="16" rx="4.5" fill="#0a0c12" opacity=".55"/>

  <!-- 气泡 -->
  <circle cx="126" cy="46" r="5.5" fill="none" stroke="#00e5ff" stroke-width="1.6" opacity=".8"/>
  <circle cx="133" cy="31" r="4" fill="none" stroke="#00e5ff" stroke-width="1.4" opacity=".6"/>
  <circle cx="130" cy="17" r="2.8" fill="none" stroke="#00e5ff" stroke-width="1.2" opacity=".4"/>
</svg>
`;

fs.writeFileSync(path.join(ASSETS, 'egg-fish.svg'), svg, 'utf8');
console.log('已生成 assets/egg-fish.svg');