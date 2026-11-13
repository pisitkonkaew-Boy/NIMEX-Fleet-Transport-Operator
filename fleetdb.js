/* NIMEX Fleet Transport Operator — ฐานข้อมูลรถ (ตั้งค่า) + สรุปโซน / DC
   • ฐานข้อมูลรถ: ทะเบียน รหัสรถ กลุ่มรถ DC ประเภทรถ — ผู้ดูแลเพิ่ม/แก้/ลบ/นำเข้า Excel แล้วบันทึกลง Google Sheet (แท็บ Vehicles)
   • DC → โซน: ค่าเริ่มต้น 12 โซนแบบ Check-in Performance ผู้ดูแลแก้ได้ (แท็บ Zones)
   • ไม่เปลี่ยนสูตรเดิม: ตัวเลขเงินใช้ calcSummary() ของหน้าแดชบอร์ด ตามตัวกรองด้านซ้าย
   • จับคู่คันในไฟล์รายได้กับฐาน: ทะเบียน (ตัดช่องว่าง/ขีด) ถ้าไม่พบใช้รหัสรถ */
(function () {
'use strict';
var ZONES = ['BKK', 'กลาง', 'ตะวันออก', 'ตะวันตก', 'เหนือบน', 'เหนือกลาง', 'เหนือล่าง', 'อีสานบน', 'อีสานกลาง', 'อีสานล่าง', 'ใต้บน', 'ใต้ล่าง'];
var DEF_Z = {"150":"เหนือบน","151":"เหนือบน","152":"เหนือบน","153":"เหนือกลาง","154":"เหนือกลาง","155":"เหนือกลาง","156":"เหนือบน","157":"เหนือบน","158":"เหนือบน","159":"เหนือบน","160":"เหนือล่าง","162":"เหนือล่าง","163":"เหนือล่าง","164":"เหนือกลาง","165":"เหนือกลาง","166":"เหนือล่าง","167":"เหนือกลาง","168":"เหนือกลาง","170":"เหนือล่าง","171":"เหนือบน","230":"อีสานล่าง","231":"อีสานล่าง","232":"อีสานล่าง","233":"อีสานล่าง","234":"อีสานล่าง","235":"อีสานกลาง","236":"อีสานกลาง","237":"อีสานล่าง","240":"อีสานกลาง","241":"อีสานบน","242":"อีสานบน","243":"อีสานบน","244":"อีสานกลาง","245":"อีสานกลาง","246":"อีสานกลาง","247":"อีสานบน","248":"อีสานบน","249":"อีสานกลาง","250":"อีสานกลาง","251":"อีสานล่าง","252":"อีสานล่าง","260":"อีสานบน","320":"ตะวันออก","321":"ตะวันออก","322":"ตะวันออก","323":"ตะวันออก","325":"ตะวันออก","328":"ตะวันออก","476":"ตะวันตก","477":"ใต้บน","480":"ใต้ล่าง","481":"ใต้ล่าง","482":"ใต้บน","483":"ใต้บน","484":"ใต้บน","486":"ใต้บน","487":"ใต้บน","490":"ใต้ล่าง","492":"ใต้ล่าง","493":"ใต้ล่าง","610":"BKK","615":"กลาง","618":"กลาง","621":"BKK","624":"ตะวันออก","631":"กลาง","670":"ตะวันตก","671":"ตะวันตก","672":"กลาง","673":"ตะวันตก","674":"ตะวันตก","680":"BKK","691":"BKK"};
var NOZ = 'ยังไม่กำหนดโซน', NOM = 'ไม่อยู่ในฐาน';
var VEH = [], ZMAP = {}, DIRTY = 0, byPlate = {}, byCode = {}, SERVER_V = 1, FDC = null;
var ui = { zone: '', group: '', tab: 'veh', q: '', fdc: '', fgrp: '', page: 1 };

function $(id) { return document.getElementById(id); }
function E(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
function nf(v, d) { return Number(v || 0).toLocaleString('th-TH', { minimumFractionDigits: d || 0, maximumFractionDigits: d || 0 }); }
function pn(p) { return String(p || '').replace(/[\s\-]/g, ''); }
function cn(c) { return String(c || '').replace(/\D/g, '').replace(/^0+/, ''); }
function dcCode(n) { var m = String(n || '').trim().match(/^(\d{2,5})/); return m ? m[1] : ''; }
function dcClean(n) { return String(n || '').replace(/\s+/g, ' ').trim(); }
function zoneOf(dc) { return ZMAP[dcCode(dc)] || NOZ; }
function zoneList() { var z = ZONES.slice(); Object.keys(ZMAP).forEach(function (k) { if (z.indexOf(ZMAP[k]) < 0) z.push(ZMAP[k]); }); return z; }
function adm() { return !!window.FTO_ADMIN; }

/* ---------- โหลด / ดัชนี ---------- */
function load() {
  var f = window.FTO_FLEET || {}; SERVER_V = window.FTO_SERVER_V || 1;
  VEH = (f.vehicles || []).map(function (r) { return { plate: r[0], code: r[1], group: r[2], dc: r[3], vtype: r[4] }; });
  ZMAP = {}; var zs = f.zones || [];
  if (zs.length) zs.forEach(function (z) { if (z[1]) ZMAP[String(z[0])] = z[1]; }); else Object.keys(DEF_Z).forEach(function (k) { ZMAP[k] = DEF_Z[k]; });
  index();
}
function index() {
  byPlate = {}; byCode = {};
  VEH.forEach(function (v) { byPlate[pn(v.plate)] = v; var c = cn(v.code); if (c) byCode[c] = v; });
}
function fileDcs() {   /* ทะเบียน → DC ทั้งหมดที่พบในไฟล์รายได้ (คันเดียววิ่งได้หลาย DC) */
  if (FDC) return FDC; FDC = {};
  DB.forEach(function (r) { var k = pn(r.plate), c = dcCode(r.dc_name); (FDC[k] = FDC[k] || {})[c] = dcClean(r.dc_name); });
  return FDC;
}
function match(r) { return byPlate[pn(r.plate)] || byCode[cn(r.dc_code)] || null; }
function info(r) {
  var m = match(r);
  var f = fileDcs()[pn(r.plate)] || {}, multi = Object.keys(f).length > 1;
  /* DC ไม่ตรง = DC ในฐานไม่ตรงกับ DC ใดเลยที่คันนี้วิ่งในไฟล์ (ถ้าวิ่งหลาย DC และ DC ในฐานเป็นหนึ่งในนั้น ถือว่าไม่ผิด) */
  return { m: m, zone: zoneOf(r.dc_name), group: m ? (m.group || '-') : NOM, multi: multi, mis: !!(m && dcCode(m.dc) && !f[dcCode(m.dc)]) };
}
function data() {   /* ตามตัวกรองด้านซ้าย + โซน/กลุ่มบนหน้านี้ */
  var base = typeof getFiltered === 'function' ? getFiltered() : DB;
  return base.filter(function (r) { var i = info(r); return (!ui.zone || i.zone === ui.zone) && (!ui.group || i.group === ui.group); });
}
function vehInScope() { return VEH.filter(function (v) { return (!ui.zone || zoneOf(v.dc) === ui.zone) && (!ui.group || v.group === ui.group) && (!slicers.dc.size || Array.from(slicers.dc).some(function (d) { return dcCode(d) === dcCode(v.dc); })); }); }

/* ---------- หน้า: สรุปโซน / DC ---------- */
function unmatchedRows() {   /* รถในไฟล์ (ประเภทเดียวกับในฐาน) ที่ไม่อยู่ในฐาน — ใช้ข้อมูลก่อนกรองเฉพาะรถในฐาน */
  var src = window.ftoPeriod ? ftoPeriod.unmatched() : DB.filter(function (r) { return !match(r); });
  var types = new Set(VEH.map(function (v) { return dcClean(v.vtype); }));
  return src.filter(function (r) { return !match(r) && (!types.size || types.has(dcClean(String(r.vehicle_type).replace(/^\d+\s+/, '')))) && (!ui.zone || zoneOf(r.dc_name) === ui.zone) && (!slicers.dc.size || slicers.dc.has(r.dc_name)); });
}
function rowStats(rows) { var s = calcSummary(rows); s.nm = rows.filter(function (r) { return !match(r); }).length; s.plates = new Set(rows.map(function (r) { return pn(r.plate); })).size; return s; }
function sumTable(keyName, groups, vehCount, click) {
  var h = '<div class="table-wrap fl-tw"><div style="overflow-x:auto"><table class="fl-t"><thead><tr><th>' + keyName + '</th><th class="text-right">รถในฐาน</th><th class="text-right">กระจาย / ขนย้าย</th><th class="text-right">รายการในไฟล์</th><th class="text-right">ไม่อยู่ในฐาน</th><th class="text-right">รายได้รวม</th><th class="text-right">ค่าใช้จ่าย+ค่าเช่า</th><th class="text-right">ยอดคงเหลือสุทธิ</th><th class="text-right">เฉลี่ย/คัน</th><th class="text-right">คันขาดทุน</th><th class="text-right">% ขาดทุน</th></tr></thead><tbody>';
  var T = [];
  groups.forEach(function (g) {
    var s = rowStats(g.rows), vc = vehCount(g.key), pl = s.n ? s.loss_count / s.n * 100 : 0; T = T.concat(g.rows);
    h += '<tr' + (click ? ' class="fl-click" data-' + click + '="' + E(g.key) + '" tabindex="0"' : '') + '><td><b>' + E(g.label || g.key) + '</b></td><td class="text-right">' + nf(vc.all) + '</td><td class="text-right">' + nf(vc.dist) + ' / ' + nf(vc.move) + '</td><td class="text-right">' + nf(s.n) + '</td><td class="text-right' + (s.nm ? ' fl-bad' : '') + '">' + nf(s.nm) + '</td><td class="text-right">' + nf(s.total_rev) + '</td><td class="text-right">' + nf(s.total_exp + s.total_rental) + '</td><td class="text-right ' + (s.total_net < 0 ? 'fl-bad' : '') + '"><b>' + nf(s.total_net) + '</b></td><td class="text-right ' + (s.avg_net < 0 ? 'fl-bad' : '') + '">' + nf(s.avg_net) + '</td><td class="text-right">' + nf(s.loss_count) + '</td><td class="text-right ' + (pl >= 50 ? 'fl-bad' : '') + '">' + pl.toFixed(1) + '%</td></tr>';
  });
  var s = rowStats(T), vt = { all: 0, dist: 0, move: 0 }; groups.forEach(function (g) { var c = vehCount(g.key); vt.all += c.all; vt.dist += c.dist; vt.move += c.move; });
  h += '</tbody><tfoot><tr><td><b>รวม</b></td><td class="text-right"><b>' + nf(vt.all) + '</b></td><td class="text-right">' + nf(vt.dist) + ' / ' + nf(vt.move) + '</td><td class="text-right"><b>' + nf(s.n) + '</b></td><td class="text-right">' + nf(s.nm) + '</td><td class="text-right">' + nf(s.total_rev) + '</td><td class="text-right">' + nf(s.total_exp + s.total_rental) + '</td><td class="text-right"><b>' + nf(s.total_net) + '</b></td><td class="text-right">' + nf(s.avg_net) + '</td><td class="text-right">' + nf(s.loss_count) + '</td><td class="text-right">' + (s.n ? (s.loss_count / s.n * 100).toFixed(1) : '0.0') + '%</td></tr></tfoot></table></div></div>';
  return h;
}
function vc(list) { return { all: list.length, dist: list.filter(function (v) { return v.group === 'กระจาย'; }).length, move: list.filter(function (v) { return v.group === 'ขนย้าย'; }).length }; }
function renderZone() {
  var el = $('fl-zone-body'); if (!el) return;
  var rows = data(), V = vehInScope(), s = rowStats(rows), NM = unmatchedRows(), mis = rows.filter(function (r) { return info(r).mis; });
  var inFile = new Set(DB.map(function (r) { return pn(r.plate); })), notInFile = V.filter(function (v) { return !inFile.has(pn(v.plate)); });
  var groups = ['กระจาย', 'ขนย้าย'].concat(Array.from(new Set(VEH.map(function (v) { return v.group; }))).filter(function (g) { return g && g !== 'กระจาย' && g !== 'ขนย้าย'; }));
  var h = '<div class="fl-bar"><label>โซน <select id="fl-zsel"><option value="">— ทุกโซน —</option>' + zoneList().concat([NOZ]).map(function (z) { return '<option' + (ui.zone === z ? ' selected' : '') + '>' + E(z) + '</option>'; }).join('') + '</select></label>' +
    '<label>กลุ่มรถ <select id="fl-gsel"><option value="">— ทั้งหมด —</option>' + groups.concat([NOM]).map(function (g) { return '<option' + (ui.group === g ? ' selected' : '') + '>' + E(g) + '</option>'; }).join('') + '</select></label>' +
    '<span class="fl-note">ใช้ตัวกรองด้านซ้ายร่วมด้วย · คลิกแถวโซนเพื่อดูราย DC</span></div>';
  if (!VEH.length) h += '<div class="fl-warn">ยังไม่มีฐานข้อมูลรถ' + (adm() ? ' — ไปที่เมนู "🚚 ฐานข้อมูลรถ" เพื่อนำเข้าไฟล์ Excel' : ' — ผู้ดูแลยังไม่ได้นำเข้า') + '</div>';
  h += '<div class="kpi-grid fl-kpi">' + [
    ['รถในฐานข้อมูล', nf(V.length), 'กระจาย ' + nf(vc(V).dist) + ' · ขนย้าย ' + nf(vc(V).move)],
    ['รายการในไฟล์รายได้', nf(s.n), nf(s.plates) + ' ทะเบียน'],
    ['ไม่อยู่ในฐานข้อมูลรถ', nf(NM.length), 'รถประเภทเดียวกันในไฟล์ที่หาทะเบียน/รหัสในฐานไม่พบ', NM.length > 0],
    ['DC ไม่ตรงกับฐาน', nf(mis.length), 'DC ในฐานไม่ตรงกับ DC ที่วิ่งในไฟล์', mis.length > 0],
    ['ยอดคงเหลือสุทธิรวม', nf(s.total_net), 'เฉลี่ย ' + nf(s.avg_net) + ' บาท/คัน', s.total_net < 0],
    ['คันขาดทุน', nf(s.loss_count), (s.n ? (s.loss_count / s.n * 100).toFixed(1) : '0.0') + '% ของรายการ', false]
  ].map(function (k) { return '<div class="kpi-card"><div class="kpi-label">' + k[0] + '</div><div class="kpi-value' + (k[3] ? ' fl-bad' : '') + '">' + k[1] + '</div><div class="kpi-sub">' + k[2] + '</div></div>'; }).join('') + '</div>';
  var zs = zoneList().concat([NOZ]).filter(function (z) { return !ui.zone || z === ui.zone; });
  var zg = zs.map(function (z) { return { key: z, rows: rows.filter(function (r) { return info(r).zone === z; }) }; }).filter(function (g) { return g.rows.length || V.some(function (v) { return zoneOf(v.dc) === g.key; }); });
  h += '<div class="section-head">🗺️ สรุปรายโซน</div>' + sumTable('โซน', zg, function (z) { return vc(V.filter(function (v) { return zoneOf(v.dc) === z; })); }, 'zone');
  var dcs = {}; rows.forEach(function (r) { var c = dcCode(r.dc_name) || r.dc_name; (dcs[c] = dcs[c] || { key: c, label: dcClean(r.dc_name), rows: [] }).rows.push(r); });
  V.forEach(function (v) { var c = dcCode(v.dc) || v.dc; if (!dcs[c]) dcs[c] = { key: c, label: dcClean(v.dc), rows: [] }; });
  var dg = Object.keys(dcs).sort().map(function (k) { var g = dcs[k]; g.label = g.label + ' · ' + zoneOf(g.label); return g; });
  h += '<div class="section-head">🏢 สรุปราย DC' + (ui.zone ? ' · โซน ' + E(ui.zone) : '') + '</div>' + sumTable('DC', dg, function (c) { return vc(V.filter(function (v) { return (dcCode(v.dc) || v.dc) === c; })); });
  var A = adm(), nm = NM;
  /* DC ไม่ตรง: 1 แถวต่อทะเบียน + ปุ่มแก้ (ผู้ดูแล) */
  var seen = {}, misP = [];
  mis.forEach(function (r) { var m = match(r), k = pn(m.plate); if (seen[k]) return; seen[k] = 1; misP.push({ m: m, f: fileDcs()[pn(r.plate)] || {} }); });
  var one = misP.filter(function (x) { return Object.keys(x.f).length === 1; });
  if (A && DIRTY) h = '<div class="fl-warn fl-savebar">มีการแก้ไขฐานข้อมูลรถ ' + DIRTY + ' รายการที่ยังไม่บันทึก <button type="button" class="btn btn-gold" id="fl-save"></button></div><p class="fl-msg" id="fl-msg" role="status"></p>' + h;
  else if (A) h = '<p class="fl-msg" id="fl-msg" role="status"></p>' + h;
  h += list('🔀 DC ในฐานไม่ตรงกับ DC ที่วิ่งในไฟล์ (' + nf(misP.length) + ' คัน)', ['ทะเบียน', 'DC ในไฟล์รายได้', 'DC ในฐาน', 'กลุ่มรถ'].concat(A ? [''] : []), misP.map(function (x) {
    var fd = Object.keys(x.f).map(function (c) { return x.f[c]; }), k = pn(x.m.plate);
    return [x.m.plate, fd.join(' / '), dcClean(x.m.dc), x.m.group].concat(A ? [{ h: (fd.length === 1 ? '<button type="button" class="btn btn-gold" data-act="fix-dc" data-k="' + E(k) + '" data-dc="' + E(fd[0]) + '">ใช้ DC ในไฟล์</button>' : '') + '<button type="button" class="btn" data-act="edit" data-k="' + E(k) + '">แก้ไข</button>' }] : []);
  }), A && one.length ? '<button type="button" class="btn btn-gold" data-act="fix-all">ใช้ DC จากไฟล์รายได้ทั้งหมด (' + nf(one.length) + ' คัน)</button> <span class="fl-note">เฉพาะคันที่วิ่ง DC เดียวในไฟล์</span>' : '', true);
  h += list('⚠️ รายการในไฟล์ที่ไม่อยู่ในฐานข้อมูลรถ (' + nf(nm.length) + ')', ['ทะเบียน', 'DC ในไฟล์', 'ประเภทรถ', 'เจ้าของ', 'ยอดสุทธิ'].concat(A ? [''] : []), nm.map(function (r) { return [r.plate, dcClean(r.dc_name), r.vehicle_type, r.owner, nf(r.net_balance)].concat(A ? [{ h: '<button type="button" class="btn btn-gold" data-act="add-from" data-i="' + nm.indexOf(r) + '">＋ เพิ่มเข้าฐาน</button>' }] : []); }));
  var mul = {}; rows.forEach(function (r) { var i = info(r); if (i.multi && i.m && !i.mis) mul[pn(r.plate)] = i.m; });
  var mulL = Object.keys(mul).map(function (k) { var m = mul[k], f = fileDcs()[k]; return [m.plate, Object.keys(f).map(function (c) { return f[c]; }).join(' / '), dcClean(m.dc), m.group].concat(A ? [{ h: '<button type="button" class="btn" data-act="edit" data-k="' + E(k) + '">แก้ไข</button>' }] : []); });
  h += list('ℹ️ รถที่วิ่งมากกว่า 1 DC ในไฟล์ (DC ในฐานเป็นหนึ่งในนั้น · ไม่ถือว่าผิด) (' + nf(mulL.length) + ' คัน)', ['ทะเบียน', 'DC ในไฟล์รายได้', 'DC ในฐาน', 'กลุ่มรถ'].concat(A ? [''] : []), mulL);
  h += list('📭 รถในฐานที่ไม่มีในไฟล์รายได้รอบนี้ (' + nf(notInFile.length) + ')', ['ทะเบียน', 'รหัสรถ', 'กลุ่มรถ', 'DC', 'ประเภทรถ'], notInFile.map(function (v) { return [v.plate, v.code, v.group, dcClean(v.dc), v.vtype]; }));
  var wasOpen = {}; el.querySelectorAll('details.fl-list').forEach(function (d) { wasOpen[d.dataset.k] = d.open; });
  el.innerHTML = h; el.querySelectorAll('details.fl-list').forEach(function (d) { if (d.dataset.k in wasOpen) d.open = wasOpen[d.dataset.k]; });
  setDirty(DIRTY); var sv = $('fl-save'); if (sv) sv.onclick = save;
  $('fl-zsel').onchange = function () { ui.zone = this.value; renderZone(); };
  $('fl-gsel').onchange = function () { ui.group = this.value; renderZone(); };
  el.querySelectorAll('[data-zone]').forEach(function (tr) { var go = function () { ui.zone = ui.zone === tr.dataset.zone ? '' : tr.dataset.zone; renderZone(); }; tr.onclick = go; tr.onkeydown = function (e) { if (e.key === 'Enter') go(); }; });
}
function list(title, head, rows, tools, open) {
  if (!rows.length) return '';
  var cap = 300;
  return '<details class="fl-list" data-k="' + E(title.split(' (')[0]) + '"' + (open ? ' open' : '') + '><summary>' + title + '</summary>' + (tools ? '<div class="fl-bar fl-tools">' + tools + '</div>' : '') + '<div style="overflow-x:auto"><table class="fl-t"><thead><tr>' + head.map(function (x) { return '<th>' + x + '</th>'; }).join('') + '</tr></thead><tbody>' +
    rows.slice(0, cap).map(function (r) { return '<tr>' + r.map(function (c) { return c && c.h ? '<td class="fl-act">' + c.h + '</td>' : '<td>' + E(c) + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table></div>' + (rows.length > cap ? '<p class="fl-note">แสดง ' + cap + ' จาก ' + nf(rows.length) + ' รายการ</p>' : '') + '</details>';
}

/* ---------- หน้า: ฐานข้อมูลรถ (ผู้ดูแล) ---------- */
function setDirty(n) { DIRTY = n; var b = $('fl-save'); if (b) { b.disabled = !DIRTY; b.textContent = DIRTY ? '💾 บันทึกลง Google Sheet (' + DIRTY + ' การเปลี่ยนแปลง)' : '💾 บันทึกแล้ว'; } }
function say(t, bad) { var m = $('fl-msg'); if (m) { m.textContent = t; m.classList.toggle('fl-bad', !!bad); } }
function knownDCs() { var s = {}; VEH.forEach(function (v) { s[dcClean(v.dc)] = 1; }); DB.forEach(function (r) { s[dcClean(r.dc_name)] = 1; }); return Object.keys(s).filter(Boolean).sort(); }
function renderFleet() {
  var el = $('fl-fleet-body'); if (!el) return;
  if (!adm()) { el.innerHTML = '<div class="fl-warn">เฉพาะผู้ดูแลระบบ</div>'; return; }
  var h = '<div class="fl-bar"><div class="fl-tabs"><button type="button" data-tab="veh" class="' + (ui.tab === 'veh' ? 'on' : '') + '">🚚 รถ (' + nf(VEH.length) + ')</button><button type="button" data-tab="zone" class="' + (ui.tab === 'zone' ? 'on' : '') + '">🗺️ DC → โซน</button></div>' +
    '<button type="button" class="btn btn-gold" id="fl-save"' + (DIRTY ? '' : ' disabled') + '></button></div>' +
    (SERVER_V < 2 ? '<div class="fl-warn">Apps Script ของ Transport Operator ยังเป็นรุ่นเก่า — วาง Code.gs รุ่นใหม่แล้ว Deploy เวอร์ชันใหม่ก่อน จึงจะบันทึกฐานข้อมูลรถได้</div>' : '') +
    '<p class="fl-msg" id="fl-msg" role="status"></p>';
  h += ui.tab === 'veh' ? vehHtml() : zoneHtml();
  el.innerHTML = h; setDirty(DIRTY); bindFleet(el);
}
function vehFiltered() {
  var q = ui.q.trim().toLowerCase();
  return VEH.filter(function (v) { return (!ui.fdc || dcClean(v.dc) === ui.fdc) && (!ui.fgrp || v.group === ui.fgrp) && (!q || [v.plate, v.code, v.dc, v.vtype, v.group].join(' ').toLowerCase().indexOf(q) >= 0 || pn(v.plate).indexOf(pn(q)) >= 0); })
    .sort(function (a, b) { return dcCode(a.dc).localeCompare(dcCode(b.dc)) || String(a.plate).localeCompare(String(b.plate), 'th'); });
}
function vehHtml() {
  var L = vehFiltered(), PS = 50, pages = Math.max(1, Math.ceil(L.length / PS)); if (ui.page > pages) ui.page = pages;
  var grps = Array.from(new Set(VEH.map(function (v) { return v.group; }))).filter(Boolean).sort();
  var h = '<div class="fl-bar"><input type="search" id="fl-q" placeholder="ค้นหา ทะเบียน / รหัส / DC" value="' + E(ui.q) + '" aria-label="ค้นหารถ">' +
    '<select id="fl-fdc" aria-label="กรอง DC"><option value="">— ทุก DC —</option>' + Array.from(new Set(VEH.map(function (v) { return dcClean(v.dc); }))).sort().map(function (d) { return '<option' + (ui.fdc === d ? ' selected' : '') + '>' + E(d) + '</option>'; }).join('') + '</select>' +
    '<select id="fl-fgrp" aria-label="กรองกลุ่มรถ"><option value="">— ทุกกลุ่ม —</option>' + grps.map(function (g) { return '<option' + (ui.fgrp === g ? ' selected' : '') + '>' + E(g) + '</option>'; }).join('') + '</select>' +
    '<button type="button" class="btn btn-gold" data-act="add">＋ เพิ่มรถ</button><label class="btn">📂 นำเข้า Excel<input type="file" id="fl-file" accept=".xlsx,.xls" hidden></label><button type="button" class="btn" data-act="export">⬇️ ส่งออก Excel</button></div>' +
    '<div id="fl-import"></div>';
  h += '<div class="table-wrap fl-tw"><div style="overflow-x:auto"><table class="fl-t"><thead><tr><th>ทะเบียน</th><th>รหัสรถ</th><th>กลุ่มรถ</th><th>DC</th><th>โซน</th><th>ประเภทรถ</th><th></th></tr></thead><tbody>' +
    L.slice((ui.page - 1) * PS, ui.page * PS).map(function (v) { var k = E(pn(v.plate)); return '<tr><td><b>' + E(v.plate) + '</b></td><td>' + E(v.code) + '</td><td>' + E(v.group) + '</td><td>' + E(dcClean(v.dc)) + '</td><td>' + E(zoneOf(v.dc)) + '</td><td>' + E(v.vtype) + '</td><td class="fl-act"><button type="button" class="btn" data-act="edit" data-k="' + k + '">แก้ไข</button><button type="button" class="btn fl-del" data-act="del" data-k="' + k + '">ลบ</button></td></tr>'; }).join('') +
    (L.length ? '' : '<tr><td colspan="7">ไม่พบรถตามเงื่อนไข</td></tr>') + '</tbody></table></div></div>' +
    '<div class="fl-pg"><button type="button" class="btn" data-act="pg" data-p="' + (ui.page - 1) + '"' + (ui.page <= 1 ? ' disabled' : '') + '>‹</button> หน้า ' + ui.page + ' / ' + pages + ' · ' + nf(L.length) + ' คัน <button type="button" class="btn" data-act="pg" data-p="' + (ui.page + 1) + '"' + (ui.page >= pages ? ' disabled' : '') + '>›</button></div>';
  return h;
}
function zoneHtml() {
  var cnt = {}, fc = {}, names = {};
  VEH.forEach(function (v) { var c = dcCode(v.dc); if (!c) return; cnt[c] = (cnt[c] || 0) + 1; names[c] = names[c] || dcClean(v.dc); });
  DB.forEach(function (r) { var c = dcCode(r.dc_name); if (!c) return; fc[c] = (fc[c] || 0) + 1; names[c] = names[c] || dcClean(r.dc_name); });
  var codes = Object.keys(names).sort(), zl = zoneList(), none = codes.filter(function (c) { return !ZMAP[c]; }).length;
  return '<p class="fl-note">เลือกโซนให้แต่ละ DC (ค่าเริ่มต้นใช้ 12 โซนเดียวกับ Check-in Performance) · ' + (none ? '<b class="fl-bad">ยังไม่กำหนดโซน ' + none + ' DC</b>' : 'กำหนดโซนครบทุก DC') + '</p>' +
    '<div class="table-wrap fl-tw"><div style="overflow-x:auto"><table class="fl-t"><thead><tr><th>DC</th><th class="text-right">รถในฐาน</th><th class="text-right">รายการในไฟล์</th><th>โซน</th></tr></thead><tbody>' +
    codes.map(function (c) { return '<tr><td><b>' + E(names[c]) + '</b></td><td class="text-right">' + nf(cnt[c]) + '</td><td class="text-right">' + nf(fc[c]) + '</td><td><select data-zc="' + c + '" aria-label="โซนของ ' + E(names[c]) + '"><option value="">— ' + NOZ + ' —</option>' + zl.map(function (z) { return '<option' + (ZMAP[c] === z ? ' selected' : '') + '>' + E(z) + '</option>'; }).join('') + '<option value="__new">＋ โซนใหม่…</option></select></td></tr>'; }).join('') +
    '</tbody></table></div></div>';
}
function editForm(v, pre) {
  var isNew = !v; v = v || pre || { plate: '', code: '', group: 'กระจาย', dc: '', vtype: '' };
  var grps = Array.from(new Set(['กระจาย', 'ขนย้าย'].concat(VEH.map(function (x) { return x.group; })))).filter(Boolean);
  var types = Array.from(new Set(VEH.map(function (x) { return x.vtype; }))).filter(Boolean).sort();
  var d = $('fl-dlg');
  d.innerHTML = '<form class="fl-box" id="fl-form"><h3>' + (isNew ? '＋ เพิ่มรถ' : 'แก้ไขรถ ' + E(v.plate)) + '</h3>' +
    '<label>ทะเบียนรถ *<input name="plate" required maxlength="30" value="' + E(v.plate) + '"></label>' +
    '<label>รหัสรถ<input name="code" maxlength="20" inputmode="numeric" value="' + E(v.code) + '"></label>' +
    '<label>กลุ่มรถ<input name="group" list="fl-gl" maxlength="30" value="' + E(v.group) + '"><datalist id="fl-gl">' + grps.map(function (g) { return '<option value="' + E(g) + '">'; }).join('') + '</datalist></label>' +
    '<label>DC *<input name="dc" list="fl-dl" required maxlength="60" value="' + E(dcClean(v.dc)) + '" placeholder="เช่น 150 DC เชียงใหม่"><datalist id="fl-dl">' + knownDCs().map(function (x) { return '<option value="' + E(x) + '">'; }).join('') + '</datalist></label>' +
    '<label>ประเภทรถ<input name="vtype" list="fl-tl" maxlength="40" value="' + E(v.vtype) + '"><datalist id="fl-tl">' + types.map(function (t) { return '<option value="' + E(t) + '">'; }).join('') + '</datalist></label>' +
    '<p class="fl-msg fl-bad" id="fl-fmsg"></p><div class="fl-row"><button type="button" class="btn" data-act="cancel">ยกเลิก</button><button type="submit" class="btn btn-gold">' + (isNew ? 'เพิ่ม' : 'บันทึกการแก้ไข') + '</button></div></form>';
  d.hidden = false; d.querySelector('input').focus();
  $('fl-form').onsubmit = function (e) {
    e.preventDefault(); var f = e.target, n = {}; ['plate', 'code', 'group', 'dc', 'vtype'].forEach(function (k) { n[k] = f[k].value.trim(); });
    var bad = function (t) { $('fl-fmsg').textContent = t; };
    if (!n.plate) return bad('กรุณาใส่ทะเบียนรถ'); if (!dcCode(n.dc)) return bad('DC ต้องขึ้นต้นด้วยรหัส DC เช่น 150 DC เชียงใหม่');
    if (/[<>]/.test(Object.values(n).join(''))) return bad('ห้ามใช้เครื่องหมาย < >');
    var other = byPlate[pn(n.plate)]; if (other && (isNew || other !== v)) return bad('ทะเบียนนี้มีในฐานแล้ว (' + dcClean(other.dc) + ')');
    if (isNew) VEH.push(n); else Object.assign(v, n);
    index(); setDirty(DIRTY + 1); d.hidden = true; render(); say((isNew ? 'เพิ่ม ' : 'แก้ไข ') + n.plate + ' แล้ว — อย่าลืมกดบันทึก');
  };
}
function bindFleet(el) {
  var s = $('fl-save'); if (s) s.onclick = save;
  el.querySelectorAll('[data-tab]').forEach(function (b) { b.onclick = function () { ui.tab = b.dataset.tab; renderFleet(); }; });
  var q = $('fl-q'); if (q) q.oninput = function () { ui.q = q.value; ui.page = 1; var p = q.selectionStart; renderFleet(); var n = $('fl-q'); n.focus(); n.setSelectionRange(p, p); };
  if ($('fl-fdc')) $('fl-fdc').onchange = function () { ui.fdc = this.value; ui.page = 1; renderFleet(); };
  if ($('fl-fgrp')) $('fl-fgrp').onchange = function () { ui.fgrp = this.value; ui.page = 1; renderFleet(); };
  if ($('fl-file')) $('fl-file').onchange = function (e) { var f = e.target.files[0]; if (f) readExcel(f); e.target.value = ''; };
  el.querySelectorAll('[data-zc]').forEach(function (sel) {
    sel.onchange = function () {
      var c = sel.dataset.zc, z = sel.value;
      if (z === '__new') { z = (window.prompt('ชื่อโซนใหม่') || '').trim(); if (!z || z.length > 40 || /[<>]/.test(z)) { renderFleet(); return; } }
      if (z) ZMAP[c] = z; else delete ZMAP[c];
      setDirty(DIRTY + 1); renderFleet(); say('เปลี่ยนโซนแล้ว — อย่าลืมกดบันทึก');
    };
  });
}
function onClick(e) {
  var b = e.target.closest('[data-act]'); if (!b || !e.target.closest('#page-fleet, #page-zone, #fl-dlg') || !adm()) return;
  var a = b.dataset.act, v = b.dataset.k ? byPlate[b.dataset.k] : null;
  if (a === 'add') editForm(null);
  else if (a === 'edit' && v) editForm(v);
  else if (a === 'del' && v) { if (window.confirm('ลบรถ ' + v.plate + ' (' + dcClean(v.dc) + ') ออกจากฐานข้อมูล?')) { VEH.splice(VEH.indexOf(v), 1); index(); setDirty(DIRTY + 1); renderFleet(); say('ลบ ' + v.plate + ' แล้ว — อย่าลืมกดบันทึก'); } }
  else if (a === 'fix-dc' && v) { var old = dcClean(v.dc); v.dc = b.dataset.dc; index(); setDirty(DIRTY + 1); render(); say('เปลี่ยน DC ของ ' + v.plate + ' จาก ' + old + ' เป็น ' + v.dc + ' แล้ว — อย่าลืมกดบันทึก'); }
  else if (a === 'fix-all') {
    var todo = []; DB.forEach(function (r) { var m = match(r), f = fileDcs()[pn(r.plate)] || {}, ks = Object.keys(f); if (m && ks.length === 1 && dcCode(m.dc) !== ks[0] && todo.indexOf(m) < 0) { m._to = f[ks[0]]; todo.push(m); } });
    if (todo.length && window.confirm('เปลี่ยน DC ในฐานข้อมูลรถให้ตรงกับไฟล์รายได้ ' + todo.length + ' คัน?\n\n' + todo.slice(0, 12).map(function (m) { return '• ' + m.plate + ': ' + dcClean(m.dc) + ' → ' + m._to; }).join('\n') + (todo.length > 12 ? '\n…' : ''))) {
      todo.forEach(function (m) { m.dc = m._to; }); setDirty(DIRTY + todo.length); var done = todo.length;
    }
    todo.forEach(function (m) { delete m._to; }); index(); render(); if (done) say('เปลี่ยน DC แล้ว ' + done + ' คัน — อย่าลืมกดบันทึก');
  }
  else if (a === 'add-from') { var r = unmatchedRows()[+b.dataset.i]; if (r) editForm(null, { plate: r.plate, code: r.dc_code ? String(r.dc_code).padStart(10, '0') : '', group: '', dc: dcClean(r.dc_name), vtype: String(r.vehicle_type || '').replace(/^\d+\s+/, '') }); }
  else if (a === 'cancel') $('fl-dlg').hidden = true;
  else if (a === 'pg') { ui.page = +b.dataset.p; renderFleet(); }
  else if (a === 'export') exportVeh();
  else if (a === 'imp-replace' || a === 'imp-merge') applyImport(a === 'imp-replace');
  else if (a === 'imp-cancel') { PENDING = null; $('fl-import').innerHTML = ''; }
}

/* ---------- นำเข้า / ส่งออก Excel ---------- */
var PENDING = null;
function readExcel(file) {
  say('กำลังอ่านไฟล์…');
  file.arrayBuffer().then(function (buf) {
    var wb = XLSX.read(buf, { type: 'array' }), best = null;
    wb.SheetNames.forEach(function (sn) {
      var raw = XLSX.utils.sheet_to_json(wb.Sheets[sn], { header: 1, defval: '' }), hr = -1;
      for (var i = 0; i < Math.min(10, raw.length); i++) if (raw[i].some(function (c) { return /ทะเบียน/.test(String(c)); })) { hr = i; break; }
      if (hr < 0) return;
      var H = raw[hr].map(function (c) { return String(c).trim(); }), col = function (re) { for (var j = 0; j < H.length; j++) if (re.test(H[j])) return j; return -1; };
      var m = { plate: col(/ทะเบียน/), code: col(/รหัสรถ/), group: col(/กลุ่ม/), dc: col(/^(ชื่อ\s*)?DC$|^DC|DC/), vtype: col(/ชนิดรถ/) >= 0 ? col(/ชนิดรถ/) : col(/ประเภทรถ/) };
      var score = (m.group >= 0 ? 10 : 0) + (m.code >= 0 ? 2 : 0) + (m.dc >= 0 ? 2 : 0);
      if (m.dc < 0 || (best && best.score >= score)) return;
      best = { sn: sn, score: score, m: m, rows: raw.slice(hr + 1) };
    });
    if (!best) return say('ไม่พบแผ่นงานที่มีคอลัมน์ "ทะเบียนรถ" และ "DC"', true);
    var got = {}, dup = 0, skip = 0, conflict = 0, order = [];
    best.rows.forEach(function (r) {
      var g = function (k) { return best.m[k] >= 0 ? String(r[best.m[k]] == null ? '' : r[best.m[k]]).replace(/\s+/g, ' ').trim().replace(/[<>]/g, '') : ''; };
      var v = { plate: g('plate'), code: g('code'), group: g('group'), dc: g('dc'), vtype: g('vtype') };
      if (!v.plate) { if (v.dc || v.code) skip++; return; }
      var k = pn(v.plate);
      if (got[k]) { dup++; if (JSON.stringify(got[k]) !== JSON.stringify(v)) conflict++; got[k] = v; return; }
      got[k] = v; order.push(k);
    });
    var list = order.map(function (k) { return got[k]; });
    var add = list.filter(function (v) { return !byPlate[pn(v.plate)]; }).length, upd = list.filter(function (v) { var o = byPlate[pn(v.plate)]; return o && ['code', 'group', 'dc', 'vtype'].some(function (k) { return dcClean(o[k]) !== dcClean(v[k]); }); }).length;
    var keys = new Set(order), gone = VEH.filter(function (v) { return !keys.has(pn(v.plate)); }).length;
    PENDING = list;
    $('fl-import').innerHTML = '<div class="fl-imp"><b>ไฟล์ ' + E(file.name) + ' · แผ่นงาน "' + E(best.sn) + '"</b><br>พบรถ <b>' + nf(list.length) + '</b> คัน' + (dup ? ' (แถวซ้ำ ' + nf(dup) + ' แถว' + (conflict ? ' · ข้อมูลต่างกัน ' + conflict + ' แถว ใช้แถวล่างสุด' : ' ข้อมูลเหมือนกัน ตัดออกแล้ว') + ')' : '') + (skip ? ' · ข้ามแถวไม่มีทะเบียน ' + skip : '') +
      '<br>เทียบกับฐานตอนนี้: ใหม่ <b>' + nf(add) + '</b> · ข้อมูลเปลี่ยน <b>' + nf(upd) + '</b> · อยู่ในฐานแต่ไม่อยู่ในไฟล์ <b>' + nf(gone) + '</b>' +
      '<div class="fl-row"><button type="button" class="btn btn-gold" data-act="imp-replace">แทนที่ทั้งหมดด้วยไฟล์นี้' + (gone ? ' (ลบ ' + nf(gone) + ' คัน)' : '') + '</button><button type="button" class="btn" data-act="imp-merge">เพิ่ม + อัปเดตเท่านั้น (ไม่ลบ)</button><button type="button" class="btn" data-act="imp-cancel">ยกเลิก</button></div></div>';
    say('');
  }).catch(function (e) { say('อ่านไฟล์ไม่สำเร็จ: ' + e.message, true); });
}
function applyImport(replace) {
  if (!PENDING) return; var n = PENDING.length;
  if (replace) VEH = PENDING.slice();
  else PENDING.forEach(function (v) { var o = byPlate[pn(v.plate)]; if (o) Object.assign(o, v); else VEH.push(v); });
  PENDING = null; index(); setDirty(DIRTY + 1); renderFleet(); say((replace ? 'แทนที่ฐานด้วย ' : 'เพิ่ม/อัปเดตจาก ') + nf(n) + ' คันแล้ว — ตรวจแล้วกด "บันทึกลง Google Sheet"');
}
function exportVeh() {
  var aoa = [['ทะเบียนรถ', 'รหัสรถ', 'กลุ่มรถ', 'DC', 'ประเภทรถ', 'โซน']].concat(vehFiltered().map(function (v) { return [v.plate, v.code, v.group, dcClean(v.dc), v.vtype, zoneOf(v.dc)]; }));
  var z = [['รหัส DC', 'โซน']].concat(Object.keys(ZMAP).sort().map(function (c) { return [c, ZMAP[c]]; }));
  var wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), 'ฐานข้อมูลรถ'); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(z), 'DC-โซน');
  XLSX.writeFile(wb, 'NIMEX-ฐานข้อมูลรถ.xlsx');
}
function persist(note) {   /* บันทึกฐานข้อมูลรถทั้งหมดทันที (ใช้โดย period.js ตอนเติมไฟล์) */
  var fleet = { vehicles: VEH.map(function (v) { return [String(v.plate), String(v.code || ''), String(v.group || ''), dcClean(v.dc), String(v.vtype || '')]; }),
    zones: Object.keys(ZMAP).sort().map(function (c) { return [c, ZMAP[c]]; }) };
  index(); FDC = null;
  return window.ftoApi({ a: 'fleet', fleet: fleet, note: note || '' }).then(function (r) { setDirty(0); window.FTO_FLEET = { vehicles: fleet.vehicles, zones: fleet.zones }; return r; });
}
function save() {
  if (!DIRTY) return;
  if (!window.ftoApi) return say('บันทึกไม่ได้: ยังไม่ได้เชื่อม Google Sheet', true);
  var fleet = { vehicles: VEH.map(function (v) { return [String(v.plate), String(v.code || ''), String(v.group || ''), dcClean(v.dc), String(v.vtype || '')]; }),
    zones: Object.keys(ZMAP).sort().map(function (c) { return [c, ZMAP[c]]; }) };
  say('⏳ กำลังบันทึก…'); $('fl-save').disabled = true;
  window.ftoApi({ a: 'fleet', fleet: fleet, note: DIRTY + ' changes' }).then(function (r) {
    setDirty(0); say('✅ บันทึกแล้ว รถ ' + nf(r.vehicles) + ' คัน · DC ที่กำหนดโซน ' + nf(r.zones) + ' · ผู้ชมเห็นข้อมูลใหม่แล้ว');
    window.FTO_FLEET = { vehicles: fleet.vehicles, zones: fleet.zones };
    if (window.ftoPeriod) ftoPeriod.refresh();
  }).catch(function (e) {
    setDirty(DIRTY);
    say(e.message === 'unknown' ? 'บันทึกไม่สำเร็จ: Apps Script ยังเป็นรุ่นเก่า — วาง Code.gs รุ่นใหม่แล้ว Deploy เวอร์ชันใหม่' : 'บันทึกไม่สำเร็จ: ' + (e.message === 'denied' ? 'รหัสไม่ถูกต้อง' : e.message === 'bad_value' ? 'ข้อมูลไม่ถูกต้อง (ทะเบียนซ้ำหรือว่าง)' : e.message), true);
  });
}

/* ---------- เมนู / หน้า ---------- */
function show(p, tab) {
  currentPage = p;
  document.querySelectorAll('.navtab').forEach(function (t) { t.classList.toggle('active', t === tab); });
  document.querySelectorAll('.page').forEach(function (pg) { pg.classList.remove('active'); });
  $('page-' + p).classList.add('active');
  var o = $(p === 'zone' ? 'fl-fleet-body' : 'fl-zone-body'); if (o) o.innerHTML = '';
  render();
}
function render() { if (currentPage === 'zone') renderZone(); else if (currentPage === 'fleet') renderFleet(); }
function start() {
  load();
  var orig = window.renderCurrentPage;
  window.renderCurrentPage = renderCurrentPage = function () { if (currentPage === 'zone' || currentPage === 'fleet') render(); else orig(); };
  document.addEventListener('click', onClick);
  window.addEventListener('beforeunload', function (e) { if (DIRTY) { e.preventDefault(); e.returnValue = ''; } });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && $('fl-dlg') && !$('fl-dlg').hidden) $('fl-dlg').hidden = true; });
}
window.ftoFleet = { start: start, persist: persist, reset: function () { FDC = null; index(); }, zoneList: zoneList, show: show, info: info, match: match, zoneOf: zoneOf, data: data, rowStats: rowStats, vehInScope: vehInScope, get vehicles() { return VEH; }, get zones() { return ZMAP; }, set: function (k, v) { ui[k] = v; render(); } };
})();
