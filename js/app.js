/* ===== МатЛэнд: приложение (роутинг, прогресс, премиум, рейтинг) ===== */
(function () {
  const $ = s => document.querySelector(s);
  const PROMO_CODES = ['MATLAND2026', 'SCHOOL110', 'TEACHER', 'CHAMPION'];
  const API_ON = location.protocol.startsWith('http'); // file:// — рейтинг недоступен

  // ---------- хранилище ----------
  const store = {
    get(k, d) { try { const v = localStorage.getItem('ml_' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('ml_' + k, JSON.stringify(v)); } catch (e) {} }
  };
  const getStars = id => store.get('stars', {})[id] || 0;
  const setStars = (id, s) => { const all = store.get('stars', {}); if (s > (all[id] || 0)) { all[id] = s; store.set('stars', all); } };
  const isPro = () => store.get('pro', false);
  const getBest = id => store.get('best', {})[id] || 0;
  const setBest = (id, s) => { const all = store.get('best', {}); if (s > (all[id] || 0)) { all[id] = s; store.set('best', all); return true; } return false; };

  // ---------- профиль игрока ----------
  function playerId() {
    let id = store.get('pid', null);
    if (!id) {
      id = (crypto.randomUUID ? crypto.randomUUID() : 'p' + Date.now() + Math.random().toString(36).slice(2, 10));
      store.set('pid', id);
    }
    return id;
  }
  const getProfile = () => store.get('profile', null);

  // ---------- фильтр нецензурных слов ----------
  const BAD_ROOTS = ['хуй', 'хуя', 'хуе', 'хуё', 'хуи', 'пизд', 'ебан', 'ебал', 'ебат', 'ебуч', 'ёбан', 'ёбл', 'заеб', 'заёб', 'уёб', 'ублюд', 'бля', 'мудак', 'мудил', 'гандон', 'гондон', 'пидор', 'пидар', 'пидр', 'педик', 'шлюх', 'дроч', 'залуп', 'мразь', 'сука', 'суки', 'сучк', 'говн', 'дерьм', 'жопа', 'жопу', 'срал', 'сран', 'еблан'];
  const LOOKALIKE = { a: 'а', b: 'в', c: 'с', e: 'е', k: 'к', m: 'м', h: 'н', o: 'о', p: 'р', t: 'т', x: 'х', y: 'у', u: 'и', '0': 'о', '3': 'з', '4': 'ч', '6': 'б' };
  function isProfane(s) {
    const norm = String(s || '').toLowerCase()
      .split('').map(c => LOOKALIKE[c] || c).join('')
      .replace(/[^а-яё]/g, '');
    return BAD_ROOTS.some(r => norm.includes(r));
  }

  // ---------- лайки ----------
  let likesData = { counts: {}, mine: [] };
  async function loadLikes() {
    if (!API_ON) return;
    try {
      const r = await fetch('/api/likes?player=' + encodeURIComponent(playerId()));
      likesData = await r.json();
      if (!likesData.counts) likesData = { counts: {}, mine: [] };
    } catch (e) {}
  }
  function likeLabel(id) {
    const n = likesData.counts[id] || 0;
    const my = likesData.mine.includes(id);
    return (my ? '❤️' : '🤍') + ' ' + n;
  }
  async function toggleLike(id, btn) {
    if (!API_ON) return;
    btn.disabled = true;
    try {
      const r = await fetch('/api/like', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ player: { id: playerId() }, gameId: id })
      });
      const j = await r.json();
      likesData.counts[id] = j.count;
      if (j.liked) likesData.mine.push(id);
      else likesData.mine = likesData.mine.filter(x => x !== id);
      btn.textContent = likeLabel(id);
      btn.classList.toggle('liked', j.liked);
    } catch (e) {}
    btn.disabled = false;
  }

  // ---------- виды ----------
  const views = ['home', 'grades', 'grade', 'play', 'top'];
  function show(name) {
    views.forEach(v => { const e = $('#view-' + v); if (e) e.hidden = v !== name; });
    window.scrollTo(0, 0);
  }

  // ---------- выбор класса ----------
  function renderGrades() {
    const grid = $('#grade-grid');
    grid.innerHTML = '';
    window.GRADES.forEach(g => {
      const total = g.games.reduce((s, game) => s + getStars(game.id), 0);
      const a = document.createElement('a');
      a.className = 'grade-card';
      a.href = '#/grade/' + g.n;
      a.style.setProperty('--gc', `linear-gradient(135deg, ${g.color}, ${g.color}88)`);
      a.innerHTML = `<div class="grade-num">${g.n}</div>
        <div class="grade-lbl">класс</div>
        <div class="grade-topics">${g.topics}</div>
        <div class="grade-stars">★ ${total}/30</div>`;
      grid.appendChild(a);
    });
  }

  // ---------- каталог игр ----------
  let curGrade = null;
  function renderGrade(n) {
    const g = window.GRADES.find(x => x.n === n);
    if (!g) { location.hash = '#/grades'; return; }
    curGrade = g;
    $('#grade-title').textContent = n + ' класс';
    $('#grade-sub').textContent = g.topics;
    const grid = $('#game-grid');
    grid.innerHTML = '';
    g.games.forEach(game => {
      const locked = game.premium && !isPro();
      const b = document.createElement('button');
      b.className = 'game-card' + (locked ? ' locked' : '');
      b.style.setProperty('--ac', g.color);
      b.style.setProperty('--ac-bg', g.color + '26');
      const stars = getStars(game.id);
      b.innerHTML = `
        ${game.premium ? '<span class="badge-premium">👑 PREMIUM</span>' : ''}
        <div class="game-ico">${locked ? '🔒' : game.ico}</div>
        <div class="game-name">${game.name}</div>
        <div class="game-desc">${game.desc}</div>
        <div class="game-meta">
          <span class="game-mech">${window.MECH_NAMES[game.mech] || game.mech}</span>
          <span class="meta-right">
            ${API_ON ? `<button class="like-btn ${likesData.mine.includes(game.id) ? 'liked' : ''}" title="Нравится">${likeLabel(game.id)}</button>` : ''}
            <button class="game-mech lb-btn" title="Рейтинг игры">🏆</button>
            <span class="game-stars">${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}</span>
          </span>
        </div>`;
      b.querySelector('.lb-btn').onclick = e => { e.stopPropagation(); location.hash = '#/top/' + game.id; };
      const likeBtn = b.querySelector('.like-btn');
      if (likeBtn) likeBtn.onclick = e => { e.stopPropagation(); toggleLike(game.id, likeBtn); };
      b.onclick = () => {
        if (locked) { openModal('#modal-premium'); return; }
        location.hash = '#/play/' + game.id;
      };
      grid.appendChild(b);
    });
  }

  // ---------- игра ----------
  let engineCtl = null, curGame = null, playT0 = 0, playTimer = null;
  const fmtTime = s => { s = Math.max(0, Math.round(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
  function findGame(id) {
    for (const g of window.GRADES) { const f = g.games.find(x => x.id === id); if (f) return { g, game: f }; }
    return null;
  }
  function startPlay(id) {
    const found = findGame(id);
    if (!found) { location.hash = '#/grades'; return; }
    if (found.game.premium && !isPro()) { location.hash = '#/grade/' + found.g.n; return; }
    curGame = found;
    $('#play-name').textContent = found.game.ico + ' ' + found.game.name;
    $('#play-hud').textContent = '';
    stopEngine();
    playT0 = performance.now();
    $('#play-timer').textContent = '0:00';
    playTimer = setInterval(() => { $('#play-timer').textContent = fmtTime((performance.now() - playT0) / 1000); }, 1000);
    engineCtl = window.Engine.start(found.game.mech, found.game.gen, $('#game-root'), {
      hud: t => { $('#play-hud').textContent = t; },
      end: res => showResult(res)
    }, { grade: found.g.n, goal: found.game.goal });
  }
  function stopEngine() {
    if (engineCtl) { engineCtl.stop(); engineCtl = null; }
    if (playTimer) { clearInterval(playTimer); playTimer = null; }
  }

  // Очки: 100 за верный ответ + 250 за звезду + бонус за скорость
  // (бонус только при результате хотя бы в 1 звезду, до 600 очков;
  //  в спринтах время фиксировано — бонуса нет, решают количество верных)
  function calcScore(res) {
    const t = Math.round(res.timeSec || (performance.now() - playT0) / 1000);
    const base = Math.max(0, (res.correct || 0) * 100 + (res.stars || 0) * 250);
    const bonus = (res.stars > 0 && !res.noTimeBonus) ? Math.max(0, 600 - 2 * t) : 0;
    return { score: base + bonus, bonus, t };
  }
  function showResult(res) {
    if (playTimer) { clearInterval(playTimer); playTimer = null; }
    setStars(curGame.game.id, res.stars);
    const { score, bonus, t } = calcScore(res);
    const improved = setBest(curGame.game.id, score);
    if (improved) store.set('btime', Object.assign(store.get('btime', {}), { [curGame.game.id]: t }));
    submitScore(curGame.game.id);
    $('#result-ico').textContent = res.stars >= 3 ? '🏆' : res.stars === 2 ? '🎉' : res.stars === 1 ? '👍' : '💪';
    $('#result-title').textContent = res.title || (res.stars > 0 ? 'Готово!' : 'Попробуй ещё!');
    $('#result-stars').innerHTML =
      '<span style="color:var(--gold)">' + '★'.repeat(res.stars) + '</span>' +
      '<span style="color:var(--line)">' + '★'.repeat(3 - res.stars) + '</span>';
    $('#result-text').textContent = (res.text || `Верных ответов: ${res.correct} из ${res.total}`) +
      ` · Время: ${fmtTime(t)} · Очки: ${score}` + (bonus ? ` (бонус за скорость +${bonus})` : '');
    const rm = $('#result-mistakes');
    if (res.mistakes && res.mistakes.length) {
      rm.innerHTML = '<div class="rm-title">Разбор ошибок:</div>' +
        res.mistakes.map(m => `<div class="rm-item">✗ ${esc(m)}</div>`).join('');
    } else {
      rm.innerHTML = res.total ? '<div class="rm-title">Без единой ошибки — красота! ✨</div>' : '';
    }
    openModal('#modal-result');
  }

  // ---------- рейтинг ----------
  async function submitScore(gameId) {
    const p = getProfile();
    const score = getBest(gameId);
    if (!API_ON || !p || !score) return;
    try {
      await fetch('/api/score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          player: Object.assign({ id: playerId() }, p),
          gameId, score,
          stars: getStars(gameId),
          time: store.get('btime', {})[gameId] || 0
        })
      });
    } catch (e) {}
  }

  const esc = s => String(s || '').replace(/[<>&"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]));

  async function renderTop(gameId) {
    const found = findGame(gameId);
    if (!found) { location.hash = '#/grades'; return; }
    $('#top-title').textContent = found.game.ico + ' ' + found.game.name;
    $('#top-back').href = '#/grade/' + found.g.n;
    const table = $('#top-table'), banner = $('#top-banner'), msg = $('#top-msg');
    banner.innerHTML = ''; msg.textContent = '';
    table.innerHTML = '<div class="lb-empty"><div class="g-bigico">⏳</div>Загружаем рейтинг…</div>';

    if (!API_ON) {
      table.innerHTML = '<div class="lb-empty"><div class="g-bigico">📡</div>Рейтинг работает, когда сайт открыт с сервера (Railway).<br>Локально с диска соревнование недоступно.</div>';
      return;
    }
    if (!getProfile()) {
      table.innerHTML = '<div class="lb-empty"><div class="g-bigico">🧑‍🎓</div>Заполни анкету игрока, чтобы попасть в рейтинг!</div>';
      openModal('#modal-profile');
      return;
    }
    // дошлём лучший результат (если играли до заполнения анкеты)
    await submitScore(gameId);
    let data;
    try {
      const r = await fetch('/api/leaderboard/' + encodeURIComponent(gameId) + '?player=' + encodeURIComponent(playerId()));
      data = await r.json();
    } catch (e) {
      table.innerHTML = '<div class="lb-empty"><div class="g-bigico">😴</div>Не получилось загрузить рейтинг. Проверь интернет и обнови страницу.</div>';
      return;
    }
    if (!data.top || !data.top.length) {
      table.innerHTML = '<div class="lb-empty"><div class="g-bigico">🌱</div>Пока никто не играл. Стань первым в топе!</div>';
      return;
    }
    if (data.reward) {
      banner.innerHTML = `<div class="lb-banner">🏅 <b>Ты в тройке лидеров!</b> Твой призовой промокод на премиум: <code>${esc(data.reward)}</code></div>`;
    }
    const medals = ['🥇', '🥈', '🥉'];
    table.innerHTML = data.top.map(r => `
      <div class="lb-row ${r.rank <= 3 ? 'medal-' + r.rank : ''} ${r.me ? 'me' : ''}">
        <div class="lb-rank">${r.rank <= 3 ? medals[r.rank - 1] : r.rank}</div>
        <div class="lb-who"><b>${esc(r.name)} ${esc(r.surname)}${r.me ? ' (ты)' : ''}</b>
          <span>${esc(r.city)} · шк. ${esc(r.school)} · ${r.grade} класс</span></div>
        <div class="lb-pts">${r.score}<small>${'★'.repeat(r.stars || 0)}${r.time ? ' · ' + fmtTime(r.time) : ''}</small></div>
      </div>`).join('');
    if (data.me && data.me.rank > 20) {
      table.innerHTML += `<div class="lb-sep">•••</div>
        <div class="lb-row me">
          <div class="lb-rank">${data.me.rank}</div>
          <div class="lb-who"><b>Это ты!</b><span>Всего участников: ${data.total}</span></div>
          <div class="lb-pts">${data.me.score}<small>${'★'.repeat(data.me.stars || 0)}${data.me.time ? ' · ' + fmtTime(data.me.time) : ''}</small></div>
        </div>`;
      msg.textContent = 'До топ-20 осталось совсем немного — сыграй ещё раз!';
    } else if (data.me) {
      msg.textContent = data.me.rank <= 3 ? 'Ты на пьедестале! Удержи позицию 💪' : 'Ты в топ-20! Улучши результат и поднимись выше.';
    }
  }

  // ---------- анкета ----------
  const gradeSel = $('#pf-grade');
  gradeSel.innerHTML = '<option value="" disabled selected>Класс</option>' +
    Array.from({ length: 11 }, (_, i) => `<option value="${i + 1}">${i + 1} класс</option>`).join('');
  function fillProfileForm() {
    const p = getProfile() || {};
    $('#pf-name').value = p.name || '';
    $('#pf-surname').value = p.surname || '';
    $('#pf-city').value = p.city || '';
    $('#pf-school').value = p.school || '';
    if (p.grade) gradeSel.value = p.grade;
  }
  $('#profile-form').addEventListener('submit', e => {
    e.preventDefault();
    const p = {
      name: $('#pf-name').value.trim(),
      surname: $('#pf-surname').value.trim(),
      city: $('#pf-city').value.trim(),
      school: $('#pf-school').value.trim(),
      grade: +gradeSel.value || 1
    };
    if (!p.name || !p.surname) return;
    if ([p.name, p.surname, p.city, p.school].some(isProfane)) {
      $('#profile-msg').textContent = 'Пожалуйста, без грубых слов 🙂 Исправь анкету.';
      $('#profile-msg').className = 'promo-msg bad';
      return;
    }
    store.set('profile', p);
    $('#profile-msg').textContent = 'Сохранено! Теперь твои результаты попадают в рейтинг 🏆';
    $('#profile-msg').className = 'promo-msg ok';
    setTimeout(() => { closeModals(); route(); }, 800);
  });
  $('#btn-profile').onclick = () => { fillProfileForm(); openModal('#modal-profile'); };

  // ---------- модалки ----------
  function openModal(sel) { if (sel === '#modal-profile') fillProfileForm(); $(sel).hidden = false; }
  function closeModals() { document.querySelectorAll('.modal-wrap').forEach(m => { m.hidden = true; }); }
  document.querySelectorAll('.modal-wrap').forEach(m => {
    m.addEventListener('click', e => { if (e.target === m || e.target.hasAttribute('data-close')) closeModals(); });
  });

  // ---------- оплата ----------
  let payCfg = { yookassa: false, telegram: null, price: null };
  async function loadPayConfig() {
    if (!API_ON) return;
    try { payCfg = await (await fetch('/api/config')).json(); } catch (e) {}
    const tg = $('#btn-pay-tg');
    if (payCfg.telegram) tg.href = payCfg.telegram;
  }
  async function syncPro() {
    if (!API_ON || isPro()) return;
    try {
      const j = await (await fetch('/api/pay/status?player=' + encodeURIComponent(playerId()))).json();
      if (j.pro) { store.set('pro', true); route(); }
    } catch (e) {}
  }
  $('#btn-buy').onclick = () => {
    $('#btn-buy').hidden = true;
    $('#pay-options').hidden = false;
    if (payCfg.price) $('#btn-pay-sbp').textContent = `🏦 СБП / карта — ${payCfg.price} ₽ (ЮKassa)`;
  };
  $('#btn-pay-sbp').onclick = async () => {
    const msg = $('#promo-msg');
    if (!API_ON || !payCfg.yookassa) {
      msg.textContent = 'Оплата через ЮKassa подключается — совсем скоро! Пока можно ввести промокод.';
      msg.className = 'promo-msg';
      return;
    }
    msg.textContent = 'Создаём платёж…'; msg.className = 'promo-msg';
    try {
      const r = await fetch('/api/pay/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ player: { id: playerId() } })
      });
      const j = await r.json();
      if (j.url) location.href = j.url;
      else { msg.textContent = j.error || 'Не получилось создать платёж'; msg.className = 'promo-msg bad'; }
    } catch (e) { msg.textContent = 'Ошибка сети. Попробуй ещё раз.'; msg.className = 'promo-msg bad'; }
  };
  $('#btn-pay-tg').onclick = e => {
    if (!payCfg.telegram) {
      e.preventDefault();
      $('#promo-msg').textContent = 'Telegram-бот подключается — совсем скоро! Пока можно ввести промокод.';
      $('#promo-msg').className = 'promo-msg';
    }
  };
  const applyPromo = () => {
    const v = ($('#promo-input').value || '').trim().toUpperCase();
    const msg = $('#promo-msg');
    if (PROMO_CODES.includes(v)) {
      store.set('pro', true);
      msg.textContent = 'Промокод принят! Все 33 премиум-игры открыты 🎉';
      msg.className = 'promo-msg ok';
      setTimeout(() => { closeModals(); route(); }, 900);
    } else {
      msg.textContent = 'Такой промокод не найден';
      msg.className = 'promo-msg bad';
    }
  };
  $('#btn-promo-apply').onclick = applyPromo;
  $('#promo-input').addEventListener('keydown', e => { if (e.key === 'Enter') applyPromo(); });
  $('#btn-promo').onclick = () => openModal('#modal-premium');

  $('#btn-again').onclick = () => { closeModals(); if (curGame) startPlay(curGame.game.id); };
  $('#btn-top').onclick = () => { closeModals(); if (curGame) location.hash = '#/top/' + curGame.game.id; };
  $('#btn-tolist').onclick = () => { closeModals(); location.hash = '#/grade/' + (curGame ? curGame.g.n : 1); };
  $('#btn-exit').onclick = () => { location.hash = '#/grade/' + (curGame ? curGame.g.n : 1); };

  // ---------- роутер ----------
  function route() {
    stopEngine();
    closeModals();
    const h = location.hash || '#/';
    let m;
    if ((m = h.match(/^#\/grade\/(\d+)$/))) {
      const n = +m[1];
      renderGrade(n); show('grade');
      loadLikes().then(() => { if (location.hash === h) renderGrade(n); }); // обновить счётчики лайков
    }
    else if ((m = h.match(/^#\/play\/([\w-]+)$/))) { show('play'); startPlay(m[1]); }
    else if ((m = h.match(/^#\/top\/([\w-]+)$/))) { show('top'); renderTop(m[1]); }
    else if (h === '#/grades') { renderGrades(); show('grades'); }
    else { show('home'); }
  }
  window.addEventListener('hashchange', route);
  route();
  loadPayConfig();
  syncPro();
  // вернулись после оплаты — подождём подтверждение от ЮKassa
  if (new URLSearchParams(location.search).has('paid')) {
    let tries = 0;
    const poll = setInterval(async () => {
      await syncPro();
      if (isPro() || ++tries > 6) {
        clearInterval(poll);
        if (isPro()) alert('Оплата прошла! Все премиум-игры открыты 🎉');
        history.replaceState(null, '', location.pathname + location.hash);
      }
    }, 2500);
  }
})();
