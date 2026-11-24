// 植遇 · 主逻辑（杂志版式）
(() => {
const { CATS, PLANTS, KIN_CARDS, SOLAR_TERMS, RARITY, HUAXIN } = window;

// ───────────────────────── 工具
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s = '') => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const catOf = id => CATS.find(c => c.id === id) || CATS[0];
const plantOf = id => PLANTS.find(p => p.id === id);
const DAY = 86400000;
const today = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const parse = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const fmt = s => { const d = parse(s); return `${d.getMonth() + 1}月${d.getDate()}日`; };
const dot = s => { const d = parse(s); return `${d.getMonth() + 1}.${String(d.getDate()).padStart(2, '0')}`; };
const WEEK = '日一二三四五六', WEEK_EN = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const MONTH_CN = ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月'];
const MONTH_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const CN_D = '〇一二三四五六七八九';
const cnNum = n => n <= 10 ? (n === 10 ? '十' : CN_D[n]) : n < 20 ? '十' + CN_D[n - 10] : CN_D[Math.floor(n / 10)] + '十' + (n % 10 ? CN_D[n % 10] : '');
const ic = (n, extra = '') => `<svg class="ic" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" ${extra}><use href="#i-${n}"/></svg>`;
const img = (p, cls = '') => p && p.photo
  ? `<span class="lz" style="background:${p.photo.c || '#dfe3dc'}"><img class="${cls}" src="${p.photo.src}" alt="${esc(p.cn)}" loading="lazy" decoding="async" onload="this.classList.add('ok')"></span>`
  : `<div class="noimg">${esc(((p && p.cn) || '?')[0])}</div>`;
const raw = (src, alt = '') => `<span class="lz" style="background:#20261f"><img src="${src}" alt="${esc(alt)}" onload="this.classList.add('ok')"></span>`;

// 滚动揭幕：进入视口时淡入，照片从下往上展开
const io = 'IntersectionObserver' in window ? new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -8% 0px' }) : null;
function reveal(root = document) {
  if (!io) { document.documentElement.classList.add('no-motion'); return; }
  $$('.sr:not(.in)', root).forEach((el, i) => { el.style.transitionDelay = `${(i % 4) * 90}ms`; io.observe(el); });
}

// 许可名称 → 知识共享许可原文链接（公有领域没有许可原文，不加链接）
function licUrl(lic) {
  if (/^CC0/i.test(lic)) return 'https://creativecommons.org/publicdomain/zero/1.0/deed.zh-hans';
  const m = /^CC (BY(?:-SA)?) ([\d.]+)(?: ([a-z]{2}))?$/i.exec(lic || '');
  if (!m) return '';
  const base = `https://creativecommons.org/licenses/${m[1].toLowerCase()}/${m[2]}/`;
  return m[3] ? `${base}${m[3].toLowerCase()}/` : `${base}deed.zh-hans`;
}
const licHtml = lic => { const u = licUrl(lic); return u ? `<a href="${u}" target="_blank" rel="noopener license">${esc(lic)}</a>` : esc(lic); };
const credit = p => p && p.photo ? `<div class="credit">摄影 <a href="${esc(p.photo.page)}" target="_blank" rel="noopener">${esc(p.photo.author || 'Wikimedia Commons')}</a> · ${licHtml(p.photo.license)}</div>` : '';
const NO = p => 'No. ' + String(PLANTS.indexOf(p) + 1).padStart(3, '0');
const monthsLabel = ms => { if (!ms || !ms.length) return '全年'; const a = ms[0], b = ms[ms.length - 1]; return a === b ? `${a}月` : `${a}–${b}月`; };
const inSeason = (p, m) => p.season && p.season.months && p.season.months.includes(m);
const hash = s => [...String(s)].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
const TYPE_COLOR = { '花期': '#C8496B', '叶色': '#C98E1A', '果期': '#9C4A2B', '其他': '#2E6B52' };
const typeKey = t => ['花期', '叶色', '果期'].includes(t) ? t : '其他';

// ───────────────────────── 存储
const KEY = 'zhiyu.v1';
const blank = () => ({ collected: {}, journal: [], garden: [] });
let S = (() => { try { return Object.assign(blank(), JSON.parse(localStorage.getItem(KEY)) || {}); } catch { return blank(); } })();
function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); return true; } catch { toast('本地空间不够了，照片没能保存'); return false; } }

const API = window.ZHIYU_API || '';
let SVC = { configured: false, server: false };
async function refreshSvc() {
  try { const r = await fetch(API + '/api/status', { cache: 'no-store' }); if (!r.ok) throw 0; SVC = { ...(await r.json()), server: true }; }
  catch { SVC = { configured: false, server: false }; }
  // 公开部署（配置了接口地址）时，连不上或未配置 Key 就是「维护中」，不退回演示模式
  SVC.down = !!API && !(SVC.server && SVC.configured);
  const d = $('#svcDot'); if (d) d.classList.toggle('ok', SVC.configured);
}
const MAINT_HTML = `<h2>识别服务暂时维护中</h2><p>拍照识别和 AI 查询暂时用不了，通常很快就会恢复。图鉴、花历、问答和你的植物记录都可以照常使用。</p>
  <button class="btn ink" id="maintGo">去翻图鉴</button>`;
function showMaint() { const sh = openSheet(MAINT_HTML); $('#maintGo', sh).onclick = () => { closeSheet(); go('atlas'); }; }

// ───────────────────────── 通用 UI
function toast(html) {
  const t = $('#toast'); t.innerHTML = html; t.classList.add('show');
  clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), 2400);
}
function openSheet(html) {
  const sh = $('#sheet'); sh.innerHTML = `<div class="grab"></div>${html}`;
  $('#mask').classList.add('open'); sh.classList.add('open'); sh.scrollTop = 0;
  return sh;
}
function closeSheet() { $('#mask').classList.remove('open'); $('#sheet').classList.remove('open'); }
$('#mask').onclick = closeSheet;

const stack = [];
function openArticle(html) {
  const el = document.createElement('div');
  el.className = 'article'; el.innerHTML = html;
  document.body.appendChild(el); stack.push(el); document.body.classList.add('lock');
  requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('open')));
  $$('[data-close]', el).forEach(b => b.onclick = () => closeArticle(el));
  const prog = $('.a-bar .prog', el);
  if (prog) el.addEventListener('scroll', () => { prog.style.width = Math.min(100, el.scrollTop / Math.max(1, el.scrollHeight - el.clientHeight) * 100) + '%'; }, { passive: true });
  setTimeout(() => reveal(el), 50);
  return el;
}
function closeArticle(el = stack[stack.length - 1]) {
  if (!el) return;
  el.classList.remove('open'); stack.splice(stack.indexOf(el), 1);
  setTimeout(() => el.remove(), 600);
  if (!stack.length) document.body.classList.remove('lock');
}
const closeAll = () => [...stack].forEach(a => closeArticle(a));
document.addEventListener('keydown', e => { if (e.key === 'Escape') { if ($('#sheet').classList.contains('open')) closeSheet(); else if ($('#srch').classList.contains('open')) closeSearch(); else closeArticle(); } });

// ───────────────────────── 时令
function termList(y) { return SOLAR_TERMS.map(([m, d, n]) => ({ n, m, d, date: new Date(y, m - 1, d) })); }
function solar(d = today()) {
  const y = d.getFullYear(), list = [...termList(y - 1), ...termList(y), ...termList(y + 1)];
  const i = list.findIndex((t, k) => t.date <= d && list[k + 1].date > d);
  const cur = list[i], next = list[i + 1];
  return { cur: cur.n, day: Math.round((d - cur.date) / DAY) + 1, next: next.n, left: Math.round((next.date - d) / DAY) };
}
const weekNo = d => { const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())); const dn = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - dn); const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1)); return Math.ceil(((t - y0) / DAY + 1) / 7); };

// ───────────────────────── 导航
const TABS = [['home', '发现', 'home'], ['atlas', '图鉴', 'book'], ['calendar', '花历', 'cal'], ['mine', '我的植物', 'pot']];
let current = 'home';
function renderNav() {
  $('#nav').innerHTML = TABS.map(([id, name]) => `<button data-tab="${id}" class="${current === id ? 'on' : ''}">${name}</button>`).join('');
  const t = TABS.map(([id, name, icon]) => `<button class="tab ${current === id ? 'on' : ''}" data-tab="${id}">${ic(icon)}${name}</button>`);
  t.splice(2, 0, `<button class="tab cam" data-cam>${ic('cam')}识别</button>`);
  $('#tabbar').innerHTML = t.join('');
  $$('[data-tab]').forEach(b => b.onclick = () => go(b.dataset.tab));
  $$('#tabbar [data-cam]').forEach(b => b.onclick = openCamSheet);
}
function masthead() {
  const d = today(), so = solar(d);
  $('#issue').textContent = `Vol. ${String(d.getFullYear()).slice(2)} — No. ${weekNo(d)}`;
  $('#mdate').textContent = `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')} ${WEEK_EN[d.getDay()]} · ${so.cur}`;
  $$('[data-settings]').forEach(b => b.onclick = openSettings);
  $$('.mast [data-cam], .mast-bar [data-cam]').forEach(b => b.onclick = openCamSheet);
  $$('.mast [data-home], .mast-bar [data-home]').forEach(b => b.onclick = () => go('home'));
  $$('.mast [data-msearch], .mast-bar [data-msearch]').forEach(b => b.onclick = () => openSearch());
  // 大字标滚出视口后，导航条变成带小字标的吸顶样式
  const bar = $('#mastBar'), hero = $('.mast');
  const onScroll = () => bar.classList.toggle('stuck', scrollY > hero.offsetHeight - 4);
  addEventListener('scroll', onScroll, { passive: true }); onScroll();
  // 按 / 或 ⌘K 打开全站搜索
  addEventListener('keydown', e => {
    const typing = /INPUT|TEXTAREA/.test(document.activeElement && document.activeElement.tagName);
    if ((e.key === '/' && !typing) || ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k')) { e.preventDefault(); openSearch(); }
  });
}
function go(tab, opts = {}) {
  current = tab;
  $$('.view').forEach(v => v.hidden = v.id !== 'v-' + tab);
  RENDER[tab](opts);
  renderNav();
  window.scrollTo({ top: 0 });
  const v = $('#v-' + tab); v.classList.remove('rv'); void v.offsetWidth; v.classList.add('rv');
  reveal(v);
}
const rerender = () => { const y = scrollY; RENDER[current]({ keep: true }); renderNav(); reveal($('#v-' + current)); window.scrollTo({ top: y }); };
function bind(root) {
  $$('[data-open]', root).forEach(el => el.addEventListener('click', e => { e.stopPropagation(); openDetail(el.dataset.open); }));
  $$('[data-cam]', root).forEach(b => b.onclick = openCamSheet);
}

// ───────────────────────── 组件
const caption = (p, sub) => `<div class="cap"><span class="fig">${NO(p)}</span><h4>${esc(p.cn)}</h4><div class="latin">${esc(p.latin)}</div>
  <p>${sub}${S.collected[p.id] ? ` · <span class="got">${dot(S.collected[p.id].date)} 已遇见</span>` : ''}</p></div>`;
const item = (p, sub, cls = '') => `<div class="item hov sr ${cls}" data-open="${p.id}"><div class="ph">${img(p)}</div>${caption(p, sub)}</div>`;
const seasonSub = p => p.season ? `${esc(p.season.type)} · ${monthsLabel(p.season.months)}` : `${catOf(p.cat).name} · ${esc(p.family)}`;

// ───────────────────────── 发现（本期）
const CAT_COVER = { foliage: 'monstera', succulent: 'echeveria', flower: 'sakura', tree: 'ginkgo', herb: 'lemon', wild: 'dandelion', water: 'lotus', odd: 'flytrap' };
const QUIZ = window.QUIZ || [];
const TYPE_NAME = { kin: '亲戚关系', name: '名字由来', myth: '常见误会', fact: '冷知识', poem: '诗里的植物' };
// 首页翻牌：亲戚卡和问答题混在一起，每天换一组
function flipCards(n, seed) {
  const a = KIN_CARDS.map(k => ({ id: 'k_' + k.id, t: k.rel === 'same' ? '是亲戚吗' : '是一家吗', q: k.q, a: k.a, plant: k.id }));
  const b = QUIZ.map(q => ({ id: q.id, t: TYPE_NAME[q.type] || '冷知识', q: q.q,
    a: (q.format === 'tf' ? (q.answer ? '对。' : '不对。') : `答案是「${q.options[q.answer]}」。`) + q.explain, plant: q.plant }));
  return [...a, ...b].sort((x, y) => hash(x.id + seed) - hash(y.id + seed)).slice(0, n);
}
const flipHTML = (k, i) => { const p = plantOf(k.plant); return `
  <div class="flip sr" data-flip><div class="flip-in">
    <div class="flip-f"><div class="Q">Q${i + 1}</div><div class="t">${esc(k.t)}</div><div class="q">${esc(k.q)}</div><div class="hint">${ic('turn', 'style="width:13px;height:13px"')}点击翻面</div></div>
    <div class="flip-b">${p && p.photo ? `<img src="${p.photo.src}" alt="" loading="lazy">` : ''}<div class="A">A.</div><p>${esc(k.a)}</p>${p ? `<button data-open="${p.id}">读「${esc(p.cn)}」</button>` : ''}</div>
  </div></div>`; };

let browseSeed = 0;
function renderHome() {
  const d = today(), m = d.getMonth() + 1, so = solar(d), wk = weekNo(d);
  const doy = Math.floor((d - new Date(d.getFullYear(), 0, 0)) / DAY);
  const seasonal = PLANTS.filter(p => inSeason(p, m));
  const pool = seasonal.filter(p => p.photo && ['花期', '叶色', '果期'].includes(p.season.type));
  const pick = (pool.length ? pool : PLANTS.filter(p => p.photo))[doy % Math.max(1, (pool.length || PLANTS.filter(p => p.photo).length))];
  const rest = seasonal.filter(p => p !== pick).sort((a, b) => hash(a.id + doy) - hash(b.id + doy));
  const poems = PLANTS.filter(p => p.poem && p.photo);
  const poemPick = poems.find(p => inSeason(p, m) && p !== pick) || poems[doy % Math.max(1, poems.length)];
  const perMonth = Array.from({ length: 12 }, (_, i) => { const ps = PLANTS.filter(p => inSeason(p, i + 1)); return { n: ps.length, t: ['花期', '叶色', '果期'].map(t => ps.filter(p => typeKey(p.season.type) === t).length) }; });
  const maxT = Math.max(1, ...perMonth.flatMap(x => x.t));
  const feat = rest[0], side = rest.slice(1, 3), row = rest.slice(3, 7);
  const tick = [...PLANTS].sort((a, b) => hash(a.id + doy) - hash(b.id + doy)).slice(0, 40);
  const browse = [...PLANTS].filter(p => p.photo).sort((a, b) => hash(a.id + browseSeed + doy) - hash(b.id + browseSeed + doy)).slice(0, 4);

  $('#v-home').innerHTML = `
    <section class="cover">
      <div class="cover-txt sr">
        <span class="kicker spot">Cover story · 本期封面</span>
        <span class="no">№ ${wk} — ${pick.season ? esc(pick.season.type) + '正当时' : catOf(pick.cat).name}</span>
        <h1>${esc(pick.cn)}</h1>
        <div class="latin">${esc(pick.latin)}</div>
        <p class="lead">${esc(pick.persona)}</p>
        <div class="specs">
          <div><span>科</span><span>${esc(pick.family)}</span></div>
          ${pick.origin ? `<div><span>原产</span><span>${esc(pick.origin)}</span></div>` : ''}
          <div><span>${pick.season ? esc(pick.season.type) : '观赏期'}</span><span>${pick.season ? monthsLabel(pick.season.months) : '全年'}</span></div>
          ${pick.alias && pick.alias.length ? `<div><span>别名</span><span>${pick.alias.map(esc).join('、')}</span></div>` : ''}
        </div>
        <button class="link" data-open="${pick.id}"><span>阅读全文</span>${ic('arrow')}</button>
      </div>
      <div class="cover-img bleed-r sr">
        <div class="vert">${so.cur} · 第${cnNum(so.day)}天 · 距${so.next}${cnNum(so.left)}天</div>
        <figure><div class="ph" data-open="${pick.id}">${img(pick)}</div>${credit(pick)}</figure>
      </div>
    </section>

    <nav class="toc sr">
      <button data-jump="c1"><div class="n">01</div><h3>此刻正当时</h3><p>${seasonal.length} 种植物在这个月最好看</p></button>
      <button data-jump="c2"><div class="n">02</div><h3>花历</h3><p>一年十二个月的花事与时令</p></button>
      <button data-jump="c3"><div class="n">03</div><h3>植物冷知识问答</h3><p>${QUIZ.length + KIN_CARDS.length} 道题，看看你认识多少</p></button>
      <button data-jump="c4"><div class="n">04</div><h3>图鉴索引</h3><p>${PLANTS.length} 种植物，${CATS.length} 个分类</p></button>
    </nav>

    <div class="ticker" aria-hidden="true"><div class="track">${[...tick, ...tick].map(p => `<button data-open="${p.id}">${esc(p.latin)}<small>${esc(p.cn)}</small></button>`).join('')}</div></div>

    ${feat ? `<section class="chap" id="c1">
      <div class="chap-h sr"><div><span class="n">01 — In season</span><h2>此刻正当时</h2></div>
        <div class="deck">${so.cur}前后，城市里值得停下来看一眼的有：${seasonal.slice(0, 6).map(p => esc(p.cn)).join('、')}${seasonal.length > 6 ? `等 ${seasonal.length} 种` : ''}。<br><button class="link" data-goto="calendar">打开${m}月花历 ${ic('arrow')}</button></div></div>
      <div class="ed">
        ${item(feat, seasonSub(feat), 'feat')}
        ${side.length ? `<div class="side">${side.map(p => item(p, seasonSub(p))).join('')}</div>` : ''}
        ${row.map(p => item(p, seasonSub(p), 'row')).join('')}
      </div></section>` : ''}

    ${poemPick ? `<section class="spread grain" data-open="${poemPick.id}">${img(poemPick)}
      <div class="q"><span class="kicker">一句诗 · ${esc(poemPick.cn)}</span><blockquote>${esc(poemPick.poem.line)}</blockquote><cite>—— ${esc(poemPick.poem.src)}</cite></div>
      ${credit(poemPick)}</section>` : ''}

    <section class="chap" id="c2">
      <div class="chap-h sr"><div><span class="n">02 — Almanac</span><h2>花历</h2></div>
        <div class="deck">每个月有多少种植物正当时，柱子表示花期、叶色、果期的数量。点任意一个月份，看那个月的花事。</div></div>
      <div class="months12 sr">${perMonth.map((x, i) => `<button data-month="${i + 1}" class="${i + 1 === m ? 'now' : ''}"><div class="m">${i + 1}</div><div class="cn">${MONTH_CN[i]}</div>
        <div class="bars">${x.t.map((v, k) => `<i style="height:${Math.max(2, v / maxT * 18)}px;opacity:${[.9, .6, .35][k]}"></i>`).join('')}</div><div class="c">${x.n} 种</div></button>`).join('')}</div>
    </section>

    <section class="chap band grain" id="c3">
      <div class="chap-h sr"><div><span class="n">03 — Quiz</span><h2>植物冷知识问答</h2></div>
        <div class="deck">名字像的不一定是一家，天天见的也未必真认识。先翻几张卡热热身，再来一局 10 道题。</div></div>
      <div class="quiz-intro">
        <div class="sr"><div class="big">${QUIZ.length + KIN_CARDS.length}<small>道题 · 每局随机 10 道</small></div>
          <div class="types">${Object.values(TYPE_NAME).join(' · ')}</div>
          <button class="btn ink" data-quiz>开始答题 ${ic('arrow')}</button></div>
        <div class="qa qa2">${flipCards(4, doy).map(flipHTML).join('')}</div>
      </div>
    </section>

    <section class="chap" id="cb">
      <div class="chap-h sr"><div><span class="n">Browse</span><h2>随手翻一页</h2></div>
        <div class="deck">从 ${PLANTS.length} 种里随便抽四种，也许会遇到一个你天天路过却叫不出名字的。<br><button class="link" id="reshuffle">换一批 ${ic('turn')}</button></div></div>
      <div class="strip">${browse.map(p => `<div class="item hov sr" data-open="${p.id}"><div class="ph">${img(p)}</div>
        <span class="cat-l">${catOf(p.cat).name} · ${NO(p)}</span><h4>${esc(p.cn)}</h4><p>${esc(p.persona)}</p></div>`).join('')}</div>
    </section>

    <section class="chap" id="c4">
      <div class="chap-h sr"><div><span class="n">04 — Index</span><h2>图鉴索引</h2></div>
        <div class="deck">从窗台上的龟背竹到路边的蒲公英，再到只在热带雨林里开的大王花。<br><button class="link" data-goto="atlas">翻开全部 ${PLANTS.length} 种 ${ic('arrow')}</button></div></div>
      <div class="index" id="catIndex">${CATS.map((c, i) => { const cover = plantOf(CAT_COVER[c.id]) || PLANTS.find(p => p.cat === c.id && p.photo);
        return `<div class="r sr" data-cat="${c.id}" data-img="${cover && cover.photo ? cover.photo.src : ''}"><span class="thumb">${img(cover)}</span><span class="n">0${i + 1}</span><h3>${c.name}</h3><span class="en">${c.en}</span><span class="c">${PLANTS.filter(p => p.cat === c.id).length} 种 →</span></div>`; }).join('')}
        <div class="float" id="catFloat"><img alt=""></div></div>
    </section>

    <footer class="colophon band grain">
      <div><div class="word"><b>植遇</b><span>Zhiyu</span></div><p style="margin-top:10px">一本关于身边植物的图鉴。拍下遇见的植物，认识它，记住它。</p></div>
      <div><h5>图片</h5>植物照片来自 Wikimedia Commons，按各自的知识共享协议使用，作者署名见每张图下方。<br><button id="credits">全部图片来源</button></div>
      <div><h5>内容</h5>冷知识与问答整理自维基百科、中国植物志等公开资料，每篇文章末尾列有来源；拍照识别由 DeepSeek 提供。</div>
    </footer>`;

  const v = $('#v-home'); bind(v);
  $$('[data-flip]', v).forEach(f => f.onclick = e => { if (!e.target.closest('[data-open]')) f.classList.toggle('on'); });
  $$('[data-jump]', v).forEach(b => b.onclick = () => { const t = $('#' + b.dataset.jump); if (t) window.scrollTo({ top: t.getBoundingClientRect().top + scrollY - 110, behavior: 'smooth' }); });
  $$('[data-goto]', v).forEach(b => b.onclick = () => go(b.dataset.goto));
  $$('[data-month]', v).forEach(b => b.onclick = () => { cal.m = +b.dataset.month; go('calendar'); });
  $$('[data-cat]', v).forEach(el => el.onclick = () => { atlas.cat = el.dataset.cat; atlas.q = ''; go('atlas'); });
  $$('[data-quiz]', v).forEach(b => b.onclick = startQuiz);
  $('#reshuffle').onclick = () => { browseSeed++; const y = scrollY; renderHome(); reveal(v); window.scrollTo({ top: y }); };
  const fl = $('#catFloat'), idx = $('#catIndex');
  $$('.r', idx).forEach(r => {
    r.onmouseenter = () => { if (!r.dataset.img) return; fl.firstElementChild.src = r.dataset.img; fl.style.top = (r.offsetTop - 120) + 'px'; fl.classList.add('show'); };
    r.onmouseleave = () => fl.classList.remove('show');
  });
  $('#credits').onclick = openCredits;
}

// ───────────────────────── 问答游戏
function startQuiz() {
  const kin = KIN_CARDS.map(k => ({ id: 'k_' + k.id, type: 'kin', format: 'reveal', q: k.q, explain: k.a, plant: k.id }));
  // 题库够 10 道时只出对错题和选择题；亲戚卡（开放式）留给首页翻牌
  const all = (QUIZ.length >= 10 ? [...QUIZ] : [...QUIZ, ...kin]).sort(() => Math.random() - .5);
  const qs = all.slice(0, 10);
  const res = [];
  const el = openArticle(`<div class="a-bar"><div class="page"><button class="back" data-close>${ic('left')}结束</button><span class="mid">植物冷知识问答 · Quiz</span><span class="r" id="qzScore">0 分</span></div><span class="prog"></span></div><div id="qzBox"></div>`);
  const box = $('#qzBox', el);
  const show = i => {
    if (i >= qs.length) return end();
    const q = qs[i], p = plantOf(q.plant);
    const opts = q.format === 'tf' ? ['对', '不对'] : q.format === 'choice' ? q.options : ['我猜到了', '没猜到'];
    const correct = q.format === 'tf' ? (q.answer ? 0 : 1) : q.format === 'choice' ? q.answer : null;
    box.innerHTML = `<div class="qz">
      <div class="qz-img blur">${p && p.photo ? `<div class="ph">${img(p)}</div><div class="tag">${esc(p.cn)}<small>${esc(p.latin)}</small></div>` : `<div class="ph"><div class="noimg">?</div></div>`}</div>
      <div class="qz-body">
        <div class="qz-top"><span class="num">${String(i + 1).padStart(2, '0')}<small> / ${qs.length}</small></span><span class="t">${esc(TYPE_NAME[q.type] || '冷知识')}</span></div>
        <div class="qz-dots">${qs.map((_, k) => `<i class="${res[k] === true ? 'r' : res[k] === false ? 'w' : k === i ? 'c' : ''}"></i>`).join('')}</div>
        <div class="qz-q">${esc(q.q)}</div>
        <div class="qz-opts">${opts.map((o, k) => `<button data-k="${k}"><span class="k">${'ABC'[k]}</span><span>${esc(o)}</span><span class="m"></span></button>`).join('')}</div>
        <div class="qz-ex"></div>
        <div class="qz-nav"></div>
      </div></div>`;
    el.scrollTo({ top: 0 });
    $('.a-bar .prog', el).style.width = (i / qs.length * 100) + '%';
    $$('.qz-opts button', box).forEach(b => b.onclick = () => {
      const k = +b.dataset.k;
      const ok = correct === null ? k === 0 : k === correct;
      res[i] = ok;
      $$('.qz-opts button', box).forEach(x => { x.disabled = true; const kk = +x.dataset.k;
        if (correct !== null && kk === correct) { x.classList.add('right'); x.querySelector('.m').textContent = '正确答案'; }
        if (kk === k && !ok && correct !== null) { x.classList.add('wrong'); x.querySelector('.m').textContent = '你的选择'; } });
      if (correct === null) b.classList.add(ok ? 'right' : 'wrong');
      $('.qz-img', box).classList.remove('blur');
      const ex = $('.qz-ex', box);
      ex.innerHTML = `<b>${correct === null ? '答案' : ok ? '答对了' : '答错了'}</b>${esc(q.explain)}${q.source ? `<span class="src">来源 <a href="${esc(q.source)}" target="_blank" rel="noopener">${esc(host(q.source))}</a></span>` : ''}`;
      requestAnimationFrame(() => ex.classList.add('show'));
      $('#qzScore').textContent = `${res.filter(Boolean).length} 分`;
      $('.qz-nav', box).innerHTML = `<button class="btn ink" id="qzNext">${i + 1 < qs.length ? '下一题' : '看成绩'} ${ic('arrow')}</button>${p ? `<button class="btn out" data-open="${p.id}">读「${esc(p.cn)}」</button>` : ''}`;
      $('#qzNext').onclick = () => show(i + 1); bind($('.qz-nav', box));
    });
  };
  const end = () => {
    const n = res.filter(Boolean).length;
    const verdict = n >= 9 ? '几乎全对。路边的植物大概都认识你。' : n >= 7 ? '很不错，出门散步可以给朋友当讲解员了。' : n >= 4 ? '一半一半。下次路过它们，可以多看两眼。' : '没关系，这些题本来就挺反直觉的。翻翻图鉴，再来一局。';
    $('.a-bar .prog', el).style.width = '100%';
    box.innerHTML = `<div class="page"><div class="qz-end"><span class="kicker spot">本局成绩</span><div class="score">${n}<small> / ${qs.length}</small></div><p class="verdict">${verdict}</p>
      <div class="qz-nav"><button class="btn ink" id="qzAgain">再来一局 ${ic('turn')}</button><button class="btn out" data-close2>回到首页</button></div>
      <div class="qz-list">${qs.map((q, k) => `<div class="${res[k] ? 'r' : 'w'}"><b>${res[k] ? '✓' : '✗'}</b><span>${esc(q.q)}</span></div>`).join('')}</div></div></div>`;
    $('#qzAgain').onclick = () => { closeArticle(el); startQuiz(); };
    $('[data-close2]', box).onclick = () => closeArticle(el);
  };
  show(0);
}

// ───────────────────────── 图鉴
const atlas = { cat: 'all', q: '', f: new Set(), view: 'grid' };
const FILTERS = [['season', '当季'], ['home', '适合家养'], ['got', '已遇见'], ['not', '未遇见']];
function atlasList() {
  const m = today().getMonth() + 1, q = atlas.q.toLowerCase();
  return PLANTS.filter(p => (atlas.cat === 'all' || p.cat === atlas.cat)
    && (!q || [p.cn, p.latin, p.family, p.id, ...(p.alias || [])].some(s => s && s.toLowerCase().includes(q)))
    && (!atlas.f.has('season') || inSeason(p, m)) && (!atlas.f.has('home') || p.home)
    && (!atlas.f.has('got') || S.collected[p.id]) && (!atlas.f.has('not') || !S.collected[p.id]));
}
function renderAtlas() {
  const got = Object.keys(S.collected).length;
  $('#v-atlas').innerHTML = `
    <div class="ph-head rv"><div><span class="kicker spot">The index</span><h1>图鉴</h1></div>
      <div><p class="deck">收录 ${PLANTS.length} 种植物，分为${CATS.map(c => c.name).join('、')}八个部分。你已遇见其中 ${got} 种。</p>
        <label class="uline">${ic('search')}<input id="atlasQ" placeholder="搜索中文名、别名、学名或科名" value="${esc(atlas.q)}" autocomplete="off"></label></div></div>
    <div class="bar-f">
      <div class="tabs">${[{ id: 'all', name: '全部' }, ...CATS].map(c => `<button class="${atlas.cat === c.id ? 'on' : ''}" data-c="${c.id}">${c.name}<sup>${c.id === 'all' ? PLANTS.length : PLANTS.filter(p => p.cat === c.id).length}</sup></button>`).join('')}</div>
      <span class="sep"></span>
      <div class="toggles">${FILTERS.map(([k, n]) => `<button class="tg ${atlas.f.has(k) ? 'on' : ''}" data-f="${k}">${n}</button>`).join('')}</div>
      <span class="sep"></span>
      <div class="toggles"><button class="tg ${atlas.view === 'grid' ? 'on' : ''}" data-v="grid">图片</button><button class="tg ${atlas.view === 'list' ? 'on' : ''}" data-v="list">索引</button></div>
      <span class="cnt" id="atlasN"></span>
    </div>
    <div id="atlasBody"></div>`;
  const v = $('#v-atlas');
  $$('[data-c]', v).forEach(b => b.onclick = () => { atlas.cat = b.dataset.c; renderAtlas(); });
  $$('[data-f]', v).forEach(b => b.onclick = () => { const k = b.dataset.f; atlas.f.has(k) ? atlas.f.delete(k) : atlas.f.add(k); if (k === 'got') atlas.f.delete('not'); if (k === 'not') atlas.f.delete('got'); renderAtlas(); });
  $$('[data-v]', v).forEach(b => b.onclick = () => { atlas.view = b.dataset.v; renderAtlas(); });
  $('#atlasQ').oninput = e => { atlas.q = e.target.value.trim(); renderAtlasBody(); };
  const on = $('.tabs .on', v); if (on) on.parentNode.parentNode.scrollLeft = on.offsetLeft - 20;
  renderAtlasBody();
}
function renderAtlasBody() {
  const list = atlasList();
  $('#atlasN').textContent = `${list.length} species`;
  const body = $('#atlasBody');
  if (!list.length) { body.innerHTML = `<div class="nores">没有找到"${esc(atlas.q)}"<small>换个名字试试，或者直接拍照识别。</small></div>`; return; }
  body.innerHTML = atlas.view === 'grid'
    ? `<div class="grid4">${list.map((p, i) => item(p, `${esc(p.family)} · ${catOf(p.cat).name}`).replace('class="item', `style="animation-delay:${Math.min(i, 12) * 30}ms" class="item`)).join('')}</div>`
    : `<table class="tbl"><thead><tr><th>编号</th><th></th><th>中文名</th><th>学名</th><th class="hide-m">科</th><th class="hide-m">分类</th><th class="hide-m">观赏期</th><th class="hide-m">状态</th></tr></thead><tbody>
      ${list.map(p => `<tr class="rw" data-open="${p.id}"><td class="t-no">${String(PLANTS.indexOf(p) + 1).padStart(3, '0')}</td><td><div class="ph t-img">${img(p)}</div></td>
        <td class="t-cn">${esc(p.cn)}</td><td class="latin">${esc(p.latin)}</td><td class="hide-m">${esc(p.family)}</td><td class="hide-m">${catOf(p.cat).name}</td>
        <td class="hide-m">${p.season ? `${esc(p.season.type)} ${monthsLabel(p.season.months)}` : '—'}</td><td class="hide-m" style="color:var(--spot)">${S.collected[p.id] ? dot(S.collected[p.id].date) + ' 遇见' : ''}</td></tr>`).join('')}</tbody></table>`;
  bind(body);
}

// ───────────────────────── 花历
const cal = { m: today().getMonth() + 1, type: '花期' };
function renderCalendar() {
  const now = today(), nm = now.getMonth() + 1, m = cal.m, y = now.getFullYear();
  const ps = PLANTS.filter(p => inSeason(p, m));
  const groups = ['花期', '叶色', '果期', '其他'].map(t => [t, ps.filter(p => typeKey(p.season.type) === t)]).filter(g => g[1].length);
  const terms = termList(y).filter(t => t.m === m);
  const curTerm = solar(now).cur;
  const seasonalAll = PLANTS.filter(p => p.season && p.season.months && p.season.months.length && (cal.type === 'all' || typeKey(p.season.type) === cal.type))
    .sort((a, b) => a.season.months[0] - b.season.months[0] || a.season.months.length - b.season.months.length);
  const counts = Array.from({ length: 12 }, (_, i) => PLANTS.filter(p => inSeason(p, i + 1)).length);
  const hxDates = Object.fromEntries(termList(y).map(t => [t.n, `${t.m}.${String(t.d).padStart(2, '0')}`]));

  $('#v-calendar').innerHTML = `
    <div class="ph-head rv"><div><span class="kicker spot">The almanac</span><h1>花历</h1></div>
      <p class="deck">一年十二个月，城市里什么时候看什么。观赏期按长江中下游的物候整理，其他地区会提前或推后几周。</p></div>
    <div class="cal-sel"><div class="months12">${counts.map((n, i) => `<button data-m="${i + 1}" class="${i + 1 === nm ? 'now' : ''} ${i + 1 === m ? 'sel' : ''}"><div class="m">${i + 1}</div><div class="cn">${MONTH_CN[i]}</div><div class="c">${n} 种</div></button>`).join('')}</div></div>

    <div class="cal-spread">
      <aside class="cal-left">
        <div class="big">${MONTH_CN[m - 1]}</div>
        <div class="en">${MONTH_EN[m - 1]}${m === nm ? ' · 本月' : ''}</div>
        <div class="terms">${terms.map(t => `<div><b>${t.n}</b><span>${t.m}月${t.d}日前后</span></div>`).join('')}</div>
        <p class="sumline">这个月有 ${ps.length} 种植物正当时${groups.length ? '：' + groups.map(([t, l]) => `${t === '其他' ? '其他观赏' : t} ${l.length} 种`).join('，') : ''}。</p>
        ${terms.some(t => HUAXIN[t.n]) ? `<div class="huaxin"><span class="kicker">花信风</span>${terms.filter(t => HUAXIN[t.n]).map(t => `<div class="row"><b>${t.n}</b>${HUAXIN[t.n].map(([f, id], k) => `<span><small>${['一候', '二候', '三候'][k]}</small>${id && plantOf(id) ? `<button data-open="${id}">${f}</button>` : `<em>${f}</em>`}</span>`).join('')}</div>`).join('')}</div>` : ''}
      </aside>
      <div>${groups.length ? groups.map(([t, l]) => `<div class="grp"><div class="grp-h"><h3>${t === '其他' ? '其他观赏' : t}</h3><span>${l.length} species</span></div>
        <div class="grid3">${l.map(p => item(p, `${esc(p.season.type)} · ${monthsLabel(p.season.months)}`)).join('')}</div></div>`).join('')
        : `<div class="nores">这个月图鉴里还没有标注观赏期的植物</div>`}</div>
    </div>

    <section class="chap">
      <div class="chap-h"><div><span class="n">Calendar</span><h2>全年花历</h2></div>
        <div class="deck"><div class="legend">${['花期', '叶色', '果期', '其他'].map(t => `<span><i style="background:${TYPE_COLOR[t]}"></i>${t === '其他' ? '其他观赏' : t}</span>`).join('')}</div>
        <div class="toggles" style="margin-top:16px">${['all', '花期', '叶色', '果期', '其他'].map(t => `<button class="tg ${cal.type === t ? 'on' : ''}" data-t="${t}">${t === 'all' ? '全部' : t === '其他' ? '其他观赏' : t}</button>`).join('')}</div></div></div>
      <div class="tl-wrap"><div class="tl">
        <div class="tl-head"><span></span>${Array.from({ length: 12 }, (_, i) => `<span class="${i + 1 === nm ? 'now' : ''}">${i + 1}</span>`).join('')}</div>
        ${seasonalAll.map(p => { const ms = p.season.months, col = TYPE_COLOR[typeKey(p.season.type)];
          return `<div class="tl-row" data-open="${p.id}"><div class="tl-name">${p.photo ? `<img src="${p.photo.src}" alt="" loading="lazy">` : `<div class="noimg">${esc(p.cn[0])}</div>`}<b>${esc(p.cn)}</b><small>${esc(p.season.type)}</small></div>
            ${Array.from({ length: 12 }, (_, i) => { const mm = i + 1, on = ms.includes(mm); const prev = ms.includes(mm === 1 ? 12 : mm - 1), next = ms.includes(mm === 12 ? 1 : mm + 1);
              return `<div class="c ${mm === nm ? 'now' : ''}">${on ? `<i class="${prev ? '' : 's'} ${next ? '' : 'e'}" style="background:${col}"></i>` : ''}</div>`; }).join('')}</div>`; }).join('')}
      </div></div>
    </section>

    <section class="chap">
      <div class="chap-h"><div><span class="n">Folk almanac</span><h2>二十四番花信风</h2></div>
        <div class="deck">民间把小寒到谷雨这八个节气分成二十四候，每候配一种应时开的花，从梅花开始，到楝花结束。楝花开过，春天的花事就算告一段落。这份花信按江南物候排列。</div></div>
      <div class="hx-table">${Object.entries(HUAXIN).map(([t, fs]) => `<div class="col ${t === curTerm ? 'cur' : ''}"><div class="term">${t}</div><div class="dt">${hxDates[t] || ''}</div>
        <ol>${fs.map(([f, id], k) => `<li><small>${['一候', '二候', '三候'][k]}</small>${id && plantOf(id) ? `<button data-open="${id}">${f}</button>` : f}</li>`).join('')}</ol></div>`).join('')}</div>
    </section>`;
  const v = $('#v-calendar'); bind(v);
  $$('[data-m]', v).forEach(b => b.onclick = () => { cal.m = +b.dataset.m; const y0 = scrollY; renderCalendar(); window.scrollTo({ top: y0 }); });
  $$('[data-t]', v).forEach(b => b.onclick = () => { cal.type = b.dataset.t; const y0 = scrollY; renderCalendar(); window.scrollTo({ top: y0 }); });
}

// ───────────────────────── 文章：植物详情
const FACT_N = ['一', '二', '三', '四', '五'];
function careHTML(p) {
  const lv = (n, words) => `<div class="lv">${[1, 2, 3].map(i => `<i class="${i <= n ? 'f' : ''}"></i>`).join('')}</div><b>${words[n - 1]}</b>`;
  return `<section class="a-sec"><span class="kicker">养护档案</span><div class="care3">
    <div><small>光照</small>${lv(p.care.light, ['耐阴', '散射光', '要晒太阳'])}</div>
    <div><small>浇水</small>${lv(p.care.water, ['很少', '见干见湿', '爱喝水'])}</div>
    <div><small>难度</small>${lv(p.care.diff, ['新手友好', '要点心思', '有挑战'])}</div></div>
    <p class="body-p">${esc(p.care.tip)}</p></section>`;
}
const factsHTML = (facts, title) => `<section class="a-sec"><span class="kicker">${title || `关于它的${FACT_N[facts.length - 1] || facts.length}件事`}</span>
  ${facts.map((f, i) => `<div class="fact"><span class="n">${i + 1}</span><p>${esc(f)}</p></div>`).join('')}</section>`;
const host = u => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return u; } };
const aBar = (mid, r) => `<div class="a-bar"><div class="page"><button class="back" data-close>${ic('left')}返回</button><span class="mid">${mid}</span><span class="r">${r}</span></div><span class="prog"></span></div>`;

function openDetail(id) {
  const p = plantOf(id); if (!p) return;
  const c = catOf(p.cat), col = S.collected[id], m = today().getMonth() + 1;
  const owned = S.garden.some(g => g.plantId === id && (g.status || 'growing') === 'growing');
  const kin = ((p.kin && p.kin.ids) || []).map(plantOf).filter(Boolean);
  const el = openArticle(`
    ${aBar(`图鉴 · ${NO(p)}`, c.en)}
    <div class="page">
      <div class="opener">
        <figure class="o-img bleed-l sr"><div class="ph">${img(p)}</div>${credit(p)}</figure>
        <div class="txt">
          <span class="kicker spot">${c.name} · ${esc(p.family)}</span>
          <h1>${esc(p.cn)}</h1>
          <div class="latin">${esc(p.latin)}</div>
          ${p.alias && p.alias.length ? `<div class="alias">也叫 ${p.alias.map(esc).join('、')}</div>` : ''}
          <div class="byline"><span>${NO(p)}</span><span>${RARITY[p.rarity] ? RARITY[p.rarity].name : ''}</span><span>${p.season ? esc(p.season.type) + ' ' + monthsLabel(p.season.months) : '全年可见'}</span></div>
          <span class="lead-label">它的自我介绍</span>
          <p class="lead">${esc(p.persona)}</p>
        </div>
      </div>
      <div class="a-body">
        <aside class="a-aside"><div class="dossier">
          <div><small>学名</small><b class="latin">${esc(p.latin)}</b></div>
          <div><small>科</small><b>${esc(p.family)}</b></div>
          ${p.origin ? `<div><small>原产</small><b>${esc(p.origin)}</b></div>` : ''}
          <div><small>${p.season ? esc(p.season.type) : '观赏期'}</small><b>${p.season ? monthsLabel(p.season.months) : '全年'}</b></div>
          <div><small>稀有度</small><b>${RARITY[p.rarity] ? RARITY[p.rarity].name : '—'}</b></div>
          <div><small>家里能养吗</small><b>${p.home && p.care ? ['可以，新手友好', '可以，要点心思', '可以，有挑战'][p.care.diff - 1] : '不太适合'}</b></div>
          ${col ? `<div><small>我的记录</small><b style="color:var(--spot)">${fmt(col.date)} 遇见${col.place ? ' · ' + esc(col.place) : ''}</b></div>` : ''}
        </div></aside>
        <div class="a-main">
          ${factsHTML(p.facts)}
          ${p.poem ? `<div class="pull"><p>${esc(p.poem.line)}</p><cite>—— ${esc(p.poem.src)}</cite></div>` : ''}
          ${p.season ? `<section class="a-sec" style="margin-top:72px"><span class="kicker">${esc(p.season.type)} · ${monthsLabel(p.season.months)}</span>
            <div class="yr">${Array.from({ length: 12 }, (_, i) => `<span class="${p.season.months.includes(i + 1) ? 'on' : ''} ${i + 1 === m ? 'now' : ''}">${i + 1}<i></i></span>`).join('')}</div></section>` : ''}
          ${p.home && p.care ? careHTML(p) : ''}
          ${p.kin && p.kin.text ? `<section class="a-sec"><span class="kicker">亲戚关系</span><p class="body-p">${esc(p.kin.text)}</p>
            ${kin.length ? `<div class="kin-cards">${kin.map(k => item(k, esc(k.family))).join('')}</div>` : ''}</section>` : ''}
          ${p.sources && p.sources.length ? `<div class="sources">资料来源　${p.sources.slice(0, 6).map(u => `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(host(u))}</a>`).join('')}</div>` : ''}
          <div style="height:90px"></div>
        </div>
      </div>
    </div>
    <div class="a-actions">
      <button class="btn ${col ? 'done' : 'ink'}" data-meet>${col ? ic('check') + '已遇见' : ic('pin') + '我遇见过它'}</button>
      <button class="btn ${owned ? 'done' : 'out'}" data-own>${owned ? ic('check') + '正在养' : ic('pot') + '我也在养'}</button>
    </div>`);
  bind(el);
  $('[data-meet]', el).onclick = () => col ? toast(`${fmt(col.date)} 第一次遇见 <b>${esc(p.cn)}</b>`) : meetSheet(p, () => { closeArticle(el); openDetail(id); });
  const own = $('[data-own]', el);
  if (own) own.onclick = () => owned ? (closeAll(), mine.f = 'growing', go('mine')) : addToGarden(p.id, () => { closeArticle(el); openDetail(id); });
}

function meetSheet(p, after) {
  const sh = openSheet(`<h2>在哪儿遇见了${esc(p.cn)}？</h2><p>记下地点，图鉴和足迹里都会留下这一页。</p>
    <div class="field"><label>地点（选填）</label><input id="mPlace" placeholder="比如：小区门口、公司楼下、西湖边"></div>
    <div class="field"><label>一句话（选填）</label><input id="mNote" placeholder="比如：叶子黄透了"></div>
    <button class="btn ink" id="mOk">${ic('pin')}记下这次遇见</button>`);
  $('#mOk', sh).onclick = () => {
    record({ plantId: p.id, name: p.cn, latin: p.latin, family: p.family, cat: p.cat, place: $('#mPlace', sh).value.trim(), note: $('#mNote', sh).value.trim() });
    closeSheet(); toast(`点亮了 <b>${esc(p.cn)}</b>`); after && after(); rerender();
  };
}
function record(entry) {
  const date = iso(today());
  const e = Object.assign({ jid: Date.now().toString(36), date }, entry);
  S.journal.unshift(e);
  if (e.plantId && !S.collected[e.plantId]) S.collected[e.plantId] = { date, place: e.place || '' };
  if (!save() && e.photo) { delete e.photo; save(); }
  return e;
}

// ───────────────────────── 我的植物（遇见 / 正在养 / 养过）
const STATUS = { met: '遇见', growing: '正在养', past: '养过' };
const mine = { f: 'all' };
const waterLeft = g => g.every - Math.round((today() - parse(g.last)) / DAY);
const span = (a, b) => Math.max(1, Math.round((parse(b) - parse(a)) / DAY));

function addToGarden(plantId, after) {
  const p = plantOf(plantId), every = (p.care && p.care.every) || 7;
  const sh = openSheet(`<h2>正在养${esc(p.cn)}</h2>
    <p>给它起个名字。${p.care ? `按它的习性，默认 ${every} 天提醒一次浇水` : `图鉴里还没有它的家养建议，先按 ${every} 天提醒一次浇水`}，可以改。</p>
    <div class="field"><label>昵称</label><input id="gName" value="${esc(p.cn)}"></div>
    <div class="field"><label>几天浇一次</label><input id="gEvery" type="number" min="1" value="${every}"></div>
    <button class="btn spot" id="gOk">${ic('pot')}加进「正在养」</button>`);
  $('#gOk', sh).onclick = () => {
    const d = iso(today());
    S.garden.push({ gid: Date.now().toString(36), plantId, name: $('#gName', sh).value.trim() || p.cn, every: Math.max(1, +$('#gEvery', sh).value || every), last: d, log: [d], added: d, status: 'growing' });
    save(); closeSheet(); toast(`<b>${esc(p.cn)}</b> 已加进「正在养」`); after && after(); rerender();
  };
}

// 选一种自己在养的植物：全部 251 种都能搜，适合家养的排前面
function pickHomePlant() {
  const all = [...PLANTS].sort((a, b) => (b.home ? 1 : 0) - (a.home ? 1 : 0));
  const sh = openSheet(`<h2>你在养哪一种？</h2><p>输入名字、别名或学名。没有收录的植物，可以拍照识别后加进来。</p>
    <div class="field"><input id="pkQ" placeholder="比如：桂花、龟背竹、Monstera" autocomplete="off"></div>
    <p class="note" id="pkN"></p><div class="pick" id="pkList"></div>`);
  const draw = q => {
    const k = norm(q);
    const list = k ? all.filter(p => [p.cn, p.latin, ...(p.alias || [])].some(s => norm(s).includes(k))) : all.filter(p => p.home).slice(0, 24);
    $('#pkN', sh).textContent = k ? (list.length ? `找到 ${list.length} 种` : '图鉴里没有找到，可以换个叫法，或者拍照识别。') : '常见的家养植物';
    $('#pkList', sh).innerHTML = list.slice(0, 48).map(p => `<button data-pk="${p.id}">${p.photo ? `<img src="${p.photo.src}" alt="" loading="lazy">` : ''}${esc(p.cn)}${p.home ? '' : '<small class="pk-out">户外为主</small>'}</button>`).join('');
    $$('[data-pk]', sh).forEach(b => b.onclick = () => addToGarden(b.dataset.pk));
  };
  draw(''); const inp = $('#pkQ', sh); inp.oninput = e => draw(e.target.value); setTimeout(() => inp.focus(), 60);
}

function mineCard(e, i) {
  const g = e.g, j = e.j, p = plantOf(g ? g.plantId : j.plantId);
  const name = g ? g.name : j.name;
  let fig, sub, acts = '';
  if (e.kind === 'met') {
    fig = `${dot(j.date)} 遇见${j.photo ? ' · 我拍的' : ''}${j.ai && !j.demo ? ' · AI 识别' : ''}`;
    sub = `${j.place ? esc(j.place) : '未记录地点'}${j.note ? ' · ' + esc(j.note) : ''}`;
  } else if (e.kind === 'growing') {
    const left = waterLeft(g), start = g.added || (g.log && g.log[0]) || g.last;
    fig = `养了 ${span(start, iso(today()))} 天`;
    sub = `每 ${g.every} 天浇水 · <span class="${left <= 0 ? 'due' : ''}">${left <= 0 ? (left < 0 ? `晚了 ${-left} 天` : '今天该浇了') : `${left} 天后浇水`}</span>`;
    acts = `<div class="card-acts"><button data-w="${g.gid}">${ic('drop', 'style="width:13px;height:13px"')}浇好了</button><button data-end="${g.gid}">不养了</button></div>`;
  } else {
    const start = g.added || (g.log && g.log[0]) || g.last;
    fig = `养过 · ${dot(start)}–${dot(g.ended || g.last)}`;
    sub = `一共养了 ${span(start, g.ended || g.last)} 天${p && p.cn !== name ? ' · ' + esc(p.cn) : ''}`;
    acts = `<div class="card-acts"><button data-again="${g.gid}">又养上了</button></div>`;
  }
  const photo = j && j.photo ? raw(j.photo, name) : img(p);
  return `<div class="item hov sr mc" data-mk="${e.kind}" data-id="${g ? g.gid : j.jid}" style="transition-delay:${(i % 4) * 60}ms">
    <div class="ph">${photo}<span class="st st-${e.kind}">${STATUS[e.kind]}</span></div>
    <div class="cap"><span class="fig">${fig}</span><h4>${esc(name)}</h4><p>${sub}</p>${acts}</div></div>`;
}

function renderMine() {
  const G = S.garden.map(g => ({ ...g, status: g.status || 'growing' }));
  const growing = G.filter(g => g.status === 'growing'), past = G.filter(g => g.status === 'past');
  const due = growing.filter(g => waterLeft(g) <= 0);
  const entries = [
    ...S.journal.map(j => ({ kind: 'met', date: j.date, j })),
    ...growing.map(g => ({ kind: 'growing', date: g.added || (g.log && g.log[0]) || g.last, g })),
    ...past.map(g => ({ kind: 'past', date: g.ended || g.last, g })),
  ].sort((a, b) => b.date.localeCompare(a.date));
  const counts = { all: entries.length, met: S.journal.length, growing: growing.length, past: past.length };
  const list = mine.f === 'all' ? entries : entries.filter(e => e.kind === mine.f);
  const got = Object.keys(S.collected).length;
  const deck = !entries.length ? '遇见的、正在养的、养过的植物，都记在这里。'
    : due.length ? `今天有 ${due.length} 盆等着喝水：${due.map(g => esc(g.name)).join('、')}。`
    : growing.length ? `正在养的 ${growing.length} 盆今天都喝饱了。` : '路上遇见的每一种植物，都记在这里。';

  $('#v-mine').innerHTML = `
    <div class="ph-head rv"><div><span class="kicker spot">My plants</span><h1>我的植物</h1></div>
      <div><p class="deck">${deck}</p>
        <div style="display:flex;gap:10px;margin-top:20px;flex-wrap:wrap"><button class="btn ink" id="mAdd">${ic('pot')}我在养…</button><button class="btn out" data-cam>${ic('cam')}拍照记下遇见</button></div></div></div>
    <div class="statline"><div><b>${counts.met}</b><span>次遇见</span></div><div><b>${counts.growing}</b><span>盆正在养</span></div><div><b>${counts.past}</b><span>种养过</span></div><div><b>${Math.round(got / PLANTS.length * 100)}%</b><span>图鉴完成 · ${got}/${PLANTS.length}</span></div></div>
    ${due.length ? `<section class="due"><div class="grp-h"><h3>今天要浇水</h3><span>${due.length} pots</span></div>
      <div class="g-list">${due.map(g => { const p = plantOf(g.plantId); const left = waterLeft(g);
        return `<div class="gl"><div class="ph" data-open="${p.id}">${img(p)}</div><div><span class="fig">${NO(p)}</span><h3>${esc(g.name)}</h3>
          <div class="sp">${esc(p.cn)} · 每 ${g.every} 天浇水</div><span class="when due">${left < 0 ? `已经晚了 ${-left} 天` : '今天该浇水了'}</span></div>
          <button class="wbtn" data-w="${g.gid}" title="记录一次浇水">${ic('drop')}</button></div>`; }).join('')}</div></section>` : ''}
    ${entries.length ? `<div class="bar-f" style="margin-top:56px"><div class="tabs">${[['all', '全部'], ['met', '遇见'], ['growing', '正在养'], ['past', '养过']].map(([k, n]) =>
        `<button class="${mine.f === k ? 'on' : ''}" data-mf="${k}">${n}<sup>${counts[k]}</sup></button>`).join('')}</div><span class="cnt">${list.length} entries</span></div>
      ${list.length ? `<div class="grid4">${list.map(mineCard).join('')}</div>` : `<div class="nores">这里还空着</div>`}`
    : `<div class="empty"><h3>还没有记录</h3><p>路上遇见一种植物，拍下来；家里养着的，点「我在养」加进来。</p></div>`}`;

  const v = $('#v-mine'); bind(v);
  $('#mAdd').onclick = pickHomePlant;
  $$('[data-mf]', v).forEach(b => b.onclick = () => { mine.f = b.dataset.mf; renderMine(); reveal(v); });
  const findG = id => S.garden.find(x => x.gid === id);
  $$('[data-w]', v).forEach(b => b.onclick = e => { e.stopPropagation(); const g = findG(b.dataset.w);
    g.last = iso(today()); g.log = [...(g.log || []), g.last].slice(-60); save(); toast(`给 <b>${esc(g.name)}</b> 浇好水了`); rerender(); });
  $$('[data-end]', v).forEach(b => b.onclick = e => { e.stopPropagation(); const g = findG(b.dataset.end);
    g.status = 'past'; g.ended = iso(today()); save(); toast(`<b>${esc(g.name)}</b> 移到了「养过」`); rerender(); });
  $$('[data-again]', v).forEach(b => b.onclick = e => { e.stopPropagation(); const g = findG(b.dataset.again);
    g.status = 'growing'; delete g.ended; g.last = iso(today()); save(); toast(`<b>${esc(g.name)}</b> 回到了「正在养」`); rerender(); });
  $$('.mc', v).forEach(el => el.onclick = () => {
    if (el.dataset.mk === 'met') { const j = S.journal.find(x => x.jid === el.dataset.id); if (j.ai) showResult(j.ai, j.photo, j); else if (j.plantId) openDetail(j.plantId); }
    else { const g = findG(el.dataset.id); if (g) openDetail(g.plantId); }
  });
}

const RENDER = { home: renderHome, atlas: renderAtlas, calendar: renderCalendar, mine: renderMine };

// ───────────────────────── 设置 / 图片来源
async function openSettings() {
  await refreshSvc();
  const sh = openSheet(`<h2>设置</h2>
    <div class="sec-t">拍照识别</div>
    ${SVC.public || API ? `<p class="p">拍照识别和 AI 查询由 DeepSeek 提供。为了控制费用，每人每天可以用 ${SVC.per_ip || 5} 次，两者合计。</p>
      <div class="status-line"><i class="${SVC.remaining ? 'ok' : ''}"></i>${SVC.down ? '识别服务暂时维护中' : `今天还可以用 ${SVC.remaining} 次`}</div>
      <p class="note">你拍的照片只会发给 DeepSeek 用来识别，不会保存在服务器上。图鉴、花历和你的植物记录都存在你自己的浏览器里。</p>`
    : `<p class="p">识别使用 DeepSeek 的看图模型 deepseek-flash，按用量计费，一张照片大约一千多个 token。Key 只保存在这台电脑的本地服务里，网页读不到。</p>
      <div class="status-line"><i class="${SVC.configured ? 'ok' : ''}"></i>${!SVC.server ? (API ? '识别服务暂时维护中' : '没有连上识别服务') : SVC.configured ? (SVC.from_env ? '已开启真实识别（Key 来自系统环境变量）' : '已开启真实识别') : '未配置：当前是演示模式'}</div>
      ${SVC.server && !SVC.from_env ? `<div class="field"><label>DEEPSEEK API KEY</label><input id="sKey" type="password" placeholder="${SVC.configured ? '已保存，输入新的可替换' : 'sk-…'}"></div><button class="btn ink" id="sSave">保存</button>` : ''}
      <p class="note">没有配置时，识别会进入演示模式，随机给出图鉴里的一种，并明确标注"不是真实识别"。</p>`}
    <div class="sec-t">体验数据</div>
    <button class="opt" id="sDemo"><span class="oi">${ic('spark')}</span><span><b>载入示例数据</b><small>放几条遇见记录和几盆在养的植物</small></span></button>
    <button class="opt" id="sClear"><span class="oi">${ic('close')}</span><span><b>清空本地数据</b><small>图鉴点亮、遇见和在养的记录都会清空</small></span></button>`);
  const sv = $('#sSave', sh);
  if (sv) sv.onclick = async () => {
    const key = $('#sKey', sh).value.trim(); if (!key && SVC.configured) return closeSheet();
    try { const r = await fetch(API + '/api/config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ apiKey: key }) }); SVC = { ...SVC, ...(await r.json()) }; }
    catch { return toast('保存失败，本地服务没有响应'); }
    $('#svcDot').classList.toggle('ok', SVC.configured); closeSheet(); toast(SVC.configured ? '已保存，<b>真实识别</b>已开启' : '已清除 Key');
  };
  $('#sDemo', sh).onclick = () => { loadSample(); closeSheet(); toast('示例数据已载入'); rerender(); };
  $('#sClear', sh).onclick = () => { if (confirm('确定清空图鉴、足迹和阳台？')) { S = blank(); save(); closeSheet(); rerender(); toast('已清空'); } };
}
function loadSample() {
  const t = today(), ago = n => iso(new Date(t - n * DAY));
  const add = (id, n, place, note) => { const p = plantOf(id); if (!p) return; S.journal.push({ jid: id + n, plantId: id, name: p.cn, latin: p.latin, family: p.family, cat: p.cat, date: ago(n), place, note }); if (!S.collected[id]) S.collected[id] = { date: ago(n), place }; };
  add('ginkgo', 4, '小区门口', '一夜之间全黄了'); add('maple', 11, '公园湖边', ''); add('camphor', 20, '上班路上', '');
  add('osmanthus', 48, '楼下花坛', '先闻到香味才找到它'); add('dandelion', 30, '河边草地', ''); add('lotus', 120, '西湖', '');
  S.journal.sort((a, b) => b.date.localeCompare(a.date));
  const g = (id, name, every, n, since) => { if (plantOf(id) && !S.garden.some(x => x.plantId === id)) S.garden.push({ gid: id + 'g', plantId: id, name, every, last: ago(n), log: [ago(n)], added: ago(since), status: 'growing' }); };
  g('monstera', '大叶子', 7, 5, 210); g('snake', '老虎', 21, 9, 380); g('basil', '意面专用', 2, 2, 45);
  if (!S.garden.some(x => x.plantId === 'jade')) S.garden.push({ gid: 'jadeg', plantId: 'jade', name: '玉树', every: 14, last: ago(70), log: [ago(70)], added: ago(260), ended: ago(70), status: 'past' });
  save();
}
function openCredits() {
  openSheet(`<h2>图片来源</h2><p>所有植物照片来自 Wikimedia Commons，按各自的知识共享（CC）许可或公有领域使用；点作者名看原图，点许可名称看许可原文。</p>
    <div class="credits-list">${PLANTS.filter(p => p.photo).map(p => `${esc(p.cn)}：<a href="${esc(p.photo.page)}" target="_blank" rel="noopener">${esc(p.photo.author || '未署名')}</a> · ${licHtml(p.photo.license)}`).join('<br>')}</div>`);
}

// ───────────────────────── 拍照识别
function openCamSheet() {
  if (SVC.down) return showMaint();
  const sh = openSheet(`<h2>遇见了什么植物？</h2><p>让叶子或花占满画面，识别会更准。${SVC.public ? `今天还可以识别 ${SVC.remaining} 次。` : SVC.configured ? '' : '当前是演示模式，可以在设置里开启真实识别。'}</p>
    <div style="margin-top:14px;border-top:1px solid var(--rule)">
    <button class="opt" id="oCam"><span class="oi">${ic('cam')}</span><span><b>拍一张</b><small>手机上会直接打开相机</small></span></button>
    <button class="opt" id="oLib"><span class="oi">${ic('img')}</span><span><b>从相册选</b><small>以前拍过的植物照片也可以</small></span></button></div>`);
  $('#oCam', sh).onclick = () => $('#fileCam').click();
  $('#oLib', sh).onclick = () => $('#fileLib').click();
}
['#fileCam', '#fileLib'].forEach(s => $(s).onchange = e => { const f = e.target.files[0]; e.target.value = ''; if (f) { closeSheet(); startScan(f); } });
function shrink(file, max, q) {
  return new Promise((res, rej) => {
    const im = new Image();
    im.onload = () => { const k = Math.min(1, max / Math.max(im.width, im.height)); const cv = document.createElement('canvas'); cv.width = Math.round(im.width * k); cv.height = Math.round(im.height * k);
      cv.getContext('2d').drawImage(im, 0, 0, cv.width, cv.height); URL.revokeObjectURL(im.src); res(cv.toDataURL('image/jpeg', q)); };
    im.onerror = () => rej(new Error('图片读取失败'));
    im.src = URL.createObjectURL(file);
  });
}
let scanAbort = null;
async function startScan(file) {
  let big, thumb;
  try { [big, thumb] = await Promise.all([shrink(file, 1280, .85), shrink(file, 900, .8)]); }
  catch { return toast('这张图片打不开，换一张试试'); }
  await refreshSvc();
  if (SVC.down) return showMaint();
  const scan = $('#scan'); $('#scanImg').src = thumb; scan.classList.add('open'); document.body.classList.add('lock');
  const steps = ['观察叶形', '数一数花瓣和叶脉', '翻一翻图鉴', '找找它的亲戚', '整理冷知识'];
  let i = 0; $('#scanStatus').textContent = steps[0];
  $('#scanSub').textContent = SVC.configured ? 'IDENTIFYING WITH DEEPSEEK' : 'DEMO MODE · 结果不是真实识别';
  const tick = setInterval(() => { i = (i + 1) % steps.length; $('#scanStatus').textContent = steps[i]; }, 1500);
  scanAbort = new AbortController();
  const stop = () => { clearInterval(tick); scan.classList.remove('open'); if (!stack.length) document.body.classList.remove('lock'); };
  $('#scanCancel').onclick = () => { scanAbort.abort(); stop(); };
  try {
    const r = SVC.configured ? await identify(big.split(',')[1], scanAbort.signal) : await demoIdentify(scanAbort.signal);
    stop();
    if (!r.is_plant) { const sh = openSheet(`<h2>好像没看到植物</h2><p>${esc(r.clues || '照片里没有找到明显的植物。')}换个角度，让叶子或花占满画面再试一次。</p><button class="btn ink" id="again">${ic('cam')}再拍一张</button>`); $('#again', sh).onclick = () => $('#fileCam').click(); return; }
    if (typeof r._remaining === 'number') SVC.remaining = r._remaining;
    showResult(r, thumb);
  } catch (err) {
    stop(); if (scanAbort.signal.aborted) return;
    const sh = openSheet(`<h2>识别没成功</h2><p>${esc(err.message || '未知错误')}</p><button class="btn out" id="eSet">检查设置</button>`);
    $('#eSet', sh).onclick = openSettings;
  }
}
async function identify(b64, signal) {
  let r;
  try { r = await fetch(API + '/api/identify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ image: b64 }), signal }); }
  catch (e) { if (signal.aborted) throw e; throw new Error('本地服务没有响应，确认 server.py 正在运行。'); }
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.message || `识别服务出错（${r.status}）`);
  return data;
}
function demoIdentify(signal) {
  return new Promise((res, rej) => {
    const t = setTimeout(() => { const p = PLANTS[Math.floor(Math.random() * PLANTS.length)];
      res({ is_plant: true, library_id: p.id, name_cn: p.cn, name_latin: p.latin, family_cn: p.family, category: p.cat, confidence: 'medium', clues: '', persona: p.persona, facts: p.facts, kin: p.kin && p.kin.text, care_tip: '', look_alikes: [], demo: true }); }, 2600);
    signal.addEventListener('abort', () => { clearTimeout(t); rej(new Error('aborted')); });
  });
}

// ───────────────────────── 文章：识别报告
const CONF = { high: ['很有把握', '#2E6B52'], medium: ['比较像', '#A07410'], low: ['不太确定', '#B23A24'] };
function showResult(r, photo, saved) {
  const lib = plantOf(r.library_id), c = catOf(lib ? lib.cat : r.category);
  const facts = lib ? lib.facts : (r.facts || []), persona = lib ? lib.persona : r.persona, kinText = lib ? lib.kin && lib.kin.text : r.kin;
  const first = lib && !S.collected[lib.id];
  const [cl, cc] = CONF[r.confidence] || CONF.medium;
  const kicker = r.lookup ? (lib ? '图鉴里有它' : 'AI 查询 · 图鉴尚未收录') : saved ? `${fmt(saved.date)} 的遇见` : r.demo ? '演示结果' : first ? '新遇见 · 图鉴 +1' : lib ? '又见面了' : '图鉴外的新朋友';
  const meta = r._meta || {};
  const el = openArticle(`
    ${aBar(r.lookup ? 'AI 查询 · Lookup' : '识别报告 · Field report', c.en)}
    <div class="page">
      <div class="opener">
        <figure class="o-img bleed-l sr"><div class="ph">${photo ? raw(photo) : lib ? img(lib) : `<div class="ai-art">${window.BOTANY ? (['tree', 'flower', 'herb'].includes(r.category) ? BOTANY.branchArt('#1F4D3A', 1.1) : BOTANY.fernArt('#1F4D3A', 1.1)) : ''}</div>`}</div>
          ${r.lookup && lib ? credit(lib) : `<div class="credit">${r.lookup ? '图鉴尚未收录，这里只有线描示意' : saved ? '我拍的照片' : '你刚拍的照片'}${saved && saved.place ? ' · ' + esc(saved.place) : ''}</div>`}</figure>
        <div class="txt">
          <span class="kicker spot">${kicker}</span>
          <h1>${esc(r.name_cn)}</h1>
          <div class="latin">${esc(r.name_latin)}</div>
          <div class="byline"><span class="conf" style="color:${cc}">${cl}</span><span>${c.name}</span><span>${esc(r.family_cn)}</span></div>
          ${persona ? `<span class="lead-label">${esc(r.name_cn)} 说</span><p class="lead">${esc(persona)}</p>` : ''}
          ${lib && lib.photo && photo ? `<div class="compare" data-lib><img src="${lib.photo.src}" alt=""><span><b>图鉴里的${esc(lib.cn)}</b>对照看看 · ${NO(lib)} →</span></div>` : ''}
        </div>
      </div>
      <div class="a-body">
        <aside class="a-aside"><div class="dossier">
          <div><small>识别结果</small><b>${esc(r.name_cn)}</b></div>
          <div><small>学名</small><b class="latin">${esc(r.name_latin)}</b></div>
          <div><small>科</small><b>${esc(r.family_cn)}</b></div>
          <div><small>把握程度</small><b style="color:${cc}">${cl}</b></div>
          <div><small>内容来源</small><b>${lib ? '图鉴已收录，经过核对' : 'AI 生成，仅供参考'}</b></div>
          ${meta.model ? `<div><small>识别模型</small><b>${esc(meta.model)} · ${meta.seconds}s</b></div>` : ''}
        </div></aside>
        <div class="a-main">
          ${r.demo ? `<div class="demo">演示模式没有真正分析你的照片，这是从图鉴里随机抽的一种。配置 DeepSeek API Key 后就能真实识别。</div>` : ''}
          ${!r.demo && r.clues ? `<section class="a-sec"><span class="kicker">${r.lookup ? '怎么认出它' : '我是怎么认出来的'}</span><p class="clue">${esc(r.clues)}</p>
            ${(r.look_alikes || []).length ? `<div class="alike">容易混淆　${r.look_alikes.map(x => `<span>${esc(x)}</span>`).join('')}</div>` : ''}</section>` : ''}
          ${facts.length ? factsHTML(facts) : ''}
          ${kinText ? `<section class="a-sec"><span class="kicker">亲戚关系</span><p class="body-p">${esc(kinText)}</p></section>` : ''}
          ${lib && lib.home && lib.care ? careHTML(lib) : r.care_tip ? `<section class="a-sec"><span class="kicker">养护建议</span><p class="body-p">${esc(r.care_tip)}</p></section>` : ''}
          <div style="height:90px"></div>
        </div>
      </div>
    </div>
    <div class="a-actions">
      ${r.lookup ? (lib ? `<button class="btn ink" data-lib>读图鉴全文</button>` : `<button class="btn ink" data-cam>${ic('cam')}遇见了就拍下来</button>`)
        : saved ? (lib ? `<button class="btn out" data-lib>读图鉴全文</button>` : '') : `<button class="btn ink" data-keep>${ic('pin')}${lib ? '收进图鉴' : '记进足迹'}</button>`}
      ${lib && lib.home && lib.care && !S.garden.some(g => g.plantId === lib.id) ? `<button class="btn out" data-own>${ic('pot')}我也养了</button>` : ''}
    </div>`);
  $$('[data-lib]', el).forEach(b => b.onclick = () => openDetail(lib.id));
  $$('[data-cam]', el).forEach(b => b.onclick = () => { closeArticle(el); openCamSheet(); });
  const keep = $('[data-keep]', el);
  if (keep) keep.onclick = () => {
    const sh = openSheet(`<h2>在哪儿遇见的？</h2><p>选填，留着以后翻足迹的时候看。</p>
      <div class="field"><label>地点</label><input id="kPlace" placeholder="比如：公司楼下"></div>
      <div class="field"><label>一句话</label><input id="kNote" placeholder="比如：第一次见到它开花"></div>
      <button class="btn ink" id="kOk">${ic('check')}保存</button>`);
    $('#kOk', sh).onclick = () => {
      const { _meta, ...ai } = r;
      record({ plantId: lib ? lib.id : null, name: r.name_cn, latin: r.name_latin, family: r.family_cn, cat: lib ? lib.cat : r.category, place: $('#kPlace', sh).value.trim(), note: $('#kNote', sh).value.trim(), photo, ai, demo: !!r.demo });
      closeSheet(); closeArticle(el); toast(first ? `点亮了 <b>${esc(r.name_cn)}</b>` : '已记进足迹'); rerender();
    };
  };
  const own = $('[data-own]', el); if (own) own.onclick = () => addToGarden(lib.id, () => own.remove());
}

// ───────────────────────── 全站搜索
const norm = s => String(s || '').toLowerCase().replace(/\s+/g, '');
const SEARCH_HINTS = ['银杏', '多肉', '有毒', '活化石', '入侵', '蕨', '诗经', '会动'];
function searchPlants(q) {
  const k = norm(q); if (!k) return { hits: [], text: [] };
  const hits = [], text = [];
  for (const p of PLANTS) {
    const cn = norm(p.cn), al = (p.alias || []).map(norm), la = norm(p.latin), fa = norm(p.family), cat = norm(catOf(p.cat).name);
    let s = 0, why = '';
    if (cn === k) s = 100; else if (cn.startsWith(k)) s = 85; else if (cn.includes(k)) s = 70;
    else if (al.some(a => a === k)) { s = 65; why = '别名'; } else if (al.some(a => a.includes(k))) { s = 55; why = '别名'; }
    else if (la.includes(k) || norm(p.id) === k) { s = 45; why = '学名'; }
    else if (fa.includes(k)) { s = 30; why = '同科'; }
    else if (cat.includes(k)) { s = 25; why = '分类'; }
    if (s) { hits.push({ p, s, why }); continue; }
    const f = [p.persona, ...(p.facts || []), p.kin && p.kin.text, p.origin, p.care && p.care.tip, p.poem && (p.poem.line + p.poem.src)].find(x => x && norm(x).includes(k));
    if (f) text.push({ p, snip: f });
  }
  hits.sort((a, b) => b.s - a.s || PLANTS.indexOf(a.p) - PLANTS.indexOf(b.p));
  return { hits, text };
}
const markQ = (s, q) => { const t = esc(s); const k = esc(q.trim()); if (!k) return t; return t.split(k).join(`<mark>${k}</mark>`); };
const around = (s, q) => { const i = s.indexOf(q.trim()); return i > 26 ? '…' + s.slice(i - 22) : s; };
const srow = (p, sub, extra = '') => `<button class="srow" data-pid="${p.id}"><span class="ph">${img(p)}</span>
  <span><b>${esc(p.cn)}</b><span class="latin">${esc(p.latin)}</span><span class="sub">${sub}</span>${extra}</span><span class="go">读全文 →</span></button>`;

function openSearch(q = '') {
  const L = $('#srch');
  L.innerHTML = `<div class="page">
    <div class="srch-top"><span class="kicker spot">搜索 · ${PLANTS.length} 种植物</span><button class="srch-close" id="srchX">关闭 <kbd>Esc</kbd></button></div>
    <div class="srch-in"><input id="srchQ" placeholder="想认识哪种植物？" autocomplete="off" value="${esc(q)}"></div>
    <div class="srch-hint">试试${SEARCH_HINTS.map(h => `<button data-h="${h}">${h}</button>`).join('')}</div>
    <div id="srchR"></div></div>`;
  L.classList.add('open'); L.setAttribute('aria-hidden', 'false'); document.body.classList.add('lock'); L.scrollTop = 0;
  const inp = $('#srchQ', L); setTimeout(() => inp.focus(), 80);
  let sel = 0;
  const rows = () => $$('.srow', L);
  const mark = () => rows().forEach((r, i) => r.classList.toggle('act', i === sel));
  const draw = () => {
    const v = inp.value.trim(), R = $('#srchR', L);
    if (!v) {
      const m = today().getMonth() + 1, ps = PLANTS.filter(p => inSeason(p, m)).slice(0, 6);
      R.innerHTML = `<section class="srch-sec"><h3>这个月正当时<span>${ps.length}</span></h3>${ps.map(p => srow(p, `${esc(p.season.type)} · ${monthsLabel(p.season.months)}`)).join('')}</section>`;
    } else {
      const { hits, text } = searchPlants(v);
      R.innerHTML = (hits.length ? `<section class="srch-sec"><h3>图鉴里的植物<span>${hits.length}</span></h3>${hits.slice(0, 40).map(({ p, why }) =>
            srow(p, `${catOf(p.cat).name} · ${esc(p.family)}${why === '别名' ? ` · 也叫 ${markQ((p.alias || []).find(a => norm(a).includes(norm(v))) || '', v)}` : why ? ` · 按${why}匹配` : ''}`)).join('')}</section>` : '')
        + (text.length ? `<section class="srch-sec"><h3>在内容里提到「${esc(v)}」<span>${text.length}</span></h3>${text.slice(0, 30).map(({ p, snip }) =>
            srow(p, `${catOf(p.cat).name} · ${esc(p.family)}`, `<span class="snip">${markQ(around(snip, v), v)}</span>`)).join('')}</section>` : '')
        + (!hits.length && text.length ? `<p class="srch-more">没有名叫「${esc(v)}」的植物。${SVC.configured ? `<button id="srchAi">用 AI 查一查这个名字</button>` : ''}<span id="srchAiMsg"></span></p>` : '')
        + (!hits.length && !text.length ? `<div class="srch-none"><div><h4>图鉴里还没有「${esc(v)}」</h4>
            <p>${SVC.configured ? '可以请 DeepSeek 按名字查一查这种植物，结果会标明是 AI 生成的内容。' : SVC.down ? '识别服务暂时维护中，AI 查询稍后再试。' : '配置 DeepSeek API Key 后，可以按名字请 AI 查一查。'}${SVC.down ? '' : '遇见实物的话，拍张照识别会更准。'}</p>
            <div class="acts">${SVC.configured ? `<button class="btn ink" id="srchAi">${ic('spark')}用 AI 查一查「${esc(v)}」</button>` : ''}${SVC.down ? '' : `<button class="btn out" id="srchCam">${ic('cam')}拍照识别</button>`}</div>
            <p id="srchAiMsg"></p></div></div>` : '');
      const ai = $('#srchAi', L); if (ai) ai.onclick = () => aiLookup(v);
      const cm = $('#srchCam', L); if (cm) cm.onclick = () => { closeSearch(); openCamSheet(); };
    }
    rows().forEach(r => r.onclick = () => { closeSearch(); openDetail(r.dataset.pid); });
    sel = 0; mark();
  };
  inp.oninput = draw;
  inp.onkeydown = e => {
    const rs = rows();
    if (e.key === 'ArrowDown') { e.preventDefault(); sel = Math.min(rs.length - 1, sel + 1); mark(); rs[sel] && rs[sel].scrollIntoView({ block: 'nearest' }); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); sel = Math.max(0, sel - 1); mark(); rs[sel] && rs[sel].scrollIntoView({ block: 'nearest' }); }
    else if (e.key === 'Enter') { e.preventDefault(); if (rs[sel]) rs[sel].click(); else if ($('#srchAi', L)) $('#srchAi', L).click(); }
  };
  $$('[data-h]', L).forEach(b => b.onclick = () => { inp.value = b.dataset.h; draw(); inp.focus(); });
  $('#srchX', L).onclick = closeSearch;
  refreshSvc().then(() => { if (inp.value.trim()) draw(); });
  draw();
}
function closeSearch() {
  const L = $('#srch'); L.classList.remove('open'); L.setAttribute('aria-hidden', 'true');
  if (!stack.length) document.body.classList.remove('lock');
}
async function aiLookup(name) {
  const msg = $('#srchAiMsg'), btn = $('#srchAi');
  if (btn) btn.disabled = true;
  msg.innerHTML = `<span class="ai-loading"><i></i>正在请 DeepSeek 查「${esc(name)}」…</span>`;
  try {
    const r = await fetch(API + '/api/lookup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.message || `查询失败（${r.status}）`);
    if (!d.is_plant) { msg.textContent = d.clues || '这好像不是一种植物。'; if (btn) btn.disabled = false; return; }
    if (typeof d._remaining === 'number') SVC.remaining = d._remaining;
    d.lookup = true; closeSearch(); showResult(d, null);
  } catch (e) { msg.innerHTML = `<span style="color:#B23A24">${esc(e.message)}</span>`; if (btn) btn.disabled = false; }
}

// ───────────────────────── 启动
masthead();
refreshSvc();
go('home');
})();
