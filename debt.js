/* NIMEX Fleet Transport Operator — รถรอปรับสภาพหนี้ + ทะเบียนรถรวม (NIMEX610) + รายการรอยืนยัน
   ตัวตนรถ = รหัสรถ · รถวิ่งงาน = รหัสในฐานข้อมูลรถ
   รถรอปรับสภาพหนี้ = ไม่อยู่ในฐาน · ไม่มีรายได้เลยทุกงวดในระบบ · ไม่ใช่รถบริษัท · ยังมียอดค้าง (คงเหลือสุทธิ < 0 หรือยอดยกมา > 0) · ไม่นับรถ 6 ล้อขึ้นไป
   สถานะผู้ถือครองทะเบียน (จาก NIMEX610): คืนรถให้บริษัท / ผู้ประกอบการรายใหม่ / ลาออก ไม่มีทะเบียนกลับมา
   NIMEX610 เก็บเฉพาะ รหัสรถ ทะเบียน ชนิดรถ ประเภทการจ้าง DC วันเริ่มงาน วันลาออก (ไม่เก็บชื่อ เบอร์โทร เลขบัญชี) */
(function () {
'use strict';
var RCOLS = ['code', 'plate', 'kind', 'emp', 'dc', 'start', 'resign'];
var RHEAD = { code: /^รหัสรถ$/, plate: /^ทะเบียนรถ$/, kind: /^ชนิดรถ$/, emp: /^ประเภทรถ$/, dc: /^ชื่อ DC$/, start: /^วันที่เริ่มงาน$/, resign: /^วันที่ลาออก$/ };
var ST = { back: 'คืนรถให้บริษัท', newop: 'ผู้ประกอบการรายใหม่', newwait: 'ผู้ประกอบการรายใหม่ (ยังไม่วิ่งงาน)', gone: 'ลาออก ไม่มีทะเบียนกลับมา', noreg: 'ยังไม่มีข้อมูล NIMEX610' };
var STC = { back: '#123f8c', newop: '#6e93d6', newwait: '#9fb6de', gone: '#b8334a', noreg: '#8a99b3' };
var REG = null, RBC = {}, RBP = {}, AGG = null, AGGK = '', UI = { st: '', q: '', zone: '' }, PEND610 = null;
function $(id) { return document.getElementById(id); }
function E(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
function nf(v) { return Number.isFinite(+v) ? Math.round(+v).toLocaleString('th-TH') : '–'; }
function pn(p) { return String(p || '').replace(/[\s\-]/g, ''); }
function cn(c) { return String(c || '').replace(/\D/g, '').replace(/^0+/, ''); }
function clean(n) { return String(n || '').replace(/\s+/g, ' ').trim(); }
function FP() { return window.ftoPeriod; }
function adm() { return !!window.FTO_ADMIN; }
function pdate(s) { var m = String(s || '').match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/); if (!m) return null; var y = +m[3]; if (y > 2400) y -= 543; return new Date(y, +m[2] - 1, +m[1]); }
function thDate(d) { return d ? d.getDate() + ' ' + ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'][d.getMonth()] + ' ' + (d.getFullYear() + 543) : '–'; }
function zoneOf(dc) { return window.ftoFleet ? ftoFleet.zoneOf(dc) : '-'; }
function cfgReview() { return (FP().cfg.review) || {}; }

/* ---------- NIMEX610 ---------- */
function loadReg(d) {
  REG = d && d.rows ? d : null; RBC = {}; RBP = {};
  if (!REG) return;
  REG.rows.forEach(function (r) { var o = {}; REG.cols.forEach(function (c, i) { o[c] = r[i]; }); o.s = pdate(o.start); o.r = pdate(o.resign); RBC[cn(o.code)] = o; (RBP[pn(o.plate)] = RBP[pn(o.plate)] || []).push(o); });
}
function parse610(file) {
  return file.arrayBuffer().then(function (buf) {
    var wb = XLSX.read(buf, { type: 'array', raw: true }), ws = wb.Sheets[wb.SheetNames[0]], raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: false }), hr = -1;
    for (var i = 0; i < Math.min(15, raw.length); i++) if (raw[i].some(function (c) { return /^รหัสรถ$/.test(String(c).trim()); }) && raw[i].some(function (c) { return /^ทะเบียนรถ$/.test(String(c).trim()); })) { hr = i; break; }
    if (hr < 0) throw new Error('ไม่พบหัวตาราง "รหัสรถ" และ "ทะเบียนรถ" (รายงาน NIMEX610)');
    var H = raw[hr].map(function (c) { return String(c).trim(); }), idx = {};
    RCOLS.forEach(function (k) { idx[k] = H.findIndex(function (h) { return RHEAD[k].test(h); }); if (idx[k] < 0) throw new Error('ไม่พบคอลัมน์ ' + RHEAD[k].source.replace(/[\^$]/g, '')); });
    var rows = [], seen = {};
    for (i = hr + 1; i < raw.length; i++) {
      var r = raw[i], c = String(r[idx.code] || '').trim(); if (!c || seen[c]) continue; seen[c] = 1;
      rows.push(RCOLS.map(function (k) { return String(r[idx[k]] == null ? '' : r[idx[k]]).replace(/\s+/g, ' ').trim().replace(/[<>]/g, '').slice(0, 100); }));
    }
    return { cols: RCOLS, rows: rows, file: file.name };
  });
}

/* ---------- รวมยอดรายรหัส ทุกงวด ---------- */
function agg() {
  var p = FP(), key = p.keys.join(',') + '|' + JSON.stringify([p.cfg.exclude, p.cfg.alias, p.cfg.typeMin]);
  if (AGG && AGGK === key) return AGG;
  AGG = {}; AGGK = key;
  p.keys.forEach(function (k) {
    var m = AGG[k] = {};
    p.stage(k).rows.forEach(function (r) {
      var c = cn(r.dc_code) || ('p:' + pn(r.plate)), x = m[c];
      if (!x) x = m[c] = { code: c, raw: String(r.dc_code || ''), plate: r.plate, dc: clean(r.dc_name), type: r.vehicle_type_raw || r.vehicle_type, owner: r.owner, rev: 0, net: 0, carry: 0 };
      x.rev += r.total_revenue || 0; x.net += r.net_balance || 0; x.carry += r.carry_over || 0;
    });
  });
  return AGG;
}
function inMaster(x) { return !!(window.ftoFleet && ftoFleet.match({ dc_code: x.code.indexOf('p:') === 0 ? '' : x.code, plate: x.plate })); }
function isCompany(x) { var g = RBC[x.code]; return (g && /^01/.test(g.emp)) || /^030/.test(String(x.type || '')); }
function holder(x) {
  if (!REG) return { k: 'noreg' };
  var others = (RBP[pn(x.plate)] || []).filter(function (o) { return cn(o.code) !== x.code; });
  if (!others.length) return { k: 'gone' };
  var cur = FP().cur, A = agg()[cur] || {};
  var act = others.filter(function (o) { var c = cn(o.code); return inMaster({ code: c, plate: o.plate }) || (A[c] && A[c].rev > 0); });
  var pick = (act.length ? act : others).slice().sort(function (a, b) { return (b.s || 0) - (a.s || 0); })[0];
  var co = /^01/.test(pick.emp);
  return { k: co ? 'back' : (act.length ? 'newop' : 'newwait'), code: pick.code, emp: pick.emp, start: pick.s };
}
function debtList() {
  var p = FP(), cur = p.cur; if (!cur) return [];
  var A = agg(), keys = p.keys.filter(function (k) { return k <= cur; }), revAll = {};
  keys.forEach(function (k) { Object.keys(A[k]).forEach(function (c) { revAll[c] = (revAll[c] || 0) + A[k][c].rev; }); });
  var out = [];
  Object.keys(A[cur] || {}).forEach(function (c) {
    var x = A[cur][c];
    if (inMaster(x) || isCompany(x) || revAll[c] > 0.004 || !(x.net < 0 || x.carry > 0)) return;
    var i = keys.length - 1; while (i - 1 >= 0 && A[keys[i - 1]][c] && A[keys[i - 1]][c].net < 0) i--;
    var neg = x.net < 0, g = RBC[c], h = holder(x), end = p.periodEnd(cur);
    out.push({ code: x.raw || c, c: c, plate: x.plate, dc: x.dc, zone: zoneOf(x.dc), type: String(x.type || '').replace(/^\d+\s+/, ''), emp: g ? g.emp : '', net: x.net, carry: x.carry,
      from: neg ? keys[i] : '', n: neg ? keys.length - i : 0, first: neg && i === 0, resign: g ? g.r : null, months: g && g.r ? Math.max(0, (end.getFullYear() - g.r.getFullYear()) * 12 + end.getMonth() - g.r.getMonth()) : null, h: h });
  });
  return out.sort(function (a, b) { return a.net - b.net; });
}
function pendingList() {   /* มีรายได้งวดนี้ แต่ไม่อยู่ในฐาน (ไม่ใช่รถบริษัท) และยังไม่เคยตอบว่า "ไม่ใช่" */
  var p = FP(), A = agg()[p.cur] || {}, rv = cfgReview();
  return Object.keys(A).map(function (c) { return A[c]; }).filter(function (x) { return x.rev > 0 && !inMaster(x) && !isCompany(x) && rv[x.code] !== 'no'; })
    .map(function (x) { var others = (RBP[pn(x.plate)] || []).filter(function (o) { return cn(o.code) !== x.code; }), m = window.ftoFleet ? ftoFleet.vehicles.filter(function (v) { return pn(v.plate) === pn(x.plate); })[0] : null; return Object.assign({}, x, { g: RBC[x.code], sameplate: m, others: others }); })
    .sort(function (a, b) { return a.dc.localeCompare(b.dc) || String(a.plate).localeCompare(String(b.plate)); });
}
function resignWarn() {   /* รถในฐานที่มีวันลาออก (NIMEX610) ก่อนสิ้นงวด → แจ้งเตือน ไม่ตัดออกเอง */
  if (!REG || !window.ftoFleet || !FP().cur) return [];
  var end = FP().periodEnd(FP().cur);
  return ftoFleet.vehicles.map(function (v) { var g = RBC[cn(v.code)]; return g && g.r && g.r <= end ? { v: v, g: g } : null; }).filter(Boolean);
}

/* ---------- หน้า: รถรอปรับสภาพหนี้ ---------- */
function renderPage() {
  var el = $('db-body'); if (!el) return;
  var p = FP(); if (!p.cur) { el.innerHTML = '<div class="fl-warn">ยังไม่มีข้อมูล</div>'; return; }
  var all = debtList(), L = all.filter(function (x) { return (!UI.st || x.h.k === UI.st) && (!UI.zone || x.zone === UI.zone) && (!UI.q || (x.plate + ' ' + x.code + ' ' + x.dc).toLowerCase().indexOf(UI.q.toLowerCase()) >= 0); });
  var sum = function (a, f) { return a.reduce(function (s, x) { return s + f(x); }, 0); }, cnt = {};
  all.forEach(function (x) { cnt[x.h.k] = (cnt[x.h.k] || 0) + 1; });
  var h = '<div class="vw-head"><div class="section-head" style="margin-bottom:0">💳 รถรอปรับสภาพหนี้</div><div class="vw-sub">' + E(p.spanLabel(p.cur, 'round')) + ' · ไม่อยู่ในฐานรถวิ่งงาน · ไม่มีรายได้ทุกงวดในระบบ (' + p.keys.filter(function (k) { return k <= p.cur; }).length + ' งวด) · ไม่รวมรถบริษัทและรถ 6 ล้อขึ้นไป</div></div>' +
    (REG ? '' : '<div class="fl-warn">ยังไม่ได้เติมทะเบียนรถรวม (NIMEX610) — สถานะผู้ถือครองและวันที่ลาออกจะแสดงหลังเติมไฟล์ที่ ⚙️ ตั้งค่า → ทะเบียนรถ NIMEX610</div>') +
    '<div class="vw-grid8 db-grid">' + [
      ['🚛 จำนวนรถ', nf(all.length), 'คัน'],
      ['📥 ยอดยกมารวม', '฿' + fmtK(sum(all, function (x) { return x.carry; })), 'คอลัมน์ S'],
      ['📉 คงเหลือสุทธิรวม', '฿' + fmtK(sum(all, function (x) { return x.net; })), 'คอลัมน์ T', 1],
      ['⏳ ติดลบเฉลี่ย', (all.length ? (sum(all, function (x) { return x.n; }) / all.length).toFixed(1) : '0') + ' งวด', 'นับต่อเนื่องถึงงวดนี้']
    ].map(function (k) { return '<div class="kpi-card vw-card"><div class="kpi-label">' + k[0] + '</div><div class="kpi-value' + (k[3] ? ' vw-neg' : '') + '">' + k[1] + '</div><div class="kpi-sub">' + k[2] + '</div></div>'; }).join('') + '</div>' +
    '<div class="section-head">สถานะผู้ถือครองทะเบียน</div><div class="db-st">' + ['back', 'newop', 'newwait', 'gone', 'noreg'].filter(function (k) { return cnt[k]; }).map(function (k) {
      var g = all.filter(function (x) { return x.h.k === k; });
      return '<button type="button" class="db-stc' + (UI.st === k ? ' on' : '') + '" data-db="st" data-v="' + k + '" style="--c:' + STC[k] + '"><b>' + nf(cnt[k]) + '</b><span>' + ST[k] + '</span><small>คงเหลือสุทธิ ' + nf(sum(g, function (x) { return x.net; })) + ' บาท</small></button>';
    }).join('') + '</div>';
  var zs = {}; all.forEach(function (x) { var z = zs[x.zone] = zs[x.zone] || { n: 0, net: 0, carry: 0 }; z.n++; z.net += x.net; z.carry += x.carry; });
  var zl = (window.ftoFleet ? ftoFleet.zoneList() : []).filter(function (z) { return zs[z]; }).concat(Object.keys(zs).filter(function (z) { return !window.ftoFleet || ftoFleet.zoneList().indexOf(z) < 0; }));
  h += '<div class="section-head">รายโซน</div><div class="table-wrap fl-tw"><div style="overflow-x:auto"><table class="fl-t"><thead><tr><th>โซน</th><th class="text-right">คัน</th><th class="text-right">ยอดยกมารวม</th><th class="text-right">คงเหลือสุทธิรวม</th></tr></thead><tbody>' +
    zl.map(function (z) { return '<tr class="fl-click' + (UI.zone === z ? ' vw-on' : '') + '" data-db="zone" data-v="' + E(z) + '"><td><b>' + E(z) + '</b></td><td class="text-right">' + nf(zs[z].n) + '</td><td class="text-right">' + nf(zs[z].carry) + '</td><td class="text-right' + (zs[z].net < 0 ? ' fl-bad' : '') + '">' + nf(zs[z].net) + '</td></tr>'; }).join('') + '</tbody></table></div></div>';
  h += '<div class="fl-bar"><input type="search" id="db-q" placeholder="ค้นหา ทะเบียน / รหัสรถ / DC" value="' + E(UI.q) + '" aria-label="ค้นหารถรอปรับสภาพหนี้">' + (UI.st || UI.zone ? '<button type="button" class="btn" data-db="clear">ล้างตัวกรอง (' + [UI.st ? ST[UI.st] : '', UI.zone].filter(Boolean).join(' · ') + ')</button>' : '') + '<button type="button" class="btn btn-gold" data-db="xlsx">⬇️ Excel รถรอปรับสภาพหนี้</button><span class="fl-note">' + nf(L.length) + ' คัน</span></div>' +
    '<div class="table-wrap fl-tw"><div style="overflow-x:auto"><table class="fl-t"><thead><tr><th>ทะเบียน</th><th>รหัสรถ</th><th>DC</th><th>ประเภทรถ</th><th>วันที่ลาออก</th><th>ติดลบตั้งแต่งวด</th><th class="text-right">ติดลบ</th><th class="text-right">ยอดยกมา</th><th class="text-right">คงเหลือสุทธิ</th><th>สถานะผู้ถือครองทะเบียน</th></tr></thead><tbody>' +
    L.slice(0, 500).map(function (x) {
      return '<tr><td><b>' + E(x.plate) + '</b></td><td>' + E(x.code) + '</td><td>' + E(x.dc) + '<div class="fl-note">' + E(x.zone) + '</div></td><td>' + E(x.type) + '<div class="fl-note">' + E(String(x.emp).replace(/^\d+\s+/, '')) + '</div></td>' +
        '<td>' + thDate(x.resign) + (x.months !== null ? '<div class="fl-note">' + x.months + ' เดือนก่อนสิ้นงวด</div>' : '') + '</td><td>' + (x.from ? E(p.label(x.from, true)) + (x.first && p.keys.length ? '<div class="fl-note">งวดแรกที่มีข้อมูล</div>' : '') : '<span class="fl-note">ไม่ติดลบ (มียอดยกมา)</span>') + '</td>' +
        '<td class="text-right' + (x.n >= 4 ? ' fl-bad' : '') + '">' + (x.n ? '<b>' + x.n + '</b> งวด' : '–') + '</td><td class="text-right">' + nf(x.carry) + '</td><td class="text-right fl-bad"><b>' + nf(x.net) + '</b></td>' +
        '<td><span class="db-chip" style="--c:' + STC[x.h.k] + '">' + ST[x.h.k] + '</span>' + (x.h.code ? '<div class="fl-note">รหัส ' + E(x.h.code) + ' · ' + E(String(x.h.emp || '').replace(/^\d+\s+/, '')) + (x.h.start ? ' · เริ่ม ' + thDate(x.h.start) : '') + '</div>' : '') + '</td></tr>';
    }).join('') + (L.length ? '' : '<tr><td colspan="10">ไม่มีรถตามเงื่อนไข</td></tr>') + '</tbody></table></div></div>';
  el.innerHTML = h;
  var q = $('db-q'); q.oninput = function () { UI.q = q.value; var pos = q.selectionStart; renderPage(); var n = $('db-q'); n.focus(); n.setSelectionRange(pos, pos); };
}
function xlsx() {
  var p = FP(), L = debtList(), wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['รถรอปรับสภาพหนี้ · ' + p.spanLabel(p.cur, 'round')], [], ['ทะเบียน', 'รหัสรถ', 'DC', 'โซน', 'ประเภทรถ', 'ประเภทการจ้าง', 'วันที่ลาออก', 'ติดลบตั้งแต่งวด', 'ติดลบ (งวด)', 'ยอดยกมา', 'คงเหลือสุทธิ', 'สถานะผู้ถือครองทะเบียน', 'รหัสผู้ถือครอง', 'ประเภทผู้ถือครอง']]
    .concat(L.map(function (x) { return [x.plate, x.code, x.dc, x.zone, x.type, x.emp, x.resign ? thDate(x.resign) : '', x.from ? p.label(x.from, true) : '', x.n, x.carry, x.net, ST[x.h.k], x.h.code || '', x.h.emp || '']; }))), 'รถรอปรับสภาพหนี้');
  XLSX.writeFile(wb, 'NIMEX-รถรอปรับสภาพหนี้-' + p.cur + '.xlsx');
}

/* ---------- แท็บในหน้าตั้งค่า ---------- */
function tabs() { var n = FP().cur ? pendingList().length : 0; return [['reg', 'ทะเบียนรถ NIMEX610'], ['review', 'รอยืนยัน' + (n ? ' (' + n + ')' : '')]]; }
function card(t, b) { return '<div class="fp-card"><h3>' + t + '</h3>' + b + '</div>'; }
function tab(t) {
  if (t === 'reg') {
    var info = REG ? '<p>มีในระบบ <b>' + nf(REG.rows.length) + '</b> รหัส · ไฟล์ ' + E(REG.file || '') + ' · โหลดเมื่อ ' + E(String(REG.at || '').slice(0, 10)) + '</p>' : '<p>ยังไม่มีข้อมูล</p>';
    return card('ทะเบียนรถรวม (รายงาน NIMEX610)', info + '<p class="fl-note">ใช้หาสถานะผู้ถือครองทะเบียน (คืนรถให้บริษัท / ผู้ประกอบการรายใหม่ / ลาออก) ประเภทการจ้าง และวันที่ลาออก · เก็บเฉพาะ รหัสรถ ทะเบียน ชนิดรถ ประเภทการจ้าง DC วันเริ่มงาน วันลาออก (ไม่เก็บชื่อ เบอร์โทร เลขบัญชี) · เติมใหม่ = แทนที่ทั้งหมด</p>' +
      '<label class="fp-drop">📂 เลือกไฟล์ NIMEX610<input type="file" id="db-file" accept=".xlsx,.xls"></label><div id="db-prev">' + (PEND610 ? '<div class="fl-imp">ไฟล์ ' + E(PEND610.file) + ' · พบ <b>' + nf(PEND610.rows.length) + '</b> รหัส · มีวันที่ลาออก ' + nf(PEND610.rows.filter(function (r) { return r[6]; }).length) + ' · รถบริษัท ' + nf(PEND610.rows.filter(function (r) { return /^01/.test(r[3]); }).length) + '<div class="fl-row" style="justify-content:flex-start"><button type="button" class="btn btn-gold" data-db="save610">💾 บันทึกทะเบียนรถรวม</button><button type="button" class="btn" data-db="cancel610">ยกเลิก</button></div></div>' : '') + '</div><p class="fl-msg" id="db-msg" role="status"></p>');
  }
  if (t === 'review') {
    if (!FP().cur) return card('รอยืนยัน', '<p>ยังไม่มีข้อมูล</p>');
    var L = pendingList(), W = resignWarn(), rv = cfgReview(), no = Object.keys(rv).filter(function (c) { return rv[c] === 'no'; });
    return card('รถมีรายได้แต่ไม่อยู่ในฐานรถวิ่งงาน · ' + E(FP().spanLabel(FP().cur, 'round')) + ' (' + nf(L.length) + ')', '<p class="fl-note">ตรวจแล้วกด "อยู่ในฐาน" (เพิ่มเข้าฐานข้อมูลรถ) หรือ "ไม่ใช่รถวิ่งงาน" — ระบบจำคำตอบไว้ ไม่ถามซ้ำ · ไม่รวมรถบริษัทและรถ 6 ล้อขึ้นไป</p>' +
      '<div style="overflow-x:auto"><table class="fl-t"><thead><tr><th>ทะเบียน</th><th>รหัสรถ</th><th>DC</th><th>ประเภทรถ</th><th class="text-right">รวมรายได้</th><th class="text-right">คงเหลือสุทธิ</th><th>หมายเหตุ</th><th></th></tr></thead><tbody>' +
      L.map(function (x) {
        var note = x.sameplate ? 'ทะเบียนนี้อยู่ในฐานด้วยรหัส ' + E(x.sameplate.code) + ' (ยืนยันแล้วจะแทนรหัสเดิม)' : x.g ? E(String(x.g.emp).replace(/^\d+\s+/, '')) + (x.g.s ? ' · เริ่มงาน ' + thDate(x.g.s) : '') : '';
        return '<tr><td><b>' + E(x.plate) + '</b></td><td>' + E(x.raw) + '</td><td>' + E(x.dc) + '</td><td>' + E(String(x.type).replace(/^\d+\s+/, '')) + '</td><td class="text-right">' + nf(x.rev) + '</td><td class="text-right' + (x.net < 0 ? ' fl-bad' : '') + '">' + nf(x.net) + '</td><td class="fp-wrap fl-note">' + note + '</td>' +
          '<td class="fl-act"><select data-dbg="' + E(x.code) + '" aria-label="กลุ่มรถ"><option>กระจาย</option><option>ขนย้าย</option></select><button type="button" class="btn btn-gold" data-db="yes" data-v="' + E(x.code) + '">อยู่ในฐาน</button><button type="button" class="btn" data-db="no" data-v="' + E(x.code) + '">ไม่ใช่รถวิ่งงาน</button></td></tr>';
      }).join('') + (L.length ? '' : '<tr><td colspan="8">ไม่มีรายการรอยืนยัน</td></tr>') + '</tbody></table></div>' + (no.length ? '<details class="fl-list"><summary>ตอบแล้วว่า "ไม่ใช่รถวิ่งงาน" (' + no.length + ')</summary><p>' + no.map(function (c) { return E(c) + ' <button type="button" class="btn" data-db="undo" data-v="' + E(c) + '">ยกเลิก</button>'; }).join(' · ') + '</p></details>' : '') + '<p class="fl-msg" id="db-msg" role="status"></p>') +
      card('รถในฐานที่มีวันที่ลาออกแล้ว (NIMEX610) (' + nf(W.length) + ')', REG ? (W.length ? '<p class="fl-note">แจ้งเตือนเท่านั้น ระบบไม่ตัดออกเอง — ตรวจแล้วแก้ที่ 🚚 ฐานข้อมูลรถ</p><div style="overflow-x:auto"><table class="fl-t"><thead><tr><th>ทะเบียน</th><th>รหัสรถในฐาน</th><th>DC</th><th>วันที่ลาออก</th><th>รหัสอื่นของทะเบียนนี้</th></tr></thead><tbody>' +
        W.map(function (w) { var o = (RBP[pn(w.v.plate)] || []).filter(function (x) { return cn(x.code) !== cn(w.v.code); }); return '<tr><td><b>' + E(w.v.plate) + '</b></td><td>' + E(w.v.code) + '</td><td>' + E(clean(w.v.dc)) + '</td><td class="fl-bad">' + thDate(w.g.r) + '</td><td class="fl-note">' + o.map(function (x) { return E(x.code) + ' ' + E(String(x.emp).replace(/^\d+\s+/, '')); }).join(' · ') + '</td></tr>'; }).join('') + '</tbody></table></div>' : '<p>ไม่มี</p>') : '<p>เติม NIMEX610 ก่อน</p>');
  }
  return '';
}
function msg(t, bad) { var m = $('db-msg'); if (m) { m.textContent = t; m.classList.toggle('fl-bad', !!bad); } }
function onClick(e) {
  var b = e.target.closest('[data-db]'); if (!b) return; var a = b.dataset.db, v = b.dataset.v;
  if (a === 'st') { UI.st = UI.st === v ? '' : v; renderPage(); }
  else if (a === 'zone') { UI.zone = UI.zone === v ? '' : v; renderPage(); }
  else if (a === 'clear') { UI.st = ''; UI.zone = ''; renderPage(); }
  else if (a === 'xlsx') xlsx();
  else if (!adm()) return;
  else if (a === 'cancel610') { PEND610 = null; FP().renderAdmin(); }
  else if (a === 'save610') {
    var d = PEND610; b.disabled = true; msg('⏳ กำลังบันทึก…');
    window.ftoApi({ a: 'reg', data: d }).then(function () { d.at = new Date().toISOString(); loadReg(d); PEND610 = null; AGG = null; FP().renderAdmin(); msg('✅ บันทึกทะเบียนรถรวมแล้ว ' + nf(d.rows.length) + ' รหัส'); })
      .catch(function (x) { b.disabled = false; msg('บันทึกไม่สำเร็จ: ' + (x.message === 'unknown' ? 'Apps Script ยังเป็นรุ่นเก่า' : x.message), true); });
  }
  else if (a === 'yes') {
    var x = pendingList().filter(function (q) { return q.code === v; })[0]; if (!x) return;
    var grp = (document.querySelector('[data-dbg="' + v + '"]') || {}).value || 'กระจาย', V = ftoFleet.vehicles, log = [];
    var old = x.sameplate;
    if (old) { log.push([old.plate, old.code, x.raw, 'แทนรหัสเดิม (ทะเบียนเดียวกัน)', clean(x.dc)]); old.code = x.raw.length < 10 ? ('0000000000' + x.raw).slice(-10) : x.raw; old.dc = clean(x.dc); }
    else { var nc = x.raw.length < 10 ? ('0000000000' + x.raw).slice(-10) : x.raw; V.push({ plate: x.plate, code: nc, group: grp, dc: clean(x.dc), vtype: String(x.type).replace(/^\d+\s+/, '') }); log.push([x.plate, '', nc, 'เพิ่มเข้าฐาน (' + grp + ')', clean(x.dc)]); }
    msg('⏳ กำลังบันทึก…');
    ftoFleet.persist('ยืนยันรถวิ่งงาน ' + x.plate + ' รหัส ' + x.raw).then(function () { FP().changeLog('ยืนยันรถวิ่งงาน (หน้าตั้งค่า → รอยืนยัน)', ['ทะเบียน', 'รหัสเดิม', 'รหัสใหม่', 'การเปลี่ยนแปลง', 'DC'], log); FP().refresh(); FP().renderAdmin(); msg('✅ ' + x.plate + ' อยู่ในฐานแล้ว (ดาวน์โหลด Excel รายการที่เปลี่ยนแล้ว)'); })
      .catch(function (y) { msg('บันทึกไม่สำเร็จ: ' + y.message, true); });
  }
  else if (a === 'no' || a === 'undo') {
    var C = JSON.parse(JSON.stringify(FP().cfg)); C.review = C.review || {};
    if (a === 'no') C.review[v] = 'no'; else delete C.review[v];
    FP().saveCfg(C, a === 'no' ? '✅ บันทึกแล้ว: รหัส ' + v + ' ไม่ใช่รถวิ่งงาน (ระบบจะไม่ถามซ้ำ)' : '✅ ยกเลิกคำตอบของรหัส ' + v);
  }
}
function onChange(e) {
  if (e.target.id !== 'db-file') return; var f = e.target.files[0]; if (!f) return; msg('กำลังอ่านไฟล์…');
  parse610(f).then(function (d) { PEND610 = d; FP().renderAdmin(); }).catch(function (x) { PEND610 = null; msg('อ่านไฟล์ไม่สำเร็จ: ' + x.message, true); });
  e.target.value = '';
}
function show(tab) {
  currentPage = 'debt';
  document.querySelectorAll('.navtab').forEach(function (t) { t.classList.toggle('active', t === tab); });
  document.querySelectorAll('.page').forEach(function (pg) { pg.classList.remove('active'); });
  $('page-debt').classList.add('active'); renderPage();
}
function start() {
  loadReg((window.FTO_DATA || {}).reg);
  var orig = window.renderCurrentPage;
  window.renderCurrentPage = renderCurrentPage = function () { if (currentPage === 'debt') renderPage(); else orig(); };
  document.addEventListener('click', onClick); document.addEventListener('change', onChange);
}
window.ftoDebt = { start: start, show: show, tabs: tabs, tab: tab, debtList: debtList, pendingList: pendingList, resignWarn: resignWarn, holder: holder, loadReg: loadReg, parse610: parse610, reset: function () { AGG = null; }, get reg() { return REG; } };
})();
