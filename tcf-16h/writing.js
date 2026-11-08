/* Writing: timed pad with word counter, full 60-min writing mock, model answers, chunk recall. Data: window.WR. */
(function () {
  'use strict';
  var WR = window.WR, U = window.CRAM, $ = U.$, el = U.el, store = U.store;
  var TASKS = {
    EE_T1: { label: 'Tâche 1', min: 60, max: 120, mins: 10, what: 'message · 60–120 words' },
    EE_T2: { label: 'Tâche 2', min: 120, max: 150, mins: 20, what: 'article / blog / letter · 120–150 words' },
    EE_T3: { label: 'Tâche 3', min: 120, max: 180, mins: 28, what: 'part 1 summary 40–60 + part 2 opinion 80–120 = 120–180 words' }
  };
  var ACC = ['é', 'è', 'ê', 'à', 'â', 'ç', 'ù', 'û', 'î', 'ï', 'ô', 'ë', 'œ', 'É', 'À', '« ', ' »', '’'];
  function wc(t) { var m = (t || '').match(/[A-Za-zÀ-ÿœŒ0-9]+(?:[’'-][A-Za-zÀ-ÿœŒ0-9]+)*/g); return m ? m.length : 0; }
  function prompts(t) { return WR.prompts[t]; }
  function famLabel(p) { return p.ff ? 'listed ' + p.ff + '×' : 'rarely listed'; }

  function splitDocs(fr) {
    var m = fr.split(/(?=Document\s*[12AB]\b)/);
    return m;
  }
  function promptBlock(t, p, lang) {
    var b = el('div', 'prompt');
    var parts = t === 'EE_T3' ? splitDocs(lang === 'en' ? p.en : p.fr) : [lang === 'en' ? p.en : p.fr];
    parts.forEach(function (x) { b.appendChild(el('p', '', x.trim())); });
    return b;
  }

  /* --------- one writing box with counter + accent bar --------- */
  function box(key, min, max, label) {
    var w = el('div', 'wbox');
    if (label) w.appendChild(el('div', 'wlabel', label));
    var bar = el('div', 'accents');
    var ta = el('textarea', 'pad');
    ta.spellcheck = false; ta.setAttribute('autocorrect', 'off'); ta.setAttribute('autocapitalize', 'off');
    ta.value = store.get(key, '');
    ACC.forEach(function (a) {
      var b = el('button', 'acc', a.trim());
      b.onmousedown = function (e) { e.preventDefault(); };
      b.onclick = function () { var s = ta.selectionStart, e2 = ta.selectionEnd; ta.value = ta.value.slice(0, s) + a + ta.value.slice(e2); ta.selectionStart = ta.selectionEnd = s + a.length; ta.focus(); upd(); };
      bar.appendChild(b);
    });
    var cnt = el('div', 'count');
    function upd() {
      var n = wc(ta.value); store.set(key, ta.value);
      cnt.textContent = n + ' words · limit ' + min + '–' + max;
      cnt.className = 'count ' + (n < min ? 'under' : n > max ? 'over' : 'in');
    }
    ta.oninput = upd; upd();
    w.appendChild(bar); w.appendChild(ta); w.appendChild(cnt);
    w.text = function () { return ta.value; };
    w.n = function () { return wc(ta.value); };
    return w;
  }

  function gradePrompt(t, p, text) {
    var T = TASKS[t];
    return 'Grade this TCF Canada Expression écrite ' + T.label + ' (' + T.what + ') like a trained FEI examiner.\n' +
      'My target is NCLC 7 (B2, 10–11/20). I am rusty B1, exam tomorrow.\n\n' +
      'PROMPT:\n' + p.fr + '\n\nMY TEXT (' + wc(text) + ' words):\n' + text + '\n\n' +
      'Reply in English, short:\n1. CEFR level you would give this task (A2/B1/B2/C1) and why in 2 lines.\n' +
      '2. Task completion: every point of the prompt covered? register (tu/vous), greeting/closing, word count.\n' +
      '3. The 5 errors that cost the most, each as: my words → corrected French (one-line reason).\n' +
      '4. Two B2 structures I could have used here, written with my own content.\n' +
      '5. My text corrected, keeping my words and ideas wherever they are correct (no upgrades beyond B2).';
  }

  /* --------- single-task timed practice --------- */
  var P = { t: 'EE_T1', idx: 0 };
  function renderPad(root, opts) {
    if (opts) {
      if (opts.t && opts.t !== P.t) { P.list = null; }
      for (var k in opts) P[k] = opts[k];
      if (opts.n != null) { P.idx = Math.max(0, prompts(P.t).map(function (p) { return p.n; }).indexOf(opts.n)); delete P.n; }
      if (opts.list && opts.n == null && !opts.keep) { P.idx = Math.max(0, prompts(P.t).map(function (p) { return p.n; }).indexOf(opts.list[0])); }
    }
    root.innerHTML = '';
    var tabs = el('div', 'filters');
    Object.keys(TASKS).forEach(function (t) {
      var b = el('button', 'chip' + (P.t === t ? ' on' : ''), TASKS[t].label + ' (' + TASKS[t].mins + ' min)');
      b.onclick = function () { P.list = null; renderPad(root, { t: t, idx: 0 }); };
      tabs.appendChild(b);
    });
    root.appendChild(tabs);
    var list = prompts(P.t);
    root.appendChild(el('div', 'note', 'Prompts ranked by how often their family was listed. Write first with the timer, then Copy for grading and paste it to Claude.'));
    var sel = el('select', 'psel');
    list.forEach(function (p, i) {
      var o = el('option', '', (i + 1) + '. [' + famLabel(p) + '] ' + p.en.slice(0, 90));
      o.value = i; if (i === P.idx) o.selected = true; sel.appendChild(o);
    });
    sel.onchange = function () { renderPad(root, { idx: +sel.value }); };
    root.appendChild(sel);
    var p = list[P.idx];
    if (P.list) { var pos = P.list.indexOf(p.n); root.appendChild(el('div', 'nowlbl', pos >= 0 ? 'SPRINT ' + (pos + 1) + ' OF ' + P.list.length + ' · prompt #' + p.n : 'prompt #' + p.n)); }
    var lang = el('button', 'mini', 'English');
    var pb = promptBlock(P.t, p, 'fr');
    lang.onclick = function () { var en = lang.textContent === 'English'; lang.textContent = en ? 'Français' : 'English'; pb.replaceWith(pb = promptBlock(P.t, p, en ? 'en' : 'fr')); };
    root.appendChild(lang); root.appendChild(pb);
    var m = WR.models[P.t + ':' + p.fam];
    if (m) root.appendChild(el('div', 'note', 'Your model for this family: Writing → Models → "' + m.title + '". Write first, look after.'));
    var key = 'pad.' + P.t + '.' + p.n, boxes = [];
    if (P.t === 'EE_T3') {
      boxes.push(box(key + '.a', 40, 60, 'Partie 1 · résumé des deux documents (40–60 mots)'));
      boxes.push(box(key + '.b', 80, 120, 'Partie 2 · votre opinion (80–120 mots)'));
    } else boxes.push(box(key, TASKS[P.t].min, TASKS[P.t].max));
    var tm = timer(TASKS[P.t].mins);
    root.appendChild(tm);
    boxes.forEach(function (b) { root.appendChild(b); });
    var tot = el('div', 'note');
    if (P.t === 'EE_T3') { var up = function () { tot.textContent = 'Total ' + (boxes[0].n() + boxes[1].n()) + ' words (120–180)'; }; root.addEventListener('input', up); up(); root.appendChild(tot); }
    var acts = el('div', 'acts');
    var cp = el('button', 'btn primary', 'Copy for grading');
    cp.onclick = function () {
      var text = boxes.map(function (b) { return b.text(); }).join('\n\n');
      U.copy(gradePrompt(P.t, p, text), cp);
      var hist = store.get('pad.history', []); hist.push({ t: P.t, n: p.n, words: wc(text), at: new Date().toISOString() }); store.set('pad.history', hist);
    };
    acts.appendChild(cp);
    var nx = el('button', 'btn', 'Next prompt ›');
    nx.onclick = function () {
      if (P.list) { var pos = P.list.indexOf(p.n); if (pos >= 0 && pos < P.list.length - 1) return renderPad(root, { n: P.list[pos + 1] }); }
      renderPad(root, { idx: (P.idx + 1) % list.length });
    };
    acts.appendChild(nx);
    root.appendChild(acts);
    root.appendChild(checklist(P.t));
  }

  function timer(mins) {
    var w = el('div', 'wtimer'), s = mins * 60, iv = null, t0 = 0;
    var lab = el('span', 'clock', U.mmss(s));
    var b = el('button', 'btn', 'Start ' + mins + ' min');
    b.onclick = function () {
      if (iv) { clearInterval(iv); iv = null; b.textContent = 'Resume'; return; }
      t0 = Date.now() - (mins * 60 - s) * 1000;
      iv = setInterval(function () {
        if (!document.body.contains(w)) return clearInterval(iv);
        s = Math.max(0, mins * 60 - Math.floor((Date.now() - t0) / 1000));
        lab.textContent = U.mmss(s); lab.className = 'clock' + (s < 120 ? ' hot' : '');
        if (!s) { clearInterval(iv); iv = null; lab.textContent = 'Time. Stop typing, run the checklist.'; }
      }, 500);
      b.textContent = 'Pause';
    };
    w.appendChild(b); w.appendChild(lab);
    return w;
  }

  function checklist(t) {
    var d = el('details', 'check');
    d.appendChild(el('summary', '', 'Checklist before you stop (2 min)'));
    (WR.checks[t] || []).forEach(function (c) {
      var l = el('label', 'ck'); var i = el('input'); i.type = 'checkbox'; l.appendChild(i); l.appendChild(document.createTextNode(' ' + c)); d.appendChild(l);
    });
    return d;
  }

  /* --------- full 60-minute writing mock (3 tasks, one clock) --------- */
  function pickWeighted(t, used) {
    var L = prompts(t).filter(function (p) { return !used[t + p.n]; });
    var tot = L.reduce(function (a, p) { return a + (p.ff || 1); }, 0), r = Math.random() * tot;
    for (var i = 0; i < L.length; i++) { r -= (L[i].ff || 1); if (r <= 0) return L[i]; }
    return L[0];
  }
  function renderMock(root) {
    root.innerHTML = '';
    var live = store.get('wmock.live', null);
    if (!live) {
      root.appendChild(el('p', 'note', 'One 60-minute clock for all three tasks, prompts drawn at random weighted by how often each family was listed. Suggested split: T1 10 min, T2 20 min, T3 28 min, 2 min final check. Type straight into the boxes, no notes, no models.'));
      var go = el('button', 'btn primary', 'Start a writing mock');
      go.onclick = function () {
        var used = store.get('wmock.used', {}), set = {};
        ['EE_T1', 'EE_T2', 'EE_T3'].forEach(function (t) { var p = pickWeighted(t, used); set[t] = p.n; used[t + p.n] = 1; });
        store.set('wmock.used', used);
        store.set('wmock.live', { set: set, start: Date.now(), id: Date.now() });
        renderMock(root);
      };
      root.appendChild(go);
      var past = store.get('wmock.past', []);
      if (past.length) root.appendChild(el('div', 'note', past.length + ' writing mock(s) done.'));
      return;
    }
    var get = function (t) { return prompts(t).filter(function (p) { return p.n === live.set[t]; })[0]; };
    var clock = el('div', 'clock big');
    root.appendChild(clock);
    var iv = setInterval(function () {
      if (!document.body.contains(clock)) return clearInterval(iv);
      var s = 3600 - Math.floor((Date.now() - live.start) / 1000);
      clock.textContent = s > 0 ? U.mmss(s) + ' left' : 'Time is up. Stop typing.';
      clock.className = 'clock big' + (s < 300 ? ' hot' : '');
    }, 500);
    var all = [];
    ['EE_T1', 'EE_T2', 'EE_T3'].forEach(function (t) {
      var p = get(t), sec = el('section', 'wtask');
      sec.appendChild(el('h3', '', TASKS[t].label + ' · ' + TASKS[t].what));
      sec.appendChild(promptBlock(t, p, 'fr'));
      var k = 'wmock.' + live.id + '.' + t;
      if (t === 'EE_T3') { var a = box(k + '.a', 40, 60, 'Partie 1 · résumé (40–60)'), b = box(k + '.b', 80, 120, 'Partie 2 · opinion (80–120)'); sec.appendChild(a); sec.appendChild(b); all.push([t, p, function () { return a.text() + '\n\n' + b.text(); }]); }
      else { var x = box(k, TASKS[t].min, TASKS[t].max); sec.appendChild(x); all.push([t, p, x.text]); }
      root.appendChild(sec);
    });
    var acts = el('div', 'acts');
    var cp = el('button', 'btn primary', 'Copy all 3 for grading');
    cp.onclick = function () {
      U.copy('Grade my full TCF Canada writing mock (3 tasks). For EACH task give items 1-5 below, then an overall /20 estimate and NCLC.\n\n' +
        all.map(function (a) { return '==== ' + gradePrompt(a[0], a[1], a[2]()); }).join('\n\n'), cp);
    };
    var end = el('button', 'btn', 'End mock');
    end.onclick = function () { var past = store.get('wmock.past', []); past.push(live); store.set('wmock.past', past); store.set('wmock.live', null); renderMock(root); };
    acts.appendChild(cp); acts.appendChild(end);
    root.appendChild(acts);
  }

  /* --------- model answers --------- */
  function renderModels(root, sel) {
    root.innerHTML = '';
    var keys = Object.keys(WR.models).sort(function (a, b) { var A = WR.models[a], B = WR.models[b]; return A.t.localeCompare(B.t) || B.ff - A.ff; });
    var t = (sel && sel.t) || store.get('models.t', 'EE_T1');
    var tabs = el('div', 'filters');
    Object.keys(TASKS).forEach(function (x) {
      var b = el('button', 'chip' + (x === t ? ' on' : ''), TASKS[x].label);
      b.onclick = function () { store.set('models.t', x); renderModels(root, { t: x }); };
      tabs.appendChild(b);
    });
    root.appendChild(tabs);
    root.appendChild(el('p', 'note', 'Your own sentences, cut to the word limit, one per prompt family, most-listed first. Recall mode: read the English cue, say or type the French, then tap to check.'));
    keys.filter(function (k) { return WR.models[k].t === t; }).forEach(function (k) {
      var m = WR.models[k], d = el('details', 'model');
      d.id = 'm-' + k.replace(':', '-');
      if (sel && sel.k === k) d.open = true;
      d.appendChild(el('summary', '', m.title + ' · listed ' + m.ff + '× · ' + m.words + ' words'));
      if (m.prompt) d.appendChild(el('p', 'prompt small', m.prompt));
      var rec = el('button', 'mini', 'Recall mode');
      var body = el('div', 'mbody');
      function draw(recall) {
        body.innerHTML = '';
        var lastPart = null;
        m.s.forEach(function (s) {
          if (s.part && s.part !== lastPart) { lastPart = s.part; body.appendChild(el('div', 'wlabel', s.part === 'a' ? 'Partie 1 · résumé (frame, generic)' : 'Partie 2 · your opinion')); }
          else if (s.br) { body.appendChild(el('div', 'gap')); }
          var row = el('div', 'ms' + (recall ? ' hide' : ''));
          row.innerHTML = '<div class="fr">' + U.esc(s.fr) + '</div><div class="en">' + U.esc(s.en || '') + (s.gen ? ' <span class="gen">generic</span>' : '') + '</div>';
          if (recall) row.onclick = function () { row.classList.toggle('hide'); };
          body.appendChild(row);
        });
        if (m.note) body.appendChild(el('div', 'note', m.note));
      }
      rec.onclick = function () { var on = rec.textContent === 'Recall mode'; rec.textContent = on ? 'Show all' : 'Recall mode'; draw(on); };
      d.appendChild(rec); d.appendChild(body); draw(false);
      root.appendChild(d);
    });
  }

  /* --------- chunk recall (spaced within the day) --------- */
  function renderChunks(root, opts) {
    root.innerHTML = '';
    var cats = {}; WR.chunks.forEach(function (c) { cats[c.cat] = (cats[c.cat] || 0) + 1; });
    var S = store.get('chunks.state', {}), cat = (opts && opts.cat) || store.get('chunks.cat', 'all');
    var f = el('div', 'filters');
    [['all', 'All (' + WR.chunks.length + ')']].concat(Object.keys(cats).map(function (c) { return [c, c + ' (' + cats[c] + ')']; })).forEach(function (x) {
      var b = el('button', 'chip' + (cat === x[0] ? ' on' : ''), x[1]);
      b.onclick = function () { store.set('chunks.cat', x[0]); renderChunks(root, { cat: x[0] }); };
      f.appendChild(b);
    });
    root.appendChild(f);
    var pool = WR.chunks.filter(function (c) { return cat === 'all' || c.cat === cat; });
    var now = Date.now();
    var due = pool.filter(function (c) { var s = S[c.id]; return !s || s.due <= now; });
    var known = pool.filter(function (c) { var s = S[c.id]; return s && s.box >= 3; }).length;
    root.appendChild(el('div', 'note', due.length + ' due now · ' + known + '/' + pool.length + ' solid (3 right in a row). Say the French out loud or type it, then reveal. Again = back in 3 min; Good = 15 min, then 1 h, then 4 h.'));
    if (!due.length) { root.appendChild(el('p', 'note', 'Nothing due in this set. Come back at the next review block.')); return; }
    due.sort(function (a, b) { return ((S[a.id] || {}).due || 0) - ((S[b.id] || {}).due || 0); });
    var c = due[0], card = el('div', 'qcard chunk');
    card.appendChild(el('div', 'qmeta', c.cat + (c.gen ? ' · generic (not from your answers)' : c.src ? ' · from your ' + c.src : '') + (c.use ? ' · ' + c.use : '')));
    card.appendChild(el('div', 'cue', c.en));
    var inp = el('textarea', 'pad small'); inp.placeholder = 'Type the French (optional), then Reveal'; card.appendChild(inp);
    var ans = el('div', 'ans'); ans.hidden = true; ans.textContent = c.fr; card.appendChild(ans);
    var u = null;
    var acts = el('div', 'acts');
    var rv = el('button', 'btn primary', 'Reveal');
    rv.onclick = function () {
      ans.hidden = false; if (u) u.hidden = false; rv.remove();
      var again = el('button', 'btn', 'Again'), good = el('button', 'btn primary', 'Good');
      var STEP = [15, 60, 240, 480];
      again.onclick = function () { S[c.id] = { box: 0, due: Date.now() + 3 * 60000 }; store.set('chunks.state', S); renderChunks(root); };
      good.onclick = function () { var b = ((S[c.id] || {}).box || 0) + 1; S[c.id] = { box: b, due: Date.now() + STEP[Math.min(b - 1, 3)] * 60000 }; store.set('chunks.state', S); renderChunks(root); };
      acts.appendChild(again); acts.appendChild(good); good.focus();
    };
    acts.appendChild(rv);
    card.appendChild(acts);
    root.appendChild(card);
  }


  /* --------- cut drill: delete-only edits of your own answers down to the limit --------- */
  function renderCut(root, opts) {
    root.innerHTML = '';
    var ids = WR.cutDefault, all = WR.answers;
    root.appendChild(el('p', 'note', 'Your own French answers, all over the limit. Delete words and sentences until the counter turns green. Delete only: no new words. Keep every point the prompt asks for. This is the habit you need in the exam: write long, then cut fast.'));
    var sel = el('select', 'psel');
    var cur = (opts && opts.id) || store.get('cut.id', ids[0]);
    all.forEach(function (a) { var o = el('option', '', a.id + ' · ' + a.task + ' · ' + a.words + ' words · ' + a.title); o.value = a.id; if (a.id === cur) o.selected = true; sel.appendChild(o); });
    sel.onchange = function () { store.set('cut.id', sel.value); renderCut(root, { id: sel.value }); };
    root.appendChild(el('div', 'note', 'Do these three first: ' + ids.join(', ') + '.'));
    root.appendChild(sel);
    var a = all.filter(function (x) { return x.id === cur; })[0];
    var T = TASKS[a.t];
    root.appendChild(el('div', 'prompt small', a.prompt));
    var key = 'cut.' + a.id;
    if (store.get(key, null) == null) store.set(key, a.fr);
    var b = box(key, a.t === 'EE_T3' ? 120 : T.min, T.max, 'Target: ' + a.target);
    root.appendChild(timer(12));
    root.appendChild(b);
    var rs = el('button', 'mini', 'Reset to the full answer'); rs.onclick = function () { store.set(key, a.fr); renderCut(root, { id: a.id }); };
    root.appendChild(rs);
    var en = el('details', 'check'); en.appendChild(el('summary', '', 'Your English (for meaning)')); en.appendChild(el('p', '', a.en)); root.appendChild(en);
  }

  /* --------- error log --------- */
  function errlog(root) {
    var w = el('div', 'qcard');
    w.appendChild(el('h3', '', 'My errors (from every grading)'));
    w.appendChild(el('div', 'note', 'One line each: my words → correct French. Star the 8 that come back most. Read this before every writing block.'));
    var ta = el('textarea', 'pad'); ta.value = store.get('errlog', ''); ta.oninput = function () { store.set('errlog', ta.value); };
    w.appendChild(ta);
    var cp = el('button', 'mini', 'Copy'); cp.onclick = function () { U.copy(ta.value, cp); }; w.appendChild(cp);
    root.appendChild(w);
  }

  window.WRITING = { pad: renderPad, mock: renderMock, models: renderModels, chunks: renderChunks, cut: renderCut, errlog: errlog, wc: wc };
})();
