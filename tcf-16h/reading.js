/* Reading: timed mock papers (39 questions, 60 min) and level drills from the bank in rd.js (window.RD). */
(function () {
  'use strict';
  var RD = window.RD, C = RD.cards, IMG = 'https://binarybreeze05.github.io/tcf-cram-drill/img/';
  var W = { A1: 3, A2: 9, B1: 15, B2: 21, C1: 26, C2: 33 };
  var POS_W = function (n) { return n <= 4 ? 3 : n <= 10 ? 9 : n <= 19 ? 15 : n <= 29 ? 21 : n <= 35 ? 26 : 33; };
  var NCLC = [[549, '10'], [524, '9'], [499, '8'], [453, '7'], [406, '6'], [375, '5'], [342, '4'], [0, '<4']];
  var CHECK = [[4, 2], [10, 7], [19, 18], [29, 35], [35, 48], [39, 58]];
  var U = window.CRAM, $ = U.$, el = U.el, store = U.store;

  function nclc(s) { for (var i = 0; i < NCLC.length; i++) if (s >= NCLC[i][0]) return NCLC[i][1]; return '<4'; }
  function imgOf(c) { return c.img.length ? IMG + c.img[0] : null; }

  function docBlock(c) {
    var box = el('div', 'doc');
    var src = imgOf(c);
    if (src) {
      var im = el('img'); im.src = src; im.alt = 'Document'; im.loading = 'lazy';
      im.onerror = function () { im.remove(); txt.hidden = false; };
      box.appendChild(im);
    }
    var txt = el('div', 'doctext'); txt.textContent = c.tx.join('\n');
    if (src) {
      txt.hidden = true;
      var t = el('button', 'mini', 'Show text');
      t.onclick = function () { txt.hidden = !txt.hidden; t.textContent = txt.hidden ? 'Show text' : 'Hide text'; };
      box.appendChild(t);
    }
    box.appendChild(txt);
    return box;
  }

  /* ---------------- mock papers ---------------- */
  var REC = ['test30', 'test28', 'test09', 'test13', 'test10'];
  var PAPERS = REC.map(function (t) { return RD.papers.filter(function (p) { return p.test === t; })[0]; })
    .concat(RD.papers.filter(function (p) { return REC.indexOf(p.test) < 0; }));
  var INMOCK = {}; PAPERS.slice(0, 3).forEach(function (p) { p.items.forEach(function (i) { INMOCK[i] = 1; }); });
  var mock = null, tick = null;
  function results() { return store.get('mock.results', {}); }

  function renderMockList(root) {
    root.innerHTML = '';
    var res = results();
    var intro = el('p', 'note');
    intro.innerHTML = 'A full paper: 39 questions in exam order (A1 → C2), 60-minute clock. Pace checkpoints: Q4 by 2 min, Q10 by 7, Q19 by 18, Q29 by 35, Q35 by 48, Q39 by 58. Never leave a blank: there is no penalty. Score uses the widely shared (unofficial) weights 3/9/15/21/26/33.';
    root.appendChild(intro);
    var grid = el('div', 'papers');
    PAPERS.forEach(function (p, i) {
      var r = res[p.test];
      var b = el('button', 'paper' + (r ? ' done' : ''));
      b.title = r ? 'Open the review' : 'Start this paper';
      b.innerHTML = '<b>' + (i < 3 ? 'Mock ' + (i + 1) + ' · ' : i < 5 ? 'Spare · ' : '') + p.test.replace('test', 'Test ') + '</b>' + (r ? '<span>' + r.score + ' · NCLC ' + nclc(r.score) + '</span>' : '<span>not done</span>');
      b.onclick = function () {
        if (r && r.ans) { review(root, { items: p.items, ans: r.ans, test: p.test }, score({ items: p.items, ans: r.ans })); return; }
        startMock(p, root);
      };
      grid.appendChild(b);
    });
    root.appendChild(grid);
  }

  function startMock(p, root) {
    var saved = store.get('mock.live', null);
    if (saved && saved.test === p.test && !saved.done) mock = saved;
    else mock = { test: p.test, items: p.items, ans: {}, flag: {}, i: 0, start: Date.now(), done: false };
    store.set('mock.live', mock);
    drawMock(root);
    clearInterval(tick);
    tick = setInterval(function () { clock(root); }, 1000);
  }

  function left() { return 3600 - Math.floor((Date.now() - mock.start) / 1000); }
  function clock(root) {
    if (!mock || mock.done) { clearInterval(tick); return; }
    var s = left(), c = $('#mclock', root);
    if (s <= 0) { finishMock(root); return; }
    if (c) {
      var used = 60 - Math.ceil(s / 60), n = Object.keys(mock.ans).length, target = 0;
      CHECK.forEach(function (k) { if (used >= k[1]) target = k[0]; });
      c.textContent = U.mmss(s) + ' left · answered ' + n + '/39' + (target && n < target ? ' · behind pace (aim Q' + target + ')' : '');
      c.className = 'clock' + (s < 300 ? ' hot' : '') + (target && n < target ? ' behind' : '');
    }
  }

  function drawMock(root) {
    root.innerHTML = '';
    var id = mock.items[mock.i], c = C[id], n = mock.i + 1;
    var bar = el('div', 'mbar');
    bar.appendChild(el('div', 'clock', '')).id = 'mclock';
    var nav = el('div', 'qgrid');
    mock.items.forEach(function (x, k) {
      var b = el('button', 'q' + (mock.ans[k] ? ' a' : '') + (mock.flag[k] ? ' f' : '') + (k === mock.i ? ' cur' : ''), String(k + 1));
      b.onclick = function () { mock.i = k; store.set('mock.live', mock); drawMock(root); };
      nav.appendChild(b);
    });
    bar.appendChild(nav);
    root.appendChild(bar);
    var card = el('div', 'qcard');
    card.appendChild(el('div', 'qmeta', 'Question ' + n + ' / 39 · ' + c.lv + ' · ' + POS_W(n) + ' pts'));
    card.appendChild(docBlock(c));
    card.appendChild(el('div', 'qtext', c.q));
    var opts = el('div', 'opts');
    c.o.forEach(function (o) {
      var b = el('button', 'opt' + (mock.ans[mock.i] === o[0] ? ' pick' : ''));
      b.innerHTML = '<b>' + o[0] + '</b> ' + U.esc(o[1]);
      b.onclick = function () { mock.ans[mock.i] = o[0]; store.set('mock.live', mock); if (mock.i < 38) mock.i++; drawMock(root); };
      opts.appendChild(b);
    });
    card.appendChild(opts);
    var act = el('div', 'acts');
    var pv = el('button', 'btn', '‹ Prev'); pv.onclick = function () { if (mock.i > 0) { mock.i--; drawMock(root); } };
    var fl = el('button', 'btn' + (mock.flag[mock.i] ? ' on' : ''), mock.flag[mock.i] ? 'Flagged' : 'Flag');
    fl.onclick = function () { mock.flag[mock.i] = !mock.flag[mock.i]; store.set('mock.live', mock); drawMock(root); };
    var nx = el('button', 'btn', 'Next ›'); nx.onclick = function () { if (mock.i < 38) { mock.i++; drawMock(root); } };
    var fin = el('button', 'btn primary', 'Finish paper');
    fin.onclick = function () {
      var miss = 39 - Object.keys(mock.ans).length;
      if (miss && !confirm(miss + ' blank. Blanks score zero and guesses cost nothing. Finish anyway?')) return;
      finishMock(root);
    };
    [pv, fl, nx, fin].forEach(function (b) { act.appendChild(b); });
    card.appendChild(act);
    root.appendChild(card);
    clock(root);
  }

  function score(m) {
    var s = 0, raw = 0, by = {};
    m.items.forEach(function (id, k) {
      var c = C[id], ok = c.o.some(function (o) { return o[3] && o[0] === m.ans[k]; });
      var lv = c.lv; by[lv] = by[lv] || [0, 0]; by[lv][1]++;
      if (ok) { s += POS_W(k + 1); raw++; by[lv][0]++; }
    });
    return { score: s, raw: raw, by: by };
  }

  function finishMock(root) {
    clearInterval(tick);
    mock.done = true; mock.end = Date.now();
    var r = score(mock), res = results();
    res[mock.test] = { score: r.score, raw: r.raw, by: r.by, min: Math.round((mock.end - mock.start) / 60000), at: new Date().toISOString(), ans: mock.ans };
    store.set('mock.results', res);
    var misses = store.get('drill.miss', {});
    mock.items.forEach(function (id, k) { var c = C[id]; if (!c.o.some(function (o) { return o[3] && o[0] === mock.ans[k]; })) misses[id] = 1; });
    store.set('drill.miss', misses);
    store.set('mock.live', mock);
    review(root, mock, r);
  }

  function review(root, m, r) {
    root.innerHTML = '';
    var h = el('div', 'result');
    h.innerHTML = '<div class="big">' + r.score + ' / 699 · NCLC ' + nclc(r.score) + '</div><div>' + r.raw + '/39 right · ' +
      ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].map(function (l) { return r.by[l] ? l + ' ' + r.by[l][0] + '/' + r.by[l][1] : ''; }).filter(Boolean).join(' · ') +
      '</div><div class="note">NCLC 7 needs 453. Misses went into Drill → "My misses". Review every miss below: say in English why the right answer is right before you move on.</div>';
    var back = el('button', 'btn', '‹ All papers'); back.onclick = function () { mock = null; renderMockList(root); };
    var again = el('button', 'mini', 'Retake this paper (clears this result)');
    again.onclick = function () { if (!confirm('Retake ' + m.test + '? Your saved answers for it will be replaced.')) return; var res = results(); delete res[m.test]; store.set('mock.results', res); store.set('mock.live', null); mock = null; renderMockList(root); };
    h.appendChild(back); h.appendChild(again);
    h.appendChild(el('div', 'note', 'This review stays here: Reading mocks → click the paper again to reopen it.'));
    root.appendChild(h);
    m.items.forEach(function (id, k) {
      var c = C[id], mine = m.ans[k], right = c.o.filter(function (o) { return o[3]; })[0];
      var ok = right && mine === right[0];
      var d = el('details', 'rev' + (ok ? ' ok' : ' bad'));
      if (!ok) d.open = true;
      var s = el('summary', '', (k + 1) + '. ' + c.lv + ' · ' + (ok ? 'right' : 'you ' + (mine || 'blank') + ', answer ' + (right ? right[0] : '?')) + ' · ' + c.q);
      d.appendChild(s);
      d.appendChild(explain(c, mine));
      root.appendChild(d);
    });
  }

  function explain(c, mine) {
    var w = el('div', 'explain');
    w.appendChild(docBlock(c));
    w.appendChild(el('div', 'qtext', c.q + (c.qe ? '  —  ' + c.qe : '')));
    c.o.forEach(function (o) {
      var row = el('div', 'xo' + (o[3] ? ' right' : '') + (mine === o[0] && !o[3] ? ' wrong' : ''));
      row.innerHTML = '<b>' + o[0] + '</b> ' + U.esc(o[1]) + (o[2] ? '<i> · ' + U.esc(o[2]) + '</i>' : '') + (o[4] ? '<div class="why">' + U.esc(o[4]) + '</div>' : '');
      w.appendChild(row);
    });
    if (c.why) w.appendChild(el('div', 'why', c.why));
    return w;
  }

  /* ---------------- drills ---------------- */
  var D = { lv: 'B2', seen2: true, misses: false, queue: [], i: 0, picked: null, t0: 0 };
  var TARGET = { A1: 30, A2: 45, B1: 75, B2: 100, C1: 135, C2: 150 };
  function stats() { return store.get('drill.stats', {}); }
  function buildQueue() {
    var miss = store.get('drill.miss', {}), done = store.get('drill.done', {});
    var all = Object.keys(C).map(function (k) { return C[k]; });
    var q = all.filter(function (c) {
      if (D.misses) return miss[c.id];
      return c.lv === D.lv && (!D.seen2 || c.seen >= 2) && !INMOCK[c.id];
    });
    var ORD = { B2: 0, C1: 1, C2: 2, B1: 3, A2: 4, A1: 5 };
    if (D.misses) q.sort(function (a, b) { return ORD[a.lv] - ORD[b.lv] || b.seen - a.seen; });
    else q.sort(function (a, b) { return (done[a.id] ? 1 : 0) - (done[b.id] ? 1 : 0) || b.seen - a.seen || (a.id < b.id ? -1 : 1); });
    D.queue = q.map(function (c) { return c.id; }); D.i = 0; D.picked = null;
  }

  function renderDrill(root, opts) {
    if (opts) { for (var k in opts) D[k] = opts[k]; buildQueue(); }
    if (!D.queue.length && !D.misses) buildQueue();
    root.innerHTML = '';
    var f = el('div', 'filters');
    ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].forEach(function (l) {
      var b = el('button', 'chip' + (!D.misses && D.lv === l ? ' on' : ''), l);
      b.onclick = function () { renderDrill(root, { lv: l, misses: false }); };
      f.appendChild(b);
    });
    var s2 = el('button', 'chip' + (D.seen2 ? ' on' : ''), 'Repeats only (in 2+ tests)');
    s2.onclick = function () { renderDrill(root, { seen2: !D.seen2, misses: false }); };
    f.appendChild(s2);
    var nm = Object.keys(store.get('drill.miss', {})).length;
    var mb = el('button', 'chip' + (D.misses ? ' on' : ''), 'My misses (' + nm + ')');
    mb.onclick = function () { renderDrill(root, { misses: true }); };
    f.appendChild(mb);
    root.appendChild(f);
    var st = stats(), line = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].map(function (l) {
      var x = st[l]; return x ? l + ' ' + x[0] + '/' + x[1] + ' (' + Math.round(100 * x[0] / x[1]) + '%)' : null;
    }).filter(Boolean).join(' · ');
    root.appendChild(el('div', 'note', (line || 'No drill answers yet.') + ' · today ' + (store.get('drill.today', 0)) + ' answered'));
    if (!D.queue.length) { root.appendChild(el('p', 'note', 'Nothing in this set.')); return; }
    if (D.i >= D.queue.length) { root.appendChild(el('p', 'note', 'Set finished. Pick another level or run My misses.')); return; }
    var c = C[D.queue[D.i]];
    var card = el('div', 'qcard');
    card.appendChild(el('div', 'qmeta', (D.i + 1) + ' / ' + D.queue.length + ' · ' + c.lv + ' · in ' + c.seen + ' test' + (c.seen > 1 ? 's' : '') + ' · aim ' + TARGET[c.lv] + ' s'));
    var timer = el('div', 'dtimer', '0 s'); card.appendChild(timer);
    card.appendChild(docBlock(c));
    card.appendChild(el('div', 'qtext', c.q));
    var box = el('div', 'opts');
    D.t0 = Date.now();
    var iv = setInterval(function () { if (!document.body.contains(timer)) return clearInterval(iv); var s = Math.round((Date.now() - D.t0) / 1000); timer.textContent = s + ' s'; timer.className = 'dtimer' + (s > TARGET[c.lv] ? ' hot' : ''); }, 500);
    c.o.forEach(function (o) {
      var b = el('button', 'opt');
      b.innerHTML = '<b>' + o[0] + '</b> ' + U.esc(o[1]);
      b.onclick = function () {
        if (D.picked) return;
        clearInterval(iv);
        D.picked = o[0];
        var ok = !!o[3], st = stats(); st[c.lv] = st[c.lv] || [0, 0]; st[c.lv][1]++; if (ok) st[c.lv][0]++; store.set('drill.stats', st);
        store.set('drill.today', store.get('drill.today', 0) + 1);
        var done = store.get('drill.done', {}); done[c.id] = 1; store.set('drill.done', done);
        var miss = store.get('drill.miss', {}); if (ok) delete miss[c.id]; else miss[c.id] = 1; store.set('drill.miss', miss);
        card.appendChild(el('div', 'verdict ' + (ok ? 'ok' : 'bad'), ok ? 'Right' : 'Wrong'));
        card.appendChild(explain(c, o[0]));
        var nx = el('button', 'btn primary', 'Next ›');
        nx.onclick = function () { D.i++; D.picked = null; renderDrill(root); window.scrollTo(0, root.offsetTop - 60); };
        card.appendChild(nx);
        nx.focus();
      };
      box.appendChild(b);
    });
    card.appendChild(box);
    var skip = el('button', 'mini', 'Skip (broken card)');
    skip.onclick = function () { D.i++; renderDrill(root); };
    card.appendChild(skip);
    root.appendChild(card);
  }

  window.READING = {
    mocks: function (root) {
      var live = store.get('mock.live', null);
      if (live && !live.done) { mock = live; drawMock(root); clearInterval(tick); tick = setInterval(function () { clock(root); }, 1000); }
      else renderMockList(root);
    },
    drill: function (root, opts) { renderDrill(root, opts); },
    nclc: nclc
  };
})();
