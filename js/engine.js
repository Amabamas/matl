/* ===== МатЛэнд: игровой движок v2 =====
   Engine.start(mech, genId, rootEl, hooks, opts) -> {stop()}
   hooks: hud(text), end({correct,total,stars,title,text,timeSec})
   opts:  {grade: 1..11}

   Возрастной стандарт:
   - T = время «на подумать» растёт с классом (1 кл ≈ 7с, 11 кл ≈ 18с),
     потому что задачи старших классов сложнее — темп игры это учитывает;
   - в канвас-играх объекты НЕ исчезают: улетел — вернётся по кругу,
     вопрос не меняется, пока не дан верный ответ;
   - вся физика на dt — одинаковая скорость на любом железе и fps.
*/
(function () {
  const P = () => window.Problems.gens;
  const pick = a => a[Math.floor(Math.random() * a.length)];

  function el(tag, cls, html) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html !== undefined) e.innerHTML = html;
    return e;
  }
  function starsBy(correct, total) {
    const r = total ? correct / total : 0;
    return r >= 0.9 ? 3 : r >= 0.65 ? 2 : r >= 0.35 ? 1 : 0;
  }
  function vibrate(ms) { if (navigator.vibrate) try { navigator.vibrate(ms); } catch (e) {} }

  // ---------- разбор ошибок: чип с верным решением улетает на свободное поле сбоку, игра не останавливается ----------
  function mistake(ctl, root, text) {
    if (!ctl.alive || ctl.mistakes.length >= 30) return;
    ctl.mistakes.push(text);
    let tray = document.querySelector('.err-tray');
    if (!tray) { tray = el('div', 'err-tray'); document.body.appendChild(tray); }
    const chip = el('div', 'err-chip', text);
    tray.prepend(chip);
    while (tray.children.length > 7) tray.removeChild(tray.lastChild); // сбоку — последние 7, полный список в итогах
    // анимация: чип стартует из центра игрового поля и плавно летит на своё место сбоку
    const cr = chip.getBoundingClientRect();
    const rr = root.getBoundingClientRect();
    const dx = (rr.left + rr.width / 2) - (cr.left + cr.width / 2);
    const dy = (rr.top + rr.height * 0.35) - (cr.top + cr.height / 2);
    chip.style.transform = `translate(${dx}px, ${dy}px) scale(1.2)`;
    requestAnimationFrame(() => requestAnimationFrame(() => {
      chip.classList.add('settled');
      chip.style.transform = 'translate(0, 0) scale(1)';
    }));
  }
  function clearTray() { document.querySelectorAll('.err-tray').forEach(t => t.remove()); }
  // короткое пояснение: подставляем верный ответ в вопрос
  const mcqText = p => {
    const q = p.q;
    if (/=\s*\?[^?]*$/.test(q)) return q.replace(/=\s*\?[^?]*$/, '= ' + p.a);  // «…, x = ?» → «…, x = 5»
    if (/\?\s*=/.test(q)) return q.replace('?', p.a);                           // «7 + ? = 12» → «7 + 5 = 12»
    if (/,\s*\?$/.test(q)) return q.replace(/\?$/, p.a);                        // «2, 6, 18, ?» → «2, 6, 18, 54»
    if (/\?$/.test(q)) return q + ' → ' + p.a;                                  // «Что после 17?» → «… → 18»
    return q + ' = ' + p.a;                                                     // «7 + 5» → «7 + 5 = 12»
  };

  // Вопрос + 4 варианта. cb(isRight, p)
  function askMCQ(box, p, cb, lockMs) {
    box.innerHTML = '';
    const q = el('div', 'g-question', p.q);
    const grid = el('div', 'g-options');
    box.appendChild(q); box.appendChild(grid);
    let done = false;
    p.opts.forEach(o => {
      const b = el('button', 'g-opt', o);
      b.onclick = () => {
        if (done) return;
        done = true;
        const right = o === p.a;
        b.classList.add(right ? 'right' : 'wrong');
        if (!right) {
          vibrate(60);
          [...grid.children].forEach(c => { if (c.textContent === p.a) c.classList.add('right'); });
        }
        setTimeout(() => cb(right, p), lockMs || 650);
      };
      grid.appendChild(b);
    });
  }

  // ---------- база сессии ----------
  function makeCtl() {
    const ctl = { alive: true, timers: [], raf: 0, t0: performance.now(), mistakes: [], noTimeBonus: false };
    ctl.later = (fn, ms) => { const t = setTimeout(() => { if (ctl.alive) fn(); }, ms); ctl.timers.push(t); return t; };
    ctl.stop = () => { ctl.alive = false; ctl.timers.forEach(clearTimeout); cancelAnimationFrame(ctl.raf); clearTray(); };
    ctl.elapsed = () => (performance.now() - ctl.t0) / 1000;
    return ctl;
  }
  function finish(ctl, hooks, correct, total, forceStars, title, text) {
    if (!ctl.alive) return;
    const timeSec = ctl.elapsed();
    ctl.stop();
    const stars = forceStars !== undefined ? forceStars : starsBy(correct, total);
    hooks.end({ correct, total, stars, title, text, timeSec, mistakes: ctl.mistakes, noTimeBonus: ctl.noTimeBonus });
  }

  const M = {};

  /* ========== СПРИНТ: время растёт с классом ========== */
  M.sprint = (gen, root, hooks, ctl, T) => {
    ctl.noTimeBonus = true; // время фиксировано — очки только за решённые примеры
    const LIMIT = Math.round(60 + (T.grade - 1) * 3); // 1 кл: 60с … 11 кл: 90с
    const base = LIMIT / T.think;                     // сколько задач реально успеть
    const t3 = T.goal || Math.max(3, Math.ceil(base * 0.9));
    const t2 = Math.max(2, Math.ceil(t3 * 0.6)), t1 = Math.max(1, Math.ceil(t3 * 0.27));
    let correct = 0, total = 0, time = LIMIT;
    const wrap = el('div', 'g-wrap');
    const row = el('div', 'g-row');
    const timerEl = el('span', 'g-timer', '' + LIMIT);
    const left = el('span', '', '⏱ ');
    left.appendChild(timerEl);
    row.appendChild(left);
    row.appendChild(el('span', '', `Цель: ${t3} ⭐⭐⭐`));
    const scoreEl = el('span', '', 'Верно: 0');
    row.appendChild(scoreEl);
    const box = el('div');
    wrap.appendChild(row); wrap.appendChild(box); root.appendChild(wrap);
    const tick = () => {
      if (!ctl.alive) return;
      time--; timerEl.textContent = time;
      if (time <= 10) timerEl.classList.add('low');
      if (time <= 0) {
        const st = correct >= t3 ? 3 : correct >= t2 ? 2 : correct >= t1 ? 1 : 0;
        return finish(ctl, hooks, correct, Math.max(total, 1), st, 'Время вышло!', `Решено верно: ${correct} (цель на 3★ — ${t3})`);
      }
      ctl.later(tick, 1000);
    };
    ctl.later(tick, 1000);
    const next = () => {
      if (!ctl.alive) return;
      askMCQ(box, gen(), (r, p) => { total++; if (r) correct++; else mistake(ctl, root, mcqText(p)); scoreEl.textContent = 'Верно: ' + correct; hooks.hud('⭐ ' + correct); next(); }, 400);
    };
    next();
  };

  /* ========== ДУЭЛЬ (пошаговая — время не давит) ========== */
  M.duel = (gen, root, hooks, ctl) => {
    let you = 100, bot = 100, correct = 0, total = 0;
    const wrap = el('div', 'g-wrap');
    const heads = el('div', 'duel-heads');
    const mkSide = (face, name) => {
      const s = el('div', 'duel-side');
      const f = el('div', 'duel-face', face);
      const bar = el('div', 'g-bar hp'); bar.appendChild(el('i'));
      bar.firstChild.style.width = '100%';
      s.appendChild(f); s.appendChild(bar);
      s.appendChild(el('div', 'duel-hpnum', name));
      return { s, f, bar: bar.firstChild };
    };
    const L = mkSide('🧒', 'Ты'), Rt = mkSide('🤖', 'Робо-Математик');
    heads.appendChild(L.s); heads.appendChild(el('div', 'duel-face', '⚔️')); heads.appendChild(Rt.s);
    const msg = el('div', 'g-msg');
    const box = el('div');
    wrap.appendChild(heads); wrap.appendChild(msg); wrap.appendChild(box); root.appendChild(wrap);
    const upd = () => { L.bar.style.width = Math.max(you, 0) + '%'; Rt.bar.style.width = Math.max(bot, 0) + '%'; hooks.hud(`❤️ ${Math.max(you, 0)}`); };
    const next = () => {
      if (!ctl.alive) return;
      if (bot <= 0) return finish(ctl, hooks, correct, total, correct >= total * 0.9 ? 3 : correct >= total * 0.7 ? 2 : 1, 'Победа!', 'Робо-Математик повержен! ⚔️');
      if (you <= 0) return finish(ctl, hooks, correct, total, 0, 'Поражение…', 'Робот оказался точнее. Попробуй ещё раз!');
      askMCQ(box, gen(), (r, p) => {
        total++;
        if (r) { correct++; bot -= 20; Rt.f.classList.remove('hit-flash'); void Rt.f.offsetWidth; Rt.f.classList.add('hit-flash'); msg.textContent = 'Точный удар! −20 роботу'; msg.className = 'g-msg ok'; }
        else { mistake(ctl, root, mcqText(p)); you -= 20; L.f.classList.remove('hit-flash'); void L.f.offsetWidth; L.f.classList.add('hit-flash'); msg.textContent = 'Робот атакует! −20 тебе'; msg.className = 'g-msg bad'; }
        upd(); next();
      });
    };
    upd(); next();
  };

  /* ========== БОСС-БИТВА (пошаговая) ========== */
  M.boss = (gen, root, hooks, ctl) => {
    let hp = 100, lives = 3, correct = 0, total = 0;
    const face = pick(['🐉', '👾', '🦖', '🧟', '👹']);
    const wrap = el('div', 'g-wrap');
    const top = el('div');
    const f = el('div', 'duel-face', face); f.style.fontSize = '56px'; f.style.textAlign = 'center';
    const bar = el('div', 'g-bar hp'); bar.appendChild(el('i')); bar.firstChild.style.width = '100%';
    top.appendChild(f); top.appendChild(bar);
    const livesEl = el('div', 'g-msg', '❤️❤️❤️');
    const box = el('div');
    wrap.appendChild(top); wrap.appendChild(livesEl); wrap.appendChild(box); root.appendChild(wrap);
    const next = () => {
      if (!ctl.alive) return;
      if (hp <= 0) return finish(ctl, hooks, correct, total, lives === 3 ? 3 : lives === 2 ? 2 : 1, 'Босс повержен!', `${face} побеждён! Осталось жизней: ${lives}`);
      if (lives <= 0) return finish(ctl, hooks, correct, total, 0, 'Босс победил…', 'Потренируйся и возвращайся!');
      askMCQ(box, gen(), (r, p) => {
        total++;
        if (r) { correct++; hp -= 20; f.classList.remove('hit-flash'); void f.offsetWidth; f.classList.add('hit-flash'); }
        else { mistake(ctl, root, mcqText(p)); lives--; livesEl.textContent = '❤️'.repeat(lives) + '🖤'.repeat(3 - lives); }
        bar.firstChild.style.width = Math.max(hp, 0) + '%';
        hooks.hud('💥 ' + (100 - Math.max(hp, 0)) / 20 + '/5');
        next();
      });
    };
    next();
  };

  /* ========== ТРОПА (пошаговая) ========== */
  M.path = (gen, root, hooks, ctl) => {
    const STEPS = 8;
    let step = 0, lives = 3, correct = 0, total = 0;
    const wrap = el('div', 'g-wrap');
    const map = el('div', 'path-map');
    for (let i = 0; i < STEPS; i++) map.appendChild(el('div', 'path-step'));
    const livesEl = el('div', 'g-msg', '❤️❤️❤️');
    const q = el('div', 'g-question');
    const doors = el('div', 'path-doors');
    wrap.appendChild(map); wrap.appendChild(livesEl); wrap.appendChild(q); wrap.appendChild(doors);
    root.appendChild(wrap);
    const updMap = () => { [...map.children].forEach((d, i) => { d.className = 'path-step' + (i < step ? ' done' : i === step ? ' here' : ''); }); hooks.hud(`🚩 ${step}/${STEPS}`); };
    const next = () => {
      if (!ctl.alive) return;
      if (step >= STEPS) return finish(ctl, hooks, correct, total, lives === 3 ? 3 : lives === 2 ? 2 : 1, 'Тропа пройдена!', 'Ты выбрался из математического леса! 🌲');
      if (lives <= 0) return finish(ctl, hooks, correct, total, 0, 'Заблудился…', 'Лес запутал тебя. Попробуй снова!');
      updMap();
      const p = gen();
      q.textContent = p.q;
      doors.innerHTML = '';
      let opts = p.opts.slice(0, 3);
      if (!opts.includes(p.a)) opts[Math.floor(Math.random() * 3)] = p.a;
      opts.forEach(o => {
        const d = el('button', 'path-door', o);
        d.onclick = () => {
          total++;
          if (o === p.a) { correct++; step++; next(); }
          else { mistake(ctl, root, mcqText(p)); lives--; livesEl.textContent = '❤️'.repeat(lives) + '🖤'.repeat(3 - lives); d.classList.add('err'); vibrate(60); if (lives <= 0) next(); }
        };
        doors.appendChild(d);
      });
    };
    next();
  };

  /* ========== БАШНЯ (пошаговая) ========== */
  M.tower = (gen, root, hooks, ctl) => {
    const GOAL = 10;
    let height = 0, correct = 0, total = 0;
    const wrap = el('div', 'g-wrap');
    const towerBox = el('div');
    towerBox.style.cssText = 'display:flex;flex-direction:column-reverse;align-items:center;gap:3px;min-height:120px;justify-content:flex-start';
    const box = el('div');
    const msg = el('div', 'g-msg');
    wrap.appendChild(towerBox); wrap.appendChild(msg); wrap.appendChild(box);
    root.appendChild(wrap);
    const colors = ['#7c5cff', '#00d4ff', '#ff5ca8', '#ffc247', '#3ddc84'];
    const addBlock = () => {
      const b = el('div');
      b.style.cssText = `width:${Math.max(46, 120 - height * 7)}px;height:16px;border-radius:6px;background:${colors[height % colors.length]};transition:transform .3s;transform:scale(0)`;
      towerBox.appendChild(b);
      requestAnimationFrame(() => { b.style.transform = 'scale(1)'; });
    };
    const next = () => {
      if (!ctl.alive) return;
      if (height >= GOAL || total >= GOAL + 4) {
        return finish(ctl, hooks, correct, total, height >= GOAL ? starsBy(correct, total) : Math.min(1, starsBy(correct, total)), height >= GOAL ? 'Башня построена!' : 'Стройка окончена', `Высота башни: ${height} этажей 🏗`);
      }
      askMCQ(box, gen(), (r, p) => {
        total++;
        if (r) { correct++; height++; addBlock(); msg.textContent = 'Этаж №' + height + ' готов!'; msg.className = 'g-msg ok'; }
        else if (height > 0) { mistake(ctl, root, mcqText(p)); height--; towerBox.lastChild && towerBox.removeChild(towerBox.lastChild); msg.textContent = 'Ой! Этаж рухнул…'; msg.className = 'g-msg bad'; }
        else { mistake(ctl, root, mcqText(p)); msg.textContent = 'Фундамент не заложен…'; msg.className = 'g-msg bad'; }
        hooks.hud('🏗 ' + height);
        next();
      });
    };
    next();
  };

  /* ========== ПАМЯТЬ ========== */
  M.memory = (gen, root, hooks, ctl) => {
    const data = gen();
    const cards = [];
    data.pairs.forEach(([a, b], i) => { cards.push({ t: a, id: i }); cards.push({ t: b, id: i }); });
    const deck = window.Problems.shuffle(cards);
    let open = null, lock = false, found = 0, moves = 0;
    const wrap = el('div', 'g-wrap');
    const grid = el('div', 'mem-grid');
    wrap.appendChild(el('div', 'g-msg', 'Найди пары: выражение и его значение'));
    wrap.appendChild(grid); root.appendChild(wrap);
    deck.forEach(c => {
      const card = el('button', 'mem-card');
      const inner = el('div', 'mem-inner');
      inner.appendChild(el('div', 'mem-face mem-back', '?'));
      inner.appendChild(el('div', 'mem-face mem-front', c.t));
      card.appendChild(inner);
      card.onclick = () => {
        if (lock || card.classList.contains('open')) return;
        card.classList.add('open');
        if (!open) { open = { card, c }; return; }
        moves++;
        if (open.c.id === c.id) {
          card.classList.add('done'); open.card.classList.add('done');
          found++; open = null;
          hooks.hud('🎴 ' + found + '/' + data.pairs.length);
          if (found === data.pairs.length) {
            const stars = moves <= data.pairs.length + 2 ? 3 : moves <= data.pairs.length + 5 ? 2 : 1;
            ctl.later(() => finish(ctl, hooks, found, moves, stars, 'Все пары найдены!', `Ходов: ${moves}`), 600);
          }
        } else {
          lock = true;
          const prev = open; open = null;
          ctl.later(() => { card.classList.remove('open'); prev.card.classList.remove('open'); lock = false; }, 750);
        }
      };
      grid.appendChild(card);
    });
    hooks.hud('🎴 0/' + data.pairs.length);
  };

  /* ========== ПОРЯДОК ========== */
  M.order = (gen, root, hooks, ctl) => {
    const ROUNDS = 4;
    let round = 0, errors = 0;
    const wrap = el('div', 'g-wrap');
    const title = el('div', 'g-question');
    const done = el('div', 'ord-done');
    const poolEl = el('div', 'ord-pool');
    const msg = el('div', 'g-msg');
    wrap.appendChild(title); wrap.appendChild(done); wrap.appendChild(poolEl); wrap.appendChild(msg);
    root.appendChild(wrap);
    const next = () => {
      if (!ctl.alive) return;
      if (round >= ROUNDS) {
        const stars = errors === 0 ? 3 : errors <= 3 ? 2 : 1;
        return finish(ctl, hooks, ROUNDS * 5 - errors, ROUNDS * 5, stars, 'Всё по порядку!', `Ошибок: ${errors}`);
      }
      const d = gen();
      title.textContent = d.title;
      done.innerHTML = ''; poolEl.innerHTML = ''; msg.textContent = 'Нажимай от меньшего к большему';
      msg.className = 'g-msg';
      const sorted = d.items.slice().sort((a, b) => a.v - b.v);
      let idx = 0;
      d.items.forEach(it => {
        const chip = el('button', 'ord-chip', it.t);
        chip.onclick = () => {
          if (chip.classList.contains('used')) return;
          if (it.v === sorted[idx].v) {
            idx++;
            chip.classList.add('used');
            done.appendChild(el('div', 'ord-slot', it.t));
            hooks.hud('📶 ' + (round + 1) + '/' + ROUNDS);
            if (idx === sorted.length) { round++; ctl.later(next, 700); }
          } else { errors++; chip.classList.add('err'); vibrate(60); ctl.later(() => chip.classList.remove('err'), 350); }
        };
        poolEl.appendChild(chip);
      });
    };
    next();
  };

  /* ========== ВЕРНО / НЕВЕРНО ========== */
  M.tf = (gen, root, hooks, ctl) => {
    const GOAL = 12;
    let correct = 0, total = 0, streak = 0;
    const wrap = el('div', 'g-wrap');
    const bar = el('div', 'g-bar'); bar.appendChild(el('i')); bar.firstChild.style.width = '0%';
    const q = el('div', 'g-question');
    const streakEl = el('div', 'g-msg');
    const btns = el('div', 'tf-btns');
    const yes = el('button', 'tf-btn tf-yes', '✓ Верно');
    const no = el('button', 'tf-btn tf-no', '✗ Неверно');
    btns.appendChild(yes); btns.appendChild(no);
    wrap.appendChild(bar); wrap.appendChild(q); wrap.appendChild(streakEl); wrap.appendChild(btns);
    root.appendChild(wrap);
    let cur = null, lock = false;
    const next = () => {
      if (!ctl.alive) return;
      if (total >= GOAL) return finish(ctl, hooks, correct, total, undefined, 'Раунд окончен!', `Верно: ${correct} из ${total}`);
      cur = gen(); q.textContent = cur.q; lock = false;
    };
    const answer = v => {
      if (lock || !cur) return;
      lock = true; total++;
      const right = v === cur.truth;
      if (right) { correct++; streak++; streakEl.textContent = streak >= 3 ? '🔥 Серия: ' + streak : 'Верно!'; streakEl.className = 'g-msg ok'; }
      else { streak = 0; mistake(ctl, root, `${cur.q} — это ${cur.truth ? 'верно' : 'неверно'}`); streakEl.textContent = 'Не-а! ' + (cur.truth ? 'Это было верно' : 'Это было неверно'); streakEl.className = 'g-msg bad'; vibrate(60); }
      bar.firstChild.style.width = (total / GOAL * 100) + '%';
      hooks.hud('⭐ ' + correct);
      ctl.later(next, 550);
    };
    yes.onclick = () => answer(true);
    no.onclick = () => answer(false);
    next();
  };

  /* ========== ЧИСЛОВАЯ ПРЯМАЯ ========== */
  M.line = (gen, root, hooks, ctl) => {
    const ROUNDS = 7;
    let round = 0, correct = 0;
    const wrap = el('div', 'g-wrap');
    const q = el('div', 'g-question');
    const track = el('div', 'nl-track');
    const msg = el('div', 'g-msg');
    const check = el('button', 'btn btn-primary btn-wide', 'Проверить');
    wrap.appendChild(q); wrap.appendChild(track); wrap.appendChild(msg); wrap.appendChild(check);
    root.appendChild(wrap);
    let cur = null, pos = 0.5, target = null;
    const build = () => {
      track.innerHTML = '';
      track.appendChild(el('div', 'nl-line'));
      const n = 10;
      for (let i = 0; i <= n; i++) {
        const t = el('div', 'nl-tick'); t.style.left = (i / n * 100) + '%';
        track.appendChild(t);
        const lab = el('div', 'nl-lab', window.Problems.fmt(cur.min + (cur.max - cur.min) * i / n));
        lab.style.left = (i / n * 100) + '%';
        track.appendChild(lab);
      }
      target = el('div', 'nl-target', '●');
      pos = 0.5;
      target.style.left = '50%';
      track.appendChild(target);
      const move = clientX => {
        const r = track.getBoundingClientRect();
        pos = Math.min(1, Math.max(0, (clientX - r.left) / r.width));
        target.style.left = (pos * 100) + '%';
      };
      let drag = false;
      target.addEventListener('pointerdown', e => { drag = true; target.setPointerCapture(e.pointerId); });
      target.addEventListener('pointermove', e => { if (drag) move(e.clientX); });
      target.addEventListener('pointerup', () => { drag = false; });
      track.addEventListener('pointerdown', e => { if (e.target !== target) move(e.clientX); });
    };
    const next = () => {
      if (!ctl.alive) return;
      if (round >= ROUNDS) return finish(ctl, hooks, correct, ROUNDS, undefined, 'Прямая пройдена!', `Точных попаданий: ${correct} из ${ROUNDS}`);
      cur = gen(); q.textContent = cur.q; msg.textContent = 'Перетащи метку и нажми «Проверить»'; msg.className = 'g-msg';
      build();
      hooks.hud('📍 ' + round + '/' + ROUNDS);
    };
    check.onclick = () => {
      if (!cur) return;
      const val = cur.min + (cur.max - cur.min) * pos;
      const tol = (cur.max - cur.min) * 0.028; // строже: почти точное попадание
      round++;
      if (Math.abs(val - cur.val) <= tol) { correct++; msg.textContent = 'Точно! 🎯'; msg.className = 'g-msg ok'; }
      else { mistake(ctl, root, `${cur.q.replace('Где', '')} — это ${window.Problems.fmt(cur.val)}`); msg.textContent = `Мимо. Правильное место: ${window.Problems.fmt(cur.val)}`; msg.className = 'g-msg bad'; vibrate(60); }
      ctl.later(next, 900);
    };
    next();
  };

  /* ========== КОНСТРУКТОР ========== */
  M.build = (gen, root, hooks, ctl) => {
    const ROUNDS = 8;
    let round = 0, correct = 0;
    const wrap = el('div', 'g-wrap');
    const eq = el('div', 'bld-eq');
    const msg = el('div', 'g-msg', 'Выбери, что стоит на месте пропуска');
    const box = el('div', 'g-options');
    wrap.appendChild(el('div', 'g-center')).appendChild(eq);
    wrap.appendChild(msg); wrap.appendChild(box);
    root.appendChild(wrap);
    const next = () => {
      if (!ctl.alive) return;
      if (round >= ROUNDS) return finish(ctl, hooks, correct, ROUNDS, undefined, 'Собрано!', `Верно: ${correct} из ${ROUNDS}`);
      const p = gen();
      eq.innerHTML = ''; box.innerHTML = '';
      let hole = null;
      p.parts.forEach(part => {
        if (typeof part === 'object' && part.hole) { hole = el('span', 'bld-hole', '?'); eq.appendChild(hole); }
        else eq.appendChild(el('span', '', part));
      });
      let lock = false;
      p.opts.forEach(o => {
        const b = el('button', 'g-opt', o);
        b.onclick = () => {
          if (lock) return; lock = true; round++;
          hole.textContent = o; hole.classList.add('filled');
          if (o === p.a) { correct++; hole.classList.add('ok'); b.classList.add('right'); }
          else {
            mistake(ctl, root, p.parts.map(part => (typeof part === 'object' && part.hole) ? p.a : part).join(' '));
            hole.classList.add('bad'); b.classList.add('wrong'); vibrate(60);
            ctl.later(() => { hole.textContent = p.a; hole.classList.remove('bad'); hole.classList.add('ok'); }, 500);
          }
          hooks.hud('🧩 ' + correct);
          ctl.later(next, 950);
        };
        box.appendChild(b);
      });
    };
    next();
  };

  /* ========== CANVAS: инициализация + цикл с dt ========== */
  function setupCanvas(root, ctl) {
    const cv = el('canvas', 'g-canvas');
    cv.style.cssText = 'position:absolute;inset:0;width:100%;height:100%'; // точно по контейнеру
    root.appendChild(cv);
    const ctx = cv.getContext('2d');
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let W = 0, H = 0;
    const resize = () => {
      const r = root.getBoundingClientRect();
      W = r.width; H = r.height;
      cv.width = W * dpr; cv.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    requestAnimationFrame(resize);
    setTimeout(resize, 250); // страховка после окончательной раскладки
    window.addEventListener('resize', resize);
    const oldStop = ctl.stop;
    ctl.stop = () => { window.removeEventListener('resize', resize); oldStop(); };
    // цикл с дельтой времени (стабильно на слабом железе)
    const loop = frameFn => {
      let last = performance.now();
      const step = now => {
        if (!ctl.alive) return;
        const dt = Math.min((now - last) / 1000, 0.05);
        last = now;
        frameFn(dt);
        ctl.raf = requestAnimationFrame(step);
      };
      ctl.raf = requestAnimationFrame(step);
    };
    return { cv, ctx, size: () => ({ W, H }), loop };
  }

  function pill(ctx, x, y, text, bg, fg) {
    ctx.font = 'bold 15px Rubik,sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const w = ctx.measureText(text).width + 20;
    ctx.fillStyle = bg;
    ctx.beginPath();
    const h = 28, r = 12, lx = x - w / 2, ty = y - h / 2;
    ctx.moveTo(lx + r, ty);
    ctx.arcTo(lx + w, ty, lx + w, ty + h, r);
    ctx.arcTo(lx + w, ty + h, lx, ty + h, r);
    ctx.arcTo(lx, ty + h, lx, ty, r);
    ctx.arcTo(lx, ty, lx + w, ty, r);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = fg;
    ctx.fillText(text, x, y + 1);
  }

  /* ========== ГОНКА: скорость бота зависит от класса ========== */
  const BOT_NAMES = ['Турбо', 'Молния', 'Вжух', 'Ракета', 'Шумахер', 'Форсаж', 'Вихрь', 'Комета', 'Метеор', 'Зигзаг', 'Болид', 'Гонщик Гоша', 'Быстрый Боря', 'Синий', 'Профессор'];
  M.race = (gen, root, hooks, ctl, T) => {
    const NEED = 6; // верных ответов до финиша
    const botName = pick(BOT_NAMES);
    const wrap = el('div', 'g-wrap'); wrap.style.paddingBottom = '0';
    const box = el('div');
    wrap.appendChild(box);
    root.appendChild(wrap);
    const cvBox = el('div'); cvBox.style.cssText = 'height:190px;position:relative;flex:0 0 auto';
    root.appendChild(cvBox);
    const { ctx, size, loop } = setupCanvas(cvBox, ctl);
    let youX = 0, youTarget = 0, botX = 0, correct = 0, total = 0, over = false;
    let tAcc = 0, puffT = 0, puffs = [];
    const botSpeed = 1 / ((NEED + 1.5) * T.think); // бот финиширует чуть медленнее, чем ты при верных ответах в темпе T
    loop(dt => {
      const { W, H } = size();
      if (!W) return;
      tAcc += dt;
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = '#171728'; ctx.fillRect(0, 0, W, H);
      for (const y of [H * 0.32, H * 0.72]) {
        ctx.fillStyle = '#24243d'; ctx.fillRect(0, y - 24, W, 48);
        ctx.strokeStyle = '#3a3a5e'; ctx.setLineDash([14, 12]);
        ctx.lineDashOffset = -(tAcc * 70) % 26; // разметка бежит навстречу — видно движение
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
        ctx.setLineDash([]); ctx.lineDashOffset = 0;
      }
      ctx.fillStyle = '#ffc247'; ctx.fillRect(W - 26, H * 0.32 - 30, 5, H * 0.72 - H * 0.32 + 60);
      youX += (youTarget - youX) * Math.min(1, dt * 4);
      botX = Math.min(botX + botSpeed * dt, 1);
      const pad = 30, run = W - 70;
      const youPx = pad + youX * run, botPx = pad + botX * run;
      // выхлоп бота
      puffT += dt;
      if (puffT > 0.28 && !over) { puffT = 0; puffs.push({ x: botPx - 14, y: H * 0.72 + 8, ttl: 1 }); if (Math.abs(youTarget - youX) > 0.01) puffs.push({ x: youPx - 14, y: H * 0.32 + 8, ttl: 1 }); }
      puffs = puffs.filter(p => p.ttl > 0);
      for (const p of puffs) {
        p.ttl -= dt * 1.8; p.x -= dt * 30;
        ctx.globalAlpha = Math.max(p.ttl, 0) * 0.5;
        ctx.fillStyle = '#9a9ab8';
        ctx.beginPath(); ctx.arc(p.x, p.y, 5 + (1 - p.ttl) * 7, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
      }
      // машинки подпрыгивают, покачиваются, за ними — полосы скорости
      const drawCar = (emoji, x, y, phase) => {
        ctx.fillStyle = 'rgba(154,154,184,.5)';
        for (let i = 0; i < 3; i++) {
          const lx = x - 12 - i * 10 - (tAcc * 140 % 10);
          ctx.fillRect(lx, y - 8 + i * 7, 8, 2);
        }
        ctx.save();
        ctx.translate(x + 15, y);
        ctx.rotate(Math.sin(tAcc * 10 + phase) * 0.055);
        ctx.font = '30px serif'; ctx.textBaseline = 'middle'; ctx.textAlign = 'center';
        ctx.fillText(emoji, 0, Math.sin(tAcc * 11 + phase) * 2);
        ctx.restore();
      };
      drawCar('🚗', youPx, H * 0.32, 0);
      drawCar('🚙', botPx, H * 0.72, 2.2);
      ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
      ctx.font = '700 12px Rubik,sans-serif'; ctx.fillStyle = '#c7c7e0';
      ctx.fillText('Ты', 8, H * 0.32 - 26);
      ctx.fillText(botName, 8, H * 0.72 - 26);
      if (!over && (youX >= 0.99 || botX >= 1)) {
        over = true;
        const win = youX >= 0.99;
        ctl.later(() => finish(ctl, hooks, correct, Math.max(total, 1), win ? starsBy(correct, total) || 1 : 0, win ? 'Финиш! Ты первый! 🏁' : `${botName} приехал раньше…`, win ? `Верных ответов: ${correct}` : `${botName} обогнал тебя. Решай точнее — каждый верный ответ ускоряет машину!`), 400);
      }
    });
    const next = () => {
      if (!ctl.alive || over) return;
      askMCQ(box, gen(), (r, p) => { total++; if (r) { correct++; youTarget = Math.min(1, youTarget + 1 / NEED); } else mistake(ctl, root, mcqText(p)); hooks.hud('🏁 ' + correct + '/' + NEED); next(); }, 350);
    };
    next();
  };

  /* ========== ЛОВЕЦ: медленное падение по возрасту, ответы возвращаются ========== */
  M.catch = (gen, root, hooks, ctl, T) => {
    const GOAL = 8;
    const qEl = el('div', 'g-question'); qEl.style.padding = '14px 10px 4px';
    root.appendChild(qEl);
    const hint = el('div', 'g-msg', 'Двигай корзину и лови правильный ответ. Пропустил — он вернётся сверху!');
    root.appendChild(hint);
    const cvBox = el('div'); cvBox.style.cssText = 'flex:1;position:relative;min-height:280px';
    root.appendChild(cvBox);
    const { cv, ctx, size, loop } = setupCanvas(cvBox, ctl);
    const fallT = T.think; // секунд на полный пролёт экрана (чуть бодрее)
    let basketX = 0.5, drops = [], cur = null, correct = 0, total = 0, flash = 0;
    const lanes = [0.14, 0.38, 0.62, 0.86];
    const newRound = () => {
      cur = gen();
      qEl.textContent = cur.q;
      const xs = window.Problems.shuffle(lanes.slice());
      drops = cur.opts.map((o, i) => ({ o, x: xs[i], y: -0.04 - i * 0.17, fly: false }));
    };
    const move = clientX => {
      const r = cv.getBoundingClientRect();
      basketX = Math.min(0.94, Math.max(0.06, (clientX - r.left) / r.width));
    };
    cv.addEventListener('pointermove', e => move(e.clientX));
    // тап по числу — оно само летит в корзину; тап мимо — двигаем корзину
    cv.addEventListener('pointerdown', e => {
      const r = cv.getBoundingClientRect();
      const px = e.clientX - r.left, py = e.clientY - r.top;
      const { W, H } = size();
      let hit = false;
      if (W) for (const d of drops) {
        if (d.y > -0.02 && Math.abs(px - d.x * W) < 48 && Math.abs(py - d.y * H) < 28) { d.fly = true; hit = true; break; }
      }
      if (!hit) move(e.clientX);
    });
    newRound();
    loop(dt => {
      const { W, H } = size();
      if (!W) return;
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = '#171728'; ctx.fillRect(0, 0, W, H);
      const bx = basketX * W, by = H - 34;
      ctx.font = '34px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('🧺', bx, by);
      for (const d of drops) {
        if (d.fly) { // нажатое число летит прямо в корзину
          d.x += (basketX - d.x) * Math.min(1, dt * 9);
          d.y += (by / H - d.y) * Math.min(1, dt * 9);
        } else {
          d.y += dt / fallT;
          if (d.y > 1.06) { d.y = -0.06; d.x = pick(lanes); } // вернулся сверху — вопрос тот же
        }
        const dx = d.x * W, dy = d.y * H;
        pill(ctx, dx, dy, d.o, '#24243d', '#f2f2fa');
        if (dy > by - 26 && dy < by + 22 && Math.abs(dx - bx) < 46) {
          total++;
          if (d.o === cur.a) {
            correct++; flash = 1;
            hooks.hud('🧺 ' + correct + '/' + GOAL);
            if (correct >= GOAL) { finish(ctl, hooks, correct, total, undefined, 'Корзина полна!', `Поймано верных: ${correct} из ${total} попыток`); return; }
            newRound();
            break;
          } else {
            flash = -1; vibrate(60);
            mistake(ctl, cvBox, mcqText(cur));
            d.y = -0.06; d.x = pick(lanes); d.fly = false; // неверный улетает наверх, вопрос продолжается
            hooks.hud('🧺 ' + correct + '/' + GOAL);
          }
        }
      }
      if (flash) {
        ctx.fillStyle = flash > 0 ? 'rgba(61,220,132,.12)' : 'rgba(255,92,108,.12)';
        ctx.fillRect(0, 0, W, H);
        flash = flash > 0 ? Math.max(0, flash - dt * 3) : Math.min(0, flash + dt * 3);
      }
    });
    hooks.hud('🧺 0/' + GOAL);
  };

  /* ========== ТАП-МИРЫ: шары / космос / рыбалка (объекты по кругу) ========== */
  function tapWorld(theme) {
    return (gen, root, hooks, ctl, T) => {
      const GOAL = 10;
      const qEl = el('div', 'g-question'); qEl.style.padding = '14px 10px 4px';
      root.appendChild(qEl);
      const cvBox = el('div'); cvBox.style.cssText = 'flex:1;position:relative;min-height:280px';
      root.appendChild(cvBox);
      const { cv, ctx, size, loop } = setupCanvas(cvBox, ctl);
      const crossT = T.think * 1.2; // секунд на пролёт экрана
      let cur = null, objs = [], correct = 0, total = 0, effects = [];
      const newRound = () => {
        cur = gen(); qEl.textContent = cur.q;
        objs = cur.opts.map((o, i) => theme.spawn(o, (i + 0.5) / cur.opts.length, i));
      };
      cv.addEventListener('pointerdown', e => {
        const r = cv.getBoundingClientRect();
        const px = e.clientX - r.left, py = e.clientY - r.top;
        const { W, H } = size();
        for (const ob of objs) {
          if (Math.hypot(px - ob.x * W, py - ob.y * H) < 46) {
            total++;
            const right = ob.o === cur.a;
            effects.push({ x: ob.x, y: ob.y, t: 1, ok: right });
            if (right) {
              correct++;
              hooks.hud(theme.hud + ' ' + correct + '/' + GOAL);
              if (correct >= GOAL) {
                ctl.later(() => finish(ctl, hooks, correct, total, undefined, theme.winTitle, `Точность: ${Math.round(correct / total * 100)}%`), 350);
              } else newRound();
            } else {
              vibrate(60);
              mistake(ctl, cvBox, mcqText(cur));
              theme.reset(ob); // неверный объект отлетает в начало, вопрос остаётся
              hooks.hud(theme.hud + ' ' + correct + '/' + GOAL);
            }
            return;
          }
        }
      });
      newRound();
      loop(dt => {
        const { W, H } = size();
        if (!W) return;
        ctx.clearRect(0, 0, W, H);
        theme.bg(ctx, W, H);
        for (const ob of objs) {
          theme.move(ob, dt / crossT, dt);
          if (theme.gone(ob)) theme.reset(ob); // улетел — вернулся, вопрос тот же
          const ox = ob.x * W, oy = ob.y * H;
          theme.drawObj(ctx, ob, ox, oy);
          pill(ctx, ox, oy + (theme.labelDy || 0), ob.o, 'rgba(15,15,26,.72)', theme.labelColor || '#fff');
        }
        effects = effects.filter(f => f.t > 0);
        for (const f of effects) {
          f.t -= dt * 1.6;
          ctx.globalAlpha = Math.max(f.t, 0);
          ctx.font = '26px serif'; ctx.textAlign = 'center';
          ctx.fillText(f.ok ? '✨' : '❌', f.x * W, f.y * H - (1 - f.t) * 30);
          ctx.globalAlpha = 1;
        }
      });
      hooks.hud(theme.hud + ' 0/' + GOAL);
    };
  }

  M.pop = tapWorld({
    hud: '🎈', winTitle: 'Все шары лопнуты!',
    spawn: (o, lane) => ({ o, lane, x: lane + (Math.random() - 0.5) * 0.06, y: 1.03 + Math.random() * 0.12, wob: Math.random() * 6, hue: Math.floor(Math.random() * 360) }),
    reset: ob => { ob.y = 1.03 + Math.random() * 0.08; ob.x = ob.lane + (Math.random() - 0.5) * 0.06; },
    move: (ob, v) => { ob.y -= v; ob.x += Math.sin(ob.y * 9 + ob.wob) * 0.0008; },
    gone: ob => ob.y < -0.12,
    bg: (ctx, W, H) => { const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#1b2947'); g.addColorStop(1, '#171728'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); },
    drawObj: (ctx, ob, x, y) => {
      ctx.fillStyle = `hsl(${ob.hue} 75% 62%)`;
      ctx.beginPath(); ctx.ellipse(x, y, 36, 42, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.4)';
      ctx.beginPath(); ctx.moveTo(x, y + 42); ctx.quadraticCurveTo(x + 6, y + 60, x, y + 76); ctx.stroke();
    }
  });

  M.space = tapWorld({
    hud: '🚀', winTitle: 'Галактика спасена!',
    labelColor: '#ffe9c7',
    spawn: (o, lane) => ({ o, lane, x: 1.03 + Math.random() * 0.12, y: 0.14 + lane * 0.72, r: 30 + Math.random() * 8, spin: Math.random() * Math.PI }),
    reset: ob => { ob.x = 1.03 + Math.random() * 0.08; },
    move: (ob, v, dt) => { ob.x -= v; ob.spin += dt * 0.6; },
    gone: ob => ob.x < -0.1,
    bg: (ctx, W, H) => {
      ctx.fillStyle = '#0b0b1a'; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = 'rgba(255,255,255,.5)';
      for (let i = 0; i < 26; i++) ctx.fillRect((i * 137) % W, (i * 89) % H, 2, 2);
      ctx.font = '30px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('🚀', 26, H / 2);
    },
    drawObj: (ctx, ob, x, y) => {
      ctx.save(); ctx.translate(x, y); ctx.rotate(ob.spin);
      ctx.fillStyle = '#6b5c4a';
      ctx.beginPath();
      for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; const rr = ob.r * (0.85 + (i % 3) * 0.09); ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
      ctx.closePath(); ctx.fill();
      ctx.restore();
    }
  });

  M.fish = tapWorld({
    hud: '🎣', winTitle: 'Отличный улов!',
    labelColor: '#eaf6ff', labelDy: 30,
    spawn: (o, lane, i) => { const dir = i % 2 ? 1 : -1; return { o, lane, dir, x: dir > 0 ? -0.04 - Math.random() * 0.08 : 1.04 + Math.random() * 0.08, y: 0.16 + lane * 0.68, ph: Math.random() * 6 }; },
    reset: ob => { ob.x = ob.dir > 0 ? -0.06 : 1.06; },
    move: (ob, v, dt) => { ob.x += v * ob.dir; ob.y += Math.sin(ob.x * 10 + ob.ph) * dt * 0.05; },
    gone: ob => ob.x < -0.2 || ob.x > 1.2,
    bg: (ctx, W, H) => {
      const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#0e2a4a'); g.addColorStop(1, '#0a1a30');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = 'rgba(255,255,255,.08)';
      for (let i = 0; i < 8; i++) ctx.fillRect((i * 149) % W, (i * 97) % H, 3, 3);
    },
    drawObj: (ctx, ob, x, y) => {
      ctx.save(); ctx.translate(x, y);
      if (ob.dir < 0) ctx.scale(-1, 1);
      ctx.font = '36px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('🐠', 0, 0);
      ctx.restore();
    }
  });

  /* ========== публичный API ========== */
  window.Engine = {
    mechanics: Object.keys(M),
    start(mech, genId, root, hooks, opts) {
      root.innerHTML = '';
      const ctl = makeCtl();
      const grade = (opts && opts.grade) || 5;
      const T = { grade, think: 6 + grade * 1.1, goal: opts && opts.goal }; // 1 кл ≈ 7с на задачу, 11 кл ≈ 18с
      const raw = P()[genId];
      // анти-повтор: помним последние 6 примеров — они не выпадают снова
      let gen = raw;
      if (raw) {
        const recent = [];
        gen = () => {
          let p, key, tries = 0;
          do {
            p = raw();
            key = JSON.stringify(p.q || p.parts || p.pairs || (p.items && p.items.map(i => i.t)));
          } while (recent.includes(key) && ++tries < 25);
          recent.push(key);
          if (recent.length > 6) recent.shift();
          return p;
        };
      }
      if (!M[mech] || !raw) {
        root.appendChild(el('div', 'g-center', '<div class="g-bigico">🚧</div><p>Игра не найдена</p>'));
        return ctl;
      }
      try { M[mech](gen, root, hooks, ctl, T); }
      catch (e) { console.error(e); root.appendChild(el('div', 'g-center', '<div class="g-bigico">😵</div><p>Что-то пошло не так. Попробуй другую игру.</p>')); }
      return ctl;
    }
  };
})();
