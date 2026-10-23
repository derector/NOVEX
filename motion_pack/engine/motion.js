/* motion.js v3 — помощник страницы и набор приёмов. Подключается после gsap. Вся анимация живёт в M.tl. */
(function () {
  const stage = document.getElementById('stage'), d = stage.dataset;
  const W = +d.width, H = +d.height, fps = +(d.fps || 30), D = +d.duration;
  const k = Math.min(W, H) / 1080, NS = 'http://www.w3.org/2000/svg', PI2 = Math.PI * 2;
  const SAFE = { social: [288, 192, 672, 120], reels: [269, 65, 672, 65], tiktok: [240, 120, 660, 120],
    shorts: [288, 192, 672, 48], feed: [100, 80, 100, 80], none: [0, 0, 0, 0] };
  let s = d.safe === 'broadcast' ? [H * 0.05, W * 0.05, H * 0.05, W * 0.05]
    : SAFE[d.safe] ? SAFE[d.safe].map(v => v * k)
    : d.safe ? d.safe.split(',').map(Number) : SAFE.none;
  s = s.map(Math.round);
  ['t', 'r', 'b', 'l'].forEach((n, i) => stage.style.setProperty('--safe-' + n, s[i] + 'px'));
  stage.style.setProperty('--u', W / 100 + 'px');
  const css = document.createElement('style');            // базовые правила живут здесь, чтобы их нельзя было потерять
  css.textContent = `html,body{margin:0;background:transparent}
#stage{position:relative;overflow:hidden;width:${W}px;height:${H}px}
.bg,.scene,.fill{position:absolute;inset:0}
.safe{position:absolute;top:var(--safe-t);right:var(--safe-r);bottom:var(--safe-b);left:var(--safe-l);display:flex;flex-direction:column;justify-content:center}
.win{position:absolute;overflow:hidden}
img[data-footage]{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
svg.mo-ov{position:absolute;left:0;top:0;overflow:visible;pointer-events:none}
.mo-l-mask{overflow-clip-margin:.2em}
.mo-cap{position:absolute;inset:0;display:flex;justify-content:center;align-items:center}
.mo-capl{display:flex;flex-wrap:wrap;gap:0 .32em;justify-content:center;text-align:center}
.mo-capl span{display:inline-block}
.mo-cur{position:absolute;width:.09em;height:1em;background:currentColor}
.mo-icon{display:block;width:100%;height:100%;overflow:visible}`;
  document.head.prepend(css);
  gsap.registerPlugin(...['CustomEase', 'SplitText', 'DrawSVGPlugin', 'MotionPathPlugin', 'MorphSVGPlugin'].map(n => window[n]).filter(Boolean));
  if (window.CustomEase) [['swift', '0.8,0,0.1,1'], ['glide', '0.22,1,0.36,1'], ['punch', '0.34,1.56,0.64,1'], ['ant', '0.36,-0.3,0.12,1']].forEach(e => CustomEase.create(e[0], e[1]));

  const q = t => (typeof t === 'string' ? stage.querySelector(t) : t);
  const qa = t => (typeof t === 'string' ? [...stage.querySelectorAll(t)] : t.nodeType ? [t] : [...t]);
  const tl = gsap.timeline({ paused: true, defaults: { ease: 'expo.out', duration: 0.5 } });
  const hooks = [], sfxList = [], marks = [], nudges = new Map();
  let fmap = {};
  const mk = (tag, attrs, parent) => { const e = document.createElementNS(NS, tag); for (const a in attrs) e.setAttribute(a, attrs[a]); if (parent) parent.appendChild(e); return e; };
  const box = (el, root, tight) => {                // рамка элемента в координатах кадра (или root) в покое: трансформации на время замера снимаются
    const st = [], off = e => { if (e.style && e.style.transform && e.style.transform !== 'none') { st.push([e, e.style.transform]); e.style.transform = 'none'; } };
    for (let e = el; e && e !== document.body; e = e.parentElement) off(e);
    if (tight) el.querySelectorAll('*').forEach(off);
    let r = el.getBoundingClientRect();
    if (tight && getComputedStyle(el).display !== 'inline') { const g = document.createRange(); g.selectNodeContents(el); const t = g.getBoundingClientRect(); if (t.width > 1) r = t; }
    const o = (root || stage).getBoundingClientRect();
    st.forEach(v => { v[0].style.transform = v[1]; });
    return { x: r.left - o.left, y: r.top - o.top, w: r.width, h: r.height, cx: r.left - o.left + r.width / 2, cy: r.top - o.top + r.height / 2 };
  };
  const pre = new WeakMap(), preK = {}; let kseq = 0;  // рамки, снятые до разбивки текста: SplitText режет вложенные элементы
  const rbox = (t, host) => { if (isBox(t)) return Object.assign({ cx: t.x + t.w / 2, cy: t.y + t.h / 2 }, t); const el = q(t), a = preK[el.dataset.moK] || pre.get(el) || box(el, null, true), h = host && host !== stage ? box(host) : { x: 0, y: 0 };
    return { x: a.x - h.x, y: a.y - h.y, w: a.w, h: a.h, cx: a.cx - h.x, cy: a.cy - h.y }; };
  const scenes = [], sceneAt = t => { const s2 = scenes.filter(v => v[1] <= t + 0.01).pop(); return s2 ? s2[0] : stage; };
  const isBox = t => t && typeof t === 'object' && !t.nodeType && !Array.isArray(t) && 'w' in t;
  const hostOf = el => (el && el.closest && el.closest('[data-layer],.scene')) || stage;
  const hostFor = (t, o) => (o.host ? q(o.host) : Array.isArray(t) || isBox(t) ? sceneAt(o.at || 0) : hostOf(q(t)));   // точки и рамки живут в сцене, которая на экране в момент at
  const layer = host => host.querySelector(':scope > svg.mo-ov') || mk('svg', { class: 'mo-ov', width: W, height: H, 'data-decor': '', style: host === stage ? 'z-index:800' : '' }, host);
  const spot = (v, host) => {                        // точка: [x,y] в px (или долях кадра, если оба ≤ 1) либо центр элемента
    if (Array.isArray(v)) return v[0] <= 1 && v[1] <= 1 ? [v[0] * W, v[1] * H] : v;
    const b = rbox(v, host); return [b.cx, b.cy];
  };
  const sfx = (o, def, t, x) => { const n = o.sfx === undefined ? def : o.sfx; if (n) M.sfx(n, t, x); };
  const move = (o, a, dur, size, land, g) => {       // звук перемещения из двух слоёв: подъезд с пиком на середине хода и низкий удар в момент остановки
    if (o.sfx === false) return; if (typeof o.sfx === 'string') return M.sfx(o.sfx, a + dur * 0.5);
    const nm = size > 1 ? 'sweep' : size ? 'whoosh' : 'swish', len = size > 1 ? 0.95 : size ? 0.55 : 0.26;
    M.sfx(nm, a + dur * 0.5, { rate: Math.max(0.75, Math.min(1.35, len / (dur * 1.15))), gain: g || 0 });
    if (land) M.sfx(size ? 'hit' : 'thock', a + dur * land, { gain: (g || 0) + (size > 1 ? 0 : size ? -4 : -2) });
  };
  const accent = o => o.color || 'var(--accent)', hf = 0.5 / fps;   // линия становится видимой на полкадра позже старта: нулевая длина даёт точку
  const split = (el, chars) => {
    let sp = el.__sp;
    if (!sp) { pre.set(el, box(el, null, true)); el.querySelectorAll('*').forEach(c => { c.dataset.moK = ++kseq; preK[kseq] = box(c, null, true); });
      sp = el.__sp = SplitText.create(el, { type: 'lines,words', mask: 'lines', linesClass: 'mo-l', wordsClass: 'mo-w' }); gsap.set(sp.masks, { overflow: 'visible' }); }
    if (chars && !sp.ch) sp.ch = SplitText.create(sp.words, { type: 'chars', charsClass: 'mo-c' }).chars;
    return sp;
  };
  const IN = { rise: { yPercent: 118 }, drop: { yPercent: -118 }, fade: { autoAlpha: 0, y: '0.4em' }, slide: { autoAlpha: 0, x: '-0.7em' },
    pop: { autoAlpha: 0, scale: 0.2 }, blur: { autoAlpha: 0, scale: 1.25, filter: 'blur(16px)' }, flip: { autoAlpha: 0, rotationX: -92 } };
  const REST = { yPercent: 0, y: 0, x: 0, autoAlpha: 1, scale: 1, rotationX: 0, filter: 'blur(0px)' };
  const rest = from => { const r = {}; for (const a in from) r[a] = REST[a]; return r; };
  const vis = (el, a, b) => { gsap.set(el, { visibility: a > 0 ? 'hidden' : 'inherit' }); if (a > 0) tl.set(el, { visibility: 'inherit' }, a); if (b != null && b < D) tl.set(el, { visibility: 'hidden' }, b); };

  const M = window.M = {
    W, H, fps, D, tl, k, safe: { top: s[0], right: s[1], bottom: s[2], left: s[3] }, data: { icons: {}, faces: {}, words: {} },
    f: n => n / fps,                               // кадры → секунды
    snap: t => Math.round(t * fps) / fps,          // время на сетку кадров
    box,
    rand(seed) {                                   // детерминированный генератор вместо Math.random
      let a = (seed || 1) >>> 0;
      return () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a);
        t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
    },
    scene(target, start, end) {                    // сцена видна только на [start, end)
      const el = q(target);
      vis(el, start, end); scenes.push([el, start]); scenes.sort((x, y) => x[1] - y[1]);
      tl.addLabel(el.id || 'scene@' + start, start);
      return el;
    },
    seq(list) {                                    // [['#s1',0], ['#s2',3.2,'push-left',{dur:.6}], …] — сцены и переходы между ними
      const ov = () => { const e = document.createElement('div'); e.className = 'fill'; e.setAttribute('data-decor', ''); e.style.zIndex = 900; e.style.pointerEvents = 'none'; stage.appendChild(e); return e; };
      list.forEach((it, i) => {
        const el = q(it[0]), t = it[1], type = it[2] || 'cut', o = it[3] || {}, nx = list[i + 1], prev = i ? q(list[i - 1][0]) : null;
        const cover = /^(bars|diag|circle)/.test(type), dur = type === 'cut' ? 0 : o.dur || (cover ? 0.8 : 0.65), a = t - dur / 2, dir = (type.split('-')[1] || 'left');
        const nd = nx && nx[2] && nx[2] !== 'cut' ? (nx[3] && nx[3].dur) || (/^(bars|diag|circle)/.test(nx[2]) ? 0.8 : 0.65) : 0;
        if (getComputedStyle(el).zIndex === 'auto') el.style.zIndex = i + 1;
        vis(el, !i || cover ? t : type === 'zoom' ? a + dur * 0.4 : a, nx ? nx[1] + (/^(bars|diag|circle)/.test(nx[2] || '') ? 0 : nd / 2) : null);
        tl.addLabel(el.id || 'scene@' + t, t); marks.push(t); scenes.push([el, t]); scenes.sort((x, y) => x[1] - y[1]);
        if (!i || type === 'cut') return;
        const ax = /up|down/.test(dir) ? 'yPercent' : 'xPercent', sg = /left|up/.test(dir) ? 1 : -1, ez = o.ease || 'swift';
        if (type.startsWith('push')) { tl.fromTo(el, { [ax]: 100 * sg }, { [ax]: 0, duration: dur, ease: ez }, a).to(prev, { [ax]: -100 * sg, duration: dur, ease: ez }, a); move(o, a, dur, 1, 0.8); }
        else if (type.startsWith('slide')) { tl.fromTo(el, { [ax]: 100 * sg }, { [ax]: 0, duration: dur, ease: ez }, a).to(prev, { [ax]: -24 * sg, duration: dur, ease: ez }, a); move(o, a, dur, 1, 0.8); }
        else if (type === 'zoom') { tl.to(prev, { scale: 1.7, opacity: 0, duration: dur * 0.5, ease: 'power3.in' }, a).fromTo(el, { scale: 0.55, opacity: 0 }, { scale: 1, opacity: 1, duration: dur * 0.6, ease: 'expo.out' }, a + dur * 0.4); move(o, a, dur, 1, 0.62, 2); }
        else if (type === 'iris') { const x = (o.x == null ? 0.5 : o.x) * 100, y = (o.y == null ? 0.5 : o.y) * 100; tl.fromTo(el, { clipPath: `circle(0% at ${x}% ${y}%)` }, { clipPath: `circle(150% at ${x}% ${y}%)`, duration: dur, ease: o.ease || 'power3.inOut' }, a).set(el, { clipPath: 'none' }, a + dur); sfx(o, 'swell', t); sfx(o, 'shimmer', a, { gain: -3 }); }
        else if (type.startsWith('wipe')) { const c = { left: ['0 0 0 100%'], right: ['0 100% 0 0'], up: ['100% 0 0 0'], down: ['0 0 100% 0'] }[dir][0]; tl.fromTo(el, { clipPath: `inset(${c})` }, { clipPath: 'inset(0 0 0 0%)', duration: dur, ease: ez }, a).set(el, { clipPath: 'none' }, a + dur); move(o, a, dur, 1, 0.8); }
        else if (cover) {
          const host = ov(), cols = o.colors || ['var(--accent)', 'var(--fg)'], h = dur / 2;
          if (type.startsWith('bars')) { const n = o.n || 5, vert = /up|down/.test(dir);
            for (let j = 0; j < n; j++) { const b = document.createElement('div'); b.style.cssText = `position:absolute;background:${cols[j % cols.length]};` + (vert ? `top:0;bottom:0;left:${j * 100 / n}%;width:${100 / n + 0.2}%` : `left:0;right:0;top:${j * 100 / n}%;height:${100 / n + 0.2}%`); host.appendChild(b);
              const p = vert ? 'scaleY' : 'scaleX', o1 = vert ? (sg > 0 ? '50% 100%' : '50% 0%') : (sg > 0 ? '100% 50%' : '0% 50%'), o2 = vert ? (sg > 0 ? '50% 0%' : '50% 100%') : (sg > 0 ? '0% 50%' : '100% 50%'), st = j * h * 0.4 / n;
              tl.fromTo(b, { [p]: 0, transformOrigin: o1 }, { [p]: 1, duration: h * 0.6, ease: 'power3.inOut' }, a + st).set(b, { transformOrigin: o2 }, t + st).to(b, { [p]: 0, duration: h * 0.6, ease: 'power3.inOut' }, t + st + 0.001); } }
          else if (type.startsWith('diag')) cols.slice(0, 2).forEach((c, j) => { const b = document.createElement('div'); b.style.cssText = `position:absolute;top:-10%;bottom:-10%;left:-40%;width:180%;background:${c};transform:skewX(-14deg)`; host.appendChild(b);
            tl.fromTo(b, { xPercent: 112 * sg }, { xPercent: -112 * sg, duration: dur * (1 - j * 0.12), ease: 'power2.inOut' }, a + j * dur * 0.12); });
          else { const x = (o.x == null ? 0.5 : o.x) * 100, y = (o.y == null ? 0.5 : o.y) * 100; host.style.background = cols[0];
            tl.fromTo(host, { clipPath: `circle(0% at ${x}% ${y}%)` }, { clipPath: `circle(150% at ${x}% ${y}%)`, duration: h, ease: 'power3.in' }, a).to(host, { autoAlpha: 0, duration: h * 0.7, ease: 'power2.out' }, t); }
          move(o, a, dur, 1, 0.52, 1);
        }
      });
    },
    text(target, o = {}) {                         // вход текста: {at, in: rise|drop|fade|slide|pop|blur|flip|type, by: lines|words|chars, stagger, dur, ease, cps, cursor}
      const kind = o.in || 'rise', by = o.by || (kind === 'type' ? 'chars' : 'words'); let end = o.at || 0;
      qa(target).forEach((el, n) => {
        const sp = split(el, by === 'chars'), parts = by === 'chars' ? sp.ch : by === 'lines' ? sp.lines : sp.words, t0 = (o.at || 0) + n * (o.gap == null ? 0.12 : o.gap);
        if (kind === 'type') {
          const cps = o.cps || 22; gsap.set(parts, { autoAlpha: 0 });
          parts.forEach((c, i) => { tl.set(c, { autoAlpha: 1 }, t0 + i / cps); if (cps <= 16 || i % 2 === 0) sfx(o, 'key', t0 + i / cps); if (i % 6 === 0) marks.push(t0 + i / cps); });
          end = Math.max(end, t0 + parts.length / cps);
          if (o.cursor !== false) { const cur = document.createElement('span'); cur.className = 'mo-cur'; cur.setAttribute('data-decor', ''); if (getComputedStyle(el).position === 'static') el.style.position = 'relative'; el.appendChild(cur);
            const tE = t0 + parts.length / cps + (o.cursorHold == null ? 0.8 : o.cursorHold);
            hooks.push(t => { const i = Math.min(parts.length - 1, Math.floor((t - t0) * cps)), on = t >= t0 - 0.3 && t < tE && (t < t0 + parts.length / cps || Math.floor(t * 3) % 2 === 0);
              cur.style.visibility = on ? 'visible' : 'hidden'; if (!on) return; const c = parts[Math.max(0, i)], b = box(c, el); cur.style.left = (i < 0 ? b.x : b.x + b.w) + 'px'; cur.style.top = b.y + (b.h - cur.offsetHeight) / 2 + 'px'; }); }
          return;
        }
        const from = Object.assign({}, IN[kind] || IN.rise), masked = kind === 'rise' || kind === 'drop';
        if (kind === 'pop') from.transformOrigin = '50% 85%'; if (kind === 'flip') { from.transformOrigin = '50% 100%'; from.transformPerspective = 700; }
        const dur = o.dur || (kind === 'pop' ? 0.45 : by === 'chars' ? 0.45 : 0.6), stg = o.stagger == null ? (by === 'chars' ? 0.018 : by === 'lines' ? 0.09 : 0.05) : o.stagger;
        if (masked) { gsap.set(sp.masks, { overflow: 'clip' }); }
        tl.fromTo(parts, from, Object.assign(rest(from), { duration: dur, ease: o.ease || (kind === 'pop' ? 'back.out(2.2)' : 'expo.out'), stagger: stg }), t0);
        const tE = t0 + dur + stg * (parts.length - 1); end = Math.max(end, tE);
        if (masked) tl.set(sp.masks, { overflow: 'visible' }, tE + 0.01);
        if (kind === 'pop') { parts.slice(0, 8).forEach((p, i) => sfx(o, 'pop', t0 + i * stg, { rate: 0.9 + 0.04 * i })); if (parts.length > 2) sfx(o, 'hit', t0 + stg * Math.min(parts.length, 8) + dur * 0.25, { gain: -5 }); }
        else if (masked || kind === 'slide' || kind === 'flip') { sfx(o, 'swish', t0 + dur * 0.2, { gain: -2 }); sp.lines.forEach((l, i) => sfx(o, 'tap', t0 + i * 0.08 + dur * 0.3)); }
        else if (kind === 'blur') sfx(o, 'swell', t0 + dur * 0.5, { gain: -5 });
      });
      return end;
    },
    textOut(target, o = {}) {                      // выход текста: {at, out: rise|drop|fade|pop|blur, by, dur}
      const kind = o.out || 'rise', by = o.by || 'words';
      qa(target).forEach(el => {
        const sp = split(el, by === 'chars'), parts = by === 'chars' ? sp.ch : by === 'lines' ? sp.lines : sp.words, t0 = o.at || 0;
        const to = { rise: { yPercent: -118 }, drop: { yPercent: 118 }, fade: { autoAlpha: 0, y: '-0.3em' }, pop: { autoAlpha: 0, scale: 0.2 }, blur: { autoAlpha: 0, filter: 'blur(14px)' } }[kind];
        if (kind === 'rise' || kind === 'drop') tl.set(sp.masks, { overflow: 'clip' }, t0 - 0.01);
        tl.to(parts, Object.assign({ duration: o.dur || 0.3, ease: o.ease || 'power3.in', stagger: o.stagger == null ? 0.02 : o.stagger }, to), t0);
      });
    },
    show(target, o = {}) {                         // вход блоков целиком: {at, in: pop|rise|drop|slide|fade|wipe|grow|blur, stagger, dur, ease}
      const kind = o.in || 'pop', els = qa(target), at = o.at || 0, u = 70 * k;
      const from = { pop: { autoAlpha: 0, scale: 0.3 }, rise: { autoAlpha: 0, y: u }, drop: { autoAlpha: 0, y: -u }, slide: { autoAlpha: 0, x: -u * 1.4 }, fade: { autoAlpha: 0 }, blur: { autoAlpha: 0, scale: 1.2, filter: 'blur(18px)' },
        wipe: { clipPath: 'inset(0 100% 0 0)' }, grow: { scaleX: 0, transformOrigin: '0% 50%' } }[kind];
      const to = kind === 'wipe' ? { clipPath: 'inset(0 0% 0 0)' } : kind === 'grow' ? { scaleX: 1 } : rest(from), stg = o.stagger == null ? 0.07 : o.stagger;
      if (kind === 'wipe') { gsap.set(els, { autoAlpha: 0 }); tl.set(els, { autoAlpha: 1 }, at); }
      tl.fromTo(els, from, Object.assign(to, { duration: o.dur || (kind === 'pop' ? 0.5 : 0.6), ease: o.ease || (kind === 'pop' ? 'back.out(1.9)' : kind === 'wipe' || kind === 'grow' ? 'power3.inOut' : 'expo.out'), stagger: stg }), at);
      if (kind === 'pop') els.slice(0, 8).forEach((e, i) => sfx(o, 'pop', at + i * stg, { rate: 0.9 + 0.05 * i }));
      else { sfx(o, 'swish', at + 0.12, { gain: -3 }); els.slice(0, 8).forEach((e, i) => sfx(o, kind === 'wipe' || kind === 'grow' ? 'tick' : 'tap', at + i * stg + (o.dur || 0.6) * 0.3)); }
      return at + (o.dur || 0.6) + stg * (els.length - 1);
    },
    hide(target, o = {}) {                         // выход блоков: {at, out: pop|rise|drop|slide|fade|wipe, stagger, dur}
      const kind = o.out || 'fade', u = 70 * k, to = { pop: { autoAlpha: 0, scale: 0.3 }, rise: { autoAlpha: 0, y: -u }, drop: { autoAlpha: 0, y: u }, slide: { autoAlpha: 0, x: u * 1.4 }, fade: { autoAlpha: 0 }, wipe: { clipPath: 'inset(0 0 0 100%)' } }[kind];
      tl.to(qa(target), Object.assign({ duration: o.dur || 0.3, ease: o.ease || 'power3.in', stagger: o.stagger == null ? 0.03 : o.stagger }, to), o.at || 0);
    },
    captions(words, o = {}) {                      // субтитры по словам: {into, mode: karaoke|pop, max, offset, from, to, hi, upper, hold}
      const host = q(o.into), off = o.offset || 0, max = o.max || 16, mode = o.mode || 'karaoke', groups = [], base = getComputedStyle(host).color;
      const ws = words.filter(w => w.s >= (o.from == null ? -1e9 : o.from) && w.s < (o.to == null ? 1e9 : o.to)); let cur = [], len = 0;
      ws.forEach((w, i) => { const nx = ws[i + 1]; cur.push(w); len += w.w.length + 1;
        if (!nx || /[.!?…]$/.test(w.w) || nx.s - w.e > 0.4 || len + nx.w.length > max) { groups.push(cur); cur = []; len = 0; } });
      groups.forEach((g, gi) => {
        const line = document.createElement('div'), nx = groups[gi + 1], t0 = g[0].s + off, t1 = Math.min(g[g.length - 1].e + off + (o.hold == null ? 0.3 : o.hold), nx ? nx[0].s + off : D);
        line.className = 'mo-cap'; line.setAttribute('data-cap', ''); host.appendChild(line); const inner = document.createElement('div'); inner.className = 'mo-capl'; line.appendChild(inner);
        const sps = g.map(w => { const sp = document.createElement('span'), tx = w.w.replace(/[.,;:…]+$/, ''); sp.textContent = o.upper ? tx.toUpperCase() : tx; inner.appendChild(sp); return sp; });
        vis(line, Math.max(0.001, t0), t1); g.forEach(w => marks.push(w.s + off));
        if (mode === 'pop') g.forEach((w, i) => tl.fromTo(sps[i], { autoAlpha: 0, scale: 0.5, transformOrigin: '50% 80%' }, { autoAlpha: 1, scale: 1, duration: 0.22, ease: 'back.out(2.4)' }, Math.max(0.001, w.s + off)));
        else { tl.fromTo(inner, { scale: 0.86 }, { scale: 1, duration: 0.18, ease: 'back.out(2)' }, Math.max(0.001, t0));
          g.forEach((w, i) => { const a = Math.max(0.002, w.s + off), b = Math.max(a + 0.08, (g[i + 1] ? g[i + 1].s : w.e + 0.2) + off);
            tl.to(sps[i], { color: o.hi || 'var(--accent)', scale: 1.06, duration: 0.09, ease: 'power2.out' }, a); if (!o.keep) tl.to(sps[i], { color: base, scale: 1, duration: 0.12, ease: 'power2.out' }, b); }); }
      });
      return groups;
    },
    count(target, o) {                             // счётчик: {from,to,at,dur,ease,decimals,prefix,suffix}
      const el = q(target), p = { v: o.from || 0 }, dec = o.decimals || 0;
      const fmt = o.format || (v => {
        const [a, b] = Math.abs(v).toFixed(dec).split('.');
        return (o.prefix || '') + (v < 0 ? '−' : '') + a.replace(/\B(?=(\d{3})+(?!\d))/g, String.fromCharCode(160)) + (b ? ',' + b : '') + (o.suffix || '');
      });
      el.style.fontVariantNumeric = 'tabular-nums';
      el.textContent = fmt(o.to);                  // до первого кадра в элементе стоит итоговое число: по нему меряются акценты вокруг
      const dur = o.dur || 1, at = o.at || 0;
      tl.to(p, { v: o.to, duration: dur, ease: o.ease || 'power3.out' }, at);
      const ez = gsap.parseEase(o.ease || 'power3.out'), v0 = o.from || 0;
      hooks.push(t => { const u = Math.max(0, Math.min(1, (Math.floor(t * fps + 1e-6) / fps - at) / dur)), s2 = fmt(v0 + (o.to - v0) * ez(u)); if (el.textContent !== s2) el.textContent = s2; });   // цифра — чистая функция от номера кадра: в подкадрах размытия и на любой странице рендера она одна и та же
      for (let i = 0, n = Math.min(18, Math.round(dur * 14)); i < n; i++) sfx(o, 'tick', at + dur * (1 - Math.pow(1 - i / n, 2.2)) * 0.9, { rate: 0.8 + 0.5 * i / n, gain: -5 + 5 * i / n });   // тики ускоряются и поднимаются, число «приземляется» звоном
      if (o.sfx === undefined) { M.sfx('thock', at + dur * 0.93); M.sfx('chime', at + dur * 0.93, { gain: -2 }); }
    },
    draw: {                                        // рисованные акценты: линия прорисовывается поверх вёрстки
      path(dd, o = {}) {
        const host = o.host ? q(o.host) : sceneAt(o.at || 0), p = mk('path', { d: dd, fill: 'none', stroke: accent(o), 'stroke-width': o.width || 6 * k, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, layer(host)), at = o.at || 0, dur = o.dur || 0.45;
        tl.fromTo(p, { drawSVG: '0% 0%' }, { drawSVG: '0% 100%', duration: dur, ease: o.ease || 'power2.inOut' }, at);
        gsap.set(p, { autoAlpha: 0 }); tl.set(p, { autoAlpha: 1 }, at + hf);
        sfx(o, 'scratch', at);
        return { el: p, end: at + dur, out(t, dd2) { tl.to(p, { drawSVG: '100% 100%', duration: dd2 || 0.3, ease: 'power2.in' }, t).set(p, { autoAlpha: 0 }, t + (dd2 || 0.3)); return this; } };
      },
      underline(t, o = {}) {
        const host = hostFor(t, o), b = rbox(t, host), r = M.rand(o.seed || b.x * 7 + b.y), sw = o.width || Math.max(5 * k, b.h * 0.07), y = b.y + b.h * (o.dy == null ? (o.style === 'wave' ? 1.07 : 1) : o.dy), x1 = b.x - b.w * 0.02, x2 = b.x + b.w * 1.02, j = a => (r() - 0.5) * 2 * a;
        let dd = `M${x1} ${y + j(sw * 0.4)}`;
        if (o.style === 'wave') { const n = Math.max(4, Math.round(b.w / (sw * 5))); for (let i = 1; i <= n; i++) { const xx = x1 + (x2 - x1) * i / n; dd += ` Q${xx - (x2 - x1) / n / 2} ${y + (i % 2 ? -1 : 1) * sw * 1.8} ${xx} ${y}`; } }
        else if (o.style === 'scribble') { const n = 5; for (let i = 1; i <= n; i++) dd += ` L${i % 2 ? x2 - j(b.w * 0.04) - b.w * 0.03 : x1 + b.w * 0.05 + j(b.w * 0.04)} ${y + i * sw * 0.55 + j(sw * 0.3)}`; }
        else dd += ` Q${(x1 + x2) / 2 + j(b.w * 0.12)} ${y - sw * 0.9 + j(sw)} ${x2} ${y + j(sw * 0.5)}`;
        return M.draw.path(dd, Object.assign({ host, width: sw }, o));
      },
      strike(t, o = {}) { return M.draw.underline(t, Object.assign({ dy: 0.52 }, o)); },
      circle(t, o = {}) {                          // обвести от руки
        const host = hostFor(t, o), b = rbox(t, host), r = M.rand(o.seed || b.x + b.y * 3), pad = o.pad == null ? b.h * 0.28 : o.pad, rx = b.w / 2 + pad * 1.4, ry = b.h / 2 + pad, a0 = -2.4 + r() * 0.5, pts = [];
        for (let i = 0; i <= 26; i++) { const u = i / 26, a = a0 + u * PI2 * 1.09, g = 1 + u * 0.07 + (r() - 0.5) * 0.03; pts.push([b.cx + Math.cos(a) * rx * g, b.cy + Math.sin(a) * ry * g]); }
        return M.draw.path(`M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}` + pts.slice(1, -1).map((p, i) => ` Q${p[0].toFixed(1)} ${p[1].toFixed(1)} ${((p[0] + pts[i + 2][0]) / 2).toFixed(1)} ${((p[1] + pts[i + 2][1]) / 2).toFixed(1)}`).join(''), Object.assign({ host, dur: 0.55 }, o));
      },
      brackets(t, o = {}) {                        // уголки-рамка вокруг элемента
        const host = hostFor(t, o), b = rbox(t, host), p = o.pad == null ? 14 * k : o.pad, L = o.len || Math.min(b.w, b.h) * 0.22, x1 = b.x - p, y1 = b.y - p, x2 = b.x + b.w + p, y2 = b.y + b.h + p;
        const c = [[x1, y1 + L, x1, y1, x1 + L, y1], [x2 - L, y1, x2, y1, x2, y1 + L], [x2, y2 - L, x2, y2, x2 - L, y2], [x1 + L, y2, x1, y2, x1, y2 - L]];
        return c.map((v, i) => M.draw.path(`M${v[0]} ${v[1]} L${v[2]} ${v[3]} L${v[4]} ${v[5]}`, Object.assign({ host, dur: 0.3 }, o, { at: (o.at || 0) + i * 0.05, sfx: i ? false : o.sfx })));
      },
      arrow(a, b2, o = {}) {                       // изогнутая стрелка от a к b (точка или элемент)
        const host = hostFor(a, o), A = spot(a, host), B = spot(b2, host), dx = B[0] - A[0], dy = B[1] - A[1], len = Math.hypot(dx, dy), g = o.gap == null ? 0 : o.gap;
        const ux = dx / len, uy = dy / len, S = [A[0] + ux * g, A[1] + uy * g], E = [B[0] - ux * g, B[1] - uy * g], bend = (o.bend == null ? 0.22 : o.bend) * len, C = [(S[0] + E[0]) / 2 - uy * bend, (S[1] + E[1]) / 2 + ux * bend];
        const tx = E[0] - C[0], ty = E[1] - C[1], tn = Math.hypot(tx, ty), hx = tx / tn, hy = ty / tn, hl = o.head || Math.max(18 * k, Math.min(len * 0.16, 46 * k)), rot = (c, s2) => [E[0] - (hx * c - hy * s2) * hl, E[1] - (hy * c + hx * s2) * hl], h1 = rot(0.85, 0.5), h2 = rot(0.85, -0.5);
        const sh = M.draw.path(`M${S[0]} ${S[1]} Q${C[0]} ${C[1]} ${E[0]} ${E[1]}`, Object.assign({ host }, o));
        M.draw.path(`M${h1[0]} ${h1[1]} L${E[0]} ${E[1]} L${h2[0]} ${h2[1]}`, Object.assign({ host }, o, { at: sh.end - 0.1, dur: 0.18, sfx: false }));
        return sh;
      },
      burst(c, o = {}) {                           // лучи-искры из точки
        const el = Array.isArray(c) ? null : c, host = hostFor(c, o), bb = el ? rbox(el, host) : null, P = el ? [bb.cx, bb.cy] : spot(c, host), n = o.n || (el ? 12 : 8), at = o.at || 0, dur = o.dur || 0.5, a0 = o.angle == null ? 0.26 : o.angle, sv = layer(host);
        const pad = o.pad == null ? 26 * k : o.pad, len = o.len || 70 * k, rx = el ? bb.w / 2 + pad : o.r1 || 40 * k, ry = el ? bb.h / 2 + pad : o.r1 || 40 * k;   // вокруг элемента лучи стартуют за его рамкой
        for (let i = 0; i < n; i++) { const a = a0 + i / n * PI2, cx = Math.cos(a), sy = Math.sin(a), e1 = 1 / Math.hypot(cx / rx, sy / ry), e2 = el ? e1 + len : o.r2 || 110 * k, p = mk('path', { d: `M${(P[0] + cx * e1).toFixed(1)} ${(P[1] + sy * e1).toFixed(1)} L${(P[0] + cx * e2).toFixed(1)} ${(P[1] + sy * e2).toFixed(1)}`, fill: 'none', stroke: accent(o), 'stroke-width': o.width || 6 * k, 'stroke-linecap': 'round' }, sv);
          gsap.set(p, { autoAlpha: 0 }); tl.set(p, { autoAlpha: 1 }, at + hf).fromTo(p, { drawSVG: '0% 0%' }, { drawSVG: '0% 100%', duration: dur * 0.45, ease: 'power2.out' }, at).to(p, { drawSVG: '100% 100%', duration: dur * 0.55, ease: 'power2.in' }, at + dur * 0.45).set(p, { autoAlpha: 0 }, at + dur); }
        sfx(o, 'pop', at); sfx(o, 'shimmer', at, { gain: -3 });
      },
      ring(c, o = {}) {                            // расходящееся кольцо
        const host = hostFor(c, o), P = spot(c, host), at = o.at || 0, e = mk('circle', { cx: P[0], cy: P[1], r: o.r1 || 10 * k, fill: 'none', stroke: accent(o), 'stroke-width': o.width || 10 * k }, layer(host));
        gsap.set(e, { autoAlpha: 0 }); tl.set(e, { autoAlpha: 1 }, at).to(e, { attr: { r: o.r2 || 160 * k, 'stroke-width': 0.1 }, duration: o.dur || 0.6, ease: 'expo.out' }, at).set(e, { autoAlpha: 0 }, at + (o.dur || 0.6));
        sfx(o, 'bubble', at);
      },
      confetti(c, o = {}) {                        // хлопушка из точки
        const host = hostFor(c, o), P = spot(c, host), n = o.n || 28, r = M.rand(o.seed || 11), at = o.at || 0, cols = o.colors || ['var(--accent)', 'var(--fg)'], sv = layer(host), dur = o.dur || 1.3;
        for (let i = 0; i < n; i++) { const a = -Math.PI / 2 + (r() - 0.5) * (o.spread || 2.2), v = (0.45 + r() * 0.55) * (o.power || 520 * k), w = (10 + r() * 14) * k, e = mk('rect', { x: P[0] - w / 2, y: P[1] - w / 4, width: w, height: w / 2, rx: 2, fill: cols[i % cols.length] }, sv);
          gsap.set(e, { autoAlpha: 0, transformOrigin: '50% 50%' }); tl.set(e, { autoAlpha: 1 }, at)
            .to(e, { x: Math.cos(a) * v, duration: dur, ease: 'power2.out' }, at).to(e, { y: Math.sin(a) * v, duration: dur * 0.4, ease: 'power2.out' }, at).to(e, { y: Math.sin(a) * v + (300 + r() * 500) * k, duration: dur * 0.6, ease: 'power2.in' }, at + dur * 0.4)
            .to(e, { rotation: (r() - 0.5) * 900, duration: dur, ease: 'none' }, at).to(e, { autoAlpha: 0, duration: 0.2 }, at + dur - 0.2); }
        sfx(o, 'pop', at); sfx(o, 'shimmer', at + 0.05);
      },
      highlight(t, o = {}) {                       // маркер за словом (фон проезжает под текстом)
        const e0 = q(t), at = o.at || 0, els = (e0.dataset.moK ? qa(`[data-mo-k="${e0.dataset.moK}"]`) : [e0]).filter(e => e.textContent.trim()), dur = (o.dur || 0.4) / els.length;   // после разбивки текста слово может лежать в нескольких кусках
        els.forEach((el, i) => { if (getComputedStyle(el).display === 'block') el.style.width = 'fit-content'; el.style.backgroundImage = `linear-gradient(${accent(o)},${accent(o)})`; el.style.backgroundRepeat = 'no-repeat'; el.style.backgroundPosition = '0 ' + (o.y || '60%');
          tl.fromTo(el, { backgroundSize: '0% ' + (o.h || '88%') }, { backgroundSize: '100% ' + (o.h || '88%'), duration: dur, ease: 'power3.inOut' }, at + i * dur); if (o.ink) tl.to(el, { color: o.ink, duration: 0.2 }, at + i * dur + 0.1); });
        sfx(o, 'swish', at + (o.dur || 0.4) * 0.5, { gain: -2 });
      }
    },
    icon(name, o = {}) {                           // иконка из набора (mo data --icons): {into, at, draw, color, stroke}
      const ic = M.data.icons[name], host = q(o.into); if (!ic) throw new Error('нет иконки «' + name + '» — добавь: mo data <dir> --icons ' + name);
      const sv = mk('svg', { class: 'mo-icon', viewBox: '0 0 24 24', fill: 'none', stroke: o.color || 'currentColor', 'stroke-width': o.stroke || 1.6, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'data-decor': '' }, host);
      sv.innerHTML = ic; const ps = [...sv.querySelectorAll('path,circle,line,rect,polyline,ellipse')], at = o.at || 0, dur = o.draw == null ? 0.7 : o.draw;
      if (dur) { gsap.set(ps, { autoAlpha: 0 }); ps.forEach((p, i) => tl.set(p, { autoAlpha: 1 }, at + i * dur * 0.5 / ps.length + hf).fromTo(p, { drawSVG: '0% 0%' }, { drawSVG: '0% 100%', duration: dur * 0.75, ease: 'power2.inOut' }, at + i * dur * 0.5 / ps.length)); sfx(o, 'scratch', at); sfx(o, 'tick', at + dur, { gain: 3 }); }
      return sv;
    },
    win(target, o = {}) {                          // окно с видео: формы-пресеты и кадрирование по лицу. {face: M.data.faces['clip.mp4']}
      const el = q(target), img = el.querySelector('img[data-footage]'), S = M.safe, sw = W - S.left - S.right, sh = H - S.top - S.bottom, f = o.face, cur = {};
      const P = { full: [0, 0, W, H, 0], card: [S.left, S.top + sh * 0.19, sw, sh * 0.62, sw * 0.05], top: [S.left, S.top, sw, sh * 0.5, sw * 0.05], bottom: [S.left, S.top + sh * 0.5, sw, sh * 0.5, sw * 0.05],
        wide: [S.left, S.top + (sh - sw * 0.5625) / 2, sw, sw * 0.5625, sw * 0.04], circle: [S.left + sw * 0.14, S.top + sh * 0.04, sw * 0.72, sw * 0.72, sw * 0.36], pill: [S.left, S.top + (sh - sw * 0.44) / 2, sw, sw * 0.44, sw * 0.22],
        left: [S.left, S.top, sw * 0.47, sh, sw * 0.03], right: [S.left + sw * 0.53, S.top, sw * 0.47, sh, sw * 0.03],
        'pip-tl': [S.left, S.top, sw * 0.36, sw * 0.45, sw * 0.045], 'pip-tr': [S.left + sw * 0.64, S.top, sw * 0.36, sw * 0.45, sw * 0.045], 'pip-bl': [S.left, S.top + sh - sw * 0.45, sw * 0.36, sw * 0.45, sw * 0.045], 'pip-br': [S.left + sw * 0.64, S.top + sh - sw * 0.45, sw * 0.36, sw * 0.45, sw * 0.045] };
      const res = (sh2, ov) => { let b;
        if (typeof sh2 === 'string' && sh2.startsWith('off')) { const dr = sh2.split('-')[1] || 'left'; b = Object.assign({}, cur); if (dr === 'left') b.x = -cur.w * 1.15; if (dr === 'right') b.x = W + cur.w * 0.15; if (dr === 'up') b.y = -cur.h * 1.15; if (dr === 'down') b.y = H + cur.h * 0.15; }
        else { const p = typeof sh2 === 'string' ? P[sh2] : null; if (typeof sh2 === 'string' && !p) throw new Error('нет формы окна «' + sh2 + '»'); b = p ? { x: p[0], y: p[1], w: p[2], h: p[3], r: p[4], rot: 0 } : Object.assign({ rot: 0, r: 0 }, cur, sh2); }
        return Object.assign(b, ov); };
      const fit = b => { if (!f) return { objectPosition: '50% ' + (o.focusY == null ? 20 : o.focusY) + '%' };
        const sc = Math.max(b.w / f.W, b.h / f.H), ox = f.W * sc - b.w, oy = f.H * sc - b.h, top = Math.min(f.cy * sc - b.h * 0.42, (f.cy - f.h * 0.95) * sc - b.h * 0.07);
        return { objectPosition: (ox > 1 ? Math.max(0, Math.min(1, (f.cx * sc - b.w / 2) / ox)) * 100 : 50).toFixed(1) + '% ' + (oy > 1 ? Math.max(0, Math.min(1, top / oy)) * 100 : 50).toFixed(1) + '%' }; };
      const css2 = b => ({ left: b.x, top: b.y, width: b.w, height: b.h, borderRadius: b.r, rotation: b.rot || 0 });
      const api = { el, shapes: P, box: () => Object.assign({}, cur), shape: (sh2, ov) => res(sh2, ov),
        set(sh2, ov) { Object.assign(cur, res(sh2, ov)); gsap.set(el, css2(cur)); if (img) gsap.set(img, fit(cur)); return api; },
        to(sh2, at, o2 = {}) { const b = res(sh2, o2.box), dur = o2.dur || 0.7, ease = o2.ease || 'expo.inOut'; Object.assign(cur, b);
          tl.to(el, Object.assign({ duration: dur, ease }, css2(b)), at); if (img && !String(sh2).startsWith('off')) tl.to(img, Object.assign({ duration: dur, ease }, fit(b)), at);
          move(o2, at, dur, 1, String(sh2).startsWith('off') ? 0 : 0.64); return api; } };
      return api.set(o.shape || 'full');
    },
    camera(target) {                               // камера над большим холстом: {x,y} — точка холста в центре кадра
      const el = q(target), st = { x: W / 2, y: H / 2, zoom: 1, rot: 0 }, deps = [...el.querySelectorAll('[data-depth]')];
      el.style.transformOrigin = '0 0'; el.setAttribute('data-layer', ''); M.cam = true;
      hooks.push(() => { el.style.transform = `translate(${W / 2}px,${H / 2}px) scale(${st.zoom}) rotate(${st.rot}deg) translate(${-st.x}px,${-st.y}px)`;
        deps.forEach(c => { const dz = 1 - +c.dataset.depth; c.style.translate = `${(st.x - W / 2) * dz}px ${(st.y - H / 2) * dz}px`; }); });
      const api = { state: st,
        set(v) { Object.assign(st, v); return api; },
        to(v, at, o = {}) { tl.to(st, Object.assign({ duration: o.dur || 0.9, ease: o.ease || 'swift' }, v), at); move(o, at, o.dur || 0.9, 2, 0.72, -2); return api; },
        focus(t, at, o = {}) { const b = box(q(t), el), v = { x: b.cx, y: b.cy, zoom: o.zoom || Math.min(W / b.w, H / b.h) * (o.fill || 0.72), rot: o.rot || 0 }; return at == null ? api.set(v) : api.to(v, at, o); } };
      return api;
    },
    float(target, o = {}) {                        // живое покачивание на удержании (не для мелкого текста)
      qa(target).forEach((el, i) => { const r = M.rand((o.seed || 5) + i * 13), p = [r(), r(), r()], per = o.period || 4, ax = o.x == null ? 8 * k : o.x, ay = o.y == null ? 12 * k : o.y, ar = o.rot || 0;
        (nudges.get(el) || nudges.set(el, []).get(el)).push(t => [ax * Math.sin(PI2 * (t / per + p[0])), ay * Math.sin(PI2 * (t / (per * 0.73) + p[1])), ar * Math.sin(PI2 * (t / (per * 1.31) + p[2]))]); });
    },
    shake(target, o = {}) {                        // короткая встряска на акцент
      const at = o.at || 0, dur = o.dur || 0.35, amp = o.amp || 16 * k;
      qa(target).forEach(el => (nudges.get(el) || nudges.set(el, []).get(el)).push(t => { const u = (t - at) / dur; if (u < 0 || u > 1) return [0, 0, 0]; const dc = (1 - u) * (1 - u); return [amp * dc * Math.sin(u * 38), amp * 0.6 * dc * Math.cos(u * 31), 0]; }));
      sfx(o, 'boom', at, { gain: -4 });
    },
    grain(amount) { stage.dataset.grain = amount == null ? 0.12 : amount; },   // плёночное зерно: накладывается при сборке файла (в стоп-кадрах его нет)
    chart(target, o) {                             // {type: bars|line|donut, data: [{label,value}], at, dur, hi, unit}
      const el = q(target), data = o.data, at = o.at || 0, dur = o.dur || 0.9, max = Math.max(...data.map(x => x.value)), hi = o.hi == null ? data.findIndex(x => x.value === max) : o.hi, col = i => (i === hi ? accent(o) : o.dim || 'color-mix(in srgb, currentColor 32%, transparent)');
      if (o.type === 'donut') { const v = data[0].value / (o.total || 100), R = 42, sv = mk('svg', { viewBox: '0 0 100 100', class: 'mo-icon', 'data-decor': '' }, el);
        mk('circle', { cx: 50, cy: 50, r: R, fill: 'none', stroke: col(-1), 'stroke-width': o.width || 9 }, sv);
        const a = mk('circle', { cx: 50, cy: 50, r: R, fill: 'none', stroke: accent(o), 'stroke-width': o.width || 9, 'stroke-linecap': 'round', transform: 'rotate(-90 50 50)' }, sv);
        tl.fromTo(a, { drawSVG: '0% 0%' }, { drawSVG: '0% ' + v * 100 + '%', duration: dur, ease: 'power3.out' }, at); sfx(o, 'swell', at + dur * 0.5); return sv; }
      if (o.type === 'line') { const sv = mk('svg', { viewBox: '0 0 100 60', class: 'mo-icon', preserveAspectRatio: 'none', 'data-decor': '' }, el), min = o.min == null ? Math.min(...data.map(x => x.value)) * 0.8 : o.min;
        const pt = data.map((x, i) => [4 + 92 * i / (data.length - 1), 56 - 50 * (x.value - min) / (max - min)]), p = mk('path', { d: 'M' + pt.map(v => v.join(' ')).join(' L'), fill: 'none', stroke: accent(o), 'stroke-width': o.width || 1.6, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'vector-effect': 'non-scaling-stroke' }, sv);
        if (o.width == null) p.setAttribute('stroke-width', 7 * k);
        tl.fromTo(p, { drawSVG: '0% 0%' }, { drawSVG: '0% 100%', duration: dur, ease: 'power2.inOut' }, at); sfx(o, 'scratch', at); return sv; }
      el.style.display = 'flex'; el.style.alignItems = 'flex-end'; el.style.gap = el.style.gap || '3%';
      data.forEach((x, i) => { const c = document.createElement('div'), b = document.createElement('div'), n = document.createElement('div'), l = document.createElement('div'), t0 = at + i * 0.09;
        c.style.cssText = 'flex:1;height:100%;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;gap:.35em'; b.style.cssText = `width:100%;height:${Math.max(2, x.value / max * 72)}%;background:${col(i)};border-radius:${o.radius || '.25em .25em 0 0'};transform-origin:50% 100%`;
        n.textContent = '0'; l.textContent = x.label || ''; l.setAttribute('data-small', ''); n.setAttribute('data-small', ''); c.append(n, b, l); el.appendChild(c);
        tl.fromTo(b, { scaleY: 0 }, { scaleY: 1, duration: dur, ease: 'power3.out' }, t0).fromTo([n, l], { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.3 }, t0);
        M.count(n, { to: x.value, at: t0, dur, suffix: o.unit || '', decimals: o.decimals || 0, sfx: false }); sfx(o, 'thock', t0 + dur * 0.5, { rate: 0.9 + 0.06 * i }); });
    },
    sfx(name, at, o) { sfxList.push(Object.assign({ name, at: Math.max(0, +at || 0) }, o)); },   // звук на таймлинии: {gain (дБ), rate, pan, anchor: start|peak|end}
    hit(at, size, o = {}) {                        // акцент из слоёв: 's' — щелчок с телом; 'm' — подъезд и низкий удар; 'l' — нарастание, большой удар с хвостом и звон
      const g = o.gain || 0;
      if (size === 'l') { M.sfx('riser', at, { gain: g }); M.sfx('boom', at, { gain: g }); M.sfx('chime', at + 0.04, { gain: g - 3 }); }
      else if (size === 's') M.sfx('thock', at, { gain: g });
      else { M.sfx('whoosh', at - 0.04, { gain: g }); M.sfx('hit', at, { gain: g }); }
    },
    ticks(at, o = {}) {                            // очередь щелчков: {n, gap, name, rise: false — ровная, gain}
      const n = o.n || 6, gap = o.gap || 0.05;
      for (let i = 0; i < n; i++) M.sfx(o.name || 'tick', at + i * gap, { rate: o.rise === false ? 1 : 0.85 + 0.5 * i / n, gain: (o.gain || 0) - (o.rise === false ? 0 : 5 * (1 - i / Math.max(1, n - 1))) });
      return at + n * gap;
    },
    onFrame(fn) { hooks.push(fn); },               // fn(t, frame) — для canvas и всего процедурного
    start(build) {                                 // грузит шрифты → строит таймлинию → открывает renderFrame
      const faces = [...document.fonts].map(f => f.load().catch(e => console.error('Шрифт не загрузился: ' + f.family)));
      Promise.all(faces).then(() => document.fonts.ready).then(() => { build(M); M.ready(); })
        .catch(e => { console.error('Ошибка сборки: ' + (e && e.stack || e)); window.__moError = String(e && e.message || e); });
    },
    ready() {
      const real = tl.duration();
      if (real < D) tl.set({}, {}, D);
      hooks.push(t => nudges.forEach((fns, el) => { let x = 0, y = 0, r = 0; fns.forEach(fn => { const v = fn(t); x += v[0]; y += v[1]; r += v[2]; }); el.style.translate = x.toFixed(2) + 'px ' + y.toFixed(2) + 'px'; el.style.rotate = r.toFixed(3) + 'deg'; }));
      nudges.forEach((fns, el) => gsap.getProperty(el, 'x'));   // GSAP запоминает трансформацию элемента до первого покачивания, иначе впечёт его в свой расчёт
      const foot = [...stage.querySelectorAll('img[data-footage]')];
      const num = (v, def) => (v == null || v === '' ? def : +v);
      const ev = marks.slice(); tl.getChildren(true, true, false).forEach(c => { if (c.duration() <= 0.02) return; let t = c.startTime(), p = c.parent; while (p && p !== tl) { t = p.startTime() + t / (p.timeScale() || 1); p = p.parent; } ev.push(+t.toFixed(3)); });
      window.__motion = {
        W, H, fps, D, tlDur: real, labels: tl.labels, safe: M.safe, loop: d.loop != null, loudness: num(d.loudness, -14),
        footage: foot.map((im, i) => ({ i, file: im.dataset.footage, in: num(im.dataset.in, 0), at: num(im.dataset.at, 0),
          dur: num(im.dataset.dur, null), w: im.offsetWidth, h: im.offsetHeight, over: num(im.dataset.oversize, 1),
          audio: im.dataset.audio != null, gain: num(im.dataset.gain, 0), duck: false, voice: im.dataset.voice != null })),
        audio: [...document.querySelectorAll('audio[src]')].map(a => ({ file: a.getAttribute('src'), at: num(a.dataset.at, 0),
          in: num(a.dataset.in, 0), dur: num(a.dataset.dur, null), gain: a.dataset.gain == null ? null : +a.dataset.gain, fadeIn: num(a.dataset.fadeIn, 0),
          fadeOut: num(a.dataset.fadeOut, 0), duck: a.dataset.duck != null, voice: a.dataset.voice != null })),
        sfx: sfxList, kit: d.sfx || '01', sfxGain: num(d.sfxGain, 0), under: num(d.musicUnder, 17), grain: () => num(stage.dataset.grain, 0), events: ev.sort((a, b) => a - b).filter((t, i, a) => !i || t - a[i - 1] > 0.1),
        camera: !!M.cam, stray: () => gsap.globalTimeline.getChildren(false, true, true).filter(c => c !== tl).length,
        setFootage(m) { fmap = m; }
      };
      window.renderFrame = async t => {
        t = Math.max(0, Math.min(D, t));
        nudges.forEach((fns, el) => { el.style.translate = 'none'; el.style.rotate = 'none'; });
        tl.seek(t, false);
        const fr = Math.round(t * fps);
        hooks.forEach(h => h(t, fr));
        await Promise.all(foot.map((im, i) => {
          const m = fmap[i];
          if (!m || getComputedStyle(im).visibility === 'hidden') return;
          const n = Math.max(0, Math.min(m.count - 1, Math.floor((t - m.at) * fps + 1e-6)));
          const src = m.dir + '/' + String(n + 1).padStart(6, '0') + '.jpg';
          if (im.getAttribute('src') === src) return;
          im.src = src;
          return im.decode().catch(() => {});
        }));
      };
      if (!window.__MO) {                          // открыли файл в обычном браузере — просто проигрываем
        const fit = () => { stage.style.transformOrigin = '0 0';
          stage.style.transform = 'scale(' + Math.min(innerWidth / W, innerHeight / H) + ')'; };
        fit(); addEventListener('resize', fit);
        tl.eventCallback('onUpdate', () => hooks.forEach(h => h(tl.time(), Math.round(tl.time() * fps))));
        tl.repeat(-1).play(0);
      }
      window.__moReady = true;
    }
  };
})();