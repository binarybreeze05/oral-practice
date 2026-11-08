/* Speaking (Expression orale): Task 1 opener + answer cards, Task 2 / Task 3 kits, speaking pad (timer, recorder,
   live transcript, grading prompt), 12-min speaking mock. Data: window.SP (sp.js). */
(function () {
  'use strict';
  var U = window.CRAM, el = U.el, store = U.store, esc = U.esc, SP = window.SP;
  var STEP = [15, 60, 240, 480];
  var TASKS = {
    EO_T1: { name: 'Tâche 1 · Entretien', secs: 120, prep: 0 },
    EO_T2: { name: 'Tâche 2 · Interaction', secs: 210, prep: 120 },
    EO_T3: { name: 'Tâche 3 · Point de vue', secs: 270, prep: 0 }
  };

  /* ---------- small parts ---------- */
  function hideEn(en) { var s = el('span', 'bmin hid', en); s.onclick = function () { s.classList.toggle('show'); }; return s; }
  function line(fr, en, opts) {
    var d = el('div', 'ms' + (opts && opts.hide ? ' hide' : ''));
    var f = el('div', 'fr', fr); d.appendChild(f);
    if (en) { var e = el('div', 'en', en); d.appendChild(e); }
    if (opts && opts.gen) d.appendChild(el('span', 'gen', 'generic'));
    if (opts && opts.guess) d.appendChild(el('span', 'gen', 'guessed fact'));
    if (opts && opts.hide) f.onclick = function () { d.classList.remove('hide'); };
    return d;
  }
  function frVoice() {
    if (!window.speechSynthesis) return null;
    var v = speechSynthesis.getVoices().filter(function (x) { return /^fr/i.test(x.lang); });
    return v.filter(function (x) { return /fr-FR/i.test(x.lang); })[0] || v[0] || null;
  }
  function say(text) {
    if (!window.speechSynthesis) return;
    speechSynthesis.cancel();
    var u = new SpeechSynthesisUtterance(text); u.lang = 'fr-FR'; u.rate = 0.95; var v = frVoice(); if (v) u.voice = v;
    speechSynthesis.speak(u);
  }
  if (window.speechSynthesis) { speechSynthesis.getVoices(); speechSynthesis.onvoiceschanged = function () { }; }
  function listenBtn(text) { var b = el('button', 'mini', 'Hear it'); b.onclick = function () { say(text); }; return b; }
  function tabs(root, key, list, cur, fn) {
    var f = el('div', 'filters');
    list.forEach(function (x) {
      var b = el('button', 'chip' + (cur === x[0] ? ' on' : ''), x[1]);
      b.onclick = function () { store.set(key, x[0]); fn(x[0]); };
      f.appendChild(b);
    });
    root.appendChild(f);
  }

  /* ---------- spaced deck (same steps as the writing chunks) ---------- */
  function deck(root, key, items, render, onAgain, rerender) {
    var S = store.get(key, {}), now = Date.now();
    var due = items.filter(function (c) { var s = S[c.id]; return !s || s.due <= now; });
    var solid = items.filter(function (c) { var s = S[c.id]; return s && s.box >= 3; }).length;
    var seen = items.filter(function (c) { return S[c.id]; }).length;
    root.appendChild(el('div', 'note', due.length + ' due · ' + seen + '/' + items.length + ' seen · ' + solid + ' solid (3 Good in a row). Again = back in 3 min; Good = 15 min, 1 h, 4 h, 8 h.'));
    if (!due.length) {
      var soon = items.slice().sort(function (a, b) { return (S[a.id] || {}).due - (S[b.id] || {}).due; })[0];
      var mins = soon ? Math.max(1, Math.round(((S[soon.id] || {}).due - now) / 60000)) : 0;
      root.appendChild(el('p', 'note', 'Nothing due in this set. Next card due in ' + mins + ' min. Pick another set, or review early.'));
      if (soon && rerender) { var re = el('button', 'btn', 'Review early'); re.onclick = function () { S = store.get(key, {}); S[soon.id].due = Date.now() - 1; store.set(key, S); rerender(); }; root.appendChild(re); }
      return;
    }
    due.sort(function (a, b) { var x = (S[a.id] || {}).due || 0, y = (S[b.id] || {}).due || 0; return x - y || items.indexOf(a) - items.indexOf(b); });
    var c = due[0], card = el('div', 'qcard chunk');
    var parts = render(c, card);
    var acts = el('div', 'acts');
    var rv = el('button', 'btn primary', 'Reveal');
    rv.onclick = function () {
      parts.reveal(); rv.remove();
      var again = el('button', 'btn', 'Again'), good = el('button', 'btn primary', 'Good');
      again.onclick = function () { S = store.get(key, {}); S[c.id] = { box: 0, due: Date.now() + 3 * 60000 }; store.set(key, S); if (onAgain) onAgain(c); parts.next(); };
      good.onclick = function () { S = store.get(key, {}); var b = ((S[c.id] || {}).box || 0) + 1; S[c.id] = { box: b, due: Date.now() + STEP[Math.min(b - 1, 3)] * 60000 }; store.set(key, S); parts.next(); };
      acts.appendChild(again); acts.appendChild(good); good.focus();
    };
    acts.appendChild(rv);
    card.appendChild(acts);
    root.appendChild(card);
  }

  /* ---------- recorder + live transcript ---------- */
  var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  function recorder(key) {
    var w = el('div', 'rec');
    var row = el('div', 'acts');
    var rb = el('button', 'btn', 'Record'); row.appendChild(rb);
    var opt = el('label', 'note'); var cb = el('input'); cb.type = 'checkbox'; cb.checked = !!SR && store.get('sr.on', true);
    opt.appendChild(cb); opt.appendChild(document.createTextNode(' live transcript' + (SR ? '' : ' (not in this browser: use Chrome)')));
    if (!SR) cb.disabled = true;
    cb.onchange = function () { store.set('sr.on', cb.checked); };
    row.appendChild(opt);
    w.appendChild(row);
    var audio = el('audio'); audio.controls = true; audio.hidden = true; w.appendChild(audio);
    var dl = el('a', 'mini', 'Download recording'); dl.hidden = true; w.appendChild(dl);
    w.appendChild(el('div', 'wlabel', 'Transcript (speech-to-text; fix obvious mishearings, not your mistakes)'));
    var ta = el('textarea', 'pad small'); ta.value = store.get('tx.' + key, ''); ta.oninput = function () { store.set('tx.' + key, ta.value); };
    w.appendChild(ta);
    var clr = el('button', 'mini', 'Clear transcript'); clr.onclick = function () { ta.value = ''; store.set('tx.' + key, ''); }; w.appendChild(clr);
    var mr = null, chunks = [], stream = null, rec = null, on = false, interim = el('div', 'note');
    w.insertBefore(interim, ta);
    function startSR() {
      if (!SR || !cb.checked) return;
      rec = new SR(); rec.lang = 'fr-FR'; rec.continuous = true; rec.interimResults = true;
      rec.onresult = function (e) {
        var fin = '', mid = '';
        for (var i = e.resultIndex; i < e.results.length; i++) { if (e.results[i].isFinal) fin += e.results[i][0].transcript; else mid += e.results[i][0].transcript; }
        if (fin) { ta.value = (ta.value ? ta.value.replace(/\s*$/, ' ') : '') + fin.trim(); store.set('tx.' + key, ta.value); }
        interim.textContent = mid ? '… ' + mid : '';
      };
      rec.onerror = function (e) { if (e.error === 'not-allowed') interim.textContent = 'Microphone blocked for speech-to-text. Allow it in the address bar.'; };
      rec.onend = function () { if (on) { try { rec.start(); } catch (x) { } } };
      try { rec.start(); } catch (x) { }
    }
    function start() {
      on = true; rb.textContent = 'Stop'; rb.classList.add('on');
      if (navigator.mediaDevices && window.MediaRecorder) {
        navigator.mediaDevices.getUserMedia({ audio: true }).then(function (s) {
          stream = s; chunks = []; mr = new MediaRecorder(s);
          mr.ondataavailable = function (e) { if (e.data.size) chunks.push(e.data); };
          mr.onstop = function () {
            var blob = new Blob(chunks, { type: mr.mimeType || 'audio/webm' }); var url = URL.createObjectURL(blob);
            audio.src = url; audio.hidden = false; dl.href = url; dl.download = 'tcf-' + key + '-' + Date.now() + (/mp4/.test(blob.type) ? '.m4a' : '.webm'); dl.hidden = false;
            stream.getTracks().forEach(function (t) { t.stop(); });
          };
          mr.start(1000);
        }, function () { interim.textContent = 'No microphone access. Allow it in the address bar, or just speak and use the timer.'; });
      }
      startSR();
    }
    function stop() {
      on = false; rb.textContent = 'Record'; rb.classList.remove('on'); interim.textContent = '';
      if (mr && mr.state !== 'inactive') mr.stop();
      if (rec) { try { rec.stop(); } catch (x) { } rec = null; }
    }
    rb.onclick = function () { on ? stop() : start(); };
    w.start = start; w.stop = stop; w.text = function () { return ta.value; }; w.isOn = function () { return on; };
    return w;
  }

  /* ---------- timer with optional prep phase ---------- */
  function clock(prep, secs, hooks) {
    var w = el('div', 'wtimer'), c = el('span', 'clock big', ''), b = el('button', 'btn primary', 'Start'), rs = el('button', 'mini', 'Reset');
    var t0 = null, iv = null, phase = prep ? 'prep' : 'talk';
    function paint() {
      if (!t0) { c.textContent = prep ? 'Prep ' + U.mmss(prep) + ' then talk ' + U.mmss(secs) : U.mmss(secs); return; }
      var el2 = Math.floor((Date.now() - t0) / 1000);
      if (prep && el2 < prep) { c.textContent = 'Prep ' + U.mmss(prep - el2); c.className = 'clock big behind'; return; }
      if (prep && phase === 'prep') { phase = 'talk'; if (hooks && hooks.talk) hooks.talk(); }
      var left = prep + secs - el2;
      if (left <= 0) { c.textContent = 'Time. Stop talking.'; c.className = 'clock big hot'; clearInterval(iv); iv = null; b.textContent = 'Start'; if (hooks && hooks.end) hooks.end(); return; }
      c.textContent = 'Talk ' + U.mmss(left); c.className = 'clock big' + (left <= 30 ? ' hot' : '');
      if (hooks && hooks.tick) hooks.tick(el2 - prep);
    }
    b.onclick = function () {
      if (iv) { clearInterval(iv); iv = null; t0 = null; phase = prep ? 'prep' : 'talk'; b.textContent = 'Start'; c.className = 'clock big'; paint(); if (hooks && hooks.end) hooks.end(); return; }
      t0 = Date.now(); phase = prep ? 'prep' : 'talk'; b.textContent = 'Stop'; if (!prep && hooks && hooks.talk) hooks.talk(); iv = setInterval(function () { if (!document.body.contains(w)) return clearInterval(iv); paint(); }, 250); paint();
    };
    rs.onclick = function () { clearInterval(iv); iv = null; t0 = null; phase = prep ? 'prep' : 'talk'; b.textContent = 'Start'; c.className = 'clock big'; paint(); };
    w.appendChild(c); w.appendChild(b); w.appendChild(rs); paint();
    return w;
  }

  /* ---------- prompts for Claude ---------- */
  function gradePrompt(task, promptFr, text) {
    var what = task === 'EO_T1' ? 'Task 1 (entretien dirigé, 2 min: personal questions)' : task === 'EO_T2' ? 'Task 2 (exercice en interaction, 3 min 30 of talk: I ask the examiner questions)' : 'Task 3 (expression d\'un point de vue, 4 min 30: I defend an opinion)';
    return 'You are a TCF Canada Expression orale examiner. This is my ' + what + '.\nConsigne: ' + promptFr + '\n\n' +
      'Below is an automatic speech-to-text transcript of what I said. Ignore punctuation and spelling, and words the machine probably misheard. Judge only grammar, vocabulary, structure and task completion.\n\n' +
      'Reply in English, short:\n1. Score estimate /20 and NCLC for this task.\n2. Task completion' + (task === 'EO_T2' ? ' (how many distinct relevant questions, register tu/vous right?, did I react to answers?)' : task === 'EO_T3' ? ' (clear position? 2 developed arguments with examples? concession? conclusion?)' : ' (did I give details and hooks, not bare facts?)') + '.\n3. My 5 most costly errors: what I said → the fix.\n4. Two structures to add next time, in plain spoken French a B1-B2 speaker can say.\n5. A corrected version that keeps my own words and ideas. No fancier vocabulary than mine.\n\nTranscript:\n' + (text || '(empty)');
  }
  function examinerPrompt(task, promptFr) {
    var head = 'Act as a TCF Canada examiner for Expression orale. Speak only French at a normal exam pace, and do not correct me during the task. When I say "fin", switch to English and give: score estimate /20 and NCLC, 5 errors I made with the fix, and one thing to do better.\n\n';
    if (task === 'EO_T1') return head + 'Task 1, entretien dirigé, 2 minutes. Start with "Bonjour. Présentez-vous, s\'il vous plaît." After my introduction, ask me 4 to 6 short personal follow-up questions that build on what I just said (family, work, studies, hobbies, Canada, learning French, travel, plans). Stop at 2 minutes.';
    if (task === 'EO_T2') return head + 'Task 2, exercice en interaction. The card: «' + promptFr + '». Read the card to me, then wait while I prepare for 2 minutes (I will say "prêt"). Then play the person on the card for 3 min 30: answer my questions briefly and naturally, invent plausible details (prices, times, places), and now and then give an answer that invites a follow-up question. If I stop asking, wait a moment, then say "Vous avez d\'autres questions ?". Stop at 3 min 30.';
    return head + 'Task 3, expression d\'un point de vue, 4 min 30. Ask me: «' + promptFr + '». Let me speak. Once or twice, push back like an examiner ("Mais certains pensent que…", "Vous avez un exemple ?"). Stop at 4 min 30.';
  }
  function copyBtn(label, fn) { var b = el('button', 'btn', label); b.onclick = function () { U.copy(fn(), b); }; return b; }

  /* =========================== TASK 1 =========================== */
  function renderT1(root, opts) {
    root.innerHTML = '';
    var T = SP.t1, sub = (opts && opts.sub) || store.get('t1.sub', 'opener');
    root.appendChild(el('div', 'note', 'Task 1, 2 minutes, no prep. The examiner says "Présentez-vous", then asks follow-ups on what you said. Your opener plants hooks in your strongest topics. All French below is your own English answers, translated; "guessed fact" marks the facts I filled in.'));
    tabs(root, 't1.sub', [['opener', 'Opener (75 s)'], ['freq', '★ Frequent (' + T.cards.filter(function (c) { return c.freq; }).length + ')'], ['topic', 'By topic'], ['read', 'Read all']], sub, function (s) { renderT1(root, { sub: s }); });
    if (sub === 'opener') return opener(root);
    if (sub === 'read') return readAll(root);
    var pool = T.cards;
    if (sub === 'freq') pool = pool.filter(function (c) { return c.freq; });
    if (sub === 'topic') {
      var tp = (opts && opts.topic) || store.get('t1.topic', T.topics[0]);
      tabs(root, 't1.topic', T.topics.map(function (t) { return [t, t + ' (' + T.cards.filter(function (c) { return c.topic === t && !c.freq; }).length + ')']; }), tp, function (t) { renderT1(root, { sub: 'topic', topic: t }); });
      pool = pool.filter(function (c) { return c.topic === tp && !c.freq; });
    }
    var ear = store.get('t1.ear', false);
    var eb = el('button', 'chip' + (ear ? ' on' : ''), ear ? 'Ear mode on: the question plays, text hidden (tap to show)' : 'Ear mode off');
    eb.onclick = function () { store.set('t1.ear', !ear); renderT1(root, { sub: sub, topic: opts && opts.topic }); };
    root.appendChild(eb);
    root.appendChild(el('div', 'note', 'In the exam you only hear the questions. Answer OUT LOUD in French for 20–40 s, then Reveal and compare. Good if you got the key facts and most of the French; the wording can differ.'));
    deck(root, 't1.deck', pool, function (c, card) {
      card.appendChild(el('div', 'qmeta', (c.hook ? '★ opener hook (built from your ' + (c.from || []).join(', ') + ') · ' : c.freq ? '★ frequent · ' : '') + c.topic + (c.hook ? '' : ' · Q' + c.bank)));
      var q = el('div', 'cue' + (ear ? ' ms hide' : '')); q.innerHTML = '<span class="fr" style="font-family:var(--fr)">' + esc(c.qfr) + '</span>'; card.appendChild(q);
      if (ear) { q.onclick = function () { q.classList.remove('hide'); }; setTimeout(function () { say(c.qfr); }, 150); }
      var qe = hideEn(c.q); card.appendChild(qe); card.appendChild(listenBtn(c.qfr));
      var ans = el('div', ''); ans.hidden = true;
      c.lines.forEach(function (l) { ans.appendChild(line(l.fr, l.en, { guess: l.guess })); });
      ans.appendChild(listenBtn(c.lines.map(function (l) { return l.fr; }).join(' ')));
      if (c.hook) ans.appendChild(el('div', 'bout', 'Likely follow-up: ' + c.hook));
      card.appendChild(ans);
      return { reveal: function () { ans.hidden = false; q.classList.remove('hide'); }, next: function () { renderT1(root, { sub: sub, topic: opts && opts.topic }); } };
    }, null, function () { renderT1(root, { sub: sub, topic: opts && opts.topic }); });
  }
  function opener(root) {
    var O = SP.t1.opener, mode = store.get('t1.omode', 'read');
    tabs(root, 't1.omode', [['read', 'Read + shadow'], ['recall', 'Recall (French hidden)']], mode, function () { renderT1(root, { sub: 'opener' }); });
    var box = el('div', 'qcard');
    O.chunks.forEach(function (ch, i) {
      box.appendChild(el('div', 'wlabel', (i + 1) + ' · ' + ch.name + (i === 2 ? ' (optional: drop it if a take runs past 75 s; question 42 asks it anyway)' : '')));
      ch.lines.forEach(function (l) { box.appendChild(line(l.fr, l.en, { hide: mode === 'recall', guess: l.guess })); });
      box.appendChild(listenBtn(ch.lines.map(function (l) { return l.fr; }).join(' ')));
      box.appendChild(el('div', 'gap'));
    });
    box.appendChild(el('div', 'note', O.words + ' French words: about 75 s at a calm pace, 60–65 s without chunk 3. Stop after the Barcelona line, no summary. If the examiner cuts in, answer and drop the rest.'));
    root.appendChild(box);
    var r = el('div', 'qcard'); r.appendChild(el('div', 'wlabel', 'Say it, recorded (75-s clock; aim to finish by 75 s)'));
    var rec = recorder('t1.opener');
    r.appendChild(clock(0, 75, { talk: function () { if (!rec.isOn()) rec.start(); }, end: function () { if (rec.isOn()) rec.stop(); } }));
    r.appendChild(rec);
    root.appendChild(r);
  }
  function readAll(root) {
    SP.t1.topics.forEach(function (t) {
      root.appendChild(el('h3', 'phase', t));
      SP.t1.cards.filter(function (c) { return c.topic === t; }).forEach(function (c) {
        var d = el('details', 'model'); var s = el('summary'); s.textContent = (c.freq ? '★ ' : '') + 'Q' + c.bank + ' · ' + c.qfr; d.appendChild(s);
        d.appendChild(el('div', 'note', c.q));
        c.lines.forEach(function (l) { d.appendChild(line(l.fr, l.en, { guess: l.guess })); });
        root.appendChild(d);
      });
    });
  }

  /* =========================== TASK 2 =========================== */
  function renderT2(root, opts) {
    root.innerHTML = '';
    var T = SP.t2, sub = (opts && opts.sub) || store.get('t2.sub', 'kit');
    root.appendChild(el('div', 'note', 'Task 2, 5 min 30: 2 min prep, then 3 min 30 asking the examiner questions. Aim for 12–15 questions, the card\'s points first, and react to each answer. Register: tu for a friend or colleague; vous for staff, neighbours and strangers. Each card below shows its register.'));
    tabs(root, 't2.sub', [['kit', 'Question kit (' + T.chunks.length + ')'], ['drill', 'Kit drill'], ['fams', 'Top ' + T.fams.length + ' cards'], ['models', 'Your ' + T.models.length + ' answers']], sub, function (s) { renderT2(root, { sub: s }); });
    if (sub === 'kit') return kitSheet(root, T.chunks, ['open', 'ask', 'react', 'close', 'rescue']);
    if (sub === 'drill') return chunkDrill(root, 't2.deck', T.chunks, function () { renderT2(root, { sub: 'drill' }); });
    if (sub === 'models') return models(root, T.models);
    famList(root, T.fams, 'EO_T2', function (f, d, hide) {
      d.appendChild(el('div', 'note', 'Register: ' + f.reg));
      d.appendChild(line(f.opener_fr, null, { hide: hide }));
      var ol = el('ol', 'bdo');
      f.questions.forEach(function (q) { var li = el('li'); li.appendChild(line(q.fr, q.en, { hide: hide, gen: q.gen })); ol.appendChild(li); });
      d.appendChild(ol);
      d.appendChild(line(f.closer_fr, null, { hide: hide }));
      if (f.from && f.from.length) d.appendChild(el('div', 'bout', 'Built from your ' + f.from.join(', ')));
    });
  }
  /* =========================== TASK 3 =========================== */
  function renderT3(root, opts) {
    root.innerHTML = '';
    var T = SP.t3, sub = (opts && opts.sub) || store.get('t3.sub', 'skel');
    root.appendChild(el('div', 'note', 'Task 3, 4 min 30, no prep: take a side in the first 20 seconds, two arguments each with an example from your life, one concession, a conclusion. When the examiner pushes back, agree in part and come back to your side.'));
    tabs(root, 't3.sub', [['skel', 'Skeleton'], ['kit', 'Phrases (' + T.chunks.length + ')'], ['drill', 'Phrase drill'], ['themes', 'Your arguments'], ['fams', 'Top ' + T.fams.length + ' topics'], ['models', 'Your ' + T.models.length + ' answers']], sub, function (s) { renderT3(root, { sub: s }); });
    if (sub === 'skel') {
      var box = el('div', 'qcard');
      T.skeleton.forEach(function (s) { box.appendChild(el('div', 'wlabel', s.step + (s.secs ? ' · about ' + s.secs + ' s' : ''))); box.appendChild(line(s.fr, s.en, { gen: s.gen })); });
      root.appendChild(box); return;
    }
    if (sub === 'kit') return kitSheet(root, T.chunks, ['open', 'position', 'argue', 'example', 'concede', 'conclude', 'rescue']);
    if (sub === 'drill') return chunkDrill(root, 't3.deck', T.chunks, function () { renderT3(root, { sub: 'drill' }); });
    if (sub === 'models') return models(root, T.models);
    if (sub === 'themes') {
      T.themes.forEach(function (th) {
        root.appendChild(el('h3', 'phase', th.theme));
        th.args.forEach(function (a) { root.appendChild(line(a.fr, a.en)); });
      });
      return;
    }
    famList(root, T.fams, 'EO_T3', function (f, d, hide) {
      d.appendChild(line(f.position_fr, null, { hide: hide }));
      f.plan.forEach(function (p) { var w = el('div', ''); w.appendChild(el('span', 'reg', p.part)); w.appendChild(line(p.fr, p.en, { hide: hide, gen: p.gen })); d.appendChild(w); });
      if (f.borrow && f.borrow.length) d.appendChild(el('div', 'bout', 'Borrowed from your ' + f.borrow.join(', ')));
    });
  }

  function kitSheet(root, chunks, order) {
    order.forEach(function (cat) {
      var L = chunks.filter(function (c) { return c.cat === cat; }); if (!L.length) return;
      root.appendChild(el('h3', 'phase', cat));
      L.forEach(function (c) { var d = line(c.fr, c.en + (c.use ? ' · ' + c.use : ''), { gen: c.gen }); root.appendChild(d); });
    });
  }
  function chunkDrill(root, key, chunks, again) {
    root.appendChild(el('div', 'note', 'English cue → say the French out loud → Reveal.'));
    deck(root, key, chunks, function (c, card) {
      card.appendChild(el('div', 'qmeta', c.cat + (c.gen ? ' · generic' : c.src ? ' · from your ' + c.src : '') + (c.use ? ' · ' + c.use : '')));
      card.appendChild(el('div', 'cue', c.en));
      var a = el('div', 'ans', c.fr); a.hidden = true; card.appendChild(a);
      return { reveal: function () { a.hidden = false; card.appendChild(listenBtn(c.fr)); }, next: again };
    }, null, again);
  }
  function famList(root, fams, task, body) {
    var hide = store.get('fam.hide.' + task, false);
    var b = el('button', 'chip' + (hide ? ' on' : ''), hide ? 'Recall mode on (tap a line to see it)' : 'Recall mode off');
    b.onclick = function () { store.set('fam.hide.' + task, !hide); (task === 'EO_T2' ? renderT2 : renderT3)(root, { sub: 'fams' }); };
    root.appendChild(b);
    var tot = SP[task === 'EO_T2' ? 't2' : 't3'].totalListings;
    fams.forEach(function (f, i) {
      var d = el('details', 'model'); var s = el('summary'); s.textContent = (i + 1) + '. ' + f.prompt_fr; d.appendChild(s);
      d.appendChild(el('div', 'note', f.prompt_en + ' · listed ' + f.ff + '× (' + Math.round(100 * f.ff / tot) + '% of listings) · #' + f.n));
      body(f, d, hide);
      var p = el('button', 'mini', 'Practise this card ›'); p.onclick = function () { U.go('spad', { t: task, n: f.n }); }; d.appendChild(p);
      root.appendChild(d);
    });
  }
  function models(root, M) {
    var hide = store.get('models.sp.hide', false);
    var b = el('button', 'chip' + (hide ? ' on' : ''), hide ? 'Recall mode on' : 'Recall mode off');
    b.onclick = function () { store.set('models.sp.hide', !hide); root.innerHTML = ''; var v = store.get('view'); U.go(v); };
    root.appendChild(b);
    M.forEach(function (m) {
      var d = el('details', 'model'); var s = el('summary'); s.textContent = m.id + ' · ' + m.prompt_fr + (m.ff ? ' (family listed ' + m.ff + '×)' : ''); d.appendChild(s);
      d.appendChild(el('div', 'note', m.prompt_en + ' · ' + m.words + ' words'));
      m.paras.forEach(function (para) { para.forEach(function (ln) { ln.forEach(function (x) { d.appendChild(line(x.fr, x.en, { hide: hide })); }); }); d.appendChild(el('div', 'gap')); });
      root.appendChild(d);
    });
  }

  /* =========================== SPEAKING PAD =========================== */
  function promptList(t) {
    if (t === 'EO_T1') return SP.t1.cards.map(function (c) { return { n: c.bank, ff: c.freq ? 1 : 0, fr: c.qfr, en: c.q, fam: c.topic }; });
    return SP[t === 'EO_T2' ? 't2' : 't3'].prompts;
  }
  function renderPad(root, opts) {
    root.innerHTML = '';
    var P = store.get('spad', { t: 'EO_T3', idx: 0, list: null });
    if (opts && opts.t) { P.t = opts.t; P.idx = 0; P.list = opts.list || null; }
    var L = promptList(P.t);
    if (opts && opts.n != null) P.idx = Math.max(0, L.map(function (p) { return p.n; }).indexOf(opts.n));
    else if (opts && opts.list) P.idx = Math.max(0, L.map(function (p) { return p.n; }).indexOf(opts.list[0]));
    store.set('spad', P);
    var f = el('div', 'filters');
    Object.keys(TASKS).forEach(function (t) { var b = el('button', 'chip' + (P.t === t ? ' on' : ''), TASKS[t].name); b.onclick = function () { renderPad(root, { t: t }); }; f.appendChild(b); });
    root.appendChild(f);
    if (P.list && P.list.length) {
      var k = P.list.indexOf(L[P.idx] && L[P.idx].n);
      root.appendChild(el('div', 'nowlbl', 'SPRINT ' + (k + 1) + ' OF ' + P.list.length + ' · prompts ' + P.list.map(function (n) { return '#' + n; }).join(', ')));
    }
    var sel = el('select', 'psel');
    L.forEach(function (p, i) { var o = el('option', '', (P.t === 'EO_T1' ? (p.ff ? '★ ' : '') + 'Q' + p.n + ' · ' : '#' + p.n + ' · ' + (p.ff ? 'listed ' + p.ff + '× · ' : '')) + p.fr.slice(0, 110)); o.value = i; if (i === P.idx) o.selected = true; sel.appendChild(o); });
    sel.onchange = function () { P.idx = +sel.value; store.set('spad', P); renderPad(root); };
    root.appendChild(sel);
    var p = L[P.idx], key = P.t + ':' + p.n, TK = TASKS[P.t];
    var pb = el('div', 'prompt'); pb.appendChild(el('p', '', P.t === 'EO_T1' ? 'Bonjour. Présentez-vous, s\'il vous plaît. (then: ' + p.fr + ')' : p.fr)); pb.appendChild(hideEn(p.en)); root.appendChild(pb);
    root.appendChild(listenBtn(P.t === 'EO_T1' ? 'Bonjour. Présentez-vous, s\'il vous plaît.' : p.fr));
    var notes = null;
    if (P.t === 'EO_T2') {
      root.appendChild(el('div', 'wlabel', 'Prep notes (keywords only: the card\'s points, 12 question words, tu or vous)'));
      notes = el('textarea', 'pad small'); notes.value = store.get('prep.' + key, ''); notes.oninput = function () { store.set('prep.' + key, notes.value); }; root.appendChild(notes);
    }
    var rec = recorder(key);
    var T1Q = null;
    if (P.t === 'EO_T1') {
      T1Q = el('div', 'cue', '');
      var asked = [];
      var qs = SP.t1.cards.filter(function (c) { return c.freq; }).concat(SP.t1.cards.filter(function (c) { return !c.freq; }));
      var hooks = { talk: function () { asked = []; T1Q.textContent = 'Présentez-vous.'; say('Bonjour. Présentez-vous, s\'il vous plaît.'); if (!rec.isOn()) rec.start(); },
        tick: function (s) { var slot = s < 72 ? 0 : 1 + Math.floor((s - 72) / 16); if (slot > asked.length) { var pick = qs.filter(function (c) { return asked.indexOf(c) < 0; }); var c = pick[Math.floor(Math.random() * Math.min(pick.length, 25))]; asked.push(c); T1Q.textContent = c.qfr; say(c.qfr); } },
        end: function () { if (rec.isOn()) rec.stop(); } };
      root.appendChild(el('div', 'note', 'The page plays the examiner: it asks "Présentez-vous", then a follow-up at 72 s and every 16 s after (frequent questions first). In the exam the examiner cuts in when they like; stop your opener and answer.'));
      root.appendChild(clock(0, TK.secs, hooks)); root.appendChild(T1Q);
    } else {
      root.appendChild(clock(TK.prep, TK.secs, { talk: function () { if (!rec.isOn()) rec.start(); }, end: function () { if (rec.isOn()) rec.stop(); } }));
    }
    root.appendChild(rec);
    var acts = el('div', 'acts');
    acts.appendChild(copyBtn('Copy for grading', function () { return gradePrompt(P.t, P.t === 'EO_T1' ? 'Présentez-vous (then personal follow-up questions)' : p.fr, rec.text()); }));
    acts.appendChild(copyBtn('Copy examiner prompt (Claude voice mode)', function () { return examinerPrompt(P.t, p.fr); }));
    if (P.list && P.list.length) {
      var k2 = P.list.indexOf(p.n);
      if (k2 >= 0 && k2 < P.list.length - 1) { var nx = el('button', 'btn primary', 'Next sprint ›'); nx.onclick = function () { renderPad(root, { t: P.t, n: P.list[k2 + 1], list: P.list }); }; acts.appendChild(nx); }
    }
    root.appendChild(acts);
    root.appendChild(el('div', 'note', 'Listen back once with this check: Did I start within 3 s? Any silence over 5 s? ' + (P.t === 'EO_T2' ? 'How many questions? Did I react to answers?' : P.t === 'EO_T3' ? 'Side clear in 20 s? Two examples? A concession?' : 'Details and hooks, not bare facts?') + ' Then paste the grading prompt to Claude.'));
  }
  /* keep list across Next */
  var _rp = renderPad;
  renderPad = function (root, opts) { if (opts && opts.list) { var P = store.get('spad', {}); P.list = opts.list; store.set('spad', P); } _rp(root, opts); };

  /* =========================== SPEAKING MOCK =========================== */
  function pickWeighted(L) { var tot = L.reduce(function (a, p) { return a + (p.ff || 1); }, 0), r = Math.random() * tot; for (var i = 0; i < L.length; i++) { r -= (L[i].ff || 1); if (r <= 0) return L[i]; } return L[0]; }
  function renderMock(root) {
    root.innerHTML = '';
    var M = store.get('smock', null);
    root.appendChild(el('div', 'note', 'Full Expression orale in exam order: Task 1 (2:00), Task 2 (2:00 prep + 3:30), Task 3 (4:30). Cards drawn by how often they were reported. Best done with Claude voice mode playing the examiner (copy the prompt below); otherwise solo here: the page asks the Task 1 questions aloud and records each part.'));
    var nw = el('button', 'btn primary', M ? 'New mock (new cards)' : 'Draw a mock');
    nw.onclick = function () { var used = store.get('smock.used', {}); var t2 = pickWeighted(SP.t2.prompts.filter(function (p) { return !used['2:' + p.n]; })), t3 = pickWeighted(SP.t3.prompts.filter(function (p) { return !used['3:' + p.n]; })); used['2:' + t2.n] = 1; used['3:' + t3.n] = 1; store.set('smock.used', used); store.set('smock', { t2: t2.n, t3: t3.n, at: Date.now() }); renderMock(root); };
    root.appendChild(nw);
    if (!M) return;
    var p2 = SP.t2.prompts.filter(function (p) { return p.n === M.t2; })[0], p3 = SP.t3.prompts.filter(function (p) { return p.n === M.t3; })[0];
    var all = el('div', 'acts');
    all.appendChild(copyBtn('Copy examiner prompt for all 3 (Claude voice mode)', function () {
      return 'Act as a TCF Canada examiner for the whole Expression orale (12 min). Speak only French at exam pace; never correct me during the tasks; keep time.\n' +
        'Task 1 (2 min): "Bonjour. Présentez-vous, s\'il vous plaît." then 4-6 personal follow-ups that build on what I say.\n' +
        'Task 2: read me this card: «' + p2.fr + '». Wait while I prepare 2 min (I say "prêt"), then play the person on the card for 3 min 30, answering briefly with plausible details.\n' +
        'Task 3 (4 min 30): ask «' + p3.fr + '» and push back once or twice.\n' +
        'When all three are done (or I say "fin"), switch to English: a score /20 and NCLC estimate per task and overall, my 5 most costly errors with fixes, and the one thing to fix first.';
    }));
    root.appendChild(all);
    var parts = [['EO_T1', 'Présentez-vous, s\'il vous plaît. (puis questions personnelles)', null], ['EO_T2', p2.fr, p2.en], ['EO_T3', p3.fr, p3.en]];
    var recs = [];
    parts.forEach(function (x, i) {
      var sec = el('div', 'wtask'); sec.appendChild(el('h3', '', TASKS[x[0]].name));
      var pb = el('div', 'prompt'); pb.appendChild(el('p', '', x[1])); if (x[2]) pb.appendChild(hideEn(x[2])); sec.appendChild(pb);
      var rec = recorder('mock.' + M.at + '.' + x[0]); recs.push([x, rec]);
      if (x[0] === 'EO_T1') {
        var Q = el('div', 'cue', ''), asked = [];
        var qs = SP.t1.cards.filter(function (c) { return c.freq; }).concat(SP.t1.cards.filter(function (c) { return !c.freq; }));
        sec.appendChild(clock(0, 120, { talk: function () { asked = []; Q.textContent = 'Présentez-vous.'; say('Bonjour. Présentez-vous, s\'il vous plaît.'); rec.start(); },
          tick: function (s) { var slot = s < 72 ? 0 : 1 + Math.floor((s - 72) / 16); if (slot > asked.length) { var pick = qs.filter(function (c) { return asked.indexOf(c) < 0; }); var c = pick[Math.floor(Math.random() * Math.min(pick.length, 30))]; asked.push(c); Q.textContent = c.qfr; say(c.qfr); } },
          end: function () { if (rec.isOn()) rec.stop(); } }));
        sec.appendChild(Q);
      } else {
        if (x[0] === 'EO_T2') { var n = el('textarea', 'pad small'); n.placeholder = 'Prep notes: keywords only'; sec.appendChild(n); }
        sec.appendChild(listenBtn(x[1]));
        sec.appendChild(clock(TASKS[x[0]].prep, TASKS[x[0]].secs, { talk: function () { if (!rec.isOn()) rec.start(); }, end: function () { if (rec.isOn()) rec.stop(); } }));
      }
      sec.appendChild(rec);
      root.appendChild(sec);
    });
    var ac = el('div', 'acts');
    ac.appendChild(copyBtn('Copy all 3 for grading', function () {
      return 'You are a TCF Canada Expression orale examiner. Below are automatic speech-to-text transcripts of my 3 tasks (ignore punctuation, spelling and probable mishearings). For each task: score /20 and NCLC estimate, task completion, my 3 most costly errors with the fix. Then overall /20 and the single thing to fix first. Keep my own words in any correction; no fancier vocabulary. Reply in English, short.\n\n' +
        recs.map(function (r) { return '## ' + TASKS[r[0][0]].name + '\nConsigne: ' + r[0][1] + '\nTranscript:\n' + (r[1].text() || '(empty)'); }).join('\n\n');
    }));
    root.appendChild(ac);
  }

  window.SPEAKING = { t1: renderT1, t2: renderT2, t3: renderT3, pad: renderPad, mock: renderMock };
})();
