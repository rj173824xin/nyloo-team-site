/* ============================================================
   彩蛋：一条戴耳机的鱼游过去
   触发方式：
     1) 连点「大肥鱼」的队员卡片 5 次
     2) 键盘输入科乐美秘技 ↑↑↓↓←→←→
   纯 CSS 动画，无外部依赖，只播放一次
   ============================================================ */
'use strict';

(function () {

  /* ---------- 鱼 ---------- */
  // 鱼身本身是 assets/egg-fish.svg（CSS 背景图），这里只挂气泡
  function fishHTML() {
    return `
      <div class="fish" aria-hidden="true">
        <span class="fish__bubble"></span>
        <span class="fish__bubble" style="animation-delay:.5s"></span>
        <span class="fish__bubble" style="animation-delay:1s"></span>
      </div>
    `;
  }

  /* ---------- 台词 ---------- */
  const LINES = [
    '不打 CS，但队里的事我都管。',
    '服务器我盯着呢，你们打。',
    '这个网页是我写的。',
    '咱队里，我最不会的就是 CS。',
    '复盘录像我存好了。'
  ];

  let playing = false;
  let unlocked = false;

  function play() {
    if (playing) return;
    playing = true;
    unlocked = true;

    // 鱼
    const fish = document.createElement('div');
    fish.className = 'easter-fish';
    fish.innerHTML = fishHTML();
    document.body.appendChild(fish);

    // 台词气泡
    const line = LINES[Math.floor(Math.random() * LINES.length)];
    const tip = document.createElement('div');
    tip.className = 'easter-tip';
    tip.textContent = line;
    document.body.appendChild(tip);

    // 水花
    for (let i = 0; i < 10; i++) {
      const s = document.createElement('span');
      s.className = 'easter-splash';
      s.style.left = (8 + Math.random() * 84) + '%';
      s.style.animationDelay = (Math.random() * 1.4) + 's';
      document.body.appendChild(s);
      setTimeout(() => s.remove(), 3400);
    }

    setTimeout(() => tip.classList.add('is-on'), 700);
    setTimeout(() => tip.classList.remove('is-on'), 3000);

    setTimeout(() => {
      fish.remove();
      tip.remove();
      playing = false;
    }, 3600);
  }

  /* ---------- 触发 1：连点大肥鱼头像 ---------- */
  let clicks = 0;
  let clickTimer = null;

  const EGG_ID = '大肥鱼';

  document.addEventListener('click', (e) => {
    if (!e.target.closest) return;

    // 点队员卡片（且是大肥鱼本人）才计数
    const card = e.target.closest('.member');
    const modalOpen = document.getElementById('modal') && !document.getElementById('modal').hidden;
    if (!card && !modalOpen) return;

    const isMe = card
      ? card.dataset.id === EGG_ID
      : true;   // 弹层里点任何位置都算（大肥鱼弹层打开时）

    if (!isMe) return;

    clicks++;
    if (clicks >= 5) {
      clicks = 0;
      play();
      return;
    }
    clearTimeout(clickTimer);
    clickTimer = setTimeout(() => { clicks = 0; }, 1600);
  });

  /* ---------- 触发 2：科乐美秘技 ---------- */
  const KONAMI = [
    'ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown',
    'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight'
  ];
  let seq = [];

  document.addEventListener('keydown', (e) => {
    // 在输入框里打字不算
    const t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;

    seq.push(e.key);
    if (seq.length > KONAMI.length) seq.shift();

    if (seq.length === KONAMI.length && seq.every((k, i) => k === KONAMI[i])) {
      seq = [];
      play();
    }
  });

  /* ---------- 对外暴露（供测试用） ---------- */
  window.__fishEgg = {
    play,
    isUnlocked: () => unlocked,
    lines: LINES,
    konami: KONAMI
  };

  /* ============================================================
     记号 · 其一：控制台
     打开开发者工具才会看见。没有别的用处，就是想留一句话。
     ============================================================ */
  const mark = [
    '%c  NYLOO  %c  这个站是 2025 年 10 月做的',
    'background:linear-gradient(100deg,#00e5ff,#a855f7);color:#05070d;' +
    'font-weight:700;padding:4px 10px;border-radius:4px',
    'color:#8b93a7;padding:4px 4px'
  ];
  try { console.log(...mark); } catch (e) { /* 忽略 */ }

  const fishMark = [
    '%c  ~>  ',
    'color:#00e5ff;font-weight:700',
    'color:#8b93a7',
    '鱼在水里游，我在屏幕后面待着。'
  ];
  try { console.log(...fishMark); } catch (e) { /* 忽略 */ }

  // 只在控制台里能调用的隐藏命令
  window.nyloo = {
    /** 在控制台输入 nyloo.hello() */
    hello() {
      const who = '大肥鱼';
      const lines = [
        '',
        '  打 CS 的不是我，管事的才是我。',
        '  网页、服务器、复盘录像、流水账——都归我。',
        '',
        '  想看我游过去，连点我的头像 5 次，或者敲 ↑↑↓↓←→←→。',
        ''
      ];
      lines.forEach(l => console.log('%c' + l, 'color:#00e5ff'));
      console.log('%c  —— ' + who, 'color:#a855f7;font-weight:700');
      return '咕噜咕噜';
    },
    /** 直接放鱼 */
    fish() { play(); return '游过去了'; },
    /** 站点的年纪 */
    age() {
      const start = new Date('2025-01-17T00:00:00+08:00');
      const days = Math.floor((Date.now() - start) / 86400000);
      console.log(`%c  NYLOO 成立至今 ${days} 天`, 'color:#00e5ff;font-size:14px');
      return days;
    }
  };
})();