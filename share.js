/* NIMEX Fleet Transport Operator — แชร์/ส่งออกแบบเลือกหัวข้อ + อินโฟกราฟิก 16:9 (สกิล nimex-export-infographic-169)
   ใช้ตัวกรองแถวบนทั้งหมด (งวด · รอบ/เดือน · ผลทั้งหมด/ไม่รวมติดลบสะสม · โซน · DC · ประเภทรถ · กำไร/ขาดทุน)
   ตัวเลขทุกตัวมาจาก calcSummary() ของหน้าเดิม (8 ตัวหลัก) · % ≥ เกณฑ์ ใช้เกณฑ์ KPI 6 ในหน้าตั้งค่า (คงเหลือสุทธิ ≥ 7,000 บาท)
   ช่วงก่อนหน้า = งวดก่อน (โหมดรอบ) หรือเดือนก่อน (โหมดเดือน) ตามแถวบน */
(function () {
'use strict';
var GC = { A: '#123f8c', B: '#6e93d6', C: '#d4a72c', D: '#d9822b', F: '#b8334a' };
var GE = { A: '🔵', B: '🟦', C: '🟡', D: '🟠', F: '🔴' }, MD = ['1️⃣','2️⃣','3️⃣','4️⃣','5️⃣','6️⃣','7️⃣','8️⃣','9️⃣','🔟'];
var GOOD = '#1a9e5f', BAD = '#b8334a', MINV = 5;
var X = { an: { l: 'กำไรสุทธิเฉลี่ย/คัน', money: 1, dir: 1 }, pp: { l: '% รถกำไร', pct: 1, dir: 1 }, p7: { l: '% รถคงเหลือ ≥ เกณฑ์', pct: 1, dir: 1 } };
var BWK = ['an', 'pp', 'p7'];
var SECS = [['kpi', '8 ตัวหลัก'], ['zone', 'ผลรายโซน'], ['dc', 'DC กำไรเฉลี่ย/คันต่ำสุด 10 อันดับ'], ['type', 'แยกชนิดรถ'], ['debt', 'รถรอปรับสภาพหนี้']]
  .concat(BWK.map(function (id) { return ['bw_' + id, 'ดีสุด/แย่สุด · ' + X[id].l]; }));
var picked = { kpi: 1, zone: 1, dc: 1, type: 1 };
function $(id) { return document.getElementById(id); }
function E(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
function nf(v) { return Number.isFinite(v) ? Math.round(v).toLocaleString('en-US') : '–'; }
function p1(v) { return Number.isFinite(v) ? v.toFixed(1) + '%' : '–'; }
function M() { return window.ftoViews.metrics; }
function MP() { return window.ftoPeriod; }
function k6() { var k = (MP().cfg.kpis || []).filter(function (x) { return x.src === 'net_ge'; })[0]; return k || { param: 7000, grade: { A: 96, B: 94, C: 92, D: 90 }, dir: 1, no: '6' }; }
function grade(v) { var g = k6().grade; return !Number.isFinite(v) ? '' : v >= g.A ? 'A' : v >= g.B ? 'B' : v >= g.C ? 'C' : v >= g.D ? 'D' : 'F'; }
function gradesOn() { return MP().gradesOn(); }
function clean(n) { return String(n || '').replace(/\s+/g, ' ').trim(); }
function short(n) { return clean(n).replace(/^\d+\s+/, '').replace(/^C?DC\s*/, ''); }
function vt(t) { return String(t || '').replace(/^\d+\s+/, ''); }
function zoneOf(dc) { return window.ftoFleet ? ftoFleet.zoneOf(dc) : '-'; }
function money(v) { return Number.isFinite(v) ? '฿' + fmtK(v) : '–'; }
function fk(m, v) { return m.money ? money(v) : m.pct ? p1(v) : nf(v); }

/* ---------- ข้อมูล ---------- */
function filtered(rows) { var keep = DB; DB = rows; try { return getFiltered(); } finally { DB = keep; } }
function allZones(rows) { return ftoViews.base(rows); }
function st(rows) {
  var s = calcSummary(rows), p = k6().param, ok = rows.filter(function (r) { return r.net_balance >= p; }).length;
  return { s: s, n: s.n, an: s.avg_net, pp: s.n ? s.profit_count / s.n * 100 : NaN, p7: s.n ? ok / s.n * 100 : NaN, net: s.total_net, rev: s.total_rev, loss: s.n ? s.loss_count / s.n * 100 : NaN };
}
function period() {
  var p = MP(), pk = p.prevFor(p.cur), cur = getFiltered(), prev = pk ? filtered(p.dataset(pk)) : null;
  return { cur: cur, prev: prev, all: allZones(DB), allPrev: pk ? allZones(p.dataset(pk)) : null, curLabel: p.spanLabel(p.cur), prevLabel: pk ? p.spanLabel(pk) : '' };
}
function scopeText() {
  var t = []; if (ftoViews.zone) t.push('โซน ' + ftoViews.zone);
  if (slicers.dc.size) t.push(slicers.dc.size > 2 ? slicers.dc.size + ' DC' : Array.from(slicers.dc).map(short).join(', '));
  return t.length ? t.join(' · ') : 'ทุกโซน';
}
function otherFilters() {
  var v = MP().view, t = [v.span === 'month' ? 'เทียบรายเดือน' : 'เทียบรายงวด', v.res === 'excl' ? 'ผลไม่รวมติดลบสะสม' : 'ผลทั้งหมด'];
  if (slicers.vtype.size) t.push('ประเภทรถ: ' + Array.from(slicers.vtype).map(vt).join(', '));
  if (slicers.pl.size) t.push(Array.from(slicers.pl).join(', '));
  return t.join(' · ');
}
function kpiData(P) {
  var c = calcSummary(P.cur), pr = P.prev ? calcSummary(P.prev) : null;
  return M().map(function (m) {
    var v = m.f(c), pv = pr ? m.f(pr) : NaN, d = v - pv, pct = Number.isFinite(pv) && pv ? d / Math.abs(pv) * 100 : NaN;
    return { m: m, l: m.l, v: v, prev: pv, diff: d, pct: pct, n: c.n, good: !Number.isFinite(d) || Math.abs(d) < 0.5 || !m.dir ? null : (m.dir > 0 ? d > 0 : d < 0) };
  });
}
function groupBy(rows, f) { var g = {}; rows.forEach(function (r) { var k = f(r); (g[k] = g[k] || []).push(r); }); return g; }
function zoneData(P) {
  var g = groupBy(P.all, function (r) { return zoneOf(r.dc_name); }), gp = P.allPrev ? groupBy(P.allPrev, function (r) { return zoneOf(r.dc_name); }) : {};
  var order = (window.ftoFleet ? ftoFleet.zoneList() : []).filter(function (z) { return g[z]; }).concat(Object.keys(g).filter(function (z) { return !window.ftoFleet || ftoFleet.zoneList().indexOf(z) < 0; }));
  return order.map(function (z) {
    var s = st(g[z]); s.z = z; s.prev = gp[z] ? st(gp[z]) : null; s.gr = grade(s.p7);
    var t = groupBy(g[z], function (r) { return r.vehicle_type; }); s.t = t; return s;
  });
}
function typeData(P) {
  var g = groupBy(P.cur, function (r) { return r.vehicle_type; });
  return Object.keys(g).sort(function (a, b) { return g[b].length - g[a].length; }).map(function (t) { var s = st(g[t]); s.name = vt(t); s.key = t; return s; });
}
function dcData(P) {
  var g = groupBy(P.cur, function (r) { return clean(r.dc_name); });
  return Object.keys(g).map(function (d) { var s = st(g[d]); s.d = d; s.name = short(d); s.code = (d.match(/^\d+/) || [''])[0]; s.z = zoneOf(d); s.gr = grade(s.p7); return s; });
}
function dcRanked(P) { return dcData(P).filter(function (s) { return s.n >= MINV; }); }
function dcWorst10(P) { return dcRanked(P).sort(function (a, b) { return a.an - b.an; }).slice(0, 10); }
function bw(list, key, n, dir) {
  var arr = list.filter(function (x) { return Number.isFinite(x[key]); }).sort(function (a, b) { return dir > 0 ? b[key] - a[key] : a[key] - b[key]; });
  var k = Math.min(n, Math.floor(arr.length / 2));
  return { best: arr.slice(0, k), worst: arr.slice(arr.length - k).reverse(), all: arr };
}
function bwData(P, id) { return { dc: bw(dcRanked(P), id, 5, X[id].dir), zn: bw(zoneData(P).filter(function (z) { return z.n >= MINV; }), id, 3, X[id].dir) }; }
function debtData() {
  if (!window.ftoDebt) return null; var L = ftoDebt.debtList(), o = { n: L.length, carry: 0, net: 0, st: {} };
  L.forEach(function (x) { o.carry += x.carry; o.net += x.net; var s = o.st[x.h.k] = o.st[x.h.k] || { n: 0, net: 0 }; s.n++; s.net += x.net; });
  return o;
}
var STN = { back: 'คืนรถให้บริษัท', newop: 'ผู้ประกอบการรายใหม่', newwait: 'ผู้ประกอบการรายใหม่ (ยังไม่วิ่งงาน)', gone: 'ลาออก ไม่มีทะเบียนกลับมา', noreg: 'ยังไม่มีข้อมูล NIMEX610' };
var STC = { back: '#123f8c', newop: '#6e93d6', newwait: '#9fb6de', gone: '#b8334a', noreg: '#8a99b3' };

/* ---------- ข้อความสรุป ---------- */
function diffTxt(t) {
  if (!Number.isFinite(t.prev)) return 'ไม่มีช่วงก่อนหน้า';
  var s = (t.diff > 0 ? '+' : t.diff < 0 ? '−' : '±') + (t.m.money ? fmtK(Math.abs(t.diff)) : nf(Math.abs(t.diff))) + (Number.isFinite(t.pct) && !t.m.share ? ' (' + (t.pct > 0 ? '+' : '') + t.pct.toFixed(1) + '%)' : '');
  return (t.good === null ? '' : t.good ? '🟢 ' : '🔴 ') + s;
}
function summaryText() {
  var P = period(), L = ['🚚 NIMEX Transport Operator · รถร่วม', '🗓️ ' + P.curLabel + '  |  📍 ' + scopeText(), P.prevLabel ? '↔️ เทียบ ' + P.prevLabel : '↔️ ไม่มีช่วงก่อนหน้า', '⚙️ ' + otherFilters()], sec = function (t) { L.push(''); L.push(t); };
  if (picked.kpi) { sec('🎯 8 ตัวหลัก'); kpiData(P).forEach(function (t) { L.push('• ' + t.l + ': ' + (t.m.money ? nf(t.v) + ' บาท' : nf(t.v)) + '  (' + diffTxt(t) + ')'); }); }
  if (picked.zone) { sec('🗺️ โซนที่กำไรเฉลี่ย/คันต่ำสุด'); zoneData(P).filter(function (z) { return z.n >= MINV; }).sort(function (a, b) { return a.an - b.an; }).slice(0, 3).forEach(function (z, i) { L.push(MD[i] + ' ' + z.z + ': ' + nf(z.an) + ' บาท/คัน (' + nf(z.n) + ' คัน)'); }); }
  if (picked.dc) { sec('🚨 DC กำไรเฉลี่ย/คันต่ำสุด (≥ ' + MINV + ' คัน)'); dcWorst10(P).slice(0, 5).forEach(function (s, i) { L.push(MD[i] + ' ' + s.d + ' (' + s.z + '): ' + nf(s.an) + ' บาท/คัน · ' + nf(s.n) + ' คัน'); }); }
  if (picked.type) { sec('🚛 แยกชนิดรถ'); typeData(P).forEach(function (s) { L.push('• ' + s.name + ': ' + nf(s.n) + ' คัน · กำไรสุทธิ ' + nf(s.net) + ' · เฉลี่ย ' + nf(s.an) + '/คัน · กำไร ' + p1(s.pp)); }); }
  if (picked.debt) { var D = debtData(); if (D) { sec('💳 รถรอปรับสภาพหนี้ ' + nf(D.n) + ' คัน · ยอดยกมา ' + nf(D.carry) + ' · คงเหลือสุทธิ ' + nf(D.net) + ' บาท'); Object.keys(D.st).forEach(function (k) { L.push('• ' + STN[k] + ': ' + D.st[k].n + ' คัน (' + nf(D.st[k].net) + ' บาท)'); }); } }
  BWK.forEach(function (id) {
    if (!picked['bw_' + id]) return; var B = bwData(P, id), f = function (s) { return X[id].money ? nf(s[id]) + ' บาท' : p1(s[id]); };
    sec('🏅 ดีสุด/แย่สุด · ' + X[id].l);
    B.dc.best.forEach(function (s) { L.push('🟢 ' + s.d + ': ' + f(s)); }); B.dc.worst.forEach(function (s) { L.push('🔴 ' + s.d + ': ' + f(s)); });
    L.push('โซน:'); B.zn.best.forEach(function (s) { L.push('🟢 ' + s.z + ': ' + f(s)); }); B.zn.worst.forEach(function (s) { L.push('🔴 ' + s.z + ': ' + f(s)); });
  });
  return L.join('\n');
}

/* ---------- SVG / อินโฟกราฟิก ---------- */
/* ---------- SVG: ฟอนต์ Prompt + โลโก้ฝังในภาพ (ไม่ใช้ html2canvas) ---------- */
var FONT_CSS = null, LOGO = null;
function fontCss() {
  if (FONT_CSS != null) return FONT_CSS;
  var out = [];
  [].forEach.call(document.querySelectorAll('style'), function (s) { (s.textContent.match(/@font-face\s*\{[^}]*\}/g) || []).forEach(function (f) { if (f.indexOf('Prompt') >= 0) out.push(f); }); });
  return (FONT_CSS = out.join('\n'));
}
function logoData() {
  if (LOGO) return Promise.resolve(LOGO);
  try {   /* ใช้รูปโลโก้ที่โหลดอยู่บนหน้าแล้ว (โดเมนเดียวกัน) */
    var im = document.querySelector('img.nx-logo');
    if (im && im.complete && im.naturalWidth) { var c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight; c.getContext('2d').drawImage(im, 0, 0); LOGO = c.toDataURL('image/png'); return Promise.resolve(LOGO); }
  } catch (e) { LOGO = null; }
  return fetch('logo.png').then(function (r) { return r.blob(); }).then(function (b) { return new Promise(function (res) { var f = new FileReader(); f.onload = function () { LOGO = f.result; res(LOGO); }; f.readAsDataURL(b); }); }).catch(function () { return ''; });
}
function wrapSvg(W, H, body) {
  return '<svg xmlns="http://www.w3.org/2000/svg" width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '" font-family="Prompt, sans-serif"><defs><style>' + fontCss() + ' text{font-family:Prompt,sans-serif}</style></defs>' + body + '</svg>';
}
function toPng(svg, W, H, scale) {
  return new Promise(function (res, rej) {
    var url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' })), img = new Image();
    img.onload = function () {
      var c = document.createElement('canvas'); c.width = Math.round(W * scale); c.height = Math.round(H * scale);
      var x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url);
      c.toBlob(function (b) { b ? res(b) : rej(new Error('png')); }, 'image/png');
    };
    img.onerror = function () { rej(new Error('svg')); }; img.src = url;
  });
}
function waitFonts() { return (document.fonts && document.fonts.ready) ? document.fonts.ready : Promise.resolve(); }
function T(x, y, s, o) { o = o || {}; return '<text x="' + x + '" y="' + y + '" font-size="' + (o.fs || 16) + '" font-weight="' + (o.fw || 400) + '" fill="' + (o.c || '#0b1f3f') + '"' + (o.a ? ' text-anchor="' + o.a + '"' : '') + '>' + E(s) + '</text>'; }

/* ---------- อินโฟกราฟิก 16:9 (1920×1080 → PNG 3840×2160) ---------- */
function niceAxis(vals) {   /* ช่วงแคบ (เช่น 70–95%) ไม่เริ่มที่ 0 */
  var v = vals.filter(Number.isFinite); if (!v.length) return { lo: 0, hi: 100, note: '' };
  var mn = Math.min.apply(null, v), mx = Math.max.apply(null, v);
  var lo = (v.length >= 2 && mn >= 40 && mx - mn <= 30) ? Math.max(0, Math.floor((mn - 5) / 10) * 10) : 0, top = Math.min(100, mx * 1.08), span = Math.max(1, top - lo), step = [1, 2, 5, 10, 20, 25].filter(function (x) { return x * 4 >= span; })[0] || 25;
  var hi = lo + step * 4; if (hi > 100 && mx <= 100) hi = 100;   /* % ไม่เกิน 100 */
  return { lo: lo, hi: hi, note: lo ? 'แกนเริ่มที่ ' + lo + '%' : '' };
}
function panel(x, y, w, h, title, sub) {
  return '<g transform="translate(' + x + ' ' + y + ')"><rect width="' + w + '" height="' + h + '" rx="16" fill="#fff" stroke="#dbe3f0"/><rect width="' + w + '" height="5" rx="2" fill="#d4af37"/>' +
    T(22, 38, title, { fs: 21, fw: 600, c: '#0a2a5e' }) + (sub ? T(w - 20, 38, sub, { fs: 14, c: '#55657f', a: 'end' }) : '') + '</g>';
}
function hbars(x, y, w, h, items, key, color) {   /* แท่งแนวนอน + จำนวนรายการ/คัน */
  var ax = niceAxis(items.map(function (i) { return i[key]; })), lab = 230, bwd = w - lab - 110, rh = Math.min(72, h / Math.max(1, items.length)), s = '';
  if (!items.length) return { s: T(x + w / 2, y + h / 2, 'ไม่มีข้อมูล', { fs: 16, a: 'middle', c: '#55657f' }), note: '' };
  items.forEach(function (it, i) {
    var yy = y + i * rh, val = it[key], len = Number.isFinite(val) ? Math.max(2, (Math.max(val, ax.lo) - ax.lo) / (ax.hi - ax.lo) * bwd) : 0;
    s += T(x, yy + rh / 2 - 2, it.name, { fs: 17, fw: 600 }) + T(x, yy + rh / 2 + 19, nf(it.n) + ' คัน', { fs: 13, c: '#55657f' });
    s += '<rect x="' + (x + lab) + '" y="' + (yy + rh * .22) + '" width="' + bwd + '" height="' + rh * .56 + '" rx="8" fill="#eef2f9"/><rect x="' + (x + lab) + '" y="' + (yy + rh * .22) + '" width="' + len + '" height="' + rh * .56 + '" rx="8" fill="' + color + '"/>';
    s += T(x + lab + bwd + 12, yy + rh / 2 + 7, p1(val), { fs: 21, fw: 600, c: '#0a2a5e' });
  });
  return { s: s, note: ax.note };
}
function vpairs(x, y, w, h, rows, k1, k2, c1, c2, l1, l2) {   /* แท่งคู่รายโซน */
  var ax = niceAxis(rows.reduce(function (a, r) { return a.concat([r[k1], r[k2]]); }, [])), n = rows.length, gw = w / Math.max(1, n), bwid = Math.min(24, gw * .32), base = y + h - 40, ch = h - 76, s = '';
  for (var t = 0; t <= 4; t++) { var gv = ax.lo + (ax.hi - ax.lo) * t / 4, gy = base - ch * t / 4; s += '<line x1="' + x + '" x2="' + (x + w) + '" y1="' + gy + '" y2="' + gy + '" stroke="#e4e9f2"/>' + T(x - 6, gy + 5, (Math.round(gv * 10) / 10) + '%', { fs: 12, c: '#8a99b3', a: 'end' }); }
  rows.forEach(function (r, i) {
    var cx = x + gw * i + gw / 2;
    [[k1, c1, -1], [k2, c2, 1]].forEach(function (b) {
      var v = r[b[0]]; if (!Number.isFinite(v)) return; var hh = Math.max(2, (Math.min(Math.max(v, ax.lo), ax.hi) - ax.lo) / (ax.hi - ax.lo) * ch), bx = cx + (b[2] < 0 ? -bwid - 2 : 2);
      s += '<rect x="' + bx + '" y="' + (base - hh) + '" width="' + bwid + '" height="' + hh + '" rx="4" fill="' + b[1] + '"/>' + T(bx + bwid / 2, base - hh - 6, v < 10 ? v.toFixed(1) : Math.round(v), { fs: 11.5, fw: 600, c: '#33445f', a: 'middle' });
    });
    s += T(cx, base + 20, r.z, { fs: 13, fw: 600, a: 'middle' }) + T(cx, base + 36, nf(r.n), { fs: 11, c: '#8a99b3', a: 'middle' });
  });
  s += '<rect x="' + x + '" y="' + (y - 4) + '" width="14" height="14" rx="3" fill="' + c1 + '"/>' + T(x + 20, y + 8, l1, { fs: 14 }) + '<rect x="' + (x + 250) + '" y="' + (y - 4) + '" width="14" height="14" rx="3" fill="' + c2 + '"/>' + T(x + 270, y + 8, l2, { fs: 14 });
  return { s: s, note: ax.note };
}
function donut2(cx, cy, r, items, center, sub) {
  var tot = items.reduce(function (a, x) { return a + x.v; }, 0), s = '', a0 = -Math.PI / 2, ri = r * .6;
  if (!tot) return T(cx, cy, 'ไม่มีข้อมูล', { fs: 16, a: 'middle', c: '#55657f' });
  items.forEach(function (x) {
    if (!x.v) return; var a1 = a0 + x.v / tot * Math.PI * 2, big = a1 - a0 > Math.PI ? 1 : 0;
    if (x.v === tot) s += '<circle cx="' + cx + '" cy="' + cy + '" r="' + (r + ri) / 2 + '" fill="none" stroke="' + x.c + '" stroke-width="' + (r - ri) + '"/>';
    else s += '<path d="M' + (cx + r * Math.cos(a0)) + ' ' + (cy + r * Math.sin(a0)) + 'A' + r + ' ' + r + ' 0 ' + big + ' 1 ' + (cx + r * Math.cos(a1)) + ' ' + (cy + r * Math.sin(a1)) + 'L' + (cx + ri * Math.cos(a1)) + ' ' + (cy + ri * Math.sin(a1)) + 'A' + ri + ' ' + ri + ' 0 ' + big + ' 0 ' + (cx + ri * Math.cos(a0)) + ' ' + (cy + ri * Math.sin(a0)) + 'Z" fill="' + x.c + '"/>';
    a0 = a1;
  });
  return s + T(cx, cy + 4, center, { fs: 32, fw: 600, c: '#0a2a5e', a: 'middle' }) + T(cx, cy + 28, sub, { fs: 14, c: '#55657f', a: 'middle' });
}
function infographic(logo) {
  var W = 1920, H = 1080, P = period(), K = kpiData(P), s = '', par = k6().param;
  s += '<rect width="' + W + '" height="' + H + '" fill="#eef2f9"/><rect width="' + W + '" height="120" fill="#0a2a5e"/><rect y="116" width="' + W + '" height="4" fill="#d4af37"/>';
  s += '<rect x="28" y="22" width="170" height="76" rx="12" fill="#fff"/>' + (logo ? '<image href="' + logo + '" x="38" y="30" width="150" height="60" preserveAspectRatio="xMidYMid meet"/>' : '');
  s += T(226, 60, 'NIMEX Transport Operator · สรุปผลรถร่วม', { fs: 33, fw: 600, c: '#fff' }) + T(226, 94, P.curLabel + (P.prevLabel ? '  ·  เทียบ ' + P.prevLabel : '  ·  ไม่มีช่วงก่อนหน้า') + '  ·  ' + otherFilters(), { fs: 18, c: '#f0d57a' });
  var sc = scopeText(); if (sc.length > 20) sc = sc.slice(0, 19) + '…';
  s += '<rect x="' + (W - 330) + '" y="34" width="302" height="52" rx="26" fill="#d4af37"/>' + T(W - 179, 68, '📍 ' + sc, { fs: 20, fw: 600, c: '#0a2a5e', a: 'middle' });
  var gap = 12, n = K.length, cw = (W - 56 - gap * (n - 1)) / n, cy = 140, chh = 160;
  K.forEach(function (t, i) {
    var x = 28 + i * (cw + gap), dc = t.good === null ? '#cfdcf2' : t.good ? '#5fe0a0' : '#ff8a98', neg = (t.m.id === 'net' || t.m.id === 'an') && t.v < 0;
    s += '<g transform="translate(' + x + ' ' + cy + ')"><rect width="' + cw + '" height="' + chh + '" rx="16" fill="#0a2a5e"/><rect y="' + (chh - 6) + '" width="' + cw + '" height="6" rx="3" fill="#d4af37"/>';
    s += T(cw / 2, 34, t.l, { fs: 15, fw: 500, c: '#f0d57a', a: 'middle' }) + T(cw / 2, 88, t.m.money ? money(t.v) : nf(t.v), { fs: 38, fw: 600, c: neg ? '#ff9aa8' : '#fff', a: 'middle' });
    s += T(cw / 2, 118, t.m.share && t.n ? (t.v / t.n * 100).toFixed(1) + '% ของทั้งหมด' : (t.m.money ? 'บาท' + (t.m.id === 'ar' || t.m.id === 'an' ? '/คัน' : '') : 'คัน'), { fs: 13, c: '#cfdcf2', a: 'middle' });
    s += T(cw / 2, 142, Number.isFinite(t.prev) ? (t.diff > 0 ? '▲ ' : t.diff < 0 ? '▼ ' : '') + diffTxt(t).replace(/^🟢 |^🔴 /, '') : 'ไม่มีช่วงก่อนหน้า', { fs: 14, fw: 600, c: Number.isFinite(t.prev) ? dc : '#cfdcf2', a: 'middle' });
    s += '</g>';
  });
  var top = cy + chh + 20, pw = (W - 56 - 20) / 2, ph = (H - top - 52 - 20) / 2, xs = [28, 28 + pw + 20], ys = [top, top + ph + 20];
  var TD = typeData(P), ZD = zoneData(P), types = TD.slice(0, 2).map(function (t) { return t.key; }).sort();
  var g1 = hbars(xs[0] + 24, ys[0] + 64, pw - 48, ph - 84, TD, 'pp', '#1d57b8');
  s += panel(xs[0], ys[0], pw, ph, '% รถกำไร แยกชนิดรถ', [scopeText() !== 'ทุกโซน' ? scopeText() : '', g1.note].filter(Boolean).join(' · ')) + g1.s;
  var pr = ZD.map(function (z) { var a = z.t[types[0]], b = z.t[types[1]]; return { z: z.z, n: z.n, a: a ? st(a).pp : NaN, b: b ? st(b).pp : NaN }; });
  var g2 = vpairs(xs[1] + 60, ys[0] + 66, pw - 84, ph - 74, pr, 'a', 'b', '#1d57b8', '#b8860b', vt(types[0]) || '-', vt(types[1]) || '-');
  s += panel(xs[1], ys[0], pw, ph, '% รถกำไร รายโซน · ' + (vt(types[0]) || '') + ' vs ' + (vt(types[1]) || ''), g2.note || 'ทุกโซน') + g2.s;
  var g3 = vpairs(xs[0] + 60, ys[1] + 66, pw - 84, ph - 74, ZD, 'p7', 'loss', '#123f8c', '#b8334a', '% คงเหลือ ≥ ' + nf(par), '% รถขาดทุน');
  s += panel(xs[0], ys[1], pw, ph, '% รถคงเหลือ ≥ ' + nf(par) + ' บาท และ % รถขาดทุน รายโซน', g3.note || 'ทุกโซน') + g3.s;
  var lx = xs[1] + 330, ly = ys[1] + 70, ccx = xs[1] + 170, ccy = ys[1] + ph / 2 + 18, rr = Math.min(120, ph / 2 - 50);
  if (gradesOn()) {
    var DD = dcRanked(P), cnt = {}; DD.forEach(function (d) { cnt[d.gr] = (cnt[d.gr] || 0) + 1; });
    var gc = k6().grade, prevG = { B: 'A', C: 'B', D: 'C' };
    s += panel(xs[1], ys[1], pw, ph, 'เกรด DC ตาม KPI ' + E(k6().no) + ' (% รถคงเหลือ ≥ ' + nf(par) + ') + แย่สุด 3', 'DC ≥ ' + MINV + ' คัน') + donut2(ccx, ccy, rr, ['A', 'B', 'C', 'D', 'F'].map(function (g) { return { v: cnt[g] || 0, c: GC[g] }; }), nf(DD.length), 'DC');
    ['A', 'B', 'C', 'D', 'F'].forEach(function (g, i) { var rng = g === 'A' ? '≥ ' + gc.A + '%' : g === 'F' ? '< ' + gc.D + '%' : gc[g] + '–<' + gc[prevG[g]] + '%'; s += '<rect x="' + lx + '" y="' + (ly + i * 30) + '" width="18" height="18" rx="4" fill="' + GC[g] + '"/>' + T(lx + 26, ly + i * 30 + 15, g + '  ' + rng + '  ·  ' + (cnt[g] || 0) + ' DC', { fs: 15 }); });
    var worst = DD.slice().sort(function (a, b) { return a.p7 - b.p7; }).slice(0, 3), wy = ly + 170;
    s += T(lx, wy, 'แย่สุด 3 อันดับ', { fs: 16, fw: 600, c: '#b8334a' });
    worst.forEach(function (d, i) { s += '<circle cx="' + (lx + 12) + '" cy="' + (wy + 26 + i * 30) + '" r="11" fill="#b8334a"/>' + T(lx + 12, wy + 31 + i * 30, i + 1, { fs: 13, fw: 600, c: '#fff', a: 'middle' }) + T(lx + 32, wy + 31 + i * 30, d.d + ' (' + d.z + ')  ' + p1(d.p7) + ' · ' + nf(d.n) + ' คัน', { fs: 15 }); });
  } else {
    var Dd = debtData() || { n: 0, st: {}, net: 0 }, ks = Object.keys(Dd.st);
    s += panel(xs[1], ys[1], pw, ph, 'รถรอปรับสภาพหนี้ ตามสถานะผู้ถือครองทะเบียน', MP().spanLabel(MP().cur, 'round')) + donut2(ccx, ccy, rr, ks.map(function (k) { return { v: Dd.st[k].n, c: STC[k] }; }), nf(Dd.n), 'คัน');
    ks.forEach(function (k, i) { s += '<rect x="' + lx + '" y="' + (ly + i * 34) + '" width="18" height="18" rx="4" fill="' + STC[k] + '"/>' + T(lx + 26, ly + i * 34 + 15, STN[k] + '  ·  ' + Dd.st[k].n + ' คัน  ·  ' + nf(Dd.st[k].net) + ' บาท', { fs: 15 }); });
    s += T(lx, ly + ks.length * 34 + 30, 'คงเหลือสุทธิรวม ' + nf(Dd.net) + ' บาท', { fs: 17, fw: 600, c: '#b8334a' });
  }
  s += '<rect y="' + (H - 40) + '" width="' + W + '" height="40" fill="#0a2a5e"/>' + T(28, H - 14, 'สูตร: 8 ตัวหลักจากไฟล์ NIMEX03102 · รถร่วมในฐานรถวิ่งงาน (จับคู่ด้วยรหัสรถ) · ไม่นับ DC 801 และรถ 6 ล้อขึ้นไป · 680/690 นับเป็น 691 · กำไร = คงเหลือสุทธิ > 0 · % ≥ เกณฑ์ = คงเหลือสุทธิ ≥ ' + nf(par) + ' บาท', { fs: 14, c: '#cfdcf2' }) + T(W - 28, H - 14, 'NIMEX Fleet Hub', { fs: 15, fw: 600, c: '#f0d57a', a: 'end' });
  return wrapSvg(W, H, s);
}
function sections(P) {
  var out = [];
  if (picked.kpi) out.push({ k: 'kpi', t: '8 ตัวหลัก', head: ['ตัวชี้วัด', 'ช่วงนี้', 'ช่วงก่อนหน้า', 'ผลต่าง'], rows: kpiData(P).map(function (t) { return [t.l, nf(t.v), Number.isFinite(t.prev) ? nf(t.prev) : '–', (Number.isFinite(t.diff) && t.diff > 0 ? '▲ ' : Number.isFinite(t.diff) && t.diff < 0 ? '▼ ' : '') + diffTxt(t).replace(/^🟢 |^🔴 /, '')]; }), tone: kpiData(P).map(function (t) { return t.good; }) });
  if (picked.zone) out.push({ k: 'zone', t: 'ผลรายโซน (ทุกโซน)', head: ['โซน', 'คัน', 'รายได้รวม', 'กำไรสุทธิรวม', 'เฉลี่ย/คัน', '% รถกำไร', '% ≥ ' + nf(k6().param), '% รถขาดทุน'], rows: zoneData(P).map(function (z) { return [z.z, nf(z.n), nf(z.rev), nf(z.net), nf(z.an), p1(z.pp), p1(z.p7), p1(z.loss)]; }) });
  if (picked.dc) out.push({ k: 'dc', t: 'DC กำไรเฉลี่ย/คันต่ำสุด 10 อันดับ (≥ ' + MINV + ' คัน)', head: ['#', 'DC', 'โซน', 'คัน', 'กำไรสุทธิรวม', 'เฉลี่ย/คัน', '% รถกำไร', '% ≥ ' + nf(k6().param)], rows: dcWorst10(P).map(function (s, i) { return [i + 1, s.d, s.z, nf(s.n), nf(s.net), nf(s.an), p1(s.pp), p1(s.p7)]; }) });
  if (picked.type) out.push({ k: 'type', t: 'แยกชนิดรถ', head: ['ชนิดรถ', 'คัน', 'รายได้รวม', 'กำไรสุทธิรวม', 'เฉลี่ย/คัน', '% รถกำไร', '% ≥ ' + nf(k6().param)], rows: typeData(P).map(function (s) { return [s.name, nf(s.n), nf(s.rev), nf(s.net), nf(s.an), p1(s.pp), p1(s.p7)]; }) });
  if (picked.debt) { var D = debtData(); if (D) out.push({ k: 'debt', t: 'รถรอปรับสภาพหนี้ · ' + MP().spanLabel(MP().cur, 'round'), head: ['สถานะผู้ถือครองทะเบียน', 'คัน', 'คงเหลือสุทธิรวม'], rows: Object.keys(D.st).map(function (k) { return [STN[k], nf(D.st[k].n), nf(D.st[k].net)]; }).concat([['รวม', nf(D.n), nf(D.net)]]) }); }
  BWK.forEach(function (id) {
    if (!picked['bw_' + id]) return; var B = bwData(P, id), f = function (s) { return X[id].money ? nf(s[id]) : p1(s[id]); }, tag = function (x, g) { return g.best.indexOf(x) >= 0 ? 'ดีสุด' : g.worst.indexOf(x) >= 0 ? 'แย่สุด' : ''; };
    out.push({ k: 'bw_' + id, t: 'ดีสุด/แย่สุด · ' + X[id].l, head: ['ป้าย', 'ระดับ', 'ชื่อ', 'โซน', 'คัน', X[id].l],
      rows: B.dc.best.concat(B.dc.worst).map(function (s) { return [tag(s, B.dc), 'DC', s.d, s.z, nf(s.n), f(s)]; }).concat(B.zn.best.concat(B.zn.worst).map(function (s) { return [tag(s, B.zn), 'โซน', s.z, s.z, nf(s.n), f(s)]; })),
      full: B.dc.all.map(function (s, i) { return [tag(s, B.dc), 'DC', i + 1, s.d, s.z, s.n, +(+s[id]).toFixed(2)]; }).concat(B.zn.all.map(function (s, i) { return [tag(s, B.zn), 'โซน', i + 1, s.z, s.z, s.n, +(+s[id]).toFixed(2)]; })) });
  });
  return out;
}

function tableSvg(sec, W) {
  var rh = 36, n = sec.head.length, first = Math.min(260, W * .24), cw = (W - first) / Math.max(1, n - 1), s = T(0, 26, sec.t, { fs: 22, fw: 600, c: '#0a2a5e' }), y0 = 42;
  var cx = function (i) { return i === 0 ? 10 : first + (i - 1) * cw + 10; };
  if (sec.k === 'dc' || sec.k.indexOf('bw_') === 0) { first = sec.k === 'dc' ? 60 : 90; cw = (W - first) / (n - 1); cx = function (i) { if (i === 0) return 10; if (i === 1) return first + 10; return first + 230 + (i - 2) * (W - first - 230) / (n - 2) + 10; }; }
  s += '<rect y="' + y0 + '" width="' + W + '" height="' + rh + '" rx="6" fill="#0a2a5e"/>';
  sec.head.forEach(function (h, i) { s += T(cx(i), y0 + 24, h, { fs: 14.5, fw: 600, c: '#fff' }); });
  sec.rows.forEach(function (r, j) {
    var y = y0 + (j + 1) * rh; if (j % 2) s += '<rect y="' + y + '" width="' + W + '" height="' + rh + '" fill="#f2f5fb"/>';
    r.forEach(function (c, i) { var tn = sec.tone && i === r.length - 1 ? sec.tone[j] : null, col = c === 'แย่สุด' || c === 'F' || tn === false ? BAD : c === 'ดีสุด' || tn === true ? GOOD : '#0b1f3f'; s += T(cx(i), y + 24, c, { fs: 14.5, fw: i < 1 ? 600 : 400, c: col }); });
  });
  if (!sec.rows.length) s += T(10, y0 + rh + 24, 'ไม่มีข้อมูลตามตัวกรอง', { fs: 14.5, c: '#55657f' });
  return { s: s, h: y0 + (Math.max(1, sec.rows.length) + 1) * rh };
}
function longSvg(logo) {
  var P = period(), W = 1500, x = 40, y = 160, body = '', secs = sections(P);
  secs.forEach(function (sec) { var t = tableSvg(sec, W - 80); body += '<g transform="translate(' + x + ' ' + y + ')">' + t.s + '</g>'; y += t.h + 40; });
  var H = y + 30, head = '<rect width="' + W + '" height="' + H + '" fill="#fff"/><rect width="' + W + '" height="130" fill="#0a2a5e"/><rect y="126" width="' + W + '" height="4" fill="#d4af37"/><rect x="28" y="22" width="150" height="76" rx="12" fill="#fff"/>' +
    (logo ? '<image href="' + logo + '" x="36" y="30" width="134" height="60" preserveAspectRatio="xMidYMid meet"/>' : '') + T(200, 56, 'NIMEX Transport Operator · รถร่วม', { fs: 32, fw: 600, c: '#fff' }) +
    T(200, 88, P.curLabel + ' · ' + scopeText() + (P.prevLabel ? ' · เทียบ ' + P.prevLabel : ' · ไม่มีช่วงก่อนหน้า'), { fs: 18, c: '#f0d57a' }) + T(200, 114, otherFilters(), { fs: 14, c: '#cfdcf2' });
  return { svg: wrapSvg(W, H, head + body), W: W, H: H };
}

/* ---------- ไฟล์ ---------- */
var SHEET = { kpi: '8 ตัวหลัก', zone: 'ผลรายโซน', dc: 'DC ต่ำสุด 10 อันดับ', type: 'แยกชนิดรถ', debt: 'รถรอปรับสภาพหนี้', bw_an: 'ดีสุด-แย่สุด กำไรเฉลี่ยต่อคัน', bw_pp: 'ดีสุด-แย่สุด % รถกำไร', bw_p7: 'ดีสุด-แย่สุด % คงเหลือถึงเกณฑ์' };
var LIBS = { pptx: ['PptxGenJS', 'https://cdnjs.cloudflare.com/ajax/libs/pptxgenjs/3.12.0/pptxgen.bundle.js'], xlsx: ['XLSX', 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'] };
function loadLib(k) { return new Promise(function (res, rej) { var g = LIBS[k][0]; if (window[g]) return res(); var s = document.createElement('script'); s.src = LIBS[k][1]; s.onload = res; s.onerror = function () { rej(new Error('lib')); }; document.head.appendChild(s); }); }
function fname() { var p = MP(); return 'NIMEX-TransportOperator-' + (p.view.span === 'month' ? p.cur.slice(0, 7) : p.cur) + (scopeText() !== 'ทุกโซน' ? '-Filtered' : ''); }
function download(blob, name) { var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1500); }
function say(m) { var x = $('fts-msg'); if (x) x.textContent = m; }
function doInfo() { say('กำลังสร้างอินโฟกราฟิก…'); return waitFonts().then(logoData).then(function (lg) { return toPng(infographic(lg), 1920, 1080, 2); }).then(function (b) { download(b, fname() + '-infographic-16x9.png'); say('✓ ดาวน์โหลดอินโฟกราฟิก 16:9 แล้ว (3840×2160)'); }).catch(function (e) { say('สร้างภาพไม่สำเร็จ: ' + e.message); }); }
function doPng() { if (!sections(period()).length) return say('กรุณาเลือกหัวข้ออย่างน้อย 1 หัวข้อ'); say('กำลังสร้างรูป…'); return waitFonts().then(logoData).then(function (lg) { var L = longSvg(lg); return toPng(L.svg, L.W, L.H, 2); }).then(function (b) { download(b, fname() + '.png'); say('✓ ดาวน์โหลดรูป PNG แล้ว'); }).catch(function (e) { say('สร้างรูปไม่สำเร็จ: ' + e.message); }); }
function doXlsx() {
  var P = period(), secs = sections(P); if (!secs.length) return say('กรุณาเลือกหัวข้ออย่างน้อย 1 หัวข้อ');
  return loadLib('xlsx').then(function () {
    var wb = XLSX.utils.book_new(), used = {};
    secs.forEach(function (sec) {
      var aoa = [[sec.t], [P.curLabel + ' · ' + scopeText() + (P.prevLabel ? ' · เทียบ ' + P.prevLabel : ' · ไม่มีช่วงก่อนหน้า')], [otherFilters()], []];
      if (sec.full) { aoa.push(['ป้าย', 'ระดับ', 'อันดับ', 'ชื่อ', 'โซน', 'คัน', sec.head[5]]); aoa = aoa.concat(sec.full); }
      else { aoa.push(sec.head); aoa = aoa.concat(sec.rows); }
      var name = SHEET[sec.k] || sec.k, i = 2; while (used[name]) name = name.slice(0, 26) + ' ' + (i++); used[name] = 1;
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), name);
    });
    XLSX.writeFile(wb, fname() + '.xlsx'); say('✓ ดาวน์โหลด Excel แล้ว (' + secs.length + ' ชีต)');
  }).catch(function (e) { say('สร้าง Excel ไม่สำเร็จ: ' + e.message); });
}
function doPptx() {
  var P = period(), secs = sections(P); say('กำลังสร้าง PowerPoint…');
  return Promise.all([loadLib('pptx'), waitFonts().then(logoData)]).then(function (x) {
    var lg = x[1]; return toPng(infographic(lg), 1920, 1080, 1).then(function (b) { return new Promise(function (res) { var f = new FileReader(); f.onload = function () { res(f.result); }; f.readAsDataURL(b); }); });
  }).then(function (img) {
    var pp = new PptxGenJS(); pp.layout = 'LAYOUT_WIDE';
    pp.addSlide().addImage({ data: img, x: 0, y: 0, w: 13.333, h: 7.5 });
    secs.forEach(function (sec) {
      var sl = pp.addSlide(); sl.background = { color: 'FFFFFF' };
      sl.addShape(pp.ShapeType.rect, { x: 0, y: 0, w: 13.333, h: 0.9, fill: { color: '0A2A5E' } });
      sl.addText(sec.t, { x: 0.4, y: 0.12, w: 12.5, h: 0.45, fontFace: 'Prompt', fontSize: 22, bold: true, color: 'FFFFFF' });
      sl.addText(P.curLabel + ' · ' + scopeText(), { x: 0.4, y: 0.52, w: 12.5, h: 0.3, fontFace: 'Prompt', fontSize: 12, color: 'F0D57A' });
      var rows = [sec.head.map(function (h) { return { text: String(h), options: { bold: true, color: 'FFFFFF', fill: { color: '0A2A5E' } } }; })]
        .concat(sec.rows.slice(0, 16).map(function (r, j) { return r.map(function (c, i) { var tn = sec.tone && i === r.length - 1 ? sec.tone[j] : null; return { text: String(c), options: { color: c === 'แย่สุด' || c === 'F' || tn === false ? 'B8334A' : c === 'ดีสุด' || tn === true ? '1A9E5F' : '0B1F3F' } }; }); }));
      sl.addTable(rows, { x: 0.4, y: 1.15, w: 12.5, fontFace: 'Prompt', fontSize: 11.5, border: { type: 'solid', color: 'DBE3F0', pt: 0.5 }, autoPage: false });
    });
    return pp.writeFile({ fileName: fname() + '.pptx' });
  }).then(function () { say('✓ ดาวน์โหลด PowerPoint แล้ว (' + (secs.length + 1) + ' สไลด์)'); }).catch(function (e) { say('สร้าง PowerPoint ไม่สำเร็จ: ' + e.message); });
}


/* ---------- หน้าต่างแชร์ ---------- */
function render() {
  var P = period();
  $('fts-body').innerHTML =
    '<p class="fts-note">🗓️ ' + E(P.curLabel) + ' · 📍 ' + E(scopeText()) + '<br>↔️ ' + (P.prevLabel ? 'เทียบ ' + E(P.prevLabel) : 'ไม่มีช่วงก่อนหน้า') + '<br>⚙️ ' + E(otherFilters()) + '<br>ใช้ตัวกรองแถวบน — เปลี่ยนงวด/โซน/ตัวกรองแล้วเปิดหน้าต่างนี้ใหม่</p>' +
    '<button type="button" class="fts-info" data-act="info">🖼️ อินโฟกราฟิก 16:9</button>' +
    '<div class="fts-h">เลือกหัวข้อสำหรับ Excel / PowerPoint / PNG / ข้อความ</div><div class="fts-checks">' + SECS.map(function (s) { return '<label><input type="checkbox" data-sec="' + s[0] + '"' + (picked[s[0]] ? ' checked' : '') + '> ' + E(s[1]) + '</label>'; }).join('') + '</div>' +
    '<div class="fts-btns"><button type="button" data-act="xlsx">Excel</button><button type="button" data-act="pptx">PowerPoint</button><button type="button" data-act="png">รูป PNG ยาว</button></div>' +
    '<label class="fts-h" for="fts-text">ข้อความสรุป (คัดลอกไปวาง LINE / อีเมล)</label><textarea id="fts-text" rows="9">' + E(summaryText()) + '</textarea>' +
    '<div class="fts-btns"><button type="button" class="alt" data-act="copy">คัดลอกข้อความ</button></div><p class="fts-msg" id="fts-msg" role="status"></p>';
}
function open() { if (!MP() || !MP().cur) return; $('fts').hidden = false; render(); }
function close() { $('fts').hidden = true; }
function mount() {
  var d = document.createElement('div'); d.id = 'fts'; d.hidden = true; d.className = 'fts';
  d.innerHTML = '<div class="fts-box" role="dialog" aria-modal="true" aria-labelledby="fts-t"><div class="fts-top"><h2 id="fts-t">📤 แชร์และส่งออก</h2><button type="button" class="fts-x" data-act="close" aria-label="ปิด">✕</button></div><div id="fts-body"></div></div>';
  document.body.appendChild(d);
  d.addEventListener('click', function (e) {
    if (e.target === d) return close();
    var b = e.target.closest('[data-act]'); if (!b) return; var a = b.dataset.act;
    if (a === 'close') close(); else if (a === 'info') doInfo(); else if (a === 'png') doPng(); else if (a === 'xlsx') doXlsx(); else if (a === 'pptx') doPptx();
    else if (a === 'copy') { var t = $('fts-text'); (navigator.clipboard ? navigator.clipboard.writeText(t.value) : Promise.reject()).then(function () { say('✓ คัดลอกข้อความแล้ว'); }).catch(function () { t.select(); document.execCommand('copy'); say('✓ คัดลอกข้อความแล้ว'); }); }
  });
  d.addEventListener('change', function (e) { var k = e.target.dataset && e.target.dataset.sec; if (k) { if (e.target.checked) picked[k] = 1; else delete picked[k]; var t = $('fts-text'); if (t) t.value = summaryText(); } });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !$('fts').hidden) close(); });
  var btn = $('shareBtn'); if (btn) btn.onclick = open;
}
window.ftoShare = { open: open, summaryText: summaryText, period: period, kpiData: kpiData, zoneData: zoneData, typeData: typeData, dcWorst10: dcWorst10, bwData: bwData, infographic: infographic, sections: sections };
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount); else mount();
})();
