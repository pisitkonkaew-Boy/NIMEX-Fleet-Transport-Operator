/* NIMEX Fleet Transport Operator — loads rows from the Google Sheet (Apps Script), then starts the dashboard.
   Viewer: read only. Admin (#admin + key checked by Apps Script): upload / export. */
(function () {
  var KEY = 'nimex-admin-key';
  var NUM = ['revenue','adj_revenue','total_revenue','daily_expense','bal_after_daily','period_expense','bal_after_period',
    'adj_expense','bal_after_adj','rental','bal_after_rental','tax','carry_over','net_balance','row_num','dc_code'];
  var COLS = ['dc_name','plate','revenue','adj_revenue','total_revenue','daily_expense','bal_after_daily','period_expense',
    'bal_after_period','adj_expense','bal_after_adj','rental','bal_after_rental','tax','carry_over','net_balance',
    'row_num','dc_code','vehicle_type','owner','status','profit_loss'];
  function $(id) { return document.getElementById(id); }
  function ss(v) { try { if (v === undefined) return sessionStorage.getItem(KEY); if (v === null) sessionStorage.removeItem(KEY); else sessionStorage.setItem(KEY, v); } catch (e) { return null; } }
  var wantAdmin = /(^|#)admin\b/.test(location.hash);
  window.FTO_ADMIN = false;

  /* ---------- cover (every time, also #admin) ---------- */
  function cover() {
    var c = $('cover'); if (!c) return;
    document.body.style.overflow = 'hidden';
    function close() { c.hidden = true; document.body.style.overflow = ''; }
    c.querySelector('button').onclick = close; c.querySelector('.fg').onclick = close;
    document.addEventListener('keydown', function k(e) { if (e.key === 'Enter' || e.key === 'Escape') { if (!$('boot') || $('boot').hidden) { close(); document.removeEventListener('keydown', k); } } });
  }

  function msg(html) { var b = $('boot'); b.innerHTML = '<div class="boot-box">' + html + '</div>'; b.hidden = false; }
  function api(body) {
    return fetch(window.FTO_API, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(Object.assign({ key: ss() }, body)) })
      .then(function (r) { return r.json(); }).then(function (j) { if (!j.ok) throw new Error(j.error || 'failed'); return j; });
  }
  function toRows(objs) { return objs.map(function (o) { return COLS.map(function (c) { var v = o[c]; return v === undefined || v === null ? '' : v; }); }); }
  function fromRows(cols, rows) {
    return rows.map(function (r) { var o = {}; cols.forEach(function (c, i) { var v = r[i]; o[c] = NUM.indexOf(c) >= 0 ? (v === '' || v === null ? (c === 'dc_code' ? '' : 0) : +v) : String(v === null ? '' : v); }); return o; });
  }
  /* replace the whole Rows tab with this list (chunks of 1,500) */
  window.ftoApi = api; /* ใช้โดย fleetdb.js / period.js */
  window.ftoStatus = function (t, bad) { status(t, bad); };
  function status(t, bad) { var s = $('nx-status'); if (s) { s.textContent = t; s.classList.toggle('bad', !!bad); } }

  function start() {
    cover();
    if (!window.FTO_API) { msg('<h2>ยังไม่ได้ตั้งค่า</h2><p>ยังไม่ได้ใส่ที่อยู่ระบบข้อมูล (Apps Script) ใน config.js</p>'); return; }
    var key = ss();
    if (wantAdmin && !key) { askKey(); return; }
    var authP = key ? api({ a: 'auth' }).then(function () { window.FTO_ADMIN = true; }).catch(function () { ss(null); if (wantAdmin) throw new Error('relogin'); }) : Promise.resolve();
    var dataP = fetch(window.FTO_API + '?v=' + (window.FTO_V || 1)).then(function (r) { return r.json(); });
    Promise.all([authP, dataP]).then(function (x) {
      var D = x[1];
      if (window.FTO_ADMIN) document.documentElement.classList.add('nx-admin');
      window.FTO_SERVER_V = D.v || 1;
      window.FTO_FLEET = D.fleet || {};
      window.FTO_DATA = D;   /* v3: periods / cfg / man — อ่านโดย period.js */
      if (D.updated) status('อัปเดตล่าสุด ' + new Date(D.updated).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' }));
      if ((D.v || 1) < 3) {
        if (!window.FTO_ADMIN) { msg('<h2>กำลังปรับปรุงระบบ</h2><p>ผู้ดูแลกำลังอัปเดตระบบข้อมูล ลองเปิดใหม่ภายหลัง</p>'); return; }
        msg('<h2>ต้องอัปเดต Apps Script</h2><p>หน้าเว็บรุ่นใหม่ต้องใช้ Code.gs รุ่น v3<br>วางโค้ดใหม่ใน Apps Script แล้ว Deploy → Manage deployments → Edit → New version</p>'); return;
      }
      $('boot').hidden = true;
      if (window.ftoFleet) window.ftoFleet.start();
      window.ftoPeriod.start();
    }).catch(function (e) {
      if (e && e.message === 'relogin') { askKey('รหัสไม่ถูกต้อง'); return; }
      msg('<h2>โหลดข้อมูลไม่สำเร็จ</h2><p>ลองเปิดหน้านี้ใหม่อีกครั้ง</p>');
    });
  }
  if (document.readyState === 'complete') start(); else window.addEventListener('load', start);
})();
