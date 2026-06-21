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

  var curIndex = -1;

  contEl.checked = localStorage.getItem('continuous') === '1';
  contEl.addEventListener('change', function () {
    localStorage.setItem('continuous', contEl.checked ? '1' : '0');
  });

  function asArr(x) { return Array.isArray(x) ? x : (x ? [x] : []); }
  function blob(x) { return asArr(x).join(' '); }

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
      el.onclick = function () { loadAndShow(data.indexOf(r), contEl.checked); };
      listEl.appendChild(el);
    });
    countEl.textContent = items.length + ' recording' + (items.length === 1 ? '' : 's');
  }

  function renderEntry(r) {
    document.getElementById('entry-title').textContent = r.title;
    document.getElementById('entry-date').textContent = r.date || '';
    var fr = asArr(r.french), en = asArr(r.english);
    var n = Math.max(fr.length, en.length);
    segsEl.innerHTML = '';
    for (var i = 0; i < n; i++) {
      var row = document.createElement('div'); row.className = 'seg';
      var l = document.createElement('div'); l.className = 'seg-fr'; l.textContent = fr[i] || '';
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
    if (!q) return data;
    return data.filter(function (r) {
      return (r.title || '').toLowerCase().indexOf(q) >= 0
        || blob(r.french).toLowerCase().indexOf(q) >= 0
        || blob(r.english).toLowerCase().indexOf(q) >= 0;
    });
  }

  // auto-advance (commute mode)
  player.addEventListener('ended', function () { if (contEl.checked) step(1); });
  player.addEventListener('play', function () { renderList(currentItems()); });
  player.addEventListener('pause', function () { renderList(currentItems()); });

  searchEl.addEventListener('input', function () { renderList(currentItems()); });

  renderList(data);
  if (data.length) loadAndShow(0, false);
})();
