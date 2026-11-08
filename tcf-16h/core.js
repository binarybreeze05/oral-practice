/* Shell: helpers, tabs, the 16-hour schedule (writing + speaking) with a live "now" block. Data: window.PLAN, window.SHEETS. */
(function () {
  'use strict';
  var NS = 'tcf16::';
  var U = window.CRAM = {
    $: function (s, r) { return (r || document).querySelector(s); },
    el: function (tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; },
    esc: function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); },
    mmss: function (s) { s = Math.max(0, s); var m = Math.floor(s / 60), x = s % 60; return (m < 10 ? '0' : '') + m + ':' + (x < 10 ? '0' : '') + x; },
    store: {
      get: function (k, d) { try { var v = localStorage.getItem(NS + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
      set: function (k, v) { try { localStorage.setItem(NS + k, JSON.stringify(v)); } catch (e) { } }
    },
    copy: function (text, btn) {
      var done = function () { if (btn) { var t = btn.textContent; btn.textContent = 'Copied. Paste it to Claude.'; setTimeout(function () { btn.textContent = t; }, 2500); } };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, fallback); else fallback();
      function fallback() { var ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); } catch (e) { } ta.remove(); done(); }
    }
  };
  var $ = U.$, el = U.el, store = U.store;

  /* ---------- routing ---------- */
  var VIEWS = {
    plan: function (r) { renderPlan(r); },
    t1: function (r, o) { window.SPEAKING.t1(r, o); },
    t2: function (r, o) { window.SPEAKING.t2(r, o); },
    t3: function (r, o) { window.SPEAKING.t3(r, o); },
    spad: function (r, o) { window.SPEAKING.pad(r, o); },
    smock: function (r) { window.SPEAKING.mock(r); },
    pad: function (r, o) { window.WRITING.pad(r, o); },
    wmock: function (r) { window.WRITING.mock(r); },
    models: function (r, o) { window.WRITING.models(r, o); },
    chunks: function (r, o) { window.WRITING.chunks(r, o); },
    cut: function (r, o) { window.WRITING.cut(r, o); },
    rules: function (r) { var s = el('div', 'sheet'); s.innerHTML = window.SHEETS.rules; r.appendChild(s); window.WRITING.errlog(r); },
    templates: function (r) { sheetWithScratch(r, 'templates', 'Type the slot list from memory here, then compare with the sheet above.'); },
    card: function (r) { sheetWithScratch(r, 'card', 'Type the writing T1, T2, T3 skeletons and the T3 summary frame from memory here.'); }
  };
  function sheetWithScratch(r, name, label) {
    var s = el('div', 'sheet'); s.innerHTML = window.SHEETS[name]; r.appendChild(s);
    var w = el('div', 'qcard'); w.appendChild(el('div', 'wlabel', label));
    var ta = el('textarea', 'pad'); ta.value = store.get('scratch.' + name, ''); ta.oninput = function () { store.set('scratch.' + name, ta.value); };
    var clr = el('button', 'mini', 'Clear'); clr.onclick = function () { ta.value = ''; store.set('scratch.' + name, ''); };
    w.appendChild(ta); w.appendChild(clr); r.appendChild(w);
  }
  function go(view, opts) {
    var main = $('#main');
    document.querySelectorAll('nav a').forEach(function (a) { a.classList.toggle('on', a.dataset.v === view); });
    store.set('view', view);
    main.innerHTML = '';
    if (!VIEWS[view] && !window.SHEETS[view]) view = 'plan';
    document.querySelectorAll('nav a').forEach(function (a) { a.classList.toggle('on', a.dataset.v === view); });
    store.set('view', view);
    if (VIEWS[view]) VIEWS[view](main, opts);
    else if (window.SHEETS[view]) { var s = el('div', 'sheet'); s.innerHTML = window.SHEETS[view]; main.appendChild(s); }
    window.scrollTo(0, 0);
  }
  U.go = go;

  /* ---------- plan ---------- */
  function planState() { return store.get('plan', { done: {}, start: null, active: null, t0: null }); }
  function savePlan(s) { store.set('plan', s); }
  function totals() {
    var P = window.PLAN, m = 0, by = { EO: 0, EE: 0, both: 0 };
    P.blocks.forEach(function (b) { m += b.min; by[b.skill] = (by[b.skill] || 0) + b.min; });
    return { min: m, by: by };
  }
  var tick = null;
  function renderPlan(root) {
    var P = window.PLAN, S = planState(), T = totals();
    root.innerHTML = '';
    var head = el('div', 'planhead');
    var doneMin = P.blocks.reduce(function (a, b) { return a + (S.done[b.id] ? b.min : 0); }, 0);
    head.innerHTML = '<div class="big">' + Math.floor(doneMin / 60) + ' h ' + (doneMin % 60) + ' min of ' + (T.min / 60).toFixed(1) + ' h done</div>' +
      '<div class="note">' + P.blocks.length + ' blocks · writing ' + (T.by.EE / 60).toFixed(1) + ' h · speaking ' + (T.by.EO / 60).toFixed(1) + ' h' + (T.by.both ? ' · mixed ' + (T.by.both / 60).toFixed(1) + ' h' : '') + ' · focused minutes only, breaks are extra</div>';
    var undone = P.blocks.filter(function (b) { return !S.done[b.id]; });
    if (undone.length) {
      var rem = undone.reduce(function (a, b) { return a + b.min; }, 0) + (undone.length - 1) * (P.breakMin || 5);
      (P.meals || []).forEach(function (m) { if (!S.done[m.after]) rem += m.min; });
      if (S.active && S.t0 && !S.done[S.active]) rem -= Math.min(Math.floor((Date.now() - S.t0) / 60000), (P.blocks.filter(function (b) { return b.id === S.active; })[0] || { min: 0 }).min);
      var fin = new Date(Date.now() + rem * 60000);
      var hh = fin.getHours(), mm = fin.getMinutes();
      head.appendChild(el('div', 'note', 'At this pace you finish at ' + (hh < 10 ? '0' : '') + hh + ':' + (mm < 10 ? '0' : '') + mm + (fin.getDate() !== new Date().getDate() ? ' tomorrow' : '') + ' (' + (P.breakMin || 5) + '-min breaks between blocks, plus meals).'));
    }
    var bar = el('div', 'progress'); var fill = el('div', 'fill'); fill.style.width = (100 * doneMin / T.min) + '%'; bar.appendChild(fill); head.appendChild(bar);
    root.appendChild(head);
    if (P.intro) { var i = el('div', 'intro'); i.innerHTML = P.intro; root.appendChild(i); }
    var next = P.blocks.filter(function (b) { return !S.done[b.id]; })[0];
    if (next) root.appendChild(nowCard(next, S, root));
    else root.appendChild(el('div', 'nowcard', 'All blocks done. Read the exam-morning card, then sleep.'));
    var phase = null;
    var mealAfter = {}; (P.meals || []).forEach(function (m) { mealAfter[m.after] = m; });
    P.blocks.forEach(function (b, k) {
      if (b.phase && b.phase !== phase) { phase = b.phase; root.appendChild(el('h3', 'phase', phase)); }
      var row = el('div', 'block' + (S.done[b.id] ? ' done' : '') + (next && b.id === next.id ? ' cur' : ''));
      var cb = el('input'); cb.type = 'checkbox'; cb.checked = !!S.done[b.id];
      cb.onchange = function () { var s = planState(); if (cb.checked) s.done[b.id] = Date.now(); else delete s.done[b.id]; if (s.active === b.id) { s.active = null; s.t0 = null; } savePlan(s); renderPlan(root); };
      row.appendChild(cb);
      var body = el('div', 'bbody');
      body.innerHTML = '<div class="btitle"><span class="bn">' + (k + 1) + '</span> ' + U.esc(b.title) + ' <span class="bmin">' + b.min + ' min · ' + ({ EE: 'writing', EO: 'speaking', both: 'both' }[b.skill] || b.skill) + '</span></div>' +
        '<div class="bdo">' + b.do + '</div>' + (b.out ? '<div class="bout">Output: ' + b.out + '</div>' : '');
      if (b.go) { var g = el('button', 'mini', 'Open ' + (b.goLabel || 'material') + ' ›'); g.onclick = function () { go(b.go[0], b.go[1]); }; body.appendChild(g); }
      row.appendChild(body);
      root.appendChild(row);
      if (mealAfter[b.id]) root.appendChild(el('div', 'note', '· ' + mealAfter[b.id].label + ', ' + mealAfter[b.id].min + ' min (not counted) ·'));
    });
    if (P.outro) { var o = el('div', 'intro'); o.innerHTML = P.outro; root.appendChild(o); }
  }
  function nowCard(b, S, root) {
    var c = el('div', 'nowcard');
    c.innerHTML = '<div class="nowlbl">NOW</div><div class="btitle">' + U.esc(b.title) + ' <span class="bmin">' + b.min + ' min</span></div><div class="bdo">' + b.do + '</div>';
    var clock = el('div', 'clock big', U.mmss(b.min * 60));
    c.appendChild(clock);
    var acts = el('div', 'acts');
    var st = el('button', 'btn primary', S.active === b.id ? 'Running…' : 'Start block timer');
    st.onclick = function () { var s = planState(); s.active = b.id; s.t0 = Date.now(); savePlan(s); renderPlan(root); };
    var dn = el('button', 'btn', 'Done, next block');
    dn.onclick = function () { var s = planState(); s.done[b.id] = Date.now(); s.active = null; s.t0 = null; savePlan(s); renderPlan(root); };
    acts.appendChild(st);
    if (b.go) { var g = el('button', 'btn', 'Open ' + (b.goLabel || 'material') + ' ›'); g.onclick = function () { go(b.go[0], b.go[1]); }; acts.appendChild(g); }
    acts.appendChild(dn);
    c.appendChild(acts);
    clearInterval(tick);
    if (S.active === b.id && S.t0) {
      var upd = function () {
        if (!document.body.contains(clock)) return clearInterval(tick);
        var left = b.min * 60 - Math.floor((Date.now() - S.t0) / 1000);
        clock.textContent = left > 0 ? U.mmss(left) + ' left in this block' : 'Block time is up. Tick it and take your break.';
        clock.className = 'clock big' + (left < 120 ? ' hot' : '');
      };
      upd(); tick = setInterval(upd, 1000);
    }
    return c;
  }

  document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('nav a').forEach(function (a) { a.onclick = function (e) { e.preventDefault(); go(a.dataset.v); }; });
    var t = document.documentElement;
    var tb = $('#theme'); if (tb) tb.onclick = function () { var d = t.getAttribute('data-theme') === 'dark' || (!t.getAttribute('data-theme') && matchMedia('(prefers-color-scheme: dark)').matches); t.setAttribute('data-theme', d ? 'light' : 'dark'); store.set('theme', d ? 'light' : 'dark'); };
    var th = store.get('theme', null); if (th) t.setAttribute('data-theme', th);
    go(store.get('view', 'plan'));
  });
})();
