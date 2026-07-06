(function () {
  var data = (window.RECORDINGS || []).slice();
  data.sort(function (a, b) { return (b.date || "").localeCompare(a.date || ""); });

  var listEl = document.getElementById('list');
  var searchEl = document.getElementById('search');
  var countEl = document.getElementById('count');
  var emptyEl = document.getElementById('empty');
  var entryEl = document.getElementById('entry');
  var segsEl = document.getElementById('segs');
  var reader = document.getElementById('reader');
  var player = document.getElementById('player');
  var npTitle = document.getElementById('np-title');
  var contEl = document.getElementById('continuous');
  var themeBtn = document.getElementById('theme-toggle');
  var eraseBtn = document.getElementById('erase-toggle');

  var curIndex = -1;
  var curId = null, curHL = new Set();   // per-recording set of user word highlights ("seg:wi")
  var eraseMode = false;                 // when true, select/tap removes highlights instead of adding

  /* ---- theme toggle (system default, manual override, persisted) ---- */
  var root = document.documentElement;
  var mq = window.matchMedia('(prefers-color-scheme: dark)');
  function effectiveTheme() {
    return root.getAttribute('data-theme') || (mq.matches ? 'dark' : 'light');
  }
  function paintThemeIcon() { themeBtn.textContent = effectiveTheme() === 'dark' ? '☀︎' : '☾'; }
  themeBtn.addEventListener('click', function () {
    var next = effectiveTheme() === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
    paintThemeIcon();
  });
  mq.addEventListener('change', function () { if (!localStorage.getItem('theme')) paintThemeIcon(); });
  paintThemeIcon();

  /* ---- continuous mode ---- */
  contEl.checked = localStorage.getItem('continuous') === '1';
  contEl.addEventListener('change', function () {
    localStorage.setItem('continuous', contEl.checked ? '1' : '0');
  });

  var backBtn = document.getElementById('back');
  backBtn.addEventListener('click', function () { document.body.classList.remove('detail'); });
  function isMobile() { return window.matchMedia('(max-width:680px)').matches; }

  function asArr(x) { return Array.isArray(x) ? x : (x ? [x] : []); }
  function blob(x) { return asArr(x).join(' '); }

  /* ---- source filter (declutters the mix of workflow sources) ---- */
  var CAT_ORDER = ['Section A answers', 'Section B answers', 'Section B passages', 'Recordings', 'Other'];
  function categoryOf(r) {
    var s = r.source || '';
    if (s === 'section-a-response') return 'Section A answers';
    if (s === 'section-b-response') return 'Section B answers';
    if (s === 'section-b') return 'Section B passages';
    if (s === 's2t' || s === 't2t') return 'Recordings';
    return 'Other';
  }
  var filtersEl = document.getElementById('filters');
  var activeCat = localStorage.getItem('cat') || 'All';
  function catsPresent() {
    var seen = {};
    data.forEach(function (r) { var c = categoryOf(r); seen[c] = (seen[c] || 0) + 1; });
    return CAT_ORDER.filter(function (c) { return seen[c]; }).map(function (c) { return [c, seen[c]]; });
  }
  function renderFilters() {
    var cats = catsPresent();
    filtersEl.innerHTML = '';
    if (cats.length < 2) return;                       // only one kind present -> nothing to filter
    if (activeCat !== 'All' && !cats.some(function (c) { return c[0] === activeCat; })) activeCat = 'All';
    [['All', data.length]].concat(cats).forEach(function (c) {
      var b = document.createElement('button');
      b.className = 'chip' + (activeCat === c[0] ? ' active' : '');
      b.appendChild(document.createTextNode(c[0]));
      var n = document.createElement('span'); n.className = 'n'; n.textContent = c[1]; b.appendChild(n);
      b.onclick = function () {
        activeCat = c[0]; localStorage.setItem('cat', activeCat);
        renderFilters(); renderList(currentItems());
      };
      filtersEl.appendChild(b);
    });
  }

  function renderList(items) {
    listEl.innerHTML = '';
    var lastGroup = null;
    items.forEach(function (r) {
      var g = (r.date || '').slice(0, 7) || '—';
      if (g !== lastGroup) {
        var gl = document.createElement('div');
        gl.className = 'group-label'; gl.textContent = g;
        listEl.appendChild(gl); lastGroup = g;
      }
      var el = document.createElement('div');
      var isCur = (data[curIndex] === r);
      el.className = 'item' + (isCur ? ' active' : '') + (isCur && !player.paused ? ' playing' : '');
      el.innerHTML = '<div class="meta"><div class="t"></div><div class="d"></div></div>';
      el.querySelector('.t').textContent = r.title;
      el.querySelector('.d').textContent = (r.date || '') + (r.audio ? '' : ' · no audio');
      el.onclick = function () {
        loadAndShow(data.indexOf(r), contEl.checked);
        if (isMobile()) document.body.classList.add('detail');
      };
      listEl.appendChild(el);
    });
    countEl.textContent = items.length + ' recording' + (items.length === 1 ? '' : 's');
  }

  /* ---- user word-highlighting (tap a French word to highlight; tap it again to remove) ---- */
  var HL_KEY = 'oralhl:';
  var WORD_RE = /[\p{L}\p{N}]+(?:[’'\-][\p{L}\p{N}]+)*/gu;
  function loadHL(id) {
    try { return new Set(JSON.parse(localStorage.getItem(HL_KEY + id) || '[]')); }
    catch (e) { return new Set(); }
  }
  function saveHL(id, set) {
    try {
      if (set.size) localStorage.setItem(HL_KEY + id, JSON.stringify(Array.from(set)));
      else localStorage.removeItem(HL_KEY + id);
    } catch (e) {}
  }
  // Append `text` to `el`, wrapping each word in a clickable <span class="w"> so it can be
  // toggled. `state.wi` is the running word index within the segment (a stable id for
  // persistence); separators (spaces, punctuation) stay as plain text nodes.
  function appendWords(el, text, segIndex, state) {
    WORD_RE.lastIndex = 0;
    var last = 0, m;
    while ((m = WORD_RE.exec(text))) {
      if (m.index > last) el.appendChild(document.createTextNode(text.slice(last, m.index)));
      var k = segIndex + ':' + (state.wi++);
      var w = document.createElement('span');
      w.className = curHL.has(k) ? 'w uhl' : 'w';
      w.setAttribute('data-k', k);
      w.textContent = m[0];
      el.appendChild(w);
      last = m.index + m[0].length;
    }
    if (last < text.length) el.appendChild(document.createTextNode(text.slice(last)));
  }

  function renderEntry(r) {
    curId = (r.id != null ? r.id : (r.title || ''));
    curHL = loadHL(curId);
    document.getElementById('entry-title').textContent = r.title;
    document.getElementById('entry-date').textContent = r.date || '';
    var hl = document.getElementById('entry-hl');
    if (r.highlightWords != null) { hl.textContent = '✎ ' + r.highlightWords + ' words'; hl.hidden = false; }
    else { hl.hidden = true; }
    var fr = asArr(r.french), en = asArr(r.english), spans = r.frenchSpans;
    var n = Math.max(fr.length, en.length);
    segsEl.innerHTML = '';
    for (var i = 0; i < n; i++) {
      var row = document.createElement('div'); row.className = 'seg';
      var l = document.createElement('div'); l.className = 'seg-fr';
      var state = { wi: 0 };
      if (spans && spans[i]) {                          // response entry: blank-fill words stay marked
        spans[i].forEach(function (s) {
          if (s[1]) { var m = document.createElement('mark'); m.className = 'hl'; m.textContent = s[0]; l.appendChild(m); }
          else { appendWords(l, s[0], i, state); }
        });
      } else { appendWords(l, fr[i] || '', i, state); }
      var rt = document.createElement('div'); rt.className = 'seg-en'; rt.textContent = en[i] || '';
      row.appendChild(l); row.appendChild(rt); segsEl.appendChild(row);
    }
  }

  function setMedia(r) {
    if (!('mediaSession' in navigator)) return;
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: r.title, artist: 'Oral practice — French', album: 'TEF'
      });
      navigator.mediaSession.setActionHandler('play', function () { player.play(); });
      navigator.mediaSession.setActionHandler('pause', function () { player.pause(); });
      navigator.mediaSession.setActionHandler('nexttrack', function () { step(1); });
      navigator.mediaSession.setActionHandler('previoustrack', function () { step(-1); });
    } catch (e) {}
  }

  function neighborWithAudio(from, dir) {
    for (var k = 1; k <= data.length; k++) {
      var j = ((from + dir * k) % data.length + data.length) % data.length;
      if (data[j].audio) return j;
    }
    return -1;
  }
  function step(dir) { var j = neighborWithAudio(curIndex, dir); if (j >= 0) loadAndShow(j, true); }

  function loadAndShow(i, autoplay) {
    if (i < 0 || i >= data.length) return;
    curIndex = i;
    var r = data[i];
    emptyEl.hidden = true; entryEl.hidden = false;
    renderEntry(r);
    reader.scrollTop = 0;
    if (r.audio) {
      var abs = new URL(r.audio, location.href).href;
      if (player.src !== abs) player.src = r.audio;
      npTitle.textContent = r.title;
      setMedia(r);
      if (autoplay) { var p = player.play(); if (p && p.catch) p.catch(function () {}); }
    } else {
      npTitle.textContent = r.title + ' — no audio';
    }
    renderList(currentItems());
  }

  function currentItems() {
    var q = (searchEl.value || '').toLowerCase().trim();
    return data.filter(function (r) {
      if (activeCat !== 'All' && categoryOf(r) !== activeCat) return false;
      if (!q) return true;
      return (r.title || '').toLowerCase().indexOf(q) >= 0
        || blob(r.french).toLowerCase().indexOf(q) >= 0
        || blob(r.english).toLowerCase().indexOf(q) >= 0;
    });
  }

  player.addEventListener('ended', function () { if (contEl.checked) step(1); });
  player.addEventListener('play', function () { renderList(currentItems()); });
  player.addEventListener('pause', function () { renderList(currentItems()); });
  searchEl.addEventListener('input', function () { renderList(currentItems()); });

  /* ---- highlight / erase French words ----
     Highlight mode (default): tap a word to toggle it, or drag-select a run to highlight it.
     Erase mode (Erase button on): tap or drag-select highlighted words to remove them. */
  var afterSelect = false;   // true right after a drag-select, so the trailing click doesn't toggle

  function paintErase() {
    eraseBtn.setAttribute('aria-pressed', eraseMode ? 'true' : 'false');
    eraseBtn.textContent = eraseMode ? 'Erasing' : 'Erase';
    segsEl.classList.toggle('erasing', eraseMode);
  }
  eraseBtn.addEventListener('click', function () { eraseMode = !eraseMode; paintErase(); });
  paintErase();

  function setHL(el, on) {                             // add/remove one word's highlight; true if it changed
    var k = el.getAttribute('data-k');
    if (on && !curHL.has(k)) { curHL.add(k); el.classList.add('uhl'); return true; }
    if (!on && curHL.has(k)) { curHL.delete(k); el.classList.remove('uhl'); return true; }
    return false;
  }
  function applySelection() {                          // (un)highlight every word the selection touches
    var sel = window.getSelection && window.getSelection();
    if (!sel || !sel.rangeCount || sel.isCollapsed) return false;
    var rng = sel.getRangeAt(0), words = segsEl.querySelectorAll('.seg-fr .w'), changed = false;
    for (var i = 0; i < words.length; i++) {
      if (rng.intersectsNode(words[i]) && setHL(words[i], !eraseMode)) changed = true;
    }
    if (changed) { saveHL(curId, curHL); sel.removeAllRanges(); }
    return changed;
  }
  function resetSelect() { afterSelect = false; }
  function endSelect() { if (applySelection()) afterSelect = true; }
  segsEl.addEventListener('mousedown', resetSelect);
  segsEl.addEventListener('touchstart', resetSelect, { passive: true });
  segsEl.addEventListener('mouseup', endSelect);
  segsEl.addEventListener('touchend', endSelect);

  /* tap a single French word: toggle it (highlight mode) or remove it (erase mode) */
  segsEl.addEventListener('click', function (e) {
    if (afterSelect) { afterSelect = false; return; }   // this click trailed a drag-select — ignore it
    var w = e.target.closest && e.target.closest('.w');
    if (!w || !segsEl.contains(w)) return;
    var sel = window.getSelection && window.getSelection();
    if (sel && !sel.isCollapsed && String(sel)) return; // a selection is active — leave it for applySelection
    var on = eraseMode ? false : !curHL.has(w.getAttribute('data-k'));  // erase only removes; else toggle
    if (setHL(w, on)) saveHL(curId, curHL);
  });

  renderFilters();
  renderList(currentItems());
  if (data.length) loadAndShow(0, false);
})();
