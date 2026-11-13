/* NIMEX Fleet Transport Operator — หน้าตาใหม่ (ไม่เปลี่ยนสูตร: ใช้ calcSummary / getFiltered ของหน้าเดิม)
   • ตัวกรองย้ายจากแถบซ้ายไปแถวด้านบน + เพิ่ม: รอบ/เดือน · ผลทั้งหมด/ไม่รวมติดลบสะสม · โซน
   • สรุปผู้บริหาร: กรอบหลัก 8 ตัว + แถวรองเทียบงวด/เดือนก่อน · แยกชนิดรถ 2 ฝั่ง · 8 ด้านรายโซน
   • ประชุมทีม: 8 ตัวหลัก รายโซน / ราย DC · เทรนด์: ผลรายงวด/รายเดือน (ตัวอย่าง) · ความเสี่ยง: เริ่มติดลบตั้งแต่งวดไหน */
(function () {
'use strict';
var M = [
  { id: 'n', l: 'รถทั้งหมด', s: 'จำนวนรถ', icon: '🚛', unit: 'คัน', dir: 0, f: function (s) { return s.n; } },
  { id: 'rev', l: 'รายได้รวม', s: 'รายได้', icon: '💰', money: 1, dir: 1, f: function (s) { return s.total_rev; } },
  { id: 'exp', l: 'ค่าใช้จ่ายรวม', s: 'ค่าใช้จ่าย', icon: '📋', money: 1, dir: -1, sub: 'รวมค่าเช่ารถ', f: function (s) { return s.total_exp + s.total_rental; } },
  { id: 'net', l: 'กำไรสุทธิรวม', s: 'กำไรสุทธิ', icon: '📈', money: 1, dir: 1, f: function (s) { return s.total_net; } },
  { id: 'pc', l: 'รถกำไร', icon: '✅', unit: 'คัน', dir: 1, share: 1, f: function (s) { return s.profit_count; } },
  { id: 'lc', l: 'รถขาดทุน', icon: '🔴', unit: 'คัน', dir: -1, share: 1, f: function (s) { return s.loss_count; } },
  { id: 'ar', l: 'เฉลี่ยรายได้/คัน', s: 'รายได้/คัน', icon: '📊', money: 1, dir: 1, f: function (s) { return s.avg_rev; } },
  { id: 'an', l: 'เฉลี่ยกำไรสุทธิ/คัน', s: 'กำไร/คัน', icon: '💹', money: 1, dir: 1, f: function (s) { return s.avg_net; } }
];
var ZONE = '', TEAM = { by: 'zone', sort: 'net', desc: false }, TREND = { m: 'an' };
function $(id) { return document.getElementById(id); }
function E(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
function nf(v) { return Number.isFinite(v) ? Math.round(v).toLocaleString('th-TH') : '–'; }
function fv(m, v, full) { if (!Number.isFinite(v)) return '–'; return m.money ? (full ? nf(v) : '฿' + fmtK(v)) : nf(v); }
function FP() { return window.ftoPeriod; }
function Z(dc) { return window.ftoFleet ? ftoFleet.zoneOf(dc) : '-'; }
function vtName(t) { return String(t || '').replace(/^\d+\s+/, ''); }

/* ---------- ข้อมูล + ช่วงก่อนหน้า (ใช้ตัวกรองเดิมของหน้าโดยสลับ DB ชั่วคราว) ---------- */
function filtered(rows) { var keep = DB; DB = rows; try { return getFiltered(); } finally { DB = keep; } }
function prevRows() { var p = FP(), k = p.prevFor(p.cur); return k ? filtered(p.dataset(k)) : null; }
function prevLabel() { var p = FP(), k = p.prevFor(p.cur); return k ? p.spanLabel(k) : ''; }
function deltaHtml(m, v, pv, s, ps, short) {
  if (!Number.isFinite(pv)) return '<span class="vw-d">ไม่มีช่วงก่อนหน้า</span>';
  var d = v - pv; if (Math.abs(d) < 0.5 && !m.share) return '<span class="vw-d">เท่าเดิม</span>';
  var good = m.dir === 0 ? null : (m.dir > 0 ? d > 0 : d < 0), pct = pv ? d / Math.abs(pv) * 100 : NaN;
  var txt = (d > 0 ? '▲ +' : d < 0 ? '▼ ' : '± ') + (m.money ? fmtK(d) : nf(d)) + (Number.isFinite(pct) && !m.share && !short ? ' (' + (pct > 0 ? '+' : '') + pct.toFixed(1) + '%)' : '');
  if (m.share && s && ps && s.n && ps.n && !short) { var sp = m.f(s) / s.n * 100 - m.f(ps) / ps.n * 100; txt += ' · ' + (sp > 0 ? '+' : '') + sp.toFixed(1) + ' จุด'; }
  return '<span class="vw-d ' + (good === null || d === 0 ? '' : good ? 'up' : 'down') + '">' + txt + '</span>';
}
function groupStats(rows, key) { var g = {}; rows.forEach(function (r) { var k = key(r); (g[k] = g[k] || []).push(r); }); var o = {}; Object.keys(g).forEach(function (k) { o[k] = calcSummary(g[k]); }); return o; }

/* ---------- แถบตัวกรองด้านบน ---------- */
function buildBar() {
  var sb = $('sidebar'), content = $('content'); if (!sb || !content || $('vw-bar')) return;
  var bar = document.createElement('div'); bar.id = 'vw-bar'; bar.setAttribute('role', 'region'); bar.setAttribute('aria-label', 'ตัวกรองข้อมูล');
  bar.innerHTML = '<div class="vw-grp vw-fix"><span class="vw-l">งวด</span><span id="vw-slot-p"></span></div>' +
    '<div class="vw-grp vw-fix"><span class="vw-l">เทียบแบบ</span><div class="vw-seg" data-k="span"><button type="button" data-v="round">รอบ</button><button type="button" data-v="month">เดือน</button></div></div>' +
    '<div class="vw-grp vw-fix"><span class="vw-l">ผล</span><div class="vw-seg" data-k="res"><button type="button" data-v="all">ทั้งหมด</button><button type="button" data-v="excl" title="ผลไม่รวมติดลบสะสม = คงเหลือสุทธิ + ยอดยกมา (คอลัมน์ S)">ไม่รวมติดลบสะสม</button></div></div>' +
    '<div class="vw-grp"><span class="vw-l">โซน</span><select id="vw-zone" class="slicer-dropdown" aria-label="โซน"></select></div>' +
    '<div class="vw-grp"><span class="vw-l">DC</span><span id="vw-slot-dc"></span></div><div class="vw-grp"><span class="vw-l">ประเภทรถ</span><span id="vw-slot-vt"></span></div><div class="vw-grp"><span class="vw-l">กำไร/ขาดทุน</span><span id="vw-slot-pl"></span></div>' +
    '<div class="vw-grp vw-end"><span id="vw-slot-reset"></span><span class="vw-cnt" id="vw-slot-cnt"></span></div>';
  content.insertBefore(bar, content.firstChild);
  var mv = function (sel, slot) { var e = typeof sel === 'string' ? sb.querySelector(sel) : sel; if (e) $(slot).appendChild(e); };
  mv('#fp-sel', 'vw-slot-p'); mv('#dc-select', 'vw-slot-dc'); mv('#vtype-select', 'vw-slot-vt'); mv('#pl-select', 'vw-slot-pl');
  var rb = Array.prototype.find.call(sb.querySelectorAll('button'), function (b) { return /ล้าง/.test(b.textContent); }); if (rb) { rb.classList.add('vw-reset'); rb.textContent = '🔄 ล้าง'; rb.title = 'ล้างตัวกรองทั้งหมด'; mv(rb, 'vw-slot-reset'); }
  mv('#filter-count', 'vw-slot-cnt');
  sb.hidden = true; document.body.classList.add('vw-nosb');
  bar.addEventListener('click', function (e) { var b = e.target.closest('.vw-seg button'); if (!b) return; FP().setView(b.parentNode.dataset.k, b.dataset.v); syncBar(); });
  $('vw-zone').onchange = function () { ZONE = this.value; renderCurrentPage(); if (typeof updateFilterCount === 'function') updateFilterCount(); };
}
function syncBar() {
  document.querySelectorAll('#vw-bar .vw-seg').forEach(function (s) { var v = FP().view[s.dataset.k]; s.querySelectorAll('button').forEach(function (b) { b.setAttribute('aria-pressed', b.dataset.v === v); }); });
  var z = $('vw-zone'); if (z) z.innerHTML = '<option value="">— ทุกโซน —</option>' + (window.ftoFleet ? ftoFleet.zoneList() : []).map(function (x) { return '<option' + (x === ZONE ? ' selected' : '') + '>' + E(x) + '</option>'; }).join('');
}

/* ---------- สรุปผู้บริหาร ---------- */
function cards(s, ps, compact) {
  return M.map(function (m) {
    var v = m.f(s), pv = ps ? m.f(ps) : NaN, neg = m.id === 'net' || m.id === 'an' ? v < 0 : false;
    return '<div class="kpi-card vw-card' + (compact ? ' sm' : '') + '"><div class="kpi-label">' + (compact ? (m.s || m.l) : m.icon + ' ' + m.l) + '</div><div class="kpi-value' + (neg ? ' vw-neg' : '') + '">' + fv(m, v) + '</div>' +
      '<div class="kpi-sub">' + (m.share ? (s.n ? (v / s.n * 100).toFixed(1) : '0.0') + (compact ? '%' : '% ของทั้งหมด') : m.sub || (m.unit || (m.money ? 'บาท' + (m.id === 'ar' || m.id === 'an' ? '/คัน' : '') : ''))) + '</div>' +
      '<div class="vw-cmp" title="' + E(deltaHtml(m, v, pv, s, ps).replace(/<[^>]+>/g, '')) + '">' + deltaHtml(m, v, pv, s, ps, compact) + '</div></div>';
  }).join('');
}
function renderExec() {
  var pg = $('page-executive'); if (!pg) return;
  var cur = getFiltered(), prev = prevRows(), s = calcSummary(cur), ps = prev ? calcSummary(prev) : null, p = FP();
  var types = {}; cur.forEach(function (r) { types[r.vehicle_type] = (types[r.vehicle_type] || 0) + 1; });
  var two = Object.keys(types).sort(function (a, b) { return types[b] - types[a]; }).slice(0, 2).sort(), rest = Object.keys(types).filter(function (t) { return two.indexOf(t) < 0; });
  var h = '<div class="vw-head"><div class="section-head" style="margin-bottom:0">สรุปภาพรวมสำหรับผู้บริหาร</div><div class="vw-sub">' + E(p.spanLabel(p.cur)) + (prevLabel() ? ' · เทียบ ' + E(prevLabel()) : ' · ไม่มีช่วงก่อนหน้า') + (p.view.res === 'excl' ? ' · <b>ไม่รวมติดลบสะสม</b>' : '') + (ZONE ? ' · โซน ' + E(ZONE) : '') + '</div></div>';
  h += '<div class="vw-grid8">' + cards(s, ps) + '</div>';
  h += '<div class="section-head">🚚 แยกชนิดรถ</div><div class="vw-two">' + two.map(function (t) {
    var c = cur.filter(function (r) { return r.vehicle_type === t; }), pr = prev ? prev.filter(function (r) { return r.vehicle_type === t; }) : null;
    return '<div class="vw-side"><div class="vw-side-h">' + E(vtName(t)) + ' <small>' + nf(c.length) + ' คัน</small></div><div class="vw-grid4">' + cards(calcSummary(c), pr ? calcSummary(pr) : null, 1) + '</div></div>';
  }).join('') + '</div>' + (rest.length ? '<p class="fl-note">ชนิดอื่นที่รวมอยู่ในยอดรวมด้านบน: ' + rest.map(function (t) { return E(vtName(t)) + ' ' + types[t] + ' คัน'; }).join(' · ') + '</p>' : '');
  var zs = groupStats(cur, function (r) { return Z(r.dc_name); }), zp = prev ? groupStats(prev, function (r) { return Z(r.dc_name); }) : {};
  var order = (window.ftoFleet ? ftoFleet.zoneList() : []).filter(function (z) { return zs[z]; }).concat(Object.keys(zs).filter(function (z) { return !window.ftoFleet || ftoFleet.zoneList().indexOf(z) < 0; }));
  h += '<div class="section-head">🗺️ ผล 8 ด้าน รายโซน</div>' + table8('โซน', order.map(function (z) { return { k: z, s: zs[z], ps: zp[z] }; }), { k: 'รวม', s: s, ps: ps }, 'zone');
  pg.innerHTML = h;
  pg.querySelectorAll('[data-zone]').forEach(function (tr) { tr.onclick = function () { ZONE = ZONE === tr.dataset.zone ? '' : tr.dataset.zone; syncBar(); renderCurrentPage(); }; });
}
function table8(head, rows, total, click) {
  var cell = function (m, s, ps) { var v = m.f(s); return '<td class="text-right' + ((m.id === 'net' || m.id === 'an') && v < 0 ? ' fl-bad' : '') + '"><b>' + fv(m, v, 1) + '</b>' + (m.share && s.n ? ' <small>(' + (v / s.n * 100).toFixed(0) + '%)</small>' : '') + '<div>' + (ps ? deltaHtml(m, v, m.f(ps), s, ps).replace('ไม่มีช่วงก่อนหน้า', '') : '') + '</div></td>'; };
  return '<div class="table-wrap fl-tw"><div style="overflow-x:auto"><table class="fl-t vw-t"><thead><tr><th>' + head + '</th>' + M.map(function (m) { return '<th class="text-right' + (TEAM.sort === m.id && click === 'team' ? ' vw-sorted' : '') + '"' + (click === 'team' ? ' data-sort="' + m.id + '" tabindex="0"' : '') + '>' + m.l + (click === 'team' && TEAM.sort === m.id ? (TEAM.desc ? ' ▼' : ' ▲') : '') + '</th>'; }).join('') + '</tr></thead><tbody>' +
    rows.map(function (r) { return '<tr' + (click === 'zone' ? ' class="fl-click' + (ZONE === r.k ? ' vw-on' : '') + '" data-zone="' + E(r.k) + '"' : '') + '><td><b>' + E(r.k) + '</b>' + (r.z ? '<div class="fl-note">' + E(r.z) + '</div>' : '') + '</td>' + M.map(function (m) { return cell(m, r.s, r.ps); }).join('') + '</tr>'; }).join('') +
    '</tbody>' + (total ? '<tfoot><tr><td><b>' + total.k + '</b></td>' + M.map(function (m) { return cell(m, total.s, total.ps); }).join('') + '</tr></tfoot>' : '') + '</table></div></div>';
}

/* ---------- ประชุมทีม: 8 ตัวหลัก รายโซน / ราย DC ---------- */
function renderTeam() {
  var pg = $('page-team'); if (!pg) return;
  var cur = getFiltered(), prev = prevRows(), p = FP(), key = TEAM.by === 'zone' ? function (r) { return Z(r.dc_name); } : function (r) { return r.dc_name.replace(/\s+/g, ' ').trim(); };
  var gs = groupStats(cur, key), gp = prev ? groupStats(prev, key) : {}, m = M.filter(function (x) { return x.id === TEAM.sort; })[0] || M[3];
  var rows = Object.keys(gs).map(function (k) { return { k: k, s: gs[k], ps: gp[k], z: TEAM.by === 'dc' ? Z(k) : '' }; }).sort(function (a, b) { return (TEAM.desc ? -1 : 1) * (m.f(a.s) - m.f(b.s)); });
  var h = '<div class="vw-head"><div class="section-head" style="margin-bottom:0">📊 ประชุมทีม · 8 ตัวหลัก</div><div class="vw-sub">' + E(p.spanLabel(p.cur)) + (prevLabel() ? ' · เทียบ ' + E(prevLabel()) : '') + (ZONE ? ' · โซน ' + E(ZONE) : '') + '</div></div>' +
    '<div class="fl-bar"><div class="vw-seg" id="vw-teamby"><button type="button" data-v="zone" aria-pressed="' + (TEAM.by === 'zone') + '">รายโซน</button><button type="button" data-v="dc" aria-pressed="' + (TEAM.by === 'dc') + '">ราย DC</button></div><span class="fl-note">คลิกหัวคอลัมน์เพื่อเรียง · เรียงตาม ' + E(m.l) + (TEAM.desc ? ' มาก → น้อย' : ' น้อย → มาก') + '</span></div>' +
    '<div class="chart-card"><div class="chart-title">' + E(m.l) + ' ' + (TEAM.by === 'zone' ? 'รายโซน' : 'ราย DC') + '</div><div style="height:' + Math.max(240, rows.length * 26) + 'px"><canvas id="vw-team-chart"></canvas></div></div>' +
    table8(TEAM.by === 'zone' ? 'โซน' : 'DC', rows, { k: 'รวม', s: calcSummary(cur), ps: prev ? calcSummary(prev) : null }, 'team');
  pg.innerHTML = h;
  pg.querySelectorAll('#vw-teamby button').forEach(function (b) { b.onclick = function () { TEAM.by = b.dataset.v; renderTeam(); }; });
  pg.querySelectorAll('[data-sort]').forEach(function (th) { var go = function () { if (TEAM.sort === th.dataset.sort) TEAM.desc = !TEAM.desc; else { TEAM.sort = th.dataset.sort; TEAM.desc = false; } renderTeam(); }; th.onclick = go; th.onkeydown = function (e) { if (e.key === 'Enter') go(); }; });
  if (window.Chart) {
    if (charts['vw-team']) { charts['vw-team'].destroy(); delete charts['vw-team']; }
    var vals = rows.map(function (r) { return m.f(r.s); });
    charts['vw-team'] = new Chart($('vw-team-chart'), { type: 'bar', data: { labels: rows.map(function (r) { return r.k; }), datasets: [{ data: vals, backgroundColor: vals.map(function (v) { return v < 0 ? '#b8334a' : '#1d57b8'; }), borderRadius: 4 }] },
      options: { indexAxis: 'y', maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: { label: function (c) { return fv(m, c.raw, 1); } } } }, scales: { x: { ticks: { callback: function (v) { return m.money ? fmtK(v) : v; } } } } } });
  }
}

/* ---------- เทรนด์ (ตัวอย่าง): ผลรายงวด / รายเดือน ---------- */
function renderTrend() {
  var pg = $('page-trend'); if (!pg) return;
  var p = FP(), span = p.view.span, keys = span === 'month' ? p.months().map(function (mo) { return p.monthKeys(mo)[0]; }) : p.keys.slice();
  keys = keys.slice(-24);
  var m = M.filter(function (x) { return x.id === TREND.m; })[0];
  var series = keys.map(function (k) { return filtered(p.dataset(k)); });
  var types = {}; series.forEach(function (rs) { rs.forEach(function (r) { types[r.vehicle_type] = (types[r.vehicle_type] || 0) + 1; }); });
  var two = Object.keys(types).sort(function (a, b) { return types[b] - types[a]; }).slice(0, 2).sort();
  var lab = keys.map(function (k) { return p.spanLabel(k).replace(/^งวด |^เดือน /, ''); });
  var h = '<div class="vw-head"><div class="section-head" style="margin-bottom:0">📈 เทรนด์ ' + (span === 'month' ? 'รายเดือน' : 'รายงวด') + '</div><div class="vw-sub">' + keys.length + ' ' + (span === 'month' ? 'เดือน' : 'งวด') + ' · ตามตัวกรองด้านบน' + (p.view.res === 'excl' ? ' · ไม่รวมติดลบสะสม' : '') + '</div></div>' +
    '<div class="fl-bar vw-chips">' + M.map(function (x) { return '<button type="button" data-tm="' + x.id + '" aria-pressed="' + (x.id === TREND.m) + '">' + x.icon + ' ' + x.l + '</button>'; }).join('') + '</div>' +
    (keys.length < 2 ? '<div class="fl-warn">มีข้อมูล ' + keys.length + ' ' + (span === 'month' ? 'เดือน' : 'งวด') + ' — เติมไฟล์ย้อนหลังเพื่อดูแนวโน้ม</div>' : '') +
    '<div class="chart-card"><div class="chart-title">' + E(m.l) + ' · ทั้งหมด เทียบ ' + two.map(vtName).join(' / ') + '</div><div style="height:320px"><canvas id="vw-trend-chart"></canvas></div></div>' +
    '<div class="section-head">📋 8 ตัวหลัก ราย' + (span === 'month' ? 'เดือน' : 'งวด') + '</div>' + table8(span === 'month' ? 'เดือน' : 'งวด', keys.map(function (k, i) { return { k: lab[i], s: calcSummary(series[i]), ps: i ? calcSummary(series[i - 1]) : null }; }).reverse(), null);
  pg.innerHTML = h;
  pg.querySelectorAll('[data-tm]').forEach(function (b) { b.onclick = function () { TREND.m = b.dataset.tm; renderTrend(); }; });
  if (window.Chart) {
    if (charts['vw-trend']) { charts['vw-trend'].destroy(); delete charts['vw-trend']; }
    var ds = [{ label: 'ทั้งหมด', data: series.map(function (rs) { return m.f(calcSummary(rs)); }), borderColor: '#0a2a5e', backgroundColor: '#0a2a5e', borderWidth: 3, tension: .25 }]
      .concat(two.map(function (t, i) { return { label: vtName(t), data: series.map(function (rs) { return m.f(calcSummary(rs.filter(function (r) { return r.vehicle_type === t; }))); }), borderColor: ['#1d57b8', '#d4a72c'][i], backgroundColor: ['#1d57b8', '#d4a72c'][i], borderWidth: 2, borderDash: [5, 4], tension: .25 }; }));
    charts['vw-trend'] = new Chart($('vw-trend-chart'), { type: 'line', data: { labels: lab, datasets: ds }, options: { maintainAspectRatio: false, plugins: { tooltip: { callbacks: { label: function (c) { return c.dataset.label + ': ' + fv(m, c.raw, 1); } } } }, scales: { y: { ticks: { callback: function (v) { return m.money ? fmtK(v) : v; } } } } } });
  }
}

/* ---------- ความเสี่ยง: เริ่มติดลบตั้งแต่งวดไหน ---------- */
function streaks() {
  var p = FP(), keys = p.keys, ci = keys.indexOf(p.cur); if (ci < 0) return [];
  var byK = {}; var netOf = function (k) { if (byK[k]) return byK[k]; var o = {}; p.dataset(k, 'round', 'all').forEach(function (r) { var q = r.plate.replace(/[\s\-]/g, ''); o[q] = (o[q] || 0) + r.net_balance; }); return (byK[k] = o); };
  var cur = filtered(p.dataset(p.cur, 'round', 'all')), seen = {}, out = [];
  cur.forEach(function (r) {
    var q = r.plate.replace(/[\s\-]/g, ''); if (seen[q]) return; seen[q] = 1;
    if (!(netOf(p.cur)[q] < 0)) return;
    var i = ci; while (i - 1 >= 0 && netOf(keys[i - 1])[q] < 0) i--;
    var rows = cur.filter(function (x) { return x.plate.replace(/[\s\-]/g, '') === q; });
    out.push({ plate: r.plate, dc: rows.map(function (x) { return x.dc_name.replace(/\s+/g, ' ').trim(); }).join(' / '), zone: Z(r.dc_name), from: keys[i], n: ci - i + 1, net: netOf(p.cur)[q], carry: rows.reduce(function (a, x) { return a + (x.carry_over || 0); }, 0), first: i === 0 });
  });
  return out.sort(function (a, b) { return b.n - a.n || a.net - b.net; });
}
function renderStreak() {
  var pg = $('page-risk'); if (!pg) return; var box = $('vw-streak'); if (!box) { box = document.createElement('div'); box.id = 'vw-streak'; var a = $('risk-alerts'); a.parentNode.insertBefore(box, a.nextSibling); }
  var p = FP(), L = streaks(), b = { '1 งวด': 0, '2–3 งวด': 0, '4–6 งวด': 0, 'มากกว่า 6 งวด': 0 };
  L.forEach(function (x) { b[x.n === 1 ? '1 งวด' : x.n <= 3 ? '2–3 งวด' : x.n <= 6 ? '4–6 งวด' : 'มากกว่า 6 งวด']++; });
  box.innerHTML = '<div class="chart-card vw-streak"><div class="chart-title">⏳ ติดลบต่อเนื่อง · เริ่มติดลบตั้งแต่งวดไหน <small class="fl-note">(คงเหลือสุทธิรายงวด &lt; 0 ติดต่อกันจนถึง ' + E(p.spanLabel(p.cur, 'round')) + ')</small></div>' +
    (p.keys.length < 2 ? '<div class="fl-warn">มีข้อมูล ' + p.keys.length + ' งวด — เติมไฟล์ย้อนหลังเพื่อหางวดแรกที่เริ่มติดลบ</div>' : '') +
    '<div class="vw-buckets">' + Object.keys(b).map(function (k, i) { return '<div class="vw-bk' + (i >= 2 && b[k] ? ' bad' : '') + '"><b>' + b[k] + '</b><span>ติดลบ ' + k + '</span></div>'; }).join('') + '</div>' +
    '<details class="fl-list"' + (L.length <= 30 ? ' open' : '') + '><summary>รายชื่อรถที่ติดลบงวดนี้ (' + L.length + ' คัน)</summary><div style="overflow-x:auto"><table class="fl-t"><thead><tr><th>ทะเบียน</th><th>DC</th><th>โซน</th><th>เริ่มติดลบตั้งแต่งวด</th><th class="text-right">ติดลบติดต่อกัน</th><th class="text-right">คงเหลือสุทธิงวดนี้</th><th class="text-right">ยอดยกมา (สะสม)</th></tr></thead><tbody>' +
    L.map(function (x) { return '<tr><td><b>' + E(x.plate) + '</b></td><td>' + E(x.dc) + '</td><td>' + E(x.zone) + '</td><td>' + E(p.label(x.from, true)) + (x.first && p.keys.length ? ' <span class="fl-note">(งวดแรกที่มีข้อมูล)</span>' : '') + '</td><td class="text-right' + (x.n >= 4 ? ' fl-bad' : '') + '"><b>' + x.n + '</b> งวด</td><td class="text-right fl-bad">' + nf(x.net) + '</td><td class="text-right">' + nf(x.carry) + '</td></tr>'; }).join('') + '</tbody></table></div></details></div>';
}

/* ---------- เริ่ม ---------- */
function start() {
  buildBar(); syncBar();
  var og = window.getFiltered;
  window.getFiltered = getFiltered = function () { var r = og(); return ZONE ? r.filter(function (x) { return Z(x.dc_name) === ZONE; }) : r; };
  var oreset = window.resetAllSlicers; if (oreset) window.resetAllSlicers = resetAllSlicers = function () { ZONE = ''; syncBar(); return oreset.apply(this, arguments); };
  var orisk = window.renderRisk;
  window.renderExec = renderExec = renderExecNew; window.renderTeam = renderTeam = renderTeamNew; window.renderTrend = renderTrend = renderTrendNew;
  window.renderRisk = renderRisk = function () { orisk(); renderStreak(); };
}
var renderExecNew = renderExec, renderTeamNew = renderTeam, renderTrendNew = renderTrend;
window.ftoViews = { start: start, sync: syncBar, metrics: M, streaks: streaks, get zone() { return ZONE; }, base: function (rows) { var z = ZONE, keep = DB; ZONE = ''; if (rows) DB = rows; try { return getFiltered(); } finally { ZONE = z; DB = keep; } }, setZone: function (z) { ZONE = z; syncBar(); renderCurrentPage(); } };
})();
