/* ===== МатЛэнд: Telegram-бот продажи премиума =====
   Оплата через Telegram Stars (XTR) — работает сразу, без платёжного провайдера.
   После оплаты бот присылает промокод, который открывает премиум на сайте.

   Переменные окружения:
   BOT_TOKEN     — токен бота от @BotFather (обязательно)
   UNLOCK_CODE   — промокод, который бот выдаёт после оплаты (по умолчанию CHAMPION)
   STARS_PRICE   — цена в звёздах Telegram (по умолчанию 100)
   SITE_URL      — адрес сайта для кнопки (необязательно)

   Запуск: сам стартует внутри server.js, если задан BOT_TOKEN.
   Отдельно: node bot.js
*/
const TOKEN = process.env.BOT_TOKEN || '';
const API = 'https://api.telegram.org/bot' + TOKEN;
const UNLOCK_CODE = process.env.UNLOCK_CODE || 'CHAMPION';
const STARS_PRICE = Math.max(1, parseInt(process.env.STARS_PRICE, 10) || 100);
const SITE_URL = process.env.SITE_URL || '';

async function call(method, body) {
  const r = await fetch(API + '/' + method, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {})
  });
  return r.json();
}

async function handle(u) {
  try {
    // подтверждение перед оплатой — обязательно ответить за 10 секунд
    if (u.pre_checkout_query) {
      await call('answerPreCheckoutQuery', { pre_checkout_query_id: u.pre_checkout_query.id, ok: true });
      return;
    }
    const m = u.message;
    if (!m) return;
    // успешная оплата → выдаём промокод
    if (m.successful_payment) {
      await call('sendMessage', {
        chat_id: m.chat.id,
        text: `🎉 Оплата получена! Твой промокод премиума:\n\n<code>${UNLOCK_CODE}</code>\n\nВведи его на сайте МатЛэнд: кнопка «Промокод» в шапке — и все 33 премиум-игры откроются!${SITE_URL ? '\n\n' + SITE_URL : ''}`,
        parse_mode: 'HTML'
      });
      return;
    }
    const text = m.text || '';
    if (text.startsWith('/start') || text.startsWith('/buy')) {
      await call('sendMessage', {
        chat_id: m.chat.id,
        text: `👋 Привет! Это бот <b>МатЛэнд</b> — 110 игр по математике для 1–11 классов.\n\n👑 Премиум открывает 33 дополнительные игры во всех классах.\n\nНажми кнопку, чтобы купить за ${STARS_PRICE} ⭐ (Telegram Stars). После оплаты пришлю промокод.`,
        parse_mode: 'HTML'
      });
      await call('sendInvoice', {
        chat_id: m.chat.id,
        title: 'МатЛэнд: премиум-доступ',
        description: '33 премиум-игры для всех классов + поддержка проекта',
        payload: 'matland-premium',
        currency: 'XTR', // Telegram Stars — провайдер не нужен
        prices: [{ label: 'Премиум', amount: STARS_PRICE }]
      });
      return;
    }
    await call('sendMessage', { chat_id: m.chat.id, text: 'Напиши /buy, чтобы купить премиум-доступ 👑' });
  } catch (e) { console.error('bot handle error:', e.message); }
}

let running = false;
async function start() {
  if (!TOKEN) throw new Error('BOT_TOKEN не задан');
  if (running) return;
  running = true;
  let offset = 0;
  while (running) {
    try {
      const r = await call('getUpdates', { timeout: 50, offset, allowed_updates: ['message', 'pre_checkout_query'] });
      for (const u of r.result || []) {
        offset = u.update_id + 1;
        handle(u);
      }
      if (!r.ok) await new Promise(s => setTimeout(s, 3000));
    } catch (e) {
      await new Promise(s => setTimeout(s, 3000));
    }
  }
}

module.exports = { start };
if (require.main === module) start().catch(e => { console.error(e.message); process.exit(1); });
