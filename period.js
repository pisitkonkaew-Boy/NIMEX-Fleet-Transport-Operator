/* NIMEX Fleet Transport Operator — ข้อมูลรายงวด (1–15 / 16–สิ้นเดือน) + KPI แผนก + หน้าตั้งค่า (เติมไฟล์ / KPI / เงื่อนไข / ตรวจข้อมูล / ส่งออก)
   ลำดับข้อมูล: ไฟล์ NIMEX03102 → ตัด DC ที่ยกเว้น (801) → รวม DC (680, 690 = 691) → เฉพาะรถในฐานข้อมูลรถ → รวมแถวทะเบียน+DC ซ้ำ (สูตรเดิม)
   → DB ของแดชบอร์ด (หน้าเดิมคำนวณแบบเดิมทุกอย่าง)
   KPI: ค่าจากไฟล์ (net_ge = % ของรถที่ยอดคงเหลือสุทธิ ≥ เกณฑ์) หรือผู้ดูแลกรอกเอง · เกรด A=4 B=3 C=2 D=1 F=0 ถ่วงน้ำหนัก → เกรดรวม */
(function () {
'use strict';
var COLS = ['dc_name','plate','revenue','adj_revenue','total_revenue','daily_expense','bal_after_daily','period_expense',
  'bal_after_period','adj_expense','bal_after_adj','rental','bal_after_rental','tax','carry_over','net_balance',
  'row_num','dc_code','vehicle_type','owner','status','profit_loss'];
var SUM = ['revenue','adj_revenue','total_revenue','daily_expense','bal_after_daily','period_expense','bal_after_period','adj_expense','bal_after_adj','rental','bal_after_rental','tax','carry_over','net_balance'];
var MON = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
var MS = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
var PT = { A: 4, B: 3, C: 2, D: 1, F: 0 };
var GC = { A: '#123f8c', B: '#6e93d6', C: '#d4a72c', D: '#d9822b', F: '#b8334a' };
var DEF = {
  kpis: [
    { id: 'k6', no: '6', name: 'อัตราส่วนรถที่มียอดปิดบัญชีคงเหลืองวดละ 7,000 บาทขึ้นไป (รถร่วม)', unit: '%', weight: 40, grade: { A: 96, B: 94, C: 92, D: 90 }, dir: 1, src: 'net_ge', param: 7000 },
    { id: 'k7', no: '7', name: 'อัตราความถูกต้องตรงเวลาในการปิดบัญชีรถกระจาย', unit: '%', weight: 30, grade: { A: 100, B: 99, C: 98, D: 97 }, dir: 1, src: 'manual' },
    { id: 'k8', no: '8', name: 'ปิดบัญชีรถเสริม: ถูกต้องและตรงเวลา', unit: '%', weight: 30, grade: { A: 100, B: 99, C: 98, D: 97 }, dir: 1, src: 'manual' }
  ],
  overall: { A: 3.5, B: 2.5, C: 1.5, D: 0.5 },
  exclude: ['801'], alias: { '680': '691', '690': '691' }, masterOnly: true, countMode: 'revenue', typeLow: 40, unit: 'row', dropZero: false, typeMin: 60,
  typeGroup: { '041': '040', '044': '042' }   /* แสดงผลรถ 2 กลุ่ม: 4 ล้อกลาง → ปิกอัพ · ควบคุมอุณหภูมิ4WJ → ควบคุมอุณหภูมิ4W */
};
var SRC = { net_ge: 'คำนวณจากไฟล์: % รถที่ยอดคงเหลือสุทธิ ≥ เกณฑ์ (บาท)', manual: 'ผู้ดูแลกรอกค่าเองทุกงวด' };

var VIEW = { span: 'round', res: 'all' }, DS = {};
var P = {}, KEYS = [], CUR = '', CFG = null, MAN = {}, NAMES = {}, PEND = null, UI = { tab: 'upload', confirm: '', msg: '', bad: false };
function $(id) { return document.getElementById(id); }
function E(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
function nf(v, d) { return Number.isFinite(+v) ? Number(v).toLocaleString('th-TH', { minimumFractionDigits: d || 0, maximumFractionDigits: d || 0 }) : '–'; }
function p2(v) { return Number.isFinite(v) ? (Math.round(v * 100) / 100).toLocaleString('th-TH', { maximumFractionDigits: 2 }) : '–'; }
function code(n) { var m = String(n || '').trim().match(/^(\d{2,5})/); return m ? m[1] : ''; }
function clean(n) { return String(n || '').replace(/\s+/g, ' ').trim(); }
function pn(p) { return String(p || '').replace(/[\s\-]/g, ''); }
function adm() { return !!window.FTO_ADMIN; }
function clone(o) { return JSON.parse(JSON.stringify(o)); }
function api(b) { return window.ftoApi(b); }

/* ---------- งวด ---------- */
function pLabel(k, long) { var a = k.split('-'), y = +a[0], m = +a[1], h = +a[2], last = new Date(y - 543, m, 0).getDate(); return (h === 1 ? '1–15' : '16–' + last) + ' ' + (long ? MON[m - 1] : MS[m - 1]) + ' ' + y; }
function prevKey(k) { var i = KEYS.indexOf(k); return i > 0 ? KEYS[i - 1] : ''; }
function cfg() { return CFG || DEF; }

/* ---------- แปลงข้อมูลงวด → DB ---------- */
function objs(d) {
  return d.rows.map(function (r) { var o = {}; d.cols.forEach(function (c, i) { o[c] = r[i]; }); SUM.forEach(function (c) { o[c] = +o[c] || 0; }); o.dc_name = String(o.dc_name || ''); o.plate = String(o.plate || ''); return o; });
}
function learnNames() {
  NAMES = {};
  Object.keys(P).forEach(function (k) { P[k].rows.forEach(function (r) { var c = code(r[0]); if (c && !NAMES[c]) NAMES[c] = String(r[0]); }); });
  if (window.ftoFleet) ftoFleet.vehicles.forEach(function (v) { var c = code(v.dc); if (c && !NAMES[c]) NAMES[c] = v.dc; });
}
function canon(name) {   /* รวม DC ตามค่าตั้ง เช่น 680 / 690 → 691 */
  var c = code(name), t = cfg().alias[c];
  return t ? (NAMES[t] || t + '  DC') : name;
}
function typeMin() { var t = cfg().typeMin; return t === undefined || t === null ? 60 : +t; }
function bigType(t) { var m = String(t || '').match(/^\s*(\d{3})/), lim = typeMin(); return !!(lim && m && +m[1] >= lim); }   /* รหัสประเภทรถ ≥ 060 = 6 ล้อ / 10 ล้อ / ลูกพ่วง → ไม่นับทุกมิติ */
var TNAME = { '040': '040  รถปิกอัพ', '042': '042  รถควบคุมอุณหภูมิ4W' };
function typeGroup() { var g = cfg().typeGroup; return g === undefined || g === null ? DEF.typeGroup : g; }
function tcode(t) { var m = String(t || '').match(/^\s*(\d{3})/); return m ? m[1] : ''; }
function stage(k) {   /* ขั้น 1–2: ตัด DC ยกเว้น + ตัดรถ 6 ล้อขึ้นไป + รวม DC */
  var C = cfg(), raw = objs(P[k]), ex = 0, al = 0, big = 0, out = [];
  raw.forEach(function (o) {
    if (C.exclude.indexOf(code(o.dc_name)) >= 0) { ex++; return; }
    if (bigType(o.vehicle_type)) { big++; return; }
    var n = canon(o.dc_name); if (n !== o.dc_name) { al++; o.dc_name = n; }
    var tg = typeGroup()[tcode(o.vehicle_type)]; if (tg) { o.vehicle_type_raw = o.vehicle_type; o.vehicle_type = TNAME[tg] || (raw.filter(function (x) { return tcode(x.vehicle_type) === tg; })[0] || {}).vehicle_type || tg; }
    out.push(o);
  });
  return { all: raw.length, excluded: ex, aliased: al, big: big, rows: out };
}
function merge(rows) {   /* สูตรเดิม: รวมทะเบียน + DC ที่ซ้ำ */
  var m = new Map();
  rows.forEach(function (r) {
    var k = r.plate + '|||' + r.dc_name;
    if (!m.has(k)) m.set(k, Object.assign({}, r));
    else { var x = m.get(k); SUM.forEach(function (f) { x[f] = (x[f] || 0) + (r[f] || 0); }); }
  });
  return Array.from(m.values()).map(function (r) { r.profit_loss = r.net_balance > 0 ? 'กำไร' : 'ขาดทุน'; return r; });
}
function countMode() { return cfg().countMode || 'revenue'; }
function typeLow() { var t = cfg().typeLow; return t === undefined || t === null ? 40 : +t; }
/* นับตามจริงจากรายได้: รถที่มีรายได้ในงวดนั้น · ประเภทรถตั้งแต่ 040 (ไม่นับมอเตอร์ไซต์ 020 / รถใช้งานบริษัท 030)
   · ไม่ใช่รถบริษัท (NIMEX610 พนักงานรหัส 01) · ไม่ใช่รหัสที่ผู้ดูแลตอบว่า "ไม่ใช่รถวิ่งงาน" */
function running(r) {
  if (!(r.total_revenue > 0)) return false;
  var t = tcode(r.vehicle_type_raw || r.vehicle_type); if (t && +t < typeLow()) return false;
  var c = String(r.dc_code || '').replace(/\D/g, '').replace(/^0+/, '');
  if (c && (cfg().review || {})[c] === 'no') return false;
  return !(window.ftoDebt && ftoDebt.isCompanyCode && ftoDebt.isCompanyCode(c));
}
function build(k) {
  var s = stage(k), rows = s.rows, M = window.ftoFleet, inM = [], outM = [];
  rows.forEach(function (r) { (M && M.match(r) ? inM : outM).push(r); });
  var use = countMode() === 'revenue' ? rows.filter(running) : (cfg().masterOnly && M && M.vehicles.length ? inM : rows);
  var merged = merge(use);
  return { stage: s, db: merged, unmatched: outM, dupMerged: use.length - merged.length };
}
var BUILT = {};
function built(k) { if (!BUILT[k]) BUILT[k] = build(k); return BUILT[k]; }
/* ชุดข้อมูลของหน้าแดชบอร์ด: รอบ (งวด) หรือ เดือน (รวม 2 งวด) · ผลทั้งหมด หรือ ไม่รวมติดลบสะสม (คงเหลือสุทธิ + ยอดยกมา) */
function monthOf(k) { return k ? k.slice(0, 7) : ''; }
function monthKeys(m) { return KEYS.filter(function (k) { return monthOf(k) === m; }); }
function months() { var o = []; KEYS.forEach(function (k) { var m = monthOf(k); if (o.indexOf(m) < 0) o.push(m); }); return o; }
function mLabel(m) { var a = m.split('-'); return MON[+a[1] - 1] + ' ' + a[0]; }
function spanLabel(k, span) { if (!k) return ''; if ((span || VIEW.span) === 'month') { var ks = monthKeys(monthOf(k)); return 'เดือน ' + mLabel(monthOf(k)) + (ks.length < 2 ? ' (มี ' + ks.length + ' งวด)' : ''); } return 'งวด ' + pLabel(k, true); }
function prevFor(k, span) {
  if (!k) return '';
  if ((span || VIEW.span) === 'month') { var ms = months(), i = ms.indexOf(monthOf(k)); return i > 0 ? monthKeys(ms[i - 1])[0] : ''; }
  return prevKey(k);
}
function dataset(k, span, res) {
  span = span || VIEW.span; res = res || VIEW.res;
  if (!k || !P[k]) return [];
  var id = k + '|' + span + '|' + res; if (DS[id]) return DS[id];
  var rows = span === 'month' ? (monthKeys(monthOf(k)).length ? monthKeys(monthOf(k)) : [k]).reduce(function (a, q) { return a.concat(built(q).db); }, []) : built(k).db;
  rows = span === 'month' ? merge(rows.map(function (r) { return Object.assign({}, r); })) : rows.map(function (r) { return Object.assign({}, r); });
  if (res === 'excl') rows.forEach(function (r) { r.net_balance = r.net_balance + (r.carry_over || 0); r.carry_over = 0; r.profit_loss = r.net_balance > 0 ? 'กำไร' : 'ขาดทุน'; });
  return (DS[id] = rows);
}
function apply() {
  BUILT = {}; DS = {}; if (window.ftoDebt) ftoDebt.reset();
  if (!CUR) { DB = []; } else DB = dataset(CUR).map(function (r) { return Object.assign({}, r); });
  if (window.ftoFleet && ftoFleet.reset) ftoFleet.reset();
  var sel = $('fp-sel'); if (sel) sel.innerHTML = KEYS.slice().reverse().map(function (k) { return '<option value="' + k + '"' + (k === CUR ? ' selected' : '') + '>งวด ' + pLabel(k) + '</option>'; }).join('') || '<option>ยังไม่มีข้อมูล</option>';
  var t = $('fp-note'); if (t) t.textContent = CUR ? spanLabel(CUR) + ' · ' + nf(DB.length) + ' รายการ' + (VIEW.res === 'excl' ? ' · ไม่รวมติดลบสะสม' : '') : '';
}
function refresh() {
  apply();
  if (typeof renderSlicers === 'function') { renderSlicers(); updateFilterCount(); renderCurrentPage(); }
}

/* ---------- KPI ---------- */
function units(k) {   /* หน่วยนับของ KPI จากไฟล์: แถว (ทะเบียน+DC ตามไฟล์) หรือ ต่อคัน */
  var rows = built(k).db;
  if (cfg().dropZero) rows = rows.filter(function (r) { return SUM.some(function (f) { return r[f]; }); });
  if (cfg().unit !== 'plate') return rows.map(function (r) { return { plate: r.plate, dc: r.dc_name, net: r.net_balance, rev: r.total_revenue }; });
  var m = {}; rows.forEach(function (r) { var x = m[pn(r.plate)]; if (!x) x = m[pn(r.plate)] = { plate: r.plate, dc: r.dc_name, net: 0, rev: -Infinity, n: 0 }; x.net += r.net_balance; if (r.total_revenue > x.rev) { x.rev = r.total_revenue; x.dc = r.dc_name; } });
  return Object.keys(m).map(function (p) { return m[p]; });
}
function kval(kp, k, list) {
  if (!k || !P[k]) return NaN;
  if (kp.src === 'manual') { var v = (MAN[k] || {})[kp.id]; return v === null || v === undefined ? NaN : +v; }
  if (kp.src === 'net_ge') { var u = list || units(k); return u.length ? u.filter(function (x) { return x.net >= kp.param; }).length / u.length * 100 : NaN; }
  return NaN;
}
function grade(kp, v) {
  if (!Number.isFinite(v)) return ''; var g = kp.grade;
  if (kp.dir < 0) return v <= g.A ? 'A' : v <= g.B ? 'B' : v <= g.C ? 'C' : v <= g.D ? 'D' : 'F';
  return v >= g.A ? 'A' : v >= g.B ? 'B' : v >= g.C ? 'C' : v >= g.D ? 'D' : 'F';
}
function overall(k) {
  var C = cfg(), w = 0, s = 0, miss = [];
  var rows = C.kpis.map(function (kp) { var v = kval(kp, k), g = grade(kp, v); if (g) { w += kp.weight; s += PT[g] * kp.weight; } else miss.push(kp); return { kp: kp, v: v, g: g, pts: g ? PT[g] * kp.weight / 100 : NaN }; });
  var score = w ? s / w : NaN, o = C.overall, gr = !Number.isFinite(score) ? '' : score >= o.A ? 'A' : score >= o.B ? 'B' : score >= o.C ? 'C' : score >= o.D ? 'D' : 'F';
  return { rows: rows, score: score, grade: gr, miss: miss, w: w };
}
function gradesOn() { return cfg().showGrade !== false; }
function chip(g, force) { if (!force && !gradesOn()) return ''; return g ? '<span class="fp-g" style="background:' + GC[g] + '">' + g + '</span>' : '<span class="fp-na">ยังไม่มีค่า</span>'; }
function fmtV(kp, v) { return Number.isFinite(v) ? p2(v) + (kp.unit === '%' ? '%' : kp.unit ? ' ' + E(kp.unit) : '') : '–'; }

/* ---------- หน้า KPI แผนก ---------- */
function renderKpi() {
  var el = $('fp-kpi-body'); if (!el) return;
  if (!CUR) { el.innerHTML = '<div class="fl-warn">ยังไม่มีข้อมูล' + (adm() ? ' — ไปที่ ⚙️ ตั้งค่า / เติมไฟล์' : '') + '</div>'; return; }
  var O = overall(CUR), pk = prevKey(CUR), PO = pk ? overall(pk) : null, C = cfg();
  var h = '<div class="fp-top"><div class="fp-ov"><div class="fp-ov-l">เกรดรวมแผนก · งวด ' + pLabel(CUR, true) + '</div><div class="fp-ov-v">' + (O.grade ? '<span class="fp-big" style="background:' + GC[O.grade] + '">' + O.grade + '</span>' : '') + '<b>' + p2(O.score) + '</b><small> / 4.00</small></div>' +
    '<div class="fp-ov-s">' + (PO && Number.isFinite(PO.score) ? 'งวดก่อน (' + pLabel(pk) + ') ' + p2(PO.score) + ' เกรด ' + PO.grade + ' · ' + delta(O.score - PO.score, 1, '') : 'ไม่มีงวดก่อนหน้า') + '</div>' +
    (O.miss.length ? '<div class="fp-ov-s fl-bad">ยังไม่มีค่า: ' + O.miss.map(function (k) { return 'KPI ' + E(k.no); }).join(', ') + ' — คิดเกรดรวมจากตัวที่มีค่า (น้ำหนัก ' + O.w + '%)</div>' : '') + '</div>' +
    '<p class="fl-note">คะแนนเกรด A=4 B=3 C=2 D=1 F=0 × น้ำหนัก · เกรดรวม A ≥ ' + C.overall.A + ' · B ≥ ' + C.overall.B + ' · C ≥ ' + C.overall.C + ' · D ≥ ' + C.overall.D + ' · KPI คิดจากข้อมูลทั้งงวด (ไม่ขึ้นกับตัวกรองด้านซ้าย)</p></div>';
  h += '<div class="table-wrap fl-tw"><div style="overflow-x:auto"><table class="fl-t fp-t"><thead><tr><th>KPI</th><th>หน่วย</th><th class="text-right">น้ำหนัก</th><th class="text-right">A</th><th class="text-right">B</th><th class="text-right">C</th><th class="text-right">D</th><th class="text-right">ผลงวดนี้</th><th>เกรด</th><th class="text-right">คะแนน</th><th class="text-right">งวดก่อน</th></tr></thead><tbody>' +
    O.rows.map(function (x) { var kp = x.kp, pv = pk ? kval(kp, pk) : NaN; return '<tr><td class="fp-wrap"><b>' + E(kp.no) + '</b> ' + E(kp.name) + '<div class="fl-note">' + E(kp.src === 'net_ge' ? 'คำนวณจากไฟล์ (≥ ' + nf(kp.param) + ' บาท)' : 'กรอกโดยผู้ดูแล') + '</div></td><td>' + E(kp.unit) + '</td><td class="text-right">' + kp.weight + '%</td>' +
      ['A', 'B', 'C', 'D'].map(function (g) { return '<td class="text-right">' + p2(kp.grade[g]) + '</td>'; }).join('') + '<td class="text-right"><b>' + fmtV(kp, x.v) + '</b></td><td>' + chip(x.g) + '</td><td class="text-right">' + p2(x.pts) + '</td><td class="text-right">' + fmtV(kp, pv) + (Number.isFinite(pv) && Number.isFinite(x.v) ? '<div>' + delta(x.v - pv, kp.dir, kp.unit === '%' ? ' จุด' : '') + '</div>' : '') + '</td></tr>'; }).join('') +
    '</tbody><tfoot><tr><td colspan="7"><b>รวม</b> (น้ำหนักรวม ' + C.kpis.reduce(function (a, k) { return a + k.weight; }, 0) + '%)</td><td></td><td>' + chip(O.grade) + '</td><td class="text-right"><b>' + p2(O.score) + '</b></td><td></td></tr></tfoot></table></div></div>';
  C.kpis.filter(function (k) { return k.src === 'net_ge'; }).forEach(function (kp) { h += netDetail(kp); });
  h += '<div class="section-head">📈 ผล KPI รายงวด</div><div class="table-wrap fl-tw"><div style="overflow-x:auto"><table class="fl-t"><thead><tr><th>งวด</th>' + C.kpis.map(function (k) { return '<th class="text-right">KPI ' + E(k.no) + '</th>'; }).join('') + '<th class="text-right">คะแนนรวม</th><th>เกรดรวม</th></tr></thead><tbody>' +
    KEYS.slice().reverse().map(function (k) { var o = overall(k); return '<tr' + (k === CUR ? ' class="fp-cur"' : '') + '><td><b>' + pLabel(k) + '</b></td>' + o.rows.map(function (x) { return '<td class="text-right">' + fmtV(x.kp, x.v) + ' ' + (x.g ? '<span class="fp-g sm" style="background:' + GC[x.g] + '">' + x.g + '</span>' : '') + '</td>'; }).join('') + '<td class="text-right"><b>' + p2(o.score) + '</b></td><td>' + chip(o.grade) + '</td></tr>'; }).join('') + '</tbody></table></div></div>';
  el.innerHTML = h;
  if (!gradesOn()) {   /* ผู้ดูแลปิดการแสดงเกรด: เหลือค่า KPI + เป้าหมาย */
    var ov = el.querySelector('.fp-ov'); if (ov) ov.innerHTML = '<div class="fp-ov-l">KPI แผนก Fleet Planning</div><div class="fp-ov-v"><b style="font-size:26px">' + spanLabel(CUR, 'round') + '</b></div>';
    var nt = el.querySelector('.fp-top .fl-note'); if (nt) nt.textContent = 'KPI คิดจากข้อมูลทั้งงวด (ไม่ขึ้นกับตัวกรอง)';
    var drop = function (t, idx) { t.querySelectorAll('tr').forEach(function (tr) { idx.slice().sort(function (a, b) { return b - a; }).forEach(function (i) { if (tr.cells[i] && tr.cells.length > i) tr.deleteCell(i); }); }); };
    var t1 = el.querySelector('.fp-t'); if (t1) { t1.tFoot && t1.tFoot.remove(); drop(t1, [3, 4, 5, 6, 8, 9]); }
    var all = el.querySelectorAll('table'); var tl = all[all.length - 1]; if (tl) { var n = tl.tHead.rows[0].cells.length; drop(tl, [n - 2, n - 1]); }
    el.querySelectorAll('.fl-t').forEach(function (t) { var hs = t.tHead ? Array.prototype.map.call(t.tHead.rows[0].cells, function (c) { return c.textContent; }) : []; var gi = hs.indexOf('เกรด'); if (gi >= 0) drop(t, [gi]); });
  }
}
function delta(d, dir, unit) {
  if (!Number.isFinite(d)) return ''; if (Math.abs(d) < 0.005) return '<span class="fp-d">± 0' + unit + '</span>';
  var good = dir > 0 ? d > 0 : d < 0; return '<span class="fp-d ' + (good ? 'up' : 'down') + '">' + (d > 0 ? '▲ +' : '▼ ') + p2(d) + unit + '</span>';
}
function netDetail(kp) {
  var U = units(CUR), Z = window.ftoFleet ? ftoFleet.zoneOf : function () { return '-'; }, by = function (f) { var m = {}; U.forEach(function (u) { var k = f(u); (m[k] = m[k] || []).push(u); }); return m; };
  var tbl = function (title, m, order) {
    var keys = order ? order.filter(function (k) { return m[k]; }).concat(Object.keys(m).filter(function (k) { return order.indexOf(k) < 0; })) : Object.keys(m).sort();
    return '<div class="table-wrap fl-tw"><div style="overflow-x:auto"><table class="fl-t"><thead><tr><th>' + title + '</th><th class="text-right">รถ (' + (cfg().unit === 'plate' ? 'คัน' : 'แถว') + ')</th><th class="text-right">≥ ' + nf(kp.param) + '</th><th class="text-right">ต่ำกว่า</th><th class="text-right">%</th><th>เกรด</th></tr></thead><tbody>' +
      keys.map(function (k) { var L = m[k], ok = L.filter(function (u) { return u.net >= kp.param; }).length, v = ok / L.length * 100, g = grade(kp, v); return '<tr><td><b>' + E(k) + '</b></td><td class="text-right">' + nf(L.length) + '</td><td class="text-right">' + nf(ok) + '</td><td class="text-right' + (L.length - ok ? ' fl-bad' : '') + '">' + nf(L.length - ok) + '</td><td class="text-right">' + p2(v) + '%</td><td>' + chip(g) + '</td></tr>'; }).join('') + '</tbody></table></div></div>';
  };
  var low = U.filter(function (u) { return u.net < kp.param; }).sort(function (a, b) { return a.net - b.net; });
  return '<div class="section-head">🎯 KPI ' + E(kp.no) + ' รายโซน</div>' + tbl('โซน', by(function (u) { return Z(u.dc); }), window.ftoFleet ? ftoFleet.zoneList() : null) +
    '<details class="fl-list"><summary>🏢 KPI ' + E(kp.no) + ' ราย DC</summary>' + tbl('DC', by(function (u) { return clean(u.dc); })) + '</details>' +
    '<details class="fl-list"><summary>⚠️ รถที่ยอดคงเหลือต่ำกว่า ' + nf(kp.param) + ' บาท (' + nf(low.length) + ')</summary><div style="overflow-x:auto"><table class="fl-t"><thead><tr><th>ทะเบียน</th><th>DC</th><th>โซน</th><th class="text-right">คงเหลือสุทธิ</th><th class="text-right">รายได้รวม</th></tr></thead><tbody>' +
    low.map(function (u) { return '<tr><td>' + E(u.plate) + '</td><td>' + E(clean(u.dc)) + '</td><td>' + E(Z(u.dc)) + '</td><td class="text-right' + (u.net < 0 ? ' fl-bad' : '') + '">' + nf(u.net) + '</td><td class="text-right">' + nf(u.rev) + '</td></tr>'; }).join('') + '</tbody></table></div></details>';
}

/* ---------- อ่านไฟล์ NIMEX03102 ---------- */
function parseFile(file) {
  return file.arrayBuffer().then(function (buf) {
    var wb = XLSX.read(buf, { type: 'array' }), ws = wb.Sheets[wb.SheetNames[0]], raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }), hr = -1, key = '', ptxt = '';
    for (var i = 0; i < Math.min(15, raw.length); i++) {
      var line = raw[i].map(String).join(' ');
      if (!key) { var m = line.match(/(\d{1,2})\s*[-–]\s*(\d{1,2})\s*(มกราคม|กุมภาพันธ์|มีนาคม|เมษายน|พฤษภาคม|มิถุนายน|กรกฎาคม|สิงหาคม|กันยายน|ตุลาคม|พฤศจิกายน|ธันวาคม)\s*(\d{4})/); if (m) { ptxt = m[0]; key = m[4] + '-' + ('0' + (MON.indexOf(m[3]) + 1)).slice(-2) + '-' + (+m[1] <= 15 && +m[2] <= 15 ? 1 : 2); } }
      if (hr < 0 && raw[i].some(function (c) { return /ทะเบียน/.test(String(c)); }) && raw[i].some(function (c) { return /DC/.test(String(c)); })) hr = i;
    }
    if (hr < 0) throw new Error('ไม่พบหัวตาราง (คอลัมน์ "ชื่อ DC" และ "ทะเบียนรถ")');
    var H = raw[hr].map(function (c) { return String(c).trim(); });
    var need = [[1, /DC/], [3, /ทะเบียน/], [19, /คงเหลือสุทธิ/], [8, /รวมรายได้/]];
    need.forEach(function (n) { if (!n[1].test(H[n[0]] || '')) throw new Error('รูปแบบคอลัมน์ไม่ตรงกับ NIMEX03102 (คอลัมน์ ' + String.fromCharCode(65 + n[0]) + ' ควรเป็น ' + n[1].source + ')'); });
    var rows = [];
    for (i = hr + 1; i < raw.length; i++) {
      var r = raw[i]; if (!String(r[3] || '').trim() && !String(r[1] || '').trim()) continue;
      var f = function (j) { return parseFloat(r[j]) || 0; }, net = f(19);
      rows.push([String(r[1] || '').trim(), String(r[3] || '').trim(), f(6), f(7), f(8), f(9), f(10), f(11), f(12), f(13), f(14), f(15), f(16), f(17), f(18), net,
        +r[0] || i, String(r[2] || '').replace(/\D/g, ''), String(r[4] || '').trim(), String(r[5] || '').trim(), '', net > 0 ? 'กำไร' : 'ขาดทุน']);
    }
    return { key: key, ptxt: ptxt, rows: rows, file: file.name };
  });
}
function dcChanges(k) {   /* รถในฐานที่ DC ไม่ตรงไฟล์ → DC ใหม่ตามไฟล์ (ถ้าวิ่งหลาย DC ใช้ DC ที่รายได้มากสุด) และ DC ในฐานที่เป็นรหัสรวม (680/690) → 691 */
  var M = window.ftoFleet; if (!M) return [];
  var st = stage(k).rows, by = {};
  st.forEach(function (r) { var m = M.match(r); if (!m) return; var x = by[pn(m.plate)] = by[pn(m.plate)] || { m: m, dcs: {} }; x.dcs[r.dc_name] = (x.dcs[r.dc_name] || 0) + (r.total_revenue || 0); });
  var out = [];
  Object.keys(by).forEach(function (p) {
    var x = by[p], names = Object.keys(x.dcs), cur = canon(x.m.dc), has = names.some(function (n) { return code(n) === code(cur); }), to;
    if (has) to = cur; else to = names.sort(function (a, b) { return x.dcs[b] - x.dcs[a]; })[0];
    if (clean(to) !== clean(x.m.dc)) out.push({ m: x.m, from: clean(x.m.dc), to: clean(to), multi: names.length > 1 });
  });
  return out;
}

/* ---------- หน้าตั้งค่า ---------- */
var TABS = [['upload', 'เติมไฟล์'], ['kpi', 'KPI และเกณฑ์'], ['man', 'กรอก KPI รายงวด'], ['cond', 'เงื่อนไข'], ['check', 'ตรวจข้อมูล'], ['data', 'ข้อมูลทั้งหมด'], ['export', 'ส่งออกไฟล์']];
var DATA_WRAP = null;
function dataWrap() { if (!DATA_WRAP) { var pg = $('page-data'); DATA_WRAP = document.createElement('div'); DATA_WRAP.id = 'fp-data-wrap'; while (pg.firstChild) DATA_WRAP.appendChild(pg.firstChild); pg.appendChild(DATA_WRAP); } return DATA_WRAP; }
function msgHtml() { return '<p class="fl-msg' + (UI.bad ? ' fl-bad' : '') + '" id="fp-msg" role="status">' + E(UI.msg) + '</p>'; }
function say(t, bad) { UI.msg = t; UI.bad = !!bad; var m = $('fp-msg'); if (m) { m.textContent = t; m.classList.toggle('fl-bad', !!bad); } }
function renderAdmin() {
  var el = $('fp-admin-body'); if (!el) return;
  var w = dataWrap(); if (w.parentNode !== $('page-data')) $('page-data').appendChild(w);
  if (!adm()) { el.innerHTML = '<div class="fl-warn">เฉพาะผู้ดูแลระบบ</div>'; return; }
  var XT = window.ftoDebt ? ftoDebt.tabs() : [], ALL = TABS.slice(0, 5).concat(XT).concat(TABS.slice(5));
  var h = '<div class="fl-tabs fp-tabs">' + ALL.map(function (t) { return '<button type="button" data-fp="tab" data-v="' + t[0] + '" class="' + (UI.tab === t[0] ? 'on' : '') + '">' + t[1] + '</button>'; }).join('') + '<button type="button" data-fp="fleet">🚚 ฐานข้อมูลรถ</button></div>';
  var FN = { upload: tabUpload, kpi: tabKpi, man: tabMan, cond: tabCond, check: tabCheck, export: tabExport, data: function () { return '<div id="fp-data-slot"></div>'; } };
  h += FN[UI.tab] ? FN[UI.tab]() : (window.ftoDebt ? ftoDebt.tab(UI.tab) : '');
  el.innerHTML = h;
  if (UI.tab === 'data') { $('fp-data-slot').appendChild(w); dataPage = 1; renderDataTable(); }
  if (window.ftoDebt && ftoDebt.after) ftoDebt.after(UI.tab);
}
function card(t, b) { return '<div class="fp-card"><h3>' + t + '</h3>' + b + '</div>'; }
function tabUpload() {
  var h = card('ข้อมูลที่ใช้แสดงผลอยู่', CUR ? '<p>ล่าสุด งวด ' + pLabel(KEYS[KEYS.length - 1], true) + ' · มี ' + KEYS.length + ' งวดในระบบ · ' + (countMode() === 'revenue' ? 'นับตามจริง: รถที่มีรายได้ในงวดนั้น (ไม่รวมรถบริษัท)' : cfg().masterOnly ? 'นับเฉพาะรถในฐานข้อมูลรถ (' + nf(window.ftoFleet ? ftoFleet.vehicles.length : 0) + ' คัน)' : 'นับทุกคันในไฟล์') + ' · ตัด DC ' + E(cfg().exclude.join(', ')) + ' · รวม DC ' + E(Object.keys(cfg().alias).map(function (a) { return a + '→' + cfg().alias[a]; }).join(', ')) + '</p>' : '<p>ยังไม่มีข้อมูล เติมไฟล์งวดแรกด้านล่าง</p>');
  h += card('เติมไฟล์รายงวด', '<p class="fl-note">เลือกรายงาน NIMEX03102 (รายงานปิดบัญชีรถ แบบละเอียด) 1 ไฟล์ = 1 งวด (1–15 หรือ 16–สิ้นเดือน) ระบบอ่านงวดจากหัวรายงาน สรุปผลให้ตรวจก่อนบันทึก ถ้างวดนั้นมีอยู่แล้วจะถูกแทนที่ · DC ของรถในฐานจะอัปเดตตามไฟล์</p>' +
    '<label class="fp-drop">📂 เลือกไฟล์ Excel<input type="file" id="fp-file" accept=".xlsx,.xls"></label><div id="fp-prev">' + (PEND ? prevHtml() : '') + '</div>' + msgHtml());
  h += card('งวดที่มีในระบบ', '<div style="overflow-x:auto"><table class="fl-t"><thead><tr><th>งวด</th><th class="text-right">แถวในไฟล์</th><th class="text-right">รถที่นับ</th><th class="text-right">คงเหลือสุทธิรวม</th>' + cfg().kpis.filter(function (k) { return k.src === 'net_ge'; }).map(function (k) { return '<th class="text-right">KPI ' + E(k.no) + '</th>'; }).join('') + '<th>ไฟล์</th><th>โหลดเมื่อ</th><th></th></tr></thead><tbody>' +
    (KEYS.slice().reverse().map(function (k) { var b = built(k), net = b.db.reduce(function (a, r) { return a + r.net_balance; }, 0); return '<tr><td><b>' + pLabel(k, true) + '</b></td><td class="text-right">' + nf(P[k].rows.length) + '</td><td class="text-right">' + nf(b.db.length) + '</td><td class="text-right' + (net < 0 ? ' fl-bad' : '') + '">' + nf(net) + '</td>' +
      cfg().kpis.filter(function (x) { return x.src === 'net_ge'; }).map(function (x) { var v = kval(x, k); return '<td class="text-right">' + fmtV(x, v) + ' ' + chip(grade(x, v)) + '</td>'; }).join('') + '<td>' + E(P[k].file || '') + '</td><td>' + E((P[k].at || '').slice(0, 10)) + '</td><td class="fl-act">' +
      (UI.confirm === k ? '<button type="button" class="btn fl-del" data-fp="del" data-v="' + k + '">ยืนยันลบ</button><button type="button" class="btn" data-fp="delx">ยกเลิก</button>' : '<button type="button" class="btn" data-fp="delq" data-v="' + k + '">ลบงวด</button>') + '</td></tr>'; }).join('') || '<tr><td colspan="9">ยังไม่มีข้อมูล</td></tr>') + '</tbody></table></div>');
  return h;
}
function prevHtml() {
  var x = PEND, k = x.key, sameKey = !!P[k];
  var opts = ''; var now = new Date(), y = now.getFullYear() + 543;
  for (var yy = y + 1; yy >= y - 2; yy--) for (var m = 12; m >= 1; m--) for (var hh = 2; hh >= 1; hh--) { var kk = yy + '-' + ('0' + m).slice(-2) + '-' + hh; opts += '<option value="' + kk + '"' + (kk === k ? ' selected' : '') + '>' + pLabel(kk, true) + '</option>'; }
  var s = x.st, b = x.b, ch = x.ch, kp = cfg().kpis.filter(function (q) { return q.src === 'net_ge'; });
  return '<div class="fl-imp"><b>ไฟล์ ' + E(x.file) + '</b>' + (x.ptxt ? ' · หัวรายงาน "' + E(x.ptxt) + '"' : ' · <span class="fl-bad">ไม่พบช่วงวันที่ในหัวรายงาน เลือกงวดเอง</span>') +
    '<div class="fp-grid"><label>งวด <select id="fp-pkey">' + (k ? '' : '<option value="">— เลือกงวด —</option>') + opts + '</select></label>' + (sameKey ? '<span class="fl-bad">งวดนี้มีอยู่แล้ว จะถูกแทนที่</span>' : '') + '</div>' +
    '<ul class="fp-ul"><li>แถวในไฟล์ <b>' + nf(s.all) + '</b> · ตัด DC ยกเว้น ' + nf(s.excluded) + ' · ตัดรถ 6 ล้อขึ้นไป ' + nf(s.big) + ' · รวม DC (680/690→691) ' + nf(s.aliased) + ' แถว</li>' +
    '<li>รถในฐานข้อมูลรถพบในไฟล์ <b>' + nf(x.found) + '</b> / ' + nf(x.master) + ' คัน' + (x.missing.length ? ' · <span class="fl-bad">ไม่พบ ' + nf(x.missing.length) + ' คัน</span>' : '') + '</li>' +
    '<li>รายการที่นับ (ทะเบียน + DC) <b>' + nf(b.db.length) + '</b> · รวมแถวซ้ำ ' + nf(b.dupMerged) + ' · คงเหลือสุทธิรวม <b>' + nf(b.db.reduce(function (a, r) { return a + r.net_balance; }, 0)) + '</b> บาท</li>' +
    kp.map(function (q) { var v = kval(q, '__pend'); return '<li>KPI ' + E(q.no) + ' (≥ ' + nf(q.param) + ' บาท) <b>' + fmtV(q, v) + '</b> ' + chip(grade(q, v)) + '</li>'; }).join('') +
    '<li>DC ในฐานข้อมูลรถที่จะอัปเดตตามไฟล์ <b>' + nf(ch.length) + '</b> คัน</li></ul>' +
    (ch.length ? '<details class="fl-list"><summary>ดูรายการ DC ที่จะเปลี่ยน (' + ch.length + ')</summary><div style="overflow-x:auto"><table class="fl-t"><thead><tr><th>ทะเบียน</th><th>DC เดิมในฐาน</th><th>DC ใหม่ตามไฟล์</th><th></th></tr></thead><tbody>' + ch.map(function (c) { return '<tr><td>' + E(c.m.plate) + '</td><td>' + E(c.from) + '</td><td><b>' + E(c.to) + '</b></td><td class="fl-note">' + (c.multi ? 'วิ่งหลาย DC · ใช้ DC รายได้มากสุด' : '') + '</td></tr>'; }).join('') + '</tbody></table></div></details>' : '') +
    (x.missing.length ? '<details class="fl-list"><summary>รถในฐานที่ไม่พบในไฟล์ (' + x.missing.length + ')</summary><p>' + x.missing.map(function (v) { return E(v.plate) + ' (' + E(clean(v.dc)) + ')'; }).join(' · ') + '</p></details>' : '') +
    '<div class="fl-row"><button type="button" class="btn btn-gold" data-fp="save">💾 บันทึกงวดนี้' + (ch.length ? ' + อัปเดต DC ' + ch.length + ' คัน' : '') + '</button><button type="button" class="btn" data-fp="cancel">ยกเลิก</button></div></div>';
}
function preview(parsed) {
  var k = parsed.key || '__pend';
  P.__pend = { cols: COLS, rows: parsed.rows, file: parsed.file, label: parsed.ptxt };
  var keysBak = KEYS; delete BUILT.__pend; learnNames();
  var b = build('__pend'), st = b.stage, M = window.ftoFleet, foundSet = {};
  st.rows.forEach(function (r) { var m = M && M.match(r); if (m) foundSet[pn(m.plate)] = 1; });
  var missing = M ? M.vehicles.filter(function (v) { return !foundSet[pn(v.plate)]; }) : [];
  BUILT.__pend = b;
  PEND = { key: parsed.key, ptxt: parsed.ptxt, file: parsed.file, rows: parsed.rows, st: st, b: b, ch: dcChanges('__pend'), found: Object.keys(foundSet).length, master: M ? M.vehicles.length : 0, missing: missing };
  KEYS = keysBak; return k;
}
function savePending() {
  var x = PEND; if (!x) return; var k = ($('fp-pkey') || {}).value || x.key;
  if (!/^\d{4}-\d{2}-[12]$/.test(k)) return say('กรุณาเลือกงวด', true);
  var btn = document.querySelector('[data-fp=save]'); if (btn) btn.disabled = true;
  say('⏳ กำลังบันทึก…');
  var step = Promise.resolve();
  if (x.ch.length) step = step.then(function () { x.ch.forEach(function (c) { c.m.dc = c.to; }); return ftoFleet.persist('อัปเดต DC ตามไฟล์งวด ' + k + ' (' + x.ch.length + ' คัน)'); });
  step.then(function () { return api({ a: 'period', period: k, data: { cols: COLS, rows: x.rows, file: x.file, label: x.ptxt } }); })
    .then(function () {
      P[k] = { cols: COLS, rows: x.rows, file: x.file, label: x.ptxt, at: new Date().toISOString() }; delete P.__pend;
      KEYS = Object.keys(P).filter(function (q) { return q !== '__pend'; }).sort(); CUR = k; PEND = null; learnNames(); refresh();
      if (x.ch.length) changeLog('อัปเดต DC ตามไฟล์งวด ' + pLabel(k, true), ['ทะเบียน', 'รหัสรถ', 'DC เดิมในฐาน', 'DC ใหม่ตามไฟล์', 'หมายเหตุ'], x.ch.map(function (c) { return [c.m.plate, c.m.code, c.from, c.to, c.multi ? 'วิ่งหลาย DC · ใช้ DC รายได้มากสุด' : '']; }));
      say('✅ บันทึกงวด ' + pLabel(k, true) + ' แล้ว · ' + nf(x.rows.length) + ' แถว' + (x.ch.length ? ' · อัปเดต DC ในฐาน ' + x.ch.length + ' คัน (ดาวน์โหลด Excel รายการที่เปลี่ยนแล้ว)' : '') + ' · ผู้ชมเห็นข้อมูลใหม่แล้ว');
      renderAdmin();
    }).catch(function (e) { if (btn) btn.disabled = false; say('บันทึกไม่สำเร็จ: ' + (e.message === 'denied' ? 'รหัสไม่ถูกต้อง' : e.message === 'unknown' ? 'Apps Script ยังเป็นรุ่นเก่า' : e.message), true); });
}
function changeLog(title, head, rows) {   /* ทุกครั้งที่ระบบแก้ฐานข้อมูลรถ → ดาวน์โหลด Excel รายการที่เปลี่ยน */
  try {
    var wb = XLSX.utils.book_new(), d = new Date();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([[title], ['เมื่อ ' + d.toLocaleString('th-TH')], []].concat([head]).concat(rows)), 'รายการที่เปลี่ยน');
    XLSX.writeFile(wb, 'NIMEX-เปลี่ยนแปลงฐานข้อมูลรถ-' + d.toISOString().slice(0, 16).replace(/[:T]/g, '-') + '.xlsx');
  } catch (e) {}
}
function tabKpi() {
  var C = cfg(), tw = C.kpis.reduce(function (a, k) { return a + (+k.weight || 0); }, 0);
  return card('KPI แผนก Fleet Planning', '<p class="fl-note">แก้ชื่อ น้ำหนัก เกณฑ์เกรด และแหล่งข้อมูลได้ · เพิ่ม KPI ใหม่ได้ (ค่าจากไฟล์ หรือกรอกเองทุกงวด) · คะแนนเกรด A=4 B=3 C=2 D=1 F=0</p>' +
    '<div style="overflow-x:auto"><table class="fl-t fp-edit"><thead><tr><th>ลำดับ</th><th>ชื่อ KPI</th><th>หน่วย</th><th>น้ำหนัก %</th><th>A</th><th>B</th><th>C</th><th>D</th><th>ทิศทาง</th><th>แหล่งข้อมูล</th><th>เกณฑ์ (บาท)</th><th></th></tr></thead><tbody>' +
    C.kpis.map(function (k, i) { return '<tr data-i="' + i + '"><td><input data-f="no" value="' + E(k.no) + '" size="3"></td><td><input data-f="name" value="' + E(k.name) + '" class="fp-name"></td><td><input data-f="unit" value="' + E(k.unit) + '" size="4"></td><td><input data-f="weight" type="number" min="0" max="100" step="1" value="' + k.weight + '"></td>' +
      ['A', 'B', 'C', 'D'].map(function (g) { return '<td><input data-f="g' + g + '" type="number" step="0.01" value="' + k.grade[g] + '"></td>'; }).join('') +
      '<td><select data-f="dir"><option value="1"' + (k.dir > 0 ? ' selected' : '') + '>สูง = ดี</option><option value="-1"' + (k.dir < 0 ? ' selected' : '') + '>ต่ำ = ดี</option></select></td><td><select data-f="src">' + Object.keys(SRC).map(function (s) { return '<option value="' + s + '"' + (k.src === s ? ' selected' : '') + '>' + (s === 'manual' ? 'กรอกเอง' : 'จากไฟล์: % รถ ≥ เกณฑ์') + '</option>'; }).join('') + '</select></td>' +
      '<td><input data-f="param" type="number" step="1" value="' + (k.src === 'net_ge' ? k.param : '') + '"' + (k.src === 'net_ge' ? '' : ' disabled') + '></td><td><button type="button" class="btn fl-del" data-fp="kdel" data-v="' + i + '">ลบ</button></td></tr>'; }).join('') +
    '</tbody></table></div><div class="fl-row" style="justify-content:flex-start"><button type="button" class="btn" data-fp="kadd">＋ เพิ่ม KPI</button><span class="fl-note">น้ำหนักรวม <b class="' + (tw !== 100 ? 'fl-bad' : '') + '">' + tw + '%</b>' + (tw !== 100 ? ' (ควรเป็น 100%)' : '') + '</span></div>') +
    card('เกณฑ์เกรดรวมแผนก (คะแนนเฉลี่ยถ่วงน้ำหนัก 0–4)', '<label class="fp-chk"><input type="checkbox" id="fp-sg"' + (gradesOn() ? ' checked' : '') + '> แสดงเกรดในหน้า KPI (ปิดแล้วผู้ชมจะเห็นเฉพาะค่า KPI และเป้าหมาย)</label><div class="fp-grid">' + ['A', 'B', 'C', 'D'].map(function (g) { return '<label>' + chip(g, 1) + ' ≥ <input type="number" step="0.01" min="0" max="4" id="fp-o' + g + '" value="' + C.overall[g] + '"></label>'; }).join('') + '<span class="fl-note">ต่ำกว่า D = F</span></div>') +
    '<div class="fl-row" style="justify-content:flex-start"><button type="button" class="btn btn-gold" data-fp="ksave">💾 บันทึก KPI และเกณฑ์</button></div>' + msgHtml();
}
function readKpiForm() {
  var C = clone(cfg()), rows = document.querySelectorAll('.fp-edit tbody tr'), err = '';
  C.kpis = Array.prototype.map.call(rows, function (tr) {
    var i = +tr.dataset.i, o = clone(cfg().kpis[i] || {}), g = function (f) { return tr.querySelector('[data-f=' + f + ']'); };
    o.no = g('no').value.trim(); o.name = g('name').value.trim(); o.unit = g('unit').value.trim(); o.weight = +g('weight').value; o.dir = +g('dir').value; o.src = g('src').value;
    o.grade = { A: +g('gA').value, B: +g('gB').value, C: +g('gC').value, D: +g('gD').value };
    if (o.src === 'net_ge') o.param = +g('param').value; else delete o.param;
    if (!o.name) err = 'ชื่อ KPI ห้ามว่าง'; if (/[<>]/.test(o.name + o.unit + o.no)) err = 'ห้ามใช้เครื่องหมาย < >';
    if (!(o.weight >= 0 && o.weight <= 100)) err = 'น้ำหนักต้องอยู่ระหว่าง 0–100';
    var G = o.grade; if (['A', 'B', 'C', 'D'].some(function (x) { return !Number.isFinite(G[x]); })) err = 'เกณฑ์เกรดต้องเป็นตัวเลข';
    else if (o.dir > 0 ? !(G.A >= G.B && G.B >= G.C && G.C >= G.D) : !(G.A <= G.B && G.B <= G.C && G.C <= G.D)) err = 'KPI ' + o.no + ': เกณฑ์ต้องเรียง A → D ' + (o.dir > 0 ? 'จากมากไปน้อย' : 'จากน้อยไปมาก');
    if (o.src === 'net_ge' && !Number.isFinite(o.param)) err = 'KPI ' + o.no + ': ใส่เกณฑ์ (บาท)';
    return o;
  });
  if ($('fp-sg')) C.showGrade = $('fp-sg').checked;
  if ($('fp-oA')) { C.overall = { A: +$('fp-oA').value, B: +$('fp-oB').value, C: +$('fp-oC').value, D: +$('fp-oD').value }; var O = C.overall; if (!(O.A >= O.B && O.B >= O.C && O.C >= O.D)) err = 'เกณฑ์เกรดรวมต้องเรียง A ≥ B ≥ C ≥ D'; }
  return { C: C, err: err };
}
function saveCfg(C, okMsg) {
  say('⏳ กำลังบันทึก…');
  return api({ a: 'cfg', cfg: C }).then(function () { CFG = C; refresh(); renderAdmin(); say(okMsg); }).catch(function (e) { say('บันทึกไม่สำเร็จ: ' + (e.message === 'bad_value' ? 'ค่าที่กรอกไม่ถูกต้อง' : e.message), true); });
}
function tabMan() {
  var M = cfg().kpis.filter(function (k) { return k.src === 'manual'; });
  if (!M.length) return card('กรอก KPI รายงวด', '<p>ไม่มี KPI แบบกรอกเอง</p>');
  if (!KEYS.length) return card('กรอก KPI รายงวด', '<p>เติมไฟล์งวดแรกก่อน</p>');
  return card('กรอก KPI รายงวด', '<p class="fl-note">กรอกผลของแต่ละงวด (เว้นว่าง = ยังไม่มีค่า) แล้วกดบันทึก เกรดจะคำนวณให้ทันที</p><div style="overflow-x:auto"><table class="fl-t fp-edit"><thead><tr><th>งวด</th>' + M.map(function (k) { return '<th>KPI ' + E(k.no) + '<div class="fl-note fp-wrap">' + E(k.name) + '</div></th>'; }).join('') + '</tr></thead><tbody>' +
    KEYS.slice().reverse().map(function (p) { return '<tr><td><b>' + pLabel(p) + '</b></td>' + M.map(function (k) { var v = (MAN[p] || {})[k.id]; return '<td><input type="number" step="0.01" data-mp="' + p + '" data-mk="' + k.id + '" value="' + (v === null || v === undefined ? '' : v) + '" aria-label="KPI ' + E(k.no) + ' งวด ' + pLabel(p) + '"> ' + E(k.unit) + ' ' + chip(grade(k, v === null || v === undefined ? NaN : +v), 1) + '</td>'; }).join('') + '</tr>'; }).join('') +
    '</tbody></table></div><div class="fl-row" style="justify-content:flex-start"><button type="button" class="btn btn-gold" data-fp="msave">💾 บันทึกค่า KPI</button></div>' + msgHtml());
}
function tabCond() {
  var C = cfg();
  return card('เงื่อนไขการนับรถ', '<div class="fp-form">' +
    '<label>DC ที่ตัดออก (รหัส คั่นด้วยจุลภาค)<input id="fp-ex" value="' + E(C.exclude.join(', ')) + '" placeholder="801"></label>' +
    '<label>DC ที่รวมกัน (บรรทัดละ 1 คู่ รูปแบบ รหัสเดิม=รหัสที่ใช้)<textarea id="fp-al" rows="3">' + E(Object.keys(C.alias).map(function (a) { return a + '=' + C.alias[a]; }).join('\n')) + '</textarea></label>' +
    '<label>ไม่นับรถรหัสประเภทตั้งแต่ (ทุกมิติ · 060 = 6 ล้อ, 100 = 10 ล้อ, 065 = ลูกพ่วง · 0 = นับทุกประเภท)<input id="fp-tm" type="number" min="0" max="999" value="' + typeMin() + '" style="max-width:120px"></label>' +
    '<label>รวมประเภทรถตอนแสดงผล (บรรทัดละ 1 คู่ รูปแบบ รหัสประเภทเดิม=รหัสที่ใช้ · 041 = 4 ล้อกลาง → 040 ปิกอัพ)<textarea id="fp-tg" rows="2">' + E(Object.keys(typeGroup()).map(function (a) { return a + '=' + typeGroup()[a]; }).join('\n')) + '</textarea></label>' +
    '<div>วิธีนับรถวิ่งงาน: <label class="fp-chk"><input type="radio" name="fp-cm" value="revenue"' + (countMode() === 'revenue' ? ' checked' : '') + '> ตามจริง — รถที่มีรายได้ในงวดนั้น ไม่รวมรถบริษัท (NIMEX610) และรหัสที่ตอบว่าไม่ใช่รถวิ่งงาน</label> <label class="fp-chk"><input type="radio" name="fp-cm" value="master"' + (countMode() !== 'revenue' ? ' checked' : '') + '> ตามฐานข้อมูลรถ</label></div>' +
    '<label>วิธีตามจริง: ไม่นับรหัสประเภทต่ำกว่า (040 = ไม่นับมอเตอร์ไซต์ 020 และรถใช้งานบริษัท 030)<input id="fp-tl" type="number" min="0" max="999" value="' + typeLow() + '" style="max-width:120px"></label>' +
    '<label class="fp-chk"><input type="checkbox" id="fp-mo"' + (C.masterOnly ? ' checked' : '') + '> วิธีตามฐาน: นับเฉพาะรถในฐานข้อมูลรถ</label>' +
    '<label class="fp-chk"><input type="checkbox" id="fp-dz"' + (C.dropZero ? ' checked' : '') + '> KPI จากไฟล์: ไม่นับรถที่ทุกช่องเป็น 0 (ไม่มีรายได้/ค่าใช้จ่ายในงวด)</label>' +
    '<div>หน่วยนับของ KPI จากไฟล์: <label class="fp-chk"><input type="radio" name="fp-u" value="row"' + (C.unit !== 'plate' ? ' checked' : '') + '> แยกตามทะเบียน + DC ตามไฟล์</label> <label class="fp-chk"><input type="radio" name="fp-u" value="plate"' + (C.unit === 'plate' ? ' checked' : '') + '> รวมเป็น 1 คัน (ยอดทุก DC)</label></div>' +
    '</div><div class="fl-row" style="justify-content:flex-start"><button type="button" class="btn btn-gold" data-fp="csave">💾 บันทึกเงื่อนไข</button></div>' + msgHtml());
}
function tabCheck() {
  if (!CUR) return card('ตรวจข้อมูล', '<p>ยังไม่มีข้อมูล</p>');
  var b = built(CUR), s = b.stage, M = window.ftoFleet, found = {}, multi = {};
  s.rows.forEach(function (r) { var m = M && M.match(r); if (m) { found[pn(m.plate)] = 1; (multi[pn(m.plate)] = multi[pn(m.plate)] || {})[r.dc_name] = 1; } });
  var miss = M ? M.vehicles.filter(function (v) { return !found[pn(v.plate)]; }) : [], mul = Object.keys(multi).filter(function (p) { return Object.keys(multi[p]).length > 1; });
  var zero = b.db.filter(function (r) { return !SUM.some(function (f) { return r[f]; }); }), ch = dcChanges(CUR);
  var mt = M ? new Set(M.vehicles.map(function (v) { return clean(v.vtype); })) : new Set(), um = b.unmatched.filter(function (r) { return mt.has(clean(String(r.vehicle_type).replace(/^\d+\s+/, ''))); });
  var row = function (t, n, d) { return '<tr><td>' + t + '</td><td class="text-right' + (n ? ' fl-bad' : '') + '">' + nf(n) + '</td><td class="fp-wrap">' + d + '</td></tr>'; };
  return card('ผลตรวจข้อมูล · งวด ' + pLabel(CUR, true), '<div style="overflow-x:auto"><table class="fl-t"><thead><tr><th>รายการ</th><th class="text-right">จำนวน</th><th>รายละเอียด</th></tr></thead><tbody>' +
    '<tr><td>แถวในไฟล์</td><td class="text-right">' + nf(s.all) + '</td><td>ตัด DC ยกเว้น ' + nf(s.excluded) + ' · รวม DC ' + nf(s.aliased) + ' แถว</td></tr>' +
    '<tr><td>รายการที่นับ (ทะเบียน + DC)</td><td class="text-right">' + nf(b.db.length) + '</td><td>รวมแถวซ้ำ ' + nf(b.dupMerged) + '</td></tr>' +
    row('รถในฐานที่ไม่พบในไฟล์', miss.length, miss.slice(0, 40).map(function (v) { return E(v.plate) + ' (' + E(clean(v.dc)) + ')'; }).join(' · ')) +
    row('DC ในฐานไม่ตรงกับไฟล์', ch.length, ch.slice(0, 40).map(function (c) { return E(c.m.plate) + ': ' + E(c.from) + ' → ' + E(c.to); }).join(' · ') + (ch.length ? '<div class="fl-row" style="justify-content:flex-start"><button type="button" class="btn btn-gold" data-fp="fixdc">อัปเดต DC ในฐานตามไฟล์ (' + ch.length + ' คัน)</button></div>' : '')) +
    '<tr><td>รถที่วิ่งมากกว่า 1 DC</td><td class="text-right">' + nf(mul.length) + '</td><td>นับแยกตาม DC ในไฟล์</td></tr>' +
    '<tr><td>รายการที่ทุกช่องเป็น 0</td><td class="text-right">' + nf(zero.length) + '</td><td>' + zero.slice(0, 40).map(function (r) { return E(r.plate); }).join(' · ') + '</td></tr>' +
    row('รถประเภทเดียวกับในฐาน แต่ไม่อยู่ในฐาน', um.length, 'ประเภท ' + E(Array.from(mt).join(', ')) + ' — ถ้าเป็นรถร่วมให้เพิ่มเข้าฐานที่หน้า 🗺️ สรุปโซน / DC') +
    '</tbody></table></div>' + msgHtml());
}
function tabExport() {
  return card('ส่งออกไฟล์', '<p class="fl-note">งวดที่เลือก: ' + (CUR ? pLabel(CUR, true) : '–') + '</p><div class="fl-row" style="justify-content:flex-start">' +
    '<button type="button" class="btn btn-gold" data-fp="x1">⬇️ Excel งวดนี้ (KPI + ราย DC + ข้อมูลรถ)</button><button type="button" class="btn" data-fp="x2">⬇️ Excel KPI ทุกงวด</button><button type="button" class="btn" data-fp="x3">⬇️ ข้อมูลดิบงวดนี้ (ทุกแถวในไฟล์)</button></div>' + msgHtml());
}
function xKpiRows(k) { var o = overall(k); return o.rows.map(function (x) { return [x.kp.no, x.kp.name, x.kp.unit, x.kp.weight, x.kp.grade.A, x.kp.grade.B, x.kp.grade.C, x.kp.grade.D, Number.isFinite(x.v) ? +x.v.toFixed(2) : '', x.g, Number.isFinite(x.pts) ? +x.pts.toFixed(2) : '']; }).concat([['', 'รวม', '', '', '', '', '', '', '', o.grade, Number.isFinite(o.score) ? +o.score.toFixed(2) : '']]); }
function doExport(kind) {
  if (!CUR) return say('ยังไม่มีข้อมูล', true);
  var wb = XLSX.utils.book_new(), add = function (n, a) { XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(a), n); }, Z = window.ftoFleet;
  var KH = ['ลำดับ', 'KPI', 'หน่วย', 'น้ำหนัก %', 'A', 'B', 'C', 'D', 'ผล', 'เกรด', 'คะแนน'];
  if (kind === 'x1') {
    add('KPI', [['KPI แผนก Fleet Planning · งวด ' + pLabel(CUR, true)], []].concat([KH]).concat(xKpiRows(CUR)));
    cfg().kpis.filter(function (k) { return k.src === 'net_ge'; }).forEach(function (kp) {
      var U = units(CUR), m = {}; U.forEach(function (u) { var d = clean(u.dc); (m[d] = m[d] || []).push(u); });
      add(('KPI ' + kp.no + ' ราย DC').slice(0, 31), [['DC', 'โซน', 'รถ', '≥ ' + kp.param, 'ต่ำกว่า', '%', 'เกรด']].concat(Object.keys(m).sort().map(function (d) { var L = m[d], ok = L.filter(function (u) { return u.net >= kp.param; }).length, v = ok / L.length * 100; return [d, Z ? Z.zoneOf(d) : '', L.length, ok, L.length - ok, +v.toFixed(2), grade(kp, v)]; })));
      add(('ต่ำกว่า ' + kp.param).slice(0, 31), [['ทะเบียน', 'DC', 'โซน', 'คงเหลือสุทธิ', 'รายได้รวม']].concat(U.filter(function (u) { return u.net < kp.param; }).sort(function (a, b) { return a.net - b.net; }).map(function (u) { return [u.plate, clean(u.dc), Z ? Z.zoneOf(u.dc) : '', u.net, u.rev]; })));
    });
    add('ข้อมูลรถ', [['DC', 'โซน', 'กลุ่มรถ', 'รหัสรถ', 'ทะเบียน', 'ประเภทรถ', 'เจ้าของ', 'รวมรายได้', 'ค่าใช้จ่ายประจำวัน', 'ค่าใช้จ่ายรายงวด', 'ค่าเช่ารถ', 'ภาษี', 'ยอดยกมา', 'คงเหลือสุทธิ', 'กำไร/ขาดทุน']].concat(built(CUR).db.map(function (r) { var i = Z ? Z.info(r) : {}; return [clean(r.dc_name), i.zone || '', i.group || '', r.dc_code, r.plate, r.vehicle_type, r.owner, r.total_revenue, r.daily_expense, r.period_expense, r.rental, r.tax, r.carry_over, r.net_balance, r.profit_loss]; })));
    XLSX.writeFile(wb, 'NIMEX-TransportOperator-' + CUR + '.xlsx');
  } else if (kind === 'x2') {
    var C = cfg();
    add('KPI ทุกงวด', [['งวด'].concat(C.kpis.map(function (k) { return 'KPI ' + k.no; })).concat(C.kpis.map(function (k) { return 'เกรด KPI ' + k.no; })).concat(['คะแนนรวม', 'เกรดรวม'])].concat(KEYS.map(function (k) { var o = overall(k); return [pLabel(k, true)].concat(o.rows.map(function (x) { return Number.isFinite(x.v) ? +x.v.toFixed(2) : ''; })).concat(o.rows.map(function (x) { return x.g; })).concat([Number.isFinite(o.score) ? +o.score.toFixed(2) : '', o.grade]); })));
    add('เกณฑ์', [KH.slice(0, 8).concat(['ทิศทาง', 'แหล่งข้อมูล'])].concat(C.kpis.map(function (k) { return [k.no, k.name, k.unit, k.weight, k.grade.A, k.grade.B, k.grade.C, k.grade.D, k.dir > 0 ? 'สูง = ดี' : 'ต่ำ = ดี', k.src === 'net_ge' ? 'จากไฟล์ ≥ ' + k.param : 'กรอกเอง']; })));
    XLSX.writeFile(wb, 'NIMEX-TransportOperator-KPI.xlsx');
  } else {
    add('NIMEX03102', [['ชื่อ DC', 'ทะเบียนรถ', 'รายได้', 'ปรับปรุงรายได้', 'รวมรายได้', 'ค่าใช้จ่ายประจำวัน', 'คงเหลือหลังค่าใช้จ่ายประจำวัน', 'ค่าใช้จ่ายรายงวด', 'คงเหลือหลังค่าใช้จ่ายรายงวด', 'ปรับปรุงค่าใช้จ่าย', 'คงเหลือหลังปรับปรุง', 'ค่าเช่ารถ', 'คงเหลือหลังค่าเช่า', 'ภาษี ณ ที่จ่าย', 'ยอดยกมา', 'คงเหลือสุทธิ', 'ลำดับ', 'รหัสรถ', 'ประเภทรถ', 'เจ้าของรถ']].concat(P[CUR].rows.map(function (r) { return r.slice(0, 20); })));
    XLSX.writeFile(wb, 'NIMEX03102-' + CUR + '.xlsx');
  }
  say('✓ ดาวน์โหลดแล้ว');
}

/* ---------- เหตุการณ์ ---------- */
function onClick(e) {
  var b = e.target.closest('[data-fp]'); if (!b) return;
  var a = b.dataset.fp, v = b.dataset.v;
  if (a === 'tab') { UI.tab = v; UI.msg = ''; UI.confirm = ''; renderAdmin(); }
  else if (a === 'fleet') ftoFleet.show('fleet', null);
  else if (a === 'delq') { UI.confirm = v; renderAdmin(); }
  else if (a === 'delx') { UI.confirm = ''; renderAdmin(); }
  else if (a === 'del') {
    say('⏳ กำลังลบ…');
    api({ a: 'delperiod', period: v }).then(function () { delete P[v]; delete MAN[v]; KEYS = Object.keys(P).filter(function (q) { return q !== '__pend'; }).sort(); if (CUR === v) CUR = KEYS[KEYS.length - 1] || ''; UI.confirm = ''; refresh(); renderAdmin(); say('ลบงวด ' + pLabel(v, true) + ' แล้ว'); })
      .catch(function (x) { say('ลบไม่สำเร็จ: ' + x.message, true); });
  }
  else if (a === 'save') savePending();
  else if (a === 'cancel') { PEND = null; delete P.__pend; renderAdmin(); }
  else if (a === 'kadd') { var r = readKpiForm().C, n = 1; while (r.kpis.some(function (k) { return k.id === 'k' + n || k.id === 'x' + n; })) n++; r.kpis.push({ id: 'x' + n, no: String(r.kpis.length ? (+r.kpis[r.kpis.length - 1].no || 0) + 1 : 1), name: 'KPI ใหม่', unit: '%', weight: 0, grade: { A: 100, B: 99, C: 98, D: 97 }, dir: 1, src: 'manual' }); CFG = r; renderAdmin(); say('เพิ่มแถว KPI แล้ว — แก้ชื่อและเกณฑ์ แล้วกดบันทึก'); }
  else if (a === 'kdel') { var r2 = readKpiForm().C; if (window.confirm('ลบ KPI ' + r2.kpis[+v].no + ' ' + r2.kpis[+v].name + '?')) { r2.kpis.splice(+v, 1); CFG = r2; renderAdmin(); say('ลบแล้ว — กดบันทึกเพื่อยืนยัน'); } }
  else if (a === 'ksave') { var f = readKpiForm(); if (f.err) return say(f.err, true); saveCfg(f.C, '✅ บันทึก KPI และเกณฑ์แล้ว'); }
  else if (a === 'csave') {
    var C = clone(cfg()), ex = $('fp-ex').value.split(/[,\s]+/).filter(Boolean), al = {}, bad = '';
    if (ex.some(function (x) { return !/^\d{2,5}$/.test(x); })) bad = 'DC ที่ตัดออกต้องเป็นรหัสตัวเลข';
    $('fp-al').value.split(/\n/).map(function (l) { return l.trim(); }).filter(Boolean).forEach(function (l) { var m = l.match(/^(\d{2,5})\s*=\s*(\d{2,5})$/); if (!m) bad = 'รูปแบบ DC ที่รวมกันไม่ถูกต้อง: ' + l; else al[m[1]] = m[2]; });
    var tgm = {}; $('fp-tg').value.split(/\n/).map(function (l) { return l.trim(); }).filter(Boolean).forEach(function (l) { var m = l.match(/^(\d{3})\s*=\s*(\d{3})$/); if (!m) bad = 'รูปแบบรวมประเภทรถไม่ถูกต้อง (ต้องเป็นรหัส 3 หลัก เช่น 041=040): ' + l; else tgm[m[1]] = m[2]; });
    if (bad) return say(bad, true);
    C.typeGroup = tgm; C.exclude = ex; C.alias = al; C.typeMin = Math.max(0, Math.round(+$('fp-tm').value || 0)); C.masterOnly = $('fp-mo').checked; C.countMode = (document.querySelector('[name=fp-cm]:checked') || {}).value === 'master' ? 'master' : 'revenue'; C.typeLow = Math.max(0, Math.round(+$('fp-tl').value || 0)); C.dropZero = $('fp-dz').checked; C.unit = (document.querySelector('[name=fp-u]:checked') || {}).value === 'plate' ? 'plate' : 'row';
    learnNames(); saveCfg(C, '✅ บันทึกเงื่อนไขแล้ว ทุกหน้าคำนวณใหม่');
  }
  else if (a === 'msave') {
    var nm = clone(MAN), bad2 = '';
    document.querySelectorAll('[data-mp]').forEach(function (i) { var p = i.dataset.mp, k = i.dataset.mk, s = i.value.trim(); nm[p] = nm[p] || {}; if (s === '') nm[p][k] = null; else if (!Number.isFinite(+s)) bad2 = 'ค่าต้องเป็นตัวเลข'; else nm[p][k] = +s; });
    if (bad2) return say(bad2, true);
    say('⏳ กำลังบันทึก…');
    api({ a: 'man', man: nm }).then(function () { MAN = nm; renderAdmin(); say('✅ บันทึกค่า KPI แล้ว'); }).catch(function (x) { say('บันทึกไม่สำเร็จ: ' + x.message, true); });
  }
  else if (a === 'fixdc') { var ch = dcChanges(CUR); say('⏳ กำลังบันทึก…'); ch.forEach(function (c) { c.m.dc = c.to; }); ftoFleet.persist('อัปเดต DC ตามไฟล์งวด ' + CUR).then(function () { refresh(); renderAdmin(); say('✅ อัปเดต DC แล้ว ' + ch.length + ' คัน'); }).catch(function (x) { say('บันทึกไม่สำเร็จ: ' + x.message, true); }); }
  else if (a === 'x1' || a === 'x2' || a === 'x3') doExport(a);
}
function onChange(e) {
  if (e.target.id === 'fp-sel') { CUR = e.target.value; refresh(); return; }
  if (e.target.id === 'fp-file') {
    var f = e.target.files[0]; if (!f) return; say('กำลังอ่านไฟล์…');
    parseFile(f).then(function (x) { preview(x); UI.msg = ''; renderAdmin(); if (!x.key) say('ไม่พบช่วงวันที่ในหัวรายงาน กรุณาเลือกงวด', true); })
      .catch(function (x) { PEND = null; say('อ่านไฟล์ไม่สำเร็จ: ' + x.message, true); });
    e.target.value = ''; return;
  }
  if (e.target.id === 'fp-pkey' && PEND) { PEND.key = e.target.value; renderAdmin(); return; }
  if (e.target.dataset && e.target.dataset.f === 'src') { var tr = e.target.closest('tr'), p = tr.querySelector('[data-f=param]'); p.disabled = e.target.value !== 'net_ge'; if (!p.disabled && !p.value) p.value = 7000; }
}

/* ---------- เริ่ม ---------- */
function show(p, tab) {
  currentPage = p;
  document.querySelectorAll('.navtab').forEach(function (t) { t.classList.toggle('active', t === tab); });
  document.querySelectorAll('.page').forEach(function (pg) { pg.classList.remove('active'); });
  $('page-' + p).classList.add('active');
  render();
}
function render() { if (currentPage === 'kpi') renderKpi(); else if (currentPage === 'admin') { renderAdmin(); if (UI.tab === 'data') renderDataTable(); } }
function start() {
  var D = window.FTO_DATA || {};
  P = D.periods || {}; KEYS = Object.keys(P).sort(); CUR = KEYS[KEYS.length - 1] || ''; MAN = D.man || {};
  CFG = D.cfg && D.cfg.kpis ? D.cfg : null;
  var m = location.hash.match(/p=(\d{4}-\d{2}-[12])/); if (m && P[m[1]]) CUR = m[1];
  learnNames();
  var orig = window.renderCurrentPage;
  window.renderCurrentPage = renderCurrentPage = function () { if (currentPage === 'kpi' || currentPage === 'admin') render(); else orig(); };
  document.addEventListener('click', onClick); document.addEventListener('change', onChange);
  if (window.ftoViews) ftoViews.start();
  if (window.ftoDebt) ftoDebt.start();
  window.FTO_ROWS = []; apply(); window.FTO_ROWS = DB.slice();
  window.ftoStart();
  if (!CUR && adm()) { var t = Array.prototype.find.call(document.querySelectorAll('.navtab'), function (x) { return /ตั้งค่า/.test(x.textContent); }); if (t) t.click(); }
}
window.ftoPeriod = { changeLog: changeLog, bigType: bigType, saveCfg: function (C, msg) { return saveCfg(C, msg); }, say: say, renderAdmin: function () { renderAdmin(); }, setTab: function (t) { UI.tab = t; UI.msg = ''; },
  periodEnd: function (k) { var a = k.split('-'), y = +a[0] - 543, m = +a[1]; return a[2] === '1' ? new Date(y, m - 1, 15) : new Date(y, m, 0); }, dataset: dataset, prevFor: prevFor, spanLabel: spanLabel, months: months, monthKeys: monthKeys, view: VIEW, setView: function (k, v) { VIEW[k] = v; refresh(); }, P: function () { return P; }, gradesOn: gradesOn,
  start: start, refresh: function () { learnNames(); refresh(); }, show: show, overall: overall, kval: kval, units: units, built: built, stage: stage, dcChanges: dcChanges, parseFile: parseFile,
  unmatched: function () { return CUR ? built(CUR).unmatched : []; }, get keys() { return KEYS; }, get cur() { return CUR; }, get cfg() { return cfg(); }, label: pLabel };
})();
