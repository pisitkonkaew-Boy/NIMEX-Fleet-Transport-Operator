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
  function pushAll(objs, note, onStep) {
    var rows = toRows(objs), i = 0;
    return api({ a: 'begin' }).then(function next() {
      if (i >= rows.length) return api({ a: 'finish', note: note });
      var part = rows.slice(i, i + 1500); i += part.length;
      if (onStep) onStep(i, rows.length);
      return api({ a: 'append', rows: part }).then(next);
    });
  }
  window.ftoPushAll = pushAll;

  function askKey(err) {
    msg('<h2>ผู้ดูแลระบบ</h2>' + (err ? '<p class="bad">' + err + '</p>' : '<p>ใส่รหัสผู้ดูแลเพื่อเข้าโหมดจัดการข้อมูล</p>') +
      '<input id="adm-key" type="password" autocomplete="current-password" aria-label="รหัสผู้ดูแล"><div class="row"><a class="btn2" href="./">ดูแบบผู้ชม</a><button class="btn1" id="adm-go">เข้าสู่ระบบ</button></div>');
    var go = function () {
      var v = $('adm-key').value; if (!v) return; ss(v);
      api({ a: 'auth' }).then(function () { location.reload(); }).catch(function (e) { ss(null); askKey(e.message === 'admin_key_not_set' ? 'ยังไม่ได้ตั้ง ADMIN_KEY ใน Apps Script' : 'รหัสไม่ถูกต้อง'); });
    };
    $('adm-go').onclick = go; $('adm-key').onkeydown = function (e) { if (e.key === 'Enter') go(); }; $('adm-key').focus();
  }

  function firstRun() {
    msg('<h2>ตั้งค่าครั้งแรก</h2><p>ยังไม่มีข้อมูลใน Google Sheet เลือกไฟล์ <b>fto-seed.json</b> เพื่อนำเข้าข้อมูลเริ่มต้น</p><input type="file" id="seed-f" accept=".json" aria-label="ไฟล์ข้อมูลเริ่มต้น"><p class="note" id="seed-m"></p>');
    $('seed-f').onchange = function (e) {
      var m = $('seed-m'); m.textContent = 'กำลังอ่านไฟล์…';
      e.target.files[0].text().then(function (t) {
        var d = JSON.parse(t), objs = fromRows(d.cols, d.rows);
        m.textContent = 'พบ ' + objs.length.toLocaleString() + ' รายการ กำลังบันทึก…';
        return pushAll(objs, 'seed', function (n, all) { m.textContent = 'กำลังบันทึก ' + n.toLocaleString() + ' / ' + all.toLocaleString(); });
      }).then(function (r) { m.textContent = 'นำเข้าแล้ว ' + r.total.toLocaleString() + ' รายการ'; setTimeout(function () { location.reload(); }, 700); })
        .catch(function (x) { m.textContent = 'นำเข้าไม่สำเร็จ: ' + x.message; });
    };
  }

  /* after an admin upload, mergeData() has updated DB in this page → confirm, then save the full list to the Sheet */
  function hookUpload() {
    if (typeof window.mergeData !== 'function') return;
    var orig = window.mergeData;
    window.mergeData = mergeData = function (newRows) {
      var before = DB.length, res = orig(newRows);
      var ok = window.confirm('ตรวจก่อนบันทึก\n\nไฟล์นี้มี ' + newRows.length.toLocaleString() + ' รายการ\n• เพิ่มใหม่ ' + res.added.toLocaleString() + '\n• แทนที่ของเดิม (ทะเบียน + DC ซ้ำ) ' + res.updated.toLocaleString() +
        '\nรวมหลังบันทึก ' + DB.length.toLocaleString() + ' รายการ (เดิม ' + before.toLocaleString() + ')\n\nบันทึกลง Google Sheet ให้ผู้ชมทุกคนเห็นหรือไม่?');
      if (!ok) { setTimeout(function () { location.reload(); }, 50); return res; }
      status('กำลังบันทึกลง Google Sheet…');
      pushAll(DB, 'upload +' + res.added + ' ~' + res.updated, function (n, all) { status('กำลังบันทึก ' + n.toLocaleString() + ' / ' + all.toLocaleString()); })
        .then(function (r) { status('บันทึกแล้ว ' + r.total.toLocaleString() + ' รายการ · ผู้ชมเห็นข้อมูลใหม่แล้ว'); })
        .catch(function (e) { status('บันทึกไม่สำเร็จ: ' + e.message, true); });
      return res;
    };
  }
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
      if (!D.rows || !D.rows.length) { if (window.FTO_ADMIN) firstRun(); else msg('<h2>ยังไม่มีข้อมูล</h2><p>ผู้ดูแลยังไม่ได้นำเข้าข้อมูล</p>'); return; }
      window.FTO_ROWS = fromRows(D.cols, D.rows);
      if (D.updated) status('อัปเดตล่าสุด ' + new Date(D.updated).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' }));
      if (window.FTO_ADMIN) hookUpload();
      $('boot').hidden = true;
      window.ftoStart();
    }).catch(function (e) {
      if (e && e.message === 'relogin') { askKey('รหัสไม่ถูกต้อง'); return; }
      msg('<h2>โหลดข้อมูลไม่สำเร็จ</h2><p>ลองเปิดหน้านี้ใหม่อีกครั้ง</p>');
    });
  }
  if (document.readyState === 'complete') start(); else window.addEventListener('load', start);
})();
