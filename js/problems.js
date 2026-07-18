/* ===== МатЛэнд: генераторы задач по программе 1–11 классов =====
   Каждый генератор возвращает объект с полем kind:
   mcq   {q, a, opts[4]}            — вопрос с вариантами
   tf    {q, truth}                 — верно/неверно
   pairs {pairs:[[лево,право]...]}  — пары для «Памяти»
   order {title, items:[{t,v}...]}  — расставь по возрастанию
   line  {q, val, min, max}         — числовая прямая
   build {parts:[...], a, opts}     — вставь пропущенное
*/
(function () {
  const R = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];
  const shuffle = arr => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const fmt = n => (Math.round(n * 1000) / 1000).toString().replace('.', ',');
  // красивые степени: sup(23) -> ²³, sup(-3) -> ⁻³
  const SUPC = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', '-': '⁻' };
  const sup = n => String(n).split('').map(c => SUPC[c] || c).join('');

  // варианты-числа вокруг правильного ответа
  function numOpts(a, spread) {
    spread = spread || Math.max(2, Math.round(Math.abs(a) * 0.3));
    const set = new Set([a]);
    let guard = 0;
    while (set.size < 4 && guard++ < 200) {
      let d = R(1, spread) * (Math.random() < 0.5 ? -1 : 1);
      set.add(a + d);
    }
    while (set.size < 4) set.add(a + set.size * 7 + 1);
    return shuffle([...set]).map(fmt);
  }
  function mcq(q, a, opts) { return { kind: 'mcq', q, a: typeof a === 'number' ? fmt(a) : a, opts: opts || numOpts(a) }; }
  function strOpts(a, wrongs) {
    const uniq = [...new Set(wrongs.map(String))].filter(w => w !== String(a));
    return shuffle([a].concat(shuffle(uniq).slice(0, 3)));
  }

  // производные виды из mcq-генератора
  const toTf = genFn => () => {
    const p = genFn();
    const truth = Math.random() < 0.5;
    const shown = truth ? p.a : pick(p.opts.filter(o => o !== p.a));
    return { kind: 'tf', q: p.q + ' = ' + shown, truth };
  };
  const toPairs = (genFn, n) => () => {
    const seen = new Set(), pairs = [];
    let guard = 0;
    while (pairs.length < (n || 6) && guard++ < 300) {
      const p = genFn();
      if (seen.has(p.a) || seen.has(p.q)) continue;
      seen.add(p.a); seen.add(p.q);
      pairs.push([p.q, p.a]);
    }
    return { kind: 'pairs', pairs };
  };
  const orderOf = (title, itemFn, n) => () => {
    const set = new Map();
    let guard = 0;
    while (set.size < (n || 5) && guard++ < 300) {
      const it = itemFn();
      if (![...set.values()].some(v => v.v === it.v)) set.set(it.t, it);
    }
    return { kind: 'order', title, items: shuffle([...set.values()]) };
  };

  const G = {};

  /* ================= 1 КЛАСС: счёт до 20 ================= */
  G.g1_add10 = () => { const a = R(1, 9), b = R(1, 10 - a); return mcq(`${a} + ${b}`, a + b, numOpts(a + b, 3)); };
  G.g1_sub10 = () => { const a = R(2, 10), b = R(1, a - 1); return mcq(`${a} − ${b}`, a - b, numOpts(a - b, 3)); };
  G.g1_add20 = () => { const a = R(5, 15), b = R(1, 20 - a); return mcq(`${a} + ${b}`, a + b, numOpts(a + b, 3)); };
  G.g1_mix20 = () => Math.random() < 0.5 ? G.g1_add20() : (() => { const a = R(11, 20), b = R(1, 9); return mcq(`${a} − ${b}`, a - b, numOpts(a - b, 3)); })();
  G.g1_sostav = () => { const s = R(5, 10), a = R(1, s - 1); return Object.assign(mcq(`${a} + ? = ${s}`, s - a, numOpts(s - a, 3))); };
  G.g1_next = () => { const a = R(1, 18); return mcq(`Что идёт после ${a}?`, a + 1, numOpts(a + 1, 2)); };
  G.g1_updown = () => {
    const k = pick(['next', 'prev', 'between', 'mix', 'mix', 'sostav']);
    if (k === 'next') { const a = R(3, 18); return mcq(`Что идёт после ${a}?`, a + 1, numOpts(a + 1, 2)); }
    if (k === 'prev') { const a = R(3, 19); return mcq(`Что стоит перед ${a}?`, a - 1, numOpts(a - 1, 2)); }
    if (k === 'between') { const a = R(1, 17); return mcq(`Какое число между ${a} и ${a + 2}?`, a + 1, numOpts(a + 1, 2)); }
    if (k === 'sostav') { const s = R(6, 18), a = R(1, s - 1); return mcq(`${a} + ? = ${s}`, s - a, numOpts(s - a, 3)); }
    return G.g1_mix20();
  };
  G.g1_tf = () => { const a = R(1, 20), b = R(1, 20); const sign = pick(['>', '<']); const truth = sign === '>' ? a > b : a < b; return { kind: 'tf', q: `${a} ${sign} ${b}`, truth }; };
  G.g1_pairs = toPairs(G.g1_add10);
  G.g1_order = orderOf('Расставь числа по возрастанию', () => { const v = R(1, 20); return { t: '' + v, v }; });
  G.g1_line = () => { const v = R(1, 19); return { kind: 'line', q: `Где на прямой число ${v}?`, val: v, min: 0, max: 20 }; };
  G.g1_build = () => { const a = R(1, 9), b = R(1, 10 - a); return { kind: 'build', parts: [{ hole: true }, '+', '' + b, '=', '' + (a + b)], a: '' + a, opts: numOpts(a, 3) }; };

  /* ================= 2 КЛАСС: до 100, умножение 2–5 ================= */
  G.g2_add = () => { const a = R(15, 70), b = R(10, 99 - a); return mcq(`${a} + ${b}`, a + b, numOpts(a + b, 8)); };
  G.g2_sub = () => { const a = R(30, 99), b = R(10, a - 5); return mcq(`${a} − ${b}`, a - b, numOpts(a - b, 8)); };
  G.g2_mult = () => { const a = R(2, 5), b = R(2, 9); return mcq(`${a} × ${b}`, a * b, numOpts(a * b, 5)); };
  G.g2_mix = () => pick([G.g2_add, G.g2_sub, G.g2_mult])();
  G.g2_dvo = () => { const a = R(2, 9); return mcq(`${a} × 2`, a * 2, numOpts(a * 2, 4)); };
  G.g2_tf = toTf(G.g2_mult);
  G.g2_pairs = toPairs(G.g2_mult);
  G.g2_order = orderOf('Расставь по возрастанию', () => { const v = R(10, 99); return { t: '' + v, v }; });
  G.g2_line = () => { const v = R(1, 9) * 10 + pick([0, 5]); return { kind: 'line', q: `Где число ${v}?`, val: v, min: 0, max: 100 }; };
  G.g2_build = () => { const a = R(2, 5), b = R(2, 9); return { kind: 'build', parts: ['' + a, '×', { hole: true }, '=', '' + (a * b)], a: '' + b, opts: numOpts(b, 3) }; };

  /* ================= 3 КЛАСС: таблица умножения, деление ================= */
  G.g3_mult = () => { const a = R(2, 9), b = R(2, 9); return mcq(`${a} × ${b}`, a * b, numOpts(a * b, 7)); };
  G.g3_div = () => { const b = R(2, 9), c = R(2, 9); return mcq(`${b * c} ÷ ${b}`, c, numOpts(c, 3)); };
  G.g3_ops = () => { const a = R(2, 9), b = R(2, 9), c = R(1, 30); return Math.random() < 0.5 ? mcq(`${c} + ${a} × ${b}`, c + a * b, numOpts(c + a * b, 8)) : mcq(`${a} × ${b} − ${Math.min(c, a * b - 1)}`, a * b - Math.min(c, a * b - 1), numOpts(a * b - Math.min(c, a * b - 1), 8)); };
  G.g3_mix = () => pick([G.g3_mult, G.g3_div])();
  G.g3_per = () => { const a = R(2, 12), b = R(2, 12); return mcq(`Периметр прямоугольника ${a}×${b}`, 2 * (a + b), numOpts(2 * (a + b), 6)); };
  G.g3_mul10 = () => { const a = pick([20, 30, 40, 60, 80, 100, 200]), b = R(2, 4); return Math.random() < 0.5 ? mcq(`${a} × ${b}`, a * b, numOpts(a * b, a / 2)) : mcq(`${a * b} ÷ ${b}`, a, numOpts(a, a / 2)); };
  G.g3_tf = toTf(G.g3_mult);
  G.g3_pairs = toPairs(G.g3_mult);
  G.g3_order = orderOf('Расставь произведения по возрастанию', () => { const a = R(2, 9), b = R(2, 9); return { t: `${a}×${b}`, v: a * b }; });
  G.g3_build = () => {
    const a = R(2, 9), b = R(2, 9), pos = pick([0, 1, 2]);
    if (pos === 0) return { kind: 'build', parts: [{ hole: true }, '×', '' + b, '=', '' + a * b], a: '' + a, opts: numOpts(a, 3) };
    if (pos === 1) return { kind: 'build', parts: ['' + a, '×', { hole: true }, '=', '' + a * b], a: '' + b, opts: numOpts(b, 3) };
    return { kind: 'build', parts: ['' + a, '×', '' + b, '=', { hole: true }], a: '' + a * b, opts: numOpts(a * b, 6) };
  };

  /* ================= 4 КЛАСС: многозначные числа ================= */
  G.g4_add = () => { const a = R(120, 800), b = R(100, 999 - a > 100 ? 999 - a : 150); return mcq(`${a} + ${b}`, a + b, numOpts(a + b, 40)); };
  G.g4_sub = () => { const a = R(300, 999), b = R(100, a - 50); return mcq(`${a} − ${b}`, a - b, numOpts(a - b, 40)); };
  G.g4_mult = () => { const a = R(12, 99), b = R(3, 9); return mcq(`${a} × ${b}`, a * b, numOpts(a * b, 30)); };
  G.g4_div = () => { const b = R(3, 12), c = R(11, 40); return mcq(`${b * c} ÷ ${b}`, c, numOpts(c, 6)); };
  G.g4_ops = () => { const a = R(10, 40), b = R(3, 9), c = R(10, 99); return mcq(`(${a} + ${c}) × ${b}`, (a + c) * b, numOpts((a + c) * b, 50)); };
  G.g4_tf = toTf(G.g4_mult);
  G.g4_pairs = toPairs(G.g4_div);
  G.g4_order = orderOf('Расставь по возрастанию значений', () => {
    const k = pick(['plain', 'mul', 'sum']);
    if (k === 'mul') { const x = R(3, 90); return { t: `${x} × 100`, v: x * 100 }; }
    if (k === 'sum') { const a = R(100, 4900), b = R(10, 99) * 10; return { t: `${a} + ${b}`, v: a + b }; }
    const v = R(100, 9999); return { t: '' + v, v };
  });
  G.g4_line = () => { const v = R(3, 97) * 10; return { kind: 'line', q: `Где число ${v}?`, val: v, min: 0, max: 1000 }; };
  G.g4_build = () => { const a = R(12, 60), b = R(3, 9); return { kind: 'build', parts: ['' + a, '×', { hole: true }, '=', '' + a * b], a: '' + b, opts: numOpts(b, 3) }; };

  /* ================= 5 КЛАСС: дроби и десятичные ================= */
  G.g5_frac = () => {
    if (Math.random() < 0.4) {
      // разные, но кратные знаменатели — считать несложно: 1/2 + 1/4 = 3/4
      const [d1, d2] = pick([[2, 4], [3, 6], [2, 6], [4, 8], [5, 10], [2, 8], [3, 9], [2, 10]]);
      const a = R(1, d1 - 1), b = R(1, d2 - 1);
      const num = a * (d2 / d1) + b;
      const ans = `${num}/${d2}`;
      return mcq(`${a}/${d1} + ${b}/${d2}`, ans, strOpts(ans, [`${num + 1}/${d2}`, `${Math.max(1, num - 1)}/${d2}`, `${a + b}/${d2}`, `${a + b}/${d1 + d2}`, `${num + 2}/${d2}`]));
    }
    const d = pick([3, 4, 5, 7, 8, 9]), a = R(1, d - 2), b = R(1, d - a - 1);
    return mcq(`${a}/${d} + ${b}/${d}`, `${a + b}/${d}`, strOpts(`${a + b}/${d}`, [`${a + b + 1}/${d}`, `${Math.max(1, a + b - 1)}/${d}`, `${a + b}/${d + 1}`, `${a}/${d}`, `${a + b + 2}/${d}`]));
  };
  G.g5_dec = () => { const a = R(10, 90) / 10, b = R(10, 90) / 10; return Math.random() < 0.5 ? mcq(`${fmt(a)} + ${fmt(b)}`, Math.round((a + b) * 10) / 10) : mcq(`${fmt(Math.max(a, b))} − ${fmt(Math.min(a, b))}`, Math.round(Math.abs(a - b) * 10) / 10); };
  G.g5_pct = () => { const p = pick([10, 20, 25, 50]), n = pick([40, 60, 80, 100, 120, 200, 300]); return mcq(`${p}% от ${n}`, n * p / 100, numOpts(n * p / 100, 12)); };
  G.g5_decmul = () => { const a = R(2, 12) / 10, b = R(2, 9); return mcq(`${fmt(a)} × ${b}`, Math.round(a * b * 10) / 10); };
  G.g5_mix = () => pick([G.g5_dec, G.g5_pct])();
  G.g5_tf = () => { const d = pick([4, 5, 8, 10]), a = R(1, d - 1), b = R(1, d - 1); const truth = Math.random() < 0.5; const q = truth ? `${a}/${d} ${a > b ? '>' : a < b ? '<' : '='} ${b}/${d}` : `${a}/${d} ${a > b ? '<' : a < b ? '>' : '<'} ${b}/${d}`; return { kind: 'tf', q, truth }; };
  G.g5_pairs = toPairs(G.g5_pct);
  const FRACS = [['1/4', 0.25], ['1/3', 0.333], ['1/2', 0.5], ['2/3', 0.667], ['3/4', 0.75], ['1/5', 0.2], ['2/5', 0.4], ['3/5', 0.6], ['4/5', 0.8], ['1/6', 0.167], ['5/6', 0.833], ['1/8', 0.125], ['3/8', 0.375], ['5/8', 0.625], ['7/8', 0.875], ['5/12', 0.417], ['7/12', 0.583]];
  G.g5_order = orderOf('Расставь дроби по возрастанию', () => { const [t, v] = pick(FRACS); return { t, v }; });
  G.g5_line = () => { const d = pick([2, 4, 5, 8, 10]), a = R(1, d - 1); return { kind: 'line', q: `Где дробь ${a}/${d}?`, val: a / d, min: 0, max: 1 }; };
  G.g5_seq = () => {
    if (Math.random() < 0.5) { const a1 = R(2, 30), d = R(3, 12); return { kind: 'build', parts: [`${a1}, ${a1 + d}, ${a1 + 2 * d},`, { hole: true }, ', …'], a: '' + (a1 + 3 * d), opts: numOpts(a1 + 3 * d, 5) }; }
    const b1 = R(2, 5), q = pick([2, 3]); return { kind: 'build', parts: [`${b1}, ${b1 * q}, ${b1 * q * q},`, { hole: true }, ', …'], a: '' + b1 * q * q * q, opts: numOpts(b1 * q * q * q, Math.max(4, b1 * q * q)) };
  };
  G.g5_build = () => { const d = pick([5, 7, 9]), a = R(1, d - 2), b = R(1, d - a - 1); return { kind: 'build', parts: [`${a}/${d}`, '+', { hole: true }, '=', `${a + b}/${d}`], a: `${b}/${d}`, opts: strOpts(`${b}/${d}`, [`${b + 1}/${d}`, `${b}/${d + 1}`, `${Math.max(1, b - 1)}/${d}`, `${b + 2}/${d}`]) }; };

  /* ================= 6 КЛАСС: отрицательные числа, пропорции ================= */
  const neg = n => n < 0 ? `(${n})` : '' + n;
  G.g6_add = () => { const a = R(-20, 20), b = R(-20, 20); return mcq(`${a} + ${neg(b)}`, a + b, numOpts(a + b, 6)); };
  G.g6_sub = () => { const a = R(-20, 20), b = R(-20, 20); return mcq(`${a} − ${neg(b)}`, a - b, numOpts(a - b, 6)); };
  G.g6_mul = () => { const a = R(-9, 9) || 2, b = R(-9, 9) || 3; return mcq(`${a} × ${neg(b)}`, a * b, numOpts(a * b, 8)); };
  G.g6_mod = () => {
    const a = R(-15, 15), b = R(-15, 15) || 3;
    const k = pick(['sub', 'add', 'diff', 'plain']);
    if (k === 'sub') return mcq(`|${a} − ${neg(b)}|`, Math.abs(a - b), numOpts(Math.abs(a - b), 5));
    if (k === 'add') return mcq(`|${a} + ${neg(b)}|`, Math.abs(a + b), numOpts(Math.abs(a + b), 5));
    if (k === 'diff') return mcq(`|${a}| − |${b}|`, Math.abs(a) - Math.abs(b), numOpts(Math.abs(a) - Math.abs(b), 5));
    return mcq(`|${a}|`, Math.abs(a), numOpts(Math.abs(a), 5));
  };
  G.g6_pct = () => { const p = pick([5, 10, 15, 20, 25, 50, 75]), n = pick([40, 60, 80, 120, 160, 200, 400]); return mcq(`${p}% от ${n}`, n * p / 100, numOpts(n * p / 100, 15)); };
  G.g6_prop = () => { const k = R(2, 6), a = R(2, 9); return mcq(`${a} : ${a * k} = 3 : ?`, 3 * k, numOpts(3 * k, 5)); };
  G.g6_tf = () => { const a = R(-15, 15), b = R(-15, 15); const sign = pick(['>', '<']); const truth = sign === '>' ? a > b : a < b; return { kind: 'tf', q: `${a} ${sign} ${b}`, truth }; };
  G.g6_pairs = toPairs(G.g6_mul);
  G.g6_order = orderOf('Расставь по возрастанию', () => { const v = R(-20, 20); return { t: '' + v, v }; });
  G.g6_line = () => { const v = R(-9, 9); return { kind: 'line', q: `Где число ${v}?`, val: v, min: -10, max: 10 }; };
  G.g6_build = () => { const a = R(-9, 9) || 4, b = R(-9, 9) || -3; return { kind: 'build', parts: ['' + a, '+', { hole: true }, '=', '' + (a + b)], a: neg(b), opts: strOpts(neg(b), [neg(-b), neg(b + 1), neg(b - 1)]) }; };

  /* ================= 7 КЛАСС: уравнения, степени ================= */
  G.g7_eq = () => { const x = R(-9, 9) || 3, a = R(2, 9), b = R(-20, 20); return mcq(`${a}x ${b < 0 ? '−' : '+'} ${Math.abs(b)} = ${a * x + b},  x = ?`, x, numOpts(x, 4)); };
  G.g7_pow = () => { const a = pick([2, 3, 4, 5, 10]), n = a === 2 ? R(2, 6) : a === 10 ? R(2, 4) : R(2, 3); return mcq(`${a}${sup(n)}`, Math.pow(a, n), numOpts(Math.pow(a, n), Math.max(4, Math.pow(a, n) * 0.25))); };
  G.g7_powrule = () => { const a = R(2, 7), b = R(2, 7); return mcq(`x${sup(a)} · x${sup(b)} = xⁿ,  n = ?`, a + b, numOpts(a + b, 3)); };
  G.g7_expand = () => { const k = R(2, 6), a = R(1, 9); const ans = `${k}x + ${k * a}`; return mcq(`${k}(x + ${a})`, ans, strOpts(ans, [`${k}x + ${a}`, `${k}x + ${k + a}`, `${k + a}x`, `${k}x + ${k * a + k}`])); };
  G.g7_like = () => {
    const c = R(2, 6), a = c + R(1, 6), b = R(2, 12), d = R(2, 12);
    const kx = a - c, n = b + d;
    const ans = `${kx === 1 ? '' : kx}x + ${n}`;
    return mcq(`${a}x + ${b} − ${c}x + ${d}`, ans, strOpts(ans, [`${a + c}x + ${n}`, `${kx === 1 ? '' : kx}x + ${Math.abs(b - d) || n + 2}`, `${kx + 1}x + ${n}`, `${kx === 1 ? '' : kx}x + ${n + 1}`]));
  };
  G.g7_subst = () => { const x = R(-5, 5) || 2, a = R(2, 6), b = R(-9, 9); return mcq(`y = ${a}x ${b < 0 ? '−' : '+'} ${Math.abs(b)} при x = ${x}`, a * x + b, numOpts(a * x + b, 6)); };
  G.g7_tf = toTf(G.g7_pow);
  G.g7_pairs = toPairs(G.g7_pow);
  const POWS = [['2³', 8], ['2⁴', 16], ['2⁵', 32], ['2⁶', 64], ['2⁷', 128], ['3²', 9], ['3³', 27], ['3⁴', 81], ['5²', 25], ['5³', 125], ['6²', 36], ['7²', 49], ['10²', 100], ['4³', 64], ['2⁸', 256], ['3⁵', 243]];
  G.g7_order = orderOf('Расставь степени по возрастанию', () => { const [t, v] = pick(POWS); return { t, v }; });
  G.g7_build = () => { const x = R(2, 9), a = R(2, 6), b = (R(-15, 15) || 7); return { kind: 'build', parts: [`${a}x ${b < 0 ? '−' : '+'} ${Math.abs(b)} = ${a * x + b}`, '→ x =', { hole: true }], a: '' + x, opts: numOpts(x, 4) }; };

  /* ================= 8 КЛАСС: корни, квадратные уравнения ================= */
  G.g8_sqrt = () => { const a = R(2, 15); return mcq(`√${a * a}`, a, numOpts(a, 3)); };
  G.g8_quad = () => { const r = R(2, 9); return mcq(`x² = ${r * r},  x = ?`, r, numOpts(r, 3)); };
  G.g8_quad2 = () => { const p = R(1, 6), q = R(1, 6); const b = p + q, c = p * q; return mcq(`x² − ${b}x + ${c} = 0. Больший корень?`, Math.max(p, q), numOpts(Math.max(p, q), 3)); };
  G.g8_powneg = () => { const a = pick([2, 3, 4, 5, 10]), n = R(1, 2); const ans = `1/${Math.pow(a, n)}`; return mcq(`${a}${sup(-n)}`, ans, strOpts(ans, [`−${Math.pow(a, n)}`, `1/${Math.pow(a, n + 1)}`, `${Math.pow(a, n)}`, `−1/${Math.pow(a, n)}`])); };
  G.g8_sqrtmul = () => { const a = R(2, 6), b = R(2, 6); return mcq(`√${a * a} × √${b * b}`, a * b, numOpts(a * b, 6)); };
  G.g8_disc = () => { const b = R(2, 8), c = R(1, Math.floor(b * b / 4)); return mcq(`D для x² + ${b}x + ${c} = 0`, b * b - 4 * c, numOpts(b * b - 4 * c, 8)); };
  G.g8_tf = toTf(G.g8_sqrt);
  G.g8_pairs = toPairs(G.g8_sqrt);
  const ROOTS = [['√2', 1.414], ['√5', 2.236], ['2', 2], ['√8', 2.828], ['3', 3], ['√10', 3.162], ['4', 4], ['√20', 4.472], ['5', 5], ['√30', 5.477], ['6', 6], ['√40', 6.325], ['7', 7], ['√50', 7.071], ['√60', 7.746], ['√80', 8.944], ['9', 9], ['√90', 9.487]];
  G.g8_order = orderOf('Расставь по возрастанию (корни и числа!)', () => { const [t, v] = pick(ROOTS); return { t, v }; });
  G.g8_build = () => { const r = R(3, 12); return { kind: 'build', parts: ['√', { hole: true }, '=', '' + r], a: '' + r * r, opts: numOpts(r * r, Math.max(6, r)) }; };

  /* ================= 9 КЛАСС: прогрессии, функции ================= */
  G.g9_arith = () => { const a1 = R(1, 10), d = R(2, 7), n = R(4, 9); return mcq(`Арифм. прогрессия: a₁=${a1}, d=${d}. a${'₀₁₂₃₄₅₆₇₈₉'[n]} = ?`, a1 + d * (n - 1), numOpts(a1 + d * (n - 1), 8)); };
  G.g9_geom = () => { const b1 = pick([1, 2, 3]), q = pick([2, 3]), n = R(3, 5); return mcq(`Геом. прогрессия: b₁=${b1}, q=${q}. b${'₀₁₂₃₄₅₆₇₈₉'[n]} = ?`, b1 * Math.pow(q, n - 1), numOpts(b1 * Math.pow(q, n - 1), 10)); };
  G.g9_func = () => { const x = R(-4, 4), a = R(1, 3), b = R(-6, 6); return mcq(`f(x) = ${a}x² ${b < 0 ? '−' : '+'} ${Math.abs(b)}.  f(${x}) = ?`, a * x * x + b, numOpts(a * x * x + b, 7)); };
  G.g9_sys = () => { const x = R(1, 9), y = R(1, 9); return mcq(`x + y = ${x + y},  x − y = ${x - y}.  x = ?`, x, numOpts(x, 3)); };
  G.g9_sum = () => { const n = R(4, 10); return mcq(`1 + 2 + … + ${n}`, n * (n + 1) / 2, numOpts(n * (n + 1) / 2, 7)); };
  G.g9_root = () => { const k = R(2, 5), p = R(1, 8), q = R(1, 6); return mcq(`${k}(x − ${p}) = ${k * q},  x = ?`, p + q, numOpts(p + q, 4)); };
  G.g9_seq = () => {
    const kind = pick(['sq', 'tri', 'fib', 'dbl']);
    if (kind === 'sq') { const n = R(3, 8); return mcq(`Продолжи: ${((n - 3) ** 2) || 1}, ${(n - 2) ** 2}, ${(n - 1) ** 2}, ?`, n * n, numOpts(n * n, 6)); }
    if (kind === 'tri') { const n = R(4, 8); const t = k => k * (k + 1) / 2; return mcq(`Продолжи: ${t(n - 3)}, ${t(n - 2)}, ${t(n - 1)}, ?`, t(n), numOpts(t(n), 5)); }
    if (kind === 'fib') { let a = R(1, 3), b = R(2, 4); const s = [a, b, a + b, a + 2 * b]; return mcq(`Продолжи: ${s.join(', ')}, ?`, a + b + a + 2 * b, numOpts(2 * a + 3 * b, 4)); }
    const st = R(1, 5); return mcq(`Продолжи: ${st}, ${st * 2}, ${st * 4}, ?`, st * 8, numOpts(st * 8, 6));
  };
  G.g9_tf = () => {
    const x = R(-4, 4), a = R(1, 3), b = R(-6, 6);
    const val = a * x * x + b;
    const truth = Math.random() < 0.5;
    const shown = truth ? val : val + pick([-3, -2, -1, 1, 2, 3]);
    return { kind: 'tf', q: `f(x) = ${a}x² ${b < 0 ? '−' : '+'} ${Math.abs(b)}.  f(${x}) = ${shown}`, truth };
  };
  G.g9_pairs = toPairs(G.g9_sum);
  const MIXPOW = [['2⁵', 32], ['3³', 27], ['5²', 25], ['30', 30], ['2⁶', 64], ['4³', 64.001], ['70', 70], ['3⁴', 81], ['10²', 100], ['2⁷', 128], ['11²', 121], ['5³', 125], ['2⁴', 16], ['3²', 9], ['20', 20]];
  G.g9_order = orderOf('Что больше? Расставь по возрастанию', () => { const [t, v] = pick(MIXPOW); return { t, v }; });
  G.g9_build = () => {
    const k = pick(['geom', 'sq', 'alt']);
    if (k === 'geom') { const b1 = R(2, 6), q = pick([2, 3]); return { kind: 'build', parts: [`${b1}, ${b1 * q}, ${b1 * q * q},`, { hole: true }, ', …'], a: '' + b1 * q * q * q, opts: numOpts(b1 * q * q * q, Math.max(6, b1 * q * q)) }; }
    if (k === 'sq') { const n = R(2, 7); return { kind: 'build', parts: [`${n * n}, ${(n + 1) * (n + 1)}, ${(n + 2) * (n + 2)},`, { hole: true }, ', …'], a: '' + (n + 3) * (n + 3), opts: numOpts((n + 3) * (n + 3), 8) }; }
    const a1 = R(20, 60), d = R(3, 9); return { kind: 'build', parts: [`${a1}, ${a1 - d}, ${a1 - 2 * d},`, { hole: true }, ', …'], a: '' + (a1 - 3 * d), opts: numOpts(a1 - 3 * d, 5) };
  };

  /* ================= 10 КЛАСС: тригонометрия, логарифмы ================= */
  const TRIG = [
    ['sin 0°', '0'], ['sin 30°', '1/2'], ['sin 45°', '√2/2'], ['sin 60°', '√3/2'], ['sin 90°', '1'],
    ['cos 0°', '1'], ['cos 30°', '√3/2'], ['cos 45°', '√2/2'], ['cos 60°', '1/2'], ['cos 90°', '0'],
    ['tg 0°', '0'], ['tg 45°', '1'], ['tg 30°', '√3/3'], ['tg 60°', '√3']
  ];
  const TRIGVALS = ['0', '1/2', '√2/2', '√3/2', '1', '−1/2', '−1', '√3/3', '√3'];
  G.g10_trig = () => { const [q, a] = pick(TRIG); return mcq(q, a, strOpts(a, TRIGVALS.filter(v => v !== a))); };
  G.g10_log = () => { const b = pick([2, 3, 5, 10]), n = b === 2 ? R(1, 6) : b === 10 ? R(1, 4) : R(1, 3); const name = b === 10 ? 'lg' : 'log' + ({ 2: '₂', 3: '₃', 5: '₅' }[b]); return mcq(`${name} ${Math.pow(b, n)}`, n, numOpts(n, 2)); };
  G.g10_exp = () => { const b = pick([2, 3, 5]), n = b === 2 ? R(2, 7) : R(2, 4); return mcq(`${b}ˣ = ${Math.pow(b, n)},  x = ?`, n, numOpts(n, 2)); };
  G.g10_deg = () => { const pairs = [['π/6', '30°'], ['π/4', '45°'], ['π/3', '60°'], ['π/2', '90°'], ['2π/3', '120°'], ['3π/4', '135°'], ['5π/6', '150°'], ['π', '180°'], ['7π/6', '210°'], ['5π/4', '225°'], ['4π/3', '240°'], ['3π/2', '270°'], ['5π/3', '300°'], ['2π', '360°']]; const [q, a] = pick(pairs); return mcq(`${q} в градусах`, a, strOpts(a, pairs.map(p => p[1]).filter(v => v !== a))); };
  G.g10_logsum = () => { const b = 2, m = R(1, 4), n = R(1, 4); return mcq(`log₂${Math.pow(2, m)} + log₂${Math.pow(2, n)}`, m + n, numOpts(m + n, 2)); };
  const RADPAIRS = [['30°', 'π/6'], ['45°', 'π/4'], ['60°', 'π/3'], ['90°', 'π/2'], ['120°', '2π/3'], ['180°', 'π'], ['270°', '3π/2'], ['360°', '2π']];
  G.g10_rad = () => { const [q, a] = pick(RADPAIRS); return mcq(`${q} в радианах`, a, strOpts(a, RADPAIRS.map(p => p[1]).filter(v => v !== a))); };
  G.g10_tf = () => { const [q, a] = pick(TRIG); const truth = Math.random() < 0.5; const shown = truth ? a : pick(TRIGVALS.filter(v => v !== a)); return { kind: 'tf', q: `${q} = ${shown}`, truth }; };
  G.g10_pairs = () => {
    // в «Памяти» ответы-значения не должны повторяться, иначе пары неоднозначны
    const pool = shuffle(TRIG.slice());
    const seen = new Set(), out = [];
    for (const [q, a] of pool) { if (seen.has(a)) continue; seen.add(a); out.push([q, a]); if (out.length === 6) break; }
    return { kind: 'pairs', pairs: out };
  };
  G.g10_order = orderOf('Расставь по возрастанию', () => { const n = R(0, 6); const t = ['sin 0°', 'sin 30°', 'sin 45°', 'sin 60°', 'sin 90°', '√2', '2'][n]; const v = [0, 0.5, 0.707, 0.866, 1, 1.414, 2][n]; return { t, v }; });
  G.g10_build = () => {
    const b = pick([2, 2, 3, 5]), n = b === 2 ? R(2, 7) : b === 3 ? R(1, 4) : R(1, 3);
    const name = { 2: 'log₂', 3: 'log₃', 5: 'log₅' }[b];
    return { kind: 'build', parts: [name, { hole: true }, '=', '' + n], a: '' + Math.pow(b, n), opts: numOpts(Math.pow(b, n), Math.max(3, Math.pow(b, n) / 2)) };
  };

  /* ================= 11 КЛАСС: производные, интегралы ================= */
  G.g11_deriv = () => {
    if (Math.random() < 0.35) {
      const T = [['(sin x)′', 'cos x', ['−sin x', '−cos x', 'sin x', 'tg x']], ['(cos x)′', '−sin x', ['sin x', 'cos x', '−cos x', '1/x']], ['(eˣ)′', 'eˣ', ['x·eˣ', 'e', 'eˣ⁻¹', 'ln x']], ['(ln x)′', '1/x', ['ln x', 'x', '1/x²', 'eˣ']], ['(x)′', '1', ['x', '0', 'x²', '2x']], ['(5)′', '0', ['5', '1', 'x', '5x']]];
      const [q, a, w] = pick(T);
      return mcq(q, a, strOpts(a, w));
    }
    const n = R(2, 9);
    const A = n === 2 ? '2x' : `${n}x${sup(n - 1)}`;
    return mcq(`(x${sup(n)})′`, A, strOpts(A, [`${n}x${sup(n)}`, n === 2 ? 'x' : `x${sup(n - 1)}`, `${n - 1}x${sup(n - 1)}`, `${n + 1}x${sup(n)}`]));
  };
  G.g11_derval = () => { const a = R(1, 4), x = R(1, 5); return mcq(`f(x) = ${a === 1 ? '' : a}x².  f′(${x}) = ?`, 2 * a * x, numOpts(2 * a * x, 6)); };
  const INT = [['∫ x dx', 'x²/2 + C'], ['∫ x² dx', 'x³/3 + C'], ['∫ x³ dx', 'x⁴/4 + C'], ['∫ x⁴ dx', 'x⁵/5 + C'], ['∫ 2x dx', 'x² + C'], ['∫ 3x² dx', 'x³ + C'], ['∫ 4x³ dx', 'x⁴ + C'], ['∫ dx', 'x + C'], ['∫ 5 dx', '5x + C'], ['∫ cos x dx', 'sin x + C'], ['∫ sin x dx', '−cos x + C'], ['∫ eˣ dx', 'eˣ + C'], ['∫ 1/x dx', 'ln|x| + C'], ['∫ 2 dx', '2x + C'], ['∫ 6x dx', '3x² + C'], ['∫ 8x³ dx', '2x⁴ + C']];
  G.g11_int = () => { const [q, a] = pick(INT); return mcq(q, a, strOpts(a, INT.map(p => p[1]).filter(v => v !== a))); };
  G.g11_logeq = () => {
    const b = pick([2, 2, 3, 10]), n = b === 2 ? R(1, 7) : b === 3 ? R(1, 4) : R(1, 4);
    const name = b === 10 ? 'lg' : { 2: 'log₂', 3: 'log₃' }[b];
    return mcq(`${name} x = ${n},  x = ?`, Math.pow(b, n), numOpts(Math.pow(b, n), Math.max(3, Math.pow(b, n) / 2)));
  };
  G.g11_expeq = () => {
    const k = pick(['chain', 'lnmul', 'logmix', 'expeq', 'powdiv', 'negpow']);
    const a = R(2, 6), b = R(2, 4), c = R(2, 5);
    if (k === 'chain') return mcq(`e${sup(a)} · (e${sup(b)})${sup(c)} = eⁿ,  n = ?`, a + b * c, numOpts(a + b * c, 5));
    if (k === 'lnmul') return mcq(`ln(e${sup(a)} · e${sup(b)})`, a + b, numOpts(a + b, 3));
    if (k === 'logmix') { const m = R(2, 5), n2 = R(1, 4); return mcq(`log₂ ${Math.pow(2, m)} + log₃ ${Math.pow(3, n2)}`, m + n2, numOpts(m + n2, 3)); }
    if (k === 'expeq') return mcq(`eˣ · e${sup(b)} = e${sup(a + b)},  x = ?`, a, numOpts(a, 3));
    if (k === 'powdiv') return mcq(`(e${sup(a)})${sup(b)} / e${sup(c)} = eⁿ,  n = ?`, a * b - c, numOpts(a * b - c, 5));
    return mcq(`e${sup(a)} · e${sup(-b)} = eⁿ,  n = ?`, a - b, numOpts(a - b, 3));
  };
  G.g11_tang = () => {
    if (Math.random() < 0.5) { const x = R(1, 6); return mcq(`Угловой коэффициент касательной к y = x² в точке x = ${x}`, 2 * x, numOpts(2 * x, 3)); }
    const a = R(1, 3), x = R(1, 4), b = R(1, 9);
    return mcq(`Угловой коэффициент касательной к y = ${a === 1 ? '' : a}x² + ${b} в точке x = ${x}`, 2 * a * x, numOpts(2 * a * x, 4));
  };
  G.g11_tf = () => { const n = R(2, 5); const truth = Math.random() < 0.5; const q = truth ? `(x${sup(n)})′ = ${n}x${sup(n - 1)}` : `(x${sup(n)})′ = ${n}x${sup(n)}`; return { kind: 'tf', q, truth }; };
  G.g11_pairs = () => { const items = [['(x²)′', '2x'], ['(x³)′', '3x²'], ['(sin x)′', 'cos x'], ['(cos x)′', '−sin x'], ['(eˣ)′', 'eˣ'], ['(ln x)′', '1/x'], ['(x)′', '1'], ['(C)′', '0']]; return { kind: 'pairs', pairs: shuffle(items).slice(0, 6) }; };
  G.g11_order = orderOf('Расставь по возрастанию', () => { const n = R(0, 5); const t = ['ln 1', 'e⁰', 'e', 'e²', '10', '2e²'][n]; const v = [0, 1, 2.72, 7.39, 10, 14.78][n]; return { t, v }; });
  G.g11_build = () => { const n = R(2, 9); return { kind: 'build', parts: [`(x${sup(n)})′ =`, { hole: true }, n === 2 ? 'x' : `x${sup(n - 1)}`], a: '' + n, opts: numOpts(n, 3) }; };

  window.Problems = { gens: G, R, pick, shuffle, fmt };
})();
