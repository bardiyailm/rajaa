/* رسوم SVG خفيفة بلا مكتبات: عمود مكدّس، أعمدة، شريط شرائح. لون واحد (لون المقهى) بدرجات مختلفة. */
const Charts = (() => {
  const NS = 'http://www.w3.org/2000/svg';
  const arN = (n) => String(n).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[d]);
  const niceMax = (m) => { if (m <= 4) return 4; const p = Math.pow(10, Math.floor(Math.log10(m))); const f = m / p; return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * p; };
  const esc = (s) => String(s).replace(/[<>&"]/g, '');

  function shell(el) {
    el.classList.add('chart');
    el.replaceChildren();
    const tip = document.createElement('div'); tip.className = 'tip'; tip.hidden = true;
    const box = document.createElement('div'); box.className = 'plot'; box.dir = 'ltr';
    el.append(box, tip);
    return { box, tip, w: Math.max(260, box.clientWidth || el.clientWidth || 340) };
  }
  function place(tip, box, x, y, html) {
    tip.innerHTML = html; tip.hidden = false;
    const bw = box.clientWidth, tw = tip.offsetWidth;
    tip.style.left = Math.min(Math.max(0, x - tw / 2), Math.max(0, bw - tw)) + 'px';
    tip.style.top = Math.max(0, y - tip.offsetHeight - 8) + 'px';
  }
  function bind(svg, hits, tip, box, content, geo) {
    const show = (i) => { const g = geo(i); place(tip, box, g.x, g.y, content(i)); svg.querySelectorAll('[data-i]').forEach((n) => n.classList.toggle('dim', n.dataset.i !== String(i))); };
    const hide = () => { tip.hidden = true; svg.querySelectorAll('[data-i]').forEach((n) => n.classList.remove('dim')); };
    hits.forEach((r, i) => {
      r.addEventListener('pointerenter', () => show(i));
      r.addEventListener('pointerdown', () => show(i));
      r.addEventListener('pointerleave', hide);
    });
  }

  /** series: [{label, a, b}] ; keys: {a:{label,cls}, b:{...}} ؛ العمود = a (أسفل) + b (أعلى) */
  function stacked(el, series, { keys, fmtLabel, every }) {
    const { box, tip, w } = shell(el);
    const H = 190, pl = 30, pr = 6, pt = 10, pb = 26, iw = w - pl - pr, ih = H - pt - pb;
    const tot = series.map((s) => s.a + s.b);
    const max = niceMax(Math.max(1, ...tot));
    const n = series.length, slot = iw / n, bw = Math.max(3, Math.min(22, slot * 0.62));
    let g = '';
    for (let t = 0; t <= 4; t++) {
      const v = (max / 4) * t, y = pt + ih - (v / max) * ih;
      g += `<line class="grid" x1="${pl}" x2="${w - pr}" y1="${y}" y2="${y}"/><text class="ax" x="${pl - 5}" y="${y + 3.5}" text-anchor="end">${arN(Math.round(v * 10) / 10)}</text>`;
    }
    const step = every || Math.ceil(n / 6);
    series.forEach((s, i) => {
      const cx = pl + slot * i + slot / 2, x = cx - bw / 2;
      const hA = (s.a / max) * ih, hB = (s.b / max) * ih;
      const yA = pt + ih - hA, yB = yA - hB - (s.a && s.b ? 2 : 0);
      if (s.a) g += `<rect data-i="${i}" class="m ${keys.a.cls}" x="${x}" y="${yA}" width="${bw}" height="${Math.max(0, hA)}" rx="${s.b ? 0 : Math.min(4, bw / 2)}"/>`;
      if (s.b) g += `<rect data-i="${i}" class="m ${keys.b.cls}" x="${x}" y="${yB}" width="${bw}" height="${Math.max(0, hB)}" rx="${Math.min(4, bw / 2)}"/>`;
      if (i % step === 0 || i === n - 1) g += `<text class="ax" x="${cx}" y="${H - 8}" text-anchor="middle">${esc(fmtLabel(s.label))}</text>`;
    });
    let hz = '';
    series.forEach((_, i) => { hz += `<rect class="hit" x="${pl + slot * i}" y="${pt}" width="${slot}" height="${ih}"/>`; });
    box.innerHTML = `<svg viewBox="0 0 ${w} ${H}" width="${w}" height="${H}" role="img">${g}${hz}</svg>`;
    const svg = box.firstChild;
    bind(svg, [...svg.querySelectorAll('.hit')], tip, box,
      (i) => `<b>${esc(fmtLabel(series[i].label, true))}</b><div><i class="sw ${keys.a.cls}"></i>${keys.a.label}: ${arN(series[i].a)}</div><div><i class="sw ${keys.b.cls}"></i>${keys.b.label}: ${arN(series[i].b)}</div>`,
      (i) => ({ x: pl + slot * i + slot / 2, y: pt + ih - ((series[i].a + series[i].b) / max) * ih }));
  }

  /** أعمدة بسيطة: values + labels، مع إبراز القمة */
  function bars(el, values, labels, { unit, peak = true, every = 1, fmtTip }) {
    const { box, tip, w } = shell(el);
    const H = 160, pl = 26, pr = 4, pt = 14, pb = 24, iw = w - pl - pr, ih = H - pt - pb;
    let max = niceMax(Math.max(1, ...values)); if (max % 2) max += 1;
    const n = values.length, slot = iw / n, bw = Math.max(4, Math.min(26, slot * 0.66));
    const top = values.indexOf(Math.max(...values));
    let g = '';
    for (let t = 0; t <= 2; t++) {
      const v = (max / 2) * t, y = pt + ih - (v / max) * ih;
      g += `<line class="grid" x1="${pl}" x2="${w - pr}" y1="${y}" y2="${y}"/><text class="ax" x="${pl - 5}" y="${y + 3.5}" text-anchor="end">${arN(Math.round(v * 10) / 10)}</text>`;
    }
    values.forEach((v, i) => {
      const cx = pl + slot * i + slot / 2, h = (v / max) * ih;
      const isTop = peak && v > 0 && i === top;
      g += `<rect data-i="${i}" class="m ${isTop ? 'k1' : 'k2'}" x="${cx - bw / 2}" y="${pt + ih - h}" width="${bw}" height="${Math.max(0, h)}" rx="${Math.min(4, bw / 2)}"/>`;
      if (isTop) g += `<text class="ax strong" x="${cx}" y="${pt + ih - h - 4}" text-anchor="middle">${arN(v)}</text>`;
      if (i % every === 0) g += `<text class="ax" x="${cx}" y="${H - 7}" text-anchor="middle">${esc(labels[i])}</text>`;
    });
    let hz = '';
    values.forEach((_, i) => { hz += `<rect class="hit" x="${pl + slot * i}" y="${pt}" width="${slot}" height="${ih}"/>`; });
    box.innerHTML = `<svg viewBox="0 0 ${w} ${H}" width="${w}" height="${H}" role="img">${g}${hz}</svg>`;
    const svg = box.firstChild;
    bind(svg, [...svg.querySelectorAll('.hit')], tip, box,
      (i) => `<b>${esc(labels[i])}</b><div>${fmtTip ? fmtTip(values[i]) : arN(values[i]) + ' ' + (unit || '')}</div>`,
      (i) => ({ x: pl + slot * i + slot / 2, y: pt + ih - (values[i] / max) * ih }));
  }

  /** شريط شرائح أفقي: items [{label, n, cls}] + وسيلة إيضاح بأعداد */
  function segments(el, items) {
    el.classList.add('chart');
    const total = items.reduce((s, x) => s + x.n, 0) || 1;
    const bar = document.createElement('div'); bar.className = 'seg';
    items.filter((x) => x.n > 0).forEach((x) => {
      const d = document.createElement('div'); d.className = 'm ' + x.cls; d.style.flexGrow = x.n;
      d.title = `${x.label}: ${arN(x.n)}`; bar.append(d);
    });
    const lg = document.createElement('div'); lg.className = 'legend';
    items.forEach((x) => { lg.insertAdjacentHTML('beforeend', `<div><i class="sw ${x.cls}"></i><span>${x.label}</span><b>${arN(x.n)}</b><small>${Math.round((x.n / total) * 100)}٪</small></div>`); });
    el.replaceChildren(bar, lg);
  }

  return { stacked, bars, segments, arN };
})();
