// 植遇 · 植物线描生成器：叶片、蕨叶、枝条、银杏叶，以及由它们组成的纹样
// 所有图形都是细线描（无填充），颜色和粗细由调用方决定
(function () {
  const f = n => +n.toFixed(2);

  // 一片带叶脉的叶子：以 (0,0) 为叶柄，朝 -y 方向生长
  function leaf(L, W, veins = 3) {
    const out = `M0,0 C${f(W * .62)},${f(-L * .22)} ${f(W * .58)},${f(-L * .74)} 0,${f(-L)} C${f(-W * .58)},${f(-L * .74)} ${f(-W * .62)},${f(-L * .22)} 0,0`;
    let v = `M0,${f(L * .08)} L0,${f(-L * .92)}`;
    for (let i = 1; i <= veins; i++) {
      const t = .18 + i * (.6 / (veins + 1)) + .05;
      const w = Math.sin(Math.PI * Math.min(.95, t + .08)) * W * .4;
      v += ` M0,${f(-L * t)} Q${f(w * .5)},${f(-L * (t + .05))} ${f(w)},${f(-L * (t + .12))}`;
      v += ` M0,${f(-L * t)} Q${f(-w * .5)},${f(-L * (t + .05))} ${f(-w)},${f(-L * (t + .12))}`;
    }
    return out + ' ' + v;
  }
  const at = (d, x, y, r = 0, s = 1) => `<path d="${d}" transform="translate(${f(x)} ${f(y)}) rotate(${f(r)}) scale(${s})"/>`;

  // 二次贝塞尔上的点与切线角
  function qpt(p0, p1, p2, t) {
    const x = (1 - t) ** 2 * p0[0] + 2 * (1 - t) * t * p1[0] + t * t * p2[0];
    const y = (1 - t) ** 2 * p0[1] + 2 * (1 - t) * t * p1[1] + t * t * p2[1];
    const dx = 2 * (1 - t) * (p1[0] - p0[0]) + 2 * t * (p2[0] - p1[0]);
    const dy = 2 * (1 - t) * (p1[1] - p0[1]) + 2 * t * (p2[1] - p1[1]);
    return [x, y, Math.atan2(dy, dx) * 180 / Math.PI];
  }

  // 蕨叶：一根弯曲的叶轴，两侧交替长出逐渐变小的羽片
  function fern(H = 300, bend = 60, n = 22) {
    const p0 = [0, 0], p1 = [bend * .2, -H * .55], p2 = [bend, -H];
    let g = `<path d="M0,0 Q${f(p1[0])},${f(p1[1])} ${f(p2[0])},${f(p2[1])}"/>`;
    for (let i = 1; i <= n; i++) {
      const t = .06 + (i / (n + 1)) * .92;
      const [x, y, a] = qpt(p0, p1, p2, t);
      const size = (1 - t) * .9 + .12;
      const L = H * .19 * size, W = L * .34;
      const side = i % 2 ? 1 : -1;
      g += at(leaf(L, W, 2), x, y, a + side * 62 + 90, 1);
    }
    g += at(leaf(H * .05, H * .02, 1), p2[0], p2[1], qpt(p0, p1, p2, 1)[2] + 90, 1);
    return g;
  }

  // 枝条：一根枝，对生的椭圆叶
  function branch(H = 220, bend = -40, pairs = 6) {
    const p0 = [0, 0], p1 = [bend * .1, -H * .5], p2 = [bend, -H];
    let g = `<path d="M0,0 Q${f(p1[0])},${f(p1[1])} ${f(p2[0])},${f(p2[1])}"/>`;
    for (let i = 1; i <= pairs; i++) {
      const t = i / (pairs + .6);
      const [x, y, a] = qpt(p0, p1, p2, t);
      const L = H * .2 * (1 - t * .35), W = L * .42;
      g += at(leaf(L, W, 2), x, y, a + 90 + 48, 1) + at(leaf(L, W, 2), x, y, a + 90 - 48, 1);
    }
    g += at(leaf(H * .16, H * .065, 2), p2[0], p2[1], qpt(p0, p1, p2, 1)[2] + 90, 1);
    return g;
  }

  // 银杏叶：扇形，放射状叶脉，顶端有缺刻
  function ginkgo(R = 60) {
    // 叶缘：两侧内凹的弧线 + 顶端轻微起伏，中间一道缺刻
    let d = `M0,0 C${f(-R * .12)},${f(-R * .18)} ${f(-R * .5)},${f(-R * .48)} ${f(-R * .82)},${f(-R * .66)}` +
      ` C${f(-R * .78)},${f(-R * .9)} ${f(-R * .42)},${f(-R * 1.04)} ${f(-R * .2)},${f(-R * .98)}` +
      ` C${f(-R * .1)},${f(-R * .96)} ${f(-R * .04)},${f(-R * .86)} 0,${f(-R * .74)}` +
      ` C${f(R * .04)},${f(-R * .86)} ${f(R * .1)},${f(-R * .96)} ${f(R * .2)},${f(-R * .98)}` +
      ` C${f(R * .42)},${f(-R * 1.04)} ${f(R * .78)},${f(-R * .9)} ${f(R * .82)},${f(-R * .66)}` +
      ` C${f(R * .5)},${f(-R * .48)} ${f(R * .12)},${f(-R * .18)} 0,0 M0,0 C${f(R * .02)},${f(R * .25)} ${f(-R * .04)},${f(R * .45)} ${f(R * .03)},${f(R * .62)}`;
    // 二叉状叶脉：从叶基向外弯曲放射
    for (let k = -5; k <= 5; k++) {
      if (k === 0) continue;
      const a = k * 8.2 * Math.PI / 180, r = R * (.86 - Math.abs(k) * .025);
      const ex = Math.sin(a) * r * 1.02, ey = -Math.cos(a) * r;
      d += ` M0,${f(-R * .04)} Q${f(ex * .25)},${f(ey * .55)} ${f(ex)},${f(ey)}`;
    }
    return `<path d="${d}"/>`;
  }

  const svg = (vb, inner, stroke, sw = 1, extra = '') =>
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" ${extra}><g fill="none" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">${inner}</g></svg>`;
  const uri = s => `url("data:image/svg+xml;charset=utf-8,${encodeURIComponent(s)}")`;

  // 幕帘纹样：散落的叶片、小蕨、银杏叶（可无缝平铺）
  function curtainTile(stroke) {
    const g =
      `<g transform="translate(40 120) rotate(-28)">${fern(110, 22, 12)}</g>` +
      `<g transform="translate(150 60) rotate(32) scale(.55)">${ginkgo(60)}</g>` +
      at(leaf(46, 18, 3), 175, 190, 145) + at(leaf(34, 13, 2), 110, 175, -60) +
      `<g transform="translate(205 140) rotate(-12) scale(.5)">${branch(140, -20, 4)}</g>` +
      at(leaf(28, 11, 2), 90, 40, 70) + at(leaf(22, 9, 1), 20, 200, 20);
    return svg('0 0 240 240', g, stroke, .9, 'width="240" height="240"');
  }

  // 刊头下的藤蔓线
  function vineRule(stroke) {
    // 一根舒展的波浪藤，叶片疏密、大小、朝向都错开，避免机械重复
    const g = `<path d="M0,12 C50,7 90,17 140,12 S240,7 290,12 S370,16 420,12"/>` +
      `<path d="M58,10.4 q6,-6 14,-7"/>` +
      at(leaf(13, 6, 2), 72, 3.6, 72) + at(leaf(9, 4.5, 1), 96, 13.6, 128) +
      at(leaf(15, 7, 2), 205, 9, 58) + at(leaf(10, 5, 1), 214, 9.4, 112) +
      `<path d="M330,13.6 q4,5 11,6"/>` + at(leaf(11, 5, 1), 341, 19.6, 98);
    return svg('0 0 420 24', g, stroke, .75, 'width="420" height="24"');
  }

  // 银杏叶光标：柔和的秋黄色扇形叶，放射状叶脉，一根短叶柄
  function ginkgoCursor() {
    const R = 13.5, X = 16, Y = 19;
    const P = (x, y) => `${f(X + x * R)},${f(Y + y * R)}`;
    const fan = `M${P(0, 0)} C${P(-.12, -.18)} ${P(-.5, -.48)} ${P(-.84, -.66)} C${P(-.8, -.92)} ${P(-.42, -1.06)} ${P(-.2, -1)}` +
      ` C${P(-.1, -.98)} ${P(-.04, -.88)} ${P(0, -.76)} C${P(.04, -.88)} ${P(.1, -.98)} ${P(.2, -1)}` +
      ` C${P(.42, -1.06)} ${P(.8, -.92)} ${P(.84, -.66)} C${P(.5, -.48)} ${P(.12, -.18)} ${P(0, 0)} Z`;
    let veins = '';
    for (let k = -3; k <= 3; k++) { if (!k) continue; const a = k * 11 * Math.PI / 180; veins += ` M${P(0, -.05)} Q${P(Math.sin(a) * .22, -.45)} ${P(Math.sin(a) * .8, -Math.cos(a) * .82)}`; }
    const stem = `M${P(0, 0)} Q${P(.04, .3)} ${P(.12, .62)}`;
    return `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><g transform="rotate(-22 16 16)">` +
      `<path d="${stem}" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/><path d="${stem}" fill="none" stroke="#9A8237" stroke-width="1.2" stroke-linecap="round"/>` +
      `<path d="${fan}" fill="#D6BE6A" stroke="#fff" stroke-width="1.2" stroke-linejoin="round"/>` +
      `<path d="${veins}" fill="none" stroke="#A88D3E" stroke-width=".55" stroke-linecap="round" opacity=".75"/></g></svg>`;
  }
  const mapleSvg = ginkgoCursor();

  window.BOTANY = { leaf, fern, branch, ginkgo, svg, uri, at, mapleSvg,
    sprig: (stroke, sw = 1.2) => svg('-40 -110 80 120', `<g transform="rotate(8)">${branch(95, -12, 3)}</g>`, stroke, sw),
    fernArt: (stroke, sw = .8) => svg('-60 -330 200 340', fern(320, 70, 24), stroke, sw),
    branchArt: (stroke, sw = .8) => svg('-110 -250 160 260', branch(240, -60, 7), stroke, sw),
    ginkgoArt: (stroke, sw = .9) => svg('-70 -70 140 110', ginkgo(60), stroke, sw),
  };

  // 把纹样写进 CSS 变量，供样式表使用
  const root = document.documentElement.style;
  root.setProperty('--curtain', uri(curtainTile('rgba(31,77,58,.42)')));
  root.setProperty('--vine', uri(vineRule('rgba(31,77,58,.85)')));
  root.setProperty('--fern-faint', uri(window.BOTANY.fernArt('rgba(31,77,58,.16)', .7)));
  root.setProperty('--branch-faint', uri(window.BOTANY.branchArt('rgba(31,77,58,.2)', .7)));
  root.setProperty('--fleuron', uri(window.BOTANY.sprig('#1F4D3A', 1.4)));
  root.setProperty('--leaf-cursor', `url("data:image/svg+xml;charset=utf-8,${encodeURIComponent(mapleSvg)}") 15 12, pointer`);

  // 网页图标：一片叶子
  const ico = document.createElement('link'); ico.rel = 'icon';
  ico.href = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg('-30 -64 60 72', leaf(58, 30, 3), '#1F4D3A', 3.2));
  document.head.appendChild(ico);
})();
