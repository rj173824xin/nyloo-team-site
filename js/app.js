/* ============================================================
   战队展示页 · 交互
   数据来源：data/team.json（全部文案与队员信息都在那里）
   ------------------------------------------------------------
   这个文件里所有的渲染都是「数据驱动」的：队员多了少了、
   位置改了、简介换了，这里一行都不用动。当初写成这样，是因为
   我知道队里的人还会变——果然，最后从 4 个人变成了 8 个。

   如果你在读这段代码：别害怕，它没有框架、没有编译，
   浏览器打开就能读，改错了刷新一下就看见了。
                                               —— 鱼
   ============================================================ */
'use strict';

const DATA_URL = 'data/team.json';

/* ---------- 小工具 ---------- */
const $  = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

/** 转义，避免数据里出现 < > 破坏结构 */
function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

/** 复制到剪贴板，带降级方案 */
async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // http 非安全上下文下 clipboard 不可用
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;opacity:0;top:0';
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch { ok = false; }
    ta.remove();
    return ok;
  }
}

let toastTimer;
function toast(msg) {
  const el = $('#toast');
  if (!el) return;
  el.textContent = msg;
  el.hidden = false;
  requestAnimationFrame(() => el.classList.add('is-on'));
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    el.classList.remove('is-on');
    setTimeout(() => { el.hidden = true; }, 300);
  }, 1900);
}

/* ---------- 通用渲染 ---------- */

/** data-bind="site.nameCn" → 把值写进元素的 textContent */
function bindText(data) {
  $$('[data-bind]').forEach(el => {
    const path = el.dataset.bind.split('.');
    let val = data;
    for (const k of path) {
      if (val == null) break;
      val = val[k];
    }
    if (val != null && typeof val !== 'object') el.textContent = val;
  });
}

/** 数字滚动 */
function countUp(el, target, suffix = '', duration = 1200) {
  // 兜底：无论动画跑不跑得完，最终值先钉死
  const finalText = target + suffix;

  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce) { el.textContent = finalText; return; }

  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    el.textContent = finalText;      // 关键：动画被中断也要落到终值
  };

  const start = performance.now();
  function tick(now) {
    if (done) return;
    const p = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - p, 3);   // easeOutCubic
    el.textContent = Math.round(target * eased) + suffix;
    if (p < 1) requestAnimationFrame(tick);
    else finish();
  }

  requestAnimationFrame(tick);
  // 保险丝：动画最长跑 duration + 400ms，到点强制落终值
  setTimeout(finish, duration + 400);
}

/* ---------- 各板块渲染 ---------- */

function renderStats(about) {
  const box = $('#stats');
  if (!box || !Array.isArray(about.stats)) return;
  box.innerHTML = about.stats.map(s => {
    const val = Number(s.value) || 0;
    const suf = s.suffix || '';
    // 初始就写真实值：动画没跑、JS 报错、用户禁用动画，都不会看到 0
    return `
    <div class="stat">
      <div class="stat__value" data-target="${val}" data-suffix="${esc(suf)}">${val}${esc(suf)}</div>
      <div class="stat__label">${esc(s.label)}</div>
    </div>`;
  }).join('');
}

function renderTimeline(about) {
  const box = $('#timeline');
  if (!box || !Array.isArray(about.timeline)) return;
  box.innerHTML = about.timeline.map(t => `
    <li class="timeline__item reveal">
      <div class="timeline__date">${esc(t.date)}</div>
      <div class="timeline__title">${esc(t.title)}</div>
      <div class="timeline__text">${esc(t.text)}</div>
    </li>
  `).join('');
}

function renderHonors(about) {
  const box = $('#honors');
  if (!box || !Array.isArray(about.honors)) return;

  box.innerHTML = about.honors.map((h, i) => {
    // 有证书图片的，做成可点击放大的卡片
    if (h.image) {
      return `
        <figure class="honor-card reveal">
          <button class="honor-card__btn" data-honor="${i}"
                  aria-label="放大查看 ${esc(h.name)} 的证书">
            <img class="honor-card__img" src="${esc(h.image)}"
                 alt="${esc(h.name)} 荣誉证书" loading="lazy">
            <span class="honor-card__zoom" aria-hidden="true">⤢</span>
          </button>
          <figcaption class="honor-card__cap">
            <span class="honor-card__year">${esc(h.year)}</span>
            <span class="honor-card__name">${esc(h.name)}</span>
            <span class="honor-card__result">${esc(h.result)}</span>
            ${h.note ? `<span class="honor-card__note">${esc(h.note)}</span>` : ''}
          </figcaption>
        </figure>
      `;
    }
    // 没图片的，保持原来的紧凑样式
    return `
      <div class="honor reveal">
        <span class="honor__year">${esc(h.year)}</span>
        <span class="honor__name">${esc(h.name)}</span>
        <span class="honor__result">${esc(h.result)}</span>
      </div>
    `;
  }).join('');
}

/** 放大看证书 */
function openHonor(index) {
  const h = (HONORS || [])[index];
  const modal = $('#modal');
  const body = $('#modalBody');
  if (!h || !h.image || !modal || !body) return;

  body.innerHTML = `
    <div class="md__name" id="modalName">${esc(h.result || h.name)}</div>
    <div class="md__rank">${esc(h.year)} · ${esc(h.name)}</div>
    ${h.note ? `<p class="md__bio">${esc(h.note)}</p>` : ''}
    <img class="honor-full" src="${esc(h.image)}" alt="${esc(h.name)} 荣誉证书">
  `;

  lastFocused = document.activeElement;
  modal.hidden = false;
  document.body.style.overflow = 'hidden';
  const closeBtn = $('.modal__close', modal);
  if (closeBtn) closeBtn.focus();
}

/** 合照横幅（about.photo 有值才渲染） */
function renderPhoto(about) {
  const box = $('#photo');
  if (!box) return;
  const ph = about.photo;
  if (!ph || !ph.src) { box.hidden = true; return; }
  box.hidden = false;
  box.innerHTML = `
    <figure class="photo reveal">
      <img class="photo__img" src="${esc(ph.src)}" alt="${esc(ph.caption || '战队合照')}" loading="lazy">
      ${ph.caption ? `<figcaption class="photo__cap">${esc(ph.caption)}</figcaption>` : ''}
    </figure>
  `;
}

/* ---------- 队员 ---------- */

let MEMBERS = [];
let ROLES = [];
let HONORS = [];

function renderFilters(roles) {
  const box = $('#filters');
  if (!box) return;
  box.innerHTML = roles.map((r, i) => `
    <button class="filter ${i === 0 ? 'is-active' : ''}"
            data-role="${esc(r)}"
            aria-pressed="${i === 0}">${esc(r)}</button>
  `).join('');
}

function memberCard(m) {
  const list = Array.isArray(m.main) ? m.main : [];
  const mains = list.slice(0, 3).map(x => `<span>${esc(x)}</span>`).join('');
  const more = list.length > 3 ? `<span>+${list.length - 3}</span>` : '';
  const hasMain = list.length > 0;

  // 角标：与位置重复时不显示，避免「突破手 1」在卡片上出现两遍
  const showRank = m.rank && m.rank !== m.role;

  // 有 link 的队员：点头像跳外链
  const linked = !!m.link;
  const avatarTag = linked
    ? `<a class="member__avatar-link" href="${esc(m.link)}" target="_blank"
          rel="noopener noreferrer" title="前往 ${esc(m.name)} 的主页"
          aria-label="打开 ${esc(m.name || m.id)} 的网站（新窗口）">
         <img class="member__avatar" src="${esc(m.avatar)}" alt="" loading="lazy">
       </a>`
    : `<img class="member__avatar" src="${esc(m.avatar)}" alt="" loading="lazy">`;

  return `
    <div class="member" data-id="${esc(m.id)}" role="button" tabindex="0"
         aria-label="查看 ${esc(m.name || m.id)} 的详情">
      ${showRank ? `<span class="member__rank">${esc(m.rank)}</span>` : ''}
      <div class="member__top">
        ${avatarTag}
        <div>
          <div class="member__id">${esc(m.name || m.id)}</div>
          <div class="member__role">${esc(m.role)}</div>
        </div>
      </div>
      ${m.bio ? `<p class="member__bio">${esc(m.bio)}</p>` : ''}
      ${hasMain ? `<div class="member__main">${mains}${more}</div>` : ''}
      <div class="member__more">
        ${linked ? '点头像访问主页 · 查看详情 →' : '查看详情 →'}
      </div>
    </div>
  `;
}

function renderMembers(list) {
  const box = $('#members-grid');
  const empty = $('#membersEmpty');
  if (!box) return;
  box.innerHTML = list.map(memberCard).join('');
  if (empty) empty.hidden = list.length > 0;
  observeReveals(box);
}

function applyFilter(role) {
  const list = role === ROLES[0] ? MEMBERS : MEMBERS.filter(m => m.role === role);
  renderMembers(list);
}

/* ---------- 队员详情弹层 ---------- */

let lastFocused = null;

function openMember(id) {
  const m = MEMBERS.find(x => x.id === id);
  const modal = $('#modal');
  const body = $('#modalBody');
  if (!m || !modal || !body) return;

  const statEntries = Object.entries(m.stats || {});
  const showRank = m.rank && m.rank !== m.role;
  const meta = [
    showRank ? esc(m.rank) : '',
    'ID ' + esc(m.id)
  ].filter(Boolean).join(' · ');

  body.innerHTML = `
    <div class="md__top">
      <img class="md__avatar" src="${esc(m.avatar)}" alt="">
      <div>
        <div class="md__name" id="modalName">${esc(m.name || m.id)}</div>
        <div class="md__role">${esc(m.role)}</div>
        <div class="md__rank">${meta}</div>
      </div>
    </div>
    ${m.bio ? `<p class="md__bio">${esc(m.bio)}</p>` : ''}
    ${m.link ? `
      <a class="md__link" href="${esc(m.link)}" target="_blank" rel="noopener noreferrer">
        访问主页 <span aria-hidden="true">↗</span>
      </a>` : ''}
    ${(m.main || []).length ? `
      <div class="md__section">
        <div class="md__label">擅长</div>
        <div class="md__tags">${m.main.map(x => `<span>${esc(x)}</span>`).join('')}</div>
      </div>` : ''}
    ${statEntries.length ? `
      <div class="md__section">
        <div class="md__label">信息</div>
        <div class="md__stats">
          ${statEntries.map(([k, v]) => `
            <div class="md__stat"><b>${esc(v)}</b><span>${esc(k)}</span></div>`).join('')}
        </div>
      </div>` : ''}
  `;

  lastFocused = document.activeElement;
  modal.hidden = false;
  document.body.style.overflow = 'hidden';
  const closeBtn = $('.modal__close', modal);
  if (closeBtn) closeBtn.focus();
}

function closeModal() {
  const modal = $('#modal');
  if (!modal || modal.hidden) return;
  modal.hidden = true;
  document.body.style.overflow = '';
  if (lastFocused && lastFocused.focus) lastFocused.focus();
}

/* ---------- 滚动相关 ---------- */

/** 元素进入视口时加 is-in，触发 CSS 动画 */
let revealObserver;
function observeReveals(root = document) {
  if (!('IntersectionObserver' in window)) {
    $$('.reveal', root).forEach(el => {
      el.classList.add('is-in');
      runCountUpIn(el);
    });
    return;
  }
  if (!revealObserver) {
    revealObserver = new IntersectionObserver((entries, obs) => {
      entries.forEach(e => {
        if (!e.isIntersecting) return;
        e.target.classList.add('is-in');
        runCountUpIn(e.target);
        obs.unobserve(e.target);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
  }
  $$('.reveal', root).forEach(el => {
    if (!el.classList.contains('is-in')) revealObserver.observe(el);
  });
}

/** 触发某个区块里所有数字的滚动动画 */
function runCountUpIn(el) {
  const nums = [el, ...Array.from(el.querySelectorAll ? el.querySelectorAll('.stat__value') : [])]
    .filter(n => n && n.classList && n.classList.contains('stat__value'));
  nums.forEach(n => {
    if (n.dataset.target && !n.dataset.counted) {
      n.dataset.counted = '1';
      countUp(n, Number(n.dataset.target), n.dataset.suffix || '');
    }
  });
}

/**
 * 保底：数字条如果因为任何原因没被观察到（在视口内但没触发、
 * 用户直接跳到锚点、页面很短等），滚到底或 3 秒后强制落到终值。
 */
function ensureStats() {
  const fallback = () => {
    $$('.stat__value').forEach(n => {
      if (n.dataset.counted) return;
      // 进入过视口就播动画，否则直接给终值
      const r = n.getBoundingClientRect();
      const visible = r.top < window.innerHeight && r.bottom > 0;
      n.dataset.counted = '1';
      if (visible) {
        countUp(n, Number(n.dataset.target) || 0, n.dataset.suffix || '');
      } else {
        n.textContent = (Number(n.dataset.target) || 0) + (n.dataset.suffix || '');
      }
    });
  };
  setTimeout(fallback, 3000);
  window.addEventListener('scroll', () => {
    const last = $$('.stat__value').filter(n => !n.dataset.counted);
    if (last.length) fallback();
  }, { passive: true, once: true });
}

/** 导航：滚动加边框、进度条、当前区块高亮 */
function initScrollUI() {
  const nav = $('#nav');
  const progress = $('#navProgress');
  const links = $$('.nav__links a');
  const sections = links
    .map(a => ({ a, sec: $(a.getAttribute('href')) }))
    .filter(x => x.sec);

  function onScroll() {
    const y = window.scrollY;
    if (nav) nav.classList.toggle('is-scrolled', y > 12);

    if (progress) {
      const h = document.documentElement.scrollHeight - window.innerHeight;
      progress.style.width = (h > 0 ? Math.min(y / h, 1) * 100 : 0) + '%';
    }

    // 当前区块：取最后一个「顶端已过中线」的区块
    const line = y + window.innerHeight * 0.32;
    let current = null;
    for (const { sec } of sections) {
      if (sec.offsetTop <= line) current = sec.id;
    }
    links.forEach(a => {
      a.classList.toggle('is-active', a.getAttribute('href') === '#' + current);
    });
  }

  let ticking = false;
  window.addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => { onScroll(); ticking = false; });
  }, { passive: true });

  onScroll();
}

/* ---------- 事件绑定 ---------- */

function initEvents() {
  // 移动端菜单
  const toggle = $('#navToggle');
  const links = $('#navLinks');
  if (toggle && links) {
    toggle.addEventListener('click', () => {
      const open = links.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', String(open));
    });
    links.addEventListener('click', e => {
      if (e.target.tagName === 'A') {
        links.classList.remove('is-open');
        toggle.setAttribute('aria-expanded', 'false');
      }
    });
  }

  // 事件委托：筛选 / 队员卡片 / 复制 / 关闭弹层
  document.addEventListener('click', async e => {
    const filter = e.target.closest('.filter');
    if (filter) {
      $$('.filter').forEach(b => {
        const on = b === filter;
        b.classList.toggle('is-active', on);
        b.setAttribute('aria-pressed', String(on));
      });
      applyFilter(filter.dataset.role);
      return;
    }

    // 点证书：放大查看
    const honorBtn = e.target.closest('.honor-card__btn');
    if (honorBtn) { openHonor(Number(honorBtn.dataset.honor)); return; }

    // 点头像上的外链：让浏览器自己跳转，不打开详情弹层
    if (e.target.closest('.member__avatar-link')) return;

    const member = e.target.closest('.member');
    if (member) { openMember(member.dataset.id); return; }

    const copyBtn = e.target.closest('[data-copy]');
    if (copyBtn) {
      const ok = await copyText(copyBtn.dataset.copy);
      toast(ok ? '已复制：' + copyBtn.dataset.copy : '复制失败，请手动选中');
      return;
    }

    if (e.target.closest('[data-close]')) { closeModal(); return; }
  });

  // 键盘：卡片是 role=button，回车/空格等同点击
  document.addEventListener('keydown', e => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const card = e.target.closest && e.target.closest('.member');
    if (!card) return;
    // 焦点在头像链接上时交给浏览器处理
    if (e.target.closest('.member__avatar-link')) return;
    e.preventDefault();
    openMember(card.dataset.id);
  });

  // Esc 关闭
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeModal();
  });

  // 图片加载失败时兜底，避免出现裂图
  document.addEventListener('error', e => {
    const el = e.target;
    if (el && el.tagName === 'IMG') {
      el.style.visibility = 'hidden';
    }
  }, true);
}

/* ---------- 启动 ---------- */

async function boot() {
  initEvents();
  initScrollUI();

  let data;
  try {
    const res = await fetch(DATA_URL, { cache: 'no-cache' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    data = await res.json();
  } catch (err) {
    // 常见于直接双击打开 file:// 页面
    const fb = $('#fallback');
    if (fb) {
      fb.hidden = false;
      $('main')?.setAttribute('hidden', '');
      $('.hero')?.setAttribute('hidden', '');
    }
    console.error('数据加载失败：', err);
    return;
  }

  const site = data.site || {};
  if (site.nameCn) document.title = site.nameCn + ' · 战队介绍';

  bindText(data);

  const about = data.about || {};
  HONORS = Array.isArray(about.honors) ? about.honors : [];
  renderStats(about);
  renderTimeline(about);
  renderHonors(about);
  renderPhoto(about);

  const members = data.members || {};
  MEMBERS = Array.isArray(members.list) ? members.list : [];
  ROLES = Array.isArray(members.roles) && members.roles.length ? members.roles : ['全部'];
  renderFilters(ROLES);
  renderMembers(MEMBERS);

  // 页脚联系方式
  const contact = site.contact || {};
  const bits = [];
  if (contact.email) bits.push(contact.email);
  if (contact.qq) bits.push('QQ ' + contact.qq);
  const fc = $('#footerContact');
  if (fc && bits.length) fc.textContent = bits.join(' · ');

  observeReveals();
  ensureStats();   // 保底：数字最终一定会落到真实值
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}