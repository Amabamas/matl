/* ===== МатЛэнд: сервер (статика + API рейтинга) =====
   Хранилище — JSON-файл (DB_PATH). На Railway подключите Volume
   и укажите переменную DB_PATH=/data/db.json, чтобы рейтинг переживал редеплой. */
const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'data', 'db.json');
const REWARD_CODE = process.env.REWARD_CODE || 'CHAMPION'; // промокод для топ-3

// ---------- оплата (заполняются переменными окружения на Railway) ----------
const YK_SHOP_ID = process.env.YOOKASSA_SHOP_ID || '';   // shopId из ЮKassa
const YK_SECRET = process.env.YOOKASSA_SECRET || '';     // Secret Key из ЮKassa
const PREMIUM_PRICE = process.env.PREMIUM_PRICE || '199.00'; // цена в рублях
const SITE_URL = process.env.SITE_URL || '';             // публичный адрес сайта, напр. https://matland.up.railway.app
const TG_BOT_URL = process.env.TG_BOT_URL || '';         // ссылка на бота, напр. https://t.me/matland_bot
const YK_ENABLED = !!(YK_SHOP_ID && YK_SECRET);

// ---------- хранилище ----------
let db = { players: {}, scores: {}, likes: {}, pro: {}, payments: {} }; // pro[playerId]=1 — куплен премиум
try { db = JSON.parse(fs.readFileSync(DB_PATH, 'utf8')); } catch (e) {}
let saveTimer = null;
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
      fs.writeFileSync(DB_PATH, JSON.stringify(db));
    } catch (e) { console.error('save error:', e.message); }
  }, 300);
}

const clean = (s, n) => String(s || '').trim().slice(0, n || 40).replace(/[<>&"']/g, '');

// ---------- фильтр нецензурных слов ----------
const BAD_ROOTS = ['хуй', 'хуя', 'хуе', 'хуё', 'хуи', 'пизд', 'ебан', 'ебал', 'ебат', 'ебуч', 'ёбан', 'ёбл', 'заеб', 'заёб', 'уёб', 'ублюд', 'бля', 'мудак', 'мудил', 'гандон', 'гондон', 'пидор', 'пидар', 'пидр', 'педик', 'шлюх', 'дроч', 'залуп', 'мразь', 'сука', 'суки', 'сучк', 'говн', 'дерьм', 'жопа', 'жопу', 'срал', 'сран', 'еблан'];
const LOOKALIKE = { a: 'а', b: 'в', c: 'с', e: 'е', k: 'к', m: 'м', h: 'н', o: 'о', p: 'р', t: 'т', x: 'х', y: 'у', u: 'и', '0': 'о', '3': 'з', '4': 'ч', '6': 'б' };
function isProfane(s) {
  const norm = String(s || '').toLowerCase()
    .split('').map(c => LOOKALIKE[c] || c).join('')
    .replace(/[^а-яё]/g, '');
  return BAD_ROOTS.some(r => norm.includes(r));
}

// ---------- простая защита от спама ----------
const hits = new Map();
app.use('/api/', (req, res, next) => {
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '?';
  const now = Date.now();
  const h = hits.get(ip) || [];
  const recent = h.filter(t => now - t < 10000);
  recent.push(now);
  hits.set(ip, recent);
  if (recent.length > 40) return res.status(429).json({ error: 'Слишком часто. Подожди немного.' });
  next();
});

app.use(express.json({ limit: '8kb' }));

// ---------- API ----------
app.post('/api/score', (req, res) => {
  const { player, gameId, score, stars, time } = req.body || {};
  if (!player || !player.id || !gameId) return res.status(400).json({ error: 'bad request' });
  const id = clean(player.id, 64);
  if (!/^[\w-]{8,64}$/.test(id)) return res.status(400).json({ error: 'bad id' });
  const name = clean(player.name), surname = clean(player.surname);
  if (!name || !surname) return res.status(400).json({ error: 'no name' });
  if ([name, surname, player.city, player.school].some(isProfane)) return res.status(400).json({ error: 'profanity' });
  db.players[id] = {
    name, surname,
    city: clean(player.city, 60),
    school: clean(player.school, 80),
    grade: Math.max(1, Math.min(11, Math.round(+player.grade) || 1))
  };
  const gid = clean(gameId, 16);
  if (!db.scores[gid]) db.scores[gid] = {};
  const s = Math.max(0, Math.min(100000, Math.round(+score) || 0));
  const st = Math.max(0, Math.min(3, Math.round(+stars) || 0));
  const tm = Math.max(0, Math.min(36000, Math.round(+time) || 0));
  const prev = db.scores[gid][id];
  if (!prev || s > prev.score || (s === prev.score && st > prev.stars)) {
    db.scores[gid][id] = { score: s, stars: st, time: tm, at: Date.now() };
  }
  save();
  res.json({ ok: true });
});

app.get('/api/leaderboard/:gameId', (req, res) => {
  const gid = clean(req.params.gameId, 16);
  const g = db.scores[gid] || {};
  const rows = Object.entries(g)
    .map(([pid, v]) => Object.assign({ pid }, v, db.players[pid] || {}))
    .filter(r => r.name)
    .sort((a, b) => b.score - a.score || b.stars - a.stars || a.at - b.at);
  const me = clean(req.query.player || '', 64);
  const myIdx = rows.findIndex(r => r.pid === me);
  res.json({
    total: rows.length,
    top: rows.slice(0, 20).map((r, i) => ({
      rank: i + 1, name: r.name, surname: r.surname, city: r.city,
      school: r.school, grade: r.grade, score: r.score, stars: r.stars,
      time: r.time || 0, me: r.pid === me
    })),
    me: myIdx >= 0 ? { rank: myIdx + 1, score: rows[myIdx].score, stars: rows[myIdx].stars, time: rows[myIdx].time || 0 } : null,
    reward: myIdx > -1 && myIdx < 3 ? REWARD_CODE : null
  });
});

// ---------- оплата ----------
app.get('/api/config', (req, res) => {
  res.json({ yookassa: YK_ENABLED, telegram: TG_BOT_URL || null, price: YK_ENABLED ? PREMIUM_PRICE : null });
});

// создать платёж в ЮKassa → вернуть ссылку на страницу оплаты (там есть СБП)
app.post('/api/pay/create', async (req, res) => {
  if (!YK_ENABLED) return res.status(503).json({ error: 'Оплата ещё не настроена' });
  const id = clean(req.body && req.body.player && req.body.player.id, 64);
  if (!/^[\w-]{8,64}$/.test(id)) return res.status(400).json({ error: 'bad id' });
  const returnUrl = (SITE_URL || `${req.protocol}://${req.get('host')}`) + '/?paid=1';
  try {
    const r = await fetch('https://api.yookassa.ru/v3/payments', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotence-Key': id + '-' + Date.now(),
        'Authorization': 'Basic ' + Buffer.from(YK_SHOP_ID + ':' + YK_SECRET).toString('base64')
      },
      body: JSON.stringify({
        amount: { value: PREMIUM_PRICE, currency: 'RUB' },
        capture: true,
        confirmation: { type: 'redirect', return_url: returnUrl },
        description: 'МатЛэнд: премиум-доступ (33 игры)',
        metadata: { playerId: id }
      })
    });
    const j = await r.json();
    if (j.confirmation && j.confirmation.confirmation_url) {
      db.payments[j.id] = id; save();
      res.json({ url: j.confirmation.confirmation_url });
    } else {
      console.error('yookassa error:', JSON.stringify(j));
      res.status(502).json({ error: 'ЮKassa не приняла платёж. Попробуйте позже.' });
    }
  } catch (e) { res.status(502).json({ error: 'Нет связи с ЮKassa' }); }
});

// вебхук ЮKassa: в личном кабинете укажите URL <сайт>/api/pay/webhook, событие payment.succeeded
app.post('/api/pay/webhook', (req, res) => {
  const b = req.body || {};
  if (b.event === 'payment.succeeded' && b.object) {
    const pid = (b.object.metadata && b.object.metadata.playerId) || db.payments[b.object.id];
    if (pid) { db.pro[pid] = 1; save(); }
  }
  res.json({ ok: true });
});

app.get('/api/pay/status', (req, res) => {
  const me = clean(req.query.player || '', 64);
  res.json({ pro: !!db.pro[me] });
});

// ---------- лайки ----------
app.post('/api/like', (req, res) => {
  const { player, gameId } = req.body || {};
  const id = clean(player && player.id, 64);
  const gid = clean(gameId, 16);
  if (!/^[\w-]{8,64}$/.test(id) || !gid) return res.status(400).json({ error: 'bad request' });
  if (!db.likes[gid]) db.likes[gid] = {};
  let liked;
  if (db.likes[gid][id]) { delete db.likes[gid][id]; liked = false; }
  else { db.likes[gid][id] = 1; liked = true; }
  save();
  res.json({ liked, count: Object.keys(db.likes[gid]).length });
});

app.get('/api/likes', (req, res) => {
  const me = clean(req.query.player || '', 64);
  const counts = {}, mine = [];
  for (const [gid, users] of Object.entries(db.likes)) {
    counts[gid] = Object.keys(users).length;
    if (me && users[me]) mine.push(gid);
  }
  res.json({ counts, mine });
});

// ---------- статика ----------
app.use(express.static(__dirname, { maxAge: '1h', extensions: ['html'] }));

app.listen(PORT, () => console.log('МатЛэнд запущен: http://localhost:' + PORT));

// Telegram-бот продажи премиума (запускается, если задан BOT_TOKEN)
if (process.env.BOT_TOKEN) {
  try { require('./bot').start(); console.log('Telegram-бот запущен'); }
  catch (e) { console.error('Бот не запустился:', e.message); }
}
